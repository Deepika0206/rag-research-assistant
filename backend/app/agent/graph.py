import operator
from typing import Annotated, TypedDict

from langgraph.graph import END, START, StateGraph

from app.agent.critic import check_draft
from app.agent.drafter import make_draft
from app.agent.planner import make_plan
from app.agent.refiner import make_refined_query
from app.agent.synthesizer import synthesize
from app.config import MAX_REFINEMENTS
from app.llm import call_llm


class AgentState(TypedDict, total=False):
    question: str
    topic: str | None
    collection_id: str | None
    subsection_id: str | None
    query_type: str
    sub_questions: list[str]
    idx: int
    current_query: str
    queries_tried: list[str]
    refinements: int
    current_chunks: list[dict]
    current_draft: dict
    current_verdict: dict
    final: dict
    sub_results: Annotated[list[dict], operator.add]   # append
    trace: Annotated[list[dict], operator.add]         # append


def build_graph(retriever, llm=call_llm):
    retrieval_mode = getattr(retriever, "mode", "pgvector+bm25+crossencoder")

    def planner_node(state: AgentState) -> dict:
        plan = make_plan(state["question"], llm)
        first = plan["sub_questions"][0]
        return {
            "query_type": plan["query_type"],
            "sub_questions": plan["sub_questions"],
            "idx": 0,
            "current_query": first,
            "queries_tried": [first],
            "refinements": 0,
            "trace": [{"step": "planner", "query_type": plan["query_type"],
                       "sub_questions": plan["sub_questions"], "fallback": plan["fallback"]}],
        }

    def retrieve_node(state: AgentState) -> dict:
        query = state["current_query"]
        search_kwargs: dict = {"topic": state.get("topic")}
        if state.get("collection_id"):
            search_kwargs["collection_id"] = state["collection_id"]
        if state.get("subsection_id"):
            search_kwargs["subsection_id"] = state["subsection_id"]
        chunks = retriever.search(query, **search_kwargs)
        return {
            "current_chunks": chunks,
            "trace": [{"step": "retrieve", "sub_question": state["sub_questions"][state["idx"]],
                       "query": query, "attempt": state["refinements"] + 1,
                       "mode": retrieval_mode,
                       "chunks": [{"chunk_id": c["chunk_id"], "doc": c["doc"],
                                   "score": round(c["rerank_score"], 3)} for c in chunks]}],
        }

    def draft_node(state: AgentState) -> dict:
        sub_q = state["sub_questions"][state["idx"]]
        draft = make_draft(sub_q, state["current_chunks"], llm)
        return {"current_draft": draft,
                "trace": [{"step": "draft", "claims": draft["claims"], "missing": draft["missing"],
                           "dropped_ids": draft["dropped_ids"], "parse_error": draft["parse_error"]}]}

    def critique_node(state: AgentState) -> dict:
        verdict = check_draft(state["current_draft"], state["current_chunks"], llm)
        return {"current_verdict": verdict,
                "trace": [{"step": "critique", "passed": verdict["passed"],
                           "verdicts": verdict["verdicts"], "incomplete": verdict["incomplete"],
                           "critic_error": verdict["critic_error"]}]}

    def refine_node(state: AgentState) -> dict:
        sub_q = state["sub_questions"][state["idx"]]
        new_query = make_refined_query(sub_q, state["current_draft"], state["current_verdict"],
                                       state["queries_tried"], llm)
        return {"current_query": new_query,
                "queries_tried": state["queries_tried"] + [new_query],
                "refinements": state["refinements"] + 1,
                "trace": [{"step": "refine", "new_query": new_query,
                           "refinement": state["refinements"] + 1}]}

    def advance_node(state: AgentState) -> dict:
        idx = state["idx"]
        sub_q = state["sub_questions"][idx]
        draft, verdict, chunks = state["current_draft"], state["current_verdict"], state["current_chunks"]
        passed = verdict["passed"]
        kept_claims = draft["claims"] if passed else [
            c for c, v in zip(draft["claims"], verdict["verdicts"]) if v["supported"]
        ]
        if passed:
            status = "answered"
        elif kept_claims:
            status = "partial"
        else:
            status = "evidence_insufficient"
        item = {
            "sub_question": sub_q,
            "status": status,
            "claims": kept_claims,
            "rejected": [] if passed else [v for v in verdict["verdicts"] if not v["supported"]],
            "missing": "" if passed else draft["missing"],
            "chunks": chunks,
            "refinements": state["refinements"],
            "queries_tried": state["queries_tried"],
        }
        nxt = idx + 1
        next_query = state["sub_questions"][nxt] if nxt < len(state["sub_questions"]) else ""
        return {"sub_results": [item], "idx": nxt, "current_query": next_query,
                "queries_tried": [next_query] if next_query else [], "refinements": 0,
                "trace": [{"step": "sub_result", "sub_question": sub_q, "status": status,
                           "refinements": item["refinements"]}]}

    def synthesize_node(state: AgentState) -> dict:
        final = synthesize(state["question"], state["sub_results"], llm)
        return {"final": final,
                "trace": [{"step": "synthesize", "status": final["status"], "mode": final["synthesis"],
                           "n_sentences": len(final["sentences"]),
                           "dropped_sentences": final["dropped_sentences"],
                           "relations": [r["text"] for r in final["relations"]]}]}

    def route_after_critique(state: AgentState) -> str:
        if state["current_verdict"]["passed"] or state["refinements"] >= MAX_REFINEMENTS:
            return "advance"
        return "refine"

    def route_next(state: AgentState) -> str:
        return "retrieve" if state["idx"] < len(state["sub_questions"]) else "synthesize"

    b = StateGraph(AgentState)
    for name, fn in [("planner", planner_node), ("retrieve", retrieve_node), ("draft", draft_node),
                     ("critique", critique_node), ("refine", refine_node), ("advance", advance_node),
                     ("synthesize", synthesize_node)]:
        b.add_node(name, fn)
    b.add_edge(START, "planner")
    b.add_edge("planner", "retrieve")
    b.add_edge("retrieve", "draft")
    b.add_edge("draft", "critique")
    b.add_conditional_edges("critique", route_after_critique, {"advance": "advance", "refine": "refine"})
    b.add_edge("refine", "retrieve")
    b.add_conditional_edges("advance", route_next, {"retrieve": "retrieve", "synthesize": "synthesize"})
    b.add_edge("synthesize", END)
    return b.compile()


def run_agent(
    graph,
    question: str,
    topic: str | None = None,
    collection_id: str | None = None,
    subsection_id: str | None = None,
) -> dict:
    # Worst case: 3 sub-questions x 12 steps + planner = 37 steps. The limit of 60 is safe.
    initial_state: AgentState = {
        "question": question,
        "topic": topic,
        "sub_results": [],
        "trace": [],
    }
    if collection_id is not None:
        initial_state["collection_id"] = collection_id
    if subsection_id is not None:
        initial_state["subsection_id"] = subsection_id
    return graph.invoke(initial_state, {"recursion_limit": 60})

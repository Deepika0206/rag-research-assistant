import json

from app.agent.critic import CRITIC_SYSTEM
from app.agent.drafter import DRAFTER_SYSTEM
from app.agent.graph import build_graph, run_agent
from app.agent.planner import PLANNER_SYSTEM
from app.agent.refiner import REFINER_SYSTEM


class FakeRetriever:
    def __init__(self):
        self.queries = []

    def search(self, query, topic=None, k=5):
        self.queries.append(query)
        return [{"chunk_id": 1, "topic": "dp", "doc": "dp/a.md",
                 "text": "Memoization stores results.", "rerank_score": 1.0}]


def make_llm(critic_passes):
    """critic_passes: one bool per Critic call. The last value repeats."""
    calls = {"draft": 0, "critic": 0, "refine": 0}

    def llm(system, user, max_tokens=1000, temperature=0.0):
        if system == PLANNER_SYSTEM:
            return json.dumps({"query_type": "single_hop", "sub_questions": ["What is memoization?"]})
        if system == DRAFTER_SYSTEM:
            calls["draft"] += 1
            return json.dumps({"claims": [{"text": "Memoization stores results.", "chunk_ids": [1]}],
                               "missing": ""})
        if system == CRITIC_SYSTEM:
            ok = critic_passes[min(calls["critic"], len(critic_passes) - 1)]
            calls["critic"] += 1
            return json.dumps({"verdicts": [{"index": 0, "supported": ok, "reason": "test"}]})
        if system == REFINER_SYSTEM:
            calls["refine"] += 1
            return f"new query {calls['refine']}"
        raise AssertionError("unknown stage")

    return llm, calls


def run(critic_passes):
    retriever = FakeRetriever()
    llm, calls = make_llm(critic_passes)
    out = run_agent(build_graph(retriever, llm=llm), "What is memoization?")
    return out, calls, retriever


def test_passes_first_time():
    out, calls, _ = run([True])
    r = out["sub_results"][0]
    assert r["status"] == "answered" and r["refinements"] == 0 and calls["draft"] == 1


def test_passes_after_one_refinement():
    out, calls, retriever = run([False, True])
    r = out["sub_results"][0]
    assert r["status"] == "answered" and r["refinements"] == 1
    assert calls["draft"] == 2
    assert retriever.queries == ["What is memoization?", "new query 1"]


def test_gives_up_after_two_refinements():
    out, calls, retriever = run([False])
    r = out["sub_results"][0]
    assert r["status"] == "evidence_insufficient" and r["claims"] == []
    assert r["refinements"] == 2
    assert calls["draft"] == 3 and calls["refine"] == 2 and len(retriever.queries) == 3


def test_partial_keeps_supported_claims_after_max_refinements():
    retriever = FakeRetriever()

    def llm(system, user, max_tokens=1000, temperature=0.0):
        if system == PLANNER_SYSTEM:
            return json.dumps({"query_type": "single_hop", "sub_questions": ["What is memoization?"]})
        if system == DRAFTER_SYSTEM:
            return json.dumps({
                "claims": [
                    {"text": "Memoization stores results.", "chunk_ids": [1]},
                    {"text": "Memoization requires O(1) space.", "chunk_ids": [1]},
                ],
                "missing": "Space bound not fully stated.",
            })
        if system == CRITIC_SYSTEM:
            return json.dumps({"verdicts": [
                {"index": 0, "supported": True, "reason": "stated"},
                {"index": 1, "supported": False, "reason": "not stated"},
            ]})
        if system == REFINER_SYSTEM:
            return "memoization space complexity"
        raise AssertionError("unknown stage")

    out = run_agent(build_graph(retriever, llm=llm), "What is memoization?")
    r = out["sub_results"][0]
    assert r["status"] == "partial"
    assert len(r["claims"]) == 1 and r["claims"][0]["text"] == "Memoization stores results."
    assert len(r["rejected"]) == 1
    assert out["final"]["status"] == "partial"
    assert "Memoization stores results." in out["final"]["answer"]
    assert "Memoization requires O(1) space." not in out["final"]["answer"]




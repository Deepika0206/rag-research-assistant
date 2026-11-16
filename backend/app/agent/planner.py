from app.agent.utils import extract_json
from app.llm import call_llm

MAX_SUBQ = 3

PLANNER_SYSTEM = """You are the Planner for a question-answering system over a private set of study notes.
The notes cover five topics: searching, sorting, graphs, dp (dynamic programming), trees.

Your job:
1. Decide if the question is "single_hop" or "multi_hop".
   - single_hop: one search of the notes can answer it.
   - multi_hop: it needs facts about 2 or more techniques, topics, or documents.
     Words like compare, contrast, differentiate, distinguish, "differences between", relate,
     "which topics use both", or "across my notes" are strong signals.
2. If single_hop, return exactly one sub-question: the original question.
3. If multi_hop, split it into 2 or 3 sub-questions.
   - Each sub-question must make sense on its own. Do not use words like "it", "both", or "the former".
   - Keep the key technical terms from the question.
   - Each sub-question must ask for facts that can be found by searching the notes.
     Never write a sub-question that only combines the answers of the other sub-questions.
   - Never answer the question yourself. Do not write a sub-question that repeats another one.

Reply with JSON only. No other text. Use this shape:
{"query_type": "single_hop", "sub_questions": ["..."]}

Example:
Question: How do BFS and DFS differ in the notes?
{"query_type": "multi_hop", "sub_questions": ["How does breadth-first search (BFS) work and when is it used?", "How does depth-first search (DFS) work and when is it used?"]}

Example:
Question: What is memoization?
{"query_type": "single_hop", "sub_questions": ["What is memoization?"]}"""


def parse_plan(text: str, question: str) -> dict:
    """Turn the model reply into a safe plan. This function never raises an error."""
    fallback = {"query_type": "single_hop", "sub_questions": [question], "fallback": True}

    data = extract_json(text)
    if not isinstance(data, dict):
        return fallback

    subs = data.get("sub_questions")
    if not isinstance(subs, list):
        return fallback

    seen, unique = set(), []
    for s in subs:
        if isinstance(s, str) and s.strip() and s.strip().lower() not in seen:
            seen.add(s.strip().lower())
            unique.append(s.strip())
    if not unique:
        return fallback

    if data.get("query_type") == "single_hop" or len(unique) < 2:
        return {"query_type": "single_hop", "sub_questions": [question], "fallback": False}

    return {"query_type": "multi_hop", "sub_questions": unique[:MAX_SUBQ], "fallback": False}


def make_plan(question: str, llm=call_llm) -> dict:
    reply = llm(PLANNER_SYSTEM, f"Question: {question}", max_tokens=400)
    return parse_plan(reply, question)

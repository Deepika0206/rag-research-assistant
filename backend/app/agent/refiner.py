from app.llm import call_llm

REFINER_SYSTEM = """You write a better search query for a search engine over study notes.
You get: the sub-question, the earlier search queries, the claims that the checker rejected (with reasons), and a note about what was missing.
Write ONE new search query that is likely to find the missing evidence.

Rules:
- Use different words from the earlier queries. Try a synonym, a more specific term, or a more general term.
- Keep the key technical terms.
- Write one line, at most 25 words. Reply with the query only."""


def clean_query(text: str, tried: list[str], fallback: str) -> str:
    lines = text.strip().splitlines()
    q = lines[0].strip().strip("\"'`")[:200] if lines else ""
    if not q or q.lower() in {t.lower() for t in tried}:
        return fallback
    return q


def make_refined_query(sub_question: str, draft: dict, verdict: dict,
                       tried: list[str], llm=call_llm) -> str:
    rejected = [f'- "{v["claim"]}" ({v["reason"]})' for v in verdict["verdicts"] if not v["supported"]]
    user = (
        f"Sub-question: {sub_question}\n"
        f"Earlier queries: {tried}\n"
        f"Rejected claims:\n{chr(10).join(rejected) or '- (the draft had no claims)'}\n"
        f"Missing: {draft.get('missing') or '(not stated)'}"
    )
    reply = llm(REFINER_SYSTEM, user, max_tokens=100)
    fallback = f"{sub_question} {draft.get('missing', '')}".strip()[:200]
    return clean_query(reply, tried, fallback)

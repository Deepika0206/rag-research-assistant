import re


def tokenize(text: str) -> list[str]:
    """Lowercase words and numbers. Used by BM25."""
    return re.findall(r"[a-z0-9]+", text.lower())


def rrf_fuse(ranked_lists: list[list[int]], k: int, rrf_k: int = 60) -> list[tuple[int, float]]:
    """Merge ranked ID lists. Return the top k as (id, score)."""
    scores: dict[int, float] = {}
    for ranked in ranked_lists:
        for rank, item in enumerate(ranked, start=1):
            scores[item] = scores.get(item, 0.0) + 1.0 / (rrf_k + rank)
    return sorted(scores.items(), key=lambda x: -x[1])[:k]

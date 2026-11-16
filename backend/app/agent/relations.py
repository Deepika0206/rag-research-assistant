def build_claim_table(sub_results: list[dict]) -> list[dict]:
    """One row per verified claim. Answered and partial sub-questions contribute."""
    table, n = [], 0
    for si, r in enumerate(sub_results):
        if r["status"] not in ("answered", "partial"):
            continue
        by_id = {c["chunk_id"]: c for c in r["chunks"]}
        for claim in r["claims"]:
            n += 1
            ids = claim["chunk_ids"]
            table.append({
                "claim_id": f"C{n}",
                "sub_index": si,
                "text": claim["text"],
                "chunk_ids": ids,
                "docs": sorted({by_id[i]["doc"] for i in ids}),
                "topics": sorted({by_id[i]["topic"] for i in ids}),
            })
    return table


def compute_relations(sub_results: list[dict], table: list[dict]) -> list[dict]:
    """Exact set facts across sub-questions. Uses only cited chunks of verified claims."""
    n_sub = len(sub_results)
    if n_sub < 2 or any(r["status"] not in ("answered", "partial") for r in sub_results):
        return []
    by_sub = {i: [t for t in table if t["sub_index"] == i] for i in range(n_sub)}
    if any(not rows for rows in by_sub.values()):
        return []

    relations = []
    for key, label in (("topics", "topic"), ("docs", "document")):
        per_sub = [set().union(*(set(t[key]) for t in by_sub[i])) for i in range(n_sub)]
        shared = sorted(set.intersection(*per_sub))
        for value in shared:
            relations.append({
                "kind": f"shared_{label}", "value": value,
                "claim_ids": [t["claim_id"] for t in table if value in t[key]],
                "text": f"The verified evidence for all {n_sub} sub-questions includes the {label} '{value}'.",
            })
        if not shared and label == "topic":
            relations.append({
                "kind": "no_shared_topic", "value": None,
                "claim_ids": [t["claim_id"] for t in table],
                "text": f"No topic appears in the verified evidence of all {n_sub} sub-questions.",
            })

    for i, r in enumerate(relations, 1):
        r["id"] = f"R{i}"
    return relations

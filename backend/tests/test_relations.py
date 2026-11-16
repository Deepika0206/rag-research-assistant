from app.agent.relations import build_claim_table, compute_relations


def chunk(cid, topic, doc):
    return {"chunk_id": cid, "topic": topic, "doc": doc, "text": "t"}


def sub(status, claims, chunks):
    return {"sub_question": "q", "status": status, "claims": claims, "chunks": chunks,
            "rejected": [], "missing": "", "refinements": 0, "queries_tried": ["q"]}


def test_shared_topic_uses_only_cited_chunks():
    # Both sub-questions RETRIEVED a 'trees' chunk, but no claim cites it.
    s1 = sub("answered", [{"text": "A.", "chunk_ids": [1, 2]}],
             [chunk(1, "dp", "dp/a.md"), chunk(2, "searching", "searching/a.md"), chunk(9, "trees", "trees/z.md")])
    s2 = sub("answered", [{"text": "B.", "chunk_ids": [3]}],
             [chunk(3, "dp", "dp/b.md"), chunk(8, "trees", "trees/y.md")])
    rel = compute_relations([s1, s2], build_claim_table([s1, s2]))
    assert [r["value"] for r in rel if r["kind"] == "shared_topic"] == ["dp"]


def test_no_shared_topic():
    s1 = sub("answered", [{"text": "A.", "chunk_ids": [1]}], [chunk(1, "dp", "dp/a.md")])
    s2 = sub("answered", [{"text": "B.", "chunk_ids": [2]}], [chunk(2, "graphs", "graphs/b.md")])
    rel = compute_relations([s1, s2], build_claim_table([s1, s2]))
    assert [r["kind"] for r in rel] == ["no_shared_topic"]


def test_no_relations_when_one_side_failed():
    s1 = sub("answered", [{"text": "A.", "chunk_ids": [1]}], [chunk(1, "dp", "dp/a.md")])
    s2 = sub("evidence_insufficient", [], [chunk(2, "dp", "dp/b.md")])
    assert compute_relations([s1, s2], build_claim_table([s1, s2])) == []


def test_single_sub_question_has_no_relations():
    s1 = sub("answered", [{"text": "A.", "chunk_ids": [1]}], [chunk(1, "dp", "dp/a.md")])
    assert compute_relations([s1], build_claim_table([s1])) == []


def test_claim_ids_count_only_answered_claims():
    s1 = sub("answered", [{"text": "A.", "chunk_ids": [1]}, {"text": "B.", "chunk_ids": [1]}],
             [chunk(1, "dp", "dp/a.md")])
    assert [t["claim_id"] for t in build_claim_table([s1])] == ["C1", "C2"]

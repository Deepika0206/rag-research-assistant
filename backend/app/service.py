def _source(c: dict) -> dict:
    return {"doc": c["doc"], "topic": c["topic"], "text": c["text"]}


def shape_agentic(out: dict) -> dict:
    f = out["final"]
    return {
        "mode": "agentic",
        "question": out["question"],
        "query_type": out["query_type"],
        "status": f["status"],
        "answer": f["answer"],
        "claims": [{"claim_id": c["claim_id"], "text": c["text"], "chunk_ids": c["chunk_ids"],
                    "sub_question": c["sub_index"] + 1} for c in f["claims"]],
        "relations": [{"id": r["id"], "kind": r["kind"], "value": r["value"],
                       "text": r["text"], "claim_ids": r["claim_ids"]} for r in f["relations"]],
        "sources": {str(k): v for k, v in f["sources"].items()},
        "sub_questions": [{"sub_question": r["sub_question"], "status": r["status"],
                           "refinements": r["refinements"], "queries_tried": r["queries_tried"],
                           "missing": r["missing"]} for r in out["sub_results"]],
        "synthesis": f["synthesis"],
        "trace": out["trace"],
    }


def shape_baseline(out: dict) -> dict:
    return {
        "mode": "baseline",
        "question": out["question"],
        "query_type": None,
        "status": "unchecked",                      # nothing verifies the baseline answer
        "answer": out["answer"],
        "claims": [],
        "relations": [],
        "sources": {str(c["chunk_id"]): _source(c) for c in out["chunks"]},
        "sub_questions": [],
        "citations": out["citations"],
        "invalid_citations": out["invalid_citations"],
        "trace": [{"step": "retrieve", "query": out["question"],
                   "chunks": [{"chunk_id": c["chunk_id"], "doc": c["doc"],
                               "score": round(c["score"], 3)} for c in out["chunks"]]}],
    }

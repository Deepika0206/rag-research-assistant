import json
import sys
from pathlib import Path

from app.retrieval.retriever import Retriever

GOLD_FILE = Path(__file__).resolve().parents[2] / "eval" / "retrieval_dev.json"


def matches(chunk: dict, gold: dict) -> bool:
    return chunk["doc"] == gold["doc"] and gold["phrase"].lower() in chunk["text"].lower()


def score(chunks: list[dict], gold: list[dict]) -> tuple[float, float]:
    covered = sum(any(matches(c, g) for c in chunks) for g in gold)
    recall = covered / len(gold)
    rr = 0.0
    for rank, c in enumerate(chunks, start=1):
        if any(matches(c, g) for g in gold):
            rr = 1.0 / rank
            break
    return recall, rr


def main() -> None:
    r = Retriever()
    data = json.loads(GOLD_FILE.read_text(encoding="utf-8"))

    bad = 0                                  # every gold item must match at least one chunk
    for item in data:
        for g in item["gold"]:
            if not any(matches(c, g) for c in r.chunks.values()):
                print(f"BAD GOLD {item['id']}: {g}")
                bad += 1
    if bad:
        sys.exit("Fix the gold file first. The doc path or phrase matches no chunk.")

    systems = {
        "dense top-5 (baseline)": lambda q: [c for c, _ in r.dense(q, 5)],
        "bm25 top-5": lambda q: [c for c, _ in r.bm25_search(q, 5)],
        "hybrid top-5 (RRF)": lambda q: [c for c, _ in r.hybrid(q, 5)],
        "hybrid + rerank top-5 (proposed)": lambda q: [h["chunk_id"] for h in r.search(q)],
    }

    print(f"{len(data)} questions\n{'system':<36}{'Recall@5':>10}{'MRR':>8}")
    for name, fn in systems.items():
        recalls, rrs = [], []
        for item in data:
            ids = fn(item["question"])
            rec, rr = score([r.chunks[i] for i in ids], item["gold"])
            recalls.append(rec)
            rrs.append(rr)
        print(f"{name:<36}{sum(recalls)/len(recalls):>10.2f}{sum(rrs)/len(rrs):>8.2f}")


if __name__ == "__main__":
    main()

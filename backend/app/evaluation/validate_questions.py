import json
import sys
from collections import Counter

from app.evaluation.common import EVAL_DIR, EXPECTED_COUNTS, load_chunks_from_db, load_questions, matches

REQUIRED = {"id", "category", "question", "gold", "gold_answer"}


def main() -> None:
    questions = load_questions()
    chunks = list(load_chunks_from_db().values())
    problems, warnings = [], []

    counts = Counter(q.get("category") for q in questions)
    for cat, n in EXPECTED_COUNTS.items():
        if counts[cat] != n:
            problems.append(f"{cat}: expected {n} questions, found {counts[cat]}")
    ids = [q.get("id") for q in questions]
    if len(ids) != len(set(ids)):
        problems.append("Duplicate question IDs.")

    dev = set()
    for name in ("retrieval_dev.json", "planner_dev.json"):
        p = EVAL_DIR / name
        if p.exists():
            dev |= {d["question"].strip().lower() for d in json.loads(p.read_text(encoding="utf-8"))}

    topics = Counter()
    for q in questions:
        qid = q.get("id", "?")
        missing = REQUIRED - q.keys()
        if missing:
            problems.append(f"{qid}: missing fields {sorted(missing)}")
            continue
        if q["question"].strip().lower() in dev:
            problems.append(f"{qid}: same question as a dev question")

        if q["category"] == "unsupported":
            if q["gold"]:
                problems.append(f"{qid}: an unsupported question must have empty gold")
            if "must_be_absent" not in q:
                problems.append(f"{qid}: add must_be_absent (a list, may be empty)")
            terms = [t.lower() for t in q.get("must_be_absent", [])]
            for t in terms:
                hits = sorted({c["doc"] for c in chunks if t in c["text"].lower()})
                if hits:
                    problems.append(f"{qid}: the notes mention '{t}' in {hits[:3]}. Is it really unsupported?")
            if not terms:
                warnings.append(f"{qid}: no absence terms. Check your notes by hand.")
        else:
            if not q["gold"]:
                problems.append(f"{qid}: gold is empty")
                continue
            for g in q["gold"]:
                n = sum(matches(c, g) for c in chunks)
                topics[g["doc"].split("/")[0]] += 1
                if n == 0:
                    problems.append(f"{qid}: BAD GOLD {g}")
                elif n > 2:
                    warnings.append(f"{qid}: phrase {g['phrase']!r} matches {n} chunks. Use a more distinctive phrase.")
            if q["category"] == "multi_hop" and len({g["doc"] for g in q["gold"]}) < 2:
                problems.append(f"{qid}: a multi-hop question needs gold from at least 2 documents")

    print("Categories:", dict(counts))
    print("Gold items per topic:", dict(topics))
    for w in warnings:
        print("WARN ", w)
    for p in problems:
        print("ERROR", p)
    print("\nQuestions:", "READY TO LOCK" if not problems else "NOT READY")
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()

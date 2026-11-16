import csv
import json
import random
import sys

from app.evaluation.common import (EVAL_DIR, cited_ids, last_records, load_chunks_from_db,
                                   load_questions, looks_like_refusal, split_sentences)


def write_csv(path, header, rows):
    with open(path, "w", encoding="utf-8-sig", newline="") as f:     # utf-8-sig opens cleanly in Excel
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)


def main(run: str, seed: int = 7) -> None:
    out_dir = EVAL_DIR / "results" / run
    questions = {q["id"]: q for q in load_questions()}
    chunks = load_chunks_from_db()

    items = []
    for system in ("baseline", "agentic"):
        recs = last_records(out_dir / f"{system}.jsonl")
        bad = [q for q in questions if q not in recs or recs[q].get("error")]
        if bad:
            sys.exit(f"{system}: missing or failed questions {bad}. Finish the run first.")
        items += [(system, qid, recs[qid]) for qid in questions]

    random.Random(seed).shuffle(items)                 # hides the system and the order
    key, answers, sentences = {}, [], []
    for n, (system, qid, rec) in enumerate(items, start=1):
        item_id = f"A{n:03d}"
        key[item_id] = {"system": system, "id": qid}
        q = questions[qid]
        answers.append([item_id, q["category"], q["question"], q["gold_answer"], rec["answer"], "", "", ""])

        retrieved = set(rec["chunk_ids"]) if system == "baseline" else {int(k) for k in rec["sources"]}
        for s_no, sent in enumerate(split_sentences(rec["answer"]), start=1):
            ids = cited_ids(sent)
            phantom = [i for i in ids if i not in retrieved]
            texts = "\n\n".join(f"[{i}] {chunks[i]['text']}" for i in ids if i in chunks)
            sentences.append([item_id, s_no, sent, "refusal" if looks_like_refusal(sent) else "claim",
                              ";".join(map(str, ids)), texts, "", ";".join(map(str, phantom))])

    write_csv(out_dir / "ratings_answers.csv",
              ["item_id", "category", "question", "gold_answer", "answer",
               "correctness_1to5", "abstained_0or1", "notes"], answers)
    write_csv(out_dir / "ratings_sentences.csv",
              ["item_id", "sent_no", "sentence", "kind", "cited_ids", "cited_text",
               "supported_0or1", "bad_citations"], sentences)
    (out_dir / "rating_key.json").write_text(json.dumps(key, indent=2), encoding="utf-8")
    print(f"{len(answers)} answers and {len(sentences)} sentences to rate.")
    print("Do NOT open rating_key.json until you finish rating.")


if __name__ == "__main__":
    main(sys.argv[1])

import csv
import json
import re
import statistics
import sys
from collections import defaultdict

from app.evaluation.common import (CATEGORIES, EVAL_DIR, best_rr, corpus_fingerprint, last_records,
                                   load_chunks_from_db, load_questions, recall_union)

SYSTEMS = ("baseline", "agentic")
VARIANT = {"baseline": "baseline", "agentic": "one_query"}


def read_csv(path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def ids_in(text):
    return {int(x) for x in re.findall(r"\d+", text or "")}


def mean(xs):
    xs = list(xs)
    return sum(xs) / len(xs) if xs else None


def num(x, d=2):
    return "n/a" if x is None else f"{x:.{d}f}"


def pct(x):
    return "n/a" if x is None else f"{x * 100:.0f}%"


def main(run: str) -> None:
    out_dir = EVAL_DIR / "results" / run
    questions = {q["id"]: q for q in load_questions()}
    chunks = load_chunks_from_db()
    snap = json.loads((out_dir / "snapshot.json").read_text(encoding="utf-8"))
    if snap["corpus_fingerprint"] != corpus_fingerprint(chunks):
        sys.exit("The corpus changed after the run. Chunk IDs do not match. Re-run the evaluation.")

    records = {s: last_records(out_dir / f"{s}.jsonl") for s in SYSTEMS}
    for s in SYSTEMS:
        bad = [q for q in questions if q not in records[s] or records[s][q].get("error")]
        if bad:
            sys.exit(f"{s}: missing or failed questions {bad}")

    key = json.loads((out_dir / "rating_key.json").read_text(encoding="utf-8"))
    item = {(v["system"], v["id"]): k for k, v in key.items()}
    answers = {r["item_id"]: r for r in read_csv(out_dir / "ratings_answers.csv")}

    # ---- read and check the manual ratings
    problems, correctness, abstained = [], {}, {}
    for (system, qid), iid in item.items():
        row = answers.get(iid)
        if row is None:
            problems.append(f"{iid}: row missing")
            continue
        try:
            c = int(row["correctness_1to5"])
            if not 1 <= c <= 5:
                raise ValueError
            correctness[(system, qid)] = c
        except ValueError:
            problems.append(f"{iid}: correctness must be a number from 1 to 5")
        if questions[qid]["category"] == "unsupported":
            if row["abstained_0or1"].strip() not in {"0", "1"}:
                problems.append(f"{iid}: abstained must be 0 or 1")
            else:
                abstained[(system, qid)] = int(row["abstained_0or1"])

    tally = defaultdict(lambda: {"claims": 0, "supported": 0, "cites": 0, "bad": 0})
    for r in read_csv(out_dir / "ratings_sentences.csv"):
        system, qid = key[r["item_id"]]["system"], key[r["item_id"]]["id"]
        if r["kind"].strip().lower() != "claim":
            continue                                           # refusals are not claims
        if r["supported_0or1"].strip() not in {"0", "1"}:
            problems.append(f"{r['item_id']} sentence {r['sent_no']}: supported must be 0 or 1")
            continue
        t = tally[(system, qid)]
        cited = ids_in(r["cited_ids"])
        t["claims"] += 1
        t["supported"] += int(r["supported_0or1"])
        t["cites"] += len(cited)
        t["bad"] += len(ids_in(r["bad_citations"]) & cited)
    if problems:
        print(f"{len(problems)} rating problems. First 15:")
        sys.exit("\n".join(problems[:15]))

    # ---- retrieval metrics (code)
    def to_chunks(ids):
        return [chunks[i] for i in ids if i in chunks]

    ret, avg_seen = {}, defaultdict(list)
    for qid, q in questions.items():
        if q["category"] == "unsupported":
            continue
        gold, a = q["gold"], records["agentic"][qid]
        base = to_chunks(records["baseline"][qid]["retrieval_lists"][0])
        one = to_chunks(a["retrieval_only_ids"])
        lists = [to_chunks(l) for l in a["retrieval_lists"]]
        ret[("baseline", qid)] = (recall_union([base], gold), best_rr([base], gold))
        ret[("one_query", qid)] = (recall_union([one], gold), best_rr([one], gold))
        ret[("proposed", qid)] = (recall_union(lists, gold), best_rr(lists, gold))
        avg_seen[(q["category"], "baseline")].append(len(base))
        avg_seen[(q["category"], "one_query")].append(len(one))
        avg_seen[(q["category"], "proposed")].append(sum(len(l) for l in lists))

    lines = []

    def add(s=""):
        print(s)
        lines.append(s)

    by_cat = {c: [q for q, v in questions.items() if v["category"] == c] for c in CATEGORIES}
    add(f"Run: {run} | model: {snap['model']} | corpus: {snap['corpus_fingerprint']} | commit: {snap['git']['commit']}")

    add("\nMAIN TABLE (per question category)")
    add(f"{'category':<12}{'system':<10}{'n':>3}{'Recall@5':>10}{'MRR':>7}{'Correct':>9}"
        f"{'Faithful':>10}{'CiteAcc':>9}{'Reject':>8}{'claims':>8}{'cites':>7}")
    for cat in CATEGORIES:
        qids = by_cat[cat]
        for system in SYSTEMS:
            has_gold = cat != "unsupported"
            recall = mean(ret[(VARIANT[system], q)][0] for q in qids) if has_gold else None
            rr = mean(ret[(VARIANT[system], q)][1] for q in qids) if has_gold else None
            claims = sum(tally[(system, q)]["claims"] for q in qids)
            sup = sum(tally[(system, q)]["supported"] for q in qids)
            cites = sum(tally[(system, q)]["cites"] for q in qids)
            bad = sum(tally[(system, q)]["bad"] for q in qids)
            rej = mean(abstained[(system, q)] for q in qids) if cat == "unsupported" else None
            add(f"{cat:<12}{system:<10}{len(qids):>3}{num(recall):>10}{num(rr):>7}"
                f"{num(mean(correctness[(system, q)] for q in qids)):>9}"
                f"{pct(sup / claims if claims else None):>10}{pct(1 - bad / cites if cites else None):>9}"
                f"{pct(rej):>8}{claims:>8}{cites:>7}")

    add("\nPAIRED CORRECTNESS (proposed vs baseline, number of questions)")
    for cat in CATEGORIES:
        d = [correctness[("agentic", q)] - correctness[("baseline", q)] for q in by_cat[cat]]
        add(f"{cat:<12} wins {sum(x > 0 for x in d)} | ties {sum(x == 0 for x in d)} | losses {sum(x < 0 for x in d)}")

    add("\nUNSUPPORTED: automatic cross-check (agentic status == evidence_insufficient)")
    auto = sum(records["agentic"][q]["status"] == "evidence_insufficient" for q in by_cat["unsupported"])
    add(f"{auto}/{len(by_cat['unsupported'])} strict automatic rejections. "
        f"Manual (abstained) agentic: {sum(abstained[('agentic', q)] for q in by_cat['unsupported'])}"
        f"/{len(by_cat['unsupported'])}")

    add("\nRETRIEVAL ABLATION (single-hop and multi-hop only)")
    add(f"{'category':<12}{'variant':<30}{'Recall@5':>10}{'MRR':>7}{'avg chunks seen':>17}")
    names = {"baseline": "dense top-5", "one_query": "hybrid + rerank, 1 query",
             "proposed": "decomposition (per sub-question)"}
    for cat in ("single_hop", "multi_hop"):
        for v in ("baseline", "one_query", "proposed"):
            add(f"{cat:<12}{names[v]:<30}{num(mean(ret[(v, q)][0] for q in by_cat[cat])):>10}"
                f"{num(mean(ret[(v, q)][1] for q in by_cat[cat])):>7}{num(mean(avg_seen[(cat, v)]), 1):>17}")

    add("\nCRITIC ACTIVITY (agentic, from the trace)")
    add(f"{'category':<12}{'critic checks':>14}{'failed':>8}{'claims rejected':>17}{'sub-q refined':>15}{'sub-q insufficient':>20}")
    for cat in CATEGORIES:
        trace = [e for q in by_cat[cat] for e in records["agentic"][q]["trace"]]
        crit = [e for e in trace if e["step"] == "critique"]
        subs = [s for q in by_cat[cat] for s in records["agentic"][q]["sub_questions"]]
        add(f"{cat:<12}{len(crit):>14}{sum(not e['passed'] for e in crit):>8}"
            f"{sum(1 for e in crit for v in e['verdicts'] if not v['supported']):>17}"
            f"{sum(s['refinements'] > 0 for s in subs):>15}{sum(s['status'] != 'answered' for s in subs):>20}")

    add("\nCOST AND SPEED (all 25 questions; the cache was " + ("ON)" if snap["cache"] else "OFF)"))
    for system in SYSTEMS:
        recs = list(records[system].values())
        add(f"{system:<10} median latency {statistics.median(r['latency_s'] for r in recs):6.1f} s | "
            f"mean LLM calls {mean(r['calls'] for r in recs):5.1f} | "
            f"mean tokens in/out {mean(r['input_tokens'] for r in recs):6.0f}/{mean(r['output_tokens'] for r in recs):5.0f} | "
            f"mean cost {mean(r['est_cost'] for r in recs):.4f} | total cost {sum(r['est_cost'] for r in recs):.3f}")

    (out_dir / "report.txt").write_text("\n".join(lines), encoding="utf-8")
    with open(out_dir / "per_question.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["id", "category", "system", "recall5", "mrr", "correctness", "status", "latency_s", "calls"])
        for qid, q in questions.items():
            for system in SYSTEMS:
                r = records[system][qid]
                rec = ret.get((VARIANT[system], qid), (None, None))
                w.writerow([qid, q["category"], system, rec[0], rec[1], correctness[(system, qid)],
                            r.get("status", "unchecked"), round(r["latency_s"], 1), r["calls"]])
    print(f"\nSaved: {out_dir / 'report.txt'} and per_question.csv")


if __name__ == "__main__":
    main(sys.argv[1])

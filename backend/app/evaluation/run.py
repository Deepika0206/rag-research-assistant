import argparse
import hashlib
import json
import os
import statistics
import sys
import time
from importlib.metadata import version

from app.evaluation.common import EVAL_DIR, corpus_fingerprint, git_state, last_records, load_questions


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True, help="results folder name, for example final_run1")
    ap.add_argument("--questions", default=None, help="path to a questions file (default: eval/questions.json)")
    ap.add_argument("--only", nargs="*", help="run only these question IDs")
    ap.add_argument("--systems", nargs="*", default=["baseline", "agentic"])
    ap.add_argument("--cache", action="store_true", help="use the LLM cache (debugging only; it hides latency)")
    args = ap.parse_args()
    os.environ["USE_LLM_CACHE"] = "1" if args.cache else "0"    # must be set before the app imports

    from app import config
    from app.agent.critic import CRITIC_SYSTEM
    from app.agent.drafter import DRAFTER_SYSTEM
    from app.agent.graph import build_graph, run_agent
    from app.agent.planner import PLANNER_SYSTEM
    from app.agent.refiner import REFINER_SYSTEM
    from app.agent.synthesizer import SYNTH_SYSTEM
    from app.baseline import SYSTEM_PROMPT, baseline_answer
    from app.llm import usage_summary
    from app.retrieval.retriever import Retriever

    questions = load_questions(args.questions)
    if args.only:
        questions = [q for q in questions if q["id"] in args.only]

    retriever = Retriever()
    if retriever.mode != "pgvector+bm25+crossencoder":
        raise RuntimeError(f"eval/run.py refuses to start: retriever mode is {retriever.mode!r}, must be 'pgvector+bm25+crossencoder'")
    graph = build_graph(retriever)

    def _safe_ver(p):
        return version(p)

    prompts = {"baseline": SYSTEM_PROMPT, "planner": PLANNER_SYSTEM, "drafter": DRAFTER_SYSTEM,
               "critic": CRITIC_SYSTEM, "refiner": REFINER_SYSTEM, "synthesizer": SYNTH_SYSTEM}
    snapshot = {
        "model": config.CLAUDE_MODEL,
        "corpus_fingerprint": corpus_fingerprint(retriever.chunks),
        "n_chunks": len(retriever.chunks),
        "prompts": {k: hashlib.sha256(v.encode()).hexdigest()[:12] for k, v in prompts.items()},
        "settings": {"MAX_TOKENS": config.MAX_TOKENS, "OVERLAP_TOKENS": config.OVERLAP_TOKENS,
                     "CANDIDATES": config.CANDIDATES, "TOP_K": config.TOP_K,
                     "MAX_REFINEMENTS": config.MAX_REFINEMENTS},
        "cache": args.cache,
        "git": git_state(),
        "packages": {p: _safe_ver(p) for p in ("langgraph", "anthropic", "sentence-transformers", "rank-bm25")},
    }


    if snapshot["git"]["uncommitted_changes"]:
        print("WARN: there are uncommitted code changes. Commit and tag the frozen system first.")

    out_dir = EVAL_DIR / "results" / args.out
    out_dir.mkdir(parents=True, exist_ok=True)
    snap_path = out_dir / "snapshot.json"
    if snap_path.exists():
        old = json.loads(snap_path.read_text(encoding="utf-8"))
        if any(old.get(k) != snapshot.get(k) for k in ("model", "corpus_fingerprint", "prompts", "settings")):
            sys.exit("The model, corpus, prompts, or settings changed since this run started. Use a new --out folder.")
    else:
        snap_path.write_text(json.dumps({**snapshot, "started": time.strftime("%Y-%m-%d %H:%M:%S")}, indent=2),
                             encoding="utf-8")

    def run_baseline(q):
        t0 = time.time()
        out = baseline_answer(q["question"], retriever, None)
        ids = [c["chunk_id"] for c in out["chunks"]]
        return {"latency_s": time.time() - t0, "answer": out["answer"], "chunk_ids": ids,
                "retrieval_lists": [ids], "citations": out["citations"],
                "invalid_citations": out["invalid_citations"]}

    def run_agentic(q):
        retrieval_only = [h["chunk_id"] for h in retriever.search(q["question"])]   # no LLM call
        t0 = time.time()
        out = run_agent(graph, q["question"], None)
        latency = time.time() - t0
        f = out["final"]
        lists = [[c["chunk_id"] for c in e["chunks"]]
                 for e in out["trace"] if e["step"] == "retrieve" and e.get("attempt") == 1]
        return {
            "latency_s": latency, "status": f["status"], "answer": f["answer"],
            "query_type": out["query_type"],
            "sub_questions": [{"sub_question": r["sub_question"], "status": r["status"],
                               "refinements": r["refinements"]} for r in out["sub_results"]],
            "retrieval_lists": lists, "retrieval_only_ids": retrieval_only,
            "claims": f["claims"], "relations": f["relations"],
            "sources": {str(k): v for k, v in f["sources"].items()},
            "synthesis": f["synthesis"], "dropped_sentences": f["dropped_sentences"],
            "trace": out["trace"],
        }

    runners = {"baseline": run_baseline, "agentic": run_agentic}
    for system in args.systems:
        path = out_dir / f"{system}.jsonl"
        done = {i for i, r in last_records(path).items() if not r.get("error")}
        for q in questions:
            if q["id"] in done:
                continue
            print(f"[{system}] {q['id']} {q['question'][:70]}")
            u0 = usage_summary()
            try:
                rec, err = runners[system](q), None
            except Exception as e:                       # record the failure and go on
                rec, err = {}, f"{type(e).__name__}: {e}"
                print("   ERROR:", err)
            u1 = usage_summary()
            tin, tout = u1["input_tokens"] - u0["input_tokens"], u1["output_tokens"] - u0["output_tokens"]
            rec.update({
                "id": q["id"], "category": q["category"], "question": q["question"], "system": system,
                "error": err, "calls": u1["calls"] - u0["calls"], "input_tokens": tin, "output_tokens": tout,
                "est_cost": (tin * config.PRICE_IN_PER_MTOK + tout * config.PRICE_OUT_PER_MTOK) / 1_000_000,
            })
            with open(path, "a", encoding="utf-8") as f:
                f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    print("\nSUMMARY")
    for system in args.systems:
        recs = [r for r in last_records(out_dir / f"{system}.jsonl").values()]
        ok = [r for r in recs if not r.get("error")]
        if recs:
            print(f"{system}: {len(ok)}/{len(recs)} ok | mean calls {statistics.mean(r['calls'] for r in ok):.1f}"
                  f" | mean cost {statistics.mean(r['est_cost'] for r in ok):.4f}"
                  f" | median latency {statistics.median(r['latency_s'] for r in ok):.1f}s")


if __name__ == "__main__":
    main()

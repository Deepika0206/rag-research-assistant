import sys

from app.agent.graph import build_graph, run_agent
from app.llm import usage_summary

if "--diagram" in sys.argv:
    class DummyRetriever:
        def search(self, *args, **kwargs):
            return []
    dummy_graph = build_graph(DummyRetriever())
    print(dummy_graph.get_graph().draw_mermaid())
    sys.exit()

from app.retrieval.retriever import Retriever

if len(sys.argv) < 2:
    print("Usage: python -m app.run_graph '<question>' [optional_topic] OR --diagram")
    sys.exit(1)

graph = build_graph(Retriever())

question = sys.argv[1]
topic = sys.argv[2] if len(sys.argv) > 2 else None
out = run_agent(graph, question, topic)

print(f"TYPE: {out['query_type']}")
for i, r in enumerate(out["sub_results"], 1):
    print(f"\nSUB-QUESTION {i}: {r['sub_question']}")
    print(f"  STATUS: {r['status']}  (refinements: {r['refinements']})")
    for c in r["claims"]:
        print(f"  + {c['text']}  {c['chunk_ids']}")
    for v in r["rejected"]:
        print(f"  - REJECTED: {v['claim']}  ({v['reason']})")

f = out["final"]
print(f"\n=== FINAL REPORT ===  status: {f['status']}  | synthesis: {f['synthesis']}"
      f"  | dropped sentences: {f['dropped_sentences']}")
print(f["answer"])
print("\nRELATIONS:")
for r in f["relations"]:
    print(f"  {r['id']}: {r['text']}  (claims {r['claim_ids']})")
print("\nSOURCES:")
for cid, s in f["sources"].items():
    print(f"  [{cid}] {s['doc']:<34} {s['text'][:70]!r}")
print("\nSTEPS:", " > ".join(t["step"] for t in out["trace"]))
print("USAGE:", usage_summary())

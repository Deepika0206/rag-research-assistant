import sys

from app.baseline import baseline_answer
from app.llm import usage_summary
from app.retrieval.retriever import Retriever

if len(sys.argv) < 2:
    print("Usage: python -m app.ask_baseline '<question>' [optional_topic]")
    sys.exit(1)

retriever = Retriever()
question = sys.argv[1]
topic = sys.argv[2] if len(sys.argv) > 2 else None

out = baseline_answer(question, retriever, topic)
print("\nANSWER:\n" + out["answer"])
print("\nRETRIEVED:")
for c in out["chunks"]:
    print(f"  [{c['chunk_id']}] {c['doc']}  score={c['score']:.3f}")
print("\nCITED:", out["citations"], "| PHANTOM:", out["invalid_citations"])
print("USAGE:", usage_summary())

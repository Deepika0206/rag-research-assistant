import sys
from app.retrieval.retriever import Retriever

if len(sys.argv) < 2:
    print("Usage: python -m app.search_demo '<query>' [optional_topic]")
    sys.exit(1)

r = Retriever()
q = sys.argv[1]
topic = sys.argv[2] if len(sys.argv) > 2 else None

print("DENSE :", [(c, round(s, 3)) for c, s in r.dense(q, 5, topic)])
print("BM25  :", [(c, round(s, 1)) for c, s in r.bm25_search(q, 5, topic)])
print("HYBRID:", [(c, round(s, 4)) for c, s in r.hybrid(q, 10, topic)])
print("FINAL :")
for h in r.search(q, topic):
    print(f"  chunk {h['chunk_id']:>4}  {h['doc']:<34} rerank={h['rerank_score']:6.2f}  {h['text'][:60]!r}")

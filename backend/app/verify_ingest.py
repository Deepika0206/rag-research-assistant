import os
import sys
import numpy as np
import psycopg
from pgvector.psycopg import register_vector
from sentence_transformers import SentenceTransformer


from app.config import DATABASE_URL, EMBED_MODEL

EXPECTED_TOPICS = {"searching", "sorting", "graphs", "dp", "trees"}

# question -> topic that must appear in the top 5 results. Edit for YOUR notes.
TEST_QUERIES = {
    "how does binary search work": "searching",
    "explain merge sort": "sorting",
    "shortest path in a weighted graph": "graphs",
    "what is memoization": "dp",
    "inorder traversal of a binary tree": "trees",
}


def check(name: str, passed: bool, detail: str = "") -> bool:
    print(f"[{'PASS' if passed else 'FAIL'}] {name} {detail}")
    return passed


def main() -> None:
    results = []
    model = SentenceTransformer(EMBED_MODEL)

    with psycopg.connect(DATABASE_URL) as conn:
        register_vector(conn)

        topics = dict(conn.execute("SELECT topic, count(*) FROM chunks GROUP BY topic").fetchall())
        results.append(check("all 5 topics present", set(topics) == EXPECTED_TOPICS, str(topics)))

        n_docs, n_chunks, max_tok, avg_tok = conn.execute(
            "SELECT (SELECT count(*) FROM documents), count(*), max(n_tokens), avg(n_tokens) FROM chunks"
        ).fetchone()
        print(f"       {n_docs} documents, {n_chunks} chunks, "
              f"average {float(avg_tok or 0):.0f} tokens, max {max_tok}")
        min_docs = int(os.getenv("MIN_DOCS", "40"))
        results.append(check(f"at least {min_docs} documents", n_docs >= min_docs))
        results.append(check("no chunk over 384 tokens", max_tok is not None and max_tok <= 384))

        emb = conn.execute("SELECT embedding FROM chunks LIMIT 1").fetchone()[0]
        embedding_array = np.asarray(emb.to_list(), dtype=float)

        results.append(
            check(
                "embedding: 768 numbers, length 1",
                len(embedding_array) == 768
                and abs(np.linalg.norm(embedding_array) - 1) < 0.01
            )
        )

        for query, topic in TEST_QUERIES.items():
            qv = model.encode(query, normalize_embeddings=True)
            rows = conn.execute(
                "SELECT topic FROM chunks ORDER BY embedding <=> %s LIMIT 5", (qv,)
            ).fetchall()
            found = [r[0] for r in rows]
            results.append(check(f"search {query!r}", topic in found, f"-> {found}"))

    print("\nPhase 2:", "READY" if all(results) else "NOT READY")
    sys.exit(0 if all(results) else 1)


if __name__ == "__main__":
    main()

import sys
import psycopg
from pgvector.psycopg import register_vector
from sentence_transformers import SentenceTransformer

from app.config import DATABASE_URL, EMBED_MODEL

if len(sys.argv) < 2:
    print("Usage: python -m app.search_dense '<search_query>'")
    sys.exit(1)

model = SentenceTransformer(EMBED_MODEL)
qv = model.encode(sys.argv[1], normalize_embeddings=True)

with psycopg.connect(DATABASE_URL) as conn:
    register_vector(conn)
    rows = conn.execute(
        "SELECT id, topic, 1 - (embedding <=> %s) AS score, left(text, 90) "
        "FROM chunks ORDER BY embedding <=> %s LIMIT 5",
        (qv, qv),
    ).fetchall()

for cid, topic, score, preview in rows:
    print(f"{cid:>4} {topic:<10} {score:.3f}  {preview!r}")

import sys
from pathlib import Path

import psycopg
from sentence_transformers import SentenceTransformer
from pgvector.psycopg import register_vector
from app.config import DATABASE_URL, EMBED_MODEL
from app.ingest.chunker import chunk_text, count_tokens


def main(corpus_dir: str) -> None:
    root = Path(corpus_dir).resolve()
    if not root.is_dir():
        sys.exit(f"Corpus folder not found: {root}")

    files = sorted(
        path for path in root.rglob("*")
        if path.is_file() and path.suffix.lower() in {".md", ".txt"}
    )
    if not files:
        sys.exit(f"No .md or .txt files found in {root}")

    model = SentenceTransformer(EMBED_MODEL)
    schema_file = Path(__file__).resolve().parent.parent / "schema.sql"
    added = updated = unchanged = skipped = 0

    with psycopg.connect(DATABASE_URL) as conn:
        conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
        register_vector(conn)
        if schema_file.exists():
            conn.execute(schema_file.read_text(encoding="utf-8"))

        for path in files:
            relative_path = path.relative_to(root).as_posix()
            if path.parent == root:
                print(f"SKIP {relative_path}: put the file inside a topic folder")
                skipped += 1
                continue

            topic = path.parent.name
            chunks = chunk_text(path.read_text(encoding="utf-8"))
            if not chunks:
                print(f"SKIP {relative_path}: no usable text")
                skipped += 1
                continue

            previous = conn.execute(
                "SELECT id, stored_path, collection_id::text, subsection_id::text, status "
                "FROM documents WHERE path = %s",
                (relative_path,),
            ).fetchone()
            if previous:
                doc_id, stored_path, collection_id, subsection_id, status = previous
                # User uploads must never be replaced by the bundled seed importer.
                if stored_path or relative_path.startswith("uploads/"):
                    print(f"SKIP {relative_path}: managed upload")
                    skipped += 1
                    continue

                existing_texts = [row[0] for row in conn.execute(
                    "SELECT text FROM chunks WHERE doc_id = %s ORDER BY chunk_index",
                    (doc_id,),
                )]
                if existing_texts == chunks and status == "indexed":
                    print(f"UNCHANGED {relative_path}: {len(chunks)} chunks")
                    unchanged += 1
                    continue

                # Delete only this seed document's old chunks. Preserve its ID,
                # collection, subsection, and all unrelated documents.
                conn.execute("DELETE FROM chunks WHERE doc_id = %s", (doc_id,))
                conn.execute(
                    "UPDATE documents SET title = %s, topic = %s, status = 'processing', "
                    "error_message = NULL WHERE id = %s",
                    (path.stem, topic, doc_id),
                )
                operation = "UPDATED"
            else:
                doc_id = conn.execute(
                    "INSERT INTO documents (title, topic, path, status) "
                    "VALUES (%s, %s, %s, 'processing') RETURNING id",
                    (path.stem, topic, relative_path),
                ).fetchone()[0]
                collection_id = subsection_id = None
                operation = "ADDED"

            vectors = model.encode(chunks, normalize_embeddings=True, batch_size=16)
            for index, (text, vector) in enumerate(zip(chunks, vectors)):
                n_tokens = count_tokens(text)
                if n_tokens > 384:
                    print(f"WARN {relative_path} chunk {index}: {n_tokens} tokens")
                conn.execute(
                    "INSERT INTO chunks "
                    "(doc_id, chunk_index, topic, text, n_tokens, embedding, "
                    "collection_id, subsection_id) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s::uuid, %s::uuid)",
                    (doc_id, index, topic, text, n_tokens, vector, collection_id, subsection_id),
                )
            conn.execute(
                "UPDATE documents SET chunk_count = %s, status = 'indexed', "
                "error_message = NULL WHERE id = %s",
                (len(chunks), doc_id),
            )
            print(f"{operation} {relative_path}: {len(chunks)} chunks")
            if operation == "ADDED":
                added += 1
            else:
                updated += 1

    print(f"DONE: added={added}, updated={updated}, unchanged={unchanged}, skipped={skipped}")
    print("If the API was running, restart it so its in-memory BM25 index reloads.")


if __name__ == "__main__":
    default_corpus = "corpus" if Path("corpus").exists() else "../corpus"
    main(sys.argv[1] if len(sys.argv) > 1 else default_corpus)

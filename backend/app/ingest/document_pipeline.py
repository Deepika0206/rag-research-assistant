import re
import uuid
from pathlib import Path
from typing import Any

from app.config import MAX_UPLOAD_BYTES, UPLOAD_DIR
from app.ingest.chunker import chunk_text, count_tokens
from app.ingest.extractor import extract_text, normalize_extension
from app.store import (
    create_document_record,
    get_document,
    insert_document_chunks,
    mark_document_failed,
    resolve_destination,
)


def _safe_filename(name: str) -> str:
    base = Path(name or "document.txt").name
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", base).strip("._")
    return cleaned or "document.txt"


def ingest_uploaded_file(
    *,
    filename: str,
    data: bytes,
    retriever: Any,
    collection_id: str | None = None,
    subsection_id: str | None = None,
) -> dict[str, Any]:
    """Save an uploaded document, extract text, chunk, embed, store in pgvector, and update live index."""
    safe_name = _safe_filename(filename)
    ext = normalize_extension(safe_name)
    if ext not in {".pdf", ".docx", ".doc", ".txt", ".md"}:
        raise ValueError(
            f"Unsupported file type '{ext or 'unknown'}' for '{filename}'. Allowed: .pdf, .docx, .doc, .txt, .md."
        )
    if not data:
        raise ValueError(f"File '{filename}' is empty.")
    if len(data) > MAX_UPLOAD_BYTES:
        mb = MAX_UPLOAD_BYTES // (1024 * 1024)
        raise ValueError(f"File '{filename}' exceeds the {mb} MB size limit.")

    target_col_id, target_sub_id, topic_label = resolve_destination(collection_id, subsection_id)

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    unique_prefix = uuid.uuid4().hex[:12]
    disk_name = f"{unique_prefix}_{safe_name}"
    disk_path = UPLOAD_DIR / disk_name
    disk_path.write_bytes(data)

    doc_rel_path = f"uploads/{unique_prefix}/{safe_name}"
    title = Path(safe_name).stem.replace("_", " ").replace("-", " ").strip() or safe_name

    doc_id = create_document_record(
        title=title,
        topic=topic_label,
        path=doc_rel_path,
        collection_id=target_col_id,
        subsection_id=target_sub_id,
        filename=safe_name,
        file_type=ext.lstrip("."),
        file_size=len(data),
        stored_path=str(disk_path),
        status="processing",
    )

    try:
        raw_text = extract_text(safe_name, data)
        chunks = chunk_text(raw_text)
        if not chunks:
            raise ValueError("Document yielded no usable text chunks.")

        if getattr(retriever, "embedder", None) is None:
            raise RuntimeError("Embedding model is not initialized.")

        lock = getattr(retriever, "_lock", None)
        if lock is not None:
            with lock:
                vectors = retriever.embedder.encode(chunks, normalize_embeddings=True, batch_size=16)
        else:
            vectors = retriever.embedder.encode(chunks, normalize_embeddings=True, batch_size=16)

        chunk_rows = [
            (i, chunk_text_val, count_tokens(chunk_text_val), vec)
            for i, (chunk_text_val, vec) in enumerate(zip(chunks, vectors))
        ]
        inserted_chunks = insert_document_chunks(
            doc_id=doc_id,
            topic=topic_label,
            doc_path=doc_rel_path,
            collection_id=target_col_id,
            subsection_id=target_sub_id,
            chunk_rows=chunk_rows,
        )
        if hasattr(retriever, "add_chunks"):
            retriever.add_chunks(inserted_chunks)

        doc_record = get_document(doc_id)
        if doc_record is None:
            return {
                "id": doc_id,
                "title": title,
                "filename": safe_name,
                "file_type": ext.lstrip("."),
                "file_size": len(data),
                "status": "indexed",
                "chunk_count": len(inserted_chunks),
                "collection_id": target_col_id,
                "subsection_id": target_sub_id,
                "topic": topic_label,
                "path": doc_rel_path,
            }
        return doc_record
    except Exception as exc:
        mark_document_failed(doc_id, str(exc))
        raise

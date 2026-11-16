from pathlib import Path
from typing import Any
import uuid

import psycopg
from pgvector.psycopg import register_vector
from psycopg.types.json import Jsonb

from app.config import DATABASE_URL

DEFAULT_COLLECTION_NAME = "Unassigned"


class ConflictError(Exception):
    pass


class NotFoundError(Exception):
    pass


class ValidationError(Exception):
    pass


def _schema_path() -> Path:
    return Path(__file__).resolve().parent / "schema.sql"


def ensure_schema() -> str:
    """Create/upgrade tables idempotently and guarantee a default Unassigned collection exists."""
    schema_file = _schema_path()
    sql = schema_file.read_text(encoding="utf-8") if schema_file.exists() else ""
    with psycopg.connect(DATABASE_URL) as conn:
        if sql:
            conn.execute(sql)
        row = conn.execute(
            "SELECT id::text FROM collections WHERE is_default = TRUE ORDER BY created_at ASC LIMIT 1"
        ).fetchone()
        if row:
            return row[0]
        row = conn.execute(
            "SELECT id::text FROM collections WHERE LOWER(name) = LOWER(%s) LIMIT 1",
            (DEFAULT_COLLECTION_NAME,),
        ).fetchone()
        if row:
            conn.execute("UPDATE collections SET is_default = TRUE WHERE id = %s::uuid", (row[0],))
            return row[0]
        created = conn.execute(
            "INSERT INTO collections (name, is_default) VALUES (%s, TRUE) RETURNING id::text",
            (DEFAULT_COLLECTION_NAME,),
        ).fetchone()
        return created[0]


def get_default_collection_id(conn=None) -> str:
    if conn is not None:
        row = conn.execute(
            "SELECT id::text FROM collections WHERE is_default = TRUE ORDER BY created_at ASC LIMIT 1"
        ).fetchone()
        if row:
            return row[0]
        created = conn.execute(
            "INSERT INTO collections (name, is_default) VALUES (%s, TRUE) RETURNING id::text",
            (DEFAULT_COLLECTION_NAME,),
        ).fetchone()
        return created[0]
    return ensure_schema()


def list_collections() -> dict[str, Any]:
    with psycopg.connect(DATABASE_URL) as conn:
        default_id = get_default_collection_id(conn)
        col_rows = conn.execute(
            """
            SELECT c.id::text, c.name, c.is_default, c.created_at,
                   COUNT(DISTINCT d.id)::int AS doc_count
            FROM collections c
            LEFT JOIN documents d ON d.collection_id = c.id
            GROUP BY c.id, c.name, c.is_default, c.created_at
            ORDER BY c.is_default ASC, c.created_at ASC
            """
        ).fetchall()

        sub_rows = conn.execute(
            """
            SELECT s.id::text, s.collection_id::text, s.name, s.created_at,
                   COUNT(DISTINCT d.id)::int AS doc_count
            FROM subsections s
            LEFT JOIN documents d ON d.subsection_id = s.id
            GROUP BY s.id, s.collection_id, s.name, s.created_at
            ORDER BY s.created_at ASC
            """
        ).fetchall()

    subs_by_col: dict[str, list[dict[str, Any]]] = {}
    for sid, cid, sname, screated, sdoc_count in sub_rows:
        subs_by_col.setdefault(cid, []).append({
            "id": sid,
            "collection_id": cid,
            "name": sname,
            "doc_count": sdoc_count,
            "created_at": screated.isoformat() if screated else None,
        })

    collections = []
    for cid, cname, is_default, ccreated, doc_count in col_rows:
        collections.append({
            "id": cid,
            "name": cname,
            "is_default": bool(is_default),
            "doc_count": doc_count,
            "created_at": ccreated.isoformat() if ccreated else None,
            "subsections": subs_by_col.get(cid, []),
        })
    return {"collections": collections, "default_collection_id": default_id}


def create_collection(name: str) -> dict[str, Any]:
    with psycopg.connect(DATABASE_URL) as conn:
        exists = conn.execute(
            "SELECT 1 FROM collections WHERE LOWER(name) = LOWER(%s)", (name,)
        ).fetchone()
        if exists:
            raise ConflictError(f"Collection '{name}' already exists.")
        row = conn.execute(
            "INSERT INTO collections (name, is_default) VALUES (%s, FALSE) "
            "RETURNING id::text, name, is_default, created_at",
            (name,),
        ).fetchone()
    return {
        "id": row[0],
        "name": row[1],
        "is_default": bool(row[2]),
        "doc_count": 0,
        "created_at": row[3].isoformat() if row[3] else None,
        "subsections": [],
    }


def rename_collection(collection_id: uuid.UUID, name: str) -> dict[str, Any]:
    with psycopg.connect(DATABASE_URL) as conn:
        cur = conn.execute(
            "SELECT id::text, is_default FROM collections WHERE id = %s", (collection_id,)
        ).fetchone()
        if not cur:
            raise NotFoundError("Collection not found.")
        if cur[1]:
            raise ValidationError("The default Unassigned collection cannot be renamed.")
        dup = conn.execute(
            "SELECT 1 FROM collections WHERE LOWER(name) = LOWER(%s) AND id <> %s",
            (name, collection_id),
        ).fetchone()
        if dup:
            raise ConflictError(f"Collection '{name}' already exists.")
        row = conn.execute(
            "UPDATE collections SET name = %s WHERE id = %s "
            "RETURNING id::text, name, is_default, created_at",
            (name, collection_id),
        ).fetchone()
        doc_count = conn.execute(
            "SELECT COUNT(*)::int FROM documents WHERE collection_id = %s", (collection_id,)
        ).fetchone()[0]
    return {
        "id": row[0],
        "name": row[1],
        "is_default": bool(row[2]),
        "doc_count": doc_count,
        "created_at": row[3].isoformat() if row[3] else None,
    }


def delete_collection(collection_id: uuid.UUID, mode: str) -> dict[str, Any]:
    if mode not in {"delete_all", "move_to_default"}:
        raise ValidationError("Invalid delete mode. Use 'delete_all' or 'move_to_default'.")

    with psycopg.connect(DATABASE_URL) as conn:
        cur = conn.execute(
            "SELECT id::text, is_default FROM collections WHERE id = %s", (collection_id,)
        ).fetchone()
        if not cur:
            raise NotFoundError("Collection not found.")
        if cur[1]:
            raise ValidationError("The default Unassigned collection cannot be deleted.")

        doc_rows = conn.execute(
            "SELECT id, stored_path FROM documents WHERE collection_id = %s",
            (collection_id,),
        ).fetchall()
        doc_ids = [r[0] for r in doc_rows]
        stored_paths = [r[1] for r in doc_rows if r[1]]

        if mode == "delete_all":
            if doc_ids:
                conn.execute("DELETE FROM documents WHERE collection_id = %s", (collection_id,))
            conn.execute("DELETE FROM collections WHERE id = %s", (collection_id,))
            return {
                "deleted_collection_id": str(collection_id),
                "mode": mode,
                "deleted_doc_ids": doc_ids,
                "moved_doc_ids": [],
                "default_collection_id": None,
                "stored_paths": stored_paths,
            }

        default_id = get_default_collection_id(conn)
        if doc_ids:
            conn.execute(
                "UPDATE documents SET collection_id = %s::uuid, subsection_id = NULL WHERE collection_id = %s",
                (default_id, collection_id),
            )
            conn.execute(
                "UPDATE chunks SET collection_id = %s::uuid, subsection_id = NULL WHERE collection_id = %s",
                (default_id, collection_id),
            )
        conn.execute("DELETE FROM collections WHERE id = %s", (collection_id,))
        return {
            "deleted_collection_id": str(collection_id),
            "mode": mode,
            "deleted_doc_ids": [],
            "moved_doc_ids": doc_ids,
            "default_collection_id": default_id,
            "stored_paths": [],
        }


def create_subsection(collection_id: uuid.UUID, name: str) -> dict[str, Any]:
    with psycopg.connect(DATABASE_URL) as conn:
        col = conn.execute("SELECT 1 FROM collections WHERE id = %s", (collection_id,)).fetchone()
        if not col:
            raise NotFoundError("Parent collection not found.")
        dup = conn.execute(
            "SELECT 1 FROM subsections WHERE collection_id = %s AND LOWER(name) = LOWER(%s)",
            (collection_id, name),
        ).fetchone()
        if dup:
            raise ConflictError(f"Subsection '{name}' already exists in this collection.")
        row = conn.execute(
            "INSERT INTO subsections (collection_id, name) VALUES (%s, %s) "
            "RETURNING id::text, collection_id::text, name, created_at",
            (collection_id, name),
        ).fetchone()
    return {
        "id": row[0],
        "collection_id": row[1],
        "name": row[2],
        "doc_count": 0,
        "created_at": row[3].isoformat() if row[3] else None,
    }


def rename_subsection(subsection_id: uuid.UUID, name: str) -> dict[str, Any]:
    with psycopg.connect(DATABASE_URL) as conn:
        cur = conn.execute(
            "SELECT collection_id FROM subsections WHERE id = %s", (subsection_id,)
        ).fetchone()
        if not cur:
            raise NotFoundError("Subsection not found.")
        col_id = cur[0]
        dup = conn.execute(
            "SELECT 1 FROM subsections WHERE collection_id = %s AND LOWER(name) = LOWER(%s) AND id <> %s",
            (col_id, name, subsection_id),
        ).fetchone()
        if dup:
            raise ConflictError(f"Subsection '{name}' already exists in this collection.")
        row = conn.execute(
            "UPDATE subsections SET name = %s WHERE id = %s "
            "RETURNING id::text, collection_id::text, name, created_at",
            (name, subsection_id),
        ).fetchone()
        doc_count = conn.execute(
            "SELECT COUNT(*)::int FROM documents WHERE subsection_id = %s", (subsection_id,)
        ).fetchone()[0]
    return {
        "id": row[0],
        "collection_id": row[1],
        "name": row[2],
        "doc_count": doc_count,
        "created_at": row[3].isoformat() if row[3] else None,
    }


def delete_subsection(subsection_id: uuid.UUID, delete_documents: bool = False) -> dict[str, Any]:
    with psycopg.connect(DATABASE_URL) as conn:
        cur = conn.execute(
            "SELECT collection_id::text FROM subsections WHERE id = %s", (subsection_id,)
        ).fetchone()
        if not cur:
            raise NotFoundError("Subsection not found.")
        parent_collection_id = cur[0]
        doc_rows = conn.execute(
            "SELECT id, stored_path FROM documents WHERE subsection_id = %s",
            (subsection_id,),
        ).fetchall()
        doc_ids = [r[0] for r in doc_rows]
        stored_paths = [r[1] for r in doc_rows if r[1]]

        if delete_documents:
            if doc_ids:
                conn.execute("DELETE FROM documents WHERE subsection_id = %s", (subsection_id,))
            conn.execute("DELETE FROM subsections WHERE id = %s", (subsection_id,))
            return {
                "deleted_subsection_id": str(subsection_id),
                "collection_id": parent_collection_id,
                "deleted_doc_ids": doc_ids,
                "moved_doc_ids": [],
                "stored_paths": stored_paths,
            }

        if doc_ids:
            conn.execute(
                "UPDATE documents SET subsection_id = NULL WHERE subsection_id = %s",
                (subsection_id,),
            )
            conn.execute(
                "UPDATE chunks SET subsection_id = NULL WHERE subsection_id = %s",
                (subsection_id,),
            )
        conn.execute("DELETE FROM subsections WHERE id = %s", (subsection_id,))
        return {
            "deleted_subsection_id": str(subsection_id),
            "collection_id": parent_collection_id,
            "deleted_doc_ids": [],
            "moved_doc_ids": doc_ids,
            "stored_paths": [],
        }


def resolve_destination(collection_id: str | None, subsection_id: str | None) -> tuple[str, str | None, str]:
    """Validate optional collection_id/subsection_id and return (collection_id, subsection_id, topic_label)."""
    with psycopg.connect(DATABASE_URL) as conn:
        sub_uuid = None
        if subsection_id:
            try:
                sub_uuid = uuid.UUID(subsection_id)
            except ValueError as exc:
                raise ValidationError("Invalid subsection_id format.") from exc
            sub_row = conn.execute(
                "SELECT s.id::text, s.collection_id::text, c.name, s.name "
                "FROM subsections s JOIN collections c ON c.id = s.collection_id WHERE s.id = %s",
                (sub_uuid,),
            ).fetchone()
            if not sub_row:
                raise NotFoundError("Target subsection not found.")
            if collection_id and collection_id != sub_row[1]:
                raise ValidationError("Subsection does not belong to the selected collection.")
            return sub_row[1], sub_row[0], f"{sub_row[2]} / {sub_row[3]}"[:40]

        if collection_id:
            try:
                col_uuid = uuid.UUID(collection_id)
            except ValueError as exc:
                raise ValidationError("Invalid collection_id format.") from exc
            col_row = conn.execute(
                "SELECT id::text, name FROM collections WHERE id = %s", (col_uuid,)
            ).fetchone()
            if not col_row:
                raise NotFoundError("Target collection not found.")
            return col_row[0], None, col_row[1][:40]

        default_id = get_default_collection_id(conn)
        return default_id, None, "uploaded"


def create_document_record(
    *,
    title: str,
    topic: str,
    path: str,
    collection_id: str,
    subsection_id: str | None,
    filename: str,
    file_type: str,
    file_size: int,
    stored_path: str,
    status: str = "processing",
) -> int:
    with psycopg.connect(DATABASE_URL) as conn:
        row = conn.execute(
            """
            INSERT INTO documents (
              title, topic, path, collection_id, subsection_id,
              filename, file_type, file_size, status, stored_path, chunk_count
            )
            VALUES (%s, %s, %s, %s::uuid, %s::uuid, %s, %s, %s, %s, %s, 0)
            RETURNING id
            """,
            (title, topic, path, collection_id, subsection_id, filename, file_type, file_size, status, stored_path),
        ).fetchone()
    return int(row[0])


def insert_document_chunks(
    *,
    doc_id: int,
    topic: str,
    doc_path: str,
    collection_id: str,
    subsection_id: str | None,
    chunk_rows: list[tuple[int, str, int, Any]],
) -> list[dict[str, Any]]:
    inserted: list[dict[str, Any]] = []
    with psycopg.connect(DATABASE_URL) as conn:
        register_vector(conn)
        for idx, text, n_tokens, vec in chunk_rows:
            row = conn.execute(
                """
                INSERT INTO chunks (doc_id, chunk_index, topic, text, n_tokens, embedding, collection_id, subsection_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s::uuid, %s::uuid)
                RETURNING id
                """,
                (doc_id, idx, topic, text, n_tokens, vec, collection_id, subsection_id),
            ).fetchone()
            inserted.append({
                "chunk_id": int(row[0]),
                "doc_id": doc_id,
                "topic": topic,
                "text": text,
                "doc": doc_path,
                "collection_id": collection_id,
                "subsection_id": subsection_id,
            })
        conn.execute(
            "UPDATE documents SET status = 'indexed', chunk_count = %s, error_message = NULL WHERE id = %s",
            (len(inserted), doc_id),
        )
    return inserted


def mark_document_failed(doc_id: int, error_message: str) -> None:
    with psycopg.connect(DATABASE_URL) as conn:
        conn.execute(
            "UPDATE documents SET status = 'failed', error_message = %s WHERE id = %s",
            (error_message[:500], doc_id),
        )


def _doc_dict(row) -> dict[str, Any]:
    (
        doc_id,
        title,
        topic,
        path,
        collection_id,
        collection_name,
        subsection_id,
        subsection_name,
        filename,
        file_type,
        file_size,
        status,
        error_message,
        chunk_count,
        created_at,
    ) = row
    return {
        "id": int(doc_id),
        "title": title,
        "topic": topic,
        "path": path,
        "collection_id": collection_id,
        "collection_name": collection_name,
        "subsection_id": subsection_id,
        "subsection_name": subsection_name,
        "filename": filename or Path(path).name,
        "file_type": (file_type or Path(path).suffix.lstrip(".") or "md").lower(),
        "file_size": int(file_size or 0),
        "status": status or "indexed",
        "error_message": error_message,
        "chunk_count": int(chunk_count or 0),
        "created_at": created_at.isoformat() if created_at else None,
    }


def list_documents(
    collection_id: str | None = None,
    subsection_id: str | None = None,
    unassigned_only: bool = False,
) -> list[dict[str, Any]]:
    clauses: list[str] = []
    params: list[Any] = []
    if subsection_id:
        try:
            sub_uuid = uuid.UUID(subsection_id)
        except ValueError as exc:
            raise ValidationError("Invalid subsection_id format.") from exc
        clauses.append("d.subsection_id = %s")
        params.append(sub_uuid)
    elif collection_id:
        try:
            col_uuid = uuid.UUID(collection_id)
        except ValueError as exc:
            raise ValidationError("Invalid collection_id format.") from exc
        clauses.append("d.collection_id = %s")
        params.append(col_uuid)
    elif unassigned_only:
        clauses.append("(c.is_default = TRUE OR d.collection_id IS NULL)")

    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    sql = f"""
        SELECT d.id, d.title, d.topic, d.path,
               d.collection_id::text, c.name,
               d.subsection_id::text, s.name,
               d.filename, d.file_type, d.file_size, d.status, d.error_message,
               CASE WHEN d.chunk_count > 0 THEN d.chunk_count
                    ELSE (SELECT COUNT(*)::int FROM chunks ch WHERE ch.doc_id = d.id) END AS chunk_count,
               d.created_at
        FROM documents d
        LEFT JOIN collections c ON c.id = d.collection_id
        LEFT JOIN subsections s ON s.id = d.subsection_id
        {where}
        ORDER BY d.created_at DESC NULLS LAST, d.id DESC
    """
    with psycopg.connect(DATABASE_URL) as conn:
        rows = conn.execute(sql, params).fetchall()
    return [_doc_dict(r) for r in rows]


def get_document(doc_id: int) -> dict[str, Any] | None:
    sql = """
        SELECT d.id, d.title, d.topic, d.path,
               d.collection_id::text, c.name,
               d.subsection_id::text, s.name,
               d.filename, d.file_type, d.file_size, d.status, d.error_message,
               CASE WHEN d.chunk_count > 0 THEN d.chunk_count
                    ELSE (SELECT COUNT(*)::int FROM chunks ch WHERE ch.doc_id = d.id) END AS chunk_count,
               d.created_at
        FROM documents d
        LEFT JOIN collections c ON c.id = d.collection_id
        LEFT JOIN subsections s ON s.id = d.subsection_id
        WHERE d.id = %s
    """
    with psycopg.connect(DATABASE_URL) as conn:
        row = conn.execute(sql, (doc_id,)).fetchone()
        if not row:
            return None
        doc = _doc_dict(row)
        chunk_rows = conn.execute(
            "SELECT id, chunk_index, n_tokens, text FROM chunks WHERE doc_id = %s ORDER BY chunk_index ASC LIMIT 10",
            (doc_id,),
        ).fetchall()
    doc["chunks"] = [
        {"chunk_id": int(r[0]), "chunk_index": int(r[1]), "n_tokens": int(r[2]), "text": r[3]}
        for r in chunk_rows
    ]
    return doc


def delete_document(doc_id: int) -> dict[str, Any]:
    with psycopg.connect(DATABASE_URL) as conn:
        row = conn.execute(
            "SELECT id, stored_path, path FROM documents WHERE id = %s", (doc_id,)
        ).fetchone()
        if not row:
            raise NotFoundError("Document not found.")
        stored_path = row[1]
        doc_path = row[2]
        conn.execute("DELETE FROM documents WHERE id = %s", (doc_id,))
    return {"deleted_doc_id": int(doc_id), "stored_path": stored_path, "path": doc_path}


def save_run(question: str, topic: str | None, mode: str, result: dict) -> str:
    with psycopg.connect(DATABASE_URL) as conn:
        row = conn.execute(
            "INSERT INTO agent_runs (question, topic, mode, status, answer, result, latency_ms) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id",
            (question, topic, mode, result["status"], result["answer"],
             Jsonb(result), result.get("latency_ms")),
        ).fetchone()
    return str(row[0])


def load_run(run_id: uuid.UUID) -> dict | None:
    with psycopg.connect(DATABASE_URL) as conn:
        row = conn.execute(
            "SELECT result, created_at FROM agent_runs WHERE id = %s", (run_id,)
        ).fetchone()
    if row is None:
        return None
    result, created_at = row
    return {**result, "run_id": str(run_id), "created_at": created_at.isoformat()}


def create_conversation(
    conversation_id: str,
    title: str,
    collection_id: str | None = None,
) -> dict[str, Any]:
    with psycopg.connect(DATABASE_URL) as conn:
        conn.execute(
            """
            INSERT INTO conversations (id, title, collection_id)
            VALUES (%s, %s, %s::uuid)
            ON CONFLICT (id) DO NOTHING
            """,
            (conversation_id, title, collection_id),
        )
        row = conn.execute(
            """
            SELECT id, title, is_pinned, collection_id::text, created_at, updated_at
            FROM conversations WHERE id = %s
            """,
            (conversation_id,),
        ).fetchone()
    if row is None:
        raise NotFoundError("Conversation could not be created.")
    return {
        "id": row[0],
        "title": row[1],
        "is_pinned": row[2],
        "collection_id": row[3],
        "created_at": row[4].isoformat(),
        "updated_at": row[5].isoformat(),
        "messages": [],
        "run_ids": [],
    }


def list_conversations() -> list[dict[str, Any]]:
    with psycopg.connect(DATABASE_URL) as conn:
        rows = conn.execute(
            """
            SELECT c.id, c.title, c.is_pinned, c.collection_id::text,
                   c.created_at, c.updated_at,
                   COALESCE(
                     ARRAY_AGG(DISTINCT m.run_id::text)
                       FILTER (WHERE m.run_id IS NOT NULL),
                     ARRAY[]::text[]
                   ) AS run_ids,
                   COALESCE(STRING_AGG(m.content, ' ' ORDER BY m.sequence), '') AS search_text
            FROM conversations c
            LEFT JOIN conversation_messages m ON m.conversation_id = c.id
            GROUP BY c.id
            ORDER BY c.updated_at DESC, c.created_at DESC
            """
        ).fetchall()
    return [
        {
            "id": row[0],
            "title": row[1],
            "is_pinned": row[2],
            "collection_id": row[3],
            "created_at": row[4].isoformat(),
            "updated_at": row[5].isoformat(),
            "run_ids": row[6],
            "search_text": row[7],
        }
        for row in rows
    ]


def get_conversation(conversation_id: str) -> dict[str, Any] | None:
    with psycopg.connect(DATABASE_URL) as conn:
        row = conn.execute(
            """
            SELECT id, title, is_pinned, collection_id::text, created_at, updated_at
            FROM conversations WHERE id = %s
            """,
            (conversation_id,),
        ).fetchone()
        if row is None:
            return None
        message_rows = conn.execute(
            """
            SELECT id, role, content, created_at, run_id::text, response, error
            FROM conversation_messages
            WHERE conversation_id = %s
            ORDER BY sequence ASC
            """,
            (conversation_id,),
        ).fetchall()

    messages = []
    run_ids = []
    for msg in message_rows:
        response = msg[5]
        if response is not None and msg[4]:
            response = {**response, "run_id": msg[4]}
        if msg[4] and msg[4] not in run_ids:
            run_ids.append(msg[4])
        messages.append({
            "id": msg[0],
            "role": msg[1],
            "content": msg[2],
            "timestamp": msg[3].isoformat(),
            "run_id": msg[4],
            "response": response,
            "error": msg[6],
        })
    return {
        "id": row[0],
        "title": row[1],
        "is_pinned": row[2],
        "collection_id": row[3],
        "created_at": row[4].isoformat(),
        "updated_at": row[5].isoformat(),
        "run_ids": run_ids,
        "search_text": " ".join(message["content"] for message in messages),
        "messages": messages,
    }


def get_conversation_for_run(run_id: uuid.UUID) -> dict[str, Any] | None:
    with psycopg.connect(DATABASE_URL) as conn:
        row = conn.execute(
            """
            SELECT conversation_id
            FROM conversation_messages
            WHERE run_id = %s
            ORDER BY sequence DESC
            LIMIT 1
            """,
            (run_id,),
        ).fetchone()
    return get_conversation(row[0]) if row else None


def update_conversation(conversation_id: str, changes: dict[str, Any]) -> dict[str, Any]:
    allowed = {"title", "is_pinned", "collection_id"}
    assignments = []
    values = []
    for field in allowed:
        if field in changes:
            assignments.append(f"{field} = %s::uuid" if field == "collection_id" else f"{field} = %s")
            values.append(changes[field])
    if not assignments:
        raise ValidationError("No conversation changes were provided.")
    assignments.append("updated_at = now()")
    values.append(conversation_id)
    with psycopg.connect(DATABASE_URL) as conn:
        row = conn.execute(
            f"""
            UPDATE conversations SET {", ".join(assignments)}
            WHERE id = %s
            RETURNING id
            """,
            values,
        ).fetchone()
    if row is None:
        raise NotFoundError("Conversation not found.")
    updated = get_conversation(conversation_id)
    if updated is None:
        raise NotFoundError("Conversation not found.")
    return updated


def delete_conversation(conversation_id: str) -> None:
    with psycopg.connect(DATABASE_URL) as conn:
        row = conn.execute(
            "DELETE FROM conversations WHERE id = %s RETURNING id",
            (conversation_id,),
        ).fetchone()
    if row is None:
        raise NotFoundError("Conversation not found.")


def import_legacy_conversations(conversations: list[dict[str, Any]]) -> None:
    with psycopg.connect(DATABASE_URL) as conn:
        for item in conversations:
            collection_id = item.get("collection_id")
            try:
                collection_id = str(uuid.UUID(collection_id)) if collection_id else None
            except (TypeError, ValueError):
                collection_id = None
            if collection_id and not conn.execute(
                "SELECT 1 FROM collections WHERE id = %s::uuid", (collection_id,)
            ).fetchone():
                collection_id = None
            conn.execute(
                """
                INSERT INTO conversations (
                    id, title, is_pinned, collection_id, created_at, updated_at
                )
                VALUES (%s, %s, %s, %s::uuid,
                        %s::timestamptz, %s::timestamptz)
                ON CONFLICT (id) DO NOTHING
                """,
                (
                    item["id"],
                    item["title"],
                    item.get("is_pinned", False),
                    collection_id,
                    item["created_at"],
                    item["updated_at"],
                ),
            )

            imported_messages = item.get("messages", [])
            pending_user: int | None = None
            associated_runs: dict[int, str | None] = {}
            for index, message in enumerate(imported_messages):
                if message["role"] == "user":
                    pending_user = index
                elif message["role"] == "assistant":
                    response = message.get("response") or {}
                    run_id = response.get("run_id")
                    if pending_user is not None:
                        associated_runs[pending_user] = run_id
                        pending_user = None
                    associated_runs[index] = run_id

            migrated_run_ids: set[uuid.UUID] = set()
            for index, message in enumerate(imported_messages):
                raw_run_id = associated_runs.get(index)
                try:
                    run_id = uuid.UUID(raw_run_id) if raw_run_id else None
                except (TypeError, ValueError):
                    run_id = None
                if run_id and not conn.execute(
                    "SELECT 1 FROM agent_runs WHERE id = %s", (run_id,)
                ).fetchone():
                    run_id = None
                if run_id:
                    migrated_run_ids.add(run_id)

                response = message.get("response")
                response_json = Jsonb(response) if response is not None else None
                if run_id:
                    conn.execute(
                        """
                        INSERT INTO conversation_messages (
                            id, conversation_id, role, content, created_at,
                            run_id, response, error
                        )
                        VALUES (%s, %s, %s, %s, %s::timestamptz, %s, %s, %s)
                        ON CONFLICT (run_id, role) WHERE run_id IS NOT NULL
                        DO UPDATE SET conversation_id = EXCLUDED.conversation_id,
                                      content = EXCLUDED.content,
                                      created_at = EXCLUDED.created_at,
                                      sequence = EXCLUDED.sequence,
                                      response = EXCLUDED.response,
                                      error = EXCLUDED.error
                        """,
                        (
                            message["id"],
                            item["id"],
                            message["role"],
                            message["content"],
                            message["timestamp"],
                            run_id,
                            response_json,
                            message.get("error"),
                        ),
                    )
                else:
                    conn.execute(
                        """
                        INSERT INTO conversation_messages (
                            id, conversation_id, role, content, created_at,
                            response, error
                        )
                        VALUES (%s, %s, %s, %s, %s::timestamptz, %s, %s)
                        ON CONFLICT (id) DO NOTHING
                        """,
                        (
                            message["id"],
                            item["id"],
                            message["role"],
                            message["content"],
                            message["timestamp"],
                            response_json,
                            message.get("error"),
                        ),
                    )

            if migrated_run_ids:
                conn.execute(
                    """
                    DELETE FROM conversations c
                    WHERE c.legacy_run_id = ANY(%s)
                      AND c.id <> %s
                      AND NOT EXISTS (
                        SELECT 1 FROM conversation_messages m
                        WHERE m.conversation_id = c.id
                      )
                    """,
                    (list(migrated_run_ids), item["id"]),
                )


def save_conversation_user_message(
    conversation_id: str,
    message_id: str,
    content: str,
) -> None:
    with psycopg.connect(DATABASE_URL) as conn:
        if not conn.execute(
            "SELECT 1 FROM conversations WHERE id = %s", (conversation_id,)
        ).fetchone():
            raise NotFoundError("Conversation not found.")
        conn.execute(
            """
            INSERT INTO conversation_messages (
                id, conversation_id, role, content, request_id
            )
            VALUES (%s, %s, 'user', %s, %s)
            ON CONFLICT (conversation_id, request_id, role)
              WHERE request_id IS NOT NULL
            DO NOTHING
            """,
            (message_id, conversation_id, content, message_id),
        )
        existing = conn.execute(
            """
            SELECT content FROM conversation_messages
            WHERE conversation_id = %s AND request_id = %s AND role = 'user'
            """,
            (conversation_id, message_id),
        ).fetchone()
        if existing is None or existing[0] != content:
            raise ConflictError("This message ID was already used for another question.")
        conn.execute(
            """
            UPDATE conversations
            SET title = CASE
                          WHEN title = 'New Research Chat'
                           AND NOT EXISTS (
                             SELECT 1 FROM conversation_messages
                             WHERE conversation_id = %s
                               AND role = 'user' AND request_id <> %s
                           )
                          THEN LEFT(%s, 160)
                          ELSE title
                        END,
                updated_at = now()
            WHERE id = %s
            """,
            (conversation_id, message_id, content, conversation_id),
        )


def load_conversation_response(
    conversation_id: str,
    message_id: str,
) -> dict[str, Any] | None:
    with psycopg.connect(DATABASE_URL) as conn:
        row = conn.execute(
            """
            SELECT response, run_id::text FROM conversation_messages
            WHERE conversation_id = %s
              AND request_id = %s
              AND role = 'assistant'
              AND response IS NOT NULL
            """,
            (conversation_id, message_id),
        ).fetchone()
    if row is None:
        return None
    response = row[0]
    return {**response, "run_id": row[1]} if row[1] else response


def save_conversation_run(
    conversation_id: str,
    message_id: str,
    question: str,
    topic: str | None,
    mode: str,
    result: dict[str, Any],
) -> dict[str, Any]:
    with psycopg.connect(DATABASE_URL) as conn:
        row = conn.execute(
            """
            INSERT INTO agent_runs (
                question, topic, mode, status, answer, result, latency_ms, request_id
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (request_id) WHERE request_id IS NOT NULL DO NOTHING
            RETURNING id, result
            """,
            (
                question,
                topic,
                mode,
                result["status"],
                result["answer"],
                Jsonb(result),
                result.get("latency_ms"),
                message_id,
            ),
        ).fetchone()
        if row is None:
            row = conn.execute(
                "SELECT id, result FROM agent_runs WHERE request_id = %s",
                (message_id,),
            ).fetchone()
        if row is None:
            raise RuntimeError("The research run could not be stored.")

        run_id = str(row[0])
        stored_result = row[1]
        conn.execute(
            """
            UPDATE conversation_messages
            SET run_id = %s
            WHERE conversation_id = %s AND request_id = %s AND role = 'user'
            """,
            (row[0], conversation_id, message_id),
        )
        conn.execute(
            """
            INSERT INTO conversation_messages (
                id, conversation_id, role, content, run_id, request_id, response
            )
            VALUES (%s, %s, 'assistant', %s, %s, %s, %s)
            ON CONFLICT (conversation_id, request_id, role)
              WHERE request_id IS NOT NULL
            DO UPDATE SET content = EXCLUDED.content,
                          run_id = EXCLUDED.run_id,
                          response = EXCLUDED.response,
                          error = NULL
            """,
            (
                str(uuid.uuid4()),
                conversation_id,
                stored_result["answer"],
                row[0],
                message_id,
                Jsonb({**stored_result, "run_id": run_id}),
            ),
        )
        conn.execute(
            "UPDATE conversations SET updated_at = now() WHERE id = %s",
            (conversation_id,),
        )
    return {**stored_result, "run_id": run_id}


def save_conversation_error(
    conversation_id: str,
    message_id: str,
    error: str,
) -> None:
    with psycopg.connect(DATABASE_URL) as conn:
        conn.execute(
            """
            INSERT INTO conversation_messages (
                id, conversation_id, role, content, request_id, error
            )
            VALUES (%s, %s, 'assistant', '', %s, %s)
            ON CONFLICT (conversation_id, request_id, role)
              WHERE request_id IS NOT NULL
            DO UPDATE SET error = EXCLUDED.error
            """,
            (str(uuid.uuid4()), conversation_id, message_id, error),
        )
        conn.execute(
            "UPDATE conversations SET updated_at = now() WHERE id = %s",
            (conversation_id,),
        )


def ping() -> bool:
    try:
        with psycopg.connect(DATABASE_URL, connect_timeout=3) as conn:
            conn.execute("SELECT 1")
        return True
    except Exception:
        return False

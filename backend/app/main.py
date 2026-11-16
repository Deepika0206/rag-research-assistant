import logging
import os
import threading
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from anthropic import APIError
from fastapi import FastAPI, File, Form, Header, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app import config
from app.agent.graph import build_graph, run_agent
from app.baseline import baseline_answer
from app.ingest.document_pipeline import ingest_uploaded_file
from app.retrieval.retriever import Retriever
from app.schemas import (
    AskRequest,
    CollectionCreate,
    CollectionRename,
    ConversationCreate,
    ConversationImport,
    ConversationUpdate,
    SubsectionCreate,
    SubsectionRename,
)

from app.security import DailyCap, RateLimiter, code_ok
from app.service import shape_agentic, shape_baseline
from app.store import (
    ConflictError,
    NotFoundError,
    ValidationError,
    create_conversation,
    create_collection,
    create_subsection,
    delete_conversation,
    delete_collection,
    delete_document,
    delete_subsection,
    ensure_schema,
    get_conversation,
    get_conversation_for_run,
    get_document,
    import_legacy_conversations,
    list_conversations,
    list_collections,
    list_documents,
    load_conversation_response,
    load_run,
    ping,
    rename_collection,
    rename_subsection,
    save_run,
    save_conversation_error,
    save_conversation_run,
    save_conversation_user_message,
    update_conversation,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("rag")


def require_access(code: str | None) -> None:
    if not code_ok(code, config.ACCESS_CODE):
        raise HTTPException(401, "Access code is missing or wrong.")


def _sync_topics(app: FastAPI) -> list[str]:
    retriever = getattr(app.state, "retriever", None)
    if retriever and hasattr(retriever, "chunks"):
        topics = sorted({c["topic"] for c in retriever.chunks.values() if c.get("topic")})
        app.state.topics = topics
        return topics
    return getattr(app.state, "topics", [])


def _remove_files(paths: list[str]) -> None:
    for p in paths:
        try:
            Path(p).unlink(missing_ok=True)
        except Exception:
            logger.warning("Could not delete stored file %s", p)


@asynccontextmanager
async def lifespan(app: FastAPI):
    import langgraph
    import langgraph.graph
    if getattr(langgraph, "__file__", None) is None:
        langgraph.__file__ = langgraph.graph.__file__
    if not hasattr(langgraph.graph, "StateGraph"):
        raise RuntimeError("Real LangGraph StateGraph is not available.")

    # ACCESS_CODE must be present for any non-local deployment
    is_local = any(origin in ("http://localhost:3000", "http://127.0.0.1:3000") for origin in config.ALLOWED_ORIGINS) and not os.getenv("RENDER")
    if not is_local and not config.ACCESS_CODE:
        raise RuntimeError("Non-local deployment requires ACCESS_CODE to be configured.")
    if not config.ENABLE_DOCS and not config.ACCESS_CODE:
        raise RuntimeError("Production mode (ENABLE_DOCS=0) requires ACCESS_CODE to be configured.")

    logger.info("STARTUP STEP 1: Connecting to PostgreSQL")
    ensure_schema()
    logger.info("STARTUP STEP 1 COMPLETE: Database schema ready")

    logger.info("STARTUP STEP 2: Initializing Retriever")
    retriever = Retriever()
    logger.info("STARTUP STEP 2 COMPLETE: Retriever ready")

    app.state.retriever = retriever

    logger.info("STARTUP STEP 3: Building LangGraph")
    app.state.graph = build_graph(retriever)
    logger.info("STARTUP STEP 3 COMPLETE: LangGraph ready")
    app.state.topics = sorted({c["topic"] for c in retriever.chunks.values()})
    app.state.limiter = RateLimiter(config.RATE_LIMIT_PER_MIN, 60)
    app.state.cap = DailyCap(config.DAILY_RUN_LIMIT)
    app.state.slots = threading.BoundedSemaphore(config.MAX_CONCURRENT_RUNS)
    logger.info("Ready: %d chunks, topics=%s", len(retriever.chunks), app.state.topics)
    yield


app = FastAPI(
    title="RAG Research Assistant",
    lifespan=lifespan,
    docs_url="/docs" if config.ENABLE_DOCS else None,
    redoc_url=None,
    openapi_url="/openapi.json" if config.ENABLE_DOCS else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-Access-Code"],
)


@app.get("/api/health")
def health(request: Request):
    if not ping():
        raise HTTPException(503, "The database is not reachable.")
    return {
        "status": "ok",
        "db": True,
        "chunks": len(request.app.state.retriever.chunks),
        "model": config.CLAUDE_MODEL,
        "retrieval_mode": request.app.state.retriever.mode,
    }


@app.get("/api/topics")
def topics(request: Request):
    return {"topics": _sync_topics(request.app)}


# ---------------- Collection & Subsection Management ---------------- #


@app.get("/api/collections")
def api_list_collections(x_access_code: str | None = Header(default=None)):
    require_access(x_access_code)
    try:
        return list_collections()
    except Exception:
        logger.exception("Database error listing collections")
        raise HTTPException(503, "The database is not reachable.")


@app.post("/api/collections", status_code=201)
def api_create_collection(req: CollectionCreate, x_access_code: str | None = Header(default=None)):
    require_access(x_access_code)
    try:
        return create_collection(req.name)
    except ConflictError as exc:
        raise HTTPException(409, str(exc))
    except Exception:
        logger.exception("Database error creating collection")
        raise HTTPException(503, "Could not create collection.")


@app.patch("/api/collections/{collection_id}")
def api_rename_collection(
    collection_id: uuid.UUID,
    req: CollectionRename,
    x_access_code: str | None = Header(default=None),
):
    require_access(x_access_code)
    try:
        return rename_collection(collection_id, req.name)
    except NotFoundError as exc:
        raise HTTPException(404, str(exc))
    except ConflictError as exc:
        raise HTTPException(409, str(exc))
    except ValidationError as exc:
        raise HTTPException(400, str(exc))
    except Exception:
        logger.exception("Database error renaming collection")
        raise HTTPException(503, "Could not rename collection.")


@app.delete("/api/collections/{collection_id}")
def api_delete_collection(
    collection_id: uuid.UUID,
    request: Request,
    mode: str = Query(default="move_to_default"),
    x_access_code: str | None = Header(default=None),
):
    require_access(x_access_code)
    try:
        res = delete_collection(collection_id, mode)
    except NotFoundError as exc:
        raise HTTPException(404, str(exc))
    except ValidationError as exc:
        raise HTTPException(400, str(exc))
    except Exception:
        logger.exception("Database error deleting collection")
        raise HTTPException(503, "Could not delete collection.")

    retriever = getattr(request.app.state, "retriever", None)
    if res["deleted_doc_ids"]:
        if retriever and hasattr(retriever, "remove_docs"):
            retriever.remove_docs(res["deleted_doc_ids"])
        _remove_files(res["stored_paths"])
    elif res["moved_doc_ids"] and retriever and hasattr(retriever, "update_doc_location"):
        retriever.update_doc_location(res["moved_doc_ids"], res["default_collection_id"], None)
    _sync_topics(request.app)
    return {
        "deleted_collection_id": res["deleted_collection_id"],
        "mode": res["mode"],
        "deleted_doc_ids": res["deleted_doc_ids"],
        "moved_doc_ids": res["moved_doc_ids"],
        "default_collection_id": res["default_collection_id"],
    }


@app.post("/api/collections/{collection_id}/subsections", status_code=201)
def api_create_subsection(
    collection_id: uuid.UUID,
    req: SubsectionCreate,
    x_access_code: str | None = Header(default=None),
):
    require_access(x_access_code)
    try:
        return create_subsection(collection_id, req.name)
    except NotFoundError as exc:
        raise HTTPException(404, str(exc))
    except ConflictError as exc:
        raise HTTPException(409, str(exc))
    except Exception:
        logger.exception("Database error creating subsection")
        raise HTTPException(503, "Could not create subsection.")


@app.patch("/api/subsections/{subsection_id}")
def api_rename_subsection(
    subsection_id: uuid.UUID,
    req: SubsectionRename,
    x_access_code: str | None = Header(default=None),
):
    require_access(x_access_code)
    try:
        return rename_subsection(subsection_id, req.name)
    except NotFoundError as exc:
        raise HTTPException(404, str(exc))
    except ConflictError as exc:
        raise HTTPException(409, str(exc))
    except Exception:
        logger.exception("Database error renaming subsection")
        raise HTTPException(503, "Could not rename subsection.")


@app.delete("/api/subsections/{subsection_id}")
def api_delete_subsection(
    subsection_id: uuid.UUID,
    request: Request,
    delete_documents: bool = Query(default=False),
    x_access_code: str | None = Header(default=None),
):
    require_access(x_access_code)
    try:
        res = delete_subsection(subsection_id, delete_documents=delete_documents)
    except NotFoundError as exc:
        raise HTTPException(404, str(exc))
    except Exception:
        logger.exception("Database error deleting subsection")
        raise HTTPException(503, "Could not delete subsection.")

    retriever = getattr(request.app.state, "retriever", None)
    if res["deleted_doc_ids"]:
        if retriever and hasattr(retriever, "remove_docs"):
            retriever.remove_docs(res["deleted_doc_ids"])
        _remove_files(res["stored_paths"])
    elif res["moved_doc_ids"] and retriever and hasattr(retriever, "update_doc_location"):
        retriever.update_doc_location(res["moved_doc_ids"], res["collection_id"], None)
    _sync_topics(request.app)
    return {
        "deleted_subsection_id": res["deleted_subsection_id"],
        "collection_id": res["collection_id"],
        "deleted_doc_ids": res["deleted_doc_ids"],
        "moved_doc_ids": res["moved_doc_ids"],
    }


# ---------------- Document Management & Ingestion ---------------- #


@app.get("/api/documents")
def api_list_documents(
    collection_id: str | None = Query(default=None),
    subsection_id: str | None = Query(default=None),
    unassigned: bool = Query(default=False),
    x_access_code: str | None = Header(default=None),
):
    require_access(x_access_code)
    try:
        docs = list_documents(
            collection_id=collection_id,
            subsection_id=subsection_id,
            unassigned_only=unassigned,
        )
        return {"documents": docs}
    except ValidationError as exc:
        raise HTTPException(422, str(exc))
    except Exception:
        logger.exception("Database error listing documents")
        raise HTTPException(503, "Could not load documents.")


@app.get("/api/documents/{doc_id}")
def api_get_document(doc_id: int, x_access_code: str | None = Header(default=None)):
    require_access(x_access_code)
    try:
        doc = get_document(doc_id)
    except Exception:
        logger.exception("Database error getting document")
        raise HTTPException(503, "Could not load document.")
    if doc is None:
        raise HTTPException(404, "Document not found.")
    return doc


@app.post("/api/documents/upload")
async def api_upload_documents(
    request: Request,
    files: list[UploadFile] = File(...),
    collection_id: str | None = Form(default=None),
    subsection_id: str | None = Form(default=None),
    x_access_code: str | None = Header(default=None),
):
    require_access(x_access_code)
    if not files:
        raise HTTPException(400, "No files were provided.")

    retriever = request.app.state.retriever
    uploaded: list[dict] = []
    errors: list[dict] = []

    for f in files:
        filename = f.filename or "document.txt"
        try:
            data = await f.read()
            doc = ingest_uploaded_file(
                filename=filename,
                data=data,
                retriever=retriever,
                collection_id=collection_id or None,
                subsection_id=subsection_id or None,
            )
            uploaded.append(doc)
        except (ValueError, ValidationError) as exc:
            errors.append({"filename": filename, "error": str(exc)})
        except NotFoundError as exc:
            raise HTTPException(404, str(exc))
        except Exception as exc:
            logger.exception("Error ingesting uploaded file %s", filename)
            errors.append({"filename": filename, "error": str(exc) or "Failed to process file."})

    _sync_topics(request.app)

    if not uploaded and errors:
        raise HTTPException(422, errors[0]["error"])

    return {
        "uploaded": uploaded,
        "errors": errors,
        "total_uploaded": len(uploaded),
        "total_errors": len(errors),
    }


@app.delete("/api/documents/{doc_id}")
def api_delete_document(
    doc_id: int,
    request: Request,
    x_access_code: str | None = Header(default=None),
):
    require_access(x_access_code)
    try:
        res = delete_document(doc_id)
    except NotFoundError as exc:
        raise HTTPException(404, str(exc))
    except Exception:
        logger.exception("Database error deleting document")
        raise HTTPException(503, "Could not delete document.")

    retriever = getattr(request.app.state, "retriever", None)
    if retriever and hasattr(retriever, "remove_docs"):
        retriever.remove_docs([doc_id])
    if res.get("stored_path"):
        _remove_files([res["stored_path"]])
    _sync_topics(request.app)
    return {"deleted_doc_id": doc_id, "path": res["path"]}


# ---------------- Chunks, Runs, and RAG Ask ---------------- #


@app.get("/api/conversations")
def api_list_conversations(x_access_code: str | None = Header(default=None)):
    require_access(x_access_code)
    try:
        return {"conversations": list_conversations()}
    except Exception:
        logger.exception("Database error listing conversations")
        raise HTTPException(503, "Could not load conversations.")


@app.post("/api/conversations", status_code=201)
def api_create_conversation(
    req: ConversationCreate,
    x_access_code: str | None = Header(default=None),
):
    require_access(x_access_code)
    try:
        return create_conversation(req.id, req.title, req.collection_id)
    except Exception:
        logger.exception("Database error creating conversation")
        raise HTTPException(503, "Could not create conversation.")


@app.post("/api/conversations/import")
def api_import_conversations(
    req: ConversationImport,
    x_access_code: str | None = Header(default=None),
):
    require_access(x_access_code)
    try:
        import_legacy_conversations([
            conversation.model_dump() for conversation in req.conversations
        ])
        return {"imported": len(req.conversations)}
    except Exception:
        logger.exception("Database error importing legacy conversations")
        raise HTTPException(503, "Could not import legacy conversations.")


@app.get("/api/conversations/{conversation_id}")
def api_get_conversation(
    conversation_id: str,
    x_access_code: str | None = Header(default=None),
):
    require_access(x_access_code)
    try:
        conversation = get_conversation(conversation_id)
    except Exception:
        logger.exception("Database error loading conversation")
        raise HTTPException(503, "Could not load conversation.")
    if conversation is None:
        raise HTTPException(404, "Conversation not found.")
    return conversation


@app.get("/api/conversations/by-run/{run_id}")
def api_get_conversation_for_run(
    run_id: uuid.UUID,
    x_access_code: str | None = Header(default=None),
):
    require_access(x_access_code)
    try:
        conversation = get_conversation_for_run(run_id)
    except Exception:
        logger.exception("Database error loading conversation for run")
        raise HTTPException(503, "Could not load the conversation for this research run.")
    if conversation is None:
        raise HTTPException(404, "Conversation not found for this research run.")
    return conversation


@app.patch("/api/conversations/{conversation_id}")
def api_update_conversation(
    conversation_id: str,
    req: ConversationUpdate,
    x_access_code: str | None = Header(default=None),
):
    require_access(x_access_code)
    changes = req.model_dump(exclude_unset=True)
    changes = {key: value for key, value in changes.items() if value is not None or key == "collection_id"}
    try:
        return update_conversation(conversation_id, changes)
    except NotFoundError as exc:
        raise HTTPException(404, str(exc))
    except ValidationError as exc:
        raise HTTPException(400, str(exc))
    except Exception:
        logger.exception("Database error updating conversation")
        raise HTTPException(503, "Could not update conversation.")


@app.delete("/api/conversations/{conversation_id}")
def api_delete_conversation(
    conversation_id: str,
    x_access_code: str | None = Header(default=None),
):
    require_access(x_access_code)
    try:
        delete_conversation(conversation_id)
    except NotFoundError as exc:
        raise HTTPException(404, str(exc))
    except Exception:
        logger.exception("Database error deleting conversation")
        raise HTTPException(503, "Could not delete conversation.")
    return {"deleted_conversation_id": conversation_id}


@app.get("/api/chunks/{chunk_id}")
def get_chunk(chunk_id: int, request: Request, x_access_code: str | None = Header(default=None)):
    require_access(x_access_code)
    chunk = request.app.state.retriever.chunks.get(chunk_id)
    if chunk is None:
        raise HTTPException(404, "Chunk not found.")
    return chunk


@app.get("/api/runs/{run_id}")
def get_run(run_id: uuid.UUID, x_access_code: str | None = Header(default=None)):
    require_access(x_access_code)
    try:
        run = load_run(run_id)
    except Exception:
        logger.exception("Database error loading run")
        raise HTTPException(503, "The database is not reachable.")
    if run is None:
        raise HTTPException(404, "Run not found.")
    return run


@app.post("/api/ask")
def ask(req: AskRequest, request: Request, x_access_code: str | None = Header(default=None)):
    st = request.app.state
    # Handle reverse-proxy forwarded IPs (e.g. Render) using right-most proxy-appended IP
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        ip = forwarded.split(",")[-1].strip() or (request.client.host if request.client else "unknown")
    else:
        ip = request.client.host if request.client else "unknown"

    if not st.limiter.allow(ip):
        raise HTTPException(429, "Too many requests. Wait a minute and try again.",
                            headers={"Retry-After": "60"})
    require_access(x_access_code)
    known_topics = _sync_topics(request.app)
    if req.topic is not None and req.topic not in known_topics:
        raise HTTPException(422, f"Unknown topic. Use one of: {', '.join(known_topics)}")
    if req.conversation_id and req.message_id:
        try:
            existing = load_conversation_response(req.conversation_id, req.message_id)
            if existing is not None:
                return existing
            save_conversation_user_message(
                req.conversation_id,
                req.message_id,
                req.question,
            )
        except NotFoundError as exc:
            raise HTTPException(404, str(exc))
        except ConflictError as exc:
            raise HTTPException(409, str(exc))
        except Exception:
            logger.exception("Could not save conversation question")
            raise HTTPException(503, "Could not save the conversation message.")
    if not st.slots.acquire(blocking=False):
        if req.conversation_id and req.message_id:
            try:
                save_conversation_error(
                    req.conversation_id,
                    req.message_id,
                    "The server is busy. Try again in a moment.",
                )
            except Exception:
                logger.exception("Could not save busy-server conversation error")
        raise HTTPException(503, "The server is busy. Try again in a moment.")

    try:
        if not st.cap.take():
            raise HTTPException(429, "The daily question limit is reached. Try again tomorrow.")
        start = time.time()
        try:
            extra_scope = {}
            if req.collection_id is not None:
                extra_scope["collection_id"] = req.collection_id
            if req.subsection_id is not None:
                extra_scope["subsection_id"] = req.subsection_id

            if req.mode == "baseline":
                result = shape_baseline(baseline_answer(req.question, st.retriever, req.topic, **extra_scope))
            else:
                result = shape_agentic(run_agent(st.graph, req.question, req.topic, **extra_scope))
        except APIError:
            logger.exception("LLM API error")
            raise HTTPException(502, "The language model service failed. Try again.")
        except Exception:
            logger.exception("Pipeline error")
            raise HTTPException(500, "Something went wrong while answering. Try again.")
    except HTTPException as exc:
        if req.conversation_id and req.message_id:
            try:
                save_conversation_error(
                    req.conversation_id,
                    req.message_id,
                    str(exc.detail),
                )
            except Exception:
                logger.exception("Could not save conversation error")
        raise
    finally:
        st.slots.release()

    result["latency_ms"] = int((time.time() - start) * 1000)
    if req.conversation_id and req.message_id:
        try:
            result = save_conversation_run(
                req.conversation_id,
                req.message_id,
                req.question,
                req.topic,
                req.mode,
                result,
            )
        except Exception:
            logger.exception("Could not save conversation research result")
            try:
                save_conversation_error(
                    req.conversation_id,
                    req.message_id,
                    "Could not save the research result. Please try again.",
                )
            except Exception:
                logger.exception("Could not save conversation persistence error")
            raise HTTPException(503, "Could not save the research result.")
    else:
        run_id = None
        try:
            run_id = save_run(req.question, req.topic, req.mode, result)
        except Exception:
            logger.exception("Could not save the run")      # the answer is still returned
        result["run_id"] = run_id
    return result

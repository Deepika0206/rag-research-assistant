import threading

import pytest
from fastapi.testclient import TestClient

import app.main as main
from app.security import DailyCap, RateLimiter

RUN_ID = "00000000-0000-0000-0000-000000000001"

AGENT_OUT = {
    "question": "What is memoization?",
    "query_type": "single_hop",
    "sub_results": [{"sub_question": "What is memoization?", "status": "answered", "refinements": 0,
                     "queries_tried": ["What is memoization?"], "missing": "",
                     "claims": [], "chunks": [], "rejected": []}],
    "trace": [{"step": "planner"}],
    "final": {
        "status": "answered", "answer": "Memoization stores results. [1]", "synthesis": "deterministic",
        "claims": [{"claim_id": "C1", "text": "Memoization stores results.", "chunk_ids": [1],
                    "sub_index": 0, "docs": ["dp/a.md"], "topics": ["dp"]}],
        "relations": [],
        "sources": {1: {"doc": "dp/a.md", "topic": "dp", "text": "Memoization stores results."}},
    },
}

BASELINE_OUT = {
    "question": "What is memoization?", "answer": "It stores results [1].",
    "chunks": [{"chunk_id": 1, "topic": "dp", "doc": "dp/a.md", "text": "t", "score": 0.5}],
    "citations": [1], "invalid_citations": [],
}


class FakeRetriever:
    mode = "pgvector+bm25+crossencoder"
    chunks = {1: {"chunk_id": 1, "topic": "dp", "doc": "dp/a.md", "text": "Memoization stores results."}}


@pytest.fixture
def client(monkeypatch):
    # TestClient without "with" does not run the lifespan, so no models are loaded.
    app = main.app
    app.state.retriever = FakeRetriever()
    app.state.graph = object()
    app.state.topics = ["dp"]
    app.state.limiter = RateLimiter(3, 60)
    app.state.cap = DailyCap(100)
    app.state.slots = threading.BoundedSemaphore(1)
    monkeypatch.setattr(main, "run_agent", lambda graph, q, topic: AGENT_OUT)
    monkeypatch.setattr(main, "baseline_answer", lambda q, retriever, topic: BASELINE_OUT)
    monkeypatch.setattr(main, "save_run", lambda *a, **k: RUN_ID)
    monkeypatch.setattr(main, "ping", lambda: True)
    return TestClient(app)


def ask(client, **body):
    return client.post("/api/ask", json={"question": "What is memoization?", **body})


def test_ask_agentic(client):
    r = ask(client)
    body = r.json()
    assert r.status_code == 200
    assert body["status"] == "answered" and body["run_id"] == RUN_ID
    assert body["claims"][0]["chunk_ids"] == [1] and "1" in body["sources"]


def test_ask_baseline_is_unchecked(client):
    body = ask(client, mode="baseline").json()
    assert body["status"] == "unchecked" and body["citations"] == [1]


def test_question_too_long(client):
    assert ask(client, question="x" * 501).status_code == 422


def test_unknown_topic_and_extra_field(client):
    assert ask(client, topic="cooking").status_code == 422
    assert ask(client, hack=True).status_code == 422
    assert ask(client, conversation_id="conversation-1").status_code == 422


def test_rate_limit(client):
    codes = [ask(client).status_code for _ in range(4)]
    assert codes == [200, 200, 200, 429]
    assert ask(client).headers["retry-after"] == "60"


def test_daily_cap_releases_slot(client):
    main.app.state.cap = DailyCap(0)
    assert ask(client).status_code == 429
    assert main.app.state.slots.acquire(blocking=False)      # the slot was freed


def test_busy_server(client):
    main.app.state.slots.acquire()
    assert ask(client).status_code == 503


def test_pipeline_error_hides_details(client, monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("secret details")
    monkeypatch.setattr(main, "run_agent", boom)
    r = ask(client)
    assert r.status_code == 500 and "secret" not in r.text
    assert main.app.state.slots.acquire(blocking=False)      # the slot was freed


def test_save_failure_still_returns_answer(client, monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("db down")
    monkeypatch.setattr(main, "save_run", boom)
    r = ask(client)
    assert r.status_code == 200 and r.json()["run_id"] is None


def test_chunk_and_run_endpoints(client, monkeypatch):
    assert client.get("/api/chunks/1").status_code == 200
    assert client.get("/api/chunks/999").status_code == 404
    assert client.get("/api/runs/not-a-uuid").status_code == 422
    monkeypatch.setattr(main, "load_run", lambda run_id: None)
    assert client.get(f"/api/runs/{RUN_ID}").status_code == 404


def test_health_and_topics(client):
    h = client.get("/api/health").json()
    assert h["chunks"] == 1
    assert h["retrieval_mode"] == "pgvector+bm25+crossencoder"
    assert client.get("/api/topics").json() == {"topics": ["dp"]}


def test_api_error_returns_502(client, monkeypatch):
    from anthropic import APIError
    def boom(*a, **k):
        raise APIError(message="invalid api key", request=None, body=None)
    monkeypatch.setattr(main, "run_agent", boom)
    r = ask(client)
    assert r.status_code == 502
    assert "language model service failed" in r.json()["detail"]


def test_run_db_error_returns_503(client, monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("db connection lost")
    monkeypatch.setattr(main, "load_run", boom)
    assert client.get(f"/api/runs/{RUN_ID}").status_code == 503


def test_access_code(client, monkeypatch):
    monkeypatch.setattr(main.config, "ACCESS_CODE", "s3cret")
    main.app.state.limiter = RateLimiter(10, 60)
    body = {"question": "What is memoization?"}
    assert client.post("/api/ask", json=body).status_code == 401
    assert client.post("/api/ask", json=body, headers={"X-Access-Code": "wrong"}).status_code == 401
    assert client.post("/api/ask", json=body, headers={"X-Access-Code": "s3cret"}).status_code == 200
    assert client.get("/api/chunks/1").status_code == 401
    assert client.get("/api/chunks/1", headers={"X-Access-Code": "s3cret"}).status_code == 200
    assert client.get(f"/api/runs/{RUN_ID}").status_code == 401
    monkeypatch.setattr(main, "load_run", lambda rid: None)
    assert client.get(f"/api/runs/{RUN_ID}", headers={"X-Access-Code": "s3cret"}).status_code == 404


def test_conversation_endpoints(client, monkeypatch):
    record = {
        "id": "conversation-1",
        "title": "A conversation",
        "is_pinned": False,
        "collection_id": None,
        "created_at": "2025-01-01T00:00:00+00:00",
        "updated_at": "2025-01-01T00:00:00+00:00",
        "run_ids": [],
        "messages": [],
    }
    monkeypatch.setattr(main, "list_conversations", lambda: [record])
    monkeypatch.setattr(main, "create_conversation", lambda *args: record)
    monkeypatch.setattr(main, "get_conversation", lambda conversation_id: record)
    monkeypatch.setattr(main, "get_conversation_for_run", lambda run_id: record)
    monkeypatch.setattr(main, "update_conversation", lambda conversation_id, changes: {**record, **changes})
    deleted = []
    monkeypatch.setattr(main, "delete_conversation", lambda conversation_id: deleted.append(conversation_id))

    assert client.get("/api/conversations").json() == {"conversations": [record]}
    created = client.post("/api/conversations", json={"id": "conversation-1"})
    assert created.status_code == 201 and created.json()["id"] == "conversation-1"
    assert client.get("/api/conversations/conversation-1").status_code == 200
    assert client.get(f"/api/conversations/by-run/{RUN_ID}").status_code == 200
    renamed = client.patch(
        "/api/conversations/conversation-1",
        json={"title": "Renamed", "is_pinned": True},
    )
    assert renamed.json()["title"] == "Renamed"
    removed = client.delete("/api/conversations/conversation-1")
    assert removed.json()["deleted_conversation_id"] == "conversation-1"
    assert deleted == ["conversation-1"]


def test_conversation_endpoints_require_access_code(client, monkeypatch):
    monkeypatch.setattr(main.config, "ACCESS_CODE", "private-code")
    monkeypatch.setattr(main, "list_conversations", lambda: [])
    assert client.get("/api/conversations").status_code == 401
    assert client.get(
        "/api/conversations",
        headers={"X-Access-Code": "private-code"},
    ).status_code == 200


def test_ask_persists_question_and_research_run(client, monkeypatch):
    calls = []
    monkeypatch.setattr(main, "load_conversation_response", lambda *args: None)
    monkeypatch.setattr(
        main,
        "save_conversation_user_message",
        lambda *args: calls.append(("user", args)),
    )

    def save_result(conversation_id, message_id, question, topic, mode, result):
        calls.append(("run", (conversation_id, message_id, question, topic, mode)))
        return {**result, "run_id": RUN_ID}

    monkeypatch.setattr(main, "save_conversation_run", save_result)
    response = ask(
        client,
        question="What is memoization?",
        conversation_id="conversation-1",
        message_id="message-1",
    )

    assert response.status_code == 200
    assert response.json()["run_id"] == RUN_ID
    assert calls == [
        ("user", ("conversation-1", "message-1", "What is memoization?")),
        ("run", ("conversation-1", "message-1", "What is memoization?", None, "agentic")),
    ]


def test_ask_returns_idempotent_conversation_response(client, monkeypatch):
    cached = {"answer": "Previously saved", "run_id": RUN_ID}
    monkeypatch.setattr(main, "load_conversation_response", lambda *args: cached)
    monkeypatch.setattr(
        main,
        "save_conversation_user_message",
        lambda *args: pytest.fail("Duplicate message should not be written."),
    )
    response = ask(
        client,
        conversation_id="conversation-1",
        message_id="message-1",
    )
    assert response.status_code == 200
    assert response.json() == cached


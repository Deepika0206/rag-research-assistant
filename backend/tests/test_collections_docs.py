import io
import threading
import uuid
import zipfile

import pytest
from fastapi.testclient import TestClient

import app.main as main
from app.ingest.chunker import chunk_text
from app.ingest.extractor import extract_text
from app.retrieval.retriever import Retriever
from app.security import DailyCap, RateLimiter


def _make_minimal_docx_bytes(text: str) -> bytes:
    """Create a valid minimal .docx archive in memory if python-docx is available or verify via zipfile."""
    try:
        from docx import Document

        doc = Document()
        doc.add_paragraph(text)
        buf = io.BytesIO()
        doc.save(buf)
        return buf.getvalue()
    except ImportError:
        # Minimal OOXML structure when python-docx isn't installed in test env
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>')
        return buf.getvalue()


def test_extract_text_txt_and_md():
    assert extract_text("notes.txt", b"Dynamic programming uses memoization.") == "Dynamic programming uses memoization."
    assert extract_text("graph.md", b"# Graphs\n\nDijkstra finds shortest paths.") == "# Graphs\n\nDijkstra finds shortest paths."


def test_extract_text_rejects_unsupported_and_empty():
    with pytest.raises(ValueError, match="Unsupported file format"):
        extract_text("image.png", b"123")
    with pytest.raises(ValueError, match="empty"):
        extract_text("empty.txt", b"   ")


def test_extract_text_docx_when_installed():
    pytest.importorskip("docx")
    data = _make_minimal_docx_bytes("Bellman-Ford handles negative edge weights.")
    out = extract_text("lecture.docx", data)
    assert "Bellman-Ford handles negative edge weights." in out


def test_chunk_text_splits_oversized_single_paragraph():
    long_para = " ".join(f"word{i}" for i in range(900))
    chunks = chunk_text(long_para)
    assert len(chunks) >= 2
    assert "word0" in chunks[0]
    assert "word899" in chunks[-1]


def test_retriever_live_add_remove_and_scope_filter():
    pytest.importorskip("rank_bm25")
    pytest.importorskip("numpy")
    r = object.__new__(Retriever)
    r._lock = threading.Lock()
    r.chunks = {}
    r.ids = []
    r.embedder = None
    r.reranker = None
    r.bm25 = None
    r.connected = True

    col_a = str(uuid.uuid4())
    col_b = str(uuid.uuid4())
    sub_a1 = str(uuid.uuid4())

    r.add_chunks([
        {"chunk_id": 101, "doc_id": 1, "topic": "ColA", "doc": "uploads/a.txt",
         "text": "Dijkstra shortest path priority queue algorithm", "collection_id": col_a, "subsection_id": sub_a1},
        {"chunk_id": 102, "doc_id": 2, "topic": "ColB", "doc": "uploads/b.txt",
         "text": "Dijkstra graph traversal edge relaxation", "collection_id": col_b, "subsection_id": None},
    ])

    all_hits = r.bm25_search("Dijkstra", k=5)
    assert [cid for cid, _ in all_hits] == [101, 102] or set(cid for cid, _ in all_hits) == {101, 102}

    col_a_hits = r.bm25_search("Dijkstra", k=5, collection_id=col_a)
    assert [cid for cid, _ in col_a_hits] == [101]

    sub_a1_hits = r.bm25_search("Dijkstra", k=5, collection_id=col_a, subsection_id=sub_a1)
    assert [cid for cid, _ in sub_a1_hits] == [101]

    r.update_doc_location([1], col_b, None)
    assert r.chunks[101]["collection_id"] == col_b
    assert r.chunks[101]["subsection_id"] is None

    r.remove_docs([1])
    assert 101 not in r.chunks
    after_del = r.bm25_search("Dijkstra", k=5)
    assert [cid for cid, _ in after_del] == [102]


def test_collections_subsections_and_document_endpoints(monkeypatch):
    col_id = str(uuid.uuid4())
    sub_id = str(uuid.uuid4())
    default_id = str(uuid.uuid4())

    class FakeRetriever:
        mode = "pgvector+bm25+crossencoder"
        chunks = {}

        def __init__(self):
            self._lock = threading.Lock()

        def remove_docs(self, doc_ids):
            for did in doc_ids:
                for cid in [k for k, v in list(self.chunks.items()) if v.get("doc_id") == did]:
                    del self.chunks[cid]

        def update_doc_location(self, doc_ids, cid, sid):
            pass

    app = main.app
    app.state.retriever = FakeRetriever()
    app.state.graph = object()
    app.state.topics = ["dp"]
    app.state.limiter = RateLimiter(20, 60)
    app.state.cap = DailyCap(100)
    app.state.slots = threading.BoundedSemaphore(2)

    monkeypatch.setattr(main, "list_collections", lambda: {
        "collections": [
            {"id": col_id, "name": "DSA Algorithms", "is_default": False, "doc_count": 1, "subsections": [
                {"id": sub_id, "collection_id": col_id, "name": "Dynamic Programming", "doc_count": 1}
            ]},
            {"id": default_id, "name": "Unassigned", "is_default": True, "doc_count": 0, "subsections": []},
        ],
        "default_collection_id": default_id,
    })
    monkeypatch.setattr(main, "create_collection", lambda name: {
        "id": col_id, "name": name, "is_default": False, "doc_count": 0, "subsections": []
    })
    monkeypatch.setattr(main, "rename_collection", lambda cid, name: {
        "id": str(cid), "name": name, "is_default": False, "doc_count": 0
    })
    monkeypatch.setattr(main, "delete_collection", lambda cid, mode: {
        "deleted_collection_id": str(cid), "mode": mode, "deleted_doc_ids": [1] if mode == "delete_all" else [],
        "moved_doc_ids": [] if mode == "delete_all" else [1], "default_collection_id": default_id, "stored_paths": [],
    })
    monkeypatch.setattr(main, "create_subsection", lambda cid, name: {
        "id": sub_id, "collection_id": str(cid), "name": name, "doc_count": 0
    })
    monkeypatch.setattr(main, "rename_subsection", lambda sid, name: {
        "id": str(sid), "collection_id": col_id, "name": name, "doc_count": 0
    })
    monkeypatch.setattr(main, "delete_subsection", lambda sid, delete_documents=False: {
        "deleted_subsection_id": str(sid), "collection_id": col_id, "deleted_doc_ids": [], "moved_doc_ids": [], "stored_paths": []
    })
    monkeypatch.setattr(main, "list_documents", lambda **kw: [
        {"id": 10, "title": "knapsack notes", "filename": "knapsack_notes.md", "file_type": "md",
         "file_size": 120, "status": "indexed", "chunk_count": 2, "collection_id": col_id, "subsection_id": sub_id}
    ])
    monkeypatch.setattr(main, "get_document", lambda did: {
        "id": did, "title": "knapsack notes", "filename": "knapsack_notes.md", "file_type": "md",
        "status": "indexed", "chunk_count": 2, "chunks": [{"chunk_id": 1, "chunk_index": 0, "n_tokens": 12, "text": "DP table"}]
    })
    monkeypatch.setattr(main, "delete_document", lambda did: {
        "deleted_doc_id": did, "stored_path": None, "path": "uploads/x/knapsack_notes.md"
    })
    monkeypatch.setattr(main, "ingest_uploaded_file", lambda **kw: {
        "id": 11, "title": kw["filename"], "filename": kw["filename"], "file_type": "txt",
        "file_size": len(kw["data"]), "status": "indexed", "chunk_count": 1,
        "collection_id": kw.get("collection_id"), "subsection_id": kw.get("subsection_id"),
    })

    client = TestClient(app)

    assert client.get("/api/collections").status_code == 200
    assert client.post("/api/collections", json={"name": "Exam Revision"}).status_code == 201
    assert client.patch(f"/api/collections/{col_id}", json={"name": "Algorithms"}).status_code == 200
    assert client.post(f"/api/collections/{col_id}/subsections", json={"name": "Graphs"}).status_code == 201
    assert client.patch(f"/api/subsections/{sub_id}", json={"name": "DP"}).status_code == 200
    assert client.delete(f"/api/subsections/{sub_id}").status_code == 200
    assert client.delete(f"/api/collections/{col_id}?mode=move_to_default").status_code == 200

    assert len(client.get("/api/documents").json()["documents"]) == 1
    assert client.get("/api/documents/10").status_code == 200

    up = client.post(
        "/api/documents/upload",
        data={"collection_id": col_id, "subsection_id": sub_id},
        files=[
            ("files", ("a.txt", b"Alpha algorithms note", "text/plain")),
            ("files", ("b.md", b"# Beta\n\nContent", "text/markdown")),
        ],
    )
    assert up.status_code == 200
    assert up.json()["total_uploaded"] == 2
    assert client.delete("/api/documents/10").status_code == 200

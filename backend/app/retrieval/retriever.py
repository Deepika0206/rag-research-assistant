import os
import threading

try:
    import numpy as np
except ImportError:
    np = None

try:
    import psycopg
    from pgvector.psycopg import register_vector
except ImportError:
    psycopg = None

try:
    from rank_bm25 import BM25Okapi
except ImportError:
    BM25Okapi = None

try:
    from sentence_transformers import CrossEncoder, SentenceTransformer
except ImportError:
    CrossEncoder = None
    SentenceTransformer = None

from app.config import CANDIDATES, DATABASE_URL, EMBED_MODEL, RERANK_MODEL, RRF_K, TOP_K
from app.retrieval.utils import rrf_fuse, tokenize

STRICT = os.getenv("STRICT_RETRIEVAL", "1") == "1"


class Retriever:
    """Loads models and the BM25 index once. Supports live updates on document upload/deletion."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.chunks: dict[int, dict] = {}
        self.ids: list[int] = []
        self.embedder = None
        self.reranker = None
        self.bm25 = None

        connected = False
        if psycopg and SentenceTransformer and CrossEncoder:
            try:
                self.embedder = SentenceTransformer(EMBED_MODEL)
                self.reranker = CrossEncoder(RERANK_MODEL)
                with psycopg.connect(DATABASE_URL) as conn:
                    rows = conn.execute(
                        "SELECT c.id, c.topic, c.text, d.path, c.doc_id, "
                        "c.collection_id::text, c.subsection_id::text "
                        "FROM chunks c JOIN documents d ON d.id = c.doc_id ORDER BY c.id"
                    ).fetchall()
                self.chunks = {
                    r[0]: {
                        "chunk_id": r[0],
                        "topic": r[1],
                        "text": r[2],
                        "doc": r[3],
                        "doc_id": r[4],
                        "collection_id": r[5],
                        "subsection_id": r[6],
                    }
                    for r in rows
                }
                self.ids = list(self.chunks)
                if BM25Okapi and self.ids:
                    self.bm25 = BM25Okapi([tokenize(self.chunks[i]["text"]) for i in self.ids])
                connected = True
            except Exception as e:
                connected = False
                if STRICT:
                    raise RuntimeError(f"Retriever init failed: {e}")

        self.connected = connected
        if STRICT and (not connected or BM25Okapi is None):
            missing = [n for n, m in (("psycopg/pgvector", psycopg),
                                      ("sentence-transformers", SentenceTransformer),
                                      ("rank-bm25", BM25Okapi)) if m is None]
            raise RuntimeError("STRICT_RETRIEVAL=1: retrieval backend is not fully available"
                               + (f" (missing packages: {', '.join(missing)})" if missing else ""))

    def _rebuild_bm25_unlocked(self) -> None:
        self.ids = sorted(self.chunks)
        if BM25Okapi and self.ids:
            self.bm25 = BM25Okapi([tokenize(self.chunks[i]["text"]) for i in self.ids])
        else:
            self.bm25 = None

    def add_chunks(self, new_chunks: list[dict]) -> None:
        if not new_chunks:
            return
        with self._lock:
            for c in new_chunks:
                self.chunks[c["chunk_id"]] = c
            self._rebuild_bm25_unlocked()

    def remove_docs(self, doc_ids: list[int]) -> None:
        if not doc_ids:
            return
        target = set(doc_ids)
        with self._lock:
            to_del = [cid for cid, c in self.chunks.items() if c.get("doc_id") in target]
            if not to_del:
                return
            for cid in to_del:
                del self.chunks[cid]
            self._rebuild_bm25_unlocked()

    def update_doc_location(
        self,
        doc_ids: list[int],
        collection_id: str | None,
        subsection_id: str | None,
    ) -> None:
        if not doc_ids:
            return
        target = set(doc_ids)
        with self._lock:
            for c in self.chunks.values():
                if c.get("doc_id") in target:
                    c["collection_id"] = collection_id
                    c["subsection_id"] = subsection_id

    @property
    def mode(self) -> str:
        if self.connected and self.embedder and self.reranker and (self.bm25 or not self.chunks):
            return "pgvector+bm25+crossencoder"
        return "DEGRADED-fallback"

    def dense(
        self,
        query: str,
        k: int = CANDIDATES,
        topic: str | None = None,
        collection_id: str | None = None,
        subsection_id: str | None = None,
    ):
        if self.embedder and psycopg:
            if not self.chunks:
                return []
            with self._lock:
                qv = self.embedder.encode(query, normalize_embeddings=True)
            clauses: list[str] = []
            filter_params: list = []
            if topic:
                clauses.append("topic = %s")
                filter_params.append(topic)
            if collection_id:
                clauses.append("collection_id = %s::uuid")
                filter_params.append(collection_id)
            if subsection_id:
                clauses.append("subsection_id = %s::uuid")
                filter_params.append(subsection_id)

            where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
            params = [qv] + filter_params + [qv, k]
            sql = (f"SELECT id, 1 - (embedding <=> %s) FROM chunks {where} "
                   "ORDER BY embedding <=> %s LIMIT %s")
            with psycopg.connect(DATABASE_URL) as conn:
                register_vector(conn)
                return [(r[0], float(r[1])) for r in conn.execute(sql, params).fetchall()]

        raise RuntimeError("Dense search failed: embedder or database not available.")

    def bm25_search(
        self,
        query: str,
        k: int = CANDIDATES,
        topic: str | None = None,
        collection_id: str | None = None,
        subsection_id: str | None = None,
    ):
        with self._lock:
            if not self.ids or not self.bm25:
                return []
            if not np:
                raise RuntimeError("BM25 search failed: numpy not available.")
            bm25 = self.bm25
            ids_snapshot = list(self.ids)
            chunks_snapshot = dict(self.chunks)

        scores = bm25.get_scores(tokenize(query))
        out = []
        for idx in np.argsort(scores)[::-1]:
            if scores[idx] <= 0:
                break
            cid = ids_snapshot[idx]
            chunk = chunks_snapshot.get(cid)
            if not chunk:
                continue
            if topic and chunk["topic"] != topic:
                continue
            if collection_id and chunk.get("collection_id") != collection_id:
                continue
            if subsection_id and chunk.get("subsection_id") != subsection_id:
                continue
            out.append((cid, float(scores[idx])))
            if len(out) == k:
                break
        return out

    def hybrid(
        self,
        query: str,
        k: int = CANDIDATES,
        topic: str | None = None,
        collection_id: str | None = None,
        subsection_id: str | None = None,
    ):
        dense_ids = [
            c for c, _ in self.dense(query, CANDIDATES, topic=topic, collection_id=collection_id, subsection_id=subsection_id)
        ]
        bm25_ids = [
            c for c, _ in self.bm25_search(query, CANDIDATES, topic=topic, collection_id=collection_id, subsection_id=subsection_id)
        ]
        return rrf_fuse([dense_ids, bm25_ids], k=k, rrf_k=RRF_K)

    def rerank(self, query: str, candidate_ids: list[int], k: int = TOP_K):
        if not candidate_ids:
            return []
        if self.reranker:
            with self._lock:
                valid_ids = [c for c in candidate_ids if c in self.chunks]
                if not valid_ids:
                    return []
                pairs = [(query, self.chunks[c]["text"]) for c in valid_ids]
                scores = self.reranker.predict(pairs)
            ranked = sorted(zip(valid_ids, scores), key=lambda x: -x[1])[:k]
            return [(c, float(s)) for c, s in ranked]

        raise RuntimeError("Reranking failed: reranker not available.")

    def search(
        self,
        query: str,
        topic: str | None = None,
        k: int = TOP_K,
        collection_id: str | None = None,
        subsection_id: str | None = None,
    ):
        """Full pipeline: hybrid (10 candidates) -> rerank -> top k chunks."""
        candidates = [
            c for c, _ in self.hybrid(query, CANDIDATES, topic=topic, collection_id=collection_id, subsection_id=subsection_id)
        ]
        ranked = self.rerank(query, candidates, k)
        with self._lock:
            return [{**self.chunks[c], "rerank_score": s} for c, s in ranked if c in self.chunks]

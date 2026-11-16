# RAG Research Assistant

An agent that answers multi-step questions over a private set of study notes.
Every claim cites a source chunk. If the notes lack evidence, it says so.

## How it works

```mermaid
flowchart TD
  Q[Question] --> P[Planner]
  P --> R["Retriever: BM25 + dense, RRF, rerank"]
  R --> D[Drafter]
  D --> C{Critic}
  C -- all claims supported --> A[Next sub-question]
  C -- unsupported, retries < 2 --> F[Refiner] --> R
  C -- unsupported, retries = 2 --> A
  A -- more left --> R
  A -- done --> S[Synthesizer]
  S --> O[Cited report + trace]
```

## Stack
- **Backend:** Python 3.11, FastAPI, LangGraph, Uvicorn
- **Frontend:** React 19 / TypeScript, Tailwind CSS, Vite
- **Database & Retrieval:** PostgreSQL 16 + pgvector, rank-bm25, RRF rank fusion
- **Models:** sentence-transformers (`all-mpnet-base-v2`, 768-dim), cross-encoder (`ms-marco-MiniLM-L-6-v2`)
- **LLM Pipeline:** Anthropic Claude API (`claude-sonnet-5-5`)
- **Infrastructure:** Docker, Render Blueprint (`render.yaml`)

## Run it locally (VS Code on Windows / macOS / Linux)

### 1. Prerequisites
- **Python 3.11**
- **Node.js 20+ (or 22)** & npm
- **Docker Desktop** (recommended for PostgreSQL 16 + pgvector) or a local **PostgreSQL 16** server with the `pgvector` extension enabled

### 2. Database & Environment Variables
From the project root in the VS Code terminal (PowerShell on Windows):
```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item .env.example .env
```
Edit `backend\.env` and set your real `ANTHROPIC_API_KEY`. Keep `DATABASE_URL=postgresql://rag:rag@localhost:5432/rag` when using Docker Compose.

Start PostgreSQL + pgvector:
```powershell
docker compose up -d db
```
*(If using a native local PostgreSQL installation instead of Docker, create user/database `rag` with `CREATE EXTENSION vector;` and update `DATABASE_URL` in `backend\.env`.)*

### 3. Backend Setup (FastAPI + LangGraph + Retrieval)
In VS Code Terminal 1 (PowerShell on Windows):
```powershell
python -m venv backend\.venv
.\backend\.venv\Scripts\Activate.ps1
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r backend\requirements.txt
cd backend
python -m app.ingest.run_ingest ..\corpus --yes   # optional: ingests initial 47 DSA notes
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
*(On macOS/Linux: `python3.11 -m venv backend/.venv && source backend/.venv/bin/activate`.)*

FastAPI creates or safely upgrades the `collections`, `subsections`, `documents`, `chunks`, `agent_runs`, `conversations`, and `conversation_messages` tables on startup (`ensure_schema()`), including a default `Unassigned` collection. Existing research runs remain intact and are migrated as separate legacy conversations unless a reliable prior conversation ID is imported from the frontend's local history.

To run the schema migration explicitly from the project root (PowerShell):
```powershell
cd backend
python -c "from app.store import ensure_schema; ensure_schema(); print('Database schema is up to date.')"
cd ..
```
The frontend imports pre-existing local conversations into PostgreSQL once per configured backend the first time it connects. Open `http://localhost:8000/docs` when `ENABLE_DOCS=1` to inspect endpoints.

### 4. Frontend Setup (React + Vite)
In VS Code Terminal 2:
```powershell
npm install
npm test                                # Vitest: 16 passed
npm run dev                             # opens on http://localhost:3000
```
`VITE_API_URL` in `.env` defaults to `http://localhost:8000`. You can also change the backend URL or enter `ACCESS_CODE` at runtime inside **Settings & Access** in the UI.

### 5. Backend Unit Tests (optional)
```powershell
cd backend
..\backend\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
pytest -q
```

## Tests and Evaluation
- **Unit Tests:**
  - Frontend: `npm test` (Vitest: 16/16 passed)
  - Backend: `cd backend && pytest -q` (run inside backend venv after installing `requirements-dev.txt`)
- **Evaluation Design:** 25 locked evaluation questions in `eval/questions.json`:
  - 12 single-hop (supported)
  - 8 multi-hop (supported)
  - 5 negative controls (unsupported/out-of-corpus)
- **Six Required Metrics (from Approved Synopsis):**
  1. **Recall@5:** Proportion of relevant golden chunks retrieved within top-5 candidates.
  2. **MRR (Mean Reciprocal Rank):** Reciprocal rank of the first relevant chunk in retrieved list.
  3. **Answer Correctness:** Semantic accuracy of generated answer against golden facts.
  4. **Faithfulness Score:** Proportion of generated claims strictly grounded in retrieved chunks.
  5. **Citation Accuracy:** Precision of chunk citations (no phantom or mismatched chunk IDs).
  6. **Unsupported Query Rejection Rate:** Proportion of out-of-scope/unsupported queries safely refused when supporting evidence is absent.
- **Evaluation Execution:**
  ```bash
  cd backend
  python -m app.evaluation.validate_questions     # confirms READY TO LOCK
  python -m app.evaluation.run --out final_run1   # runs both baseline and agentic systems
  python -m app.evaluation.make_rating_sheets final_run1
  python -m app.evaluation.score final_run1       # computes summary report
  ```
- **Baseline vs. Agentic Comparison:**
  - Baseline: Single-pass RAG (dense top-5 -> Claude) without planning, reranking, or critic verification (available via `/api/ask` with `mode="baseline"` and evaluation scripts; the chat UI always runs `agentic` with no baseline UI toggle).
  - Agentic: LangGraph multi-step pipeline (Planner -> Hybrid Retriever + Cross-Encoder -> Drafter -> Critic -> Bounded Refiner -> Synthesizer with post-synthesis Critic verification).

## Deployment and Security
- **Docker Image:** `backend/Dockerfile` with CPU-optimized PyTorch, pre-baked sentence-transformers & cross-encoder models (`HF_HOME=/opt/hf`), non-root execution (`appuser`, uid 1000), and `--proxy-headers`.
- **Shared Access Code:** `X-Access-Code` header protecting `/api/ask` and `/api/runs/{id}`. Non-local deployments strictly require `ACCESS_CODE` at startup.
- **Reverse-Proxy Rate Limiting:** 6 req/min per client IP extracted via `X-Forwarded-For` header, preventing shared IP throttling across proxy users.
- **Resource Protections:** `BoundedSemaphore(2)` concurrent pipeline slots, 100 daily run budget cap.
- **Documentation & Open Endpoints:** Public `/docs` and `/openapi.json` disabled in production (`ENABLE_DOCS=0`).
- **PostgreSQL Dev Security:** Database port bound to `127.0.0.1:5432:5432` in `docker-compose.yml`.

## Dependency Security Audits
- **Frontend (`npm audit`):** 0 vulnerabilities found.
- **Backend (`pip-audit`):** Checked against PyPI Advisory Database using pinned dependencies in `backend/requirements.lock`.

## First Deploy Sequence on Render

Follow this strict deployment order:

```bash
# 1. Push repo to GitHub and create Render Blueprint from render.yaml
#    - Provision rag-db (PostgreSQL 16 + pgvector)
#    - Set ANTHROPIC_API_KEY in Render environment settings

# 2. Ingest corpus notes and compute embeddings using External Database URL:
cd backend && DATABASE_URL="$EXTERNAL_DATABASE_URL" python -m app.ingest.run_ingest ../corpus --yes

# 3. Verify chunks, embeddings, and vector search:
DATABASE_URL="$EXTERNAL_DATABASE_URL" python -m app.verify_ingest

# 4. Restart API service (rag-assistant-api) on Render to reload in-memory BM25 index

# 5. Verify API health check:
curl https://rag-assistant-api.onrender.com/api/health

# 6. Verify static web frontend (rag-assistant-web):
#    - Enter ACCESS_CODE in Settings & Access
#    - Submit a question to test end-to-end pipeline
```

## Deviations from Approved Synopsis
1. **Frontend Framework:** The original synopsis proposed Next.js 14; the actual implementation uses **React 19 + TypeScript + Vite + Tailwind CSS**. The client is a single-page researcher workbench without requirement for server-side HTML rendering (SSR). The decoupled FastAPI backend provides full API-first modularity.
2. **Corpus Taxonomy Note:** `topological_sort.md` is categorized under graphs in coursework taxonomy; in this corpus it is indexed under `sorting/topological_sort.md` with cross-references to DAGs. Cross-document `topic` relations are derived from corpus subfolder names. For negative control question `u02`, Tarjan SCC is strictly unsupported while `graphs/kosaraju_scc.md` provides SCC coverage.
3. **Baseline UI Toggle:** Baseline comparison runs in backend `/api/ask` and the evaluation harness (`eval/run.py`); the web chat interface defaults to `agentic` mode without exposing a baseline toggle.

## Limitations
1. **Corpus Grounding vs. Truth:** Every claim cites a source chunk and is checked by a Critic against cited chunks, not real-world objective truth. An error in the notes will be faithfully reproduced.
2. **Chunk Budget Differences:** The multi-hop agent retrieves up to 15 chunks (5 per sub-question), compared to the fixed 5-chunk budget of the single-pass baseline.
3. **Partial Sub-Answers & Folder-Based Relations:** When a sub-question hits `MAX_REFINEMENTS` with missing evidence, Critic-verified claims are preserved under `partial` status while missing sub-questions are listed in the gap block; `relations` reflect folder-based topics (`dp`, `graphs`, `searching`, `sorting`, `trees`).
4. **Latency, Chunk Count, and Cost:** Live corpus chunk count (47 documents) and measured latency/cost values are populated upon running `run_ingest`, `verify_ingest`, and `evaluation.run`.

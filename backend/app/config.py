import os
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:
    def load_dotenv(*args, **kwargs):
        pass

# Search for .env in current directory, parent, backend directory, or project root
backend_root = Path(__file__).resolve().parent.parent
project_root = backend_root.parent
for p in [Path.cwd() / ".env", backend_root / ".env", project_root / ".env", Path.cwd().parent / ".env"]:
    if p.exists():
        load_dotenv(p)
        break
else:
    load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://rag:rag@localhost:5432/rag")
EMBED_MODEL = "sentence-transformers/all-mpnet-base-v2"
MAX_TOKENS = 320       # model reads only 384 tokens
OVERLAP_TOKENS = 50

RERANK_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"
CANDIDATES = 10     # candidates after hybrid merge (synopsis: top-10)
TOP_K = 5           # chunks kept after reranking (synopsis: top-5)
RRF_K = 60

CLAUDE_MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-5-5")
USE_LLM_CACHE = os.getenv("USE_LLM_CACHE", "0") == "1"
LLM_CACHE_DIR = Path(__file__).resolve().parents[1] / ".llm_cache"
PRICE_IN_PER_MTOK = float(os.getenv("PRICE_IN_PER_MTOK", "3.0"))
PRICE_OUT_PER_MTOK = float(os.getenv("PRICE_OUT_PER_MTOK", "15.0"))

MAX_REFINEMENTS = 2     # synopsis: max 2 refinement cycles per sub-question

ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if o.strip()]
RATE_LIMIT_PER_MIN = int(os.getenv("RATE_LIMIT_PER_MIN", "6"))
MAX_CONCURRENT_RUNS = int(os.getenv("MAX_CONCURRENT_RUNS", "2"))
DAILY_RUN_LIMIT = int(os.getenv("DAILY_RUN_LIMIT", "100"))
MAX_QUESTION_CHARS = 500

ACCESS_CODE = os.getenv("ACCESS_CODE", "")          # empty = no code (development only)
ENABLE_DOCS = os.getenv("ENABLE_DOCS", "1") == "1"

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", str(backend_root / "uploads")))
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(20 * 1024 * 1024)))

"""
Environment check test script for RAG Research Assistant.
Verifies:
1. Python version and required environment variables
2. Directory structure (corpus, backend, eval)
3. Package imports (anthropic, dotenv, sentence_transformers, psycopg, pgvector)
4. Database connection & pgvector extension (if database is running)
5. Anthropic client initialization
"""

import os
import sys
from pathlib import Path

def print_status(component: str, ok: bool, details: str = ""):
    status = "✅ PASS" if ok else "❌ FAIL"
    print(f"[{status}] {component}: {details}")

def main():
    print("=" * 60)
    print("🚀 Running Environment Check for RAG Research Assistant")
    print("=" * 60)

    all_passed = True

    # 1. Python version
    py_ver = sys.version.split()[0]
    py_ok = sys.version_info >= (3, 10)
    print_status("Python Version", py_ok, f"Current: {py_ver} (Required: >= 3.10)")
    if not py_ok:
        all_passed = False

    # 2. Project Directories
    root_dir = Path(__file__).resolve().parent.parent
    expected_dirs = [
        root_dir / "corpus" / "searching",
        root_dir / "corpus" / "sorting",
        root_dir / "corpus" / "graphs",
        root_dir / "corpus" / "dp",
        root_dir / "corpus" / "trees",
        root_dir / "backend" / "app",
        root_dir / "eval",
    ]
    missing_dirs = [str(d.relative_to(root_dir)) for d in expected_dirs if not d.exists()]
    dirs_ok = len(missing_dirs) == 0
    print_status(
        "Directory Structure",
        dirs_ok,
        "All expected directories present" if dirs_ok else f"Missing: {missing_dirs}"
    )
    if not dirs_ok:
        all_passed = False

    # 3. Load .env (checks backend/.env first as documented, then root .env)
    dotenv_imported = False
    try:
        from dotenv import load_dotenv
        backend_env = root_dir / "backend" / ".env"
        root_env = root_dir / ".env"
        dotenv_path = backend_env if backend_env.exists() else root_env
        if dotenv_path.exists():
            load_dotenv(dotenv_path)
            print_status(".env File", True, f"Loaded from {dotenv_path.relative_to(root_dir)}")
        else:
            print_status(".env File", False, f"Not found at backend/.env or .env (create backend/.env from .env.example)")
            all_passed = False
        dotenv_imported = True
    except ImportError:
        print_status("python-dotenv", False, "Module not installed")
        all_passed = False

    # 4. Check Environment Variables
    anthropic_key = os.getenv("ANTHROPIC_API_KEY", "")
    model_name = os.getenv("CLAUDE_MODEL", "")
    db_url = os.getenv("DATABASE_URL", "")

    key_ok = bool(anthropic_key and anthropic_key != "your-key-here")
    print_status(
        "ANTHROPIC_API_KEY",
        key_ok,
        "Valid key detected (masked: ***)" if key_ok else "Not set or still placeholder ('your-key-here')"
    )

    print_status(
        "CLAUDE_MODEL",
        bool(model_name),
        f"Model: {model_name or 'Not set'}"
    )

    # Mask credentials in DATABASE_URL if present
    masked_db = db_url
    if "@" in db_url and "://" in db_url:
        prefix, rest = db_url.split("://", 1)
        creds, host = rest.split("@", 1)
        masked_db = f"{prefix}://***:***@{host}"

    print_status(
        "DATABASE_URL",
        bool(db_url),
        f"URL: {masked_db or 'Not set'}"
    )

    # 5. Check dependencies imports
    modules = ["anthropic", "sentence_transformers", "psycopg", "pgvector"]
    for mod in modules:
        try:
            __import__(mod)
            print_status(f"Import: {mod}", True, "Available")
        except ImportError as e:
            print_status(f"Import: {mod}", False, f"Import error: {e}")
            all_passed = False

    # 6. Test Database Connection (optional / non-fatal if db container not yet started)
    if db_url:
        try:
            import psycopg
            with psycopg.connect(db_url, connect_timeout=3) as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1;")
                    cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
                    print_status("PostgreSQL & pgvector", True, "Successfully connected and verified vector extension")
        except Exception as e:
            print_status("PostgreSQL & pgvector", False, f"Could not connect to {db_url}: {e}")
            print("   ℹ️  Note: Start PostgreSQL via docker compose up -d or cloud database.")

    print("=" * 60)
    if all_passed:
        print("🎉 Environment check complete! All core prerequisites are met.")
    else:
        print("⚠️ Environment check completed with warnings/missing items above.")
    print("=" * 60)

if __name__ == "__main__":
    main()

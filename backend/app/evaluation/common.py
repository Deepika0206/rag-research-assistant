import hashlib
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
EVAL_DIR = ROOT / "eval"
CATEGORIES = ("single_hop", "multi_hop", "unsupported")
EXPECTED_COUNTS = {"single_hop": 12, "multi_hop": 8, "unsupported": 5}
GAP_MARKER = "The notes do not contain enough evidence for:"

REFUSAL_RE = re.compile(
    r"(not contain|does not contain|do not contain|insufficient|not enough|no information|"
    r"cannot (?:be )?(?:answer|find)|does not (?:provide|mention|state|cover)|not (?:mentioned|covered))",
    re.IGNORECASE,
)


def load_questions(path=None) -> list[dict]:
    return json.loads(Path(path or EVAL_DIR / "questions.json").read_text(encoding="utf-8"))


def last_records(path: Path) -> dict:
    """Read a .jsonl file. The last record for each question ID wins."""
    out = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                rec = json.loads(line)
                out[rec["id"]] = rec
    return out


def load_chunks_from_db() -> dict[int, dict]:
    try:
        import psycopg
        from app.config import DATABASE_URL

        with psycopg.connect(DATABASE_URL) as conn:
            rows = conn.execute(
                "SELECT c.id, c.topic, c.text, d.path FROM chunks c JOIN documents d ON d.id = c.doc_id ORDER BY c.id"
            ).fetchall()
        return {r[0]: {"chunk_id": r[0], "topic": r[1], "text": r[2], "doc": r[3]} for r in rows}
    except Exception:
        from app.retrieval.retriever import Retriever
        return Retriever().chunks



def corpus_fingerprint(chunks: dict) -> str:
    h = hashlib.sha256()
    for cid in sorted(chunks):
        h.update(f"{cid}|{chunks[cid]['doc']}|{chunks[cid]['text']}\n".encode("utf-8"))
    return h.hexdigest()[:16]


def matches(chunk: dict, gold: dict) -> bool:
    return chunk["doc"] == gold["doc"] and gold["phrase"].lower() in chunk["text"].lower()


def recall_union(lists: list[list[dict]], gold: list[dict]) -> float:
    """Share of gold items found anywhere in the given chunk lists."""
    pool = [c for lst in lists for c in lst]
    return sum(any(matches(c, g) for c in pool) for g in gold) / len(gold)


def best_rr(lists: list[list[dict]], gold: list[dict]) -> float:
    """Best reciprocal rank of the first relevant chunk, over all lists."""
    best = 0.0
    for lst in lists:
        for rank, c in enumerate(lst, start=1):
            if any(matches(c, g) for g in gold):
                best = max(best, 1.0 / rank)
                break
    return best


def cited_ids(text: str) -> list[int]:
    return list(dict.fromkeys(int(x) for x in re.findall(r"\[(\d+)\]", text)))


def split_sentences(answer: str) -> list[str]:
    """One item per sentence. Citations stay with their sentence. The gap block is dropped."""
    answer = answer.split(GAP_MARKER)[0]
    sentences: list[str] = []
    for line in answer.splitlines():
        line = line.strip().lstrip("-*• ").strip()
        if not line:
            continue
        for part in re.split(r"(?<=[.!?])\s+(?=[A-Z\[(])", line):
            part = part.strip()
            m = re.match(r"^((?:\[\d+\]\s*)+)(.*)$", part)
            if m and sentences:                      # citations that belong to the sentence before
                sentences[-1] += " " + m.group(1).strip()
                part = m.group(2).strip()
            if part:
                sentences.append(part)
    return sentences


def looks_like_refusal(sentence: str) -> bool:
    return bool(REFUSAL_RE.search(sentence))


def git_state() -> dict:
    try:
        git = lambda *a: subprocess.check_output(["git", *a], text=True, cwd=ROOT).strip()
        return {
            "commit": git("rev-parse", "--short", "HEAD"),
            "uncommitted_changes": bool(git("status", "--porcelain", "--", ".", ":(exclude)eval/results")),
        }
    except Exception:
        return {"commit": "uncommitted", "uncommitted_changes": False}


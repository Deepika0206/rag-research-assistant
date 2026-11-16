import re

from app.config import EMBED_MODEL, MAX_TOKENS, OVERLAP_TOKENS

_tokenizer = None


def _get_tokenizer():
    global _tokenizer
    if _tokenizer is None:
        try:
            from transformers import AutoTokenizer
            _tokenizer = AutoTokenizer.from_pretrained(EMBED_MODEL)
        except Exception:
            _tokenizer = False
    return _tokenizer if _tokenizer is not False else None


def count_tokens(text: str) -> int:
    tok = _get_tokenizer()
    if tok is not None:
        return len(tok.encode(text, add_special_tokens=False))
    # Approximate fallback when transformers tokenizer is unavailable in lightweight tests
    return max(1, len(re.findall(r"\S+", text))) if text.strip() else 0


def _split_long_paragraph(para: str) -> list[str]:
    """Split a single paragraph exceeding MAX_TOKENS into sentence/line/word segments."""
    if count_tokens(para) <= MAX_TOKENS:
        return [para]

    pieces = [s.strip() for s in re.split(r"(?<=[.!?])\s+|\n+", para) if s.strip()]
    if len(pieces) <= 1:
        words = para.split()
        out, cur = [], []
        for w in words:
            candidate = " ".join(cur + [w])
            if cur and count_tokens(candidate) > MAX_TOKENS:
                out.append(" ".join(cur))
                cur = [w]
            else:
                cur.append(w)
        if cur:
            out.append(" ".join(cur))
        return out

    expanded: list[str] = []
    for p in pieces:
        if count_tokens(p) > MAX_TOKENS:
            expanded.extend(_split_long_paragraph(p))
        else:
            expanded.append(p)
    return expanded


def chunk_text(text: str) -> list[str]:
    """Group paragraphs into chunks. Repeat the last paragraphs as overlap."""
    raw_paras = [p.strip() for p in re.split(r"\r?\n\s*\r?\n", text) if p.strip()]
    paras: list[str] = []
    for p in raw_paras:
        paras.extend(_split_long_paragraph(p))

    chunks, cur, cur_tok = [], [], 0
    for p in paras:
        t = count_tokens(p)
        if cur and cur_tok + t > MAX_TOKENS:
            chunks.append("\n\n".join(cur))
            keep, keep_tok = [], 0
            for q in reversed(cur):            # build the overlap
                qt = count_tokens(q)
                if keep_tok + qt > OVERLAP_TOKENS:
                    break
                keep.insert(0, q)
                keep_tok += qt
            cur, cur_tok = keep, keep_tok
        cur.append(p)
        cur_tok += t
    if cur:
        chunks.append("\n\n".join(cur))
    return chunks

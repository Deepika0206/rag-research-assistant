import hashlib
import json
import os
import time

try:
    from anthropic import Anthropic
except ImportError:
    Anthropic = None

from app.config import (CLAUDE_MODEL, LLM_CACHE_DIR, PRICE_IN_PER_MTOK,
                        PRICE_OUT_PER_MTOK, USE_LLM_CACHE)

_client = None
_usage = {"calls": 0, "cached": 0, "input_tokens": 0, "output_tokens": 0, "seconds": 0.0}


def _get_client():
    global _client
    if _client is None:
        if Anthropic is None:
            return None
        api_key = os.getenv("ANTHROPIC_API_KEY", "")
        if not api_key or "your-key" in api_key or "mock" in api_key:
            return None
        _client = Anthropic(max_retries=3, timeout=60.0)   # the SDK retries rate-limit and server errors
    return _client


def call_llm(system: str, user: str, max_tokens: int = 1000, temperature: float = 0.0) -> str:

    key = hashlib.sha256(
        json.dumps([CLAUDE_MODEL, system, user, max_tokens, temperature]).encode()
    ).hexdigest()
    path = LLM_CACHE_DIR / f"{key}.json"

    if USE_LLM_CACHE and path.exists():
        _usage["cached"] += 1
        return json.loads(path.read_text(encoding="utf-8"))["text"]

    client = _get_client()
    if client is None:
        raise RuntimeError("Anthropic client is not initialized. Please configure ANTHROPIC_API_KEY.")

    start = time.time()
    msg = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    text = "".join(b.text for b in msg.content if b.type == "text")
    if msg.stop_reason == "max_tokens":
        print("WARN: the answer was cut at max_tokens. Raise max_tokens.")

    _usage["input_tokens"] += msg.usage.input_tokens
    _usage["output_tokens"] += msg.usage.output_tokens
    _usage["calls"] += 1
    _usage["seconds"] += time.time() - start

    if USE_LLM_CACHE:
        LLM_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({"text": text}), encoding="utf-8")
    return text


def usage_summary() -> dict:
    """Totals for this run only. Cached calls cost nothing."""
    cost = (_usage["input_tokens"] * PRICE_IN_PER_MTOK
            + _usage["output_tokens"] * PRICE_OUT_PER_MTOK) / 1_000_000
    return {**_usage, "seconds": round(_usage["seconds"], 1), "est_cost": round(cost, 4)}

"""
Standalone LLM verification script for RAG Research Assistant.
Uses the actual app.llm.call_llm function.
"""

import os
import sys
from pathlib import Path

# Add backend directory to sys.path so app modules import cleanly
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.config import CLAUDE_MODEL
from app.llm import call_llm, usage_summary


def test_llm():
    print("=" * 60)
    print("🤖 Testing Anthropic Claude LLM Integration")
    print(f"Configured Model: {CLAUDE_MODEL}")
    print("=" * 60)

    key = os.getenv("ANTHROPIC_API_KEY", "")
    if not key or "your-key" in key or "mock" in key:
        print("❌ FAILED: ANTHROPIC_API_KEY is not set or contains placeholder.")
        print("Please set your key in backend/.env:")
        print("  ANTHROPIC_API_KEY=sk-ant-api03-...")
        return 1

    masked = key[:7] + "..." + key[-4:] if len(key) > 12 else "***"
    print(f"API Key Detected: {masked}")

    system_prompt = "You are a concise algorithm tutor. Answer in exactly one sentence."
    user_prompt = "What is the time complexity of Binary Search?"

    print("\nSending test prompt to Claude...")
    try:
        reply = call_llm(system=system_prompt, user=user_prompt, max_tokens=100)
        print("\n✅ SUCCESS: LLM responded successfully!")
        print(f"Response: {reply.strip()}")
        usage = usage_summary()
        print(f"Token Usage: {usage['input_tokens']} in / {usage['output_tokens']} out | Est Cost: ${usage['est_cost']}")
        return 0
    except Exception as e:
        print(f"\n❌ FAILED: Error calling LLM: {type(e).__name__}: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(test_llm())

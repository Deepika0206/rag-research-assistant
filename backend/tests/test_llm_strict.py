import os
from unittest.mock import MagicMock

try:
    import pytest
except ImportError:
    class _PytestRaises:
        def __init__(self, expected_exc, match=None):
            self.expected_exc = expected_exc
            self.match = match

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc_val, exc_tb):
            if exc_type is None:
                raise AssertionError(f"Expected {self.expected_exc} but no exception was raised")
            if not issubclass(exc_type, self.expected_exc):
                return False
            if self.match and self.match not in str(exc_val):
                raise AssertionError(f"Expected exception matching {self.match!r}, got {exc_val!r}")
            return True

    class _PytestMock:
        @staticmethod
        def raises(expected_exc, match=None):
            return _PytestRaises(expected_exc, match=match)

    pytest = _PytestMock()

from app.llm import call_llm


def test_call_llm_raises_without_key(monkeypatch):
    """Test 1: call_llm raises without a key."""
    monkeypatch.setenv("LLM_MODE", "")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "")
    monkeypatch.setattr("app.llm.USE_LLM_CACHE", 0)
    monkeypatch.setattr("app.llm._client", None)
    with pytest.raises(RuntimeError, match="Anthropic client is not initialized"):
        call_llm("System prompt", "User query")


def test_call_llm_never_sends_temperature(monkeypatch):
    """Test 2: call_llm never passes temperature to client.messages.create."""
    monkeypatch.setenv("LLM_MODE", "")
    monkeypatch.setattr("app.llm.USE_LLM_CACHE", 0)

    mock_client = MagicMock()
    mock_msg = MagicMock()
    mock_msg.content = [MagicMock(type="text", text="LLM response")]
    mock_msg.stop_reason = "end_turn"
    mock_msg.usage.input_tokens = 120
    mock_msg.usage.output_tokens = 45
    mock_client.messages.create.return_value = mock_msg

    monkeypatch.setattr("app.llm._get_client", lambda: mock_client)

    res = call_llm("System prompt", "User query", max_tokens=250, temperature=0.7)
    assert res == "LLM response"

    mock_client.messages.create.assert_called_once()
    _, kwargs = mock_client.messages.create.call_args
    assert "temperature" not in kwargs, f"temperature must not be sent to API, got: {kwargs}"
    assert kwargs["max_tokens"] == 250
    assert kwargs["system"] == "System prompt"
    assert kwargs["messages"] == [{"role": "user", "content": "User query"}]


def test_strict_retriever_refuses_when_library_missing(monkeypatch):
    """Test 3: strict mode refuses to start when a library is missing."""
    import app.retrieval.retriever as ret_mod
    monkeypatch.setattr(ret_mod, "STRICT", True)
    monkeypatch.setattr(ret_mod, "SentenceTransformer", None)

    with pytest.raises(RuntimeError, match="STRICT_RETRIEVAL=1: retrieval backend is not fully available"):
        ret_mod.Retriever()

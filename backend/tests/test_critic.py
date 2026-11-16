from app.agent.critic import check_draft, parse_verdicts
from app.agent.drafter import parse_draft


def test_parse_draft_removes_phantom_ids():
    d = parse_draft('{"claims":[{"text":"A.","chunk_ids":[1,99]}],"missing":""}', {1, 2})
    assert d["claims"][0]["chunk_ids"] == [1]
    assert d["dropped_ids"] == ["99"]


def test_parse_draft_garbage():
    d = parse_draft("hello", {1})
    assert d["claims"] == [] and d["parse_error"] is True


def test_broken_critic_reply_fails_closed():
    out, err = parse_verdicts("not json", 2)
    assert err and not any(v["supported"] for v in out)


def test_missing_verdict_means_unsupported():
    out, _ = parse_verdicts('{"verdicts":[{"index":0,"supported":true,"reason":"ok"}]}', 2)
    assert out[0]["supported"] and not out[1]["supported"]


def test_supported_must_be_boolean_true():
    out, _ = parse_verdicts('{"verdicts":[{"index":0,"supported":"yes","reason":""}]}', 1)
    assert not out[0]["supported"]


def test_claim_without_citation_fails_and_critic_is_not_called():
    def boom(*a, **k):
        raise AssertionError("The LLM must not be called")
    draft = {"claims": [{"text": "A.", "chunk_ids": []}], "missing": ""}
    assert check_draft(draft, [], boom)["passed"] is False


def test_empty_draft_fails():
    assert check_draft({"claims": [], "missing": "x"}, [], lambda *a, **k: "")["passed"] is False


def test_all_supported_but_missing_info_does_not_pass():
    chunks = [{"chunk_id": 1, "text": "Memoization stores results."}]
    draft = {"claims": [{"text": "Memoization stores results.", "chunk_ids": [1]}],
             "missing": "Nothing about negative cycles."}
    llm = lambda *a, **k: '{"verdicts":[{"index":0,"supported":true,"reason":"ok"}]}'
    r = check_draft(draft, chunks, llm)
    assert r["incomplete"] is True and r["passed"] is False

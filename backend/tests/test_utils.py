from app.retrieval.utils import tokenize, rrf_fuse


def test_tokenize():
    assert tokenize("O(log n) Binary-Search!") == ["o", "log", "n", "binary", "search"]


def test_rrf_prefers_chunks_found_by_both_lists():
    fused = rrf_fuse([[1, 2, 3], [3, 4, 5]], k=3)
    assert fused[0][0] == 3


def test_rrf_respects_k():
    assert len(rrf_fuse([[1, 2, 3], [4, 5, 6]], k=4)) == 4


def test_extract_json_normal():
    from app.agent.utils import extract_json
    assert extract_json('{"key": "value"}') == {"key": "value"}


def test_extract_json_trailing_text():
    from app.agent.utils import extract_json
    raw = '{"query": "machine learning"}\n\nAdditional explanation that should not break parsing.'
    assert extract_json(raw) == {"query": "machine learning"}


def test_extract_json_markdown_code_block():
    from app.agent.utils import extract_json
    raw = 'Here is the plan:\n```json\n{"query_type": "single_hop", "sub_questions": ["What is BFS?"]}\n```\nHope this helps!'
    assert extract_json(raw) == {"query_type": "single_hop", "sub_questions": ["What is BFS?"]}


def test_extract_json_malformed():
    from app.agent.utils import extract_json
    assert extract_json('{broken json') is None
    assert extract_json('not json at all') is None


def test_extract_json_multiple_objects():
    from app.agent.utils import extract_json
    raw = 'First object: {"first": 1} and second object: {"second": 2}'
    assert extract_json(raw) == {"first": 1}

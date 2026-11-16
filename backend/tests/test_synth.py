import json

from app.agent.critic import CRITIC_SYSTEM
from app.agent.drafter import DRAFTER_SYSTEM
from app.agent.graph import build_graph, run_agent
from app.agent.planner import PLANNER_SYSTEM
from app.agent.synthesizer import (
    SYNTH_SYSTEM,
    parse_synthesis,
    render,
    render_deterministic,
    synthesize,
)


def test_parse_drops_bad_refs_and_fake_citations():
    ref_map = {"C1": [5], "C2": [6, 7]}
    reply = json.dumps({"sentences": [
        {"text": "Good sentence [99].", "refs": ["C1", "Z9"]},     # fake cite removed, Z9 dropped
        {"text": "No evidence at all.", "refs": []},               # deleted
        {"text": "Only a bad ref.", "refs": ["C77"]},              # deleted
        {"text": "Uses arr[0] safely.", "refs": ["C2"]},          # arr[0] stays
    ]})
    out, dropped, err = parse_synthesis(reply, ref_map)
    assert err is False and dropped == 2
    assert out[0]["text"] == "Good sentence." and out[0]["chunk_ids"] == [5]
    assert out[1]["text"] == "Uses arr[0] safely." and out[1]["chunk_ids"] == [6, 7]


def test_parse_garbage():
    assert parse_synthesis("nope", {"C1": [1]})[2] is True


def test_render_keeps_markdown_blocks_and_places_table_citations_in_last_cell():
    answer = render([
        {"text": "## Key differences\n\nA brief introduction.", "chunk_ids": [1]},
        {
            "text": "| Criterion | Merge sort | Quicksort |\n| --- | --- | --- |\n| Time | `O(n log n)` | `O(n^2)` |",
            "chunk_ids": [2, 3],
        },
    ])
    assert answer == (
        "## Key differences\n\nA brief introduction. [1]\n\n"
        "| Criterion | Merge sort | Quicksort |\n| --- | --- | --- |\n"
        "| Time | `O(n log n)` | `O(n^2)` [2][3] |"
    )


def test_binary_search_explanation_uses_markdown_heading_and_complexity_format():
    answer = render_deterministic(
        [
            {
                "text": "Binary search halves the sorted search interval at each step. "
                "Its time complexity is `O(log n)`.",
                "chunk_ids": [4],
            }
        ],
        "Explain binary search.",
    )
    assert answer == (
        "## Explanation\n\n"
        "Binary search halves the sorted search interval at each step. "
        "Its time complexity is `O(log n)`. [4]"
    )


def test_deterministic_answer_formats_step_by_step_procedure():
    answer = render_deterministic(
        [
            {"text": "Select the unvisited vertex with the smallest tentative distance.", "chunk_ids": [1]},
            {"text": "Relax its outgoing edges.", "chunk_ids": [2]},
        ],
        "Explain Dijkstra's algorithm step by step.",
    )
    assert answer == (
        "## Steps\n\n"
        "1. Select the unvisited vertex with the smallest tentative distance. [1]\n"
        "2. Relax its outgoing edges. [2]"
    )


def test_comparison_synthesis_marks_unsupported_side_and_keeps_gap():
    chunk = {
        "chunk_id": 1,
        "topic": "searching",
        "doc": "searching/binary_search.md",
        "text": "Binary search repeatedly halves a sorted search interval.",
    }

    def llm(system, user, max_tokens=1000, temperature=0.0):
        if system == SYNTH_SYSTEM:
            return json.dumps({"sentences": [{
                "text": (
                    "Binary search and linear search differ in the retrieved notes.\n\n"
                    "| Criterion | Binary search | Linear search |\n"
                    "| --- | --- | --- |\n"
                    "| Search process | Repeatedly halves a sorted interval | "
                    "Not established by the retrieved evidence |"
                ),
                "refs": ["C1"],
            }]})
        if system == CRITIC_SYSTEM:
            return json.dumps({"verdicts": [{"index": 0, "supported": True, "reason": "supported"}]})
        raise AssertionError("unexpected LLM stage")

    result = synthesize(
        "Compare binary search with linear search.",
        [
            {
                "sub_question": "How does binary search work?",
                "status": "answered",
                "claims": [{"text": "Binary search repeatedly halves a sorted search interval.", "chunk_ids": [1]}],
                "chunks": [chunk],
                "missing": "",
            },
            {
                "sub_question": "How does linear search work?",
                "status": "evidence_insufficient",
                "claims": [],
                "chunks": [],
                "missing": "no supporting evidence found",
            },
        ],
        llm=llm,
    )

    assert result["status"] == "partial"
    assert "| Search process | Repeatedly halves a sorted interval | Not established by the retrieved evidence [1] |" in result["answer"]
    assert "## Evidence gaps" in result["answer"]
    assert list(result["sources"]) == [1]


class FakeRetriever:
    def search(self, query, topic=None, k=5):
        if query == "a?":
            return [{"chunk_id": 1, "topic": "searching", "doc": "searching/a.md", "text": "A.", "rerank_score": 1.0},
                    {"chunk_id": 3, "topic": "dp", "doc": "dp/s.md", "text": "A in dp.", "rerank_score": 0.9}]
        return [{"chunk_id": 2, "topic": "dp", "doc": "dp/b.md", "text": "B.", "rerank_score": 1.0}]


def fake_llm(system, user, max_tokens=1000, temperature=0.0):
    if system == PLANNER_SYSTEM:
        return json.dumps({"query_type": "multi_hop", "sub_questions": ["a?", "b?"]})
    if system == DRAFTER_SYSTEM:
        if "Question: a?" in user:
            return json.dumps({"claims": [{"text": "A works.", "chunk_ids": [1, 3]}], "missing": ""})
        return json.dumps({"claims": [{"text": "B works.", "chunk_ids": [2]}], "missing": ""})
    if system == CRITIC_SYSTEM:
        return json.dumps({"verdicts": [{"index": 0, "supported": True, "reason": "ok"}]})
    if system == SYNTH_SYSTEM:
        return json.dumps({"sentences": [
            {"text": "Both are covered in dp [12].", "refs": ["C1", "C2", "R1"]},
            {"text": "An uncited sentence.", "refs": []},
        ]})
    raise AssertionError("unknown stage")


def test_multi_hop_report_uses_code_citations_and_relations():
    out = run_agent(build_graph(FakeRetriever(), llm=fake_llm), "compare a and b")
    f = out["final"]
    assert f["status"] == "answered" and f["synthesis"] == "llm" and f["dropped_sentences"] == 1
    assert [r["value"] for r in f["relations"]] == ["dp"]
    assert f["answer"] == "Both are covered in dp. [1][2][3]"      # chunk IDs come from code
    assert sorted(f["sources"]) == [1, 2, 3]


def test_strip_tags_nested_and_malformed():
    from app.agent.utils import strip_tags
    assert strip_tags("<claim>text</claim>") == "text"
    assert strip_tags("<claim><claim>text</claim></claim>") == "text"
    assert strip_tags("<claim>text") == "text"
    assert strip_tags("prefix <chunk id='1'>content</chunk> suffix") == "prefix content suffix"
    assert strip_tags("deep <claim><chunk><cited_chunk>inner</cited_chunk></chunk></claim>") == "deep inner"


def test_single_answered_sub_question_needs_no_synth_call():
    def llm(system, user, max_tokens=1000, temperature=0.0):
        assert system != SYNTH_SYSTEM
        return fake_llm(system, user, max_tokens, temperature)
    plan = json.dumps({"query_type": "single_hop", "sub_questions": ["a?"]})
    def llm2(system, user, max_tokens=1000, temperature=0.0):
        return plan if system == PLANNER_SYSTEM else llm(system, user, max_tokens, temperature)
    out = run_agent(build_graph(FakeRetriever(), llm=llm2), "a?")
    assert out["final"]["synthesis"] == "deterministic"
    assert out["final"]["answer"] == "## Explanation\n\nA works. [1][3]"


def test_post_synthesis_critic_drops_fabricated_sentence():
    def llm(system, user, max_tokens=1000, temperature=0.0):
        if system == SYNTH_SYSTEM:
            return json.dumps({"sentences": [
                {"text": "A works.", "refs": ["C1"]},
                {"text": "Fabricated claim.", "refs": ["C2"]},
                {"text": "Both share topic dp.", "refs": ["R1"]},
            ]})
        if system == CRITIC_SYSTEM and "Fabricated claim." in user:
            return json.dumps({"verdicts": [
                {"index": 0, "supported": True, "reason": "ok"},
                {"index": 1, "supported": False, "reason": "not in chunk"},
            ]})
        return fake_llm(system, user, max_tokens, temperature)

    out = run_agent(build_graph(FakeRetriever(), llm=llm), "compare a and b")
    f = out["final"]
    assert "Fabricated claim." not in f["answer"]
    assert "A works." in f["answer"]
    assert "Both share topic dp." in f["answer"]
    assert f["dropped_sentences"] == 1


from app.agent.planner import parse_plan

Q = "compare a and b"


def test_good_multi_hop():
    p = parse_plan('{"query_type":"multi_hop","sub_questions":["a?","b?"]}', Q)
    assert p["query_type"] == "multi_hop"
    assert p["sub_questions"] == ["a?", "b?"]
    assert p["fallback"] is False


def test_json_inside_code_fence():
    p = parse_plan('```json\n{"query_type":"multi_hop","sub_questions":["a?","b?"]}\n```', Q)
    assert p["sub_questions"] == ["a?", "b?"]


def test_cap_at_three():
    p = parse_plan('{"query_type":"multi_hop","sub_questions":["a","b","c","d","e"]}', Q)
    assert p["sub_questions"] == ["a", "b", "c"]


def test_single_hop_keeps_original_question():
    p = parse_plan('{"query_type":"single_hop","sub_questions":["rewritten"]}', Q)
    assert p["sub_questions"] == [Q]


def test_one_subquestion_means_single_hop():
    p = parse_plan('{"query_type":"multi_hop","sub_questions":["only one"]}', Q)
    assert p["query_type"] == "single_hop" and p["sub_questions"] == [Q]


def test_duplicates_removed():
    p = parse_plan('{"query_type":"multi_hop","sub_questions":["a?","A?","b?"]}', Q)
    assert p["sub_questions"] == ["a?", "b?"]


def test_garbage_falls_back():
    p = parse_plan("sorry, I cannot do that", Q)
    assert p["fallback"] is True and p["sub_questions"] == [Q]

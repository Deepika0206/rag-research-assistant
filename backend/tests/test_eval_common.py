from app.evaluation.common import best_rr, cited_ids, looks_like_refusal, recall_union, split_sentences


def chunk(doc, text):
    return {"doc": doc, "text": text}


GOLD = [{"doc": "a.md", "phrase": "alpha"}, {"doc": "b.md", "phrase": "beta"}]


def test_split_keeps_citations_with_their_sentence():
    text = "Sliding window keeps a moving range. [41][42] Two-pointer uses two indices. [12]"
    assert split_sentences(text) == [
        "Sliding window keeps a moving range. [41][42]",
        "Two-pointer uses two indices. [12]",
    ]


def test_split_baseline_style_and_bullets_and_decimals():
    assert split_sentences("Binary search is fast [12]. It halves the range [12][15].") == [
        "Binary search is fast [12].", "It halves the range [12][15]."]
    assert split_sentences("- First point [3]\n- Second point [4]") == ["First point [3]", "Second point [4]"]
    assert split_sentences("It takes 3.5 steps [2].") == ["It takes 3.5 steps [2]."]


def test_gap_block_is_not_a_claim():
    text = "A is true. [1]\n\nThe notes do not contain enough evidence for:\n- B (missing)"
    assert split_sentences(text) == ["A is true. [1]"]


def test_cited_ids_and_refusal():
    assert cited_ids("X [3][12] and [3].") == [3, 12]
    assert looks_like_refusal("The context does not contain this information.")
    assert not looks_like_refusal("Binary search is fast [1].")


def test_recall_union_counts_each_gold_item_once():
    l1 = [chunk("a.md", "Alpha is here")]
    l2 = [chunk("x.md", "no"), chunk("b.md", "beta is here")]
    assert recall_union([l1], GOLD) == 0.5
    assert recall_union([l1, l2], GOLD) == 1.0


def test_best_rr_takes_the_best_list():
    l1 = [chunk("a.md", "Alpha is here")]
    l2 = [chunk("x.md", "no"), chunk("b.md", "beta is here")]
    assert best_rr([l1, l2], GOLD) == 1.0
    assert best_rr([l2], GOLD) == 0.5
    assert best_rr([[chunk("x.md", "no")]], GOLD) == 0.0

from app.agent.critic import check_draft
from app.llm import usage_summary

CHUNK = {"chunk_id": 1, "text": "Binary search runs in O(log n) time on a sorted array. "
                                "Each step compares the target with the middle element."}

# (claim, expected verdict)
CASES = [
    ("Binary search takes O(log n) time.", True),
    ("Binary search needs a sorted array.", True),
    ("Searching a sorted array with binary search takes logarithmic time.", True),   # paraphrase
    ("Binary search was first published in 1946.", False),                            # true or not, not in chunk
    ("Binary search takes O(log n) time and O(1) extra space.", False),              # one part missing
    ("Binary search takes O(n) time.", False),                                        # wrong
]

correct = 0
for claim, expected in CASES:
    draft = {"claims": [{"text": claim, "chunk_ids": [1]}], "missing": ""}
    result = check_draft(draft, [CHUNK])
    got = result["verdicts"][0]["supported"]
    correct += got == expected
    print(f"[{'OK ' if got == expected else 'BAD'}] expected={expected!s:<5} got={got!s:<5} {claim}")
    print(f"        reason: {result['verdicts'][0]['reason']}")

print(f"\n{correct}/{len(CASES)} correct")
print("USAGE:", usage_summary())

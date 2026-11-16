import json
from pathlib import Path

from app.agent.planner import make_plan
from app.llm import usage_summary

PATH = Path(__file__).resolve().parents[2] / "eval" / "planner_dev.json"
data = json.loads(PATH.read_text(encoding="utf-8"))

correct = 0
for item in data:
    plan = make_plan(item["question"])
    ok = plan["query_type"] == item["expected"]
    correct += ok
    print(f"[{'OK ' if ok else 'BAD'}] expected={item['expected']:<10} got={plan['query_type']:<10} "
          f"fallback={plan['fallback']}  {item['question']}")
    if plan["query_type"] == "multi_hop":
        for s in plan["sub_questions"]:
            print(f"        - {s}")

print(f"\nType accuracy: {correct}/{len(data)}")
print("USAGE:", usage_summary())

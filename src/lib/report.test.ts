import { describe, expect, test } from "vitest";
import { firstSourceId, parseAnswer } from "./report";

const valid = new Set(["12", "15"]);

describe("parseAnswer", () => {
  test("splits text and citations", () => {
    const out = parseAnswer("A is fast. [12][15] B is slow. [12]", valid);
    expect(out).toEqual([
      { kind: "text", text: "A is fast. " },
      { kind: "cite", id: "12", valid: true },
      { kind: "cite", id: "15", valid: true },
      { kind: "text", text: " B is slow. " },
      { kind: "cite", id: "12", valid: true },
    ]);
  });

  test("an unknown number stays plain text (arr[0])", () => {
    expect(parseAnswer("Use arr[0] first.", valid)).toEqual([{ kind: "text", text: "Use arr[0] first." }]);
  });

  test("a phantom citation is flagged", () => {
    const out = parseAnswer("Claim [99].", valid, new Set(["99"]));
    expect(out[1]).toEqual({ kind: "cite", id: "99", valid: false });
  });

  test("no citations", () => {
    expect(parseAnswer("Nothing here.", valid)).toEqual([{ kind: "text", text: "Nothing here." }]);
    expect(parseAnswer("", valid)).toEqual([]);
  });
});

test("firstSourceId sorts numerically", () => {
  expect(firstSourceId({ "10": 1, "9": 1 })).toBe("9");
  expect(firstSourceId({})).toBeNull();
});

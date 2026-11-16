import type { Status } from "./types";

export type Segment =
  | { kind: "text"; text: string }
  | { kind: "cite"; id: string; valid: boolean };

/** Split an answer into plain text and citation chips. */
export function parseAnswer(answer: string, validIds: Set<string>, invalidIds: Set<string> = new Set()): Segment[] {
  const out: Segment[] = [];
  const pushText = (t: string) => {
    if (!t) return;
    const last = out[out.length - 1];
    if (last && last.kind === "text") last.text += t;
    else out.push({ kind: "text", text: t });
  };

  const re = /\[(\d+)\]/g;
  let pos = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(answer)) !== null) {
    pushText(answer.slice(pos, m.index));
    const id = m[1];
    if (validIds.has(id)) out.push({ kind: "cite", id, valid: true });
    else if (invalidIds.has(id)) out.push({ kind: "cite", id, valid: false });
    else pushText(m[0]);                       // for example arr[0]: keep as plain text
    pos = m.index + m[0].length;
  }
  pushText(answer.slice(pos));
  return out;
}

export function firstSourceId(sources: Record<string, unknown>): string | null {
  const ids = Object.keys(sources).sort((a, b) => Number(a) - Number(b));
  return ids.length > 0 ? ids[0] : null;
}

export const STATUS_INFO: Record<Status, { label: string; hint: string; className: string }> = {
  answered: {
    label: "Answered",
    hint: "Every claim passed the Critic.",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  partial: {
    label: "Partial",
    hint: "Some parts have no supporting evidence in the notes.",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  evidence_insufficient: {
    label: "Evidence-insufficient",
    hint: "The notes do not contain enough evidence. The system did not guess.",
    className: "border-rose-200 bg-rose-50 text-rose-800",
  },
  unchecked: {
    label: "Unchecked (baseline)",
    hint: "The baseline has no verification step. Check the citations yourself.",
    className: "border-[#eaeaea] bg-[#fafafa] text-[#666666]",
  },
};

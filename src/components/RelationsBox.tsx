import type { Relation } from "../lib/types";

export function RelationsBox({ relations }: { relations: Relation[] }) {
  if (!relations || relations.length === 0) return null;
  return (
    <section className="rounded-[12px] border border-[#eaeaea] bg-white p-6 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.08),0px_2px_1px_0px_rgba(0,0,0,0.04)] space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-[#171717] uppercase tracking-wider font-mono">
          Cross-Document Relations ({relations.length})
        </h2>
        <span className="text-[11px] font-mono text-[#666666]">Deterministic Graph</span>
      </div>
      <p className="text-xs text-[#666666]">
        Computed from verified claim sources. Indicates shared topic/document context across decomposed sub-questions.
      </p>
      <ul className="space-y-2 text-xs">
        {relations.map((r) => (
          <li key={r.id} className="bg-[#fafafa] p-2.5 rounded-[8px] border border-[#eaeaea]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#171717]">{r.text}</span>
              <span className="font-mono text-[11px] text-[#666666] shrink-0">
                claims: {r.claim_ids.join(", ")}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

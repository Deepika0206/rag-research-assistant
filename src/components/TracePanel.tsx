import React from "react";
import type { TraceEvent } from "../lib/types";

const LABEL: Record<TraceEvent["step"], string> = {
  planner: "Planner",
  retrieve: "Retriever",
  draft: "Drafter",
  critique: "Critic",
  refine: "Refiner",
  sub_result: "Sub-answer",
  synthesize: "Synthesizer",
};

function Row({ step, children }: { step: TraceEvent["step"]; children: React.ReactNode }) {
  return (
    <li className="rounded-[8px] border border-[#eaeaea] bg-[#fafafa] p-3 text-xs">
      <span className="mb-2 inline-block rounded-[4px] bg-[#171717] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-white">
        {LABEL[step]}
      </span>
      <div className="space-y-1.5">{children}</div>
    </li>
  );
}

function EventView({ e }: { e: TraceEvent }) {
  switch (e.step) {
    case "planner":
      return (
        <Row step="planner">
          <p className="text-[#171717]">
            Strategy: <strong className="font-semibold">{e.query_type}</strong>
            {e.fallback ? " (fallback plan used)" : ""}
          </p>
          <ol className="list-decimal pl-4 space-y-1 text-[#666666]">
            {e.sub_questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ol>
        </Row>
      );
    case "retrieve":
      return (
        <Row step="retrieve">
          {e.sub_question && <p className="text-[#666666]">Sub-question: {e.sub_question}</p>}
          <p className="text-[#171717]">
            Query: <span className="font-mono text-[11px] bg-white px-1.5 py-0.5 rounded border border-[#eaeaea]">{e.query}</span>
            {e.attempt ? ` (attempt ${e.attempt})` : ""}
          </p>
          <ul className="pl-1 space-y-1 pt-1">
            {e.chunks.map((c) => (
              <li key={c.chunk_id} className="text-[11px] font-mono text-[#666666]">
                [{c.chunk_id}] {c.doc} · score: {c.score}
              </li>
            ))}
          </ul>
        </Row>
      );
    case "draft":
      return (
        <Row step="draft">
          {e.claims.length === 0 ? (
            <p className="italic text-[#666666]">No claims drafted.</p>
          ) : (
            <ul className="space-y-1 text-[#171717]">
              {e.claims.map((c, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span>•</span>
                  <span>
                    {c.text} <span className="text-[#666666] font-mono text-[10px]">[{c.chunk_ids.join(", ")}]</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {e.missing && <p className="text-[#666666]">Missing: {e.missing}</p>}
          {e.dropped_ids.length > 0 && (
            <p className="text-rose-700 font-mono text-[11px]">
              Dropped uncited chunks: {e.dropped_ids.join(", ")}
            </p>
          )}
          {e.parse_error && <p className="text-rose-700 font-mono text-[11px]">Draft JSON parse error.</p>}
        </Row>
      );
    case "critique":
      return (
        <Row step="critique">
          <p className="text-[#171717]">
            Verification:{" "}
            <strong className={e.passed ? "text-emerald-700 font-semibold" : "text-rose-700 font-semibold"}>
              {e.passed ? "PASSED" : "FAILED"}
            </strong>
          </p>
          <ul className="space-y-1.5 mt-2">
            {e.verdicts.map((v, i) => (
              <li key={i} className="text-xs bg-white p-2 rounded-[6px] border border-[#eaeaea]">
                <div className="flex items-center gap-1.5">
                  <span className={v.supported ? "text-emerald-700 font-mono font-bold" : "text-rose-700 font-mono font-bold"}>
                    {v.supported ? "✓" : "✗"}
                  </span>
                  <span className="text-[#171717] font-medium">{v.claim}</span>
                </div>
                <p className="text-[#666666] text-[11px] mt-1 pl-4">{v.reason}</p>
              </li>
            ))}
          </ul>
          {e.incomplete && <p className="text-amber-700 text-xs mt-1">Critic noted incomplete context.</p>}
        </Row>
      );
    case "refine":
      return (
        <Row step="refine">
          <p className="text-[#171717]">
            Refined Query:{" "}
            <span className="font-mono text-[11px] bg-white px-1.5 py-0.5 rounded border border-[#eaeaea]">{e.new_query}</span>{" "}
            <span className="text-[#666666]">(attempt {e.refinement})</span>
          </p>
        </Row>
      );
    case "sub_result":
      return (
        <Row step="sub_result">
          <p className="font-medium text-[#171717]">{e.sub_question}</p>
          <p className="text-[#666666] font-mono text-[11px]">
            Status: {e.status} ({e.refinements} refinement{e.refinements === 1 ? "" : "s"})
          </p>
        </Row>
      );
    case "synthesize":
      return (
        <Row step="synthesize">
          <p className="text-[#171717]">
            Synthesis: <strong className="font-semibold">{e.status}</strong> · mode: {e.mode} · sentences: {e.n_sentences}
            {e.dropped_sentences > 0 ? ` · dropped: ${e.dropped_sentences}` : ""}
          </p>
          {e.relations.length > 0 && (
            <ul className="pl-3 mt-1.5 space-y-1 text-[11px] text-[#666666]">
              {e.relations.map((r, i) => (
                <li key={i}>• {r}</li>
              ))}
            </ul>
          )}
        </Row>
      );
    default:
      return null;
  }
}

export function TracePanel({ trace }: { trace: TraceEvent[] }) {
  if (!trace || trace.length === 0) return null;
  return (
    <details className="rounded-[12px] border border-[#eaeaea] bg-white shadow-[0px_0px_0px_1px_rgba(0,0,0,0.08),0px_2px_1px_0px_rgba(0,0,0,0.04)] group">
      <summary className="cursor-pointer select-none p-5 font-mono text-xs font-semibold text-[#171717] uppercase tracking-wider hover:text-[#666666] transition-colors flex items-center justify-between list-none">
        <span>Execution Trace ({trace.length} steps)</span>
        <span className="text-[11px] font-mono text-[#666666]">[toggle]</span>
      </summary>
      <div className="border-t border-[#eaeaea] p-5 space-y-3">
        <p className="text-[11px] font-mono text-[#666666]">
          Pipeline logs from planner, hybrid retriever, drafter, critic, and synthesizer.
        </p>
        <ol className="space-y-2.5">
          {trace.map((e, i) => (
            <EventView key={i} e={e} />
          ))}
        </ol>
      </div>
    </details>
  );
}

import React, { useState } from "react";
import { Bookmark, Check, Share2, AlertCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "../../types/conversation";
import { STATUS_INFO } from "../../lib/report";
import { remarkCitations } from "../../lib/remarkCitations";
import { CiteChip } from "../CiteChip";
import { TracePanel } from "../TracePanel";
import { RelationsBox } from "../RelationsBox";

interface Props {
  message: Message;
  selectedSourceId: string | null;
  onSelectSource: (id: string) => void;
  onSaveAsNote?: (title: string, content: string, sources: any, citations?: number[]) => void;
  onShareRun?: (runId: string) => void;
}

export function ChatMessage({
  message,
  selectedSourceId,
  onSelectSource,
  onSaveAsNote,
  onShareRun,
}: Props) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showTrace, setShowTrace] = useState(false);

  // If user message
  if (message.role === "user") {
    return (
      <div className="flex justify-end py-2">
        <div className="max-w-2xl rounded-[12px] bg-[#171717] text-white px-4 py-2.5 text-xs sm:text-sm font-normal shadow-xs">
          {message.content}
        </div>
      </div>
    );
  }

  // Assistant response message
  const resp = message.response;
  const isError = !!message.error;

  const validIds: Set<string> = new Set(Object.keys(resp?.sources || {}));
  const invalidIds: Set<string> = new Set<string>((resp?.invalid_citations || []).map(String));
  const statusInfo = resp ? STATUS_INFO[resp.status as keyof typeof STATUS_INFO] || STATUS_INFO.unchecked : null;

  const handleSave = () => {
    if (!resp || !onSaveAsNote) return;
    const title = resp.question.slice(0, 50);
    onSaveAsNote(title, resp.answer, resp.sources, resp.citations);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleShare = () => {
    if (!resp?.run_id) return;
    onShareRun?.(resp.run_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex justify-start py-2">
      <div className="w-full max-w-6xl min-w-0 rounded-[12px] border border-[#eaeaea] bg-white p-4 sm:p-5 shadow-xs space-y-4">
        {/* Status indicator row */}
        {statusInfo && (
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#eaeaea]">
            <div className="flex items-center gap-2">
              <span className={`rounded-[9999px] border px-2.5 py-0.5 text-[11px] font-medium ${statusInfo.className}`}>
                {statusInfo.label}
              </span>
              <span className="text-xs text-[#666666]">{statusInfo.hint}</span>
            </div>

            <div className="flex items-center gap-1.5">
              {resp?.run_id && (
                <button
                  type="button"
                  onClick={handleShare}
                  title="Share link to this research run"
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-[6px] border border-[#eaeaea] text-[#666666] hover:text-[#171717] hover:border-[#171717] transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Share2 className="w-3 h-3" />}
                  <span>{copied ? "Link Copied" : "Share"}</span>
                </button>
              )}

              {onSaveAsNote && resp && (
                <button
                  type="button"
                  onClick={handleSave}
                  title="Save findings to notes"
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-[6px] border border-[#eaeaea] text-[#666666] hover:text-[#171717] hover:border-[#171717] transition-colors"
                >
                  {saved ? <Check className="w-3 h-3 text-emerald-600" /> : <Bookmark className="w-3 h-3" />}
                  <span>{saved ? "Saved" : "Save Note"}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div className="flex items-start gap-2 rounded-[8px] bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Query encountered an issue</p>
              <p className="mt-0.5 text-rose-700">{message.error}</p>
            </div>
          </div>
        )}

        {/* Answer Content with inline citations */}
        {resp && (
          <div className="markdown-content text-xs sm:text-sm">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, [remarkCitations, validIds, invalidIds]]}
              components={{
                a: ({ href, children, ...props }) => {
                  const citation = href?.match(/^#citation-(\d+)$/);
                  if (citation) {
                    const id = citation[1];
                    return (
                      <CiteChip
                        id={id}
                        valid={validIds.has(id)}
                        active={id === selectedSourceId}
                        onSelect={onSelectSource}
                      />
                    );
                  }
                  return (
                    <a href={href} {...props} target="_blank" rel="noreferrer">
                      {children}
                    </a>
                  );
                },
                table: ({ children }) => (
                  <div className="markdown-table-wrap">
                    <table>{children}</table>
                  </div>
                ),
              }}
            >
              {resp.answer}
            </ReactMarkdown>
          </div>
        )}

        {/* Sub-questions note if multi-step query */}
        {resp && resp.sub_questions && resp.sub_questions.length > 1 && (
          <div className="pt-2.5 border-t border-[#eaeaea] text-xs text-[#666666]">
            <span className="font-medium text-[#171717]">Research sub-topics addressed: </span>
            {resp.sub_questions.map((sq: { sub_question: string }, i: number) => (
              <span key={i} className="inline-block mr-2">
                • {sq.sub_question}
              </span>
            ))}
          </div>
        )}

        {/* Cross-document relations & Execution trace */}
        {resp && <RelationsBox relations={resp.relations ?? []} />}
        {resp && resp.trace?.length > 0 && (
          <div className="pt-2.5 border-t border-[#eaeaea] space-y-2">
            <button
              type="button"
              onClick={() => setShowTrace(!showTrace)}
              className="text-xs text-[#666666] hover:text-[#171717] font-medium transition-colors"
            >
              {showTrace ? "Hide" : "Show"} execution trace ({resp.trace.length} steps)
            </button>
            {showTrace && <TracePanel trace={resp.trace} />}
          </div>
        )}

        {/* Footer timestamp and latency */}
        <div className="pt-2 border-t border-[#eaeaea]/60 flex items-center justify-between text-[10px] font-mono text-[#7d7d7d]">
          <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          {resp && <span>Grounded across {Object.keys(resp.sources).length} citations · {(resp.latency_ms / 1000).toFixed(1)}s</span>}
        </div>
      </div>
    </div>
  );
}

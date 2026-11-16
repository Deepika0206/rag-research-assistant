import React from "react";
import { X, ExternalLink, BookmarkCheck } from "lucide-react";
import { CiteChip } from "../CiteChip";
import type { Source } from "../../lib/types";

interface Props {
  sources: Record<string, Source>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose?: () => void;
}

export function SourceList({ sources, selectedId, onSelect, onClose }: Props) {
  const ids = Object.keys(sources).sort((a, b) => Number(a) - Number(b));
  const activeSource = selectedId ? sources[selectedId] : null;

  return (
    <aside className="absolute inset-0 z-30 w-full shrink-0 border-l border-[#eaeaea] bg-white flex flex-col h-full overflow-hidden sm:relative sm:inset-auto sm:z-auto sm:w-80 lg:w-96">
      {/* Header */}
      <div className="p-3.5 border-b border-[#eaeaea] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookmarkCheck className="w-4 h-4 text-[#171717]" />
          <h3 className="text-xs font-semibold uppercase tracking-wider font-mono text-[#171717]">
            Cited Evidence ({ids.length})
          </h3>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[#7d7d7d] hover:text-[#171717]"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Sources badge row */}
      <div className="p-3 border-b border-[#eaeaea] bg-[#fafafa]">
        <div className="text-[11px] text-[#666666] mb-2">Select a citation badge to inspect chunk:</div>
        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
          {ids.map((id) => (
            <CiteChip key={id} id={id} active={id === selectedId} onSelect={onSelect} />
          ))}
        </div>
      </div>

      {/* Selected Chunk Content Reader */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {activeSource ? (
          <div>
            <div className="flex items-center justify-between text-[11px] font-mono text-[#666666] pb-2 border-b border-[#eaeaea]">
              <span className="font-semibold text-[#171717]">Source Chunk [{selectedId}]</span>
              <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-[#fafafa] border border-[#eaeaea]">
                {activeSource.topic}
              </span>
            </div>
            <div className="text-xs font-medium text-[#171717] mt-2 mb-1">
              Document: <span className="font-mono text-[#666666]">{activeSource.doc}</span>
            </div>
            <div className="mt-3 p-3 rounded-[8px] bg-[#fafafa] border border-[#eaeaea] text-xs font-mono text-[#171717] leading-relaxed whitespace-pre-wrap selection:bg-[#171717] selection:text-white">
              {activeSource.text}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-xs text-[#7d7d7d]">
            <p>Click any numbered citation badge like [1] in an answer to verify the cited textbook/coursework passage.</p>
          </div>
        )}
      </div>
    </aside>
  );
}

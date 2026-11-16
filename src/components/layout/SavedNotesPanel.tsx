import React, { useState } from "react";
import { Bookmark, Trash2, ExternalLink } from "lucide-react";
import type { SavedNote } from "../../types/conversation";
import { CiteChip } from "../CiteChip";

interface Props {
  notes: SavedNote[];
  onDeleteNote: (id: string) => void;
  onOpenConversation?: (convId: string) => void;
}

export function SavedNotesPanel({ notes, onDeleteNote, onOpenConversation }: Props) {
  const [selectedChunk, setSelectedChunk] = useState<{ id: string; text: string; doc: string } | null>(null);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#fafafa] overflow-hidden">
      <div className="bg-white border-b border-[#eaeaea] p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <Bookmark className="w-4 h-4 text-[#171717]" />
          <h2 className="text-base font-semibold text-[#171717] tracking-tight">Saved Findings &amp; Notes</h2>
        </div>
        <p className="text-xs text-[#666666] mt-0.5">
          Review saved research findings with their complete supporting source citations and evidence preserved.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {notes.length === 0 ? (
          <div className="max-w-md mx-auto text-center py-16 text-xs text-[#7d7d7d]">
            <Bookmark className="w-8 h-8 text-[#eaeaea] mx-auto mb-2" />
            <p className="font-medium text-[#171717]">No saved notes yet</p>
            <p className="mt-1">
              When reviewing an answer in Chat, click "Save Note" to preserve important findings alongside their cited evidence chunks.
            </p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-4">
            {notes.map((note) => {
              const srcKeys = Object.keys(note.sources || {});
              return (
                <div
                  key={note.id}
                  className="rounded-[12px] border border-[#eaeaea] bg-white p-5 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-[#171717]">{note.title}</h3>
                      <p className="text-[10px] font-mono text-[#7d7d7d] mt-0.5">
                        Saved {new Date(note.createdAt).toLocaleDateString()} at {new Date(note.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {note.conversationId && onOpenConversation && (
                        <button
                          type="button"
                          onClick={() => onOpenConversation(note.conversationId!)}
                          className="text-xs text-[#666666] hover:text-[#171717] flex items-center gap-1"
                        >
                          <span>Open chat</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onDeleteNote(note.id)}
                        className="p-1 text-[#7d7d7d] hover:text-rose-600 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="text-xs sm:text-sm text-[#171717] leading-relaxed whitespace-pre-line bg-[#fafafa] p-3 rounded-[8px] border border-[#eaeaea]/80">
                    {note.content}
                  </div>

                  {srcKeys.length > 0 && (
                    <div className="pt-2 border-t border-[#eaeaea]">
                      <div className="text-[11px] font-mono text-[#666666] mb-1.5">
                        Preserved Source Citations ({srcKeys.length}):
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {srcKeys.map((cid) => {
                          const src = note.sources[cid];
                          return (
                            <button
                              key={cid}
                              type="button"
                              onClick={() => setSelectedChunk({ id: cid, text: src.text, doc: src.doc })}
                              className="text-xs px-2 py-0.5 rounded-[9999px] border border-[#eaeaea] bg-white text-[#171717] hover:border-[#171717] transition-colors"
                            >
                              [{cid}] {src.doc}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal / Inspector for selected chunk */}
      {selectedChunk && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-[12px] bg-white p-5 border border-[#eaeaea] shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#eaeaea]">
              <span className="text-xs font-semibold text-[#171717]">
                Citation Chunk [{selectedChunk.id}] — {selectedChunk.doc}
              </span>
              <button
                type="button"
                onClick={() => setSelectedChunk(null)}
                className="text-xs font-medium text-[#666666] hover:text-[#171717]"
              >
                Close
              </button>
            </div>
            <pre className="text-xs font-mono text-[#171717] bg-[#fafafa] p-3 rounded-[8px] border border-[#eaeaea] whitespace-pre-wrap max-h-80 overflow-y-auto">
              {selectedChunk.text}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

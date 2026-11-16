import React, { useRef, useEffect, useState } from "react";
import { MessageSquare, BookOpen, Loader2, Bookmark } from "lucide-react";
import type { Conversation } from "../../types/conversation";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { SourceList } from "./SourceList";
import type {
  CollectionRecord,
  SearchScope,
  Source,
  UploadDocumentsResponse,
} from "../../lib/types";

interface Props {
  conversation: Conversation | null;
  loading: boolean;
  topics: string[];
  collections: CollectionRecord[];
  defaultCollectionId: string | null;
  documentCount: number;
  searchScope: SearchScope;
  onSelectScope: (scope: SearchScope) => void;
  onSubmitQuestion: (question: string) => void;
  onUploadDocuments: (
    files: File[],
    options?: {
      collectionId?: string | null;
      subsectionId?: string | null;
      onProgress?: (pct: number) => void;
    }
  ) => Promise<UploadDocumentsResponse>;
  onSaveAsNote: (title: string, content: string, sources: any, citations?: number[]) => void;
  onShareRun: (runId: string) => void;
  onAssignCollection: (colId?: string) => void;
  onOpenLibrary: () => void;
}

export function ChatWindow({
  conversation,
  loading,
  topics,
  collections,
  defaultCollectionId,
  documentCount,
  searchScope,
  onSelectScope,
  onSubmitQuestion,
  onUploadDocuments,
  onSaveAsNote,
  onShareRun,
  onOpenLibrary,
}: Props) {
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [showSourcesPanel, setShowSourcesPanel] = useState<boolean>(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Collect all sources present in current conversation messages
  const allSources: Record<string, Source> = {};
  conversation?.messages.forEach((m) => {
    if (m.response?.sources) {
      Object.assign(allSources, m.response.sources);
    }
  });

  const hasSources = Object.keys(allSources).length > 0;

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation?.messages, loading]);

  const handleSelectSource = (id: string) => {
    setSelectedSourceId(id);
    setShowSourcesPanel(true);
  };

  const currentCollection = collections.find((c) => c.id === conversation?.collectionId);

  return (
    <div className="relative flex-1 flex h-full min-w-0 overflow-hidden bg-[#fafafa]">
      {/* Main chat column */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {/* Chat Header Bar */}
        <div className="h-12 border-b border-[#eaeaea] bg-white px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold text-[#171717] truncate">
              {conversation?.title || "New Research Chat"}
            </span>
            {currentCollection && (
              <span className="text-[11px] font-mono text-[#666666] shrink-0">
                · {currentCollection.name}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {hasSources && (
              <button
                type="button"
                onClick={() => setShowSourcesPanel(!showSourcesPanel)}
                className={`text-xs px-2.5 py-1 rounded-[6px] border transition-colors flex items-center gap-1.5 ${
                  showSourcesPanel
                    ? "bg-[#171717] text-white border-[#171717]"
                    : "bg-white text-[#666666] border-[#eaeaea] hover:text-[#171717]"
                }`}
              >
                <Bookmark className="w-3 h-3" />
                <span>Evidence ({Object.keys(allSources).length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Message history scroll area */}
        <div ref={scrollRef} className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 space-y-4">
          {!conversation || conversation.messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-12 px-4 space-y-4">
              <div className="w-10 h-10 rounded-full bg-white border border-[#eaeaea] flex items-center justify-center text-[#171717] shadow-xs">
                <MessageSquare className="w-5 h-5 text-[#171717]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#171717] tracking-tight">
                  Algorithmic Research Assistant
                </h3>
                <p className="text-xs text-[#666666] mt-1 leading-relaxed">
                  Ask single-hop or multi-topic questions over your private DSA course notes and uploaded documents. Every claim cites a source chunk and is checked by a Critic.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={onOpenLibrary}
                  className="inline-flex items-center gap-1.5 text-xs text-[#171717] bg-white border border-[#eaeaea] px-3 py-1.5 rounded-[8px] hover:border-[#171717] transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Browse Library ({documentCount > 0 ? `${documentCount} docs` : "47 notes"})</span>
                </button>
              </div>
            </div>
          ) : (
            conversation.messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                selectedSourceId={selectedSourceId}
                onSelectSource={handleSelectSource}
                onSaveAsNote={onSaveAsNote}
                onShareRun={onShareRun}
              />
            ))
          )}

          {/* Loading indicator */}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-[#666666] bg-white border border-[#eaeaea] p-3 rounded-[12px] max-w-md shadow-xs animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-[#171717]" />
              <span>Searching corpus notes and synthesizing verified citations...</span>
            </div>
          )}
        </div>

        {/* Chat input footer */}
        <ChatInput
          loading={loading}
          topics={topics}
          collections={collections}
          defaultCollectionId={defaultCollectionId}
          searchScope={searchScope}
          onSelectScope={onSelectScope}
          onSubmit={onSubmitQuestion}
          onUploadDocuments={onUploadDocuments}
        />
      </div>

      {/* Slide-out or side-by-side Evidence Source Inspector */}
      {showSourcesPanel && hasSources && (
        <SourceList
          sources={allSources}
          selectedId={selectedSourceId}
          onSelect={setSelectedSourceId}
          onClose={() => setShowSourcesPanel(false)}
        />
      )}
    </div>
  );
}

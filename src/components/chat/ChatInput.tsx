import React, { useEffect, useRef, useState } from "react";
import {
  Send,
  Plus,
  Paperclip,
  X,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
} from "lucide-react";
import type {
  CollectionRecord,
  SearchScope,
  UploadDocumentsResponse,
} from "../../lib/types";

interface Props {
  loading: boolean;
  topics: string[];
  collections: CollectionRecord[];
  defaultCollectionId: string | null;
  searchScope: SearchScope;
  onSelectScope: (scope: SearchScope) => void;
  onSubmit: (question: string) => void;
  onUploadDocuments: (
    files: File[],
    options?: {
      collectionId?: string | null;
      subsectionId?: string | null;
      onProgress?: (pct: number) => void;
    }
  ) => Promise<UploadDocumentsResponse>;
}

const QUICK_SUGGESTIONS = [
  "What is the time complexity of binary search?",
  "Compare sliding window and two-pointer across my notes. Which topics use both?",
  "Explain how Floyd-Warshall detects negative cycles.",
  "Compare binary search with the Aho-Corasick algorithm.",
];

const ACCEPTED_TYPES = ".pdf,.docx,.doc,.txt,.md";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function fileExtensionLabel(name: string): string {
  const parts = name.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : "FILE";
}

function encodeScopeValue(scope: SearchScope): string {
  if (scope.kind === "topic") return `topic:${scope.topic}`;
  if (scope.kind === "collection") return `col:${scope.collectionId}`;
  if (scope.kind === "subsection") return `sub:${scope.collectionId}:${scope.subsectionId}`;
  return "all";
}

export function ChatInput({
  loading,
  topics,
  collections,
  defaultCollectionId,
  searchScope,
  onSelectScope,
  onSubmit,
  onUploadDocuments,
}: Props) {
  const [text, setText] = useState("");
  const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
  const [destCollectionId, setDestCollectionId] = useState<string>("");
  const [destSubsectionId, setDestSubsectionId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync default upload destination with active chat scope or default collection
  useEffect(() => {
    if (searchScope.kind === "collection") {
      setDestCollectionId(searchScope.collectionId);
      setDestSubsectionId("");
    } else if (searchScope.kind === "subsection") {
      setDestCollectionId(searchScope.collectionId);
      setDestSubsectionId(searchScope.subsectionId);
    } else if (!destCollectionId && defaultCollectionId) {
      setDestCollectionId(defaultCollectionId);
    }
  }, [searchScope, defaultCollectionId]);

  const selectedCollectionObj = collections.find((c) => c.id === destCollectionId) || null;
  const availableSubsections = selectedCollectionObj?.subsections || [];

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (loading || !text.trim() || text.trim().length < 3) return;
    onSubmit(text.trim());
    setText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const addFiles = (incoming: File[]) => {
    if (!incoming.length) return;
    setUploadStatus(null);
    setQueuedFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}:${f.size}`));
      const unique = incoming.filter((f) => !seen.has(`${f.name}:${f.size}`));
      return [...prev, ...unique];
    });
  };

  const removeQueuedFile = (idx: number) => {
    setQueuedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUploadNow = async () => {
    if (!queuedFiles.length || uploading) return;
    setUploading(true);
    setUploadProgress(5);
    setUploadStatus(null);
    try {
      const res = await onUploadDocuments(queuedFiles, {
        collectionId: destCollectionId || defaultCollectionId || null,
        subsectionId: destSubsectionId || null,
        onProgress: setUploadProgress,
      });
      const chunksTotal = res.uploaded.reduce((acc, d) => acc + (d.chunk_count || 0), 0);
      const destLabel = selectedCollectionObj
        ? destSubsectionId
          ? `${selectedCollectionObj.name} / ${
              availableSubsections.find((s) => s.id === destSubsectionId)?.name || ""
            }`
          : selectedCollectionObj.name
        : "Unassigned Library";

      if (res.errors.length > 0 && res.uploaded.length > 0) {
        setUploadStatus({
          ok: true,
          message: `Indexed ${res.uploaded.length} file(s) (${chunksTotal} chunks) into ${destLabel}. Failed: ${res.errors[0].filename} (${res.errors[0].error})`,
        });
      } else {
        setUploadStatus({
          ok: true,
          message: `Uploaded & indexed ${res.uploaded.length} document${res.uploaded.length === 1 ? "" : "s"} (${chunksTotal} chunks) into ${destLabel}.`,
        });
      }
      setQueuedFiles([]);
    } catch (err) {
      setUploadStatus({
        ok: false,
        message: err instanceof Error ? err.message : "Failed to upload and index documents.",
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleScopeSelectChange = (val: string) => {
    if (val === "all") {
      onSelectScope({ kind: "all" });
      return;
    }
    if (val.startsWith("topic:")) {
      onSelectScope({ kind: "topic", topic: val.slice("topic:".length) });
      return;
    }
    if (val.startsWith("col:")) {
      const colId = val.slice("col:".length);
      const col = collections.find((c) => c.id === colId);
      if (col) onSelectScope({ kind: "collection", collectionId: col.id, name: col.name });
      return;
    }
    if (val.startsWith("sub:")) {
      const [, colId, subId] = val.split(":");
      const col = collections.find((c) => c.id === colId);
      const sub = col?.subsections.find((s) => s.id === subId);
      if (col && sub) {
        onSelectScope({
          kind: "subsection",
          collectionId: col.id,
          subsectionId: sub.id,
          name: `${col.name} / ${sub.name}`,
        });
      }
    }
  };

  return (
    <div className="border-t border-[#eaeaea] bg-white p-3 sm:p-4">
      <div className="max-w-4xl mx-auto space-y-2.5">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_TYPES}
          className="hidden"
          onChange={(e) => {
            addFiles(Array.from(e.target.files || []));
            e.target.value = "";
          }}
        />

        {/* Scope selector and keyboard hint */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[#666666]">Scope:</span>
            <select
              value={encodeScopeValue(searchScope)}
              onChange={(e) => handleScopeSelectChange(e.target.value)}
              className="text-xs rounded-[6px] border border-[#eaeaea] bg-[#fafafa] px-2 py-0.5 text-[#171717] focus:outline-none focus:border-[#171717] max-w-[260px]"
            >
              <option value="all">Entire Corpus (All Documents)</option>
              {collections.length > 0 && (
                <optgroup label="Collections & Folders">
                  {collections.map((c) => (
                    <React.Fragment key={c.id}>
                      <option value={`col:${c.id}`}>
                        Collection: {c.name} ({c.doc_count})
                      </option>
                      {c.subsections.map((s) => (
                        <option key={s.id} value={`sub:${c.id}:${s.id}`}>
                          &nbsp;&nbsp;{c.name} / {s.name} ({s.doc_count})
                        </option>
                      ))}
                    </React.Fragment>
                  ))}
                </optgroup>
              )}
              {topics.length > 0 && (
                <optgroup label="Topics">
                  {topics.map((t) => (
                    <option key={t} value={`topic:${t}`}>
                      Topic: {t}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          <span className="text-[11px] font-mono text-[#7d7d7d] hidden sm:inline">
            Return to send · Shift+Return for new line · Drop files to upload
          </span>
        </div>

        {/* Upload feedback notification */}
        {uploadStatus && (
          <div
            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-[8px] border text-xs ${
              uploadStatus.ok
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-rose-50 border-rose-200 text-rose-900"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {uploadStatus.ok ? (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="truncate sm:whitespace-normal">{uploadStatus.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setUploadStatus(null)}
              className="p-0.5 hover:opacity-70 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Selected files queue & destination selector */}
        {queuedFiles.length > 0 && (
          <div className="rounded-[10px] border border-[#eaeaea] bg-[#fafafa] p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-[#171717]">
                Ready to upload ({queuedFiles.length} file{queuedFiles.length === 1 ? "" : "s"})
              </span>
              <button
                type="button"
                onClick={() => setQueuedFiles([])}
                disabled={uploading}
                className="text-[11px] text-[#666666] hover:text-[#171717]"
              >
                Clear all
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {queuedFiles.map((f, idx) => (
                <div
                  key={`${f.name}-${idx}`}
                  className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[6px] border border-[#eaeaea] bg-white text-xs max-w-full"
                >
                  <FileText className="w-3.5 h-3.5 text-[#666666] shrink-0" />
                  <span className="font-medium text-[#171717] truncate max-w-[160px]">{f.name}</span>
                  <span className="text-[11px] font-mono text-[#7d7d7d] tabular-nums shrink-0">
                    {fileExtensionLabel(f.name)} · {formatFileSize(f.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeQueuedFile(idx)}
                    disabled={uploading}
                    aria-label={`Remove ${f.name}`}
                    className="p-0.5 text-[#7d7d7d] hover:text-rose-700"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>

            {/* Destination collection + optional subsection selector */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-[#eaeaea]">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-[#666666]">Save to:</span>
                <select
                  aria-label="Destination collection"
                  value={destCollectionId}
                  onChange={(e) => {
                    setDestCollectionId(e.target.value);
                    setDestSubsectionId("");
                  }}
                  disabled={uploading}
                  className="text-xs rounded-[6px] border border-[#eaeaea] bg-white px-2 py-1 text-[#171717] focus:outline-none focus:border-[#171717]"
                >
                  <option value="">Unassigned Library (Default)</option>
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                {availableSubsections.length > 0 && (
                  <select
                    aria-label="Destination subsection"
                    value={destSubsectionId}
                    onChange={(e) => setDestSubsectionId(e.target.value)}
                    disabled={uploading}
                    className="text-xs rounded-[6px] border border-[#eaeaea] bg-white px-2 py-1 text-[#171717] focus:outline-none focus:border-[#171717]"
                  >
                    <option value="">Collection Root (Optional Folder)</option>
                    {availableSubsections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <button
                type="button"
                onClick={handleUploadNow}
                disabled={uploading}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[#171717] text-white text-xs font-medium hover:bg-black disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>
                      {uploadProgress < 100
                        ? `Uploading ${uploadProgress}%...`
                        : "Indexing chunks..."}
                    </span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload &amp; Index</span>
                  </>
                )}
              </button>
            </div>

            {uploading && (
              <div className="w-full h-1.5 rounded bg-[#eaeaea] overflow-hidden">
                <div
                  className="h-full bg-[#171717] transition-all duration-200"
                  style={{ width: `${Math.max(8, uploadProgress)}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Input Textarea container with [+ Upload] immediately left of [Send] */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            addFiles(Array.from(e.dataTransfer.files || []));
          }}
          className={`rounded-[12px] border transition-all shadow-xs ${
            dragOver
              ? "border-[#171717] bg-white ring-1 ring-[#171717]"
              : "border-[#eaeaea] bg-[#fafafa] focus-within:border-[#171717] focus-within:bg-white"
          }`}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a research question over your algorithmic notes..."
            rows={2}
            maxLength={500}
            disabled={loading}
            className="w-full resize-none px-3 pt-3 pb-1 text-xs sm:text-sm text-[#171717] placeholder:text-[#7d7d7d] bg-transparent focus:outline-none"
          />

          <div className="px-2.5 pb-2.5 flex items-center justify-between gap-2">
            <span className="text-[11px] text-[#7d7d7d] px-1 hidden sm:inline">
              PDF, DOCX, DOC, TXT, MD supported
            </span>

            {/* Upload (+) immediately to the LEFT of Send */}
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                title="Upload documents (.pdf, .docx, .doc, .txt, .md)"
                aria-label="Upload documents"
                className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[8px] border border-[#eaeaea] bg-white text-xs font-medium text-[#171717] hover:border-[#171717] hover:bg-[#fafafa] transition-colors disabled:opacity-40 whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <Paperclip className="w-3 h-3 text-[#666666]" />
                <span>Upload</span>
              </button>

              <button
                type="button"
                onClick={() => handleSubmit()}
                disabled={loading || text.trim().length < 3}
                aria-label="Send question"
                className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-[8px] bg-[#171717] text-white text-xs font-medium hover:bg-black disabled:opacity-30 disabled:hover:bg-[#171717] transition-all whitespace-nowrap shrink-0"
              >
                <span>Send</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Quick prompt suggestions when empty */}
        {!text && queuedFiles.length === 0 && (
          <div className="hidden sm:flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#7d7d7d]">
              Suggested:
            </span>
            {QUICK_SUGGESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setText(q)}
                className="text-[11px] px-2 py-0.5 rounded-[6px] border border-[#eaeaea] bg-white text-[#666666] hover:text-[#171717] hover:border-[#171717] transition-colors truncate max-w-[280px]"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

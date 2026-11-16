import React, { useEffect, useRef, useState } from "react";
import {
  Search,
  ExternalLink,
  BookOpen,
  Hash,
  ArrowRight,
  Upload,
  Trash2,
  MoreHorizontal,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  FolderOpen,
  X,
} from "lucide-react";
import { CORPUS_DOCUMENTS, CORPUS_TOPICS } from "../../lib/corpusData";
import { fetchDocumentDetailApi } from "../../lib/api";
import type { CorpusDocument } from "../../types/conversation";
import type {
  CollectionRecord,
  DocumentRecord,
  SearchScope,
  UploadDocumentsResponse,
} from "../../lib/types";
import { SimpleConfirmModal } from "../modals/ConfirmModal";

interface Props {
  collections: CollectionRecord[];
  documents: DocumentRecord[];
  selectedCollectionId: string | null;
  selectedSubsectionId: string | null;
  loading?: boolean;
  backendError?: string | null;
  onSelectScope: (collectionId: string | null, subsectionId?: string | null) => void;
  onUploadDocuments: (
    files: File[],
    options?: {
      collectionId?: string | null;
      subsectionId?: string | null;
      onProgress?: (pct: number) => void;
    }
  ) => Promise<UploadDocumentsResponse>;
  onDeleteDocument: (docId: number) => Promise<unknown>;
  requestedDocumentId: number | null;
  onDocumentOpened: () => void;
  onAskQuestion: (query: string, topic?: string) => void;
  onAskInScope: (scope: SearchScope) => void;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso?: string | null): string {
  if (!iso) return "Corpus";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export function LibraryPanel({
  collections,
  documents,
  selectedCollectionId,
  selectedSubsectionId,
  loading = false,
  backendError = null,
  onSelectScope,
  onUploadDocuments,
  onDeleteDocument,
  requestedDocumentId,
  onDocumentOpened,
  onAskQuestion,
  onAskInScope,
}: Props) {
  const [viewMode, setViewMode] = useState<"documents" | "corpus">("documents");
  const [search, setSearch] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<string>("all");

  // Document detail state
  const [activeDoc, setActiveDoc] = useState<DocumentRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeCorpusDoc, setActiveCorpusDoc] = useState<CorpusDocument | null>(
    CORPUS_DOCUMENTS[0] || null
  );

  // Upload state inside Library
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadNotice, setUploadNotice] = useState<{ ok: boolean; text: string } | null>(null);

  // Delete confirmation
  const [docToDelete, setDocToDelete] = useState<DocumentRecord | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [openDocMenuId, setOpenDocMenuId] = useState<number | null>(null);

  // Switch automatically to live documents view when a collection or subsection is clicked in sidebar
  useEffect(() => {
    if (selectedCollectionId || selectedSubsectionId) {
      setViewMode("documents");
    }
  }, [selectedCollectionId, selectedSubsectionId]);

  const activeCollection = collections.find((c) => c.id === selectedCollectionId) || null;
  const activeSubsection =
    activeCollection?.subsections.find((s) => s.id === selectedSubsectionId) || null;

  const scopedDocs = documents.filter((doc) => {
    if (selectedSubsectionId && doc.subsection_id !== selectedSubsectionId) return false;
    if (selectedCollectionId && !selectedSubsectionId && doc.collection_id !== selectedCollectionId)
      return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      doc.title.toLowerCase().includes(q) ||
      doc.filename.toLowerCase().includes(q) ||
      doc.topic.toLowerCase().includes(q) ||
      doc.path.toLowerCase().includes(q)
    );
  });

  // Sync active document selection cleanly
  useEffect(() => {
    if (!scopedDocs.length) {
      setActiveDoc(null);
      return;
    }
    if (!activeDoc || !scopedDocs.some((d) => d.id === activeDoc.id)) {
      setActiveDoc(scopedDocs[0]);
    }
  }, [scopedDocs.length, selectedCollectionId, selectedSubsectionId]);

  const handleSelectDoc = async (doc: DocumentRecord) => {
    setActiveDoc(doc);
    setDetailLoading(true);
    try {
      const detail = await fetchDocumentDetailApi(doc.id);
      setActiveDoc(detail);
    } catch {
      // Keep summary record if detail fetch fails
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (!requestedDocumentId) return;
    const doc = documents.find((item) => item.id === requestedDocumentId);
    if (!doc) return;
    if (
      (selectedSubsectionId && doc.subsection_id !== selectedSubsectionId) ||
      (selectedCollectionId && !selectedSubsectionId && doc.collection_id !== selectedCollectionId)
    ) {
      return;
    }
    setSearch("");
    void handleSelectDoc(doc);
    onDocumentOpened();
  }, [requestedDocumentId, documents, selectedCollectionId, selectedSubsectionId, onDocumentOpened]);

  const handleUploadFiles = async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    setUploadProgress(5);
    setUploadNotice(null);
    try {
      const res = await onUploadDocuments(files, {
        collectionId: selectedCollectionId,
        subsectionId: selectedSubsectionId,
        onProgress: setUploadProgress,
      });
      const totalChunks = res.uploaded.reduce((sum, d) => sum + (d.chunk_count || 0), 0);
      if (res.errors.length > 0 && res.uploaded.length > 0) {
        setUploadNotice({
          ok: true,
          text: `Indexed ${res.uploaded.length} document(s) (${totalChunks} chunks). ${res.errors.length} failed: ${res.errors[0].filename} (${res.errors[0].error})`,
        });
      } else {
        setUploadNotice({
          ok: true,
          text: `Indexed ${res.uploaded.length} document${res.uploaded.length === 1 ? "" : "s"} (${totalChunks} chunks) and added to search index.`,
        });
      }
      if (res.uploaded[0]) {
        handleSelectDoc(res.uploaded[0]);
      }
    } catch (err) {
      setUploadNotice({
        ok: false,
        text: err instanceof Error ? err.message : "Failed to upload documents.",
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const filteredCorpusDocs = CORPUS_DOCUMENTS.filter((doc) => {
    if (selectedTopic !== "all" && doc.topic !== selectedTopic) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      doc.title.toLowerCase().includes(q) ||
      doc.summary.toLowerCase().includes(q) ||
      doc.path.toLowerCase().includes(q)
    );
  });

  const breadcrumbLabel = activeSubsection
    ? `${activeCollection?.name || "Collection"} / ${activeSubsection.name}`
    : activeCollection
      ? activeCollection.name
      : "All Indexed Documents";

  const currentSearchScope: SearchScope = activeSubsection && activeCollection
    ? {
        kind: "subsection",
        collectionId: activeCollection.id,
        subsectionId: activeSubsection.id,
        name: `${activeCollection.name} / ${activeSubsection.name}`,
      }
    : activeCollection
      ? {
          kind: "collection",
          collectionId: activeCollection.id,
          name: activeCollection.name,
        }
      : { kind: "all" };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#fafafa] overflow-hidden">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.doc,.txt,.md"
        className="hidden"
        onChange={(e) => {
          const picked = Array.from(e.target.files || []);
          e.target.value = "";
          handleUploadFiles(picked);
        }}
      />

      {/* Top Banner */}
      <div className="bg-white border-b border-[#eaeaea] p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              {selectedCollectionId ? (
                <FolderOpen className="w-4 h-4 text-[#171717]" />
              ) : (
                <BookOpen className="w-4 h-4 text-[#171717]" />
              )}
              <h2 className="text-base font-semibold text-[#171717] tracking-tight">
                {viewMode === "documents" ? breadcrumbLabel : "Built-in Corpus Reference"}
              </h2>
            </div>
            <p className="text-xs text-[#666666] mt-0.5">
              {viewMode === "documents"
                ? "Upload, inspect, and manage documents indexed in pgvector + BM25 for RAG retrieval."
                : `Browse the ${CORPUS_DOCUMENTS.length} reference algorithmic study notes.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Segmented switch between live DB documents and built-in reference notes */}
            <div className="flex items-center gap-1 p-0.5 rounded-[8px] bg-[#fafafa] border border-[#eaeaea]">
              <button
                type="button"
                onClick={() => setViewMode("documents")}
                className={`px-2.5 py-1 text-xs font-medium rounded-[6px] transition-colors whitespace-nowrap shrink-0 ${
                  viewMode === "documents"
                    ? "bg-white text-[#171717] shadow-xs"
                    : "text-[#666666] hover:text-[#171717]"
                }`}
              >
                Collections &amp; Uploads ({documents.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode("corpus")}
                className={`px-2.5 py-1 text-xs font-medium rounded-[6px] transition-colors whitespace-nowrap shrink-0 ${
                  viewMode === "corpus"
                    ? "bg-white text-[#171717] shadow-xs"
                    : "text-[#666666] hover:text-[#171717]"
                }`}
              >
                Reference ({CORPUS_DOCUMENTS.length})
              </button>
            </div>

            {viewMode === "documents" && (
              <>
                <button
                  type="button"
                  onClick={() => onAskInScope(currentSearchScope)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[#eaeaea] bg-white text-xs font-medium text-[#171717] hover:border-[#171717] transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Ask in Scope</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[#171717] text-white text-xs font-medium hover:bg-black transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  {uploading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  <span>{uploading ? `Uploading ${uploadProgress}%` : "Upload Documents"}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-3.5 h-3.5 text-[#7d7d7d] absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                viewMode === "documents"
                  ? "Filter documents by title, filename, or topic..."
                  : "Filter topics, algorithms, concepts..."
              }
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-[8px] border border-[#eaeaea] bg-[#fafafa] text-[#171717] placeholder:text-[#7d7d7d] focus:outline-none focus:border-[#171717] focus:bg-white"
            />
          </div>

          {viewMode === "documents" ? (
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => onSelectScope(null, null)}
                className={`px-2.5 py-1 rounded-[6px] text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  !selectedCollectionId
                    ? "bg-[#171717] text-white"
                    : "bg-white text-[#666666] border border-[#eaeaea] hover:text-[#171717]"
                }`}
              >
                All Collections
              </button>
              {collections.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelectScope(c.id, null)}
                  className={`px-2.5 py-1 rounded-[6px] text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    selectedCollectionId === c.id && !selectedSubsectionId
                      ? "bg-[#171717] text-white"
                      : "bg-white text-[#666666] border border-[#eaeaea] hover:text-[#171717]"
                  }`}
                >
                  {c.name} ({c.doc_count})
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setSelectedTopic("all")}
                className={`px-3 py-1 rounded-[6px] text-xs font-medium transition-colors shrink-0 ${
                  selectedTopic === "all"
                    ? "bg-[#171717] text-white"
                    : "bg-white text-[#666666] border border-[#eaeaea] hover:text-[#171717]"
                }`}
              >
                All Topics
              </button>
              {CORPUS_TOPICS.map((top) => (
                <button
                  key={top}
                  type="button"
                  onClick={() => setSelectedTopic(top)}
                  className={`px-3 py-1 rounded-[6px] text-xs font-medium capitalize transition-colors shrink-0 ${
                    selectedTopic === top
                      ? "bg-[#171717] text-white"
                      : "bg-white text-[#666666] border border-[#eaeaea] hover:text-[#171717]"
                  }`}
                >
                  {top}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Upload Notice / Progress */}
        {uploadNotice && (
          <div
            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-[8px] border text-xs ${
              uploadNotice.ok
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-rose-50 border-rose-200 text-rose-900"
            }`}
          >
            <div className="flex items-center gap-2">
              {uploadNotice.ok ? (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>{uploadNotice.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setUploadNotice(null)}
              className="p-0.5 hover:opacity-70"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      {viewMode === "documents" ? (
        <div
          className="flex-1 flex flex-col md:flex-row overflow-hidden relative"
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const dropped = Array.from(e.dataTransfer.files || []);
            handleUploadFiles(dropped);
          }}
        >
          {dragOver && (
            <div className="absolute inset-0 z-30 bg-white/90 border-2 border-dashed border-[#171717] m-3 rounded-[12px] flex flex-col items-center justify-center gap-2 pointer-events-none">
              <Upload className="w-6 h-6 text-[#171717]" />
              <p className="text-sm font-semibold text-[#171717]">
                Drop files to upload into {breadcrumbLabel}
              </p>
              <p className="text-xs text-[#666666]">Supports PDF, DOCX, DOC, TXT, and MD</p>
            </div>
          )}

          {/* Document List */}
          <div className="w-full flex-1 min-h-0 md:flex-none md:w-1/2 lg:w-3/5 overflow-y-auto p-4 space-y-2 border-r border-[#eaeaea]">
            {backendError && documents.length === 0 ? (
              <div className="p-6 rounded-[12px] border border-amber-200 bg-amber-50/70 text-xs text-amber-900 space-y-1">
                <p className="font-semibold">Backend connection required</p>
                <p>{backendError}</p>
              </div>
            ) : loading && documents.length === 0 ? (
              <div className="p-8 flex items-center justify-center gap-2 text-xs text-[#666666]">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading collection documents...</span>
              </div>
            ) : scopedDocs.length === 0 ? (
              <div className="p-8 rounded-[12px] border border-dashed border-[#eaeaea] bg-white text-center space-y-3">
                <FileText className="w-6 h-6 text-[#7d7d7d] mx-auto" />
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-[#171717]">
                    No documents in {breadcrumbLabel}
                  </p>
                  <p className="text-xs text-[#666666]">
                    Upload PDF, DOCX, TXT, or Markdown notes here to index them for RAG search.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[#171717] text-white text-xs font-medium hover:bg-black"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Documents</span>
                </button>
              </div>
            ) : (
              scopedDocs.map((doc) => {
                const isSelected = activeDoc?.id === doc.id;
                return (
                  <div
                    key={doc.id}
                    onClick={() => {
                      setOpenDocMenuId(null);
                      void handleSelectDoc(doc);
                    }}
                    className={`group relative p-3.5 rounded-[12px] border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-white border-[#171717] shadow-xs"
                        : "bg-white border-[#eaeaea] hover:border-[#171717]/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#171717] truncate">
                          {doc.title || doc.filename}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#666666] mt-1 tabular-nums">
                          <span className="font-mono uppercase text-[#171717]">
                            {doc.file_type}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{formatBytes(doc.file_size)}</span>
                          <span aria-hidden="true">·</span>
                          <span>{formatDate(doc.created_at)}</span>
                          <span aria-hidden="true">·</span>
                          <span>{doc.chunk_count} chunks</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {doc.status === "indexed" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Indexed</span>
                          </span>
                        ) : doc.status === "processing" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Processing</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-700">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Failed</span>
                          </span>
                        )}

                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDocMenuId(openDocMenuId === doc.id ? null : doc.id);
                            }}
                            title="Document options"
                            aria-label={`Options for ${doc.filename}`}
                            aria-haspopup="menu"
                            aria-expanded={openDocMenuId === doc.id}
                            className="p-1 rounded text-[#7d7d7d] hover:text-[#171717] hover:bg-[#fafafa] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#171717]"
                          >
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </button>
                          {openDocMenuId === doc.id && (
                            <div
                              role="menu"
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") setOpenDocMenuId(null);
                              }}
                              className="absolute right-0 top-7 z-40 w-44 rounded-[8px] border border-[#eaeaea] bg-white p-1 text-[#171717] shadow-lg"
                            >
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setOpenDocMenuId(null);
                                  void handleSelectDoc(doc);
                                }}
                                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-[#fafafa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#171717]"
                              >
                                <FileText className="h-3 w-3 text-[#666666]" />
                                View Document
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setOpenDocMenuId(null);
                                  setDeleteError(null);
                                  setDocToDelete(doc);
                                }}
                                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-rose-700 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
                              >
                                <Trash2 className="h-3 w-3" />
                                Delete Document
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {(doc.collection_name || doc.subsection_name) && (
                      <div className="mt-2 pt-2 border-t border-[#eaeaea]/60 text-[11px] text-[#666666] flex items-center justify-between">
                        <span className="truncate">
                          {doc.collection_name || "Unassigned"}
                          {doc.subsection_name ? ` / ${doc.subsection_name}` : ""}
                        </span>
                        <span className="font-mono text-[10px] text-[#7d7d7d] truncate max-w-[180px]">
                          {doc.filename}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Right Document Detail Inspector */}
          <div className="w-full flex-1 min-h-0 md:flex-none md:w-1/2 lg:w-2/5 overflow-y-auto p-4 sm:p-6 bg-white">
            {activeDoc ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-[#171717]">
                      {activeDoc.title || activeDoc.filename}
                    </h3>
                    <p className="text-xs font-mono text-[#7d7d7d] mt-0.5 break-all">
                      {activeDoc.filename}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDocToDelete(activeDoc)}
                    className="px-2.5 py-1 rounded-[6px] border border-rose-200 text-rose-700 text-xs font-medium hover:bg-rose-50 shrink-0"
                  >
                    Delete
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs p-3.5 rounded-[8px] bg-[#fafafa] border border-[#eaeaea] tabular-nums">
                  <div>
                    <div className="text-[#7d7d7d]">File Type</div>
                    <div className="font-mono font-medium uppercase text-[#171717]">
                      {activeDoc.file_type}
                    </div>
                  </div>
                  <div>
                    <div className="text-[#7d7d7d]">Status</div>
                    <div className="font-medium capitalize text-[#171717]">{activeDoc.status}</div>
                  </div>
                  <div>
                    <div className="text-[#7d7d7d]">Indexed Chunks</div>
                    <div className="font-mono font-medium text-[#171717]">
                      {activeDoc.chunk_count}
                    </div>
                  </div>
                  <div>
                    <div className="text-[#7d7d7d]">Uploaded</div>
                    <div className="font-medium text-[#171717]">
                      {formatDate(activeDoc.created_at)}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-[#7d7d7d]">Destination</div>
                    <div className="font-medium text-[#171717]">
                      {activeDoc.collection_name || "Corpus / Unassigned"}
                      {activeDoc.subsection_name ? ` / ${activeDoc.subsection_name}` : ""}
                    </div>
                  </div>
                </div>

                {activeDoc.error_message && (
                  <div className="p-3 rounded-[8px] border border-rose-200 bg-rose-50 text-xs text-rose-800">
                    {activeDoc.error_message}
                  </div>
                )}

                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-[#171717]">
                    Indexed Chunks Preview
                  </h4>
                  {detailLoading ? (
                    <div className="flex items-center gap-2 text-xs text-[#666666] py-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Loading chunks...</span>
                    </div>
                  ) : activeDoc.chunks && activeDoc.chunks.length > 0 ? (
                    <div className="space-y-2">
                      {activeDoc.chunks.map((c) => (
                        <div
                          key={c.chunk_id}
                          className="p-3 rounded-[8px] border border-[#eaeaea] bg-[#fafafa] text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between text-[11px] font-mono text-[#7d7d7d] tabular-nums">
                            <span>Chunk #{c.chunk_index + 1} (ID {c.chunk_id})</span>
                            <span>{c.n_tokens} tokens</span>
                          </div>
                          <p className="text-[#171717] leading-relaxed whitespace-pre-wrap line-clamp-5">
                            {c.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#7d7d7d]">
                      Select a document to preview indexed chunks.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-[#7d7d7d]">
                Select a document to inspect details and indexed chunks.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Built-in Reference Corpus View (Preserved) */
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          <div className="w-full md:w-1/2 lg:w-3/5 overflow-y-auto p-4 space-y-2 border-r border-[#eaeaea]">
            {filteredCorpusDocs.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#7d7d7d]">
                No documents match your filter.
              </div>
            ) : (
              filteredCorpusDocs.map((doc) => {
                const isSelected = activeCorpusDoc?.id === doc.id;
                return (
                  <div
                    key={doc.id}
                    onClick={() => setActiveCorpusDoc(doc)}
                    className={`p-3.5 rounded-[12px] border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-white border-[#171717] shadow-sm"
                        : "bg-white border-[#eaeaea] hover:border-[#171717]/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[#171717] tracking-tight">
                        {doc.title}
                      </span>
                      <span className="text-[10px] font-mono uppercase text-[#666666]">
                        {doc.topic}
                      </span>
                    </div>
                    <p className="text-xs text-[#666666] mt-1 line-clamp-2 leading-relaxed">
                      {doc.summary}
                    </p>
                    <div className="mt-2.5 pt-2 border-t border-[#eaeaea]/60 flex items-center justify-between text-[11px]">
                      <span className="font-mono text-[#7d7d7d] text-[10px] truncate max-w-[200px]">
                        {doc.path}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAskQuestion(doc.sampleQuery, doc.topic);
                        }}
                        className="inline-flex items-center gap-1 text-[#171717] hover:underline font-medium"
                      >
                        <span>Ask question</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="w-full md:w-1/2 lg:w-2/5 overflow-y-auto p-4 sm:p-6 bg-white hidden md:block">
            {activeCorpusDoc ? (
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#666666]">
                    {activeCorpusDoc.topic}
                  </span>
                  <h3 className="text-sm font-semibold text-[#171717] mt-1">
                    {activeCorpusDoc.title}
                  </h3>
                  <p className="text-xs font-mono text-[#7d7d7d] mt-0.5">
                    Path: {activeCorpusDoc.path}
                  </p>
                </div>

                <div className="p-3.5 rounded-[8px] bg-[#fafafa] border border-[#eaeaea] text-xs text-[#171717] leading-relaxed">
                  <h4 className="font-semibold mb-1">Document Synopsis</h4>
                  <p className="text-[#666666]">{activeCorpusDoc.summary}</p>
                </div>

                <div className="p-3.5 rounded-[8px] border border-[#eaeaea] space-y-2">
                  <h4 className="text-xs font-semibold text-[#171717] flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-[#7d7d7d]" />
                    <span>Suggested Research Question</span>
                  </h4>
                  <p className="text-xs text-[#171717] italic">"{activeCorpusDoc.sampleQuery}"</p>
                  <button
                    type="button"
                    onClick={() => onAskQuestion(activeCorpusDoc.sampleQuery, activeCorpusDoc.topic)}
                    className="w-full mt-2 flex items-center justify-center gap-1.5 py-1.5 rounded-[6px] bg-[#171717] text-white text-xs font-medium hover:bg-[#262626] transition-colors"
                  >
                    <span>Query this topic in chat</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-[#7d7d7d]">
                Select a document to inspect details.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Document Confirmation Modal */}
      {docToDelete && (
        <SimpleConfirmModal
          title="Delete Document"
          description={`Delete "${docToDelete.filename}"? This will permanently remove the document and all ${docToDelete.chunk_count} indexed chunks from the search index.`}
          confirmLabel="Delete Document"
          busy={deleteBusy}
          error={deleteError}
          onCancel={() => {
            setDocToDelete(null);
            setDeleteError(null);
          }}
          onConfirm={async () => {
            setDeleteBusy(true);
            setDeleteError(null);
            try {
              await onDeleteDocument(docToDelete.id);
              if (activeDoc?.id === docToDelete.id) {
                setActiveDoc(null);
              }
              setUploadNotice({
                ok: true,
                text: `Deleted document "${docToDelete.filename}".`,
              });
              setDocToDelete(null);
              setDeleteError(null);
            } catch (err) {
              setDeleteError(err instanceof Error ? err.message : "Failed to delete document.");
            } finally {
              setDeleteBusy(false);
            }
          }}
        />
      )}
    </div>
  );
}

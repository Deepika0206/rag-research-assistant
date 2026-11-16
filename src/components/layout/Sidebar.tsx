import React, { useRef, useState } from "react";
import {
  Plus,
  Search,
  BookOpen,
  Pin,
  Bookmark,
  ChevronDown,
  ChevronRight,
  Settings,
  X,
  FileText,
  Folder,
  FolderOpen,
  MoreHorizontal,
  Trash2,
  Pencil,
  Upload,
  Loader2,
} from "lucide-react";
import type { Conversation, SavedNote } from "../../types/conversation";
import type { CollectionRecord, DocumentRecord, SubsectionRecord } from "../../lib/types";
import { SidebarItem } from "./SidebarItem";
import { DeleteCollectionModal, SimpleConfirmModal } from "../modals/ConfirmModal";

export type SidebarTab = "chat" | "library" | "notes" | "settings";

interface Props {
  conversations: Conversation[];
  collections: CollectionRecord[];
  documents: DocumentRecord[];
  savedNotes: SavedNote[];
  activeId: string | null;
  activeTab: SidebarTab;
  selectedCollectionId: string | null;
  selectedSubsectionId: string | null;
  collectionsLoading?: boolean;
  collectionsError?: string | null;
  onSelectTab: (tab: SidebarTab) => void;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void | Promise<void>;
  onDeleteConversation: (id: string) => Promise<void>;
  onRenameConversation: (id: string, title: string) => Promise<void>;
  onTogglePin: (id: string) => void | Promise<void>;
  onAssignCollection: (convId: string, colId?: string) => void | Promise<void>;
  conversationError?: string | null;
  onClearConversationError?: () => void;
  onCreateCollection: (name: string) => Promise<unknown>;
  onRenameCollection: (id: string, name: string) => Promise<unknown>;
  onDeleteCollection: (id: string, mode: "delete_all" | "move_to_default") => Promise<unknown>;
  onCreateSubsection: (collectionId: string, name: string) => Promise<unknown>;
  onRenameSubsection: (subsectionId: string, name: string) => Promise<unknown>;
  onDeleteSubsection: (subsectionId: string, deleteDocuments: boolean) => Promise<unknown>;
  onSelectCollectionScope: (collectionId: string | null, subsectionId?: string | null) => void;
  onUploadToDestination: (files: File[], collectionId: string, subsectionId?: string | null) => Promise<unknown>;
  onDeleteDocument: (docId: number) => Promise<unknown>;
  onViewDocument: (document: DocumentRecord) => void;
  onCloseMobile?: () => void;
}

function SidebarDocumentRow({
  document,
  menuOpen,
  onToggleMenu,
  onView,
  onDelete,
}: {
  document: DocumentRecord;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onView: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group/doc relative flex min-w-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-[#666666] hover:bg-[#eaeaea]/40 hover:text-[#171717] focus-within:bg-[#eaeaea]/40">
      <button
        type="button"
        onClick={onView}
        className="flex min-w-0 flex-1 items-center gap-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#171717]"
        title={document.filename}
      >
        <FileText className="h-3 w-3 shrink-0" />
        <span className="truncate">{document.filename}</span>
      </button>
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleMenu();
          }}
          aria-label={`Options for ${document.filename}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="rounded p-0.5 opacity-0 transition-opacity hover:bg-black/10 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#171717] group-hover/doc:opacity-100 group-focus-within/doc:opacity-100"
        >
          <MoreHorizontal className="h-3 w-3" />
        </button>
        {menuOpen && (
          <div
            role="menu"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Escape") onToggleMenu();
            }}
            className="absolute right-0 top-6 z-40 w-40 rounded-[8px] border border-[#eaeaea] bg-white p-1 text-[#171717] shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              onClick={onView}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-[#fafafa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#171717]"
            >
              <FileText className="h-3 w-3 text-[#666666]" />
              View Document
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={onDelete}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-rose-700 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
            >
              <Trash2 className="h-3 w-3" />
              Delete Document
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function Sidebar({
  conversations,
  collections,
  documents,
  savedNotes,
  activeId,
  activeTab,
  selectedCollectionId,
  selectedSubsectionId,
  collectionsLoading = false,
  collectionsError = null,
  onSelectTab,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  onTogglePin,
  onAssignCollection,
  conversationError = null,
  onClearConversationError,
  onCreateCollection,
  onRenameCollection,
  onDeleteCollection,
  onCreateSubsection,
  onRenameSubsection,
  onDeleteSubsection,
  onSelectCollectionScope,
  onUploadToDestination,
  onDeleteDocument,
  onViewDocument,
  onCloseMobile,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddCollection, setShowAddCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [expandedCollections, setExpandedCollections] = useState<Record<string, boolean>>({});
  const [expandedSubsections, setExpandedSubsections] = useState<Record<string, boolean>>({});

  // Subsection creation & rename states
  const [addingSubForCol, setAddingSubForCol] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState("");
  const [editingCol, setEditingCol] = useState<{ id: string; name: string } | null>(null);
  const [editingSub, setEditingSub] = useState<{ id: string; name: string } | null>(null);

  // Menus & confirmation dialogs
  const [openColMenuId, setOpenColMenuId] = useState<string | null>(null);
  const [openSubMenuId, setOpenSubMenuId] = useState<string | null>(null);
  const [openDocMenuId, setOpenDocMenuId] = useState<number | null>(null);
  const [confirmDeleteCol, setConfirmDeleteCol] = useState<CollectionRecord | null>(null);
  const [confirmDeleteSub, setConfirmDeleteSub] = useState<SubsectionRecord | null>(null);
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState<DocumentRecord | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Quick upload into a specific subsection
  const subUploadInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadTarget, setUploadTarget] = useState<{ collectionId: string; subsectionId?: string | null } | null>(null);

  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    if (c.title.toLowerCase().includes(q)) return true;
    if (c.searchText?.toLowerCase().includes(q)) return true;
    return c.messages.some((m) => m.content.toLowerCase().includes(q));
  });

  const pinnedConversations = filteredConversations.filter((c) => c.isPinned);
  const unpinnedConversations = filteredConversations.filter((c) => !c.isPinned);

  const toggleCollectionExpand = (id: string) => {
    setExpandedCollections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSubsectionExpand = (id: string) => {
    setExpandedSubsections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCollectionName.trim();
    if (!trimmed) return;
    setActionBusy(true);
    setActionError(null);
    try {
      await onCreateCollection(trimmed);
      setNewCollectionName("");
      setShowAddCollection(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to create collection.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleRenameCollectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCol || !editingCol.name.trim()) return;
    setActionBusy(true);
    setActionError(null);
    try {
      await onRenameCollection(editingCol.id, editingCol.name.trim());
      setEditingCol(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to rename collection.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleCreateSubsection = async (e: React.FormEvent, collectionId: string) => {
    e.preventDefault();
    const trimmed = newSubName.trim();
    if (!trimmed) return;
    setActionBusy(true);
    setActionError(null);
    try {
      await onCreateSubsection(collectionId, trimmed);
      setNewSubName("");
      setAddingSubForCol(null);
      setExpandedCollections((prev) => ({ ...prev, [collectionId]: true }));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to create subsection.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleRenameSubsectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSub || !editingSub.name.trim()) return;
    setActionBusy(true);
    setActionError(null);
    try {
      await onRenameSubsection(editingSub.id, editingSub.name.trim());
      setEditingSub(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to rename subsection.");
    } finally {
      setActionBusy(false);
    }
  };

  const triggerUploadInto = (collectionId: string, subsectionId?: string | null) => {
    setUploadTarget({ collectionId, subsectionId: subsectionId || null });
    setOpenColMenuId(null);
    setOpenSubMenuId(null);
    setOpenDocMenuId(null);
    setTimeout(() => subUploadInputRef.current?.click(), 0);
  };

  const handleSidebarFilesChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length || !uploadTarget) return;
    setActionBusy(true);
    setActionError(null);
    try {
      await onUploadToDestination(files, uploadTarget.collectionId, uploadTarget.subsectionId);
      setExpandedCollections((prev) => ({ ...prev, [uploadTarget.collectionId]: true }));
      if (uploadTarget.subsectionId) {
        setExpandedSubsections((prev) => ({ ...prev, [uploadTarget.subsectionId!]: true }));
      }
      onSelectCollectionScope(uploadTarget.collectionId, uploadTarget.subsectionId || null);
      onSelectTab("library");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setActionBusy(false);
      setUploadTarget(null);
    }
  };

  return (
    <aside
      className="w-72 shrink-0 border-r border-[#eaeaea] bg-[#fafafa] flex flex-col h-full select-none"
      onClick={() => {
        setOpenColMenuId(null);
        setOpenSubMenuId(null);
      }}
    >
      <input
        ref={subUploadInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.doc,.txt,.md"
        className="hidden"
        onChange={handleSidebarFilesChosen}
      />

      {/* Sidebar Header & Brand */}
      <div className="p-3.5 border-b border-[#eaeaea] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-[6px] bg-[#171717] text-white flex items-center justify-center font-mono font-semibold text-[11px]">
            RA
          </div>
          <div>
            <h1 className="text-xs font-semibold tracking-tight text-[#171717]">Research Assistant</h1>
            <p className="text-[10px] text-[#666666]">Coursework &amp; Algorithms</p>
          </div>
        </div>
        {onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="md:hidden p-1 text-[#666666] hover:text-[#171717]"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Primary Actions: New Chat & Search */}
      <div className="p-3 space-y-2 border-b border-[#eaeaea] bg-white">
        <button
          type="button"
          onClick={() => {
            onNewChat();
            onSelectTab("chat");
          }}
          className="w-full flex items-center justify-center gap-2 rounded-[8px] bg-[#171717] px-3 py-2 text-xs font-medium text-white hover:bg-[#262626] transition-colors shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Chat</span>
        </button>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#7d7d7d] absolute left-2.5 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-[8px] border border-[#eaeaea] bg-[#fafafa] text-[#171717] placeholder:text-[#7d7d7d] focus:outline-none focus:border-[#171717] focus:bg-white transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-2 text-[#7d7d7d] hover:text-[#171717]"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Workspace Navigation Tabs */}
      <div className="px-3 py-2 border-b border-[#eaeaea] grid grid-cols-3 gap-1 bg-[#fafafa]">
        <button
          type="button"
          onClick={() => onSelectTab("chat")}
          className={`flex items-center justify-center gap-1.5 py-1.5 rounded-[6px] text-xs font-medium transition-colors ${
            activeTab === "chat"
              ? "bg-white text-[#171717] border border-[#eaeaea] shadow-xs"
              : "text-[#666666] hover:text-[#171717] hover:bg-white/50"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Chat</span>
        </button>
        <button
          type="button"
          onClick={() => onSelectTab("library")}
          className={`flex items-center justify-center gap-1.5 py-1.5 rounded-[6px] text-xs font-medium transition-colors ${
            activeTab === "library"
              ? "bg-white text-[#171717] border border-[#eaeaea] shadow-xs"
              : "text-[#666666] hover:text-[#171717] hover:bg-white/50"
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Library</span>
        </button>
        <button
          type="button"
          onClick={() => onSelectTab("notes")}
          className={`flex items-center justify-center gap-1.5 py-1.5 rounded-[6px] text-xs font-medium transition-colors ${
            activeTab === "notes"
              ? "bg-white text-[#171717] border border-[#eaeaea] shadow-xs"
              : "text-[#666666] hover:text-[#171717] hover:bg-white/50"
          }`}
        >
          <Bookmark className="w-3.5 h-3.5" />
          <span>Notes ({savedNotes.length})</span>
        </button>
      </div>

      {/* Scrollable Sections */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Pinned Section */}
        {pinnedConversations.length > 0 && (
          <div>
            <div className="flex items-center gap-1 px-1 mb-1.5 text-[11px] font-mono font-semibold uppercase tracking-wider text-[#666666]">
              <Pin className="w-3 h-3 text-[#7d7d7d]" />
              <span>Pinned ({pinnedConversations.length})</span>
            </div>
            <div className="space-y-0.5">
              {pinnedConversations.map((conv) => (
                <SidebarItem
                  key={conv.id}
                  conversation={conv}
                  isActive={activeId === conv.id && activeTab === "chat"}
                  collections={collections}
                  onSelect={() => {
                    onSelectConversation(conv.id);
                    onSelectTab("chat");
                  }}
                  onDelete={() => onDeleteConversation(conv.id)}
                  onRename={(title) => onRenameConversation(conv.id, title)}
                  onTogglePin={() => onTogglePin(conv.id)}
                  onAssignCollection={(colId) => onAssignCollection(conv.id, colId)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Collections & Subsections */}
        <div>
          <div className="flex items-center justify-between px-1 mb-1.5">
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#666666]">
              Collections
            </span>
            <div className="flex items-center gap-1">
              {collectionsLoading && <Loader2 className="w-3 h-3 animate-spin text-[#7d7d7d]" />}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAddCollection((v) => !v);
                  setActionError(null);
                }}
                title="Add collection"
                aria-label="Add collection"
                className="p-0.5 rounded text-[#666666] hover:text-[#171717] hover:bg-[#eaeaea]/60"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {showAddCollection && (
            <form onSubmit={handleCreateCollection} className="mb-2 px-1 flex gap-1">
              <input
                type="text"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setShowAddCollection(false);
                }}
                placeholder="Collection name..."
                className="flex-1 min-w-0 px-2 py-1 text-xs rounded-[6px] border border-[#eaeaea] bg-white focus:outline-none focus:border-[#171717]"
                autoFocus
                disabled={actionBusy}
              />
              <button
                type="submit"
                disabled={actionBusy || !newCollectionName.trim()}
                className="px-2.5 py-1 bg-[#171717] text-white text-xs rounded-[6px] font-medium hover:bg-black disabled:opacity-40 shrink-0"
              >
                Create
              </button>
            </form>
          )}

          {(actionError || collectionsError) && (
            <div className="mb-2 mx-1 px-2 py-1.5 rounded-[6px] border border-amber-200 bg-amber-50 text-[11px] text-amber-900">
              {actionError || "Backend offline — configure Settings & Access to manage persistent collections."}
            </div>
          )}
          {actionSuccess && (
            <div role="status" className="mb-2 mx-1 px-2 py-1.5 rounded-[6px] border border-emerald-200 bg-emerald-50 text-[11px] text-emerald-800">
              {actionSuccess}
            </div>
          )}

          {collections.length === 0 && !collectionsLoading ? (
            <p className="px-2 py-2 text-[11px] text-[#7d7d7d]">
              {collectionsError ? "Connect backend in Settings to load collections." : "No collections yet. Click + to create one."}
            </p>
          ) : (
            <div className="space-y-0.5">
              {collections.map((col) => {
                const isExpanded = !!expandedCollections[col.id];
                const isSelectedCol =
                  activeTab === "library" && selectedCollectionId === col.id && !selectedSubsectionId;

                return (
                  <div key={col.id} className="rounded-[6px]">
                    {editingCol?.id === col.id ? (
                      <form onSubmit={handleRenameCollectionSubmit} className="flex items-center gap-1 px-1 py-1">
                        <input
                          type="text"
                          value={editingCol.name}
                          onChange={(e) => setEditingCol({ ...editingCol, name: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") setEditingCol(null);
                          }}
                          className="flex-1 min-w-0 px-2 py-0.5 text-xs rounded border border-[#171717] bg-white focus:outline-none"
                          autoFocus
                        />
                        <button
                          type="submit"
                          disabled={actionBusy}
                          className="px-2 py-0.5 text-[11px] bg-[#171717] text-white rounded"
                        >
                          Save
                        </button>
                      </form>
                    ) : (
                      <div
                        className={`group relative flex items-center justify-between px-1.5 py-1 rounded-[6px] text-xs transition-colors ${
                          isSelectedCol
                            ? "bg-[#171717] text-white"
                            : "text-[#171717] hover:bg-[#eaeaea]/60"
                        }`}
                      >
                        <div className="flex items-center gap-1 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCollectionExpand(col.id);
                            }}
                            aria-label={isExpanded ? `Collapse ${col.name}` : `Expand ${col.name}`}
                            className={`p-0.5 rounded shrink-0 ${
                              isSelectedCol ? "text-white/80 hover:text-white" : "text-[#7d7d7d] hover:text-[#171717]"
                            }`}
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3 h-3" />
                            ) : (
                              <ChevronRight className="w-3 h-3" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setExpandedCollections((prev) => ({ ...prev, [col.id]: true }));
                              onSelectCollectionScope(col.id, null);
                              onSelectTab("library");
                            }}
                            className="flex items-center gap-1.5 min-w-0 flex-1 text-left py-0.5"
                          >
                            {isExpanded ? (
                              <FolderOpen className="w-3.5 h-3.5 shrink-0 opacity-80" />
                            ) : (
                              <Folder className="w-3.5 h-3.5 shrink-0 opacity-80" />
                            )}
                            <span className="font-medium truncate">{col.name}</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-0.5 shrink-0">
                          <span
                            className={`text-[10px] font-mono tabular-nums px-1 ${
                              isSelectedCol ? "text-white/80" : "text-[#7d7d7d]"
                            }`}
                          >
                            {col.doc_count}
                          </span>

                          {/* Add subsection button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedCollections((prev) => ({ ...prev, [col.id]: true }));
                              setAddingSubForCol(addingSubForCol === col.id ? null : col.id);
                              setNewSubName("");
                            }}
                            title={`Add subsection to ${col.name}`}
                            aria-label={`Add subsection to ${col.name}`}
                            className={`p-0.5 rounded opacity-70 group-hover:opacity-100 ${
                              isSelectedCol ? "hover:bg-white/20 text-white" : "hover:bg-black/10 text-[#666666]"
                            }`}
                          >
                            <Plus className="w-3 h-3" />
                          </button>

                          {/* Three-dot collection actions */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenSubMenuId(null);
                                setOpenDocMenuId(null);
                                setOpenColMenuId(openColMenuId === col.id ? null : col.id);
                              }}
                              title="Collection options"
                              aria-label={`Options for ${col.name}`}
                              aria-haspopup="menu"
                              aria-expanded={openColMenuId === col.id}
                              className={`p-0.5 rounded opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#171717] ${
                                isSelectedCol ? "hover:bg-white/20 text-white" : "hover:bg-black/10 text-[#666666]"
                              }`}
                            >
                              <MoreHorizontal className="w-3 h-3" />
                            </button>

                            {openColMenuId === col.id && (
                              <div
                                role="menu"
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => {
                                  if (e.key === "Escape") setOpenColMenuId(null);
                                }}
                                className="absolute right-0 top-6 z-40 w-44 rounded-[8px] border border-[#eaeaea] bg-white p-1 shadow-lg text-[#171717]"
                              >
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setOpenColMenuId(null);
                                    setExpandedCollections((prev) => ({ ...prev, [col.id]: true }));
                                    setAddingSubForCol(col.id);
                                    setNewSubName("");
                                  }}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-[#fafafa] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#171717]"
                                >
                                  <Plus className="w-3 h-3 text-[#666666]" />
                                  <span>New Subsection</span>
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => triggerUploadInto(col.id, null)}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-[#fafafa] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#171717]"
                                >
                                  <Upload className="w-3 h-3 text-[#666666]" />
                                  <span>Upload Documents</span>
                                </button>
                                {!col.is_default && (
                                  <>
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={() => {
                                        setOpenColMenuId(null);
                                        setEditingCol({ id: col.id, name: col.name });
                                      }}
                                      className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-[#fafafa] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#171717]"
                                    >
                                      <Pencil className="w-3 h-3 text-[#666666]" />
                                      <span>Rename Collection</span>
                                    </button>
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={() => {
                                        setOpenColMenuId(null);
                                        setActionError(null);
                                        setConfirmDeleteCol(col);
                                      }}
                                      className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-rose-50 text-rose-700 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      <span>Delete Collection</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Inline Add Subsection form */}
                    {addingSubForCol === col.id && (
                      <form
                        onSubmit={(e) => handleCreateSubsection(e, col.id)}
                        className="pl-5 pr-1 py-1 flex gap-1"
                      >
                        <input
                          type="text"
                          value={newSubName}
                          onChange={(e) => setNewSubName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") setAddingSubForCol(null);
                          }}
                          placeholder="Folder name..."
                          className="flex-1 min-w-0 px-2 py-0.5 text-xs rounded border border-[#eaeaea] bg-white focus:outline-none focus:border-[#171717]"
                          autoFocus
                        />
                        <button
                          type="submit"
                          disabled={actionBusy || !newSubName.trim()}
                          className="px-2 py-0.5 bg-[#171717] text-white text-[11px] rounded font-medium disabled:opacity-40"
                        >
                          Add
                        </button>
                      </form>
                    )}

                    {/* Expanded Subsections Tree */}
                    {isExpanded && (
                      <div className="pl-3 ml-2.5 border-l border-[#eaeaea] space-y-0.5 my-0.5">
                        {col.subsections.length === 0 &&
                        !documents.some((doc) => doc.collection_id === col.id) ? (
                          <div className="px-2 py-1 text-[11px] text-[#7d7d7d]">
                            No subfolders
                          </div>
                        ) : (
                          col.subsections.map((sub) => {
                            const isSubExpanded = !!expandedSubsections[sub.id];
                            const isSelectedSub =
                              activeTab === "library" && selectedSubsectionId === sub.id;
                            const subDocs = documents.filter((d) => d.subsection_id === sub.id);

                            return (
                              <div key={sub.id}>
                                {editingSub?.id === sub.id ? (
                                  <form
                                    onSubmit={handleRenameSubsectionSubmit}
                                    className="flex items-center gap-1 px-1 py-0.5"
                                  >
                                    <input
                                      type="text"
                                      value={editingSub.name}
                                      onChange={(e) =>
                                        setEditingSub({ ...editingSub, name: e.target.value })
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === "Escape") setEditingSub(null);
                                      }}
                                      className="flex-1 min-w-0 px-1.5 py-0.5 text-xs rounded border border-[#171717] bg-white focus:outline-none"
                                      autoFocus
                                    />
                                    <button
                                      type="submit"
                                      disabled={actionBusy}
                                      className="px-2 py-0.5 text-[11px] bg-[#171717] text-white rounded"
                                    >
                                      Save
                                    </button>
                                  </form>
                                ) : (
                                  <div
                                    className={`group/sub relative flex items-center justify-between px-1.5 py-1 rounded-[6px] text-xs transition-colors ${
                                      isSelectedSub
                                        ? "bg-[#171717] text-white"
                                        : "text-[#666666] hover:text-[#171717] hover:bg-[#eaeaea]/60"
                                    }`}
                                  >
                                    <div className="flex items-center gap-1 min-w-0 flex-1">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleSubsectionExpand(sub.id);
                                        }}
                                        aria-label={
                                          isSubExpanded ? `Collapse ${sub.name}` : `Expand ${sub.name}`
                                        }
                                        className="p-0.5 rounded shrink-0 opacity-70 hover:opacity-100"
                                      >
                                        {isSubExpanded ? (
                                          <ChevronDown className="w-2.5 h-2.5" />
                                        ) : (
                                          <ChevronRight className="w-2.5 h-2.5" />
                                        )}
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setExpandedSubsections((prev) => ({
                                            ...prev,
                                            [sub.id]: true,
                                          }));
                                          onSelectCollectionScope(col.id, sub.id);
                                          onSelectTab("library");
                                        }}
                                        className="flex-1 min-w-0 text-left truncate py-0.5"
                                      >
                                        {sub.name}
                                      </button>
                                    </div>

                                    <div className="flex items-center gap-0.5 shrink-0">
                                      <span className="text-[10px] font-mono tabular-nums px-1 opacity-75">
                                        {sub.doc_count}
                                      </span>
                                      <div className="relative">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setOpenColMenuId(null);
                                            setOpenDocMenuId(null);
                                            setOpenSubMenuId(
                                              openSubMenuId === sub.id ? null : sub.id
                                            );
                                          }}
                                          aria-label={`Options for ${sub.name}`}
                                          aria-haspopup="menu"
                                          aria-expanded={openSubMenuId === sub.id}
                                          className="p-0.5 rounded opacity-0 group-hover/sub:opacity-100 group-focus-within/sub:opacity-100 hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#171717]"
                                        >
                                          <MoreHorizontal className="w-3 h-3" />
                                        </button>

                                        {openSubMenuId === sub.id && (
                                          <div
                                            role="menu"
                                            onClick={(e) => e.stopPropagation()}
                                            onKeyDown={(e) => {
                                              if (e.key === "Escape") setOpenSubMenuId(null);
                                            }}
                                            className="absolute right-0 top-6 z-40 w-44 rounded-[8px] border border-[#eaeaea] bg-white p-1 shadow-lg text-[#171717]"
                                          >
                                            <button
                                              type="button"
                                              role="menuitem"
                                              onClick={() => triggerUploadInto(col.id, sub.id)}
                                              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-[#fafafa] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#171717]"
                                            >
                                              <Upload className="w-3 h-3 text-[#666666]" />
                                              <span>Upload Here</span>
                                            </button>
                                            <button
                                              type="button"
                                              role="menuitem"
                                              onClick={() => {
                                                setOpenSubMenuId(null);
                                                setEditingSub({ id: sub.id, name: sub.name });
                                              }}
                                              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-[#fafafa] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#171717]"
                                            >
                                              <Pencil className="w-3 h-3 text-[#666666]" />
                                              <span>Rename Folder</span>
                                            </button>
                                            <button
                                              type="button"
                                              role="menuitem"
                                              onClick={() => {
                                                setOpenSubMenuId(null);
                                                setActionError(null);
                                                setConfirmDeleteSub(sub);
                                              }}
                                              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-rose-50 text-rose-700 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                              <span>Delete Folder</span>
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Expanded Subsection Document Preview */}
                                {isSubExpanded && (
                                  <div className="pl-5 pr-1 py-0.5 space-y-0.5">
                                    {subDocs.length === 0 ? (
                                      <button
                                        type="button"
                                        onClick={() => triggerUploadInto(col.id, sub.id)}
                                        className="w-full text-left px-1.5 py-0.5 text-[11px] text-[#7d7d7d] hover:text-[#171717] flex items-center gap-1"
                                      >
                                        <Plus className="w-2.5 h-2.5" />
                                        <span>Upload into folder</span>
                                      </button>
                                    ) : (
                                      subDocs.map((doc) => (
                                        <SidebarDocumentRow
                                          key={doc.id}
                                          document={doc}
                                          menuOpen={openDocMenuId === doc.id}
                                          onToggleMenu={() => {
                                            setOpenColMenuId(null);
                                            setOpenSubMenuId(null);
                                            setOpenDocMenuId(openDocMenuId === doc.id ? null : doc.id);
                                          }}
                                          onView={() => {
                                            setOpenDocMenuId(null);
                                            onViewDocument(doc);
                                          }}
                                          onDelete={() => {
                                            setOpenDocMenuId(null);
                                            setActionError(null);
                                            setConfirmDeleteDoc(doc);
                                          }}
                                        />
                                      ))
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                        {documents
                          .filter((doc) => doc.collection_id === col.id && !doc.subsection_id)
                          .map((doc) => (
                            <SidebarDocumentRow
                              key={doc.id}
                              document={doc}
                              menuOpen={openDocMenuId === doc.id}
                              onToggleMenu={() => {
                                setOpenColMenuId(null);
                                setOpenSubMenuId(null);
                                setOpenDocMenuId(openDocMenuId === doc.id ? null : doc.id);
                              }}
                              onView={() => {
                                setOpenDocMenuId(null);
                                onViewDocument(doc);
                              }}
                              onDelete={() => {
                                setOpenDocMenuId(null);
                                setActionError(null);
                                setConfirmDeleteDoc(doc);
                              }}
                            />
                          ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent History */}
        <div>
          <div className="px-1 mb-1.5 text-[11px] font-mono font-semibold uppercase tracking-wider text-[#666666]">
            History ({unpinnedConversations.length})
          </div>
          {conversationError && (
            <div className="mb-2 flex items-start justify-between gap-2 rounded-[8px] border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-700">
              <span>{conversationError}</span>
              {onClearConversationError && (
                <button
                  type="button"
                  aria-label="Dismiss conversation error"
                  onClick={onClearConversationError}
                  className="shrink-0 rounded p-0.5 hover:bg-rose-100"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
          {unpinnedConversations.length === 0 ? (
            <p className="px-2 py-3 text-xs text-[#7d7d7d] italic">
              {searchQuery ? "No matching conversations found." : "No previous conversations yet."}
            </p>
          ) : (
            <div className="space-y-0.5">
              {unpinnedConversations.map((conv) => (
                <SidebarItem
                  key={conv.id}
                  conversation={conv}
                  isActive={activeId === conv.id && activeTab === "chat"}
                  collections={collections}
                  onSelect={() => {
                    onSelectConversation(conv.id);
                    onSelectTab("chat");
                  }}
                  onDelete={() => onDeleteConversation(conv.id)}
                  onRename={(title) => onRenameConversation(conv.id, title)}
                  onTogglePin={() => onTogglePin(conv.id)}
                  onAssignCollection={(colId) => onAssignCollection(conv.id, colId)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer Settings Tab Trigger */}
      <div className="p-3 border-t border-[#eaeaea] bg-white">
        <button
          type="button"
          onClick={() => onSelectTab("settings")}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[8px] text-xs font-medium transition-colors ${
            activeTab === "settings"
              ? "bg-[#171717] text-white"
              : "text-[#666666] hover:text-[#171717] hover:bg-[#fafafa]"
          }`}
        >
          <div className="flex items-center gap-2">
            <Settings className="w-3.5 h-3.5" />
            <span>Settings &amp; Access</span>
          </div>
          <span className="text-[10px] font-mono opacity-80">v1.0</span>
        </button>
      </div>

      {/* Delete Collection Modal */}
      {confirmDeleteCol && (
        <DeleteCollectionModal
          collectionName={confirmDeleteCol.name}
          docCount={confirmDeleteCol.doc_count}
          busy={actionBusy}
          error={actionError}
          onCancel={() => setConfirmDeleteCol(null)}
          onConfirm={async (mode) => {
            setActionBusy(true);
            setActionError(null);
            setActionSuccess(null);
            try {
              await onDeleteCollection(confirmDeleteCol.id, mode);
              setConfirmDeleteCol(null);
              setActionError(null);
              setActionSuccess(`Deleted collection "${confirmDeleteCol.name}".`);
            } catch (err) {
              setActionError(err instanceof Error ? err.message : "Failed to delete collection.");
            } finally {
              setActionBusy(false);
            }
          }}
        />
      )}

      {/* Delete Subsection Modal */}
      {confirmDeleteSub && (
        <SimpleConfirmModal
          title="Delete Subsection"
          description={`Remove folder "${confirmDeleteSub.name}" (${confirmDeleteSub.doc_count} document${confirmDeleteSub.doc_count === 1 ? "" : "s"}).`}
          confirmLabel="Delete Subsection"
          checkboxLabel="Also permanently delete documents inside this folder (otherwise keep them in the parent collection)"
          busy={actionBusy}
          error={actionError}
          onCancel={() => setConfirmDeleteSub(null)}
          onConfirm={async (deleteDocs) => {
            setActionBusy(true);
            setActionError(null);
            setActionSuccess(null);
            try {
              await onDeleteSubsection(confirmDeleteSub.id, deleteDocs);
              setConfirmDeleteSub(null);
              setActionError(null);
              setActionSuccess(`Deleted subsection "${confirmDeleteSub.name}".`);
            } catch (err) {
              setActionError(err instanceof Error ? err.message : "Failed to delete subsection.");
            } finally {
              setActionBusy(false);
            }
          }}
        />
      )}

      {confirmDeleteDoc && (
        <SimpleConfirmModal
          title="Delete Document"
          description={`Delete "${confirmDeleteDoc.filename}" permanently? This also removes its indexed chunks from search.`}
          confirmLabel="Delete Document"
          busy={actionBusy}
          error={actionError}
          onCancel={() => setConfirmDeleteDoc(null)}
          onConfirm={async () => {
            setActionBusy(true);
            setActionError(null);
            setActionSuccess(null);
            try {
              await onDeleteDocument(confirmDeleteDoc.id);
              setConfirmDeleteDoc(null);
              setActionSuccess(`Deleted document "${confirmDeleteDoc.filename}".`);
            } catch (err) {
              setActionError(err instanceof Error ? err.message : "Failed to delete document.");
            } finally {
              setActionBusy(false);
            }
          }}
        />
      )}
    </aside>
  );
}

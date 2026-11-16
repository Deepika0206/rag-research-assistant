import React, { useState } from "react";
import { Folder, MoreHorizontal, Pencil, Pin, Trash2 } from "lucide-react";
import type { Conversation } from "../../types/conversation";
import type { CollectionRecord } from "../../lib/types";
import { SimpleConfirmModal } from "../modals/ConfirmModal";

interface Props {
  conversation: Conversation;
  isActive: boolean;
  collections: CollectionRecord[];
  onSelect: () => void;
  onDelete: () => Promise<void>;
  onRename: (title: string) => Promise<void>;
  onTogglePin: () => void | Promise<void>;
  onAssignCollection: (collectionId?: string) => void | Promise<void>;
}

export function SidebarItem({
  conversation,
  isActive,
  collections,
  onSelect,
  onDelete,
  onRename,
  onTogglePin,
  onAssignCollection,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [collectionMenuOpen, setCollectionMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(conversation.title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const currentCollection = collections.find((item) => item.id === conversation.collectionId);

  const runAction = async (action: () => void | Promise<void>) => {
    setError(null);
    try {
      await action();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The chat could not be updated.");
    }
  };

  const saveTitle = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Chat title cannot be empty.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onRename(trimmed);
      setEditing(false);
      setMenuOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not rename this chat.");
    } finally {
      setBusy(false);
    }
  };

  const deleteChat = async () => {
    setBusy(true);
    setError(null);
    try {
      await onDelete();
      setConfirmDelete(false);
      setMenuOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not delete this chat.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div
        onClick={onSelect}
        className={`group relative flex min-w-0 items-center justify-between gap-1 rounded-[8px] px-2.5 py-2 text-xs transition-colors ${
          isActive
            ? "bg-[#171717] text-white"
            : "text-[#171717] hover:bg-[#eaeaea]/70"
        }`}
      >
        <div className="min-w-0 flex-1 pr-1">
          {editing ? (
            <form
              onSubmit={saveTitle}
              onClick={(event) => event.stopPropagation()}
              className="flex min-w-0 gap-1"
            >
              <input
                autoFocus
                aria-label="Chat title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={160}
                disabled={busy}
                className="min-w-0 flex-1 rounded border border-[#d4d4d4] bg-white px-1.5 py-1 text-xs text-[#171717] outline-none focus:border-[#171717]"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded px-1.5 text-[10px] font-medium text-white bg-[#171717] disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setTitle(conversation.title);
                  setEditing(false);
                  setError(null);
                }}
                className="rounded px-1.5 text-[10px] text-[#666666] hover:bg-[#eaeaea]"
              >
                Cancel
              </button>
            </form>
          ) : (
            <>
              <div className="flex min-w-0 items-center gap-1.5">
                {conversation.isPinned && (
                  <Pin className={`h-3 w-3 shrink-0 ${isActive ? "text-white/80" : "text-[#7d7d7d]"}`} />
                )}
                <span className="truncate font-medium">
                  {conversation.title || "Untitled Conversation"}
                </span>
              </div>
              {currentCollection && (
                <div className="mt-0.5 flex min-w-0 items-center gap-1">
                  <span
                    className={`max-w-full truncate rounded px-1.5 py-0.2 font-mono text-[10px] ${
                      isActive ? "bg-white/20 text-white/90" : "bg-[#eaeaea] text-[#666666]"
                    }`}
                  >
                    {currentCollection.name}
                  </span>
                </div>
              )}
            </>
          )}
          {error && <p role="alert" className="mt-1 break-words text-[10px] text-rose-600">{error}</p>}
        </div>

        <div
          className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => void runAction(onTogglePin)}
            aria-label={conversation.isPinned ? "Unpin chat" : "Pin chat"}
            title={conversation.isPinned ? "Unpin chat" : "Pin chat"}
            className={`rounded p-1 hover:bg-black/10 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#171717] ${
              isActive ? "text-white/80 hover:text-white" : "text-[#7d7d7d] hover:text-[#171717]"
            }`}
          >
            <Pin className="h-3 w-3" />
          </button>

          <div className="relative group/folder">
            <button
              type="button"
              title="Assign collection"
              aria-label="Assign collection"
              aria-haspopup="menu"
              aria-expanded={collectionMenuOpen}
              onClick={() => setCollectionMenuOpen((open) => !open)}
              className={`rounded p-1 hover:bg-black/10 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#171717] ${
                isActive ? "text-white/80 hover:text-white" : "text-[#7d7d7d] hover:text-[#171717]"
              }`}
            >
              <Folder className="h-3 w-3" />
            </button>
            <div
              role="menu"
              className={`absolute right-0 top-6 z-40 w-36 rounded-[8px] border border-[#eaeaea] bg-white p-1 text-[#171717] shadow-lg ${
                collectionMenuOpen ? "block" : "hidden group-hover/folder:block group-focus-within/folder:block"
              }`}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setCollectionMenuOpen(false);
                  void runAction(() => onAssignCollection(undefined));
                }}
                className="w-full rounded px-2 py-1 text-left text-[11px] hover:bg-[#fafafa]"
              >
                No collection
              </button>
              {collections.map((collection) => (
                <button
                  key={collection.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setCollectionMenuOpen(false);
                    void runAction(() => onAssignCollection(collection.id));
                  }}
                  className={`w-full truncate rounded px-2 py-1 text-left text-[11px] hover:bg-[#fafafa] ${
                    conversation.collectionId === collection.id ? "font-semibold" : ""
                  }`}
                >
                  {collection.name}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setMenuOpen((open) => !open);
                setError(null);
              }}
              aria-label={`Options for ${conversation.title || "chat"}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className={`rounded p-1 hover:bg-black/10 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#171717] ${
                isActive ? "text-white/80 hover:text-white" : "text-[#7d7d7d] hover:text-[#171717]"
              }`}
            >
              <MoreHorizontal className="h-3 w-3" />
            </button>
            {menuOpen && (
              <div
                role="menu"
                onKeyDown={(event) => {
                  if (event.key === "Escape") setMenuOpen(false);
                }}
                className="absolute right-0 top-6 z-40 w-36 rounded-[8px] border border-[#eaeaea] bg-white p-1 text-[#171717] shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setTitle(conversation.title);
                    setEditing(true);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-[#fafafa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#171717]"
                >
                  <Pencil className="h-3 w-3 text-[#666666]" />
                  Rename Chat
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setConfirmDelete(true);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-rose-700 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete Chat
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {confirmDelete && (
        <SimpleConfirmModal
          title="Delete chat?"
          description={`"${conversation.title || "Untitled Conversation"}" will be removed. Its saved research runs remain available.`}
          confirmLabel="Delete Chat"
          busy={busy}
          error={error}
          onCancel={() => {
            if (!busy) {
              setConfirmDelete(false);
              setError(null);
            }
          }}
          onConfirm={() => void deleteChat()}
        />
      )}
    </>
  );
}

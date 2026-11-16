import React, { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

interface DeleteCollectionModalProps {
  collectionName: string;
  docCount: number;
  busy?: boolean;
  error?: string | null;
  onConfirm: (mode: "delete_all" | "move_to_default") => void;
  onCancel: () => void;
}

export function DeleteCollectionModal({
  collectionName,
  docCount,
  busy = false,
  error = null,
  onConfirm,
  onCancel,
}: DeleteCollectionModalProps) {
  const [mode, setMode] = useState<"move_to_default" | "delete_all">("move_to_default");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => {
        if (!busy) onCancel();
      }}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-[12px] border border-[#eaeaea] bg-white p-5 shadow-xl space-y-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-collection-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[8px] bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700 shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 id="delete-collection-title" className="text-sm font-semibold text-[#171717]">Delete Collection</h3>
              <p className="text-xs text-[#666666]">
                Remove <span className="font-medium text-[#171717]">"{collectionName}"</span> ({docCount} document{docCount === 1 ? "" : "s"})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="p-1 text-[#7d7d7d] hover:text-[#171717] rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}

        <div className="space-y-2">
          <label
            className={`flex items-start gap-2.5 p-3 rounded-[8px] border cursor-pointer transition-colors ${
              mode === "move_to_default"
                ? "border-[#171717] bg-[#fafafa]"
                : "border-[#eaeaea] hover:border-[#171717]/40"
            }`}
          >
            <input
              type="radio"
              name="delete-collection-mode"
              checked={mode === "move_to_default"}
              onChange={() => setMode("move_to_default")}
              className="mt-0.5 accent-[#171717]"
            />
            <div className="text-xs">
              <div className="font-medium text-[#171717]">
                Delete only the collection and keep documents
              </div>
              <p className="text-[#666666] mt-0.5">
                Moves all documents into the default Unassigned collection and preserves their search index.
              </p>
            </div>
          </label>

          <label
            className={`flex items-start gap-2.5 p-3 rounded-[8px] border cursor-pointer transition-colors ${
              mode === "delete_all"
                ? "border-rose-600 bg-rose-50/40"
                : "border-[#eaeaea] hover:border-rose-300"
            }`}
          >
            <input
              type="radio"
              name="delete-collection-mode"
              checked={mode === "delete_all"}
              onChange={() => setMode("delete_all")}
              className="mt-0.5 accent-rose-600"
            />
            <div className="text-xs">
              <div className="font-medium text-rose-800">
                Delete collection and all its contents
              </div>
              <p className="text-rose-700/80 mt-0.5">
                Permanently deletes all subsections, documents, and indexed vector chunks in this collection.
              </p>
            </div>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-3 py-1.5 rounded-[8px] border border-[#eaeaea] bg-white text-xs font-medium text-[#171717] hover:bg-[#fafafa]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(mode)}
            disabled={busy}
            className={`px-3 py-1.5 rounded-[8px] text-xs font-medium text-white transition-colors ${
              mode === "delete_all"
                ? "bg-rose-600 hover:bg-rose-700"
                : "bg-[#171717] hover:bg-black"
            } disabled:opacity-50`}
          >
            {busy ? "Deleting..." : "Confirm Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface SimpleConfirmModalProps {
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  error?: string | null;
  checkboxLabel?: string;
  onConfirm: (checked: boolean) => void;
  onCancel: () => void;
}

export function SimpleConfirmModal({
  title,
  description,
  confirmLabel = "Delete",
  destructive = true,
  busy = false,
  error = null,
  checkboxLabel,
  onConfirm,
  onCancel,
}: SimpleConfirmModalProps) {
  const [checked, setChecked] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => {
        if (!busy) onCancel();
      }}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-[12px] border border-[#eaeaea] bg-white p-5 shadow-xl space-y-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="simple-confirm-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[8px] bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700 shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 id="simple-confirm-title" className="text-sm font-semibold text-[#171717]">{title}</h3>
              <p className="text-xs text-[#666666] mt-0.5">{description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="p-1 text-[#7d7d7d] hover:text-[#171717] rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {checkboxLabel && (
          <label className="flex items-center gap-2 p-2.5 rounded-[8px] border border-[#eaeaea] bg-[#fafafa] text-xs text-[#171717] cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="accent-rose-600"
            />
            <span>{checkboxLabel}</span>
          </label>
        )}

        {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-3 py-1.5 rounded-[8px] border border-[#eaeaea] bg-white text-xs font-medium text-[#171717] hover:bg-[#fafafa]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(checked)}
            disabled={busy}
            className={`px-3 py-1.5 rounded-[8px] text-xs font-medium text-white ${
              destructive ? "bg-rose-600 hover:bg-rose-700" : "bg-[#171717] hover:bg-black"
            } disabled:opacity-50`}
          >
            {busy ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

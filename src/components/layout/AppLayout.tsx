import React, { useState } from "react";
import { Sidebar, type SidebarTab } from "./Sidebar";
import type { Conversation, SavedNote } from "../../types/conversation";
import type { CollectionRecord, DocumentRecord } from "../../lib/types";
import { Menu, Key } from "lucide-react";

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
  conversationError?: string | null;
  pendingRunId: string | null;
  onSelectTab: (tab: SidebarTab) => void;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void | Promise<void>;
  onDeleteConversation: (id: string) => Promise<void>;
  onRenameConversation: (id: string, title: string) => Promise<void>;
  onTogglePin: (id: string) => void | Promise<void>;
  onAssignCollection: (convId: string, colId?: string) => void | Promise<void>;
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
  onOpenSettings: () => void;
  children: React.ReactNode;
}

export function AppLayout({
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
  conversationError = null,
  pendingRunId,
  onSelectTab,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  onTogglePin,
  onAssignCollection,
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
  onOpenSettings,
  children,
}: Props) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const sidebarProps = {
    conversations,
    collections,
    documents,
    savedNotes,
    activeId,
    activeTab,
    selectedCollectionId,
    selectedSubsectionId,
    collectionsLoading,
    collectionsError,
    conversationError,
    onClearConversationError,
    onDeleteConversation,
    onRenameConversation,
    onTogglePin,
    onAssignCollection,
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
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-[#fafafa] text-[#171717] font-sans selection:bg-[#171717] selection:text-white">
      {/* Desktop Persistent Sidebar */}
      <div className="hidden md:flex h-full shrink-0">
        <Sidebar
          {...sidebarProps}
          onSelectTab={onSelectTab}
          onNewChat={onNewChat}
          onSelectConversation={onSelectConversation}
        />
      </div>

      {/* Mobile Drawer Sidebar */}
      {mobileSidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative z-10 w-72 h-full bg-[#fafafa] shadow-xl">
            <Sidebar
              {...sidebarProps}
              onSelectTab={(tab) => {
                onSelectTab(tab);
                setMobileSidebarOpen(false);
              }}
              onNewChat={() => {
                onNewChat();
                setMobileSidebarOpen(false);
              }}
              onSelectConversation={(id) => {
                onSelectConversation(id);
                setMobileSidebarOpen(false);
              }}
              onViewDocument={(document) => {
                onViewDocument(document);
                setMobileSidebarOpen(false);
              }}
              onCloseMobile={() => setMobileSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main Workspace Column */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Mobile top navigation bar */}
        <div className="md:hidden h-12 border-b border-[#eaeaea] bg-white px-3 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className="p-1.5 rounded-[6px] hover:bg-[#fafafa] text-[#171717]"
          >
            <Menu className="w-4 h-4" />
          </button>

          <span className="text-xs font-semibold tracking-tight text-[#171717]">
            Research Assistant
          </span>

          <button
            type="button"
            onClick={onOpenSettings}
            className={`p-1.5 rounded-[6px] text-xs flex items-center gap-1 ${
              pendingRunId
                ? "bg-amber-100 text-amber-900 border border-amber-300"
                : "text-[#666666] hover:text-[#171717]"
            }`}
          >
            <Key className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content View Area */}
        <main className="flex-1 overflow-hidden flex flex-col min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}

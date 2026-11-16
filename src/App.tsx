
import { useCallback, useEffect, useRef, useState } from "react";
import { AppLayout } from "./components/layout/AppLayout";
import { type SidebarTab } from "./components/layout/Sidebar";
import { ChatWindow } from "./components/chat/ChatWindow";
import { LibraryPanel } from "./components/library/LibraryPanel";
import { SavedNotesPanel } from "./components/layout/SavedNotesPanel";
import { SettingsPanel } from "./components/layout/SettingsPanel";
import { useConversations } from "./hooks/useConversations";
import { useLibraryStore } from "./hooks/useLibraryStore";
import { ask, errorMessage, fetchTopics, getAccessCode } from "./lib/api";
import type { AskResponse, DocumentRecord, SearchScope } from "./lib/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function createMessageId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `message-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function App() {
  const [topics, setTopics] = useState<string[]>([]);
  const [searchScope, setSearchScope] = useState<SearchScope>({ kind: "all" });
  const [activeTab, setActiveTab] = useState<SidebarTab>("chat");
  const [loading, setLoading] = useState(false);
  const [accessCode, setAccessCodeState] = useState(() => getAccessCode());
  const [pendingRunId, setPendingRunId] = useState<string | null>(null);
  const [requestedDocumentId, setRequestedDocumentId] = useState<number | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const submissionInFlightRef = useRef(false);
  const initialUrlLoadedRef = useRef(false);
  const activeIdRef = useRef<string | null>(null);

  const {
    conversations,
    savedNotes,
    activeId,
    activeConversation,
    ready: conversationsReady,
    persistenceReady,
    loadingConversation,
    conversationError,
    clearConversationError,
    reloadConversations,
    createConversation,
    ensureConversation,
    selectConversation,
    selectConversationForRun,
    deleteConversation,
    togglePin,
    assignCollection,
    unassignDeletedCollection,
    updateConversationTitle,
    saveNote,
    deleteNote,
    appendMessage,
  } = useConversations();

  activeIdRef.current = activeId;

  // Stop a pending request when the user leaves the conversation.
  // Do not create a fake "Cancelled" response.
  const cancelPendingQuestion = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    submissionInFlightRef.current = false;
    setLoading(false);
  };

  const refreshTopics = useCallback(() => {
    fetchTopics()
      .then(setTopics)
      .catch(() => {
        // Backend may be offline or starting.
      });
  }, []);

  const {
    collections,
    defaultCollectionId,
    documents,
    selectedCollectionId,
    selectedSubsectionId,
    loading: collectionsLoading,
    backendError: collectionsError,
    refreshLibrary,
    selectScope,
    createCollection,
    renameCollection,
    deleteCollection,
    createSubsection,
    renameSubsection,
    deleteSubsection,
    uploadDocuments,
    deleteDocument,
  } = useLibraryStore(refreshTopics);

  // Load topics from FastAPI.
  useEffect(() => {
    refreshTopics();
    return () => abortRef.current?.abort();
  }, [refreshTopics]);

  // Load a conversation from a shared run link.
  const loadSharedRun = useCallback(
    async (runId: string) => {
      try {
        await selectConversationForRun(runId);
        setPendingRunId(null);
        setActiveTab("chat");
      } catch {
        setPendingRunId(runId);
        setActiveTab("settings");
      }
    },
    [selectConversationForRun]
  );

  // Open the conversation identified in the browser URL.
  useEffect(() => {
    if (!conversationsReady || initialUrlLoadedRef.current) return;

    initialUrlLoadedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const run = params.get("run");
    const conversationId = params.get("conversation");

    if (run && UUID_RE.test(run)) {
      void loadSharedRun(run);
    } else if (conversationId) {
      void selectConversation(conversationId)
        .then(() => setActiveTab("chat"))
        .catch(() => undefined);
    }
  }, [conversationsReady, loadSharedRun, selectConversation]);

  // Ask a question using the current chat.
  const handleAskQuestion = async (
    question: string,
    overrideTopic?: string
  ) => {
    const cleanQuestion = question.trim();

    if (
      !cleanQuestion ||
      submissionInFlightRef.current ||
      !conversationsReady ||
      !persistenceReady
    ) {
      return;
    }

    submissionInFlightRef.current = true;

    abortRef.current?.abort();

    const ctl = new AbortController();
    abortRef.current = ctl;

    let topicToUse: string | null = overrideTopic || null;
    let collectionIdToUse: string | null = null;
    let subsectionIdToUse: string | null = null;

    if (!overrideTopic) {
      if (searchScope.kind === "topic") {
        topicToUse = searchScope.topic;
      } else if (searchScope.kind === "collection") {
        collectionIdToUse = searchScope.collectionId;
      } else if (searchScope.kind === "subsection") {
        collectionIdToUse = searchScope.collectionId;
        subsectionIdToUse = searchScope.subsectionId;
      }
    }

    // IMPORTANT:
    // Use the current conversation if one is selected.
    // Create a conversation only when the user sends
    // the first question in a new chat.
    let targetConvId = activeIdRef.current;

    if (!targetConvId) {
      targetConvId = createConversation(cleanQuestion.slice(0, 157));
    }

    setLoading(true);
    setActiveTab("chat");

    let userMessageAdded = false;
    const requestId = createMessageId();

    try {
      // Save the conversation record before sending the request.
      await ensureConversation(
        targetConvId,
        cleanQuestion.slice(0, 157)
      );

      // Ignore a request cancelled by New Chat.
      if (ctl.signal.aborted) return;

      appendMessage(targetConvId, {
        id: requestId,
        role: "user",
        content: cleanQuestion,
        timestamp: new Date().toISOString(),
      });

      userMessageAdded = true;

      const res: AskResponse = await ask(
        {
          question: cleanQuestion,
          topic: topicToUse,
          collection_id: collectionIdToUse,
          subsection_id: subsectionIdToUse,
          mode: "agentic",
          conversation_id: targetConvId,
          message_id: requestId,
        },
        ctl.signal
      );

      if (ctl.signal.aborted) return;

      appendMessage(targetConvId, {
        id: `assistant-${requestId}`,
        role: "assistant",
        content: res.answer,
        timestamp: new Date().toISOString(),
        ...(res.run_id ? { runId: res.run_id } : {}),
        response: res,
      });

      // Keep the browser URL linked to the active conversation.
      if (activeIdRef.current === targetConvId) {
        window.history.replaceState(
          null,
          "",
          `?conversation=${encodeURIComponent(targetConvId)}`
        );
      }
    } catch (e) {
      // Expected cancellation is not an application error.
      if (ctl.signal.aborted) return;

      const msg = errorMessage(e);

      if (!userMessageAdded) {
        appendMessage(targetConvId, {
          id: requestId,
          role: "user",
          content: cleanQuestion,
          timestamp: new Date().toISOString(),
        });
      }

      appendMessage(targetConvId, {
        id: `error-${createMessageId()}`,
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
        error: msg,
      });

      if (msg.toLowerCase().includes("access code")) {
        setActiveTab("settings");
      }
    } finally {
      // An old request must not change the loading state
      // of a new request.
      if (abortRef.current === ctl) {
        abortRef.current = null;
        setLoading(false);
        submissionInFlightRef.current = false;
      }
    }
  };

  const handleShareRun = (runId: string) => {
    const url =
      `${window.location.origin}${window.location.pathname}?run=${runId}`;

    navigator.clipboard.writeText(url);
  };

  const handleDeleteCollection = async (
    id: string,
    mode: "delete_all" | "move_to_default"
  ) => {
    const res = await deleteCollection(id, mode);

    unassignDeletedCollection(id);

    if (
      (searchScope.kind === "collection" &&
        searchScope.collectionId === id) ||
      (searchScope.kind === "subsection" &&
        searchScope.collectionId === id)
    ) {
      setSearchScope({ kind: "all" });
    }

    return res;
  };

  const handleDeleteSubsection = async (
    subsectionId: string,
    deleteDocs: boolean
  ) => {
    const res = await deleteSubsection(subsectionId, deleteDocs);

    if (
      searchScope.kind === "subsection" &&
      searchScope.subsectionId === subsectionId
    ) {
      setSearchScope({ kind: "all" });
    }

    return res;
  };

  return (
    <AppLayout
      conversations={conversations}
      collections={collections}
      documents={documents}
      savedNotes={savedNotes}
      activeId={activeId}
      activeTab={activeTab}
      selectedCollectionId={selectedCollectionId}
      selectedSubsectionId={selectedSubsectionId}
      collectionsLoading={collectionsLoading}
      collectionsError={collectionsError}
      conversationError={conversationError}
      pendingRunId={pendingRunId}
      onSelectTab={setActiveTab}
      onNewChat={() => {
        cancelPendingQuestion();

        // NEW CHAT FIX:
        // Open a blank chat without saving an empty record.
        void selectConversation(null);

        window.history.replaceState(
          null,
          "",
          window.location.pathname
        );

        setActiveTab("chat");
      }}
      onSelectConversation={async (id) => {
        cancelPendingQuestion();

        try {
          await selectConversation(id);

          window.history.replaceState(
            null,
            "",
            `?conversation=${encodeURIComponent(id)}`
          );

          setActiveTab("chat");
        } catch {
          // The hook reports the error.
        }
      }}
      onDeleteConversation={async (id) => {
        if (id === activeIdRef.current) {
          cancelPendingQuestion();
        }

        await deleteConversation(id);

        if (id === activeId) {
          window.history.replaceState(
            null,
            "",
            window.location.pathname
          );
        }
      }}
      onRenameConversation={updateConversationTitle}
      onTogglePin={togglePin}
      onAssignCollection={assignCollection}
      onClearConversationError={clearConversationError}
      onCreateCollection={createCollection}
      onRenameCollection={renameCollection}
      onDeleteCollection={handleDeleteCollection}
      onCreateSubsection={createSubsection}
      onRenameSubsection={renameSubsection}
      onDeleteSubsection={handleDeleteSubsection}
      onSelectCollectionScope={(colId, subId) =>
        selectScope(colId, subId ?? null)
      }
      onUploadToDestination={(files, colId, subId) =>
        uploadDocuments(files, {
          collectionId: colId,
          subsectionId: subId || null,
        })
      }
      onDeleteDocument={deleteDocument}
      onViewDocument={(document: DocumentRecord) => {
        selectScope(
          document.collection_id ?? null,
          document.subsection_id ?? null
        );

        setRequestedDocumentId(document.id);
        setActiveTab("library");
      }}
      onOpenSettings={() => setActiveTab("settings")}
    >
      {activeTab === "chat" && (
        <ChatWindow
          conversation={activeConversation}
          loading={
            loading ||
            !conversationsReady ||
            !persistenceReady ||
            loadingConversation
          }
          topics={topics}
          collections={collections}
          defaultCollectionId={defaultCollectionId}
          documentCount={documents.length}
          searchScope={searchScope}
          onSelectScope={setSearchScope}
          onSubmitQuestion={(q) => handleAskQuestion(q)}
          onUploadDocuments={uploadDocuments}
          onSaveAsNote={(title, content, sources, citations) => {
            saveNote({
              title,
              content,
              sources,
              citations,
              conversationId: activeId || undefined,
            });
          }}
          onShareRun={handleShareRun}
          onAssignCollection={(colId) => {
            if (activeId) {
              assignCollection(activeId, colId);
            }
          }}
          onOpenLibrary={() => setActiveTab("library")}
        />
      )}

      {activeTab === "library" && (
        <LibraryPanel
          collections={collections}
          documents={documents}
          selectedCollectionId={selectedCollectionId}
          selectedSubsectionId={selectedSubsectionId}
          loading={collectionsLoading}
          backendError={collectionsError}
          onSelectScope={(colId, subId) =>
            selectScope(colId, subId ?? null)
          }
          onUploadDocuments={uploadDocuments}
          onDeleteDocument={deleteDocument}
          requestedDocumentId={requestedDocumentId}
          onDocumentOpened={() => setRequestedDocumentId(null)}
          onAskQuestion={(query, topic) => {
            handleAskQuestion(query, topic);
          }}
          onAskInScope={(scope) => {
            setSearchScope(scope);
            setActiveTab("chat");
          }}
        />
      )}

      {activeTab === "notes" && (
        <SavedNotesPanel
          notes={savedNotes}
          onDeleteNote={deleteNote}
          onOpenConversation={(convId) => {
            cancelPendingQuestion();

            void selectConversation(convId)
              .then(() => {
                window.history.replaceState(
                  null,
                  "",
                  `?conversation=${encodeURIComponent(convId)}`
                );

                setActiveTab("chat");
              })
              .catch(() => undefined);
          }}
        />
      )}

      {activeTab === "settings" && (
        <SettingsPanel
          accessCode={accessCode}
          onUpdateAccessCode={(code) => {
            setAccessCodeState(code);
            refreshLibrary();
            refreshTopics();
            reloadConversations();
          }}
          pendingRunId={pendingRunId}
          onRetryPendingRun={() => {
            if (pendingRunId) {
              loadSharedRun(pendingRunId);
            }
          }}
          onApiUrlChanged={() => {
            refreshTopics();
            refreshLibrary();
            reloadConversations();
          }}
        />
      )}
    </AppLayout>
  );
}

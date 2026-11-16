
import { useState, useEffect, useCallback, useRef } from "react";
import type {
  Conversation,
  ConversationRecord,
  Message,
  SavedNote,
} from "../types/conversation";

import {
  createConversationApi,
  deleteConversationApi,
  errorMessage,
  fetchConversationApi,
  fetchConversationForRunApi,
  fetchConversationsApi,
  getApiUrl,
  importConversationsApi,
  updateConversationApi,
} from "../lib/api";

const STORAGE_KEY_CONV = "rag_conversations_v1";
const STORAGE_KEY_ACTIVE = "rag_active_conversation_v1";
const STORAGE_KEY_NOTES = "rag_saved_notes_v1";

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return fallback;
    }

    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error(`Failed to load ${key} from localStorage`, e);
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }

    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Failed to save ${key} to localStorage`, e);
  }
}

function removeFromStorage(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch (e) {
    console.error(`Failed to remove ${key} from localStorage`, e);
  }
}

function createId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `conversation-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function titleFromQuestion(question: string): string {
  return (
    question.slice(0, 157) +
    (question.length > 157 ? "..." : "")
  );
}

function toConversation(record: ConversationRecord): Conversation {
  const messages: Message[] = (record.messages || []).map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    timestamp: message.timestamp,
    ...(message.run_id ? { runId: message.run_id } : {}),
    ...(message.response ? { response: message.response } : {}),
    ...(message.error ? { error: message.error } : {}),
  }));

  return {
    id: record.id,
    title: record.title,
    messages,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    isPinned: record.is_pinned,
    ...(record.collection_id
      ? { collectionId: record.collection_id }
      : {}),
    runIds: record.run_ids || [],
    ...(record.search_text
      ? { searchText: record.search_text }
      : {}),
    isDraft: false,
  };
}

// A conversation appears in History only if it contains
// at least one real user question.
function hasUserQuestion(conversation: Conversation): boolean {
  return (
    Array.isArray(conversation.messages) &&
    conversation.messages.some(
      (message) =>
        message?.role === "user" &&
        typeof message.content === "string" &&
        message.content.trim().length > 0
    )
  );
}

// Remove blank chats and exact duplicates.
// Do not deduplicate by title because different chats
// may contain the same question.
function visibleHistory(items: Conversation[]): Conversation[] {
  const ids = new Set<string>();
  const singleRunIds = new Set<string>();

  return items.filter((conversation) => {
    if (
      !conversation ||
      typeof conversation.id !== "string" ||
      !hasUserQuestion(conversation)
    ) {
      return false;
    }

    if (ids.has(conversation.id)) {
      return false;
    }

    ids.add(conversation.id);

    if (conversation.messages.length === 2) {
      const assistant = conversation.messages.find(
        (message) => message.role === "assistant"
      );

      const runId =
        assistant?.runId || assistant?.response?.run_id;

      if (runId) {
        if (singleRunIds.has(runId)) {
          return false;
        }

        singleRunIds.add(runId);
      }
    }

    return true;
  });
}

function storedHistory(): Conversation[] {
  const raw = loadFromStorage<unknown>(STORAGE_KEY_CONV, []);

  return Array.isArray(raw)
    ? visibleHistory(raw as Conversation[])
    : [];
}

function toLegacyImport(conversations: Conversation[]) {
  return visibleHistory(conversations).map((conversation) => ({
    id: conversation.id,
    title: conversation.title || "Untitled Conversation",
    created_at: conversation.createdAt,
    updated_at: conversation.updatedAt,
    is_pinned: Boolean(conversation.isPinned),

    ...(conversation.collectionId
      ? { collection_id: conversation.collectionId }
      : {}),

    messages: conversation.messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      timestamp: message.timestamp,
      ...(message.response
        ? { response: message.response }
        : {}),
      ...(message.error ? { error: message.error } : {}),
    })),
  }));
}

// Prevent duplicate imports when React StrictMode
// runs startup effects more than once.
const importInFlight = new Map<string, Promise<void>>();

async function importLegacyOnce(
  marker: string,
  items: Conversation[]
): Promise<void> {
  if (window.localStorage.getItem(marker) === "true") {
    return;
  }

  const existing = importInFlight.get(marker);

  if (existing) {
    return existing;
  }

  const task = (async () => {
    const payload = toLegacyImport(visibleHistory(items));

    if (payload.length > 0) {
      await importConversationsApi(payload);
    }

    window.localStorage.setItem(marker, "true");
  })();

  importInFlight.set(marker, task);

  try {
    await task;
  } finally {
    importInFlight.delete(marker);
  }
}

// Load complete records before deciding if a chat
// has messages. Some API list responses contain
// metadata but no messages.
async function fetchNonemptyHistory(
  records: ConversationRecord[],
  cache: Conversation[]
): Promise<Conversation[]> {
  const restored: Conversation[] = [];

  const cachedById = new Map(
    cache.map((item) => [item.id, item])
  );

  // Read records in small batches.
  for (let start = 0; start < records.length; start += 5) {
    const batch = records.slice(start, start + 5);

    const resolved = await Promise.all(
      batch.map(async (record) => {
        const summary = toConversation(record);

        if (hasUserQuestion(summary)) {
          return summary;
        }

        try {
          const detail = toConversation(
            await fetchConversationApi(record.id)
          );

          const cached = cachedById.get(record.id);

          // Keep a local backup if the server has an
          // empty record but the browser has real messages.
          if (
            !hasUserQuestion(detail) &&
            cached &&
            hasUserQuestion(cached)
          ) {
            return {
              ...detail,
              messages: cached.messages,
              title: cached.title,
              runIds:
                cached.runIds || detail.runIds,
              searchText:
                cached.searchText || detail.searchText,
            };
          }

          return detail;
        } catch {
          // A temporary API error must not erase a
          // previously cached real conversation.
          return cachedById.get(record.id) || summary;
        }
      })
    );

    restored.push(...resolved);
  }

  return visibleHistory(restored);
}

export function useConversations() {
  const [conversations, setConversations] =
    useState<Conversation[]>(storedHistory);

  const [savedNotes, setSavedNotes] = useState<SavedNote[]>(
    () => loadFromStorage<SavedNote[]>(STORAGE_KEY_NOTES, [])
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [persistenceReady, setPersistenceReady] = useState(false);
  const [loadingConversation, setLoadingConversation] =
    useState(false);
  const [conversationError, setConversationError] =
    useState<string | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);

  const draftIdRef = useRef<string | null>(null);

  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  const ensureInFlightRef = useRef(
    new Map<string, Promise<void>>()
  );

  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

  // Restore conversations from backend storage.
  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      try {
        const legacy = storedHistory();

        const marker =
          `rag_conversations_imported_v1:${getApiUrl()}`;

        await importLegacyOnce(marker, legacy);

        const records = await fetchConversationsApi();

        const list = await fetchNonemptyHistory(
          records,
          legacy
        );

        const savedActiveId =
          window.localStorage.getItem(STORAGE_KEY_ACTIVE);

        const restoredId = list.some(
          (item) => item.id === savedActiveId
        )
          ? savedActiveId
          : list[0]?.id || null;

        if (cancelled) return;

        setConversations(list);
        activeIdRef.current = restoredId;
        setActiveId(restoredId);
        setPersistenceReady(true);
        setConversationError(null);
      } catch (error) {
        if (cancelled) return;

        setPersistenceReady(false);
        setConversationError(errorMessage(error));

        const storedId = loadFromStorage<string | null>(
          STORAGE_KEY_ACTIVE,
          null
        );

        const local = storedHistory();

        setConversations(local);

        const fallbackId = local.some(
          (item) => item.id === storedId
        )
          ? storedId
          : local[0]?.id || null;

        activeIdRef.current = fallbackId;
        setActiveId(fallbackId);
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    };

    void restore();

    return () => {
      cancelled = true;
    };
  }, [reloadCounter]);

  // Save notes without changing their existing behavior.
  useEffect(() => {
    saveToStorage(STORAGE_KEY_NOTES, savedNotes);
  }, [savedNotes]);

  // Save only conversations with real questions.
  useEffect(() => {
    if (!ready) return;

    saveToStorage(
      STORAGE_KEY_CONV,
      visibleHistory(conversations)
    );
  }, [conversations, ready]);

  // Save the selected conversation ID.
  useEffect(() => {
    if (!ready) return;

    const active = conversations.find(
      (item) => item.id === activeId
    );

    if (active && !active.isDraft) {
      saveToStorage(STORAGE_KEY_ACTIVE, active.id);
    } else {
      removeFromStorage(STORAGE_KEY_ACTIVE);
    }
  }, [activeId, conversations, ready]);

  const activeConversation =
    conversations.find((c) => c.id === activeId) || null;

  // Only display question-bearing chats in the sidebar.
  const historyConversations = visibleHistory(conversations);

  const reloadConversations = useCallback(() => {
    setReady(false);
    setPersistenceReady(false);
    setReloadCounter((count) => count + 1);
  }, []);

  // Create a local conversation draft.
  // This function does NOT save the draft to the backend.
  const createConversation = useCallback(
    (firstTitle?: string): string => {
      // Reuse the selected conversation for additional
      // questions until the user clicks New Chat.
      if (firstTitle?.trim() && activeIdRef.current) {
        const active = conversationsRef.current.find(
          (item) => item.id === activeIdRef.current
        );

        if (active) {
          return active.id;
        }
      }

      if (draftIdRef.current) {
        return draftIdRef.current;
      }

      const existingDraft = conversationsRef.current.find(
        (conversation) =>
          conversation.isDraft &&
          conversation.messages.length === 0
      );

      if (existingDraft) {
        draftIdRef.current = existingDraft.id;
        activeIdRef.current = existingDraft.id;
        setActiveId(existingDraft.id);

        return existingDraft.id;
      }

      const id = createId();
      const now = new Date().toISOString();

      const newConversation: Conversation = {
        id,
        title: firstTitle || "New Research Chat",
        messages: [],
        createdAt: now,
        updatedAt: now,
        isPinned: false,
        isDraft: true,
      };

      draftIdRef.current = id;

      const updatedConversations = [
        newConversation,
        ...conversationsRef.current,
      ];

      conversationsRef.current = updatedConversations;

      setConversations(updatedConversations);
      activeIdRef.current = id;
      setActiveId(id);
      setConversationError(null);

      return id;
    },
    []
  );

  // Create the backend record only when the
  // first question is actually being submitted.
  const ensureConversation = useCallback(
    (id: string, title: string): Promise<void> => {
      const pending = ensureInFlightRef.current.get(id);

      if (pending) {
        return pending;
      }

      const existing = conversationsRef.current.find(
        (item) => item.id === id
      );

      if (!existing) {
        return Promise.reject(
          new Error(
            "The selected conversation is no longer available."
          )
        );
      }

      if (!existing.isDraft) {
        return Promise.resolve();
      }

      const task = (async () => {
        try {
          const record = await createConversationApi(
            id,
            title
          );

          const created = toConversation(record);

          setConversations((previous) =>
            previous.map((item) => {
              if (item.id !== id) {
                return item;
              }

              // Preserve messages written locally while
              // the server was creating the record.
              return {
                ...created,
                title: item.messages.some(
                  (message) => message.role === "user"
                )
                  ? item.title
                  : created.title,
                messages:
                  item.messages.length > 0
                    ? item.messages
                    : created.messages,
                runIds: Array.from(
                  new Set([
                    ...(created.runIds || []),
                    ...(item.runIds || []),
                  ])
                ),
                searchText:
                  item.searchText || created.searchText,
              };
            })
          );

          if (draftIdRef.current === id) {
            draftIdRef.current = null;
          }

          setConversationError(null);
        } catch (error) {
          setConversationError(errorMessage(error));
          throw error;
        } finally {
          ensureInFlightRef.current.delete(id);
        }
      })();

      ensureInFlightRef.current.set(id, task);

      return task;
    },
    []
  );

  // Select an existing chat or open a blank chat.
  const selectConversation = useCallback(
    async (id: string | null) => {
      if (id === null) {
        activeIdRef.current = null;
        setActiveId(null);
        draftIdRef.current = null;
        return;
      }

      const existing = conversationsRef.current.find(
        (item) => item.id === id
      );

      if (!existing) return;

      if (existing.isDraft) {
        activeIdRef.current = id;
        setActiveId(id);
        draftIdRef.current = id;
        return;
      }

      setLoadingConversation(true);

      try {
        const record = await fetchConversationApi(id);
        const loaded = toConversation(record);

        setConversations((previous) =>
          previous.map((item) =>
            item.id === id ? loaded : item
          )
        );

        activeIdRef.current = id;
        setActiveId(id);
        draftIdRef.current = null;
        setConversationError(null);
      } catch (error) {
        setConversationError(errorMessage(error));
        throw error;
      } finally {
        setLoadingConversation(false);
      }
    },
    []
  );

  // Open a conversation associated with a shared run.
  const selectConversationForRun = useCallback(
    async (runId: string) => {
      setLoadingConversation(true);

      try {
        const record = await fetchConversationForRunApi(
          runId
        );

        const loaded = toConversation(record);

        setConversations((previous) => [
          loaded,
          ...previous.filter(
            (item) => item.id !== loaded.id
          ),
        ]);

        activeIdRef.current = loaded.id;
        setActiveId(loaded.id);
        draftIdRef.current = null;
        setConversationError(null);
      } catch (error) {
        setConversationError(errorMessage(error));
        throw error;
      } finally {
        setLoadingConversation(false);
      }
    },
    []
  );

  // Delete one selected conversation.
  const deleteConversation = useCallback(
    async (id: string) => {
      const target = conversationsRef.current.find(
        (item) => item.id === id
      );

      if (!target) return;

      const wasActive = activeId === id;

      const nextConversation = conversationsRef.current.find(
        (item) => item.id !== id
      );

      try {
        if (!target.isDraft) {
          await deleteConversationApi(id);
        }

        setConversationError(null);

        setConversations((previous) =>
          previous.filter((item) => item.id !== id)
        );

        if (draftIdRef.current === id) {
          draftIdRef.current = null;
        }

        if (wasActive) {
          activeIdRef.current = null;
          setActiveId(null);

          if (nextConversation) {
            try {
              await selectConversation(
                nextConversation.id
              );
            } catch {
              // Deletion succeeded. Selection error
              // is reported by selectConversation.
            }
          }
        }
      } catch (error) {
        setConversationError(errorMessage(error));
        throw error;
      }
    },
    [activeId, selectConversation]
  );

  // Rename, pin, or assign a conversation.
  const updateConversation = useCallback(
    async (
      id: string,
      changes: {
        title?: string;
        is_pinned?: boolean;
        collection_id?: string | null;
      }
    ) => {
      const current = conversationsRef.current.find(
        (item) => item.id === id
      );

      if (!current) return;

      const updatedAt = new Date().toISOString();

      if (current.isDraft) {
        setConversations((previous) =>
          previous.map((item) =>
            item.id === id
              ? {
                  ...item,
                  ...(changes.title !== undefined
                    ? { title: changes.title }
                    : {}),
                  ...(changes.is_pinned !== undefined
                    ? { isPinned: changes.is_pinned }
                    : {}),
                  ...(changes.collection_id !== undefined
                    ? {
                        collectionId:
                          changes.collection_id ||
                          undefined,
                      }
                    : {}),
                  updatedAt,
                }
              : item
          )
        );

        return;
      }

      try {
        const record = await updateConversationApi(
          id,
          changes
        );

        const updated = toConversation(record);

        setConversations((previous) =>
          previous.map((item) =>
            item.id === id
              ? {
                  ...updated,
                  messages: item.messages,
                }
              : item
          )
        );

        setConversationError(null);
      } catch (error) {
        setConversationError(errorMessage(error));
        throw error;
      }
    },
    []
  );

  const togglePin = useCallback(
    async (id: string) => {
      const current = conversationsRef.current.find(
        (item) => item.id === id
      );

      if (current) {
        await updateConversation(id, {
          is_pinned: !current.isPinned,
        });
      }
    },
    [updateConversation]
  );

  const assignCollection = useCallback(
    async (id: string, collectionId?: string) => {
      await updateConversation(id, {
        collection_id: collectionId || null,
      });
    },
    [updateConversation]
  );

  const unassignDeletedCollection = useCallback(
    (deletedCollectionId: string) => {
      setConversations((previous) =>
        previous.map((item) =>
          item.collectionId === deletedCollectionId
            ? {
                ...item,
                collectionId: undefined,
              }
            : item
        )
      );
    },
    []
  );

  const updateConversationTitle = useCallback(
    async (id: string, title: string) => {
      await updateConversation(id, { title });
    },
    [updateConversation]
  );

  // Append messages to the same conversation.
  const appendMessage = useCallback(
    (conversationId: string, message: Message) => {
      setConversations((previous) =>
        previous.map((conversation) => {
          if (conversation.id !== conversationId) {
            return conversation;
          }

          const title =
            conversation.messages.length === 0 &&
            message.role === "user"
              ? titleFromQuestion(message.content)
              : conversation.title;

          const runIds = message.runId
            ? Array.from(
                new Set([
                  ...(conversation.runIds || []),
                  message.runId,
                ])
              )
            : conversation.runIds;

          const searchText = [
            conversation.searchText,
            message.content,
          ]
            .filter(Boolean)
            .join(" ");

          return {
            ...conversation,
            title,
            updatedAt: message.timestamp,
            messages: [
              ...conversation.messages,
              message,
            ],
            searchText,
            ...(runIds ? { runIds } : {}),
          };
        })
      );
    },
    []
  );

  // Save a research note.
  const saveNote = useCallback(
    (
      note: Omit<SavedNote, "id" | "createdAt">
    ) => {
      const newNote: SavedNote = {
        ...note,
        id:
          `note-${Date.now()}-` +
          Math.random().toString(36).slice(2, 6),
        createdAt: new Date().toISOString(),
      };

      setSavedNotes((previous) => [
        newNote,
        ...previous,
      ]);
    },
    []
  );

  const deleteNote = useCallback(
    (id: string) => {
      setSavedNotes((previous) =>
        previous.filter((note) => note.id !== id)
      );
    },
    []
  );

  return {
    // The sidebar sees only chats with real questions.
    conversations: historyConversations,

    savedNotes,
    activeId,

    // The chat editor can still access an unsaved draft.
    activeConversation,

    ready,
    persistenceReady,
    loadingConversation,
    conversationError,

    clearConversationError: () =>
      setConversationError(null),

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
    appendMessage,
    saveNote,
    deleteNote,
  };
}

import type { AskResponse } from "../lib/types";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  runId?: string;
  // Included on assistant messages:
  response?: AskResponse;
  status?: string;
  error?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  isPinned: boolean;
  collectionId?: string;
  runIds?: string[];
  searchText?: string;
  isDraft?: boolean;
}

export interface ConversationMessageRecord {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  run_id: string | null;
  response?: AskResponse | null;
  error?: string | null;
}

export interface ConversationRecord {
  id: string;
  title: string;
  is_pinned: boolean;
  collection_id: string | null;
  created_at: string;
  updated_at: string;
  run_ids: string[];
  search_text?: string;
  messages?: ConversationMessageRecord[];
}

export interface Collection {
  id: string;
  name: string;
  color?: string;
  is_default?: boolean;
  createdAt?: string;
}

export interface SavedNote {
  id: string;
  title: string;
  content: string;
  conversationId?: string;
  createdAt: string;
  sources: Record<string, { doc: string; topic: string; text: string }>;
  citations?: number[];
}

export interface CorpusDocument {
  id: string;
  filename: string;
  path: string;
  topic: string;
  title: string;
  summary: string;
  sampleQuery: string;
}

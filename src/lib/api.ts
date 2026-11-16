import type {
  AskResponse,
  CollectionRecord,
  DocumentRecord,
  Mode,
  SubsectionRecord,
  UploadDocumentsResponse,
} from "./types";
import type {
  ConversationRecord,
} from "../types/conversation";

const trimTrailingSlashes = (url: string): string => url.trim().replace(/\/+$/, "");

const ENV_API = trimTrailingSlashes(import.meta.env.VITE_API_URL || "");

const API_TIMEOUTS = {
  default: 60_000,
  health: 10_000,
  topics: 30_000,
  collections: 60_000,
  documents: 60_000,
  research: 300_000,
} as const;

const ASK_TIMEOUT_MS = API_TIMEOUTS.research;

export function getApiUrl(): string {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const userUrl = window.localStorage.getItem("rag_api_url");
      if (userUrl && userUrl.trim()) {
        return trimTrailingSlashes(userUrl);
      }
    }
  } catch {
    // Storage can be unavailable in privacy-restricted contexts.
  }

  if (ENV_API) {
    return ENV_API;
  }

  // Local development fallback. A URL saved in Settings takes precedence.
  if (import.meta.env.DEV) {
    const host = typeof window !== "undefined" ? window.location?.hostname : undefined;
    if (!host || host === "localhost" || host === "127.0.0.1") {
      return "http://127.0.0.1:8000";
    }
  }

  return "";
}

export function setApiUrl(url: string): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const cleaned = trimTrailingSlashes(url);
      if (cleaned) {
        window.localStorage.setItem("rag_api_url", cleaned);
      } else {
        window.localStorage.removeItem("rag_api_url");
      }
    }
  } catch {
    // Ignore storage errors in privacy-restricted contexts.
  }
}

export function getAccessCode(): string {
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      return window.sessionStorage.getItem("rag_access_code") || "";
    }
  } catch {
    // Ignore storage errors.
  }
  return "";
}

export function setAccessCode(code: string): void {
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      window.sessionStorage.setItem("rag_access_code", code.trim());
    }
  } catch {
    // Ignore storage errors.
  }
}

function detailText(detail: unknown): string {
  if (typeof detail === "string") return detail;

  // FastAPI validation errors usually return an array of error objects.
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string };
    if (first && typeof first.msg === "string") return first.msg;
  }

  return "The request was not accepted.";
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs: number = API_TIMEOUTS.default,
  outer?: AbortSignal,
): Promise<T> {
  const baseUrl = getApiUrl();
  if (!baseUrl) {
    throw new Error(
      "Backend API URL is not configured. Please set VITE_API_URL or enter your FastAPI backend URL in Settings.",
    );
  }

  const controller = new AbortController();
  const forwardAbort = () => controller.abort();
  outer?.addEventListener("abort", forwardAbort, { once: true });

  // Handle an external signal that was aborted before this request began.
  if (outer?.aborted) controller.abort();

  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const accessCode = getAccessCode();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(accessCode ? { "X-Access-Code": accessCode } : {}),
    ...((init.headers as Record<string, string>) || {}),
  };

  try {
    const endpoint = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const response = await fetch(endpoint, {
      ...init,
      headers,
      signal: controller.signal,
    });

    const contentType = response.headers.get("content-type") || "";

    if (!response.ok) {
      const errorBody = contentType.includes("application/json")
        ? await response.json().catch(() => null)
        : null;
      throw new Error(detailText(errorBody?.detail));
    }

    if (!contentType.includes("application/json")) {
      throw new Error(
        `Server at ${baseUrl} returned a non-JSON response. Ensure your FastAPI backend is running.`,
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      if (outer?.aborted) {
        throw new Error("Request cancelled by the application.");
      }
      throw new Error(
        `Request timed out after ${timeoutMs / 1000} seconds: ${path}`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener("abort", forwardAbort);
  }
}

function check(data: unknown): AskResponse {
  const result = data as Partial<AskResponse> | null;
  if (
    !result ||
    typeof result.answer !== "string" ||
    typeof result.status !== "string" ||
    !result.sources ||
    !Array.isArray(result.trace)
  ) {
    throw new Error("The server sent an unexpected response.");
  }
  return result as AskResponse;
}

export async function ask(
  body: {
    question: string;
    topic: string | null;
    mode: Mode;
    collection_id?: string | null;
    subsection_id?: string | null;
    conversation_id?: string;
    message_id?: string;
  },
  signal: AbortSignal,
): Promise<AskResponse> {
  const payload: Record<string, unknown> = {
    question: body.question,
    topic: body.topic,
    mode: body.mode,
  };

  if (body.collection_id) payload.collection_id = body.collection_id;
  if (body.subsection_id) payload.subsection_id = body.subsection_id;
  if (body.conversation_id) payload.conversation_id = body.conversation_id;
  if (body.message_id) payload.message_id = body.message_id;

  const response = await request<unknown>(
    "/api/ask",
    { method: "POST", body: JSON.stringify(payload) },
    ASK_TIMEOUT_MS,
    signal,
  );

  return check(response);
}

export async function getRun(id: string): Promise<AskResponse> {
  const response = await request<unknown>(`/api/runs/${id}`);
  return check(response);
}

export async function fetchConversationsApi(): Promise<ConversationRecord[]> {
  const data = await request<{ conversations: ConversationRecord[] }>(
    "/api/conversations",
    {},
    API_TIMEOUTS.collections,
  );
  return data.conversations;
}

export async function fetchConversationApi(id: string): Promise<ConversationRecord> {
  return request(`/api/conversations/${encodeURIComponent(id)}`, {}, API_TIMEOUTS.collections);
}

export async function fetchConversationForRunApi(runId: string): Promise<ConversationRecord> {
  return request(
    `/api/conversations/by-run/${encodeURIComponent(runId)}`,
    {},
    API_TIMEOUTS.collections,
  );
}

export async function createConversationApi(
  id: string,
  title: string,
  collectionId?: string,
): Promise<ConversationRecord> {
  return request("/api/conversations", {
    method: "POST",
    body: JSON.stringify({
      id,
      title,
      ...(collectionId ? { collection_id: collectionId } : {}),
    }),
  });
}

export async function importConversationsApi(
  conversations: Array<{
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
    is_pinned: boolean;
    collection_id?: string;
    messages: Array<{
      id: string;
      role: "user" | "assistant";
      content: string;
      timestamp: string;
      response?: AskResponse;
      error?: string;
    }>;
  }>,
): Promise<{ imported: number }> {
  return request("/api/conversations/import", {
    method: "POST",
    body: JSON.stringify({ conversations }),
  }, API_TIMEOUTS.collections);
}

export async function updateConversationApi(
  id: string,
  changes: { title?: string; is_pinned?: boolean; collection_id?: string | null },
): Promise<ConversationRecord> {
  return request(`/api/conversations/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(changes),
  });
}

export async function deleteConversationApi(id: string): Promise<void> {
  await request(`/api/conversations/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function fetchTopics(): Promise<string[]> {
  const data = await request<{ topics: string[] }>(
    "/api/topics",
    {},
    API_TIMEOUTS.topics,
  );
  return data.topics;
}

// ------------ Collections, subsections, and documents ------------

export async function fetchCollectionsApi(): Promise<{
  collections: CollectionRecord[];
  default_collection_id: string;
}> {
  return request("/api/collections", {}, API_TIMEOUTS.collections);
}

export async function createCollectionApi(name: string): Promise<CollectionRecord> {
  return request("/api/collections", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function renameCollectionApi(
  id: string,
  name: string,
): Promise<CollectionRecord> {
  return request(`/api/collections/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export async function deleteCollectionApi(
  id: string,
  mode: "delete_all" | "move_to_default",
): Promise<{
  deleted_collection_id: string;
  mode: string;
  deleted_doc_ids: number[];
  moved_doc_ids: number[];
  default_collection_id: string | null;
}> {
  return request(`/api/collections/${id}?mode=${encodeURIComponent(mode)}`, {
    method: "DELETE",
  });
}

export async function createSubsectionApi(
  collectionId: string,
  name: string,
): Promise<SubsectionRecord> {
  return request(`/api/collections/${collectionId}/subsections`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function renameSubsectionApi(
  id: string,
  name: string,
): Promise<SubsectionRecord> {
  return request(`/api/subsections/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export async function deleteSubsectionApi(
  id: string,
  deleteDocuments = false,
): Promise<{
  deleted_subsection_id: string;
  collection_id: string;
  deleted_doc_ids: number[];
  moved_doc_ids: number[];
}> {
  return request(
    `/api/subsections/${id}?delete_documents=${deleteDocuments ? "true" : "false"}`,
    { method: "DELETE" },
  );
}

export async function fetchDocumentsApi(params?: {
  collectionId?: string | null;
  subsectionId?: string | null;
  unassigned?: boolean;
}): Promise<DocumentRecord[]> {
  const qs = new URLSearchParams();

  if (params?.subsectionId) qs.set("subsection_id", params.subsectionId);
  else if (params?.collectionId) qs.set("collection_id", params.collectionId);
  if (params?.unassigned) qs.set("unassigned", "true");

  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const data = await request<{ documents: DocumentRecord[] }>(
    `/api/documents${suffix}`,
    {},
    API_TIMEOUTS.documents,
  );
  return data.documents;
}

export async function fetchDocumentDetailApi(
  docId: number,
): Promise<DocumentRecord> {
  return request(`/api/documents/${docId}`, {}, API_TIMEOUTS.documents);
}

export async function deleteDocumentApi(
  docId: number,
): Promise<{ deleted_doc_id: number; path: string }> {
  return request(`/api/documents/${docId}`, {
    method: "DELETE",
  });
}

export function uploadDocumentsApi(
  files: File[],
  options?: {
    collectionId?: string | null;
    subsectionId?: string | null;
    onProgress?: (percent: number) => void;
  },
): Promise<UploadDocumentsResponse> {
  const baseUrl = getApiUrl();
  if (!baseUrl) {
    return Promise.reject(
      new Error("Backend API URL is not configured. Please enter your FastAPI backend URL in Settings."),
    );
  }

  if (!files.length) {
    return Promise.reject(new Error("Select at least one file to upload."));
  }

  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }

  if (options?.collectionId) {
    formData.append("collection_id", options.collectionId);
  }
  if (options?.subsectionId) {
    formData.append("subsection_id", options.subsectionId);
  }

  const code = getAccessCode();
  const endpoint = `${baseUrl}/api/documents/upload`;

  // XHR supports progress events when sending multipart/form-data.
  if (typeof XMLHttpRequest !== "undefined") {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", endpoint);

      if (code) {
        xhr.setRequestHeader("X-Access-Code", code);
      }

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && options?.onProgress) {
          const percent = Math.min(99, Math.round((event.loaded / event.total) * 100));
          options.onProgress(percent);
        }
      };

      xhr.onload = () => {
        let parsed: unknown = null;
        try {
          parsed = xhr.responseText ? JSON.parse(xhr.responseText) : null;
        } catch {
          parsed = null;
        }

        if (xhr.status >= 200 && xhr.status < 300 && parsed) {
          options?.onProgress?.(100);
          resolve(parsed as UploadDocumentsResponse);
        } else {
          const errorDetail = (parsed as { detail?: unknown } | null)?.detail;
          reject(
            new Error(
              errorDetail
                ? detailText(errorDetail)
                : `Upload failed with HTTP ${xhr.status}.`,
            ),
          );
        }
      };

      xhr.onerror = () => {
        reject(
          new Error(
            `Cannot connect to FastAPI backend server (${baseUrl}). Ensure the backend is running and CORS allows uploads.`,
          ),
        );
      };

      xhr.send(formData);
    });
  }

  return fetch(endpoint, {
    method: "POST",
    headers: code ? { "X-Access-Code": code } : {},
    body: formData,
  }).then(async (response) => {
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(detailText(body?.detail));
    }
    options?.onProgress?.(100);
    return body as UploadDocumentsResponse;
  });
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    const url = getApiUrl() || "the configured backend URL";
    const message = error.message.toLowerCase();

    if (message.includes("failed to fetch") || message.includes("networkerror")) {
      return `Cannot connect to FastAPI backend server (${url}). Please ensure your backend is running, accessible, and ALLOWED_ORIGINS includes this frontend origin.`;
    }

    return error.message;
  }

  return "Something went wrong.";
}

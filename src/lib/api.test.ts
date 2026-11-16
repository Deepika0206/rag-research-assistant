import { describe, expect, test, beforeEach, vi } from "vitest";
import { getAccessCode, setAccessCode, getApiUrl, setApiUrl, ask } from "./api";

const mockStorage: Record<string, string> = {};
const mockLocalStorage: Record<string, string> = {};

const createStorage = (store: Record<string, string>) => ({
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    for (const k of Object.keys(store)) {
      delete store[k];
    }
  },
});

const mockSessionStorage = createStorage(mockStorage);
const mockLocal = createStorage(mockLocalStorage);

// Polyfill window.sessionStorage and window.localStorage in node test environment
(globalThis as unknown as { window: unknown }).window = {
  sessionStorage: mockSessionStorage,
  localStorage: mockLocal,
};

describe("access code and backend url management", () => {
  beforeEach(() => {
    mockSessionStorage.clear();
    mockLocal.clear();
    vi.restoreAllMocks();
  });

  test("getApiUrl and setApiUrl allow dynamic configuration", () => {
    setApiUrl("https://my-rag-fastapi.onrender.com/");
    expect(getApiUrl()).toBe("https://my-rag-fastapi.onrender.com");
    setApiUrl("");
    expect(mockLocalStorage["rag_api_url"]).toBeUndefined();
  });

  test("getAccessCode returns empty string by default", () => {
    expect(getAccessCode()).toBe("");
  });

  test("setAccessCode saves trimmed code to sessionStorage", () => {
    setAccessCode("  secret123  ");
    expect(getAccessCode()).toBe("secret123");
    expect(mockStorage["rag_access_code"]).toBe("secret123");
  });

  test("request sends X-Access-Code header when access code is set", async () => {
    setAccessCode("my-secret-key");

    let capturedHeaders: Record<string, string> = {};
    const fetchMock = vi.fn().mockImplementation((_url, init) => {
      capturedHeaders = init.headers;
      return Promise.resolve({
        ok: true,
        headers: { get: () => "application/json" },
        json: () =>
          Promise.resolve({
            answer: "Binary search runs in O(log n). [1]",
            status: "answered",
            sources: { "1": { chunk_id: 1, topic: "searching", doc: "searching/binary_search.md", text: "..." } },
            trace: [],
          }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const ctl = new AbortController();
    await ask({ question: "What is binary search?", topic: null, mode: "agentic" }, ctl.signal);

    expect(fetchMock).toHaveBeenCalled();
    expect(capturedHeaders["X-Access-Code"]).toBe("my-secret-key");
  });

  test("request omits X-Access-Code header when access code is empty", async () => {
    setAccessCode("");

    let capturedHeaders: Record<string, string> = {};
    const fetchMock = vi.fn().mockImplementation((_url, init) => {
      capturedHeaders = init.headers;
      return Promise.resolve({
        ok: true,
        headers: { get: () => "application/json" },
        json: () =>
          Promise.resolve({
            answer: "Binary search runs in O(log n). [1]",
            status: "answered",
            sources: { "1": { chunk_id: 1, topic: "searching", doc: "searching/binary_search.md", text: "..." } },
            trace: [],
          }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const ctl = new AbortController();
    await ask({ question: "What is binary search?", topic: null, mode: "agentic" }, ctl.signal);

    expect(capturedHeaders["X-Access-Code"]).toBeUndefined();
  });

  test("wrong code -> 401 throws descriptive access error", async () => {
    setAccessCode("wrong-code");

    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        headers: { get: () => "application/json" },
        json: () => Promise.resolve({ detail: "Access code is missing or wrong." }),
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const ctl = new AbortController();
    await expect(
      ask({ question: "What is binary search?", topic: null, mode: "agentic" }, ctl.signal)
    ).rejects.toThrow("Access code is missing or wrong.");
  });

  test("correct code -> 200 allows request and returns answer", async () => {
    setAccessCode("correct-code");

    const fetchMock = vi.fn().mockImplementation((_url, init) => {
      if (init.headers["X-Access-Code"] !== "correct-code") {
        return Promise.resolve({
          ok: false,
          status: 401,
          headers: { get: () => "application/json" },
          json: () => Promise.resolve({ detail: "Access code is missing or wrong." }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: () =>
          Promise.resolve({
            answer: "Valid answer with citations [1].",
            status: "answered",
            sources: { "1": { chunk_id: 1, topic: "searching", doc: "searching/binary_search.md", text: "text" } },
            trace: [],
          }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const ctl = new AbortController();
    const res = await ask({ question: "Explain binary search", topic: null, mode: "agentic" }, ctl.signal);
    expect(res.answer).toBe("Valid answer with citations [1].");
    expect(res.status).toBe("answered");
  });

  test("ask passes collection_id and subsection_id when provided", async () => {
    const { ask: askFn } = await import("./api");
    let capturedBody: Record<string, unknown> = {};
    const fetchMock = vi.fn().mockImplementation((_url, init) => {
      capturedBody = JSON.parse(init.body as string);
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: () =>
          Promise.resolve({
            answer: "Scoped answer [1].",
            status: "answered",
            sources: { "1": { topic: "Col", doc: "uploads/a.pdf", text: "text" } },
            trace: [],
          }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const ctl = new AbortController();
    await askFn(
      {
        question: "Explain Bellman-Ford",
        topic: null,
        collection_id: "col-123",
        subsection_id: "sub-456",
        mode: "agentic",
      },
      ctl.signal
    );

    expect(capturedBody.collection_id).toBe("col-123");
    expect(capturedBody.subsection_id).toBe("sub-456");
  });

  test("ask associates a request with its conversation and message", async () => {
    const { ask: askFn } = await import("./api");
    let capturedBody: Record<string, unknown> = {};
    const fetchMock = vi.fn().mockImplementation((_url, init) => {
      capturedBody = JSON.parse(init.body as string);
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: () => Promise.resolve({
          answer: "Answer [1].",
          status: "answered",
          sources: {},
          trace: [],
        }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await askFn({
      question: "Explain binary search",
      topic: null,
      mode: "agentic",
      conversation_id: "conversation-1",
      message_id: "message-1",
    }, new AbortController().signal);

    expect(capturedBody.conversation_id).toBe("conversation-1");
    expect(capturedBody.message_id).toBe("message-1");
  });

  test("conversation APIs preserve access headers and use stable conversation endpoints", async () => {
    const {
      createConversationApi,
      deleteConversationApi,
      fetchConversationApi,
      fetchConversationForRunApi,
      fetchConversationsApi,
      importConversationsApi,
      updateConversationApi,
    } = await import("./api");
    setAccessCode("conversation-secret");
    const calls: { url: string; method: string; headers: Record<string, string>; body?: string }[] = [];
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url, init) => {
      calls.push({
        url,
        method: init?.method || "GET",
        headers: init?.headers as Record<string, string>,
        body: init?.body as string | undefined,
      });
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: () => Promise.resolve({ conversations: [], messages: [] }),
      });
    }));

    await fetchConversationsApi();
    await createConversationApi("conversation-1", "First question");
    await fetchConversationApi("conversation-1");
    await fetchConversationForRunApi("00000000-0000-0000-0000-000000000001");
    await updateConversationApi("conversation-1", { title: "Renamed" });
    await importConversationsApi([]);
    await deleteConversationApi("conversation-1");

    expect(calls.map((call) => `${call.method} ${call.url.replace(/^https?:\/\/[^/]+/, "")}`)).toEqual([
      "GET /api/conversations",
      "POST /api/conversations",
      "GET /api/conversations/conversation-1",
      "GET /api/conversations/by-run/00000000-0000-0000-0000-000000000001",
      "PATCH /api/conversations/conversation-1",
      "POST /api/conversations/import",
      "DELETE /api/conversations/conversation-1",
    ]);
    expect(calls.every((call) => call.headers["X-Access-Code"] === "conversation-secret")).toBe(true);
    expect(JSON.parse(calls[1].body || "{}")).toMatchObject({
      id: "conversation-1",
      title: "First question",
    });
  });

  test("collection, subsection, upload, and delete document APIs call correct endpoints", async () => {
    const {
      createCollectionApi,
      createSubsectionApi,
      deleteCollectionApi,
      deleteDocumentApi,
      fetchCollectionsApi,
      uploadDocumentsApi,
    } = await import("./api");

    const calls: { url: string; method: string; body?: unknown }[] = [];
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method || "GET", body: init?.body });
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: () =>
          Promise.resolve({
            collections: [],
            default_collection_id: "def-1",
            id: "col-1",
            name: "DSA",
            uploaded: [{ id: 5, filename: "dp.pdf", status: "indexed", chunk_count: 3 }],
            errors: [],
            total_uploaded: 1,
            total_errors: 0,
            deleted_doc_id: 5,
          }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchCollectionsApi();
    await createCollectionApi("DSA");
    await createSubsectionApi("col-1", "Dynamic Programming");
    await deleteCollectionApi("col-1", "move_to_default");
    await deleteDocumentApi(5);

    const file = new File(["hello"], "dp.pdf", { type: "application/pdf" });
    const uploadRes = await uploadDocumentsApi([file], {
      collectionId: "col-1",
      subsectionId: "sub-1",
    });

    expect(uploadRes.total_uploaded).toBe(1);
    expect(calls.map((c) => `${c.method} ${c.url.replace("http://localhost:8000", "")}`)).toEqual([
      "GET /api/collections",
      "POST /api/collections",
      "POST /api/collections/col-1/subsections",
      "DELETE /api/collections/col-1?mode=move_to_default",
      "DELETE /api/documents/5",
      "POST /api/documents/upload",
    ]);
  });
});


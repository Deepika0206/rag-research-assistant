import React, { useState } from "react";
import { Key, ShieldCheck, Check, Server, Database, Globe, RefreshCw } from "lucide-react";
import { setAccessCode, getAccessCode, getApiUrl, setApiUrl } from "../../lib/api";

interface Props {
  accessCode: string;
  onUpdateAccessCode: (code: string) => void;
  pendingRunId: string | null;
  onRetryPendingRun: () => void;
  onApiUrlChanged?: () => void;
}

export function SettingsPanel({
  accessCode,
  onUpdateAccessCode,
  pendingRunId,
  onRetryPendingRun,
  onApiUrlChanged,
}: Props) {
  const [code, setCode] = useState(accessCode);
  const [savedCode, setSavedCode] = useState(false);

  const [apiUrl, setApiUrlState] = useState(() => getApiUrl());
  const [savedUrl, setSavedUrl] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ ok: boolean; message: string } | null>(null);

  const handleSaveCode = (e: React.FormEvent) => {
    e.preventDefault();
    setAccessCode(code);
    onUpdateAccessCode(code);
    setSavedCode(true);
    setTimeout(() => setSavedCode(false), 2000);
    if (pendingRunId) {
      onRetryPendingRun();
    }
  };

  const handleSaveApiUrl = (e: React.FormEvent) => {
    e.preventDefault();
    setApiUrl(apiUrl);
    setSavedUrl(true);
    setTimeout(() => setSavedUrl(false), 2000);
    onApiUrlChanged?.();
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    const targetUrl = apiUrl.trim().replace(/\/+$/, "");
    if (!targetUrl) {
      setConnectionStatus({ ok: false, message: "Please provide a backend URL first." });
      setTestingConnection(false);
      return;
    }
    try {
      const res = await fetch(`${targetUrl}/api/health`, {
        headers: code ? { "X-Access-Code": code } : {},
      });
      const contentType = res.headers.get("content-type") || "";
      if (res.ok) {
        if (!contentType.includes("application/json")) {
          setConnectionStatus({
            ok: false,
            message: `Endpoint at ${targetUrl}/api/health returned non-JSON (${contentType || "unknown"}). Ensure this URL points to your FastAPI backend, not the frontend.`,
          });
          return;
        }
        const data = await res.json().catch(() => ({}));
        setConnectionStatus({
          ok: true,
          message: `Connected successfully! Status: ${data.status || "ok"}, Chunks: ${data.chunks ?? "ready"}, Mode: ${data.retrieval_mode || "active"}.`,
        });
      } else {
        const text = await res.text().catch(() => "");
        setConnectionStatus({
          ok: false,
          message: `Backend reached but responded with HTTP ${res.status}: ${text.slice(0, 150)}`,
        });
      }
    } catch (err) {
      setConnectionStatus({
        ok: false,
        message: `Failed to connect to ${targetUrl}. Ensure the backend is running and ALLOWED_ORIGINS allows this frontend.`,
      });
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#fafafa] overflow-hidden">
      <div className="bg-white border-b border-[#eaeaea] p-4 sm:p-6">
        <h2 className="text-base font-semibold text-[#171717] tracking-tight">Settings &amp; Access</h2>
        <p className="text-xs text-[#666666] mt-0.5">
          Configure security credentials and connection settings for your Python FastAPI backend.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-xl mx-auto space-y-6">
          {/* Backend API URL Card */}
          <div className="rounded-[12px] border border-[#eaeaea] bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#171717]" />
              <h3 className="text-xs font-semibold uppercase tracking-wider font-mono text-[#171717]">
                Backend API URL (VITE_API_URL)
              </h3>
            </div>
            <p className="text-xs text-[#666666] leading-relaxed">
              Target address of your deployed Python FastAPI service (e.g. <code className="bg-[#fafafa] px-1 py-0.5 rounded border border-[#eaeaea] text-[#171717]">https://rag-assistant-api.onrender.com</code>).
            </p>

            <form onSubmit={handleSaveApiUrl} className="space-y-3">
              <div>
                <input
                  type="url"
                  value={apiUrl}
                  onChange={(e) => setApiUrlState(e.target.value)}
                  placeholder="https://your-fastapi-backend.onrender.com"
                  className="w-full px-3 py-2 text-xs font-mono rounded-[8px] border border-[#eaeaea] bg-[#fafafa] text-[#171717] focus:outline-none focus:border-[#171717] focus:bg-white transition-colors"
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[#eaeaea] bg-[#fafafa] text-[#171717] text-xs font-medium hover:bg-white transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? "animate-spin" : ""}`} />
                  <span>{testingConnection ? "Testing..." : "Test Connection"}</span>
                </button>

                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[#171717] text-white text-xs font-medium hover:bg-[#262626] transition-colors"
                >
                  {savedUrl ? <Check className="w-3.5 h-3.5" /> : null}
                  <span>{savedUrl ? "Saved" : "Save Backend URL"}</span>
                </button>
              </div>

              {connectionStatus && (
                <div
                  className={`p-3 rounded-[8px] text-xs border ${
                    connectionStatus.ok
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-rose-50 text-rose-800 border-rose-200"
                  }`}
                >
                  {connectionStatus.message}
                </div>
              )}
            </form>
          </div>
          {/* Access Code Card */}
          <div className="rounded-[12px] border border-[#eaeaea] bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-[#171717]" />
              <h3 className="text-xs font-semibold uppercase tracking-wider font-mono text-[#171717]">
                API Access Code (X-Access-Code)
              </h3>
            </div>
            <p className="text-xs text-[#666666] leading-relaxed">
              If your backend is deployed in production (e.g. Render), enter your server's ACCESS_CODE below to authorize questions and view saved runs.
            </p>

            <form onSubmit={handleSaveCode} className="space-y-3">
              <div>
                <input
                  type="password"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter access code..."
                  className="w-full px-3 py-2 text-xs font-mono rounded-[8px] border border-[#eaeaea] bg-[#fafafa] text-[#171717] focus:outline-none focus:border-[#171717] focus:bg-white transition-colors"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#7d7d7d]">
                  Stored in your browser's session storage.
                </span>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[#171717] text-white text-xs font-medium hover:bg-[#262626] transition-colors"
                >
                  {savedCode ? <Check className="w-3.5 h-3.5" /> : null}
                  <span>{savedCode ? "Saved" : "Save Code"}</span>
                </button>
              </div>
            </form>

            {pendingRunId && (
              <div className="p-3 rounded-[8px] bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-2">
                <p>A shared run ({pendingRunId}) is waiting to be loaded once access is granted.</p>
                <button
                  type="button"
                  onClick={onRetryPendingRun}
                  className="px-2.5 py-1 rounded bg-[#171717] text-white text-xs font-medium"
                >
                  Retry Loading Shared Run
                </button>
              </div>
            )}
          </div>

          {/* System Information */}
          <div className="rounded-[12px] border border-[#eaeaea] bg-white p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider font-mono text-[#171717]">
              System &amp; Pipeline Configuration
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-[8px] bg-[#fafafa] border border-[#eaeaea]">
                <div className="flex items-center gap-1.5 font-medium text-[#171717]">
                  <Database className="w-3.5 h-3.5 text-[#7d7d7d]" />
                  <span>Corpus Database</span>
                </div>
                <div className="text-[11px] text-[#666666] mt-1 font-mono">
                  PostgreSQL 16 + pgvector
                </div>
              </div>
              <div className="p-3 rounded-[8px] bg-[#fafafa] border border-[#eaeaea]">
                <div className="flex items-center gap-1.5 font-medium text-[#171717]">
                  <Server className="w-3.5 h-3.5 text-[#7d7d7d]" />
                  <span>RAG Engine</span>
                </div>
                <div className="text-[11px] text-[#666666] mt-1 font-mono">
                  Hybrid BM25 + Cross-Encoder
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

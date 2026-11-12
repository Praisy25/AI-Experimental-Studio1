"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, API_URL } from "../lib/api";

type DocumentItem = { id: string; name: string; characters: number; createdAt: string; updatedAt: string };
type DocumentPreview = { id: string; name: string; content: string };
type Workspace = { id: string; name: string };

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<DocumentPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    const response = await apiFetch(`${API_URL}/api/documents?workspaceId=${encodeURIComponent(workspaceId)}`);
    const body = await response.json().catch(() => []);
    if (!response.ok) throw new Error(body.error || "Could not load documents.");
    setDocuments(body as DocumentItem[]);
  }, [workspaceId]);

  useEffect(() => { void apiFetch(`${API_URL}/api/workspaces`).then(async (response) => { if (!response.ok) throw new Error("Could not load workspaces."); const items = await response.json() as Workspace[]; setWorkspaces(items); setWorkspaceId(items[0]?.id || ""); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load workspaces.")); }, []);
  useEffect(() => { void Promise.resolve().then(load).catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load documents.")).finally(() => setLoading(false)); }, [load]);

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    setBusy(true); setError(""); setNotice("");
    try {
      for (const file of files) {
        if (!/\.(txt|md|csv|pdf|docx)$/i.test(file.name)) throw new Error(`${file.name}: choose a TXT, Markdown, CSV, PDF, or DOCX file.`);
        if (file.size > 1_000_000) throw new Error(`${file.name}: maximum size is 1 MB.`);
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = "";
        for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
        const response = await apiFetch(`${API_URL}/api/documents`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: file.name, base64: btoa(binary), workspaceId }) });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || `Upload failed (HTTP ${response.status}). Check that the API server is running and restarted.`);
      }
      await load(); setNotice(`${files.length} document${files.length === 1 ? "" : "s"} added to your workspace.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Upload failed."); await load().catch(() => undefined); }
    finally { setBusy(false); }
  }

  async function remove(document: DocumentItem) {
    if (!window.confirm(`Remove “${document.name}” from your workspace?`)) return;
    setError("");
    try {
      const response = await apiFetch(`${API_URL}/api/documents/${encodeURIComponent(document.id)}?workspaceId=${encodeURIComponent(workspaceId)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not remove this document.");
      setDocuments((current) => current.filter((item) => item.id !== document.id));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not remove document."); }
  }

  async function openPreview(document: DocumentItem) {
    setPreviewLoading(true); setError("");
    try {
      const response = await apiFetch(`${API_URL}/api/documents/${encodeURIComponent(document.id)}?workspaceId=${encodeURIComponent(workspaceId)}`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not load this document.");
      setPreview(body as DocumentPreview);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load this document."); }
    finally { setPreviewLoading(false); }
  }

  return <main className="min-h-screen bg-[#0b0d12] px-4 py-8 text-slate-100 md:px-8"><div className="mx-auto max-w-4xl">
    <div className="flex items-center justify-between"><Link href="/" className="text-sm text-violet-300 hover:text-violet-200">← Dashboard</Link><div className="flex gap-4"><Link href="/research" className="text-sm text-violet-300 hover:text-violet-200">Research assistant</Link><Link href="/chat" className="text-sm text-violet-300 hover:text-violet-200">Open chat</Link></div></div>
    <header className="py-8"><p className="text-sm uppercase tracking-widest text-violet-300">AI Experiment Studio</p><h1 className="mt-2 text-3xl font-semibold">Workspace documents</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Add text files for your assistant to reference when relevant. Matching excerpts are included in chat and model comparisons.</p></header>
    <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5"><label htmlFor="document-workspace" className="mb-2 block text-sm font-medium">Workspace</label><select id="document-workspace" value={workspaceId} onChange={(event) => { setWorkspaceId(event.target.value); setDocuments([]); setPreview(null); }} className="mb-4 block w-full rounded-lg border border-white/10 bg-[#15171d] px-3 py-2.5 text-sm" disabled={!workspaces.length}><option value="">Select a workspace</option>{workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select><label htmlFor="document-upload" className="mb-2 block text-sm font-medium">Upload documents</label><input id="document-upload" type="file" accept=".txt,.md,.csv,.pdf,.docx,text/plain,text/markdown,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple disabled={busy || !workspaceId} onChange={(event) => void upload(event)} className="block w-full text-sm text-slate-400 file:mr-4 file:rounded-lg file:border-0 file:bg-violet-600 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-white hover:file:bg-violet-500 disabled:opacity-50"/><p className="mt-3 text-xs text-slate-500">TXT, Markdown, CSV, PDF, or DOCX · up to 1 MB per file. Only documents in this workspace are retrieved for relevant chats and research.</p><p className="mt-2 text-xs text-slate-500">Scanned PDF text is transcribed on your computer when an Ollama vision model is configured.</p>{busy && <p className="mt-3 text-sm text-violet-200">Adding documents…</p>}</section>
    {error && <p role="alert" className="mt-4 rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-300">{error}</p>}{notice && <p role="status" className="mt-4 rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-3 text-sm text-emerald-200">{notice}</p>}
    <section className="mt-8"><h2 className="mb-3 text-lg font-semibold">Saved documents <span className="text-sm font-normal text-slate-500">{documents.length}</span></h2>{loading ? <p className="text-sm text-slate-400">Loading documents…</p> : documents.length ? <ul className="space-y-3">{documents.map((document) => <li key={document.id} className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4"><div className="min-w-0"><p className="truncate text-sm font-medium">{document.name}</p><p className="mt-1 text-xs text-slate-500">{document.characters.toLocaleString()} characters · Added {new Date(document.createdAt).toLocaleDateString()}</p></div><div className="flex shrink-0 items-center gap-2"><button type="button" disabled={previewLoading} onClick={() => void openPreview(document)} className="rounded-lg border border-violet-400/20 px-3 py-2 text-xs text-violet-200 hover:bg-violet-400/5 disabled:opacity-50">Preview</button><button type="button" onClick={() => void remove(document)} className="rounded-lg border border-red-400/20 px-3 py-2 text-xs text-red-300 hover:bg-red-400/5">Remove</button></div></li>)}</ul> : <p className="rounded-xl border border-white/10 p-4 text-sm text-slate-500">No documents yet.</p>}</section>
    {preview && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreview(null); }}><section role="dialog" aria-modal="true" aria-labelledby="document-preview-title" className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-white/10 bg-[#111319] shadow-2xl"><header className="flex items-center justify-between gap-4 border-b border-white/10 p-4"><div className="min-w-0"><h2 id="document-preview-title" className="truncate font-medium">{preview.name}</h2><p className="mt-1 text-xs text-slate-500">Extracted text preview</p></div><button type="button" autoFocus onClick={() => setPreview(null)} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5">Close</button></header><pre className="overflow-auto whitespace-pre-wrap break-words p-5 text-sm leading-6 text-slate-300">{preview.content}</pre></section></div>}
  </div></main>;
}

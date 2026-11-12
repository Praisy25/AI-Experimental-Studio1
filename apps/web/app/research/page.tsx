"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { apiFetch, API_URL } from "../lib/api";

type Document = { id: string; name: string; characters: number };
type Workspace = { id: string; name: string };
type Provider = { id: string; provider: string; displayName: string; defaultModel: string | null };
type Result = { task: string; modelName: string; result: string; sources: { id: string; name: string }[] };

export default function ResearchPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [externalAiEnabled, setExternalAiEnabled] = useState(false);
  const [models, setModels] = useState<{ name: string; size: number }[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [providerId, setProviderId] = useState("");
  const [modelName, setModelName] = useState("");
  const [task, setTask] = useState("summarize");
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void Promise.all([
      apiFetch(`${API_URL}/api/workspaces`).then((response) => response.ok ? response.json() as Promise<Workspace[]> : Promise.reject(new Error("Could not load workspaces."))),
      apiFetch(`${API_URL}/api/providers`).then((response) => response.ok ? response.json() as Promise<Provider[]> : Promise.reject(new Error("Could not load providers."))),
      apiFetch(`${API_URL}/api/runtime-config`).then((response) => response.ok ? response.json() as Promise<{ externalAiEnabled: boolean }> : Promise.resolve({ externalAiEnabled: false })),
      apiFetch(`${API_URL}/api/models`).then((response) => response.ok ? response.json() as Promise<{ name: string; size: number }[]> : Promise.resolve([])),
    ]).then(async ([workspaceItems, linked, runtimeConfig, local]) => {
      setWorkspaces(workspaceItems); setProviders(linked.filter((provider) => runtimeConfig.externalAiEnabled || provider.provider === "ollama")); setExternalAiEnabled(runtimeConfig.externalAiEnabled); setModels(local);
      const selectedWorkspace = workspaceItems[0]?.id || "";
      setWorkspaceId(selectedWorkspace);
      if (selectedWorkspace) {
        const response = await apiFetch(`${API_URL}/api/documents?workspaceId=${encodeURIComponent(selectedWorkspace)}`);
        if (!response.ok) throw new Error("Could not load workspace documents.");
        const docs = await response.json() as Document[];
        setDocuments(docs); setSelected(docs.slice(0, Math.min(2, docs.length)).map((doc) => doc.id));
      }
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load research data."));
  }, []);

  const activeProvider = providers.find((provider) => provider.id === providerId);
  async function changeWorkspace(nextWorkspaceId: string) {
    setWorkspaceId(nextWorkspaceId); setDocuments([]); setSelected([]); setResult(null); setError("");
    try {
      const response = await apiFetch(`${API_URL}/api/documents?workspaceId=${encodeURIComponent(nextWorkspaceId)}`);
      if (!response.ok) throw new Error("Could not load workspace documents.");
      const docs = await response.json() as Document[];
      setDocuments(docs); setSelected(docs.slice(0, Math.min(2, docs.length)).map((doc) => doc.id));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load workspace documents."); }
  }
  async function analyze(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setResult(null);
    try {
      const response = await apiFetch(`${API_URL}/api/research/analyze`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task, question, documentIds: selected, workspaceId, modelName, providerConnectionId: providerId || null }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Research request failed.");
      setResult(body as Result);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Research request failed."); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-[#0b0d12] px-5 py-8 text-slate-100 md:px-10"><div className="mx-auto max-w-5xl"><div className="flex justify-between"><Link href="/documents" className="text-sm text-violet-300">← Documents</Link><Link href="/chat" className="text-sm text-violet-300">Chat</Link></div><p className="mt-8 text-sm uppercase tracking-widest text-violet-300">AI Experiment Studio</p><h1 className="mt-2 text-3xl font-semibold">Research assistant</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Summarize, compare, question, or make notes from text extracted from your uploaded files. The model receives only the documents selected below; citations refer to filenames.</p>{!externalAiEnabled && <p className="mt-3 text-xs text-emerald-300">Free local mode: research runs through Ollama on this computer.</p>}
    {!workspaces.length ? <p className="mt-6 rounded-xl border border-white/10 p-5 text-sm text-slate-400">Create a workspace before running document research.</p> : <><label className="mt-6 block max-w-md text-sm text-slate-300">Workspace<select value={workspaceId} onChange={(event) => void changeWorkspace(event.target.value)} className="mt-2 block w-full rounded-lg border border-white/10 bg-[#15171d] px-3 py-2.5">{workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select></label>{documents.length === 0 ? <p className="mt-4 rounded-xl border border-white/10 p-5 text-sm text-slate-400">No documents in this workspace yet. Upload a text-based PDF, DOCX, TXT, CSV, or Markdown file.</p> : <form onSubmit={analyze} className="mt-4 space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5"><fieldset><legend className="text-sm font-medium">Select documents (up to five)</legend><div className="mt-3 grid gap-2 sm:grid-cols-2">{documents.map((document) => <label key={document.id} className="flex items-start gap-3 rounded-lg border border-white/10 p-3 text-sm"><input type="checkbox" checked={selected.includes(document.id)} disabled={!selected.includes(document.id) && selected.length >= 5} onChange={(event) => setSelected((current) => event.target.checked ? [...current, document.id] : current.filter((id) => id !== document.id))} className="mt-1 accent-violet-500" /><span><span className="block font-medium">{document.name}</span><span className="text-xs text-slate-500">{document.characters.toLocaleString()} extracted characters</span></span></label>)}</div></fieldset>
      <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm text-slate-300">Task<select value={task} onChange={(event) => setTask(event.target.value)} className="mt-2 block w-full rounded-lg border border-white/10 bg-[#15171d] px-3 py-2.5"><option value="summarize">Summarize</option><option value="compare">Compare documents</option><option value="contradictions">Find contradictions</option><option value="answer">Answer a question</option><option value="notes">Draft research notes</option></select></label><label className="text-sm text-slate-300">Provider<select value={providerId} onChange={(event) => { setProviderId(event.target.value); setModelName(providers.find((provider) => provider.id === event.target.value)?.defaultModel || ""); }} className="mt-2 block w-full rounded-lg border border-white/10 bg-[#15171d] px-3 py-2.5"><option value="">Local Ollama</option>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.displayName} ({provider.provider})</option>)}</select></label><label className="text-sm text-slate-300 sm:col-span-2">Model{!providerId && models.length ? <select required value={modelName} onChange={(event) => setModelName(event.target.value)} className="mt-2 block w-full rounded-lg border border-white/10 bg-[#15171d] px-3 py-2.5"><option value="">Select an installed model</option>{models.map((model) => <option key={model.name} value={model.name}>{model.name}</option>)}</select> : <input required value={modelName} onChange={(event) => setModelName(event.target.value)} placeholder={activeProvider?.defaultModel || "Model name"} className="mt-2 block w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5" />}</label></div>
      <label className="block text-sm text-slate-300">Question or comparison criteria <span className="text-slate-500">(needed for compare, contradictions, and question)</span><textarea value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={4000} rows={3} placeholder="What should I focus on?" className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5" /></label><button disabled={busy || selected.length === 0 || !modelName.trim()} className="rounded-lg bg-violet-600 px-5 py-3 text-sm font-medium disabled:opacity-50">{busy ? "Analyzing documents…" : "Run research analysis"}</button></form>}</>}
    {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-300">{error}</p>}{result && <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5"><div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-lg font-semibold">Research result</h2><p className="mt-1 text-xs text-slate-500">{result.modelName} · {result.task}</p></div><button type="button" onClick={() => void navigator.clipboard.writeText(result.result)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300">Copy result</button></div><div className="mt-5 text-sm leading-7 text-slate-200 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_h2]:my-3 [&_h2]:font-semibold"><ReactMarkdown remarkPlugins={[remarkGfm]}>{result.result}</ReactMarkdown></div><p className="mt-4 border-t border-white/10 pt-3 text-xs text-slate-500">Sources provided: {result.sources.map((source) => source.name).join(", ")}. Verify important claims against the original files.</p></section>}</div></main>;
}

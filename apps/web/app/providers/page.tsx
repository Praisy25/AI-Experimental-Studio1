"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, API_URL } from "../lib/api";

type Provider = { id: string; provider: string; displayName: string; hasApiKey: boolean; baseUrl: string | null; defaultModel: string | null; contextLength: number | null; strengths: string | null; weaknesses: string | null; averageResponseMs: number | null; responseSamples: number; inputPricePerMillion: number | null; outputPricePerMillion: number | null };
const choices = ["openai", "anthropic", "gemini", "openrouter", "deepseek", "ollama", "custom"];
const blank = { provider: "ollama", displayName: "", apiKey: "", baseUrl: "", defaultModel: "", contextLength: "", strengths: "", weaknesses: "", inputPricePerMillion: "", outputPricePerMillion: "" };

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [externalAiEnabled, setExternalAiEnabled] = useState(false);

  const load = useCallback(async () => {
    const [configResponse, response] = await Promise.all([apiFetch(`${API_URL}/api/runtime-config`), apiFetch(`${API_URL}/api/providers`)]);
    if (configResponse.ok) { const config = await configResponse.json(); setExternalAiEnabled(config.externalAiEnabled === true); }
    if (response.status === 401) return;
    if (!response.ok) { setError("Could not load provider connections."); setLoading(false); return; }
    setProviders(await response.json()); setLoading(false);
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  function updateField(event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }
  function edit(item: Provider) {
    setEditingId(item.id); setNotice(""); setError("");
    setForm({ provider: item.provider, displayName: item.displayName, apiKey: "", baseUrl: item.baseUrl || "", defaultModel: item.defaultModel || "", contextLength: item.contextLength?.toString() || "", strengths: item.strengths || "", weaknesses: item.weaknesses || "", inputPricePerMillion: item.inputPricePerMillion?.toString() || "", outputPricePerMillion: item.outputPricePerMillion?.toString() || "" });
  }
  function reset() { setEditingId(null); setForm(blank); }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice(""); setError("");
    const response = await apiFetch(`${API_URL}/api/providers${editingId ? `/${editingId}` : ""}`, {
      method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, inputPricePerMillion: form.inputPricePerMillion === "" ? null : Number(form.inputPricePerMillion), outputPricePerMillion: form.outputPricePerMillion === "" ? null : Number(form.outputPricePerMillion) }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setError(data.error || "Could not save this connection."); return; }
    reset(); setNotice("Provider connection saved."); await load();
  }
  async function remove(item: Provider) {
    if (!window.confirm(`Remove ${item.displayName}?`)) return;
    const response = await apiFetch(`${API_URL}/api/providers/${item.id}`, { method: "DELETE" });
    if (!response.ok) { setError("Could not remove this connection."); return; }
    if (editingId === item.id) reset();
    setProviders((items) => items.filter((entry) => entry.id !== item.id)); setNotice("Provider connection removed.");
  }

  return <main className="min-h-screen bg-[#0b0d12] px-5 py-8 text-slate-100 md:px-10"><div className="mx-auto max-w-4xl">
    <Link href="/profile" className="text-sm text-violet-300">← Account settings</Link>
    <h1 className="mt-6 text-3xl font-semibold">AI provider connections</h1>
    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Connect API providers for your experiments. API keys are encrypted before they are stored and are never shown again after saving. Ollama runs locally and does not need a key.</p>
    {!externalAiEnabled && <p className="mt-4 rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-3 text-sm text-emerald-200">Free local mode is on. AI requests use Ollama on this computer. Paid external providers are disabled by the API.</p>}
    {notice && <p role="status" className="mt-4 text-sm text-emerald-300">{notice}</p>}{error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
    <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6"><h2 className="text-lg font-semibold">{editingId ? "Edit connection" : "Add a connection"}</h2>
      <form onSubmit={save} className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-slate-300">Provider<select name="provider" value={form.provider} onChange={updateField} className="mt-2 w-full rounded-lg border border-white/10 bg-[#141720] px-3 py-2.5">{choices.filter((choice) => externalAiEnabled || choice === "ollama").map((choice) => <option key={choice} value={choice}>{choice === "custom" ? "Custom OpenAI-compatible" : choice[0].toUpperCase() + choice.slice(1)}</option>)}</select></label>
        <label className="text-sm text-slate-300">Connection name<input name="displayName" required maxLength={80} value={form.displayName} onChange={updateField} placeholder="My OpenAI account" className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5" /></label>
        {form.provider !== "ollama" && <label className="text-sm text-slate-300 sm:col-span-2">API key<input name="apiKey" type="password" autoComplete="new-password" required={!editingId} value={form.apiKey} onChange={updateField} placeholder={editingId ? "Leave blank to keep the saved key" : "Paste your provider API key"} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5" /></label>}
        <label className="text-sm text-slate-300">Base URL <span className="text-slate-500">(optional)</span><input name="baseUrl" type="url" value={form.baseUrl} onChange={updateField} placeholder={form.provider === "ollama" ? "http://localhost:11434" : "Provider default"} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5" /></label>
        <label className="text-sm text-slate-300">Default model <span className="text-slate-500">(optional)</span><input name="defaultModel" maxLength={120} value={form.defaultModel} onChange={updateField} placeholder="e.g. gpt-4o-mini" className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5" /></label>
        <div className="sm:col-span-2"><p className="text-sm font-medium text-slate-300">Model capabilities</p><p className="mt-1 text-xs leading-5 text-slate-500">Add the model’s published context window and your own capability notes. These details help recommendations and are not independently verified.</p></div>
        <label className="text-sm text-slate-300">Context length (tokens)<input name="contextLength" type="number" min="1" max="10000000" step="1" value={form.contextLength} onChange={updateField} placeholder="Unknown" className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5" /></label>
        <label className="text-sm text-slate-300">Strengths<textarea name="strengths" maxLength={2000} rows={3} value={form.strengths} onChange={updateField} placeholder="e.g. code generation, reasoning, long documents" className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5" /></label>
        <label className="text-sm text-slate-300 sm:col-span-2">Weaknesses or limits<textarea name="weaknesses" maxLength={2000} rows={2} value={form.weaknesses} onChange={updateField} placeholder="Known limits, unsupported inputs, or areas to double-check" className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5" /></label>
        <div className="sm:col-span-2"><p className="text-sm font-medium text-slate-300">Optional pricing for cost estimates</p><p className="mt-1 text-xs leading-5 text-slate-500">Enter input and output rates in USD per 1 million tokens. Rates apply only when this connection uses its configured default model; estimates use approximate token counts.</p></div>
        <label className="text-sm text-slate-300">Input price (USD / 1M tokens)<input name="inputPricePerMillion" type="number" min="0" max="10000" step="any" value={form.inputPricePerMillion} onChange={updateField} placeholder="Leave blank if unknown" className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5" /></label>
        <label className="text-sm text-slate-300">Output price (USD / 1M tokens)<input name="outputPricePerMillion" type="number" min="0" max="10000" step="any" value={form.outputPricePerMillion} onChange={updateField} placeholder="Leave blank if unknown" className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5" /></label>
        <div className="flex gap-3 sm:col-span-2"><button className="rounded-lg bg-violet-600 px-4 py-2.5 font-medium">{editingId ? "Save changes" : "Save connection"}</button>{editingId && <button type="button" onClick={reset} className="rounded-lg border border-white/15 px-4 py-2.5">Cancel</button>}</div>
      </form>
    </section>
    <section className="mt-6"><h2 className="text-lg font-semibold">Saved connections</h2>{loading ? <p className="mt-3 text-sm text-slate-400">Loading…</p> : providers.length === 0 ? <p className="mt-3 text-sm text-slate-400">No providers connected yet.</p> : <div className="mt-3 space-y-3">{providers.map((item) => <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4"><div><p className="font-medium">{item.displayName} <span className="ml-2 rounded-full bg-white/10 px-2 py-1 text-xs text-slate-300">{item.provider}</span></p><p className="mt-1 text-sm text-slate-400">{item.defaultModel || "No default model"} · {item.hasApiKey ? "API key saved" : "No key required"}{item.baseUrl ? ` · ${item.baseUrl}` : ""}</p>{(item.contextLength || item.averageResponseMs != null || item.inputPricePerMillion != null) && <p className="mt-2 text-xs text-slate-500">{item.contextLength ? `Context: ${item.contextLength.toLocaleString()} tokens` : "Context: not set"}{item.averageResponseMs != null ? ` · Avg response: ${(item.averageResponseMs / 1000).toFixed(1)}s from ${item.responseSamples} replies` : " · Speed: no history yet"}{item.inputPricePerMillion != null && item.outputPricePerMillion != null ? ` · $${item.inputPricePerMillion}/$${item.outputPricePerMillion} per 1M input/output tokens` : " · Price: not set"}</p>}{item.strengths && <p className="mt-2 text-xs text-emerald-200/80"><strong>Strengths:</strong> {item.strengths}</p>}{item.weaknesses && <p className="mt-1 text-xs text-amber-200/80"><strong>Limits:</strong> {item.weaknesses}</p>}</div><div className="flex gap-2"><button onClick={() => edit(item)} className="rounded-lg border border-white/15 px-3 py-2 text-sm">Edit</button><button onClick={() => void remove(item)} className="rounded-lg border border-red-400/30 px-3 py-2 text-sm text-red-300">Remove</button></div></article>)}</div>}</section>
    <p className="mt-7 text-xs leading-5 text-slate-500">Keep the server’s ENCRYPTION_KEY private and backed up. Changing or losing it makes previously saved keys unreadable.</p>
  </div></main>;
}

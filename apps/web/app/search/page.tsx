"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { apiFetch, API_URL } from "../lib/api";

type SearchResults = {
  chats: { id: string; title: string; updatedAt: string; excerpt: string | null }[];
  prompts: { id: string; title: string; prompt: string; category: string; updatedAt: string }[];
  documents: { id: string; name: string; updatedAt: string; excerpt: string }[];
};

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const runSearch = useCallback(async (value: string) => {
    if (value.length < 2) { setError("Enter at least two characters."); return; }
    setBusy(true); setError("");
    try {
      const response = await apiFetch(`${API_URL}/api/search?q=${encodeURIComponent(value)}`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Search failed.");
      setResults(body as SearchResults);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Search failed.");
      setResults(null);
    } finally { setBusy(false); }
  }, []);

  useEffect(() => {
    const initialQuery = new URLSearchParams(window.location.search).get("q")?.trim();
    if (initialQuery) void Promise.resolve().then(() => { setQuery(initialQuery); return runSearch(initialQuery); });
  }, [runSearch]);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSearch(query.trim());
  }

  return <main className="min-h-screen bg-[#0b0d12] px-4 py-8 text-slate-100 md:px-8">
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between"><Link href="/" className="text-sm text-violet-300 hover:text-violet-200">← Dashboard</Link><Link href="/chat" className="text-sm text-violet-300 hover:text-violet-200">Open chat</Link></div>
      <header className="py-8"><p className="text-sm uppercase tracking-widest text-violet-300">AI Experiment Studio</p><h1 className="mt-2 text-3xl font-semibold">Search your workspace</h1><p className="mt-2 text-sm text-slate-400">Find saved conversations, prompt library entries, and uploaded documents.</p></header>
      <form onSubmit={search} className="flex gap-2"><label htmlFor="workspace-search" className="sr-only">Search chats and prompts</label><input id="workspace-search" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search titles, messages, prompts…" maxLength={120} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none focus:border-violet-400" /><button disabled={busy} className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-medium hover:bg-violet-500 disabled:opacity-50">{busy ? "Searching…" : "Search"}</button></form>
      {error && <p role="alert" className="mt-4 rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-300">{error}</p>}
      {results && <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section><h2 className="mb-3 text-lg font-semibold">Conversations <span className="text-sm font-normal text-slate-500">{results.chats.length}</span></h2>{results.chats.length ? <ul className="space-y-3">{results.chats.map((chat) => <li key={chat.id}><Link href={`/chat?id=${encodeURIComponent(chat.id)}`} className="block rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:border-violet-400/40"><h3 className="truncate text-sm font-medium">{chat.title}</h3>{chat.excerpt && <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-xs leading-5 text-slate-400">{chat.excerpt}</p>}<p className="mt-2 text-[11px] text-slate-600">Updated {new Date(chat.updatedAt).toLocaleString()}</p></Link></li>)}</ul> : <p className="rounded-xl border border-white/10 p-4 text-sm text-slate-500">No matching conversations.</p>}</section>
        <section><h2 className="mb-3 text-lg font-semibold">Saved prompts <span className="text-sm font-normal text-slate-500">{results.prompts.length}</span></h2>{results.prompts.length ? <ul className="space-y-3">{results.prompts.map((prompt) => <li key={prompt.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4"><div className="flex items-center justify-between gap-3"><h3 className="truncate text-sm font-medium">{prompt.title}</h3><span className="shrink-0 rounded-full bg-violet-400/10 px-2 py-1 text-[10px] text-violet-200">{prompt.category}</span></div><p className="mt-2 line-clamp-4 whitespace-pre-wrap break-words text-xs leading-5 text-slate-400">{prompt.prompt}</p></li>)}</ul> : <p className="rounded-xl border border-white/10 p-4 text-sm text-slate-500">No matching saved prompts.</p>}</section>
        <section className="md:col-span-2"><h2 className="mb-3 text-lg font-semibold">Documents <span className="text-sm font-normal text-slate-500">{results.documents.length}</span></h2>{results.documents.length ? <ul className="space-y-3">{results.documents.map((document) => <li key={document.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4"><div className="flex items-center justify-between gap-3"><h3 className="truncate text-sm font-medium">{document.name}</h3><Link href="/documents" className="shrink-0 text-xs text-violet-300 hover:text-violet-200">Open documents</Link></div><p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-xs leading-5 text-slate-400">{document.excerpt}</p></li>)}</ul> : <p className="rounded-xl border border-white/10 p-4 text-sm text-slate-500">No matching documents.</p>}</section>
      </div>}
    </div>
  </main>;
}

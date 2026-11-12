"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch, API_URL } from "../lib/api";

type Notification = { id: string; kind: "experiment" | "chat" | "budget" | "task" | "provider"; title: string; detail: string; createdAt: string; href: string };

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      const response = await apiFetch(`${API_URL}/api/notifications`, { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not load notifications.");
      setItems((body.notifications || []) as Notification[]);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load notifications."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void Promise.resolve().then(load); }, []);

  return <main className="min-h-screen bg-[#0b0d12] px-5 py-8 text-slate-100 md:px-10"><div className="mx-auto max-w-4xl">
    <div className="flex items-center justify-between"><Link href="/" className="text-sm text-violet-300 hover:text-violet-200">← Dashboard</Link><button type="button" onClick={() => void load()} disabled={loading} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5 disabled:opacity-50">Refresh</button></div>
    <header className="py-8"><p className="text-sm uppercase tracking-widest text-violet-300">AI Experiment Studio</p><h1 className="mt-2 text-3xl font-semibold">Notifications</h1><p className="mt-2 text-sm text-slate-400">Budget alerts, completed long tasks, provider access problems, and recent failures from your account.</p></header>
    {error && <p role="alert" className="rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-300">{error}</p>}
    {loading ? <p className="text-sm text-slate-400">Loading notifications…</p> : items.length ? <ul className="space-y-3">{items.map((item) => <li key={item.id} className="rounded-xl border border-amber-300/20 bg-amber-300/[0.04] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><Link href={item.href} className="font-medium text-amber-100 hover:underline">{item.title}</Link><time className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</time></div><p className="mt-2 text-xs uppercase tracking-wide text-slate-500">{item.kind === "budget" ? "spending alert" : item.kind === "task" ? "completed task" : item.kind === "provider" ? "provider key or access issue" : `${item.kind} failure`}</p><p className="mt-2 break-words text-sm leading-6 text-slate-300">{item.detail}</p></li>)}</ul> : <p className="rounded-xl border border-white/10 p-5 text-sm text-slate-400">No recent notifications.</p>}
  </div></main>;
}

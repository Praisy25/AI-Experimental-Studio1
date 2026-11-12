"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch, API_URL } from "../lib/api";

type Summary = {
  totalUsers: number;
  dailyActiveUsers: number;
  totalRuns: number;
  totalApiCostEstimateUsd: number;
  modelUsage: { model: string; count: number }[];
  popularPrompts: { prompt: string; count: number }[];
  recentErrors: { model: string; error: string | null; createdAt: string }[];
};

export default function AdminPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    void apiFetch(`${API_URL}/api/admin/summary`).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load admin metrics.");
      setSummary(data as Summary);
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load admin metrics."));
  }, []);

  return <main className="min-h-screen bg-[#0b0d12] px-5 py-8 text-slate-100 md:px-10"><div className="mx-auto max-w-5xl"><Link href="/" className="text-sm text-violet-300">← Dashboard</Link><p className="mt-8 text-sm uppercase tracking-widest text-violet-300">AI Experiment Studio</p><h1 className="mt-2 text-3xl font-semibold">Admin overview</h1><p className="mt-2 text-sm text-slate-400">Usage and error summaries across accounts. Estimated costs only include configured provider rates.</p>{error && <p role="alert" className="mt-5 rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-300">{error} Configure ADMIN_EMAILS on the API server with comma-separated admin addresses.</p>}{summary && <><section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Users", summary.totalUsers], ["Active today", summary.dailyActiveUsers], ["Experiment runs", summary.totalRuns], ["Estimated API cost", `$${summary.totalApiCostEstimateUsd.toFixed(4)}`]].map(([label, value]) => <article key={label} className="rounded-xl border border-white/10 bg-white/[0.03] p-5"><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></article>)}</section><section className="mt-4 grid gap-4 lg:grid-cols-2"><article className="rounded-xl border border-white/10 bg-white/[0.03] p-5"><h2 className="font-semibold">Model usage</h2>{summary.modelUsage.length ? <ul className="mt-3 space-y-2">{summary.modelUsage.map((item) => <li key={item.model} className="flex justify-between gap-3 text-sm"><span className="truncate">{item.model}</span><span>{item.count}</span></li>)}</ul> : <p className="mt-3 text-sm text-slate-500">No experiment runs yet.</p>}</article><article className="rounded-xl border border-white/10 bg-white/[0.03] p-5"><h2 className="font-semibold">Popular prompts</h2>{summary.popularPrompts.length ? <ul className="mt-3 space-y-2">{summary.popularPrompts.map((item) => <li key={item.prompt} className="flex justify-between gap-3 text-sm"><span className="truncate">{item.prompt}</span><span>{item.count}</span></li>)}</ul> : <p className="mt-3 text-sm text-slate-500">No completed prompts yet.</p>}</article></section><section className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-5"><h2 className="font-semibold">Recent failed runs</h2>{summary.recentErrors.length ? <ul className="mt-3 space-y-3">{summary.recentErrors.map((item, index) => <li key={`${item.createdAt}-${index}`} className="border-l border-red-400/30 pl-3 text-sm"><p className="font-medium">{item.model} · {new Date(item.createdAt).toLocaleString()}</p><p className="mt-1 break-words text-slate-400">{item.error || "No error details recorded."}</p></li>)}</ul> : <p className="mt-3 text-sm text-slate-500">No failed runs in the recent history.</p>}</section></>}</div></main>;
}

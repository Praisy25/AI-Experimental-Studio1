
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch as fetch, API_URL } from "./lib/api";
import LoadingSkeleton from "./components/LoadingSkeleton";

type Experiment = {
  id: string;
  name: string;
  description: string | null;
  modelName: string;
  status: string;
  createdAt: string;
};

type Dashboard = {
  totals: { experiments: number; runs: number; completedRuns: number; estimatedTokens: number; averageResponseMs: number | null };
  favoriteModels: { model: string; runs: number; averageRating: number | null }[];
  mostUsedPrompts: { title: string; uses: number }[];
  dailyUsage: { label: string; runs: number; estimatedTokens: number }[];
  weeklyUsage: { label: string; runs: number; estimatedTokens: number }[];
  monthlyUsage: { label: string; runs: number; estimatedTokens: number }[];
  activity: { id: string; kind: string; experimentId: string; title: string; detail: string; createdAt: string }[];
  recentChats: { id: string; title: string; modelName: string | null; updatedAt: string; _count: { messages: number } }[];
  recommendation: { model: string; reason: string } | null;
  costTracking: { available: boolean; estimatedUsd: number; trackedRuns: number; totalRuns: number; reason: string };
};

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [modelName, setModelName] = useState("not-configured");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [dashboardError, setDashboardError] = useState("");
  const [usagePeriod, setUsagePeriod] = useState<"daily" | "weekly" | "monthly">("daily");

  const loadDashboard = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/dashboard/summary`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load dashboard");
      setDashboard(data as Dashboard);
      setDashboardError("");
    } catch (err) {
      setDashboardError(err instanceof Error ? err.message : "Could not load dashboard");
    }
  }, []);

  const loadExperiments = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/experiments`);
      if (!response.ok) throw new Error("Could not load experiments");

      const data: Experiment[] = await response.json();
      setExperiments(data);
    } catch {
      setError("Cannot connect to the API. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadExperiments);
    void Promise.resolve().then(loadDashboard);
  }, [loadExperiments, loadDashboard]);

  const usageData = dashboard ? usagePeriod === "daily" ? dashboard.dailyUsage : usagePeriod === "weekly" ? dashboard.weeklyUsage : dashboard.monthlyUsage : [];
  const usageTitle = usagePeriod === "daily" ? "Daily usage · last 7 days" : usagePeriod === "weekly" ? "Weekly usage · last 6 weeks" : "Monthly usage · last 6 months";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/api/experiments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, modelName }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not create experiment");
      }

      setName("");
      setDescription("");
      setModelName("not-configured");
      setMessage("Experiment saved successfully.");
      await loadExperiments();
      await loadDashboard();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0b0d12] px-5 py-8 text-slate-100 md:px-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex justify-end gap-4"><Link href="/notifications" className="text-sm text-violet-300 hover:text-violet-200">Notifications</Link><Link href="/chat" className="text-sm text-violet-300 hover:text-violet-200">Chat</Link><Link href="/profile" className="text-sm text-violet-300 hover:text-violet-200">Account settings</Link></div>
        <Link href="/" className="text-sm text-violet-300 hover:text-violet-200">
          ← Back to Overview
        </Link>

        <header className="mt-8">
          <p className="text-sm uppercase tracking-widest text-violet-300">AI Experiment Studio</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Dashboard
          </h1>
          <p className="mt-2 text-slate-400">
            Your model activity, experiment results, and workspace at a glance.
          </p>
        </header>

        {!dashboard && !dashboardError && <section role="status" aria-label="Loading dashboard" className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><LoadingSkeleton className="h-24" /><LoadingSkeleton className="h-24" /><LoadingSkeleton className="h-24" /><LoadingSkeleton className="h-24" /><LoadingSkeleton className="h-52 sm:col-span-2" /><LoadingSkeleton className="h-52 sm:col-span-2" /></section>}
        {dashboardError && <p role="alert" className="mt-6 rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-300">{dashboardError}</p>}
        {dashboard && <>
          <section aria-label="Usage overview" className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[["Experiments", dashboard.totals.experiments.toLocaleString()], ["Model runs", dashboard.totals.runs.toLocaleString()], ["Tokens used", `${dashboard.totals.estimatedTokens.toLocaleString()} est.`], ["Avg. response", dashboard.totals.averageResponseMs == null ? "—" : `${(dashboard.totals.averageResponseMs / 1000).toFixed(1)} s`]].map(([label, value]) => <article key={label} className="rounded-xl border border-white/10 bg-white/[0.03] p-5"><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p>{label === "Tokens used" && <p className="mt-1 text-xs text-slate-500">Estimated from text length</p>}</article>)}
          </section>
          <section className="mt-4 grid gap-4 lg:grid-cols-3">
            <article className="rounded-xl border border-white/10 bg-white/[0.03] p-5 lg:col-span-2"><div className="flex items-center justify-between gap-2"><h2 className="font-semibold">{usageTitle}</h2><select aria-label="Usage chart range" value={usagePeriod} onChange={(event) => setUsagePeriod(event.target.value as "daily" | "weekly" | "monthly")} className="rounded-lg border border-white/10 bg-[#15171d] px-2 py-1 text-xs"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></div><div className="mt-5 grid h-36 grid-cols-7 items-end gap-3">{usageData.map((period) => { const peak = Math.max(1, ...usageData.map((item) => item.estimatedTokens)); const height = period.estimatedTokens ? Math.max(8, Math.round(period.estimatedTokens / peak * 100)) : 3; const label = usagePeriod === "daily" ? new Date(`${period.label}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" }) : period.label; return <div key={period.label} className="flex h-full flex-col items-center justify-end gap-2"><div title={`${period.estimatedTokens.toLocaleString()} estimated tokens`} className="w-full max-w-10 rounded-t-md bg-violet-500/80" style={{ height: `${height}%` }} /><span className="text-[10px] text-slate-500">{label}</span></div>; })}</div><p className="mt-3 text-xs text-slate-500">Token totals are estimates based on prompt and response text length.</p></article>
            <article className="rounded-xl border border-white/10 bg-white/[0.03] p-5"><h2 className="font-semibold">Estimated cost</h2><p className="mt-3 text-2xl font-semibold">${dashboard.costTracking.estimatedUsd.toFixed(4)}</p><p className="mt-2 text-sm leading-6 text-slate-500">Pricing configured for {dashboard.costTracking.trackedRuns} of {dashboard.costTracking.totalRuns} completed responses. {dashboard.costTracking.reason}</p><Link href="/providers" className="mt-3 inline-block text-sm text-violet-300">Manage provider pricing →</Link></article>
          </section>
          <section className="mt-4 grid gap-4 lg:grid-cols-3">
            <article className="rounded-xl border border-white/10 bg-white/[0.03] p-5"><h2 className="font-semibold">Favorite models</h2>{dashboard.favoriteModels.length ? <ul className="mt-3 space-y-3">{dashboard.favoriteModels.map((model) => <li key={model.model} className="flex items-center justify-between gap-2 text-sm"><span className="truncate">{model.model}</span><span className="shrink-0 text-slate-400">{model.runs} runs{model.averageRating != null ? ` · ${model.averageRating.toFixed(1)}/5` : ""}</span></li>)}</ul> : <p className="mt-3 text-sm text-slate-500">Run an experiment to build your model stats.</p>}</article>
            <article className="rounded-xl border border-white/10 bg-white/[0.03] p-5"><h2 className="font-semibold">AI recommendation</h2>{dashboard.recommendation ? <><p className="mt-3 text-lg font-medium text-violet-200">{dashboard.recommendation.model}</p><p className="mt-2 text-sm leading-6 text-slate-400">{dashboard.recommendation.reason}</p></> : <p className="mt-3 text-sm text-slate-500">Rate completed runs to get a recommendation based on your results.</p>}</article>
            <article className="rounded-xl border border-white/10 bg-white/[0.03] p-5"><h2 className="font-semibold">Most used prompts</h2>{dashboard.mostUsedPrompts.length ? <ul className="mt-3 space-y-3">{dashboard.mostUsedPrompts.map((prompt) => <li key={prompt.title} className="flex items-center justify-between gap-2 text-sm"><span className="truncate">{prompt.title}</span><span className="shrink-0 text-slate-400">{prompt.uses}</span></li>)}</ul> : <p className="mt-3 text-sm text-slate-500">Prompt usage appears after model runs.</p>}</article>
          </section>
          <section className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">Activity timeline</h2><Link href="/experiments" className="text-sm text-violet-300">All experiments →</Link></div>{dashboard.activity.length ? <ol className="mt-4 space-y-3">{dashboard.activity.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-l border-violet-400/30 pl-4 text-sm"><Link href={`/experiments/${item.experimentId}`} className="font-medium hover:text-violet-200">{item.title}</Link><span className="text-slate-400">{item.detail}</span><time className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</time></li>)}</ol> : <p className="mt-3 text-sm text-slate-500">Recent model runs will show here.</p>}</section>
          <section className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">Recent chats</h2><Link href="/chat" className="text-sm text-violet-300">Open chat →</Link></div>{dashboard.recentChats.length ? <ul className="mt-4 space-y-3">{dashboard.recentChats.map((chat) => <li key={chat.id} className="flex flex-wrap items-center justify-between gap-2 border-l border-violet-400/30 pl-4 text-sm"><Link href={`/chat?id=${encodeURIComponent(chat.id)}`} className="font-medium hover:text-violet-200">{chat.title}</Link><span className="text-slate-400">{chat.modelName || "No model yet"} · {chat._count.messages} messages</span><time className="text-xs text-slate-500">{new Date(chat.updatedAt).toLocaleString()}</time></li>)}</ul> : <p className="mt-3 text-sm text-slate-500">Your saved conversations will appear here.</p>}</section>
        </>}

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-lg font-semibold">Create an experiment</h2>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label htmlFor="name" className="mb-2 block text-sm text-slate-300">
                Experiment name *
              </label>
              <input
                id="name"
                required
                maxLength={120}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Customer classification baseline"
                className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-violet-400"
              />
            </div>

            <div>
              <label htmlFor="description" className="mb-2 block text-sm text-slate-300">
                Description
              </label>
              <textarea
                id="description"
                rows={3}
                maxLength={2000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What do you want to test?"
                className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-violet-400"
              />
            </div>

            <div>
              <label htmlFor="modelName" className="mb-2 block text-sm text-slate-300">
                Model
              </label>
              <select
                id="modelName"
                value={modelName}
                onChange={(event) => setModelName(event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#15171d] px-4 py-3 outline-none focus:border-violet-400"
              >
                <option value="not-configured">Not configured yet</option>
                <option value="ollama">Ollama (local model)</option>
                <option value="custom">Custom model</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-violet-600 px-5 py-3 font-medium hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Create experiment"}
            </button>
          </form>

          {error && (
            <p role="alert" className="mt-4 text-sm text-red-400">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="mt-4 text-sm text-emerald-400">
              {message}
            </p>
          )}
        </section>

        <section className="mt-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">Saved experiments</h2>
            <button
              type="button"
              onClick={() => void loadExperiments()}
              disabled={loading}
              className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <p className="mt-5 text-sm text-slate-400">Loading experiments...</p>
          ) : experiments.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-white/15 p-8 text-center">
              <p className="font-medium">No experiments yet</p>
              <p className="mt-2 text-sm text-slate-400">
                Create your first experiment using the form above.
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {experiments.map((experiment) => (
                <Link
                  key={experiment.id}
                  href={`/experiments/${experiment.id}`}
                  className="block rounded-xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-violet-400/50 hover:bg-white/[0.06]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold">{experiment.name}</h3>
                    <span className="rounded-full bg-violet-400/10 px-2 py-1 text-xs text-violet-300">
                      {experiment.status}
                    </span>
                  </div>

                  <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-400">
                    {experiment.description || "No description provided."}
                  </p>

                  <p className="mt-4 text-xs text-slate-500">
                    Model: {experiment.modelName}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Created: {new Date(experiment.createdAt).toLocaleString()}
                  </p>
                  <p className="mt-3 text-sm text-violet-300">
                    View details →
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

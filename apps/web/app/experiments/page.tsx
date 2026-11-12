
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch as fetch } from "../lib/api";

type Experiment = {
  id: string;
  name: string;
  description: string | null;
  modelName: string;
  status: string;
  createdAt: string;
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [modelName, setModelName] = useState("not-configured");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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

  useEffect(() => { void Promise.resolve().then(loadExperiments); }, [loadExperiments]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/api/experiments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          modelName,
        }),
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
        <div className="mb-3 text-right"><Link href="/profile" className="text-sm text-violet-300 hover:text-violet-200">Account settings</Link></div>
        <Link href="/" className="text-sm text-violet-300 hover:text-violet-200">
          ← Back to Overview
        </Link>

        <header className="mt-8">
          <p className="text-sm uppercase tracking-widest text-violet-300">
            Workspace / Experiments
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Experiments
          </h1>
          <p className="mt-2 text-slate-400">
            Create and manage your AI experiments locally.
          </p>
        </header>

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
              <label
                htmlFor="description"
                className="mb-2 block text-sm text-slate-300"
              >
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
              <label
                htmlFor="modelName"
                className="mb-2 block text-sm text-slate-300"
              >
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
                <article
                  key={experiment.id}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-5"
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
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

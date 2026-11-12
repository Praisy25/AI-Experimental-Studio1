"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "../lib/api";

type Mode = "login" | "signup" | "forgot";

export default function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [localResetUrl, setLocalResetUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLocalResetUrl("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const body: Record<string, unknown> = Object.fromEntries(form.entries());
    if (mode === "login") body.rememberMe = rememberMe;
    try {
      const response = await fetch(`${API_URL}/api/auth/${mode === "signup" ? "signup" : mode === "forgot" ? "forgot-password" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not complete the request.");
      if (mode === "forgot") { setMessage(data.message); setLocalResetUrl(typeof data.resetUrl === "string" ? data.resetUrl : ""); }
      else router.replace("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not complete the request.");
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset your password" : "Welcome back";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b0d12] px-5 py-10 text-slate-100">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-7 shadow-2xl shadow-black/30">
        <Link href="/" className="text-sm text-violet-300">AI Experiment Studio</Link>
        <h1 className="mt-6 text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-slate-400">{mode === "signup" ? "Create a private workspace for your experiments." : mode === "forgot" ? "We’ll email a time-limited reset link if the address is registered." : "Sign in to continue to your workspace."}</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "signup" && <>
            <label className="block text-sm text-slate-300">Name<input name="name" required maxLength={100} autoComplete="name" className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5" /></label>
            <label className="block text-sm text-slate-300">Username<input name="username" required minLength={3} maxLength={30} pattern="[A-Za-z0-9_]+" autoComplete="username" className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5" /></label>
          </>}
          <label className="block text-sm text-slate-300">Email<input name="email" required type="email" maxLength={254} autoComplete="email" className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5" /></label>
          {mode !== "forgot" && <label className="block text-sm text-slate-300">Password<input name="password" required type="password" minLength={10} maxLength={128} autoComplete={mode === "signup" ? "new-password" : "current-password"} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5" /></label>}
          {mode === "signup" && <label className="block text-sm text-slate-300">Confirm password<input name="confirmPassword" required type="password" minLength={10} maxLength={128} autoComplete="new-password" className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5" /></label>}
          {mode === "login" && <label className="flex items-center gap-2 text-sm text-slate-400"><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />Remember me</label>}
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          {message && <p role="status" className="text-sm text-emerald-300">{message}</p>}
          {localResetUrl && <a href={localResetUrl} className="block break-all rounded-lg border border-violet-400/20 bg-violet-400/5 p-3 text-sm text-violet-200">Open local password reset link</a>}
          <button disabled={busy} className="w-full rounded-lg bg-violet-600 px-4 py-3 font-medium hover:bg-violet-500 disabled:opacity-60">{busy ? "Please wait…" : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in"}</button>
        </form>
        <div className="mt-5 flex flex-wrap justify-between gap-3 text-sm text-slate-400">
          {mode === "login" && <Link href="/forgot-password" className="hover:text-violet-300">Forgot password?</Link>}
          <Link href={mode === "signup" ? "/login" : "/signup"} className="hover:text-violet-300">{mode === "signup" ? "Already registered? Sign in" : "New here? Create an account"}</Link>
        </div>
      </section>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { API_URL } from "../lib/api";

export default function ResetPasswordForm() {
  const token = useSearchParams().get("token") || "";
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${API_URL}/api/auth/reset-password`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ token, password: form.get("password"), confirmPassword: form.get("confirmPassword") }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not reset password.");
      router.replace("/login?reset=1");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not reset password.");
    } finally { setBusy(false); }
  }

  return <main className="flex min-h-screen items-center justify-center bg-[#0b0d12] px-5 text-slate-100"><section className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-7"><Link href="/login" className="text-sm text-violet-300">Back to sign in</Link><h1 className="mt-6 text-2xl font-semibold">Choose a new password</h1><form onSubmit={submit} className="mt-6 space-y-4"><label className="block text-sm text-slate-300">New password<input name="password" required minLength={10} maxLength={128} type="password" autoComplete="new-password" className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5" /></label><label className="block text-sm text-slate-300">Confirm password<input name="confirmPassword" required minLength={10} maxLength={128} type="password" autoComplete="new-password" className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5" /></label>{error && <p role="alert" className="text-sm text-red-300">{error}</p>}<button disabled={busy || !token} className="w-full rounded-lg bg-violet-600 px-4 py-3 font-medium disabled:opacity-60">{busy ? "Updating…" : "Reset password"}</button></form></section></main>;
}

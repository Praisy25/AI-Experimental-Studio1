"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { apiFetch as fetch, API_URL } from "../lib/api";

type User = { id: string; name: string; username: string; email: string; avatarDataUrl: string | null; preferredLanguage: string | null; preferredExplanationStyle: string | null; dailyBudgetUsd: number | null };

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(`${API_URL}/api/auth/me`);
    if (!response.ok) { window.location.replace("/login"); return; }
    const data = await response.json();
    setUser(data.user);
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function updateProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice(""); setError("");
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    const response = await fetch(`${API_URL}/api/auth/profile`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) { setError(data.error); return; }
    setUser(data.user); setNotice("Profile updated.");
  }
  async function uploadAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setNotice(""); setError("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 1024 * 1024) {
      setError("Choose a PNG, JPEG, or WebP image up to 1 MB."); input.value = ""; return;
    }
    const reader = new FileReader();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onerror = () => reject(new Error("Could not read this image."));
      reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read this image."));
      reader.readAsDataURL(file);
    }).catch((readError) => { setError(readError instanceof Error ? readError.message : "Could not read this image."); return ""; });
    if (!dataUrl) { input.value = ""; return; }
    const response = await fetch(`${API_URL}/api/auth/avatar`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mimeType: file.type, data: dataUrl.split(",")[1] }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setError(result.error || "Could not save the profile picture."); input.value = ""; return; }
    setUser((current) => current ? { ...current, avatarDataUrl: result.avatarDataUrl } : current);
    setNotice("Profile picture updated."); input.value = "";
  }

  async function removeAvatar() {
    const response = await fetch(`${API_URL}/api/auth/avatar`, { method: "DELETE" });
    if (!response.ok) { setError("Could not remove the profile picture."); return; }
    setUser((current) => current ? { ...current, avatarDataUrl: null } : current);
    setNotice("Profile picture removed.");
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice(""); setError("");
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    const response = await fetch(`${API_URL}/api/auth/change-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) { setError(data.error); return; }
    await fetch(`${API_URL}/api/auth/logout`, { method: "POST" });
    window.location.replace("/login");
  }

  async function logout() {
    await fetch(`${API_URL}/api/auth/logout`, { method: "POST" });
    window.location.replace("/login");
  }

  async function deleteAccount() {
    const password = window.prompt("Enter your password to permanently delete your account and experiments.");
    if (password === null) return;
    const response = await fetch(`${API_URL}/api/auth/account`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    if (!response.ok) { const data = await response.json(); setError(data.error || "Could not delete account."); return; }
    window.location.replace("/signup");
  }

  return <main className="min-h-screen bg-[#0b0d12] px-5 py-8 text-slate-100 md:px-10"><div className="mx-auto max-w-3xl"><Link href="/" className="text-sm text-violet-300">â† Back to workspace</Link><h1 className="mt-6 text-3xl font-semibold">Account settings</h1>{!user ? <p className="mt-5 text-slate-400">Loading accountâ€¦</p> : <>
    <div className="mt-3 flex items-center gap-3 text-sm text-slate-400">{user.avatarDataUrl ? <Image unoptimized width={48} height={48} src={user.avatarDataUrl} alt="Profile picture" className="h-12 w-12 rounded-full object-cover" /> : <div aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-500/20 text-lg font-semibold text-violet-200">{(user.name || user.username).slice(0, 1).toUpperCase()}</div>}<span>Signed in as {user.email}</span></div>
    {notice && <p role="status" className="mt-4 text-sm text-emerald-300">{notice}</p>}{error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
    <Link href="/providers" className="mt-4 inline-flex rounded-lg border border-white/15 px-4 py-2.5 text-sm">Manage AI provider connections</Link><section className="mt-7 rounded-2xl border border-white/10 bg-white/[0.03] p-6"><h2 className="text-lg font-semibold">Profile</h2><form onSubmit={updateProfile} className="mt-4 space-y-4"><label className="block text-sm text-slate-300">Name<input name="name" required maxLength={100} defaultValue={user.name} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5" /></label><label className="block text-sm text-slate-300">Username<input name="username" required minLength={3} maxLength={30} pattern="[A-Za-z0-9_]+" defaultValue={user.username} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5" /></label><label className="block text-sm text-slate-300">Preferred coding language<select name="preferredLanguage" defaultValue={user.preferredLanguage || ""} className="mt-2 w-full rounded-lg border border-white/10 bg-[#15171d] px-3 py-2.5"><option value="">No preference</option>{["Python", "JavaScript", "TypeScript", "Java", "C#", "C++", "Go", "Rust", "SQL"].map((language) => <option key={language} value={language}>{language}</option>)}</select></label><label className="block text-sm text-slate-300">Preferred explanation style<select name="preferredExplanationStyle" defaultValue={user.preferredExplanationStyle || ""} className="mt-2 w-full rounded-lg border border-white/10 bg-[#15171d] px-3 py-2.5"><option value="">No preference</option><option value="concise">Concise and direct</option><option value="step-by-step">Step by step</option><option value="beginner-friendly">Beginner friendly</option><option value="technical">Detailed and technical</option></select></label><label className="block text-sm text-slate-300">Daily spending alert (USD)<input name="dailyBudgetUsd" type="number" min="0.01" max="100000" step="0.01" defaultValue={user.dailyBudgetUsd ?? ""} placeholder="Leave blank to disable" className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5" /></label><p className="-mt-2 text-xs text-slate-500">You will see a notification when today estimated costs reach this limit. Estimates use configured provider rates.</p><button className="rounded-lg bg-violet-600 px-4 py-2.5 font-medium">Save profile</button></form></section>
    <section className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6"><h2 className="text-lg font-semibold">Profile picture</h2><p className="mt-2 text-sm text-slate-400">PNG, JPEG, or WebP, up to 1 MB.</p><div className="mt-4 flex flex-wrap gap-3"><label className="cursor-pointer rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium">Upload picture<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void uploadAvatar(event)} className="sr-only" /></label>{user.avatarDataUrl && <button onClick={() => void removeAvatar()} className="rounded-lg border border-white/15 px-4 py-2.5 text-sm">Remove picture</button>}</div></section>
    <section className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6"><h2 className="text-lg font-semibold">Change password</h2><form onSubmit={changePassword} className="mt-4 space-y-4">{[["currentPassword", "Current password"], ["newPassword", "New password"], ["confirmPassword", "Confirm new password"]].map(([name, label]) => <label key={name} className="block text-sm text-slate-300">{label}<input name={name} required minLength={name === "currentPassword" ? undefined : 10} maxLength={128} type="password" autoComplete="new-password" className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5" /></label>)}<button className="rounded-lg bg-violet-600 px-4 py-2.5 font-medium">Change password</button></form></section>
    <section className="mt-5 flex flex-wrap gap-3"><button onClick={() => void logout()} className="rounded-lg border border-white/15 px-4 py-2.5">Sign out</button><button onClick={() => void deleteAccount()} className="rounded-lg border border-red-400/40 px-4 py-2.5 text-red-300">Delete account</button></section>
  </>}</div></main>;
}

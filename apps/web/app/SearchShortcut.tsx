"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";

const commands = [
  { label: "Open dashboard", detail: "Overview and analytics", href: "/" },
  { label: "Start a chat", detail: "Chat with connected models", href: "/chat" },
  { label: "Experiments", detail: "Run and compare experiments", href: "/experiments" },
  { label: "Documents", detail: "Manage workspace files", href: "/documents" },
  { label: "Research assistant", detail: "Analyze documents", href: "/research" },
  { label: "Connected providers", detail: "Manage models and pricing", href: "/providers" },
  { label: "Global search", detail: "Search chats, prompts, and files", href: "/search" },
  { label: "Notifications", detail: "Review account alerts", href: "/notifications" },
  { label: "Profile settings", detail: "Account and preferences", href: "/profile" },
];

export default function SearchShortcut() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("ai-studio-theme");
    document.documentElement.dataset.theme = saved === "light" ? "light" : "dark";

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      } else if (event.key === "Escape") { setOpen(false); setQuery(""); setActive(0); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    return value ? commands.filter((command) => `${command.label} ${command.detail}`.toLowerCase().includes(value)) : commands;
  }, [query]);

  function navigate(href: string) {
    setOpen(false);
    setQuery(""); setActive(0);
    if (href === "/search" && query.trim().length >= 2) router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    else router.push(href);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (filtered[active]) navigate(filtered[active].href);
    else if (query.trim().length >= 2) navigate("/search");
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") { event.preventDefault(); setActive((index) => (index + 1) % Math.max(1, filtered.length)); }
    if (event.key === "ArrowUp") { event.preventDefault(); setActive((index) => (index - 1 + Math.max(1, filtered.length)) % Math.max(1, filtered.length)); }
  }

  function toggleTheme() {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("ai-studio-theme", next);
  }

  return <>
    <button type="button" onClick={toggleTheme} aria-label="Switch theme" title="Switch theme" className="fixed bottom-4 right-4 z-40 rounded-full border border-white/15 bg-[#15171d] px-3 py-2 text-sm text-slate-200 shadow-lg hover:border-violet-400/50">Toggle theme</button>
    {open && <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 pt-[12vh]" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="global-command-title" className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-[#15171d] shadow-2xl">
        <form onSubmit={submit}>
          <h2 id="global-command-title" className="sr-only">Command palette</h2>
          <input ref={inputRef} value={query} onChange={(event) => { setQuery(event.target.value); setActive(0); }} onKeyDown={onInputKeyDown} placeholder="Search pages and actions..." maxLength={120} className="w-full border-b border-white/10 bg-transparent px-5 py-5 text-base outline-none placeholder:text-slate-500" />
          <div role="listbox" aria-label="Available commands" className="max-h-[55vh] overflow-y-auto p-2">
            {filtered.map((command, index) => <button type="button" role="option" aria-selected={active === index} key={command.href} onMouseEnter={() => setActive(index)} onClick={() => navigate(command.href)} className={`flex w-full items-center justify-between rounded-lg px-4 py-3 text-left ${active === index ? "bg-violet-500/20 text-white" : "text-slate-300 hover:bg-white/5"}`}><span><span className="block text-sm font-medium">{command.label}</span><span className="mt-1 block text-xs text-slate-500">{command.detail}</span></span><span className="text-xs text-slate-500">Enter</span></button>)}
            {!filtered.length && <p className="px-4 py-6 text-center text-sm text-slate-400">No matching pages. Press Enter to search for “{query}”.</p>}
          </div>
          <div className="flex items-center justify-between border-t border-white/10 px-5 py-3 text-xs text-slate-500"><span>Navigate with ↑ ↓ · Open with Enter</span><button type="button" onClick={() => setOpen(false)} className="rounded border border-white/10 px-2 py-1">Esc</button></div>
        </form>
      </section>
    </div>}
  </>;
}

"use client";

import { useEffect, useState } from "react";

type Toast = { id: number; message: string; kind: "success" | "error" | "info" };

export default function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    function onToast(event: Event) {
      const detail = (event as CustomEvent<{ message?: string; kind?: Toast["kind"] }>).detail;
      if (!detail?.message) return;
      const id = Date.now() + Math.random();
      setToasts((items) => [...items.slice(-3), { id, message: detail.message!, kind: detail.kind || "info" }]);
      window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 4000);
    }
    window.addEventListener("ai-studio:toast", onToast);
    return () => window.removeEventListener("ai-studio:toast", onToast);
  }, []);

  return <div aria-live="polite" className="pointer-events-none fixed right-4 top-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
    {toasts.map((toast) => <div key={toast.id} role={toast.kind === "error" ? "alert" : "status"} className={`toast-enter pointer-events-auto flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur ${toast.kind === "success" ? "border-emerald-400/30 bg-emerald-950/90 text-emerald-100" : toast.kind === "error" ? "border-red-400/30 bg-red-950/90 text-red-100" : "border-violet-400/30 bg-slate-900/95 text-slate-100"}`}><span>{toast.message}</span><button type="button" aria-label="Dismiss notification" onClick={() => setToasts((items) => items.filter((item) => item.id !== toast.id))} className="text-current opacity-70 hover:opacity-100">×</button></div>)}
  </div>;
}

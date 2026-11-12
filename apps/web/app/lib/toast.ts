export function showToast(message: string, kind: "success" | "error" | "info" = "info") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("ai-studio:toast", { detail: { message, kind } }));
}

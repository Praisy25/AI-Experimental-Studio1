export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const request = () => fetch(input, { ...init, credentials: "include" });
  let response = await request();
  const url = String(input);

  const authEndpoint = /\/api\/auth\/(login|signup|forgot-password|reset-password|refresh|logout)(\?|$)/.test(url);
  if (response.status === 401 && !authEndpoint) {
    const refreshed = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    }).catch(() => null);
    if (refreshed?.ok) response = await request();
    else if (typeof window !== "undefined") window.location.replace("/login");
  }

  return response;
}

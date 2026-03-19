// ─── API Client ──────────────────────────────────────────────────
// Fetch wrapper for client components.
// - Reads csrf_token cookie, sends as X-CSRF-Token header on unsafe methods
// - On 401: silently tries /api/auth/refresh, then retries once

function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export interface ApiError {
  code: string;
  message: string;
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

const UNSAFE_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

export async function apiClient<T = unknown>(
  url: string,
  options: RequestInit = {},
): Promise<ApiResult<T>> {
  const method = (options.method || "GET").toUpperCase();

  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (UNSAFE_METHODS.has(method)) {
    const csrf = getCsrfToken();
    if (csrf) headers.set("X-CSRF-Token", csrf);
  }

  const fetchOpts: RequestInit = { ...options, method, headers };

  let response = await fetch(url, fetchOpts);

  // 401 → try silent refresh, then retry once
  if (
    response.status === 401 &&
    !url.includes("/api/auth/refresh") &&
    !url.includes("/api/auth/login")
  ) {
    const refreshRes = await fetch("/api/auth/refresh", {
      method: "POST",
    });
    if (refreshRes.ok) {
      // After refresh, browser cookie jar is updated — re-read CSRF
      if (UNSAFE_METHODS.has(method)) {
        const newCsrf = getCsrfToken();
        if (newCsrf) headers.set("X-CSRF-Token", newCsrf);
      }
      response = await fetch(url, fetchOpts);
    }
  }

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      ok: false,
      error: body.error ?? { code: "UNKNOWN", message: "Произошла ошибка" },
    };
  }

  return { ok: true, data: body as T };
}

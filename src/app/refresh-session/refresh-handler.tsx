"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Silent session refresh page.
 *
 * Middleware redirects here when:
 * - access_token is expired/missing
 * - has_session cookie exists (indicates refresh_token may be valid)
 *
 * Flow:
 * 1. POST /api/auth/refresh (browser sends refresh_token cookie automatically)
 * 2. On success → redirect to ?redirect param (new access_token in cookies)
 * 3. On failure → redirect to /login (session truly expired)
 *
 * Uses window.location.href for redirect to ensure fresh cookie state.
 */
export function RefreshHandler() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const redirectTo = searchParams.get("redirect");
    const safeRedirect =
      redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")
        ? redirectTo
        : "/";

    fetch("/api/auth/refresh", { method: "POST" })
      .then((res) => {
        if (res.ok) {
          window.location.href = safeRedirect;
        } else {
          // Refresh failed → session expired, go to login
          window.location.href = `/login?redirect=${encodeURIComponent(safeRedirect)}`;
        }
      })
      .catch(() => {
        window.location.href = `/login?redirect=${encodeURIComponent(safeRedirect)}`;
      });
  }, [searchParams]);

  return null;
}

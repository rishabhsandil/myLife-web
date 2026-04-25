/**
 * In-memory access-token store.
 *
 * Access tokens are short-lived (~15 min) and live ONLY in memory — never
 * in localStorage. The long-lived refresh token is held in an httpOnly
 * cookie that the browser sends automatically to /api/auth/refresh.
 *
 * On app boot AuthContext calls `refreshAccessToken()` to mint a fresh
 * access token from the refresh cookie. After expiry, `api.ts` retries
 * a 401 response by calling `refreshAccessToken()` once before failing.
 */

interface User {
  id: string;
  email: string;
  name: string;
}

interface RefreshResponse {
  user: User;
  accessToken: string;
}

let accessToken: string | null = null;
// Single-flight guard so concurrent 401s only trigger one refresh round-trip.
let inFlightRefresh: Promise<RefreshResponse | null> | null = null;
// Listeners notified when the refresh cookie is rejected so the app can
// drop the user from state and route back to the login screen.
const sessionExpiredListeners = new Set<() => void>();

const API_BASE = import.meta.env.VITE_API_URL || '';

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function clearAccessToken(): void {
  accessToken = null;
}

export function onSessionExpired(listener: () => void): () => void {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

function notifySessionExpired(): void {
  sessionExpiredListeners.forEach((l) => l());
}

/**
 * Exchange the httpOnly refresh cookie for a fresh access token.
 *
 * Returns the user + token on success, or `null` if the cookie is
 * missing/expired/invalid (the caller should treat that as logged out).
 * Concurrent calls share a single in-flight request.
 */
export function refreshAccessToken(): Promise<RefreshResponse | null> {
  if (inFlightRefresh) return inFlightRefresh;

  inFlightRefresh = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        accessToken = null;
        if (res.status === 401) notifySessionExpired();
        return null;
      }
      const data = (await res.json()) as RefreshResponse;
      accessToken = data.accessToken;
      return data;
    } catch {
      // Network failure — leave the existing token in place; api.ts will
      // surface the underlying error to the caller.
      return null;
    } finally {
      inFlightRefresh = null;
    }
  })();

  return inFlightRefresh;
}

/** Tell the server to clear the refresh cookie. Best-effort. */
export async function revokeRefreshToken(): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // Ignore — the in-memory token is being cleared either way.
  }
}

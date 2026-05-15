import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  getAccessToken,
  setAccessToken,
  clearAccessToken,
  refreshAccessToken,
  revokeRefreshToken,
  onSessionExpired,
} from '../utils/authToken';

interface User {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, name: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  verifyEmail: (code: string) => Promise<void>;
  resendVerification: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = import.meta.env.VITE_API_URL || '';

interface AuthResponse {
  user: User;
  accessToken: string;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, try to mint a fresh access token from the httpOnly refresh
  // cookie. If that succeeds we already have the user payload and don't
  // need a separate /auth/me round-trip.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await refreshAccessToken();
      if (cancelled) return;
      if (result) {
        setUser(result.user);
      } else {
        clearAccessToken();
      }
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // If a later refresh attempt fails (e.g. cookie expired while the tab was
  // open), drop the user from state so the app routes back to login.
  useEffect(() => {
    return onSessionExpired(() => {
      clearAccessToken();
      setUser(null);
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    const { user: u, accessToken } = data as AuthResponse;
    setAccessToken(accessToken);
    setUser(u);
  }, []);

  const signup = useCallback(async (email: string, name: string, password: string) => {
    const response = await fetch(`${API_BASE}/api/auth/signup`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, password }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Signup failed');
    }

    const { user: u, accessToken } = data as AuthResponse;
    setAccessToken(accessToken);
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    // Tell the server to clear the refresh cookie before dropping local state.
    await revokeRefreshToken();
    clearAccessToken();
    setUser(null);
  }, []);

  const verifyEmail = useCallback(async (code: string) => {
    const response = await fetch(`${API_BASE}/api/auth/verify-email`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAccessToken() ?? ''}` },
      body: JSON.stringify({ code }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Verification failed');
    setUser(u => u ? { ...u, emailVerified: true } : u);
  }, []);

  const resendVerification = useCallback(async () => {
    const response = await fetch(`${API_BASE}/api/auth/resend-verification`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAccessToken() ?? ''}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to resend verification email');
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout, verifyEmail, resendVerification }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Re-exported so callers that need to read the current access token
// (rare — prefer going through utils/api.ts) don't import from two places.
export { getAccessToken };

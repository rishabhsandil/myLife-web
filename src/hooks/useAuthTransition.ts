import { useEffect, useRef } from 'react';

/**
 * Calls `onLogin` when the auth user transitions from null → defined,
 * and `onLogout` when it transitions defined → null.
 *
 * Replaces the previous useRef-based prev-userId tracking in App.tsx.
 */
export function useAuthTransition(
  userId: string | null | undefined,
  onLogin: () => void,
  onLogout: () => void,
) {
  const prevRef = useRef<string | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    const current = userId ?? null;

    if (!prev && current) onLogin();
    else if (prev && !current) onLogout();

    prevRef.current = current;
  }, [userId, onLogin, onLogout]);
}

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api/client';
import type { User } from './api/types';

interface AuthState {
  user: User | null;
  loading: boolean;
  /** True after the user signed out in this tab, so the next sign-in starts at the groups list. */
  signedOut: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Clears the user locally, e.g. after the server reports an expired session. */
  forget: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .currentUser()
      .then((current) => active && setUser(current))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setUser(await api.signIn(email, password));
    setSignedOut(false);
  }, []);
  const signUp = useCallback(async (email: string, password: string) => {
    setUser(await api.signUp(email, password));
    setSignedOut(false);
  }, []);
  const signOut = useCallback(async () => {
    try {
      await api.signOut();
    } finally {
      setSignedOut(true);
      setUser(null);
    }
  }, []);
  const forget = useCallback(() => setUser(null), []);

  const value = useMemo(
    () => ({ user, loading, signedOut, signIn, signUp, signOut, forget }),
    [user, loading, signedOut, signIn, signUp, signOut, forget],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

/** The signed-in user; only call inside routes guarded by RequireAuth. */
export function useUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error('No signed-in user');
  return user;
}

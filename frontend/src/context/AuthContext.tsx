'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import * as auth from '@/lib/auth';

interface AuthContextValue {
  user: auth.AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<auth.AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    auth.fetchMe().then((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login: async (email, password) => setUser(await auth.login(email, password)),
        register: async (email, password, displayName) =>
          setUser(await auth.register(email, password, displayName)),
        logout: () => {
          auth.clearToken();
          setUser(null);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

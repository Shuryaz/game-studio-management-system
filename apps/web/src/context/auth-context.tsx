"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";

const API = process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:3001";

export type Role = "admin" | "producer" | "developer" | "designer" | "qa";

export function normalizeRole(value: unknown): Role | null {
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();
  if (normalized === "admin" || normalized === "producer" || normalized === "developer" || normalized === "designer" || normalized === "qa") {
    return normalized as Role;
  }

  return null;
}

export interface AuthUser {
  id:       number;
  username: string;
  name?:    string;
  email:    string;
  role:     Role;
}

interface AuthContextValue {
  user:    AuthUser | null;
  loading: boolean;
  /** Reset the current auth state immediately before a new login or logout */
  clearUser: () => void;
  /** Call after login to hydrate the context immediately */
  setUser: (u: AuthUser | null) => void;
  /** Refresh from /users/me (e.g. after profile save) */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user:    null,
  loading: true,
  clearUser: () => {},
  setUser: () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const requestIdRef = useRef(0);

  const clearUser = () => {
    requestIdRef.current += 1;
    setUser(null);
  };

  async function fetchMe(signal?: AbortSignal) {
    const requestId = ++requestIdRef.current;

    try {
      const res = await fetch(`${API}/users/me`, { credentials: "include", signal });
      if (signal?.aborted || requestId !== requestIdRef.current) return;

      if (!res.ok) { setUser(null); return; }
      const json = await res.json();

      if (!json.success || !json.data) {
        setUser(null);
        return;
      }

      const role = normalizeRole(json.data.role ?? json.data.roleName);
      if (!role) {
        setUser(null);
        return;
      }

      setUser({ ...json.data, role } as AuthUser);
    } catch {
      if (signal?.aborted || requestId !== requestIdRef.current) return;
      setUser(null);
    } finally {
      if (signal?.aborted || requestId !== requestIdRef.current) return;
      setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    fetchMe(controller.signal);

    return () => {
      controller.abort();
      requestIdRef.current += 1;
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, clearUser, setUser, refresh: () => fetchMe() }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

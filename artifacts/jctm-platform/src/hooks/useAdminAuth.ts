/**
 * useAdminAuth — Role-based admin authentication hook
 *
 * Manages per-role admin tokens in localStorage, validates sessions on mount,
 * and provides login / logout helpers.
 *
 * Usage:
 *   const { isAdmin, adminToken, isLoading, login, logout } = useAdminAuth("gallery");
 */

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

export type AdminRole = "gallery" | "sermon" | "livestream";

const STORAGE_KEY = (role: AdminRole) => `jctm-admin-token-${role}`;
const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export interface AdminAuthState {
  isAdmin: boolean;
  adminToken: string;
  isLoading: boolean;
  login: (passphrase: string) => Promise<boolean>;
  logout: () => void;
}

export function useAdminAuth(role: AdminRole): AdminAuthState {
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminToken, setAdminToken] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    setIsAdmin(false);
    setAdminToken("");
    window.localStorage.removeItem(STORAGE_KEY(role));
  }, [role]);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY(role));
    if (!stored) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/admin/auth/session`, {
          headers: authHeaders(stored),
        });
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && data?.authenticated === true && data?.role === role) {
          setAdminToken(stored);
          setIsAdmin(true);
        } else {
          window.localStorage.removeItem(STORAGE_KEY(role));
        }
      } catch {
        if (!cancelled) window.localStorage.removeItem(STORAGE_KEY(role));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [role]);

  const login = useCallback(async (passphrase: string): Promise<boolean> => {
    try {
      const res = await fetch(`${BASE_URL}/api/admin/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase, role }),
      });
      const data = await res.json();
      if (!res.ok || typeof data?.token !== "string") {
        toast.error(data?.error ?? "Incorrect passphrase");
        return false;
      }
      window.localStorage.setItem(STORAGE_KEY(role), data.token);
      setAdminToken(data.token);
      setIsAdmin(true);
      toast.success(`${capitalize(role)} admin access granted`);
      return true;
    } catch {
      toast.error("Unable to verify admin passphrase.");
      return false;
    }
  }, [role]);

  return { isAdmin, adminToken, isLoading, login, logout };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function adminAuthHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

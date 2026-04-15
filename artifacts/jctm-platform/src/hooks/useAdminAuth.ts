/**
 * useAdminAuth — Role-based admin authentication hook
 *
 * Manages per-role admin tokens in localStorage, validates sessions on mount,
 * and provides login / logout / setup / change-passphrase helpers.
 *
 * Usage:
 *   const auth = useAdminAuth("gallery");
 *   // auth.needsSetup  — true when role has no passphrase configured yet
 *   // auth.isAdmin     — true when authenticated
 *   // auth.login(pass) — authenticate with passphrase
 *   // auth.setup(pass, confirm)  — first-time setup
 *   // auth.changePassphrase(current, next, confirm)
 *   // auth.logout()
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
  needsSetup: boolean;
  adminToken: string;
  isLoading: boolean;
  login: (passphrase: string) => Promise<boolean>;
  setup: (passphrase: string, confirmPassphrase: string) => Promise<boolean>;
  changePassphrase: (
    currentPassphrase: string,
    newPassphrase: string,
    confirmPassphrase: string,
  ) => Promise<boolean>;
  logout: () => void;
}

export function useAdminAuth(role: AdminRole): AdminAuthState {
  const [isAdmin, setIsAdmin]       = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [adminToken, setAdminToken] = useState("");
  const [isLoading, setIsLoading]   = useState(true);

  const logout = useCallback(() => {
    setIsAdmin(false);
    setAdminToken("");
    window.localStorage.removeItem(STORAGE_KEY(role));
  }, [role]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const stored = window.localStorage.getItem(STORAGE_KEY(role));

      if (stored) {
        try {
          const res  = await fetch(`${BASE_URL}/api/admin/auth/session`, { headers: authHeaders(stored) });
          const data = await res.json();
          if (!cancelled) {
            if (res.ok && data?.authenticated === true && data?.role === role) {
              setAdminToken(stored);
              setIsAdmin(true);
              setIsLoading(false);
              return;
            }
            window.localStorage.removeItem(STORAGE_KEY(role));
          }
        } catch {
          if (!cancelled) window.localStorage.removeItem(STORAGE_KEY(role));
        }
      }

      // Check whether the role needs first-time setup
      try {
        const res  = await fetch(`${BASE_URL}/api/admin/auth/roles`);
        const data = await res.json() as { roles: { role: AdminRole; configured: boolean }[] };
        if (!cancelled) {
          const entry = data.roles?.find((r) => r.role === role);
          setNeedsSetup(entry ? !entry.configured : false);
        }
      } catch {
        // ignore — keep needsSetup false
      }

      if (!cancelled) setIsLoading(false);
    })();

    return () => { cancelled = true; };
  }, [role]);

  const login = useCallback(async (passphrase: string): Promise<boolean> => {
    try {
      const res  = await fetch(`${BASE_URL}/api/admin/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase, role }),
      });
      const data = await res.json();

      if (data?.needsSetup) {
        setNeedsSetup(true);
        return false;
      }

      if (!res.ok || typeof data?.token !== "string") {
        toast.error(data?.error ?? "Incorrect passphrase");
        return false;
      }

      window.localStorage.setItem(STORAGE_KEY(role), data.token);
      setAdminToken(data.token);
      setIsAdmin(true);
      setNeedsSetup(false);
      toast.success(`${capitalize(role)} admin access granted`);
      return true;
    } catch {
      toast.error("Unable to verify admin passphrase.");
      return false;
    }
  }, [role]);

  const setup = useCallback(async (passphrase: string, confirmPassphrase: string): Promise<boolean> => {
    try {
      const res  = await fetch(`${BASE_URL}/api/admin/auth/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, passphrase, confirmPassphrase }),
      });
      const data = await res.json();

      if (!res.ok || typeof data?.token !== "string") {
        toast.error(data?.error ?? "Setup failed. Please try again.");
        return false;
      }

      window.localStorage.setItem(STORAGE_KEY(role), data.token);
      setAdminToken(data.token);
      setIsAdmin(true);
      setNeedsSetup(false);
      toast.success(`${capitalize(role)} admin access created and activated`);
      return true;
    } catch {
      toast.error("Unable to complete admin setup.");
      return false;
    }
  }, [role]);

  const changePassphrase = useCallback(async (
    currentPassphrase: string,
    newPassphrase: string,
    confirmPassphrase: string,
  ): Promise<boolean> => {
    try {
      const res  = await fetch(`${BASE_URL}/api/admin/auth/change-passphrase`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(adminToken),
        },
        body: JSON.stringify({ currentPassphrase, newPassphrase, confirmPassphrase }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data?.error ?? "Failed to change passphrase.");
        return false;
      }

      // Force re-login after passphrase change
      logout();
      toast.success("Passphrase updated. Please log in again.");
      return true;
    } catch {
      toast.error("Unable to change passphrase.");
      return false;
    }
  }, [adminToken, logout]);

  return { isAdmin, needsSetup, adminToken, isLoading, login, setup, changePassphrase, logout };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function adminAuthHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

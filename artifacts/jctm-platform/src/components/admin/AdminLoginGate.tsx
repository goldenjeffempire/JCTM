/**
 * AdminLoginGate — Role-aware admin login component
 *
 * Shows a styled login panel when the user is not authenticated for the given
 * admin role. Renders children once authenticated.
 *
 * Usage:
 *   <AdminLoginGate role="livestream" title="Livestream Controls">
 *     <LivestreamControlPanel />
 *   </AdminLoginGate>
 */

import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Eye, EyeOff, ShieldCheck, Loader2 } from "lucide-react";
import type { AdminRole, AdminAuthState } from "@/hooks/useAdminAuth";

const ROLE_LABELS: Record<AdminRole, { title: string; description: string; color: string }> = {
  gallery: {
    title: "Gallery Admin",
    description: "Manage and upload ministry photos",
    color: "text-violet-500",
  },
  sermon: {
    title: "Sermon Admin",
    description: "Manage YouTube sync and sermon library",
    color: "text-blue-500",
  },
  livestream: {
    title: "Livestream Admin",
    description: "Control live broadcast and rebroadcast",
    color: "text-red-500",
  },
};

interface AdminLoginGateProps {
  role: AdminRole;
  auth: AdminAuthState;
  children: ReactNode;
  title?: string;
  compact?: boolean;
}

export function AdminLoginGate({ role, auth, children, title, compact = false }: AdminLoginGateProps) {
  const [passphrase, setPassphrase] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [logging, setLogging] = useState(false);

  const meta = ROLE_LABELS[role];

  const handleLogin = async () => {
    if (!passphrase.trim() || logging) return;
    setLogging(true);
    await auth.login(passphrase.trim());
    setLogging(false);
    setPassphrase("");
  };

  if (auth.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (auth.isAdmin) {
    return <>{children}</>;
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-xl border border-border/60 bg-muted/30">
        <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          type={showPass ? "text" : "password"}
          value={passphrase}
          onChange={e => setPassphrase(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleLogin()}
          placeholder={`${meta.title} passphrase`}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          autoFocus
        />
        <button
          onClick={() => setShowPass(v => !v)}
          className="text-muted-foreground hover:text-foreground"
          tabIndex={-1}
        >
          {showPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={handleLogin}
          disabled={logging || !passphrase.trim()}
          className="text-xs font-semibold text-accent hover:underline disabled:opacity-50"
        >
          {logging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Unlock"}
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card p-6 space-y-5"
    >
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-primary/8 border border-border flex items-center justify-center shrink-0">
          <Lock className={`w-5 h-5 ${meta.color}`} />
        </div>
        <div>
          <h3 className="font-semibold text-base">{title ?? meta.title}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{meta.description}</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <input
            type={showPass ? "text" : "password"}
            value={passphrase}
            onChange={e => setPassphrase(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            placeholder="Enter admin passphrase…"
            autoFocus
            className="w-full px-4 py-2.5 pr-10 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <button
            onClick={() => setShowPass(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        <button
          onClick={handleLogin}
          disabled={logging || !passphrase.trim()}
          className="w-full py-2.5 rounded-xl bg-accent text-white font-semibold text-sm hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {logging ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Verifying…</>
          ) : (
            <><ShieldCheck className="h-4 w-4" /> Unlock {meta.title}</>
          )}
        </button>
      </div>

      <p className="text-xs text-muted-foreground/60 text-center">
        Access restricted to authorized administrators only
      </p>
    </motion.div>
  );
}

interface AdminBadgeProps {
  role: AdminRole;
  auth: AdminAuthState;
}

export function AdminBadge({ role, auth }: AdminBadgeProps) {
  const meta = ROLE_LABELS[role];
  if (!auth.isAdmin) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-600 text-xs font-semibold"
      >
        <ShieldCheck className="h-3 w-3" />
        {meta.title}
        <button
          onClick={auth.logout}
          className="ml-1 text-green-600/60 hover:text-green-600 transition-colors"
          title="Exit admin"
        >
          ×
        </button>
      </motion.div>
    </AnimatePresence>
  );
}

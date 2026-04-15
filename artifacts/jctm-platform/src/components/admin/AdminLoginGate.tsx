/**
 * AdminLoginGate — Role-aware admin login component
 *
 * Three modes, all handled automatically:
 *   needsSetup  — role has never been configured; shows first-time setup form
 *   !isAdmin    — role is configured; shows passphrase login
 *   isAdmin     — authenticated; renders children + badge with change-passphrase option
 */

import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Eye, EyeOff, ShieldCheck, Loader2, KeyRound, RefreshCw } from "lucide-react";
import type { AdminRole, AdminAuthState } from "@/hooks/useAdminAuth";

const ROLE_LABELS: Record<AdminRole, { title: string; description: string; color: string }> = {
  gallery: {
    title:       "Gallery Admin",
    description: "Manage and upload ministry photos",
    color:       "text-violet-500",
  },
  sermon: {
    title:       "Sermon Admin",
    description: "Manage YouTube sync and sermon library",
    color:       "text-blue-500",
  },
  livestream: {
    title:       "Livestream Admin",
    description: "Control live broadcast and rebroadcast",
    color:       "text-red-500",
  },
};

interface AdminLoginGateProps {
  role: AdminRole;
  auth: AdminAuthState;
  children: ReactNode;
  title?: string;
  compact?: boolean;
}

// ─── Setup form (first-time) ──────────────────────────────────────────────────

function SetupForm({ role, auth }: { role: AdminRole; auth: AdminAuthState }) {
  const meta = ROLE_LABELS[role];
  const [passphrase, setPassphrase]         = useState("");
  const [confirmPassphrase, setConfirm]     = useState("");
  const [showPass, setShowPass]             = useState(false);
  const [submitting, setSubmitting]         = useState(false);
  const [mismatch, setMismatch]             = useState(false);

  const handleSetup = async () => {
    if (submitting || !passphrase.trim()) return;
    if (passphrase !== confirmPassphrase) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    setSubmitting(true);
    await auth.setup(passphrase.trim(), confirmPassphrase.trim());
    setSubmitting(false);
    setPassphrase("");
    setConfirm("");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 space-y-5"
    >
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
          <KeyRound className="w-5 h-5 text-amber-500" />
        </div>
        <div>
          <h3 className="font-semibold text-base">Set up {meta.title}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            No passphrase exists yet. Create one to activate admin access.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <input
            type={showPass ? "text" : "password"}
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Choose a passphrase (min 8 chars)…"
            autoFocus
            className="w-full px-4 py-2.5 pr-10 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          />
          <button
            onClick={() => setShowPass((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        <input
          type={showPass ? "text" : "password"}
          value={confirmPassphrase}
          onChange={(e) => { setConfirm(e.target.value); setMismatch(false); }}
          onKeyDown={(e) => e.key === "Enter" && handleSetup()}
          placeholder="Confirm passphrase…"
          className={`w-full px-4 py-2.5 rounded-xl border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/30 ${
            mismatch ? "border-red-500" : "border-border"
          }`}
        />
        {mismatch && (
          <p className="text-xs text-red-500 -mt-1">Passphrases do not match.</p>
        )}

        <button
          onClick={handleSetup}
          disabled={submitting || !passphrase.trim() || !confirmPassphrase.trim()}
          className="w-full py-2.5 rounded-xl bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {submitting ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</>
          ) : (
            <><KeyRound className="h-4 w-4" /> Create Passphrase & Log In</>
          )}
        </button>
      </div>

      <p className="text-xs text-muted-foreground/60 text-center">
        This passphrase is stored securely in the database and persists across all deployments.
      </p>
    </motion.div>
  );
}

// ─── Change passphrase form ────────────────────────────────────────────────────

function ChangePassphraseForm({
  role,
  auth,
  onClose,
}: {
  role: AdminRole;
  auth: AdminAuthState;
  onClose: () => void;
}) {
  const [current, setCurrent]       = useState("");
  const [next, setNext]             = useState("");
  const [confirm, setConfirm]       = useState("");
  const [showPass, setShowPass]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mismatch, setMismatch]     = useState(false);

  const handleChange = async () => {
    if (submitting || !current.trim() || !next.trim()) return;
    if (next !== confirm) { setMismatch(true); return; }
    setMismatch(false);
    setSubmitting(true);
    const ok = await auth.changePassphrase(current.trim(), next.trim(), confirm.trim());
    setSubmitting(false);
    if (ok) onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="pt-4 border-t border-border space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Change Passphrase
        </p>

        {[
          { value: current, set: setCurrent, placeholder: "Current passphrase" },
          { value: next,    set: setNext,    placeholder: "New passphrase (min 8 chars)" },
          { value: confirm, set: (v: string) => { setConfirm(v); setMismatch(false); }, placeholder: "Confirm new passphrase" },
        ].map(({ value, set, placeholder }, idx) => (
          <div key={idx} className="relative">
            <input
              type={showPass ? "text" : "password"}
              value={value}
              onChange={(e) => set(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleChange()}
              placeholder={placeholder}
              className={`w-full px-4 py-2 rounded-xl border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 ${
                mismatch && idx === 2 ? "border-red-500" : "border-border"
              }`}
            />
            {idx === 0 && (
              <button
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
        ))}

        {mismatch && <p className="text-xs text-red-500">New passphrases do not match.</p>}

        <div className="flex gap-2">
          <button
            onClick={handleChange}
            disabled={submitting || !current.trim() || !next.trim() || !confirm.trim()}
            className="flex-1 py-2 rounded-xl bg-accent text-white font-semibold text-sm hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Update
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Login form ───────────────────────────────────────────────────────────────

function LoginForm({
  role,
  auth,
  title,
  compact,
}: {
  role: AdminRole;
  auth: AdminAuthState;
  title?: string;
  compact: boolean;
}) {
  const meta = ROLE_LABELS[role];
  const [passphrase, setPassphrase] = useState("");
  const [showPass, setShowPass]     = useState(false);
  const [logging, setLogging]       = useState(false);

  const handleLogin = async () => {
    if (!passphrase.trim() || logging) return;
    setLogging(true);
    await auth.login(passphrase.trim());
    setLogging(false);
    setPassphrase("");
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-xl border border-border/60 bg-muted/30">
        <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          type={showPass ? "text" : "password"}
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          placeholder={`${meta.title} passphrase`}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          autoFocus
        />
        <button
          onClick={() => setShowPass((v) => !v)}
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
            onChange={(e) => setPassphrase(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder="Enter admin passphrase…"
            autoFocus
            className="w-full px-4 py-2.5 pr-10 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <button
            onClick={() => setShowPass((v) => !v)}
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
            <><ShieldCheck className="h-4 w-4" /> Unlock {title ?? meta.title}</>
          )}
        </button>
      </div>

      <p className="text-xs text-muted-foreground/60 text-center">
        Access restricted to authorised administrators only
      </p>
    </motion.div>
  );
}

// ─── Main gate ────────────────────────────────────────────────────────────────

export function AdminLoginGate({
  role,
  auth,
  children,
  title,
  compact = false,
}: AdminLoginGateProps) {
  const [showChangePass, setShowChangePass] = useState(false);

  if (auth.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (auth.needsSetup) {
    return <SetupForm role={role} auth={auth} />;
  }

  if (!auth.isAdmin) {
    return <LoginForm role={role} auth={auth} title={title} compact={compact} />;
  }

  return (
    <div className="space-y-3">
      {children}
      <AnimatePresence>
        {showChangePass && (
          <ChangePassphraseForm
            role={role}
            auth={auth}
            onClose={() => setShowChangePass(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────

interface AdminBadgeProps {
  role: AdminRole;
  auth: AdminAuthState;
  onChangePassphrase?: () => void;
}

export function AdminBadge({ role, auth, onChangePassphrase }: AdminBadgeProps) {
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
        {onChangePassphrase && (
          <button
            onClick={onChangePassphrase}
            className="ml-0.5 text-green-600/60 hover:text-green-600 transition-colors"
            title="Change passphrase"
          >
            <KeyRound className="h-3 w-3" />
          </button>
        )}
        <button
          onClick={auth.logout}
          className="ml-0.5 text-green-600/60 hover:text-green-600 transition-colors"
          title="Exit admin"
        >
          ×
        </button>
      </motion.div>
    </AnimatePresence>
  );
}

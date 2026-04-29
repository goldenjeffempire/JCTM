import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  Megaphone, Send, Loader2, X, Bell, AlertCircle,
  Sparkles, Clock, CalendarClock, ListChecks, Trash2,
  CheckCircle2, XCircle, Hourglass, FlaskConical, Copy,
  Bookmark, BookmarkPlus,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface BroadcastResult {
  success: true;
  sent: number;
  failed: number;
  deactivated: number;
  total: number;
}

interface BroadcastError extends Error {
  status?: number;
  payload?: { reason?: string; cooldownRemainingMs?: number };
}

interface BroadcastSnippet {
  id: number;
  name: string;
  title: string;
  body: string;
  url: string;
  require_interaction: boolean;
  created_at: string;
  updated_at: string;
}

interface ScheduledBroadcast {
  id: number;
  title: string;
  body: string;
  url: string;
  require_interaction: boolean;
  scheduled_for: string;
  status: "pending" | "processing" | "sent" | "failed" | "cancelled";
  sent_at: string | null;
  sent_count: number | null;
  failed_count: number | null;
  deactivated_count: number | null;
  error: string | null;
  created_at: string;
}

const QUICK_TEMPLATES: { label: string; title: string; body: string; url: string }[] = [
  {
    label: "Service starting now",
    title: "🔴 Service starting now",
    body: "Join us live for today's worship and word.",
    url: "/sermons",
  },
  {
    label: "New sermon available",
    title: "📖 New sermon now available",
    body: "Watch the latest message on Temple TV.",
    url: "/sermons",
  },
  {
    label: "Prayer call",
    title: "🙏 Join us in prayer",
    body: "Stand with us in prayer right now.",
    url: "/prayer",
  },
];

type SendMode = "now" | "schedule";

// Convert a Date to the value format an <input type="datetime-local"> expects
// in the user's local timezone (YYYY-MM-DDTHH:MM).
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    "-" + pad(d.getMonth() + 1) +
    "-" + pad(d.getDate()) +
    "T" + pad(d.getHours()) +
    ":" + pad(d.getMinutes())
  );
}

function formatScheduledFor(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function relativeTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60_000);
  const hours = Math.round(abs / 3_600_000);
  const days = Math.round(abs / 86_400_000);
  const sign = diff >= 0 ? "in " : "";
  const tail = diff >= 0 ? "" : " ago";
  if (abs < 60_000) return diff >= 0 ? "in <1m" : "just now";
  if (mins < 60) return `${sign}${mins}m${tail}`;
  if (hours < 48) return `${sign}${hours}h${tail}`;
  return `${sign}${days}d${tail}`;
}

export function GenericBroadcastTile({ adminToken }: { adminToken: string }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/");
  const [requireInteraction, setRequireInteraction] = useState(false);
  const [mode, setMode] = useState<SendMode>("now");
  // Default schedule input = now + 15 min
  const [scheduledForLocal, setScheduledForLocal] = useState(() =>
    toLocalInputValue(new Date(Date.now() + 15 * 60_000)),
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  // Tick every second only while cooldown is active
  useEffect(() => {
    if (!cooldownUntil) return;
    const id = setInterval(() => {
      if (Date.now() >= cooldownUntil) {
        setCooldownUntil(null);
      } else {
        setTick((n) => n + 1);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [cooldownUntil]);
  void tick;

  const cooldownRemaining = cooldownUntil ? Math.max(0, cooldownUntil - Date.now()) : 0;
  const cooldownActive = cooldownRemaining > 0;

  const titleLen = title.length;
  const bodyLen = body.length;
  const titleOver = titleLen > 80;
  const bodyOver = bodyLen > 240;

  const scheduleDate = useMemo(() => {
    const d = new Date(scheduledForLocal);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [scheduledForLocal]);
  const scheduleValid = !!scheduleDate && scheduleDate.getTime() >= Date.now() + 60_000;

  const baseValid =
    title.trim().length > 0 &&
    !titleOver &&
    body.trim().length > 0 &&
    !bodyOver &&
    (url.startsWith("/") || url.startsWith("http"));

  const canSubmit =
    baseValid && (mode === "now" ? !cooldownActive : scheduleValid);

  // ── Snippet save UI state ─────────────────────────────────────────────────
  const [savingSnippetOpen, setSavingSnippetOpen] = useState(false);
  const [snippetName, setSnippetName] = useState("");

  // ── Saved snippets ────────────────────────────────────────────────────────
  const { data: snippetData } = useQuery<{ snippets: BroadcastSnippet[] }>({
    queryKey: ["admin-broadcast-snippets"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/admin/broadcast-snippets`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!res.ok) throw new Error("Failed to load snippets");
      return res.json();
    },
    enabled: !!adminToken,
    staleTime: 60_000,
  });
  const snippets = snippetData?.snippets ?? [];

  const saveSnippetMutation = useMutation({
    mutationFn: async (): Promise<{ snippet: BroadcastSnippet }> => {
      const res = await fetch(`${BASE}/api/admin/broadcast-snippets`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          name: snippetName.trim(),
          title: title.trim(),
          body: body.trim(),
          url: url.trim() || "/",
          requireInteraction,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Snippet "${data.snippet.name}" saved`);
      setSavingSnippetOpen(false);
      setSnippetName("");
      qc.invalidateQueries({ queryKey: ["admin-broadcast-snippets"] });
    },
    onError: (err: Error) => toast.error("Save failed", { description: err.message }),
  });

  const deleteSnippetMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE}/api/admin/broadcast-snippets/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      return data;
    },
    onSuccess: () => {
      toast.success("Snippet deleted");
      qc.invalidateQueries({ queryKey: ["admin-broadcast-snippets"] });
    },
    onError: (err: Error) => toast.error("Delete failed", { description: err.message }),
  });

  const applySnippet = (s: BroadcastSnippet) => {
    setTitle(s.title);
    setBody(s.body);
    setUrl(s.url);
    setRequireInteraction(s.require_interaction);
  };

  // ── Scheduled broadcasts list ──────────────────────────────────────────────
  const { data: scheduledList } = useQuery<{ broadcasts: ScheduledBroadcast[] }>({
    queryKey: ["admin-scheduled-broadcasts"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/admin/scheduled-broadcasts`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!res.ok) throw new Error("Failed to load scheduled broadcasts");
      return res.json();
    },
    enabled: !!adminToken,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
  const scheduledBroadcasts = scheduledList?.broadcasts ?? [];

  const broadcastMutation = useMutation({
    mutationFn: async (): Promise<BroadcastResult> => {
      const res = await fetch(`${BASE}/api/admin/broadcast/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), url: url.trim() || "/", requireInteraction }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err: BroadcastError = new Error(data?.reason ?? data?.error ?? `HTTP ${res.status}`);
        err.status = res.status;
        err.payload = data;
        throw err;
      }
      return data as BroadcastResult;
    },
    onSuccess: (result) => {
      toast.success(`Broadcast delivered to ${result.sent.toLocaleString()} subscribers`, {
        description: `${result.failed} failed · ${result.deactivated} deactivated · ${result.total} total reached`,
      });
      setConfirmOpen(false);
      setCooldownUntil(Date.now() + 60_000);
      qc.invalidateQueries({ queryKey: ["admin-warri-crusade-stats"] });
    },
    onError: (err: BroadcastError) => {
      if (err.status === 429) {
        toast.warning("Cooldown active", { description: err.payload?.reason ?? err.message });
        if (err.payload?.cooldownRemainingMs) {
          setCooldownUntil(Date.now() + err.payload.cooldownRemainingMs);
        }
      } else {
        toast.error("Broadcast failed", { description: err.message });
      }
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: async (): Promise<{ broadcast: ScheduledBroadcast }> => {
      const res = await fetch(`${BASE}/api/admin/scheduled-broadcasts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          url: url.trim() || "/",
          requireInteraction,
          scheduledFor: scheduleDate?.toISOString(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      return data;
    },
    onSuccess: (data) => {
      toast.success("Broadcast scheduled", {
        description: `Will fire ${formatScheduledFor(data.broadcast.scheduled_for)}`,
      });
      setConfirmOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-scheduled-broadcasts"] });
    },
    onError: (err: Error) => toast.error("Schedule failed", { description: err.message }),
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE}/api/admin/scheduled-broadcasts/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      return data;
    },
    onSuccess: () => {
      toast.success("Scheduled broadcast cancelled");
      qc.invalidateQueries({ queryKey: ["admin-scheduled-broadcasts"] });
    },
    onError: (err: Error) => toast.error("Cancel failed", { description: err.message }),
  });

  const submitting = broadcastMutation.isPending || scheduleMutation.isPending;

  // ── Test broadcast: send composed payload ONLY to admin's own browser ──────
  const testMutation = useMutation({
    mutationFn: async (): Promise<{ success: true }> => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error("This browser doesn't support push notifications");
      }
      if (Notification.permission !== "granted") {
        throw new Error("Enable notifications in your browser first");
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        throw new Error("No active subscription on this browser — re-enable notifications");
      }
      const res = await fetch(`${BASE}/api/admin/broadcast/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          url: url.trim() || "/",
          requireInteraction,
          endpoint: sub.endpoint,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.reason ?? data?.error ?? `HTTP ${res.status}`);
      return data;
    },
    onSuccess: () => {
      toast.success("Test sent to your browser", {
        description: "Check your notification tray to preview how it looks.",
      });
    },
    onError: (err: Error) => toast.error("Test failed", { description: err.message }),
  });
  const testing = testMutation.isPending;

  const applyTemplate = (t: typeof QUICK_TEMPLATES[number]) => {
    setTitle(t.title);
    setBody(t.body);
    setUrl(t.url);
  };

  const handleSubmit = () => {
    if (mode === "now") broadcastMutation.mutate();
    else scheduleMutation.mutate();
  };

  // Load a previous broadcast back into the composer for editing/re-firing.
  // Always switches to "now" mode (most common reuse pattern). Scrolls the
  // form into view since the scheduled list may be below the fold.
  const handleDuplicate = (b: ScheduledBroadcast) => {
    setTitle(b.title);
    setBody(b.body);
    setUrl(b.url);
    setRequireInteraction(b.require_interaction);
    setMode("now");
    toast.success("Loaded into composer", {
      description: "Edit if needed, then send or schedule.",
    });
    if (typeof document !== "undefined") {
      document.querySelector<HTMLInputElement>('[data-testid="broadcast-title-input"]')
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <div className="rounded-xl bg-card border border-border p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
            <Megaphone className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-base">Send instant broadcast</h3>
            <p className="text-xs text-muted-foreground">Push notification + in-app toast — fire now or schedule</p>
          </div>
        </div>
        {cooldownActive && mode === "now" && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-300 text-[11px] font-medium border border-amber-500/30 tabular-nums">
            <Clock className="h-3 w-3" />
            cooldown {Math.ceil(cooldownRemaining / 1000)}s
          </span>
        )}
      </div>

      {/* Mode toggle */}
      <div className="inline-flex rounded-lg bg-muted p-1 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setMode("now")}
          className={`px-3 py-1.5 rounded-md transition-colors inline-flex items-center gap-1.5 ${
            mode === "now" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
          data-testid="broadcast-mode-now"
        >
          <Send className="h-3.5 w-3.5" /> Send now
        </button>
        <button
          type="button"
          onClick={() => setMode("schedule")}
          className={`px-3 py-1.5 rounded-md transition-colors inline-flex items-center gap-1.5 ${
            mode === "schedule" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
          data-testid="broadcast-mode-schedule"
        >
          <CalendarClock className="h-3.5 w-3.5" /> Schedule for later
        </button>
      </div>

      {/* Quick templates + saved snippets */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[11px] uppercase font-semibold tracking-wide text-muted-foreground mr-1 flex items-center gap-1">
            <Sparkles className="h-3 w-3" />Templates:
          </span>
          {QUICK_TEMPLATES.map((t) => (
            <button
              key={t.label}
              onClick={() => applyTemplate(t)}
              className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-muted hover:bg-muted/70 text-foreground/80 hover:text-foreground transition-colors border border-border/50"
              data-testid={`broadcast-template-${t.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Saved snippets row + save action */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[11px] uppercase font-semibold tracking-wide text-muted-foreground mr-1 flex items-center gap-1">
            <Bookmark className="h-3 w-3" />Saved:
          </span>
          {snippets.length === 0 && !savingSnippetOpen && (
            <span className="text-[11px] text-muted-foreground italic">No saved snippets yet</span>
          )}
          {snippets.map((s) => (
            <span
              key={s.id}
              className="group inline-flex items-center rounded-md border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/15 text-purple-700 dark:text-purple-300 transition-colors overflow-hidden"
            >
              <button
                onClick={() => applySnippet(s)}
                title={`Load: ${s.title}`}
                className="px-2.5 py-1 text-[11px] font-medium"
                data-testid={`broadcast-snippet-${s.id}`}
              >
                {s.name}
              </button>
              <button
                onClick={() => deleteSnippetMutation.mutate(s.id)}
                disabled={deleteSnippetMutation.isPending && deleteSnippetMutation.variables === s.id}
                aria-label={`Delete snippet ${s.name}`}
                title="Delete snippet"
                className="px-1.5 py-1 text-purple-600 hover:bg-red-500/15 hover:text-red-500 transition-colors border-l border-purple-500/30 disabled:opacity-50"
                data-testid={`broadcast-snippet-delete-${s.id}`}
              >
                {deleteSnippetMutation.isPending && deleteSnippetMutation.variables === s.id ? (
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                ) : (
                  <X className="h-2.5 w-2.5" />
                )}
              </button>
            </span>
          ))}
          {savingSnippetOpen ? (
            <div className="inline-flex items-center gap-1 rounded-md border border-purple-500/40 bg-purple-500/10 overflow-hidden">
              <input
                type="text"
                autoFocus
                value={snippetName}
                maxLength={60}
                onChange={(e) => setSnippetName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && snippetName.trim()) saveSnippetMutation.mutate();
                  if (e.key === "Escape") { setSavingSnippetOpen(false); setSnippetName(""); }
                }}
                placeholder="Snippet name…"
                className="px-2 py-1 bg-transparent text-[11px] focus:outline-none text-foreground placeholder:text-muted-foreground w-32"
                data-testid="broadcast-snippet-name-input"
              />
              <button
                onClick={() => saveSnippetMutation.mutate()}
                disabled={!snippetName.trim() || saveSnippetMutation.isPending}
                className="px-2 py-1 text-[11px] font-semibold bg-purple-500 hover:bg-purple-400 text-white disabled:opacity-50 transition-colors"
                data-testid="broadcast-snippet-save-confirm"
              >
                {saveSnippetMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
              </button>
              <button
                onClick={() => { setSavingSnippetOpen(false); setSnippetName(""); }}
                className="px-1.5 py-1 text-muted-foreground hover:text-foreground"
                aria-label="Cancel"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setSavingSnippetOpen(true)}
              disabled={!baseValid}
              title={baseValid ? "Save current composition as a snippet" : "Fill in title and body first"}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium border border-dashed border-border hover:border-purple-500/50 hover:bg-purple-500/10 text-muted-foreground hover:text-purple-600 dark:hover:text-purple-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
              data-testid="broadcast-snippet-save-button"
            >
              <BookmarkPlus className="h-3 w-3" />
              Save current
            </button>
          )}
        </div>
      </div>

      {/* Form */}
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-foreground/80">Title</label>
            <span className={`text-[10px] tabular-nums ${titleOver ? "text-red-500 font-semibold" : "text-muted-foreground"}`}>
              {titleLen}/80
            </span>
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="🔔 e.g. Service starting now"
            className={`w-full px-3 py-2 rounded-lg bg-background border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 ${
              titleOver ? "border-red-500" : "border-border"
            }`}
            data-testid="broadcast-title-input"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-foreground/80">Body</label>
            <span className={`text-[10px] tabular-nums ${bodyOver ? "text-red-500 font-semibold" : "text-muted-foreground"}`}>
              {bodyLen}/240
            </span>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={300}
            rows={2}
            placeholder="Short message that appears under the title…"
            className={`w-full px-3 py-2 rounded-lg bg-background border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 ${
              bodyOver ? "border-red-500" : "border-border"
            }`}
            data-testid="broadcast-body-input"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-foreground/80 mb-1 block">Tap-to-open URL</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="/sermons"
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              data-testid="broadcast-url-input"
            />
          </div>
          <label className="flex items-center gap-2 self-end pb-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={requireInteraction}
              onChange={(e) => setRequireInteraction(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
              data-testid="broadcast-require-interaction"
            />
            <span className="text-xs text-foreground/80">Require interaction (sticky notification)</span>
          </label>
        </div>

        {/* Schedule input — only when in schedule mode */}
        {mode === "schedule" && (
          <div>
            <label className="text-xs font-medium text-foreground/80 mb-1 block">Send at</label>
            <input
              type="datetime-local"
              value={scheduledForLocal}
              onChange={(e) => setScheduledForLocal(e.target.value)}
              min={toLocalInputValue(new Date(Date.now() + 60_000))}
              className={`w-full px-3 py-2 rounded-lg bg-background border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                !scheduleValid ? "border-amber-500" : "border-border"
              }`}
              data-testid="broadcast-schedule-input"
            />
            <p className={`mt-1 text-[10px] ${scheduleValid ? "text-muted-foreground" : "text-amber-600 dark:text-amber-400"}`}>
              {scheduleDate
                ? scheduleValid
                  ? `Will fire ${relativeTime(scheduleDate.toISOString())} (in your local timezone)`
                  : "Must be at least 1 minute in the future"
                : "Pick a valid date/time"}
            </p>
          </div>
        )}
      </div>

      {/* Live preview */}
      {(title || body) && (
        <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
          <div className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1">
            <Bell className="h-3 w-3" /> Notification preview
          </div>
          <div className="font-semibold text-sm text-foreground line-clamp-1">{title || "Title…"}</div>
          <div className="text-xs text-foreground/70 line-clamp-2">{body || "Body…"}</div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => setConfirmOpen(true)}
          disabled={!canSubmit}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-400 hover:to-blue-500 text-white text-sm font-bold transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="broadcast-send-button"
        >
          {mode === "now" ? <Send className="h-4 w-4" /> : <CalendarClock className="h-4 w-4" />}
          {mode === "now"
            ? cooldownActive
              ? `Cooldown ${Math.ceil(cooldownRemaining / 1000)}s`
              : "Send broadcast"
            : "Schedule broadcast"}
        </button>
        <button
          onClick={() => testMutation.mutate()}
          disabled={!baseValid || testing}
          title="Send only to this browser as a preview"
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-muted hover:bg-muted/70 text-foreground/80 hover:text-foreground text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-border"
          data-testid="broadcast-test-button"
        >
          {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
          Test on me
        </button>
        <button
          onClick={() => { setTitle(""); setBody(""); setUrl("/"); setRequireInteraction(false); }}
          className="px-3 py-2.5 rounded-lg bg-muted hover:bg-muted/70 text-foreground/70 hover:text-foreground text-sm font-medium transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Scheduled list */}
      {scheduledBroadcasts.length > 0 && (
        <div className="border-t border-border pt-4 mt-2 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground/80">
            <ListChecks className="h-3.5 w-3.5 text-purple-500" />
            Scheduled & recent broadcasts
          </div>
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {scheduledBroadcasts.map((b) => (
              <ScheduledBroadcastRow
                key={b.id}
                broadcast={b}
                onCancel={() => cancelMutation.mutate(b.id)}
                onDuplicate={() => handleDuplicate(b)}
                cancelling={cancelMutation.isPending && cancelMutation.variables === b.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Confirm modal */}
      <AnimatePresence>
        {confirmOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => !submitting && setConfirmOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-purple-500/15 to-blue-600/15 p-5 border-b border-border">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
                      {mode === "now" ? <AlertCircle className="h-5 w-5 text-white" /> : <CalendarClock className="h-5 w-5 text-white" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground text-base">
                        {mode === "now" ? "Confirm broadcast" : "Confirm schedule"}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {mode === "now"
                          ? "This sends to every active subscriber"
                          : `Will fire ${scheduleDate ? formatScheduledFor(scheduleDate.toISOString()) : ""}`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => !submitting && setConfirmOpen(false)}
                    disabled={submitting}
                    className="text-muted-foreground hover:text-foreground p-1 rounded disabled:opacity-30"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div className="rounded-lg bg-muted/40 border border-border/60 p-3 space-y-1.5">
                  <div className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">Notification preview</div>
                  <div className="font-semibold text-sm text-foreground">{title}</div>
                  <div className="text-xs text-foreground/80">{body}</div>
                  <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                    Opens: <code className="px-1 py-0.5 rounded bg-muted">{url || "/"}</code>
                    {requireInteraction && <span className="ml-2 text-amber-600 dark:text-amber-300 font-medium">· sticky</span>}
                  </div>
                </div>
                {mode === "now" && (
                  <div className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                    <Clock className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>A 60-second cooldown for the same title + body prevents accidental duplicate sends.</span>
                  </div>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => setConfirmOpen(false)}
                    disabled={submitting}
                    className="flex-1 px-4 py-2 rounded-lg bg-muted hover:bg-muted/70 text-foreground text-sm font-medium transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-400 hover:to-blue-500 text-white text-sm font-bold transition shadow-md disabled:opacity-60"
                    data-testid="broadcast-confirm-send"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {mode === "now" ? "Sending…" : "Scheduling…"}
                      </>
                    ) : mode === "now" ? (
                      <><Send className="h-4 w-4" />Send now</>
                    ) : (
                      <><CalendarClock className="h-4 w-4" />Schedule</>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ScheduledBroadcastRow({
  broadcast: b,
  onCancel,
  onDuplicate,
  cancelling,
}: {
  broadcast: ScheduledBroadcast;
  onCancel: () => void;
  onDuplicate: () => void;
  cancelling: boolean;
}) {
  const statusMeta = (() => {
    switch (b.status) {
      case "pending":
        return { label: "Pending", icon: <Hourglass className="h-3 w-3" />, cls: "bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30" };
      case "processing":
        return { label: "Sending…", icon: <Loader2 className="h-3 w-3 animate-spin" />, cls: "bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30" };
      case "sent":
        return { label: "Sent", icon: <CheckCircle2 className="h-3 w-3" />, cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30" };
      case "failed":
        return { label: "Failed", icon: <XCircle className="h-3 w-3" />, cls: "bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/30" };
      case "cancelled":
        return { label: "Cancelled", icon: <X className="h-3 w-3" />, cls: "bg-muted text-muted-foreground border-border" };
    }
  })();

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/40 text-xs">
      <span className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border ${statusMeta.cls}`}>
        {statusMeta.icon}
        {statusMeta.label}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-foreground truncate">{b.title}</div>
        <div className="text-[10px] text-muted-foreground truncate">
          {b.status === "sent" && b.sent_at ? (
            <>Sent {relativeTime(b.sent_at)} · {(b.sent_count ?? 0).toLocaleString()} delivered</>
          ) : b.status === "failed" ? (
            <>Failed: {b.error?.slice(0, 80) ?? "unknown error"}</>
          ) : (
            <>{formatScheduledFor(b.scheduled_for)} · {relativeTime(b.scheduled_for)}</>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onDuplicate}
        aria-label="Duplicate into composer"
        title="Load into composer to re-send or edit"
        className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-purple-500 hover:bg-purple-500/10 transition-colors"
        data-testid={`broadcast-duplicate-${b.id}`}
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
      {b.status === "pending" && (
        <button
          type="button"
          onClick={onCancel}
          disabled={cancelling}
          aria-label="Cancel scheduled broadcast"
          className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
          data-testid={`broadcast-cancel-${b.id}`}
        >
          {cancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      )}
    </div>
  );
}

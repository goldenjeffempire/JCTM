import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  Megaphone, Send, Loader2, X, Bell, AlertCircle,
  Sparkles, Clock,
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

export function GenericBroadcastTile({ adminToken }: { adminToken: string }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/");
  const [requireInteraction, setRequireInteraction] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  // Tick every second only while cooldown is active, so the countdown updates
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

  const canSubmit =
    title.trim().length > 0 &&
    !titleOver &&
    body.trim().length > 0 &&
    !bodyOver &&
    (url.startsWith("/") || url.startsWith("http")) &&
    !cooldownActive;

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

  const applyTemplate = (t: typeof QUICK_TEMPLATES[number]) => {
    setTitle(t.title);
    setBody(t.body);
    setUrl(t.url);
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
            <p className="text-xs text-muted-foreground">Push notification + in-app toast to all active subscribers</p>
          </div>
        </div>
        {cooldownActive && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-300 text-[11px] font-medium border border-amber-500/30 tabular-nums">
            <Clock className="h-3 w-3" />
            cooldown {Math.ceil(cooldownRemaining / 1000)}s
          </span>
        )}
      </div>

      {/* Quick templates */}
      <div className="flex flex-wrap gap-2">
        <span className="text-[11px] uppercase font-semibold tracking-wide text-muted-foreground self-center mr-1 flex items-center gap-1">
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
          <Send className="h-4 w-4" />
          {cooldownActive ? `Cooldown ${Math.ceil(cooldownRemaining / 1000)}s` : "Send broadcast"}
        </button>
        <button
          onClick={() => { setTitle(""); setBody(""); setUrl("/"); setRequireInteraction(false); }}
          className="px-3 py-2.5 rounded-lg bg-muted hover:bg-muted/70 text-foreground/70 hover:text-foreground text-sm font-medium transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Confirm modal */}
      <AnimatePresence>
        {confirmOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => !broadcastMutation.isPending && setConfirmOpen(false)}
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
                      <AlertCircle className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground text-base">Confirm broadcast</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">This sends to every active subscriber</p>
                    </div>
                  </div>
                  <button
                    onClick={() => !broadcastMutation.isPending && setConfirmOpen(false)}
                    disabled={broadcastMutation.isPending}
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
                <div className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                  <Clock className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>A 60-second cooldown for the same title + body prevents accidental duplicate sends.</span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => setConfirmOpen(false)}
                    disabled={broadcastMutation.isPending}
                    className="flex-1 px-4 py-2 rounded-lg bg-muted hover:bg-muted/70 text-foreground text-sm font-medium transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => broadcastMutation.mutate()}
                    disabled={broadcastMutation.isPending}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-400 hover:to-blue-500 text-white text-sm font-bold transition shadow-md disabled:opacity-60"
                    data-testid="broadcast-confirm-send"
                  >
                    {broadcastMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending…
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Send now
                      </>
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

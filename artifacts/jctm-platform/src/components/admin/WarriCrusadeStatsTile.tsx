import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  Flame, Users, Send, MousePointerClick, Clock, CheckCircle,
  AlertCircle, TrendingUp, Activity, Calendar, RefreshCw, Zap, X,
  Loader2,
} from "lucide-react";
import {
  ResponsiveContainer, ComposedChart, XAxis, YAxis, Tooltip,
  CartesianGrid, Bar, Line,
} from "recharts";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface CrusadeStats {
  campaign: { slug: string; endsAt: string; active: boolean; nextScheduledAt: string | null };
  subscribers: { active: number; total: number };
  broadcasts: {
    total: number; totalSent: number; totalFailed: number;
    totalDeactivated: number; totalAttempted: number;
    avgDeliveryRate: number; lastDispatchedAt: string | null;
  };
  clicks: { total: number; ctr: number; lastClickedAt: string | null };
  timeline: { hour: string; sent: number; failed: number; attempted: number; clicks: number; deliveryRate: number }[];
  recentEvents: { id: string; message: string; firedAt: string }[];
  serverTime: string;
}

function relTime(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "just now";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function untilTime(iso: string | null): string {
  if (!iso) return "—";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "now";
  const m = Math.floor(ms / 60000);
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60);
  return `in ${h}h ${m % 60}m`;
}

function fmtHour(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });
}

export function WarriCrusadeStatsTile({ adminToken }: { adminToken: string }) {
  const [now, setNow] = useState(Date.now());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [liveAlertConfirmOpen, setLiveAlertConfirmOpen] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const { data, isLoading, isFetching, refetch, error } = useQuery<CrusadeStats>({
    queryKey: ["admin-warri-crusade-stats"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/admin/warri-crusade/stats`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refetchInterval: 30_000,
    staleTime: 10_000,
    enabled: !!adminToken,
  });

  const liveAlertMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE}/api/admin/warri-crusade/live-alert`, {
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(body?.reason ?? body?.error ?? `HTTP ${res.status}`) as Error & {
          status?: number; payload?: { reason?: string; lastFiredAt?: string };
        };
        err.status = res.status;
        err.payload = body;
        throw err;
      }
      return body as {
        success: true;
        web: { sent: number; failed: number; deactivated: number };
        expo: { sent: number; failed: number };
        total: number;
      };
    },
    onSuccess: (result) => {
      toast.success(
        `🔴 LIVE alert sent to ${result.total.toLocaleString()} devices`,
        {
          description: `Web push: ${result.web.sent} sent · Mobile: ${result.expo.sent} sent`,
          duration: 6000,
        },
      );
      setLiveAlertConfirmOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-warri-crusade-stats"] });
      qc.invalidateQueries({ queryKey: ["expo-stats"] });
    },
    onError: (err: Error & { status?: number; payload?: { reason?: string; lastFiredAt?: string } }) => {
      if (err.status === 429) {
        toast.warning("Cooldown active", {
          description: err.payload?.reason ?? "A live alert was just sent. Wait 2 minutes before retrying.",
        });
      } else {
        toast.error("Live alert failed", { description: err.message });
      }
    },
  });

  const broadcastMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE}/api/admin/warri-crusade/broadcast-now`, {
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(body?.reason ?? body?.error ?? `HTTP ${res.status}`) as Error & {
          status?: number; payload?: { reason?: string; lastFiredAt?: string };
        };
        err.status = res.status;
        err.payload = body;
        throw err;
      }
      return body as { success: true; sent: number; failed: number; deactivated: number; total: number };
    },
    onSuccess: (result) => {
      toast.success(
        `Broadcast sent — ${result.sent.toLocaleString()} delivered`,
        { description: `${result.failed} failed · ${result.deactivated} deactivated · ${result.total} total subscribers reached` }
      );
      setConfirmOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-warri-crusade-stats"] });
    },
    onError: (err: Error & { status?: number; payload?: { reason?: string; lastFiredAt?: string } }) => {
      if (err.status === 429) {
        toast.warning("Cooldown active", {
          description: err.payload?.reason ?? "A manual broadcast was just sent. Please wait a few minutes.",
        });
      } else {
        toast.error("Broadcast failed", { description: err.message });
      }
    },
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-gradient-to-br from-red-950/40 via-zinc-950 to-amber-950/30 p-6 mb-6 animate-pulse">
        <div className="h-6 w-64 bg-white/10 rounded mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl bg-white/5" />)}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-950/20 p-6 mb-6 text-red-200">
        <div className="flex items-center gap-2 mb-1">
          <AlertCircle className="h-5 w-5" />
          <span className="font-semibold">Could not load Warri Crusade campaign stats</span>
        </div>
        <p className="text-xs text-red-200/70">{(error as Error)?.message ?? "Unknown error"}</p>
        <button
          onClick={() => refetch()}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-xs font-medium"
        >
          <RefreshCw className="h-3 w-3" /> Retry
        </button>
      </div>
    );
  }

  const { campaign, subscribers, broadcasts, clicks, timeline, recentEvents } = data;
  void now; // tick for relative-time refresh

  const chartData = timeline.map((t) => ({
    hour: fmtHour(t.hour),
    sent: t.sent,
    failed: t.failed,
    clicks: t.clicks,
    deliveryRate: t.deliveryRate,
  }));

  const endsInMs = new Date(campaign.endsAt).getTime() - Date.now();
  const endsInHours = Math.max(0, Math.floor(endsInMs / 3600000));
  const endsInMinutes = Math.max(0, Math.floor((endsInMs % 3600000) / 60000));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-red-950/60 via-zinc-950 to-amber-950/40 p-5 md:p-6 mb-6 shadow-xl shadow-red-950/30"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-start gap-3 min-w-0">
          <div className="shrink-0 h-11 w-11 rounded-xl bg-gradient-to-br from-amber-400 to-red-600 flex items-center justify-center text-2xl shadow-lg shadow-red-900/40">
            <Flame className="h-6 w-6 text-zinc-950" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base md:text-lg font-bold text-white truncate">
                Warri Crusade 2026 — Campaign Live
              </h3>
              {campaign.active ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wide border border-emerald-500/40">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-500/20 text-zinc-300 text-[10px] font-bold uppercase tracking-wide border border-zinc-500/40">
                  Ended
                </span>
              )}
            </div>
            <p className="text-xs text-amber-200/80 mt-0.5">
              {campaign.active
                ? `Ends in ${endsInHours}h ${endsInMinutes}m · Hourly multi-channel push + in-app broadcast`
                : "Campaign concluded · stats frozen"}
            </p>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {campaign.active && (
            <>
              {/* 🔴 Crusade LIVE Now button */}
              <button
                onClick={() => setLiveAlertConfirmOpen(true)}
                disabled={liveAlertMutation.isPending || broadcastMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition shadow-lg shadow-red-900/50 disabled:opacity-50 border border-red-400/30"
                title="Send a LIVE NOW alert to all web + mobile subscribers"
                data-testid="warri-crusade-live-alert"
              >
                {liveAlertMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                )}
                <span className="hidden sm:inline">🔴 LIVE Alert</span>
                <span className="sm:hidden">LIVE</span>
              </button>

              {/* Hourly rotating broadcast button */}
              <button
                onClick={() => setConfirmOpen(true)}
                disabled={broadcastMutation.isPending || liveAlertMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-red-600 hover:from-amber-400 hover:to-red-500 text-zinc-950 text-xs font-bold transition shadow-lg shadow-red-900/40 disabled:opacity-50"
                title="Send a Warri Crusade broadcast right now"
                data-testid="warri-crusade-broadcast-now"
              >
                {broadcastMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Zap className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">Send broadcast now</span>
                <span className="sm:hidden">Send</span>
              </button>
            </>
          )}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Confirm broadcast modal */}
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
              className="w-full max-w-md rounded-2xl bg-zinc-950 border border-amber-500/30 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-red-950 via-amber-950/50 to-red-950 p-5 border-b border-amber-500/20">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-400 to-red-600 flex items-center justify-center">
                      <Zap className="h-5 w-5 text-zinc-950" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base">Send broadcast now?</h3>
                      <p className="text-xs text-amber-200/80 mt-0.5">Outside the hourly schedule</p>
                    </div>
                  </div>
                  <button
                    onClick={() => !broadcastMutation.isPending && setConfirmOpen(false)}
                    disabled={broadcastMutation.isPending}
                    className="text-white/50 hover:text-white p-1 rounded disabled:opacity-30"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-100/90 space-y-1">
                  <p>This will instantly fan out a push notification to <strong className="text-amber-200 tabular-nums">{subscribers.active.toLocaleString()}</strong> active subscribers and surface the in-app toast on every connected device.</p>
                </div>
                <div className="rounded-lg bg-black/40 border border-white/10 p-3 space-y-1.5">
                  <div className="text-[10px] uppercase font-semibold tracking-wide text-white/50">Notification preview</div>
                  <div className="font-semibold text-white text-sm">🔥 Warri Crusade 2026 Update</div>
                  <div className="text-xs text-white/70">Join the powerful move of God today</div>
                </div>
                <div className="text-[11px] text-white/50 flex items-start gap-1.5">
                  <Clock className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>A 5-minute cooldown prevents accidental double-sends. Half-hourly auto-broadcasts (every 30 minutes) continue independently.</span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => setConfirmOpen(false)}
                    disabled={broadcastMutation.isPending}
                    className="flex-1 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white text-sm font-medium transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => broadcastMutation.mutate()}
                    disabled={broadcastMutation.isPending}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-red-600 hover:from-amber-400 hover:to-red-500 text-zinc-950 text-sm font-bold transition shadow-lg shadow-red-900/40 disabled:opacity-60"
                    data-testid="warri-crusade-broadcast-confirm"
                  >
                    {broadcastMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending…
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Send broadcast
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── LIVE Alert confirm modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {liveAlertConfirmOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => !liveAlertMutation.isPending && setLiveAlertConfirmOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-md rounded-2xl bg-zinc-950 border border-red-500/40 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-red-950 via-red-900/60 to-red-950 p-5 border-b border-red-500/20">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-red-600 flex items-center justify-center shadow-lg shadow-red-900/60">
                      <span className="text-xl">🔴</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base">Send LIVE Alert?</h3>
                      <p className="text-xs text-red-200/80 mt-0.5">Fires immediately to ALL channels</p>
                    </div>
                  </div>
                  <button
                    onClick={() => !liveAlertMutation.isPending && setLiveAlertConfirmOpen(false)}
                    disabled={liveAlertMutation.isPending}
                    className="text-white/50 hover:text-white p-1 rounded disabled:opacity-30"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-100/90 space-y-2">
                  <p>This will instantly fire a <strong className="text-red-200">"Crusade is NOW LIVE!"</strong> alert to:</p>
                  <ul className="space-y-1 ml-2">
                    <li className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-red-400" /> All web push subscribers (browser)</li>
                    <li className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-red-400" /> All mobile app devices (Expo)</li>
                    <li className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-red-400" /> In-app toast on every open tab</li>
                  </ul>
                </div>

                <div className="rounded-lg bg-black/40 border border-white/10 p-3 space-y-1.5">
                  <div className="text-[10px] uppercase font-semibold tracking-wide text-white/50">Notification preview</div>
                  <div className="font-semibold text-white text-sm">🔴 Warri Crusade 2026 is LIVE NOW!</div>
                  <div className="text-xs text-white/70">The Warri City Crusade has just started — join us for miracles, healing, and the move of God!</div>
                </div>

                <div className="text-[11px] text-white/50 flex items-start gap-1.5">
                  <Clock className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>2-minute cooldown prevents accidental double-fires. Use this button the moment the crusade stream goes live.</span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => setLiveAlertConfirmOpen(false)}
                    disabled={liveAlertMutation.isPending}
                    className="flex-1 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white text-sm font-medium transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => liveAlertMutation.mutate()}
                    disabled={liveAlertMutation.isPending}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition shadow-lg shadow-red-900/50 disabled:opacity-60"
                    data-testid="warri-crusade-live-alert-confirm"
                  >
                    {liveAlertMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                    ) : (
                      <>🔴 Send LIVE Alert</>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KPI
          icon={<Users className="h-4 w-4" />}
          label="Active subscribers"
          value={subscribers.active.toLocaleString()}
          sublabel={`${subscribers.total.toLocaleString()} total`}
          tone="blue"
        />
        <KPI
          icon={<Send className="h-4 w-4" />}
          label="Broadcasts sent"
          value={broadcasts.total.toLocaleString()}
          sublabel={broadcasts.lastDispatchedAt ? `last ${relTime(broadcasts.lastDispatchedAt)}` : "none yet"}
          tone="amber"
        />
        <KPI
          icon={<CheckCircle className="h-4 w-4" />}
          label="Delivery rate"
          value={`${broadcasts.avgDeliveryRate.toFixed(1)}%`}
          sublabel={`${broadcasts.totalSent.toLocaleString()} of ${broadcasts.totalAttempted.toLocaleString()} delivered`}
          tone="emerald"
        />
        <KPI
          icon={<MousePointerClick className="h-4 w-4" />}
          label="Click-through"
          value={clicks.total.toLocaleString()}
          sublabel={broadcasts.totalSent > 0 ? `${clicks.ctr.toFixed(1)}% CTR` : "awaiting first send"}
          tone="rose"
        />
      </div>

      {/* Next broadcast banner */}
      {campaign.active && campaign.nextScheduledAt && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs mb-5">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span>
            Next half-hourly broadcast scheduled <strong className="text-amber-100">{untilTime(campaign.nextScheduledAt)}</strong>
            <span className="text-amber-200/60"> · {fmtHour(campaign.nextScheduledAt)} WAT</span>
          </span>
        </div>
      )}

      {/* Timeline chart */}
      <div className="rounded-xl bg-black/30 border border-white/5 p-3 mb-4">
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-white/80">
            <Activity className="h-3.5 w-3.5 text-amber-400" />
            Last 24 hours · delivery vs. clicks
          </div>
          <div className="flex items-center gap-3 text-[10px] text-white/60">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500" />Sent</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-red-500" />Failed</span>
            <span className="flex items-center gap-1"><span className="h-0.5 w-3 bg-amber-400" />Clicks</span>
          </div>
        </div>
        {chartData.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-xs text-white/40">
            No broadcasts yet in the last 24 hours
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="hour" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: "rgba(10,10,15,0.95)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  fontSize: 11,
                  color: "#fff",
                }}
                cursor={{ fill: "rgba(255,255,255,0.05)" }}
              />
              <Bar dataKey="sent" stackId="a" fill="#10b981" radius={[2, 2, 0, 0]} />
              <Bar dataKey="failed" stackId="a" fill="#ef4444" radius={[2, 2, 0, 0]} />
              <Line type="monotone" dataKey="clicks" stroke="#fbbf24" strokeWidth={2} dot={{ r: 3, fill: "#fbbf24" }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Recent broadcasts list */}
      <div className="rounded-xl bg-black/30 border border-white/5 p-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-white/80 mb-2 px-1">
          <Calendar className="h-3.5 w-3.5 text-amber-400" />
          Recent broadcasts
          <span className="ml-auto text-[10px] font-normal text-white/40">
            {recentEvents.length} of last 20
          </span>
        </div>
        {recentEvents.length === 0 ? (
          <div className="py-6 text-center text-xs text-white/40">
            No broadcast events recorded yet — first one fires at the top of the next hour.
          </div>
        ) : (
          <ul className="space-y-1 max-h-48 overflow-y-auto pr-1">
            {recentEvents.map((ev) => (
              <li key={ev.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/5 text-xs">
                <TrendingUp className="h-3 w-3 text-emerald-400 shrink-0" />
                <span className="text-white/80 truncate flex-1">{ev.message}</span>
                <span className="text-white/40 shrink-0 tabular-nums">{relTime(ev.firedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </motion.div>
  );
}

function KPI({
  icon, label, value, sublabel, tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel: string;
  tone: "blue" | "amber" | "emerald" | "rose";
}) {
  const tones: Record<typeof tone, { ring: string; iconBg: string; iconText: string }> = {
    blue: { ring: "border-blue-500/20", iconBg: "bg-blue-500/15", iconText: "text-blue-300" },
    amber: { ring: "border-amber-500/20", iconBg: "bg-amber-500/15", iconText: "text-amber-300" },
    emerald: { ring: "border-emerald-500/20", iconBg: "bg-emerald-500/15", iconText: "text-emerald-300" },
    rose: { ring: "border-rose-500/20", iconBg: "bg-rose-500/15", iconText: "text-rose-300" },
  };
  const t = tones[tone];
  return (
    <div className={`rounded-xl bg-black/40 border ${t.ring} p-3`}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`h-6 w-6 rounded-md ${t.iconBg} ${t.iconText} flex items-center justify-center`}>
          {icon}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-white/60">{label}</span>
      </div>
      <div className="text-xl md:text-2xl font-bold text-white tabular-nums leading-tight">{value}</div>
      <div className="text-[10px] text-white/50 mt-0.5 truncate">{sublabel}</div>
    </div>
  );
}

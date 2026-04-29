import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Radio, Tv2, RefreshCw, CheckCircle, AlertCircle, Clock,
  BarChart3, Zap, Calendar, PlayCircle, Settings, Activity,
  ChevronRight, Eye, Users, MessageSquare, Check, Trash2,
  BookOpen, Sparkles, X, Loader2, ShieldCheck, Wifi,
  Power, Repeat2, LayoutDashboard, Image, FileText,
  Shield, Menu, KeyRound, ImageOff, Bell, Send,
  TrendingUp, Globe, Monitor, Smartphone, Tablet, Signal,
  Megaphone, MapPin, Save, Plus, Edit3,
} from "lucide-react";
import { useLivestreamStatus } from "@/hooks/useLivestreamStatus";
import { useListGalleryImages } from "@workspace/api-client-react";
import { toast } from "sonner";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { AdminLoginGate, AdminBadge } from "@/components/admin/AdminLoginGate";
import { EventPromotionPreview } from "@/components/event-promo/EventPromotionPreview";
import { WarriCrusadeStatsTile } from "@/components/admin/WarriCrusadeStatsTile";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Bar, ComposedChart, ResponsiveContainer,
  LineChart, Line,
} from "recharts";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── Types ─────────────────────────────────────────────────────────────────────

interface BroadcastStatus {
  automation: {
    enabled: boolean; pollingInterval: string; sundayServiceWindowActive: boolean;
    rebroadcastDurationDays: number; smartCurationEnabled: boolean;
    timezone: string; channelId: string; youtubeApiConfigured: boolean;
  };
  nextScheduled: { sunday8amWAT: string; description: string };
  library: { totalSermons: number; lastSyncedAt: string | null; avgViewCount: number; topSermons: { videoId: string; title: string; viewCount: number }[] };
  serverTime: string; serverTimeWAT: string;
}

interface BroadcastQueue {
  strategy: "ai" | "algorithmic" | "fallback"; curatedAt: string;
  primary: { videoId: string; title: string; thumbnailUrl: string | null; score: number; reason: string; viewCount: number | null };
  queue: { videoId: string; title: string; thumbnailUrl: string | null; score: number; reason: string; viewCount: number | null }[];
}

interface BroadcastMetrics {
  overview: { totalViews: number; maxViews: number; avgViews: number; totalSermons: number; liveCount: number; featuredCount: number };
  recentSermons: { videoId: string; title: string; publishedAt: string; viewCount: number | null; isFeatured: boolean; isLive: boolean }[];
}

interface TestimonyItem {
  id: number; author: string; title: string | null; content: string;
  category: string | null; approved: boolean; createdAt: string;
}

interface PlatformMetrics {
  platform?: { sermons?: number; blogs?: number; members?: number; conversations?: number; testimonies?: number };
  ai?: { totalFeedback?: number; averageRating?: string | null; averageLatencyMs?: string | null; tierBreakdown?: Record<string, number> };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function rel(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function countdown(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Now";
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), mn = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${mn}m`;
  return `${mn}m`;
}

// ─── Nav sections ──────────────────────────────────────────────────────────────

type Section = "overview" | "broadcast" | "events" | "sermons" | "gallery" | "testimonies" | "platform" | "credentials";

const NAV: { id: Section; label: string; icon: React.ReactNode; badge?: string }[] = [
  { id: "overview",     label: "Overview",     icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: "broadcast",    label: "Broadcast",    icon: <Radio className="w-4 h-4" /> },
  { id: "events",       label: "Events",       icon: <Megaphone className="w-4 h-4" /> },
  { id: "sermons",      label: "Sermons",      icon: <BookOpen className="w-4 h-4" /> },
  { id: "gallery",      label: "Gallery",      icon: <Image className="w-4 h-4" /> },
  { id: "testimonies",  label: "Testimonies",  icon: <MessageSquare className="w-4 h-4" /> },
  { id: "platform",     label: "Platform",     icon: <BarChart3 className="w-4 h-4" /> },
  { id: "credentials",  label: "Credentials",  icon: <Shield className="w-4 h-4" /> },
];

// ─── Shared sub-components ────────────────────────────────────────────────────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-border bg-card p-5 ${className}`}>{children}</div>;
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-5">
      <h2 className="font-bold text-lg">{title}</h2>
      {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
    </div>
  );
}

function StatusPill({ label, status }: { label: string; status: "live" | "rebroadcast" | "off" }) {
  const map = {
    live: "bg-red-500/10 border-red-500/30 text-red-400",
    rebroadcast: "bg-amber-500/10 border-amber-500/30 text-amber-400",
    off: "bg-muted border-border text-muted-foreground",
  };
  const dot = { live: "bg-red-500 animate-pulse", rebroadcast: "bg-amber-400", off: "bg-muted-foreground" };
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${map[status]}`}>
      <span className={`w-2 h-2 rounded-full ${dot[status]}`} />
      {label}
    </div>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: string | number; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      {icon && <div className="text-muted-foreground mb-2 text-xs flex items-center gap-1.5">{icon}{label}</div>}
      {!icon && <p className="text-xs text-muted-foreground mb-1">{label}</p>}
      <p className="text-2xl font-bold text-primary">{typeof value === "number" ? value.toLocaleString() : value}</p>
    </div>
  );
}

function ConfigRow({ label, value, mono, status }: { label: string; value: string; mono?: boolean; status?: "ok" | "warn" | "info" }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        {status === "ok" && <CheckCircle className="w-3 h-3 text-emerald-500" />}
        {status === "warn" && <AlertCircle className="w-3 h-3 text-amber-500" />}
        {status === "info" && <Wifi className="w-3 h-3 text-blue-400" />}
        <span className={`text-xs font-medium ${mono ? "font-mono text-[10px]" : ""}`}>{value}</span>
      </div>
    </div>
  );
}

// ─── Active Visitors Panel ────────────────────────────────────────────────────

const PAGE_LABELS: Record<string, string> = {
  "/":                    "Home",
  "/sermons":             "Sermons",
  "/give":                "Give",
  "/prayer":              "Prayer",
  "/testimonies":         "Testimonies",
  "/events":              "Events",
  "/blog":                "Blog",
  "/gallery":             "Gallery",
  "/members":             "Members",
  "/about":               "About",
  "/devotion":            "Devotion",
  "/moments":             "Moments",
  "/sermon-assistant":    "AI Assistant",
  "/topics":              "Topics",
  "/scripture-study":     "Scripture Study",
  "/spiritual-insight":   "Spiritual Insight",
  "/leadership":          "Leadership",
  "/join":                "Join",
  "/crusade":             "Crusade",
  "/viewing-centres":     "Viewing Centres",
  "/admin":               "Admin",
};

function labelPage(path: string): string {
  if (PAGE_LABELS[path]) return PAGE_LABELS[path]!;
  if (path.startsWith("/sermons/")) return "Sermon Detail";
  if (path.startsWith("/blog/"))    return "Blog Post";
  if (path.startsWith("/topics/"))  return "Topic";
  return path;
}

interface VisitorState {
  total: number;
  active: number;
  pages: { page: string; count: number }[];
  devices?: { type: string; count: number }[];
  timestamp: number;
}

interface SparkPoint { t: string; v: number }

type ConnStatus = "connecting" | "connected" | "disconnected";

const MAX_SPARK = 30;

interface RealtimeDashboardSnapshot {
  type: "dashboard_realtime";
  live: {
    viewers: number;
    activeLiveViewers: number;
    activeRebroadcastViewers: number;
    totalLiveViewers: number;
    totalRebroadcastViewers: number;
    totalViewerSessions: number;
    isLive: boolean;
    isUpcoming: boolean;
    title: string | null;
    videoId: string | null;
    startedAt: string | null;
    scheduledStartTime: string | null;
    rebroadcastActive: boolean;
    rebroadcastMode: "scheduled" | "continuous" | null;
  };
  visitors: VisitorState;
  engagement: {
    activeAudience: number;
    interactions24h: number;
    aiMessages24h: number;
    conversations24h: number;
    prayerRequests24h: number;
    testimonies24h: number;
    momentLikes24h: number;
    momentComments24h: number;
    momentSharesTotal: number;
    broadcastEvents24h: number;
    newMembers24h: number;
    pushSubscribers: number;
    engagementDensity: number;
  };
  generatedAt: string;
}

interface RealtimePoint {
  t: string;
  audience: number;
  visitors: number;
  liveViewers: number;
  rebroadcastViewers: number;
}

type AdminAuth = ReturnType<typeof useAdminAuth>;

async function readApiJson<T>(res: Response, fallbackMessage: string): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = typeof data?.error === "string" ? data.error : fallbackMessage;
    throw new Error(message);
  }
  return data as T;
}

function formatAdminError(error: unknown, fallback = "Action failed"): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function useRealtimeDashboard(adminToken: string, onUnauthorized: () => void) {
  const [snapshot, setSnapshot] = useState<RealtimeDashboardSnapshot | null>(null);
  const [history, setHistory] = useState<RealtimePoint[]>([]);
  const [conn, setConn] = useState<ConnStatus>("connecting");
  const esRef = useRef<EventSource | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelayRef = useRef(2_000);

  const recordSnapshot = useCallback((data: RealtimeDashboardSnapshot) => {
    setSnapshot(data);
    setHistory(prev => {
      const label = new Date(data.generatedAt).toLocaleTimeString("en-NG", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      const next = [
        ...prev,
        {
          t: label,
          audience: data.engagement.activeAudience,
          visitors: data.visitors.active,
          liveViewers: data.live.activeLiveViewers ?? data.live.viewers,
          rebroadcastViewers: data.live.activeRebroadcastViewers ?? 0,
        },
      ];
      return next.length > 36 ? next.slice(next.length - 36) : next;
    });
  }, []);

  const connect = useCallback(() => {
    if (!adminToken) {
      esRef.current?.close();
      esRef.current = null;
      setConn("disconnected");
      return;
    }
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
    esRef.current?.close();
    setConn("connecting");
    const es = new EventSource(`${BASE}/api/admin/realtime/stream?adminToken=${encodeURIComponent(adminToken)}`);
    esRef.current = es;

    es.onopen = () => {
      retryDelayRef.current = 2_000;
      setConn("connected");
    };
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as RealtimeDashboardSnapshot;
        if (data.type === "dashboard_realtime") {
          recordSnapshot(data);
          setConn("connected");
        }
      } catch {
      }
    };
    es.onerror = () => {
      setConn("disconnected");
      es.close();
      esRef.current = null;
      fetch(`${BASE}/api/admin/realtime`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${adminToken}` },
      })
        .then(r => {
          if (r.status === 401) {
            onUnauthorized();
            throw new Error("unauthorized");
          }
          return r.ok ? r.json() : null;
        })
        .then((data: RealtimeDashboardSnapshot | null) => {
          if (data?.type === "dashboard_realtime") recordSnapshot(data);
        })
        .catch(() => null);
      const delay = retryDelayRef.current;
      retryDelayRef.current = Math.min(delay * 2, 30_000);
      reconnectRef.current = setTimeout(connect, delay + Math.floor(Math.random() * 750));
    };
  }, [adminToken, onUnauthorized, recordSnapshot]);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, [connect]);

  return { snapshot, history, conn };
}

function AudienceCommandCenter({ snapshot, history, conn }: { snapshot: RealtimeDashboardSnapshot | null; history: RealtimePoint[]; conn: ConnStatus }) {
  const liveMode = snapshot?.live.isLive
    ? "Live Service"
    : snapshot?.live.rebroadcastActive
      ? snapshot.live.rebroadcastMode === "continuous" ? "Temple TV" : "Rebroadcast"
      : snapshot?.live.isUpcoming
        ? "Upcoming"
        : "Off Air";
  const connColor = conn === "connected" ? "text-emerald-400" : conn === "connecting" ? "text-amber-400" : "text-red-400";
  const connDot = conn === "connected" ? "bg-emerald-400 animate-pulse" : conn === "connecting" ? "bg-amber-400 animate-pulse" : "bg-red-500";
  const engagementRows = snapshot ? [
    { label: "AI messages", value: snapshot.engagement.aiMessages24h, icon: <MessageSquare className="w-3.5 h-3.5" /> },
    { label: "Prayers", value: snapshot.engagement.prayerRequests24h, icon: <Sparkles className="w-3.5 h-3.5" /> },
    { label: "Moments", value: snapshot.engagement.momentLikes24h + snapshot.engagement.momentComments24h, icon: <Activity className="w-3.5 h-3.5" /> },
    { label: "New members", value: snapshot.engagement.newMembers24h, icon: <Users className="w-3.5 h-3.5" /> },
  ] : [];

  return (
    <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-border/70">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-primary font-bold">Operations Center</p>
          <h3 className="font-bold text-lg mt-1">Real-time Audience Command Dashboard</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Live viewers, website visitors, and engagement signals refresh continuously.</p>
        </div>
        <div className={`flex items-center gap-2 text-xs font-semibold ${connColor}`}>
          <span className={`w-2.5 h-2.5 rounded-full ${connDot}`} />
          {conn === "connected" ? "Real-time stream active" : conn === "connecting" ? "Connecting to live stream" : "Using fallback polling"}
        </div>
      </div>

      <div className="p-5 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {[
            { label: "Active Audience", value: snapshot?.engagement.activeAudience ?? 0, helper: "site + live player", icon: <Signal className="w-4 h-4" />, color: "text-emerald-400 border-emerald-500/25 bg-emerald-500/10" },
            { label: "Live Now", value: snapshot?.live.activeLiveViewers ?? snapshot?.live.viewers ?? 0, helper: liveMode, icon: <Radio className="w-4 h-4" />, color: snapshot?.live.isLive ? "text-red-400 border-red-500/25 bg-red-500/10" : "text-amber-400 border-amber-500/25 bg-amber-500/10" },
            { label: "Rebroadcast Now", value: snapshot?.live.activeRebroadcastViewers ?? 0, helper: snapshot?.live.rebroadcastActive ? liveMode : "No rebroadcast", icon: <PlayCircle className="w-4 h-4" />, color: "text-sky-400 border-sky-500/25 bg-sky-500/10" },
            { label: "Live Total", value: snapshot?.live.totalLiveViewers ?? 0, helper: "cumulative live stream", icon: <Users className="w-4 h-4" />, color: "text-rose-400 border-rose-500/25 bg-rose-500/10" },
            { label: "Rebroadcast Total", value: snapshot?.live.totalRebroadcastViewers ?? 0, helper: "cumulative replay", icon: <RefreshCw className="w-4 h-4" />, color: "text-cyan-400 border-cyan-500/25 bg-cyan-500/10" },
            { label: "Website Visitors", value: snapshot?.visitors.active ?? 0, helper: `${(snapshot?.visitors.total ?? 0).toLocaleString()} all-time`, icon: <Globe className="w-4 h-4" />, color: "text-blue-400 border-blue-500/25 bg-blue-500/10" },
            { label: "24h Engagement", value: snapshot?.engagement.interactions24h ?? 0, helper: `${snapshot?.engagement.engagementDensity ?? 0} per active`, icon: <TrendingUp className="w-4 h-4" />, color: "text-violet-400 border-violet-500/25 bg-violet-500/10" },
          ].map(metric => (
            <div key={metric.label} className={`rounded-2xl border p-4 ${metric.color}`}>
              <div className="flex items-center gap-2 text-xs font-medium opacity-80">{metric.icon}{metric.label}</div>
              <motion.p
                key={`${metric.label}-${metric.value}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-3xl font-black mt-2 tabular-nums"
              >
                {metric.value.toLocaleString()}
              </motion.p>
              <p className="text-[11px] text-muted-foreground mt-1">{metric.helper}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.65fr] gap-4">
          <div className="rounded-2xl border border-border bg-background/60 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> Audience trend</p>
              <p className="text-xs text-muted-foreground">5-second operational readings</p>
            </div>
            <div className="h-56">
              {history.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="audienceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4ade80" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="t" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} minTickGap={28} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.75rem", fontSize: "12px", color: "hsl(var(--foreground))" }}
                      formatter={(value: number, name: string) => [value, name === "audience" ? "Active audience" : name === "visitors" ? "Website visitors" : name === "rebroadcastViewers" ? "Rebroadcast viewers" : "Live viewers"]}
                    />
                    <Area type="monotone" dataKey="audience" stroke="#4ade80" strokeWidth={2.5} fill="url(#audienceGrad)" dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="visitors" stroke="#60a5fa" strokeWidth={1.8} dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="liveViewers" stroke="#f87171" strokeWidth={1.8} dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="rebroadcastViewers" stroke="#38bdf8" strokeWidth={1.8} dot={false} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full rounded-xl bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">
                  Collecting real-time readings…
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-background/60 p-4">
              <p className="text-sm font-semibold flex items-center gap-2 mb-3"><Zap className="w-4 h-4 text-primary" /> Engagement mix</p>
              <div className="space-y-2.5">
                {engagementRows.map(row => (
                  <div key={row.label} className="flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground flex items-center gap-2">{row.icon}{row.label}</span>
                    <span className="text-sm font-bold tabular-nums">{row.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background/60 p-4">
              <p className="text-sm font-semibold flex items-center gap-2 mb-3"><Monitor className="w-4 h-4 text-primary" /> Device presence</p>
              <div className="space-y-2">
                {(snapshot?.visitors.devices ?? []).length > 0 ? snapshot?.visitors.devices?.map(device => {
                  const total = Math.max(snapshot.visitors.active, 1);
                  const pct = Math.round((device.count / total) * 100);
                  const Icon = device.type === "mobile" ? Smartphone : device.type === "tablet" ? Tablet : Monitor;
                  return (
                    <div key={device.type}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="capitalize flex items-center gap-1.5"><Icon className="w-3.5 h-3.5" />{device.type}</span>
                        <span className="font-semibold">{device.count} · {pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                }) : <p className="text-xs text-muted-foreground">No active device data yet.</p>}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground border-t border-border pt-3">
          <span>Push subscribers: {(snapshot?.engagement.pushSubscribers ?? 0).toLocaleString()} · Moment shares: {(snapshot?.engagement.momentSharesTotal ?? 0).toLocaleString()}</span>
          <span>Last updated {snapshot ? new Date(snapshot.generatedAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}</span>
        </div>
      </div>
    </div>
  );
}

function ActiveVisitorsPanel({ state: providedState, spark, conn }: { state: VisitorState | null | undefined; spark: SparkPoint[]; conn: ConnStatus }) {
  const state = providedState ?? {
    total: 0, active: 0, pages: [], timestamp: Date.now(),
  };

  const connColor = conn === "connected" ? "text-emerald-400" : conn === "connecting" ? "text-amber-400" : "text-red-400";
  const connDot   = conn === "connected" ? "bg-emerald-400 animate-pulse" : conn === "connecting" ? "bg-amber-400 animate-pulse" : "bg-red-500";
  const connLabel = conn === "connected" ? "Live" : conn === "connecting" ? "Connecting…" : "Reconnecting…";

  const topPages = state.pages.slice(0, 6);
  const maxPageCount = Math.max(...topPages.map(p => p.count), 1);

  const sparkMin = Math.max(0, Math.min(...spark.map(s => s.v)) - 1);
  const sparkMax = Math.max(...spark.map(s => s.v), 1) + 1;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Signal className="w-4 h-4 text-primary" />
          </div>
          <span className="font-semibold text-sm">Real-Time Visitors</span>
        </div>
        <div className={`flex items-center gap-1.5 text-xs font-medium ${connColor}`}>
          <span className={`w-2 h-2 rounded-full ${connDot}`} />
          {connLabel}
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Hero metrics row */}
        <div className="grid grid-cols-2 gap-3">
          {/* Active right now */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Active Now
            </div>
            <motion.p
              key={state.active}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="text-4xl font-black text-emerald-400 tabular-nums leading-none"
            >
              {state.active}
            </motion.p>
            <p className="text-[11px] text-muted-foreground">visitors on site</p>
          </div>

          {/* Total all-time */}
          <div className="rounded-xl border border-border bg-muted/30 p-4 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
              <Globe className="w-3 h-3" />
              Total Visitors
            </div>
            <p className="text-4xl font-black text-primary tabular-nums leading-none">
              {state.total.toLocaleString()}
            </p>
            <p className="text-[11px] text-muted-foreground">all-time unique</p>
          </div>
        </div>

        {/* Sparkline */}
        {spark.length > 1 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <TrendingUp className="w-3 h-3" /> Active visitors (last {spark.length} readings)
              </span>
              <span className="text-xs text-muted-foreground">30 s intervals</span>
            </div>
            <div className="h-24 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={spark} margin={{ top: 4, right: 4, left: -30, bottom: 0 }}>
                  <defs>
                    <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#4ade80" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
                  <YAxis
                    domain={[sparkMin, sparkMax]}
                    tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false} tickLine={false} allowDecimals={false}
                    width={28}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                      fontSize: "11px",
                      color: "hsl(var(--foreground))",
                      padding: "6px 10px",
                    }}
                    formatter={(v: number) => [v, "Active"]}
                    labelStyle={{ color: "hsl(var(--muted-foreground))", fontSize: "10px" }}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.t ?? ""}
                  />
                  <Line
                    type="monotone" dataKey="v"
                    stroke="#4ade80" strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 3, fill: "#4ade80", strokeWidth: 0 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Pages breakdown */}
        {topPages.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
              <Eye className="w-3 h-3" /> Active by Page
            </p>
            <div className="space-y-2">
              {topPages.map(({ page, count }) => {
                const pct = Math.round((count / maxPageCount) * 100);
                return (
                  <div key={page}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs text-foreground font-medium">{labelPage(page)}</span>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-emerald-400">{count}</span>
                        <span className="text-muted-foreground w-6 text-right">{pct}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-emerald-400"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {state.active === 0 && conn === "connected" && (
          <div className="text-center py-4">
            <Users className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No active visitors right now</p>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">The panel updates within 30 seconds of a new visit</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 border-t border-border text-[10px] text-muted-foreground">
          <span>Updates every 30 s · 2-min session window</span>
          <span>
            {state.timestamp ? new Date(state.timestamp).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────

function OverviewSection({ liveStatus, adminAuth }: { liveStatus: ReturnType<typeof useLivestreamStatus>; adminAuth: AdminAuth }) {
  const realtime = useRealtimeDashboard(adminAuth.adminToken, adminAuth.logout);
  const visitorSpark = realtime.history
    .map(point => ({ t: point.t, v: point.visitors }))
    .slice(-MAX_SPARK);
  const { data, isLoading } = useQuery<BroadcastStatus>({
    queryKey: ["broadcast-status"],
    queryFn: () => fetch(`${BASE}/api/broadcast/status`).then(r => r.json()),
    refetchInterval: 30_000,
  });

  const isLive = liveStatus.isLive;

  return (
    <div className="space-y-5">
      <SectionHeader title="Overview" description="Real-time platform activity, audience engagement, and broadcast operations" />

      <AdminLoginGate role="livestream" auth={adminAuth} title="Realtime Dashboard">
        <AudienceCommandCenter snapshot={realtime.snapshot} history={realtime.history} conn={realtime.conn} />
      </AdminLoginGate>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: <Radio className="w-4 h-4" />, label: "Live Stream", value: isLive ? "LIVE" : "Off Air", color: isLive ? "border-red-500/30 bg-red-500/5 text-red-400" : "" },
          { icon: <Eye className="w-4 h-4" />, label: "Live Viewers", value: realtime.snapshot?.live.viewers ?? 0, color: (realtime.snapshot?.live.viewers ?? 0) > 0 ? "border-red-500/30 bg-red-500/5 text-red-400" : "" },
          { icon: <Users className="w-4 h-4" />, label: "Site Visitors", value: realtime.snapshot?.visitors.active ?? 0, color: (realtime.snapshot?.visitors.active ?? 0) > 0 ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400" : "" },
          { icon: <Activity className="w-4 h-4" />, label: "24h Activity", value: realtime.snapshot?.engagement.interactions24h ?? 0, color: "border-blue-500/30 bg-blue-500/5 text-blue-400" },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.color || "border-border bg-card text-muted-foreground"}`}>
            <div className="flex items-center gap-2 mb-2 opacity-70">{s.icon}<span className="text-xs">{s.label}</span></div>
            <p className="font-bold text-base text-foreground">{typeof s.value === "number" ? s.value.toLocaleString() : s.value}</p>
          </div>
        ))}
      </div>

      <AdminLoginGate role="livestream" auth={adminAuth} compact title="Realtime Visitors">
        <ActiveVisitorsPanel state={realtime.snapshot?.visitors} spark={visitorSpark} conn={realtime.conn} />
      </AdminLoginGate>

      {isLoading ? <div className="h-40 rounded-2xl bg-card border border-border animate-pulse" /> : data && (
        <Card>
          <h3 className="font-semibold text-sm flex items-center gap-2 mb-4"><Settings className="w-4 h-4 text-primary" /> Automation Engine</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
            <ConfigRow label="Channel ID" value={data.automation.channelId} mono />
            <ConfigRow label="Timezone" value={data.automation.timezone} />
            <ConfigRow label="Rebroadcast Window" value={`${data.automation.rebroadcastDurationDays} days`} />
            <ConfigRow label="YouTube API" value={data.automation.youtubeApiConfigured ? "Configured" : "Not set"} status={data.automation.youtubeApiConfigured ? "ok" : "warn"} />
            <ConfigRow label="Sunday Window" value={data.automation.sundayServiceWindowActive ? "Active (5s poll)" : "Inactive (30s)"} status={data.automation.sundayServiceWindowActive ? "ok" : "info"} />
            <ConfigRow label="Server WAT" value={new Date(data.serverTimeWAT).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} />
          </div>
        </Card>
      )}

      {data?.library && (
        <Card>
          <h3 className="font-semibold text-sm flex items-center gap-2 mb-4"><BarChart3 className="w-4 h-4 text-primary" /> Sermon Library</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div><p className="text-2xl font-bold text-primary">{data.library.totalSermons.toLocaleString()}</p><p className="text-xs text-muted-foreground mt-0.5">Total Sermons</p></div>
            <div><p className="text-2xl font-bold text-primary">{data.library.avgViewCount.toLocaleString()}</p><p className="text-xs text-muted-foreground mt-0.5">Avg Views</p></div>
            <div><p className="text-sm font-bold text-primary mt-2">{data.library.lastSyncedAt ? rel(data.library.lastSyncedAt) : "—"}</p><p className="text-xs text-muted-foreground mt-0.5">Last Sync</p></div>
          </div>
        </Card>
      )}

      <PushNotificationsCard />

      {data?.nextScheduled && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-center gap-3">
          <Calendar className="w-8 h-8 text-primary shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Next Sunday Service (8:00 AM WAT)</p>
            <p className="font-semibold text-sm">{new Date(data.nextScheduled.sunday8amWAT).toLocaleDateString("en-NG", { weekday: "long", month: "long", day: "numeric" })}</p>
            <p className="text-xs text-primary font-medium">In {countdown(data.nextScheduled.sunday8amWAT)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Push Notifications Card ──────────────────────────────────────────────────

interface GrowthRow { date: string; new_subscribers: string; cumulative: string }

interface DeliveryLogRow {
  id: string;
  notification_title: string;
  notification_type: string;
  sent: string;
  failed: string;
  deactivated: string;
  total_attempted: string;
  delivery_rate: string;
  dispatched_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  service_alert: "Service Alert",
  broadcast:     "Broadcast",
  test:          "Test",
  reminder:      "Reminder",
  daily_devotion:"Devotion",
  new_sermon:    "New Sermon",
  live_service:  "Live",
  rebroadcast:   "Rebroadcast",
};

interface ChartPoint { date: string; total: number; new: number }
interface DeviceRow { type: string; count: number; pct: number }

const DEVICE_META: Record<string, { label: string; color: string }> = {
  web:     { label: "Desktop / Web", color: "hsl(var(--primary))" },
  mobile:  { label: "Mobile",        color: "hsl(var(--accent))" },
  android: { label: "Android",       color: "#4ade80" },
  ios:     { label: "iOS",           color: "#f472b6" },
};

function DeviceBreakdown({ devices }: { devices: DeviceRow[] }) {
  if (!devices.length) return null;

  return (
    <div className="mb-5">
      <p className="text-xs font-medium text-muted-foreground mb-3">Subscribers by Device</p>
      <div className="space-y-2.5">
        {devices.map(d => {
          const meta = DEVICE_META[d.type] ?? { label: d.type.charAt(0).toUpperCase() + d.type.slice(1), color: "#94a3b8" };
          return (
            <div key={d.type}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: meta.color }} />
                  <span className="text-xs font-medium">{meta.label}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{d.count.toLocaleString()}</span>
                  <span>{d.pct}%</span>
                </div>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${d.pct}%`, background: meta.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SubscriberChart({ data, range }: { data: ChartPoint[]; range: number }) {
  const tickEvery = range <= 14 ? 1 : range <= 30 ? 4 : 8;
  const visibleTicks = data
    .map((d, i) => ({ label: d.date, i }))
    .filter(({ i }) => i % tickEvery === 0 || i === data.length - 1)
    .map(({ label }) => label);

  return (
    <div className="w-full h-40">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="date"
            ticks={visibleTicks}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "0.75rem",
              fontSize: "12px",
              color: "hsl(var(--foreground))",
            }}
            formatter={(value: number, name: string) => [
              value,
              name === "total" ? "Total subscribers" : "New today",
            ]}
            labelStyle={{ color: "hsl(var(--muted-foreground))", marginBottom: 4 }}
          />
          <Bar dataKey="new" fill="hsl(var(--accent))" opacity={0.5} radius={[2, 2, 0, 0]} maxBarSize={10} />
          <Area
            type="monotone"
            dataKey="total"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="url(#totalGrad)"
            dot={false}
            activeDot={{ r: 4, fill: "hsl(var(--primary))" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function PushNotificationsCard() {
  const auth = useAdminAuth("livestream");
  const [range, setRange] = useState<14 | 30 | 60>(30);

  const { data: stats, refetch } = useQuery<{ subscribers: number }>({
    queryKey: ["push-stats"],
    queryFn: () => fetch(`${BASE}/api/push/stats`).then(r => r.json()),
    refetchInterval: 30_000,
  });

  const { data: growthData, isLoading: growthLoading } = useQuery<{ growth: GrowthRow[] }>({
    queryKey: ["push-growth"],
    queryFn: () => fetch(`${BASE}/api/push/growth`).then(r => r.json()),
    refetchInterval: 60_000,
  });

  const { data: devicesData } = useQuery<{ total: number; devices: DeviceRow[] }>({
    queryKey: ["push-devices"],
    queryFn: () => fetch(`${BASE}/api/push/devices`).then(r => r.json()),
    refetchInterval: 60_000,
  });

  const { data: deliveryLog, refetch: refetchLog } = useQuery<{ log: DeliveryLogRow[] }>({
    queryKey: ["push-delivery-log"],
    queryFn: () =>
      auth.adminToken
        ? fetch(`${BASE}/api/push/delivery-log`, {
            headers: { Authorization: `Bearer ${auth.adminToken}` },
          }).then(r => r.json())
        : Promise.resolve({ log: [] }),
    enabled: !!auth.adminToken,
    refetchInterval: auth.adminToken ? 30_000 : false,
  });

  const chartData = (growthData?.growth ?? [])
    .slice(-range)
    .map(r => ({
      date: r.date,
      total: parseInt(r.cumulative, 10),
      new: parseInt(r.new_subscribers, 10),
    }));

  const maxTotal = Math.max(...chartData.map(d => d.total), 1);
  const totalGain = chartData.reduce((s, d) => s + d.new, 0);

  const authHeader: Record<string, string> = auth.adminToken ? { Authorization: `Bearer ${auth.adminToken}` } : {};

  const [customTitle, setCustomTitle] = useState("");
  const [customBody, setCustomBody] = useState("");
  const [sending, setSending] = useState<"service" | "custom" | null>(null);

  const sendServiceAlert = async () => {
    setSending("service");
    try {
      const res = await fetch(`${BASE}/api/push/upcoming-service`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Service alert sent to ${data.sent ?? data.subscribers ?? 0} subscribers`);
        refetch();
        refetchLog();
      } else {
        toast.error(data.error ?? "Failed to send");
      }
    } catch {
      toast.error("Network error — could not send alert");
    } finally {
      setSending(null);
    }
  };

  const sendCustomBroadcast = async () => {
    if (!customTitle.trim() || !customBody.trim()) {
      toast.error("Title and message are required");
      return;
    }
    setSending("custom");
    try {
      const res = await fetch(`${BASE}/api/push/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ title: customTitle.trim(), body: customBody.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Broadcast sent to ${data.sent ?? 0} subscribers`);
        setCustomTitle("");
        setCustomBody("");
        refetch();
        refetchLog();
      } else {
        toast.error(data.error ?? "Failed to send");
      }
    } catch {
      toast.error("Network error — could not send broadcast");
    } finally {
      setSending(null);
    }
  };

  return (
    <Card>
      <h3 className="font-semibold text-sm flex items-center gap-2 mb-4">
        <Bell className="w-4 h-4 text-primary" /> Push Notifications
      </h3>

      {/* Subscriber count stats */}
      <div className="flex items-center gap-3 mb-5">
        <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 flex-1 text-center">
          <p className="text-2xl font-bold text-primary">{stats?.subscribers ?? "—"}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Active Subscribers</p>
        </div>
        <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 flex-1 text-center">
          <p className="text-lg font-bold text-emerald-400">+{totalGain}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Last {range} days</p>
        </div>
        <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 flex-1 text-center">
          <p className="text-sm font-semibold text-primary">7:30 AM</p>
          <p className="text-xs text-muted-foreground mt-0.5">Sunday Auto-Alert</p>
        </div>
      </div>

      {/* Device breakdown */}
      <DeviceBreakdown devices={devicesData?.devices ?? []} />

      {/* Growth chart */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-muted-foreground">Subscribers Over Time</p>
          <div className="flex gap-1">
            {([14, 30, 60] as const).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                  range === r
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "text-muted-foreground hover:text-primary border border-transparent"
                }`}
              >
                {r}d
              </button>
            ))}
          </div>
        </div>

        {growthLoading ? (
          <div className="h-36 rounded-xl bg-muted/40 animate-pulse" />
        ) : chartData.length === 0 || maxTotal === 0 ? (
          <div className="h-36 rounded-xl bg-muted/40 flex items-center justify-center">
            <p className="text-xs text-muted-foreground">No subscriber data yet</p>
          </div>
        ) : (
          <SubscriberChart data={chartData} range={range} />
        )}
      </div>

      {/* Broadcast actions — requires livestream admin login */}
      <AdminLoginGate role="livestream" auth={auth} compact title="Livestream Admin">
        <div className="space-y-4">
          {/* Send service alert */}
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">Service Alert (Holy Spirit Sunday Service)</p>
            <button
              onClick={sendServiceAlert}
              disabled={sending !== null}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 py-2.5 text-sm font-semibold text-amber-400 transition-colors hover:bg-amber-500/20 disabled:opacity-50 cursor-pointer"
            >
              {sending === "service" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
              Send "Begins Soon" Alert Now
            </button>
          </div>

          {/* Custom broadcast */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Custom Broadcast</p>
            <input
              type="text"
              placeholder="Notification title…"
              value={customTitle}
              onChange={e => setCustomTitle(e.target.value)}
              className="w-full rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm outline-none focus:border-primary/50 placeholder:text-muted-foreground/50"
            />
            <textarea
              placeholder="Notification message…"
              value={customBody}
              onChange={e => setCustomBody(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm outline-none focus:border-primary/50 resize-none placeholder:text-muted-foreground/50"
            />
            <button
              onClick={sendCustomBroadcast}
              disabled={sending !== null || !customTitle.trim() || !customBody.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/20 disabled:opacity-50 cursor-pointer"
            >
              {sending === "custom" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Broadcast to All Subscribers
            </button>
          </div>

          {/* Delivery log */}
          {(deliveryLog?.log ?? []).length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-2">Recent Broadcasts</p>
              <div className="space-y-2">
                {(deliveryLog?.log ?? []).slice(0, 8).map(row => {
                  const rate = parseFloat(row.delivery_rate);
                  const rateColor = rate >= 90 ? "text-emerald-400" : rate >= 70 ? "text-amber-400" : "text-red-400";
                  const total = parseInt(row.total_attempted, 10);
                  const typeLabel = TYPE_LABELS[row.notification_type] ?? row.notification_type;
                  const ago = (() => {
                    const diff = Date.now() - new Date(row.dispatched_at).getTime();
                    const m = Math.floor(diff / 60000);
                    if (m < 60) return `${m}m ago`;
                    const h = Math.floor(m / 60);
                    if (h < 24) return `${h}h ago`;
                    return `${Math.floor(h / 24)}d ago`;
                  })();
                  return (
                    <div key={row.id} className="rounded-xl border border-border bg-muted/30 px-3 py-2.5 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-primary/10 text-primary">{typeLabel}</span>
                          <span className="text-[10px] text-muted-foreground">{ago}</span>
                        </div>
                        <p className="text-xs font-medium truncate">{row.notification_title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {row.sent} sent · {row.failed} failed · {row.deactivated} expired · {total} total
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold ${rateColor}`}>{rate}%</p>
                        <p className="text-[10px] text-muted-foreground">delivery</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </AdminLoginGate>
    </Card>
  );
}

// ─── Broadcast ────────────────────────────────────────────────────────────────

interface VideoValidation {
  valid: boolean;
  isLive: boolean;
  isUpcoming: boolean;
  title: string | null;
  thumbnailUrl: string | null;
  scheduledStartTime: string | null;
}

interface LatestUpload {
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  viewCount: number;
}

function BroadcastSection({ liveStatus, auth }: { liveStatus: ReturnType<typeof useLivestreamStatus>; auth: ReturnType<typeof useAdminAuth> }) {
  const qc = useQueryClient();
  const [videoId, setVideoId] = useState("");
  const [validation, setValidation] = useState<VideoValidation | null>(null);
  const [validating, setValidating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [showUploads, setShowUploads] = useState(false);
  const validateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const authHeader = { Authorization: `Bearer ${auth.adminToken}` };

  const isOverrideActive = liveStatus.manualOverride.live || liveStatus.manualOverride.rebroadcast;

  // Debounced validation on video ID input
  const handleVideoIdChange = (val: string) => {
    setVideoId(val);
    setValidation(null);
    if (validateTimerRef.current) clearTimeout(validateTimerRef.current);
    const trimmed = val.trim();
    if (!trimmed) return;
    validateTimerRef.current = setTimeout(() => { validateVideo(trimmed); }, 600);
  };

  const validateVideo = async (id: string) => {
    setValidating(true);
    try {
      const res = await fetch(`${BASE}/api/livestream/validate-video?videoId=${encodeURIComponent(id)}`, {
        headers: authHeader,
      });
      if (res.ok) {
        const data = await res.json() as VideoValidation;
        setValidation(data);
      } else {
        setValidation(null);
      }
    } catch {
      setValidation(null);
    } finally {
      setValidating(false);
    }
  };

  const goLive = async () => {
    const id = videoId.trim();
    if (!id) return;
    if (validation && !validation.isLive) {
      toast.error("This video is not currently live. Use 'Set as Rebroadcast' instead.");
      return;
    }
    setBusy("live");
    try {
      const res = await fetch(`${BASE}/api/livestream/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({
          isLive: true,
          videoId: id,
          title: validation?.title ?? null,
        }),
      });
      if (!res.ok) {
        if (res.status === 401) auth.logout();
        const d = await res.json().catch(() => ({})) as { error?: string };
        toast.error(d.error ?? "Failed to go live");
        return;
      }
      toast.success("🔴 Stream is now LIVE");
      qc.invalidateQueries({ queryKey: ["livestream-status"] });
    } finally { setBusy(null); }
  };

  const stopLive = async () => {
    setBusy("stopLive");
    try {
      const res = await fetch(`${BASE}/api/livestream/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ isLive: false }),
      });
      if (!res.ok) { if (res.status === 401) auth.logout(); toast.error("Failed to stop stream"); return; }
      toast.success("Stream stopped");
      qc.invalidateQueries({ queryKey: ["livestream-status"] });
    } finally { setBusy(null); }
  };

  const setRebroadcast = async (vid?: string, title?: string, thumbnailUrl?: string) => {
    const id = vid ?? videoId.trim();
    setBusy("rebroadcast");
    try {
      const res = await fetch(`${BASE}/api/livestream/rebroadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({
          videoId: id || undefined,
          title: title ?? (validation?.title ?? undefined),
          thumbnailUrl: thumbnailUrl ?? (validation?.thumbnailUrl ?? undefined),
        }),
      });
      if (!res.ok) {
        if (res.status === 401) auth.logout();
        const d = await res.json().catch(() => ({})) as { error?: string };
        toast.error(d.error ?? "Failed to set rebroadcast");
        return;
      }
      toast.success("📺 Rebroadcast activated");
      qc.invalidateQueries({ queryKey: ["livestream-status"] });
      setShowUploads(false);
    } finally { setBusy(null); }
  };

  const stopRebroadcast = async () => {
    setBusy("stopRebroadcast");
    try {
      const res = await fetch(`${BASE}/api/livestream/rebroadcast`, {
        method: "DELETE",
        headers: authHeader,
      });
      if (!res.ok) { if (res.status === 401) auth.logout(); toast.error("Failed to stop rebroadcast"); return; }
      toast.success("Rebroadcast stopped");
      qc.invalidateQueries({ queryKey: ["livestream-status"] });
    } finally { setBusy(null); }
  };

  const clearOverride = async () => {
    setBusy("clearOverride");
    try {
      const res = await fetch(`${BASE}/api/livestream/override`, {
        method: "DELETE",
        headers: authHeader,
      });
      if (!res.ok) { if (res.status === 401) auth.logout(); toast.error("Failed to clear override"); return; }
      toast.success("Automation resumed — polling YouTube for current status");
      qc.invalidateQueries({ queryKey: ["livestream-status"] });
    } finally { setBusy(null); }
  };

  const { data: queueData, isLoading: queueLoading, refetch: refetchQueue } = useQuery<BroadcastQueue>({
    queryKey: ["broadcast-queue"],
    queryFn: () => fetch(`${BASE}/api/broadcast/queue`).then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const { data: uploadsData, isLoading: uploadsLoading } = useQuery<{ videos: LatestUpload[] }>({
    queryKey: ["latest-uploads"],
    queryFn: () => fetch(`${BASE}/api/livestream/latest-uploads`, { headers: authHeader }).then(r => r.json()),
    enabled: showUploads && !!auth.adminToken,
    staleTime: 5 * 60 * 1000,
  });

  const currentStatus = liveStatus.isLive ? "live" : liveStatus.rebroadcast.available ? "rebroadcast" : "off";

  return (
    <div className="space-y-5">
      <SectionHeader title="Broadcast Control" description="Hybrid manual + automated live stream and rebroadcast management" />

      {/* Current Status Banner */}
      <div className={`rounded-2xl border p-4 flex items-center justify-between gap-3 ${
        currentStatus === "live" ? "border-red-500/30 bg-red-500/5"
        : currentStatus === "rebroadcast" ? "border-amber-500/30 bg-amber-500/5"
        : "border-border bg-card"
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            currentStatus === "live" ? "bg-red-500/20" : currentStatus === "rebroadcast" ? "bg-amber-500/20" : "bg-muted"
          }`}>
            {currentStatus === "live" ? <Radio className="w-5 h-5 text-red-500 animate-pulse" />
              : currentStatus === "rebroadcast" ? <Tv2 className="w-5 h-5 text-amber-500" />
              : <Power className="w-5 h-5 text-muted-foreground" />}
          </div>
          <div>
            <p className={`font-bold text-sm ${
              currentStatus === "live" ? "text-red-500" : currentStatus === "rebroadcast" ? "text-amber-500" : "text-muted-foreground"
            }`}>
              {currentStatus === "live" ? "🔴 LIVE NOW" : currentStatus === "rebroadcast" ? "📺 REBROADCAST" : "⚫ OFF AIR"}
            </p>
            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
              {liveStatus.title ?? (currentStatus === "off" ? "No active broadcast" : "—")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusPill
            label={currentStatus === "live" ? "Live" : currentStatus === "rebroadcast" ? "Rebroadcast" : "Off Air"}
            status={currentStatus === "live" ? "live" : currentStatus === "rebroadcast" ? "rebroadcast" : "off"}
          />
          {isOverrideActive && (
            <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-violet-500/10 text-violet-400 border border-violet-500/20 uppercase tracking-wide">
              Manual
            </span>
          )}
        </div>
      </div>

      <AdminLoginGate role="livestream" auth={auth} title="Livestream Controls">
        <div className="space-y-4">
          {/* Manual Override Warning */}
          <AnimatePresence>
            {isOverrideActive && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2 text-sm text-violet-400">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span><strong>Manual override active</strong> — automation is paused</span>
                </div>
                <button
                  onClick={clearOverride}
                  disabled={busy === "clearOverride"}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-50 transition-colors shrink-0"
                >
                  {busy === "clearOverride" ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Resume Automation
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Video ID Input + Validator */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary" /> YouTube Video ID
              </h3>
              <AdminBadge role="livestream" auth={auth} />
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  value={videoId}
                  onChange={e => handleVideoIdChange(e.target.value)}
                  placeholder="Paste video ID (e.g. dQw4w9WgXcQ)"
                  className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
                />
                <button
                  onClick={() => videoId.trim() && validateVideo(videoId.trim())}
                  disabled={!videoId.trim() || validating}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 text-primary border border-primary/20 text-xs font-semibold hover:bg-primary/20 disabled:opacity-50 transition-colors"
                >
                  {validating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  Validate
                </button>
              </div>

              {/* Validation Result */}
              <AnimatePresence mode="wait">
                {validating && (
                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-2 text-xs text-muted-foreground p-3 rounded-xl bg-muted/40">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking YouTube…
                  </motion.div>
                )}
                {!validating && validation && (
                  <motion.div key="result" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className={`rounded-xl border p-3 flex items-center gap-3 ${
                      !validation.valid ? "border-red-500/30 bg-red-500/5"
                      : validation.isLive ? "border-red-500/30 bg-red-500/5"
                      : validation.isUpcoming ? "border-blue-500/30 bg-blue-500/5"
                      : "border-emerald-500/30 bg-emerald-500/5"
                    }`}>
                    {validation.valid && validation.thumbnailUrl && (
                      <img src={validation.thumbnailUrl} alt="" className="w-16 h-10 rounded-lg object-cover shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      {!validation.valid ? (
                        <p className="text-sm font-semibold text-red-400 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5" /> Video not found
                        </p>
                      ) : (
                        <>
                          <p className="text-sm font-medium truncate">{validation.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {validation.isLive && (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE
                              </span>
                            )}
                            {validation.isUpcoming && (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                <Clock className="w-3 h-3" /> UPCOMING
                              </span>
                            )}
                            {!validation.isLive && !validation.isUpcoming && (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <CheckCircle className="w-3 h-3" /> VIDEO (not live)
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Card>

          {/* Live Stream Controls */}
          <Card>
            <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
              <Radio className="w-4 h-4 text-red-500" /> Live Stream
            </h3>

            {validation && !validation.isLive && validation.valid && videoId.trim() && (
              <div className="mb-3 flex items-start gap-2 p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 text-xs text-amber-400">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>This video is not currently live. You can still force it as live, or use it for rebroadcast below.</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                onClick={goLive}
                disabled={!!busy || !videoId.trim() || (!!validation && !validation.valid)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
                  validation?.isLive
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "bg-red-500/70 text-white hover:bg-red-500"
                }`}
              >
                {busy === "live" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radio className="h-3.5 w-3.5" />}
                {validation?.isLive ? "Go Live ✓" : "Force Live"}
              </button>

              {liveStatus.isLive && (
                <button
                  onClick={stopLive}
                  disabled={!!busy}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border bg-muted text-sm font-semibold hover:bg-muted/70 disabled:opacity-50 transition-colors"
                >
                  {busy === "stopLive" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                  Stop Stream
                </button>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
              "Go Live ✓" requires a validated live video. "Force Live" overrides validation — use when YouTube API quota is exhausted.
            </p>
          </Card>

          {/* Rebroadcast Controls */}
          <Card>
            <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
              <Tv2 className="w-4 h-4 text-amber-500" /> Rebroadcast
            </h3>

            <div className="flex flex-wrap gap-2 mb-3">
              <button
                onClick={() => setRebroadcast(videoId.trim() || undefined)}
                disabled={!!busy}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors"
              >
                {busy === "rebroadcast" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Repeat2 className="h-3.5 w-3.5" />}
                {videoId.trim() ? "Set This Video" : "Auto-Select Latest"}
              </button>

              <button
                onClick={() => setRebroadcast(undefined)}
                disabled={!!busy}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-primary/20 bg-primary/5 text-primary text-sm font-semibold hover:bg-primary/10 disabled:opacity-50 transition-colors"
              >
                {busy === "rebroadcast" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                AI Auto-Pick
              </button>

              {liveStatus.rebroadcast.available && (
                <button
                  onClick={stopRebroadcast}
                  disabled={!!busy}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border bg-muted text-sm font-semibold hover:bg-muted/70 disabled:opacity-50 transition-colors"
                >
                  {busy === "stopRebroadcast" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                  Stop Rebroadcast
                </button>
              )}
            </div>

            {/* Latest Uploads Picker */}
            <div className="border-t border-border pt-3 mt-1">
              <button
                onClick={() => setShowUploads(v => !v)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
              >
                <PlayCircle className="w-3.5 h-3.5" />
                {showUploads ? "Hide" : "Browse"} latest uploads from library
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showUploads ? "rotate-90" : ""}`} />
              </button>

              <AnimatePresence>
                {showUploads && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 space-y-1.5 max-h-64 overflow-y-auto pr-1">
                      {uploadsLoading ? (
                        Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 rounded-xl bg-muted animate-pulse" />)
                      ) : uploadsData?.videos.length ? (
                        uploadsData.videos.map(v => (
                          <button
                            key={v.videoId}
                            onClick={() => setRebroadcast(v.videoId, v.title, v.thumbnailUrl ?? undefined)}
                            disabled={!!busy}
                            className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-border hover:border-amber-500/40 hover:bg-amber-500/5 text-left transition-colors disabled:opacity-50 group"
                          >
                            {v.thumbnailUrl ? (
                              <img src={v.thumbnailUrl} alt="" className="w-12 h-8 rounded-lg object-cover shrink-0" />
                            ) : (
                              <div className="w-12 h-8 rounded-lg bg-muted shrink-0 flex items-center justify-center">
                                <PlayCircle className="w-3.5 h-3.5 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate group-hover:text-amber-500 transition-colors">{v.title}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {(v.viewCount ?? 0).toLocaleString()} views
                                {v.publishedAt ? ` · ${rel(v.publishedAt)}` : ""}
                              </p>
                            </div>
                            <Repeat2 className="w-3.5 h-3.5 text-muted-foreground group-hover:text-amber-500 shrink-0 transition-colors" />
                          </button>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">No videos in library yet</p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Card>
        </div>
      </AdminLoginGate>

      {/* AI Rebroadcast Queue */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-violet-400" /> AI Rebroadcast Queue</h3>
          <button onClick={() => refetchQueue()} disabled={queueLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors disabled:opacity-50">
            <RefreshCw className={`w-3 h-3 ${queueLoading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        {queueLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />)}</div>
        ) : queueData ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${queueData.strategy === "ai" ? "bg-violet-500/10 text-violet-400 border border-violet-500/20" : "bg-blue-500/10 text-blue-400 border border-blue-500/20"}`}>
                {queueData.strategy === "ai" ? "🤖 AI-Curated" : "📊 Algorithmic"}
              </span>
              <span className="text-xs text-muted-foreground">{rel(queueData.curatedAt)}</span>
            </div>
            {queueData.queue.map((item, idx) => (
              <div key={item.videoId} className={`rounded-xl border p-3 flex items-center gap-3 ${idx === 0 ? "border-primary/30 bg-primary/5" : "border-border"}`}>
                {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" className="w-14 h-9 rounded-lg object-cover shrink-0" /> : <div className="w-14 h-9 rounded-lg bg-muted shrink-0 flex items-center justify-center"><PlayCircle className="w-3.5 h-3.5 text-muted-foreground" /></div>}
                <div className="flex-1 min-w-0">
                  {idx === 0 && <span className="text-[10px] font-bold text-primary uppercase tracking-wide">Primary Pick</span>}
                  <p className="text-sm font-medium leading-snug truncate">{item.title}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Eye className="w-3 h-3" />{(item.viewCount ?? 0).toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground">Score: {item.score}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setRebroadcast(item.videoId, item.title, item.thumbnailUrl ?? undefined)}
                    disabled={!!busy}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 transition-colors disabled:opacity-50"
                    title="Set as Rebroadcast"
                  >
                    <Repeat2 className="w-3.5 h-3.5" />
                  </button>
                  <a href={`https://youtube.com/watch?v=${item.videoId}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-muted-foreground text-center py-6">Could not load queue</p>}
      </Card>
    </div>
  );
}

// ─── Sermons ──────────────────────────────────────────────────────────────────

function SermonsSection({ auth }: { auth: ReturnType<typeof useAdminAuth> }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<"sync" | "harvest" | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const authHeader = { Authorization: `Bearer ${auth.adminToken}` };

  const runSync = async (harvest: boolean) => {
    if (!confirm(harvest ? "Full harvest uses significant API quota. Continue?" : undefined as unknown as string) && harvest) return;
    setBusy(harvest ? "harvest" : "sync");
    setLastResult(null);
    try {
      const res = await fetch(`${BASE}/api/sermons${harvest ? "?harvest=true" : ""}`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeader } });
      if (!res.ok) { if (res.status === 401) auth.logout(); const d = await res.json().catch(() => ({})); toast.error(d?.error ?? "Sync failed"); return; }
      const data = await res.json();
      const msg = harvest ? `Full harvest: ${data.inserted ?? 0} inserted, ${data.updated ?? 0} updated` : `Sync: ${data.inserted ?? 0} new, ${data.updated ?? 0} updated`;
      toast.success(msg); setLastResult(msg);
      qc.invalidateQueries({ queryKey: ["broadcast-status"] });
    } finally { setBusy(null); }
  };

  const { data: scheduleData } = useQuery<{ schedule: { date: string; timeWAT: string; timeUTC: string; label: string }[] }>({
    queryKey: ["broadcast-schedule"],
    queryFn: () => fetch(`${BASE}/api/broadcast/schedule`).then(r => r.json()),
    staleTime: 30 * 60 * 1000,
  });

  const { data: metrics, isLoading: metricsLoading } = useQuery<BroadcastMetrics>({
    queryKey: ["broadcast-metrics"],
    queryFn: () => fetch(`${BASE}/api/broadcast/metrics`).then(r => r.json()),
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-5">
      <SectionHeader title="Sermon Library" description="Sync YouTube library and review sermon metrics" />

      <AdminLoginGate role="sermon" auth={auth} title="Sermon Sync">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm flex items-center gap-2"><RefreshCw className="w-4 h-4 text-primary" /> Sync Controls</h3>
            <AdminBadge role="sermon" auth={auth} />
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            <button onClick={() => runSync(false)} disabled={!!busy} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {busy === "sync" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Incremental Sync
            </button>
            <button onClick={() => runSync(true)} disabled={!!busy} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border bg-muted text-sm font-semibold hover:bg-muted/70 disabled:opacity-50 transition-colors">
              {busy === "harvest" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpen className="h-3.5 w-3.5" />} Full Harvest
            </button>
          </div>
          {lastResult && <p className="text-xs text-emerald-600 font-medium mb-2">{lastResult}</p>}
          <p className="text-xs text-muted-foreground">Incremental sync checks for new videos. Full harvest re-imports the entire library (uses API quota).</p>
        </Card>
      </AdminLoginGate>

      {scheduleData && (
        <Card>
          <h3 className="font-semibold text-sm flex items-center gap-2 mb-4"><Calendar className="w-4 h-4 text-primary" /> Sunday Schedule</h3>
          <div className="space-y-2">
            {scheduleData.schedule.map((item, idx) => (
              <div key={item.date} className={`rounded-xl border p-3 flex items-center gap-3 ${idx === 0 ? "border-primary/30 bg-primary/5" : "border-border"}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${idx === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  <Calendar className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{item.timeWAT}</p>
                  <p className="text-xs text-muted-foreground">UTC: {new Date(item.timeUTC).toLocaleString("en-NG")}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${idx === 0 ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {idx === 0 ? `In ${countdown(item.timeUTC)}` : item.label}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 rounded-xl bg-muted/40 text-xs text-muted-foreground leading-relaxed">
            <Clock className="w-3.5 h-3.5 inline-block mr-1" />
            Detection window: <strong className="text-foreground">7:45 AM – 10:30 AM WAT</strong> every Sunday — 5s poll. Outside this window: 30s poll.
          </div>
        </Card>
      )}

      {metricsLoading ? <div className="h-32 rounded-2xl bg-card border border-border animate-pulse" /> : metrics && (
        <Card>
          <h3 className="font-semibold text-sm flex items-center gap-2 mb-4"><BarChart3 className="w-4 h-4 text-primary" /> Broadcast Metrics</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            {[
              { label: "Total Sermons", value: metrics.overview.totalSermons },
              { label: "Total Views", value: metrics.overview.totalViews ?? 0 },
              { label: "Avg Views", value: metrics.overview.avgViews ?? 0 },
              { label: "Featured", value: metrics.overview.featuredCount ?? 0 },
              { label: "Live Count", value: metrics.overview.liveCount ?? 0 },
              { label: "Top Views", value: metrics.overview.maxViews ?? 0 },
            ].map(m => (
              <div key={m.label} className="rounded-xl border border-border bg-background p-3 text-center">
                <p className="text-xl font-bold text-primary">{m.value.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{m.label}</p>
              </div>
            ))}
          </div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Recently Synced</h4>
          <div className="space-y-0">
            {metrics.recentSermons.slice(0, 8).map(s => (
              <div key={s.videoId} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.title}</p>
                  <p className="text-xs text-muted-foreground">{rel(s.publishedAt)}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {s.isLive && <span className="text-[10px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded-full">Live</span>}
                  {s.isFeatured && <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded-full">Featured</span>}
                  <span className="text-xs text-muted-foreground">{(s.viewCount ?? 0).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Gallery ──────────────────────────────────────────────────────────────────

type GalleryImageItem = {
  id: number;
  title: string;
  objectPath: string;
  thumbnailPath?: string | null;
  category: string;
  createdAt: string;
};

function ThumbnailRow({ image, adminToken, onDone }: { image: GalleryImageItem; adminToken: string; onDone: () => void }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(image.thumbnailPath ? "done" : "idle");
  const [errMsg, setErrMsg] = useState("");

  const hasThumbnail = status === "done" || (status === "idle" && Boolean(image.thumbnailPath));

  const retry = async () => {
    setStatus("loading");
    setErrMsg("");
    try {
      const res = await fetch(`${BASE}/api/gallery/${image.id}/regenerate-thumbnail`, {
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Server error ${res.status}`);
      }
      setStatus("done");
      toast.success(`Thumbnail regenerated for "${image.title || `#${image.id}`}"`);
      onDone();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setErrMsg(msg);
      setStatus("error");
      toast.error(`Failed: ${msg}`);
    }
  };

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-muted/40 flex items-center justify-center shrink-0">
        {hasThumbnail ? (
          <CheckCircle className="w-4 h-4 text-emerald-500" />
        ) : status === "loading" ? (
          <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />
        ) : (
          <ImageOff className="w-4 h-4 text-amber-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{image.title || `Image #${image.id}`}</p>
        <p className="text-[10px] text-muted-foreground capitalize">{image.category}</p>
        {status === "error" && <p className="text-[10px] text-red-400 truncate">{errMsg}</p>}
      </div>
      {!hasThumbnail && (
        <button
          onClick={retry}
          disabled={status === "loading"}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-violet-500/10 text-violet-500 hover:bg-violet-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          <RefreshCw className={`w-3 h-3 ${status === "loading" ? "animate-spin" : ""}`} />
          Retry
        </button>
      )}
    </div>
  );
}

function GalleryThumbnailPanel({ adminToken }: { adminToken: string }) {
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const LIMIT = 50;

  const { data: images = [], isLoading, refetch } = useListGalleryImages({ limit: LIMIT, offset: page * LIMIT });

  const missing = (images as GalleryImageItem[]).filter(img => !img.thumbnailPath);
  const total   = (images as GalleryImageItem[]).length;

  const [bulkLoading, setBulkLoading] = useState(false);

  const retryAll = async () => {
    const pending = (images as GalleryImageItem[]).filter(img => !img.thumbnailPath);
    if (pending.length === 0) { toast.info("All images already have thumbnails."); return; }
    setBulkLoading(true);
    let ok = 0; let fail = 0;
    for (const img of pending) {
      try {
        const res = await fetch(`${BASE}/api/gallery/${img.id}/regenerate-thumbnail`, {
          method: "POST",
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        if (res.ok) ok++; else fail++;
      } catch { fail++; }
    }
    setBulkLoading(false);
    toast.success(`Bulk regeneration complete: ${ok} succeeded${fail > 0 ? `, ${fail} failed` : ""}`);
    refetch();
    qc.invalidateQueries({ queryKey: ["listGalleryImages"] });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-8 text-muted-foreground text-sm gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading images…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{total}</span> image{total !== 1 ? "s" : ""} — {" "}
          <span className={missing.length > 0 ? "text-amber-500 font-semibold" : "text-emerald-500 font-semibold"}>
            {missing.length === 0 ? "all thumbnails ready" : `${missing.length} missing thumbnail${missing.length !== 1 ? "s" : ""}`}
          </span>
        </div>
        {missing.length > 0 && (
          <button
            onClick={retryAll}
            disabled={bulkLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <RefreshCw className={`w-3 h-3 ${bulkLoading ? "animate-spin" : ""}`} />
            {bulkLoading ? "Processing…" : `Regenerate All (${missing.length})`}
          </button>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card/50 px-4 divide-y divide-border/0">
        {(images as GalleryImageItem[]).map(img => (
          <ThumbnailRow
            key={img.id}
            image={img}
            adminToken={adminToken}
            onDone={() => {
              refetch();
              qc.invalidateQueries({ queryKey: ["listGalleryImages"] });
            }}
          />
        ))}
        {total === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No gallery images yet. Upload photos on the Gallery page.</p>
        )}
      </div>

      {total >= LIMIT && (
        <div className="flex items-center justify-center gap-3 pt-1">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border disabled:opacity-40 hover:bg-muted transition-colors">Previous</button>
          <span className="text-xs text-muted-foreground">Page {page + 1}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={total < LIMIT} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border disabled:opacity-40 hover:bg-muted transition-colors">Next</button>
        </div>
      )}
    </div>
  );
}

function GallerySection({ auth }: { auth: ReturnType<typeof useAdminAuth> }) {
  return (
    <div className="space-y-5">
      <SectionHeader title="Gallery Management" description="Upload photos and manage image thumbnails" />
      <AdminLoginGate role="gallery" auth={auth} title="Gallery Admin">
        <Card>
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-sm flex items-center gap-2"><Image className="w-4 h-4 text-violet-500" /> Gallery Controls</h3>
            <AdminBadge role="gallery" auth={auth} />
          </div>

          <div className="flex flex-wrap gap-3 mb-6">
            <a href={`${BASE}/gallery`} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-500 text-white text-sm font-semibold hover:bg-violet-600 transition-colors">
              <Image className="w-4 h-4" /> Open Gallery Manager →
            </a>
          </div>

          <div className="border-t border-border pt-5">
            <h4 className="text-sm font-semibold mb-1 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-violet-400" /> Thumbnail Status
            </h4>
            <p className="text-xs text-muted-foreground mb-4">
              WebP thumbnails are generated automatically on upload. Use the retry controls below to regenerate any that failed.
            </p>
            <GalleryThumbnailPanel adminToken={auth.adminToken ?? ""} />
          </div>
        </Card>
      </AdminLoginGate>
    </div>
  );
}

// ─── Testimonies ──────────────────────────────────────────────────────────────

function TestimonyCard({ t, onApprove, onUnapprove, onDelete, isPending }: { t: TestimonyItem; onApprove?: () => void; onUnapprove?: () => void; onDelete: () => void; isPending: boolean }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`rounded-xl border p-4 ${t.approved ? "border-emerald-500/20 bg-emerald-500/5" : "border-border bg-card"}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-medium text-sm">{t.author}</span>
            {t.category && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full capitalize">{t.category}</span>}
            <span className="text-[10px] text-muted-foreground ml-auto">{new Date(t.createdAt).toLocaleDateString("en-NG")}</span>
          </div>
          {t.title && <p className="text-xs font-semibold mb-1">{t.title}</p>}
          <p className={`text-xs text-muted-foreground leading-relaxed ${expanded ? "" : "line-clamp-2"}`}>{t.content}</p>
          {t.content.length > 120 && <button onClick={() => setExpanded(!expanded)} className="text-[10px] text-primary mt-1">{expanded ? "Show less" : "Show more"}</button>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {!t.approved && onApprove && <button onClick={onApprove} disabled={isPending} title="Approve" className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 flex items-center justify-center disabled:opacity-50"><Check className="w-3.5 h-3.5" /></button>}
          {t.approved && onUnapprove && <button onClick={onUnapprove} disabled={isPending} title="Unapprove" className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 flex items-center justify-center disabled:opacity-50"><X className="w-3.5 h-3.5" /></button>}
          <button onClick={onDelete} disabled={isPending} title="Delete" className="w-7 h-7 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center justify-center disabled:opacity-50"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    </div>
  );
}

function TestimoniesSection({ auth }: { auth: AdminAuth }) {
  const qc = useQueryClient();
  const authHeader = { Authorization: `Bearer ${auth.adminToken}` };

  const { data, isLoading, refetch } = useQuery<{ testimonies: TestimonyItem[] }>({
    queryKey: ["admin-testimonies"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/testimonies?all=true&limit=50`, { headers: authHeader });
      if (res.status === 401) auth.logout();
      return { testimonies: await readApiJson<TestimonyItem[]>(res, "Unable to load testimonies") };
    },
    enabled: !!auth.adminToken,
    staleTime: 0,
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, approved }: { id: number; approved: boolean }) => {
      const res = await fetch(`${BASE}/api/testimonies/${id}/approve`, { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeader }, body: JSON.stringify({ approved }) });
      if (res.status === 401) auth.logout();
      return readApiJson(res, "Failed to update testimony");
    },
    onSuccess: (_, { approved }) => { toast.success(approved ? "Approved" : "Unapproved"); qc.invalidateQueries({ queryKey: ["admin-testimonies"] }); },
    onError: (error) => toast.error(formatAdminError(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE}/api/testimonies/${id}`, { method: "DELETE", headers: authHeader });
      if (res.status === 401) auth.logout();
      return readApiJson(res, "Failed to delete testimony");
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-testimonies"] }); },
    onError: (error) => toast.error(formatAdminError(error, "Delete failed")),
  });

  const testimonies = data?.testimonies ?? [];
  const pending  = testimonies.filter(t => !t.approved);
  const approved = testimonies.filter(t => t.approved);
  const isPending = approveMutation.isPending || deleteMutation.isPending;

  return (
    <div className="space-y-5">
      <AdminLoginGate role="sermon" auth={auth} title="Testimony Moderation">
        <div className="flex items-center justify-between">
          <SectionHeader title="Testimonies" description={isLoading ? "Loading…" : `${pending.length} pending · ${approved.length} published`} />
          <button onClick={() => refetch()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-muted border border-border hover:bg-muted/80 transition-colors text-muted-foreground"><RefreshCw className="w-3 h-3" /> Refresh</button>
        </div>

        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-card border border-border animate-pulse" />)}</div>
        ) : (
          <>
            {pending.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-amber-500 uppercase tracking-wide flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> Pending Review ({pending.length})</p>
                {pending.map(t => <TestimonyCard key={t.id} t={t} onApprove={() => approveMutation.mutate({ id: t.id, approved: true })} onDelete={() => deleteMutation.mutate(t.id)} isPending={isPending} />)}
              </div>
            )}
            {approved.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wide flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> Published ({approved.length})</p>
                {approved.map(t => <TestimonyCard key={t.id} t={t} onUnapprove={() => approveMutation.mutate({ id: t.id, approved: false })} onDelete={() => deleteMutation.mutate(t.id)} isPending={isPending} />)}
              </div>
            )}
            {testimonies.length === 0 && <div className="text-center py-12 text-muted-foreground"><MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-30" /><p className="text-sm">No testimonies yet</p></div>}
          </>
        )}
      </AdminLoginGate>
    </div>
  );
}

// ─── Event Promotions ────────────────────────────────────────────────────────

interface AdminEventPromotion {
  id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  artworkUrl: string | null;
  location: string | null;
  ctaText: string;
  ctaUrl: string;
  startAt: string;
  endAt: string;
  status: "draft" | "active" | "archived";
  showBanner: boolean;
  showPopup: boolean;
  showStickyBar: boolean;
  phase: "upcoming" | "live" | "ended";
  msUntilStart: number;
  msUntilEnd: number;
  pushSentAt: string | null;
  endPushSentAt: string | null;
}

interface PromotionFormState {
  id: number | null;
  slug: string;
  title: string;
  subtitle: string;
  artworkUrl: string;
  location: string;
  ctaText: string;
  ctaUrl: string;
  startAtLocal: string;
  endAtLocal: string;
  status: "draft" | "active" | "archived";
  showBanner: boolean;
  showPopup: boolean;
  showStickyBar: boolean;
}

const EMPTY_PROMOTION_FORM: PromotionFormState = {
  id: null,
  slug: "",
  title: "",
  subtitle: "",
  artworkUrl: "",
  location: "",
  ctaText: "Join Us",
  ctaUrl: "/",
  startAtLocal: "",
  endAtLocal: "",
  status: "active",
  showBanner: true,
  showPopup: true,
  showStickyBar: true,
};

// Convert an ISO UTC string into the value format <input type="datetime-local">
// expects (YYYY-MM-DDTHH:mm in the user's local TZ).
function isoToLocalInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToIso(local: string): string {
  if (!local) return "";
  return new Date(local).toISOString();
}

function formatPromotionTimeline(p: AdminEventPromotion): string {
  if (p.phase === "live") {
    const hrs = Math.floor(p.msUntilEnd / 3_600_000);
    const mins = Math.floor((p.msUntilEnd % 3_600_000) / 60_000);
    return `Ends in ${hrs}h ${mins}m`;
  }
  if (p.phase === "upcoming") {
    const days = Math.floor(p.msUntilStart / 86_400_000);
    const hrs = Math.floor((p.msUntilStart % 86_400_000) / 3_600_000);
    const mins = Math.floor((p.msUntilStart % 3_600_000) / 60_000);
    if (days > 0) return `Starts in ${days}d ${hrs}h`;
    return `Starts in ${hrs}h ${mins}m`;
  }
  return "Ended";
}

function EventPromotionsSection({ auth }: { auth: AdminAuth }) {
  const qc = useQueryClient();
  const authHeader = { Authorization: `Bearer ${auth.adminToken}` };
  const [form, setForm] = useState<PromotionFormState>(EMPTY_PROMOTION_FORM);
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading, refetch } = useQuery<AdminEventPromotion[]>({
    queryKey: ["admin-event-promotions"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/admin/event-promotions`, { headers: authHeader });
      if (res.status === 401) auth.logout();
      return readApiJson<AdminEventPromotion[]>(res, "Unable to load promotions");
    },
    enabled: !!auth.adminToken,
    refetchInterval: 30_000,
    staleTime: 0,
  });

  const upsertMutation = useMutation({
    mutationFn: async (payload: PromotionFormState) => {
      const body = {
        slug: payload.slug.trim(),
        title: payload.title.trim(),
        subtitle: payload.subtitle.trim() || null,
        artworkUrl: payload.artworkUrl.trim() || null,
        location: payload.location.trim() || null,
        ctaText: payload.ctaText.trim() || "Join Us",
        ctaUrl: payload.ctaUrl.trim() || "/",
        startAt: localInputToIso(payload.startAtLocal),
        endAt: localInputToIso(payload.endAtLocal),
        status: payload.status,
        showBanner: payload.showBanner,
        showPopup: payload.showPopup,
        showStickyBar: payload.showStickyBar,
      };
      const url = payload.id
        ? `${BASE}/api/admin/event-promotions/${payload.id}`
        : `${BASE}/api/admin/event-promotions`;
      const method = payload.id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify(body),
      });
      if (res.status === 401) auth.logout();
      return readApiJson(res, "Failed to save promotion");
    },
    onSuccess: () => {
      toast.success(form.id ? "Promotion updated" : "Promotion created");
      qc.invalidateQueries({ queryKey: ["admin-event-promotions"] });
      qc.invalidateQueries({ queryKey: ["event-promotions", "active"] });
      setForm(EMPTY_PROMOTION_FORM);
      setShowForm(false);
    },
    onError: (error) => toast.error(formatAdminError(error, "Save failed")),
  });

  const togglePatchMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<AdminEventPromotion> }) => {
      const res = await fetch(`${BASE}/api/admin/event-promotions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify(patch),
      });
      if (res.status === 401) auth.logout();
      return readApiJson(res, "Failed to update");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-event-promotions"] });
      qc.invalidateQueries({ queryKey: ["event-promotions", "active"] });
    },
    onError: (error) => toast.error(formatAdminError(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE}/api/admin/event-promotions/${id}`, { method: "DELETE", headers: authHeader });
      if (res.status === 401) auth.logout();
      return readApiJson(res, "Failed to delete");
    },
    onSuccess: () => {
      toast.success("Promotion deleted");
      qc.invalidateQueries({ queryKey: ["admin-event-promotions"] });
      qc.invalidateQueries({ queryKey: ["event-promotions", "active"] });
    },
    onError: (error) => toast.error(formatAdminError(error, "Delete failed")),
  });

  const handleEdit = (p: AdminEventPromotion) => {
    setForm({
      id: p.id,
      slug: p.slug,
      title: p.title,
      subtitle: p.subtitle ?? "",
      artworkUrl: p.artworkUrl ?? "",
      location: p.location ?? "",
      ctaText: p.ctaText,
      ctaUrl: p.ctaUrl,
      startAtLocal: isoToLocalInput(p.startAt),
      endAtLocal: isoToLocalInput(p.endAt),
      status: p.status,
      showBanner: p.showBanner,
      showPopup: p.showPopup,
      showStickyBar: p.showStickyBar,
    });
    setShowForm(true);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.slug || !form.title || !form.startAtLocal || !form.endAtLocal) {
      toast.error("Slug, title, start and end are required");
      return;
    }
    if (new Date(form.endAtLocal).getTime() <= new Date(form.startAtLocal).getTime()) {
      toast.error("End time must be after start time");
      return;
    }
    upsertMutation.mutate(form);
  };

  const promotions = data ?? [];
  const counts = {
    live: promotions.filter(p => p.phase === "live" && p.status === "active").length,
    upcoming: promotions.filter(p => p.phase === "upcoming" && p.status === "active").length,
    ended: promotions.filter(p => p.phase === "ended").length,
  };

  return (
    <div className="space-y-5">
      <AdminLoginGate role="livestream" auth={auth} title="Event Promotions">
        <WarriCrusadeStatsTile adminToken={auth.adminToken} />
        <div className="flex items-center justify-between flex-wrap gap-3">
          <SectionHeader
            title="Event Promotions"
            description={
              isLoading
                ? "Loading…"
                : `${counts.live} live · ${counts.upcoming} upcoming · ${counts.ended} ended`
            }
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-muted border border-border hover:bg-muted/80 transition-colors text-muted-foreground"
              data-testid="event-promo-refresh"
            >
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
            <button
              onClick={() => {
                setForm(EMPTY_PROMOTION_FORM);
                setShowForm(s => !s);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-primary text-primary-foreground hover:opacity-90 transition-opacity font-semibold"
              data-testid="event-promo-new"
            >
              <Plus className="w-3.5 h-3.5" /> {showForm && !form.id ? "Close form" : "New promotion"}
            </button>
          </div>
        </div>

        {showForm && (
          <Card>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-base flex items-center gap-2">
                  {form.id ? <><Edit3 className="w-4 h-4" /> Editing #{form.id}</> : <><Plus className="w-4 h-4" /> New promotion</>}
                </h3>
                <button
                  type="button"
                  onClick={() => { setForm(EMPTY_PROMOTION_FORM); setShowForm(false); }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Slug (unique)">
                  <input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })}
                    placeholder="warri-city-crusade-2026"
                    className="w-full rounded-lg bg-muted border border-border px-3 py-2 text-sm" />
                </Field>
                <Field label="Status">
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as PromotionFormState["status"] })}
                    className="w-full rounded-lg bg-muted border border-border px-3 py-2 text-sm">
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                    <option value="archived">Archived</option>
                  </select>
                </Field>
                <Field label="Title" className="sm:col-span-2">
                  <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                    placeholder="Warri City Crusade 2026"
                    className="w-full rounded-lg bg-muted border border-border px-3 py-2 text-sm" />
                </Field>
                <Field label="Subtitle / Tagline" className="sm:col-span-2">
                  <textarea value={form.subtitle} onChange={e => setForm({ ...form, subtitle: e.target.value })}
                    rows={2}
                    placeholder="A short description shown beneath the title"
                    className="w-full rounded-lg bg-muted border border-border px-3 py-2 text-sm resize-none" />
                </Field>
                <Field label="Artwork URL">
                  <input value={form.artworkUrl} onChange={e => setForm({ ...form, artworkUrl: e.target.value })}
                    placeholder="/warri-city-crusade-2026.jpeg"
                    className="w-full rounded-lg bg-muted border border-border px-3 py-2 text-sm" />
                </Field>
                <Field label="Location">
                  <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
                    placeholder="Ighogbadu Primary School, Warri"
                    className="w-full rounded-lg bg-muted border border-border px-3 py-2 text-sm" />
                </Field>
                <Field label="CTA Text">
                  <input value={form.ctaText} onChange={e => setForm({ ...form, ctaText: e.target.value })}
                    className="w-full rounded-lg bg-muted border border-border px-3 py-2 text-sm" />
                </Field>
                <Field label="CTA Link">
                  <input value={form.ctaUrl} onChange={e => setForm({ ...form, ctaUrl: e.target.value })}
                    placeholder="/crusade"
                    className="w-full rounded-lg bg-muted border border-border px-3 py-2 text-sm" />
                </Field>
                <Field label="Starts at (your local time)">
                  <input type="datetime-local" value={form.startAtLocal}
                    onChange={e => setForm({ ...form, startAtLocal: e.target.value })}
                    className="w-full rounded-lg bg-muted border border-border px-3 py-2 text-sm" />
                </Field>
                <Field label="Ends at (your local time)">
                  <input type="datetime-local" value={form.endAtLocal}
                    onChange={e => setForm({ ...form, endAtLocal: e.target.value })}
                    className="w-full rounded-lg bg-muted border border-border px-3 py-2 text-sm" />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <ChannelToggle label="Sticky Bar" value={form.showStickyBar}
                  onChange={v => setForm({ ...form, showStickyBar: v })} />
                <ChannelToggle label="Hero Banner" value={form.showBanner}
                  onChange={v => setForm({ ...form, showBanner: v })} />
                <ChannelToggle label="Popup Modal" value={form.showPopup}
                  onChange={v => setForm({ ...form, showPopup: v })} />
              </div>

              <div className="pt-2 border-t border-border">
                <EventPromotionPreview form={form} />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button type="submit" disabled={upsertMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity font-semibold text-sm disabled:opacity-60">
                  {upsertMutation.isPending
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                    : <><Save className="w-4 h-4" /> {form.id ? "Update promotion" : "Create promotion"}</>}
                </button>
                <button type="button" onClick={() => { setForm(EMPTY_PROMOTION_FORM); setShowForm(false); }}
                  className="px-4 py-2 rounded-lg bg-muted border border-border hover:bg-muted/80 text-sm">
                  Cancel
                </button>
              </div>
            </form>
          </Card>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) =>
              <div key={i} className="h-32 rounded-2xl bg-card border border-border animate-pulse" />
            )}
          </div>
        ) : promotions.length === 0 ? (
          <Card>
            <div className="text-center py-10 text-muted-foreground">
              <Megaphone className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No promotions yet — create one to start surfacing event banners and popups across the site.</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {promotions.map(p => (
              <PromotionRow
                key={p.id}
                promotion={p}
                onEdit={() => handleEdit(p)}
                onDelete={() => {
                  if (typeof window !== "undefined" && !window.confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
                  deleteMutation.mutate(p.id);
                }}
                onPatch={(patch) => togglePatchMutation.mutate({ id: p.id, patch })}
                isPending={togglePatchMutation.isPending || deleteMutation.isPending}
              />
            ))}
          </div>
        )}
      </AdminLoginGate>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs font-semibold text-muted-foreground mb-1">{label}</span>
      {children}
    </label>
  );
}

function ChannelToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${value
        ? "bg-primary/10 border-primary/40 text-primary"
        : "bg-muted border-border text-muted-foreground"}`}
    >
      <span>{label}</span>
      <span className={`inline-flex h-4 w-7 rounded-full transition-colors ${value ? "bg-primary" : "bg-border"}`}>
        <span className={`h-3 w-3 rounded-full bg-white shadow transition-transform mt-0.5 ${value ? "translate-x-3.5" : "translate-x-0.5"}`} />
      </span>
    </button>
  );
}

function PromotionRow({
  promotion: p,
  onEdit,
  onDelete,
  onPatch,
  isPending,
}: {
  promotion: AdminEventPromotion;
  onEdit: () => void;
  onDelete: () => void;
  onPatch: (patch: Partial<AdminEventPromotion>) => void;
  isPending: boolean;
}) {
  const phaseStyles =
    p.phase === "live"
      ? "bg-red-500/15 text-red-600 border-red-500/30"
      : p.phase === "upcoming"
        ? "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400"
        : "bg-muted text-muted-foreground border-border";
  const statusStyles =
    p.status === "active"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
      : p.status === "draft"
        ? "bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30"
        : "bg-zinc-500/10 text-zinc-500 border-zinc-500/20";

  return (
    <Card>
      <div className="flex items-start gap-4">
        <div className="h-16 w-16 rounded-xl bg-muted overflow-hidden shrink-0 border border-border">
          {p.artworkUrl ? (
            <img src={p.artworkUrl} alt={p.title} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-muted-foreground">
              <ImageOff className="w-5 h-5" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2">
            <span className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 border ${phaseStyles}`}>
              {p.phase === "live" && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mr-1 animate-pulse" />}
              {p.phase}
            </span>
            <span className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 border ${statusStyles}`}>
              {p.status}
            </span>
            <span className="text-[11px] text-muted-foreground">{formatPromotionTimeline(p)}</span>
          </div>
          <h3 className="mt-1 font-semibold text-sm sm:text-base truncate">{p.title}</h3>
          <p className="text-[11px] text-muted-foreground font-mono">{p.slug}</p>
          {p.location && (
            <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 shrink-0" /> {p.location}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(p.startAt).toLocaleString()} → {new Date(p.endAt).toLocaleString()}
            </span>
            {p.pushSentAt && (
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <Bell className="w-3 h-3" /> Live push sent
              </span>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <InlineToggle
              label="Sticky"
              value={p.showStickyBar}
              disabled={isPending}
              onClick={() => onPatch({ showStickyBar: !p.showStickyBar })}
            />
            <InlineToggle
              label="Banner"
              value={p.showBanner}
              disabled={isPending}
              onClick={() => onPatch({ showBanner: !p.showBanner })}
            />
            <InlineToggle
              label="Popup"
              value={p.showPopup}
              disabled={isPending}
              onClick={() => onPatch({ showPopup: !p.showPopup })}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5 shrink-0">
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1 rounded-lg bg-muted border border-border hover:bg-muted/70 px-2.5 py-1 text-xs"
            data-testid={`event-promo-edit-${p.id}`}
          >
            <Edit3 className="w-3 h-3" /> Edit
          </button>
          <button
            onClick={onDelete}
            disabled={isPending}
            className="inline-flex items-center gap-1 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/20 px-2.5 py-1 text-xs disabled:opacity-60"
            data-testid={`event-promo-delete-${p.id}`}
          >
            <Trash2 className="w-3 h-3" /> Delete
          </button>
        </div>
      </div>
    </Card>
  );
}

function InlineToggle({ label, value, disabled, onClick }: { label: string; value: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border transition-colors ${value
        ? "bg-primary/15 text-primary border-primary/30"
        : "bg-muted text-muted-foreground border-border"}`}
    >
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${value ? "bg-primary" : "bg-muted-foreground/40"}`} />
      {label} {value ? "on" : "off"}
    </button>
  );
}

// ─── Platform ─────────────────────────────────────────────────────────────────

function PlatformSection({ auth }: { auth: AdminAuth }) {
  const [blogTopic, setBlogTopic] = useState("holiness");
  const [generating, setGenerating] = useState(false);
  const authHeader = { Authorization: `Bearer ${auth.adminToken}` };

  const { data: metrics, isLoading } = useQuery<PlatformMetrics>({
    queryKey: ["platform-metrics"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/admin/metrics`, { headers: authHeader });
      if (res.status === 401) auth.logout();
      return readApiJson<PlatformMetrics>(res, "Unable to load platform metrics");
    },
    enabled: !!auth.adminToken,
    staleTime: 60_000,
  });

  const generateBlog = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`${BASE}/api/admin/blog/generate`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeader }, body: JSON.stringify({ topic: blogTopic }) });
      const data = await res.json();
      if (res.status === 401) auth.logout();
      res.ok ? toast.success(`"${data.post?.title ?? "Article"}" generated!`) : toast.error(data.error ?? "Generation failed");
    } catch { toast.error("Network error"); } finally { setGenerating(false); }
  };

  const BLOG_TOPICS = ["holiness", "correction-mandate", "prayer", "faith", "repentance", "bible-doctrine", "apostolic-order", "prophetic-insight", "end-times", "revival"];

  return (
    <div className="space-y-5">
      <SectionHeader title="Platform Analytics" description="Live platform health and AI content generation" />

      <AdminLoginGate role="sermon" auth={auth} title="Platform Analytics">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-20 rounded-xl bg-card border border-border animate-pulse" />)}</div>
        ) : metrics ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Members",       value: metrics.platform?.members ?? 0,       icon: <Users className="w-4 h-4" /> },
              { label: "Sermons",       value: metrics.platform?.sermons ?? 0,       icon: <BookOpen className="w-4 h-4" /> },
              { label: "Conversations", value: metrics.platform?.conversations ?? 0, icon: <MessageSquare className="w-4 h-4" /> },
              { label: "Testimonies",   value: metrics.platform?.testimonies ?? 0,   icon: <CheckCircle className="w-4 h-4" /> },
              { label: "Blog Posts",    value: metrics.platform?.blogs ?? 0,         icon: <FileText className="w-4 h-4" /> },
              { label: "AI Feedback",   value: metrics.ai?.totalFeedback ?? 0,       icon: <Activity className="w-4 h-4" /> },
              { label: "Avg Rating",    value: metrics.ai?.averageRating ? `${metrics.ai.averageRating}/5` : "—", icon: <CheckCircle className="w-4 h-4" /> },
              { label: "Avg Latency",   value: metrics.ai?.averageLatencyMs ? `${metrics.ai.averageLatencyMs}ms` : "—", icon: <Zap className="w-4 h-4" /> },
            ].map(m => <MetricCard key={m.label} {...m} />)}
          </div>
        ) : null}

        <Card>
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-1"><Sparkles className="w-4 h-4 text-violet-400" /> AI Blog Generator</h3>
          <p className="text-xs text-muted-foreground mb-4">Generate a theologically rich article using AI, grounded in JCTM doctrine.</p>
          <div className="flex gap-3 flex-wrap items-end">
            <div className="flex-1 min-w-[180px]">
              <label className="text-xs text-muted-foreground mb-1 block">Topic</label>
              <select value={blogTopic} onChange={e => setBlogTopic(e.target.value)} className="w-full text-sm rounded-xl border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20">
                {BLOG_TOPICS.map(t => <option key={t} value={t}>{t.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</option>)}
              </select>
            </div>
            <button onClick={generateBlog} disabled={generating} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold disabled:opacity-50 transition-colors">
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {generating ? "Generating…" : "Generate Article"}
            </button>
          </div>
        </Card>
      </AdminLoginGate>
    </div>
  );
}

// ─── Credentials ──────────────────────────────────────────────────────────────

function CredentialsSection({
  galleryAuth, sermonAuth, livestreamAuth,
}: {
  galleryAuth: ReturnType<typeof useAdminAuth>;
  sermonAuth: ReturnType<typeof useAdminAuth>;
  livestreamAuth: ReturnType<typeof useAdminAuth>;
}) {
  const roles: { auth: ReturnType<typeof useAdminAuth>; label: string; description: string; color: string; dotColor: string }[] = [
    { auth: galleryAuth,    label: "Gallery",    description: "Manage and upload ministry photos",      color: "border-violet-500/30 bg-violet-500/5", dotColor: "bg-violet-500" },
    { auth: sermonAuth,     label: "Sermon",     description: "Manage YouTube sync and sermon library", color: "border-blue-500/30 bg-blue-500/5",     dotColor: "bg-blue-500" },
    { auth: livestreamAuth, label: "Livestream", description: "Control live broadcast and rebroadcast", color: "border-red-500/30 bg-red-500/5",       dotColor: "bg-red-500" },
  ];

  return (
    <div className="space-y-5">
      <SectionHeader title="Admin Credentials" description="Manage passphrase access for each admin role" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {roles.map(({ auth, label, description, color, dotColor }) => (
          <div key={label} className={`rounded-2xl border p-5 space-y-4 ${color}`}>
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${dotColor} ${auth.isAdmin ? "" : "opacity-30"}`} />
              <div>
                <p className="font-semibold text-sm">{label} Admin</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
              {auth.isAdmin && (
                <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-emerald-600">
                  <ShieldCheck className="w-3.5 h-3.5" /> Active
                </span>
              )}
            </div>
            <AdminLoginGate role={auth === galleryAuth ? "gallery" : auth === sermonAuth ? "sermon" : "livestream"} auth={auth}>
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-background/60 text-xs text-emerald-700 font-medium">
                  <CheckCircle className="w-3.5 h-3.5" /> Authenticated — session active
                </div>
                <ChangePassInline auth={auth} />
              </div>
            </AdminLoginGate>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground leading-relaxed">
        <KeyRound className="w-3.5 h-3.5 inline-block mr-1.5" />
        Passphrases are stored as scrypt hashes in the database and <strong className="text-foreground">persist across all deployments</strong> automatically — no environment variable management needed.
      </div>
    </div>
  );
}

function ChangePassInline({ auth }: { auth: ReturnType<typeof useAdminAuth> }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!current || !next || !confirm) return;
    setBusy(true);
    const ok = await auth.changePassphrase(current.trim(), next.trim(), confirm.trim());
    setBusy(false);
    if (ok) { setOpen(false); setCurrent(""); setNext(""); setConfirm(""); }
  };

  return (
    <div>
      <button onClick={() => setOpen(v => !v)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
        <KeyRound className="w-3 h-3" /> {open ? "Cancel" : "Change passphrase"}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="pt-3 space-y-2">
              {[{ v: current, s: setCurrent, p: "Current" }, { v: next, s: setNext, p: "New (min 8 chars)" }, { v: confirm, s: setConfirm, p: "Confirm new" }].map(({ v, s, p }) => (
                <input key={p} type="password" value={v} onChange={e => s(e.target.value)} placeholder={p} className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-accent/30" />
              ))}
              <button onClick={submit} disabled={busy || !current || !next || !confirm} className="w-full py-1.5 rounded-lg bg-accent text-white text-xs font-semibold disabled:opacity-50 transition-colors flex items-center justify-center gap-1">
                {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />} Update Passphrase
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Admin Page ───────────────────────────────────────────────────────────

export default function Admin() {
  const liveStatus = useLivestreamStatus();
  const galleryAuth    = useAdminAuth("gallery");
  const sermonAuth     = useAdminAuth("sermon");
  const livestreamAuth = useAdminAuth("livestream");

  const [section, setSection] = useState<Section>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isLive = liveStatus.isLive;
  const hasRebroadcast = liveStatus.rebroadcast.available;
  const broadcastStatus = isLive ? "live" : hasRebroadcast ? "rebroadcast" : "off";
  const broadcastLabel  = isLive ? "LIVE NOW" : hasRebroadcast ? "REBROADCAST" : "OFF AIR";

  const authenticated = [galleryAuth, sermonAuth, livestreamAuth].filter(a => a.isAdmin).length;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">

      {/* ── Top Bar ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(v => !v)} className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <Menu className="w-4 h-4" />
            </button>
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Settings className="w-4 h-4 text-primary" />
            </div>
            <div className="hidden sm:block">
              <h1 className="font-bold text-sm leading-none">Admin Dashboard</h1>
              <p className="text-[11px] text-muted-foreground mt-0.5">JCTM Platform Control</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {authenticated > 0 && (
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> {authenticated}/3 active
              </span>
            )}
            <StatusPill label={broadcastLabel} status={broadcastStatus} />
          </div>
        </div>
      </header>

      <div className="flex flex-1 container mx-auto px-4 py-6 gap-6 max-w-6xl">

        {/* ── Sidebar (desktop) ─────────────────────────────────────────── */}
        <aside className="hidden lg:block w-52 shrink-0">
          <nav className="sticky top-24 space-y-1">
            {NAV.map(({ id, label, icon }) => {
              const isActive = section === id;
              const hasAuth = id === "broadcast" ? livestreamAuth.isAdmin
                : id === "sermons"  ? sermonAuth.isAdmin
                : id === "gallery"  ? galleryAuth.isAdmin
                : false;
              return (
                <button key={id} onClick={() => setSection(id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>
                  {icon}
                  {label}
                  {hasAuth && !isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* ── Mobile sidebar drawer ─────────────────────────────────────── */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-black/40 z-40 lg:hidden" />
              <motion.aside initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }} className="fixed left-0 top-0 bottom-0 w-64 bg-card border-r border-border z-50 p-5 lg:hidden">
                <div className="flex items-center gap-2 mb-6">
                  <Settings className="w-5 h-5 text-primary" />
                  <span className="font-bold text-base">Admin Dashboard</span>
                </div>
                <nav className="space-y-1">
                  {NAV.map(({ id, label, icon }) => (
                    <button key={id} onClick={() => { setSection(id); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${section === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>
                      {icon} {label}
                    </button>
                  ))}
                </nav>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* ── Main content ──────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0">
          {/* Mobile tab scroll */}
          <div className="flex gap-1 overflow-x-auto pb-3 mb-5 lg:hidden scrollbar-hide">
            {NAV.map(({ id, label }) => (
              <button key={id} onClick={() => setSection(id)} className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${section === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground bg-muted"}`}>
                {label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={section} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>
              {section === "overview"    && <OverviewSection liveStatus={liveStatus} adminAuth={livestreamAuth} />}
              {section === "broadcast"   && <BroadcastSection liveStatus={liveStatus} auth={livestreamAuth} />}
              {section === "events"      && <EventPromotionsSection auth={livestreamAuth} />}
              {section === "sermons"     && <SermonsSection auth={sermonAuth} />}
              {section === "gallery"     && <GallerySection auth={galleryAuth} />}
              {section === "testimonies" && <TestimoniesSection auth={sermonAuth} />}
              {section === "platform"    && <PlatformSection auth={sermonAuth} />}
              {section === "credentials" && <CredentialsSection galleryAuth={galleryAuth} sermonAuth={sermonAuth} livestreamAuth={livestreamAuth} />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

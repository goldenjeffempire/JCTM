import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Radio, Tv2, RefreshCw, CheckCircle, AlertCircle, Clock,
  BarChart3, Zap, Calendar, PlayCircle, Settings, Activity,
  ChevronRight, Eye, Users, MessageSquare, Check, Trash2, Download, Pin, PinOff,
  BookOpen, Sparkles, X, Loader2, ShieldCheck, Wifi,
  Power, Repeat2, LayoutDashboard, Image, FileText,
  Shield, Menu, KeyRound, ImageOff, Bell, Send,
  TrendingUp, Globe, Monitor, Smartphone, Tablet, Signal,
  Megaphone, MapPin, Save, Plus, Edit3, Mail,
  Bot, Database, Cpu, Server, Layers,
  DollarSign, ExternalLink, Info, Hash, CircleDot,
} from "lucide-react";
import { useLivestreamStatus } from "@/hooks/useLivestreamStatus";
import { useListGalleryImages } from "@workspace/api-client-react";
import { toast } from "sonner";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { AdminLoginGate, AdminBadge } from "@/components/admin/AdminLoginGate";
import { EventPromotionPreview } from "@/components/event-promo/EventPromotionPreview";
import { WarriCrusadeStatsTile } from "@/components/admin/WarriCrusadeStatsTile";
import { GenericBroadcastTile } from "@/components/admin/GenericBroadcastTile";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Bar, BarChart, ComposedChart, ResponsiveContainer,
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

type Section = "overview" | "broadcast" | "events" | "sermons" | "gallery" | "testimonies" | "platform" | "analytics" | "ai" | "ads" | "credentials" | "email" | "knowledge" | "downloads";

const NAV: { id: Section; label: string; icon: React.ReactNode; badge?: string }[] = [
  { id: "overview",     label: "Overview",     icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: "broadcast",    label: "Broadcast",    icon: <Radio className="w-4 h-4" /> },
  { id: "events",       label: "Events",       icon: <Megaphone className="w-4 h-4" /> },
  { id: "sermons",      label: "Sermons",      icon: <BookOpen className="w-4 h-4" /> },
  { id: "gallery",      label: "Gallery",      icon: <Image className="w-4 h-4" /> },
  { id: "testimonies",  label: "Testimonies",  icon: <MessageSquare className="w-4 h-4" /> },
  { id: "platform",     label: "Platform",     icon: <BarChart3 className="w-4 h-4" /> },
  { id: "analytics",    label: "Analytics",    icon: <TrendingUp className="w-4 h-4" /> },
  { id: "ai",           label: "AI Engine",    icon: <Bot className="w-4 h-4" /> },
  { id: "ads",          label: "AdSense",      icon: <DollarSign className="w-4 h-4" /> },
  { id: "credentials",  label: "Credentials",  icon: <Shield className="w-4 h-4" /> },
  { id: "email",        label: "Email",        icon: <Mail className="w-4 h-4" /> },
  { id: "knowledge",    label: "AI Knowledge", icon: <Database className="w-4 h-4" /> },
  { id: "downloads",    label: "Downloads",    icon: <Download className="w-4 h-4" /> },
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

  const { data: expoStats, refetch: refetchExpo } = useQuery<{
    tokens: { total: number; breakdown: { platform: string; count: string }[] };
    receipts: { last7Days: Record<string, number>; deliveryRate: number | null };
  }>({
    queryKey: ["expo-stats"],
    queryFn: () => fetch(`${BASE}/api/push/expo-stats`).then(r => r.json()),
    refetchInterval: 30_000,
  });

  const [expoSending, setExpoSending] = useState(false);

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
  const [sending, setSending] = useState<"service" | "live" | "reminder" | "custom" | null>(null);
  const [reminderMinutes, setReminderMinutes] = useState<15 | 30 | 60>(15);

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

  const sendLiveNowAlert = async () => {
    setSending("live");
    try {
      const res = await fetch(`${BASE}/api/push/live-now`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`"Live Now" alert sent to ${data.sent ?? data.subscribers ?? 0} subscribers`);
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

  const sendReminderAlert = async () => {
    setSending("reminder");
    try {
      const res = await fetch(`${BASE}/api/push/service-reminder`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ minutesBefore: reminderMinutes }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`"Live in ${reminderMinutes} min" reminder sent to ${data.sent ?? data.subscribers ?? 0} subscribers`);
        refetch();
        refetchLog();
      } else {
        toast.error(data.error ?? "Failed to send");
      }
    } catch {
      toast.error("Network error — could not send reminder");
    } finally {
      setSending(null);
    }
  };

  const sendExpoTest = async () => {
    setExpoSending(true);
    try {
      const res = await fetch(`${BASE}/api/push/expo-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
      });
      const data = await res.json();
      if (data.success) {
        if (data.sent === 0) {
          toast.info(data.message ?? "No active Expo devices registered yet");
        } else {
          toast.success(`Test push sent to ${data.sent} mobile device${data.sent !== 1 ? "s" : ""}`);
        }
        refetchExpo();
      } else {
        toast.error(data.error ?? "Failed to send Expo test push");
      }
    } catch {
      toast.error("Network error — could not send test push");
    } finally {
      setExpoSending(false);
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
            <p className="text-xs text-muted-foreground mb-2 font-medium">Service Alert (Warri Crusade Day 2)</p>
            <div className="space-y-2">
              <button
                onClick={sendServiceAlert}
                disabled={sending !== null}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 py-2.5 text-sm font-semibold text-amber-400 transition-colors hover:bg-amber-500/20 disabled:opacity-50 cursor-pointer"
              >
                {sending === "service" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                Send "Begins Soon" Alert Now
              </button>

              <button
                onClick={sendLiveNowAlert}
                disabled={sending !== null}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 py-2.5 text-sm font-semibold text-rose-400 transition-colors hover:bg-rose-500/20 disabled:opacity-50 cursor-pointer"
              >
                {sending === "live" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
                Send "Live Now" Alert
              </button>

              {/* Reminder pill — choose minutes-before, then send */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/40 p-1">
                  {([15, 30, 60] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setReminderMinutes(m)}
                      disabled={sending !== null}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50 ${
                        reminderMinutes === m
                          ? "bg-primary/20 text-primary border border-primary/30"
                          : "text-muted-foreground hover:text-primary"
                      }`}
                    >
                      {m}m
                    </button>
                  ))}
                </div>
                <button
                  onClick={sendReminderAlert}
                  disabled={sending !== null}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-sky-500/40 bg-sky-500/10 py-2.5 text-sm font-semibold text-sky-400 transition-colors hover:bg-sky-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {sending === "reminder" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                  Send "Live in {reminderMinutes} min" Reminder
                </button>
              </div>
            </div>
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

          {/* ── Expo Mobile Push ────────────────────────────────────────── */}
          <div className="pt-1">
            <div className="flex items-center gap-2 mb-3">
              <Smartphone className="w-3.5 h-3.5 text-blue-400" />
              <p className="text-xs font-semibold text-blue-400">Expo Mobile Push</p>
            </div>

            {/* Stats chips */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-center">
                <p className="text-lg font-bold text-blue-400">{expoStats?.tokens.total ?? "—"}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Active Devices</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-center">
                {expoStats?.receipts.deliveryRate != null ? (
                  <p className={`text-lg font-bold ${expoStats.receipts.deliveryRate >= 90 ? "text-emerald-400" : expoStats.receipts.deliveryRate >= 70 ? "text-amber-400" : "text-red-400"}`}>
                    {expoStats.receipts.deliveryRate}%
                  </p>
                ) : (
                  <p className="text-lg font-bold text-muted-foreground">—</p>
                )}
                <p className="text-[10px] text-muted-foreground mt-0.5">7d Delivery</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-center">
                <p className="text-lg font-bold text-muted-foreground">
                  {expoStats?.receipts.last7Days.pending ?? "—"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Pending</p>
              </div>
            </div>

            {/* Platform breakdown */}
            {(expoStats?.tokens.breakdown ?? []).length > 0 && (
              <div className="flex gap-2 mb-3 flex-wrap">
                {(expoStats!.tokens.breakdown).map(row => (
                  <span
                    key={row.platform}
                    className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 text-[11px] font-semibold text-blue-400"
                  >
                    {row.platform === "ios" ? "🍎" : row.platform === "android" ? "🤖" : "📱"}
                    {row.platform} · {row.count}
                  </span>
                ))}
              </div>
            )}

            {/* Send test push button */}
            <button
              onClick={sendExpoTest}
              disabled={expoSending}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 py-2.5 text-sm font-semibold text-blue-400 transition-colors hover:bg-blue-500/20 disabled:opacity-50 cursor-pointer"
            >
              {expoSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Signal className="w-4 h-4" />}
              Send Test Push to All Devices
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

// Accepts a raw 11-char YouTube ID or any common YouTube URL
// (watch?v=, youtu.be/, /live/, /shorts/, /embed/) and returns just the ID.
function extractYouTubeId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  // Already looks like a bare video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  // Try URL parsing first
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      const v = url.searchParams.get("v");
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
      const parts = url.pathname.split("/").filter(Boolean);
      // /live/<id>, /shorts/<id>, /embed/<id>
      const idx = parts.findIndex(p => p === "live" || p === "shorts" || p === "embed");
      if (idx !== -1 && parts[idx + 1] && /^[a-zA-Z0-9_-]{11}$/.test(parts[idx + 1]!)) {
        return parts[idx + 1]!;
      }
    }
  } catch {
    // fall through to regex fallback
  }
  // Regex fallback for messy strings
  const m = trimmed.match(/(?:v=|youtu\.be\/|\/live\/|\/shorts\/|\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m && m[1] ? m[1] : trimmed;
}

function BroadcastSection({ liveStatus, auth }: { liveStatus: ReturnType<typeof useLivestreamStatus>; auth: ReturnType<typeof useAdminAuth> }) {
  const qc = useQueryClient();
  const [videoInput, setVideoInput] = useState("");
  const videoId = extractYouTubeId(videoInput);
  const looksLikeUrl = /^https?:\/\//i.test(videoInput.trim()) || /youtu/i.test(videoInput.trim());
  const idResolved = /^[a-zA-Z0-9_-]{11}$/.test(videoId);
  const [validation, setValidation] = useState<VideoValidation | null>(null);
  const [validating, setValidating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [showUploads, setShowUploads] = useState(false);
  const [sendAlertOnGoLive, setSendAlertOnGoLive] = useState(true);
  const validateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const authHeader = { Authorization: `Bearer ${auth.adminToken}` };

  const isOverrideActive = liveStatus.manualOverride.live || liveStatus.manualOverride.rebroadcast;

  // Debounced validation on input — accepts a video ID or full YouTube URL
  const handleVideoIdChange = (val: string) => {
    setVideoInput(val);
    setValidation(null);
    if (validateTimerRef.current) clearTimeout(validateTimerRef.current);
    const id = extractYouTubeId(val);
    if (!id || !/^[a-zA-Z0-9_-]{11}$/.test(id)) return;
    validateTimerRef.current = setTimeout(() => { validateVideo(id); }, 600);
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
    const id = videoId;
    if (!id || !idResolved) return;
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

      // Auto-fire the Crusade LIVE alert if opted in
      if (sendAlertOnGoLive) {
        fetch(`${BASE}/api/admin/warri-crusade/live-alert`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader },
        })
          .then(r => r.json())
          .then((data: { success?: boolean; skipped?: boolean; reason?: string; total?: number; web?: { sent: number }; expo?: { sent: number } }) => {
            if (data.skipped) {
              // Campaign ended or cooldown — skip silently (no toast needed)
              return;
            }
            if (data.success) {
              toast.success(
                `🔔 LIVE alert sent to ${data.total?.toLocaleString() ?? 0} subscribers`,
                { description: `Web: ${data.web?.sent ?? 0} · Mobile: ${data.expo?.sent ?? 0}`, duration: 5000 },
              );
            }
          })
          .catch(() => {
            // Non-fatal — stream is live even if the alert fails
          });
      }
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
    const id = vid ?? (idResolved ? videoId : "");
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

      {/* Instant push broadcast — generic one-off notification */}
      <GenericBroadcastTile adminToken={auth.adminToken} />

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

          {/* YouTube Link / Video ID Input + Validator */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary" /> YouTube Link or Video ID
              </h3>
              <AdminBadge role="livestream" auth={auth} />
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  value={videoInput}
                  onChange={e => handleVideoIdChange(e.target.value)}
                  placeholder="Paste YouTube link (e.g. https://youtu.be/abc123XYZ_-) or video ID"
                  className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
                />
                <button
                  onClick={() => idResolved && validateVideo(videoId)}
                  disabled={!idResolved || validating}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 text-primary border border-primary/20 text-xs font-semibold hover:bg-primary/20 disabled:opacity-50 transition-colors"
                >
                  {validating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  Validate
                </button>
              </div>

              {/* Show extracted ID when admin pastes a full URL */}
              {looksLikeUrl && idResolved && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle className="w-3 h-3 text-emerald-500" />
                  Detected video ID: <span className="font-mono text-foreground">{videoId}</span>
                </p>
              )}
              {videoInput.trim() && !idResolved && (
                <p className="text-[11px] text-amber-400 flex items-center gap-1.5">
                  <AlertCircle className="w-3 h-3" />
                  Could not detect a YouTube video ID — paste a full link or an 11-character ID.
                </p>
              )}

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

            {validation && !validation.isLive && validation.valid && idResolved && (
              <div className="mb-3 flex items-start gap-2 p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 text-xs text-amber-400">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>This video is not currently live. You can still force it as live, or use it for rebroadcast below.</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                onClick={goLive}
                disabled={!!busy || !idResolved || (!!validation && !validation.valid)}
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

            {/* Auto LIVE alert toggle */}
            <label className="flex items-center gap-2.5 mt-3 cursor-pointer group w-fit select-none">
              <div
                onClick={() => setSendAlertOnGoLive(v => !v)}
                className={`relative w-8 h-4.5 rounded-full transition-colors duration-200 border ${
                  sendAlertOnGoLive
                    ? "bg-red-500/20 border-red-500/40"
                    : "bg-muted border-border"
                }`}
                role="switch"
                aria-checked={sendAlertOnGoLive}
              >
                <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full shadow transition-all duration-200 ${
                  sendAlertOnGoLive ? "translate-x-3.5 bg-red-500" : "translate-x-0 bg-muted-foreground/50"
                }`} />
              </div>
              <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors leading-tight">
                Auto-send <span className="font-semibold text-red-400">🔴 LIVE alert</span> to all subscribers when going live
              </span>
            </label>

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
                onClick={() => setRebroadcast(idResolved ? videoId : undefined)}
                disabled={!!busy}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors"
              >
                {busy === "rebroadcast" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Repeat2 className="h-3.5 w-3.5" />}
                {idResolved ? "Set This Video" : "Auto-Select Latest"}
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

      <HomeVideosCard auth={auth} />

    </div>
  );
}

// ─── Home Videos Card ─────────────────────────────────────────────────────────

function HomeVideosCard({ auth }: { auth: ReturnType<typeof useAdminAuth> }) {
  const authHeader = { Authorization: `Bearer ${auth.adminToken}` };
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ highlightVideoId: string | null; broadcastVideoId: string | null }>({
    queryKey: ["home-videos"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/home-videos`);
      return res.json();
    },
    staleTime: 15_000,
  });

  const [highlightInput, setHighlightInput] = useState("");
  const [broadcastInput, setBroadcastInput] = useState("");
  const [savingHighlight, setSavingHighlight] = useState(false);
  const [savingBroadcast, setSavingBroadcast] = useState(false);

  const YT_RE = /^[A-Za-z0-9_-]{5,20}$/;

  const saveHighlight = async () => {
    const id = highlightInput.trim();
    if (!YT_RE.test(id)) { toast.error("Enter a valid YouTube video ID (e.g. 1GEdYA4f0-k)"); return; }
    setSavingHighlight(true);
    try {
      const res = await fetch(`${BASE}/api/admin/home-videos/highlight`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ videoId: id }),
      });
      if (!res.ok) { if (res.status === 401) auth.logout(); const d = await res.json().catch(() => ({})) as { error?: string }; toast.error(d?.error ?? "Failed to save"); return; }
      toast.success("Today's Highlight video updated");
      setHighlightInput("");
      qc.invalidateQueries({ queryKey: ["home-videos"] });
    } finally { setSavingHighlight(false); }
  };

  const clearHighlight = async () => {
    setSavingHighlight(true);
    try {
      await fetch(`${BASE}/api/admin/home-videos/highlight`, { method: "DELETE", headers: authHeader });
      toast.success("Highlight override cleared — featured sermon will show");
      qc.invalidateQueries({ queryKey: ["home-videos"] });
    } finally { setSavingHighlight(false); }
  };

  const saveBroadcast = async () => {
    const id = broadcastInput.trim();
    if (!YT_RE.test(id)) { toast.error("Enter a valid YouTube video ID (e.g. 1GEdYA4f0-k)"); return; }
    setSavingBroadcast(true);
    try {
      const res = await fetch(`${BASE}/api/admin/home-videos/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ videoId: id }),
      });
      if (!res.ok) { if (res.status === 401) auth.logout(); const d = await res.json().catch(() => ({})) as { error?: string }; toast.error(d?.error ?? "Failed to save"); return; }
      toast.success("Latest Broadcast video updated");
      setBroadcastInput("");
      qc.invalidateQueries({ queryKey: ["home-videos"] });
    } finally { setSavingBroadcast(false); }
  };

  const clearBroadcast = async () => {
    setSavingBroadcast(true);
    try {
      await fetch(`${BASE}/api/admin/home-videos/broadcast`, { method: "DELETE", headers: authHeader });
      toast.success("Broadcast override cleared — featured sermon will show");
      qc.invalidateQueries({ queryKey: ["home-videos"] });
    } finally { setSavingBroadcast(false); }
  };

  return (
    <AdminLoginGate role="sermon" auth={auth} title="Home Page Videos">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Tv2 className="w-4 h-4 text-primary" /> Home Page Videos
          </h3>
          <AdminBadge role="sermon" auth={auth} />
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Override the YouTube video shown in <strong>Today's Highlights</strong> and <strong>Latest Broadcast</strong> on the home page.
          Leave blank to auto-show the featured sermon.
        </p>

        {isLoading ? (
          <div className="space-y-3"><div className="h-8 rounded-lg bg-muted animate-pulse" /><div className="h-8 rounded-lg bg-muted animate-pulse" /></div>
        ) : (
          <div className="space-y-4">
            {/* Today's Highlight */}
            <div className="rounded-xl border border-border p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-foreground">Today's Highlights</p>
                {data?.highlightVideoId ? (
                  <span className="flex items-center gap-1.5 text-[10px] bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active: {data.highlightVideoId}
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Auto (featured sermon)</span>
                )}
              </div>
              {data?.highlightVideoId && (
                <div className="mb-2 rounded-lg overflow-hidden border border-border" style={{ aspectRatio: "16/9", maxWidth: 240 }}>
                  <img
                    src={`https://i.ytimg.com/vi/${data.highlightVideoId}/mqdefault.jpg`}
                    alt="Current highlight"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="flex gap-2 mt-1">
                <input
                  type="text"
                  value={highlightInput}
                  onChange={e => setHighlightInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && saveHighlight()}
                  placeholder="YouTube video ID (e.g. 1GEdYA4f0-k)"
                  className="flex-1 h-8 rounded-lg border border-border bg-background px-3 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={saveHighlight}
                  disabled={savingHighlight || !highlightInput.trim()}
                  className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {savingHighlight ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Set
                </button>
                {data?.highlightVideoId && (
                  <button
                    onClick={clearHighlight}
                    disabled={savingHighlight}
                    className="h-8 px-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-destructive hover:border-destructive/40 disabled:opacity-50 transition-colors"
                    title="Clear override"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Latest Broadcast */}
            <div className="rounded-xl border border-border p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-foreground">Latest Broadcast</p>
                {data?.broadcastVideoId ? (
                  <span className="flex items-center gap-1.5 text-[10px] bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded-full font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    Active: {data.broadcastVideoId}
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Auto (featured sermon)</span>
                )}
              </div>
              {data?.broadcastVideoId && (
                <div className="mb-2 rounded-lg overflow-hidden border border-border" style={{ aspectRatio: "16/9", maxWidth: 240 }}>
                  <img
                    src={`https://i.ytimg.com/vi/${data.broadcastVideoId}/mqdefault.jpg`}
                    alt="Current broadcast"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="flex gap-2 mt-1">
                <input
                  type="text"
                  value={broadcastInput}
                  onChange={e => setBroadcastInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && saveBroadcast()}
                  placeholder="YouTube video ID (e.g. 1GEdYA4f0-k)"
                  className="flex-1 h-8 rounded-lg border border-border bg-background px-3 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={saveBroadcast}
                  disabled={savingBroadcast || !broadcastInput.trim()}
                  className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {savingBroadcast ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Set
                </button>
                {data?.broadcastVideoId && (
                  <button
                    onClick={clearBroadcast}
                    disabled={savingBroadcast}
                    className="h-8 px-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-destructive hover:border-destructive/40 disabled:opacity-50 transition-colors"
                    title="Clear override"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>
    </AdminLoginGate>
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

type BroadcastCadence = "half_hourly" | "hourly" | "daily" | "custom";

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
  broadcastEnabled: boolean;
  broadcastCadence: BroadcastCadence;
  broadcastIntervalMinutes: number | null;
  broadcastMessages: string[];
  broadcastTitleOverride: string | null;
  broadcastImageUrl: string | null;
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
  broadcastEnabled: boolean;
  broadcastCadence: BroadcastCadence;
  broadcastIntervalMinutes: string;
  broadcastMessagesText: string;
  broadcastTitleOverride: string;
  broadcastImageUrl: string;
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
  broadcastEnabled: false,
  broadcastCadence: "half_hourly",
  broadcastIntervalMinutes: "",
  broadcastMessagesText: "",
  broadcastTitleOverride: "",
  broadcastImageUrl: "",
};

const CADENCE_LABELS: Record<BroadcastCadence, string> = {
  half_hourly: "Every 30 minutes (:00 and :30 UTC)",
  hourly: "Hourly (top of each UTC hour)",
  daily: "Daily (00:00 UTC)",
  custom: "Custom interval (5 – 1440 minutes)",
};

function describeBroadcast(p: AdminEventPromotion): string {
  if (!p.broadcastEnabled) return "Broadcast off";
  if (p.broadcastCadence === "custom") {
    const n = p.broadcastIntervalMinutes ?? 30;
    return `Broadcast every ${n} min`;
  }
  return CADENCE_LABELS[p.broadcastCadence].split(" (")[0]!;
}

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
      const broadcastMessages = payload.broadcastMessagesText
        .split(/\r?\n/)
        .map(s => s.trim())
        .filter(Boolean);
      const intervalNum = Number.parseInt(payload.broadcastIntervalMinutes, 10);
      const broadcastIntervalMinutes =
        payload.broadcastCadence === "custom" && Number.isFinite(intervalNum)
          ? intervalNum
          : null;
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
        broadcastEnabled: payload.broadcastEnabled,
        broadcastCadence: payload.broadcastCadence,
        broadcastIntervalMinutes,
        broadcastMessages,
        broadcastTitleOverride: payload.broadcastTitleOverride.trim() || null,
        broadcastImageUrl: payload.broadcastImageUrl.trim() || null,
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

  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE}/api/admin/event-promotions/seed-ministers-conference`, {
        method: "POST",
        headers: authHeader,
      });
      if (res.status === 401) auth.logout();
      return readApiJson<{ promotion: AdminEventPromotion; alreadyExists: boolean }>(res, "Failed to import Ministers Conference");
    },
    onSuccess: (result) => {
      if (result.alreadyExists) {
        toast.info("Ministers Conference is already in the database");
      } else {
        toast.success("Ministers Conference imported — edit artwork, dates, and CTA below");
      }
      qc.invalidateQueries({ queryKey: ["admin-event-promotions"] });
      qc.invalidateQueries({ queryKey: ["event-promotions", "active"] });
    },
    onError: (error) => toast.error(formatAdminError(error, "Import failed")),
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
      broadcastEnabled: p.broadcastEnabled,
      broadcastCadence: p.broadcastCadence,
      broadcastIntervalMinutes: p.broadcastIntervalMinutes != null ? String(p.broadcastIntervalMinutes) : "",
      broadcastMessagesText: (p.broadcastMessages ?? []).join("\n"),
      broadcastTitleOverride: p.broadcastTitleOverride ?? "",
      broadcastImageUrl: p.broadcastImageUrl ?? "",
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

        {/* ── Ministers Conference callout — visible when not yet in DB ─────── */}
        {!isLoading && data !== undefined && !promotions.some(p => p.slug === "ministers-conference-2026") && (
          <div className="rounded-2xl border border-amber-400/40 bg-amber-400/5 p-4">
            <div className="flex items-start gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Ministers Conference 2026 — running from built-in fallback
                </h4>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  The conference banner is currently driven by hardcoded data. Import it into the database to manage the artwork, event dates, and CTA button from this dashboard — no code changes required. After importing you can edit it like any other promotion.
                </p>
              </div>
              <button
                type="button"
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs bg-amber-500 text-white hover:bg-amber-600 font-semibold transition-colors disabled:opacity-60"
              >
                {seedMutation.isPending
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Importing…</>
                  : <><Download className="w-3.5 h-3.5" /> Import to database</>}
              </button>
            </div>
          </div>
        )}

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

              {/* ── Broadcast Cadence — recurring push/SSE notifications ─────── */}
              <div className="pt-3 border-t border-border space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Megaphone className="w-4 h-4 text-primary" />
                      Broadcast Cadence
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Automatically push reminders to all subscribers on a schedule until the event ends. Each broadcast goes to web push, mobile push, and the in-app live banner.
                    </p>
                  </div>
                  <ChannelToggle
                    label={form.broadcastEnabled ? "Enabled" : "Disabled"}
                    value={form.broadcastEnabled}
                    onChange={v => setForm({ ...form, broadcastEnabled: v })}
                  />
                </div>

                {form.broadcastEnabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <Field label="Cadence">
                      <select
                        value={form.broadcastCadence}
                        onChange={e => setForm({ ...form, broadcastCadence: e.target.value as BroadcastCadence })}
                        className="w-full rounded-lg bg-muted border border-border px-3 py-2 text-sm"
                        data-testid="event-promo-broadcast-cadence"
                      >
                        <option value="half_hourly">{CADENCE_LABELS.half_hourly}</option>
                        <option value="hourly">{CADENCE_LABELS.hourly}</option>
                        <option value="daily">{CADENCE_LABELS.daily}</option>
                        <option value="custom">{CADENCE_LABELS.custom}</option>
                      </select>
                    </Field>
                    {form.broadcastCadence === "custom" && (
                      <Field label="Interval (minutes, 5–1440)">
                        <input
                          type="number"
                          min={5}
                          max={1440}
                          value={form.broadcastIntervalMinutes}
                          onChange={e => setForm({ ...form, broadcastIntervalMinutes: e.target.value })}
                          placeholder="e.g. 90"
                          className="w-full rounded-lg bg-muted border border-border px-3 py-2 text-sm"
                          data-testid="event-promo-broadcast-interval"
                        />
                      </Field>
                    )}
                    <Field label="Notification title (optional override)" className={form.broadcastCadence === "custom" ? "" : "sm:col-span-1"}>
                      <input
                        value={form.broadcastTitleOverride}
                        onChange={e => setForm({ ...form, broadcastTitleOverride: e.target.value })}
                        placeholder={form.title || "Defaults to the promotion title"}
                        className="w-full rounded-lg bg-muted border border-border px-3 py-2 text-sm"
                      />
                    </Field>
                    <Field label="Notification image URL (optional)" className="sm:col-span-2">
                      <input
                        value={form.broadcastImageUrl}
                        onChange={e => setForm({ ...form, broadcastImageUrl: e.target.value })}
                        placeholder={form.artworkUrl || "Defaults to the promotion artwork"}
                        className="w-full rounded-lg bg-muted border border-border px-3 py-2 text-sm"
                      />
                    </Field>
                    <Field label="Rotating message bodies (one per line, max 24)" className="sm:col-span-2">
                      <textarea
                        value={form.broadcastMessagesText}
                        onChange={e => setForm({ ...form, broadcastMessagesText: e.target.value })}
                        rows={5}
                        placeholder={"🔥 Don't miss this — join us today!\n⚡ Be part of something powerful — happening now\n🙏 Mark your calendar — this is going to be special"}
                        className="w-full rounded-lg bg-muted border border-border px-3 py-2 text-sm font-mono leading-relaxed"
                        data-testid="event-promo-broadcast-messages"
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Bodies rotate deterministically by slot. Leave empty to fall back to the subtitle (or the title if no subtitle is set).
                      </p>
                    </Field>
                  </div>
                )}
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

// ─── Event Notification Scheduler — multi-channel reminder dispatch ──────────

type NotifChannel = "push" | "email" | "sse";
type NotifStatus = "pending" | "sent" | "failed" | "skipped";

interface DispatchLogRow {
  id: number;
  eventId: number;
  eventTitle: string;
  milestoneHours: number;
  channel: NotifChannel;
  status: NotifStatus;
  attempts: number;
  recipientCount: number;
  successCount: number;
  failureCount: number;
  lastError: string | null;
  firstAttemptAt: string | null;
  lastAttemptAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface NotifStats {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  skipped: number;
  totalRecipients: number;
  totalSuccessSends: number;
  totalFailureSends: number;
  activeSubscribers: number;
  successRate: number;
  lastTickStartedAt: string | null;
  lastTickFinishedAt: string | null;
  lastTickResult: {
    eventsScanned: number;
    targetsFound?: number;
    jobsEnqueued?: number;
    dispatchesAttempted?: number;
    dispatchesSucceeded?: number;
    dispatchesFailed?: number;
    durationMs: number;
  } | null;
  isRunning: boolean;
  intervalMs: number;
  nextTickAt: string | null;
  emailDeliveryEnabled: boolean;
  queue: {
    pending: number;
    processing: number;
    completed: number;
    dead: number;
    oldestPendingAt: string | null;
    nextScheduledAt: string | null;
    deadLetterUnresolved: number;
    successRate: number;
  };
  worker: {
    isRunning: boolean;
    startedAt: string | null;
    lastTickAt: string | null;
    lastTickClaimed: number;
    lastTickCompleted: number;
    lastTickRetried: number;
    lastTickDeadLettered: number;
    totalProcessed: number;
    totalCompleted: number;
    totalRetried: number;
    totalDeadLettered: number;
    pollIntervalMs: number;
  };
}

interface DeadLetterRow {
  id: number;
  queueId: number | null;
  eventId: number;
  eventTitle: string;
  bucketKey: string;
  milestoneHours: number;
  channel: NotifChannel;
  kind: "milestone" | "pulse" | "live_pulse";
  leadLabel: string;
  attempts: number;
  lastError: string | null;
  firstFailedAt: string | null;
  movedAt: string;
  resolvedAt: string | null;
  resolution: string | null;
}

interface NotifHealth {
  overallHealthy: boolean;
  checkedAt: string;
  push: {
    vapid: {
      configured: boolean;
      initialized: boolean;
      publicKeyFingerprint: string | null;
      error?: string;
    };
    expo: {
      reachable: boolean;
      accessTokenConfigured: boolean;
      error?: string;
    };
    webSubscribers: {
      active: number;
      inactive: number;
      failing?: number;
      neverDelivered?: number;
    };
    expoTokens: { active: number; inactive: number };
    recentDispatch?: {
      sent: number;
      failed: number;
      deactivated: number;
      deliveryRate: number;
      dispatches: number;
    };
  };
  email: {
    configured: boolean;
    host: string | null;
    port: number;
    secure: boolean;
    from: string | null;
    replyTo: string | null;
    poolMax: number;
    rateLimit: number;
    lastVerifyAt: string | null;
    lastVerifyOk: boolean | null;
    lastVerifyError: string | null;
    lastSendAt: string | null;
    lastSendOk: boolean | null;
    lastSendError: string | null;
    totalSent: number;
    totalFailed: number;
    totalRetried: number;
  };
}

interface UpcomingMilestoneSummary {
  hours: number;
  dueAt: string;
  isPast: boolean;
  channels: Record<
    NotifChannel,
    { id: number; status: NotifStatus; attempts: number; successCount: number; failureCount: number; lastError: string | null } | null
  >;
}

interface UpcomingEventConfig {
  enabled: boolean;
  paused: boolean;
  pausedUntil: string | null;
  milestonesHours: number[];
  pulseMinutes: number | null;
  pulseWindowHours: number | null;
}

interface UpcomingPulseChannelStatus {
  status: NotifStatus;
  bucketKey: string;
  sent: number;
  failed: number;
}

interface UpcomingPulseSummary {
  lastSlotIso: string | null;
  totalPulseRows: number;
  sentPulseRows: number;
  lastByChannel: {
    push: UpcomingPulseChannelStatus | null;
    email: UpcomingPulseChannelStatus | null;
    sse: UpcomingPulseChannelStatus | null;
  };
}

interface UpcomingEventSummary {
  id: number;
  title: string;
  location: string | null;
  startDate: string;
  endDate: string | null;
  eventType: string;
  milestones: UpcomingMilestoneSummary[];
  config: UpcomingEventConfig;
  pulse: UpcomingPulseSummary;
}

const CHANNEL_LABEL: Record<NotifChannel, string> = {
  push: "Push",
  email: "Email",
  sse: "Live banner",
};

function statusBadgeClasses(status: NotifStatus): string {
  if (status === "sent") return "bg-emerald-100 text-emerald-700 border border-emerald-200";
  if (status === "failed") return "bg-rose-100 text-rose-700 border border-rose-200";
  if (status === "pending") return "bg-amber-100 text-amber-700 border border-amber-200";
  return "bg-slate-100 text-slate-600 border border-slate-200";
}

function channelBadgeClasses(channel: NotifChannel): string {
  if (channel === "push") return "bg-sky-50 text-sky-700 border border-sky-200";
  if (channel === "email") return "bg-violet-50 text-violet-700 border border-violet-200";
  return "bg-slate-50 text-slate-700 border border-slate-200";
}

function EventConfigForm({
  ev,
  onSubmit,
  isPending,
}: {
  ev: UpcomingEventSummary;
  onSubmit: (patch: { enabled?: boolean; milestonesHours?: number[] | null; pulseMinutes?: number | null; pulseWindowHours?: number | null; pausedUntil?: string | null }) => void;
  isPending: boolean;
}) {
  const [enabled, setEnabled] = useState(ev.config.enabled);
  const [milestonesText, setMilestonesText] = useState(ev.config.milestonesHours.join(", "));
  const [pulseMinutes, setPulseMinutes] = useState<string>(ev.config.pulseMinutes?.toString() ?? "");
  const [pulseWindowHours, setPulseWindowHours] = useState<string>(ev.config.pulseWindowHours?.toString() ?? "");
  const [pausedUntilLocal, setPausedUntilLocal] = useState<string>(() => {
    if (!ev.config.pausedUntil) return "";
    const d = new Date(ev.config.pausedUntil);
    if (Number.isNaN(d.getTime())) return "";
    const tzOffsetMs = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 16);
  });

  const handleSave = () => {
    const milestones = milestonesText
      .split(/[,\s]+/)
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
    const pm = pulseMinutes.trim() === "" ? null : Number(pulseMinutes);
    const pw = pulseWindowHours.trim() === "" ? null : Number(pulseWindowHours);
    if (pm !== null && (!Number.isFinite(pm) || pm < 5 || pm > 1440)) {
      toast.error("Pulse minutes must be between 5 and 1440");
      return;
    }
    if (pw !== null && (!Number.isFinite(pw) || pw < 1 || pw > 24 * 14)) {
      toast.error("Pulse window must be between 1 and 336 hours");
      return;
    }
    if (milestones.length > 12) {
      toast.error("Maximum 12 milestones");
      return;
    }
    let pausedIso: string | null = null;
    if (pausedUntilLocal.trim() !== "") {
      const d = new Date(pausedUntilLocal);
      if (Number.isNaN(d.getTime())) {
        toast.error("Invalid pause date");
        return;
      }
      pausedIso = d.toISOString();
    }
    onSubmit({
      enabled,
      milestonesHours: milestones.length === 0 ? null : milestones,
      pulseMinutes: pm,
      pulseWindowHours: pw,
      pausedUntil: pausedIso,
    });
  };

  const pauseFor = (hours: number) => {
    const ms = Date.now() + hours * 3600_000;
    onSubmit({ pausedUntil: new Date(ms).toISOString() });
  };

  const isPaused = ev.config.pausedUntil && new Date(ev.config.pausedUntil).getTime() > Date.now();

  return (
    <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Notification config</h4>
        <div className="flex items-center gap-2">
          {isPaused && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
              Paused until {new Date(ev.config.pausedUntil!).toLocaleString()}
            </span>
          )}
          {!ev.config.enabled && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-700 border border-rose-200">
              Disabled
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="rounded" />
          <span className="text-slate-700">Notifications enabled</span>
        </label>

        <label className="block sm:col-span-2 lg:col-span-1">
          <span className="block text-slate-600 mb-1">Milestones (hours, comma-sep)</span>
          <input
            type="text"
            value={milestonesText}
            onChange={(e) => setMilestonesText(e.target.value)}
            placeholder="24, 12, 6, 1"
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
          />
        </label>

        <label className="block">
          <span className="block text-slate-600 mb-1">Pulse interval (min)</span>
          <input
            type="number"
            min={5}
            max={1440}
            value={pulseMinutes}
            onChange={(e) => setPulseMinutes(e.target.value)}
            placeholder="off"
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
          />
        </label>

        <label className="block">
          <span className="block text-slate-600 mb-1">Pulse window (hours pre-event)</span>
          <input
            type="number"
            min={1}
            max={336}
            value={pulseWindowHours}
            onChange={(e) => setPulseWindowHours(e.target.value)}
            placeholder="off"
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
          />
        </label>

        <label className="block sm:col-span-2 lg:col-span-2">
          <span className="block text-slate-600 mb-1">Pause until (local)</span>
          <input
            type="datetime-local"
            value={pausedUntilLocal}
            onChange={(e) => setPausedUntilLocal(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => pauseFor(1)} disabled={isPending} className="px-2 py-1 rounded border border-slate-300 bg-white text-[11px] hover:bg-slate-100">Pause 1h</button>
          <button onClick={() => pauseFor(24)} disabled={isPending} className="px-2 py-1 rounded border border-slate-300 bg-white text-[11px] hover:bg-slate-100">Pause 24h</button>
          <button onClick={() => onSubmit({ pausedUntil: null })} disabled={isPending || !isPaused} className="px-2 py-1 rounded border border-slate-300 bg-white text-[11px] hover:bg-slate-100 disabled:opacity-40">Resume</button>
        </div>
        <button
          onClick={handleSave}
          disabled={isPending}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-slate-900 text-white text-xs font-medium hover:bg-slate-700 disabled:opacity-50"
        >
          {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
          Save config
        </button>
      </div>

      {(ev.pulse.totalPulseRows > 0 || ev.pulse.lastSlotIso) && (
        <div className="border-t border-slate-200 pt-2 text-[11px] text-slate-600">
          <div className="font-semibold text-slate-700 mb-1">Pulse activity</div>
          <div>
            Last slot: {ev.pulse.lastSlotIso ? new Date(ev.pulse.lastSlotIso).toLocaleString() : "—"} ·{" "}
            sent {ev.pulse.sentPulseRows}/{ev.pulse.totalPulseRows} rows
          </div>
          <div className="flex flex-wrap gap-2 mt-1">
            {(["push", "email", "sse"] as const).map((ch) => {
              const r = ev.pulse.lastByChannel[ch];
              if (!r) return null;
              return (
                <span key={ch} className="inline-flex items-center gap-1">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${channelBadgeClasses(ch)}`}>{CHANNEL_LABEL[ch]}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusBadgeClasses(r.status)}`}>
                    {r.status} · {r.sent}/{r.sent + r.failed}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function EventNotificationsSection({ auth }: { auth: AdminAuth }) {
  const qc = useQueryClient();
  const authHeader = useMemo(() => ({ Authorization: `Bearer ${auth.adminToken}` }), [auth.adminToken]);
  const [highlightedRowIds, setHighlightedRowIds] = useState<Set<number>>(new Set());
  const [testEmailTo, setTestEmailTo] = useState("");

  const statsQuery = useQuery<NotifStats>({
    queryKey: ["admin-event-notif-stats"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/admin/event-notifications/stats`, { headers: authHeader });
      if (res.status === 401) auth.logout();
      return readApiJson<NotifStats>(res, "Unable to load notification stats");
    },
    enabled: !!auth.adminToken,
    refetchInterval: 30_000,
  });

  const logQuery = useQuery<{ rows: DispatchLogRow[] }>({
    queryKey: ["admin-event-notif-log"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/admin/event-notifications/log?limit=50`, { headers: authHeader });
      if (res.status === 401) auth.logout();
      return readApiJson<{ rows: DispatchLogRow[] }>(res, "Unable to load dispatch log");
    },
    enabled: !!auth.adminToken,
    refetchInterval: 30_000,
  });

  const upcomingQuery = useQuery<{ events: UpcomingEventSummary[] }>({
    queryKey: ["admin-event-notif-upcoming"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/admin/event-notifications/upcoming`, { headers: authHeader });
      if (res.status === 401) auth.logout();
      return readApiJson<{ events: UpcomingEventSummary[] }>(res, "Unable to load upcoming events");
    },
    enabled: !!auth.adminToken,
    refetchInterval: 60_000,
  });

  const dlqQuery = useQuery<{ rows: DeadLetterRow[] }>({
    queryKey: ["admin-event-notif-dlq"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/admin/event-notifications/dead-letter?limit=50`, { headers: authHeader });
      if (res.status === 401) auth.logout();
      return readApiJson<{ rows: DeadLetterRow[] }>(res, "Unable to load dead-letter queue");
    },
    enabled: !!auth.adminToken,
    refetchInterval: 30_000,
  });

  const healthQuery = useQuery<NotifHealth>({
    queryKey: ["admin-event-notif-health"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/admin/event-notifications/health`, { headers: authHeader });
      if (res.status === 401) auth.logout();
      return readApiJson<NotifHealth>(res, "Unable to load health");
    },
    enabled: !!auth.adminToken,
    refetchInterval: 60_000,
  });

  const dlqRequeueMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE}/api/admin/event-notifications/dead-letter/${id}/requeue`, {
        method: "POST",
        headers: authHeader,
      });
      if (res.status === 401) auth.logout();
      return readApiJson<{ ok: true; queueId: number; scheduledAt: string }>(res, "Requeue failed");
    },
    onSuccess: () => {
      toast.success("Re-queued — worker will pick it up shortly");
      qc.invalidateQueries({ queryKey: ["admin-event-notif-dlq"] });
      qc.invalidateQueries({ queryKey: ["admin-event-notif-stats"] });
      qc.invalidateQueries({ queryKey: ["admin-event-notif-log"] });
    },
    onError: (err) => toast.error(formatAdminError(err, "Requeue failed")),
  });

  const dlqDiscardMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE}/api/admin/event-notifications/dead-letter/${id}/discard`, {
        method: "POST",
        headers: authHeader,
      });
      if (res.status === 401) auth.logout();
      return readApiJson<{ ok: true; resolvedAt: string }>(res, "Discard failed");
    },
    onSuccess: () => {
      toast.success("Discarded");
      qc.invalidateQueries({ queryKey: ["admin-event-notif-dlq"] });
      qc.invalidateQueries({ queryKey: ["admin-event-notif-stats"] });
    },
    onError: (err) => toast.error(formatAdminError(err, "Discard failed")),
  });

  const runNowMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE}/api/admin/event-notifications/run-now`, {
        method: "POST",
        headers: authHeader,
      });
      if (res.status === 401) auth.logout();
      return readApiJson<{
        result: {
          eventsScanned: number;
          targetsFound: number;
          jobsEnqueued: number;
          dispatchesAttempted: number;
          dispatchesSucceeded: number;
          dispatchesRetried: number;
          dispatchesDeadLettered: number;
        };
      }>(res, "Tick failed");
    },
    onSuccess: (data) => {
      const r = data.result;
      toast.success(
        `Scanned ${r.eventsScanned} events · enqueued ${r.jobsEnqueued} jobs · drained ${r.dispatchesSucceeded}/${r.dispatchesAttempted}` +
          (r.dispatchesRetried ? ` · ${r.dispatchesRetried} retried` : "") +
          (r.dispatchesDeadLettered ? ` · ${r.dispatchesDeadLettered} dead-lettered` : ""),
      );
      qc.invalidateQueries({ queryKey: ["admin-event-notif-stats"] });
      qc.invalidateQueries({ queryKey: ["admin-event-notif-log"] });
      qc.invalidateQueries({ queryKey: ["admin-event-notif-upcoming"] });
      qc.invalidateQueries({ queryKey: ["admin-event-notif-dlq"] });
    },
    onError: (err) => toast.error(formatAdminError(err, "Manual run failed")),
  });

  const retryMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE}/api/admin/event-notifications/${id}/retry`, {
        method: "POST",
        headers: authHeader,
      });
      if (res.status === 401) auth.logout();
      return readApiJson(res, "Retry failed");
    },
    onSuccess: () => {
      toast.success("Retry queued");
      qc.invalidateQueries({ queryKey: ["admin-event-notif-stats"] });
      qc.invalidateQueries({ queryKey: ["admin-event-notif-log"] });
      qc.invalidateQueries({ queryKey: ["admin-event-notif-upcoming"] });
    },
    onError: (err) => toast.error(formatAdminError(err, "Retry failed")),
  });

  const testEmailMutation = useMutation({
    mutationFn: async (to: string) => {
      const res = await fetch(`${BASE}/api/admin/email/test`, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ to }),
      });
      if (res.status === 401) auth.logout();
      return readApiJson<{ ok: true; to: string; messageId: string | null }>(res, "Test email failed");
    },
    onSuccess: (data) => {
      toast.success(`Test email sent to ${data.to}${data.messageId ? ` · ${data.messageId}` : ""}`);
    },
    onError: (err) => toast.error(formatAdminError(err, "Test email failed")),
  });

  const cleanupSubscribersMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE}/api/admin/push-subscriptions/cleanup`, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
      });
      if (res.status === 401) auth.logout();
      return readApiJson<{
        ok: true;
        retiredFailing: number;
        retiredStale: number;
        before: { active: number };
        after: { active: number };
      }>(res, "Subscriber cleanup failed");
    },
    onSuccess: (data) => {
      const total = data.retiredFailing + data.retiredStale;
      toast.success(
        total > 0
          ? `Retired ${total} dead subscribers (${data.retiredFailing} failing, ${data.retiredStale} stale). Active: ${data.before.active} → ${data.after.active}`
          : "No dead subscribers to retire — all clean!",
      );
      qc.invalidateQueries({ queryKey: ["admin-event-notif-health"] });
    },
    onError: (err) => toast.error(formatAdminError(err, "Subscriber cleanup failed")),
  });

  const configMutation = useMutation({
    mutationFn: async (vars: { id: number; patch: { enabled?: boolean; milestonesHours?: number[] | null; pulseMinutes?: number | null; pulseWindowHours?: number | null; pausedUntil?: string | null } }) => {
      const res = await fetch(`${BASE}/api/admin/event-notifications/event/${vars.id}/config`, {
        method: "PATCH",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: vars.patch.enabled,
          milestonesHours: vars.patch.milestonesHours,
          pulseMinutes: vars.patch.pulseMinutes,
          pulseWindowHours: vars.patch.pulseWindowHours,
          pausedUntil: vars.patch.pausedUntil,
        }),
      });
      if (res.status === 401) auth.logout();
      return readApiJson(res, "Config update failed");
    },
    onSuccess: () => {
      toast.success("Notification config saved");
      qc.invalidateQueries({ queryKey: ["admin-event-notif-upcoming"] });
    },
    onError: (err) => toast.error(formatAdminError(err, "Config update failed")),
  });

  // Live updates via SSE — highlight rows that change
  useEffect(() => {
    // Singleton sseBroadcaster — any registered SSE endpoint receives broadcasts.
    // We piggy-back on /api/sermons/stream which is already widely used.
    const evt = new EventSource(`${BASE}/api/sermons/stream`);
    const onDispatch = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as { logId: number };
        setHighlightedRowIds((prev) => {
          const next = new Set(prev);
          next.add(data.logId);
          return next;
        });
        setTimeout(() => {
          setHighlightedRowIds((prev) => {
            const next = new Set(prev);
            next.delete(data.logId);
            return next;
          });
        }, 4000);
        qc.invalidateQueries({ queryKey: ["admin-event-notif-log"] });
        qc.invalidateQueries({ queryKey: ["admin-event-notif-stats"] });
      } catch {
        /* ignore parse errors */
      }
    };
    const onTick = () => {
      qc.invalidateQueries({ queryKey: ["admin-event-notif-stats"] });
      qc.invalidateQueries({ queryKey: ["admin-event-notif-log"] });
      qc.invalidateQueries({ queryKey: ["admin-event-notif-upcoming"] });
    };
    evt.addEventListener("event_notification_dispatched", onDispatch as EventListener);
    evt.addEventListener("event_notification_tick", onTick as EventListener);
    return () => {
      evt.removeEventListener("event_notification_dispatched", onDispatch as EventListener);
      evt.removeEventListener("event_notification_tick", onTick as EventListener);
      evt.close();
    };
  }, [qc]);

  const stats = statsQuery.data;
  const logRows = logQuery.data?.rows ?? [];
  const upcoming = upcomingQuery.data?.events ?? [];

  return (
    <AdminLoginGate role="livestream" auth={auth} title="Event Notification Scheduler">
    <div className="space-y-6">
      <SectionHeader
        title="Event Notification Scheduler"
        description="Multi-channel reminders (push · email · live banner) dispatched at 24h / 12h / 6h / 1h before each upcoming event in the calendar. Runs every 30 minutes with idempotency + automatic retries."
      />

      {/* Stat tiles + controls */}
      <Card>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <MetricCard label="Email subscribers" value={stats?.activeSubscribers ?? "—"} icon={<Bell className="w-4 h-4" />} />
          <MetricCard label="Dispatches sent" value={stats?.sent ?? "—"} icon={<CheckCircle className="w-4 h-4" />} />
          <MetricCard label="Dispatches failed" value={stats?.failed ?? "—"} icon={<AlertCircle className="w-4 h-4" />} />
          <MetricCard label="Total deliveries" value={stats?.totalSuccessSends ?? "—"} icon={<Send className="w-4 h-4" />} />
          <MetricCard label="Pending" value={stats?.pending ?? "—"} icon={<Clock className="w-4 h-4" />} />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-slate-400" />
              <span>
                Last tick:{" "}
                <strong className="text-slate-800">
                  {stats?.lastTickFinishedAt ? rel(stats.lastTickFinishedAt) : "not yet"}
                </strong>
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>
                Next tick:{" "}
                <strong className="text-slate-800">
                  {stats?.nextTickAt ? countdown(stats.nextTickAt) : "—"}
                </strong>
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${stats?.isRunning ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`} />
              <span>{stats?.isRunning ? "Tick running…" : "Idle"}</span>
            </span>
            {stats && !stats.emailDeliveryEnabled && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs">
                <AlertCircle className="w-3 h-3" />
                SMTP not configured — email skipped
              </span>
            )}
            {stats && stats.emailDeliveryEnabled && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs">
                <CheckCircle className="w-3 h-3" />
                SMTP configured
              </span>
            )}
          </div>

          <button
            onClick={() => runNowMutation.mutate()}
            disabled={runNowMutation.isPending || stats?.isRunning}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {runNowMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Run scheduler now
          </button>
        </div>

        <form
          className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = testEmailTo.trim();
            if (!trimmed) {
              toast.error("Enter an email address to send the test to.");
              return;
            }
            testEmailMutation.mutate(trimmed);
          }}
        >
          <Mail className="w-4 h-4 text-slate-400 shrink-0" />
          <label htmlFor="smtp-test-to" className="text-sm text-slate-700 shrink-0">
            Send test email to
          </label>
          <input
            id="smtp-test-to"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={testEmailTo}
            onChange={(e) => setTestEmailTo(e.target.value)}
            disabled={testEmailMutation.isPending}
            className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={testEmailMutation.isPending || !stats?.emailDeliveryEnabled}
            title={stats?.emailDeliveryEnabled ? "Send a test email via the configured SMTP server" : "SMTP not configured"}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testEmailMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send test
          </button>
        </form>
      </Card>

      {/* Worker & Queue */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold text-slate-800">Background worker &amp; delivery queue</h3>
          <div className="flex items-center gap-2 text-xs">
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${stats?.worker.isRunning ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}>
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${stats?.worker.isRunning ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
              Worker {stats?.worker.isRunning ? "running" : "stopped"}
            </span>
            {stats?.worker.lastTickAt && (
              <span className="text-slate-500">
                Last poll: <strong className="text-slate-700">{rel(stats.worker.lastTickAt)}</strong>
              </span>
            )}
            <span className="text-slate-500">
              Polls every {Math.round((stats?.worker.pollIntervalMs ?? 10000) / 1000)}s
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <MetricCard
            label="Success rate"
            value={stats ? `${Math.round(stats.successRate * 100)}%` : "—"}
            icon={<CheckCircle className="w-4 h-4" />}
          />
          <MetricCard label="Queue pending" value={stats?.queue.pending ?? "—"} icon={<Clock className="w-4 h-4" />} />
          <MetricCard label="Queue processing" value={stats?.queue.processing ?? "—"} icon={<Activity className="w-4 h-4" />} />
          <MetricCard label="Dead-letter (open)" value={stats?.queue.deadLetterUnresolved ?? "—"} icon={<AlertCircle className="w-4 h-4" />} />
          <MetricCard label="Worker processed" value={stats?.worker.totalProcessed ?? "—"} icon={<Send className="w-4 h-4" />} />
        </div>

        {stats && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-600">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="font-semibold text-slate-700 mb-1">Last scheduler tick</div>
              <div>
                Scanned <strong className="text-slate-800">{stats.lastTickResult?.eventsScanned ?? 0}</strong> events ·
                {" "}targeted <strong className="text-slate-800">{stats.lastTickResult?.targetsFound ?? 0}</strong> ·
                {" "}enqueued <strong className="text-slate-800">{stats.lastTickResult?.jobsEnqueued ?? 0}</strong> jobs
              </div>
              <div className="mt-1">
                Oldest pending: <strong className="text-slate-800">{stats.queue.oldestPendingAt ? rel(stats.queue.oldestPendingAt) : "none"}</strong> ·
                {" "}Next scheduled: <strong className="text-slate-800">{stats.queue.nextScheduledAt ? rel(stats.queue.nextScheduledAt) : "—"}</strong>
              </div>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="font-semibold text-slate-700 mb-1">Last worker poll</div>
              <div>
                Claimed <strong className="text-slate-800">{stats.worker.lastTickClaimed}</strong> ·
                {" "}completed <strong className="text-emerald-700">{stats.worker.lastTickCompleted}</strong> ·
                {" "}retried <strong className="text-amber-700">{stats.worker.lastTickRetried}</strong> ·
                {" "}dead-lettered <strong className="text-rose-700">{stats.worker.lastTickDeadLettered}</strong>
              </div>
              <div className="mt-1">
                Lifetime: <strong className="text-emerald-700">{stats.worker.totalCompleted}</strong> ok ·
                {" "}<strong className="text-amber-700">{stats.worker.totalRetried}</strong> retried ·
                {" "}<strong className="text-rose-700">{stats.worker.totalDeadLettered}</strong> dead-lettered
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* System health */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold text-slate-800">Notification channel health</h3>
          <div className="flex items-center gap-2 text-xs">
            {healthQuery.data && (
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${healthQuery.data.overallHealthy ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}>
                {healthQuery.data.overallHealthy ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                {healthQuery.data.overallHealthy ? "All channels healthy" : "Channel issue detected"}
              </span>
            )}
            {healthQuery.data?.checkedAt && (
              <span className="text-slate-500">Checked {rel(healthQuery.data.checkedAt)}</span>
            )}
          </div>
        </div>
        {!healthQuery.data ? (
          <p className="text-sm text-slate-500 italic">Loading channel diagnostics…</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="rounded-md border border-slate-200 p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">Web Push (VAPID)</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${healthQuery.data.push.vapid.initialized ? "bg-emerald-100 text-emerald-700" : healthQuery.data.push.vapid.configured ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>
                  {healthQuery.data.push.vapid.initialized ? "ready" : healthQuery.data.push.vapid.configured ? "configured" : "missing"}
                </span>
              </div>
              <div className="text-slate-600">
                Active subs: <strong className="text-slate-800">{healthQuery.data.push.webSubscribers.active}</strong>
                {healthQuery.data.push.webSubscribers.inactive > 0 && (
                  <span className="text-slate-400"> · {healthQuery.data.push.webSubscribers.inactive} inactive</span>
                )}
              </div>
              {(() => {
                const failing = healthQuery.data.push.webSubscribers.failing ?? 0;
                const never = healthQuery.data.push.webSubscribers.neverDelivered ?? 0;
                if (failing === 0 && never === 0) return null;
                return (
                  <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                    {failing > 0 && <>⚠ {failing} failing</>}
                    {failing > 0 && never > 0 && <span className="text-amber-400"> · </span>}
                    {never > 0 && <>{never} never delivered</>}
                  </div>
                );
              })()}
              {healthQuery.data.push.recentDispatch && healthQuery.data.push.recentDispatch.dispatches > 0 && (() => {
                const r = healthQuery.data.push.recentDispatch;
                const pct = Math.round(r.deliveryRate * 100);
                const tone = pct >= 80 ? "text-emerald-700" : pct >= 50 ? "text-amber-700" : "text-rose-700";
                return (
                  <div className={`text-[11px] ${tone}`}>
                    24 h delivery: {pct}% ({r.sent}/{r.sent + r.failed + r.deactivated})
                  </div>
                );
              })()}
              {healthQuery.data.push.vapid.publicKeyFingerprint && (
                <div className="text-[10px] text-slate-400 font-mono truncate" title={healthQuery.data.push.vapid.publicKeyFingerprint}>
                  fp: {healthQuery.data.push.vapid.publicKeyFingerprint}
                </div>
              )}
              {healthQuery.data.push.vapid.error && (
                <div className="text-[11px] text-rose-600">{healthQuery.data.push.vapid.error}</div>
              )}
              {((healthQuery.data.push.webSubscribers.failing ?? 0) > 0 ||
                (healthQuery.data.push.recentDispatch && healthQuery.data.push.recentDispatch.dispatches > 0 && healthQuery.data.push.recentDispatch.deliveryRate < 0.8)) && (
                <button
                  type="button"
                  onClick={() => cleanupSubscribersMutation.mutate()}
                  disabled={cleanupSubscribersMutation.isPending}
                  className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-60"
                  data-testid="button-push-cleanup"
                >
                  {cleanupSubscribersMutation.isPending ? "Cleaning…" : "Retire dead subscribers"}
                </button>
              )}
            </div>
            <div className="rounded-md border border-slate-200 p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">Expo (mobile)</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${healthQuery.data.push.expo.reachable ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                  {healthQuery.data.push.expo.reachable ? "reachable" : "unreachable"}
                </span>
              </div>
              <div className="text-slate-600">
                Active tokens: <strong className="text-slate-800">{healthQuery.data.push.expoTokens.active}</strong>
                {healthQuery.data.push.expoTokens.inactive > 0 && (
                  <span className="text-slate-400"> · {healthQuery.data.push.expoTokens.inactive} inactive</span>
                )}
              </div>
              <div className="text-[11px] text-slate-500">
                Access token: {healthQuery.data.push.expo.accessTokenConfigured ? "configured (enhanced limits)" : "not configured (anonymous tier)"}
              </div>
              {healthQuery.data.push.expo.error && (
                <div className="text-[11px] text-rose-600">{healthQuery.data.push.expo.error}</div>
              )}
            </div>
            <div className="rounded-md border border-slate-200 p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">Email (SMTP)</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  !healthQuery.data.email.configured
                    ? "bg-amber-100 text-amber-700"
                    : healthQuery.data.email.lastVerifyOk === false
                      ? "bg-rose-100 text-rose-700"
                      : healthQuery.data.email.lastVerifyOk
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                }`}>
                  {!healthQuery.data.email.configured
                    ? "not configured"
                    : healthQuery.data.email.lastVerifyOk === false
                      ? "verify failed"
                      : healthQuery.data.email.lastVerifyOk
                        ? "verified"
                        : "unverified"}
                </span>
              </div>
              {healthQuery.data.email.host && (
                <div className="text-slate-600">
                  Host: <strong className="text-slate-800">{healthQuery.data.email.host}:{healthQuery.data.email.port}</strong>
                  <span className="text-slate-400"> · {healthQuery.data.email.secure ? "TLS" : "STARTTLS"}</span>
                </div>
              )}
              {healthQuery.data.email.from && (
                <div className="text-slate-600 truncate" title={healthQuery.data.email.from}>From: <strong className="text-slate-800">{healthQuery.data.email.from}</strong></div>
              )}
              {healthQuery.data.email.configured && (
                <div className="text-[11px] text-slate-500">
                  Pool: {healthQuery.data.email.poolMax} conns · {healthQuery.data.email.rateLimit}/s ·
                  Sent {healthQuery.data.email.totalSent} · Failed {healthQuery.data.email.totalFailed}
                  {healthQuery.data.email.totalRetried > 0 && <> · {healthQuery.data.email.totalRetried} retried</>}
                </div>
              )}
              {healthQuery.data.email.lastVerifyAt && (
                <div className="text-[11px] text-slate-500">
                  Last verified {rel(healthQuery.data.email.lastVerifyAt)}
                </div>
              )}
              {healthQuery.data.email.lastVerifyError && (
                <div className="text-[11px] text-rose-600 break-words" title={healthQuery.data.email.lastVerifyError}>
                  {healthQuery.data.email.lastVerifyError}
                </div>
              )}
              {healthQuery.data.email.lastSendError && (
                <div className="text-[11px] text-amber-700 break-words" title={healthQuery.data.email.lastSendError}>
                  Last send error: {healthQuery.data.email.lastSendError}
                </div>
              )}
              {!healthQuery.data.email.configured && (
                <div className="text-[11px] text-amber-700">Email channel will be skipped until SMTP_* env vars are set.</div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Dead-letter queue */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-800">Dead-letter queue</h3>
          <span className="text-xs text-slate-500">
            {dlqQuery.data?.rows.length ?? 0} unresolved · jobs that exhausted all retry attempts
          </span>
        </div>
        {!dlqQuery.data ? (
          <p className="text-sm text-slate-500 italic">Loading…</p>
        ) : dlqQuery.data.rows.length === 0 ? (
          <p className="text-sm text-emerald-700 inline-flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4" /> Empty — no permanently failed jobs.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="text-left text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-1.5 pr-3 font-medium">Event</th>
                  <th className="py-1.5 pr-3 font-medium">Channel</th>
                  <th className="py-1.5 pr-3 font-medium">Bucket</th>
                  <th className="py-1.5 pr-3 font-medium">Attempts</th>
                  <th className="py-1.5 pr-3 font-medium">Failed</th>
                  <th className="py-1.5 pr-3 font-medium">Last error</th>
                  <th className="py-1.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dlqQuery.data.rows.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="py-2 pr-3">
                      <div className="font-medium text-slate-800 truncate max-w-[260px]" title={row.eventTitle}>{row.eventTitle}</div>
                      <div className="text-[10px] text-slate-400">#{row.eventId}</div>
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${channelBadgeClasses(row.channel)}`}>{CHANNEL_LABEL[row.channel]}</span>
                    </td>
                    <td className="py-2 pr-3 text-slate-600">
                      <div>{row.leadLabel}</div>
                      <div className="text-[10px] text-slate-400 font-mono truncate max-w-[140px]" title={row.bucketKey}>{row.bucketKey}</div>
                    </td>
                    <td className="py-2 pr-3 text-slate-700">{row.attempts}</td>
                    <td className="py-2 pr-3 text-slate-500">{rel(row.movedAt)}</td>
                    <td className="py-2 pr-3 text-rose-700 max-w-[280px]">
                      <div className="line-clamp-2" title={row.lastError ?? ""}>{row.lastError ?? "—"}</div>
                    </td>
                    <td className="py-2 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => dlqRequeueMutation.mutate(row.id)}
                          disabled={dlqRequeueMutation.isPending}
                          className="px-2 py-1 rounded border border-sky-300 bg-sky-50 text-sky-700 text-[11px] hover:bg-sky-100 disabled:opacity-50"
                          title="Reset attempts and re-enqueue for the worker"
                        >
                          Re-queue
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Discard dead-letter entry for "${row.eventTitle}" (${CHANNEL_LABEL[row.channel]})?`)) {
                              dlqDiscardMutation.mutate(row.id);
                            }
                          }}
                          disabled={dlqDiscardMutation.isPending}
                          className="px-2 py-1 rounded border border-slate-300 bg-white text-slate-600 text-[11px] hover:bg-slate-100 disabled:opacity-50"
                        >
                          Discard
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Upcoming events with milestone status */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-800">Upcoming events &amp; milestone status</h3>
          <span className="text-xs text-slate-500">{upcoming.length} event{upcoming.length === 1 ? "" : "s"} scanned</span>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No upcoming events in the next 24+ hours.</p>
        ) : (
          <div className="space-y-3">
            {upcoming.map((ev) => (
              <div key={ev.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{ev.title}</div>
                    <div className="text-xs text-slate-500">
                      {new Date(ev.startDate).toLocaleString("en-NG", { timeZone: "Africa/Lagos", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      {ev.location ? ` · ${ev.location}` : ""}
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">starts {countdown(ev.startDate)}</div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {ev.milestones.map((m) => (
                    <div key={m.hours} className={`rounded-md border p-2 text-xs ${m.isPast ? "border-slate-200 bg-slate-50" : "border-slate-200 bg-white"}`}>
                      <div className="font-semibold text-slate-700 mb-1">−{m.hours}h reminder</div>
                      <div className="space-y-1">
                        {(["push", "email", "sse"] as const).map((ch) => {
                          const r = m.channels[ch];
                          const status: NotifStatus = r?.status ?? (m.isPast ? "skipped" : "pending");
                          const label = r ? `${status} · ${r.successCount}/${r.successCount + r.failureCount}` : "—";
                          return (
                            <div key={ch} className="flex items-center justify-between gap-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${channelBadgeClasses(ch)}`}>{CHANNEL_LABEL[ch]}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusBadgeClasses(status)}`}>{label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <EventConfigForm
                  ev={ev}
                  onSubmit={(patch) => configMutation.mutate({ id: ev.id, patch })}
                  isPending={configMutation.isPending}
                />
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Recent dispatch log */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-800">Recent dispatches</h3>
          <span className="text-xs text-slate-500">{logRows.length} row{logRows.length === 1 ? "" : "s"}</span>
        </div>
        {logRows.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No dispatches yet. The scheduler will record activity here as events approach.</p>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
                  <th className="px-3 py-2 font-medium">Event</th>
                  <th className="px-3 py-2 font-medium">Milestone</th>
                  <th className="px-3 py-2 font-medium">Channel</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Sent / Total</th>
                  <th className="px-3 py-2 font-medium">Attempts</th>
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {logRows.map((row) => {
                  const highlighted = highlightedRowIds.has(row.id);
                  return (
                    <tr
                      key={row.id}
                      className={`border-b border-slate-100 transition-colors duration-700 ${highlighted ? "bg-amber-50" : "hover:bg-slate-50"}`}
                    >
                      <td className="px-3 py-2 text-slate-800">{row.eventTitle}</td>
                      <td className="px-3 py-2 text-slate-600">−{row.milestoneHours}h</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${channelBadgeClasses(row.channel)}`}>{CHANNEL_LABEL[row.channel]}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusBadgeClasses(row.status)}`}>{row.status}</span>
                      </td>
                      <td className="px-3 py-2 text-slate-600 tabular-nums">
                        {row.successCount}
                        <span className="text-slate-400"> / {row.recipientCount}</span>
                        {row.failureCount > 0 && <span className="text-rose-600"> ({row.failureCount} fail)</span>}
                      </td>
                      <td className="px-3 py-2 text-slate-600 tabular-nums">{row.attempts}</td>
                      <td className="px-3 py-2 text-slate-500 text-xs">
                        {row.completedAt ? rel(row.completedAt) : row.lastAttemptAt ? rel(row.lastAttemptAt) : rel(row.createdAt)}
                      </td>
                      <td className="px-3 py-2">
                        {row.status === "failed" && (
                          <button
                            onClick={() => retryMutation.mutate(row.id)}
                            disabled={retryMutation.isPending}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-50"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {logRows.some((r) => r.lastError) && (
              <details className="mt-2 px-3">
                <summary className="text-xs text-slate-500 cursor-pointer">View errors</summary>
                <div className="mt-2 space-y-1 text-xs">
                  {logRows.filter((r) => r.lastError).map((r) => (
                    <div key={`err-${r.id}`} className="text-rose-600">
                      <strong>#{r.id}</strong> {r.eventTitle} — {CHANNEL_LABEL[r.channel]}: {r.lastError}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </Card>
    </div>
    </AdminLoginGate>
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
            {p.broadcastEnabled && (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary"
                title={`${(p.broadcastMessages?.length ?? 0)} rotating message(s)`}
              >
                <Megaphone className="w-3 h-3" /> {describeBroadcast(p)}
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

        <TopVideosPanel auth={auth} />

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

// ─── Top Videos (monetized YouTube embed analytics) ───────────────────────────

interface TopVideoRow {
  video_id:      string;
  impressions:   string | number | null;
  plays:         string | number | null;
  pauses:        string | number | null;
  q25:           string | number | null;
  q50:           string | number | null;
  q75:           string | number | null;
  completes:     string | number | null;
  last_seen:     string | null;
  title:         string | null;
  thumbnail_url: string | null;
  published_at:  string | null;
  pinned_at:     string | null;
  in_library:    boolean | null;
}

interface TopVideoPageRow {
  page:        string;
  impressions: string | number | null;
  plays:       string | number | null;
}

interface TopVideosPayload {
  items:  TopVideoRow[];
  totals: { impressions: number; plays: number; completes: number };
  pages:  TopVideoPageRow[];
}

interface MonthRow {
  month: string;
  plays: string | number | null;
}

interface TrendPoint {
  month:       string;
  impressions: number;
  plays:       number;
  completes:   number;
}

function currentUtcMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, {
    month: "long",
    year:  "numeric",
    timeZone: "UTC",
  });
}

function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : parseInt(v, 10) || 0;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

function formatPct(num: number, den: number): string {
  if (den <= 0) return "—";
  return `${((num / den) * 100).toFixed(1)}%`;
}

function TrendChart({ trend }: { trend: TrendPoint[] }) {
  if (trend.length === 0) return null;

  const W = 600;
  const H = 120;
  const PAD = { top: 8, right: 4, bottom: 22, left: 4 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const maxImpr  = Math.max(1, ...trend.map(p => p.impressions));
  const maxPlays = Math.max(1, ...trend.map(p => p.plays));
  const yMax = Math.max(maxImpr, maxPlays);

  const stepX = innerW / Math.max(1, trend.length - 1);
  const xAt = (i: number) => PAD.left + i * stepX;
  const yAt = (v: number) => PAD.top + innerH - (v / yMax) * innerH;

  const linePath = (key: "impressions" | "plays") =>
    trend.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(p[key]).toFixed(1)}`).join(" ");

  const areaPath = (key: "impressions" | "plays") => {
    const top = trend.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(p[key]).toFixed(1)}`).join(" ");
    return `${top} L${xAt(trend.length - 1).toFixed(1)},${(PAD.top + innerH).toFixed(1)} L${xAt(0).toFixed(1)},${(PAD.top + innerH).toFixed(1)} Z`;
  };

  const totalPlays = trend.reduce((acc, p) => acc + p.plays, 0);
  const lastMonth  = trend[trend.length - 1];
  const prevMonth  = trend[trend.length - 2];
  const momDelta   = prevMonth && prevMonth.plays > 0
    ? ((lastMonth.plays - prevMonth.plays) / prevMonth.plays) * 100
    : null;
  const momLabel = momDelta === null
    ? null
    : (momDelta >= 0 ? "+" : "") + momDelta.toFixed(1) + "%";

  return (
    <div className="mb-4 rounded-xl border border-border bg-muted/20 p-3">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div>
          <div className="text-xs font-semibold flex items-center gap-1.5">
            <TrendingUp className="w-3 h-3 text-primary" /> 12-Month Trend
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {formatCount(totalPlays)} plays across the last year
            {momLabel !== null && (
              <>
                {" • "}
                <span className={momDelta! >= 0 ? "text-emerald-500" : "text-red-500"}>
                  {momLabel} MoM
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500/70 inline-block" /> Impressions
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Plays
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="none">
        <defs>
          <linearGradient id="trendImprFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="rgb(59,130,246)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="rgb(59,130,246)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="trendPlaysFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="rgb(239,68,68)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="rgb(239,68,68)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d={areaPath("impressions")} fill="url(#trendImprFill)" />
        <path d={linePath("impressions")} fill="none" stroke="rgb(59,130,246)" strokeWidth="1.5" strokeOpacity="0.7" />
        <path d={areaPath("plays")}       fill="url(#trendPlaysFill)" />
        <path d={linePath("plays")}       fill="none" stroke="rgb(239,68,68)" strokeWidth="2" />

        {trend.map((p, i) => (
          <g key={p.month}>
            <circle cx={xAt(i)} cy={yAt(p.plays)} r={2} fill="rgb(239,68,68)">
              <title>{`${formatMonthLabel(p.month)}\n${p.plays.toLocaleString()} plays\n${p.impressions.toLocaleString()} impressions\n${p.completes.toLocaleString()} completes`}</title>
            </circle>
            {(i % 2 === 0 || i === trend.length - 1) && (
              <text
                x={xAt(i)}
                y={H - 6}
                textAnchor="middle"
                className="fill-muted-foreground"
                style={{ fontSize: 9 }}
              >
                {p.month.slice(2).replace("-", "/")}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

function TopVideosPanel({ auth }: { auth: AdminAuth }) {
  const authHeader = { Authorization: `Bearer ${auth.adminToken}` };
  const [exportMonth, setExportMonth] = useState<string>(currentUtcMonth());
  const [downloading, setDownloading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const { data, isLoading, isFetching, refetch } = useQuery<TopVideosPayload>({
    queryKey: ["video-events-top"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/video-events/top?limit=25`, { headers: authHeader });
      if (res.status === 401) auth.logout();
      return readApiJson<TopVideosPayload>(res, "Unable to load video analytics");
    },
    enabled: !!auth.adminToken,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: monthsData } = useQuery<{ months: MonthRow[] }>({
    queryKey: ["video-events-months"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/video-events/months`, { headers: authHeader });
      if (res.status === 401) auth.logout();
      return readApiJson<{ months: MonthRow[] }>(res, "Unable to load months");
    },
    enabled: !!auth.adminToken,
    staleTime: 60_000,
  });

  const { data: trendData } = useQuery<{ trend: TrendPoint[] }>({
    queryKey: ["video-events-trend"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/video-events/trend`, { headers: authHeader });
      if (res.status === 401) auth.logout();
      return readApiJson<{ trend: TrendPoint[] }>(res, "Unable to load trend");
    },
    enabled: !!auth.adminToken,
    staleTime: 60_000,
  });

  const trend = trendData?.trend ?? [];

  const qc = useQueryClient();
  const pinMutation = useMutation({
    mutationFn: async ({ videoId, pin }: { videoId: string; pin: boolean }) => {
      const res = await fetch(`${BASE}/api/sermons/${encodeURIComponent(videoId)}/pin`, {
        method:  pin ? "POST" : "DELETE",
        headers: authHeader,
      });
      if (res.status === 401) { auth.logout(); throw new Error("Auth expired"); }
      return readApiJson<{ ok: boolean }>(res, pin ? "Failed to pin" : "Failed to unpin");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["video-events-top"] });
    },
  });

  const availableMonths = useMemo(() => {
    const fromApi = (monthsData?.months ?? []).map(m => m.month);
    const set = new Set<string>(fromApi);
    set.add(currentUtcMonth());
    return Array.from(set).sort().reverse();
  }, [monthsData]);

  const downloadCsv = async () => {
    setDownloading(true);
    setExportError(null);
    try {
      const res = await fetch(`${BASE}/api/video-events/export.csv?month=${exportMonth}`, { headers: authHeader });
      if (res.status === 401) { auth.logout(); return; }
      if (!res.ok) throw new Error(`Export failed (HTTP ${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `jctm-video-analytics-${exportMonth}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const items   = data?.items ?? [];
  const totals  = data?.totals ?? { impressions: 0, plays: 0, completes: 0 };
  const pages   = data?.pages ?? [];
  const overallPlayRate     = totals.impressions > 0 ? (totals.plays / totals.impressions) * 100 : 0;
  const overallCompleteRate = totals.plays       > 0 ? (totals.completes / totals.plays) * 100   : 0;

  return (
    <Card>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <PlayCircle className="w-4 h-4 text-red-500" />
            Top Monetized Videos
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real watch-time signals from every <code className="px-1 py-0.5 rounded bg-muted text-[10px]">YouTubeEmbed</code> on the site.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={exportMonth}
            onChange={e => setExportMonth(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-muted transition-colors cursor-pointer"
            aria-label="Select month for CSV export"
          >
            {availableMonths.map(m => (
              <option key={m} value={m}>{formatMonthLabel(m)}</option>
            ))}
          </select>
          <button
            onClick={downloadCsv}
            disabled={downloading}
            className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
            title={`Download ${formatMonthLabel(exportMonth)} as CSV`}
          >
            {downloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
            Export CSV
          </button>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
          >
            {isFetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
            Refresh
          </button>
        </div>
      </div>
      {exportError && (
        <div className="mb-3 text-xs text-red-500 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          {exportError}
        </div>
      )}

      <TrendChart trend={trend} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <MetricCard label="Impressions" value={formatCount(totals.impressions)} icon={<Eye className="w-4 h-4" />} />
        <MetricCard label="Plays"       value={formatCount(totals.plays)}       icon={<PlayCircle className="w-4 h-4" />} />
        <MetricCard label="Play Rate"   value={overallPlayRate ? `${overallPlayRate.toFixed(1)}%` : "—"} icon={<TrendingUp className="w-4 h-4" />} />
        <MetricCard label="Completes"   value={`${formatCount(totals.completes)} (${overallCompleteRate ? overallCompleteRate.toFixed(0) + "%" : "—"})`} icon={<CheckCircle className="w-4 h-4" />} />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No video plays recorded yet. Browse the public site (Home, Sermons, Crusade, Conference, Events, Moments) and the analytics will populate here within a minute.
        </div>
      ) : (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr className="text-left">
                <th className="px-2 py-2 font-medium">#</th>
                <th className="px-2 py-2 font-medium">Video</th>
                <th className="px-2 py-2 font-medium text-right">Impr.</th>
                <th className="px-2 py-2 font-medium text-right">Plays</th>
                <th className="px-2 py-2 font-medium text-right">Play %</th>
                <th className="px-2 py-2 font-medium text-right">25%</th>
                <th className="px-2 py-2 font-medium text-right">50%</th>
                <th className="px-2 py-2 font-medium text-right">75%</th>
                <th className="px-2 py-2 font-medium text-right">Done</th>
                <th className="px-2 py-2 font-medium text-right">Done %</th>
                <th className="px-2 py-2 font-medium text-center">Hero</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row, i) => {
                const impr = num(row.impressions);
                const plays = num(row.plays);
                const completes = num(row.completes);
                const thumb = row.thumbnail_url ?? `https://i.ytimg.com/vi/${row.video_id}/mqdefault.jpg`;
                const inLibrary = row.in_library === true;
                const isPinned  = !!row.pinned_at && (Date.now() - new Date(row.pinned_at).getTime()) < 30 * 86400_000;
                const pinBusy   = pinMutation.isPending && pinMutation.variables?.videoId === row.video_id;
                return (
                  <tr key={row.video_id} className={`border-t border-border/60 hover:bg-muted/30 transition-colors ${isPinned ? "bg-amber-500/5" : ""}`}>
                    <td className="px-2 py-2 text-muted-foreground tabular-nums">{i + 1}</td>
                    <td className="px-2 py-2">
                      <a
                        href={`https://www.youtube.com/watch?v=${row.video_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2.5 group"
                      >
                        <img
                          src={thumb}
                          alt=""
                          loading="lazy"
                          className="w-14 h-8 rounded object-cover bg-muted shrink-0"
                          onError={e => {
                            (e.target as HTMLImageElement).src = `https://i.ytimg.com/vi/${row.video_id}/default.jpg`;
                          }}
                        />
                        <div className="min-w-0">
                          <div className="font-medium line-clamp-1 group-hover:text-primary transition-colors flex items-center gap-1.5">
                            {row.title ?? row.video_id}
                            {isPinned && (
                              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold">
                                Pinned Hero
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">{row.video_id}</div>
                        </div>
                      </a>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatCount(impr)}</td>
                    <td className="px-2 py-2 text-right tabular-nums font-medium">{formatCount(plays)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{formatPct(plays, impr)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{formatCount(num(row.q25))}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{formatCount(num(row.q50))}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{formatCount(num(row.q75))}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatCount(completes)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-emerald-600 font-medium">{formatPct(completes, plays)}</td>
                    <td className="px-2 py-2 text-center">
                      {!inLibrary ? (
                        <span
                          className="text-[10px] text-muted-foreground cursor-help"
                          title="Not in sermon library — only synced sermons can be pinned as the homepage hero."
                        >
                          —
                        </span>
                      ) : (
                        <button
                          onClick={() => pinMutation.mutate({ videoId: row.video_id, pin: !isPinned })}
                          disabled={pinBusy}
                          title={isPinned ? "Unpin from homepage hero" : "Pin as homepage hero (overrides auto-feature for 30 days)"}
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors disabled:opacity-50 ${
                            isPinned
                              ? "text-amber-600 dark:text-amber-400 bg-amber-500/15 hover:bg-amber-500/25"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          }`}
                        >
                          {pinBusy
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : isPinned
                              ? <PinOff className="w-3.5 h-3.5" />
                              : <Pin className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pages.length > 0 && (
        <div className="mt-5 pt-4 border-t border-border">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Globe className="w-3 h-3" /> Plays by Page
          </h4>
          <div className="space-y-1.5">
            {pages.map(p => {
              const plays = num(p.plays);
              const impr  = num(p.impressions);
              const max   = pages.reduce((acc, r) => Math.max(acc, num(r.plays)), 1);
              const pct   = max > 0 ? (plays / max) * 100 : 0;
              return (
                <div key={p.page} className="flex items-center gap-3 text-xs">
                  <span className="w-44 truncate font-medium">{labelPage(p.page)}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-red-500 to-orange-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-16 text-right tabular-nums font-medium">{formatCount(plays)}</span>
                  <span className="w-20 text-right tabular-nums text-muted-foreground">{formatPct(plays, impr)} CTR</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Predictive Analytics Dashboard ──────────────────────────────────────────

interface AnalyticsData {
  metrics: {
    activeUsersToday: number;
    activeUsers7d: number;
    activeUsers30d: number;
    avgSessionDuration: number;
    topContentTypes: string[];
    peakHourUTC: number;
    engagementRate: number;
  };
  notificationTiming: {
    bestHourUTC: number;
    bestDayName: string;
    confidence: string;
    reasoning: string;
  };
  generatedAt: string;
}

function AnalyticsDashboardSection({ auth }: { auth: ReturnType<typeof useAdminAuth> }) {
  const { data, isLoading, error, refetch } = useQuery<AnalyticsData>({
    queryKey: ["admin-analytics"],
    queryFn: async () => {
      const token = auth.adminToken;
      if (!token) throw new Error("Not authenticated");
      const res = await fetch(`${BASE}/api/admin/analytics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: !!auth.adminToken,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const peakHour = data?.metrics.peakHourUTC ?? 9;
  const peakHourLocal = ((peakHour + 1) % 24).toString().padStart(2, "0");
  const engagePct = data ? Math.round(data.metrics.engagementRate * 100) : 0;

  const metricCards = data ? [
    { label: "Active Today",   value: data.metrics.activeUsersToday.toLocaleString(),  sub: "unique visitors",          color: "text-emerald-400" },
    { label: "Active 7 Days",  value: data.metrics.activeUsers7d.toLocaleString(),     sub: "unique visitors",          color: "text-sky-400" },
    { label: "Active 30 Days", value: data.metrics.activeUsers30d.toLocaleString(),    sub: "unique visitors",          color: "text-violet-400" },
    { label: "Engagement Rate",value: `${engagePct}%`,                                  sub: "7d / 30d active ratio",    color: engagePct >= 40 ? "text-emerald-400" : "text-amber-400" },
    { label: "Peak Hour (WAT)",value: `${peakHourLocal}:00`,                            sub: "highest traffic window",   color: "text-amber-400" },
    { label: "Avg Session",    value: `${data.metrics.avgSessionDuration.toFixed(1)}m`, sub: "estimated time-on-site",   color: "text-rose-400" },
  ] : [];

  return (
    <AdminLoginGate role="sermon" auth={auth} title="Predictive Analytics">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <SectionHeader
            title="Predictive Analytics"
            description="Real-time audience metrics, engagement forecasting, and optimal notification timing — zero external APIs."
          />
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        {isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-4 animate-pulse space-y-2">
                <div className="h-3 w-24 rounded bg-muted" />
                <div className="h-7 w-16 rounded bg-muted" />
                <div className="h-3 w-28 rounded bg-muted/60" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
            Failed to load analytics. <button onClick={() => refetch()} className="underline ml-1">Retry</button>
          </div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {metricCards.map((m) => (
                <Card key={m.label} className="flex flex-col gap-1">
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">{m.label}</p>
                  <p className={`text-2xl font-bold tabular-nums ${m.color}`}>{m.value}</p>
                  <p className="text-[11px] text-muted-foreground">{m.sub}</p>
                </Card>
              ))}
            </div>

            <Card>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Top Content Types</p>
              <div className="flex flex-wrap gap-2">
                {data.metrics.topContentTypes.map((t, i) => (
                  <span key={t} className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                    i === 0 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : i === 1 ? "bg-sky-500/10 text-sky-400 border-sky-500/30"
                    : "bg-muted/40 text-muted-foreground border-border"
                  }`}>
                    #{i + 1} {t}
                  </span>
                ))}
              </div>
            </Card>

            <Card>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Optimal Push Notification Timing</p>
              <div className="flex items-start gap-4">
                <div className="flex-1 space-y-1">
                  <p className="text-base font-bold text-foreground">
                    {data.notificationTiming.bestDayName} · {((data.notificationTiming.bestHourUTC + 1) % 24).toString().padStart(2, "0")}:00 WAT
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{data.notificationTiming.reasoning}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border shrink-0 ${
                  data.notificationTiming.confidence === "high"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : data.notificationTiming.confidence === "medium"
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                      : "bg-muted/40 text-muted-foreground border-border"
                }`}>
                  {data.notificationTiming.confidence} confidence
                </span>
              </div>
            </Card>

            <p className="text-[11px] text-muted-foreground/50 text-right">
              Generated {new Date(data.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · auto-refresh every 60s
            </p>
          </>
        )}
      </div>
    </AdminLoginGate>
  );
}

// ─── AI Engine Dashboard ──────────────────────────────────────────────────────

interface AIDashboardData {
  generatedAt: string;
  feedback: {
    total: number;
    avgRating: number | null;
    avgLatencyMs: number | null;
    byTier: { tier: string; total: number; avgRating: number | null; avgLatencyMs: number | null; helpfulPct: number | null }[];
  };
  health: {
    status: string;
    subsystems: Record<string, { status: string; latencyMs: number | null; detail: string; checkedAt: string }>;
    ai: { tier1: { name: string; status: string; latencyMs: number; detail: string }; tier2: { name: string; status: string; latencyMs: number; detail: string }; tier3: { name: string; status: string; latencyMs: number; detail: string } };
    features: Record<string, boolean>;
    resources: { memoryUsedMb: number; memoryTotalMb: number; memoryPct: number; uptimeSeconds: number; nodeVersion: string; platform: string };
    uptime: { processUptimeSeconds: number; lastHeartbeatAt: string | null; heartbeatGapMs: number | null };
  };
  knowledgeBase: { totalChunks: number; embeddedChunks: number };
  cron: {
    youtube: { quotaPaused: boolean; lastRSSSync: string | null; nextRSSSync: string | null; lastAPISync: string | null; lastFullSync: string | null };
    websub: { lastRenewal: string | null; nextRenewal: string | null };
    ai: { mode: string; externalAIEnabled: boolean };
    running: Record<string, boolean>;
    lastSyncError: string | null;
  };
}

function StatusDot({ status }: { status: string }) {
  const color = status === "healthy" ? "bg-emerald-500" : status === "degraded" ? "bg-amber-500" : status === "down" ? "bg-red-500" : "bg-zinc-400";
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

// ─── AdSense Diagnostics ──────────────────────────────────────────────────────

interface AdSenseConfig {
  publisherId: string;
  isHardcodedFallback: boolean;
  envKeyUsed: string;
  publisherValid: boolean;
  enableFlag: boolean;
  slots: { name: string; envKey: string; slotId: string | null; configured: boolean }[];
  configuredSlots: number;
  totalSlots: number;
  adsTxt: { status: "ok" | "missing" | "wrong" | "error"; content: string | null };
  checkedAt: string;
}

interface AdSenseRuntime {
  scriptLoaded: boolean;
  adsboogleQueueLength: number;
  slotsInDOM: number;
  slotsFilled: number;
  consent: { essential: true; analytics: boolean; advertising: boolean } | null;
  measuredAt: string;
}

// ─── Knowledge Base Admin Section ─────────────────────────────────────────────

interface KnowledgeStats {
  totalChunks: number;
  embeddedChunks: number;
  byType: Record<string, number>;
  recentSources: { source: string; chunk_type: string; updated_at: string }[];
}

interface IngestResult {
  success: boolean; source: string; chunksStored: number; embeddingsGenerated: number;
  chunks: { chunkIndex: number; hasEmbedding: boolean; preview: string }[];
}

interface TranscriptResult {
  success: boolean; source: string; sermon_title: string; chunksStored: number;
  embeddingsGenerated: number; message: string;
}

function KnowledgeSection({ auth }: { auth: AdminAuth }) {
  // Stats
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<KnowledgeStats>({
    queryKey: ["admin-knowledge-stats"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/admin/knowledge/stats`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    refetchInterval: 20_000,
  });

  // Ingest form state
  const [ingestText, setIngestText]   = useState("");
  const [ingestSrc, setIngestSrc]     = useState("");
  const [ingestLabel, setIngestLabel] = useState("");
  const [ingestType, setIngestType]   = useState("doctrine");
  const [ingestResult, setIngestResult] = useState<IngestResult | null>(null);
  const [ingestErr, setIngestErr]     = useState("");

  // Transcript form state
  const [txTitle, setTxTitle]       = useState("");
  const [txPrch, setTxPrch]         = useState("Prophet Amos Evomobor");
  const [txDate, setTxDate]         = useState("");
  const [txVid, setTxVid]           = useState("");
  const [txText, setTxText]         = useState("");
  const [txResult, setTxResult]     = useState<TranscriptResult | null>(null);
  const [txErr, setTxErr]           = useState("");

  // Speech-to-text state
  const [sttActive, setSttActive] = useState(false);
  const [sttSupported] = useState(() => "webkitSpeechRecognition" in window || "SpeechRecognition" in window);
  const recognitionRef = useRef<unknown>(null);

  const startSpeechCapture = useCallback(() => {
    const SR = (window as Record<string, unknown>)["SpeechRecognition"] as (new () => SpeechRecognition) | undefined
      ?? (window as Record<string, unknown>)["webkitSpeechRecognition"] as (new () => SpeechRecognition) | undefined;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-NG";
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = Array.from(e.results)
        .map((r: SpeechRecognitionResult) => r[0]!.transcript)
        .join(" ");
      setTxText(transcript);
    };
    rec.onend = () => setSttActive(false);
    rec.start();
    recognitionRef.current = rec;
    setSttActive(true);
  }, []);

  const stopSpeechCapture = useCallback(() => {
    (recognitionRef.current as SpeechRecognition | null)?.stop();
    setSttActive(false);
  }, []);

  const [ingestBusy, setIngestBusy] = useState(false);
  const [syncBusy, setSyncBusy]     = useState(false);
  const [txBusy, setTxBusy]         = useState(false);

  const handleIngest = async () => {
    setIngestErr(""); setIngestResult(null); setIngestBusy(true);
    try {
      const r = await fetch(`${BASE}/api/admin/knowledge/ingest`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: ingestText, source: ingestSrc, label: ingestLabel, chunk_type: ingestType }),
      });
      const json = await r.json();
      if (!r.ok) { setIngestErr(json.error ?? "Ingestion failed"); return; }
      setIngestResult(json);
      refetchStats();
      toast.success(`Ingested ${json.chunksStored} chunk(s) with ${json.embeddingsGenerated} embedding(s)`);
    } catch { setIngestErr("Network error"); } finally { setIngestBusy(false); }
  };

  const handleTranscript = async () => {
    setTxErr(""); setTxResult(null); setTxBusy(true);
    try {
      const r = await fetch(`${BASE}/api/admin/knowledge/transcript`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: txText, sermon_title: txTitle, preacher: txPrch, date: txDate, video_id: txVid }),
      });
      const json = await r.json();
      if (!r.ok) { setTxErr(json.error ?? "Failed"); return; }
      setTxResult(json);
      refetchStats();
      toast.success(json.message);
    } catch { setTxErr("Network error"); } finally { setTxBusy(false); }
  };

  const handleSync = async () => {
    setSyncBusy(true);
    try {
      const r = await fetch(`${BASE}/api/admin/knowledge/sync`, { method: "POST", credentials: "include" });
      const json = await r.json();
      if (r.ok) { refetchStats(); toast.success("Full knowledge sync complete"); }
      else toast.error(json.error ?? "Sync failed");
    } catch { toast.error("Network error"); } finally { setSyncBusy(false); }
  };

  const typeOptions = ["doctrine", "sermon", "testimony", "devotional", "event", "faq", "ministry", "manual"];

  return (
    <AdminLoginGate role="sermon" auth={auth} title="AI Knowledge Base">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <SectionHeader title="AI Knowledge Base" description="Real-time knowledge management — paste text, ingest sermon transcripts, or trigger full re-sync" />
          <button onClick={handleSync} disabled={syncBusy} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors disabled:opacity-50">
            {syncBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Full Sync
          </button>
        </div>

        {/* ── Stats ── */}
        {statsLoading && <div className="flex items-center gap-2 text-muted-foreground text-sm py-6 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Loading stats…</div>}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard label="Total Chunks" value={stats.totalChunks.toLocaleString()} icon={<Database className="w-4 h-4" />} />
            <MetricCard label="Embedded" value={`${stats.embeddedChunks}/${stats.totalChunks}`} icon={<Sparkles className="w-4 h-4" />} />
            <MetricCard label="Content Types" value={Object.keys(stats.byType).length} icon={<Layers className="w-4 h-4" />} />
            <MetricCard label="Coverage %" value={stats.totalChunks > 0 ? `${Math.round((stats.embeddedChunks / stats.totalChunks) * 100)}%` : "0%"} icon={<Activity className="w-4 h-4" />} />
          </div>
        )}

        {stats && Object.keys(stats.byType).length > 0 && (
          <Card>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><BookOpen className="w-4 h-4 text-primary" /> Chunks by Content Type</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                <span key={type} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-border bg-muted text-foreground">
                  {type} <span className="font-mono text-primary font-bold">{count}</span>
                </span>
              ))}
            </div>
          </Card>
        )}

        {/* ── Ingest Text Form ── */}
        <Card>
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Plus className="w-4 h-4 text-primary" /> Ingest New Content</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                value={ingestSrc} onChange={e => setIngestSrc(e.target.value)}
                placeholder="source-id (e.g. jctm-2026-teaching)"
                className="px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <input
                value={ingestLabel} onChange={e => setIngestLabel(e.target.value)}
                placeholder="Label (optional, e.g. 'JCTM 2026 Crusade Sermon')"
                className="px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <select
                value={ingestType} onChange={e => setIngestType(e.target.value)}
                className="px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <textarea
              value={ingestText} onChange={e => setIngestText(e.target.value)}
              rows={6} placeholder="Paste any JCTM ministry content here — doctrine, teaching notes, sermon points, devotionals, event information, ministry updates... The system will auto-chunk and embed it for TempleBots."
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
            />
            {ingestErr && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {ingestErr}</p>}
            {ingestResult && (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-300">
                <p className="font-semibold mb-1">✓ Ingested: {ingestResult.source}</p>
                <p>{ingestResult.chunksStored} chunk(s) stored · {ingestResult.embeddingsGenerated} embedding(s) generated</p>
              </div>
            )}
            <button
              onClick={handleIngest}
              disabled={ingestBusy || !ingestText.trim() || !ingestSrc.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors"
            >
              {ingestBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Ingest Content
            </button>
          </div>
        </Card>

        {/* ── Sermon Transcript Form ── */}
        <Card>
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Tv2 className="w-4 h-4 text-primary" /> Sermon Transcript Ingestion</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                value={txTitle} onChange={e => setTxTitle(e.target.value)}
                placeholder="Sermon title (required)"
                className="px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <input
                value={txPrch} onChange={e => setTxPrch(e.target.value)}
                placeholder="Preacher"
                className="px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <input
                value={txDate} onChange={e => setTxDate(e.target.value)}
                placeholder="Date (e.g. 4 May 2026)"
                className="px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <input
                value={txVid} onChange={e => setTxVid(e.target.value)}
                placeholder="YouTube Video ID (optional)"
                className="px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="relative">
              <textarea
                value={txText} onChange={e => setTxText(e.target.value)}
                rows={8} placeholder="Paste sermon transcript here — or use the microphone button to capture speech in real time while listening to the sermon..."
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
              />
              {sttSupported && (
                <button
                  onClick={sttActive ? stopSpeechCapture : startSpeechCapture}
                  title={sttActive ? "Stop speech capture" : "Start speech-to-text capture"}
                  className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-white transition-all ${sttActive ? "bg-red-500 animate-pulse" : "bg-primary/70 hover:bg-primary"}`}
                >
                  {sttActive ? <span className="text-[10px] font-bold">■</span> : <span className="text-[10px]">🎙</span>}
                </button>
              )}
            </div>
            {sttActive && <p className="text-xs text-red-400 flex items-center gap-1.5"><span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" /> Listening — speak clearly near your microphone. Click ■ to stop.</p>}
            {!sttSupported && <p className="text-xs text-muted-foreground">Speech-to-text not available in this browser. Use Chrome for best results.</p>}

            {txErr && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {txErr}</p>}
            {txResult && (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-300">
                <p className="font-semibold mb-1">✓ {txResult.message}</p>
                <p>{txResult.chunksStored} segment(s) · {txResult.embeddingsGenerated} embedding(s)</p>
              </div>
            )}
            <button
              onClick={handleTranscript}
              disabled={txBusy || !txText.trim() || !txTitle.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors"
            >
              {txBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookOpen className="w-3.5 h-3.5" />}
              Ingest Transcript
            </button>
          </div>
        </Card>

        {/* ── Recent Sources ── */}
        {stats && stats.recentSources.length > 0 && (
          <Card>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> Recent Knowledge Sources</h3>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {stats.recentSources.map(s => (
                <div key={s.source} className="flex items-center gap-3 text-xs py-1.5 border-b border-border/40 last:border-0">
                  <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] bg-muted border border-border text-muted-foreground font-mono shrink-0">{s.chunk_type}</span>
                  <span className="flex-1 truncate font-mono text-foreground/80">{s.source}</span>
                  <span className="text-muted-foreground shrink-0">{new Date(s.updated_at).toLocaleDateString("en-NG")}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </AdminLoginGate>
  );
}

function AdSenseDiagnosticsSection({ auth }: { auth: AdminAuth }) {
  const { data: config, isLoading, refetch, isRefetching } = useQuery<AdSenseConfig>({
    queryKey: ["admin-adsense-diagnostics"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/admin/adsense-diagnostics`, {
        headers: { Authorization: `Bearer ${auth.adminToken}` },
      });
      if (!r.ok) throw new Error("Failed to load AdSense diagnostics");
      return r.json();
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
    enabled: !!auth.adminToken,
  });

  const [runtime, setRuntime] = useState<AdSenseRuntime | null>(null);

  useEffect(() => {
    function measure() {
      const insEls = document.querySelectorAll("ins.adsbygoogle");
      const filled = Array.from(insEls).filter(
        el => el.getAttribute("data-adsbygoogle-status") === "done"
      ).length;
      const scriptLoaded = Boolean(
        document.querySelector('script[src*="pagead2.googlesyndication.com"]')
      );
      const queue = (window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle;
      const queueLen = Array.isArray(queue) ? queue.length : -1;
      let consent = null;
      try {
        const raw = localStorage.getItem("jctm_cookie_consent_v2");
        consent = raw ? JSON.parse(raw) : null;
      } catch { /* ignore */ }
      setRuntime({
        scriptLoaded,
        adsboogleQueueLength: queueLen,
        slotsInDOM: insEls.length,
        slotsFilled: filled,
        consent,
        measuredAt: new Date().toISOString(),
      });
    }
    measure();
    const id = setInterval(measure, 10_000);
    return () => clearInterval(id);
  }, []);

  const fmtSlotName = (n: string) =>
    n.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());

  const adsTxtColors: Record<string, string> = {
    ok:      "text-emerald-400 border-emerald-500/30 bg-emerald-500/8",
    missing: "text-amber-400 border-amber-500/30 bg-amber-500/8",
    wrong:   "text-red-400 border-red-500/30 bg-red-500/8",
    error:   "text-zinc-400 border-zinc-500/30 bg-zinc-500/8",
  };
  const adsTxtIcon: Record<string, React.ReactNode> = {
    ok:      <CheckCircle className="w-4 h-4 text-emerald-400" />,
    missing: <AlertCircle className="w-4 h-4 text-amber-400" />,
    wrong:   <AlertCircle className="w-4 h-4 text-red-400" />,
    error:   <Info className="w-4 h-4 text-zinc-400" />,
  };
  const adsTxtMsg: Record<string, string> = {
    ok:      "ads.txt present and publisher ID matches",
    missing: "ads.txt not found in the build output",
    wrong:   "ads.txt exists but publisher ID does not match",
    error:   "Could not read ads.txt",
  };

  return (
    <AdminLoginGate role="sermon" auth={auth} title="AdSense Diagnostics">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <SectionHeader
            title="AdSense Diagnostics"
            description="Server-side config + live browser runtime — 10s auto-refresh"
          />
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading diagnostics…
          </div>
        )}

        {config && (
          <>
            {/* ── Top metric cards ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricCard
                label="Publisher ID"
                value={config.publisherValid ? "Valid" : "Invalid"}
                icon={<CheckCircle className={`w-4 h-4 ${config.publisherValid ? "text-emerald-400" : "text-red-400"}`} />}
              />
              <MetricCard
                label="Slots Configured"
                value={`${config.configuredSlots} / ${config.totalSlots}`}
                icon={<Hash className="w-4 h-4" />}
              />
              <MetricCard
                label="Script Loaded"
                value={runtime ? (runtime.scriptLoaded ? "Yes" : "No") : "…"}
                icon={<CircleDot className={`w-4 h-4 ${runtime?.scriptLoaded ? "text-emerald-400" : "text-amber-400"}`} />}
              />
              <MetricCard
                label="Slots Filled"
                value={runtime ? `${runtime.slotsFilled} / ${runtime.slotsInDOM}` : "…"}
                icon={<DollarSign className="w-4 h-4" />}
              />
            </div>

            {/* ── Publisher Setup Card ── */}
            <Card>
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-amber-400" /> Publisher Configuration
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-border/40">
                  <span className="text-xs text-muted-foreground">Publisher ID</span>
                  <span className="font-mono text-xs text-foreground flex items-center gap-2">
                    {config.publisherId}
                    {config.publisherValid
                      ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      : <AlertCircle className="w-3.5 h-3.5 text-red-400" />}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border/40">
                  <span className="text-xs text-muted-foreground">Source</span>
                  <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${
                    config.isHardcodedFallback
                      ? "text-amber-400 border-amber-500/30 bg-amber-500/8"
                      : "text-emerald-400 border-emerald-500/30 bg-emerald-500/8"
                  }`}>
                    {config.isHardcodedFallback ? "hardcoded fallback" : config.envKeyUsed}
                  </span>
                </div>
                {config.isHardcodedFallback && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 flex gap-2 text-xs text-amber-300">
                    <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>
                      Set <code className="font-mono bg-amber-500/10 px-1 rounded">VITE_ADSENSE_CLIENT_ID</code> as a build-time env var to avoid relying on the hardcoded fallback.
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between py-2 border-b border-border/40">
                  <span className="text-xs text-muted-foreground">VITE_ADSENSE_ENABLE flag</span>
                  <span className={`text-xs font-semibold ${config.enableFlag ? "text-emerald-400" : "text-amber-400"}`}>
                    {config.enableFlag ? "true (set)" : "not set — relies on import.meta.env.PROD"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-muted-foreground">AdSense account</span>
                  <a
                    href={`https://www.google.com/adsense/new/u/0/pub-${config.publisherId.replace("ca-pub-", "")}/home`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-accent hover:text-accent/80 flex items-center gap-1 transition-colors"
                  >
                    Open AdSense Console <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </Card>

            {/* ── ads.txt Status ── */}
            <Card>
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" /> ads.txt Verification
              </h3>
              <div className={`rounded-xl border p-3.5 flex items-start gap-3 ${adsTxtColors[config.adsTxt.status]}`}>
                {adsTxtIcon[config.adsTxt.status]}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{adsTxtMsg[config.adsTxt.status]}</p>
                  {config.adsTxt.content && (
                    <pre className="mt-2 text-[11px] font-mono opacity-75 whitespace-pre-wrap break-all">
                      {config.adsTxt.content.trim()}
                    </pre>
                  )}
                  {config.adsTxt.status === "missing" && (
                    <p className="text-xs mt-1 opacity-80">
                      ads.txt is generated by <code className="font-mono">scripts/write-ads-txt.mjs</code> during the Vite build. Run a production build to regenerate it.
                    </p>
                  )}
                </div>
                <a
                  href="/ads.txt"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity shrink-0"
                >
                  View <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </Card>

            {/* ── Browser Runtime ── */}
            {runtime && (
              <Card>
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-violet-400" /> Live Browser Runtime
                  <span className="ml-auto text-[10px] font-normal text-muted-foreground/60">
                    Measured at {new Date(runtime.measuredAt).toLocaleTimeString()} · refreshes every 10s
                  </span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {/* Script loaded */}
                  <div className={`rounded-xl border p-3.5 ${runtime.scriptLoaded ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">AdSense Script</p>
                    <p className={`text-base font-bold ${runtime.scriptLoaded ? "text-emerald-400" : "text-amber-400"}`}>
                      {runtime.scriptLoaded ? "Loaded" : "Not found"}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                      {runtime.scriptLoaded ? "pagead2.googlesyndication.com detected in DOM" : "Script tag missing — may not have been injected yet"}
                    </p>
                  </div>

                  {/* adsbygoogle queue */}
                  <div className="rounded-xl border border-border/50 bg-muted/10 p-3.5">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Push Queue Length</p>
                    <p className="text-base font-bold text-foreground">
                      {runtime.adsboogleQueueLength === -1 ? "N/A" : runtime.adsboogleQueueLength}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                      window.adsbygoogle.length — total pushes sent to Google
                    </p>
                  </div>

                  {/* Slots in DOM */}
                  <div className="rounded-xl border border-border/50 bg-muted/10 p-3.5">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">ins.adsbygoogle in DOM</p>
                    <p className="text-base font-bold text-foreground">{runtime.slotsInDOM}</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                      {runtime.slotsFilled > 0
                        ? `${runtime.slotsFilled} filled (data-adsbygoogle-status="done")`
                        : runtime.slotsInDOM === 0
                          ? "No ad slots rendered on current page"
                          : "Pending fill from Google"}
                    </p>
                  </div>
                </div>

                {/* Consent state */}
                <div className="mt-4 rounded-xl border border-border/50 bg-muted/10 p-4">
                  <p className="text-xs font-semibold mb-3 flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-blue-400" /> Consent State (localStorage)
                  </p>
                  {runtime.consent === null ? (
                    <div className="flex items-center gap-2 text-xs text-amber-400">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        No consent decision saved yet. This visitor will see the cookie banner. Ads render immediately (non-personalized) via Consent Mode v2 — personalized ads require "Accept All".
                      </span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "Essential", value: true },
                        { label: "Analytics", value: runtime.consent.analytics },
                        { label: "Advertising", value: runtime.consent.advertising },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex items-center gap-2">
                          {value
                            ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            : <X className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                          <span className="text-xs text-foreground">{label}</span>
                          <span className={`ml-auto text-[10px] font-bold ${value ? "text-emerald-400" : "text-red-400"}`}>
                            {value ? "granted" : "denied"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* ── Slot Registry ── */}
            <Card>
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Hash className="w-4 h-4 text-primary" /> Ad Slot Registry
                <span className="ml-2 text-xs text-muted-foreground font-normal">
                  {config.configuredSlots}/{config.totalSlots} configured
                </span>
              </h3>
              <div className="divide-y divide-border/30">
                {config.slots.map(slot => (
                  <div key={slot.name} className="flex items-center justify-between py-2.5 gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {slot.configured
                        ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        : <AlertCircle className="w-3.5 h-3.5 text-amber-400/60 shrink-0" />}
                      <span className="text-xs text-foreground">{fmtSlotName(slot.name)}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {slot.slotId ? (
                        <span className="font-mono text-[11px] text-emerald-400">{slot.slotId}</span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground/50 italic">not set</span>
                      )}
                      <span className="text-[10px] font-mono text-muted-foreground/40 hidden sm:block">
                        {slot.envKey}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {config.configuredSlots < config.totalSlots && (
                <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 flex gap-2 text-xs text-amber-300">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    {config.totalSlots - config.configuredSlots} slot(s) have no slot ID. Set the corresponding{" "}
                    <code className="font-mono bg-amber-500/10 px-1 rounded">VITE_ADSENSE_SLOT_*</code> env vars in the Replit Secrets panel, then trigger a production build.
                  </span>
                </div>
              )}
            </Card>

            {/* ── Consent Mode Config ── */}
            <Card>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-400" /> Google Consent Mode v2
              </h3>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Default signals set to <code className="font-mono bg-muted px-1 rounded">denied</code> in <code className="font-mono bg-muted px-1 rounded">index.html</code> before any scripts load.</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span><code className="font-mono bg-muted px-1 rounded">wait_for_update: 2000</code> — Google waits 2 seconds for a consent signal before deciding ad type (personalized vs non-personalized).</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Ad slots render immediately for all visitors. Personalization requires explicit acceptance via the cookie banner.</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Consent update signals fire via <code className="font-mono bg-muted px-1 rounded">gtag("consent","update",…)</code> in <code className="font-mono bg-muted px-1 rounded">CookieConsent.tsx</code>.</span>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>
    </AdminLoginGate>
  );
}

function AIDashboardSection({ auth }: { auth: AdminAuth }) {
  const { data, isLoading, refetch, isRefetching } = useQuery<AIDashboardData>({
    queryKey: ["admin-ai-dashboard"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/admin/ai-dashboard`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load AI dashboard");
      return r.json();
    },
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  const tierLabels: Record<string, { label: string; desc: string; icon: React.ReactNode; color: string }> = {
    local:          { label: "Tier 1 — Local Engine",   desc: "Exact-match + TF-IDF scoring",       icon: <Cpu className="w-4 h-4" />,     color: "text-violet-400 border-violet-500/30 bg-violet-500/10" },
    rag:            { label: "Tier 2 — RAG",            desc: "pgvector semantic search + context",  icon: <Database className="w-4 h-4" />, color: "text-blue-400 border-blue-500/30 bg-blue-500/10" },
    "local-enhanced": { label: "Tier 3 — Enhanced",    desc: "Local template generation",           icon: <Layers className="w-4 h-4" />,   color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
    "external-ai":  { label: "External AI (disabled)",  desc: "No longer in use — fully local",     icon: <X className="w-4 h-4" />,        color: "text-red-400 border-red-500/30 bg-red-500/10" },
  };

  const subsystemIcons: Record<string, React.ReactNode> = {
    database:          <Database className="w-3.5 h-3.5" />,
    ai:                <Bot className="w-3.5 h-3.5" />,
    knowledgeBase:     <BookOpen className="w-3.5 h-3.5" />,
    pushNotifications: <Bell className="w-3.5 h-3.5" />,
    youtubeSync:       <Tv2 className="w-3.5 h-3.5" />,
    email:             <Mail className="w-3.5 h-3.5" />,
  };

  const subsystemLabels: Record<string, string> = {
    database: "Database", ai: "AI Engine", knowledgeBase: "Knowledge Base",
    pushNotifications: "Push Notifications", youtubeSync: "YouTube Sync", email: "Email",
  };

  const fmtTime = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
  };

  const fmtUptime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <AdminLoginGate role="sermon" auth={auth} title="AI Engine Dashboard">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <SectionHeader title="AI Engine Dashboard" description="Live telemetry — Zero External API · Local-first · 30s auto-refresh" />
          <button onClick={() => refetch()} disabled={isRefetching} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading AI metrics…
          </div>
        )}

        {data && (
          <>
            {/* ── Overall Stats ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricCard label="Total AI Responses" value={data.feedback.total.toLocaleString()} icon={<Bot className="w-4 h-4" />} />
              <MetricCard label="Avg Rating" value={data.feedback.avgRating != null ? `${data.feedback.avgRating}/5` : "No data"} icon={<Sparkles className="w-4 h-4" />} />
              <MetricCard label="Avg Latency" value={data.feedback.avgLatencyMs != null ? `${data.feedback.avgLatencyMs}ms` : "No data"} icon={<Zap className="w-4 h-4" />} />
              <MetricCard label="Knowledge Chunks" value={`${data.knowledgeBase.embeddedChunks}/${data.knowledgeBase.totalChunks}`} icon={<BookOpen className="w-4 h-4" />} />
            </div>

            {/* ── AI Architecture Banner ── */}
            <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-violet-300">Zero External AI · Fully Local Architecture</p>
                <p className="text-xs text-muted-foreground mt-0.5">All AI inference runs on-platform. No OpenAI API key required. Mode: <span className="font-mono text-violet-300">{data.cron.ai.mode}</span></p>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold shrink-0">
                {data.health.status.toUpperCase()}
              </span>
            </div>

            {/* ── 3-Tier Engine Cards ── */}
            <Card>
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Layers className="w-4 h-4 text-primary" /> Inference Tiers</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(["tier1", "tier2", "tier3"] as const).map((key, i) => {
                  const tier = data.health.ai[key];
                  const styles = [
                    "text-violet-400 border-violet-500/30 bg-violet-500/8",
                    "text-blue-400 border-blue-500/30 bg-blue-500/8",
                    "text-emerald-400 border-emerald-500/30 bg-emerald-500/8",
                  ][i];
                  const icons = [<Cpu key="c" className="w-4 h-4" />, <Database key="d" className="w-4 h-4" />, <Layers key="l" className="w-4 h-4" />];
                  return (
                    <div key={key} className={`rounded-xl border p-4 ${styles}`}>
                      <div className="flex items-center gap-2 mb-2">
                        {icons[i]}
                        <span className="text-xs font-semibold">{tier.name}</span>
                        <StatusDot status={tier.status} />
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed mb-2">{tier.detail}</p>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">Latency</span>
                        <span className="font-mono font-semibold">{tier.latencyMs}ms</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* ── Per-Tier Feedback Quality ── */}
            <Card>
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" /> Response Quality by Tier</h3>
              {data.feedback.byTier.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No feedback recorded yet — quality scores appear as users interact with TempleBots.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground border-b border-border">
                        <th className="pb-2 pr-4">Tier</th>
                        <th className="pb-2 pr-4 text-right">Responses</th>
                        <th className="pb-2 pr-4 text-right">Avg Rating</th>
                        <th className="pb-2 pr-4 text-right">Avg Latency</th>
                        <th className="pb-2 text-right">Helpful %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {data.feedback.byTier.map(row => {
                        const meta = tierLabels[row.tier] ?? { label: row.tier, color: "text-zinc-400 border-zinc-500/30 bg-zinc-500/10" };
                        return (
                          <tr key={row.tier} className="text-sm">
                            <td className="py-2.5 pr-4">
                              <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border font-medium ${meta.color}`}>
                                {meta.label}
                              </span>
                            </td>
                            <td className="py-2.5 pr-4 text-right font-mono text-xs">{row.total.toLocaleString()}</td>
                            <td className="py-2.5 pr-4 text-right">
                              {row.avgRating != null ? (
                                <span className={`text-xs font-semibold ${row.avgRating >= 4 ? "text-emerald-400" : row.avgRating >= 3 ? "text-amber-400" : "text-red-400"}`}>
                                  {row.avgRating}/5
                                </span>
                              ) : <span className="text-muted-foreground text-xs">—</span>}
                            </td>
                            <td className="py-2.5 pr-4 text-right font-mono text-xs">{row.avgLatencyMs != null ? `${row.avgLatencyMs}ms` : "—"}</td>
                            <td className="py-2.5 text-right">
                              {row.helpfulPct != null ? (
                                <span className={`text-xs font-semibold ${row.helpfulPct >= 70 ? "text-emerald-400" : row.helpfulPct >= 50 ? "text-amber-400" : "text-red-400"}`}>
                                  {row.helpfulPct}%
                                </span>
                              ) : <span className="text-muted-foreground text-xs">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* ── Subsystem Health Grid ── */}
            <Card>
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Server className="w-4 h-4 text-primary" /> Platform Subsystems</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(data.health.subsystems).map(([key, sub]) => (
                  <div key={key} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                    <div className="text-muted-foreground">{subsystemIcons[key] ?? <Activity className="w-3.5 h-3.5" />}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <StatusDot status={sub.status} />
                        <span className="text-xs font-medium">{subsystemLabels[key] ?? key}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">{sub.detail}</p>
                    </div>
                    {sub.latencyMs != null && (
                      <span className="text-[11px] font-mono text-muted-foreground shrink-0">{sub.latencyMs}ms</span>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            {/* ── Feature Flags + System Resources ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-primary" /> Feature Flags</h3>
                <div className="space-y-1.5">
                  {Object.entries(data.health.features).map(([key, enabled]) => (
                    <div key={key} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                      {enabled
                        ? <span className="flex items-center gap-1 text-emerald-400 font-semibold"><CheckCircle className="w-3 h-3" /> Enabled</span>
                        : <span className="flex items-center gap-1 text-zinc-500"><X className="w-3 h-3" /> Off</span>
                      }
                    </div>
                  ))}
                </div>
              </Card>

              <div className="space-y-4">
                <Card>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Cpu className="w-4 h-4 text-primary" /> System Resources</h3>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Memory</span>
                        <span className="font-mono">{data.health.resources.memoryUsedMb}MB / {data.health.resources.memoryTotalMb}MB</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${data.health.resources.memoryPct > 80 ? "bg-red-500" : data.health.resources.memoryPct > 60 ? "bg-amber-500" : "bg-emerald-500"}`}
                          style={{ width: `${data.health.resources.memoryPct}%` }}
                        />
                      </div>
                    </div>
                    <ConfigRow label="Uptime" value={fmtUptime(data.health.resources.uptimeSeconds)} />
                    <ConfigRow label="Node" value={data.health.resources.nodeVersion} mono />
                    <ConfigRow label="Platform" value={data.health.resources.platform} mono />
                  </div>
                </Card>

                <Card>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> Background Jobs</h3>
                  <div className="space-y-1.5">
                    {Object.entries(data.cron.running).map(([job, running]) => (
                      <div key={job} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground capitalize">{job.replace(/([A-Z])/g, " $1").trim()}</span>
                        {running
                          ? <span className="flex items-center gap-1 text-emerald-400 font-semibold"><Activity className="w-3 h-3" /> Running</span>
                          : <span className="flex items-center gap-1 text-zinc-500"><Clock className="w-3 h-3" /> Stopped</span>
                        }
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>

            {/* ── Sync Timing ── */}
            <Card>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Tv2 className="w-4 h-4 text-primary" /> Sync Schedule</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <ConfigRow label="Last RSS sync"  value={fmtTime(data.cron.youtube.lastRSSSync)} />
                <ConfigRow label="Next RSS sync"  value={fmtTime(data.cron.youtube.nextRSSSync)} />
                <ConfigRow label="Last API sync"  value={fmtTime(data.cron.youtube.lastAPISync)} />
                <ConfigRow label="Last full sync" value={fmtTime(data.cron.youtube.lastFullSync)} />
                <ConfigRow label="WebSub renewal" value={fmtTime(data.cron.websub.lastRenewal)} />
                <ConfigRow label="YT quota"       value={data.cron.youtube.quotaPaused ? "Paused" : "Active"} status={data.cron.youtube.quotaPaused ? "warn" : "ok"} />
              </div>
              {data.cron.lastSyncError && (
                <div className="mt-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                  Last sync error: {data.cron.lastSyncError}
                </div>
              )}
            </Card>

            <p className="text-[11px] text-muted-foreground text-right">Last refreshed: {new Date(data.generatedAt).toLocaleTimeString("en-NG")}</p>
          </>
        )}
      </div>
    </AdminLoginGate>
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

// ─── Email Campaign Section ───────────────────────────────────────────────────

interface CampaignRow {
  id: number;
  campaign_key: string;
  conference_title: string;
  status: "pending" | "running" | "completed" | "failed";
  total_recipients: number;
  sent: number;
  failed: number;
  skipped: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  error: string | null;
  duration_seconds: number | null;
}

interface EmailAnalyticsData {
  smtp: { configured: boolean; host: string | null; from: string | null };
  campaignStats: { status: string; count: string; total_sent: string; total_failed: string; total_recipients: string }[];
  sendLogSummary: { email_type: string; sent_count: string; failed_count: string; last_sent: string | null }[];
  globalUnsubscribes: number | null;
  recentCampaigns: CampaignRow[];
  generatedAt: string;
}

function EmailCampaignSection({ auth }: { auth: ReturnType<typeof useAdminAuth> }) {
  const qc = useQueryClient();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [retryingKey, setRetryingKey] = useState<string | null>(null);

  const { data: analytics, isLoading } = useQuery<EmailAnalyticsData>({
    queryKey: ["email-analytics"],
    queryFn: () =>
      fetch(`${BASE}/api/admin/email/analytics`, { credentials: "include" }).then(r => r.json()),
    refetchInterval: (query) => {
      const d = query.state.data;
      const hasRunning = d?.recentCampaigns?.some(
        (c: CampaignRow) => c.status === "running" || c.status === "pending",
      );
      return hasRunning ? 5000 : 30000;
    },
  });

  const { data: campaigns } = useQuery<{ campaigns: CampaignRow[]; total: number }>({
    queryKey: ["email-campaigns"],
    queryFn: () =>
      fetch(`${BASE}/api/admin/email/campaigns?limit=20`, { credentials: "include" }).then(r => r.json()),
    refetchInterval: 15000,
  });

  const resendMutation = useMutation({
    mutationFn: async (campaign_key: string) => {
      const res = await fetch(`${BASE}/api/admin/email/resend-failed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ campaign_key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Retry failed");
      return data as { requeued: number; message: string; campaignKey: string };
    },
    onSuccess: (data) => {
      toast.success(data.message ?? `Re-queued ${data.requeued} failed recipients`);
      qc.invalidateQueries({ queryKey: ["email-analytics"] });
      qc.invalidateQueries({ queryKey: ["email-campaigns"] });
      setRetryingKey(null);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Retry failed");
      setRetryingKey(null);
    },
  });

  const handleResend = (key: string) => {
    if (!auth.isAdmin) { toast.error("Authentication required"); return; }
    setRetryingKey(key);
    resendMutation.mutate(key);
  };

  const totalSent = analytics?.campaignStats.reduce((s, r) => s + Number(r.total_sent), 0) ?? 0;
  const totalFailed = analytics?.campaignStats.reduce((s, r) => s + Number(r.total_failed), 0) ?? 0;
  const totalCampaigns = analytics?.campaignStats.reduce((s, r) => s + Number(r.count), 0) ?? 0;

  const allCampaigns = campaigns?.campaigns ?? analytics?.recentCampaigns ?? [];
  const hasRunning = allCampaigns.some(c => c.status === "running" || c.status === "pending");

  const chartData = [...(analytics?.recentCampaigns ?? [])]
    .reverse()
    .slice(-8)
    .map(c => ({
      name: c.campaign_key
        .replace(/^ministers-conference-\d{4}-/, "")
        .replace(/-\d{13}$/, "")
        .replace(/-/g, " ")
        .trim()
        .slice(0, 14) || c.conference_title.slice(0, 14),
      sent: c.sent,
      failed: c.failed,
      skipped: c.skipped,
    }));

  return (
    <AdminLoginGate role="livestream" auth={auth}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <SectionHeader
            title="Email Campaign Centre"
            description="Live delivery progress, analytics, and one-click retry controls for all conference email campaigns."
          />
          <button
            onClick={() => {
              qc.invalidateQueries({ queryKey: ["email-analytics"] });
              qc.invalidateQueries({ queryKey: ["email-campaigns"] });
            }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${hasRunning ? "animate-spin" : ""}`} />
            {hasRunning ? "Live" : "Refresh"}
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading email analytics…
          </div>
        ) : (
          <>
            {/* ── Summary stat cards ────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className={`rounded-xl border p-4 col-span-2 sm:col-span-1 ${analytics?.smtp.configured ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
                <div className="flex items-center gap-2 mb-1">
                  {analytics?.smtp.configured
                    ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                    : <AlertCircle className="w-3.5 h-3.5 text-amber-500" />}
                  <span className="text-xs text-muted-foreground font-medium">SMTP</span>
                </div>
                <p className={`text-lg font-bold ${analytics?.smtp.configured ? "text-emerald-600" : "text-amber-600"}`}>
                  {analytics?.smtp.configured ? "Connected" : "Not Set Up"}
                </p>
                {analytics?.smtp.host && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate font-mono">{analytics.smtp.host}</p>
                )}
              </div>
              <MetricCard label="Campaigns" value={totalCampaigns} icon={<Send className="w-3 h-3" />} />
              <MetricCard label="Delivered" value={totalSent.toLocaleString()} icon={<CheckCircle className="w-3 h-3 text-emerald-500" />} />
              <MetricCard label="Failed" value={totalFailed.toLocaleString()} icon={<AlertCircle className="w-3 h-3 text-red-500" />} />
              <MetricCard label="Unsubscribed" value={(analytics?.globalUnsubscribes ?? 0).toLocaleString()} icon={<Mail className="w-3 h-3" />} />
            </div>

            {/* ── Delivery rate bar chart ───────────────────────────── */}
            {chartData.length > 0 && (
              <Card>
                <h3 className="font-semibold text-sm flex items-center gap-2 mb-4">
                  <BarChart3 className="w-4 h-4 text-primary" /> Campaign Delivery Overview
                </h3>
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)" }}
                      cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                    />
                    <Bar dataKey="sent" name="Delivered" fill="#22c55e" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="failed" name="Failed" fill="#ef4444" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="skipped" name="Skipped" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-4 mt-2 justify-center">
                  {[{ color: "#22c55e", label: "Delivered" }, { color: "#ef4444", label: "Failed" }, { color: "#94a3b8", label: "Skipped" }].map(l => (
                    <span key={l.label} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: l.color }} />
                      {l.label}
                    </span>
                  ))}
                </div>
              </Card>
            )}

            {/* ── Campaign list ─────────────────────────────────────── */}
            <Card className="p-0 overflow-hidden">
              <div className="p-4 border-b border-border">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Send className="w-4 h-4 text-primary" />
                  All Campaigns
                  {allCampaigns.length > 0 && (
                    <span className="ml-auto text-[10px] text-muted-foreground font-normal">
                      {allCampaigns.length} total
                    </span>
                  )}
                </h3>
              </div>
              <div className="divide-y divide-border">
                {allCampaigns.length === 0 ? (
                  <div className="p-10 text-center text-sm text-muted-foreground">
                    No campaigns launched yet
                  </div>
                ) : (
                  allCampaigns.map((c) => {
                    const isRunning = c.status === "running" || c.status === "pending";
                    const progress = c.total_recipients > 0
                      ? Math.min(100, Math.round(((c.sent + c.failed) / c.total_recipients) * 100))
                      : 0;
                    const deliveryRate = (c.sent + c.failed) > 0
                      ? Math.round((c.sent / (c.sent + c.failed)) * 100)
                      : null;
                    const isExpanded = expandedKey === c.campaign_key;
                    const isRetrying = retryingKey === c.campaign_key;

                    return (
                      <div key={c.campaign_key}>
                        <div className="p-4 hover:bg-muted/20 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                              isRunning ? "bg-blue-500 animate-pulse" :
                              c.status === "completed" ? "bg-emerald-500" :
                              c.status === "failed" ? "bg-red-500" : "bg-muted-foreground"
                            }`} />

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                <p className="text-sm font-semibold truncate max-w-[220px]">{c.conference_title}</p>
                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                                  isRunning ? "bg-blue-500/10 border-blue-500/30 text-blue-500" :
                                  c.status === "completed" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600" :
                                  c.status === "failed" ? "bg-red-500/10 border-red-500/30 text-red-500" :
                                  "bg-muted border-border text-muted-foreground"
                                }`}>{c.status}</span>
                                {hasRunning && isRunning && (
                                  <span className="text-[10px] text-blue-500 font-mono font-semibold">{progress}%</span>
                                )}
                              </div>

                              {/* Progress bar */}
                              {c.total_recipients > 0 && (
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                    <motion.div
                                      className={`h-full rounded-full transition-all ${
                                        isRunning ? "bg-blue-500" :
                                        c.status === "completed" ? "bg-emerald-500" : "bg-red-400"
                                      }`}
                                      initial={{ width: 0 }}
                                      animate={{ width: `${progress}%` }}
                                      transition={{ duration: 0.6, ease: "easeOut" }}
                                    />
                                  </div>
                                  <span className="text-[10px] text-muted-foreground font-mono w-8 text-right shrink-0">{progress}%</span>
                                </div>
                              )}

                              {/* Stats row */}
                              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                <span className="flex items-center gap-1">
                                  <Users className="w-3 h-3" /> {c.total_recipients.toLocaleString()}
                                </span>
                                <span className="flex items-center gap-1 text-emerald-600">
                                  <CheckCircle className="w-3 h-3" /> {c.sent.toLocaleString()} sent
                                </span>
                                {c.failed > 0 && (
                                  <span className="flex items-center gap-1 text-red-500">
                                    <AlertCircle className="w-3 h-3" /> {c.failed.toLocaleString()} failed
                                  </span>
                                )}
                                {c.skipped > 0 && (
                                  <span className="flex items-center gap-1">
                                    <Hash className="w-3 h-3" /> {c.skipped.toLocaleString()} skipped
                                  </span>
                                )}
                                {deliveryRate !== null && (
                                  <span className="font-semibold text-foreground">{deliveryRate}% rate</span>
                                )}
                                {c.duration_seconds && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> {c.duration_seconds}s
                                  </span>
                                )}
                                <span className="text-[10px] ml-auto">{rel(c.created_at)}</span>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              {c.failed > 0 && !isRunning && (
                                <motion.button
                                  whileHover={{ scale: 1.03 } as never}
                                  whileTap={{ scale: 0.97 } as never}
                                  onClick={() => handleResend(c.campaign_key)}
                                  disabled={isRetrying}
                                  title={`Retry ${c.failed} failed recipients`}
                                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {isRetrying
                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                    : <RefreshCw className="w-3 h-3" />}
                                  Retry {c.failed.toLocaleString()}
                                </motion.button>
                              )}
                              <button
                                onClick={() => setExpandedKey(isExpanded ? null : c.campaign_key)}
                                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                                title="Show details"
                              >
                                <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Expanded detail drawer */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              key="detail"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden bg-muted/20 border-t border-border"
                            >
                              <div className="p-4 space-y-1.5">
                                <ConfigRow label="Campaign Key" value={c.campaign_key} mono />
                                <ConfigRow label="Created" value={new Date(c.created_at).toLocaleString()} />
                                <ConfigRow label="Started" value={c.started_at ? new Date(c.started_at).toLocaleString() : "—"} />
                                <ConfigRow label="Completed" value={c.completed_at ? new Date(c.completed_at).toLocaleString() : "—"} />
                                <ConfigRow label="Duration" value={c.duration_seconds ? `${c.duration_seconds}s` : "—"} />
                                {c.error && (
                                  <div className="text-xs text-red-500 bg-red-500/5 border border-red-500/20 rounded-lg p-3 mt-2 font-mono break-all">
                                    {c.error}
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>

            {/* ── 7-day send log summary ───────────────────────────── */}
            {(analytics?.sendLogSummary ?? []).length > 0 && (
              <Card>
                <h3 className="font-semibold text-sm flex items-center gap-2 mb-4">
                  <Activity className="w-4 h-4 text-primary" /> 7-Day Send Log by Type
                </h3>
                <div className="divide-y divide-border">
                  {(analytics?.sendLogSummary ?? []).map((row) => {
                    const total = Number(row.sent_count) + Number(row.failed_count);
                    const rate = total > 0 ? Math.round((Number(row.sent_count) / total) * 100) : 100;
                    return (
                      <div key={row.email_type} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold font-mono text-primary">{row.email_type}</span>
                            {row.last_sent && (
                              <span className="text-[10px] text-muted-foreground">{rel(row.last_sent)}</span>
                            )}
                          </div>
                          <div className="h-1 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-all"
                              style={{ width: `${rate}%` }}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs shrink-0">
                          <span className="text-emerald-600 font-semibold">{Number(row.sent_count).toLocaleString()} ✓</span>
                          {Number(row.failed_count) > 0 && (
                            <span className="text-red-500 font-semibold">{Number(row.failed_count).toLocaleString()} ✗</span>
                          )}
                          <span className="text-muted-foreground w-8 text-right">{rate}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </AdminLoginGate>
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

// ─── Downloads Audit Section ──────────────────────────────────────────────────

interface IpActivityRow {
  ip: string;
  dl1h: number;
  dl24h: number;
  dl7d: number;
  dlTotal: number;
  totalBytes: number;
  firstSeen: string;
  lastSeen: string;
  blocked: boolean;
}

interface BlockedIpEntry {
  ip: string;
  reason: string;
  blockedBy: string;
  createdAt: string;
}

interface MediaAuditData {
  thresholds: { high: { per1h: number; per24h: number }; medium: { per1h: number; per24h: number } };
  summary: {
    jobsCreated: number;
    tokensIssued: number;
    downloadsServed: number;
    totalBytes: number;
    activeTokens: number;
    suspiciousIps: number;
  };
  autoBlockedLast24h: number;
  topVideos: { videoId: string; format: string; downloadCount: number; totalBytes: number; sermonTitle: string | null }[];
  recentDownloads: {
    ip: string;
    videoId: string | null;
    format: string | null;
    quality: string | null;
    bytesServed: number | null;
    jobId: string | null;
    createdAt: string;
  }[];
  formatBreakdown: { format: string; count: number }[];
  qualityBreakdown: { quality: string; count: number }[];
  dailyActivity: { day: string; jobs: number; downloads: number }[];
  ipActivity: IpActivityRow[];
  blockedIps: BlockedIpEntry[];
}

function fmtBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const FORMAT_COLORS: Record<string, string> = {
  mp4:  "bg-blue-500/10 text-blue-600 border-blue-200",
  mp3:  "bg-violet-500/10 text-violet-600 border-violet-200",
  m4a:  "bg-purple-500/10 text-purple-600 border-purple-200",
  jpeg: "bg-amber-500/10 text-amber-600 border-amber-200",
  png:  "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  webp: "bg-cyan-500/10 text-cyan-600 border-cyan-200",
};

function FormatBadge({ format }: { format: string | null }) {
  if (!format) return <span className="text-muted-foreground text-xs">—</span>;
  const cls = FORMAT_COLORS[format] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${cls}`}>
      {format}
    </span>
  );
}

// ─── Admin Job Queue Panel ────────────────────────────────────────────────────

type AdminJobStatus = "queued" | "processing" | "ready" | "failed";

interface AdminJob {
  jobId: string;
  type: string;
  sourceId: string;
  format: string;
  quality: string;
  status: AdminJobStatus;
  progress: number;
  error: string | null;
  title: string | null;
  fileSize: number | null;
  fileSizeFormatted: string | null;
  thumbnailUrl: string | null;
  retryCount: number;
  nextRetryAt: string | null;
  isPermanentFailure: boolean;
  hasFile: boolean;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

interface AdminJobsResponse {
  counts: { queued: number; processing: number; ready: number; failed: number; total: number };
  jobs: AdminJob[];
}

const STATUS_FILTER_OPTS: { value: string; label: string }[] = [
  { value: "",           label: "All" },
  { value: "queued",     label: "Queued" },
  { value: "processing", label: "Converting" },
  { value: "ready",      label: "Ready" },
  { value: "failed",     label: "Failed" },
];

const JOB_STATUS_STYLE: Record<AdminJobStatus, string> = {
  queued:     "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
  processing: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
  ready:      "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800",
  failed:     "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800",
};

function JobQueuePanel({ auth }: { auth: ReturnType<typeof useAdminAuth> }) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [purging, setPurging] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const { data, isLoading, isError, refetch, isFetching } = useQuery<AdminJobsResponse>({
    queryKey: ["admin-media-jobs", statusFilter],
    queryFn: async () => {
      const url = statusFilter
        ? `${BASE}/api/admin/media-jobs?status=${statusFilter}`
        : `${BASE}/api/admin/media-jobs`;
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load job queue");
      return r.json();
    },
    refetchInterval: (query) => {
      // Fast refresh when there are active jobs, slow when all quiet
      const d = query.state.data as AdminJobsResponse | undefined;
      if (!d) return 5000;
      return (d.counts.queued + d.counts.processing) > 0 ? 4000 : 15000;
    },
  });

  async function handleDelete(jobId: string) {
    setDeletingIds(prev => new Set([...prev, jobId]));
    try {
      const r = await fetch(`${BASE}/api/admin/media-jobs/${jobId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error("Delete failed");
      await queryClient.invalidateQueries({ queryKey: ["admin-media-jobs"] });
      toast.success("Job removed");
    } catch {
      toast.error("Failed to delete job");
    } finally {
      setDeletingIds(prev => { const s = new Set(prev); s.delete(jobId); return s; });
    }
  }

  async function handlePurge() {
    setPurging(true);
    try {
      const r = await fetch(`${BASE}/api/admin/media-jobs/purge`, {
        method: "POST",
        credentials: "include",
      });
      if (!r.ok) throw new Error("Purge failed");
      const result = await r.json() as { rowsDeleted: number; filesDeleted: number; bytesFreed: number };
      const freed = result.bytesFreed > 0
        ? ` · ${(result.bytesFreed / 1024 / 1024).toFixed(1)} MB freed`
        : "";
      toast.success(`Purged ${result.rowsDeleted} jobs, ${result.filesDeleted} files${freed}`);
      await queryClient.invalidateQueries({ queryKey: ["admin-media-jobs"] });
    } catch {
      toast.error("Purge failed");
    } finally {
      setPurging(false);
    }
  }

  const failedOrExpired = (data?.counts.failed ?? 0);

  return (
    <Card className="!p-0 overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-border">
        <div>
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Cpu className="w-4 h-4 text-primary" /> Live Job Queue
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            All conversion jobs across all users — cancel stuck jobs or purge failures
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={handlePurge}
            disabled={purging || failedOrExpired === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {purging ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            Purge failed{failedOrExpired > 0 ? ` (${failedOrExpired})` : ""}
          </button>
        </div>
      </div>

      {/* Count pills */}
      {data && (
        <div className="flex items-center gap-3 px-5 py-3 bg-muted/30 border-b border-border flex-wrap">
          {[
            { label: "Total",      value: data.counts.total,      cls: "bg-muted text-muted-foreground border-border" },
            { label: "Queued",     value: data.counts.queued,     cls: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800" },
            { label: "Converting", value: data.counts.processing, cls: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800" },
            { label: "Ready",      value: data.counts.ready,      cls: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800" },
            { label: "Failed",     value: data.counts.failed,     cls: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800" },
          ].map(({ label, value, cls }) => (
            <div key={label} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${cls}`}>
              {label}: <span className="tabular-nums font-bold">{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 px-5 py-2 border-b border-border overflow-x-auto">
        {STATUS_FILTER_OPTS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
              statusFilter === opt.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Job list */}
      <div className="divide-y divide-border">
        {isLoading && (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3 animate-pulse">
              <div className="w-9 h-9 rounded-lg bg-muted flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-40 bg-muted rounded" />
                <div className="h-2 w-24 bg-muted rounded" />
              </div>
            </div>
          ))
        )}

        {isError && (
          <div className="px-5 py-6 text-sm text-red-500 text-center">
            Failed to load job queue. Make sure you are logged in.
          </div>
        )}

        {data && data.jobs.length === 0 && (
          <div className="px-5 py-10 text-sm text-muted-foreground text-center">
            {statusFilter ? `No ${statusFilter} jobs found.` : "No jobs yet. Conversion jobs will appear here as users request downloads."}
          </div>
        )}

        {data?.jobs.map(job => {
          const age = rel(job.createdAt);
          const isActive = job.status === "queued" || job.status === "processing";
          const isDeleting = deletingIds.has(job.jobId);
          return (
            <div key={job.jobId} className={`flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors group ${isDeleting ? "opacity-40" : ""}`}>
              {/* Thumbnail */}
              <div className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                {job.thumbnailUrl ? (
                  <img src={job.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Download className="w-4 h-4 text-muted-foreground" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium truncate max-w-[200px]">
                    {job.title ?? "Untitled"}
                  </p>
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${JOB_STATUS_STYLE[job.status]}`}>
                    {job.status === "processing" ? `${job.progress}%` : job.status}
                  </span>
                  <FormatBadge format={job.format} />
                  <span className="text-[10px] text-muted-foreground uppercase font-medium">{job.quality}</span>
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <a
                    href={`https://youtu.be/${job.sourceId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-mono text-accent hover:underline flex items-center gap-0.5"
                  >
                    {job.sourceId}
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                  <span className="text-[10px] text-muted-foreground">{age}</span>
                  {job.retryCount > 0 && (
                    <span className="text-[10px] text-amber-500">↻ {job.retryCount} attempt{job.retryCount !== 1 ? "s" : ""}</span>
                  )}
                  {job.fileSizeFormatted && (
                    <span className="text-[10px] text-muted-foreground">{job.fileSizeFormatted}</span>
                  )}
                  {job.status === "failed" && job.isPermanentFailure && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">
                      <Lock className="w-2.5 h-2.5" /> Permanent failure
                    </span>
                  )}
                  {job.status === "failed" && !job.isPermanentFailure && job.nextRetryAt && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400" title={`Next retry: ${new Date(job.nextRetryAt).toLocaleString()}`}>
                      <RefreshCw className="w-2.5 h-2.5" /> Auto-retry {rel(job.nextRetryAt)}
                    </span>
                  )}
                  {job.status === "failed" && job.error && (
                    <span className="text-[10px] text-red-500 truncate max-w-[220px]" title={job.error}>
                      {job.error.length > 60 ? job.error.slice(0, 60) + "…" : job.error}
                    </span>
                  )}
                </div>

                {/* Progress bar for active jobs */}
                {isActive && (
                  <div className="mt-1.5 h-1 w-full bg-muted rounded-full overflow-hidden max-w-xs">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-violet-500 rounded-full transition-all duration-300"
                      style={{ width: job.status === "queued" ? "4%" : `${job.progress}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Cancel / Delete */}
              <button
                onClick={() => handleDelete(job.jobId)}
                disabled={isDeleting}
                title={isActive ? "Cancel job" : "Delete job"}
                className={`flex-shrink-0 p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100 ${
                  isActive
                    ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── IP Abuse Panel ───────────────────────────────────────────────────────────

function IpAbusePanel({ data, onRefresh }: { data: MediaAuditData; onRefresh: () => void }) {
  const queryClient = useQueryClient();
  const [blockingIp, setBlockingIp] = useState<string | null>(null);

  async function handleBlock(ip: string) {
    setBlockingIp(ip);
    try {
      const r = await fetch(`${BASE}/api/admin/block-ip`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip, reason: "Flagged: high download volume" }),
      });
      if (!r.ok) throw new Error("Block failed");
      toast.success(`Blocked ${ip}`);
      await queryClient.invalidateQueries({ queryKey: ["admin-media-audit"] });
      onRefresh();
    } catch {
      toast.error("Failed to block IP");
    } finally {
      setBlockingIp(null);
    }
  }

  async function handleUnblock(ip: string) {
    setBlockingIp(ip);
    try {
      const r = await fetch(`${BASE}/api/admin/block-ip/${encodeURIComponent(ip)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error("Unblock failed");
      toast.success(`Unblocked ${ip}`);
      await queryClient.invalidateQueries({ queryKey: ["admin-media-audit"] });
      onRefresh();
    } catch {
      toast.error("Failed to unblock IP");
    } finally {
      setBlockingIp(null);
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-bold text-sm">IP Activity &amp; Abuse Detection</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Rolling-window download counts per IP. Thresholds — High:&nbsp;
            <span className="font-semibold text-red-500">&gt;{data.thresholds.high.per1h}/1h</span> or&nbsp;
            <span className="font-semibold text-red-500">&gt;{data.thresholds.high.per24h}/24h</span>&nbsp;·&nbsp;
            Medium: <span className="font-semibold text-amber-500">&gt;{data.thresholds.medium.per1h}/1h</span> or&nbsp;
            <span className="font-semibold text-amber-500">&gt;{data.thresholds.medium.per24h}/24h</span>
          </p>
        </div>
        {data.summary.suspiciousIps > 0 && (
          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-600 border border-red-200 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400">
            <AlertCircle className="w-3 h-3" />
            {data.summary.suspiciousIps} flagged
          </span>
        )}
      </div>

      {data.ipActivity.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No IP activity on record yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-3 font-semibold text-muted-foreground">IP Address</th>
                <th className="text-left py-2 pr-3 font-semibold text-muted-foreground">Risk</th>
                <th className="text-right py-2 pr-3 font-semibold text-muted-foreground">1 h</th>
                <th className="text-right py-2 pr-3 font-semibold text-muted-foreground">24 h</th>
                <th className="text-right py-2 pr-3 font-semibold text-muted-foreground">7 d</th>
                <th className="text-right py-2 pr-3 font-semibold text-muted-foreground">All-time</th>
                <th className="text-right py-2 pr-3 font-semibold text-muted-foreground">Bytes</th>
                <th className="text-left py-2 pr-3 font-semibold text-muted-foreground">Last seen</th>
                <th className="text-left py-2 font-semibold text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.ipActivity.map((row) => {
                const isHigh    = row.dl1h >= data.thresholds.high.per1h || row.dl24h >= data.thresholds.high.per24h;
                const isMed     = !isHigh && (row.dl1h >= data.thresholds.medium.per1h || row.dl24h >= data.thresholds.medium.per24h);
                const isBlocked = row.blocked;
                const isBusy    = blockingIp === row.ip;

                const rowCls = isBlocked
                  ? "border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 opacity-60"
                  : isHigh
                  ? "border-b border-red-100 dark:border-red-900/30 bg-red-50/60 dark:bg-red-950/10 hover:bg-red-50 dark:hover:bg-red-950/20"
                  : isMed
                  ? "border-b border-amber-100 dark:border-amber-900/30 bg-amber-50/40 dark:bg-amber-950/10 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                  : "border-b border-border/40 hover:bg-muted/30";

                const riskBadge = isBlocked
                  ? <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold border bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"><Lock className="w-2.5 h-2.5" /> Blocked</span>
                  : isHigh
                  ? <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold border bg-red-100 text-red-600 border-red-200 dark:bg-red-950/40 dark:border-red-700 dark:text-red-400"><AlertCircle className="w-2.5 h-2.5" /> High</span>
                  : isMed
                  ? <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold border bg-amber-100 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-400"><AlertCircle className="w-2.5 h-2.5" /> Med</span>
                  : <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold border bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-400"><CheckCircle className="w-2.5 h-2.5" /> OK</span>;

                return (
                  <tr key={row.ip} className={`${rowCls} transition-colors`}>
                    <td className="py-2 pr-3 font-mono text-[10px]">{row.ip}</td>
                    <td className="py-2 pr-3">{riskBadge}</td>
                    <td className={`py-2 pr-3 text-right font-bold tabular-nums ${isHigh && row.dl1h >= data.thresholds.high.per1h ? "text-red-600 dark:text-red-400" : isMed && row.dl1h >= data.thresholds.medium.per1h ? "text-amber-600 dark:text-amber-400" : ""}`}>{row.dl1h}</td>
                    <td className={`py-2 pr-3 text-right font-bold tabular-nums ${isHigh && row.dl24h >= data.thresholds.high.per24h ? "text-red-600 dark:text-red-400" : isMed && row.dl24h >= data.thresholds.medium.per24h ? "text-amber-600 dark:text-amber-400" : ""}`}>{row.dl24h}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">{row.dl7d}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">{row.dlTotal}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">{fmtBytes(row.totalBytes)}</td>
                    <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">{rel(row.lastSeen)}</td>
                    <td className="py-2">
                      {isBlocked ? (
                        <button
                          onClick={() => handleUnblock(row.ip)}
                          disabled={isBusy}
                          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/30 transition-colors disabled:opacity-50"
                        >
                          {isBusy ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <CheckCircle className="w-2.5 h-2.5" />}
                          Unblock
                        </button>
                      ) : (
                        <button
                          onClick={() => handleBlock(row.ip)}
                          disabled={isBusy}
                          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
                        >
                          {isBusy ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Shield className="w-2.5 h-2.5" />}
                          Block
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ─── Blocked IPs Panel ────────────────────────────────────────────────────────

function BlockedIpsPanel({ blockedIps, onRefresh }: { blockedIps: BlockedIpEntry[]; onRefresh: () => void }) {
  const queryClient = useQueryClient();
  const [unblockingIp, setUnblockingIp] = useState<string | null>(null);

  async function handleUnblock(ip: string) {
    setUnblockingIp(ip);
    try {
      const r = await fetch(`${BASE}/api/admin/block-ip/${encodeURIComponent(ip)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error("Unblock failed");
      toast.success(`Unblocked ${ip}`);
      await queryClient.invalidateQueries({ queryKey: ["admin-media-audit"] });
      onRefresh();
    } catch {
      toast.error("Failed to unblock IP");
    } finally {
      setUnblockingIp(null);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-red-500" />
            Blocked IPs
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            These addresses are permanently denied download access. Click Unblock to restore access.
          </p>
        </div>
        {blockedIps.length > 0 && (
          <span className="shrink-0 inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400">
            {blockedIps.length} blocked
          </span>
        )}
      </div>

      {blockedIps.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No IPs are currently blocked.</p>
      ) : (
        <div className="divide-y divide-border">
          {blockedIps.map((entry) => {
            const isBusy = unblockingIp === entry.ip;
            return (
              <div key={entry.ip} className="flex items-center gap-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-xs font-semibold">{entry.ip}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {entry.reason} · blocked by <span className="font-medium">{entry.blockedBy}</span> · {rel(entry.createdAt)}
                  </p>
                </div>
                <button
                  onClick={() => handleUnblock(entry.ip)}
                  disabled={isBusy}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/30 transition-colors disabled:opacity-50"
                >
                  {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                  Unblock
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ─── Downloads Section ────────────────────────────────────────────────────────

function DownloadsSection({ auth }: { auth: ReturnType<typeof useAdminAuth> }) {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<MediaAuditData>({
    queryKey: ["admin-media-audit"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/admin/media-audit`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load download analytics");
      return r.json();
    },
    refetchInterval: 30_000,
  });

  return (
    <AdminLoginGate role="sermon" auth={auth} title="Download Analytics">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg">Download Analytics</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Audit log for all media conversions, tokenised links, and file downloads.
            </p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-muted transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4 animate-pulse">
                <div className="h-3 w-20 bg-muted rounded mb-2" />
                <div className="h-7 w-14 bg-muted rounded" />
              </div>
            ))}
          </div>
        )}

        {isError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            Failed to load download analytics. Make sure you are logged in.
          </div>
        )}

        {/* ── Live Job Queue ── */}
        <JobQueuePanel auth={auth} />

        {data && (
          <>
            {/* ── Summary Cards ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: "Conversions",    value: data.summary.jobsCreated.toLocaleString(),     icon: <Zap className="w-3.5 h-3.5" />,      color: "text-amber-500",  alert: false },
                { label: "Tokens Issued",  value: data.summary.tokensIssued.toLocaleString(),    icon: <Shield className="w-3.5 h-3.5" />,    color: "text-blue-500",   alert: false },
                { label: "Files Served",   value: data.summary.downloadsServed.toLocaleString(), icon: <Download className="w-3.5 h-3.5" />,  color: "text-emerald-500",alert: false },
                { label: "Data Served",    value: fmtBytes(data.summary.totalBytes),             icon: <Activity className="w-3.5 h-3.5" />,  color: "text-violet-500", alert: false },
                { label: "Live Tokens",    value: data.summary.activeTokens.toLocaleString(),    icon: <Clock className="w-3.5 h-3.5" />,     color: "text-orange-400", alert: false },
                { label: "Flagged IPs",    value: data.summary.suspiciousIps.toLocaleString(),   icon: <AlertCircle className="w-3.5 h-3.5" />, color: data.summary.suspiciousIps > 0 ? "text-red-500" : "text-muted-foreground", alert: data.summary.suspiciousIps > 0 },
              ].map(({ label, value, icon, color, alert }) => (
                <div key={label} className={`rounded-xl border p-4 ${alert ? "border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-800" : "border-border bg-card"}`}>
                  <div className={`flex items-center gap-1.5 text-xs mb-1.5 ${color}`}>
                    {icon}
                    <span className={alert ? color : "text-muted-foreground"}>{label}</span>
                  </div>
                  <p className={`text-2xl font-bold tabular-nums ${alert ? "text-red-600 dark:text-red-400" : "text-primary"}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* ── 14-Day Activity Chart ── */}
            {data.dailyActivity.length > 0 ? (
              <Card>
                <SectionHeader title="14-Day Activity" description="Daily conversions started vs files actually downloaded" />
                <ResponsiveContainer width="100%" height={180}>
                  <ComposedChart data={data.dailyActivity} margin={{ top: 0, right: 4, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(d: string) => d.slice(5)}
                    />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                      labelStyle={{ fontWeight: 700 }}
                    />
                    <Bar dataKey="jobs"      name="Conversions" fill="hsl(var(--accent))"   opacity={0.5} radius={[3,3,0,0]} />
                    <Bar dataKey="downloads" name="Downloads"   fill="#10b981" opacity={0.85} radius={[3,3,0,0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              </Card>
            ) : (
              <Card>
                <p className="text-sm text-muted-foreground text-center py-6">No download activity yet. Download buttons are now live across the platform.</p>
              </Card>
            )}

            <div className="grid lg:grid-cols-2 gap-5">
              {/* ── Format Breakdown ── */}
              <Card>
                <SectionHeader title="Format Breakdown" description="File types downloaded" />
                {data.formatBreakdown.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No downloads yet.</p>
                ) : (
                  <div className="space-y-2">
                    {data.formatBreakdown.map(({ format, count }) => {
                      const total = data.formatBreakdown.reduce((s, r) => s + r.count, 0);
                      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                      return (
                        <div key={format} className="flex items-center gap-3">
                          <FormatBadge format={format} />
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs font-bold tabular-nums w-8 text-right">{count}</span>
                          <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              {/* ── Quality Tier Breakdown ── */}
              <Card>
                <SectionHeader title="Quality Tier Breakdown" description="Which quality users choose most" />
                {(data.qualityBreakdown ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No quality data yet.</p>
                ) : (
                  <div className="space-y-2">
                    {(data.qualityBreakdown ?? []).map(({ quality, count }) => {
                      const total = (data.qualityBreakdown ?? []).reduce((s, r) => s + r.count, 0);
                      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                      const QUALITY_COLORS: Record<string, { bar: string; badge: string }> = {
                        ultra:  { bar: "bg-violet-500", badge: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-800" },
                        high:   { bar: "bg-blue-500",   badge: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800" },
                        medium: { bar: "bg-amber-500",  badge: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800" },
                        low:    { bar: "bg-slate-400",  badge: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700" },
                      };
                      const style = QUALITY_COLORS[quality] ?? { bar: "bg-muted-foreground", badge: "bg-muted text-muted-foreground border-border" };
                      const LABELS: Record<string, string> = { ultra: "1080p Full HD", high: "720p HD", medium: "480p", low: "360p" };
                      return (
                        <div key={quality} className="flex items-center gap-3">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border w-20 justify-center flex-shrink-0 ${style.badge}`}>
                            {LABELS[quality] ?? quality}
                          </span>
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${style.bar}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs font-bold tabular-nums w-8 text-right">{count}</span>
                          <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>

            {/* ── Top Downloaded Videos ── */}
            <Card>
              <SectionHeader title="Top Downloaded Sermons" description="Most requested content — ranked by completed downloads" />
              {data.topVideos.length === 0 ? (
                <p className="text-sm text-muted-foreground">No downloads yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 pr-3 font-semibold text-muted-foreground">#</th>
                        <th className="text-left py-2 pr-3 font-semibold text-muted-foreground">Sermon</th>
                        <th className="text-left py-2 pr-3 font-semibold text-muted-foreground">Format</th>
                        <th className="text-right py-2 pr-3 font-semibold text-muted-foreground">Downloads</th>
                        <th className="text-right py-2 font-semibold text-muted-foreground">Data Served</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topVideos.map(({ videoId, format, downloadCount, totalBytes, sermonTitle }, i) => (
                        <tr key={`${videoId}-${format}`} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="py-2 pr-3 text-muted-foreground tabular-nums">{i + 1}</td>
                          <td className="py-2 pr-3 max-w-[260px]">
                            <a
                              href={`https://youtu.be/${videoId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex flex-col gap-0.5 hover:text-accent transition-colors group"
                            >
                              {sermonTitle ? (
                                <span className="font-medium text-foreground group-hover:text-accent line-clamp-1">
                                  {sermonTitle}
                                </span>
                              ) : null}
                              <span className="font-mono text-[10px] text-muted-foreground flex items-center gap-0.5">
                                {videoId}
                                <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                              </span>
                            </a>
                          </td>
                          <td className="py-2 pr-3"><FormatBadge format={format} /></td>
                          <td className="py-2 pr-3 text-right font-bold tabular-nums">{downloadCount}</td>
                          <td className="py-2 text-right text-muted-foreground tabular-nums">{fmtBytes(totalBytes)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* ── Recent Downloads Feed ── */}
            <Card>
              <SectionHeader title="Recent Downloads" description="Last 25 files served — IPs partially masked" />
              {data.recentDownloads.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No download events yet. Download buttons are live — this feed will populate as users save content.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 font-semibold text-muted-foreground">Time</th>
                        <th className="text-left py-2 font-semibold text-muted-foreground">Video</th>
                        <th className="text-left py-2 font-semibold text-muted-foreground">Format</th>
                        <th className="text-left py-2 font-semibold text-muted-foreground">Quality</th>
                        <th className="text-right py-2 font-semibold text-muted-foreground">Size</th>
                        <th className="text-left py-2 font-semibold text-muted-foreground">IP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentDownloads.map((row, i) => (
                        <tr key={i} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                          <td className="py-2 text-muted-foreground whitespace-nowrap">{rel(row.createdAt)}</td>
                          <td className="py-2">
                            {row.videoId ? (
                              <a
                                href={`https://youtu.be/${row.videoId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono text-[10px] text-accent hover:underline"
                              >
                                {row.videoId}
                              </a>
                            ) : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="py-2"><FormatBadge format={row.format} /></td>
                          <td className="py-2 text-muted-foreground uppercase text-[10px]">{row.quality ?? "—"}</td>
                          <td className="py-2 text-right tabular-nums text-muted-foreground">
                            {row.bytesServed ? fmtBytes(row.bytesServed) : "—"}
                          </td>
                          <td className="py-2 font-mono text-[10px] text-muted-foreground">{row.ip}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* ── Auto-Block Guard Status ── */}
            <div className={`rounded-xl border p-4 flex items-start gap-4 ${data.autoBlockedLast24h > 0 ? "border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-800" : "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800"}`}>
              <div className={`mt-0.5 rounded-full p-2 ${data.autoBlockedLast24h > 0 ? "bg-red-100 dark:bg-red-900/40" : "bg-emerald-100 dark:bg-emerald-900/40"}`}>
                <Shield className={`w-4 h-4 ${data.autoBlockedLast24h > 0 ? "text-red-600" : "text-emerald-600"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm ${data.autoBlockedLast24h > 0 ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"}`}>
                  Auto-Block Guard — Active
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {data.autoBlockedLast24h > 0
                    ? `${data.autoBlockedLast24h} IP${data.autoBlockedLast24h !== 1 ? "s" : ""} automatically blocked in the last 24 hours for exceeding the download threshold (>${data.thresholds.high.per1h}/h or >${data.thresholds.high.per24h}/24h). See the blocked list below.`
                    : `No IPs auto-blocked in the last 24 hours. Threshold: >${data.thresholds.high.per1h} downloads/hour or >${data.thresholds.high.per24h} downloads/24h. The guard scans every 15 minutes.`}
                </p>
              </div>
              {data.autoBlockedLast24h > 0 && (
                <span className="shrink-0 text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">{data.autoBlockedLast24h}</span>
              )}
            </div>

            {/* ── IP Activity & Abuse Detection ── */}
            <IpAbusePanel data={data} onRefresh={refetch} />

            {/* ── Blocked IPs ── */}
            <BlockedIpsPanel blockedIps={data.blockedIps ?? []} onRefresh={refetch} />
          </>
        )}
      </div>
    </AdminLoginGate>
  );
}

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
              {section === "events"      && (
                <div className="space-y-8">
                  <EventPromotionsSection auth={livestreamAuth} />
                  <EventNotificationsSection auth={livestreamAuth} />
                </div>
              )}
              {section === "sermons"     && <SermonsSection auth={sermonAuth} />}
              {section === "gallery"     && <GallerySection auth={galleryAuth} />}
              {section === "testimonies" && <TestimoniesSection auth={sermonAuth} />}
              {section === "platform"    && <PlatformSection auth={sermonAuth} />}
              {section === "analytics"   && <AnalyticsDashboardSection auth={sermonAuth} />}
              {section === "ai"          && <AIDashboardSection auth={sermonAuth} />}
              {section === "ads"         && <AdSenseDiagnosticsSection auth={sermonAuth} />}
              {section === "credentials" && <CredentialsSection galleryAuth={galleryAuth} sermonAuth={sermonAuth} livestreamAuth={livestreamAuth} />}
              {section === "email"       && <EmailCampaignSection auth={livestreamAuth} />}
              {section === "knowledge"   && <KnowledgeSection auth={sermonAuth} />}
              {section === "downloads"   && <DownloadsSection auth={sermonAuth} />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

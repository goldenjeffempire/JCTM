import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Radio, Tv2, RefreshCw, CheckCircle, AlertCircle, Clock,
  BarChart3, Zap, Calendar, PlayCircle, Settings, Activity,
  ChevronRight, Eye, Users, MessageSquare, Check, Trash2,
  BookOpen, Sparkles, X, Loader2, ShieldCheck, Wifi,
} from "lucide-react";
import { useLivestreamStatus } from "@/hooks/useLivestreamStatus";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── Types ─────────────────────────────────────────────────────────────────────

interface BroadcastStatus {
  automation: {
    enabled: boolean;
    pollingInterval: string;
    sundayServiceWindowActive: boolean;
    rebroadcastDurationDays: number;
    smartCurationEnabled: boolean;
    timezone: string;
    channelId: string;
    youtubeApiConfigured: boolean;
  };
  nextScheduled: { sunday8amWAT: string; description: string };
  library: {
    totalSermons: number;
    lastSyncedAt: string | null;
    avgViewCount: number;
    topSermons: { videoId: string; title: string; viewCount: number }[];
  };
  serverTime: string;
  serverTimeWAT: string;
}

interface BroadcastQueue {
  strategy: "ai" | "algorithmic" | "fallback";
  curatedAt: string;
  primary: {
    videoId: string;
    title: string;
    thumbnailUrl: string | null;
    score: number;
    reason: string;
    viewCount: number | null;
  };
  queue: Array<{
    videoId: string;
    title: string;
    thumbnailUrl: string | null;
    score: number;
    reason: string;
    viewCount: number | null;
  }>;
}

interface BroadcastMetrics {
  overview: {
    totalViews: number;
    maxViews: number;
    avgViews: number;
    totalSermons: number;
    liveCount: number;
    featuredCount: number;
  };
  recentSermons: Array<{
    videoId: string;
    title: string;
    publishedAt: string;
    viewCount: number | null;
    isFeatured: boolean;
    isLive: boolean;
  }>;
}

// ─── Helper ────────────────────────────────────────────────────────────────────

function formatRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatCountdown(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Now";
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

// ─── Admin Page ────────────────────────────────────────────────────────────────

export default function Admin() {
  const qc = useQueryClient();
  const liveStatus = useLivestreamStatus();
  const [activeTab, setActiveTab] = useState<"overview" | "queue" | "schedule" | "metrics" | "testimonies" | "platform">("overview");

  const { data: broadcastStatus, isLoading: statusLoading } = useQuery<BroadcastStatus>({
    queryKey: ["broadcast-status"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/broadcast/status`);
      if (!res.ok) throw new Error("Failed to fetch broadcast status");
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const { data: queueData, isLoading: queueLoading, refetch: refetchQueue } = useQuery<BroadcastQueue>({
    queryKey: ["broadcast-queue"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/broadcast/queue`);
      if (!res.ok) throw new Error("Failed to fetch queue");
      return res.json();
    },
    enabled: activeTab === "queue",
    staleTime: 5 * 60 * 1000,
  });

  const { data: metrics, isLoading: metricsLoading } = useQuery<BroadcastMetrics>({
    queryKey: ["broadcast-metrics"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/broadcast/metrics`);
      if (!res.ok) throw new Error("Failed to fetch metrics");
      return res.json();
    },
    enabled: activeTab === "metrics",
    refetchInterval: 60_000,
  });

  const scheduleQuery = useQuery<{ schedule: Array<{ date: string; timeWAT: string; timeUTC: string; label: string }> }>({
    queryKey: ["broadcast-schedule"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/broadcast/schedule`);
      if (!res.ok) throw new Error("Failed to fetch schedule");
      return res.json();
    },
    enabled: activeTab === "schedule",
    staleTime: 30 * 60 * 1000,
  });

  const requeueMutation = useMutation({
    mutationFn: async () => {
      await refetchQueue();
    },
    onSuccess: () => {
      toast.success("Rebroadcast queue refreshed with latest AI curation");
    },
    onError: () => {
      toast.error("Failed to refresh queue");
    },
  });

  const isLive = liveStatus.isLive;
  const hasRebroadcast = liveStatus.rebroadcast.available;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Settings className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h1 className="font-bold text-base">Broadcast Control</h1>
                <p className="text-xs text-muted-foreground">Automation Dashboard</p>
              </div>
            </div>

            {/* Live Status Pill */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
              isLive
                ? "bg-red-500/10 border-red-500/30 text-red-400"
                : hasRebroadcast
                ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                : "bg-muted border-border text-muted-foreground"
            }`}>
              <span className={`w-2 h-2 rounded-full ${isLive ? "bg-red-500 animate-pulse" : hasRebroadcast ? "bg-amber-400" : "bg-muted-foreground"}`} />
              {isLive ? "LIVE NOW" : hasRebroadcast ? "REBROADCAST" : "OFF AIR"}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-3">
            {(["overview", "queue", "schedule", "metrics", "testimonies", "platform"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                  activeTab === tab
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <AnimatePresence mode="wait">

          {/* ── OVERVIEW TAB ─────────────────────────────────────────────── */}
          {activeTab === "overview" && (
            <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">

              {/* Live Status Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatusCard
                  icon={<Radio className="w-4 h-4" />}
                  label="Live Stream"
                  value={isLive ? "LIVE" : "Off Air"}
                  status={isLive ? "live" : "idle"}
                />
                <StatusCard
                  icon={<Tv2 className="w-4 h-4" />}
                  label="Rebroadcast"
                  value={hasRebroadcast ? "Active" : "Inactive"}
                  status={hasRebroadcast ? "active" : "idle"}
                />
                <StatusCard
                  icon={<Zap className="w-4 h-4" />}
                  label="Poll Rate"
                  value={broadcastStatus?.automation.sundayServiceWindowActive ? "5s" : "30s"}
                  status="info"
                />
                <StatusCard
                  icon={<Activity className="w-4 h-4" />}
                  label="AI Curation"
                  value={broadcastStatus?.automation.smartCurationEnabled ? "On" : "Off"}
                  status={broadcastStatus?.automation.smartCurationEnabled ? "active" : "idle"}
                />
              </div>

              {/* Automation Config */}
              {statusLoading ? (
                <div className="h-48 rounded-2xl bg-card border border-border animate-pulse" />
              ) : broadcastStatus ? (
                <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                  <h2 className="font-semibold text-sm flex items-center gap-2">
                    <Settings className="w-4 h-4 text-primary" />
                    Automation Engine
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <ConfigRow label="Channel ID" value={broadcastStatus.automation.channelId} mono />
                    <ConfigRow label="Timezone" value={broadcastStatus.automation.timezone} />
                    <ConfigRow label="Rebroadcast Window" value={`${broadcastStatus.automation.rebroadcastDurationDays} days`} />
                    <ConfigRow label="YouTube API" value={broadcastStatus.automation.youtubeApiConfigured ? "Configured" : "Not set"} status={broadcastStatus.automation.youtubeApiConfigured ? "ok" : "warn"} />
                    <ConfigRow label="Sunday Window" value={broadcastStatus.automation.sundayServiceWindowActive ? "Active (5s poll)" : "Inactive (30s poll)"} status={broadcastStatus.automation.sundayServiceWindowActive ? "ok" : "info"} />
                    <ConfigRow label="Server WAT Time" value={new Date(broadcastStatus.serverTimeWAT).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} />
                  </div>
                </div>
              ) : null}

              {/* Current Live/Rebroadcast Info */}
              {(isLive || hasRebroadcast) && (
                <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                  <h2 className="font-semibold text-sm">
                    {isLive ? "🔴 Current Live Stream" : "📡 Current Rebroadcast"}
                  </h2>
                  {isLive ? (
                    <div className="space-y-1">
                      <p className="font-medium">{liveStatus.title ?? "Live Service"}</p>
                      {liveStatus.videoId && (
                        <a href={`https://youtube.com/watch?v=${liveStatus.videoId}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                          youtube.com/watch?v={liveStatus.videoId}
                        </a>
                      )}
                      {liveStatus.startedAt && (
                        <p className="text-xs text-muted-foreground">Started {formatRelativeTime(liveStatus.startedAt)}</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="font-medium">{liveStatus.rebroadcast.title ?? "Rebroadcast"}</p>
                      {liveStatus.rebroadcast.expiresAt && (
                        <p className="text-xs text-muted-foreground">
                          Expires in {formatCountdown(liveStatus.rebroadcast.expiresAt)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Library Stats */}
              {broadcastStatus?.library && (
                <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                  <h2 className="font-semibold text-sm flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    Sermon Library
                  </h2>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-primary">{broadcastStatus.library.totalSermons.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Total Sermons</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-primary">{broadcastStatus.library.avgViewCount.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Avg Views</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-primary mt-1">{broadcastStatus.library.lastSyncedAt ? formatRelativeTime(broadcastStatus.library.lastSyncedAt) : "—"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Last Sync</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Next Sunday */}
              {broadcastStatus?.nextScheduled && (
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-center gap-3">
                  <Calendar className="w-8 h-8 text-primary shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Next Sunday Service (8:00 AM WAT)</p>
                    <p className="font-semibold text-sm">
                      {new Date(broadcastStatus.nextScheduled.sunday8amWAT).toLocaleDateString("en-NG", {
                        weekday: "long", month: "long", day: "numeric"
                      })}
                    </p>
                    <p className="text-xs text-primary font-medium">
                      In {formatCountdown(broadcastStatus.nextScheduled.sunday8amWAT)}
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ── QUEUE TAB ────────────────────────────────────────────────── */}
          {activeTab === "queue" && (
            <motion.div key="queue" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">AI Rebroadcast Queue</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Auto-curated content selected for post-service rebroadcast
                  </p>
                </div>
                <button
                  onClick={() => requeueMutation.mutate()}
                  disabled={queueLoading || requeueMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${requeueMutation.isPending ? "animate-spin" : ""}`} />
                  Refresh
                </button>
              </div>

              {queueLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-20 rounded-xl bg-card border border-border animate-pulse" />
                  ))}
                </div>
              ) : queueData ? (
                <div className="space-y-3">
                  {/* Strategy badge */}
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      queueData.strategy === "ai"
                        ? "bg-violet-500/10 text-violet-400 border border-violet-500/20"
                        : queueData.strategy === "algorithmic"
                        ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                        : "bg-muted text-muted-foreground border border-border"
                    }`}>
                      {queueData.strategy === "ai" ? "🤖 AI-Curated" : queueData.strategy === "algorithmic" ? "📊 Algorithmic" : "⚡ Fallback"}
                    </span>
                    <span className="text-xs text-muted-foreground">Curated {formatRelativeTime(queueData.curatedAt)}</span>
                  </div>

                  {queueData.queue.map((item, idx) => (
                    <div key={item.videoId} className={`rounded-xl border p-4 flex items-center gap-3 ${
                      idx === 0 ? "border-primary/30 bg-primary/5" : "border-border bg-card"
                    }`}>
                      {item.thumbnailUrl ? (
                        <img src={item.thumbnailUrl} alt="" className="w-16 h-10 rounded-lg object-cover shrink-0 bg-muted" />
                      ) : (
                        <div className="w-16 h-10 rounded-lg bg-muted shrink-0 flex items-center justify-center">
                          <PlayCircle className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          {idx === 0 && <span className="text-[10px] font-bold text-primary uppercase tracking-wide">Primary</span>}
                          <span className="text-[10px] text-muted-foreground capitalize">{item.reason}</span>
                        </div>
                        <p className="text-sm font-medium leading-snug truncate">{item.title}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            {(item.viewCount ?? 0).toLocaleString()}
                          </span>
                          <span className="text-xs text-muted-foreground">Score: {item.score}</span>
                        </div>
                      </div>
                      <a
                        href={`https://youtube.com/watch?v=${item.videoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Tv2 className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Could not load queue</p>
                </div>
              )}
            </motion.div>
          )}

          {/* ── SCHEDULE TAB ────────────────────────────────────────────── */}
          {activeTab === "schedule" && (
            <motion.div key="schedule" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div>
                <h2 className="font-semibold">Sunday Service Schedule</h2>
                <p className="text-xs text-muted-foreground mt-0.5">West Africa Time (WAT = UTC+1, Africa/Lagos)</p>
              </div>

              {scheduleQuery.isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-16 rounded-xl bg-card border border-border animate-pulse" />
                  ))}
                </div>
              ) : scheduleQuery.data ? (
                <div className="space-y-3">
                  {scheduleQuery.data.schedule.map((item, idx) => (
                    <div key={item.date} className={`rounded-xl border p-4 flex items-center gap-4 ${
                      idx === 0 ? "border-primary/30 bg-primary/5" : "border-border bg-card"
                    }`}>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        idx === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}>
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{item.timeWAT}</p>
                        <p className="text-xs text-muted-foreground">UTC: {new Date(item.timeUTC).toLocaleString("en-NG")}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        idx === 0
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {idx === 0
                          ? `In ${formatCountdown(item.timeUTC)}`
                          : item.label}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  Detection Window
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Every Sunday from <strong className="text-foreground">7:45 AM – 10:30 AM WAT</strong>, the system polls YouTube every <strong className="text-foreground">5 seconds</strong> to detect when the service goes live. Outside this window, it polls every 30 seconds. This ensures the live banner appears within seconds of the stream starting.
                </p>
              </div>
            </motion.div>
          )}

          {/* ── METRICS TAB ────────────────────────────────────────────── */}
          {activeTab === "metrics" && (
            <motion.div key="metrics" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <h2 className="font-semibold">Broadcast Metrics</h2>

              {metricsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-28 rounded-xl bg-card border border-border animate-pulse" />
                  ))}
                </div>
              ) : metrics ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <MetricCard label="Total Sermons" value={metrics.overview.totalSermons.toLocaleString()} />
                    <MetricCard label="Total Views" value={(metrics.overview.totalViews ?? 0).toLocaleString()} />
                    <MetricCard label="Avg Views" value={(metrics.overview.avgViews ?? 0).toLocaleString()} />
                    <MetricCard label="Featured" value={metrics.overview.featuredCount?.toLocaleString() ?? "—"} />
                    <MetricCard label="Live Count" value={metrics.overview.liveCount?.toLocaleString() ?? "—"} />
                    <MetricCard label="Top Views" value={metrics.overview.maxViews?.toLocaleString() ?? "—"} />
                  </div>

                  <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                    <h3 className="text-sm font-semibold">Recently Synced</h3>
                    <div className="space-y-2">
                      {metrics.recentSermons.map(sermon => (
                        <div key={sermon.videoId} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{sermon.title}</p>
                            <p className="text-xs text-muted-foreground">{formatRelativeTime(sermon.publishedAt)}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {sermon.isLive && <span className="text-[10px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded-full">Live</span>}
                            {sermon.isFeatured && <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded-full">Featured</span>}
                            <span className="text-xs text-muted-foreground">{(sermon.viewCount ?? 0).toLocaleString()} views</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </motion.div>
          )}
          {/* ── TESTIMONIES TAB ──────────────────────────────────────── */}
          {activeTab === "testimonies" && (
            <TestimoniesTab key="testimonies" />
          )}

          {/* ── PLATFORM TAB ─────────────────────────────────────────── */}
          {activeTab === "platform" && (
            <PlatformTab key="platform" />
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Testimonies Moderation Tab ────────────────────────────────────────────────

interface TestimonyItem {
  id: number;
  author: string;
  title: string | null;
  content: string;
  category: string | null;
  approved: boolean;
  createdAt: string;
}

function TestimoniesTab() {
  const qc = useQueryClient();
  const token = localStorage.getItem("jctm_token") ?? "";

  const { data, isLoading, refetch } = useQuery<{ testimonies: TestimonyItem[] }>({
    queryKey: ["admin-testimonies"],
    queryFn: () =>
      fetch(`${BASE}/api/testimonies?all=true&limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()),
    staleTime: 0,
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, approved }: { id: number; approved: boolean }) => {
      const res = await fetch(`${BASE}/api/testimonies/${id}/approve`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ approved }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (_, { approved }) => {
      toast.success(approved ? "Testimony approved" : "Testimony unapproved");
      qc.invalidateQueries({ queryKey: ["admin-testimonies"] });
    },
    onError: () => toast.error("Action failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE}/api/testimonies/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Testimony deleted");
      qc.invalidateQueries({ queryKey: ["admin-testimonies"] });
    },
    onError: () => toast.error("Delete failed"),
  });

  const testimonies = data?.testimonies ?? [];
  const pending = testimonies.filter(t => !t.approved);
  const approved = testimonies.filter(t => t.approved);

  return (
    <motion.div key="testimonies" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" /> Testimony Moderation
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isLoading ? "Loading..." : `${pending.length} pending · ${approved.length} published`}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-muted text-muted-foreground border border-border hover:bg-muted/80 transition-colors"
        >
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-amber-500 uppercase tracking-wide flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" /> Pending Review ({pending.length})
              </h3>
              {pending.map(t => (
                <TestimonyCard
                  key={t.id}
                  t={t}
                  onApprove={() => approveMutation.mutate({ id: t.id, approved: true })}
                  onDelete={() => deleteMutation.mutate(t.id)}
                  isPending={approveMutation.isPending || deleteMutation.isPending}
                />
              ))}
            </div>
          )}

          {approved.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-emerald-500 uppercase tracking-wide flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> Published ({approved.length})
              </h3>
              {approved.map(t => (
                <TestimonyCard
                  key={t.id}
                  t={t}
                  onUnapprove={() => approveMutation.mutate({ id: t.id, approved: false })}
                  onDelete={() => deleteMutation.mutate(t.id)}
                  isPending={approveMutation.isPending || deleteMutation.isPending}
                />
              ))}
            </div>
          )}

          {testimonies.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No testimonies yet</p>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}

function TestimonyCard({
  t,
  onApprove,
  onUnapprove,
  onDelete,
  isPending,
}: {
  t: TestimonyItem;
  onApprove?: () => void;
  onUnapprove?: () => void;
  onDelete: () => void;
  isPending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`rounded-xl border p-4 ${t.approved ? "border-emerald-500/20 bg-emerald-500/5" : "border-border bg-card"}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">{t.author}</span>
            {t.category && (
              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full capitalize">{t.category}</span>
            )}
            <span className="text-[10px] text-muted-foreground ml-auto">
              {new Date(t.createdAt).toLocaleDateString("en-NG")}
            </span>
          </div>
          {t.title && <p className="text-xs font-semibold text-foreground mb-1">{t.title}</p>}
          <p className={`text-xs text-muted-foreground leading-relaxed ${expanded ? "" : "line-clamp-2"}`}>
            {t.content}
          </p>
          {t.content.length > 120 && (
            <button onClick={() => setExpanded(!expanded)} className="text-[10px] text-primary mt-1">
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {!t.approved && onApprove && (
            <button
              onClick={onApprove}
              disabled={isPending}
              title="Approve"
              className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 flex items-center justify-center transition-colors disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          )}
          {t.approved && onUnapprove && (
            <button
              onClick={onUnapprove}
              disabled={isPending}
              title="Unapprove"
              className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 flex items-center justify-center transition-colors disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onDelete}
            disabled={isPending}
            title="Delete"
            className="w-7 h-7 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center justify-center transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Platform Analytics Tab ────────────────────────────────────────────────────

interface PlatformMetrics {
  platform?: {
    sermons?: number;
    blogs?: number;
    members?: number;
    conversations?: number;
    testimonies?: number;
  };
  ai?: {
    totalFeedback?: number;
    averageRating?: string | null;
    averageLatencyMs?: string | null;
    tierBreakdown?: Record<string, number>;
  };
}

function PlatformTab() {
  const token = localStorage.getItem("jctm_token") ?? "";
  const [blogTopic, setBlogTopic] = useState("holiness");
  const [generating, setGenerating] = useState(false);

  const { data: metrics, isLoading } = useQuery<PlatformMetrics>({
    queryKey: ["platform-metrics"],
    queryFn: () =>
      fetch(`${BASE}/api/admin/metrics`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()),
    staleTime: 60_000,
  });

  const generateBlog = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`${BASE}/api/admin/blog/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ topic: blogTopic }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Blog article "${data.post?.title ?? "Article"}" generated!`);
      } else {
        toast.error(data.error ?? "Generation failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setGenerating(false);
    }
  };

  const BLOG_TOPICS = [
    "holiness", "correction-mandate", "prayer", "faith", "repentance",
    "bible-doctrine", "apostolic-order", "prophetic-insight", "end-times", "revival",
  ];

  return (
    <motion.div key="platform" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
      <div>
        <h2 className="font-semibold flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" /> Platform Analytics
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">Live platform health overview</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : metrics ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Members", value: metrics.platform?.members ?? 0, icon: <Users className="w-4 h-4" /> },
            { label: "Sermons", value: metrics.platform?.sermons ?? 0, icon: <BookOpen className="w-4 h-4" /> },
            { label: "Conversations", value: metrics.platform?.conversations ?? 0, icon: <MessageSquare className="w-4 h-4" /> },
            { label: "Testimonies", value: metrics.platform?.testimonies ?? 0, icon: <CheckCircle className="w-4 h-4" /> },
            { label: "Blog Posts", value: metrics.platform?.blogs ?? 0, icon: <Sparkles className="w-4 h-4" /> },
            { label: "AI Feedback", value: metrics.ai?.totalFeedback ?? 0, icon: <Activity className="w-4 h-4" /> },
            { label: "Avg Rating", value: metrics.ai?.averageRating ? `${metrics.ai.averageRating}/5` : "—", icon: <CheckCircle className="w-4 h-4" /> },
            { label: "Avg Latency", value: metrics.ai?.averageLatencyMs ? `${metrics.ai.averageLatencyMs}ms` : "—", icon: <Zap className="w-4 h-4" /> },
          ].map(m => (
            <div key={m.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1.5 text-xs">
                {m.icon} {m.label}
              </div>
              <p className="text-2xl font-bold text-primary">{m.value.toLocaleString()}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground text-sm">Could not load metrics</div>
      )}

      {/* Blog Generator */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400" /> AI Blog Generator
        </h3>
        <p className="text-xs text-muted-foreground">
          Generate a theologically rich blog article using AI, grounded in JCTM doctrine.
        </p>
        <div className="flex gap-3 flex-wrap items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs text-muted-foreground mb-1 block">Topic</label>
            <select
              value={blogTopic}
              onChange={e => setBlogTopic(e.target.value)}
              className="w-full text-sm rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {BLOG_TOPICS.map(t => (
                <option key={t} value={t}>{t.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</option>
              ))}
            </select>
          </div>
          <Button
            onClick={generateBlog}
            disabled={generating}
            className="gap-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg"
            size="sm"
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {generating ? "Generating..." : "Generate Article"}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatusCard({ icon, label, value, status }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  status: "live" | "active" | "idle" | "info";
}) {
  const colorMap = {
    live: "border-red-500/30 bg-red-500/5 text-red-400",
    active: "border-amber-500/30 bg-amber-500/5 text-amber-400",
    idle: "border-border bg-card text-muted-foreground",
    info: "border-blue-500/30 bg-blue-500/5 text-blue-400",
  };
  return (
    <div className={`rounded-xl border p-4 ${colorMap[status]}`}>
      <div className="flex items-center gap-2 mb-2 opacity-70">{icon}<span className="text-xs">{label}</span></div>
      <p className="font-bold text-base text-foreground">{value}</p>
    </div>
  );
}

function ConfigRow({ label, value, mono, status }: {
  label: string;
  value: string;
  mono?: boolean;
  status?: "ok" | "warn" | "info";
}) {
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

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-center">
      <p className="text-xl font-bold text-primary">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

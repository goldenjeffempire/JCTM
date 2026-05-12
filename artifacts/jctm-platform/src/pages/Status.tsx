import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Database,
  Youtube,
  BrainCircuit,
  Bell,
  Radio,
  RefreshCw,
  Clock,
  Wifi,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

interface ServiceStatus {
  status: string;
  latencyMs?: number;
  apiSyncEnabled?: boolean;
  vapidConfigured?: boolean;
  activeSubscribers?: number;
  connectedClients?: number;
  externalAIEnabled?: boolean;
  quotaPaused?: boolean;
  neonQuota?: { status: string };
}

interface HealthPayload {
  status: "ok" | "degraded";
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    database: ServiceStatus;
    youtube: ServiceStatus;
    ai: ServiceStatus;
    push: ServiceStatus;
    sse: ServiceStatus;
    redis?: ServiceStatus;
  };
  library: {
    totalSermons: number;
    aiEnrichedSermons: number;
    enrichmentProgress: number;
  };
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h < 24) return `${h}h ${m}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

function formatTs(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

type Indicator = "operational" | "degraded" | "down" | "unknown";

function resolveIndicator(svc: ServiceStatus | undefined): Indicator {
  if (!svc) return "unknown";
  if (svc.status === "ok" || svc.status === "configured" || svc.status === "active") return "operational";
  if (svc.status === "error") return "down";
  return "degraded";
}

function StatusDot({ state }: { state: Indicator }) {
  const colors: Record<Indicator, string> = {
    operational: "bg-emerald-500",
    degraded: "bg-amber-400",
    down: "bg-red-500",
    unknown: "bg-muted-foreground/40",
  };
  return (
    <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
      {state === "operational" && (
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${colors[state]} opacity-60`} />
      )}
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${colors[state]}`} />
    </span>
  );
}

function StatusBadge({ state }: { state: Indicator }) {
  const map: Record<Indicator, { label: string; className: string }> = {
    operational: { label: "Operational", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
    degraded:    { label: "Degraded",    className: "bg-amber-400/10 text-amber-600 border-amber-400/30" },
    down:        { label: "Down",        className: "bg-red-500/10 text-red-600 border-red-500/30" },
    unknown:     { label: "Unknown",     className: "bg-muted/50 text-muted-foreground border-border" },
  };
  const { label, className } = map[state];
  return (
    <Badge variant="outline" className={`text-xs font-semibold px-2 py-0.5 ${className}`}>
      {label}
    </Badge>
  );
}

interface ServiceRowProps {
  icon: React.ReactNode;
  name: string;
  description: string;
  state: Indicator;
  detail?: string;
}

function ServiceRow({ icon, name, description, state, detail }: ServiceRowProps) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 text-accent">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-primary">{name}</span>
          <StatusDot state={state} />
        </div>
        <p className="text-xs text-muted-foreground truncate">{detail ?? description}</p>
      </div>
      <StatusBadge state={state} />
    </div>
  );
}

export default function Status() {
  const { data, isLoading, isFetching, isError, dataUpdatedAt, refetch } = useQuery<HealthPayload>({
    queryKey: ["platform-status"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/health`);
      if (!res.ok) throw new Error(`Health check returned ${res.status}`);
      return res.json();
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 3,
  });

  const overall: Indicator = isError
    ? "down"
    : isLoading
    ? "unknown"
    : data?.status === "ok"
    ? "operational"
    : "degraded";

  const overallColors: Record<Indicator, { bg: string; text: string; border: string; icon: React.ReactNode }> = {
    operational: {
      bg: "from-emerald-500/10 to-transparent",
      text: "text-emerald-600",
      border: "border-emerald-500/20",
      icon: <CheckCircle2 className="h-6 w-6" />,
    },
    degraded: {
      bg: "from-amber-400/10 to-transparent",
      text: "text-amber-600",
      border: "border-amber-400/20",
      icon: <AlertTriangle className="h-6 w-6" />,
    },
    down: {
      bg: "from-red-500/10 to-transparent",
      text: "text-red-600",
      border: "border-red-500/20",
      icon: <XCircle className="h-6 w-6" />,
    },
    unknown: {
      bg: "from-muted/30 to-transparent",
      text: "text-muted-foreground",
      border: "border-border",
      icon: <Activity className="h-6 w-6 animate-pulse" />,
    },
  };

  const oc = overallColors[overall];

  const services: ServiceRowProps[] = data
    ? [
        {
          icon: <Database className="h-4 w-4" />,
          name: "Database",
          description: "PostgreSQL / Neon",
          state: resolveIndicator(data.services.database),
          detail: data.services.database.latencyMs != null
            ? `${data.services.database.latencyMs} ms latency · Neon ${data.services.database.neonQuota?.status ?? "—"}`
            : undefined,
        },
        {
          icon: <Youtube className="h-4 w-4" />,
          name: "Sermon Library",
          description: "YouTube sync",
          state: resolveIndicator(data.services.youtube),
          detail: data.services.youtube.quotaPaused
            ? "YouTube API quota paused — RSS sync active"
            : `${data.library.totalSermons} sermons · ${data.library.enrichmentProgress}% AI-enriched`,
        },
        {
          icon: <BrainCircuit className="h-4 w-4" />,
          name: "AI Assistant",
          description: "Local AI · TempleBots",
          state: resolveIndicator(data.services.ai),
          detail: "Local AI active — TempleBots powered by 3-tier local engine",
        },
        {
          icon: <Bell className="h-4 w-4" />,
          name: "Push Notifications",
          description: "Web Push / VAPID",
          state: resolveIndicator(data.services.push),
          detail: data.services.push.vapidConfigured
            ? `${data.services.push.activeSubscribers ?? 0} active subscribers`
            : "VAPID keys not configured",
        },
        {
          icon: <Wifi className="h-4 w-4" />,
          name: "Live Updates",
          description: "Server-Sent Events",
          state: resolveIndicator(data.services.sse),
          detail: `${data.services.sse.connectedClients ?? 0} connected client${data.services.sse.connectedClients !== 1 ? "s" : ""}`,
        },
        ...(data.services.redis
          ? [{
              icon: <Radio className="h-4 w-4" />,
              name: "Cache",
              description: "Redis",
              state: resolveIndicator(data.services.redis),
              detail: data.services.redis.latencyMs != null ? `${data.services.redis.latencyMs} ms latency` : undefined,
            }]
          : []),
      ]
    : [];

  return (
    <Layout>
      <SEO
        title="Platform Status — JCTM Digital Sanctuary"
        description="Live status of the Jesus Christ Temple Ministry Digital Sanctuary platform — database, sermon library, AI assistant, push notifications, and live streaming."
        path="/status"
        keywords="JCTM status, platform status, Jesus Christ Temple Ministry uptime"
        noIndex
      />

      <div className="container mx-auto px-4 py-16 max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <Activity className="h-5 w-5 text-accent" />
            </div>
            <span className="text-sm font-medium text-accent uppercase tracking-widest">Live Status</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary mb-2">
            Platform Status
          </h1>
          <p className="text-muted-foreground mb-10">
            Real-time health of the JCTM Digital Sanctuary — updated every 60 seconds.
          </p>

          {/* Overall status banner */}
          <AnimatePresence mode="wait">
            <motion.div
              key={overall}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
              className={`glass-panel rounded-2xl p-6 mb-6 border bg-gradient-to-br ${oc.bg} ${oc.border}`}
            >
              <div className="flex items-center gap-4">
                <div className={`${oc.text} flex-shrink-0`}>{oc.icon}</div>
                <div className="flex-1">
                  <p className={`text-lg font-bold ${oc.text}`}>
                    {overall === "operational" && "All Systems Operational"}
                    {overall === "degraded"    && "Partial Service Disruption"}
                    {overall === "down"        && "Service Disruption Detected"}
                    {overall === "unknown"     && "Checking status…"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {overall === "operational" && "Every subsystem is running normally."}
                    {overall === "degraded"    && "Some services are affected. We are investigating."}
                    {overall === "down"        && "We are aware of the issue and working to resolve it."}
                    {overall === "unknown"     && "Loading live data from the server…"}
                  </p>
                </div>
              </div>

              {data && (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mt-4 pt-4 border-t border-border/50">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    Uptime: <strong className="text-foreground">{formatUptime(data.uptime)}</strong>
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
                    Last checked: <strong className="text-foreground">{dataUpdatedAt ? formatTs(new Date(dataUpdatedAt).toISOString()) : "—"}</strong>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    v{data.version}
                  </span>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Service rows */}
          {isLoading ? (
            <div className="glass-panel rounded-2xl p-6 space-y-3 border border-border">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-2 animate-pulse">
                  <div className="w-8 h-8 rounded-lg bg-muted" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-32 bg-muted rounded" />
                    <div className="h-2.5 w-48 bg-muted rounded" />
                  </div>
                  <div className="h-5 w-20 bg-muted rounded-full" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="glass-panel rounded-2xl p-8 border border-red-500/20 text-center">
              <XCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
              <p className="font-semibold text-primary mb-1">Could not reach the server</p>
              <p className="text-sm text-muted-foreground mb-4">
                The health endpoint is not responding. This may indicate a server outage.
              </p>
              <button
                onClick={() => refetch()}
                className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline"
              >
                <RefreshCw className="h-4 w-4" /> Retry now
              </button>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="glass-panel rounded-2xl border border-border overflow-hidden"
            >
              <div className="px-6 py-3 bg-muted/30 border-b border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Subsystems</p>
              </div>
              <div className="divide-y divide-border px-6">
                {services.map((svc, i) => (
                  <motion.div
                    key={svc.name}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.05 }}
                  >
                    <ServiceRow {...svc} />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Manual refresh */}
          {!isLoading && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-accent transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
                {isFetching ? "Refreshing…" : "Refresh now"}
              </button>
            </div>
          )}

          <Separator className="my-10" />

          {/* Incident history note */}
          <div className="glass-panel rounded-2xl p-5 border border-border text-center">
            <p className="text-sm text-muted-foreground leading-relaxed">
              The JCTM Digital Sanctuary runs on an Always-ON server that automatically monitors its own heartbeat.
              If a disruption is detected, our team is alerted immediately via email.
              For urgent support, contact us at{" "}
              <a href="mailto:info@jctm.org.ng" className="text-accent hover:underline font-medium">
                info@jctm.org.ng
              </a>
              .
            </p>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}

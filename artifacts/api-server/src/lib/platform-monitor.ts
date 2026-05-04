/**
 * Platform Status & Monitoring Engine
 *
 * Tracks health of all subsystems:
 *   - AI engine status (local-only tier, no external deps)
 *   - Database connectivity & pool stats
 *   - YouTube API sync status
 *   - Push notification health
 *   - Knowledge base completeness
 *   - Overall platform status (green / degraded / down)
 */

import pg from "pg";
import os from "os";
import { ENGINE_METADATA } from "./local-ai-engine.js";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ─── Types ────────────────────────────────────────────────────────────────────

export type HealthStatus = "healthy" | "degraded" | "down" | "unknown";

export interface SubsystemHealth {
  status: HealthStatus;
  latencyMs?: number;
  detail?: string;
  checkedAt: string;
}

export interface AITierHealth {
  localEngine: "active" | "inactive";
  localEngineVersion: string;
  embeddingMethod: "transformer" | "tfidf" | "unknown";
  openaiEnabled: boolean;
  openaiQuotaExceeded: boolean;
  knowledgeBaseChunks: number;
  knowledgeBaseWithEmbeddings: number;
}

export interface SystemResources {
  cpuLoadPercent: number;
  memoryUsedMb: number;
  memoryTotalMb: number;
  memoryUsedPercent: number;
  uptimeSeconds: number;
  nodeVersion: string;
  platform: string;
}

export interface PlatformHealth {
  status: HealthStatus;
  version: string;
  environment: string;
  checkedAt: string;
  subsystems: {
    database: SubsystemHealth;
    ai: SubsystemHealth;
    knowledgeBase: SubsystemHealth;
    pushNotifications: SubsystemHealth;
    youtubeSync: SubsystemHealth;
    email: SubsystemHealth;
  };
  ai: AITierHealth;
  resources: SystemResources;
  uptime: {
    processUptimeSeconds: number;
    lastHeartbeatAt: string | null;
    heartbeatGapMs: number | null;
  };
  features: Record<string, boolean>;
}

// ─── Feature Flags ────────────────────────────────────────────────────────────

function getFeatureFlags(): Record<string, boolean> {
  return {
    localAI: true,
    rag: true,
    templeBots: true,
    devotionEngine: true,
    sermonRecommendations: true,
    contentModeration: true,
    analyticsAI: true,
    pushNotifications: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
    emailNotifications: Boolean(process.env.SMTP_HOST),
    youtubeSync: Boolean(process.env.YOUTUBE_API_KEY),
    adsense: Boolean(process.env.VITE_ADSENSE_CLIENT_ID ?? "ca-pub-6817509745706083"),
    giving: Boolean(process.env.STRIPE_SECRET_KEY || process.env.PAYSTACK_SECRET_KEY),
    openai: false,
  };
}

// ─── Database Health Check ────────────────────────────────────────────────────

async function checkDatabase(): Promise<SubsystemHealth> {
  const start = Date.now();
  try {
    await pool.query("SELECT 1");
    const latencyMs = Date.now() - start;
    return {
      status: latencyMs < 500 ? "healthy" : "degraded",
      latencyMs,
      detail: `Neon PostgreSQL — ${latencyMs}ms`,
      checkedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      status: "down",
      latencyMs: Date.now() - start,
      detail: `Database unreachable: ${(err as Error).message.slice(0, 80)}`,
      checkedAt: new Date().toISOString(),
    };
  }
}

// ─── AI Engine Health ─────────────────────────────────────────────────────────

async function checkAI(): Promise<{ health: SubsystemHealth; tier: AITierHealth }> {
  const start = Date.now();

  let knowledgeChunks = 0;
  let knowledgeWithEmbeddings = 0;

  try {
    const [chunkRes, embRes] = await Promise.all([
      pool.query<{ count: string }>("SELECT COUNT(*) FROM knowledge_chunks"),
      pool.query<{ count: string }>("SELECT COUNT(*) FROM knowledge_chunks WHERE embedding IS NOT NULL"),
    ]);
    knowledgeChunks = parseInt(chunkRes.rows[0]?.count ?? "0", 10);
    knowledgeWithEmbeddings = parseInt(embRes.rows[0]?.count ?? "0", 10);
  } catch {
    // Non-fatal
  }

  const latencyMs = Date.now() - start;

  const tier: AITierHealth = {
    localEngine: "active",
    localEngineVersion: ENGINE_METADATA.version,
    embeddingMethod: "tfidf",
    openaiEnabled: false,
    openaiQuotaExceeded: false,
    knowledgeBaseChunks: knowledgeChunks,
    knowledgeBaseWithEmbeddings: knowledgeWithEmbeddings,
  };

  const health: SubsystemHealth = {
    status: "healthy",
    latencyMs,
    detail: `Local AI Engine v${ENGINE_METADATA.version} — ${knowledgeChunks} knowledge chunks (${knowledgeWithEmbeddings} embedded)`,
    checkedAt: new Date().toISOString(),
  };

  return { health, tier };
}

// ─── Knowledge Base Health ────────────────────────────────────────────────────

async function checkKnowledgeBase(): Promise<SubsystemHealth> {
  try {
    const result = await pool.query<{ count: string }>(
      "SELECT COUNT(*) FROM knowledge_chunks",
    );
    const count = parseInt(result.rows[0]?.count ?? "0", 10);
    const status: HealthStatus = count >= 10 ? "healthy" : count > 0 ? "degraded" : "down";
    return {
      status,
      detail: `${count} knowledge chunks in RAG database`,
      checkedAt: new Date().toISOString(),
    };
  } catch {
    return { status: "down", detail: "Cannot query knowledge_chunks table", checkedAt: new Date().toISOString() };
  }
}

// ─── Push Notifications Health ────────────────────────────────────────────────

async function checkPushNotifications(): Promise<SubsystemHealth> {
  const hasVapid = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
  if (!hasVapid) {
    return { status: "down", detail: "VAPID keys not configured", checkedAt: new Date().toISOString() };
  }

  try {
    const result = await pool.query<{ count: string }>(
      "SELECT COUNT(*) FROM push_subscriptions WHERE is_active = true",
    );
    const count = parseInt(result.rows[0]?.count ?? "0", 10);
    return {
      status: "healthy",
      detail: `${count} active push subscriptions`,
      checkedAt: new Date().toISOString(),
    };
  } catch {
    return { status: "degraded", detail: "Push subscriptions table unavailable", checkedAt: new Date().toISOString() };
  }
}

// ─── YouTube Sync Health ──────────────────────────────────────────────────────

async function checkYoutubeSync(): Promise<SubsystemHealth> {
  const hasKey = Boolean(process.env.YOUTUBE_API_KEY);
  if (!hasKey) {
    return { status: "degraded", detail: "YouTube API key not set — RSS sync only", checkedAt: new Date().toISOString() };
  }

  try {
    const result = await pool.query<{ max_date: Date | null }>(
      "SELECT MAX(created_at) as max_date FROM sermon_data",
    );
    const lastSync = result.rows[0]?.max_date;
    if (!lastSync) {
      return { status: "degraded", detail: "No sermons synced yet", checkedAt: new Date().toISOString() };
    }
    const ageMinutes = (Date.now() - new Date(lastSync).getTime()) / 60_000;
    return {
      status: ageMinutes < 60 ? "healthy" : ageMinutes < 360 ? "degraded" : "down",
      detail: `Last sync: ${Math.round(ageMinutes)} minutes ago`,
      checkedAt: new Date().toISOString(),
    };
  } catch {
    return { status: "unknown", detail: "Cannot query sermon_data", checkedAt: new Date().toISOString() };
  }
}

// ─── Email Health ─────────────────────────────────────────────────────────────

async function checkEmail(): Promise<SubsystemHealth> {
  const hasSMTP = Boolean(process.env.SMTP_HOST);
  return {
    status: hasSMTP ? "healthy" : "degraded",
    detail: hasSMTP
      ? `SMTP configured: ${process.env.SMTP_HOST}`
      : "SMTP not configured — email notifications disabled",
    checkedAt: new Date().toISOString(),
  };
}

// ─── System Resources ─────────────────────────────────────────────────────────

function getSystemResources(): SystemResources {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  const cpuLoad = os.loadavg()[0] ?? 0;
  const cpuCount = os.cpus().length;
  const cpuLoadPercent = Math.min(100, Math.round((cpuLoad / cpuCount) * 100));

  return {
    cpuLoadPercent,
    memoryUsedMb: Math.round(usedMem / 1_048_576),
    memoryTotalMb: Math.round(totalMem / 1_048_576),
    memoryUsedPercent: Math.round((usedMem / totalMem) * 100),
    uptimeSeconds: Math.round(os.uptime()),
    nodeVersion: process.version,
    platform: os.platform(),
  };
}

// ─── Uptime Check ─────────────────────────────────────────────────────────────

async function getUptimeInfo(): Promise<{
  processUptimeSeconds: number;
  lastHeartbeatAt: string | null;
  heartbeatGapMs: number | null;
}> {
  try {
    const result = await pool.query<{ last_beat_at: Date }>(
      "SELECT last_beat_at FROM uptime_monitor ORDER BY id DESC LIMIT 1",
    );
    const lastBeat = result.rows[0]?.last_beat_at ?? null;
    const heartbeatGapMs = lastBeat ? Date.now() - new Date(lastBeat).getTime() : null;

    return {
      processUptimeSeconds: Math.round(process.uptime()),
      lastHeartbeatAt: lastBeat ? new Date(lastBeat).toISOString() : null,
      heartbeatGapMs,
    };
  } catch {
    return {
      processUptimeSeconds: Math.round(process.uptime()),
      lastHeartbeatAt: null,
      heartbeatGapMs: null,
    };
  }
}

// ─── Full Platform Health Check ───────────────────────────────────────────────

export async function getPlatformHealth(): Promise<PlatformHealth> {
  const [dbHealth, aiResult, kbHealth, pushHealth, ytHealth, emailHealth, uptimeInfo] =
    await Promise.all([
      checkDatabase(),
      checkAI(),
      checkKnowledgeBase(),
      checkPushNotifications(),
      checkYoutubeSync(),
      checkEmail(),
      getUptimeInfo(),
    ]);

  const subsystemStatuses = [
    dbHealth.status,
    aiResult.health.status,
    kbHealth.status,
  ];

  let overallStatus: HealthStatus = "healthy";
  if (subsystemStatuses.includes("down")) overallStatus = "down";
  else if (subsystemStatuses.includes("degraded")) overallStatus = "degraded";

  return {
    status: overallStatus,
    version: process.env.npm_package_version ?? "1.0.0",
    environment: process.env.NODE_ENV ?? "production",
    checkedAt: new Date().toISOString(),
    subsystems: {
      database: dbHealth,
      ai: aiResult.health,
      knowledgeBase: kbHealth,
      pushNotifications: pushHealth,
      youtubeSync: ytHealth,
      email: emailHealth,
    },
    ai: aiResult.tier,
    resources: getSystemResources(),
    uptime: uptimeInfo,
    features: getFeatureFlags(),
  };
}

// ─── Lightweight Ping ─────────────────────────────────────────────────────────

export async function getPingStatus(): Promise<{ ok: boolean; latencyMs: number; dbMs: number }> {
  const start = Date.now();
  let dbMs = 0;
  let dbOk = false;
  try {
    const dbStart = Date.now();
    await pool.query("SELECT 1");
    dbMs = Date.now() - dbStart;
    dbOk = true;
  } catch { /* ignore */ }

  return { ok: dbOk, latencyMs: Date.now() - start, dbMs };
}

import { Router, type IRouter, type Request, type Response } from "express";
import pg from "pg";

const { Pool } = pg;
const router: IRouter = Router();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Bootstrap the stats table on startup (non-blocking)
pool.query(`
  CREATE TABLE IF NOT EXISTS site_stats (
    key   TEXT PRIMARY KEY,
    value BIGINT NOT NULL DEFAULT 0
  );
  INSERT INTO site_stats (key, value) VALUES ('total_visitors', 0) ON CONFLICT DO NOTHING;
`).catch(() => null);

// ─── Total visitor tracking ───────────────────────────────────────────────────

const seenThisSession = new Set<string>();

async function getTotalFromDb(): Promise<number> {
  try {
    const result = await pool.query<{ value: string }>(
      "SELECT value FROM site_stats WHERE key = 'total_visitors'",
    );
    return result.rows.length > 0 ? Number(result.rows[0].value) : 0;
  } catch {
    return 0;
  }
}

async function incrementDb(): Promise<number> {
  try {
    const result = await pool.query<{ value: string }>(
      `INSERT INTO site_stats (key, value) VALUES ('total_visitors', 1)
       ON CONFLICT (key) DO UPDATE SET value = site_stats.value + 1
       RETURNING value`,
    );
    return result.rows.length > 0 ? Number(result.rows[0].value) : 0;
  } catch {
    return 0;
  }
}

// ─── Active session tracking ──────────────────────────────────────────────────
// A session is "active" when a heartbeat was received within the last 2 minutes.
// Visitors send a heartbeat every 30 s from the frontend.

interface ActiveSession {
  visitorId: string;
  page: string;
  lastSeen: number; // ms epoch
  country?: string;
  deviceType?: "desktop" | "mobile" | "tablet";
}

const activeSessions = new Map<string, ActiveSession>();
const SESSION_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes — no heartbeat = gone

function pruneStale(): void {
  const cutoff = Date.now() - SESSION_TIMEOUT_MS;
  let changed = false;
  for (const [key, session] of activeSessions) {
    if (session.lastSeen < cutoff) {
      activeSessions.delete(key);
      changed = true;
    }
  }
  if (changed) broadcastActiveState();
}

// Prune every 30 s
const pruneInterval = setInterval(pruneStale, 30_000);
pruneInterval.unref();

function getActiveCount(): number {
  return activeSessions.size;
}

function getPageBreakdown(): { page: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const s of activeSessions.values()) {
    const p = s.page || "/";
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([page, count]) => ({ page, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

function detectDevice(ua: string): "desktop" | "mobile" | "tablet" {
  const uaLower = ua.toLowerCase();
  if (/tablet|ipad/.test(uaLower)) return "tablet";
  if (/mobile|android|iphone/.test(uaLower)) return "mobile";
  return "desktop";
}

// ─── SSE clients ─────────────────────────────────────────────────────────────

const sseClients = new Set<Response>();

function buildActivePayload(total: number): string {
  return JSON.stringify({
    total,
    active: getActiveCount(),
    pages: getPageBreakdown(),
    timestamp: Date.now(),
  });
}

async function broadcastActiveState(): Promise<void> {
  if (sseClients.size === 0) return;
  const total = await getTotalFromDb();
  const payload = buildActivePayload(total);
  for (const client of sseClients) {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

function broadcastTotal(total: number): void {
  const payload = buildActivePayload(total);
  for (const client of sseClients) {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

// ─── GET /visitors/active ─────────────────────────────────────────────────────
// Snapshot of current active session count + page breakdown. No streaming.

router.get("/visitors/active", async (_req: Request, res: Response): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  const total = await getTotalFromDb();
  res.json({
    total,
    active: getActiveCount(),
    pages: getPageBreakdown(),
    timestamp: Date.now(),
  });
});

// ─── POST /visitors/track ─────────────────────────────────────────────────────

router.post("/visitors/track", async (req: Request, res: Response): Promise<void> => {
  const { visitorId, page } = req.body as { visitorId?: string; page?: string };

  if (!visitorId || typeof visitorId !== "string" || visitorId.length < 8) {
    res.status(400).json({ error: "visitorId required" });
    return;
  }

  const ua = req.headers["user-agent"] ?? "";
  const deviceType = detectDevice(ua);

  // Update / create active session
  activeSessions.set(visitorId, {
    visitorId,
    page: page || "/",
    lastSeen: Date.now(),
    deviceType,
  });

  const isNew = !seenThisSession.has(visitorId);

  let total: number;
  if (isNew) {
    seenThisSession.add(visitorId);
    total = await incrementDb();
    broadcastTotal(total);
  } else {
    total = await getTotalFromDb();
    broadcastActiveState();
  }

  res.json({ total, active: getActiveCount(), isNew });
});

// ─── POST /visitors/heartbeat ─────────────────────────────────────────────────
// Frontend calls this every 30 s to signal the visitor is still on the site.
// Body: { visitorId: string; page: string }

router.post("/visitors/heartbeat", async (req: Request, res: Response): Promise<void> => {
  const { visitorId, page } = req.body as { visitorId?: string; page?: string };

  if (!visitorId || typeof visitorId !== "string" || visitorId.length < 8) {
    res.status(400).json({ error: "visitorId required" });
    return;
  }

  const ua = req.headers["user-agent"] ?? "";
  const deviceType = detectDevice(ua);
  const currentPage = page || "/";

  const existing = activeSessions.get(visitorId);
  const pageChanged = existing?.page !== currentPage;

  activeSessions.set(visitorId, {
    visitorId,
    page: currentPage,
    lastSeen: Date.now(),
    deviceType: existing?.deviceType ?? deviceType,
  });

  if (pageChanged) {
    await broadcastActiveState();
  }

  res.json({ active: getActiveCount(), timestamp: Date.now() });
});

// ─── POST /visitors/session/leave ─────────────────────────────────────────────
// Called when the visitor's tab closes (via navigator.sendBeacon — POST only).

router.post("/visitors/session/leave", (req: Request, res: Response): void => {
  const { visitorId } = req.body as { visitorId?: string };
  if (visitorId && activeSessions.has(visitorId)) {
    activeSessions.delete(visitorId);
    broadcastActiveState();
  }
  res.status(204).end();
});

// ─── GET /visitors/total ──────────────────────────────────────────────────────

router.get("/visitors/total", async (_req: Request, res: Response): Promise<void> => {
  const total = await getTotalFromDb();
  res.json({ total, active: getActiveCount(), timestamp: Date.now() });
});

// ─── GET /visitors/stream ─────────────────────────────────────────────────────
// SSE stream — pushes { total, active, pages, timestamp } on every change.

router.get("/visitors/stream", async (req: Request, res: Response): Promise<void> => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  sseClients.add(res);

  // Send current state immediately on connect
  const total = await getTotalFromDb();
  res.write(`data: ${buildActivePayload(total)}\n\n`);

  const heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch {
      clearInterval(heartbeat);
    }
  }, 20_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

export default router;

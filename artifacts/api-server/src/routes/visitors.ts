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

// In-memory set of visitor IDs seen in this server session (avoids double-counting restarts)
const seenThisSession = new Set<string>();
// SSE clients subscribed to live updates
const sseClients = new Set<Response>();

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

function broadcastTotal(total: number): void {
  const payload = JSON.stringify({ total, timestamp: Date.now() });
  for (const client of sseClients) {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

// ── POST /visitors/track ─────────────────────────────────────────────────────
// Frontend sends a stable visitor ID (UUID stored in localStorage).
// We increment the DB counter only if we've not seen this ID before.
router.post("/visitors/track", async (req: Request, res: Response): Promise<void> => {
  const { visitorId } = req.body as { visitorId?: string };

  if (!visitorId || typeof visitorId !== "string" || visitorId.length < 8) {
    res.status(400).json({ error: "visitorId required" });
    return;
  }

  const isNew = !seenThisSession.has(visitorId);

  let total: number;
  if (isNew) {
    seenThisSession.add(visitorId);
    total = await incrementDb();
    broadcastTotal(total);
  } else {
    total = await getTotalFromDb();
  }

  res.json({ total, isNew });
});

// ── GET /visitors/total ──────────────────────────────────────────────────────
router.get("/visitors/total", async (_req: Request, res: Response): Promise<void> => {
  const total = await getTotalFromDb();
  res.json({ total, timestamp: Date.now() });
});

// ── GET /visitors/stream ─────────────────────────────────────────────────────
// SSE stream — pushes updated totals whenever a new visitor is tracked.
router.get("/visitors/stream", async (req: Request, res: Response): Promise<void> => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  sseClients.add(res);

  // Send current total immediately on connect
  const total = await getTotalFromDb();
  res.write(`data: ${JSON.stringify({ total, timestamp: Date.now() })}\n\n`);

  const heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch {
      clearInterval(heartbeat);
    }
  }, 30_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

export default router;

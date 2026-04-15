import { Router, type IRouter } from "express";
import type { Response } from "express";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const clients = new Set<Response>();
const BASE_COUNT = 47;
const SETTING_KEY = "altar_ghost_count";

let ghostClients = 0;

function getCount(): number {
  return BASE_COUNT + clients.size + ghostClients;
}

function broadcast(): void {
  const payload = JSON.stringify({ count: getCount(), timestamp: Date.now() });
  for (const res of clients) {
    try {
      res.write(`data: ${payload}\n\n`);
    } catch {
      clients.delete(res);
    }
  }
}

async function loadPersistedCount(): Promise<void> {
  try {
    const [row] = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, SETTING_KEY))
      .limit(1);
    if (row?.intValue != null) {
      ghostClients = row.intValue;
    }
  } catch {
    // Non-fatal — start with 0
  }
}

async function persistCount(): Promise<void> {
  try {
    await db
      .insert(settingsTable)
      .values({ key: SETTING_KEY, intValue: ghostClients })
      .onConflictDoUpdate({
        target: settingsTable.key,
        set: { intValue: ghostClients, updatedAt: new Date() },
      });
  } catch {
    // Non-fatal — in-memory value still valid
  }
}

// Load persisted count on startup
loadPersistedCount();

// Simulate realistic fluctuation every 8-12 seconds and persist
setInterval(async () => {
  const delta = Math.floor(Math.random() * 5) - 2;
  ghostClients = Math.max(0, Math.min(ghostClients + delta, 20));
  broadcast();
  await persistCount();
}, 9000);

router.get("/altar/stream", (req, res): void => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  clients.add(res);

  const initialPayload = JSON.stringify({ count: getCount(), timestamp: Date.now() });
  res.write(`data: ${initialPayload}\n\n`);

  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat\n\n`);
    } catch {
      clearInterval(heartbeat);
    }
  }, 30000);

  req.on("close", () => {
    clearInterval(heartbeat);
    clients.delete(res);
    broadcast();
  });
});

router.get("/altar/count", (_req, res): void => {
  res.json({ count: getCount(), timestamp: Date.now() });
});

export default router;

import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import net from "node:net";

const router: IRouter = Router();

async function checkDatabase(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  let client;
  try {
    client = await pool.connect();
    await client.query("SELECT 1");
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, error: String(err) };
  } finally {
    client?.release();
  }
}

function checkRedis(url: string): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  return new Promise((resolve) => {
    const start = Date.now();
    try {
      const parsed = new URL(url);
      const port = parseInt(parsed.port || "6379", 10);
      const host = parsed.hostname;
      const socket = net.createConnection({ host, port, timeout: 3000 });
      socket.once("connect", () => {
        socket.destroy();
        resolve({ ok: true, latencyMs: Date.now() - start });
      });
      socket.once("timeout", () => {
        socket.destroy();
        resolve({ ok: false, latencyMs: Date.now() - start, error: "connection timed out" });
      });
      socket.once("error", (err) => {
        resolve({ ok: false, latencyMs: Date.now() - start, error: err.message });
      });
    } catch (err) {
      resolve({ ok: false, latencyMs: Date.now() - start, error: String(err) });
    }
  });
}

async function healthHandler(_req: Request, res: Response) {
  const [db, redis] = await Promise.all([
    checkDatabase(),
    process.env.REDIS_URL
      ? checkRedis(process.env.REDIS_URL)
      : Promise.resolve(null),
  ]);

  const allOk = db.ok && (redis === null || redis.ok);

  const payload = {
    status: allOk ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    services: {
      database: {
        status: db.ok ? "ok" : "error",
        latencyMs: db.latencyMs,
        ...(db.error && process.env.NODE_ENV !== "production" ? { error: db.error } : {}),
      },
      ...(redis !== null
        ? {
            redis: {
              status: redis.ok ? "ok" : "error",
              latencyMs: redis.latencyMs,
              ...(redis.error && process.env.NODE_ENV !== "production" ? { error: redis.error } : {}),
            },
          }
        : {}),
    },
  };

  res.status(allOk ? 200 : 503).json(payload);
}

router.get("/healthz", healthHandler);
router.get("/health", healthHandler);

export default router;

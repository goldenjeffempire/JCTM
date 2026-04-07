import { Router, type IRouter } from "express";
import type { Response } from "express";

const router: IRouter = Router();

const clients = new Set<Response>();
const BASE_COUNT = 47;

function getCount(): number {
  return BASE_COUNT + clients.size;
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

// Simulate realistic fluctuation every 8-12 seconds
let ghostClients = 0;
setInterval(() => {
  const delta = Math.floor(Math.random() * 5) - 2;
  ghostClients = Math.max(0, Math.min(ghostClients + delta, 20));
  broadcast();
}, 9000);

router.get("/altar/stream", (req, res): void => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  clients.add(res);

  const initialPayload = JSON.stringify({ count: getCount() + ghostClients, timestamp: Date.now() });
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
  res.json({ count: getCount() + ghostClients, timestamp: Date.now() });
});

export default router;

import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  username: string;
  message: string;
  timestamp: number;
  isModerated: boolean;
  cid?: string; // client-generated temp ID, echoed back for optimistic UI
}

interface PrayerRequest {
  id: string;
  name: string;
  prayer: string;
  timestamp: number;
  prayCount: number;
}

// ─── In-memory store ─────────────────────────────────────────────────────────

const MAX_MESSAGES = 200;
const MAX_PRAYERS = 50;
const messageHistory: ChatMessage[] = [];
const prayerHistory: PrayerRequest[] = [];

/**
 * Active SSE sessions keyed by session-id (sid).
 * Using a Map instead of a Set so we can deduplicate by sid:
 * if the same viewer reconnects we replace the old response object,
 * keeping the viewer count stable instead of inflating it.
 */
const sessions = new Map<string, Response>();

// ─── Broadcast ────────────────────────────────────────────────────────────────

function broadcast(data: object): void {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const [sid, res] of sessions) {
    try {
      res.write(payload);
    } catch {
      sessions.delete(sid);
    }
  }
}

// ─── Keepalive heartbeat ──────────────────────────────────────────────────────
// Proxies (Nginx, Cloudflare) kill idle connections after ~60–90 s.
// Sending an SSE comment every 25 s keeps the TCP socket alive.

const heartbeat = setInterval(() => {
  for (const [sid, res] of sessions) {
    try {
      res.write(": keepalive\n\n");
    } catch {
      sessions.delete(sid);
    }
  }
}, 25_000);
heartbeat.unref(); // don't prevent process exit

// ─── Sanitisation ─────────────────────────────────────────────────────────────

/** Strip C0/C1 control characters (except newline) and trim. */
function sanitize(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g, "")
    .trim();
}

// ─── Profanity / spam filter ──────────────────────────────────────────────────

const BLOCKED_TERMS = ["spam", "scam", "fake", "fraud", "click here", "free money"];
function isAllowed(text: string): boolean {
  const lower = text.toLowerCase();
  return !BLOCKED_TERMS.some(w => lower.includes(w));
}

// ─── Rate limiting ────────────────────────────────────────────────────────────

interface RateBucket { timestamps: number[] }
const msgRateBuckets = new Map<string, RateBucket>();
const MSG_RATE_WINDOW_MS = 15_000; // 15-second rolling window
const MSG_RATE_MAX = 6;            // max 6 messages per window

function checkMsgRateLimit(ip: string): boolean {
  const now = Date.now();
  const bucket = msgRateBuckets.get(ip) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter(t => now - t < MSG_RATE_WINDOW_MS);
  if (bucket.timestamps.length >= MSG_RATE_MAX) {
    msgRateBuckets.set(ip, bucket);
    return false;
  }
  bucket.timestamps.push(now);
  msgRateBuckets.set(ip, bucket);
  return true;
}

// Prayer rate: max 3 per IP per hour
const prayerRateBuckets = new Map<string, number[]>();
const PRAYER_RATE_WINDOW_MS = 60 * 60_000;
const PRAYER_RATE_MAX = 3;

function checkPrayerRateLimit(ip: string): boolean {
  const now = Date.now();
  const times = (prayerRateBuckets.get(ip) ?? []).filter(t => now - t < PRAYER_RATE_WINDOW_MS);
  if (times.length >= PRAYER_RATE_MAX) {
    prayerRateBuckets.set(ip, times);
    return false;
  }
  times.push(now);
  prayerRateBuckets.set(ip, times);
  return true;
}

// Periodically prune stale rate-limit entries to avoid unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [ip, b] of msgRateBuckets) {
    if (!b.timestamps.some(t => now - t < MSG_RATE_WINDOW_MS)) msgRateBuckets.delete(ip);
  }
  for (const [ip, times] of prayerRateBuckets) {
    if (!times.some(t => now - t < PRAYER_RATE_WINDOW_MS)) prayerRateBuckets.delete(ip);
  }
}, 5 * 60_000).unref();

// ─── Helper: resolve client IP ────────────────────────────────────────────────

function clientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0]!.trim();
  return req.socket.remoteAddress ?? "unknown";
}

// ─── SSE: live stream endpoint ────────────────────────────────────────────────

router.get("/livechat/stream", (req: Request, res: Response): void => {
  // Accept a session-id from the client to deduplicate reconnects.
  const sid = typeof req.query.sid === "string" && req.query.sid.length > 0
    ? req.query.sid.slice(0, 64)
    : `anon-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // If this sid already has an open connection, cleanly close it first.
  // This prevents the viewer count from inflating on page refresh / reconnect.
  const existing = sessions.get(sid);
  if (existing) {
    try { existing.end(); } catch { /* already gone */ }
    sessions.delete(sid);
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable Nginx proxy buffering
  res.flushHeaders();

  // Immediately send the last 50 messages and all prayer history to the new client.
  const recentMessages = messageHistory.slice(-50);
  res.write(`data: ${JSON.stringify({ type: "history", messages: recentMessages })}\n\n`);
  res.write(`data: ${JSON.stringify({ type: "prayer_history", prayers: prayerHistory })}\n\n`);

  sessions.set(sid, res);

  // Broadcast updated viewer count to everyone (including the new client).
  broadcast({ type: "count", count: sessions.size });

  req.on("close", () => {
    // Only remove if this is still the active session for this sid.
    if (sessions.get(sid) === res) {
      sessions.delete(sid);
      broadcast({ type: "count", count: sessions.size });
    }
  });
});

// ─── POST: send a chat message ────────────────────────────────────────────────

router.post("/livechat/message", (req: Request, res: Response): void => {
  const ip = clientIp(req);

  if (!checkMsgRateLimit(ip)) {
    res.status(429).json({ error: "You're sending messages too fast. Please slow down." });
    return;
  }

  const rawUsername = req.body?.username;
  const rawMessage = req.body?.message;
  const cid = typeof req.body?.cid === "string" ? req.body.cid.slice(0, 64) : undefined;

  if (typeof rawUsername !== "string" || typeof rawMessage !== "string") {
    res.status(400).json({ error: "Username and message are required." });
    return;
  }

  const username = sanitize(rawUsername).slice(0, 30);
  const message = sanitize(rawMessage);

  if (!username || !message) {
    res.status(400).json({ error: "Username and message cannot be empty." });
    return;
  }
  if (message.length > 300) {
    res.status(400).json({ error: "Message too long (max 300 characters)." });
    return;
  }

  const allowed = isAllowed(message);
  const msg: ChatMessage = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    username,
    message: allowed ? message : "[Message removed by moderation]",
    timestamp: Date.now(),
    isModerated: !allowed,
    ...(cid ? { cid } : {}),
  };

  messageHistory.push(msg);
  if (messageHistory.length > MAX_MESSAGES) messageHistory.shift();

  broadcast({ type: "message", message: msg });
  res.json({ success: true, id: msg.id });
});

// ─── POST: react to a message ─────────────────────────────────────────────────

router.post("/livechat/react", (req: Request, res: Response): void => {
  const ALLOWED_REACTIONS = ["🙏", "🔥", "❤️", "🕊️", "💯", "⚡", "👏"];
  const { messageId, reaction } = req.body as { messageId?: string; reaction?: string };

  if (!messageId || !reaction || !ALLOWED_REACTIONS.includes(reaction)) {
    res.status(400).json({ error: "Invalid reaction." });
    return;
  }

  broadcast({ type: "reaction", messageId, reaction });
  res.json({ success: true });
});

// ─── POST: submit a prayer request ───────────────────────────────────────────

router.post("/livechat/prayer", (req: Request, res: Response): void => {
  const ip = clientIp(req);

  if (!checkPrayerRateLimit(ip)) {
    res.status(429).json({ error: "You've submitted too many prayer requests. Please wait before submitting another." });
    return;
  }

  const rawName = req.body?.name;
  const rawPrayer = req.body?.prayer;

  if (typeof rawName !== "string" || typeof rawPrayer !== "string") {
    res.status(400).json({ error: "Name and prayer are required." });
    return;
  }

  const name = sanitize(rawName).slice(0, 40);
  const prayer = sanitize(rawPrayer);

  if (!name || !prayer) {
    res.status(400).json({ error: "Name and prayer cannot be empty." });
    return;
  }
  if (prayer.length > 500) {
    res.status(400).json({ error: "Prayer request too long (max 500 characters)." });
    return;
  }
  if (!isAllowed(prayer)) {
    res.status(400).json({ error: "Prayer request was flagged by moderation." });
    return;
  }

  const entry: PrayerRequest = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    prayer,
    timestamp: Date.now(),
    prayCount: 0,
  };

  prayerHistory.push(entry);
  if (prayerHistory.length > MAX_PRAYERS) prayerHistory.shift();

  broadcast({ type: "prayer_new", prayer: entry });
  res.json({ success: true, id: entry.id });
});

// ─── POST: pray for a request ─────────────────────────────────────────────────

router.post("/livechat/pray", (req: Request, res: Response): void => {
  const { prayerId } = req.body as { prayerId?: string };
  if (!prayerId) {
    res.status(400).json({ error: "prayerId is required." });
    return;
  }

  const entry = prayerHistory.find(p => p.id === prayerId);
  if (!entry) {
    res.status(404).json({ error: "Prayer request not found." });
    return;
  }

  entry.prayCount += 1;
  broadcast({ type: "pray_count", prayerId: entry.id, prayCount: entry.prayCount });
  res.json({ success: true, prayCount: entry.prayCount });
});

export default router;

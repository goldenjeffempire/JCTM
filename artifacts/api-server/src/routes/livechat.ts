import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

interface ChatMessage {
  id: string;
  username: string;
  message: string;
  timestamp: number;
  isModerated?: boolean;
  reaction?: string;
}

interface PrayerRequest {
  id: string;
  name: string;
  prayer: string;
  timestamp: number;
  prayCount: number;
}

const MAX_MESSAGES = 200;
const MAX_PRAYERS = 50;
const messageHistory: ChatMessage[] = [];
const prayerHistory: PrayerRequest[] = [];
const clients = new Set<Response>();

function broadcast(data: object) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  clients.forEach(client => {
    try { client.write(payload); } catch { clients.delete(client); }
  });
}

// Profanity / spam filter (basic)
const BLOCKED = ["spam", "scam", "fake", "fraud", "click here", "free money"];
function moderate(text: string): boolean {
  const lower = text.toLowerCase();
  return !BLOCKED.some(w => lower.includes(w));
}

// SSE stream for live chat + prayer
router.get("/livechat/stream", (req: Request, res: Response): void => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Send recent chat history
  const recent = messageHistory.slice(-30);
  res.write(`data: ${JSON.stringify({ type: "history", messages: recent })}\n\n`);
  res.write(`data: ${JSON.stringify({ type: "count", count: clients.size + 1 })}\n\n`);

  // Send prayer history
  res.write(`data: ${JSON.stringify({ type: "prayer_history", prayers: prayerHistory })}\n\n`);

  clients.add(res);
  broadcast({ type: "count", count: clients.size });

  req.on("close", () => {
    clients.delete(res);
    broadcast({ type: "count", count: clients.size });
  });
});

// Post a chat message
router.post("/livechat/message", (req: Request, res: Response): void => {
  const { username, message } = req.body as { username: string; message: string };

  if (!username?.trim() || !message?.trim()) {
    res.status(400).json({ error: "Username and message required" });
    return;
  }
  if (message.length > 300) {
    res.status(400).json({ error: "Message too long (max 300 chars)" });
    return;
  }

  const isModerated = moderate(message);
  const msg: ChatMessage = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    username: username.trim().slice(0, 30),
    message: isModerated ? message.trim() : "[Message removed by moderation]",
    timestamp: Date.now(),
    isModerated: !isModerated,
  };

  messageHistory.push(msg);
  if (messageHistory.length > MAX_MESSAGES) messageHistory.shift();

  broadcast({ type: "message", message: msg });
  res.json({ success: true, id: msg.id });
});

// React to a chat message
router.post("/livechat/react", (req: Request, res: Response): void => {
  const { messageId, reaction } = req.body as { messageId: string; reaction: string };
  const ALLOWED_REACTIONS = ["🙏", "🔥", "❤️", "🕊️", "💯", "⚡", "👏"];

  if (!ALLOWED_REACTIONS.includes(reaction)) {
    res.status(400).json({ error: "Invalid reaction" });
    return;
  }

  broadcast({ type: "reaction", messageId, reaction });
  res.json({ success: true });
});

// Submit a prayer request
router.post("/livechat/prayer", (req: Request, res: Response): void => {
  const { name, prayer } = req.body as { name: string; prayer: string };

  if (!name?.trim() || !prayer?.trim()) {
    res.status(400).json({ error: "Name and prayer are required" });
    return;
  }
  if (prayer.length > 500) {
    res.status(400).json({ error: "Prayer too long (max 500 characters)" });
    return;
  }
  if (!moderate(prayer)) {
    res.status(400).json({ error: "Prayer request was flagged by moderation" });
    return;
  }

  const entry: PrayerRequest = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim().slice(0, 40),
    prayer: prayer.trim(),
    timestamp: Date.now(),
    prayCount: 0,
  };

  prayerHistory.push(entry);
  if (prayerHistory.length > MAX_PRAYERS) prayerHistory.shift();

  broadcast({ type: "prayer_new", prayer: entry });
  res.json({ success: true, id: entry.id });
});

// Pray for a request (increments count)
router.post("/livechat/pray", (req: Request, res: Response): void => {
  const { prayerId } = req.body as { prayerId: string };
  const entry = prayerHistory.find(p => p.id === prayerId);

  if (!entry) {
    res.status(404).json({ error: "Prayer request not found" });
    return;
  }

  entry.prayCount += 1;
  broadcast({ type: "pray_count", prayerId: entry.id, prayCount: entry.prayCount });
  res.json({ success: true, prayCount: entry.prayCount });
});

export default router;

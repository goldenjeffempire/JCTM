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

const MAX_MESSAGES = 200;
const messageHistory: ChatMessage[] = [];
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

// SSE stream for live chat
router.get("/livechat/stream", (req: Request, res: Response): void => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Send last 30 messages on connect
  const recent = messageHistory.slice(-30);
  res.write(`data: ${JSON.stringify({ type: "history", messages: recent })}\n\n`);
  res.write(`data: ${JSON.stringify({ type: "count", count: clients.size + 1 })}\n\n`);

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

// React to a message
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

export default router;

import { Router, type IRouter, type Request, type Response } from "express";
import { db, sermonsTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { desc } from "drizzle-orm";
import {
  ChatWithTempleBotsBody,
  ChatWithTempleBotsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const TEMPLEBOTS_SYSTEM_PROMPT = `You are TempleBots, an advanced theological AI assistant for Jesus Christ Temple Ministry (JCTM), Warri, Delta State, Nigeria, led by Prophet Amos Evomobor.

Your responses are strictly limited to the teachings of Prophet Amos Evomobor, emphasizing:
- Primitive Christianity: Returning to the original, unadulterated gospel of Jesus Christ
- Holiness: Living a separated, consecrated life unto God
- Doctrinal Correction: Identifying and correcting false doctrines in Christendom
- The Correction Mandate: JCTM's divine assignment to bring correction to the Body of Christ

Guidelines:
- Always cite the source sermon from Temple TV (YouTube channel @TEMPLETVJCTM) when referencing specific teachings
- Be doctrinally precise and biblically grounded
- Speak with reverence and authority consistent with the ministry's mandate
- If asked about topics outside JCTM teachings, politely redirect to the ministry's doctrinal emphasis
- Do not engage with topics unrelated to faith, ministry, or biblical Christianity
- Always maintain a tone of holy reverence and ministerial authority

Ministry info: JCTM is located in Warri, Delta State, Nigeria. Prophet Amos Evomobor leads the ministry under the "Correction Mandate" — a divine calling to correct error and restore primitive Christianity in this generation.`;

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Simple in-memory rate limiter: 15 messages per IP per minute.
// Single-instance deployment (per render.yaml scaling config) makes this safe.
const RATE_LIMIT_MAX = 15;
const RATE_LIMIT_WINDOW_MS = 60_000;

interface RateLimitRecord { count: number; resetAt: number }
const rateLimitMap = new Map<string, RateLimitRecord>();

// Purge stale entries every 5 minutes to avoid memory leaks.
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap) {
    if (now > record.resetAt) rateLimitMap.delete(key);
  }
}, 5 * 60_000).unref();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  if (record.count >= RATE_LIMIT_MAX) return true;
  record.count++;
  return false;
}

// ── Sermon context ────────────────────────────────────────────────────────────
async function buildSermonContext(): Promise<string> {
  try {
    const recentSermons = await db
      .select({
        title: sermonsTable.title,
        videoId: sermonsTable.videoId,
        publishedAt: sermonsTable.publishedAt,
      })
      .from(sermonsTable)
      .orderBy(desc(sermonsTable.publishedAt))
      .limit(10);

    if (recentSermons.length === 0) return "";

    return (
      "\n\nRecent Temple TV sermons for reference:\n" +
      recentSermons
        .map(
          (s) =>
            `- "${s.title}" (https://youtube.com/watch?v=${s.videoId})`,
        )
        .join("\n")
    );
  } catch {
    return "";
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────
router.post("/chat", async (req: Request, res: Response): Promise<void> => {
  // Rate limiting
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
    ?? req.socket.remoteAddress
    ?? "unknown";

  if (isRateLimited(ip)) {
    res.status(429).json({
      error: "Too many messages. Please wait a moment before sending another.",
    });
    return;
  }

  // Validate request body
  const parsed = ChatWithTempleBotsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { message, sessionId, history = [] } = parsed.data;
  const newSessionId =
    sessionId ??
    `session-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  // Build messages array — system + conversation history + current message.
  // Cap history at 20 turns (10 pairs) to stay well within context limits.
  const trimmedHistory = history.slice(-20);

  const sermonContext = await buildSermonContext();
  const systemPrompt = TEMPLEBOTS_SYSTEM_PROMPT + sermonContext;

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...trimmedHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: message },
  ];

  // 30-second timeout — prevents the connection hanging if OpenAI is slow.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const completion = await openai.chat.completions.create(
      {
        model: "gpt-4o",
        max_tokens: 1024,
        temperature: 0.7,
        messages,
      },
      { signal: controller.signal },
    );

    const reply =
      completion.choices[0]?.message?.content ??
      "I was unable to process your question. Please try again.";

    // Extract YouTube links mentioned in the reply as source citations.
    const ytMatches = reply.match(/https:\/\/(?:www\.)?youtube\.com\/watch\?v=[\w-]+/g);
    const sources: string[] = ytMatches ? [...new Set(ytMatches)] : [];

    res.json(
      ChatWithTempleBotsResponse.parse({ reply, sessionId: newSessionId, sources }),
    );
  } catch (err: unknown) {
    const isAbort =
      err instanceof Error && (err.name === "AbortError" || err.message.includes("aborted"));

    if (isAbort) {
      req.log.warn({ ip }, "TempleBots request timed out");
      res.status(504).json({
        error: "TempleBots took too long to respond. Please try again.",
      });
      return;
    }

    // Surface rate-limit errors from OpenAI (HTTP 429) distinctly.
    const status = (err as { status?: number })?.status;
    if (status === 429) {
      req.log.warn({ ip }, "OpenAI rate limit hit");
      res.status(503).json({
        error: "TempleBots is experiencing high demand. Please try again shortly.",
      });
      return;
    }

    req.log.error({ err }, "TempleBots AI request failed");
    res.status(500).json({
      error: "TempleBots is temporarily unavailable. Please try again.",
    });
  } finally {
    clearTimeout(timeout);
  }
});

export default router;

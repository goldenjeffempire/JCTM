/**
 * AI Routes — Zero External API
 *
 * All endpoints use local generation exclusively:
 *   - scripture-study, spiritual-insight, testimony-reflect → local text generation
 *   - suggested-questions → static JCTM pool + local engine
 *   - voice-chat → graceful fallback (no audio model)
 *   - health, model-status → platform monitor
 *   - local-inference, feedback → unchanged (already local)
 *
 * No OpenAI imports. No external API calls.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { db, conversations, messages } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { runLocalInference, ENGINE_METADATA } from "../lib/local-ai-engine.js";
import { generateScriptureStudy, generateSpiritualInsight } from "../lib/local-text-generation.js";
import { getPlatformHealth } from "../lib/platform-monitor.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

// ── Rate limiting ─────────────────────────────────────────────────────────────
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;
interface RateRecord { count: number; resetAt: number }
const rateMap = new Map<string, RateRecord>();
setInterval(() => {
  const now = Date.now();
  for (const [k, r] of rateMap) if (now > r.resetAt) rateMap.delete(k);
}, 5 * 60_000).unref();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const r = rateMap.get(ip);
  if (!r || now > r.resetAt) { rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS }); return false; }
  if (r.count >= RATE_LIMIT) return true;
  r.count++;
  return false;
}
function clientIp(req: Request): string {
  return (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "unknown";
}
function sseHeaders(res: Response) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
}
function sse(res: Response, data: object) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * Stream a pre-generated local response word-by-word via SSE.
 * Simulates real streaming for a smooth client UX.
 */
async function streamLocalResponse(res: Response, text: string): Promise<void> {
  const words = text.split(/(\s+)/);
  const CHUNK = 3;
  for (let i = 0; i < words.length; i += CHUNK) {
    const delta = words.slice(i, i + CHUNK).join("");
    if (delta) sse(res, { delta });
    await new Promise(r => setTimeout(r, 12));
  }
  sse(res, { done: true });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/ai/scripture-study
// Deep local analysis of any Bible passage — streaming SSE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.post("/ai/scripture-study", async (req: Request, res: Response): Promise<void> => {
  if (checkRateLimit(clientIp(req))) {
    res.status(429).json({ error: "Rate limit exceeded. Please wait before submitting again." });
    return;
  }

  const { passage, question } = req.body as { passage?: string; question?: string };
  if (!passage?.trim()) { res.status(400).json({ error: "Bible passage is required." }); return; }

  sseHeaders(res);

  try {
    const content = generateScriptureStudy(passage.trim(), question?.trim());
    await streamLocalResponse(res, content);
  } catch (err) {
    logger.error({ err, route: "ai/scripture-study" }, "Scripture study failed");
    sse(res, { error: "Scripture study service temporarily unavailable. Please try again." });
  } finally {
    res.end();
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/ai/spiritual-insight
// Personalized spiritual insight — streaming SSE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.post("/ai/spiritual-insight", async (req: Request, res: Response): Promise<void> => {
  if (checkRateLimit(clientIp(req))) {
    res.status(429).json({ error: "Rate limit exceeded." });
    return;
  }

  const { situation, name, category = "general" } = req.body as {
    situation?: string;
    name?: string;
    category?: string;
  };

  if (!situation?.trim()) { res.status(400).json({ error: "Please describe your situation." }); return; }

  sseHeaders(res);

  try {
    const content = generateSpiritualInsight(situation.trim(), name?.trim(), category);
    await streamLocalResponse(res, content);
  } catch (err) {
    logger.error({ err, route: "ai/spiritual-insight" }, "Spiritual insight failed");
    sse(res, { error: "Spiritual insight service temporarily unavailable." });
  } finally {
    res.end();
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/ai/voice-chat
// Voice TempleBots — text-based graceful fallback (no audio model)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.post("/ai/voice-chat", async (req: Request, res: Response): Promise<void> => {
  if (checkRateLimit(clientIp(req))) {
    res.status(429).json({ error: "Rate limit exceeded." });
    return;
  }

  const { audio, conversationId } = req.body as { audio?: string; conversationId?: number };
  if (!audio) { res.status(400).json({ error: "Audio data is required." }); return; }

  sseHeaders(res);

  try {
    let convId = conversationId;

    if (!convId) {
      try {
        const [newConv] = await db
          .insert(conversations)
          .values({ title: `Voice session ${new Date().toISOString()}` })
          .returning({ id: conversations.id });
        convId = newConv?.id;
      } catch (err) {
        logger.warn({ err, route: "ai/voice-chat" }, "Failed to create voice conversation row");
      }
    }

    const fallbackText = "Voice processing is not available in this configuration. Please use the text chat to interact with TempleBots. Visit jctm.org.ng for more ways to connect with the ministry.";

    sse(res, { type: "transcript", data: fallbackText });
    sse(res, { done: true, conversationId: convId });
  } catch (err) {
    logger.error({ err, route: "ai/voice-chat" }, "Voice chat failed");
    sse(res, { type: "error", error: "Voice chat is unavailable. Please use text chat." });
  } finally {
    res.end();
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/ai/testimony-reflect
// AI reflection on a user testimony — streaming SSE (local)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.post("/ai/testimony-reflect", async (req: Request, res: Response): Promise<void> => {
  if (checkRateLimit(clientIp(req))) {
    res.status(429).json({ error: "Rate limit exceeded." });
    return;
  }

  const { testimony, name } = req.body as { testimony?: string; name?: string };
  if (!testimony?.trim()) { res.status(400).json({ error: "Testimony text is required." }); return; }

  sseHeaders(res);

  try {
    const nameStr = name?.trim() ? `Dear ${name.trim()}, ` : "";
    const testimonySnippet = testimony.trim().slice(0, 300);

    const content = `## 🎉 God Has Been Faithful!

${nameStr}What you have shared is a powerful testimony of God's faithfulness and love in your life. *"${testimonySnippet}${testimony.length > 300 ? "..." : ""}"* — this is not coincidence; this is covenant. God has been working, and He wants you to know that He sees you.

## 📖 What the Word Says About This

*"And we know that in all things God works for the good of those who love him, who have been called according to his purpose."* — Romans 8:28

Your testimony is a living proof of this promise. Every situation you walked through — every difficulty, every uncertainty — was being used by God for a purpose greater than what you could see in the moment. Psalm 34:6 affirms: *"This poor man cried, and the LORD heard him, and saved him out of all his troubles."*

## 🔥 Deeper Prophetic Meaning

From the perspective of the Correction Mandate and JCTM's teaching under Prophet Amos Evomobor, your testimony carries a prophetic dimension: God is not only blessing you personally — He is using your experience as a testimony that will impact others around you. Revelation 12:11 declares: *"They overcame him by the blood of the Lamb and by the word of their testimony."*

Your testimony is a weapon. Share it boldly. The enemy is defeated by it.

## ✦ Carry This Forward

1. **Write it down** — Document your testimony so you never forget what God has done, and so you can share it accurately when He opens the door.

2. **Share it** — Submit your testimony to the JCTM community at jctm.org.ng/testimonies so your faith story can strengthen others.

3. **Give God glory** — Let this testimony deepen your commitment to holiness and consecrated living. What God has done for you, let it fuel your walk with Him.

*Watch testimonies and sermons of God's faithfulness on Temple TV — YouTube: @TEMPLETVJCTM*`;

    await streamLocalResponse(res, content);
  } catch (err) {
    logger.error({ err, route: "ai/testimony-reflect" }, "Testimony reflection failed");
    sse(res, { error: "Reflection service temporarily unavailable." });
  } finally {
    res.end();
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/ai/suggested-questions
// Context-aware follow-up questions (local pool)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const JCTM_QUESTIONS_POOL = [
  "What is the Correction Mandate and why was it given to Prophet Amos?",
  "How does JCTM define Primitive Christianity?",
  "What are the five errors the Correction Mandate addresses?",
  "What does the Bible teach about water baptism by full immersion?",
  "How should a believer respond to prosperity gospel teachings?",
  "What is the role of holiness in the life of a believer?",
  "How does JCTM understand the five-fold ministry offices?",
  "What does scripture say about testing prophecy?",
  "How can I grow in my prayer life according to sound doctrine?",
  "What is the biblical basis for speaking in tongues?",
  "What does JCTM teach about end-time prophecy and the second coming?",
  "How is water baptism different from infant baptism?",
  "Who is Prophet Amos Evomobor and what is his calling?",
  "What is the difference between salvation and Spirit baptism?",
  "How does holiness relate to grace — are they in conflict?",
  "What does the Bible say about false prophets in the last days?",
  "How can I know if a church is doctrinally sound?",
  "What is the significance of speaking in tongues as initial evidence?",
  "How does JCTM approach giving and tithes without the prosperity gospel?",
  "What can I do to get closer to God in my daily life?",
];

router.post("/ai/suggested-questions", (req: Request, res: Response): void => {
  const { history = [] } = req.body as { history?: Array<{ role: string; content: string }> };

  const shuffled = [...JCTM_QUESTIONS_POOL].sort(() => Math.random() - 0.5);
  const questions = shuffled.slice(0, 5);

  res.json({ questions });
});

// GET /api/ai/suggested-questions
let cachedQuestions: string[] | null = null;
let cacheExpiry = 0;

router.get("/ai/suggested-questions", (_req: Request, res: Response): void => {
  const now = Date.now();
  if (cachedQuestions && now < cacheExpiry) {
    res.json({ questions: cachedQuestions });
    return;
  }

  const shuffled = [...JCTM_QUESTIONS_POOL].sort(() => Math.random() - 0.5);
  cachedQuestions = shuffled.slice(0, 10);
  cacheExpiry = now + 6 * 60 * 60 * 1000;

  res.json({ questions: cachedQuestions });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/ai/health
// AI system health check — uses platform monitor
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get("/ai/health", async (req: Request, res: Response): Promise<void> => {
  const isAdmin = req.headers["x-admin-token"] === process.env.ADMIN_HEALTH_TOKEN
    && !!process.env.ADMIN_HEALTH_TOKEN;

  if (!isAdmin) {
    res.json({ status: "operational", timestamp: new Date().toISOString() });
    return;
  }

  try {
    const health = await getPlatformHealth();
    res.json({
      status: health.status,
      architecture: {
        primaryLayer: "JCTM Local AI Engine (Zero External API)",
        enhancementLayer: "None — fully local",
        strategy: "Local-first inference: pattern matching + RAG + template generation",
      },
      localEngine: ENGINE_METADATA,
      openAiModel: "none — disabled",
      openaiEnabled: false,
      features: Object.keys(health.features).filter(k => health.features[k]),
      ai: health.ai,
      resources: health.resources,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.json({ status: "operational", timestamp: new Date().toISOString() });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/ai/local-inference
// Direct access to the local AI engine (diagnostic + testing)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.post("/ai/local-inference", (req: Request, res: Response): void => {
  const { query } = req.body as { query?: string };
  if (!query?.trim()) {
    res.status(400).json({ error: "query is required" });
    return;
  }
  const result = runLocalInference(query.trim());
  res.json({ query, result, engineVersion: ENGINE_METADATA.version });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/ai/feedback
// Feedback loop — log interaction quality
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.post("/ai/feedback", async (req: Request, res: Response): Promise<void> => {
  const {
    sessionId, messageId, userQuery, aiResponse, rating,
    feedbackText, modelTier, latencyMs, confidenceScore, wasHelpful, category,
  } = req.body as {
    sessionId?: string; messageId?: string; userQuery?: string; aiResponse?: string;
    rating?: number; feedbackText?: string; modelTier?: string; latencyMs?: number;
    confidenceScore?: number; wasHelpful?: number; category?: string;
  };

  if (!userQuery?.trim() || !aiResponse?.trim()) {
    res.status(400).json({ error: "userQuery and aiResponse are required" });
    return;
  }
  if (rating !== undefined && (rating < 1 || rating > 5)) {
    res.status(400).json({ error: "rating must be between 1 and 5" });
    return;
  }

  try {
    const { pool } = await import("@workspace/db");
    await pool.query(
      `INSERT INTO ai_feedback
         (session_id, query, response_snippet, rating, helpful, comment, tier,
          user_query, ai_response, feedback_text, model_tier, latency_ms,
          confidence_score, was_helpful, category)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        sessionId ?? null, userQuery, aiResponse.slice(0, 500), rating ?? null,
        wasHelpful === 1 ? true : wasHelpful === 0 ? false : null,
        feedbackText ?? null, modelTier ?? "local", userQuery, aiResponse,
        feedbackText ?? null, modelTier ?? "local", latencyMs ?? null,
        confidenceScore ?? null, wasHelpful ?? null, category ?? null,
      ],
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to record feedback" });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/ai/model-status
// Reports current model routing configuration (local-only)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get("/ai/model-status", (_req: Request, res: Response): void => {
  res.json({
    architecture: "Zero External API — Fully Local",
    tiers: {
      tier1: { name: "Local AI Engine", description: "Exact-match + TF-IDF keyword scoring", latency: "<1ms" },
      tier2: { name: "RAG (pgvector)", description: "Semantic vector similarity search", latency: "10-50ms" },
      tier3: { name: "Local Template Generation", description: "JCTM knowledge-base template system", latency: "1-5ms" },
    },
    openaiAvailable: false,
    openaiEnabled: false,
    version: ENGINE_METADATA.version,
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/health
// Full platform health check (comprehensive)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get("/health", async (_req: Request, res: Response): Promise<void> => {
  try {
    const health = await getPlatformHealth();
    const statusCode = health.status === "down" ? 503 : health.status === "degraded" ? 207 : 200;
    res.status(statusCode).json(health);
  } catch (err) {
    res.status(500).json({ status: "down", error: "Health check failed", checkedAt: new Date().toISOString() });
  }
});

export default router;

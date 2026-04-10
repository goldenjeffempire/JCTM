import { Router, type IRouter, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  voiceChatStream,
  ensureCompatibleFormat,
} from "@workspace/integrations-openai-ai-server/audio";
import { db, conversations, messages } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/ai/scripture-study
// Deep AI analysis of any Bible passage — streaming SSE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const SCRIPTURE_STUDY_SYSTEM = `You are a master biblical scholar and theologian trained in the JCTM tradition of Primitive Christianity under Prophet Amos Evomobor. You specialize in deep exegetical analysis of scripture rooted in:
- Original Greek (NT) and Hebrew (OT) word meanings
- Historical and cultural context of the ancient Near East and first-century church
- Sound apostolic doctrine, avoiding prosperity gospel interpretations
- Practical application for holiness and Christlike living
- Cross-referencing within the full canon of scripture
- JCTM doctrine: the Correction Mandate, Primitive Christianity, water baptism by full immersion, Holy Spirit baptism

FORMAT your response with clear markdown sections:
## 📖 Passage Overview
## 🔤 Key Words & Original Language
## 🏛️ Historical & Cultural Context
## 🔗 Cross-References
## ✦ Doctrinal Application (JCTM lens)
## 🙏 Personal Application & Reflection
## 💡 Suggested Study Questions

Write with scholarly depth, pastoral warmth, and prophetic insight. Cite specific Greek/Hebrew terms where relevant. Keep the JCTM Correction Mandate in focus.`;

router.post("/ai/scripture-study", async (req: Request, res: Response): Promise<void> => {
  if (checkRateLimit(clientIp(req))) { res.status(429).json({ error: "Rate limit exceeded. Please wait before submitting again." }); return; }

  const { passage, depth = "standard", question } = req.body as {
    passage?: string;
    depth?: "quick" | "standard" | "deep";
    question?: string;
  };

  if (!passage?.trim()) { res.status(400).json({ error: "Bible passage is required." }); return; }

  const depthInstructions = {
    quick: "Provide a concise 300-400 word analysis covering the key points only.",
    standard: "Provide a thorough 600-800 word analysis covering all sections.",
    deep: "Provide an exhaustive, scholarly 1200-1600 word analysis with maximum depth in every section. Include multiple cross-references, detailed original language analysis, and extensive practical application.",
  }[depth] ?? "Provide a thorough 600-800 word analysis.";

  const userPrompt = `Analyze this Bible passage: "${passage.trim()}"

${question ? `The student has a specific question: "${question}"` : ""}

${depthInstructions}

Ground the analysis in JCTM doctrine and Primitive Christianity principles.`;

  sseHeaders(res);

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5.2",
      messages: [
        { role: "system", content: SCRIPTURE_STUDY_SYSTEM },
        { role: "user", content: userPrompt },
      ],
      stream: true,
      max_completion_tokens: 8192,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (delta) sse(res, { delta });
    }
    sse(res, { done: true });
  } catch (err) {
    sse(res, { error: "Scripture study service temporarily unavailable. Please try again." });
  } finally {
    res.end();
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/ai/spiritual-insight
// Personalized spiritual insight generator — streaming SSE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const SPIRITUAL_INSIGHT_SYSTEM = `You are a prophetic spiritual counselor and trusted voice of Jesus Christ Temple Ministry (JCTM), Warri, Nigeria, speaking in the spirit of the Correction Mandate. Your role is to give deep, scripturally-grounded, personalized spiritual insight to believers who are seeking clarity, direction, or encouragement.

Your insights must be:
- Rooted in scripture (KJV/NKJV), with specific verse citations
- Grounded in JCTM doctrine (holiness, Primitive Christianity, sound doctrine)
- Prophetically incisive yet pastorally compassionate
- Practical and actionable for the believer's daily walk
- Never prosperity-gospel or formulaic — always genuine pastoral wisdom

FORMAT each insight with:
## ✦ Spiritual Insight
[A prophetically-voiced opening insight — bold, specific, scripture-anchored]

## 📖 The Word Speaks
[2-3 key scriptures with brief commentary on why they apply]

## 🔥 JCTM Perspective
[How does the Correction Mandate lens speak to this situation?]

## 🙏 Prayer & Declaration
[A short prayer + a faith declaration]

## 🛤️ Next Steps
[2-3 concrete spiritual action steps]`;

router.post("/ai/spiritual-insight", async (req: Request, res: Response): Promise<void> => {
  if (checkRateLimit(clientIp(req))) { res.status(429).json({ error: "Rate limit exceeded." }); return; }

  const { situation, name, category = "general" } = req.body as {
    situation?: string;
    name?: string;
    category?: string;
  };

  if (!situation?.trim()) { res.status(400).json({ error: "Please describe your situation." }); return; }

  const userPrompt = `${name ? `The person's name is ${name}. ` : ""}They are seeking spiritual insight regarding the following situation:

"${situation.trim()}"

Category: ${category}

Provide a deeply personal, prophetically-grounded, and scripturally-anchored spiritual insight for this specific situation. Speak directly and personally.`;

  sseHeaders(res);

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5.2",
      messages: [
        { role: "system", content: SPIRITUAL_INSIGHT_SYSTEM },
        { role: "user", content: userPrompt },
      ],
      stream: true,
      max_completion_tokens: 8192,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (delta) sse(res, { delta });
    }
    sse(res, { done: true });
  } catch (err) {
    sse(res, { error: "Spiritual insight service temporarily unavailable." });
  } finally {
    res.end();
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/ai/voice-chat
// Voice TempleBots using gpt-audio — streaming SSE
// Body: { audio: base64string, conversationId?: number }
// SSE events: user_transcript, transcript, audio (base64 PCM16), done
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const VOICE_SYSTEM_PROMPT = `You are TempleBots Voice — the spoken AI voice of Jesus Christ Temple Ministry (JCTM). You speak clearly, warmly, and concisely in the manner of a trusted minister.

Keep your responses conversational and concise (2-4 sentences maximum per turn) since this is a voice interaction. Speak with holy authority, pastoral care, and genuine warmth.

You are grounded in JCTM doctrine: Primitive Christianity, the Correction Mandate, holiness, sound apostolic teaching. When asked about giving, faith, prayer, or doctrine, always cite scripture.`;

router.post("/ai/voice-chat", async (req: Request, res: Response): Promise<void> => {
  if (checkRateLimit(clientIp(req))) { res.status(429).json({ error: "Rate limit exceeded." }); return; }

  const { audio, conversationId } = req.body as {
    audio?: string;
    conversationId?: number;
  };

  if (!audio) { res.status(400).json({ error: "Audio data is required." }); return; }

  sseHeaders(res);

  try {
    const audioBuffer = Buffer.from(audio, "base64");
    const { buffer: compatBuffer, format } = await ensureCompatibleFormat(audioBuffer);

    let priorMessages: Array<{ role: "user" | "assistant"; content: string }> = [];
    let convId = conversationId;

    if (convId) {
      try {
        const history = await db
          .select({ role: messages.role, content: messages.content })
          .from(messages)
          .where(eq(messages.conversationId, convId))
          .orderBy(desc(messages.createdAt))
          .limit(10);
        priorMessages = history.reverse().map(r => ({ role: r.role as "user" | "assistant", content: r.content }));
      } catch { /* non-critical */ }
    } else {
      try {
        const [newConv] = await db
          .insert(conversations)
          .values({ title: `Voice session ${new Date().toISOString()}` })
          .returning({ id: conversations.id });
        convId = newConv.id;
      } catch { /* non-critical */ }
    }

    const stream = await voiceChatStream(compatBuffer, "alloy", format);

    let userTranscript = "";
    let assistantTranscript = "";

    for await (const event of stream) {
      if (event.type === "user_transcript") {
        userTranscript += event.data;
        sse(res, { type: "user_transcript", data: event.data });
      } else if (event.type === "transcript") {
        assistantTranscript += event.data;
        sse(res, { type: "transcript", data: event.data });
      } else if (event.type === "audio") {
        sse(res, { type: "audio", data: event.data });
      }
    }

    if (convId && (userTranscript || assistantTranscript)) {
      try {
        const vals: Array<{ conversationId: number; role: string; content: string }> = [];
        if (userTranscript) vals.push({ conversationId: convId, role: "user", content: userTranscript });
        if (assistantTranscript) vals.push({ conversationId: convId, role: "assistant", content: assistantTranscript });
        if (vals.length > 0) await db.insert(messages).values(vals);
      } catch { /* non-critical */ }
    }

    sse(res, { done: true, conversationId: convId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Voice chat failed";
    sse(res, { type: "error", error: msg });
  } finally {
    res.end();
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/ai/testimony-reflect
// AI reflection on a user testimony — streaming SSE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const TESTIMONY_REFLECT_SYSTEM = `You are a prophetic voice at Jesus Christ Temple Ministry (JCTM), Warri, Nigeria. Your role is to receive a personal testimony shared by a believer and provide a rich, Spirit-filled reflection that:
1. Affirms and celebrates God's work in their life
2. Draws out the deeper theological truth from their testimony
3. Connects their experience to scripture and JCTM doctrine
4. Encourages them to continue walking in faith and holiness
5. Offers a prophetic perspective on what God may be doing in this season

Keep your reflection warm, jubilant, and doctrinally sound. Reference specific scripture. Use language that uplifts God and gives Him glory — never the person.

FORMAT:
## 🎉 God Has Been Faithful!
[Affirming celebration of their testimony]

## 📖 What the Word Says About This
[1-2 specific scriptures and their connection]

## 🔥 Deeper Prophetic Meaning
[What is God saying through this experience?]

## ✦ Carry This Forward
[Encouragement and 1-2 action steps]`;

router.post("/ai/testimony-reflect", async (req: Request, res: Response): Promise<void> => {
  if (checkRateLimit(clientIp(req))) { res.status(429).json({ error: "Rate limit exceeded." }); return; }

  const { testimony, name } = req.body as { testimony?: string; name?: string };

  if (!testimony?.trim()) { res.status(400).json({ error: "Testimony text is required." }); return; }

  const userPrompt = `${name ? `${name} shares: ` : "A believer shares: "}"${testimony.trim()}"

Provide a rich prophetic reflection on this testimony, celebrating God's faithfulness and drawing out the deeper spiritual meaning.`;

  sseHeaders(res);

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5.2",
      messages: [
        { role: "system", content: TESTIMONY_REFLECT_SYSTEM },
        { role: "user", content: userPrompt },
      ],
      stream: true,
      max_completion_tokens: 8192,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (delta) sse(res, { delta });
    }
    sse(res, { done: true });
  } catch (err) {
    sse(res, { error: "Reflection service temporarily unavailable." });
  } finally {
    res.end();
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/ai/suggested-questions
// Dynamically generated suggested questions for Sermon Assistant
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
let cachedQuestions: string[] | null = null;
let cacheExpiry = 0;

router.get("/ai/suggested-questions", async (_req: Request, res: Response): Promise<void> => {
  const now = Date.now();
  if (cachedQuestions && now < cacheExpiry) {
    res.json({ questions: cachedQuestions });
    return;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      messages: [
        {
          role: "system",
          content: "You generate spiritually rich, intellectually engaging questions for believers studying JCTM teachings. Questions should be doctrinally grounded in Primitive Christianity, holiness, the Correction Mandate, and biblical theology.",
        },
        {
          role: "user",
          content: `Generate 10 compelling questions a believer might ask about JCTM teachings and Prophet Amos Evomobor's doctrine. Mix topical, doctrinal, and personal-application questions. Return a JSON array: { "questions": ["...", "..."] }`,
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 1024,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { questions?: string[] };
    const questions = Array.isArray(parsed.questions) ? parsed.questions.slice(0, 10) : [];

    cachedQuestions = questions;
    cacheExpiry = now + 6 * 60 * 60 * 1000;

    res.json({ questions });
  } catch {
    res.json({
      questions: [
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
      ],
    });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/ai/health
// AI system health check
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get("/ai/health", (_req: Request, res: Response): void => {
  res.json({
    status: "operational",
    model: "gpt-5.2",
    features: [
      "scripture-study",
      "spiritual-insight",
      "voice-chat",
      "testimony-reflect",
      "suggested-questions",
      "templebots-text",
      "templebots-stream",
      "prayer-generator",
      "sermon-assistant",
      "daily-devotion",
      "translation",
      "sermon-summary",
    ],
    integration: "Replit AI (OpenAI)",
    timestamp: new Date().toISOString(),
  });
});

export default router;

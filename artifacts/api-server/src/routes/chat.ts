import { Router, type IRouter, type Request, type Response } from "express";
import { db, sermonsTable, conversations, messages } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { ChatWithTempleBotsBody, ChatWithTempleBotsResponse } from "@workspace/api-zod";
import pg from "pg";
import { runLocalInference, streamLocalResponse, ENGINE_METADATA } from "../lib/local-ai-engine.js";
import { localAIEnhancer } from "../lib/local-ai-enhancer.js";
import { embed } from "../lib/local-embeddings.js";
import { cacheGet, cacheSet } from "../lib/ai-response-cache.js";
import { analyzeSentiment } from "../lib/sentiment-engine.js";
import { updateSessionFromMessage } from "../lib/ai-personalization.js";

const { Pool } = pg;

const router: IRouter = Router();

// ── pgvector pool (RAG similarity search) ─────────────────────────────────────
const ragPool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── JCTM Knowledge Base (fallback — used when DB/embeddings not available) ────
const JCTM_KNOWLEDGE_BASE = `
## JCTM KNOWLEDGE BASE — USE THIS TO ANSWER ALL QUESTIONS

### MINISTRY OVERVIEW
Jesus Christ Temple Ministry (JCTM) is a Christian ministry based in Ebrumede, Warri, Delta State, Nigeria. Founded and led by Prophet Amos Evomobor, JCTM operates under a divine mandate called the "Correction Mandate" — a God-given assignment to restore the original, unadulterated gospel of Jesus Christ to the global Body of Christ. JCTM operates Temple TV, a YouTube channel (@TEMPLETVJCTM) that broadcasts sermons, teachings, and live services to a global audience.

### PROPHET AMOS EVOMOBOR
Prophet Amos Evomobor is the founder and senior pastor of JCTM. He holds the prophetic office in the five-fold ministry. He received the Correction Mandate directly from God — a divine commission to bring doctrinal correction and reformation to the global church. He teaches with apostolic authority and theological precision, drawing from deep study of original Greek and Hebrew scriptures. He is known for his bold, uncompromising stance on holiness, doctrinal purity, and restoration of Primitive Christianity.

### THE CORRECTION MANDATE
The Correction Mandate is JCTM's divine assignment to expose and correct five major errors in modern Christianity:
1. Prosperity Gospel / Word of Faith heresy — teaching that financial prosperity is always God's will
2. Prophetic manipulation — false prophets using spiritual gifts for financial gain and control
3. Apostolic abuse — people falsely claiming the office of apostle without genuine calling
4. Sacramental corruption — distortion of baptism and communion from their original meaning
5. Ecumenism without truth — dangerous blending of Christianity with other religions under the guise of unity
This is not a criticism of individuals but a prophetic correction of doctrinal error for the health of the global church.

### PRIMITIVE CHRISTIANITY
JCTM teaches Primitive Christianity — the original faith as practiced in the first-century apostolic church:
- The Bible is the supreme and final authority on all matters of faith and practice
- Salvation is by grace through faith in Jesus Christ alone — not by works or financial giving
- Water baptism by full immersion is the biblical mode (Greek "baptizo" = to immerse)
- The Holy Spirit gifts are still active today but must operate within proper biblical order
- Holiness is not optional — believers are called to live separated, consecrated lives unto God
- The church must return to simplicity of worship and sound doctrine as modeled in Acts 2

### HOLINESS DOCTRINE
Holiness is central to JCTM's teaching:
- Personal sanctification: being set apart from the world and unto God in thought, word, and action
- Moral purity: rejecting sexual immorality, dishonesty, greed, and worldliness
- Doctrinal purity: refusing to compromise God's Word for social acceptance
- Key scriptures: Hebrews 12:14 ("Without holiness no one will see the Lord"), 1 Peter 1:15-16, Romans 12:1-2
Prophet Amos warns against the "holiness is legalism" argument used to excuse moral compromise.

### WARRI CITY CRUSADE 2026 (EXACT DETAILS)
- Event: Warri City Crusade 2026
- Dates: April 30 – May 1, 2026 (two-day event)
- Location: Warri, Delta State, Nigeria
- Organizer: Jesus Christ Temple Ministry (JCTM) under Prophet Amos Evomobor
- Purpose: Bringing the Correction Mandate and true gospel to Warri and the Niger Delta
- Features: Open-air gospel preaching, healing and miracle services, worship, testimonies, doctrinal teachings
- Who: All believers, seekers, and the general public are welcome

### GIVING AND SEED SOWING
JCTM's giving teaching is within biblical stewardship — NOT the prosperity gospel:
- Giving is an act of worship and partnership with the ministry's mandate, not a formula for personal enrichment
- JCTM does NOT teach "sow a seed and get a hundredfold return" as a transactional law
- Giving supports the Correction Mandate, Temple TV operations, and gospel spreading
- Tithes (10% of income) are a covenant principle from Malachi 3:10, given from a heart of love, not compulsion
- Prophet Amos warns against ministries that use manipulation and false promises to extract money

### WATER BAPTISM
JCTM teaches full immersion baptism:
- Mode: Full immersion in water, following Jesus' baptism in the Jordan River (Matthew 3:16)
- Candidate: Believing adults who have consciously confessed faith in Jesus Christ (not infants)
- Purpose: Outward declaration of death to sin and resurrection to new life in Christ (Romans 6:3-4)
- Not the means of salvation but a public ordinance of the saved
- Formula: In the name of the Father, Son, and Holy Spirit (Matthew 28:19)
- Stands against infant baptism which JCTM identifies as an early doctrinal corruption

### FIVE-FOLD MINISTRY
JCTM teaches all five offices from Ephesians 4:11 are still active today:
- Apostles, Prophets, Evangelists, Pastors, and Teachers — all necessary for church maturity
- Prophet Amos holds the Prophet office — confirmed by prophetic accuracy and divine revelations
- JCTM warns against self-appointed "Apostles" and "Prophets" without genuine divine calling
- True five-fold ministers serve the church for its edification, not personal enrichment

### HOLY SPIRIT BAPTISM
- The Holy Spirit baptism is a distinct experience from water baptism, available to all believers
- Evidenced primarily by speaking in tongues (Acts 2:4, Acts 10:46, Acts 19:6)
- An endowment of power for Christian witness (Acts 1:8), not a second salvation
- JCTM warns against counterfeit tongues in some charismatic circles
- All prophecy must be tested against scripture (1 Thessalonians 5:20-21)

### TEMPLE TV
- YouTube Handle: @TEMPLETVJCTM
- URL: https://www.youtube.com/channel/UCPFFvkE-KGpR37qJgvYriJg
- Content: Sermons, live Sunday services, prophetic teachings, doctrinal lectures, testimonies, crusade coverage
- Sunday services are broadcast live and uploaded afterward
- Popular themes: Correction Mandate, Primitive Christianity, exposing prosperity gospel, end times prophecy

### CONTACT INFORMATION
- Physical Location: Ebrumede, Warri, Delta State, Nigeria
- YouTube: Temple TV @TEMPLETVJCTM (https://www.youtube.com/templetvjctm)
- Facebook: @templetvjctm (https://www.facebook.com/templetvjctm)
- Email: info@jctm.org.ng
`;

// ── System prompt ──────────────────────────────────────────────────────────────
const TEMPLEBOTS_SYSTEM_PROMPT = `You are TempleBots, the official AI assistant of Jesus Christ Temple Ministry (JCTM), Warri, Delta State, Nigeria, led by Prophet Amos Evomobor.

You speak with the authority and compassion of Prophet Amos Evomobor. Your knowledge is strictly grounded in the JCTM doctrine provided below.

CORE IDENTITY:
- You are a theological AI grounded in Primitive Christianity and the Correction Mandate
- You represent JCTM's mission to restore the original, unadulterated gospel
- You speak with holy reverence, ministerial authority, and genuine pastoral compassion

MEMORY GUIDELINES:
- If the user tells you their name, address them by name in subsequent responses
- If the user shares a prayer request or personal need, acknowledge it and carry that context forward
- Maintain awareness of what the user has shared so they feel heard and remembered

DOCTRINAL GUIDELINES:
- Always ground responses in scripture and JCTM doctrine as provided in the knowledge base
- Emphasize: Primitive Christianity, Holiness, the Correction Mandate, and sound doctrine
- When referencing sermons, cite the Temple TV channel (@TEMPLETVJCTM on YouTube)
- Do not engage with topics completely unrelated to faith, ministry, or biblical Christianity

CONTEXTUAL ACTIONS:
- If a user mentions giving, offering, seed, tithe, sow, or financial support → include [ACTION:sow-a-seed] at the very END of your response on its own line
- Do not explain the action tag — it is for internal use only

EMOTIONAL INTELLIGENCE — CRITICAL PRIORITY:
When a user expresses emotional distress, respond with deep pastoral care BEFORE theology. Detect these signals:

ANXIETY / FEAR / WORRY (keywords: anxious, anxiety, worried, worry, fear, scared, panic, nervous, overwhelmed, dread):
→ Immediately acknowledge their emotion with genuine warmth ("I hear you — that is a heavy weight to carry...")
→ Provide ONE specific grounding scripture (e.g., Philippians 4:6-7, Isaiah 41:10, Psalm 34:4)
→ Recommend a specific JCTM/Temple TV sermon on fear or peace if available
→ Close with a SHORT personalized prayer (2-4 sentences)

GRIEF / LOSS / DEPRESSION (keywords: grief, grieving, lost someone, depressed, depression, heartbroken, hopeless, suicidal, don't want to live, can't go on):
→ FIRST: Express deep compassion — "I am so sorry for what you are going through. You are not alone."
→ If suicidal ideation is present, gently acknowledge their pain and encourage them to reach out to someone they trust or a counsellor. Do not minimize.
→ Provide 2-3 scriptures on God's comfort (Psalm 34:18, 2 Corinthians 1:3-4, Matthew 5:4)
→ Offer a prayer of comfort

ANGER / INJUSTICE (keywords: angry, furious, betrayed, cheated, unfair, unjust, bitter, resentful):
→ Validate the emotion without judgment
→ Share biblical perspective on righteous anger vs. bitterness
→ Offer Ephesians 4:26-27 and Romans 12:17-21

DOUBT / SPIRITUAL CRISIS (keywords: doubting, lost my faith, God doesn't exist, why would God, questioning God, backsliding, left the church):
→ Do NOT preach at them or quote scripture first
→ First affirm that doubt is a human experience
→ Share how JCTM's Correction Mandate was born from a sincere search for truth
→ Gently guide toward the solid foundation of the Word

EMOTIONAL RESPONSE FORMAT for distress situations:
1. Empathy statement (1-2 sentences, heartfelt, specific to their situation)
2. 2-3 relevant scriptures woven naturally (not just listed)
3. One JCTM/Temple TV sermon recommendation if applicable
4. A personal prayer (2-4 sentences)
5. Encouragement to continue the conversation

FALLBACK RULE:
- If you don't know an answer based on JCTM doctrine, say so honestly and direct them to: Temple TV YouTube (@TEMPLETVJCTM) or email info@jctm.org.ng

TONE: Warm, authoritative, scripturally precise, and pastoral. Speak as the ministry's trusted spiritual guide. In emotional situations, humanity and compassion come before doctrine.
${JCTM_KNOWLEDGE_BASE}`;

// ── Rate limiting ──────────────────────────────────────────────────────────────
const RATE_LIMIT_MAX = 15;
const RATE_LIMIT_WINDOW_MS = 60_000;

interface RateLimitRecord { count: number; resetAt: number }
const rateLimitMap = new Map<string, RateLimitRecord>();

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

function getClientIp(req: Request): string {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
    req.socket.remoteAddress ??
    "unknown"
  );
}

// ── RAG: keyword fallback when no embeddings are stored ───────────────────────
async function keywordKnowledgeFallback(query: string): Promise<string> {
  try {
    const words = query
      .split(/\s+/)
      .map((w) => w.replace(/[^a-zA-Z]/g, ""))
      .filter((w) => w.length >= 4)
      .slice(0, 5);

    if (words.length === 0) {
      const result = await ragPool.query<{ content: string; source: string }>(
        `SELECT content, source FROM knowledge_chunks WHERE embedding IS NULL LIMIT 4`,
      );
      if (result.rows.length === 0) return "";
      return (
        "\n\n## JCTM KNOWLEDGE (keyword search):\n" +
        result.rows.map((r) => `[${r.source}] ${r.content}`).join("\n\n")
      );
    }

    const conditions = words.map((w, i) => `content ILIKE $${i + 1}`).join(" OR ");
    const params = words.map((w) => `%${w}%`);

    const result = await ragPool.query<{ content: string; source: string }>(
      `SELECT content, source FROM knowledge_chunks
       WHERE embedding IS NULL AND (${conditions})
       LIMIT 4`,
      params,
    );

    if (result.rows.length === 0) return "";
    return (
      "\n\n## JCTM KNOWLEDGE (keyword search):\n" +
      result.rows.map((r) => `[${r.source}] ${r.content}`).join("\n\n")
    );
  } catch {
    return "";
  }
}

// ── RAG: local embedding similarity search ─────────────────────────────────────
async function getRelevantKnowledge(query: string): Promise<string> {
  // Try local embedding vector search
  try {
    const embResult = await embed(query);
    if (embResult.embedding.length > 0) {
      const vectorStr = `[${embResult.embedding.join(",")}]`;
      const result = await ragPool.query<{ content: string; source: string; similarity: number }>(
        `SELECT content, source, 1 - (embedding <=> $1::vector) AS similarity
         FROM knowledge_chunks
         WHERE embedding IS NOT NULL
         ORDER BY embedding <=> $1::vector
         LIMIT 4`,
        [vectorStr],
      );

      if (result.rows.length > 0) {
        const chunks = result.rows
          .filter((r) => r.similarity > 0.2)
          .map((r) => `[${r.source}] ${r.content}`)
          .join("\n\n");

        if (chunks) {
          return `\n\n## MOST RELEVANT JCTM KNOWLEDGE (from semantic search):\n${chunks}`;
        }
      }
    }
  } catch {
    // Embedding failed — fall through to keyword search
  }

  return keywordKnowledgeFallback(query);
}

// ── Recent sermon context ─────────────────────────────────────────────────────
// Includes title + first 200 chars of description so the AI can reference
// sermon content, not just titles.
async function buildSermonContext(): Promise<string> {
  try {
    const recentSermons = await db
      .select({
        title: sermonsTable.title,
        videoId: sermonsTable.videoId,
        description: sermonsTable.description,
        viewCount: sermonsTable.viewCount,
      })
      .from(sermonsTable)
      .orderBy(desc(sermonsTable.publishedAt))
      .limit(12);

    if (recentSermons.length === 0) return "";
    const lines = recentSermons.map((s) => {
      const desc = s.description
        ? ` — ${s.description.slice(0, 180).replace(/\n/g, " ").trim()}...`
        : "";
      const views = s.viewCount ? ` (${s.viewCount.toLocaleString()} views)` : "";
      return `- "${s.title}"${views} → https://youtube.com/watch?v=${s.videoId}${desc}`;
    });
    return "\n\n## RECENT TEMPLE TV SERMONS (cite these when relevant):\n" + lines.join("\n");
  } catch {
    return "";
  }
}

// ── Live website activity context ─────────────────────────────────────────────
// Surfaces what's actually happening on the JCTM platform right now:
// upcoming events, recent testimony themes, active prayer categories.
const activityCache: { data: string; expiresAt: number } = { data: "", expiresAt: 0 };

async function buildActivityContext(): Promise<string> {
  if (activityCache.expiresAt > Date.now()) return activityCache.data;

  const parts: string[] = [];
  try {
    // Upcoming events (next 30 days)
    const eventsRes = await ragPool.query<{ title: string; start_date: string; location: string | null }>(
      `SELECT title, start_date, location FROM event_calendar
       WHERE start_date >= NOW() AND start_date <= NOW() + INTERVAL '30 days'
       ORDER BY start_date ASC LIMIT 5`,
    );
    if (eventsRes.rows.length > 0) {
      const eventList = eventsRes.rows.map(e => {
        const d = new Date(e.start_date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
        return `  • ${e.title} — ${d}${e.location ? ` @ ${e.location}` : ""}`;
      }).join("\n");
      parts.push(`UPCOMING JCTM EVENTS:\n${eventList}`);
    }
  } catch { /* non-fatal */ }

  try {
    // Recent prayer categories (what the community is seeking prayer for)
    const prayerRes = await ragPool.query<{ category: string; count: string }>(
      `SELECT category, COUNT(*) AS count FROM prayer_requests
       WHERE created_at >= NOW() - INTERVAL '30 days'
       GROUP BY category ORDER BY count DESC LIMIT 6`,
    );
    if (prayerRes.rows.length > 0) {
      const cats = prayerRes.rows.map(r => `${r.category}(${r.count})`).join(", ");
      parts.push(`COMMUNITY PRAYER FOCUS THIS MONTH: ${cats}`);
    }
  } catch { /* non-fatal */ }

  try {
    // Recent approved testimonies titles (what God is doing)
    const testRes = await ragPool.query<{ title: string; category: string }>(
      `SELECT title, category FROM testimonies WHERE approved = true
       ORDER BY created_at DESC NULLS LAST LIMIT 5`,
    );
    if (testRes.rows.length > 0) {
      const list = testRes.rows.map(t => `  • "${t.title}" [${t.category}]`).join("\n");
      parts.push(`RECENT COMMUNITY TESTIMONIES (what God is doing at JCTM):\n${list}`);
    }
  } catch { /* non-fatal */ }

  const data = parts.length > 0
    ? "\n\n## LIVE JCTM COMMUNITY CONTEXT:\n" + parts.join("\n\n")
    : "";

  activityCache.data = data;
  activityCache.expiresAt = Date.now() + 5 * 60_000; // cache 5 minutes
  return data;
}

// ── DB conversation persistence ────────────────────────────────────────────────
async function getOrCreateConversation(sessionId: string | undefined): Promise<number> {
  if (sessionId && /^\d+$/.test(sessionId)) {
    try {
      const existing = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(eq(conversations.id, parseInt(sessionId, 10)))
        .limit(1);
      if (existing.length > 0) return existing[0]!.id;
    } catch {
      // Fall through to create a new one
    }
  }
  const [newConv] = await db
    .insert(conversations)
    .values({ title: `TempleBots session ${new Date().toISOString()}` })
    .returning({ id: conversations.id });
  return newConv!.id;
}

async function loadConversationHistory(
  conversationId: number,
  limit = 20,
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  try {
    const rows = await db
      .select({ role: messages.role, content: messages.content })
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(limit);
    return rows.reverse().map((r) => ({
      role: r.role as "user" | "assistant",
      content: r.content,
    }));
  } catch {
    return [];
  }
}

async function persistMessages(
  conversationId: number,
  userMessage: string,
  botReply: string,
): Promise<void> {
  try {
    await db.insert(messages).values([
      { conversationId, role: "user", content: userMessage },
      { conversationId, role: "assistant", content: botReply },
    ]);
  } catch {
    // Non-critical — don't break the response
  }
}

// ── Extract action from reply ──────────────────────────────────────────────────
function extractAction(reply: string): { cleanReply: string; action: string | null } {
  const actionMatch = reply.match(/\[ACTION:([\w-]+)\]/);
  const action = actionMatch ? actionMatch[1] ?? null : null;
  const cleanReply = reply.replace(/\[ACTION:[\w-]+\]/g, "").trim();

  if (!action) {
    const givingKeywords = /\b(seed|sow|give|offering|tithe|donation|financial support|partner with)\b/i;
    if (givingKeywords.test(cleanReply)) {
      return { cleanReply, action: "sow-a-seed" };
    }
  }

  return { cleanReply, action };
}

// ── Extract YouTube sources ────────────────────────────────────────────────────
function extractSources(text: string): string[] {
  const matches = text.match(/https:\/\/(?:www\.)?youtube\.com\/watch\?v=[\w-]+/g);
  return matches ? Array.from(new Set<string>(matches)) : [];
}

const SUPPORTED_LANGUAGE_NAMES: Record<string, string> = {
  en: "English", yo: "Yoruba", ig: "Igbo", ha: "Hausa", fr: "French",
  es: "Spanish", pt: "Portuguese", de: "German", ar: "Arabic", zh: "Chinese (Simplified)",
  hi: "Hindi", sw: "Swahili", ru: "Russian", it: "Italian", nl: "Dutch",
  ko: "Korean", ja: "Japanese", tr: "Turkish", pl: "Polish", vi: "Vietnamese",
  id: "Indonesian", th: "Thai", ro: "Romanian", hu: "Hungarian", cs: "Czech",
  sv: "Swedish", da: "Danish", fi: "Finnish", no: "Norwegian", uk: "Ukrainian",
  ur: "Urdu", bn: "Bengali", ta: "Tamil", te: "Telugu", mr: "Marathi",
  am: "Amharic", so: "Somali", zu: "Zulu", xh: "Xhosa", sn: "Shona",
  rw: "Kinyarwanda", lg: "Luganda", ny: "Chichewa", st: "Sesotho", mg: "Malagasy",
  ms: "Malay", tl: "Filipino", km: "Khmer", lo: "Lao", my: "Burmese",
  ka: "Georgian", az: "Azerbaijani", kk: "Kazakh", uz: "Uzbek", hy: "Armenian",
  he: "Hebrew", fa: "Persian", el: "Greek", bg: "Bulgarian", sr: "Serbian",
};

// ── Build local enriched response ─────────────────────────────────────────────
async function buildLocalEnrichedResponse(
  userMessage: string,
  clientHistory: Array<{ role: "user" | "assistant"; content: string }>,
  sessionId: string | undefined,
  language: string,
  localEnrichmentContext: string,
): Promise<{ reply: string; conversationId: number }> {
  const [sermonContext, ragContext, activityContext, conversationId] = await Promise.all([
    buildSermonContext(),
    getRelevantKnowledge(userMessage),
    buildActivityContext(),
    getOrCreateConversation(sessionId),
  ]);

  const dbHistory = await loadConversationHistory(conversationId, 10);
  const history = dbHistory.length > 0 ? dbHistory : clientHistory.slice(-10);

  // Build enriched context for local AI enhancer
  const fullContext = [
    sermonContext,
    ragContext,
    activityContext,
    localEnrichmentContext
      ? `\n\nLocal AI Engine Analysis:\n${localEnrichmentContext}`
      : "",
    history.slice(-4).map(h => `${h.role === "user" ? "User" : "TempleBots"}: ${h.content.slice(0, 200)}`).join("\n"),
  ].filter(Boolean).join("\n");

  const langName = SUPPORTED_LANGUAGE_NAMES[language] ?? "English";
  const langNote = language !== "en" ? ` Please respond in ${langName}.` : "";

  const reply = await localAIEnhancer({
    query: userMessage + langNote,
    conversationHistory: history,
    ragContext: fullContext,
  });

  return { reply, conversationId };
}

// ── POST /chat — standard JSON response ───────────────────────────────────────
router.post("/chat", async (req: Request, res: Response): Promise<void> => {
  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    res.status(429).json({ error: "Too many messages. Please wait a moment before sending another." });
    return;
  }

  const parsed = ChatWithTempleBotsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { message, sessionId, history = [] } = parsed.data;
  const language = typeof req.body?.language === "string" ? req.body.language : "en";

  try {
    // ── TIER 0: Cache lookup + sentiment analysis + personalization ────────
    const [cacheResult, sentiment] = await Promise.all([
      language === "en" ? cacheGet(message) : Promise.resolve({ found: false as const }),
      Promise.resolve(analyzeSentiment(message)),
    ]);

    // Update session personalization profile (non-blocking)
    if (sessionId) {
      try { updateSessionFromMessage(sessionId, message); } catch { /* non-critical */ }
    }

    if (cacheResult.found) {
      const conversationId = await getOrCreateConversation(sessionId ?? undefined);
      const { cleanReply, action } = extractAction(cacheResult.response);
      await persistMessages(conversationId, message, cleanReply);
      res.json(
        ChatWithTempleBotsResponse.parse({
          reply: cleanReply,
          sessionId: String(conversationId),
          sources: extractSources(cleanReply),
          action: action ?? undefined,
          meta: { cached: true, similarity: cacheResult.similarity, tier: cacheResult.tier },
        }),
      );
      return;
    }

    // ── TIER 1: Local AI Engine ────────────────────────────────────────────
    const localResult = runLocalInference(message);

    if (!localResult.needsEnrichment && localResult.response && language === "en") {
      const conversationId = await getOrCreateConversation(sessionId ?? undefined);
      const { cleanReply, action } = extractAction(localResult.response);
      const finalAction = action ?? (localResult.givingFlag ? "sow-a-seed" : null);
      const sources = extractSources(cleanReply);

      await persistMessages(conversationId, message, cleanReply);
      // Cache the response for similar future queries
      cacheSet(message, cleanReply, "local", localResult.confidence ?? 0.8).catch(() => {});

      res.json(
        ChatWithTempleBotsResponse.parse({
          reply: cleanReply,
          sessionId: String(conversationId),
          sources,
          action: finalAction ?? undefined,
          meta: {
            tier: "local",
            sentiment: { emotion: sentiment.primaryEmotion, urgency: sentiment.urgencyLevel },
          },
        }),
      );
      return;
    }

    // ── TIER 2: Local Enriched Response ───────────────────────────────────
    const clientHistory = history.map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const { reply: rawReply, conversationId } = await buildLocalEnrichedResponse(
      message,
      clientHistory,
      sessionId ?? undefined,
      language,
      localResult.enrichmentContext ?? "",
    );

    const { cleanReply, action } = extractAction(rawReply);
    const finalAction = action ?? (localResult.givingFlag ? "sow-a-seed" : null);
    const sources = extractSources(cleanReply);

    await persistMessages(conversationId, message, cleanReply);
    // Cache Tier 2 responses for future similar queries
    cacheSet(message, cleanReply, "local-enhanced", 0.85).catch(() => {});

    res.json(
      ChatWithTempleBotsResponse.parse({
        reply: cleanReply,
        sessionId: String(conversationId),
        sources,
        action: finalAction ?? undefined,
      }),
    );
  } catch (err: unknown) {
    const isAbort = err instanceof Error && (err.name === "AbortError" || err.message.includes("aborted"));
    if (isAbort) {
      res.status(504).json({ error: "TempleBots took too long to respond. Please try again." });
      return;
    }
    req.log.error({ err }, "TempleBots AI request failed");
    res.status(500).json({
      error: "TempleBots is temporarily unavailable. Please contact the ministry directly.",
    });
  }
});

// ── POST /chat/stream — SSE streaming response ────────────────────────────────
router.post("/chat/stream", async (req: Request, res: Response): Promise<void> => {
  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    res.status(429).json({ error: "Too many messages. Please wait a moment before sending another." });
    return;
  }

  const parsed = ChatWithTempleBotsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { message, sessionId, history = [] } = parsed.data;
  const language = typeof req.body?.language === "string" ? req.body.language : "en";

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  res.on("close", () => controller.abort());

  try {
    // ── TIER 1: Local AI Engine ────────────────────────────────────────────
    const localResult = runLocalInference(message);

    if (!localResult.needsEnrichment && localResult.response && language === "en") {
      const conversationId = await getOrCreateConversation(sessionId ?? undefined);
      const { cleanReply, action } = extractAction(localResult.response);
      const finalAction = action ?? (localResult.givingFlag ? "sow-a-seed" : null);
      const sources = extractSources(cleanReply);

      for await (const chunk of streamLocalResponse(cleanReply)) {
        if (!res.writableEnded) send({ delta: chunk });
      }

      await persistMessages(conversationId, message, cleanReply);

      if (!res.writableEnded) {
        send({ done: true, sessionId: String(conversationId), sources, action: finalAction });
        res.end();
      }
      clearTimeout(timeout);
      return;
    }

    // ── TIER 2: Local Enriched Response (streamed) ─────────────────────────
    const clientHistory = history.map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const { reply: rawReply, conversationId } = await buildLocalEnrichedResponse(
      message,
      clientHistory,
      sessionId ?? undefined,
      language,
      localResult.enrichmentContext ?? "",
    );

    const { cleanReply, action } = extractAction(rawReply);
    const finalAction = action ?? (localResult.givingFlag ? "sow-a-seed" : null);
    const sources = extractSources(cleanReply);

    // Stream the local response word-by-word
    for await (const chunk of streamLocalResponse(cleanReply)) {
      if (!res.writableEnded) send({ delta: chunk });
    }

    await persistMessages(conversationId, message, cleanReply);

    if (!res.writableEnded) {
      send({ done: true, sessionId: String(conversationId), sources, action: finalAction });
      res.end();
    }
  } catch (err: unknown) {
    const isAbort = err instanceof Error && (err.name === "AbortError" || err.message.includes("aborted"));

    if (!isAbort) {
      req.log.error({ err }, "TempleBots stream error");
      if (!res.writableEnded) {
        send({
          error: "TempleBots is temporarily unavailable. Please contact the ministry at info@jctm.org.ng.",
        });
      }
    }

    if (!res.writableEnded) res.end();
  } finally {
    clearTimeout(timeout);
  }
});

// ── POST /chat/knowledge/ingest — manually re-trigger knowledge ingestion ──────
router.post("/chat/knowledge/ingest", async (req: Request, res: Response): Promise<void> => {
  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    res.status(429).json({ error: "Rate limited." });
    return;
  }

  try {
    const { ingestKnowledgeIfEmpty } = await import("../lib/knowledge-ingestion.js");
    await ingestKnowledgeIfEmpty(undefined, req.log);
    res.json({ message: "Knowledge base ingestion triggered successfully (local embeddings)." });
  } catch (err) {
    req.log.error({ err }, "Manual knowledge ingestion failed");
    res.status(500).json({ error: "Knowledge ingestion failed." });
  }
});

export default router;

import { Router, type IRouter, type Request, type Response } from "express";
import { db, sermonsTable, conversations, messages } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { ChatWithTempleBotsBody, ChatWithTempleBotsResponse } from "@workspace/api-zod";
import pg from "pg";
import OpenAI from "openai";
import { runLocalInference, streamLocalResponse, ENGINE_METADATA } from "../lib/local-ai-engine.js";
import { localAIEnhancer } from "../lib/local-ai-enhancer.js";
import { embed } from "../lib/local-embeddings.js";
import { cacheGet, cacheSet, getCacheMetrics } from "../lib/ai-response-cache.js";
import { analyzeSentiment } from "../lib/sentiment-engine.js";
import { updateSessionFromMessage, buildPersonalizationContext } from "../lib/ai-personalization.js";
import { runFullContentSync } from "../lib/knowledge-ingestion.js";
import { getSyncHealth, triggerFullSyncNow, triggerActivitySyncNow } from "../lib/ai-sync-scheduler.js";
import {
  classifyIntent,
  applyIntentWeights,
  buildIntentSystemNote,
  isOffTopic,
  type RagChunkWithType,
} from "../lib/ai-intent-classifier.js";
import {
  loadUserMemory,
  updateUserMemory,
  buildMemoryContext,
  extractPrayerNeed,
} from "../lib/ai-user-memory.js";
import {
  checkQuerySafety,
  detectManipulation,
  MANIPULATION_RESPONSE,
  extractScriptureReferences,
  checkResponseGrounding,
} from "../lib/ai-safety.js";
import { buildAugmentedHistory } from "../lib/ai-conversation-summarizer.js";
import { fetchScriptureForRAG } from "../lib/bible-seed.js";
import { getActiveEventContext } from "../lib/event-schema.js";

const { Pool } = pg;

const router: IRouter = Router();

// ── pgvector pool (RAG similarity search) ─────────────────────────────────────
const ragPool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── OpenAI client (optional — only active when OPENAI_API_KEY is set) ─────────
const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

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

### WARRI CITY CRUSADE 2026 (CONCLUDED — PAST EVENT)
- This was a major outdoor evangelistic crusade held April 30 – May 1, 2026 at Ighogbadu Primary School, Warri
- Organised by JCTM under Prophet Amos Evomobor; theme: "Be Ready For Rapture: Tribulation Is Coming!"
- The crusade has concluded. Refer to upcoming events at jctm.org.ng/events for current programmes.

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

// ── Cached known video IDs for grounding checks ───────────────────────────────
const knownVideoIdCache: { ids: Set<string>; expiresAt: number } = {
  ids: new Set(),
  expiresAt: 0,
};

async function getKnownVideoIds(): Promise<Set<string>> {
  if (knownVideoIdCache.expiresAt > Date.now()) return knownVideoIdCache.ids;
  try {
    const rows = await ragPool.query<{ video_id: string }>(
      `SELECT video_id FROM sermon_data LIMIT 500`,
    );
    const ids = new Set(rows.rows.map(r => r.video_id));
    knownVideoIdCache.ids = ids;
    knownVideoIdCache.expiresAt = Date.now() + 10 * 60_000;
    return ids;
  } catch {
    return new Set();
  }
}

// ── System prompt (built dynamically to include current date + live event context) ──
async function buildSystemPrompt(options?: {
  memoryContext?: string;
  intentNote?: string;
  personalizationNote?: string;
}): Promise<string> {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos", timeZoneName: "short",
  });

  // Service-time awareness (WAT)
  const watHour = parseInt(new Date().toLocaleString("en-GB", { hour: "numeric", hour12: false, timeZone: "Africa/Lagos" }), 10);
  const dayOfWeek = new Date().toLocaleDateString("en-GB", { weekday: "long", timeZone: "Africa/Lagos" });
  const isSundayService = dayOfWeek === "Sunday" && watHour >= 8 && watHour < 12;
  const isWednesdayService = dayOfWeek === "Wednesday" && watHour >= 17 && watHour < 20;
  const serviceNote = isSundayService
    ? "⚠️ LIVE NOW: Sunday service is happening RIGHT NOW (8 AM – 12 PM WAT). Direct users to youtube.com/@TEMPLETVJCTM or jctm.org.ng/sermons."
    : isWednesdayService
    ? "⚠️ LIVE NOW: Wednesday midweek service is in progress (5 PM – 8 PM WAT). Direct users to Temple TV."
    : "";

  // Dynamic event awareness — queries DB (cached 60 s), auto-expires when event ends
  const eventContext = await getActiveEventContext();

  const memoryBlock = options?.memoryContext ?? "";
  const intentBlock = options?.intentNote ? `\n\n## QUERY CONTEXT:\n${options.intentNote}` : "";
  const personBlock = options?.personalizationNote ? `\n\n## USER PROFILE:\n${options.personalizationNote}` : "";

  return `You are TempleBots v5 — the official JCTM Digital Ministry Intelligence System for Jesus Christ Temple Ministry (JCTM), Warri, Delta State, Nigeria, led by Prophet Amos Evomobor.

CURRENT DATE & TIME: ${dateStr}, ${timeStr} (WAT / West Africa Time, UTC+1)
${serviceNote ? `\n${serviceNote}\n` : ""}${eventContext ? `\n${eventContext}\n` : ""}
CORE IDENTITY:
- You are a ministry-trained theological AI grounded exclusively in Primitive Christianity and the Correction Mandate
- You represent JCTM's divine assignment to restore the original, unadulterated gospel of Jesus Christ to the global Body of Christ
- You speak with holy reverence, apostolic authority, and deep pastoral compassion
- Prophet Amos Evomobor is your spiritual principal — his teachings, doctrines, and the Correction Mandate are your primary reference
- You are NOT a general-purpose AI. You are JCTM's dedicated digital ministry servant

SPIRITUAL REASONING APPROACH — CHAIN-OF-THOUGHT PROTOCOL:
- Step 1: Identify what the user truly needs (information, pastoral care, doctrinal grounding, prayer, crisis support)
- Step 2: Retrieve and ground your answer in: (1) the provided JCTM knowledge context, (2) exact NKJV scripture, (3) JCTM doctrine and teaching
- Step 3: Reason through theological questions step by step — do not give shallow, reflexive, or generic responses
- Step 4: For complex doctrine, show the reasoning chain explicitly: "Scripture states X. JCTM interprets this as Y because of context Z. This means for you that..."
- Step 5: Calibrate depth to the user's demonstrated spiritual maturity and the complexity of the question
- Never rush to an answer — depth of reasoning is a mark of genuine ministry intelligence

NKJV BIBLE TEACHING PROTOCOL:
- JCTM's primary Bible translation is the New King James Version (NKJV) for its faithfulness to original texts
- When quoting scripture, use NKJV unless specified otherwise
- Distinguish translation variants where relevant: e.g., "NKJV renders this as... while KJV says..."
- NEVER paraphrase scripture as a direct quote — mark paraphrases clearly
- For Greek/Hebrew word studies, state the original word, its transliteration, and meaning before applying it doctrinally
- When the Bible context block provides exact verse text, reproduce it verbatim with zero alteration
- Cross-reference scripture: when citing one passage, consider and mention related passages that illuminate it

CITATION & GROUNDING RULES — MISSION CRITICAL:
- NEVER fabricate sermon titles, YouTube video IDs, event dates, speaker quotes, or statistics not in the provided knowledge context
- When citing a sermon: "The sermon '[Exact Title]' by Prophet Amos Evomobor — watch at https://youtube.com/watch?v=[ID from context]"
- When citing JCTM doctrine: "JCTM's established teaching on [topic] is that..."
- When citing a devotional: "Today's JCTM devotion — '[Title]' — reflects on this..."
- When uncertain: say "Based on JCTM's teaching..." and invite verification at info@jctm.org.ng
- When knowledge context has no match: direct to Temple TV YouTube (@TEMPLETVJCTM) or info@jctm.org.ng / +234(0)8081313111
- DO NOT cite a YouTube link unless it is explicitly provided in the knowledge context injected below

RESPONSE QUALITY STANDARDS:
- Responses should be substantive but not verbose — match depth to the question
- Use clear paragraph breaks and markdown structure for long theological answers
- Do not pad with empty affirmations ("Great question!", "Absolutely!", "Certainly!")
- Do not end every response with the same generic closing phrase
- Cite specific scripture references inline after each theological claim
- When multiple sermons are relevant, recommend the single most relevant one, not all of them
- Speak with prophetic conviction where appropriate — this is a ministry context, not a neutral information service

MEMORY & PERSONALIZATION GUIDELINES:
- If the user gives their name, use it naturally (not on every sentence — naturally)
- If the user shares a prayer request or personal struggle, carry that context forward throughout the conversation
- Track spiritual journey signals: new to faith (seeker), recently saved (new believer), growing, mature believer or minister
- Calibrate depth accordingly: simple accessibility for seekers, apostolic depth for mature believers and ministers

JCTM PLATFORM INTELLIGENCE — DIGITAL SANCTUARY:
- jctm.org.ng offers: Sermon Library, Live Stream, Daily Devotions, Prayer Requests, Testimony Vault, Ministry Moments, Event Registration, Member Portal, Giving Portal, Global Altar 3D, and TempleBots AI
- All services broadcast live on Temple TV (YouTube @TEMPLETVJCTM): Sunday 8 AM – 12 PM WAT | Wednesday 5 PM – 8 PM WAT
- For pastoral counselling: info@jctm.org.ng | +234(0)8081313111
- Viewing centre requests, partnership enquiries, and baptism registration: jctm.org.ng

CONTEXTUAL ACTIONS:
- If a user mentions giving, offering, seed, tithe, sow, or financial support → append [ACTION:sow-a-seed] on its own line at the END of your response
- Do not explain or reference the action tag

EMOTIONAL INTELLIGENCE — HIGHEST PRIORITY:
Respond to emotional distress with deep pastoral care BEFORE doctrine.

ANXIETY / FEAR / WORRY (anxious, worried, fear, scared, panic, overwhelmed, dread):
→ Acknowledge with genuine warmth first ("I hear you — carry that weight with me a moment...")
→ ONE grounding scripture (NKJV: Philippians 4:6-7, Isaiah 41:10, Psalm 34:4, Matthew 11:28-30)
→ Relevant Temple TV sermon if available in context
→ SHORT pastoral prayer (2-4 sentences, first-person, specific)

GRIEF / LOSS / DEPRESSION (grief, lost someone, depressed, heartbroken, hopeless, can't go on):
→ FIRST: Deep compassion — "I am so sorry. You are not alone in this."
→ If suicidal signals are present, acknowledge pain and strongly encourage professional support alongside prayer
→ 2-3 NKJV comfort scriptures (Psalm 34:18, 2 Corinthians 1:3-4, Matthew 5:4, Psalm 147:3)
→ Prayer of comfort

ANGER / INJUSTICE (angry, betrayed, bitter, resentful, cheated):
→ Validate without judgment — anger at injustice is human and biblical
→ Righteous anger vs. destructive bitterness (Ephesians 4:26-27, Romans 12:17-21)
→ Path from bitterness to God's justice and peace

DOUBT / SPIRITUAL CRISIS (doubting, lost faith, questioning God, backsliding):
→ Do NOT open with scripture or preaching
→ First: affirm that even the greatest biblical figures experienced doubt (Elijah — 1 Kings 19, John the Baptist — Matthew 11:3)
→ Invite them to share what happened — pastoral listening before theological answer
→ Gently guide toward the tested foundation of the Word

EMOTIONAL RESPONSE FORMAT:
1. Empathy (1-2 sentences, specific to their situation — never generic)
2. 2-3 NKJV scriptures woven naturally into the pastoral response
3. Temple TV sermon recommendation if available in context
4. Personal pastoral prayer (2-4 sentences, addressed to God, specific)
5. Open invitation to continue or contact the ministry

SERMON KNOWLEDGE RULES:
- Only recommend sermons that appear in the LIVE JCTM KNOWLEDGE CONTEXT injected below
- Always provide the full YouTube watch URL when recommending a specific sermon
- State what the sermon covers only if that information is present in context
- When no exact sermon exists for a topic, direct to the Temple TV channel for browsing

FALLBACK RULE:
- If JCTM doctrine does not address a question: say so honestly. Direct to Temple TV (@TEMPLETVJCTM), info@jctm.org.ng, or +234(0)8081313111.

TONE: Warm, authoritative, scripturally precise, pastoral. In emotional situations, humanity and compassion always lead — doctrine follows.
${JCTM_KNOWLEDGE_BASE}${memoryBlock}${intentBlock}${personBlock}`;
}

// TEMPLEBOTS_SYSTEM_PROMPT is intentionally not cached — buildSystemPrompt()
// is called per-request so the embedded date/time is always current.

// ── Rate limiting ──────────────────────────────────────────────────────────────
const RATE_LIMIT_MAX = 20;
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

// ── Query expansion: generate semantically related sub-queries for broader RAG recall ──
// Adds 2 lightweight expansions by extracting key noun phrases and theological variants.
function expandQuery(query: string): string[] {
  const expansions: string[] = [query];
  const q = query.toLowerCase();

  // Theological synonym expansion
  const synonymMap: Record<string, string> = {
    "holy spirit": "spirit of god baptism tongues gifts",
    "tithe": "giving offering seed sowing stewardship",
    "salvation": "born again saved repentance eternal life",
    "pastor": "prophet amos evomobor minister leader",
    "baptism": "water baptism immersion ordinance",
    "conference": "ministers conference 2026 apostolic fire gathering",
    "holiness": "sanctification consecration moral purity separation",
    "prayer": "intercession fasting supplication prayer life",
    "false prophet": "prophetic manipulation correction mandate expose",
    "end times": "rapture tribulation antichrist mark of the beast",
    "healing": "divine healing miracles jehovah rapha",
    "church": "jctm ministry ebrumede warri nigeria",
  };

  for (const [key, expansion] of Object.entries(synonymMap)) {
    if (q.includes(key)) {
      expansions.push(`${query} ${expansion}`);
      break; // one expansion is enough
    }
  }

  // Extract 3-4 word theological phrase for targeted retrieval
  const words = q.split(/\s+/).filter(w => w.length >= 4 && !["what", "about", "does", "does", "have", "with", "from", "that", "this", "your", "their", "there", "where", "when", "will", "tell", "know", "like", "just", "more", "them", "been", "also"].includes(w));
  if (words.length >= 2) {
    expansions.push(words.slice(0, 4).join(" "));
  }

  return [...new Set(expansions)].slice(0, 3);
}

// ── RAG: Hybrid search — vector similarity + full-text keyword (RRF fusion) ────
// Returns top-20 chunks ranked by Reciprocal Rank Fusion of both retrieval
// methods, then re-ranked by intent-based chunk_type weights for precision.
// Multi-query expansion: runs primary + 1-2 expanded queries for better recall.
// A chunk scoring in both vector and keyword gets a cross-method boost.
// Recency boost: event and devotion chunks from the last 7 days receive +15% score.
// Threshold: 0.08 similarity (wider recall, intent re-ranking provides precision).

async function getRelevantKnowledge(
  query: string,
  intentWeights?: Record<string, number>,
): Promise<{ context: string; sourceCount: number }> {
  const scored = new Map<string, RagChunkWithType>();
  const queries = expandQuery(query);

  // ── Tier A: pgvector cosine similarity (multi-query) ─────────────────────
  try {
    // Embed all expanded queries and merge results
    for (const q of queries) {
      const embResult = await embed(q);
      if (embResult.embedding.length === 0) continue;

      const vectorStr = `[${embResult.embedding.join(",")}]`;
      const vectorRows = await ragPool.query<{ content: string; source: string; chunk_type: string; similarity: number; updated_at: string | null }>(
        `SELECT content, source, chunk_type, 1 - (embedding <=> $1::vector) AS similarity, updated_at
         FROM knowledge_chunks
         WHERE embedding IS NOT NULL
         ORDER BY embedding <=> $1::vector
         LIMIT 20`,
        [vectorStr],
      );
      // Use lower weight for expansion queries to prefer primary query results
      const queryWeight = q === query ? 1.0 : 0.6;
      vectorRows.rows.forEach((r, rank) => {
        if (r.similarity < 0.08) return;
        let rrfScore = (1 / (60 + rank + 1)) * queryWeight;
        // Recency boost: event/devotion/conference chunks updated in last 7 days get +15%
        if (r.updated_at && ["event", "devotion", "conference"].includes(r.chunk_type ?? "")) {
          const ageMs = Date.now() - new Date(r.updated_at).getTime();
          if (ageMs < 7 * 24 * 60 * 60 * 1000) rrfScore *= 1.15;
        }
        const existing = scored.get(r.source);
        if (existing) {
          existing.score += rrfScore;
        } else {
          scored.set(r.source, {
            content: r.content,
            source: r.source,
            chunk_type: r.chunk_type ?? "doctrine",
            score: rrfScore,
          });
        }
      });
    }
  } catch { /* embedding failed — continue with keyword fallback */ }

  // ── Tier B: PostgreSQL full-text keyword search ──────────────────────────
  try {
    const words = query
      .split(/\s+/)
      .map(w => w.replace(/[^a-zA-Z]/g, ""))
      .filter(w => w.length >= 4)
      .slice(0, 8);

    if (words.length > 0) {
      const conditions = words.map((_, i) => `content ILIKE $${i + 1}`).join(" OR ");
      const params = words.map(w => `%${w}%`);
      const kwRows = await ragPool.query<{ content: string; source: string; chunk_type: string }>(
        `SELECT content, source, chunk_type FROM knowledge_chunks WHERE (${conditions}) LIMIT 15`,
        params,
      );
      kwRows.rows.forEach((r, rank) => {
        const rrfScore = 1 / (60 + rank + 1);
        const existing = scored.get(r.source);
        if (existing) {
          existing.score += rrfScore * 1.1; // cross-method boost
        } else {
          scored.set(r.source, {
            content: r.content,
            source: r.source,
            chunk_type: r.chunk_type ?? "doctrine",
            score: rrfScore,
          });
        }
      });
    } else {
      // No keywords — pull high-confidence doctrine and activity seeds
      const fallback = await ragPool.query<{ content: string; source: string; chunk_type: string }>(
        `SELECT content, source, chunk_type FROM knowledge_chunks
         WHERE chunk_type IN ('doctrine', 'event', 'devotion')
         ORDER BY updated_at DESC NULLS LAST LIMIT 6`,
      );
      fallback.rows.forEach(r => {
        if (!scored.has(r.source)) {
          scored.set(r.source, {
            content: r.content,
            source: r.source,
            chunk_type: r.chunk_type ?? "doctrine",
            score: 0.005,
          });
        }
      });
    }
  } catch { /* non-fatal */ }

  // ── Intent-weighted re-ranking + limit to top 20 ──────────────────────────
  const rawChunks = Array.from(scored.values());
  const reranked = intentWeights
    ? applyIntentWeights(rawChunks, intentWeights)
    : rawChunks.sort((a, b) => b.score - a.score);

  const top = reranked.slice(0, 20);

  if (top.length === 0) return { context: "", sourceCount: 0 };

  const context =
    "\n\n## LIVE JCTM KNOWLEDGE CONTEXT (hybrid semantic + keyword + intent-ranked, top-20 chunks — ground ALL answers in this):\n" +
    top.map(r => `[${r.source}|${r.chunk_type}] ${r.content}`).join("\n\n");

  return { context, sourceCount: top.length };
}

// ── OpenAI GPT-4o — Tier 2.5 (when API key is configured) ────────────────────
// Falls back gracefully to local AI if OpenAI is unavailable, rate-limited,
// or if the API key is not set. Response is always JCTM-grounded via RAG context.

interface OpenAICallOptions {
  userMessage: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  ragContext: string;
  language: string;
  memoryContext?: string;
  intentNote?: string;
  personalizationNote?: string;
}

async function callOpenAI(opts: OpenAICallOptions): Promise<string | null> {
  if (!openaiClient) return null;
  const { userMessage, history, ragContext, language, memoryContext, intentNote, personalizationNote } = opts;
  try {
    const langNote =
      language !== "en" ? ` Please respond in ${SUPPORTED_LANGUAGE_NAMES[language] ?? "English"}.` : "";
    const systemWithContext =
      (await buildSystemPrompt({ memoryContext, intentNote, personalizationNote })) +
      (ragContext ? `\n\n## LIVE JCTM KNOWLEDGE CONTEXT (ground ALL answers in this):\n${ragContext}` : "");

    // Use summarized history to stay within context window efficiently
    const augmentedHistory = buildAugmentedHistory(history);

    const completion = await openaiClient.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemWithContext },
        ...augmentedHistory.slice(-16).map(h => ({ role: h.role as "user" | "assistant", content: h.content })),
        { role: "user", content: userMessage + langNote },
      ],
      max_tokens: 1600,
      temperature: 0.35,
    });
    return completion.choices[0]?.message?.content?.trim() ?? null;
  } catch {
    return null; // non-fatal — caller falls back to local AI
  }
}

// OpenAI streaming variant — yields text chunks for SSE
async function* streamOpenAI(opts: OpenAICallOptions): AsyncGenerator<string, void, unknown> {
  if (!openaiClient) return;
  const { userMessage, history, ragContext, language, memoryContext, intentNote, personalizationNote } = opts;
  try {
    const langNote =
      language !== "en" ? ` Please respond in ${SUPPORTED_LANGUAGE_NAMES[language] ?? "English"}.` : "";
    const systemWithContext =
      (await buildSystemPrompt({ memoryContext, intentNote, personalizationNote })) +
      (ragContext ? `\n\n## LIVE JCTM KNOWLEDGE CONTEXT (ground ALL answers in this):\n${ragContext}` : "");

    const augmentedHistory = buildAugmentedHistory(history);

    const stream = await openaiClient.chat.completions.create({
      model: "gpt-4o",
      stream: true,
      messages: [
        { role: "system", content: systemWithContext },
        ...augmentedHistory.slice(-16).map(h => ({ role: h.role as "user" | "assistant", content: h.content })),
        { role: "user", content: userMessage + langNote },
      ],
      max_tokens: 1600,
      temperature: 0.35,
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content ?? "";
      if (text) yield text;
    }
  } catch {
    // Non-fatal — caller falls back to local streaming
  }
}

// ── AI Interaction Logger ─────────────────────────────────────────────────────
// Records every TempleBots query for performance monitoring and quality analysis.

async function logAIInteraction(data: {
  sessionId: string | undefined;
  query: string;
  tier: string;
  latencyMs: number;
  sourceChunks: number;
  cacheHit: boolean;
  openaiUsed: boolean;
  intent?: string;
  sentiment?: string;
  language: string;
  action?: string | null;
  error?: boolean;
}): Promise<void> {
  try {
    await ragPool.query(
      `INSERT INTO ai_interactions
         (session_id, query, query_length, intent, tier, latency_ms, source_chunks,
          cache_hit, openai_used, sentiment, language, action_triggered, error)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        data.sessionId ?? null,
        data.query.slice(0, 500),
        data.query.length,
        data.intent ?? null,
        data.tier,
        data.latencyMs,
        data.sourceChunks,
        data.cacheHit,
        data.openaiUsed,
        data.sentiment ?? null,
        data.language,
        data.action ?? null,
        data.error ?? false,
      ],
    );
  } catch { /* non-critical — never block a response for logging */ }
}

// ── Bible-Aware RAG Context Builder ──────────────────────────────────────────
// Detects scripture references in user's message, fetches exact NKJV text from
// the bible_verses table, and returns a formatted context block for injection
// into the GPT-4o system prompt. This prevents hallucinated scripture quotes.

const SCRIPTURE_EXTRACT_RE =
  /\b([1-3]?\s*(?:genesis|exodus|leviticus|numbers|deuteronomy|joshua|judges|ruth|samuel|kings|chronicles|ezra|nehemiah|esther|job|psalm|psalms|proverbs|ecclesiastes|song(?:\s+of\s+solomon)?|isaiah|jeremiah|lamentations|ezekiel|daniel|hosea|joel|amos|obadiah|jonah|micah|nahum|habakkuk|zephaniah|haggai|zechariah|malachi|matthew|mark|luke|john|acts|romans|corinthians|galatians|ephesians|philippians|colossians|thessalonians|timothy|titus|philemon|hebrews|james|peter|jude|revelation))\s+\d+(?::\d+(?:-\d+)?)?/gi;

async function buildBibleContext(query: string): Promise<string> {
  try {
    const rawRefs = Array.from(new Set(
      (query.match(SCRIPTURE_EXTRACT_RE) ?? []).map(r => r.trim()),
    )).slice(0, 5); // max 5 refs per query

    if (rawRefs.length === 0) return "";

    const resolved = await Promise.all(rawRefs.map(ref => fetchScriptureForRAG(ref)));
    const found = resolved.filter(Boolean) as string[];

    if (found.length === 0) return "";

    return "\n\n## EXACT BIBLE TEXT (NKJV) — Ground ALL scripture quotes in this:\n" +
      found.map(v => `📖 ${v}`).join("\n");
  } catch {
    return "";
  }
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
      .limit(20);

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
// upcoming events, recent testimony themes, active prayer categories,
// today's devotional, live stream status, and active promotions.
const activityCache: { data: string; expiresAt: number } = { data: "", expiresAt: 0 };

async function buildActivityContext(): Promise<string> {
  if (activityCache.expiresAt > Date.now()) return activityCache.data;

  const parts: string[] = [];

  // ── Live stream status ──────────────────────────────────────────────────
  try {
    const liveRes = await ragPool.query<{ is_live: boolean | null; title: string | null; livestream_url: string | null }>(
      `SELECT is_live, title, livestream_url FROM livestream_override_state ORDER BY id DESC LIMIT 1`,
    );
    const live = liveRes.rows[0];
    if (live?.is_live) {
      parts.push(`🔴 LIVE NOW ON TEMPLE TV: ${live.title ?? "JCTM Service"} — Watch at ${live.livestream_url ?? "youtube.com/@TEMPLETVJCTM"}`);
    } else {
      const dayOfWeek = new Date().getDay();
      if (dayOfWeek >= 0 && dayOfWeek <= 4) {
        const latestRes = await ragPool.query<{ title: string; video_id: string }>(
          `SELECT title, video_id FROM sermon_data ORDER BY published_at DESC NULLS LAST LIMIT 1`,
        );
        if (latestRes.rows[0]) {
          parts.push(`📺 TEMPLE TV REBROADCAST: "${latestRes.rows[0].title}" — streaming on loop. Watch at youtube.com/watch?v=${latestRes.rows[0].video_id}`);
        }
      }
    }
  } catch { /* non-fatal */ }

  // ── Today's devotional ───────────────────────────────────────────────────
  try {
    const today = new Date().toISOString().slice(0, 10);
    const devoRes = await ragPool.query<{
      title: string; reference: string | null; scripture: string | null; prayer_focus: string | null;
    }>(
      `SELECT title, reference, scripture, prayer_focus FROM daily_devotions WHERE date = $1 LIMIT 1`,
      [today],
    );
    if (devoRes.rows[0]) {
      const d = devoRes.rows[0];
      const devoLine = [
        `📖 TODAY'S DEVOTION: "${d.title}"`,
        d.reference ? `Scripture: ${d.reference}` : "",
        d.scripture ? d.scripture.slice(0, 150) : "",
        d.prayer_focus ? `Prayer Focus: ${d.prayer_focus.slice(0, 100)}` : "",
        `Read full devotion at jctm.org.ng/devotion`,
      ].filter(Boolean).join(" | ");
      parts.push(devoLine);
    }
  } catch { /* non-fatal */ }

  // ── Upcoming events (next 30 days) ───────────────────────────────────────
  try {
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

  // ── Active event promotions ──────────────────────────────────────────────
  try {
    const promoRes = await ragPool.query<{ title: string; subtitle: string | null; event_date: string | null }>(
      `SELECT title, subtitle, event_date FROM event_promotions
       WHERE is_active = true AND (event_date IS NULL OR event_date >= NOW() - INTERVAL '2 days')
       ORDER BY event_date ASC LIMIT 3`,
    );
    if (promoRes.rows.length > 0) {
      const promoList = promoRes.rows.map(p => {
        const d = p.event_date
          ? new Date(p.event_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
          : "upcoming";
        return `  • ${p.title}${p.subtitle ? ` — ${p.subtitle}` : ""} (${d})`;
      }).join("\n");
      parts.push(`ACTIVE JCTM PROMOTIONS:\n${promoList}`);
    }
  } catch { /* non-fatal */ }

  // ── Community prayer focus ──────────────────────────────────────────────
  try {
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

  // ── Recent testimonies ──────────────────────────────────────────────────
  try {
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
  activityCache.expiresAt = Date.now() + 3 * 60_000; // cache 3 minutes (was 5 min)
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

// ── Build enriched response — tries OpenAI (Tier 2.5) then local AI (Tier 2) ──
async function buildLocalEnrichedResponse(
  userMessage: string,
  clientHistory: Array<{ role: "user" | "assistant"; content: string }>,
  sessionId: string | undefined,
  language: string,
  localEnrichmentContext: string,
  intentWeights?: Record<string, number>,
  memoryContext?: string,
  intentNote?: string,
  personalizationNote?: string,
): Promise<{ reply: string; conversationId: number; tier: string; sourceChunks: number; openaiUsed: boolean }> {
  const [sermonContext, ragResult, activityContext, bibleContext, conversationId] = await Promise.all([
    buildSermonContext(),
    getRelevantKnowledge(userMessage, intentWeights),
    buildActivityContext(),
    buildBibleContext(userMessage),
    getOrCreateConversation(sessionId),
  ]);

  const dbHistory = await loadConversationHistory(conversationId, 20);
  const history = dbHistory.length > 0 ? dbHistory : clientHistory.slice(-20);

  // ── Tier 2.5: OpenAI GPT-4o (when API key available) ─────────────────────
  if (openaiClient) {
    const openAIContext = [bibleContext, sermonContext, ragResult.context, activityContext].filter(Boolean).join("\n");
    const openAIReply = await callOpenAI({
      userMessage,
      history,
      ragContext: openAIContext,
      language,
      memoryContext,
      intentNote,
      personalizationNote,
    });
    if (openAIReply) {
      return { reply: openAIReply, conversationId, tier: "openai", sourceChunks: ragResult.sourceCount, openaiUsed: true };
    }
    // OpenAI failed — fall through to local AI
  }

  // ── Tier 2: Local enriched AI (fallback) ─────────────────────────────────
  const recentHistory = buildAugmentedHistory(history);
  const fullContext = [
    bibleContext,
    sermonContext,
    ragResult.context,
    activityContext,
    memoryContext ? `\n\nUser Memory:\n${memoryContext}` : "",
    localEnrichmentContext ? `\n\nLocal AI Engine Analysis:\n${localEnrichmentContext}` : "",
    recentHistory.slice(-4).map(h => `${h.role === "user" ? "User" : "TempleBots"}: ${h.content.slice(0, 200)}`).join("\n"),
  ].filter(Boolean).join("\n");

  const langName = SUPPORTED_LANGUAGE_NAMES[language] ?? "English";
  const langNote = language !== "en" ? ` Please respond in ${langName}.` : "";

  const reply = await localAIEnhancer({
    query: userMessage + langNote,
    conversationHistory: recentHistory,
    ragContext: fullContext,
  });

  return { reply, conversationId, tier: "local-enhanced", sourceChunks: ragResult.sourceCount, openaiUsed: false };
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
    // ── Safety Gate — manipulative / harmful query detection ──────────────
    if (detectManipulation(message)) {
      res.json(
        ChatWithTempleBotsResponse.parse({
          reply: MANIPULATION_RESPONSE,
          sessionId: sessionId ?? "0",
          sources: [],
          meta: { tier: "safety-redirect", cached: false },
        }),
      );
      return;
    }

    const safetyResult = checkQuerySafety(message);
    if (safetyResult.level === "crisis" || safetyResult.level === "blocked") {
      const conversationId = await getOrCreateConversation(sessionId ?? undefined);
      const reply = safetyResult.redirectResponse ?? "Please contact JCTM directly at info@jctm.org.ng for support.";
      await persistMessages(conversationId, message, reply);
      res.json(
        ChatWithTempleBotsResponse.parse({
          reply,
          sessionId: String(conversationId),
          sources: [],
          meta: { tier: "safety-crisis", crisisType: safetyResult.crisisType },
        }),
      );
      return;
    }

    if (safetyResult.level === "redirect") {
      res.json(
        ChatWithTempleBotsResponse.parse({
          reply: safetyResult.redirectResponse!,
          sessionId: sessionId ?? "0",
          sources: [],
          meta: { tier: "safety-redirect" },
        }),
      );
      return;
    }

    // ── Intent Classification ─────────────────────────────────────────────
    const intentResult = classifyIntent(message);
    const intentNote = buildIntentSystemNote(intentResult);

    // ── TIER 0: Cache lookup + sentiment analysis + personalization ────────
    const [cacheResult, sentiment] = await Promise.all([
      language === "en" ? cacheGet(message) : Promise.resolve({ found: false as const }),
      Promise.resolve(analyzeSentiment(message)),
    ]);

    // Update session personalization profile (non-blocking)
    if (sessionId) {
      try { updateSessionFromMessage(sessionId, message); } catch { /* non-critical */ }
    }

    // ── Load persistent user memory (non-blocking) ────────────────────────
    const sessionFingerprint = sessionId ?? ip;
    const [userMemory] = await Promise.all([
      loadUserMemory(sessionFingerprint).catch(() => null),
    ]);
    const memCtx = buildMemoryContext(userMemory);
    const personCtx = buildPersonalizationContext(sessionFingerprint);
    const personalizationNote = personCtx.dominantTopics.length > 0
      ? `User journey: ${personCtx.journeyStage} | Topics of interest: ${personCtx.dominantTopics.join(", ")}`
      : undefined;

    // ── Fire-and-forget memory update ─────────────────────────────────────
    const prayerNeed = extractPrayerNeed(message);
    updateUserMemory({
      sessionFingerprint,
      detectedName: userMemory?.detectedName ?? null,
      newPrayerNeed: prayerNeed,
      topicsOfInterest: personCtx.dominantTopics,
      spiritualMaturity: personCtx.spiritualMaturity,
      incrementMessages: true,
    }).catch(() => {});

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

    if (!localResult.needsEnrichment && !intentResult.requiresOpenAI && localResult.response && language === "en") {
      const conversationId = await getOrCreateConversation(sessionId ?? undefined);
      const { cleanReply, action } = extractAction(localResult.response);
      const finalAction = action ?? (localResult.givingFlag ? "sow-a-seed" : null);
      const sources = extractSources(cleanReply);
      const scriptures = extractScriptureReferences(cleanReply);

      await persistMessages(conversationId, message, cleanReply);
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
            intent: intentResult.intent,
            scriptures: scriptures.length > 0 ? scriptures : undefined,
          },
        }),
      );
      return;
    }

    // ── TIER 2 / 2.5: Enriched Response (OpenAI when available, else local) ──
    const t0 = Date.now();
    const clientHistory = history.map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const { reply: rawReply, conversationId, tier, sourceChunks, openaiUsed } =
      await buildLocalEnrichedResponse(
        message,
        clientHistory,
        sessionId ?? undefined,
        language,
        localResult.enrichmentContext ?? "",
        intentResult.chunkTypeWeights,
        memCtx.contextBlock || undefined,
        intentNote || undefined,
        personalizationNote,
      );

    const { cleanReply, action } = extractAction(rawReply);
    const finalAction = action ?? (localResult.givingFlag ? "sow-a-seed" : null);
    const sources = extractSources(cleanReply);
    const scriptures = extractScriptureReferences(cleanReply);
    const latencyMs = Date.now() - t0;

    // Grounding check (non-blocking, informational)
    getKnownVideoIds().then(videoIds => {
      const grounding = checkResponseGrounding(cleanReply, videoIds);
      if (!grounding.isGrounded && grounding.warnings.length > 0) {
        req.log.warn({ warnings: grounding.warnings, query: message.slice(0, 80) }, "AI response grounding warning");
      }
    }).catch(() => {});

    await persistMessages(conversationId, message, cleanReply);
    cacheSet(message, cleanReply, tier, 0.85).catch(() => {});
    logAIInteraction({
      sessionId: sessionId ?? undefined,
      query: message,
      tier,
      latencyMs,
      sourceChunks,
      cacheHit: false,
      openaiUsed,
      intent: intentResult.intent,
      sentiment: sentiment.primaryEmotion,
      language,
      action: finalAction,
    }).catch(() => {});

    res.json(
      ChatWithTempleBotsResponse.parse({
        reply: cleanReply,
        sessionId: String(conversationId),
        sources,
        action: finalAction ?? undefined,
        meta: {
          tier,
          sourceChunks,
          openaiUsed,
          intent: intentResult.intent,
          scriptures: scriptures.length > 0 ? scriptures : undefined,
        },
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
    // ── Safety Gate ────────────────────────────────────────────────────────
    if (detectManipulation(message)) {
      if (!res.writableEnded) {
        for await (const chunk of streamLocalResponse(MANIPULATION_RESPONSE)) {
          send({ delta: chunk });
        }
        send({ done: true, sessionId: sessionId ?? "0", sources: [], action: null });
        res.end();
      }
      clearTimeout(timeout);
      return;
    }

    const safetyResult = checkQuerySafety(message);
    if (safetyResult.redirectResponse) {
      if (safetyResult.level === "crisis") {
        const conversationId = await getOrCreateConversation(sessionId ?? undefined);
        await persistMessages(conversationId, message, safetyResult.redirectResponse);
        for await (const chunk of streamLocalResponse(safetyResult.redirectResponse)) {
          if (!res.writableEnded) send({ delta: chunk });
        }
        if (!res.writableEnded) {
          send({ done: true, sessionId: String(conversationId), sources: [], action: null });
          res.end();
        }
      } else {
        for await (const chunk of streamLocalResponse(safetyResult.redirectResponse)) {
          if (!res.writableEnded) send({ delta: chunk });
        }
        if (!res.writableEnded) {
          send({ done: true, sessionId: sessionId ?? "0", sources: [], action: null });
          res.end();
        }
      }
      clearTimeout(timeout);
      return;
    }

    // ── Intent + Session + Memory (parallel) ──────────────────────────────
    const intentResult = classifyIntent(message);
    const intentNote = buildIntentSystemNote(intentResult);
    const sessionFingerprint = sessionId ?? ip;

    if (sessionId) {
      try { updateSessionFromMessage(sessionId, message); } catch { /* non-critical */ }
    }

    const [userMemory] = await Promise.all([
      loadUserMemory(sessionFingerprint).catch(() => null),
    ]);
    const memCtx = buildMemoryContext(userMemory);
    const personCtx = buildPersonalizationContext(sessionFingerprint);
    const personalizationNote = personCtx.dominantTopics.length > 0
      ? `User journey: ${personCtx.journeyStage} | Topics: ${personCtx.dominantTopics.join(", ")}`
      : undefined;

    const prayerNeed = extractPrayerNeed(message);
    updateUserMemory({
      sessionFingerprint,
      newPrayerNeed: prayerNeed,
      topicsOfInterest: personCtx.dominantTopics,
      spiritualMaturity: personCtx.spiritualMaturity,
      incrementMessages: true,
    }).catch(() => {});

    // ── TIER 1: Local AI Engine ────────────────────────────────────────────
    const localResult = runLocalInference(message);

    if (!localResult.needsEnrichment && !intentResult.requiresOpenAI && localResult.response && language === "en") {
      const conversationId = await getOrCreateConversation(sessionId ?? undefined);
      const { cleanReply, action } = extractAction(localResult.response);
      const finalAction = action ?? (localResult.givingFlag ? "sow-a-seed" : null);
      const sources = extractSources(cleanReply);
      const scriptures = extractScriptureReferences(cleanReply);

      for await (const chunk of streamLocalResponse(cleanReply)) {
        if (!res.writableEnded) send({ delta: chunk });
      }

      await persistMessages(conversationId, message, cleanReply);

      if (!res.writableEnded) {
        send({
          done: true,
          sessionId: String(conversationId),
          sources,
          action: finalAction,
          meta: { intent: intentResult.intent, scriptures: scriptures.length > 0 ? scriptures : undefined },
        });
        res.end();
      }
      clearTimeout(timeout);
      return;
    }

    // ── TIER 2 / 2.5: Enriched Response (streamed) ────────────────────────
    const clientHistory = history.map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Try OpenAI streaming first when API key is set
    if (openaiClient) {
      const [sermonCtx, ragResult, activityCtx, bibleCtx, conversationId] = await Promise.all([
        buildSermonContext(),
        getRelevantKnowledge(message, intentResult.chunkTypeWeights),
        buildActivityContext(),
        buildBibleContext(message),
        getOrCreateConversation(sessionId ?? undefined),
      ]);
      const dbHistory = await loadConversationHistory(conversationId, 20);
      const hist = dbHistory.length > 0 ? dbHistory : clientHistory.slice(-20);
      const openAIContext = [bibleCtx, sermonCtx, ragResult.context, activityCtx].filter(Boolean).join("\n");

      let openAIFullReply = "";
      let openAIWorked = false;
      for await (const chunk of streamOpenAI({
        userMessage: message,
        history: hist,
        ragContext: openAIContext,
        language,
        memoryContext: memCtx.contextBlock || undefined,
        intentNote: intentNote || undefined,
        personalizationNote,
      })) {
        openAIWorked = true;
        openAIFullReply += chunk;
        if (!res.writableEnded) send({ delta: chunk });
      }

      if (openAIWorked && openAIFullReply) {
        const { cleanReply, action } = extractAction(openAIFullReply);
        const finalAction = action ?? (localResult.givingFlag ? "sow-a-seed" : null);
        const sources = extractSources(cleanReply);
        const scriptures = extractScriptureReferences(cleanReply);
        await persistMessages(conversationId, message, cleanReply);
        logAIInteraction({
          sessionId: sessionId ?? undefined,
          query: message,
          tier: "openai-stream",
          latencyMs: 0,
          sourceChunks: ragResult.sourceCount,
          cacheHit: false,
          openaiUsed: true,
          intent: intentResult.intent,
          language,
          action: finalAction,
        }).catch(() => {});
        if (!res.writableEnded) {
          send({
            done: true,
            sessionId: String(conversationId),
            sources,
            action: finalAction,
            meta: { intent: intentResult.intent, scriptures: scriptures.length > 0 ? scriptures : undefined },
          });
          res.end();
        }
        clearTimeout(timeout);
        return;
      }
      // OpenAI streaming failed — fall through to local AI
    }

    // Fallback: local enriched + local stream
    const { reply: rawReply, conversationId } = await buildLocalEnrichedResponse(
      message,
      clientHistory,
      sessionId ?? undefined,
      language,
      localResult.enrichmentContext ?? "",
      intentResult.chunkTypeWeights,
      memCtx.contextBlock || undefined,
      intentNote || undefined,
      personalizationNote,
    );

    const { cleanReply, action } = extractAction(rawReply);
    const finalAction = action ?? (localResult.givingFlag ? "sow-a-seed" : null);
    const sources = extractSources(cleanReply);
    const scriptures = extractScriptureReferences(cleanReply);

    for await (const chunk of streamLocalResponse(cleanReply)) {
      if (!res.writableEnded) send({ delta: chunk });
    }

    await persistMessages(conversationId, message, cleanReply);

    if (!res.writableEnded) {
      send({
        done: true,
        sessionId: String(conversationId),
        sources,
        action: finalAction,
        meta: { intent: intentResult.intent, scriptures: scriptures.length > 0 ? scriptures : undefined },
      });
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

// ── POST /chat/knowledge/ingest — manually trigger full knowledge sync ────────
router.post("/chat/knowledge/ingest", async (req: Request, res: Response): Promise<void> => {
  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    res.status(429).json({ error: "Rate limited." });
    return;
  }

  try {
    // Fire-and-forget full sync — don't block the HTTP response
    runFullContentSync(req.log).catch((err: unknown) =>
      req.log.warn({ err }, "Background full content sync error (non-fatal)"),
    );
    res.json({
      message: "Full AI knowledge sync triggered (sermons, devotionals, FAQs, live stream, conferences, shorts, activity, blog posts, testimonies).",
      note: "Sync runs in background — all 9 content types will be re-indexed.",
    });
  } catch (err) {
    req.log.error({ err }, "Manual knowledge ingestion failed");
    res.status(500).json({ error: "Knowledge ingestion failed." });
  }
});

// ── GET /chat/admin/ai-health — enterprise observability dashboard ─────────────
// Returns full TempleBots AI system health: sync state, cache metrics, interaction
// stats, engine metadata, and RAG quality indicators.
router.get("/chat/admin/ai-health", async (_req: Request, res: Response): Promise<void> => {
  try {
    const [syncHealth, cacheMetrics, interactionStats, knowledgeStats] = await Promise.allSettled([
      Promise.resolve(getSyncHealth()),
      Promise.resolve(getCacheMetrics()),
      ragPool.query<{
        total: string; openai_count: string; local_count: string;
        cache_hit_count: string; avg_latency: string; top_intents: string;
        error_count: string; total_24h: string;
      }>(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE openai_used = true) AS openai_count,
          COUNT(*) FILTER (WHERE openai_used = false) AS local_count,
          COUNT(*) FILTER (WHERE cache_hit = true) AS cache_hit_count,
          ROUND(AVG(latency_ms)::numeric, 0) AS avg_latency,
          COUNT(*) FILTER (WHERE error = true) AS error_count,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') AS total_24h
        FROM ai_interactions
        WHERE created_at >= NOW() - INTERVAL '7 days'
      `),
      ragPool.query<{ total_chunks: string; by_type: string }>(`
        SELECT
          COUNT(*) AS total_chunks,
          json_object_agg(chunk_type, cnt) AS by_type
        FROM (
          SELECT chunk_type, COUNT(*) AS cnt
          FROM knowledge_chunks
          GROUP BY chunk_type
        ) sub
      `),
    ]);

    const sync = syncHealth.status === "fulfilled" ? syncHealth.value : null;
    const cache = cacheMetrics.status === "fulfilled" ? cacheMetrics.value : null;
    const interactions = interactionStats.status === "fulfilled"
      ? interactionStats.value.rows[0] : null;
    const knowledge = knowledgeStats.status === "fulfilled"
      ? knowledgeStats.value.rows[0] : null;

    // Intent distribution (last 7 days)
    let intentDist: Record<string, number> = {};
    try {
      const intentRes = await ragPool.query<{ intent: string; count: string }>(
        `SELECT intent, COUNT(*) AS count FROM ai_interactions
         WHERE intent IS NOT NULL AND created_at >= NOW() - INTERVAL '7 days'
         GROUP BY intent ORDER BY count DESC LIMIT 10`,
      );
      for (const row of intentRes.rows) {
        intentDist[row.intent] = parseInt(row.count, 10);
      }
    } catch { /* non-fatal */ }

    res.json({
      system: "TempleBots v5 — JCTM Digital Ministry Intelligence",
      engineVersion: ENGINE_METADATA.version,
      engineDescription: ENGINE_METADATA.description,
      intentsSupported: ENGINE_METADATA.intentsSupported.length,
      timestamp: new Date().toISOString(),

      continuousSync: sync ? {
        status: sync.status,
        lastFullSyncAt: sync.lastFullSyncAt,
        lastActivitySyncAt: sync.lastActivitySyncAt,
        lastFullSyncSuccess: sync.lastFullSyncSuccess,
        consecutiveFullFailures: sync.consecutiveFullFailures,
        totalFullSyncs: sync.totalFullSyncs,
        totalActivitySyncs: sync.totalActivitySyncs,
        nextFullSyncInMinutes: Math.round(sync.nextFullSyncIn / 60_000),
        nextActivitySyncInMinutes: Math.round(sync.nextActivitySyncIn / 60_000),
        uptimeHours: Math.round(sync.uptimeMs / 3_600_000 * 10) / 10,
      } : null,

      cache: cache ? {
        totalEntries: cache.totalEntries,
        hitRate: Math.round(cache.hitRate * 1000) / 10 + "%",
        hitCount: cache.hitCount,
        missCount: cache.missCount,
        evictionCount: cache.evictionCount,
        estimatedMemoryKb: Math.round(cache.estimatedMemoryBytes / 1024),
        topQueries: cache.topQueries.slice(0, 5),
      } : null,

      interactions7d: interactions ? {
        total: parseInt(interactions.total, 10),
        last24h: parseInt(interactions.total_24h, 10),
        openaiUsed: parseInt(interactions.openai_count, 10),
        localEngine: parseInt(interactions.local_count, 10),
        cacheHits: parseInt(interactions.cache_hit_count, 10),
        errors: parseInt(interactions.error_count, 10),
        avgLatencyMs: parseInt(interactions.avg_latency ?? "0", 10),
        openaiRatio: interactions.total !== "0"
          ? Math.round(parseInt(interactions.openai_count, 10) / parseInt(interactions.total, 10) * 100) + "%"
          : "0%",
      } : null,

      knowledgeBase: knowledge ? {
        totalChunks: parseInt(knowledge.total_chunks, 10),
        byType: knowledge.by_type ?? {},
      } : null,

      topIntents7d: intentDist,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch AI health metrics", detail: String(err) });
  }
});

// ── POST /chat/admin/sync/full — manually trigger full sync ───────────────────
router.post("/chat/admin/sync/full", async (req: Request, res: Response): Promise<void> => {
  try {
    triggerFullSyncNow(req.log).catch(() => {});
    res.json({ message: "Full knowledge sync triggered in background." });
  } catch (err) {
    res.status(500).json({ error: "Sync trigger failed", detail: String(err) });
  }
});

// ── POST /chat/admin/sync/activity — trigger activity-only sync ───────────────
router.post("/chat/admin/sync/activity", async (req: Request, res: Response): Promise<void> => {
  try {
    triggerActivitySyncNow(req.log).catch(() => {});
    res.json({ message: "Activity knowledge sync triggered in background." });
  } catch (err) {
    res.status(500).json({ error: "Sync trigger failed", detail: String(err) });
  }
});

export default router;

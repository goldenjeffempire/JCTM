/**
 * local-ai-enhancer.ts — JCTM In-House AI Enhancer
 *
 * Zero external API calls. All responses generated from:
 *   1. Local AI engine (pattern matching + JCTM knowledge base)
 *   2. RAG context integration (pgvector semantic search)
 *   3. Local text generation templates
 *   4. Spiritual insight & scripture study generators
 */

import { runLocalInference } from "./local-ai-engine.js";
import {
  getTemplebotsLocalResponse,
  generateSpiritualInsight,
  generateScriptureStudy,
} from "./local-text-generation.js";
import { summarizeSermon } from "./local-content-intelligence.js";
import { logger } from "./logger.js";

export interface EnhancerOptions {
  query: string;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  ragContext?: string;
  additionalContext?: string;
  maxTokens?: number;
}

// ─── Main Local Enhancer ──────────────────────────────────────────────────────

export async function localAIEnhancer(options: EnhancerOptions): Promise<string> {
  const { query, ragContext } = options;

  try {
    const localResult = runLocalInference(query);

    // High-confidence local match — return immediately
    if (localResult.response && localResult.confidence >= 0.55) {
      return injectRagContext(localResult.response, ragContext);
    }

    // Handle emotional / crisis situations with dedicated template
    if (localResult.emotionalFlag) {
      return getTemplebotsLocalResponse("emotional_distress");
    }

    // Handle prayer support requests
    if (localResult.intent === "prayer_support") {
      return getTemplebotsLocalResponse("prayer_support");
    }

    // Scripture inquiry — enrich with study template
    const isScripture = /\b(verse|scripture|passage|bible|genesis|exodus|leviticus|numbers|deuteronomy|joshua|judges|ruth|samuel|kings|chronicles|ezra|nehemiah|esther|job|psalm|proverbs|ecclesiastes|song|isaiah|jeremiah|lamentations|ezekiel|daniel|hosea|joel|amos|obadiah|jonah|micah|nahum|habakkuk|zephaniah|haggai|zechariah|malachi|matthew|mark|luke|john|acts|romans|corinthians|galatians|ephesians|philippians|colossians|thessalonians|timothy|titus|philemon|hebrews|james|peter|jude|revelation)\b/i.test(query);
    if (isScripture) {
      const passage = extractPassage(query);
      if (passage) {
        return generateScriptureStudy(passage, query.length > 60 ? query : undefined);
      }
      return getTemplebotsLocalResponse("scripture_inquiry");
    }

    // Spiritual insight requests
    const isSpiritualInsight = /\b(going through|struggling|dealing with|help me|feeling|difficult|confused|worried|anxious|afraid|depressed|hopeless|alone|lost|guidance|direction|what should i|how can i)\b/i.test(query);
    if (isSpiritualInsight) {
      const cat = detectCategory(query);
      return generateSpiritualInsight(query, undefined, cat);
    }

    // RAG context available — build context-enriched response
    if (ragContext && ragContext.length > 80) {
      return buildRagEnrichedResponse(query, ragContext, localResult.intent);
    }

    // Complex theological question
    const isComplex = /\b(explain|what does|why does|how does|interpret|difference between|compare|is it biblical|should christians|what is the meaning|hermeneutic|exegesis|greek|hebrew|original|doctrine)\b/i.test(query);
    if (isComplex) {
      return getTemplebotsLocalResponse("complex_theological");
    }

    // Giving / financial questions
    if (localResult.givingFlag) {
      return localResult.response ?? getTemplebotsLocalResponse("giving");
    }

    // Medium-confidence local result — return with RAG enrichment
    if (localResult.response && localResult.confidence >= 0.3) {
      return injectRagContext(localResult.response, ragContext);
    }

    // Generic fallback
    return buildFallbackResponse(query);
  } catch (err) {
    logger.warn({ err }, "Local AI enhancer error — using fallback");
    return buildFallbackResponse(query);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function injectRagContext(response: string, ragContext?: string): string {
  if (!ragContext || ragContext.length < 50) return response;

  const ragLines = ragContext
    .split("\n")
    .filter(l => l.trim().length > 40)
    .slice(0, 3)
    .join(" ");

  if (!ragLines) return response;
  return response + `\n\n---\n*From JCTM's knowledge base:* ${ragLines.slice(0, 300)}`;
}

function buildRagEnrichedResponse(query: string, ragContext: string, _intent: string): string {
  const ragLines = ragContext
    .split("\n")
    .filter(l => l.trim().length > 40)
    .slice(0, 5)
    .join("\n");

  return `## From JCTM's Teachings

${ragLines}

---

This teaching is grounded in the Correction Mandate of Jesus Christ Temple Ministry (JCTM) under Prophet Amos Evomobor. For deeper study on this and related topics, watch Temple TV at **YouTube: @TEMPLETVJCTM** or explore our sermon library at jctm.org.ng/sermons.

🙏 *If you have a specific question related to this teaching, feel free to ask — TempleBots is here to guide you through God's Word.*`;
}

function buildFallbackResponse(query: string): string {
  const shortQuery = query.slice(0, 100) + (query.length > 100 ? "..." : "");
  return `Thank you for your question. Jesus Christ Temple Ministry (JCTM) is committed to providing scripturally grounded answers to every inquiry.

Regarding *"${shortQuery}"* — this is a matter that deserves careful, biblical engagement beyond what I can fully address in this format.

Here's how to get a complete answer:

📺 **Watch Temple TV** — Prophet Amos Evomobor teaches on a wide range of topics: **YouTube: @TEMPLETVJCTM**

📖 **Search our sermon library** — jctm.org.ng/sermons

🙏 **Submit a prayer request** — jctm.org.ng/prayer

📩 **Contact the ministry directly** — info@jctm.org.ng

Is there anything else I can help clarify from JCTM's doctrinal perspective?`;
}

function extractPassage(query: string): string | null {
  const match = query.match(/\b([1-3]?\s*(?:genesis|exodus|leviticus|numbers|deuteronomy|joshua|judges|ruth|samuel|kings|chronicles|ezra|nehemiah|esther|job|psalm|proverbs|ecclesiastes|song\s+of\s+solomon|isaiah|jeremiah|lamentations|ezekiel|daniel|hosea|joel|amos|obadiah|jonah|micah|nahum|habakkuk|zephaniah|haggai|zechariah|malachi|matthew|mark|luke|john|acts|romans|corinthians|galatians|ephesians|philippians|colossians|thessalonians|timothy|titus|philemon|hebrews|james|peter|jude|revelation))\s*\d+[:\d-\d]*/i);
  return match?.[0]?.trim() ?? null;
}

function detectCategory(query: string): string {
  const q = query.toLowerCase();
  if (/anxi|worri|stress|fear|afraid/.test(q)) return "anxiety";
  if (/grief|loss|mourn|sad|lost (a|my|someone)/.test(q)) return "grief";
  if (/doubt|question|not sure|confused about|faith/.test(q)) return "doubt";
  return "general";
}

// ─── Sermon Summary (local) ───────────────────────────────────────────────────

export async function enhanceSermonSummary(
  title: string,
  description: string,
): Promise<{ summary: string; bulletPoints: string[]; seoDescription: string }> {
  try {
    const result = summarizeSermon(title, description);
    return {
      summary: result.summary,
      bulletPoints: result.bulletPoints,
      seoDescription: result.seoDescription,
    };
  } catch {
    return { summary: "", bulletPoints: [], seoDescription: "" };
  }
}

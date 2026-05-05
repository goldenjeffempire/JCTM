/**
 * local-ai-enhancer.ts — JCTM In-House AI Enhancer v2
 *
 * Zero external API calls. All responses generated from:
 *   1. Local AI engine (pattern matching + JCTM knowledge base — 32 intents)
 *   2. RAG context integration (pgvector semantic search — 6 chunks)
 *   3. Local text generation templates
 *   4. Spiritual insight & scripture study generators
 *   5. Activity-aware context (live events, testimonies, prayer themes)
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

    // High-confidence local match — return immediately (enriched with RAG if available)
    if (localResult.response && localResult.confidence >= 0.55) {
      return injectRagContext(localResult.response, ragContext);
    }

    // Handle emotional / crisis situations with dedicated template
    if (localResult.emotionalFlag) {
      const cat = detectEmotionalCategory(query);
      return generateSpiritualInsight(query, undefined, cat);
    }

    // Dedicated handlers for new v2 intents
    switch (localResult.intent) {
      case "prayer_support":
        return getTemplebotsLocalResponse("prayer_support");

      case "end_times":
        return injectRagContext(localResult.response ?? buildEndTimesResponse(), ragContext);

      case "fasting_prayer":
        return injectRagContext(localResult.response ?? buildFastingResponse(), ragContext);

      case "spiritual_warfare":
        return injectRagContext(localResult.response ?? buildWarfareResponse(), ragContext);

      case "salvation_new_birth":
        return injectRagContext(localResult.response ?? buildSalvationResponse(), ragContext);

      case "repentance_restoration":
        return injectRagContext(localResult.response ?? buildRepentanceResponse(), ragContext);

      case "praise_worship":
        return injectRagContext(localResult.response ?? buildWorshipResponse(), ragContext);

      case "bible_study_method":
        return injectRagContext(localResult.response ?? buildBibleStudyResponse(), ragContext);

      case "sin_temptation":
        return injectRagContext(localResult.response ?? buildTemptationResponse(), ragContext);

      case "marriage_family":
        return injectRagContext(localResult.response ?? buildMarriageResponse(), ragContext);

      case "healing_miracles":
        return injectRagContext(localResult.response ?? buildHealingResponse(), ragContext);

      case "new_believer":
        return injectRagContext(localResult.response ?? buildNewBelieverResponse(), ragContext);

      case "testimony_sharing":
        return injectRagContext(localResult.response ?? buildTestimonyResponse(), ragContext);

      default:
        break;
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

    // Activity-aware fallback — if RAG has live context, lead with it
    if (ragContext && ragContext.includes("LIVE JCTM COMMUNITY CONTEXT")) {
      return buildActivityAwareFallback(query, ragContext);
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

  // Inject sermon citations if present in RAG context
  const sermonMatch = ragContext.match(/sermon[^"]*"([^"]+)"[^\n]*youtube\.com\/watch\?v=([\w-]+)/gi);
  if (sermonMatch && sermonMatch.length > 0 && !response.includes("youtube.com")) {
    const sermonsNote = sermonMatch.slice(0, 2).join(", ");
    return response + `\n\n---\n*Related JCTM Sermon:* ${sermonsNote}`;
  }

  // Inject relevant RAG knowledge lines
  const ragLines = ragContext
    .split("\n")
    .filter(l => l.trim().length > 40 && !l.startsWith("##") && !l.startsWith("RECENT") && !l.startsWith("UPCOMING") && !l.startsWith("COMMUNITY"))
    .slice(0, 2)
    .join(" ");

  if (!ragLines) return response;
  return response + `\n\n---\n*From JCTM's teaching archive:* ${ragLines.slice(0, 280)}`;
}

function buildRagEnrichedResponse(query: string, ragContext: string, _intent: string): string {
  // Pull relevant sermon references from context
  const sermonLines = ragContext
    .split("\n")
    .filter(l => l.includes("youtube.com/watch") || l.match(/^-\s*"/))
    .slice(0, 3);

  // Pull knowledge chunks
  const knowledgeLines = ragContext
    .split("\n")
    .filter(l => l.trim().length > 50 && !l.startsWith("#") && !l.includes("youtube.com"))
    .slice(0, 4)
    .join("\n");

  const sermonSection = sermonLines.length > 0
    ? `\n\n**📺 Relevant Temple TV Teachings:**\n${sermonLines.join("\n")}`
    : "";

  return `## From JCTM's Teachings

${knowledgeLines}${sermonSection}

---

This teaching is grounded in the **Correction Mandate** of Jesus Christ Temple Ministry (JCTM) under Prophet Amos Evomobor. For deeper study, watch Temple TV at **YouTube: @TEMPLETVJCTM** or explore the full sermon library at jctm.org.ng/sermons.

🙏 *If you have a specific question on this topic, TempleBots is here to guide you through God's Word.*`;
}

function buildActivityAwareFallback(query: string, ragContext: string): string {
  const activityLines = ragContext
    .split("\n")
    .filter(l => l.includes("UPCOMING") || l.includes("EVENT") || l.includes("TESTIMONY") || l.includes("PRAYER FOCUS"))
    .slice(0, 4)
    .join("\n");

  return `Thank you for reaching out to JCTM. Regarding *"${query.slice(0, 80)}${query.length > 80 ? "..." : ""}"* — let me share what is happening in our community right now:

${activityLines}

For a direct answer on this topic, I encourage you to:

📺 **Watch Temple TV** — Prophet Amos teaches on a wide range of topics: **YouTube @TEMPLETVJCTM**
📖 **Browse our sermon library** — jctm.org.ng/sermons
🙏 **Submit a prayer request** — jctm.org.ng/prayer
📩 **Contact the ministry** — info@jctm.org.ng

Is there a specific JCTM teaching, doctrine, or topic you would like me to address?`;
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

function detectEmotionalCategory(query: string): string {
  const q = query.toLowerCase();
  if (/anxi|worri|stress|fear|afraid|panic|nervous/.test(q)) return "anxiety";
  if (/grief|loss|mourn|sad|lost (a|my|someone)|died|death|depress/.test(q)) return "grief";
  if (/doubt|question|not sure|confused about|faith|believe/.test(q)) return "doubt";
  if (/angry|furious|bitter|betray|resentful/.test(q)) return "anger";
  return "general";
}

function detectCategory(query: string): string {
  const q = query.toLowerCase();
  if (/anxi|worri|stress|fear|afraid/.test(q)) return "anxiety";
  if (/grief|loss|mourn|sad|lost (a|my|someone)/.test(q)) return "grief";
  if (/doubt|question|not sure|confused about|faith/.test(q)) return "doubt";
  return "general";
}

function extractPassage(query: string): string | null {
  const match = query.match(/\b([1-3]?\s*(?:genesis|exodus|leviticus|numbers|deuteronomy|joshua|judges|ruth|samuel|kings|chronicles|ezra|nehemiah|esther|job|psalm|proverbs|ecclesiastes|song\s+of\s+solomon|isaiah|jeremiah|lamentations|ezekiel|daniel|hosea|joel|amos|obadiah|jonah|micah|nahum|habakkuk|zephaniah|haggai|zechariah|malachi|matthew|mark|luke|john|acts|romans|corinthians|galatians|ephesians|philippians|colossians|thessalonians|timothy|titus|philemon|hebrews|james|peter|jude|revelation))\s*\d+[:\d-\d]*/i);
  return match?.[0]?.trim() ?? null;
}

// ─── v2 Intent Response Builders (compact fallbacks) ─────────────────────────

function buildEndTimesResponse(): string {
  return `**End Times Prophecy** is central to JCTM's message — particularly the Warri City Crusade 2026 theme: *"Be Ready For Rapture: Tribulation Is Coming! Run For Your Soul!"*

The Bible is clear: Jesus will return (1 Thessalonians 4:16-17). The rapture catches away genuine, holy believers. The tribulation follows — a period of unprecedented global suffering (Revelation 6-19). The antichrist will enforce the mark of the beast (666) — **do not receive it**.

**Signs happening now:** Global moral collapse (2 Timothy 3:1-5), apostasy in the church (2 Thessalonians 2:3), wars and earthquakes (Matthew 24:6-8).

Prophet Amos's call: Repent. Live holy. Stay in God's Word. Watch and pray.

> *"Watch therefore, for you do not know what hour your Lord is coming."* — Matthew 24:42

📺 Watch end-times teachings: **YouTube @TEMPLETVJCTM**`;
}

function buildFastingResponse(): string {
  return `**Fasting** is a core spiritual discipline — Jesus said *"when you fast"*, not *"if"* (Matthew 6:16).

**Why Christians fast:** Spiritual breakthrough (Mark 9:29), seeking God's face, intercession, consecration, and repentance (Joel 2:12, Isaiah 58:6).

**Types:** Water fast, Daniel fast (vegetables + water), partial/time fast, complete fast.

**How:** Set a specific duration, pray during meal times, read Scripture, journal what God speaks. Break the fast gently.

📺 Prophet Amos teaches on fasting: **YouTube @TEMPLETVJCTM**`;
}

function buildWarfareResponse(): string {
  return `**Spiritual warfare is real** — Ephesians 6:12 tells us our battle is not against flesh and blood but against principalities and powers.

**Your armour (Ephesians 6:13-18):** Truth, righteousness, gospel of peace, faith, salvation, the Word of God, and prayer in the Spirit.

**Key principles from JCTM:**
- The victory is already won at the Cross (Colossians 2:15)
- Generational curses are broken through Christ (Galatians 3:13) and genuine repentance
- Binding and loosing (Matthew 18:18) operates under Christ's authority
- JCTM warns against sensationalized "deliverance theatrics" — true deliverance comes by the Holy Spirit

🙏 Submit a prayer request: jctm.org.ng/prayer`;
}

function buildSalvationResponse(): string {
  return `**Salvation is by grace through faith in Jesus Christ alone** (Ephesians 2:8-9).

**The Gospel:** All have sinned (Romans 3:23) → sin's wage is death (Romans 6:23) → Christ died for sinners (Romans 5:8) → receive eternal life by faith (Romans 10:9-10).

**To be saved right now:**
1. Acknowledge you are a sinner
2. Believe Jesus died and rose for you
3. Confess Him as Lord
4. Repent and turn from your old life

*"Lord Jesus, I am a sinner. I believe You died for my sins and rose again. I receive You as my Lord and Saviour. Amen."*

📩 Contact JCTM for follow-up: info@jctm.org.ng
📺 New believer resources: **YouTube @TEMPLETVJCTM**`;
}

function buildRepentanceResponse(): string {
  return `**Repentance** (Greek: metanoia) is a genuine change of mind that leads to a change of direction — not guilt or shame.

The Father's heart toward the returning prodigal: *"He ran and fell on his neck and kissed him"* (Luke 15:20). God is not angry — He is waiting.

**Steps to restoration:**
1. Come as you are — don't wait until you're "ready"
2. Confess specifically before God (1 John 1:9)
3. Receive forgiveness — *"He is faithful and just to forgive"*
4. Return to the Word and a sound church
5. Don't look back (Luke 9:62)

> *"Return, O backsliding children, says the LORD"* — Jeremiah 3:14

🙏 Submit a prayer request: jctm.org.ng/prayer`;
}

function buildWorshipResponse(): string {
  return `**True worship** is in spirit and truth (John 4:24) — not entertainment or performance, but genuine encounter with God.

**Praise vs Worship:**
- 🎺 **Praise** — declaring God's greatness with energy and joy (Psalm 150)
- 🕊️ **Worship** — intimate adoration of God's person

**Praise as warfare:** 2 Chronicles 20 — Jehoshaphat sent singers FIRST into battle. God showed up when praise began. *"Let the high praises of God be in their mouth and a two-edged sword in their hand"* (Psalm 149:6).

**Practical:** Cultivate a private altar first. Thanksgiving is the gateway into His presence (Psalm 100:4). Holiness and worship are inseparable at JCTM.

📺 Watch JCTM worship services: **YouTube @TEMPLETVJCTM**`;
}

function buildBibleStudyResponse(): string {
  return `**Studying God's Word** is the most important discipline in the believer's life.

**Three-step framework:**
1. 📖 **Observation** — What does it actually say? Read slowly, multiple times
2. 🔍 **Interpretation** — What does it mean? Read in context, compare Scripture with Scripture
3. ✅ **Application** — What must I do? Every passage has a demand on your life

**Beginner reading order (recommended by JCTM):**
John → Romans → Acts → Ephesians → Psalms

**Daily quiet time structure:**
- Read one chapter (same passage for 3 days to absorb it)
- Write one key verse and why it stood out
- Pray in response to what you read
- Declare a truth from the passage over your day

*Daily devotions available at jctm.org.ng/devotion*
📺 Scripture teaching series: **YouTube @TEMPLETVJCTM**`;
}

function buildTemptationResponse(): string {
  return `**Victory over sin and temptation** comes through the Holy Spirit — not willpower.

> *"No temptation has overtaken you except such as is common to man... God will also make the way of escape."* — 1 Corinthians 10:13

**Practical strategies:**
- ⚔️ Know your weakness — build your strongest defences there
- 🏃 **Flee, don't fight** — Joseph ran from Potiphar's wife (Genesis 39:12)
- 📖 Saturate your mind with the Word (Psalm 119:11)
- 🙏 Pray the moment temptation arises — don't reason with it
- 👥 Get accountable to a mature believer (James 5:16)
- 🔥 **Walk in the Spirit and you shall not fulfill the lust of the flesh** (Galatians 5:16)

🙏 Submit a prayer request for breakthrough: jctm.org.ng/prayer`;
}

function buildMarriageResponse(): string {
  return `**Marriage is a covenant** (Genesis 2:24), not a contract. Ephesians 5:22-33 is the complete blueprint.

**Husband:** Love sacrificially as Christ loved the Church — servant leadership, not domination (Ephesians 5:25)
**Wife:** Respectful submission — not subjugation, but voluntary honouring of God's order (Ephesians 5:22)

**Divorce:** JCTM acknowledges two biblical grounds — sexual immorality (Matthew 19:9) and abandonment by an unbeliever (1 Corinthians 7:15). Outside these, pursue reconciliation.

**Courtship:** Purity (1 Thessalonians 4:3-5), choose godliness over attraction, do not be unequally yoked (2 Corinthians 6:14).

**Family altar:** Pray daily together. Train children in the Word from childhood (Proverbs 22:6, Deuteronomy 6:6-7).

📩 Pastoral counselling: info@jctm.org.ng`;
}

function buildHealingResponse(): string {
  return `**God is still a Healer** — Jehovah Rapha (Exodus 15:26). Jesus healed ALL who came to Him (Matthew 4:23-24) and He is the same yesterday, today, and forever (Hebrews 13:8).

Healing is in the atonement: *"By His stripes we are healed"* (Isaiah 53:5, Matthew 8:16-17).

**JCTM's balanced position:** Healing is always God's will and ability — but timing belongs to His sovereignty. JCTM does NOT teach "guaranteed healing now" as the prosperity gospel falsely claims.

**What to do:**
1. 🙏 Pray and anoint with oil (James 5:14-16)
2. 📖 Stand on healing scriptures — Isaiah 53:5, Psalm 103:3, Mark 16:18
3. 💊 Use available medicine — Luke the physician was Paul's companion (Colossians 4:14)
4. 🤝 Seek intercession at jctm.org.ng/prayer
5. ✝️ Trust God's sovereignty — He alone determines the *when*`;
}

function buildNewBelieverResponse(): string {
  return `Welcome to the family of God! 🎉 This is the greatest decision you have ever made.

**Your first steps:**

1. 📖 **Read God's Word daily** — Start with John, then Acts, then Romans
2. 💧 **Get baptized** — Your first act of obedience (Matthew 28:19, Romans 6:3-4). Contact JCTM: info@jctm.org.ng
3. 🙏 **Pray daily** — Start with 10-15 minutes in the morning
4. ⛪ **Join a sound church** — Come to Ebrumede Temple, Warri, or find a viewing centre
5. 🔥 **Seek Holy Spirit baptism** — Ask God to fill you (Luke 11:13, Acts 1:8)
6. 🚫 **Guard your mind** — Be selective with what you consume
7. 👥 **Get accountability** — Find a mature believer to walk with you

📩 JCTM new believer support: info@jctm.org.ng
📺 New believer playlist: **YouTube @TEMPLETVJCTM**`;
}

function buildTestimonyResponse(): string {
  return `**Your testimony is a weapon** — Revelation 12:11 says believers overcome the enemy *"by the blood of the Lamb and by the word of their testimony."*

When you share what God has done, you are not just telling a story — you are releasing faith into the atmosphere that can unlock someone else's breakthrough.

**Share your testimony at JCTM:**
- 🙌 Salvation — coming to Christ
- 💊 Healing — physical restoration
- 🏠 Provision — God's supernatural supply
- 🔓 Deliverance — freedom from bondage
- 🙏 Answered prayer — God responding specifically

**Submit at:** jctm.org.ng/testimonies

Your story matters. Someone is waiting to hear what God did for you.

📺 Watch community testimonies: **YouTube @TEMPLETVJCTM**`;
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

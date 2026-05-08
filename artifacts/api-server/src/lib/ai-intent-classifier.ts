/**
 * AI Intent Classifier — JCTM TempleBots v4
 *
 * Classifies every incoming query into a semantic intent bucket before RAG.
 * The returned chunk_type_weights are applied to re-rank knowledge_chunks so
 * the most relevant content type surfaces at the top of the context window.
 *
 * Zero external API calls — pure regex + keyword scoring.
 */

// ─── Intent Types ─────────────────────────────────────────────────────────────

export type QueryIntent =
  | "doctrinal"          // What does JCTM teach about X / Correction Mandate / Primitive Christianity
  | "pastoral_care"      // Emotional distress, prayer needs, personal struggles
  | "sermon_discovery"   // Find a sermon, what has Prophet Amos preached on X
  | "event_info"         // Upcoming events, crusades, services, conferences
  | "ministry_info"      // About JCTM, location, contact, Temple TV, Prophet Amos
  | "testimony"          // Sharing or asking about testimonies
  | "prayer_request"     // Submitting or discussing prayer requests
  | "scripture_study"    // Bible study, specific passage, scripture exposition
  | "giving"             // Tithes, offerings, seed sowing, donation
  | "devotion"           // Daily devotional, Bible reading plan
  | "general";           // Everything else

export interface IntentResult {
  intent: QueryIntent;
  confidence: number;           // 0.0 – 1.0
  subIntents: QueryIntent[];    // Additional detected intents (multi-label)
  chunkTypeWeights: Record<string, number>; // Weights for RAG re-ranking
  responseDepth: "brief" | "standard" | "deep"; // Suggested response depth
  requiresOpenAI: boolean;      // Whether this query warrants OpenAI (complex reasoning needed)
  contextHints: string[];       // Short hints to inject into system prompt
}

// ─── Intent Signal Rules ──────────────────────────────────────────────────────

interface IntentRule {
  intent: QueryIntent;
  patterns: RegExp[];
  keywords: string[];
  baseWeight: number;
  chunkTypeWeights: Record<string, number>;
  responseDepth: "brief" | "standard" | "deep";
  requiresOpenAI: boolean;
  contextHints: string[];
}

const INTENT_RULES: IntentRule[] = [
  {
    intent: "doctrinal",
    patterns: [
      /\b(what does jctm teach|correction mandate|primitive christianity|five errors|prosperity gospel|false prophet|five.fold|apostolic|doctrinal|holiness|sanctification|heresy|baptism by immersion|water baptism|tongues|holy spirit baptism|ecumenism)\b/i,
      /\b(what does (the )?bible say about|is it biblical|scripture for|defend (from )?scripture|prove from (the )?bible|theological|exegesis|greek|hebrew word)\b/i,
    ],
    keywords: ["doctrine", "teaching", "believe", "position", "stance", "jctm says", "prophet amos teaches", "theology", "heresy", "error"],
    baseWeight: 1.8,
    chunkTypeWeights: { doctrine: 3.0, sermon: 1.5, faq: 1.2, devotional: 0.8, activity: 0.5 },
    responseDepth: "deep",
    requiresOpenAI: true,
    contextHints: ["User is asking a doctrinal question — prioritize JCTM canonical doctrine chunks", "Ground answer firmly in Correction Mandate and Primitive Christianity"],
  },
  {
    intent: "pastoral_care",
    patterns: [
      /\b(i('m| am) (struggling|suffering|hurting|depressed|anxious|afraid|lost|broken|hopeless|suicidal|lonely|confused|angry|bitter|grieving|mourning))\b/i,
      /\b(i need (help|prayer|support|comfort|someone to talk)|pray for me|please pray|god (where are you|why|help me)|i can'?t (cope|go on|take it)|i'?ve lost my (faith|way|hope))\b/i,
      /\b(mental health|crisis|abuse|trauma|addiction|divorce|death|grief|loss|suicide|self.harm)\b/i,
    ],
    keywords: ["struggling", "hurting", "pray for me", "need prayer", "hopeless", "depressed", "anxious", "lost someone", "heartbroken", "suicidal"],
    baseWeight: 2.2,
    chunkTypeWeights: { doctrine: 1.0, sermon: 1.2, faq: 0.8, devotional: 2.0, activity: 1.5 },
    responseDepth: "deep",
    requiresOpenAI: true,
    contextHints: ["User is in emotional distress — lead with pastoral compassion before theology", "CRITICAL: empathy first, scripture second, prayer third"],
  },
  {
    intent: "sermon_discovery",
    patterns: [
      /\b(sermon on|sermon about|preached on|has prophet amos (preached|taught|spoken) (on|about)|find (a )?sermon|temple tv sermon|do you have (a )?sermon|sermon (series|list)|watch (a )?sermon)\b/i,
      /\b(youtube|temple tv|video (on|about)|watch|listen to)\b/i,
    ],
    keywords: ["sermon", "preach", "taught", "temple tv", "youtube", "video", "watch", "listen", "recording", "message"],
    baseWeight: 1.6,
    chunkTypeWeights: { sermon: 3.5, doctrine: 0.8, faq: 0.7, devotional: 0.5, activity: 1.0 },
    responseDepth: "standard",
    requiresOpenAI: false,
    contextHints: ["User wants sermon recommendations — prioritize sermon knowledge chunks with YouTube links", "Always provide watch links"],
  },
  {
    intent: "event_info",
    patterns: [
      /\b(upcoming event|next (service|meeting|crusade|conference|program)|when is (the )?next|what('s| is) happening|crusade|conference|revival|camp meeting|event (date|schedule|location|time))\b/i,
      /\b(warri crusade|jctm event|program|outreach|convention)\b/i,
    ],
    keywords: ["event", "crusade", "conference", "when", "where", "schedule", "date", "program", "meeting", "service", "revival"],
    baseWeight: 1.4,
    chunkTypeWeights: { activity: 3.0, sermon: 0.7, doctrine: 0.5, faq: 1.2, devotional: 0.5 },
    responseDepth: "brief",
    requiresOpenAI: false,
    contextHints: ["User asking about events — use live activity context", "Include dates, locations, and registration links"],
  },
  {
    intent: "ministry_info",
    patterns: [
      /\b(who is prophet amos|about jctm|jctm (history|location|contact|address|email|phone)|where is jctm|how (do i|can i) (contact|reach|join|find) jctm|temple tv channel|youtube channel|social media)\b/i,
      /\b(how (do i|can i) (become a member|join the ministry)|what is jctm|tell me about (jctm|the ministry|prophet amos))\b/i,
    ],
    keywords: ["jctm", "ministry", "prophet amos", "contact", "address", "location", "email", "phone", "member", "join", "temple tv"],
    baseWeight: 1.3,
    chunkTypeWeights: { faq: 2.5, doctrine: 1.5, sermon: 0.8, activity: 1.2, devotional: 0.5 },
    responseDepth: "standard",
    requiresOpenAI: false,
    contextHints: ["User wants ministry info — include contact details, location, Temple TV links"],
  },
  {
    intent: "testimony",
    patterns: [
      /\b(my testimony|share (a )?testimony|i want to (share|testify)|god (healed|saved|delivered|provided|answered|restored) me|submit (a )?testimony|community testimony|miracle story)\b/i,
      /\b(testimony (of|about)|what god has done|prayer was answered|breakthrough)\b/i,
    ],
    keywords: ["testimony", "testify", "healed", "saved", "delivered", "miracle", "breakthrough", "answered prayer", "god did"],
    baseWeight: 1.2,
    chunkTypeWeights: { activity: 3.0, sermon: 1.0, doctrine: 0.7, faq: 0.8, devotional: 1.0 },
    responseDepth: "standard",
    requiresOpenAI: false,
    contextHints: ["User is sharing or asking about testimonies — include recent community testimonies if available"],
  },
  {
    intent: "prayer_request",
    patterns: [
      /\b(pray (for me|with me)|i need (prayer|intercession)|prayer (request|for|about)|please (pray|intercede)|join me in prayer|stand with me in prayer|prayer point|prayer topic)\b/i,
    ],
    keywords: ["pray", "prayer", "intercession", "intercede", "request", "prayer chain"],
    baseWeight: 1.4,
    chunkTypeWeights: { activity: 2.5, devotional: 2.0, sermon: 0.8, doctrine: 0.7, faq: 1.0 },
    responseDepth: "standard",
    requiresOpenAI: false,
    contextHints: ["User needs prayer — acknowledge their need, pray with them, offer community prayer focus context"],
  },
  {
    intent: "scripture_study",
    patterns: [
      /\b(bible study|study (the )?bible|what does (genesis|exodus|psalms|proverbs|isaiah|matthew|john|romans|ephesians|revelation|hebrews|acts|corinthians|galatians|philippians|colossians|thessalonians|timothy|titus|james|peter|jude) (say|mean|teach)|explain (the )?(verse|passage|scripture)|meaning of|commentary on|interpret|exegesis|the greek|hebrew word for)\b/i,
      /\b(\d+:\d+|\bverse\b|\bpassage\b|\bchapter\b)/i,
    ],
    keywords: ["bible", "scripture", "verse", "passage", "chapter", "study", "meaning", "interpretation", "commentary", "greek", "hebrew", "exegesis"],
    baseWeight: 1.5,
    chunkTypeWeights: { doctrine: 2.0, sermon: 2.0, faq: 1.0, devotional: 1.5, activity: 0.5 },
    responseDepth: "deep",
    requiresOpenAI: true,
    contextHints: ["User is studying scripture — provide exegetical depth grounded in JCTM doctrinal position"],
  },
  {
    intent: "giving",
    patterns: [
      /\b(tithe|tithing|offering|seed sowing|sow a seed|give (to jctm|to the ministry|online)|donation|how (do i|can i) give|financial support|partner with|give online)\b/i,
    ],
    keywords: ["give", "giving", "tithe", "offering", "seed", "donation", "partner", "support", "financial"],
    baseWeight: 1.3,
    chunkTypeWeights: { doctrine: 1.5, faq: 2.0, sermon: 1.0, activity: 1.5, devotional: 0.5 },
    responseDepth: "standard",
    requiresOpenAI: false,
    contextHints: ["User asking about giving — include jctm.org.ng/give link, clarify this is NOT prosperity gospel"],
  },
  {
    intent: "devotion",
    patterns: [
      /\b(daily devotion|devotional (for today|today)|today'?s devotion|bible reading (plan|today)|morning devotion|evening devotion|read the word today)\b/i,
    ],
    keywords: ["devotion", "devotional", "daily reading", "bible plan", "today's reading"],
    baseWeight: 1.2,
    chunkTypeWeights: { devotional: 3.5, doctrine: 1.0, sermon: 0.8, faq: 0.7, activity: 2.0 },
    responseDepth: "brief",
    requiresOpenAI: false,
    contextHints: ["User wants today's devotion — use the live activity context devotional section"],
  },
];

// ─── Off-topic Detection ──────────────────────────────────────────────────────

const OFF_TOPIC_PATTERNS = [
  /\b(cryptocurrency|bitcoin|ethereum|nft|stocks|trading|invest(ment|ing)|forex|binance|coinbase)\b/i,
  /\b(who (will|should) (i|you) vote for|politics|political party|president (trump|biden|obama)|election|democrat|republican|labour party|pdp|apc)\b/i,
  /\b(sex(ual)?|porn|adult content|nude|naked|erotic)\b/i,
  /\b(write me (an? )?(essay|code|script|program|email)|debug this|python|javascript|react|sql query)\b/i,
  /\b(weather (today|tomorrow|this week)|what'?s the (weather|temperature)|forecast)\b/i,
  /\b(recipe for|how to cook|what to eat|restaurant recommendation)\b/i,
];

export function isOffTopic(query: string): boolean {
  return OFF_TOPIC_PATTERNS.some(p => p.test(query));
}

// ─── Main Classifier ──────────────────────────────────────────────────────────

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

function scoreRule(query: string, rule: IntentRule): number {
  const norm = normalizeText(query);
  let score = 0;

  for (const pattern of rule.patterns) {
    if (pattern.test(query)) score += 2.0;
  }

  for (const keyword of rule.keywords) {
    if (norm.includes(normalizeText(keyword))) {
      score += keyword.includes(" ") ? 1.5 : 0.8;
    }
  }

  return score * rule.baseWeight;
}

export function classifyIntent(query: string): IntentResult {
  const scores = INTENT_RULES.map(rule => ({
    rule,
    score: scoreRule(query, rule),
  })).sort((a, b) => b.score - a.score);

  const topScore = scores[0]!;
  const maxPossibleScore = 20;
  const confidence = Math.min(topScore.score / maxPossibleScore, 1.0);

  // Detect sub-intents (any rule with > 30% of top score)
  const subIntents: QueryIntent[] = scores
    .slice(1)
    .filter(s => s.score > 0 && topScore.score > 0 && (s.score / topScore.score) > 0.3)
    .map(s => s.rule.intent)
    .slice(0, 2);

  const primaryRule = confidence > 0.05 ? topScore.rule : null;

  const intent: QueryIntent = primaryRule?.intent ?? "general";
  const chunkTypeWeights = primaryRule?.chunkTypeWeights ?? {
    doctrine: 1.0, sermon: 1.0, faq: 1.0, devotional: 1.0, activity: 1.0,
  };
  const responseDepth = primaryRule?.responseDepth ?? "standard";
  const requiresOpenAI = primaryRule?.requiresOpenAI ?? false;
  const contextHints = primaryRule?.contextHints ?? [];

  // Merge sub-intent chunk weights (average blend)
  const mergedWeights = { ...chunkTypeWeights };
  for (const subIntent of subIntents) {
    const subRule = INTENT_RULES.find(r => r.intent === subIntent);
    if (subRule) {
      for (const [type, weight] of Object.entries(subRule.chunkTypeWeights)) {
        mergedWeights[type] = ((mergedWeights[type] ?? 1.0) + weight) / 2;
      }
    }
  }

  return {
    intent,
    confidence,
    subIntents,
    chunkTypeWeights: mergedWeights,
    responseDepth,
    requiresOpenAI,
    contextHints,
  };
}

// ─── RAG Re-Ranker ────────────────────────────────────────────────────────────
// Applies chunk_type_weights to re-rank RRF scores post-fusion.

export interface RagChunkWithType {
  content: string;
  source: string;
  chunk_type: string;
  score: number;
}

export function applyIntentWeights(
  chunks: RagChunkWithType[],
  weights: Record<string, number>,
): RagChunkWithType[] {
  return chunks
    .map(chunk => ({
      ...chunk,
      score: chunk.score * (weights[chunk.chunk_type] ?? 1.0),
    }))
    .sort((a, b) => b.score - a.score);
}

// ─── Context Hint Formatter ───────────────────────────────────────────────────

export function buildIntentSystemNote(result: IntentResult): string {
  if (result.intent === "general" && result.contextHints.length === 0) return "";
  const lines = [
    `[QUERY INTENT: ${result.intent.toUpperCase()} | confidence: ${(result.confidence * 100).toFixed(0)}%]`,
    ...result.contextHints,
  ];
  if (result.subIntents.length > 0) {
    lines.push(`[SUB-INTENTS: ${result.subIntents.join(", ")}]`);
  }
  return lines.join("\n");
}

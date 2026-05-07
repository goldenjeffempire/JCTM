/**
 * AI Personalization Engine — Session-Based Content Discovery
 *
 * Tracks per-session interaction signals to power:
 *  - Topic preference modeling (what the user consistently asks about)
 *  - Content affinity scoring (which content types they engage with)
 *  - Adaptive suggested questions (progressively deeper based on history)
 *  - Return visitor detection and context restoration
 *  - Spiritual journey tracking (beginner → growing → mature believer)
 *
 * Uses in-memory session store (no PII stored, session-scoped only).
 * Zero external API calls.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type SpiritualMaturity = "seeker" | "new_believer" | "growing" | "mature";
export type ContentPreference = "sermons" | "blog" | "devotionals" | "prayer" | "events";

export interface TopicInterest {
  topic: string;
  mentionCount: number;
  lastMentioned: number;
  affinity: number; // 0.0 – 1.0
}

export interface SessionProfile {
  sessionId: string;
  createdAt: number;
  lastActiveAt: number;
  messageCount: number;
  topicInterests: Map<string, TopicInterest>;
  contentPreferences: Map<ContentPreference, number>;
  detectedName: string | null;
  spiritualMaturity: SpiritualMaturity;
  emotionalTrend: "improving" | "stable" | "declining";
  returnVisitor: boolean;
  questionsAsked: string[];
  keyInsights: string[]; // things the user revealed about themselves
}

export interface PersonalizationContext {
  sessionId: string;
  dominantTopics: string[];
  spiritualMaturity: SpiritualMaturity;
  suggestedDepth: "introductory" | "intermediate" | "deep";
  personalizedGreeting: string | null;
  adaptedQuestions: string[];
  contentRecommendationBias: ContentPreference[];
  emotionalContext: string | null;
  journeyStage: string;
}

// ─── Topic Taxonomy ───────────────────────────────────────────────────────────

const JCTM_TOPIC_KEYWORDS: Record<string, string[]> = {
  holiness: ["holiness", "holy", "sanctification", "purity", "consecration"],
  salvation: ["saved", "salvation", "born again", "repentance", "grace"],
  prayer: ["prayer", "pray", "intercession", "fasting"],
  baptism: ["baptism", "water baptism", "immersion"],
  "holy spirit": ["holy spirit", "tongues", "gifts", "spirit baptism"],
  prophecy: ["prophecy", "prophet", "prophetic", "vision"],
  "correction mandate": ["correction mandate", "five errors", "prosperity gospel", "doctrine"],
  healing: ["healing", "miracle", "deliverance", "sick"],
  marriage: ["marriage", "husband", "wife", "family", "children"],
  "end times": ["end times", "rapture", "tribulation", "last days"],
  "bible study": ["bible study", "scripture", "word of god", "passage"],
  "spiritual warfare": ["warfare", "devil", "enemy", "spiritual battle"],
  "primitive christianity": ["primitive christianity", "early church", "acts 2", "apostolic"],
  giving: ["tithe", "giving", "offering", "seed", "financial"],
  "church history": ["history", "timeline", "jctm story", "founding"],
};

function detectTopics(text: string): string[] {
  const lower = text.toLowerCase();
  const detected: string[] = [];
  for (const [topic, keywords] of Object.entries(JCTM_TOPIC_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) detected.push(topic);
  }
  return detected;
}

// ─── Session Store ────────────────────────────────────────────────────────────

const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const MAX_SESSIONS = 1000;
const sessions = new Map<string, SessionProfile>();

function createSession(sessionId: string): SessionProfile {
  return {
    sessionId,
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
    messageCount: 0,
    topicInterests: new Map(),
    contentPreferences: new Map(),
    detectedName: null,
    spiritualMaturity: "seeker",
    emotionalTrend: "stable",
    returnVisitor: false,
    questionsAsked: [],
    keyInsights: [],
  };
}

function evictSessions(): void {
  if (sessions.size < MAX_SESSIONS) return;
  const now = Date.now();
  // Remove expired sessions
  for (const [id, session] of sessions) {
    if (now - session.lastActiveAt > SESSION_TTL_MS) sessions.delete(id);
  }
  // If still over limit, remove oldest
  if (sessions.size >= MAX_SESSIONS) {
    const sorted = Array.from(sessions.entries())
      .sort(([, a], [, b]) => a.lastActiveAt - b.lastActiveAt);
    for (const [id] of sorted.slice(0, 50)) sessions.delete(id);
  }
}

export function getOrCreateSession(sessionId: string): SessionProfile {
  const now = Date.now();
  let session = sessions.get(sessionId);

  if (!session || now - session.lastActiveAt > SESSION_TTL_MS) {
    const isReturn = !!session;
    evictSessions();
    session = createSession(sessionId);
    session.returnVisitor = isReturn;
    sessions.set(sessionId, session);
  }

  session.lastActiveAt = now;
  return session;
}

// ─── Update Profile from Interaction ─────────────────────────────────────────

function detectName(text: string): string | null {
  const patterns = [
    /(?:my name is|i am|i'm|call me)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/i,
    /^([A-Z][a-z]+)\s+here\b/i,
    /this is\s+([A-Z][a-z]+)\b/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1] && match[1].length >= 2 && match[1].length <= 30) {
      return match[1];
    }
  }
  return null;
}

function inferSpiritualMaturity(
  session: SessionProfile,
  text: string,
): SpiritualMaturity {
  const lower = text.toLowerCase();
  const seekerSignals = ["new to faith", "just saved", "just gave my life", "i'm new", "first time", "don't know much"];
  const newBelieverSignals = ["recently saved", "few months", "baptized recently", "started reading bible"];
  const matureSignals = ["for many years", "been a christian", "decades", "seminary", "ministry", "pastor", "deacon", "elder"];

  if (seekerSignals.some(s => lower.includes(s))) return "seeker";
  if (newBelieverSignals.some(s => lower.includes(s))) return "new_believer";
  if (matureSignals.some(s => lower.includes(s))) return "mature";

  // Infer from topic depth and message count
  if (session.messageCount > 15 && session.topicInterests.size > 3) return "growing";
  if (session.messageCount > 30) return "mature";
  if (session.messageCount > 5) return "growing";
  return session.spiritualMaturity;
}

function detectKeyInsight(text: string): string | null {
  const patterns = [
    { re: /i'm\s+(?:struggling with|dealing with|going through)\s+(.{10,60})/i, prefix: "Struggling with" },
    { re: /i\s+need\s+prayer\s+for\s+(.{10,60})/i, prefix: "Needs prayer for" },
    { re: /i\s+was\s+(?:healed|delivered|saved|restored)\s+(?:from\s+)?(.{5,60})/i, prefix: "Testimony" },
    { re: /my\s+(?:husband|wife|child|son|daughter|father|mother|family)\s+(.{5,60})/i, prefix: "Family concern" },
  ];
  for (const { re, prefix } of patterns) {
    const match = text.match(re);
    if (match?.[1]) return `${prefix}: ${match[1].trim().slice(0, 80)}`;
  }
  return null;
}

export function updateSessionFromMessage(
  sessionId: string,
  userMessage: string,
): void {
  const session = getOrCreateSession(sessionId);
  session.messageCount++;
  session.lastActiveAt = Date.now();

  // Detect name
  const name = detectName(userMessage);
  if (name && !session.detectedName) session.detectedName = name;

  // Update topic interests
  const topics = detectTopics(userMessage);
  const now = Date.now();
  for (const topic of topics) {
    const existing = session.topicInterests.get(topic);
    if (existing) {
      existing.mentionCount++;
      existing.lastMentioned = now;
      existing.affinity = Math.min(1.0, existing.affinity + 0.1);
    } else {
      session.topicInterests.set(topic, {
        topic,
        mentionCount: 1,
        lastMentioned: now,
        affinity: 0.3,
      });
    }
  }

  // Track questions
  if (userMessage.includes("?") && userMessage.length > 10) {
    session.questionsAsked.push(userMessage.slice(0, 100));
    if (session.questionsAsked.length > 20) session.questionsAsked.shift();
  }

  // Detect key insights
  const insight = detectKeyInsight(userMessage);
  if (insight && !session.keyInsights.includes(insight)) {
    session.keyInsights.push(insight);
    if (session.keyInsights.length > 10) session.keyInsights.shift();
  }

  // Update spiritual maturity
  session.spiritualMaturity = inferSpiritualMaturity(session, userMessage);
}

// ─── Build Personalization Context ───────────────────────────────────────────

const DEPTH_QUESTIONS: Record<SpiritualMaturity, Record<string, string[]>> = {
  seeker: {
    default: [
      "Who is Jesus Christ and why does it matter?",
      "What does it mean to be saved or born again?",
      "How do I know if I am truly a Christian?",
    ],
    holiness: ["What does the Bible mean when it says 'be holy'?", "Is holiness possible for a regular person?"],
    prayer: ["How do I start praying if I'm new to it?", "Does God really hear my prayers?"],
  },
  new_believer: {
    default: [
      "What should I be doing now that I'm saved?",
      "How do I read the Bible effectively?",
      "What is water baptism and should I do it?",
    ],
    holiness: ["What practical steps help me grow in holiness?", "How do I overcome habitual sin?"],
    prayer: ["What is the Lord's Prayer teaching me?", "How long should I pray each day?"],
  },
  growing: {
    default: [
      "What does JCTM teach about the five-fold ministry?",
      "How does the Correction Mandate apply to my local church?",
      "What is the biblical basis for speaking in tongues?",
    ],
    holiness: ["How does holiness relate to grace — are they in conflict?", "What is doctrinal purity?"],
    prayer: ["What is intercession and how do I grow in it?", "How do I pray during spiritual warfare?"],
  },
  mature: {
    default: [
      "How do I identify and expose false prophets biblically?",
      "What does Primitive Christianity look like in a modern local church context?",
      "How should I disciple new believers in the Correction Mandate?",
    ],
    holiness: ["How do I teach holiness without it becoming legalism?", "What is the role of the Holy Spirit in sanctification?"],
    prayer: ["How do I lead corporate intercession effectively?", "What is the Daniel Model of prayer?"],
  },
};

function getAdaptedQuestions(session: SessionProfile): string[] {
  const maturity = session.spiritualMaturity;
  const topTopics = Array.from(session.topicInterests.values())
    .sort((a, b) => b.affinity - a.affinity)
    .slice(0, 2)
    .map(t => t.topic);

  const questionPool = DEPTH_QUESTIONS[maturity];
  const questions: string[] = [];

  for (const topic of topTopics) {
    const topicQs = questionPool[topic];
    if (topicQs) questions.push(...topicQs.slice(0, 1));
  }

  questions.push(...(questionPool["default"] ?? []).slice(0, 3 - questions.length));
  return questions.slice(0, 3);
}

function buildGreeting(session: SessionProfile): string | null {
  if (!session.returnVisitor && session.messageCount <= 1) return null;
  if (session.detectedName) {
    if (session.returnVisitor) return `Welcome back, ${session.detectedName}!`;
    return null;
  }
  return null;
}

function getJourneyStage(maturity: SpiritualMaturity): string {
  const stages: Record<SpiritualMaturity, string> = {
    seeker: "Exploring faith",
    new_believer: "New in Christ",
    growing: "Growing in the Word",
    mature: "Established in the faith",
  };
  return stages[maturity];
}

export function buildPersonalizationContext(sessionId: string): PersonalizationContext {
  const session = getOrCreateSession(sessionId);

  const dominantTopics = Array.from(session.topicInterests.values())
    .sort((a, b) => b.affinity - a.affinity)
    .slice(0, 3)
    .map(t => t.topic);

  const suggestedDepth: PersonalizationContext["suggestedDepth"] =
    session.spiritualMaturity === "seeker" ? "introductory"
      : session.spiritualMaturity === "new_believer" ? "introductory"
        : session.spiritualMaturity === "growing" ? "intermediate"
          : "deep";

  const contentBias: ContentPreference[] = ["sermons", "blog", "devotionals", "prayer", "events"];

  const emotionalContext = session.keyInsights.length > 0
    ? session.keyInsights[session.keyInsights.length - 1] ?? null
    : null;

  return {
    sessionId,
    dominantTopics,
    spiritualMaturity: session.spiritualMaturity,
    suggestedDepth,
    personalizedGreeting: buildGreeting(session),
    adaptedQuestions: getAdaptedQuestions(session),
    contentRecommendationBias: contentBias,
    emotionalContext,
    journeyStage: getJourneyStage(session.spiritualMaturity),
  };
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

setInterval(() => {
  const now = Date.now();
  let removed = 0;
  for (const [id, session] of sessions) {
    if (now - session.lastActiveAt > SESSION_TTL_MS) {
      sessions.delete(id);
      removed++;
    }
  }
}, 30 * 60 * 1000).unref();

export function getSessionCount(): number {
  return sessions.size;
}

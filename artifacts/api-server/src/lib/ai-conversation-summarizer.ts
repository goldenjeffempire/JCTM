/**
 * AI Conversation Summarizer — JCTM TempleBots v4
 *
 * When a conversation grows long (>20 messages), the oldest messages are
 * summarized into a compact context block so:
 *  - The user's journey in the conversation is preserved
 *  - OpenAI context window stays efficient
 *  - Important personal details (name, prayer needs, spiritual questions) are retained
 *
 * Summarization is extractive (keyword/pattern-based) — no external API calls.
 * A summary is injected as a system-level block in the conversation history.
 */

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SummarizationResult {
  recentMessages: ConversationMessage[];  // Last N messages to keep verbatim
  summaryBlock: string | null;            // Compact summary of earlier messages
  totalSummarized: number;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const VERBATIM_KEEP = 10;      // Always keep last 10 messages verbatim
const SUMMARIZE_THRESHOLD = 20; // Summarize when history > 20 messages

// ─── Extractive Summarizer ────────────────────────────────────────────────────

const NAME_PATTERN = /(?:my name is|i am|i'm|call me)\s+([A-Z][a-z]{1,29}(?:\s[A-Z][a-z]{1,29})?)/i;
const PRAYER_PATTERN = /(?:pray for|prayer request|i need prayer|intercede)\s+(?:about|for|regarding)?\s*(.{10,120})/i;
const STRUGGLE_PATTERN = /i(?:'m| am)\s+(?:struggling|dealing|going through|suffering|facing)\s+(?:with\s+)?(.{10,100})/i;
const TOPIC_PATTERNS = [
  /(?:question about|asking about|want to know about|interested in)\s+(.{5,80})/i,
  /(?:tell me about|what is|explain)\s+(.{5,80})/i,
];

interface ExtractedSignals {
  name: string | null;
  prayerNeeds: string[];
  struggles: string[];
  topicsDiscussed: string[];
  questionCount: number;
  messageCount: number;
}

function extractSignals(messages: ConversationMessage[]): ExtractedSignals {
  const signals: ExtractedSignals = {
    name: null,
    prayerNeeds: [],
    struggles: [],
    topicsDiscussed: [],
    questionCount: 0,
    messageCount: messages.length,
  };

  for (const msg of messages) {
    if (msg.role !== "user") continue;
    const content = msg.content;

    if (!signals.name) {
      const nameMatch = content.match(NAME_PATTERN);
      if (nameMatch?.[1]) signals.name = nameMatch[1].trim();
    }

    const prayerMatch = content.match(PRAYER_PATTERN);
    if (prayerMatch?.[1]) {
      const need = prayerMatch[1].trim().slice(0, 100);
      if (!signals.prayerNeeds.includes(need)) signals.prayerNeeds.push(need);
    }

    const struggleMatch = content.match(STRUGGLE_PATTERN);
    if (struggleMatch?.[1]) {
      const struggle = struggleMatch[1].trim().slice(0, 100);
      if (!signals.struggles.includes(struggle)) signals.struggles.push(struggle);
    }

    for (const pattern of TOPIC_PATTERNS) {
      const topicMatch = content.match(pattern);
      if (topicMatch?.[1]) {
        const topic = topicMatch[1].trim().slice(0, 80);
        if (!signals.topicsDiscussed.includes(topic)) signals.topicsDiscussed.push(topic);
      }
    }

    if (content.includes("?")) signals.questionCount++;
  }

  return signals;
}

function buildSummaryBlock(
  messages: ConversationMessage[],
  signals: ExtractedSignals,
): string {
  const parts: string[] = [
    `[EARLIER CONVERSATION SUMMARY — ${signals.messageCount} messages]`,
  ];

  if (signals.name) parts.push(`User's name: ${signals.name}`);
  if (signals.prayerNeeds.length > 0) {
    parts.push(`Prayer needs mentioned: ${signals.prayerNeeds.slice(0, 3).join("; ")}`);
  }
  if (signals.struggles.length > 0) {
    parts.push(`Personal struggles shared: ${signals.struggles.slice(0, 2).join("; ")}`);
  }
  if (signals.topicsDiscussed.length > 0) {
    parts.push(`Topics explored: ${signals.topicsDiscussed.slice(0, 5).join(", ")}`);
  }

  // Include the last user question from the summarized batch as context anchor
  const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
  if (lastUserMsg && lastUserMsg.content.length > 20) {
    parts.push(`Last question before this summary: "${lastUserMsg.content.slice(0, 150)}..."`);
  }

  parts.push(`[Continue naturally from here — the user is already engaged in this conversation]`);

  return parts.join("\n");
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function summarizeConversation(
  history: ConversationMessage[],
): SummarizationResult {
  if (history.length <= SUMMARIZE_THRESHOLD) {
    return {
      recentMessages: history,
      summaryBlock: null,
      totalSummarized: 0,
    };
  }

  const olderMessages = history.slice(0, history.length - VERBATIM_KEEP);
  const recentMessages = history.slice(-VERBATIM_KEEP);

  const signals = extractSignals(olderMessages);
  const summaryBlock = buildSummaryBlock(olderMessages, signals);

  return {
    recentMessages,
    summaryBlock,
    totalSummarized: olderMessages.length,
  };
}

// ─── Build Augmented History for OpenAI ──────────────────────────────────────
// Prepends the summary as a synthetic assistant message so OpenAI
// understands the historical context without needing the full message log.

export function buildAugmentedHistory(
  history: ConversationMessage[],
): ConversationMessage[] {
  const result = summarizeConversation(history);

  if (!result.summaryBlock) return history;

  return [
    { role: "assistant", content: result.summaryBlock },
    ...result.recentMessages,
  ];
}

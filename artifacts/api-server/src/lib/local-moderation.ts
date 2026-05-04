/**
 * Local Content Moderation Engine — Zero External API
 *
 * Provides:
 *  - Rule-based profanity/spam detection
 *  - Theological appropriateness check (no blasphemy)
 *  - Statistical spam signals (link density, repetition, etc.)
 *  - Behavioral anomaly detection
 *  - Content scoring with confidence
 *
 * Fully local — no external APIs, no model downloads required.
 */

// ─── Profanity & Inappropriate Content Signals ────────────────────────────────

const PROFANITY_PATTERNS: RegExp[] = [
  /\bf[*u][*c]k/i,
  /\bsh[*i]t/i,
  /\ba[*s]{2}/i,
  /\bb[*i]tch/i,
  /\bd[*a]mn\b/i,
  /\bcr[*a]p\b/i,
  /\bh[*e]ll\s/i,
];

const BLASPHEMY_PATTERNS: RegExp[] = [
  /jesus\s+is\s+(fake|lie|myth|fraud|devil|satan)/i,
  /god\s+(does not|doesn't|don't)\s+exist/i,
  /there\s+is\s+no\s+(god|jesus|christ)/i,
  /christianity\s+is\s+(fake|fraud|scam|lie)/i,
  /prophet\s+amos\s+is\s+(fake|fraud|false|scam)/i,
];

const SPAM_PATTERNS: RegExp[] = [
  /\b(buy now|click here|limited offer|act now|free money|earn \$)\b/i,
  /\b(casino|gambling|bet now|jackpot|lottery|prize|winner)\b/i,
  /\b(whatsapp me|telegram|dm me for|contact me for)\b/i,
  /\b(making money online|work from home|passive income|make \$\d+ daily)\b/i,
  /https?:\/\/[^\s]{40,}/,
  /\b(medication|pills|weight loss|diet|supplement|herbal)\b/i,
  /\b(hacker|hack|spy|track|monitor)\b/i,
];

const HATE_SPEECH_PATTERNS: RegExp[] = [
  /\b(kill|murder|destroy|eliminate)\s+(all\s+)?(christians?|muslims?|africans?|nigerians?)\b/i,
  /\b(all\s+)?(christians?|blacks?|nigerians?)\s+(are|should)\s+(die|suffer|burn)\b/i,
];

// ─── Spam Statistical Signals ─────────────────────────────────────────────────

function countUrls(text: string): number {
  return (text.match(/https?:\/\/\S+/gi) ?? []).length;
}

function countCaps(text: string): number {
  const upper = (text.match(/[A-Z]/g) ?? []).length;
  const total = (text.match(/[a-zA-Z]/g) ?? []).length;
  return total > 0 ? upper / total : 0;
}

function hasExcessiveRepetition(text: string): boolean {
  const words = text.toLowerCase().split(/\s+/);
  const freq: Record<string, number> = {};
  for (const w of words) freq[w] = (freq[w] ?? 0) + 1;
  const topCount = Math.max(...Object.values(freq));
  return words.length > 10 && topCount / words.length > 0.3;
}

function hasExcessiveEmoji(text: string): boolean {
  const emojiCount = (text.match(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27FF}]/gu) ?? []).length;
  return emojiCount > 10;
}

function hasPhoneOrEmailSpam(text: string): boolean {
  const phoneMatches = (text.match(/\b\d{10,11}\b/g) ?? []).length;
  const emailMatches = (text.match(/\b[a-z]+@[a-z]+\.[a-z]+\b/gi) ?? []).length;
  return phoneMatches > 2 || emailMatches > 3;
}

// ─── Moderation Result ────────────────────────────────────────────────────────

export type ModerationDecision = "approve" | "flag" | "reject";

export interface ModerationResult {
  decision: ModerationDecision;
  confidence: number;
  reasons: string[];
  flags: {
    profanity: boolean;
    spam: boolean;
    blasphemy: boolean;
    hatespeech: boolean;
    tooShort: boolean;
    tooLong: boolean;
  };
  score: number;
}

// ─── Core Moderation Function ─────────────────────────────────────────────────

export function moderateContent(
  text: string,
  options: {
    minLength?: number;
    maxLength?: number;
    context?: "testimony" | "prayer" | "comment" | "general";
  } = {},
): ModerationResult {
  const { minLength = 10, maxLength = 5000, context = "general" } = options;

  const reasons: string[] = [];
  let score = 0;
  const flags = {
    profanity: false,
    spam: false,
    blasphemy: false,
    hatespeech: false,
    tooShort: false,
    tooLong: false,
  };

  if (!text || text.trim().length < minLength) {
    flags.tooShort = true;
    reasons.push(`Content too short (minimum ${minLength} characters)`);
    score += 30;
  }

  if (text.length > maxLength) {
    flags.tooLong = true;
    reasons.push(`Content too long (maximum ${maxLength} characters)`);
    score += 20;
  }

  for (const pattern of PROFANITY_PATTERNS) {
    if (pattern.test(text)) {
      flags.profanity = true;
      reasons.push("Contains profane language");
      score += 40;
      break;
    }
  }

  for (const pattern of BLASPHEMY_PATTERNS) {
    if (pattern.test(text)) {
      flags.blasphemy = true;
      reasons.push("Contains content inappropriate for a Christian ministry platform");
      score += 80;
      break;
    }
  }

  for (const pattern of HATE_SPEECH_PATTERNS) {
    if (pattern.test(text)) {
      flags.hatespeech = true;
      reasons.push("Contains hate speech");
      score += 100;
      break;
    }
  }

  let spamSignals = 0;
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(text)) spamSignals++;
  }
  if (countUrls(text) > 2) spamSignals++;
  if (countCaps(text) > 0.5) { spamSignals++; reasons.push("Excessive capitalization"); }
  if (hasExcessiveRepetition(text)) { spamSignals++; reasons.push("Repetitive content"); }
  if (hasExcessiveEmoji(text)) { spamSignals++; reasons.push("Excessive emoji use"); }
  if (hasPhoneOrEmailSpam(text)) { spamSignals++; reasons.push("Suspicious contact information"); }

  if (spamSignals >= 2) {
    flags.spam = true;
    reasons.push("Content detected as spam");
    score += spamSignals * 20;
  }

  const confidence = Math.min(100, score) / 100;

  let decision: ModerationDecision;
  if (score >= 80) decision = "reject";
  else if (score >= 30) decision = "flag";
  else decision = "approve";

  return { decision, confidence, reasons, flags, score };
}

// ─── Batch Moderation ─────────────────────────────────────────────────────────

export interface BatchModerationResult {
  total: number;
  approved: number;
  flagged: number;
  rejected: number;
  results: Array<{ id: string; result: ModerationResult }>;
}

export function moderateBatch(
  items: Array<{ id: string; text: string }>,
  options?: Parameters<typeof moderateContent>[1],
): BatchModerationResult {
  const results = items.map(item => ({
    id: item.id,
    result: moderateContent(item.text, options),
  }));

  return {
    total: results.length,
    approved: results.filter(r => r.result.decision === "approve").length,
    flagged: results.filter(r => r.result.decision === "flag").length,
    rejected: results.filter(r => r.result.decision === "reject").length,
    results,
  };
}

// ─── Behavioral Anomaly Detection ─────────────────────────────────────────────

interface RequestRecord {
  timestamps: number[];
  uniqueContents: Set<string>;
}

const requestHistory = new Map<string, RequestRecord>();

const ANOMALY_RATE_WINDOW_MS = 60_000;
const ANOMALY_MAX_REQUESTS = 10;
const ANOMALY_MAX_DUPLICATE_RATIO = 0.5;

export interface AnomalyResult {
  isAnomaly: boolean;
  reasons: string[];
  riskLevel: "low" | "medium" | "high";
}

export function detectAnomaly(
  identifier: string,
  content: string,
): AnomalyResult {
  const now = Date.now();
  const reasons: string[] = [];

  if (!requestHistory.has(identifier)) {
    requestHistory.set(identifier, { timestamps: [], uniqueContents: new Set() });
  }

  const record = requestHistory.get(identifier)!;
  record.timestamps = record.timestamps.filter(t => now - t < ANOMALY_RATE_WINDOW_MS);
  record.timestamps.push(now);
  record.uniqueContents.add(content.slice(0, 100));

  if (record.timestamps.length > ANOMALY_MAX_REQUESTS) {
    reasons.push(`High request rate: ${record.timestamps.length} in 60 seconds`);
  }

  const duplicateRatio = 1 - record.uniqueContents.size / record.timestamps.length;
  if (record.timestamps.length >= 3 && duplicateRatio > ANOMALY_MAX_DUPLICATE_RATIO) {
    reasons.push(`Duplicate content detected (${Math.round(duplicateRatio * 100)}% repetition)`);
  }

  const isAnomaly = reasons.length > 0;
  const riskLevel: "low" | "medium" | "high" =
    reasons.length >= 2 ? "high" : reasons.length === 1 ? "medium" : "low";

  return { isAnomaly, reasons, riskLevel };
}

setInterval(() => {
  const now = Date.now();
  for (const [id, record] of requestHistory.entries()) {
    record.timestamps = record.timestamps.filter(t => now - t < ANOMALY_RATE_WINDOW_MS);
    if (record.timestamps.length === 0) requestHistory.delete(id);
  }
}, 5 * 60_000).unref();

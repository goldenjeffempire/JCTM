/**
 * Sentiment & Emotion Recognition Engine — Multi-Dimensional Local Analysis
 *
 * Provides:
 *  - Primary emotion classification (8 categories)
 *  - Sentiment polarity (positive / neutral / negative) with intensity
 *  - Spiritual state assessment (seeking, distressed, joyful, doubting, etc.)
 *  - Crisis detection (suicidal ideation, severe distress)
 *  - Urgency scoring for pastoral response prioritization
 *  - Contextual language detection (Nigerian English, pidgin patterns)
 *
 * Fully local — zero external API calls.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type PrimaryEmotion =
  | "joy"
  | "gratitude"
  | "grief"
  | "anxiety"
  | "anger"
  | "doubt"
  | "hope"
  | "neutral";

export type SentimentPolarity = "positive" | "neutral" | "negative";

export type SpiritualState =
  | "seeking"
  | "growing"
  | "distressed"
  | "doubting"
  | "joyful"
  | "interceding"
  | "grateful"
  | "neutral";

export type UrgencyLevel = "critical" | "high" | "medium" | "low";

export interface SentimentResult {
  primaryEmotion: PrimaryEmotion;
  emotionConfidence: number;
  polarity: SentimentPolarity;
  polarityScore: number;    // -1.0 to +1.0
  intensity: number;        // 0.0 to 1.0
  spiritualState: SpiritualState;
  urgencyLevel: UrgencyLevel;
  crisisDetected: boolean;
  crisisSignals: string[];
  detectedEmotions: Array<{ emotion: PrimaryEmotion; score: number }>;
  needsPastoralCare: boolean;
  suggestedResponseTone: "celebratory" | "compassionate" | "directive" | "gentle" | "balanced";
  languageStyle: "formal" | "informal" | "pidgin" | "mixed";
  wordCount: number;
  analysisTimeMs: number;
}

// ─── Lexicons ─────────────────────────────────────────────────────────────────

const JOY_SIGNALS = [
  "praise", "hallelujah", "glory", "blessed", "thankful", "wonderful",
  "amazing", "joy", "happy", "rejoice", "celebrate", "victory", "amen",
  "overflow", "excited", "breakthrough", "healed", "delivered", "grateful",
  "answered prayer", "miracle", "testimony", "good news", "thank you lord",
  "thank god", "god is good", "his faithfulness", "overflow", "prosper",
];

const GRIEF_SIGNALS = [
  "grief", "grieve", "grieving", "loss", "lost", "death", "died", "passed away",
  "mourning", "heartbroken", "broken heart", "devastated", "shattered",
  "depressed", "depression", "hopeless", "hopelessness", "empty", "hollow",
  "can't go on", "no hope", "pointless", "meaningless", "weeping", "crying",
  "tears", "pain", "hurting", "hurt", "wounded", "alone", "lonely",
];

const ANXIETY_SIGNALS = [
  "anxious", "anxiety", "worried", "worry", "worrying", "afraid", "fear",
  "scared", "frightened", "nervous", "panic", "panicking", "dread", "dreading",
  "overwhelmed", "stressed", "stress", "burden", "heavy", "uncertain",
  "don't know what to do", "confused", "what will happen", "what if",
  "terrified", "apprehensive", "uneasy", "restless", "can't sleep",
];

const ANGER_SIGNALS = [
  "angry", "anger", "furious", "rage", "mad", "frustrated", "frustrating",
  "betrayed", "betrayal", "cheated", "lied to", "liar", "unfair", "unjust",
  "bitter", "bitterness", "resentful", "resentment", "hate", "offended",
  "wronged", "abused", "mistreated", "hurt by", "they hurt", "they lied",
];

const DOUBT_SIGNALS = [
  "doubt", "doubting", "doubts", "not sure", "questioning", "confused about",
  "don't believe", "lost faith", "faith is weak", "why would god", "where is god",
  "god doesn't care", "does god exist", "backsliding", "left the church",
  "given up", "no longer believe", "struggling with faith", "can't believe",
  "why me", "why this", "god is silent", "prayer not working",
];

const HOPE_SIGNALS = [
  "hoping", "hope", "believe", "faith", "trust in god", "prayer will work",
  "god will provide", "standing in faith", "believing for", "waiting on god",
  "holding on", "not giving up", "determined", "pressing on", "keep praying",
  "i know god", "i believe", "god is able", "nothing too hard",
];

const GRATITUDE_SIGNALS = [
  "thank you", "grateful", "gratitude", "thankful", "appreciation", "appreciate",
  "blessed", "favor", "provision", "god provided", "answered", "came through",
  "faithfulness", "goodness", "mercy", "grace received", "testimony",
  "god has been good", "i am grateful", "cannot thank", "forever grateful",
];

const CRISIS_SIGNALS = [
  "want to die", "wants to die", "kill myself", "suicidal", "suicide",
  "end my life", "not worth living", "no reason to live", "give up on life",
  "don't want to live", "can't go on", "ending it all", "better off dead",
  "nobody cares if i die", "wish i was dead", "thinking about suicide",
];

const SPIRITUAL_SEEKING = [
  "how do i", "how can i", "what does the bible say", "what does god say",
  "looking for", "searching for", "seeking", "need guidance", "need help",
  "want to learn", "want to understand", "explain", "teach me", "show me",
  "new to faith", "just saved", "want to know god", "new believer",
];

const NIGERIAN_PIDGIN = [
  "e don happen", "na so", "make e", "i no", "wetin", "wahala",
  "na wa", "no be small", "abeg", "oga", "madam", "e sweet",
  "i hail", "correct", "e reach", "nothing do you",
];

// ─── Scorer ───────────────────────────────────────────────────────────────────

function scoreSignals(text: string, signals: string[]): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const signal of signals) {
    if (lower.includes(signal)) {
      score += signal.split(" ").length > 1 ? 2 : 1; // phrases score higher
    }
  }
  return score;
}

function normScore(raw: number, maxExpected: number): number {
  return Math.min(1.0, raw / Math.max(1, maxExpected));
}

// ─── Main Analysis Function ───────────────────────────────────────────────────

export function analyzeSentiment(text: string): SentimentResult {
  const start = Date.now();
  const wordCount = text.trim().split(/\s+/).length;

  // Score all emotion signals
  const joyScore = scoreSignals(text, JOY_SIGNALS);
  const griefScore = scoreSignals(text, GRIEF_SIGNALS);
  const anxietyScore = scoreSignals(text, ANXIETY_SIGNALS);
  const angerScore = scoreSignals(text, ANGER_SIGNALS);
  const doubtScore = scoreSignals(text, DOUBT_SIGNALS);
  const hopeScore = scoreSignals(text, HOPE_SIGNALS);
  const gratitudeScore = scoreSignals(text, GRATITUDE_SIGNALS);

  const raw: Record<PrimaryEmotion, number> = {
    joy: joyScore,
    grief: griefScore,
    anxiety: anxietyScore,
    anger: angerScore,
    doubt: doubtScore,
    hope: hopeScore,
    gratitude: gratitudeScore,
    neutral: 0.5,
  };

  // Find primary emotion
  let primaryEmotion: PrimaryEmotion = "neutral";
  let maxScore = 0;
  for (const [emotion, score] of Object.entries(raw) as Array<[PrimaryEmotion, number]>) {
    if (emotion !== "neutral" && score > maxScore) {
      maxScore = score;
      primaryEmotion = emotion;
    }
  }

  const total = Object.values(raw).reduce((s, v) => s + v, 0);
  const emotionConfidence = total > 0 ? maxScore / total : 0.3;

  // Sort all emotions by score
  const detectedEmotions = (Object.entries(raw) as Array<[PrimaryEmotion, number]>)
    .filter(([, s]) => s > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([emotion, score]) => ({ emotion, score: normScore(score, 5) }));

  // Polarity
  const positiveScore = joyScore + hopeScore + gratitudeScore;
  const negativeScore = griefScore + anxietyScore + angerScore + doubtScore;
  let polarity: SentimentPolarity = "neutral";
  let polarityScore = 0;

  if (positiveScore > negativeScore * 1.5) {
    polarity = "positive";
    polarityScore = Math.min(1, (positiveScore - negativeScore) / (positiveScore + 1));
  } else if (negativeScore > positiveScore * 1.5) {
    polarity = "negative";
    polarityScore = -Math.min(1, (negativeScore - positiveScore) / (negativeScore + 1));
  } else {
    polarityScore = (positiveScore - negativeScore) / (positiveScore + negativeScore + 1);
  }

  // Intensity (how emotionally loaded is the text)
  const intensity = Math.min(1, (maxScore + total * 0.1) / 6);

  // Crisis detection
  const crisisSignals: string[] = [];
  const lowerText = text.toLowerCase();
  for (const signal of CRISIS_SIGNALS) {
    if (lowerText.includes(signal)) crisisSignals.push(signal);
  }
  const crisisDetected = crisisSignals.length > 0;

  // Urgency
  let urgencyLevel: UrgencyLevel = "low";
  if (crisisDetected) urgencyLevel = "critical";
  else if (griefScore >= 4 || anxietyScore >= 4) urgencyLevel = "high";
  else if (negativeScore >= 3 || doubtScore >= 2) urgencyLevel = "medium";

  // Spiritual state
  const seekingScore = scoreSignals(text, SPIRITUAL_SEEKING);
  let spiritualState: SpiritualState = "neutral";
  if (crisisDetected || urgencyLevel === "critical") spiritualState = "distressed";
  else if (doubtScore >= 2) spiritualState = "doubting";
  else if (seekingScore >= 2) spiritualState = "seeking";
  else if (gratitudeScore >= 3 || joyScore >= 3) spiritualState = "grateful";
  else if (joyScore >= 2) spiritualState = "joyful";
  else if (hopeScore >= 2) spiritualState = "growing";
  else if (griefScore >= 2 || anxietyScore >= 2) spiritualState = "distressed";

  // Response tone
  let suggestedResponseTone: SentimentResult["suggestedResponseTone"] = "balanced";
  if (crisisDetected || urgencyLevel === "critical") suggestedResponseTone = "compassionate";
  else if (joyScore >= 3 || gratitudeScore >= 3) suggestedResponseTone = "celebratory";
  else if (doubtScore >= 2) suggestedResponseTone = "gentle";
  else if (seekingScore >= 2) suggestedResponseTone = "directive";
  else if (griefScore >= 2 || anxietyScore >= 2) suggestedResponseTone = "compassionate";

  // Language style
  const pidginScore = scoreSignals(text, NIGERIAN_PIDGIN);
  const informalScore = (text.match(/\b(ur|u r|lol|btw|omg|tbh|bruh|ngl|gonna|wanna|gotta)\b/gi) ?? []).length;
  let languageStyle: SentimentResult["languageStyle"] = "formal";
  if (pidginScore >= 2) languageStyle = "pidgin";
  else if (informalScore >= 2) languageStyle = "informal";
  else if (pidginScore === 1 && informalScore >= 1) languageStyle = "mixed";

  return {
    primaryEmotion,
    emotionConfidence: Math.max(0.3, emotionConfidence),
    polarity,
    polarityScore,
    intensity,
    spiritualState,
    urgencyLevel,
    crisisDetected,
    crisisSignals,
    detectedEmotions,
    needsPastoralCare: urgencyLevel === "critical" || urgencyLevel === "high" || doubtScore >= 2,
    suggestedResponseTone,
    languageStyle,
    wordCount,
    analysisTimeMs: Date.now() - start,
  };
}

// ─── Batch Analysis ───────────────────────────────────────────────────────────

export function analyzeBatch(texts: string[]): SentimentResult[] {
  return texts.map(t => analyzeSentiment(t));
}

// ─── Aggregate Sentiment (for prayer walls, testimonies, etc.) ────────────────

export interface AggregateSentiment {
  totalAnalyzed: number;
  dominantEmotion: PrimaryEmotion;
  overallPolarity: SentimentPolarity;
  crisisCount: number;
  emotionDistribution: Record<PrimaryEmotion, number>;
  avgIntensity: number;
  avgPolarityScore: number;
  needsAttentionCount: number;
}

export function aggregateSentiment(texts: string[]): AggregateSentiment {
  const results = analyzeBatch(texts);
  const emotionCounts: Record<PrimaryEmotion, number> = {
    joy: 0, gratitude: 0, grief: 0, anxiety: 0, anger: 0, doubt: 0, hope: 0, neutral: 0,
  };

  let totalPolarity = 0;
  let totalIntensity = 0;
  let crisisCount = 0;
  let needsAttentionCount = 0;

  for (const r of results) {
    emotionCounts[r.primaryEmotion]++;
    totalPolarity += r.polarityScore;
    totalIntensity += r.intensity;
    if (r.crisisDetected) crisisCount++;
    if (r.needsPastoralCare) needsAttentionCount++;
  }

  const dominantEmotion = (Object.entries(emotionCounts) as Array<[PrimaryEmotion, number]>)
    .sort(([, a], [, b]) => b - a)[0]?.[0] ?? "neutral";

  const avgPolarity = results.length > 0 ? totalPolarity / results.length : 0;
  const overallPolarity: SentimentPolarity =
    avgPolarity > 0.1 ? "positive" : avgPolarity < -0.1 ? "negative" : "neutral";

  return {
    totalAnalyzed: results.length,
    dominantEmotion,
    overallPolarity,
    crisisCount,
    emotionDistribution: emotionCounts,
    avgIntensity: results.length > 0 ? totalIntensity / results.length : 0,
    avgPolarityScore: avgPolarity,
    needsAttentionCount,
  };
}

/**
 * AI Safety Layer — JCTM TempleBots v4
 *
 * Multi-level safety system for the TempleBots AI pipeline:
 *
 *  1. Query moderation — detects and handles off-topic, harmful, or
 *     manipulative queries before they reach the LLM
 *  2. Response grounding — post-processes AI replies to detect and flag
 *     hallucinated sermon references, YouTube links, or event details
 *  3. Crisis detection — identifies mental health crises and ensures
 *     the response prioritises pastoral care and professional referral
 *
 * All checks are synchronous / cheap (regex-based). No external API calls.
 */

// ─── Query Safety Result ──────────────────────────────────────────────────────

export type SafetyLevel = "safe" | "redirect" | "crisis" | "blocked";

export interface QuerySafetyResult {
  level: SafetyLevel;
  reason: string | null;
  redirectResponse: string | null;  // Use this as the AI response when level != "safe"
  crisisType: string | null;
}

// ─── Crisis Detection ─────────────────────────────────────────────────────────

const CRISIS_PATTERNS: Array<{ type: string; patterns: RegExp[]; response: string }> = [
  {
    type: "suicidal_ideation",
    patterns: [
      /\b(want to (die|kill myself|end it|end my life)|thinking about (suicide|killing myself)|don'?t want to live|no reason to live|life is not worth|better off dead|planning to hurt myself|self.harm)\b/i,
      /\b(suicidal|suicide|end it all|can'?t go on|tired of (life|living|everything))\b/i,
    ],
    response: `I hear you, and I want you to know: you are precious in God's sight and in mine. What you're feeling right now is real and valid, and you don't have to carry it alone.

**Please reach out for immediate support:**
- 🇳🇬 **Nigeria:** Call or text the Mentally Aware Nigeria Initiative (MANI): **0800-CALL-MANI (08002255-6264)**
- 🌍 **International:** befrienders.org — find your local crisis line
- 📞 **JCTM Prayer Line:** Contact us directly at info@jctm.org.ng — we will pray with you personally

God's Word speaks directly to this moment: *"He heals the brokenhearted and binds up their wounds."* — Psalm 147:3

You are not alone. Please tell someone you trust where you are right now. I am here and I care deeply about you.`,
  },
  {
    type: "domestic_violence",
    patterns: [
      /\b(he is (hitting|beating|hurting|abusing) me|physical(ly)? abuse[d]?|domestic violence|he hurt(s)? me|scared of (my husband|my partner)|unsafe at home)\b/i,
    ],
    response: `Your safety matters more than anything else right now. What you're describing is not acceptable, and you deserve to be safe.

**Get help now:**
- 🇳🇬 **Nigeria:** National Domestic Violence Hotline: **0800-CALL-MANI**
- 🌍 **International:** thehotline.org

Please reach out to someone you trust — a family member, pastor, or neighbour. God sees you and He cares for you. *"The Lord is close to the broken-hearted and saves those who are crushed in spirit."* — Psalm 34:18

Contact JCTM: info@jctm.org.ng — we can connect you with pastoral support.`,
  },
];

// ─── Off-Topic Categories ─────────────────────────────────────────────────────

const OFF_TOPIC_RULES: Array<{ category: string; patterns: RegExp[]; redirect: string }> = [
  {
    category: "financial_scam",
    patterns: [
      /\b(cryptocurrency|bitcoin|ethereum|nft|forex|trading signal|investment scheme|ponzi|mlm multi.level|make money (online|fast)|passive income from)\b/i,
    ],
    redirect: `TempleBots focuses exclusively on ministry, faith, and the Word of God. For financial matters, please consult a qualified financial advisor. I am here to help you with your spiritual journey, questions about JCTM's teachings, or anything related to faith and the Bible. How can I serve you spiritually today?`,
  },
  {
    category: "politics",
    patterns: [
      /\b(vote for|political party|which candidate|pdp|apc|labour party nigeria|trump|biden|who should i vote|election result|political opinion)\b/i,
    ],
    redirect: `TempleBots doesn't weigh in on political matters. JCTM's mandate is spiritual — not political. I can help you with questions about faith, JCTM's teachings, scripture, prayer, or anything related to your walk with God. What can I help you with?`,
  },
  {
    category: "adult_content",
    patterns: [
      /\b(pornography?|porn|nude|naked|erotic|sexual content|xxx|adult (video|film|site))\b/i,
    ],
    redirect: `That topic falls outside what TempleBots can help with. I am here to support your spiritual journey with JCTM's teachings on holiness, the Word of God, and the Correction Mandate. Is there something about faith or ministry I can help you with?`,
  },
  {
    category: "technical_help",
    patterns: [
      /\b(debug (this|my) code|write (a |an )?(python|javascript|react|sql|typescript)|fix my (code|script|program)|programming (help|question)|compile error|api (request|call)|github|docker|kubernetes)\b/i,
    ],
    redirect: `TempleBots is a ministry AI assistant — I focus on faith, scripture, JCTM teachings, and spiritual support. For technical or programming help, you may want to use a general-purpose AI tool. Is there something I can help you with spiritually?`,
  },
  {
    category: "medical_diagnosis",
    patterns: [
      /\b(diagnose (me|my)|what (disease|condition|illness) (do i|could i) have|medical diagnosis|is this (cancer|diabetes|hiv)|do i have|symptoms of\b.{0,40}\?)/i,
    ],
    redirect: `I am not qualified to give medical diagnoses — please consult a qualified medical professional for health concerns. I can, however, pray with you, share scriptures on healing, or point you to JCTM's teachings on divine healing. Would you like that?`,
  },
];

// ─── Query Safety Check ───────────────────────────────────────────────────────

export function checkQuerySafety(query: string): QuerySafetyResult {
  // 1. Crisis detection (highest priority)
  for (const crisis of CRISIS_PATTERNS) {
    if (crisis.patterns.some(p => p.test(query))) {
      return {
        level: "crisis",
        reason: crisis.type,
        redirectResponse: crisis.response,
        crisisType: crisis.type,
      };
    }
  }

  // 2. Off-topic redirect
  for (const rule of OFF_TOPIC_RULES) {
    if (rule.patterns.some(p => p.test(query))) {
      return {
        level: "redirect",
        reason: rule.category,
        redirectResponse: rule.redirect,
        crisisType: null,
      };
    }
  }

  return { level: "safe", reason: null, redirectResponse: null, crisisType: null };
}

// ─── Response Grounding Checker ───────────────────────────────────────────────
// Detects when the AI has fabricated YouTube links or sermon details.

const YOUTUBE_LINK_PATTERN = /https?:\/\/(?:www\.)?youtube\.com\/watch\?v=([\w-]{11})/g;
const FAKE_LINK_INDICATORS = [
  /watch\?v=XXXX/i,
  /watch\?v=12345/i,
  /watch\?v=ABCDEF/i,
  /watch\?v=example/i,
  /watch\?v=placeholder/i,
  /\[video_id\]/i,
  /\[youtube_id\]/i,
];

export interface GroundingResult {
  isGrounded: boolean;
  suspiciousLinks: string[];
  warnings: string[];
}

export function checkResponseGrounding(
  response: string,
  knownVideoIds: Set<string>,
): GroundingResult {
  const warnings: string[] = [];
  const suspiciousLinks: string[] = [];

  // Check for obviously fake placeholders
  for (const pattern of FAKE_LINK_INDICATORS) {
    if (pattern.test(response)) {
      warnings.push("Response contains a placeholder YouTube link — likely hallucinated");
      suspiciousLinks.push("placeholder-link");
    }
  }

  // Check that cited video IDs exist in the known set
  const matches = [...response.matchAll(YOUTUBE_LINK_PATTERN)];
  for (const match of matches) {
    const videoId = match[1]!;
    if (knownVideoIds.size > 0 && !knownVideoIds.has(videoId)) {
      warnings.push(`Cited video ID ${videoId} not found in known sermon database`);
      suspiciousLinks.push(match[0]!);
    }
  }

  return {
    isGrounded: warnings.length === 0,
    suspiciousLinks,
    warnings,
  };
}

// ─── Scripture Reference Extractor ───────────────────────────────────────────
// Pulls all scripture references cited in an AI response for structured display.

const SCRIPTURE_PATTERN =
  /\b(Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|(?:1|2)\s*Samuel|(?:1|2)\s*Kings|(?:1|2)\s*Chronicles|Ezra|Nehemiah|Esther|Job|Psalms?|Proverbs|Ecclesiastes|Song of Songs|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|(?:1|2)\s*Corinthians|Galatians|Ephesians|Philippians|Colossians|(?:1|2)\s*Thessalonians|(?:1|2)\s*Timothy|Titus|Philemon|Hebrews|James|(?:1|2|3)\s*John|(?:1|2)\s*Peter|Jude|Revelation)\s+\d+:\d+(?:-\d+)?/gi;

export function extractScriptureReferences(response: string): string[] {
  const matches = response.match(SCRIPTURE_PATTERN);
  if (!matches) return [];
  return Array.from(new Set(matches.map(m => m.trim())));
}

// ─── Manipulative Query Detection ─────────────────────────────────────────────
// Detects prompt injection attempts or attempts to override system instructions.

const MANIPULATION_PATTERNS = [
  /ignore (all )?(previous|prior|above) instructions/i,
  /you are (now|actually) (a|an) (different|evil|uncensored|unrestricted)/i,
  /disregard (your|the) (system|training|instructions|guidelines)/i,
  /act as (if you have no|without any) (restrictions|guidelines|training)/i,
  /jailbreak|dan mode|developer mode|unrestricted mode/i,
  /pretend you (are|were) (trained|designed) to/i,
];

export function detectManipulation(query: string): boolean {
  return MANIPULATION_PATTERNS.some(p => p.test(query));
}

export const MANIPULATION_RESPONSE =
  `I am TempleBots, the official AI assistant of Jesus Christ Temple Ministry. My purpose is to serve you with JCTM's teachings, pastoral support, and the Word of God. I operate within those boundaries because I exist to glorify God and serve His people — not for any other purpose. How can I help you spiritually today?`;

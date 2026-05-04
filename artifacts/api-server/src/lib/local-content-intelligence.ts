/**
 * Local Content Intelligence Engine — Zero External API
 *
 * Provides:
 *  - Extractive sermon summarization
 *  - Auto-tagging using JCTM topic taxonomy + TF-IDF
 *  - Auto-description generation from title/content
 *  - Context-aware categorization
 *  - Trending relevance scoring
 *
 * All processing is fully local — no external APIs required.
 */

// ─── JCTM Topic Taxonomy ──────────────────────────────────────────────────────

export const JCTM_TOPIC_TAXONOMY: Record<string, string[]> = {
  "correction-mandate": [
    "correction", "mandate", "divine assignment", "doctrinal correction", "false doctrine",
    "reform", "restoration", "error", "expose", "rebuke", "warning",
  ],
  "primitive-christianity": [
    "primitive", "apostolic", "first century", "original", "early church",
    "acts 2", "pentecost", "new testament", "unadulterated", "pure gospel",
  ],
  "holiness": [
    "holiness", "holy", "sanctification", "purity", "consecration",
    "separation", "righteousness", "without holiness", "set apart", "moral",
  ],
  "prosperity-gospel-exposed": [
    "prosperity", "wealth", "financial blessing", "seed faith", "hundredfold",
    "name it claim it", "word of faith", "health wealth", "tithe",
  ],
  "water-baptism": [
    "baptism", "immersion", "baptize", "baptismal", "full immersion",
    "buried with christ", "romans 6", "baptizo",
  ],
  "holy-spirit": [
    "holy spirit", "spirit baptism", "tongues", "speaking in tongues",
    "gifts of the spirit", "anointing", "pentecostal", "charismata",
  ],
  "five-fold-ministry": [
    "apostle", "prophet", "evangelist", "pastor", "teacher",
    "five fold", "fivefold", "ephesians 4", "ministry office",
  ],
  "salvation": [
    "salvation", "saved", "born again", "repentance", "redemption",
    "justification", "grace", "faith", "blood of jesus",
  ],
  "prayer": [
    "prayer", "intercession", "fasting", "petition", "supplication",
    "prayer warriors", "prayer meeting", "effectual prayer",
  ],
  "end-times": [
    "end time", "last days", "rapture", "second coming", "tribulation",
    "antichrist", "revelation", "apocalypse", "eschatology",
  ],
  "discipleship": [
    "discipleship", "disciple", "mentoring", "spiritual growth",
    "maturity", "christian living", "walking with god",
  ],
  "scripture": [
    "bible", "scripture", "word of god", "verse", "passage",
    "exegesis", "hermeneutics", "biblical", "genesis", "revelation",
  ],
  "worship": [
    "worship", "praise", "thanksgiving", "adoration", "glory",
    "singing", "service", "temple", "altar",
  ],
  "family-marriage": [
    "family", "marriage", "husband", "wife", "children", "parenting",
    "home", "divorce", "covenant marriage",
  ],
  "evangelism": [
    "evangelism", "outreach", "crusade", "soul winning", "missionary",
    "gospel", "preaching", "witness", "lost souls",
  ],
};

export const JCTM_CATEGORIES = [
  "doctrine",
  "holiness",
  "correction",
  "prayer",
  "evangelism",
  "discipleship",
  "worship",
  "prophecy",
  "scripture",
  "family",
  "ministry",
  "testimony",
];

// ─── Text Utilities ───────────────────────────────────────────────────────────

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(text: string): string[] {
  return normalizeText(text).split(" ").filter(t => t.length > 2);
}

function sentenceSplit(text: string): string[] {
  return text
    .replace(/([.!?])\s+/g, "$1\n")
    .split("\n")
    .map(s => s.trim())
    .filter(s => s.length > 20);
}

const STOP_WORDS = new Set([
  "the", "and", "is", "in", "at", "of", "to", "a", "an", "on", "for",
  "with", "this", "that", "are", "was", "be", "have", "has", "had",
  "it", "as", "by", "from", "or", "but", "not", "we", "you", "your",
  "our", "his", "her", "they", "their", "what", "which", "who", "will",
  "can", "all", "one", "more", "out", "up", "about", "than", "also",
  "into", "so", "if", "do", "did", "been", "were", "would", "could",
  "when", "where", "how", "just", "now", "may", "my", "him", "us",
]);

// ─── TF-IDF Scoring ───────────────────────────────────────────────────────────

function computeTfIdf(corpus: string[]): Map<string, number>[] {
  const N = corpus.length;
  const tokenizedCorpus = corpus.map(doc => tokenize(doc));

  const df: Record<string, number> = {};
  for (const tokens of tokenizedCorpus) {
    const unique = new Set(tokens);
    for (const t of unique) df[t] = (df[t] ?? 0) + 1;
  }

  return tokenizedCorpus.map(tokens => {
    const tf: Record<string, number> = {};
    for (const t of tokens) tf[t] = (tf[t] ?? 0) + 1;

    const scores = new Map<string, number>();
    for (const [term, count] of Object.entries(tf)) {
      const termFreq = count / tokens.length;
      const idf = Math.log((N + 1) / ((df[term] ?? 0) + 1)) + 1;
      scores.set(term, termFreq * idf);
    }
    return scores;
  });
}

// ─── Extractive Summarization ─────────────────────────────────────────────────

export interface SermonSummary {
  summary: string;
  bulletPoints: string[];
  keyThemes: string[];
  tags: string[];
  category: string;
  seoDescription: string;
  readingTimeMinutes: number;
}

export function summarizeSermon(
  title: string,
  description: string,
  transcriptOrContent?: string,
): SermonSummary {
  const fullText = [title, description, transcriptOrContent].filter(Boolean).join(" ");
  const sentences = sentenceSplit(description || title);
  const words = fullText.split(/\s+/).length;

  const tags = autoTag(fullText);
  const category = categorize(fullText);
  const keyThemes = extractKeyThemes(fullText);

  const summaryLines = sentences.slice(0, 3).join(" ");
  const summary = summaryLines || buildDescriptiveSummary(title, category, keyThemes);

  const bulletPoints = buildBulletPoints(title, description, keyThemes, tags);
  const seoDescription = buildSeoDescription(title, summary, tags);
  const readingTimeMinutes = Math.max(1, Math.ceil(words / 200));

  return {
    summary,
    bulletPoints,
    keyThemes,
    tags,
    category,
    seoDescription,
    readingTimeMinutes,
  };
}

function extractKeyThemes(text: string): string[] {
  const norm = normalizeText(text);
  const themes: string[] = [];

  for (const [topic, keywords] of Object.entries(JCTM_TOPIC_TAXONOMY)) {
    const matches = keywords.filter(kw => norm.includes(kw));
    if (matches.length >= 2) themes.push(topic);
  }

  return themes.slice(0, 5);
}

function buildDescriptiveSummary(title: string, category: string, themes: string[]): string {
  const themeStr = themes.length > 0
    ? ` covering themes of ${themes.slice(0, 2).join(" and ")}`
    : "";
  return `In this powerful teaching, Prophet Amos Evomobor delivers a message on ${title}${themeStr}. This sermon is grounded in Scripture and presented through the lens of the Correction Mandate — restoring primitive Christianity and sound doctrine to the Body of Christ.`;
}

function buildBulletPoints(
  title: string,
  description: string,
  themes: string[],
  tags: string[],
): string[] {
  const points: string[] = [];
  const norm = normalizeText(description || title);

  if (norm.includes("holy") || norm.includes("holiness")) {
    points.push("Explores the biblical standard of holiness as non-negotiable for believers");
  }
  if (norm.includes("correction") || norm.includes("mandate")) {
    points.push("Addresses the Correction Mandate: restoring doctrinal truth to the modern church");
  }
  if (norm.includes("baptism")) {
    points.push("Examines the significance of water baptism by full immersion");
  }
  if (norm.includes("spirit") || norm.includes("tongues")) {
    points.push("Teaches on the Holy Spirit baptism and its evidence in the believer's life");
  }
  if (norm.includes("prayer") || norm.includes("intercession")) {
    points.push("Encourages consistent, fervent prayer as the foundation of the Christian walk");
  }

  while (points.length < 3 && themes.length > 0) {
    const theme = themes[points.length];
    if (theme) {
      points.push(`Deep dive into ${theme.replace(/-/g, " ")} from a Primitive Christianity perspective`);
    } else {
      break;
    }
  }

  if (points.length < 3) {
    points.push("Scripturally grounded teaching rooted in the unadulterated gospel");
    points.push("Practical application for living a holy and consecrated life");
  }

  if (points.length < 5) {
    points.push("Presented by Prophet Amos Evomobor through Temple TV (JCTM)");
  }

  return points.slice(0, 5);
}

function buildSeoDescription(title: string, summary: string, tags: string[]): string {
  const tagStr = tags.slice(0, 3).join(", ");
  const desc = `${title} — JCTM sermon by Prophet Amos Evomobor. ${summary.slice(0, 80)}. Topics: ${tagStr}.`;
  return desc.slice(0, 155);
}

// ─── Auto-Tagging ─────────────────────────────────────────────────────────────

export function autoTag(text: string, maxTags = 8): string[] {
  const norm = normalizeText(text);
  const tagScores: Record<string, number> = {};

  for (const [tag, keywords] of Object.entries(JCTM_TOPIC_TAXONOMY)) {
    let score = 0;
    for (const kw of keywords) {
      if (norm.includes(kw)) {
        score += kw.split(" ").length > 1 ? 3 : 1;
      }
    }
    if (score > 0) tagScores[tag] = score;
  }

  const sorted = Object.entries(tagScores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, maxTags)
    .map(([tag]) => tag);

  if (sorted.length === 0) {
    sorted.push("sermon", "jctm", "prophet-amos");
  }

  return sorted;
}

// ─── Categorization ───────────────────────────────────────────────────────────

export function categorize(text: string): string {
  const norm = normalizeText(text);

  const categoryScores: Record<string, number> = {};
  for (const cat of JCTM_CATEGORIES) {
    categoryScores[cat] = 0;
  }

  const mappings: Array<{ cat: string; keywords: string[] }> = [
    { cat: "doctrine", keywords: ["doctrine", "theology", "teaching", "truth", "error", "correction", "heresy"] },
    { cat: "holiness", keywords: ["holy", "holiness", "sanctification", "purity", "consecration", "righteous"] },
    { cat: "correction", keywords: ["correction", "expose", "false", "rebuke", "warning", "mandate"] },
    { cat: "prayer", keywords: ["prayer", "intercession", "fasting", "pray", "supplication"] },
    { cat: "evangelism", keywords: ["evangelism", "outreach", "crusade", "soul winning", "preach", "witness"] },
    { cat: "discipleship", keywords: ["disciple", "discipleship", "growth", "maturity", "christian living"] },
    { cat: "worship", keywords: ["worship", "praise", "thanksgiving", "glory", "adoration"] },
    { cat: "prophecy", keywords: ["prophecy", "prophetic", "vision", "revelation", "foretell", "prophet"] },
    { cat: "scripture", keywords: ["bible", "scripture", "word of god", "verse", "exegesis"] },
    { cat: "family", keywords: ["family", "marriage", "husband", "wife", "children", "home"] },
    { cat: "ministry", keywords: ["ministry", "five fold", "apostle", "office", "calling", "servant"] },
    { cat: "testimony", keywords: ["testimony", "miracle", "healing", "witness", "saved", "deliverance"] },
  ];

  for (const { cat, keywords } of mappings) {
    for (const kw of keywords) {
      if (norm.includes(kw)) {
        categoryScores[cat] = (categoryScores[cat] ?? 0) + 1;
      }
    }
  }

  const best = Object.entries(categoryScores).sort(([, a], [, b]) => b - a)[0];
  return best && best[1] > 0 ? best[0] : "doctrine";
}

// ─── Caption/Description Generation ──────────────────────────────────────────

export function generateCaption(
  context: { title?: string; category?: string; tags?: string[] },
): string {
  const { title, category, tags } = context;
  const tagStr = (tags ?? []).slice(0, 2).join(" | ");
  const cat = category ?? "teaching";

  if (title) {
    return `📖 ${title} | ${cat.charAt(0).toUpperCase() + cat.slice(1)} | JCTM — Jesus Christ Temple Ministry${tagStr ? ` | ${tagStr}` : ""}`;
  }

  return `Powerful ${cat} from Jesus Christ Temple Ministry (JCTM), Warri Nigeria. Watch more on Temple TV @TEMPLETVJCTM`;
}

export function generateMediaDescription(
  context: { title?: string; category?: string; tags?: string[]; isVideo?: boolean },
): string {
  const { title, category, tags, isVideo } = context;
  const tagStr = (tags ?? []).slice(0, 3).join(", ");
  const mediaType = isVideo ? "sermon video" : "ministry content";

  return `${title ? `"${title}" — ` : ""}A ${mediaType} from Jesus Christ Temple Ministry (JCTM), the ministry of Prophet Amos Evomobor in Warri, Delta State, Nigeria. ${category ? `Category: ${category}. ` : ""}${tagStr ? `Topics covered: ${tagStr}. ` : ""}Watch more sermons on Temple TV at YouTube: @TEMPLETVJCTM. JCTM operates under the divine Correction Mandate to restore primitive Christianity and sound doctrine to the global church.`;
}

// ─── Trending/Relevance Scoring ───────────────────────────────────────────────

export interface TrendingScore {
  score: number;
  reasons: string[];
}

export function scoreTrending(item: {
  title: string;
  viewCount?: number;
  likeCount?: number;
  publishedAt?: Date | string;
  isFeatured?: boolean;
  commentCount?: number;
}): TrendingScore {
  let score = 0;
  const reasons: string[] = [];

  const ageDays = item.publishedAt
    ? (Date.now() - new Date(item.publishedAt).getTime()) / 86_400_000
    : 365;

  if (ageDays < 3) { score += 40; reasons.push("brand new"); }
  else if (ageDays < 7) { score += 30; reasons.push("very recent"); }
  else if (ageDays < 30) { score += 20; reasons.push("this month"); }
  else if (ageDays < 90) { score += 10; }

  const views = item.viewCount ?? 0;
  if (views > 50_000) { score += 30; reasons.push("viral"); }
  else if (views > 10_000) { score += 20; reasons.push("highly viewed"); }
  else if (views > 1_000) { score += 10; reasons.push("popular"); }
  else if (views > 100) { score += 5; }

  if (item.isFeatured) { score += 20; reasons.push("featured"); }

  const likes = item.likeCount ?? 0;
  if (likes > 1000) score += 10;
  else if (likes > 100) score += 5;

  const comments = item.commentCount ?? 0;
  if (comments > 100) score += 5;

  const norm = normalizeText(item.title);
  const hotKeywords = ["correction mandate", "holiness", "sunday service", "live", "crusade", "prophetic"];
  for (const kw of hotKeywords) {
    if (norm.includes(kw)) { score += 5; reasons.push(`keyword: ${kw}`); }
  }

  return { score, reasons };
}

// ─── Smart Keyword Extraction ─────────────────────────────────────────────────

export function extractKeywords(text: string, topN = 10): string[] {
  const tokens = tokenize(text).filter(t => !STOP_WORDS.has(t));
  const freq: Record<string, number> = {};
  for (const t of tokens) freq[t] = (freq[t] ?? 0) + 1;

  return Object.entries(freq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, topN)
    .map(([term]) => term);
}

// ─── Blog Content Generation ──────────────────────────────────────────────────

const BLOG_TEMPLATES: Record<string, (title: string, sermonContext: string) => string> = {
  doctrine: (title, ctx) => `
<h2>The Biblical Foundation</h2>
<p>Scripture is unambiguous on this matter. Jesus Christ Temple Ministry (JCTM), under the prophetic leadership of Prophet Amos Evomobor, has long championed the teaching that ${title.toLowerCase()} is not a peripheral concern but a central pillar of authentic Christian faith.</p>
<p>The Apostle Paul warned in 2 Timothy 4:3-4 that a time would come when people would "not endure sound doctrine." We are living in that time — and the Correction Mandate of JCTM is God's response to this crisis.</p>
<h2>What the Modern Church Has Lost</h2>
<p>Centuries of tradition, cultural accommodation, and theological compromise have obscured the original teachings of the apostolic church. JCTM calls believers back to Primitive Christianity — the faith as it was delivered to the saints in the first century (Jude 1:3).</p>
${ctx ? `<h2>From the Temple TV Pulpit</h2><p>${ctx}</p>` : ""}
<h2>Practical Steps for Every Believer</h2>
<p>True reformation begins in the individual heart before it transforms communities. Prophet Amos teaches that the first step is always a return to Scripture — reading the Word not through the lens of tradition but through the Holy Spirit's illumination.</p>
<h2>Conclusion</h2>
<p>The question is not whether the Bible speaks to this issue — it does, clearly. The question is whether we will have the courage to obey. Watch Prophet Amos Evomobor teach on this and related topics on Temple TV at <strong>YouTube: @TEMPLETVJCTM</strong>.</p>
`,
  holiness: (title, ctx) => `
<h2>Why Holiness Cannot Be Optional</h2>
<p>Hebrews 12:14 states it plainly: "Without holiness, no man shall see the Lord." This is not a suggestion, a theological preference, or a cultural relic. It is an eternal condition set by God Himself for fellowship with Him.</p>
<p>Jesus Christ Temple Ministry under Prophet Amos Evomobor has consistently and boldly proclaimed this truth at a time when many churches have abandoned the call to holy living.</p>
<h2>What Holiness Actually Means</h2>
<p>Holiness is not about external rules or religious performance. It is about the inner transformation of the heart that produces an outward change in conduct. The Greek word <em>hagios</em> — "holy" — means set apart, consecrated, dedicated to God alone.</p>
${ctx ? `<h2>Prophet Amos on Holiness</h2><p>${ctx}</p>` : ""}
<h2>Common Misconceptions</h2>
<p>The claim that "holiness is legalism" is perhaps the most dangerous lie in the modern church. JCTM identifies this as one of the key strategies the enemy uses to disarm believers. The New Testament church did not see holiness as oppressive — they saw it as the natural fruit of a transformed life.</p>
<h2>Living Holy in Today's World</h2>
<p>1 Peter 1:15-16 commands: "But just as he who called you is holy, so be holy in all you do; for it is written: 'Be holy, because I am holy.'"</p>
<p>Discover more on holy living by watching Temple TV sermons at <strong>YouTube: @TEMPLETVJCTM</strong>.</p>
`,
  correction: (title, ctx) => `
<h2>Understanding the Correction Mandate</h2>
<p>Jesus Christ Temple Ministry (JCTM) was founded with a specific divine assignment: to expose and correct the five major errors that have infiltrated modern Christianity. This is not a self-appointed mission — it is, as Prophet Amos Evomobor testifies, a God-given mandate confirmed by Scripture, prayer, and prophetic revelation.</p>
<h2>The Five Areas of Correction</h2>
<p><strong>1. The Prosperity Gospel</strong> — Teaching that God always wills financial wealth for believers is a distortion of Scripture that preys on the vulnerable (1 Timothy 6:5-10).</p>
<p><strong>2. Prophetic Manipulation</strong> — False prophets who exploit spiritual gifts for financial gain are condemned throughout the Old and New Testaments (Jeremiah 23:16-17).</p>
<p><strong>3. Apostolic Abuse</strong> — Self-appointed "apostles" claiming divine authority without genuine calling mislead multitudes (2 Corinthians 11:13-15).</p>
<p><strong>4. Sacramental Corruption</strong> — The distortion of water baptism and communion from their New Testament meaning has deep consequences for believers (Romans 6:3-4).</p>
<p><strong>5. Dangerous Ecumenism</strong> — Unity at the cost of truth is not biblical unity (2 Corinthians 6:14-17).</p>
${ctx ? `<h2>Scriptural Evidence</h2><p>${ctx}</p>` : ""}
<h2>The Call to Respond</h2>
<p>Jeremiah 6:16 says: "Stand in the ways and see, and ask for the old paths, where the good way is, and walk in it." JCTM invites every believer to return to those old paths. Watch full teachings at <strong>Temple TV: @TEMPLETVJCTM</strong>.</p>
`,
  default: (title, ctx) => `
<h2>Introduction</h2>
<p>The teachings of Jesus Christ Temple Ministry (JCTM), under Prophet Amos Evomobor, have impacted thousands of believers worldwide through a consistent commitment to sound doctrine, holiness, and the unadulterated gospel of Jesus Christ.</p>
<h2>Scriptural Grounding</h2>
<p>Every teaching at JCTM begins and ends with Scripture. The Bible — not tradition, not culture, not personal opinion — is the supreme authority for all matters of faith and practice (2 Timothy 3:16-17).</p>
${ctx ? `<h2>From Recent Sermons</h2><p>${ctx}</p>` : ""}
<h2>The JCTM Mission</h2>
<p>JCTM's Correction Mandate is a prophetic call to bring the modern church back to its apostolic roots. This ministry preaches without compromise, corrects without apology, and loves without favoritism.</p>
<h2>Watch and Learn</h2>
<p>Explore hundreds of sermons and teachings by Prophet Amos Evomobor on Temple TV at <strong>YouTube: @TEMPLETVJCTM</strong>. Subscribe to stay connected with fresh ministry content.</p>
`,
};

export function generateBlogContent(
  title: string,
  category: string,
  sermonContext = "",
): { content: string; excerpt: string } {
  const template = BLOG_TEMPLATES[category] ?? BLOG_TEMPLATES["default"]!;
  const content = template(title, sermonContext).trim();

  const firstParagraph = content.replace(/<[^>]+>/g, "").split("\n").find(l => l.trim().length > 50) ?? "";
  const excerpt = firstParagraph.slice(0, 200).trim();

  return { content, excerpt };
}

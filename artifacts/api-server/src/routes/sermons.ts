import { Router, type IRouter } from "express";
import { eq, desc, ilike, or, sql } from "drizzle-orm";
import { db, sermonsTable } from "@workspace/db";
import {
  ListSermonsQueryParams,
  ListSermonsResponse,
  GetSermonParams,
  GetSermonResponse,
  GetFeaturedSermonResponse,
  GetSermonStatsResponse,
  SyncSermonsResponse,
} from "@workspace/api-zod";
import { syncIncremental, harvestAll, iso8601ToSeconds, QuotaExceededError } from "../lib/youtube-sync.js";
import { syncFromRSS } from "../lib/rss-sync.js";
import { isQuotaPaused, getQuotaResetTime, setQuotaPaused, getCronState } from "../lib/cron.js";
import { sseBroadcaster } from "../lib/sse-broadcaster.js";
import { randomUUID } from "crypto";
import { openai } from "@workspace/integrations-openai-ai-server";
import { requireAdminRole } from "../lib/adminAuth.js";

// ── In-memory sermon summary cache (survives restarts only in dev) ─────────────
const summaryCache = new Map<number, { summary: string; keyPoints: string[]; generatedAt: string }>();

const router: IRouter = Router();

const PINNED_INTRO_TITLES = new Set([
  "the generation of the evil one and the generation of the saint",
]);

type SermonTeachingPoint = {
  theme: string;
  point: string;
  quote: string;
  ref: string;
  sourceTitle: string;
  sourceVideoId: string;
  publishedAt: string;
};

const SCRIPTURE_BANK: Record<string, Array<{ quote: string; ref: string }>> = {
  Faith: [
    { quote: "Now faith is the substance of things hoped for, the evidence of things not seen.", ref: "Hebrews 11:1" },
    { quote: "For we walk by faith, not by sight.", ref: "2 Corinthians 5:7" },
    { quote: "According to your faith let it be to you.", ref: "Matthew 9:29" },
    { quote: "If you can believe, all things are possible to him who believes.", ref: "Mark 9:23" },
  ],
  Repentance: [
    { quote: "Repent therefore and be converted, that your sins may be blotted out.", ref: "Acts 3:19" },
    { quote: "Return to Me, and I will return to you, says the LORD of hosts.", ref: "Malachi 3:7" },
    { quote: "Create in me a clean heart, O God, and renew a steadfast spirit within me.", ref: "Psalm 51:10" },
    { quote: "The sacrifices of God are a broken spirit, a broken and a contrite heart.", ref: "Psalm 51:17" },
  ],
  Holiness: [
    { quote: "Pursue peace with all people, and holiness, without which no one will see the Lord.", ref: "Hebrews 12:14" },
    { quote: "Be holy, for I am holy.", ref: "1 Peter 1:16" },
    { quote: "Cleanse your hands, you sinners; and purify your hearts, you double-minded.", ref: "James 4:8" },
    { quote: "Blessed are the pure in heart, for they shall see God.", ref: "Matthew 5:8" },
  ],
  Prayer: [
    { quote: "Men always ought to pray and not lose heart.", ref: "Luke 18:1" },
    { quote: "Pray without ceasing.", ref: "1 Thessalonians 5:17" },
    { quote: "The effective, fervent prayer of a righteous man avails much.", ref: "James 5:16" },
    { quote: "Call to Me, and I will answer you, and show you great and mighty things.", ref: "Jeremiah 33:3" },
  ],
  Grace: [
    { quote: "By grace you have been saved through faith, and that not of yourselves; it is the gift of God.", ref: "Ephesians 2:8" },
    { quote: "My grace is sufficient for you, for My strength is made perfect in weakness.", ref: "2 Corinthians 12:9" },
    { quote: "The grace of God that brings salvation has appeared to all men.", ref: "Titus 2:11" },
    { quote: "Let us therefore come boldly to the throne of grace.", ref: "Hebrews 4:16" },
  ],
  "Spiritual Growth": [
    { quote: "Grow in the grace and knowledge of our Lord and Savior Jesus Christ.", ref: "2 Peter 3:18" },
    { quote: "As newborn babes, desire the pure milk of the word, that you may grow thereby.", ref: "1 Peter 2:2" },
    { quote: "That Christ may dwell in your hearts through faith; that you, being rooted and grounded in love.", ref: "Ephesians 3:17" },
    { quote: "Leaving the discussion of the elementary principles of Christ, let us go on to perfection.", ref: "Hebrews 6:1" },
  ],
  Salvation: [
    { quote: "For everyone who calls on the name of the LORD shall be saved.", ref: "Romans 10:13" },
    { quote: "Nor is there salvation in any other, for there is no other name under heaven given among men by which we must be saved.", ref: "Acts 4:12" },
    { quote: "Enter by the narrow gate; for wide is the gate and broad is the way that leads to destruction.", ref: "Matthew 7:13" },
  ],
  Justice: [
    { quote: "Let justice run down like water, and righteousness like a mighty stream.", ref: "Amos 5:24" },
    { quote: "He has shown you, O man, what is good; and what does the LORD require of you but to do justly, to love mercy, and to walk humbly with your God?", ref: "Micah 6:8" },
    { quote: "Open your mouth, judge righteously, and plead the cause of the poor and needy.", ref: "Proverbs 31:9" },
  ],
  Truth: [
    { quote: "You shall know the truth, and the truth shall make you free.", ref: "John 8:32" },
    { quote: "Sanctify them by Your truth. Your word is truth.", ref: "John 17:17" },
    { quote: "Buy the truth, and do not sell it, also wisdom and instruction and understanding.", ref: "Proverbs 23:23" },
  ],
  Deliverance: [
    { quote: "Therefore if the Son makes you free, you shall be free indeed.", ref: "John 8:36" },
    { quote: "He has delivered us from the power of darkness and conveyed us into the kingdom of the Son of His love.", ref: "Colossians 1:13" },
    { quote: "The Spirit of the LORD is upon Me, because He has anointed Me to preach deliverance to the captives.", ref: "Luke 4:18" },
  ],
  Obedience: [
    { quote: "If you love Me, keep My commandments.", ref: "John 14:15" },
    { quote: "To obey is better than sacrifice, and to heed than the fat of rams.", ref: "1 Samuel 15:22" },
    { quote: "Be doers of the word, and not hearers only, deceiving yourselves.", ref: "James 1:22" },
  ],
  Worship: [
    { quote: "God is Spirit, and those who worship Him must worship in spirit and truth.", ref: "John 4:24" },
    { quote: "Let justice run down like water, and righteousness like a mighty stream.", ref: "Amos 5:24" },
    { quote: "Present your bodies a living sacrifice, holy, acceptable to God, which is your reasonable service.", ref: "Romans 12:1" },
  ],
};

const THEME_RULES: Array<{ theme: string; patterns: RegExp[] }> = [
  { theme: "Faith", patterns: [/faith/i, /believ/i, /trust/i, /confidence/i, /cannot fail/i] },
  { theme: "Repentance", patterns: [/repent/i, /return/i, /sin/i, /sinner/i, /backslid/i, /confess/i, /forgiv/i] },
  { theme: "Holiness", patterns: [/holi/i, /righteous/i, /sanct/i, /purity/i, /pure/i, /consecr/i, /worldliness/i] },
  { theme: "Prayer", patterns: [/prayer/i, /pray/i, /intercession/i, /altar/i, /fast/i, /supplication/i] },
  { theme: "Grace", patterns: [/grace/i, /mercy/i, /saved/i, /salvation/i, /redeem/i, /blood of jesus/i] },
  { theme: "Spiritual Growth", patterns: [/grow/i, /matur/i, /word/i, /wisdom/i, /knowledge/i, /disciple/i, /christian life/i, /meditate/i] },
  { theme: "Justice", patterns: [/justice/i, /poor/i, /needy/i, /oppress/i, /exploit/i, /money/i, /house agent/i, /excessive/i, /bribe/i] },
  { theme: "Deliverance", patterns: [/deliver/i, /liberat/i, /demon/i, /bondage/i, /captiv/i, /evil spirit/i, /freedom/i] },
  { theme: "Obedience", patterns: [/obey/i, /obedien/i, /command/i, /submit/i, /will of god/i, /serve/i] },
  { theme: "Worship", patterns: [/worship/i, /praise/i, /thanksgiving/i, /holy ghost service/i, /spirit and truth/i] },
  { theme: "Truth", patterns: [/truth/i, /doctrine/i, /message/i, /gospel/i, /baptism/i, /primitive christianity/i] },
];

function normalizeTitle(title: string | null | undefined): string {
  return (title ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function isPinnedIntroTitle(title: string | null | undefined): boolean {
  return PINNED_INTRO_TITLES.has(normalizeTitle(title));
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function cleanSermonTitle(title: string): string {
  return title
    .replace(/\btemple tv\b/gi, "")
    .replace(/\blive stream\b/gi, "")
    .replace(/\blive service\b/gi, "service")
    .replace(/\s+/g, " ")
    .replace(/\s+([,!.?:;])/g, "$1")
    .trim();
}

function themeForSermon(title: string, description: string | null): string {
  const text = `${title} ${description ?? ""}`;
  return THEME_RULES.find(rule => rule.patterns.some(pattern => pattern.test(text)))?.theme ?? "Spiritual Growth";
}

function scriptureFor(theme: string, key: string): { quote: string; ref: string } {
  const bank = SCRIPTURE_BANK[theme] ?? SCRIPTURE_BANK["Spiritual Growth"]!;
  return bank[hashString(`${theme}:${key}`) % bank.length]!;
}

function pointForTheme(theme: string, title: string): string {
  const sermon = cleanSermonTitle(title);
  const points: Record<string, string> = {
    Faith: `Let the message "${sermon}" strengthen your faith to trust God beyond what your eyes can see.`,
    Repentance: `"${sermon}" calls every heart back to sincere repentance, clean hands, and a restored walk with God.`,
    Holiness: `The teaching "${sermon}" points believers back to holiness, purity, and a life separated unto the Lord.`,
    Prayer: `"${sermon}" reminds the church that prayer keeps the altar burning and opens the heart to God's will.`,
    Grace: `Through "${sermon}", receive grace as power to be saved, corrected, restored, and kept in Christ.`,
    "Spiritual Growth": `"${sermon}" invites believers to grow deeper in the Word, maturity, discipline, and daily obedience.`,
    Justice: `"${sermon}" reminds the church that righteousness must touch daily life, justice, mercy, and honest dealings before God.`,
    Deliverance: `The sermon "${sermon}" declares that Jesus Christ still delivers souls from darkness into lasting freedom.`,
    Obedience: `"${sermon}" teaches that true love for God is proven through obedience, surrender, and faithful service.`,
    Worship: `The message "${sermon}" lifts worship beyond ceremony into Spirit, truth, righteousness, and a yielded heart.`,
    Truth: `"${sermon}" anchors the soul in God's truth so the believer is not carried away by error or empty religion.`,
  };
  return points[theme] ?? points["Spiritual Growth"]!;
}

function rotateByFreshness<T>(items: T[], seed: number): T[] {
  if (items.length <= 1) return items;
  const offset = seed % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

function spreadThemes(points: SermonTeachingPoint[]): SermonTeachingPoint[] {
  const buckets = new Map<string, SermonTeachingPoint[]>();
  for (const point of points) {
    const bucket = buckets.get(point.theme) ?? [];
    bucket.push(point);
    buckets.set(point.theme, bucket);
  }
  const output: SermonTeachingPoint[] = [];
  while (buckets.size > 0) {
    const entries = [...buckets.entries()].sort((a, b) => b[1].length - a[1].length);
    let progressed = false;
    for (const [theme, bucket] of entries) {
      if (output.at(-1)?.theme === theme && entries.length > 1) continue;
      const next = bucket.shift();
      if (next) {
        output.push(next);
        progressed = true;
      }
      if (bucket.length === 0) buckets.delete(theme);
    }
    if (!progressed) {
      const [theme, bucket] = entries[0]!;
      const next = bucket.shift();
      if (next) output.push(next);
      if (bucket.length === 0) buckets.delete(theme);
    }
  }
  return output;
}

// ──────────────────────────────────────────────────────
// GET /sermons/stream  — Server-Sent Events for real-time updates
// ──────────────────────────────────────────────────────
router.get("/sermons/stream", (req, res): void => {
  const clientId = randomUUID();
  req.log.info({ clientId, total: sseBroadcaster.size() + 1 }, "SSE client connected");
  sseBroadcaster.add(clientId, res);

  req.on("close", () => {
    req.log.info({ clientId }, "SSE client disconnected");
  });
});

// ──────────────────────────────────────────────────────
// GET /sermons/sync-status  — automation engine status (sermon-admin only)
// Returns quota state, last sync times, next sync times, and last error.
// ──────────────────────────────────────────────────────
router.get("/sermons/sync-status", requireAdminRole("sermon"), (_req, res): void => {
  res.json(getCronState());
});

// ──────────────────────────────────────────────────────
// GET /sermons  — list sermons
// ──────────────────────────────────────────────────────
router.get("/sermons", async (req, res): Promise<void> => {
  const parsed = ListSermonsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { limit = 20, offset = 0, search } = parsed.data;
  const conditions = search ? [ilike(sermonsTable.title, `%${search}%`)] : [];

  const sermons = await db
    .select()
    .from(sermonsTable)
    .where(conditions.length > 0 ? or(...conditions) : undefined)
    .orderBy(desc(sermonsTable.publishedAt))
    .limit(limit)
    .offset(offset);

  const serialized = sermons.map(s => ({
    ...s,
    publishedAt: s.publishedAt instanceof Date ? s.publishedAt.toISOString() : s.publishedAt,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
  }));
  res.json(ListSermonsResponse.parse(serialized));
});

// ──────────────────────────────────────────────────────
// GET /sermons/shorts  — Videos up to 30 minutes long (Moments / Reels feed)
// Fetches a large pool, filters by duration ≤ 1800 s in JS (ISO 8601 stored).
// Falls back to the latest 50 sermons if none have duration metadata.
// ──────────────────────────────────────────────────────
router.get("/sermons/shorts", async (_req, res): Promise<void> => {
  const MAX_SECONDS = 30 * 60; // 30 minutes
  const RECENT_ENRICH_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

  // Pull a large pool ordered newest-first
  const pool = await db
    .select()
    .from(sermonsTable)
    .orderBy(desc(sermonsTable.publishedAt))
    .limit(200);

  // Filter criteria:
  //   1. Videos with a known duration within the 30-min cap, OR
  //   2. Videos with no duration yet published within the last 24 h —
  //      these are brand-new uploads that RSS sync just inserted and whose
  //      metadata is being enriched in the background. Including them here
  //      means they appear in Moments immediately (within the 5-min RSS cycle)
  //      rather than waiting up to 30 min for the full API sync.
  let shorts = pool.filter(s => {
    if (s.duration) {
      const secs = iso8601ToSeconds(s.duration);
      return secs > 0 && secs <= MAX_SECONDS;
    }
    // No duration yet — include if published recently (likely still being enriched)
    if (s.publishedAt) {
      const ageMs = Date.now() - new Date(s.publishedAt).getTime();
      return ageMs <= RECENT_ENRICH_WINDOW_MS;
    }
    return false;
  });

  // Fallback: no videos have any duration or recent publish date — show latest 50
  if (shorts.length === 0) {
    shorts = pool.slice(0, 50);
  }

  const serialized = shorts.map(s => ({
    ...s,
    publishedAt: s.publishedAt instanceof Date ? s.publishedAt.toISOString() : s.publishedAt,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
  }));
  res.json(ListSermonsResponse.parse(serialized));
});

// ──────────────────────────────────────────────────────
// GET /sermons/featured  — latest / featured sermon
// ──────────────────────────────────────────────────────
router.get("/sermons/featured", async (req, res): Promise<void> => {
  // Prefer the most recently published sermon (always show the latest upload)
  const [sermon] = await db
    .select()
    .from(sermonsTable)
    .orderBy(desc(sermonsTable.publishedAt))
    .limit(1);

  if (!sermon) {
    res.status(404).json({ error: "No sermons found" });
    return;
  }

  res.json(GetFeaturedSermonResponse.parse({
    ...sermon,
    publishedAt: sermon.publishedAt instanceof Date ? sermon.publishedAt.toISOString() : sermon.publishedAt,
    createdAt: sermon.createdAt instanceof Date ? sermon.createdAt.toISOString() : sermon.createdAt,
  }));
});

// ──────────────────────────────────────────────────────
// GET /sermons/stats
// ──────────────────────────────────────────────────────
router.get("/sermons/stats", async (req, res): Promise<void> => {
  const [result] = await db
    .select({
      total: sql<number>`cast(count(*) as int)`,
      totalViews: sql<number>`cast(sum(${sermonsTable.viewCount}) as int)`,
      latestDate: sql<string>`max(${sermonsTable.publishedAt})::text`,
    })
    .from(sermonsTable);

  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
  res.json(GetSermonStatsResponse.parse({
    total: result?.total ?? 0,
    totalViews: result?.totalViews ?? null,
    latestDate: result?.latestDate ?? null,
  }));
});

// ──────────────────────────────────────────────────────
// GET /sermons/intro  — Full Teaching feed: strictly 50 min–1h10min videos.
// Excludes Shorts, clips, and anything outside the 50–70 minute window.
// Scans the full sermon archive (newest first) for maximum coverage.
// Supports pagination via ?offset=0&limit=30 query params.
// Falls back to best available sermons closest to the target range only if
// none qualify strictly, so the page never shows an empty state.
// ──────────────────────────────────────────────────────
router.get("/sermons/intro", async (req, res): Promise<void> => {
  const MIN_SECONDS = 50 * 60;        // 50 minutes — strict lower bound
  const MAX_SECONDS = 70 * 60;        // 1 hour 10 minutes — strict upper bound
  const FALLBACK_MIN = 40 * 60;       // Fallback: 40 min if nothing in strict range
  const FALLBACK_MAX = 90 * 60;       // Fallback: 90 min
  const limit  = Math.min(Math.max(parseInt(String(req.query.limit  ?? "20")), 1), 100);
  const offset = Math.max(parseInt(String(req.query.offset ?? "0")), 0);

  // Keywords whose presence in a title disqualifies a video from the Intro feed
  const EXCLUDED_TITLE_PATTERNS = [
    /deliverance/i,
    /testimon/i,
  ];

  // Exact titles explicitly excluded from the Intro feed (case-insensitive, trimmed)
  const EXCLUDED_EXACT_TITLES = new Set([
    "26-7-23 first wednesday service program",
    "a must-watch!!!!! what did the bible say about baptism in the name of jesus christ",
    "5-6-22 holy ghost sunday service",
    "2nd january 2022 1st sunday service",
    "28-10-21 abraka crusade day 1",
    "18-4-21 super sunday service",
    "31-1-21 sunday service",
    "24-1-21 super sunday service",
    "3-1-21 thanksgiving service",
    "okpe isoko crusade day 2",
    "30-8-20 super sunday service",
    "16-8-20 super sunday service",
    "19-1-20 sunday service",
    "25-12-19 christmas service",
    "prayer of the holy spirit",
    "16-8-19 family liberation program day 3",
    "21-7-19 super sunday live service",
    "13-3-19 wednesday live service",
    "6-3-19 wednesday live service",
    "27-1-19 sunday live service",
    "16-12-18 sunday live service",
    "25-11-18 sunday live service (holy ghost service)",
    "7-11-18 wednesday live service",
    "16-9-18 sunday live service",
    "22-8-18 wednesday service",
    "day 1, no one can stop me jesus is alive 10-8-18 friday service (temple tv live stream)",
    "25-7-18 wednesday service (temple tv live stream)",
    "10-6-18 sunday service( prophetic declaration)",
    "3-6-18",
    "27-5-18 day 5 (oh lord show me mercy)",
    "24-5-18 day 2 (oh lord show me mercy)",
    "23-5-18 day 1 (oh lord show me mercy)",
    "6-5-18 sunday service praise & worship",
    "8-8-18 sunday service",
    "14th march 2018 wednesday service",
    "21 febraury 2018 mass prayer time.",
    "4th feb 2018, mass prayer",
    "cross over service",
    "meditate in the life you live as a christian.",
    "don't put your trust in man.",
    "watch how a demon entered a girl who was sleeping in the church",
    "we are saved by the grace of god part i",
    "watch how this woman delivered in the church during a mass prayer day 2",
    "punishment is coming for the sinners",
  ]);

  const isExcluded = (title: string | null) => {
    if (title == null) return false;
    if (EXCLUDED_TITLE_PATTERNS.some(re => re.test(title))) return true;
    if (EXCLUDED_EXACT_TITLES.has(title.trim().toLowerCase())) return true;
    return false;
  };

  // Scan every sermon in the archive, newest first
  const pool = await db
    .select()
    .from(sermonsTable)
    .orderBy(desc(sermonsTable.publishedAt))
    .limit(5000);

  const pinnedIntros = pool.filter(s => isPinnedIntroTitle(s.title));
  const pinnedVideoIds = new Set(pinnedIntros.map(s => s.videoId));

  // Strict filter: 50–70 min, must have duration, exclude Shorts (< 60s), exclude deliverance/testimony.
  // Pinned ministry-required intro videos are merged in above even if YouTube duration enrichment
  // has not completed yet.
  let intros = pool.filter(s => {
    if (pinnedVideoIds.has(s.videoId)) return false;
    if (!s.duration) return false;
    if (isExcluded(s.title)) return false;
    const secs = iso8601ToSeconds(s.duration);
    if (secs < 60) return false; // exclude Shorts
    return secs >= MIN_SECONDS && secs <= MAX_SECONDS;
  });

  intros = [...pinnedIntros, ...intros];

  // Fallback: broaden duration to 40–90 min (still exclude deliverance/testimony)
  if (intros.length === 0) {
    intros = pool.filter(s => {
      if (pinnedVideoIds.has(s.videoId)) return false;
      if (!s.duration) return false;
      if (isExcluded(s.title)) return false;
      const secs = iso8601ToSeconds(s.duration);
      if (secs < 60) return false;
      return secs >= FALLBACK_MIN && secs <= FALLBACK_MAX;
    });
    intros = [...pinnedIntros, ...intros];
  }

  // Last resort: most recent with any duration, still applying exclusions
  if (intros.length === 0) {
    intros = [
      ...pinnedIntros,
      ...pool
      .filter(s => s.duration && iso8601ToSeconds(s.duration) > 60 && !isExcluded(s.title))
      .filter(s => !pinnedVideoIds.has(s.videoId))
      .slice(0, 20),
    ];
  }

  const total   = intros.length;
  const page    = intros.slice(offset, offset + limit);
  const hasMore = offset + limit < total;

  const serialized = page.map(s => ({
    ...s,
    publishedAt: s.publishedAt instanceof Date ? s.publishedAt.toISOString() : s.publishedAt,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
  }));

  res.json({ videos: serialized, total, hasMore, offset, limit });
});

router.get("/sermons/teaching-points", async (req, res): Promise<void> => {
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "48")), 12), 80);
  const pool = await db
    .select({
      videoId: sermonsTable.videoId,
      title: sermonsTable.title,
      description: sermonsTable.description,
      publishedAt: sermonsTable.publishedAt,
      viewCount: sermonsTable.viewCount,
      duration: sermonsTable.duration,
    })
    .from(sermonsTable)
    .orderBy(desc(sermonsTable.publishedAt))
    .limit(240);

  const seenTitles = new Set<string>();
  const latestTime = pool[0]?.publishedAt instanceof Date ? pool[0].publishedAt.getTime() : Date.now();
  const rotationSeed = Math.floor(Date.now() / (6 * 60 * 60 * 1000)) + Math.floor(latestTime / (24 * 60 * 60 * 1000));

  const scored = pool
    .map((sermon) => {
      const titleKey = normalizeTitle(sermon.title).replace(/\b(live|service|program|sunday|wednesday|friday)\b/g, "").trim();
      if (!titleKey || seenTitles.has(titleKey)) return null;
      seenTitles.add(titleKey);
      const theme = themeForSermon(sermon.title, sermon.description);
      const scripture = scriptureFor(theme, `${sermon.videoId}:${sermon.publishedAt?.toISOString?.() ?? ""}`);
      const durationSeconds = sermon.duration ? iso8601ToSeconds(sermon.duration) : 0;
      const score =
        (sermon.publishedAt ? new Date(sermon.publishedAt).getTime() / 1_000_000_000 : 0) +
        Math.min(sermon.viewCount ?? 0, 500_000) / 10_000 +
        (durationSeconds >= 15 * 60 ? 15 : 0) +
        (THEME_RULES.some(rule => rule.theme === theme && rule.patterns.some(pattern => pattern.test(sermon.title))) ? 20 : 0);
      return {
        score,
        point: {
          theme,
          point: pointForTheme(theme, sermon.title),
          quote: scripture.quote,
          ref: scripture.ref,
          sourceTitle: cleanSermonTitle(sermon.title),
          sourceVideoId: sermon.videoId,
          publishedAt: sermon.publishedAt instanceof Date ? sermon.publishedAt.toISOString() : new Date(sermon.publishedAt).toISOString(),
        } satisfies SermonTeachingPoint,
      };
    })
    .filter((item): item is { score: number; point: SermonTeachingPoint } => item !== null)
    .sort((a, b) => b.score - a.score)
    .map(item => item.point);

  const requiredThemes = ["Faith", "Repentance", "Holiness", "Prayer", "Grace", "Spiritual Growth"];
  const topByTheme = requiredThemes
    .map(theme => scored.find(point => point.theme === theme))
    .filter((point): point is SermonTeachingPoint => point !== undefined);
  const topKeys = new Set(topByTheme.map(point => point.sourceVideoId));
  const remaining = scored.filter(point => !topKeys.has(point.sourceVideoId));
  const rotated = rotateByFreshness([...topByTheme, ...remaining], rotationSeed);
  const points = spreadThemes(rotated).slice(0, limit);

  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
  res.json({
    source: "youtube-sermon-metadata",
    generatedAt: new Date().toISOString(),
    refreshSeconds: 300,
    themes: [...new Set(points.map(point => point.theme))],
    points,
  });
});

// ──────────────────────────────────────────────────────
// GET /sermons/:id
// ──────────────────────────────────────────────────────
router.get("/sermons/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetSermonParams.safeParse({ id: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [sermon] = await db
    .select()
    .from(sermonsTable)
    .where(eq(sermonsTable.id, params.data.id));

  if (!sermon) {
    res.status(404).json({ error: "Sermon not found" });
    return;
  }

  res.json(GetSermonResponse.parse({
    ...sermon,
    publishedAt: sermon.publishedAt instanceof Date ? sermon.publishedAt.toISOString() : sermon.publishedAt,
    createdAt: sermon.createdAt instanceof Date ? sermon.createdAt.toISOString() : sermon.createdAt,
  }));
});

// ──────────────────────────────────────────────────────
// GET /sermons/:id/summary  — AI-generated sermon summary (cached)
// Used for SEO: Google can index this text content on the sermon detail page.
// ──────────────────────────────────────────────────────
router.get("/sermons/:id/summary", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetSermonParams.safeParse({ id: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const cached = summaryCache.get(params.data.id);
  if (cached) {
    res.json(cached);
    return;
  }

  const [sermon] = await db
    .select()
    .from(sermonsTable)
    .where(eq(sermonsTable.id, params.data.id));

  if (!sermon) {
    res.status(404).json({ error: "Sermon not found" });
    return;
  }

  try {
    const prompt = `You are a biblical scholar summarizing a sermon by Prophet Amos Evomobor of Jesus Christ Temple Ministry (JCTM), Warri, Nigeria.

Sermon title: "${sermon.title}"
${sermon.description ? `Description: ${sermon.description.slice(0, 500)}` : ""}

Write a 200-250 word sermon summary in plain, engaging English. Cover: the main scriptural theme, key teachings, and a practical takeaway for the listener. Then list exactly 5 bullet-point key points from the sermon. Format your response as JSON: { "summary": "...", "keyPoints": ["...", "...", "...", "...", "..."] }`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_completion_tokens: 8192,
    });

    const raw_content = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw_content) as { summary?: string; keyPoints?: string[] };

    const result = {
      summary: parsed.summary ?? "Summary unavailable.",
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints.slice(0, 5) : [],
      generatedAt: new Date().toISOString(),
    };

    summaryCache.set(params.data.id, result);
    res.json(result);
  } catch (err) {
    req.log.warn({ err }, "Sermon summary generation failed");
    res.status(503).json({ error: "Summary generation unavailable" });
  }
});

// ──────────────────────────────────────────────────────
// GET /sermons/youtube-stats/:videoId
// Fetches live like / comment / view counts from YouTube Data API.
// Returns cached DB view count as fallback if no API key is set.
// ──────────────────────────────────────────────────────
router.get("/sermons/youtube-stats/:videoId", async (req, res): Promise<void> => {
  const videoId = String(req.params.videoId ?? "").trim();
  if (!videoId) { res.status(400).json({ error: "videoId required" }); return; }

  const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

  if (!YOUTUBE_API_KEY) {
    // Fallback: return stored view count from DB, no likes/comments available
    const [row] = await db
      .select({ viewCount: sermonsTable.viewCount })
      .from(sermonsTable)
      .where(eq(sermonsTable.videoId, videoId));
    res.json({ likeCount: null, commentCount: null, viewCount: row?.viewCount ?? 0 });
    return;
  }

  try {
    const url =
      `https://www.googleapis.com/youtube/v3/videos` +
      `?part=statistics&id=${encodeURIComponent(videoId)}&key=${YOUTUBE_API_KEY}`;
    const ytRes = await fetch(url);
    if (!ytRes.ok) {
      // Quota exceeded or API error — fall back to stored data gracefully
      const [row] = await db
        .select({ viewCount: sermonsTable.viewCount })
        .from(sermonsTable)
        .where(eq(sermonsTable.videoId, videoId));
      res.json({ likeCount: null, commentCount: null, viewCount: row?.viewCount ?? 0 });
      return;
    }
    const data = await ytRes.json() as {
      items?: { statistics?: { likeCount?: string; commentCount?: string; viewCount?: string } }[]
    };
    const stats = data.items?.[0]?.statistics ?? {};
    res.json({
      likeCount: stats.likeCount != null ? parseInt(stats.likeCount) : null,
      commentCount: stats.commentCount != null ? parseInt(stats.commentCount) : null,
      viewCount: stats.viewCount != null ? parseInt(stats.viewCount) : 0,
    });
  } catch (err) {
    req.log.warn({ err }, "YouTube stats unavailable — returning stored data");
    // Always return stored view count rather than a 500
    const [row] = await db
      .select({ viewCount: sermonsTable.viewCount })
      .from(sermonsTable)
      .where(eq(sermonsTable.videoId, videoId));
    res.json({ likeCount: null, commentCount: null, viewCount: row?.viewCount ?? 0 });
  }
});

// ──────────────────────────────────────────────────────
// POST /sermons  — incremental sync (sermon-admin only)
// POST /sermons?harvest=true  — full purge + repopulate
// ──────────────────────────────────────────────────────
router.post("/sermons", requireAdminRole("sermon"), async (req, res): Promise<void> => {
  const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
  const isHarvest = req.query.harvest === "true";

  // ── Helper: run RSS fallback sync ──────────────────────────────────────────
  // Returns 200 (with a warning) when RSS succeeds — the data was synced,
  // just via the fallback path.  Only returns 503 when both methods fail.
  async function runRSSFallback(reason: string): Promise<void> {
    req.log.info({ reason }, "Manual sync falling back to RSS feed");
    try {
      const rssResult = await syncFromRSS(req.log);
      if (rssResult.total > 0) {
        sseBroadcaster.broadcast({ type: "sync_complete", data: { synced: rssResult.inserted, source: "rss" } });
      }
      const resetTime = getQuotaResetTime();
      res.status(200).json({
        synced:     rssResult.inserted,
        source:     "rss",
        warning:    reason,
        quotaResets: resetTime ? resetTime.toISOString() : null,
        rssResult:  { inserted: rssResult.inserted, updated: rssResult.updated, total: rssResult.total },
        message:    `RSS fallback ran (${rssResult.total} videos checked, ${rssResult.inserted} new, ${rssResult.updated} updated).${resetTime ? ` YouTube API resumes at ${resetTime.toUTCString()}.` : ""}`,
      });
    } catch (rssErr) {
      req.log.error({ rssErr }, "RSS fallback also failed");
      res.status(503).json({
        error:   reason,
        message: "Both YouTube API and RSS fallback failed — no sync performed.",
      });
    }
  }

  // ── No API key: run RSS only ───────────────────────────────────────────────
  if (!YOUTUBE_API_KEY) {
    await runRSSFallback("YouTube API key not configured. Set YOUTUBE_API_KEY environment variable.");
    return;
  }

  // ── Quota paused: run RSS fallback immediately without hitting the API ─────
  if (isQuotaPaused()) {
    const resetTime = getQuotaResetTime();
    const resetMsg = resetTime ? ` Quota resets at ${resetTime.toUTCString()}.` : "";
    await runRSSFallback(`YouTube API quota exceeded.${resetMsg}`);
    return;
  }

  // ── Normal API sync ────────────────────────────────────────────────────────
  try {
    const result = isHarvest
      ? await harvestAll(YOUTUBE_API_KEY, req.log)
      : await syncIncremental(YOUTUBE_API_KEY, req.log);

    sseBroadcaster.broadcast({
      type: "sync_complete",
      data: { synced: result.synced, featured: result.featured },
    });

    res.json(SyncSermonsResponse.parse({ synced: result.synced, message: result.message }));
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      // Quota just got exhausted — record it in the shared cron state so the
      // automatic 30-min sync also respects the pause, then fall back to RSS.
      const nowMs = Date.now();
      const now = new Date();
      const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
      const pauseMs = midnight.getTime() - nowMs;
      setQuotaPaused(nowMs + pauseMs);
      req.log.warn({ resumesInHours: Math.round(pauseMs / 3600000) }, "Manual sync hit YouTube quota — pausing until UTC midnight");
      await runRSSFallback(`YouTube API quota exceeded. Quota resets at ${midnight.toUTCString()}.`);
    } else {
      req.log.error({ err }, "YouTube sync failed");
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: "Failed to sync sermons from YouTube", details: message });
    }
  }
});

export default router;

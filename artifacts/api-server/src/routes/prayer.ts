import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { generateSpiritualInsight } from "../lib/local-text-generation.js";
import { moderateContent, detectAnomaly } from "../lib/local-moderation.js";

const router: IRouter = Router();

const PRAYER_CATEGORIES = new Set([
  "general","healing","provision","protection","family","ministry",
  "salvation","deliverance","guidance","thanksgiving","other",
  "peace","strength",
]);

const PRAYER_NEED_MAX_LEN = 2000;
const PRAYER_NAME_MAX_LEN = 80;

// ─── Local prayer generation templates ────────────────────────────────────────

const SCRIPTURES_BY_CATEGORY: Record<string, Array<{ verse: string; ref: string }>> = {
  healing: [
    { verse: "He was pierced for our transgressions, He was crushed for our iniquities; the punishment that brought us peace was on Him, and by His wounds we are healed.", ref: "Isaiah 53:5" },
    { verse: "Is anyone among you sick? Let them call the elders of the church to pray over them and anoint them with oil in the name of the Lord.", ref: "James 5:14" },
    { verse: "Heal me, LORD, and I will be healed; save me and I will be saved, for You are the one I praise.", ref: "Jeremiah 17:14" },
  ],
  provision: [
    { verse: "And my God will meet all your needs according to the riches of His glory in Christ Jesus.", ref: "Philippians 4:19" },
    { verse: "Bring the whole tithe into the storehouse, that there may be food in My house. Test Me in this and see if I will not throw open the floodgates of heaven.", ref: "Malachi 3:10" },
    { verse: "The LORD is my shepherd, I lack nothing.", ref: "Psalm 23:1" },
  ],
  protection: [
    { verse: "No weapon formed against you shall prosper, and every tongue which rises against you in judgment you shall condemn.", ref: "Isaiah 54:17" },
    { verse: "The LORD is my light and my salvation — whom shall I fear? The LORD is the stronghold of my life — of whom shall I be afraid?", ref: "Psalm 27:1" },
    { verse: "For He will command His angels concerning you to guard you in all your ways.", ref: "Psalm 91:11" },
  ],
  family: [
    { verse: "But as for me and my household, we will serve the LORD.", ref: "Joshua 24:15" },
    { verse: "Train up a child in the way he should go; even when he is old he will not depart from it.", ref: "Proverbs 22:6" },
    { verse: "Children are a heritage from the LORD, offspring a reward from Him.", ref: "Psalm 127:3" },
  ],
  salvation: [
    { verse: "For God so loved the world that He gave His one and only Son, that whoever believes in Him shall not perish but have eternal life.", ref: "John 3:16" },
    { verse: "If you declare with your mouth, 'Jesus is Lord,' and believe in your heart that God raised Him from the dead, you will be saved.", ref: "Romans 10:9" },
    { verse: "Come to Me, all you who are weary and burdened, and I will give you rest.", ref: "Matthew 11:28" },
  ],
  guidance: [
    { verse: "Trust in the LORD with all your heart and lean not on your own understanding; in all your ways submit to Him, and He will make your paths straight.", ref: "Proverbs 3:5-6" },
    { verse: "Your word is a lamp for my feet, a light on my path.", ref: "Psalm 119:105" },
    { verse: "Whether you turn to the right or to the left, your ears will hear a voice behind you, saying, 'This is the way; walk in it.'", ref: "Isaiah 30:21" },
  ],
  deliverance: [
    { verse: "The Spirit of the Lord is on me, because He has anointed me to proclaim freedom for the prisoners and recovery of sight for the blind, to set the oppressed free.", ref: "Luke 4:18" },
    { verse: "If the Son sets you free, you will be free indeed.", ref: "John 8:36" },
    { verse: "Submit yourselves, then, to God. Resist the devil, and he will flee from you.", ref: "James 4:7" },
  ],
  thanksgiving: [
    { verse: "Give thanks to the LORD, for He is good; His love endures forever.", ref: "Psalm 107:1" },
    { verse: "Rejoice always, pray continually, give thanks in all circumstances; for this is God's will for you in Christ Jesus.", ref: "1 Thessalonians 5:16-18" },
    { verse: "Enter His gates with thanksgiving and His courts with praise; give thanks to Him and praise His name.", ref: "Psalm 100:4" },
  ],
  general: [
    { verse: "Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God.", ref: "Philippians 4:6" },
    { verse: "Cast all your anxiety on Him because He cares for you.", ref: "1 Peter 5:7" },
    { verse: "And we know that in all things God works for the good of those who love Him, who have been called according to His purpose.", ref: "Romans 8:28" },
  ],
};

function generateLocalPrayer(need: string, category: string, name: string): string {
  const cat = PRAYER_CATEGORIES.has(category.toLowerCase()) ? category.toLowerCase() : "general";
  const scriptures = SCRIPTURES_BY_CATEGORY[cat] ?? SCRIPTURES_BY_CATEGORY["general"]!;
  const address = name ? `for ${name}` : "";
  const needSnippet = need.slice(0, 200) + (need.length > 200 ? "..." : "");
  const s = (i: number) => scriptures[i % scriptures.length]!;

  return `Heavenly Father, I come before Your throne of grace in the mighty name of Jesus Christ — the name above every name.

Lord, You see every detail of this situation ${address}: *"${needSnippet}"*. Nothing is hidden from Your sight, and nothing is beyond Your sovereign reach. Your Word declares that "${s(0).verse}" (${s(0).ref}). Father, I stand on that promise now and bring this need before You.

I thank You that You are not a distant God but one who is intimately acquainted with the needs of Your children. As Your Word declares: "${s(1).verse}" (${s(1).ref}). I receive that truth into my spirit right now and choose to trust You completely.

Lord, I ask You now to move in power over this situation. Let Your will be done — not my will, but Yours. Let the wisdom of heaven govern this need. Let Your grace be sufficient. Let Your strength be made perfect in every area of weakness. For You have promised: "${s(2).verse}" (${s(2).ref}).

I declare by faith that this prayer is heard. I declare that You are faithful and Your word does not return void (Isaiah 55:11). I choose to trust You with the outcome and to walk in peace that passes all understanding (Philippians 4:7).

In Jesus' mighty name, I pray — the name to which every knee must bow and every tongue confess that He is Lord (Philippians 2:10-11).

**In Jesus' name, Amen.**

---
*This prayer was generated by TempleBots — JCTM's AI prayer companion. For personal pastoral prayer support, contact the ministry: info@jctm.org.ng*`;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.post("/prayer/generate", async (req: Request, res: Response): Promise<void> => {
  const raw = req.body as { need?: unknown; category?: unknown; name?: unknown };

  const need     = typeof raw.need     === "string" ? raw.need.trim()     : "";
  const name     = typeof raw.name     === "string" ? raw.name.trim().slice(0, PRAYER_NAME_MAX_LEN) : "";
  const category = typeof raw.category === "string" && PRAYER_CATEGORIES.has(raw.category.toLowerCase())
    ? raw.category.toLowerCase()
    : "general";

  if (!need) { res.status(400).json({ error: "Please describe your prayer need." }); return; }
  if (need.length > PRAYER_NEED_MAX_LEN) {
    res.status(400).json({ error: `Prayer need must be ${PRAYER_NEED_MAX_LEN} characters or less.` });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    const prayer = generateLocalPrayer(need, category, name);
    const words = prayer.split(/(\s+)/);
    const CHUNK = 3;

    for (let i = 0; i < words.length; i += CHUNK) {
      const token = words.slice(i, i + CHUNK).join("");
      if (token) res.write(`data: ${JSON.stringify({ token })}\n\n`);
      await new Promise(r => setTimeout(r, 12));
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Prayer generation failed";
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    res.end();
  }
});

router.get("/prayer/requests", async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT id, name, category, request, pray_count, created_at
       FROM prayer_requests
       WHERE is_public = true
       ORDER BY created_at DESC
       LIMIT 30`
    );
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to load prayer requests" });
  }
});

router.post("/prayer/requests", async (req: Request, res: Response): Promise<void> => {
  const { name, category, request: reqText, visitorId } = req.body as {
    name?: string; category?: string; request?: string; visitorId?: string;
  };

  if (!reqText || !reqText.trim()) {
    res.status(400).json({ error: "Prayer request text is required." });
    return;
  }
  if (reqText.trim().length > PRAYER_NEED_MAX_LEN) {
    res.status(400).json({ error: "Prayer request too long." });
    return;
  }

  const ip = String(req.ip ?? req.socket?.remoteAddress ?? "unknown");
  const anomaly = detectAnomaly(ip, reqText.trim());
  if (anomaly.riskLevel === "high") {
    res.status(429).json({ error: "Too many requests. Please wait before submitting again." });
    return;
  }

  const modResult = moderateContent(reqText.trim(), { context: "prayer", minLength: 10, maxLength: PRAYER_NEED_MAX_LEN });
  if (modResult.decision === "reject") {
    res.status(422).json({ error: "Your prayer request could not be submitted. " + (modResult.reasons[0] ?? "Please revise and try again.") });
    return;
  }

  const cat = category && PRAYER_CATEGORIES.has(category.toLowerCase()) ? category.toLowerCase() : "general";

  try {
    const result = await pool.query(
      `INSERT INTO prayer_requests (name, category, request, is_public, visitor_id)
       VALUES ($1, $2, $3, true, $4)
       RETURNING id, name, category, request, created_at`,
      [name?.slice(0, PRAYER_NAME_MAX_LEN) ?? "Anonymous", cat, reqText.trim(), visitorId ?? null],
    );
    res.json({ success: true, prayerRequest: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Failed to submit prayer request." });
  }
});

router.post("/prayer/requests/:id/pray", async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid ID." }); return; }

  try {
    await pool.query(
      `UPDATE prayer_requests SET pray_count = pray_count + 1 WHERE id = $1 AND is_public = true`,
      [id],
    );
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to update pray count." });
  }
});

export default router;

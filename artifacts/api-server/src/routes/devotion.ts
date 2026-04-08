import { Router, type IRouter, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

interface DailyDevotion {
  date: string;
  title: string;
  scripture: string;
  reference: string;
  reflection: string;
  prayerFocus: string;
  declaration: string;
}

const devotionCache = new Map<string, DailyDevotion>();

const DEVOTION_SYSTEM_PROMPT = `You are a daily devotion writer for Jesus Christ Temple Ministry (JCTM), Warri, Nigeria. 
You write in the spirit of the Correction Mandate — sound doctrine, holiness, apostolic truth, and genuine faith.
Prophet Amos Evomobor leads this ministry.

Guidelines:
- Draw from KJV/NKJV scriptures
- Focus on practical holiness, faith, and doctrinal truth
- Avoid prosperity gospel themes
- Write with warmth, depth, and pastoral care
- Connect the devotion to everyday Nigerian and global Christian life

Return ONLY a valid JSON object with NO markdown wrapper, NO code blocks, and NO extra text. Return the raw JSON object only.
The JSON must have exactly these fields:
{
  "title": "Short devotion title (5-8 words)",
  "scripture": "The exact Bible verse text (full verse)",
  "reference": "Book Chapter:Verse (e.g., John 3:16)",
  "reflection": "2-3 paragraphs of devotional reflection (200-280 words total)",
  "prayerFocus": "One focused prayer point for today (1-2 sentences)",
  "declaration": "A bold faith declaration to speak aloud (1 sentence, present tense)"
}`;

router.get("/devotion/daily", async (_req: Request, res: Response): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];

  if (devotionCache.has(today)) {
    res.json({ devotion: devotionCache.get(today), cached: true });
    return;
  }

  try {
    const dayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
    const monthDay = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: DEVOTION_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Generate today's daily devotion for ${dayName}, ${monthDay}. 
Choose a scripture that is particularly meaningful and timely. 
The devotion should feel fresh and specific to this day — not generic. 
Focus on a theme of: ${getDayTheme(new Date().getDay())}.
Return ONLY the raw JSON object, no markdown, no code blocks.`,
        },
      ],
      temperature: 0.75,
      max_tokens: 700,
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    let devotion: DailyDevotion;

    try {
      const cleaned = raw.replace(/^```(?:json)?\n?/i, "").replace(/```\s*$/m, "").trim();
      devotion = JSON.parse(cleaned);
      devotion.date = today;
    } catch {
      devotion = {
        date: today,
        title: "Walk in the Light of His Word",
        scripture: "Thy word is a lamp unto my feet, and a light unto my path.",
        reference: "Psalm 119:105",
        reflection: "The Word of God is not merely a book — it is a living lamp that illuminates every step of our journey. In seasons of confusion, uncertainty, or spiritual warfare, the believer's anchor remains the unchanging truth of Scripture. Prophet Amos Evomobor often teaches that the Correction Mandate begins with returning to the Word — not tradition, not emotion, but the pure, uncompromised Word of God.\n\nToday, let this verse be more than a memory verse. Let it be a practice. Before making decisions, open the Word. Before speaking words of doubt, speak the Word. Before surrendering to fear, stand on the promises of God. His Word is a lamp — it gives light proportional to your need, one step at a time.\n\nWalk faithfully today. The path may be narrow, but it is lit by eternal truth.",
        prayerFocus: "Lord, illuminate my path today with Your Word. Let every decision I make be guided by Scripture, not by my own understanding.",
        declaration: "I walk in the light of God's Word today — my steps are ordered, my path is clear, and His truth leads me.",
      };
    }

    devotionCache.set(today, devotion);

    if (devotionCache.size > 7) {
      const oldest = Array.from(devotionCache.keys()).sort()[0];
      if (oldest) devotionCache.delete(oldest);
    }

    res.json({ devotion, cached: false });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Devotion generation failed";
    res.status(500).json({ error: msg });
  }
});

function getDayTheme(day: number): string {
  const themes = [
    "rest, Sabbath, and the presence of God",
    "new beginnings and fresh mercies",
    "perseverance and steadfast faith",
    "wisdom and sound doctrine",
    "prayer and spiritual warfare",
    "holiness and consecration",
    "gratitude and praise",
  ];
  return themes[day] ?? "faith and trust in God";
}

export default router;

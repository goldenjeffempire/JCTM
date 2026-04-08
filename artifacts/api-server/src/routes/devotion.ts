import { Router, type IRouter, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

interface DailyDevotion {
  date: string;
  title: string;
  scripture: string;
  reference: string;
  reflection: string;
  propheticWord: string;
  prayerFocus: string;
  declaration: string;
}

const devotionCache = new Map<string, DailyDevotion>();

const DEVOTION_SYSTEM_PROMPT = `You are a daily devotion writer and prophetic voice for Jesus Christ Temple Ministry (JCTM), Warri, Nigeria. 
You write in the spirit of the Correction Mandate — sound doctrine, holiness, apostolic truth, and genuine faith.
Prophet Amos Evomobor leads this ministry. He carries a strong prophetic anointing rooted in the Word.

Guidelines:
- Draw from KJV/NKJV scriptures
- Focus on practical holiness, faith, and doctrinal truth
- Avoid prosperity gospel themes
- Write with warmth, depth, and pastoral care
- Connect the devotion to everyday Nigerian and global Christian life
- The propheticWord should feel like a direct word from the Lord for today — bold, specific, and scriptural. It is a short prophetic utterance (2-4 sentences), written in first person as if God is speaking ("I say to you…", "This is the hour…", "Do not fear…"). It should align with the devotion's theme.

Return ONLY a valid JSON object with NO markdown wrapper, NO code blocks, and NO extra text. Return the raw JSON object only.
The JSON must have exactly these fields:
{
  "title": "Short devotion title (5-8 words)",
  "scripture": "The exact Bible verse text (full verse)",
  "reference": "Book Chapter:Verse (e.g., John 3:16)",
  "reflection": "2-3 paragraphs of devotional reflection (200-280 words total)",
  "propheticWord": "A short prophetic daily word for today (2-4 sentences, first-person as if God is speaking, bold and scriptural, aligned with the theme)",
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
Include a bold, specific prophetic word for today that speaks directly to the hearts of believers.
Return ONLY the raw JSON object, no markdown, no code blocks.`,
        },
      ],
      temperature: 0.78,
      max_tokens: 900,
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    let devotion: DailyDevotion;

    try {
      const cleaned = raw.replace(/^```(?:json)?\n?/i, "").replace(/```\s*$/m, "").trim();
      devotion = JSON.parse(cleaned);
      devotion.date = today;
      if (!devotion.propheticWord) {
        devotion.propheticWord = "This is a season of alignment. I am bringing My people back to the ancient paths — the paths of holiness, truth, and consecration. Do not grow weary, for I have not forgotten you. Walk faithfully and My glory will be your reward.";
      }
    } catch {
      devotion = {
        date: today,
        title: "Walk in the Light of His Word",
        scripture: "Your word is a lamp to my feet and a light to my path.",
        reference: "Psalm 119:105",
        reflection: "The Word of God is not merely a book — it is a living lamp that illuminates every step of our journey. In seasons of confusion, uncertainty, or spiritual warfare, the believer's anchor remains the unchanging truth of Scripture. Prophet Amos Evomobor often teaches that the Correction Mandate begins with returning to the Word — not tradition, not emotion, but the pure, uncompromised Word of God.\n\nToday, let this verse be more than a memory verse. Let it be a practice. Before making decisions, open the Word. Before speaking words of doubt, speak the Word. Before surrendering to fear, stand on the promises of God. His Word is a lamp — it gives light proportional to your need, one step at a time.\n\nWalk faithfully today. The path may be narrow, but it is lit by eternal truth.",
        propheticWord: "I say to you this day: do not lean on the understanding of men, for My Word is sufficient. This is an hour of returning — returning to the simplicity of the Gospel, to the purity of truth. Open your heart and I will pour fresh light on your path. The ancient paths are still the right paths.",
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
    "rest, Sabbath, and entering God's presence with stillness and worship",
    "new beginnings, fresh mercies, and the grace to start again",
    "perseverance, endurance, and steadfast faith through trials",
    "wisdom, sound doctrine, and the fear of the Lord",
    "prayer, intercession, and spiritual warfare through the Word",
    "holiness, consecration, and separation from worldliness",
    "gratitude, praise, and reflecting on God's faithfulness this week",
  ];
  return themes[day] ?? "faith and trusting God in every season";
}

export default router;

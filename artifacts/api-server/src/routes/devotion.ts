import { Router, type IRouter, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, devotionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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

const FALLBACK_POOL: Omit<DailyDevotion, "date">[] = [
  {
    title: "Walk in the Light of His Word",
    scripture: "Your word is a lamp to my feet and a light to my path.",
    reference: "Psalm 119:105",
    reflection:
      "The Word of God is not merely a book — it is a living lamp that illuminates every step of our journey. In seasons of confusion, uncertainty, or spiritual warfare, the believer's anchor remains the unchanging truth of Scripture. Prophet Amos Evomobor often teaches that the Correction Mandate begins with returning to the Word — not tradition, not emotion, but the pure, uncompromised Word of God.\n\nToday, let this verse be more than a memory verse. Let it be a practice. Before making decisions, open the Word. Before speaking words of doubt, speak the Word. Before surrendering to fear, stand on the promises of God. His Word is a lamp — it gives light proportional to your need, one step at a time.\n\nWalk faithfully today. The path may be narrow, but it is lit by eternal truth.",
    propheticWord:
      "I say to you this day: do not lean on the understanding of men, for My Word is sufficient. This is an hour of returning — returning to the simplicity of the Gospel, to the purity of truth. Open your heart and I will pour fresh light on your path. The ancient paths are still the right paths.",
    prayerFocus:
      "Lord, illuminate my path today with Your Word. Let every decision I make be guided by Scripture, not by my own understanding.",
    declaration:
      "I walk in the light of God's Word today — my steps are ordered, my path is clear, and His truth leads me.",
  },
  {
    title: "His Mercies Are New Every Morning",
    scripture:
      "It is of the LORD's mercies that we are not consumed, because his compassions fail not. They are new every morning: great is thy faithfulness.",
    reference: "Lamentations 3:22-23",
    reflection:
      "Every morning is a fresh declaration from heaven that God has not finished with you. The prophet Jeremiah penned these words in the middle of ruins — yet found reason to declare God's faithfulness. This is the posture of a believer who understands grace: not that life is always easy, but that God's compassion never runs dry.\n\nIn a world that often measures worth by performance, God offers a gift no one can earn — mercy that resets with every sunrise. Yesterday's failures do not define today's possibilities. His faithfulness is not tied to your consistency; it flows from His unchanging character.\n\nBegin today not with your to-do list, but with a declaration of His faithfulness. Before the pressures of the day crowd in, take a moment and say aloud: 'Great is thy faithfulness.' Let it be your anchor before the storms arise.",
    propheticWord:
      "This is a new day, and I am doing a new thing. Do not dwell on what has passed — look ahead, for I am opening doors that no man can shut. My mercies are your portion, and My strength is your foundation. Rise and take hold of what I have prepared.",
    prayerFocus:
      "Father, thank You for new mercy today. Help me to receive Your grace afresh and not carry yesterday's burdens into this morning.",
    declaration:
      "God's mercies are new over my life today — I receive His faithfulness and step into this day covered by grace.",
  },
  {
    title: "The Fear of the Lord Is Your Treasure",
    scripture:
      "And he will be the stability of your times, abundance of salvation, wisdom, and knowledge; the fear of the LORD is Zion's treasure.",
    reference: "Isaiah 33:6",
    reflection:
      "The culture around us often prizes boldness, self-reliance, and human wisdom. But the Word of God consistently points to a different kind of treasure — the fear of the Lord. This is not terror or dread; it is a holy reverence, a deep awe of who God is that causes us to align our lives with His will.\n\nWhen we walk in the fear of the Lord, stability follows. Decisions become clearer. Temptations lose their grip. The pursuit of holiness becomes natural because we genuinely value what God values. Prophet Amos often says that the greatest protection a believer can carry is not wealth or influence — it is the fear of God.\n\nAsk yourself today: Do my choices reflect a reverence for God? Does my private life match my public profession? The fear of the Lord is not a burden — it is the doorway to wisdom, to true abundance, and to the kind of stability that the world cannot offer.",
    propheticWord:
      "I am calling My people back to holy reverence. The fear of the Lord is the beginning of wisdom, and wisdom is what I am releasing in this season. Those who honour Me, I will honour. Draw near with a clean heart and watch Me move in ways you have not seen before.",
    prayerFocus:
      "Lord, cultivate in me a deep and holy fear of You. Let my reverence for You shape every decision, every word, and every action today.",
    declaration:
      "I walk in the fear of the Lord today — this is my treasure, my stability, and the source of all true wisdom in my life.",
  },
  {
    title: "Stand Firm — God Is Fighting for You",
    scripture:
      "The LORD will fight for you; you need only to be still.",
    reference: "Exodus 14:14",
    reflection:
      "Israel stood at the edge of the Red Sea with Pharaoh's army closing in behind them. Every natural instinct screamed to panic — but God's instruction was radical: be still. Not passive, but trusting. Not fearful, but faith-filled. And God split the sea.\n\nYou may be standing at your own Red Sea today — a situation that looks impossible, a problem that surrounds you on every side. The same God who fought for Israel is fighting for you. His arm is not shortened. His power has not diminished. The enemy chasing you will not have the final word.\n\nBeing still is not doing nothing — it is choosing to rest your confidence in God rather than in human strategy. It is worship in the middle of warfare. It is declaring, 'I trust You, Lord,' when every circumstance says otherwise. Be still. God has never lost a battle.",
    propheticWord:
      "Do not be moved by what you see — I am at work behind what your eyes cannot perceive. The battle belongs to Me. Stand in faith, hold your position, and you will see My salvation come to pass. What has seemed impossible will become your testimony.",
    prayerFocus:
      "Lord, help me to be still and trust You completely today. Silence the panic in my heart and let Your peace, which passes understanding, guard my mind.",
    declaration:
      "The Lord is fighting for me — I stand still, I trust completely, and I declare victory in every area of my life today.",
  },
  {
    title: "Holiness Is the Path, Not the Prison",
    scripture:
      "But just as he who called you is holy, so be holy in all you do; for it is written: 'Be holy, because I am holy.'",
    reference: "1 Peter 1:15-16",
    reflection:
      "Many believers secretly view holiness as a restriction — a list of things they cannot do. But the Correction Mandate that God placed on JCTM challenges this thinking at its root. Holiness is not a cage; it is the character of God expressed through surrendered lives. It is not about what you give up — it is about who you become.\n\nThe call to be holy is the call to resemble your Father. Just as a child naturally takes on the character of their parent, we as sons and daughters of God are transformed into His likeness as we walk in surrender. This process requires intentionality — guarding what we watch, what we speak, who we spend our time with, and what we allow into our hearts.\n\nHoliness brings freedom. It frees you from the guilt that sin carries. It frees you from the confusion of double-mindedness. It frees you from the fear of judgment. Today, embrace holiness not as a burden but as a blessing — a mark of belonging to a holy God.",
    propheticWord:
      "This is a season of consecration. I am calling My people to separate themselves — not in pride, but in purpose. Holiness is the garment of My presence, and those who put it on will walk in My glory. Do not compromise what I have set apart; the reward of consecration is the fullness of My Spirit.",
    prayerFocus:
      "Father, create in me a clean heart and renew a right spirit within me. Help me to pursue holiness in every area of my life — not out of duty, but out of love for You.",
    declaration:
      "I am called to holiness and I embrace it fully — my life reflects the character of a holy God in everything I say, think, and do today.",
  },
  {
    title: "Prayer Is Your Weapon and Your Breath",
    scripture:
      "Pray without ceasing.",
    reference: "1 Thessalonians 5:17",
    reflection:
      "Three words — one of the most challenging commands in all of Scripture. How does one pray without ceasing? Not by abandoning daily life to kneel continuously, but by cultivating a life where communion with God is as natural as breathing. Prayer is not a religious ritual performed at fixed times; it is a lifestyle of dependency on God.\n\nWhen you wake up — pray. When you face a decision — pray. When fear creeps in — pray. When victory comes — pray. The believer who prays without ceasing is one who has trained their spirit to instinctively reach for God in every moment. This kind of prayer life builds an unshakeable foundation that the enemy cannot breach.\n\nJCTM is a house of prayer. Prophet Amos has long taught that prayer is not preparation for the battle — prayer is the battle. Every breakthrough you carry in your hand began as a cry in your heart. Do not neglect your secret place. Do not let the busyness of life silence your altar.",
    propheticWord:
      "I am listening. Every prayer you have prayed has been heard — none has fallen to the ground. This is the season when I will answer in ways that will cause you to say, 'The Lord has done great things.' Keep praying. Keep believing. Your persistence in prayer is moving things in the unseen realm.",
    prayerFocus:
      "Lord, teach me to pray without ceasing. Help me to stay connected to You in every moment of this day, not just in the quiet times but in the chaos too.",
    declaration:
      "Prayer is my weapon and my breath — I stay connected to God all day, and His power flows through my life without interruption.",
  },
  {
    title: "Trust the Process — God Is Not Done",
    scripture:
      "Being confident of this, that he who began a good work in you will carry it on to completion until the day of Christ Jesus.",
    reference: "Philippians 1:6",
    reflection:
      "Perhaps the most difficult thing for a believer to do is wait — to trust that God is still working when nothing appears to be changing. The process of spiritual growth is rarely dramatic; it is often quiet, slow, and filled with what feels like ordinary days. Yet it is in those ordinary days that God is doing His deepest work.\n\nThe Apostle Paul wrote these words from prison — not from a comfortable seat of success. He had learned to trust the process because he had seen the faithfulness of God enough times to know that every beginning God starts, He finishes. Your story is not over. Your promise is not cancelled. The silence you feel is not abandonment — it is formation.\n\nGod is completing something in you that is bigger than your current perspective allows you to see. The patience required today is the very thing that will make you ready for tomorrow's assignment. Trust Him with the process, not just the outcome.",
    propheticWord:
      "What I have started in you, I will finish. Do not look at the current chapter and call it the conclusion — I am writing a story that will glorify My name. Stay steady. Stay surrendered. The completion of My work in you is closer than it appears. I am not slow; I am precise.",
    prayerFocus:
      "Lord, help me to trust Your timing and Your process. When I am tempted to give up or rush ahead, remind me that You are faithful to complete what You began.",
    declaration:
      "God who began a good work in me is faithful to complete it — I trust His process, I embrace His timing, and I rest in His faithfulness today.",
  },
];

function getFallbackForDate(dateStr: string): Omit<DailyDevotion, "date"> {
  const d = new Date(dateStr);
  const dayOfYear = Math.floor(
    (d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000
  );
  return FALLBACK_POOL[dayOfYear % FALLBACK_POOL.length]!;
}

router.get("/devotion/daily", async (_req: Request, res: Response): Promise<void> => {
  const today = new Date().toISOString().split("T")[0]!;

  try {
    const existing = await db
      .select()
      .from(devotionsTable)
      .where(eq(devotionsTable.date, today))
      .limit(1);

    if (existing.length > 0) {
      const row = existing[0]!;
      res.json({
        devotion: {
          date: row.date,
          title: row.title,
          scripture: row.scripture,
          reference: row.reference,
          reflection: row.reflection,
          propheticWord: row.propheticWord,
          prayerFocus: row.prayerFocus,
          declaration: row.declaration,
        } satisfies DailyDevotion,
        cached: true,
      });
      return;
    }

    const dayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
    const monthDay = new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    let devotionData: Omit<DailyDevotion, "date">;

    try {
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
        max_completion_tokens: 8192,
      });

      const raw = completion.choices[0]?.message?.content ?? "";
      const cleaned = raw.replace(/^```(?:json)?\n?/i, "").replace(/```\s*$/m, "").trim();
      const parsed = JSON.parse(cleaned) as Omit<DailyDevotion, "date">;
      if (!parsed.propheticWord) {
        parsed.propheticWord = getFallbackForDate(today).propheticWord;
      }
      devotionData = parsed;
    } catch {
      devotionData = getFallbackForDate(today);
    }

    const devotion: DailyDevotion = { date: today, ...devotionData };

    await db.insert(devotionsTable).values({
      date: today,
      title: devotion.title,
      scripture: devotion.scripture,
      reference: devotion.reference,
      reflection: devotion.reflection,
      propheticWord: devotion.propheticWord,
      prayerFocus: devotion.prayerFocus,
      declaration: devotion.declaration,
    }).onConflictDoNothing();

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

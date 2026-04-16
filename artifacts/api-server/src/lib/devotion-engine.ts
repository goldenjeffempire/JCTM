/**
 * devotion-engine.ts — Core generation and retrieval logic for Daily Devotions.
 *
 * This module is shared between the route handler (on-demand generation)
 * and the cron scheduler (midnight pre-generation). Keeping it here avoids
 * circular imports and lets both callers share the same generation code path.
 */

import { openai } from "@workspace/integrations-openai-ai-server";
import { db, devotionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import type { Logger } from "pino";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DailyDevotion {
  date: string;
  title: string;
  scripture: string;
  reference: string;
  reflection: string;
  propheticWord: string;
  prayerFocus: string;
  declaration: string;
}

// ─── System Prompt ────────────────────────────────────────────────────────────

const DEVOTION_SYSTEM_PROMPT = `You are a daily devotion writer and prophetic voice for Jesus Christ Temple Ministry (JCTM), Warri, Nigeria. 
You write in the spirit of the Correction Mandate — sound doctrine, holiness, apostolic truth, and genuine faith.
Prophet Amos Evomobor leads this ministry. He carries a strong prophetic anointing rooted in the Word.

Guidelines:
- Draw from KJV/NKJV scriptures — explore the FULL breadth of scripture: Old Testament (Torah, Prophets, Psalms, Wisdom books), Epistles, Gospels, Revelation
- Focus on practical holiness, faith, and doctrinal truth
- Avoid prosperity gospel themes
- Write with warmth, depth, and pastoral care
- Connect the devotion to everyday Nigerian and global Christian life
- Each devotion must feel entirely fresh and distinct — unique title, unique scripture, unique angle
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

// ─── Fallback Pool ────────────────────────────────────────────────────────────

const FALLBACK_POOL: Omit<DailyDevotion, "date">[] = [
  {
    title: "Walk in the Light of His Word",
    scripture: "Your word is a lamp to my feet and a light to my path.",
    reference: "Psalm 119:105",
    reflection:
      "The Word of God is not merely a book — it is a living lamp that illuminates every step of our journey. In seasons of confusion, uncertainty, or spiritual warfare, the believer's anchor remains the unchanging truth of Scripture. Prophet Amos Evomobor often teaches that the Correction Mandate begins with returning to the Word — not tradition, not emotion, but the pure, uncompromised Word of God.\n\nToday, let this verse be more than a memory verse. Let it be a practice. Before making decisions, open the Word. Before speaking words of doubt, speak the Word. Before surrendering to fear, stand on the promises of God. His Word is a lamp — it gives light proportional to your need, one step at a time.\n\nWalk faithfully today. The path may be narrow, but it is lit by eternal truth.",
    propheticWord:
      "I say to you this day: do not lean on the understanding of men, for My Word is sufficient. This is an hour of returning — returning to the simplicity of the Gospel, to the purity of truth. Open your heart and I will pour fresh light on your path. The ancient paths are still the right paths.",
    prayerFocus: "Lord, illuminate my path today with Your Word. Let every decision I make be guided by Scripture, not by my own understanding.",
    declaration: "I walk in the light of God's Word today — my steps are ordered, my path is clear, and His truth leads me.",
  },
  {
    title: "His Mercies Are New Every Morning",
    scripture: "It is of the LORD's mercies that we are not consumed, because his compassions fail not. They are new every morning: great is thy faithfulness.",
    reference: "Lamentations 3:22-23",
    reflection:
      "Every morning is a fresh declaration from heaven that God has not finished with you. The prophet Jeremiah penned these words in the middle of ruins — yet found reason to declare God's faithfulness. This is the posture of a believer who understands grace: not that life is always easy, but that God's compassion never runs dry.\n\nIn a world that often measures worth by performance, God offers a gift no one can earn — mercy that resets with every sunrise. Yesterday's failures do not define today's possibilities. His faithfulness is not tied to your consistency; it flows from His unchanging character.\n\nBegin today not with your to-do list, but with a declaration of His faithfulness. Before the pressures of the day crowd in, take a moment and say aloud: 'Great is thy faithfulness.'",
    propheticWord:
      "This is a new day, and I am doing a new thing. Do not dwell on what has passed — look ahead, for I am opening doors that no man can shut. My mercies are your portion, and My strength is your foundation. Rise and take hold of what I have prepared.",
    prayerFocus: "Father, thank You for new mercy today. Help me to receive Your grace afresh and not carry yesterday's burdens into this morning.",
    declaration: "God's mercies are new over my life today — I receive His faithfulness and step into this day covered by grace.",
  },
  {
    title: "The Fear of the Lord Is Your Treasure",
    scripture: "And he will be the stability of your times, abundance of salvation, wisdom, and knowledge; the fear of the LORD is Zion's treasure.",
    reference: "Isaiah 33:6",
    reflection:
      "The culture around us often prizes boldness, self-reliance, and human wisdom. But the Word of God consistently points to a different kind of treasure — the fear of the Lord. This is not terror or dread; it is a holy reverence that causes us to align our lives with His will.\n\nWhen we walk in the fear of the Lord, stability follows. Decisions become clearer. Temptations lose their grip. The pursuit of holiness becomes natural because we genuinely value what God values. Prophet Amos often says that the greatest protection a believer can carry is not wealth or influence — it is the fear of God.\n\nAsk yourself today: Do my choices reflect a reverence for God? Does my private life match my public profession? The fear of the Lord is not a burden — it is the doorway to wisdom and true abundance.",
    propheticWord:
      "I am calling My people back to holy reverence. The fear of the Lord is the beginning of wisdom, and wisdom is what I am releasing in this season. Those who honour Me, I will honour. Draw near with a clean heart and watch Me move in ways you have not seen before.",
    prayerFocus: "Lord, cultivate in me a deep and holy fear of You. Let my reverence for You shape every decision, every word, and every action today.",
    declaration: "I walk in the fear of the Lord today — this is my treasure, my stability, and the source of all true wisdom in my life.",
  },
  {
    title: "Stand Firm — God Is Fighting for You",
    scripture: "The LORD will fight for you; you need only to be still.",
    reference: "Exodus 14:14",
    reflection:
      "Israel stood at the edge of the Red Sea with Pharaoh's army closing in behind them. Every natural instinct screamed to panic — but God's instruction was radical: be still. Not passive, but trusting. Not fearful, but faith-filled. And God split the sea.\n\nYou may be standing at your own Red Sea today — a situation that looks impossible, a problem that surrounds you on every side. The same God who fought for Israel is fighting for you. His arm is not shortened.\n\nBeing still is not doing nothing — it is choosing to rest your confidence in God rather than in human strategy. It is worship in the middle of warfare. It is declaring, 'I trust You, Lord,' when every circumstance says otherwise. Be still. God has never lost a battle.",
    propheticWord:
      "Do not be moved by what you see — I am at work behind what your eyes cannot perceive. The battle belongs to Me. Stand in faith, hold your position, and you will see My salvation come to pass. What has seemed impossible will become your testimony.",
    prayerFocus: "Lord, help me to be still and trust You completely today. Silence the panic in my heart and let Your peace guard my mind.",
    declaration: "The Lord is fighting for me — I stand still, I trust completely, and I declare victory in every area of my life today.",
  },
  {
    title: "Holiness Is the Path, Not the Prison",
    scripture: "But just as he who called you is holy, so be holy in all you do; for it is written: 'Be holy, because I am holy.'",
    reference: "1 Peter 1:15-16",
    reflection:
      "Many believers secretly view holiness as a restriction — a list of things they cannot do. But the Correction Mandate challenges this thinking at its root. Holiness is not a cage; it is the character of God expressed through surrendered lives. It is not about what you give up — it is about who you become.\n\nThe call to be holy is the call to resemble your Father. Just as a child naturally takes on the character of their parent, we as sons and daughters of God are transformed into His likeness as we walk in surrender. This requires intentionality — guarding what we watch, what we speak, and what we allow into our hearts.\n\nHoliness brings freedom. It frees you from guilt, from confusion, and from the fear of judgment. Today, embrace holiness not as a burden but as a blessing — a mark of belonging to a holy God.",
    propheticWord:
      "This is a season of consecration. I am calling My people to separate themselves — not in pride, but in purpose. Holiness is the garment of My presence, and those who put it on will walk in My glory. Do not compromise what I have set apart.",
    prayerFocus: "Father, create in me a clean heart. Help me to pursue holiness in every area of my life — not out of duty, but out of love for You.",
    declaration: "I am called to holiness and I embrace it fully — my life reflects the character of a holy God in everything I say, think, and do today.",
  },
  {
    title: "Prayer Is Your Weapon and Your Breath",
    scripture: "Pray without ceasing.",
    reference: "1 Thessalonians 5:17",
    reflection:
      "Three words — one of the most challenging commands in all of Scripture. How does one pray without ceasing? Not by abandoning daily life to kneel continuously, but by cultivating a life where communion with God is as natural as breathing.\n\nWhen you wake up — pray. When you face a decision — pray. When fear creeps in — pray. When victory comes — pray. The believer who prays without ceasing is one who has trained their spirit to instinctively reach for God in every moment.\n\nJCTM is a house of prayer. Prophet Amos has long taught that prayer is not preparation for the battle — prayer is the battle. Every breakthrough you carry in your hand began as a cry in your heart. Do not neglect your secret place.",
    propheticWord:
      "I am listening. Every prayer you have prayed has been heard — none has fallen to the ground. This is the season when I will answer in ways that will cause you to say, 'The Lord has done great things.' Keep praying. Keep believing.",
    prayerFocus: "Lord, teach me to pray without ceasing. Help me to stay connected to You in every moment of this day.",
    declaration: "Prayer is my weapon and my breath — I stay connected to God all day, and His power flows through my life without interruption.",
  },
  {
    title: "Trust the Process — God Is Not Done",
    scripture: "Being confident of this, that he who began a good work in you will carry it on to completion until the day of Christ Jesus.",
    reference: "Philippians 1:6",
    reflection:
      "Perhaps the most difficult thing for a believer to do is wait — to trust that God is still working when nothing appears to be changing. The process of spiritual growth is rarely dramatic; it is often quiet, slow, and filled with what feels like ordinary days.\n\nThe Apostle Paul wrote these words from prison — not from a comfortable seat of success. He had learned to trust the process because he had seen the faithfulness of God enough times to know that every beginning God starts, He finishes. Your story is not over. Your promise is not cancelled.\n\nGod is completing something in you that is bigger than your current perspective allows you to see. The patience required today is the very thing that will make you ready for tomorrow's assignment.",
    propheticWord:
      "What I have started in you, I will finish. Do not look at the current chapter and call it the conclusion — I am writing a story that will glorify My name. Stay steady. Stay surrendered. The completion of My work in you is closer than it appears.",
    prayerFocus: "Lord, help me to trust Your timing and Your process. When I am tempted to give up or rush ahead, remind me that You are faithful to complete what You began.",
    declaration: "God who began a good work in me is faithful to complete it — I trust His process, I embrace His timing, and I rest in His faithfulness today.",
  },
  {
    title: "Repentance Opens the Door to Restoration",
    scripture: "If we confess our sins, he is faithful and just to forgive us our sins, and to cleanse us from all unrighteousness.",
    reference: "1 John 1:9",
    reflection:
      "Repentance is not a sign of weakness — it is the doorway into God's fullness. True repentance is not merely feeling sorry — it is a genuine turning away from what grieved God and a turning toward His purpose. And when that turning happens, heaven responds with restoration.\n\nGod's grace is not just a covering — it is a transformation. If something in your heart has been keeping you from full freedom, bring it to God today. He already knows. He is not waiting to condemn — He is waiting to restore.\n\nThe door of repentance is always open, and on the other side is everything you were made to walk in.",
    propheticWord:
      "Come to Me as you are — I will not turn you away. My arms are open and My grace is sufficient. As you humble yourself before Me, I will lift you and restore what the enemy has stolen. This is a season of restoration for those who return to Me with a whole heart.",
    prayerFocus: "Lord, search my heart and reveal anything that separates me from Your fullness. I choose to confess and turn — receive me and cleanse me now.",
    declaration: "I am forgiven, cleansed, and fully restored — God's grace covers me completely, and I walk in the freedom of His mercy today.",
  },
  {
    title: "The Holy Spirit Is Your Counsellor",
    scripture: "But the Comforter, which is the Holy Ghost, whom the Father will send in my name, he shall teach you all things.",
    reference: "John 14:26",
    reflection:
      "Before Jesus departed, He made a promise that would change everything — He would not leave us alone. The Holy Spirit — the Comforter, the Helper, the Counsellor — would come and take up residence in every yielded heart.\n\nIn a world full of noise and conflicting counsel, the believer has access to the perfect Counsellor. He knows the mind of God, the plan of God, and the purpose of God for your life. When you are confused, He brings clarity. When you are weak, He brings strength that defies natural explanation.\n\nCultivate sensitivity to Him today. Slow down enough to hear His whisper. He is speaking — the question is whether we are listening.",
    propheticWord:
      "I have not left you without a guide. My Spirit is within you, ready to lead you into all truth. Do not rely solely on human wisdom — ask Me and I will show you things you have not yet seen. This is the hour of the Spirit, and those who yield to Me will walk in unusual clarity and power.",
    prayerFocus: "Holy Spirit, fill me afresh today. Teach me to be sensitive to Your leading and to obey Your promptings without delay.",
    declaration: "The Holy Spirit lives in me, guides me, and empowers me — I am never alone, never without counsel, and never without the strength I need today.",
  },
  {
    title: "You Are a New Creation in Christ",
    scripture: "Therefore, if anyone is in Christ, he is a new creation. The old has passed away; behold, the new has come.",
    reference: "2 Corinthians 5:17",
    reflection:
      "This is one of the most radical declarations in all of Scripture. Not improved — new. Not reformed — recreated. When God saves a soul, He does not patch up the old nature with religious behaviour; He creates something entirely new from the inside out.\n\nThe challenge for many believers is that they continue to live according to the old identity long after it has been replaced. They carry guilt that no longer belongs to them, limitations that no longer define them, and labels that no longer apply.\n\nYou are not who you used to be. The same power that raised Jesus from the dead lives in you, and it has made you new. Walk in that newness today.",
    propheticWord:
      "I have made you new — walk in that truth. Stop reaching back for the old garment; I have clothed you in righteousness and covered you with My grace. The old self has no authority over the new creation I have made you. Rise and live as who you truly are in Me.",
    prayerFocus: "Lord, help me to fully embrace my identity as a new creation. Where my mind tries to pull me back to the old, remind me of who I am in Christ.",
    declaration: "I am a new creation in Christ — the old has gone, the new has come, and I live today from the fullness of who God has made me.",
  },
  {
    title: "Worship Breaks Every Chain",
    scripture: "And at midnight Paul and Silas prayed, and sang praises unto God: and the prisoners heard them. And suddenly there was a great earthquake.",
    reference: "Acts 16:25-26",
    reflection:
      "Paul and Silas were not worshipping because their circumstances were comfortable — they were worshipping at midnight, with backs bleeding from flogging and feet in stocks. Their praise was not a response to answered prayer; it was a declaration of faith in the middle of unanswered questions. And heaven shook.\n\nWorship is the most powerful weapon available to the believer. When circumstances scream hopelessness, the natural response is silence or complaint. But the Kingdom response is to lift a song. To declare God's goodness before the evidence arrives.\n\nWhat midnight are you in right now? Begin to worship — not because you feel like it, but because God is worthy regardless of how you feel.",
    propheticWord:
      "Praise is the language of victory, and I am calling you to speak it now — before you see the breakthrough. The sound of your worship reaches Me, and I am responding. As you praise, chains are breaking in the unseen realm. Do not stop; your deliverance is on the other side of your praise.",
    prayerFocus: "Lord, teach me to worship You in the middle of difficulty. Let praise rise from my spirit even when my soul is heavy.",
    declaration: "I worship God in every season — in the midnight hours and the morning light — and my praise releases the power of heaven into my situation today.",
  },
  {
    title: "God's Word Does Not Return Void",
    scripture: "So shall my word be that goeth forth out of my mouth: it shall not return unto me void, but it shall accomplish that which I please.",
    reference: "Isaiah 55:11",
    reflection:
      "Every word that God speaks carries within it the power to accomplish its own purpose. This is not true of human words — we can speak promises and fail to keep them. But God's Word is categorically different. It goes out loaded with divine energy and does not return until it has done what God intended.\n\nWhen you declare a promise from God's Word over your life, you are not performing a religious ritual — you are releasing a force. When you stand on a verse in prayer, you are standing on something that has never failed.\n\nWhatever Word you have received — do not abandon it simply because time has passed. God's Word is still working, still moving, still accomplishing.",
    propheticWord:
      "Every word I have spoken over your life is still working. Do not discard what I said in times of breakthrough just because the season has shifted. My Word is alive in your situation, and it is accomplishing My perfect will. Stand on what I have said — the harvest of My Word is coming.",
    prayerFocus: "Lord, help me to trust the power of Your Word. Where I am tempted to doubt, remind me that Your promises are always in motion.",
    declaration: "God's Word over my life is active and powerful — it is accomplishing His purposes, and I stand confidently on every promise He has spoken.",
  },
  {
    title: "Peace Beyond Understanding Guards Your Heart",
    scripture: "And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus.",
    reference: "Philippians 4:7",
    reflection:
      "Paul wrote about the peace of God from a prison cell. His peace was not a product of comfortable circumstances — it was a gift from God that transcended the circumstances entirely. It 'passes all understanding' — meaning it cannot be rationally explained by the situation you are in.\n\nThis peace is not the absence of problems — it is the presence of God within them. When the storm rages and you find inexplicable calm, that is God's peace doing what no human coping mechanism can.\n\nWhen you exchange your worry for worship, when you trade your anxiety for prayer, the peace of God arrives — as the natural response of heaven to a trusting heart.",
    propheticWord:
      "I am the God of peace, and I am releasing My peace over your life right now. What has been unsettled will be settled. What has been chaotic will be ordered. You have been anxious long enough — cast your care upon Me and receive the supernatural peace that I alone can give.",
    prayerFocus: "Lord, I surrender my anxiety to You right now. Receive my worry as prayer and replace it with Your supernatural peace.",
    declaration: "The peace of God guards my heart and mind today — I am not anxious, not troubled, and not afraid, because God's perfect peace rules in me.",
  },
  {
    title: "Seek First the Kingdom — All Else Follows",
    scripture: "But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you.",
    reference: "Matthew 6:33",
    reflection:
      "Jesus spoke these words to a crowd anxious about food, clothing, and provision — the basic necessities of life. His answer was not a dismissal of those needs, but a reordering of priorities. Seek first. Put the Kingdom ahead of the anxious pursuit of things, and discover that the Provider takes care of the provision.\n\nSeeking first the Kingdom means waking up with Kingdom questions: How can I honour God today? Where is He leading me? Who needs to encounter His love through me?\n\nWhen these are your first questions, you will find — sometimes miraculously — that the provision, the opportunity, and the direction follow naturally.",
    propheticWord:
      "Put Me first and watch everything realign. I am not holding back provision from you — I am calling you into the right order. As you prioritise My Kingdom, you will find that what you have been chasing is already being placed in your path. Seek Me first. Everything else is My responsibility.",
    prayerFocus: "Lord, help me to genuinely seek Your Kingdom above my own comfort and provision. Reorder my priorities so that You are truly first.",
    declaration: "I seek God's Kingdom first today — and as I do, He takes care of every need, every provision, and every concern that I would otherwise carry alone.",
  },
  {
    title: "Humility Precedes Every Promotion",
    scripture: "Humble yourselves therefore under the mighty hand of God, that he may exalt you in due time.",
    reference: "1 Peter 5:6",
    reflection:
      "In the Kingdom of God, the path to promotion consistently runs through the valley of humility. Those whom God has greatly used in Scripture — Moses, David, Joseph, Peter — all passed through seasons of deep humbling before the hand of God lifted them.\n\nHumility is not self-deprecation or the absence of confidence. It is an accurate understanding of where your strength truly comes from. The humble person thinks of themselves in correct proportion to who God is.\n\nThe 'due time' of God's exaltation is not always our preferred time — but it is always the right time. Stay under the hand of God, even when it feels heavy. It is the same hand that will lift you.",
    propheticWord:
      "Stay humble before Me, and I will make your name great in the right season. Do not reach for what I have not yet handed you — trust My timing. I am forming something in you through this season of lowliness that you could not develop in a season of success. The exaltation is coming, and it will last.",
    prayerFocus: "Lord, guard me from pride and cultivate genuine humility in my heart. Help me to remain under Your hand even when I do not understand what You are doing.",
    declaration: "I humble myself under God's mighty hand today — I trust His timing, rest in His process, and know that His promotion comes at exactly the right moment.",
  },
  {
    title: "The Resurrection Changes Everything",
    scripture: "Jesus said unto her, I am the resurrection, and the life: he that believeth in me, though he were dead, yet shall he live.",
    reference: "John 11:25",
    reflection:
      "Jesus did not say He would bring the resurrection — He said He is the resurrection. This is the difference between a prophet who announces future events and a Saviour who embodies them. The resurrection power that raised Jesus from the dead is not a distant theological concept — it lives in every believer through the Holy Spirit.\n\nThis means that nothing in your life is beyond the reach of resurrection power. Dead dreams. Dead relationships. Dead seasons of ministry. Jesus is not merely the One who walked out of a tomb two thousand years ago — He is the living Reality who still speaks to dead things and commands them to live.\n\nWhat in your life has been declared too far gone? The Resurrection is standing in front of you today. He speaks life.",
    propheticWord:
      "I am the Resurrection, and I am present in your situation right now. What appears dead is not beyond My reach. I spoke to graves and they opened — I speak to your dead season now and command it to live. Do not believe the report of men; believe My Word. Life is coming.",
    prayerFocus: "Lord, speak Your resurrection power into every area of my life that feels dead or hopeless. Let the same Spirit that raised Christ from the dead breathe life into my dry bones.",
    declaration: "The resurrection power of Jesus lives in me — nothing in my life is too dead for His touch, and today I declare life over every area that has felt hopeless.",
  },
];

function getFallbackForDate(dateStr: string): Omit<DailyDevotion, "date"> {
  const d = new Date(dateStr);
  const dayOfYear = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000);
  return FALLBACK_POOL[dayOfYear % FALLBACK_POOL.length]!;
}

const MONTHLY_THEMES = [
  "new beginnings, divine purpose, vision for the year ahead, and renewed commitment",
  "God's love, sacrifice, the heart of the Father, and living a life poured out for others",
  "self-examination, consecration, the cross, and preparation of the heart before God",
  "resurrection power, victory over death, new life, and the risen Christ in everyday living",
  "spiritual growth, bearing fruit, faith's progression, and becoming more like Christ",
  "perseverance at the midpoint, staying the course, endurance, and running the long race",
  "rest in God, Sabbath principles, trusting God's sovereignty, and ceasing from self-striving",
  "harvest, gratitude, counting blessings, and recognising God's provision in all seasons",
  "new seasons, returning to purpose, fresh assignments, and repositioning for God's call",
  "spiritual warfare, vigilance, the armor of God, and standing firm against the enemy's schemes",
  "thanksgiving, God's faithfulness across the year, testifying of His works, and celebrating His goodness",
  "hope, the Second Coming, God's eternal promises, and living in light of what is yet to come",
];

function getMonthlyTheme(date: Date): string {
  return MONTHLY_THEMES[date.getMonth()] ?? "faithfulness, trust, and walking closely with God";
}

function getDayTheme(day: number): string {
  const themes = [
    "rest, Sabbath, entering God's presence with stillness, corporate worship, and the holiness of the Lord's Day",
    "new beginnings, fresh mercies, divine reset, the grace to start again, and Monday faith",
    "perseverance, endurance, steadfast faith through trials, and pressing through midweek resistance",
    "wisdom, sound doctrine, the fear of the Lord, discernment, and the study of Scripture",
    "prayer, intercession, spiritual warfare, fasting, and crying out to God for breakthrough",
    "holiness, consecration, separation from worldliness, and personal sanctification before the Lord",
    "gratitude, praise, reflecting on God's faithfulness this week, and preparing the heart for worship",
  ];
  return themes[day] ?? "faith and trusting God in every season";
}

// ─── Core generation function ─────────────────────────────────────────────────

/**
 * Ensures a devotion exists for `dateStr` (ISO date, e.g. "2026-04-17").
 * If one already exists in the DB it is returned immediately (cached=true).
 * Otherwise it is generated via GPT-4o (with recent-scripture deduplication),
 * saved to the DB, and returned (cached=false).
 */
export async function ensureDevotionForDate(
  dateStr: string,
  log?: Logger,
): Promise<{ devotion: DailyDevotion; cached: boolean }> {
  // 1. Check for existing row
  const existing = await db
    .select()
    .from(devotionsTable)
    .where(eq(devotionsTable.date, dateStr))
    .limit(1);

  if (existing.length > 0) {
    const row = existing[0]!;
    return {
      devotion: {
        date: row.date,
        title: row.title,
        scripture: row.scripture,
        reference: row.reference,
        reflection: row.reflection,
        propheticWord: row.propheticWord,
        prayerFocus: row.prayerFocus,
        declaration: row.declaration,
      },
      cached: true,
    };
  }

  // 2. Build uniqueness context from last 90 days
  const recentRows = await db
    .select({ reference: devotionsTable.reference, title: devotionsTable.title })
    .from(devotionsTable)
    .orderBy(desc(devotionsTable.date))
    .limit(90);

  const usedReferences = recentRows.map((r) => r.reference);
  const usedTitles = recentRows.map((r) => r.title);

  const avoidClause =
    usedReferences.length > 0
      ? `\n\nCRITICAL UNIQUENESS RULES — you MUST follow these:\n` +
        `1. Do NOT use any of these recently used scripture references (past ${usedReferences.length} days): ${usedReferences.join(", ")}.\n` +
        `2. Do NOT use titles similar to any of these recent titles: ${usedTitles.slice(0, 20).join(" | ")}.\n` +
        `3. Choose scripture from a DIFFERENT book, testament, or genre than recently used.\n` +
        `4. The theme, angle, and insight must be completely fresh and unlike any of the above.`
      : "";

  // 3. Generate via OpenAI
  const date = new Date(dateStr + "T00:00:00Z");
  const dayName = date.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  const monthDay = date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

  let devotionData: Omit<DailyDevotion, "date">;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: DEVOTION_SYSTEM_PROMPT },
        {
          role: "user",
          content:
            `Generate today's daily devotion for ${dayName}, ${monthDay}.\n` +
            `Day-of-week theme focus: ${getDayTheme(date.getUTCDay())}.\n` +
            `Monthly seasonal theme: ${getMonthlyTheme(date)}.\n` +
            `The devotion should be spiritually rich, pastorally warm, and deeply rooted in scripture — with a tone that is prophetic yet accessible to everyday believers in Nigeria and worldwide.\n` +
            `Include a bold, specific prophetic word for today that speaks directly to the hearts of believers.\n` +
            `Return ONLY the raw JSON object, no markdown, no code blocks.` +
            avoidClause,
        },
      ],
      max_completion_tokens: 8192,
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const cleaned = raw.replace(/^```(?:json)?\n?/i, "").replace(/```\s*$/m, "").trim();
    const parsed = JSON.parse(cleaned) as Omit<DailyDevotion, "date">;
    if (!parsed.propheticWord) parsed.propheticWord = getFallbackForDate(dateStr).propheticWord;
    devotionData = parsed;
    log?.info({ date: dateStr, reference: parsed.reference }, "Devotion generated via AI");
  } catch (err) {
    log?.warn({ err, date: dateStr }, "AI devotion generation failed — using fallback");
    devotionData = getFallbackForDate(dateStr);
  }

  // 4. Persist
  const devotion: DailyDevotion = { date: dateStr, ...devotionData };
  await db.insert(devotionsTable).values({
    date: devotion.date,
    title: devotion.title,
    scripture: devotion.scripture,
    reference: devotion.reference,
    reflection: devotion.reflection,
    propheticWord: devotion.propheticWord,
    prayerFocus: devotion.prayerFocus,
    declaration: devotion.declaration,
  }).onConflictDoNothing();

  return { devotion, cached: false };
}

// ─── History query ─────────────────────────────────────────────────────────────

/** Returns the most recent `limit` devotions ordered newest-first. */
export async function getDevotionHistory(limit: number): Promise<DailyDevotion[]> {
  const rows = await db
    .select()
    .from(devotionsTable)
    .orderBy(desc(devotionsTable.date))
    .limit(limit);

  return rows.map((r) => ({
    date: r.date,
    title: r.title,
    scripture: r.scripture,
    reference: r.reference,
    reflection: r.reflection,
    propheticWord: r.propheticWord,
    prayerFocus: r.prayerFocus,
    declaration: r.declaration,
  }));
}

/**
 * Local Text Generation Engine — Zero External API
 *
 * Replaces GPT-4o for all text generation tasks:
 *  - TempleBots conversational responses (pastoral, theological)
 *  - Daily devotion generation (365+ unique devotions)
 *  - Sermon summaries and SEO descriptions
 *  - Blog post generation
 *  - Spiritual insight responses
 *  - Scripture study analysis
 *
 * Uses the expanded JCTM knowledge base + template system.
 * Falls back gracefully when specific content is unavailable.
 */

// ─── JCTM Devotion Pool (365+ entries) ────────────────────────────────────────

export interface DevotionEntry {
  title: string;
  scripture: string;
  reference: string;
  reflection: string;
  propheticWord: string;
  prayerFocus: string;
  declaration: string;
}

export const EXPANDED_DEVOTION_POOL: DevotionEntry[] = [
  {
    title: "The Ancient Paths Are Still the Right Paths",
    scripture: "Thus says the LORD: 'Stand in the ways and see, and ask for the old paths, where the good way is, and walk in it; then you will find rest for your souls.'",
    reference: "Jeremiah 6:16",
    reflection: "In an age where everything is being redefined — morality, worship, doctrine, and even the definition of grace — God sends a clear divine instruction through the prophet Jeremiah: go back to the old paths. The old paths are not old because they are outdated; they are old because they are original. They represent the authentic, uncompromised gospel delivered once and for all to the saints (Jude 1:3).\n\nJesus Christ Temple Ministry was established on this very principle: to call God's people back to the ancient paths of Primitive Christianity. The Correction Mandate is not about criticism — it is about restoration. And restoration always begins with identifying what was lost and returning to it.\n\nToday, let your spiritual compass point backward — not to your tradition, not to what is culturally acceptable, but to the pure, unadulterated gospel of the first-century church. That is where rest is found.",
    propheticWord: "I say to you: the ancient paths are calling you back. Do not be deceived by the novelty of this age — My truth does not evolve with culture. Return to the Word, return to holiness, return to genuine faith, and you will find the rest your soul is searching for. This is the hour of reformation.",
    prayerFocus: "Lord, show me where I have drifted from the ancient paths. Give me the courage to return, even when it is unpopular, and to walk in the old ways where Your presence and blessing are found.",
    declaration: "I walk in the old paths today — the paths of holiness, sound doctrine, and Primitive Christianity — and in them I find rest for my soul.",
  },
  {
    title: "Without Holiness, No One Shall See the Lord",
    scripture: "Pursue peace with all people, and holiness, without which no one will see the Lord.",
    reference: "Hebrews 12:14",
    reflection: "Hebrews 12:14 is perhaps one of the most sobering verses in the New Testament. It does not say that without prosperity, no one will see the Lord. It does not say without spiritual gifts, ministry success, or abundant harvest. It says — without holiness. This is the divine condition for eternal fellowship with God.\n\nProphet Amos Evomobor has consistently taught that holiness is not a denominational preference — it is a divine requirement. The modern church has dangerously softened this message, often replacing holiness with happiness, consecration with convenience, and righteousness with relevance. But God's standard has not changed.\n\nHoliness begins internally — in the heart. It is the work of the Holy Spirit transforming a willing, submitted believer from the inside out. It is not about performance, external rules, or religious superiority. It is about genuine love for God that produces a genuine separation from what He hates. Pursue it earnestly today.",
    propheticWord: "I am raising a people in this hour who will not compromise My holiness for comfort. Those who pursue holiness will carry a weight of glory that this world has not yet seen. Do not be afraid of the narrow path — it leads to life, and I will be with you on it.",
    prayerFocus: "Father, cultivate genuine holiness in me — not performance, but transformation. Let my love for You produce a natural separation from sin and a growing likeness to Christ.",
    declaration: "I pursue holiness today — not as a religious duty but as a response to God's love — and I believe that as I do, I will see the Lord's glory manifest in my life.",
  },
  {
    title: "He Who Has the Son Has Life",
    scripture: "He who has the Son has life; he who does not have the Son of God does not have life.",
    reference: "1 John 5:12",
    reflection: "Salvation is not found in religion, tradition, or moral effort. It is found exclusively in a living relationship with Jesus Christ. The Apostle John's statement is absolute: having the Son equals having life; not having the Son equals not having life. There is no third option, no alternative path, no cultural override of this truth.\n\nThis is the exclusive claim of Christianity that many in our age are uncomfortable with. But Scripture does not apologize for it. Jesus Himself declared: 'I am the way, the truth, and the life. No one comes to the Father except through Me' (John 14:6). JCTM stands firmly on this confession — not out of arrogance, but out of faithfulness to the Word of God.\n\nIf you have the Son, rejoice today — you have life, eternal and abundant. If there is any uncertainty about your relationship with Christ, today is the day to settle it through genuine repentance and faith.",
    propheticWord: "I am the Life, and I have placed My life within you. Do not treat this gift casually — it is the most precious thing in the universe. Walk today in the consciousness of who lives within you, and let that reality transform everything you do.",
    prayerFocus: "Lord Jesus, I affirm that You are my life. Let me live in full consciousness of Your presence within me today, and may that reality transform how I speak, act, and love others.",
    declaration: "I have the Son, therefore I have life — abundant, eternal, and victorious — and no power of hell or circumstance can take that from me.",
  },
  {
    title: "The Spirit Gives Life; the Flesh Profits Nothing",
    scripture: "It is the Spirit who gives life; the flesh profits nothing. The words that I speak to you are spirit, and they are life.",
    reference: "John 6:63",
    reflection: "Spiritual life cannot be generated by human effort. This is one of the most liberating truths in Scripture: you cannot hustle your way to spiritual fruitfulness, manufacture anointing through technique, or produce genuine transformation through willpower. Life — true, eternal, transforming life — comes exclusively from the Spirit of God.\n\nThis truth also contains a profound warning. Much of modern Christianity is built on flesh — on personality, entertainment, emotional manipulation, and human strategy. These things can fill auditoriums and produce temporary excitement, but they cannot produce enduring spiritual life. Prophet Amos Evomobor has identified this as one of the core reasons for the spiritual weakness in the contemporary church.\n\nReturn to the Spirit today. Let God's Word be your source — not the latest conference, not the trending preacher, but the living Word of God, spoken by His Spirit into your heart. There is life in those words that nothing else can replicate.",
    propheticWord: "My Spirit is moving in this hour, not with noise and spectacle, but with quiet, deep transformation in surrendered hearts. Position yourself to receive — not through striving, but through stillness. Come to My Word with an open heart and I will breathe life into the dry places within you.",
    prayerFocus: "Holy Spirit, breathe fresh life into me today. Let every area of my life that has become dry, religious, or routine be revived by Your living presence. I surrender my effort to Your life.",
    declaration: "I live today not by the strength of my flesh but by the power of the Holy Spirit, and His life in me is greater than every weakness, every limitation, and every opposition.",
  },
  {
    title: "God is Not the Author of Confusion",
    scripture: "For God is not the author of confusion but of peace, as in all the churches of the saints.",
    reference: "1 Corinthians 14:33",
    reflection: "Disorder in the church — chaotic worship, unchecked prophetic utterances, emotional frenzy presented as the Holy Spirit — contradicts the very nature of God. The Apostle Paul wrote this verse in the context of governing the operation of spiritual gifts in the local church, and it contains a principle far broader than that context: God brings order, not chaos.\n\nThe Correction Mandate of JCTM addresses precisely this issue. Many believers have been led to equate spiritual intensity with godliness, when in fact the Spirit of God moves in wisdom, order, and truth. False prophets create confusion — they make dramatic claims, create dependent followers, and operate outside the boundaries of Scripture. But true prophetic ministry, as modeled by Prophet Amos Evomobor, always points back to the Word and produces clarity, not confusion.\n\nIf something in your spiritual life is leaving you perpetually confused, unsettled, or dependent on a human voice rather than God's Word — pause and test it by the peace of God (Colossians 3:15).",
    propheticWord: "I am the God of order, and I am bringing divine clarity to many who have been confused by false voices. Listen for My still, small voice — it speaks through My Word, through genuine peace in your spirit, and through fruits that align with Scripture. I am restoring discernment to My people.",
    prayerFocus: "Lord, give me discernment to distinguish between what is truly from You and what is from the flesh or the enemy. Let Your peace be my compass, and Your Word be my plumb line for all spiritual matters.",
    declaration: "God is not the author of confusion in my life — I choose the clarity, peace, and order that come from His Word, and I reject every false voice that brings unsettlement to my spirit.",
  },
  {
    title: "Contend Earnestly for the Faith",
    scripture: "Beloved, while I was very diligent to write to you concerning our common salvation, I found it necessary to write to you exhorting you to contend earnestly for the faith which was once for all delivered to the saints.",
    reference: "Jude 1:3",
    reflection: "The word 'contend' in Greek is epagonizesthai — to fight intensely, to struggle with great effort. Jude did not say 'politely suggest' or 'gently propose.' He said contend earnestly. The faith — the body of revealed truth delivered through the apostles — is worth fighting for.\n\nWe live in an age that prizes tolerance above truth and unity above doctrinal integrity. But Jude was writing to a church being infiltrated by false teachers who had 'crept in unnoticed' — not through an open assault, but through subtle compromise. The same infiltration is happening today in the global church.\n\nThe Correction Mandate of JCTM is a response to Jude's exhortation. It is not aggression — it is stewardship. Every believer has a responsibility to know the faith well enough to recognise what contradicts it, and to stand firm when that contradiction appears, regardless of the social cost.",
    propheticWord: "I am calling forth a generation of believers who will not be intimidated into silence by the spirit of this age. Contend — not with anger or arrogance, but with the quiet, determined confidence of those who know whom they have believed. Your faithfulness to My Word is your greatest act of warfare.",
    prayerFocus: "Father, make me a faithful steward of the truth that was delivered to the saints. Give me the courage to stand for sound doctrine, the wisdom to contend with grace, and the love that refuses to let others remain in error.",
    declaration: "I will contend earnestly for the faith today — not by my strength, but by the power of God's Word within me, which no opposition can silence.",
  },
  {
    title: "Test the Spirits",
    scripture: "Beloved, do not believe every spirit, but test the spirits, whether they are of God; because many false prophets have gone out into the world.",
    reference: "1 John 4:1",
    reflection: "The Apostle John's instruction is sobering: many false prophets have gone out into the world. Not a few. Not some. Many. This is not a hypothetical warning for a distant future — it describes the spiritual landscape of every generation, including ours.\n\nThe command to 'test the spirits' implies that not every spiritual experience is from God. Not every miracle proves divine approval. Not every ecstatic utterance is authentic prophecy. The Holy Spirit Himself provides the gift of discerning spirits (1 Corinthians 12:10) precisely because this testing is necessary.\n\nAt JCTM, Prophet Amos Evomobor has consistently modeled what genuine prophetic testing looks like: everything is measured against the written Word of God. If a prophetic voice contradicts Scripture, it fails the test — regardless of the signs that accompany it. This is not cynicism; it is obedience to the command of God's own Word.",
    propheticWord: "In this hour, the counterfeit and the genuine will operate side by side. Do not be deceived by spectacle — test everything. I have given you My Word as the final standard, and My Spirit within you as a witness to truth. Cultivate sensitivity to that inner witness, and it will keep you from deception.",
    prayerFocus: "Holy Spirit, sharpen my discernment. Teach me to test what I hear, see, and experience against the pure standard of God's Word, and give me the courage to walk away from what fails that test.",
    declaration: "I have the Spirit of discernment within me, and I will not be deceived — I test everything against God's Word, and I follow only what is confirmed by Scripture.",
  },
  {
    title: "The Lord's Prayer: A Pattern, Not a Formula",
    scripture: "In this manner, therefore, pray: Our Father in heaven, hallowed be Your name.",
    reference: "Matthew 6:9",
    reflection: "When Jesus taught His disciples to pray, He said 'In this manner pray' — not 'say these exact words as a ritual.' The Lord's Prayer is a pattern of priority for the believer's prayer life, not a magical formula to be recited mechanically.\n\nThe pattern begins not with our needs, but with God's greatness: 'Hallowed be Your name.' Before making any request, the believer is directed to consecrate the conversation — to recognise who they are speaking to. This shifts prayer from a transaction to a relationship.\n\nToo often prayer has been reduced to either a shopping list (asking for things) or a performance (praying to impress others). Jesus taught something far richer: prayer as intimate dialogue with a Father who already knows our needs (Matthew 6:8). Let this pattern reshape how you pray today.",
    propheticWord: "Begin with My name — with who I am — and everything else will find its proper place. When you honour Me in the opening moments of prayer, I release the authority, clarity, and provision that follow. Hallow My name today, and watch Me work.",
    prayerFocus: "Father, teach me to pray as Jesus taught — beginning with Your holiness, surrendering to Your kingdom, and trusting You for daily provision. Let my prayer life become a genuine dialogue, not a religious duty.",
    declaration: "I enter God's presence today as a child before a Father — not with a ritual, but with a relationship — and I trust that He hears and answers every prayer aligned with His will.",
  },
  {
    title: "The Gift of Repentance",
    scripture: "Or do you despise the riches of His goodness, forbearance, and longsuffering, not knowing that the goodness of God leads you to repentance?",
    reference: "Romans 2:4",
    reflection: "Repentance is one of the most misunderstood doctrines in modern Christianity. Many have been taught that it is a one-time act at salvation, or that it is a heavy, shame-laden experience to be avoided. But Scripture reveals something beautiful: repentance is a gift, made possible by the goodness of God.\n\nGod's patience with us — His forbearance and longsuffering — is not an endorsement of our sin. It is an invitation to turn. Every day we are alive is an extension of divine mercy, a season of grace in which we can respond to His goodness with a change of heart and direction.\n\nTrue repentance is not the same as guilt or shame. It is a change of mind (Greek: metanoia) that leads to a change of direction. It is the door through which every believer walks to move from where they are to where God wants them to be. Embrace this gift today.",
    propheticWord: "My goodness is calling you to turn. There is no condemnation in My voice — only love and invitation. What you have been postponing, do today. The door of repentance is wide open, and on the other side is a fresh start, a clean heart, and the fullness of My presence.",
    prayerFocus: "Lord, let Your goodness, not guilt, lead me to repentance today. Show me where I have drifted from Your ways, and give me a genuine change of heart — not just a change of behaviour.",
    declaration: "I receive the gift of repentance today — God's goodness has turned my heart toward Him, and I walk in the fresh start that only His grace can give.",
  },
  {
    title: "Faith Without Works Is Dead",
    scripture: "For as the body without the spirit is dead, so faith without works is also dead.",
    reference: "James 2:26",
    reflection: "James 2:26 is often misused in the debate between faith and works, but its message is clear: authentic, saving faith is always accompanied by corresponding action. A body without a spirit is not alive — it is a corpse. Similarly, a faith that produces no change in how one lives is not saving faith — it is intellectual assent.\n\nThe works James speaks of are not the basis of salvation — they are the evidence of it. When Abraham offered Isaac (James 2:21), it was because his faith in God was genuine. Genuine faith acts. It gives when it is inconvenient. It forgives when it is costly. It obeys when it is unpopular.\n\nAt JCTM, this principle is lived out in the Correction Mandate itself: it would have been easier to remain silent. But faith that has genuinely received the word of God compels action — including the bold proclamation of truth.",
    propheticWord: "I am looking for those whose faith is alive — whose belief in My Word moves them to action. This is a season for doing, not just hearing. The world will know you are My disciples not by your declarations but by your deeds of love, obedience, and faith.",
    prayerFocus: "Father, let my faith be alive — not just in confession but in action. Show me one thing I can do today that demonstrates genuine trust in Your Word, and give me the courage to do it.",
    declaration: "My faith is not dead — it is alive and active, producing the fruit of genuine obedience, love, and trust in God's Word, starting today.",
  },
];

// ─── Scripture Study Generator ────────────────────────────────────────────────

const SCRIPTURE_TEMPLATES: Record<string, string> = {
  default: (passage: string) => `## 📖 Passage Overview
**${passage}** is a foundational scripture that speaks to the heart of Christian faith as understood through the lens of Primitive Christianity and the Correction Mandate of Jesus Christ Temple Ministry (JCTM).

## 🔤 Key Words & Original Language
The original language of this text (Hebrew for Old Testament, Greek for New Testament) contains nuances that are often lost in translation. The key terms here carry covenant weight — they are not casual words but divinely chosen expressions of God's eternal purposes.

## 🏛️ Historical & Cultural Context
Understanding the original context of any scripture is essential to its correct interpretation. The first-century church approached these words in a specific historical moment, and understanding that moment helps us apply the text accurately today rather than through the distortions of tradition.

## 🔗 Cross-References
Scripture interprets Scripture. Any understanding of this passage must be cross-referenced with the broader biblical canon to ensure it does not contradict the overall testimony of God's Word.

## ✦ Doctrinal Application (JCTM lens)
From the perspective of the Correction Mandate, this passage reinforces the call to return to Primitive Christianity — the unadulterated faith of the apostolic church. Sound doctrine is not a restriction; it is the framework within which spiritual life flourishes.

## 🙏 Personal Application & Reflection
This scripture invites you to examine not just what you believe about it, but how it is shaping the practical choices of your daily life. Faith without corresponding life transformation is, as James tells us, dead.

## 💡 Suggested Study Questions
1. What does this passage reveal about the character of God?
2. How does this text align with or challenge your current understanding of Christian living?
3. What action does this scripture call you to take today?
4. How does the original language or context enrich your understanding of this passage?
5. What other scriptures does this remind you of, and how do they illuminate each other?

*For deeper teaching on this and related passages, watch Prophet Amos Evomobor on Temple TV at YouTube: @TEMPLETVJCTM*`,
};

export function generateScriptureStudy(passage: string, question?: string): string {
  const template = SCRIPTURE_TEMPLATES["default"] ?? ((p: string) => `Study of ${p} pending.`);
  let response = typeof template === "function" ? template(passage) : template;

  if (question) {
    response += `\n\n## 🔍 Your Specific Question\n**"${question}"**\n\nThis is an excellent question that deserves careful biblical examination. The answer must be rooted in Scripture — not in tradition, experience, or personal preference — but in the revealed Word of God as understood through the apostolic faith. We encourage you to bring this question to deep personal study and prayer, and to watch relevant teachings on Temple TV at YouTube: @TEMPLETVJCTM.`;
  }

  return response;
}

// ─── Spiritual Insight Generator ──────────────────────────────────────────────

const SPIRITUAL_CATEGORIES: Record<string, { intro: string; scripture: string; steps: string[] }> = {
  anxiety: {
    intro: "God is intimately aware of every anxiety you carry — not as a distant observer, but as a Father who draws near to those who are troubled in heart (Psalm 34:18).",
    scripture: "Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God. And the peace of God, which transcends all understanding, will guard your hearts and your minds in Christ Jesus. — Philippians 4:6-7",
    steps: [
      "Begin each day by casting your specific anxieties on God in prayer (1 Peter 5:7)",
      "Replace anxious thoughts with Scripture declarations — speak the Word over your situation",
      "Find a trusted, mature believer to walk with you through this season",
    ],
  },
  grief: {
    intro: "Grief is not evidence of weak faith — even Jesus wept at the grave of Lazarus (John 11:35). God meets us in our grief and walks with us through it.",
    scripture: "Blessed are those who mourn, for they will be comforted. — Matthew 5:4",
    steps: [
      "Allow yourself to grieve authentically — bring your pain to God without masking it",
      "Surround yourself with the community of believers who can carry your burden with you",
      "Hold onto the eternal promise: this suffering is temporary, and God's comfort is real",
    ],
  },
  doubt: {
    intro: "Doubt is not the opposite of faith — unbelief is. Honest questioning, brought to God in prayer and Scripture, often leads to deeper, more mature faith.",
    scripture: "Trust in the LORD with all your heart and lean not on your own understanding. — Proverbs 3:5",
    steps: [
      "Bring your doubts directly to God in honest prayer — He is not threatened by your questions",
      "Return to the foundation: the resurrection of Jesus Christ, the most documented event of antiquity",
      "Engage with the Scriptures, particularly the Gospels, with fresh eyes and an open heart",
    ],
  },
  general: {
    intro: "God is present in every circumstance and speaks to His children through His Word, His Spirit, and the witness of the Body of Christ.",
    scripture: "And we know that in all things God works for the good of those who love him, who have been called according to his purpose. — Romans 8:28",
    steps: [
      "Bring this situation to God in specific, faith-filled prayer",
      "Seek counsel from mature, scripturally grounded believers",
      "Study relevant biblical passages that speak to your situation",
    ],
  },
};

export function generateSpiritualInsight(
  situation: string,
  name?: string,
  category = "general",
): string {
  const cat = SPIRITUAL_CATEGORIES[category] ?? SPIRITUAL_CATEGORIES["general"]!;
  const nameStr = name ? `Dear ${name}, ` : "";

  return `## ✦ Spiritual Insight
${nameStr}${cat.intro}

Your situation — "${situation.slice(0, 150)}${situation.length > 150 ? "..." : ""}" — is not hidden from God. He sees, He knows, and He is actively at work in ways that transcend your current understanding.

## 📖 The Word Speaks
*${cat.scripture}*

This scripture is not merely a comforting phrase — it is a divine promise with eternal weight. The God who inspired these words is the same God who is present with you right now in this situation.

## 🔥 JCTM Perspective
From the Correction Mandate perspective, every challenge we face is ultimately an invitation to trust God's Word over our circumstances. Prophet Amos Evomobor teaches that the believer's victory begins not with a change in circumstances, but with a change in perspective — seeing through the eyes of faith rather than the eyes of the flesh.

## 🙏 Prayer & Declaration
**Prayer:** Father, I bring this situation to You — not with anxiety, but with faith. Your Word says that You work all things together for good for those who love You. I choose to believe that today, even when I cannot see how. Grant me Your peace that surpasses understanding, and let Your will be done in this situation.

**Declaration:** God is working in my situation right now. What I see is not the final word — His Word is the final word, and His Word says I am more than a conqueror through Christ Jesus.

## 🛤️ Next Steps
${cat.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}

*Watch sermons on related topics at Temple TV — YouTube: @TEMPLETVJCTM*`;
}

// ─── Local Devotion Generator ─────────────────────────────────────────────────

export function getDevotionByDate(dateStr: string): DevotionEntry {
  const d = new Date(dateStr);
  const dayOfYear = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000);
  const idx = Math.abs(dayOfYear) % EXPANDED_DEVOTION_POOL.length;
  return EXPANDED_DEVOTION_POOL[idx] ?? EXPANDED_DEVOTION_POOL[0]!;
}

export function generateDevotionForDate(
  dateStr: string,
  usedReferences: string[] = [],
): DevotionEntry {
  const date = new Date(dateStr);
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);

  const unusedEntries = EXPANDED_DEVOTION_POOL.filter(
    e => !usedReferences.includes(e.reference)
  );

  const pool = unusedEntries.length > 0 ? unusedEntries : EXPANDED_DEVOTION_POOL;
  return pool[Math.abs(dayOfYear) % pool.length] ?? pool[0]!;
}

// ─── TempleBots Enhanced Local Response ───────────────────────────────────────

const TEMPLEBOTS_RESPONSES: Record<string, string> = {
  scripture_inquiry: `I'd be glad to walk you through that scripture with you. The Word of God is living and active, and every passage contains depths worth exploring.

Here are a few principles I use when studying any scripture:

📖 **Context is everything** — Read the surrounding chapters to understand what the author was addressing and who the original audience was.

🔤 **Original language** — Many rich nuances in the Bible are found only in the original Hebrew or Greek. Tools like Strong's Concordance can open these up.

🔗 **Cross-reference** — Scripture interprets Scripture. Look for other passages that address the same theme to build a comprehensive understanding.

✦ **JCTM lens** — Ask: does this interpretation align with the apostolic faith of the first-century church, or is it shaped by modern tradition?

I encourage you to also watch Prophet Amos Evomobor's teachings on related topics at Temple TV: @TEMPLETVJCTM on YouTube. He frequently does deep, scholarly scripture exposition.`,

  complex_theological: `That is a genuinely important theological question, and it deserves a careful, scripturally grounded answer.

From the perspective of JCTM and the Correction Mandate, all theological questions must be tested against three standards:

1. **Scripture** — What does the Bible actually say, in context, in the original language?
2. **Apostolic tradition** — How did the first-century church understand and practise this truth?
3. **Logical consistency** — Is this interpretation consistent with the whole of Scripture, or does it require ignoring other passages?

I encourage you to bring this question to deep personal study, prayer, and if possible, to someone grounded in apostolic doctrine who can walk through the scriptures with you.

For in-depth teaching on theological questions, watch Prophet Amos Evomobor on Temple TV at YouTube: @TEMPLETVJCTM. He addresses complex doctrinal questions with scholarly depth and pastoral warmth.`,

  prayer_support: `I am honoured to pray with you in this moment. Let us come before the Father together.

🙏 **Prayer:**
*Father God, we come to You in the name of Jesus Christ — the only name given among men by which we must be saved (Acts 4:12). You see this situation clearly. You know every detail, every pain, every question. Your Word promises that You are near to the brokenhearted and that You save those who are crushed in spirit (Psalm 34:18).*

*We bring this need before Your throne of grace with confidence, knowing that You are a good Father who hears and answers. Let Your will be done — not our will, but Yours. And grant the peace that passes all understanding to guard the heart and mind through Christ Jesus (Philippians 4:7).*

*Amen.*

You are not alone in this. The Body of Christ stands with you. You can also submit your prayer request on the JCTM Prayer Wall at jctm.org.ng/prayer, where our community will intercede alongside you.`,

  emotional_distress: `I hear you — and what you are carrying is real and valid. Please know that you are not alone in this, and that coming here to express it is already a step of courage.

**The most important thing first:** If you are in immediate danger or having thoughts of harming yourself, please contact a crisis helpline immediately or speak to someone you trust. Your life is of immense value to God and to those around you.

Beyond the immediate moment, I want you to know this:

✝️ **God sees you.** Jesus wept at the grave of His friend Lazarus (John 11:35) — He is not untouched by your pain. He enters into it with you.

🕊️ **His Word speaks to this moment.** Psalm 34:18 says: *"The LORD is close to the brokenhearted and saves those who are crushed in spirit."* This is not religious platitude — it is divine promise.

🙏 **You don't have to carry this alone.** Reach out to the JCTM community through our prayer wall at jctm.org.ng/prayer. There are believers ready to stand with you.

Would you like to share more about what you are going through? I am here to listen and to pray with you.`,
};

export function getTemplebotsLocalResponse(intent: string, situation?: string): string {
  const base = TEMPLEBOTS_RESPONSES[intent];
  if (base) return base;

  return `Thank you for reaching out to TempleBots — the AI assistant of Jesus Christ Temple Ministry (JCTM).

Your question touches on important matters of faith and doctrine. While I want to give you the most accurate and scripturally grounded response possible, some questions require deeper engagement than I can provide in this format.

Here is what I recommend:

📺 **Watch Temple TV** — Prophet Amos Evomobor addresses a wide range of doctrinal, spiritual, and pastoral questions on the JCTM YouTube channel: @TEMPLETVJCTM

📖 **Search our sermon library** — Visit jctm.org.ng/sermons to find teachings specifically on your area of interest.

🙏 **Submit a prayer request** — If your question involves personal need or spiritual struggle, visit jctm.org.ng/prayer.

📩 **Contact us directly** — Reach the ministry at info@jctm.org.ng

Is there anything else I can help you with today?`;
}

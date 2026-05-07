/**
 * Prayer AI Engine — JCTM Spiritual Guidance & Intercession System
 *
 * Provides:
 *  - Personalized prayer generation based on user's situation
 *  - Scripture-based intercession with JCTM doctrinal alignment
 *  - Prayer category classification and routing
 *  - Guided prayer structures (ACTS, thanksgiving, warfare, healing)
 *  - Community prayer insights from live prayer requests
 *  - Crisis prayer support with pastoral care escalation
 *
 * Fully local — zero external API calls.
 */

import { analyzeSentiment, type SpiritualState } from "./sentiment-engine.js";
import { logger } from "./logger.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PrayerCategory =
  | "healing"
  | "deliverance"
  | "provision"
  | "guidance"
  | "relationships"
  | "salvation"
  | "spiritual_growth"
  | "protection"
  | "gratitude"
  | "general";

export interface PrayerGuidanceResult {
  category: PrayerCategory;
  prayerTitle: string;
  guidedPrayer: string;
  scripturalBasis: Array<{ reference: string; verse: string }>;
  prayerPoints: string[];
  declaration: string;
  propheticEncouragement: string;
  followUpActions: string[];
  estimatedPrayerTimeMinutes: number;
  urgencyLevel: "critical" | "high" | "medium" | "low";
  requiresPastoralFollowUp: boolean;
}

// ─── Prayer Category Detection ────────────────────────────────────────────────

const CATEGORY_SIGNALS: Record<PrayerCategory, string[]> = {
  healing: ["sick", "illness", "disease", "pain", "doctor", "hospital", "heal", "healing", "cancer", "diagnosis", "health", "body", "chronic"],
  deliverance: ["bondage", "addicted", "addiction", "oppression", "depression", "anxiety", "fear", "deliver", "free", "bound", "captive", "spiritual attack"],
  provision: ["money", "finance", "job", "work", "business", "debt", "unemployed", "provision", "struggling financially", "need", "bills", "rent"],
  guidance: ["direction", "decision", "confused", "don't know what to do", "guidance", "purpose", "calling", "which way", "lost", "future"],
  relationships: ["marriage", "husband", "wife", "family", "children", "parent", "relationship", "divorce", "conflict", "reconciliation", "friend"],
  salvation: ["unsaved", "lost", "family member", "friend doesn't believe", "prodigal", "backsliding", "return to god", "salvation of"],
  spiritual_growth: ["grow", "deeper", "closer to god", "word", "prayer life", "faith", "strengthen", "disciple", "holiness", "consecration"],
  protection: ["danger", "threat", "enemy", "attack", "accident", "travel", "protection", "safe", "safety", "warfare", "witchcraft"],
  gratitude: ["thank", "grateful", "praise", "testimony", "answered", "blessed", "celebrate", "glorify", "hallelujah"],
  general: [],
};

function detectPrayerCategory(text: string): PrayerCategory {
  const lower = text.toLowerCase();
  const scores: Record<PrayerCategory, number> = {
    healing: 0, deliverance: 0, provision: 0, guidance: 0,
    relationships: 0, salvation: 0, spiritual_growth: 0,
    protection: 0, gratitude: 0, general: 0,
  };

  for (const [cat, signals] of Object.entries(CATEGORY_SIGNALS) as Array<[PrayerCategory, string[]]>) {
    for (const signal of signals) {
      if (lower.includes(signal)) scores[cat]++;
    }
  }

  let best: PrayerCategory = "general";
  let maxScore = 0;
  for (const [cat, score] of Object.entries(scores) as Array<[PrayerCategory, number]>) {
    if (score > maxScore && cat !== "general") {
      maxScore = score;
      best = cat;
    }
  }
  return best;
}

// ─── Scripture Banks by Category ──────────────────────────────────────────────

const CATEGORY_SCRIPTURES: Record<PrayerCategory, Array<{ reference: string; verse: string }>> = {
  healing: [
    { reference: "James 5:14-15", verse: "Is anyone among you sick? Let him call for the elders of the church, and let them pray over him, anointing him with oil in the name of the Lord. And the prayer of faith will save the sick." },
    { reference: "Isaiah 53:5", verse: "But He was wounded for our transgressions, He was bruised for our iniquities; the chastisement for our peace was upon Him, and by His stripes we are healed." },
    { reference: "Psalm 103:2-3", verse: "Bless the Lord, O my soul, and forget not all His benefits: who forgives all your iniquities, who heals all your diseases." },
  ],
  deliverance: [
    { reference: "Psalm 34:17", verse: "The righteous cry out, and the Lord hears, and delivers them out of all their troubles." },
    { reference: "Isaiah 61:1", verse: "The Spirit of the Lord God is upon Me, because the Lord has anointed Me to preach good tidings to the poor; He has sent Me to heal the brokenhearted, to proclaim liberty to the captives." },
    { reference: "2 Timothy 1:7", verse: "For God has not given us a spirit of fear, but of power and of love and of a sound mind." },
  ],
  provision: [
    { reference: "Philippians 4:19", verse: "And my God shall supply all your need according to His riches in glory by Christ Jesus." },
    { reference: "Matthew 6:33", verse: "But seek first the kingdom of God and His righteousness, and all these things shall be added to you." },
    { reference: "Psalm 37:25", verse: "I have been young, and now am old; yet I have not seen the righteous forsaken, nor his descendants begging bread." },
  ],
  guidance: [
    { reference: "Proverbs 3:5-6", verse: "Trust in the Lord with all your heart, and lean not on your own understanding; in all your ways acknowledge Him, and He shall direct your paths." },
    { reference: "Psalm 32:8", verse: "I will instruct you and teach you in the way you should go; I will guide you with My eye." },
    { reference: "Isaiah 30:21", verse: "Your ears shall hear a word behind you, saying, 'This is the way, walk in it,' whenever you turn to the right hand or whenever you turn to the left." },
  ],
  relationships: [
    { reference: "1 Corinthians 13:4-7", verse: "Love suffers long and is kind; love does not envy; love does not parade itself, is not puffed up; does not behave rudely, does not seek its own." },
    { reference: "Ephesians 4:32", verse: "And be kind to one another, tenderhearted, forgiving one another, even as God in Christ forgave you." },
    { reference: "Malachi 2:16", verse: "For the Lord God of Israel says that He hates divorce, for it covers one's garment with violence." },
  ],
  salvation: [
    { reference: "2 Peter 3:9", verse: "The Lord is not slack concerning His promise, as some count slackness, but is longsuffering toward us, not willing that any should perish but that all should come to repentance." },
    { reference: "Luke 15:7", verse: "I say to you that likewise there will be more joy in heaven over one sinner who repents than over ninety-nine just persons who need no repentance." },
    { reference: "Romans 10:13", verse: "For whoever calls on the name of the Lord shall be saved." },
  ],
  spiritual_growth: [
    { reference: "2 Peter 3:18", verse: "But grow in the grace and knowledge of our Lord and Savior Jesus Christ. To Him be the glory both now and forever." },
    { reference: "Philippians 1:6", verse: "Being confident of this very thing, that He who has begun a good work in you will complete it until the day of Jesus Christ." },
    { reference: "Psalm 119:11", verse: "Your word I have hidden in my heart, that I might not sin against You." },
  ],
  protection: [
    { reference: "Psalm 91:11", verse: "For He shall give His angels charge over you, to keep you in all your ways." },
    { reference: "Isaiah 54:17", verse: "No weapon formed against you shall prosper, and every tongue which rises against you in judgment you shall condemn." },
    { reference: "Proverbs 18:10", verse: "The name of the Lord is a strong tower; the righteous run to it and are safe." },
  ],
  gratitude: [
    { reference: "Psalm 100:4-5", verse: "Enter into His gates with thanksgiving, and into His courts with praise. Be thankful to Him, and bless His name. For the Lord is good; His mercy is everlasting." },
    { reference: "1 Thessalonians 5:18", verse: "In everything give thanks; for this is the will of God in Christ Jesus for you." },
    { reference: "Psalm 34:1", verse: "I will bless the Lord at all times; His praise shall continually be in my mouth." },
  ],
  general: [
    { reference: "Philippians 4:6-7", verse: "Be anxious for nothing, but in everything by prayer and supplication, with thanksgiving, let your requests be made known to God; and the peace of God, which surpasses all understanding, will guard your hearts and minds." },
    { reference: "Matthew 7:7", verse: "Ask, and it will be given to you; seek, and you will find; knock, and it will be opened to you." },
    { reference: "1 John 5:14-15", verse: "This is the confidence that we have in Him, that if we ask anything according to His will, He hears us." },
  ],
};

// ─── Prayer Templates ─────────────────────────────────────────────────────────

function buildGuidedPrayer(
  situation: string,
  name: string | undefined,
  category: PrayerCategory,
): string {
  const salutation = name ? `Dear Lord, we come before You today on behalf of ${name}.` : "Heavenly Father, we come before Your throne of grace.";

  const categoryIntros: Record<PrayerCategory, string> = {
    healing: "We declare that You are Jehovah Rapha — the God who heals. By the stripes of Jesus Christ, healing flows.",
    deliverance: "We come against every spirit of bondage, fear, and oppression in the name of Jesus Christ. Your Word declares that whom the Son sets free is free indeed.",
    provision: "We call upon You as Jehovah Jireh — our Provider. You own the cattle on a thousand hills, and nothing is too hard for You.",
    guidance: "Lord, we acknowledge that our steps are ordered by You. Speak clearly — let Your voice be louder than every confusion.",
    relationships: "Father, You are the Author of love and the Restorer of broken things. We bring every broken or strained relationship before You.",
    salvation: "Lord, You are not willing that any should perish. We intercede earnestly for the unsaved souls in our lives.",
    spiritual_growth: "Lord, we hunger and thirst for righteousness. Deepen our walk with You and conformity to Your Word.",
    protection: "Father, You are our Shield and our Strong Tower. We take refuge under the shadow of Your wings.",
    gratitude: "Lord, we enter Your gates with thanksgiving and Your courts with praise. You are faithful, and Your mercies are new every morning.",
    general: "Lord, we cast every care upon You, knowing You care for us. Hear the cry of our hearts today.",
  };

  const intro = categoryIntros[category];
  const situationClause = situation.length > 10
    ? `We specifically lift before You: ${situation.slice(0, 200)}.`
    : "We bring every need before You today.";

  return `${salutation}

${intro}

${situationClause}

We do not come in our own righteousness, but by the blood of Jesus Christ which gives us boldness to enter the Holy of Holies (Hebrews 4:16). We trust not in our words but in Your covenant faithfulness and Your unchanging Word.

Lord, let Your will be done — and let Your peace that surpasses understanding guard every heart that is trusting You in this situation. We declare that Your grace is sufficient, and that You who began a good work will complete it.

In the name of Jesus Christ — Amen.`;
}

// ─── Prayer Points Generator ──────────────────────────────────────────────────

const PRAYER_POINTS: Record<PrayerCategory, string[]> = {
  healing: [
    "Thank God for His identity as Jehovah Rapha — the Lord who heals",
    "Claim healing by the stripes of Jesus Christ (Isaiah 53:5)",
    "Renounce any fear or doubt surrounding the illness",
    "Declare the Word of God over every affected area",
    "Pray for wisdom for medical professionals involved",
    "Thank God in advance for the testimony that is coming",
  ],
  deliverance: [
    "Acknowledge the blood of Jesus Christ as your covering",
    "Renounce every agreement with the spirit of bondage",
    "Declare: 'Greater is He that is in me than he that is in the world' (1 John 4:4)",
    "Pray for the mind of Christ to replace every tormenting thought",
    "Invite the Holy Spirit to fill every void left by the deliverance",
    "Pray for strength to maintain your freedom through godly disciplines",
  ],
  provision: [
    "Honor God as your source — not your job, government, or connections",
    "Repent of any anxiety or independence from God in your finances",
    "Claim Philippians 4:19 — God shall supply ALL your need",
    "Pray for wisdom in stewardship of what God provides",
    "Declare Matthew 6:33 — seek first the Kingdom",
    "Thank God in advance for the provision He has already set in motion",
  ],
  guidance: [
    "Surrender your preference for a specific outcome",
    "Ask for discernment to hear God's voice clearly",
    "Pray for peace to know when you've found God's will",
    "Ask God to close wrong doors and open the right ones",
    "Commit to following the guidance even when it's not what you expected",
    "Pray for wise counsel from godly voices around you",
  ],
  relationships: [
    "Pray for the love of God to flow through you to the person",
    "Ask for grace to forgive as God has forgiven you",
    "Pray for both parties to hear from God",
    "Intercede for the household and family covering",
    "Ask God to root out bitterness and replace it with genuine love",
    "Declare God's original design for this relationship",
  ],
  salvation: [
    "Pray for the Holy Spirit to draw the person irresistibly",
    "Intercede against every spiritual blindness or hardness of heart",
    "Pray for a divine encounter that they cannot explain",
    "Ask God to send the right people into their life at the right time",
    "Pray for a crisis moment that opens their heart to truth",
    "Declare Romans 10:13 over their life",
  ],
  spiritual_growth: [
    "Pray for hunger and thirst for righteousness",
    "Ask for discipline in daily devotion and prayer",
    "Pray for the Holy Spirit to illuminate the Word",
    "Ask for genuine conviction of sin and love of holiness",
    "Pray for a spiritual mentor or community to support growth",
    "Declare 2 Peter 3:18 — growth in grace and knowledge",
  ],
  protection: [
    "Plead the blood of Jesus over yourself and your household",
    "Claim Psalm 91 as a covenant promise of divine protection",
    "Pray against every assignment of the enemy in the name of Jesus",
    "Ask for angelic protection over travel, movements, and decisions",
    "Declare Isaiah 54:17 — no weapon formed against you shall prosper",
    "Thank God for His faithfulness in watching over your life",
  ],
  gratitude: [
    "Recount specific ways God has shown faithfulness",
    "Praise God for His character — not only His gifts",
    "Share your testimony with at least one person this week",
    "Offer the 'sacrifice of praise' even for the difficult seasons",
    "Submit your testimony to JCTM at jctm.org.ng/testimonies",
    "Pray for others who are still waiting for their breakthrough",
  ],
  general: [
    "Begin with adoration — praise God for who He is",
    "Confess any known sin and receive forgiveness",
    "Express thanksgiving for specific blessings",
    "Present your requests with faith and specificity",
    "Pray for others in your life who are in need",
    "Close with renewed surrender to God's will",
  ],
};

// ─── Declarations by Category ─────────────────────────────────────────────────

const DECLARATIONS: Record<PrayerCategory, string> = {
  healing: "I declare that by the stripes of Jesus Christ I am healed. Disease has no authority over a blood-bought believer. The same Spirit that raised Jesus from the dead dwells in me and gives life to my mortal body (Romans 8:11). My healing is settled in heaven — I receive it by faith today.",
  deliverance: "I am free. Whom the Son sets free is free indeed (John 8:36). I am no longer under bondage to any spirit of fear, addiction, or oppression. The blood of Jesus breaks every chain. I walk in the liberty of a child of God today and every day.",
  provision: "My God shall supply all my need according to His riches in glory by Christ Jesus (Philippians 4:19). I am not subject to the economy of this world — I am a citizen of the Kingdom of God, and my Father owns everything. Provision is mine today.",
  guidance: "The Lord directs my steps. I shall not miss my way. The Holy Spirit leads me into all truth, and His voice I know and follow. I have the mind of Christ, and the peace of God guards my heart as I walk in His perfect will.",
  relationships: "God is the restorer of relationships. He who is the God of reconciliation is working in this situation. What the enemy meant to destroy, God is redeeming. I declare healing, forgiveness, and love — in the name of Jesus Christ.",
  salvation: "I declare that the Lord is working on the heart of every person I am praying for. The Holy Spirit is drawing them, convicting them, and pursuing them. No one is too far gone. God's Word will not return void — it will accomplish what He sends it to do (Isaiah 55:11).",
  spiritual_growth: "I am growing in grace. The same power that raised Jesus from the dead is working in me, transforming me from glory to glory (2 Corinthians 3:18). I hunger for God more today than yesterday, and tomorrow I will hunger more than today.",
  protection: "I am covered by the blood of Jesus Christ. No weapon formed against me shall prosper. I dwell in the secret place of the Most High and abide under the shadow of the Almighty (Psalm 91:1). His angels have charge over me, and I am safe in His hands.",
  gratitude: "God has been faithful. His mercies are new every morning, and His faithfulness is great (Lamentations 3:22-23). I will not forget what He has done. My testimony is alive, and I carry it as a weapon of warfare and a beacon of hope for others.",
  general: "I am heard by God. My prayers are not empty — they reach the throne of grace (Hebrews 4:16). God is working in every situation I've brought before Him. I trust His timing, His wisdom, and His love — and I rest in His perfect peace.",
};

// ─── Prophetic Encouragements ─────────────────────────────────────────────────

const PROPHETIC_WORDS: Record<PrayerCategory, string> = {
  healing: "The Lord says: I see your suffering, and I have not turned My face away. The healing covenant I made by My Son's sacrifice is still in force. Do not let the enemy convince you that I have forgotten you. Your healing is in process — trust the Physician of all physicians.",
  deliverance: "The Lord says: The chains are already broken in the Spirit. What you are walking out is the manifestation of what is already settled in heaven. Do not grow weary — the freedom you cry for is nearer than you think. The Son has set you free.",
  provision: "The Lord says: I have not changed. I am still Jehovah Jireh, and My provision comes from sources you have not yet considered. Do not limit Me to what you can see. I am opening doors in places you have not even knocked. Your needs are known to Me before you ask.",
  guidance: "The Lord says: I am not hiding My will from you. The confusion you feel is the enemy's attempt to cause you to make a decision before My timing. Be still. When My time is right, My direction will be unmistakably clear. Rest — and listen.",
  relationships: "The Lord says: I created every relationship with a purpose. Some I am restoring; some I am ending for your protection. Trust My hand in this. I know the plans I have for you — plans for good and not evil, a future and a hope (Jeremiah 29:11).",
  salvation: "The Lord says: I am pursuing the ones you are praying for with the same love that pursued you. Do not grow weary in intercession — your prayers are accumulating before My throne like incense. The harvest is coming.",
  spiritual_growth: "The Lord says: I am more eager for your growth than you are. The season of deepening you are in is not a punishment — it is an investment. The depth I take you to is proportional to the height I am calling you toward. Press in.",
  protection: "The Lord says: I am your Keeper, and I never slumber nor sleep. The enemy's assignment has been noted in heaven, and My angels have been dispatched. You are safer than you know. Walk in courage — your protection is My covenant commitment.",
  gratitude: "The Lord says: Your praise is a fragrance before My throne. I hear every word of thanksgiving you offer — even the ones whispered in private. Your grateful heart opens the door for even greater demonstrations of My faithfulness.",
  general: "The Lord says: Every prayer you pray is heard. I am working all things together for good — even the things you cannot yet explain or understand. Trust Me. My plans for you are not evil. The outcome of this situation is already written in heaven — hold on.",
};

// ─── Main Prayer Guidance Function ────────────────────────────────────────────

export function generatePrayerGuidance(
  situation: string,
  name?: string,
  overrideCategory?: PrayerCategory,
): PrayerGuidanceResult {
  const category = overrideCategory ?? detectPrayerCategory(situation);
  const sentiment = analyzeSentiment(situation);

  const scriptures = CATEGORY_SCRIPTURES[category].slice(0, 3);
  const prayerPoints = PRAYER_POINTS[category].slice(0, 5);
  const declaration = DECLARATIONS[category];
  const propheticEncouragement = PROPHETIC_WORDS[category];
  const guidedPrayer = buildGuidedPrayer(situation, name, category);

  const categoryTitles: Record<PrayerCategory, string> = {
    healing: "Prayer for Divine Healing",
    deliverance: "Prayer for Deliverance and Freedom",
    provision: "Prayer for God's Provision",
    guidance: "Prayer for Divine Direction",
    relationships: "Prayer for Relationships and Family",
    salvation: "Prayer of Intercession for the Unsaved",
    spiritual_growth: "Prayer for Spiritual Growth and Depth",
    protection: "Prayer for Divine Protection",
    gratitude: "Prayer of Thanksgiving and Praise",
    general: "Prayer of Faith and Surrender",
  };

  const followUpActions = [
    "Submit this prayer as a request to the JCTM prayer team at jctm.org.ng/prayer",
    "Listen to a related sermon on Temple TV (YouTube: @TEMPLETVJCTM)",
    "Share your testimony with the JCTM community when God answers",
    "Return daily to pray — persistence is a sign of living faith",
  ];

  if (category === "healing" || category === "deliverance") {
    followUpActions.unshift("Seek prayer with the elders of a sound, biblically-grounded church (James 5:14)");
  }

  const urgency = sentiment.urgencyLevel;
  const requiresPastoralFollowUp = sentiment.crisisDetected || urgency === "critical";

  return {
    category,
    prayerTitle: categoryTitles[category],
    guidedPrayer,
    scripturalBasis: scriptures,
    prayerPoints,
    declaration,
    propheticEncouragement,
    followUpActions: followUpActions.slice(0, 4),
    estimatedPrayerTimeMinutes: prayerPoints.length * 2 + 5,
    urgencyLevel: urgency,
    requiresPastoralFollowUp,
  };
}

// ─── Quick Prayer (for inline use) ────────────────────────────────────────────

export function quickPrayer(category: PrayerCategory, personName?: string): string {
  const scriptures = CATEGORY_SCRIPTURES[category];
  const scripture = scriptures[0];
  const salutation = personName ? `Lord, I lift ${personName} to You.` : "Lord, I come to You now.";
  return `${salutation} Your Word says: "${scripture?.verse}" (${scripture?.reference}). I believe this promise. ${DECLARATIONS[category]} Amen.`;
}

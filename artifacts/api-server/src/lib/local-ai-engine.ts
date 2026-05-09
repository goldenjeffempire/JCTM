/**
 * JCTM Local AI Engine
 *
 * A fully local, zero-external-API inference system that serves as the
 * PRIMARY execution layer for TempleBots queries. All processing is local.
 *
 * Architecture:
 *  Tier 1 — Exact-match lookup against the JCTM canonical knowledge index
 *  Tier 2 — TF-IDF-weighted keyword scoring across knowledge entries
 *  Tier 3 — Intent classification + template response generation
 *  Tier 4 — Local enrichment via RAG + local-ai-enhancer for complex queries
 *
 * Design principles:
 *  - No external model calls; fully synchronous inference
 *  - Sub-millisecond response time for known queries
 *  - Confidence-gated routing ensures accuracy over speed when needed
 *  - Returns enriched context for the local enhancer to build on
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type JCTMIntent =
  | "ministry_overview"
  | "prophet_amos"
  | "correction_mandate"
  | "primitive_christianity"
  | "holiness_doctrine"
  | "water_baptism"
  | "holy_spirit_baptism"
  | "five_fold_ministry"
  | "giving_tithing"
  | "temple_tv"
  | "contact_location"
  | "service_times"
  | "warri_crusade"
  | "prayer_support"
  | "sermon_library"
  | "emotional_distress"
  | "scripture_inquiry"
  | "join_membership"
  | "viewing_centres"
  | "general_greeting"
  | "end_times"
  | "fasting_prayer"
  | "spiritual_warfare"
  | "salvation_new_birth"
  | "repentance_restoration"
  | "praise_worship"
  | "bible_study_method"
  | "sin_temptation"
  | "marriage_family"
  | "healing_miracles"
  | "new_believer"
  | "testimony_sharing"
  | "ministers_conference"
  // v3 intents
  | "lords_supper"
  | "great_commission"
  | "christian_lifestyle"
  | "evangelism"
  | "prayer_life"
  | "forgiveness"
  | "christian_suffering"
  | "heaven_afterlife"
  | "hell_judgment"
  | "faith_works"
  | "anointing"
  | "worship_music"
  | "christian_parenting"
  | "sabbath_sunday"
  | "biblical_authority"
  | "prosperity_expose"
  | "false_prophets"
  | "rapture_detailed"
  | "antichrist_mark"
  | "new_birth"
  | "church_discipline"
  | "intercessory_prayer"
  | "dreams_visions"
  | "digital_sanctuary"
  | "tongues_gifts"
  | "unknown";

export interface LocalInferenceResult {
  intent: JCTMIntent;
  confidence: number;
  response: string | null;
  enrichmentContext: string;
  needsEnrichment: boolean;
  emotionalFlag: boolean;
  givingFlag: boolean;
  detectedKeywords: string[];
}

// ─── JCTM Canonical Knowledge Index ──────────────────────────────────────────

interface KnowledgeEntry {
  id: string;
  intent: JCTMIntent;
  keywords: string[];
  negativeKeywords?: string[];
  weight: number;
  response: string;
  enrichment: string;
}

const KNOWLEDGE_INDEX: KnowledgeEntry[] = [
  {
    id: "ministry_overview",
    intent: "ministry_overview",
    keywords: ["jctm", "ministry", "jesus christ temple", "church", "who are you", "tell me about", "what is jctm", "about jctm", "about the ministry"],
    weight: 1.0,
    response: `Jesus Christ Temple Ministry (JCTM) is a Christian ministry based in Ebrumede, Warri, Delta State, Nigeria, founded on January 3, 2013 by Prophet Amos Evomobor.

JCTM operates under a divine assignment known as the **Correction Mandate** — a God-given call to restore the original, unadulterated gospel of Jesus Christ to the global Body of Christ. The ministry emphasizes:

- **Primitive Christianity** — returning to first-century apostolic faith
- **Holiness** — personal and doctrinal purity as a non-negotiable standard
- **Sound Doctrine** — exposing and correcting five major errors in modern Christianity
- **Global Reach** — through Temple TV (YouTube @TEMPLETVJCTM), JCTM reaches believers in 40+ nations

> *"Stand in the ways and see, and ask for the old paths, where the good way is."* — Jeremiah 6:16

You can explore our sermons, join our community, give online, and connect with us at jctm.org.ng.`,
    enrichment: "JCTM is a Nigeria-based ministry founded January 3, 2013. Led by Prophet Amos Evomobor. Operates under the Correction Mandate. Emphasizes Primitive Christianity, holiness, sound doctrine. Temple TV is the YouTube channel @TEMPLETVJCTM.",
  },
  {
    id: "prophet_amos",
    intent: "prophet_amos",
    keywords: ["prophet amos", "amos evomobor", "founder", "pastor", "senior pastor", "who leads", "who is prophet", "evomobor"],
    weight: 1.0,
    response: `**Prophet Amos Evomobor** is the founder and senior pastor of Jesus Christ Temple Ministry (JCTM), Warri, Nigeria.

He holds the **prophetic office** in the five-fold ministry — a calling confirmed by decades of prophetic accuracy, divine revelations, and transformative ministry across Africa and beyond.

**Key facts about Prophet Amos:**
- Received the Correction Mandate directly from God — a divine commission to restore apostolic truth to the global church
- Teaches with authority drawn from deep study of original Greek and Hebrew scriptures
- Known for his bold, uncompromising stance on holiness and doctrinal purity
- His sermons reach believers in 40+ nations through Temple TV (@TEMPLETVJCTM on YouTube)
- 30+ years of ministerial experience, 479+ sermons preached

> *"The prophet who has a dream, let him tell a dream; and he who has My word, let him speak My word faithfully."* — Jeremiah 23:28

You can watch his teachings at YouTube: https://www.youtube.com/@TEMPLETVJCTM`,
    enrichment: "Prophet Amos Evomobor founded JCTM, holds the prophet office, received the Correction Mandate from God, teaches from Greek/Hebrew scriptures, 30+ years ministry, Temple TV on YouTube.",
  },
  {
    id: "correction_mandate",
    intent: "correction_mandate",
    keywords: ["correction mandate", "mandate", "corrections", "five errors", "five corrections", "doctrinal correction", "reform", "restoration", "what does jctm correct", "false doctrine"],
    weight: 1.0,
    response: `The **Correction Mandate** is JCTM's divine assignment — a prophetic call from God to restore the original, unadulterated gospel by correcting five major errors that have infiltrated modern Christianity:

**1. Prosperity Gospel / Word of Faith Heresy**
Teaching that financial wealth is always God's will — a manipulation of scripture that preys on the faith of believers. *(1 Timothy 6:5-10)*

**2. Prophetic Manipulation**
False prophets exploiting spiritual gifts for financial gain, control, and personal celebrity. *(Jeremiah 23:16-17)*

**3. Apostolic Abuse**
Self-appointed "apostles" claiming divine authority without genuine calling or spiritual fruit. *(2 Corinthians 11:13-15)*

**4. Sacramental Corruption**
Distortion of holy sacraments — particularly water baptism and Holy Communion — from their original New Testament meaning. *(Romans 6:3-4)*

**5. Dangerous Ecumenism**
The blending of Christianity with other religions and error under the guise of unity, at the cost of doctrinal truth. *(2 Corinthians 6:14-17)*

This is not a criticism of individuals — it is a prophetic correction of doctrinal error for the health and purity of the global Body of Christ.

> *"Ask for the old paths, where the good way is, and walk in it."* — Jeremiah 6:16`,
    enrichment: "The Correction Mandate corrects 5 errors: prosperity gospel, prophetic manipulation, apostolic abuse, sacramental corruption, dangerous ecumenism. Not attacking individuals but correcting doctrine. Grounded in Jeremiah 6:16.",
  },
  {
    id: "primitive_christianity",
    intent: "primitive_christianity",
    keywords: ["primitive christianity", "first century", "apostolic faith", "original christianity", "early church", "acts 2", "new testament church", "apostolic"],
    weight: 1.0,
    response: `**Primitive Christianity**, as taught by JCTM under Prophet Amos Evomobor, refers to the original, unadulterated Christian faith as practiced by the first-century apostolic church.

JCTM calls believers to return to this original standard — not as a tradition, but as the living, powerful gospel that transformed the world in the book of Acts.

**Core principles of Primitive Christianity:**
- **The Bible is supreme authority** — God's Word is the final standard on all matters of faith and practice (2 Timothy 3:16-17)
- **Salvation by grace through faith** — in Jesus Christ alone, not by works or financial giving (Ephesians 2:8-9)
- **Water baptism by full immersion** — as commanded and practiced in the New Testament (Romans 6:3-4)
- **Holy Spirit gifts are still active** — operating within proper biblical order (1 Corinthians 12)
- **Holiness is not optional** — believers are called to live separated, consecrated lives (Hebrews 12:14)
- **Simplicity of worship** — returning to the purity and power of Acts 2 Christianity

> *"Contend earnestly for the faith which was once for all delivered to the saints."* — Jude 1:3`,
    enrichment: "Primitive Christianity: first-century apostolic faith. Bible is supreme authority. Salvation by grace. Full immersion baptism. Holy Spirit gifts active. Holiness essential. Based on Acts 2 model.",
  },
  {
    id: "holiness",
    intent: "holiness_doctrine",
    keywords: ["holiness", "holy", "sanctification", "sanctified", "purity", "moral purity", "consecration", "separation", "set apart", "without holiness"],
    weight: 1.0,
    response: `**Holiness** is not optional at JCTM — it is the foundational standard of authentic Christian living, as declared in Hebrews 12:14:

> *"Without holiness, no man shall see the Lord."* — Hebrews 12:14

**What holiness means at JCTM:**

🔥 **Personal Sanctification** — Being set apart from the world and unto God in thought, word, and action

🛡️ **Moral Purity** — Rejecting sexual immorality, dishonesty, greed, worldliness, and anything that corrupts the soul

📖 **Doctrinal Purity** — Refusing to compromise God's Word for social acceptance, popularity, or financial gain

✝️ **Practical Consecration** — Living visibly different from the world as a reflection of Christ's character

**Key scriptures on holiness:**
- 1 Peter 1:15-16 — *"Be holy, for I am holy"*
- Romans 12:1-2 — Presenting your body as a living sacrifice
- 2 Corinthians 6:17 — *"Come out from among them and be separate"*

Prophet Amos warns against the popular argument that "holiness is legalism" — this is a deception used to excuse moral compromise and water down God's standard.`,
    enrichment: "Holiness is central to JCTM. Hebrews 12:14 is the foundation. Personal, moral, doctrinal, and practical holiness. Prophet Amos warns against calling holiness legalism.",
  },
  {
    id: "water_baptism",
    intent: "water_baptism",
    keywords: ["baptism", "water baptism", "baptize", "immersion", "dunking", "sprinkle", "infant baptism", "mode of baptism", "baptizo"],
    weight: 1.0,
    response: `JCTM teaches **water baptism by full immersion** as the biblical, New Testament mode — grounded in the original Greek word *"baptizo,"* which means **to immerse or submerge**.

**The JCTM doctrine on water baptism:**

📖 **Mode:** Full immersion in water — as Jesus was baptized in the Jordan River (Matthew 3:16) and as practiced throughout the New Testament (Acts 8:38-39)

👤 **Candidate:** Believing adults who have consciously confessed faith in Jesus Christ — *not infants*, who cannot repent or believe

✝️ **Purpose:** An outward declaration of an inward reality — death to sin and resurrection to new life in Christ (Romans 6:3-4). It is not the means of salvation but a public ordinance of the saved.

🙏 **Formula:** In the name of the Father, Son, and Holy Spirit (Matthew 28:19)

**JCTM identifies infant baptism** as an early corruption of New Testament doctrine — since it cannot be performed in response to personal faith or repentance.

> *"Repent and be baptized, every one of you, in the name of Jesus Christ for the remission of sins."* — Acts 2:38`,
    enrichment: "Water baptism by full immersion. Greek 'baptizo' means immerse. For believing adults only, not infants. Romans 6:3-4. Not the means of salvation. Matthew 28:19 formula.",
  },
  {
    id: "holy_spirit",
    intent: "holy_spirit_baptism",
    keywords: ["holy spirit", "baptism of the spirit", "speaking in tongues", "tongues", "gifts of the spirit", "spirit baptism", "receive the spirit", "charismatic", "pentecostal"],
    weight: 1.0,
    response: `JCTM teaches that the **Baptism of the Holy Spirit** is a distinct, powerful experience available to all born-again believers — separate from water baptism and salvation.

**Key truths about Holy Spirit Baptism:**

🔥 **The Initial Evidence:** The biblical sign of Holy Spirit baptism is speaking in other tongues (Acts 2:4, Acts 10:46, Acts 19:6) — not just an emotional feeling

⚡ **Its Purpose:** An endowment of power for effective Christian witness (Acts 1:8) — not a second salvation, but supernatural enablement for service

🌊 **It is for You:** The promise is to all who believe (Acts 2:38-39) — not reserved for a special few

**The gifts of the Spirit (1 Corinthians 12)** are still fully operational today within proper biblical order.

⚠️ **Important warnings from Prophet Amos:**
- JCTM warns against **counterfeit tongues** in some charismatic circles — where emotional excitement is mistaken for genuine Spirit baptism
- All prophecy must be tested against Scripture (1 Thessalonians 5:20-21) — no prophecy can contradict the written Word of God

> *"But you shall receive power when the Holy Spirit has come upon you."* — Acts 1:8`,
    enrichment: "Holy Spirit baptism is distinct from salvation. Evidenced by tongues (Acts 2:4, 10:46, 19:6). Power for witness. All gifts still active. Warnings against counterfeit tongues. Test prophecy by scripture.",
  },
  {
    id: "five_fold",
    intent: "five_fold_ministry",
    keywords: ["five fold", "fivefold", "five-fold", "apostle", "prophet", "evangelist", "pastor", "teacher", "ephesians 4", "ministry offices", "five offices"],
    weight: 1.0,
    response: `JCTM teaches that all **five ministry offices** from Ephesians 4:11 are still active and necessary for the maturity and health of the church today:

📜 **The Five-Fold Ministry Offices:**
1. **Apostles** — Sent ones who establish foundational church principles
2. **Prophets** — God's spokesmen who reveal divine will and direction *(Prophet Amos holds this office)*
3. **Evangelists** — Carriers of the gospel mandate to the lost
4. **Pastors** — Shepherds who nurture and care for God's flock
5. **Teachers** — Instructors who ground believers in sound doctrine

> *"He gave some to be apostles, some prophets, some evangelists, and some pastors and teachers, for the equipping of the saints."* — Ephesians 4:11-12

**JCTM's position on false offices:**
- Prophet Amos's office is not self-appointed — it is confirmed by the fruit of his ministry, decades of prophetic accuracy, and divine revelations
- JCTM strongly warns against people **giving themselves titles** of "Apostle" or "Prophet" without genuine divine calling
- True five-fold ministers serve the church for its edification — **not for personal enrichment or celebrity status**`,
    enrichment: "Five-fold ministry: apostles, prophets, evangelists, pastors, teachers all still active (Ephesians 4:11). Prophet Amos holds prophet office, divinely confirmed. Warnings against self-appointed apostles/prophets.",
  },
  {
    id: "giving",
    intent: "giving_tithing",
    keywords: ["give", "giving", "tithe", "tithes", "offering", "seed", "sow", "donation", "support", "partner", "financial", "paystack", "stripe", "how to give", "give online", "donate online", "donate", "how do i give", "online giving", "send money", "support jctm", "partner with jctm"],
    weight: 1.0,
    response: `Giving to JCTM is an act of **worship and partnership** with the Correction Mandate — not a prosperity formula or transactional exchange.

**JCTM's biblical approach to giving:**

✝️ **Giving is worship** — not a seed to guarantee personal blessings or financial returns (2 Corinthians 9:7)

📖 **Tithes** (10% of income) are a covenant principle from Malachi 3:10 — given from a heart of love and gratitude, never from compulsion or manipulation

🌍 **Your giving supports:** Temple TV broadcasts, the Correction Mandate outreach, and spreading the true gospel worldwide

⚠️ **What JCTM does NOT teach:** "Sow a seed and get a hundredfold return" — this transactional approach is a hallmark of the prosperity gospel that JCTM exposes and corrects

**How to give online:**
- Visit **jctm.org.ng/give**
- Payment options: Paystack (Nigerian Naira) | Stripe (USD, international)

> *"Each one must give as he has decided in his heart, not reluctantly or under compulsion, for God loves a cheerful giver."* — 2 Corinthians 9:7`,
    enrichment: "Giving is worship and partnership. Biblical stewardship. Tithes from Malachi 3:10. NOT prosperity gospel. Give at jctm.org.ng/give via Paystack or Stripe. God loves cheerful giver.",
  },
  {
    id: "temple_tv",
    intent: "temple_tv",
    keywords: ["temple tv", "youtube", "channel", "watch", "video", "stream", "live", "@templetvjctm", "sermons online", "watch online", "broadcast"],
    weight: 1.0,
    response: `**Temple TV** is the official YouTube broadcast channel of Jesus Christ Temple Ministry (JCTM).

📺 **How to find Temple TV:**
- YouTube Handle: **@TEMPLETVJCTM**
- URL: https://www.youtube.com/@TEMPLETVJCTM
- Or browse sermons here on the JCTM Digital Sanctuary: **jctm.org.ng/sermons**

**Content you'll find on Temple TV:**
- Sunday service broadcasts (live and recorded)
- Deep prophetic teachings from Prophet Amos Evomobor
- Doctrinal series on the Correction Mandate
- Holiness teachings and practical Christian living
- Testimonies and crusade coverage
- End times prophecy and current affairs

**Popular themes:** Correction Mandate • Primitive Christianity • Exposing Prosperity Gospel • Holy Spirit Baptism • Holiness Doctrine • End Times

Temple TV reaches believers in 40+ nations around the world, making JCTM's message of doctrinal restoration available to all.`,
    enrichment: "Temple TV is the official YouTube channel @TEMPLETVJCTM. Also available at jctm.org.ng/sermons. Contains sermons, live services, teachings from Prophet Amos. 40+ nations.",
  },
  {
    id: "contact",
    intent: "contact_location",
    keywords: ["contact", "location", "address", "where", "how to reach", "phone", "email", "social media", "facebook", "ebrumede", "warri", "delta state", "find jctm", "phone number", "telephone", "call jctm", "reach jctm", "contact jctm", "jctm address", "jctm location", "jctm phone", "how to contact", "get in touch"],
    weight: 1.0,
    response: `Here's how you can connect with Jesus Christ Temple Ministry (JCTM):

📍 **Physical Location:**
Ebrumede Temple, Off Sapele Road
Warri, Delta State, Nigeria

📧 **Email:** info@jctm.org.ng

📺 **YouTube (Temple TV):** https://www.youtube.com/@TEMPLETVJCTM

📘 **Facebook:** https://www.facebook.com/templetvjctm

🌐 **Website:** https://jctm.org.ng

**Service Times:**
- Sunday Services: 8:00 AM – 12:00 PM WAT (also broadcast live on Temple TV)
- Wednesday Services: 5:00 PM – 8:00 PM WAT

**Prayer Requests:** You can submit prayer requests at jctm.org.ng/prayer

If you're outside Warri, you can also find a **viewing centre** near you at jctm.org.ng/viewing-centres.`,
    enrichment: "JCTM location: Ebrumede Temple, Warri, Delta State Nigeria. Email: info@jctm.org.ng. Sunday 8-12 WAT, Wednesday 5-8 PM WAT. Facebook and YouTube @templetvjctm.",
  },
  {
    id: "service_times",
    intent: "service_times",
    keywords: [
      "service time", "service times", "sunday service", "sunday worship",
      "sunday school", "sunday meeting", "wednesday service", "church service",
      "when does service start", "when is service", "what time", "meeting time",
      "worship time", "church time", "programme time", "fellowship time",
      "midweek service", "weekly programme", "what time does", "when do you meet"
    ],
    weight: 1.0,
    response: `Here are the **JCTM Service Times** at Ebrumede Temple, Warri:

🙏 **Sunday Services:**
8:00 AM – 12:00 PM WAT
*(Services are also broadcast LIVE on Temple TV — YouTube: @TEMPLETVJCTM)*

📖 **Wednesday Midweek Services:**
5:00 PM – 8:00 PM WAT

📍 **Venue:** Ebrumede Temple, Off Sapele Road, Warri, Delta State, Nigeria

📺 If you can't attend in person, you can **watch live and recorded services** on Temple TV:
👉 https://www.youtube.com/@TEMPLETVJCTM

If you're outside Warri, you may find a **viewing centre** near you at:
👉 jctm.org.ng/viewing-centres

All are welcome — come as you are!`,
    enrichment: "JCTM service times: Sunday 8:00 AM - 12:00 PM WAT, Wednesday 5:00 PM - 8:00 PM WAT. Location: Ebrumede Temple, Warri. Live broadcast on Temple TV YouTube @TEMPLETVJCTM.",
  },
  {
    id: "crusade",
    intent: "warri_crusade",
    keywords: ["crusade", "warri city crusade", "2026 crusade", "april 30", "may 1", "outdoor crusade", "crusade 2026", "rapture", "tribulation", "okumagba"],
    weight: 1.0,
    response: `**Warri City Crusade 2026 — Prophet Amos Global Crusade**

🔥 **Theme:** *"Be Ready For Rapture: Tribulation Is Coming! Run For Your Soul!"*

📅 **Dates:** April 30 – May 1, 2026 (Two-day open-air crusade)

📍 **Location:** Ighogbadu Primary School, Obodo, Okumagba Avenue, Warri South LGA, Delta State, Nigeria

📞 **Contact:** +234(0)8081313111

**What to expect:**
- Powerful open-air gospel preaching from Prophet Amos Evomobor
- Healing and miracle services
- Prophetic declarations and end-time messages
- Mass worship gatherings
- Testimonies from believers across the Niger Delta region

👥 **Who is welcome?** ALL are welcome — believers, seekers, and the general public

This crusade is JCTM's major evangelistic thrust for 2026, bringing the Correction Mandate and the true gospel directly to the streets of Warri. Thousands are expected from across the Niger Delta.

Get more details and set a reminder at **jctm.org.ng/crusade**`,
    enrichment: "Warri City Crusade 2026: April 30 - May 1 2026. Ighogbadu Primary School, Okumagba Avenue Warri South LGA. Theme: Be Ready for Rapture. Contact: +234(0)8081313111. Open air crusade.",
  },
  {
    id: "sermons",
    intent: "sermon_library",
    keywords: ["sermons", "sermon", "teachings", "teaching", "message", "preach", "preaching", "library", "archive", "find sermons", "listen", "topic"],
    weight: 0.8,
    response: `The **JCTM Sermon Library** is a growing collection of teachings from Prophet Amos Evomobor, covering the full breadth of JCTM doctrine.

📚 **Browse sermons at:** jctm.org.ng/sermons

**Major teaching themes in the library:**
- 📖 The Correction Mandate (the ministry's core assignment)
- 🌿 Primitive Christianity and apostolic faith
- 🔥 Holiness — the standard of God for believers
- ❌ Exposing the Prosperity Gospel
- 🌬️ Holy Spirit baptism and the gifts
- 💧 Biblical water baptism
- ⏰ End times prophecy and readiness
- 🙏 Prayer, fasting, and consecration
- 🛡️ Spiritual warfare and protection

**Also available:**
- 🤖 **Sermon Assistant** — Ask questions directly from the sermon library at jctm.org.ng/sermon-assistant
- 📺 **Temple TV** (YouTube) — Watch live and archived services at https://www.youtube.com/@TEMPLETVJCTM
- 🔍 **Scripture Study** — Deep AI-assisted Bible analysis at jctm.org.ng/scripture-study`,
    enrichment: "Sermon library at jctm.org.ng/sermons. Topics: Correction Mandate, Primitive Christianity, Holiness, End Times, etc. Sermon Assistant and Temple TV also available.",
  },
  {
    id: "prayer",
    intent: "prayer_support",
    keywords: ["prayer", "pray", "intercession", "prayer request", "need prayer", "praying", "prayer point", "please pray", "prayer for"],
    negativeKeywords: ["how to pray", "teach me to pray", "prayer life"],
    weight: 0.9,
    response: `The prayer team of Jesus Christ Temple Ministry is here to stand with you before the throne of God.

🙏 **Submit a prayer request at:** jctm.org.ng/prayer

Our team intercedes daily for:
- Healing and physical restoration
- Financial breakthrough and divine provision
- Spiritual growth and consecration
- Family restoration and protection
- Deliverance from spiritual bondage
- Guidance in life decisions

**A scripture for you as you pray:**

> *"Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God. And the peace of God, which transcends all understanding, will guard your hearts and your minds in Christ Jesus."* — Philippians 4:6-7

You are not alone in what you are carrying. God hears every word of prayer lifted in faith, and He is faithful. Share your request with us — we will hold it before the Lord.`,
    enrichment: "Prayer requests at jctm.org.ng/prayer. Ministry intercedes daily for healing, provision, family, deliverance, guidance. Philippians 4:6-7.",
  },
  {
    id: "join",
    intent: "join_membership",
    keywords: ["join", "become a member", "membership", "register", "sign up", "join jctm", "how to join", "become part"],
    weight: 0.8,
    response: `Welcome! There are several ways to become part of the JCTM family:

**🌐 Online:**
- Join as a member at **jctm.org.ng/join** — register your details and connect with our community
- Follow Temple TV on YouTube: https://www.youtube.com/@TEMPLETVJCTM
- Like our Facebook page: https://www.facebook.com/templetvjctm

**🏛️ In-Person (Warri):**
- Visit us at Ebrumede Temple, Warri, Delta State, Nigeria
- Sunday Services: 8:00 AM – 12:00 PM WAT
- Wednesday Services: 5:00 PM – 8:00 PM WAT

**📍 Viewing Centres:**
If you're in Nigeria but not in Warri, you may find a viewing centre near you at **jctm.org.ng/viewing-centres**

**📧 Questions?** Reach us at info@jctm.org.ng

We welcome everyone who is hungry for truth, committed to holiness, and willing to embrace the Correction Mandate as a standard for Christian living.`,
    enrichment: "Join at jctm.org.ng/join. In-person at Ebrumede Temple Warri. Viewing centres at jctm.org.ng/viewing-centres. Email info@jctm.org.ng.",
  },
  {
    id: "viewing_centres",
    intent: "viewing_centres",
    keywords: ["viewing centre", "viewing center", "branch", "centre near me", "satellite", "affiliate", "outside warri", "other locations"],
    weight: 0.9,
    response: `JCTM has **viewing centres** across Nigeria where you can fellowship and watch Temple TV services together with other believers.

📍 **Find a viewing centre near you at:** jctm.org.ng/viewing-centres

If there isn't a viewing centre in your area yet, you can:
- Watch all services live and on-demand via Temple TV on YouTube (@TEMPLETVJCTM)
- Access all teachings through the JCTM Digital Sanctuary at jctm.org.ng/sermons
- Contact us at info@jctm.org.ng to ask about starting a viewing centre in your community

> *"Where two or three are gathered together in My name, I am there in the midst of them."* — Matthew 18:20`,
    enrichment: "Viewing centres directory at jctm.org.ng/viewing-centres. Can also watch on Temple TV YouTube. Contact info@jctm.org.ng to start a viewing centre.",
  },
  {
    id: "greeting",
    intent: "general_greeting",
    keywords: ["hello", "hi", "good morning", "good afternoon", "good evening", "hey", "greetings", "shalom", "peace", "welcome"],
    weight: 0.7,
    response: `Peace and grace to you in the name of Jesus Christ! I am **TempleBots** — the AI assistant of Jesus Christ Temple Ministry (JCTM), Warri, Nigeria.

I am here to help you explore JCTM's teachings, doctrines, and resources. Here are some things you can ask me:

✦ *"What is the Correction Mandate?"*
✦ *"Who is Prophet Amos Evomobor?"*
✦ *"How can I watch Temple TV sermons?"*
✦ *"What does JCTM teach about water baptism?"*
✦ *"Tell me about the Warri City Crusade 2026"*
✦ *"How can I give to support the ministry?"*

How may I assist you today?`,
    enrichment: "User greeted TempleBots. Provide a warm welcome and guide them to JCTM resources. TempleBots is the AI assistant of JCTM.",
  },

  // ── New Intents ───────────────────────────────────────────────────────────

  {
    id: "end_times",
    intent: "end_times",
    keywords: [
      "end times", "end time", "rapture", "second coming", "tribulation", "antichrist",
      "mark of the beast", "666", "last days", "apocalypse", "eschatology",
      "book of revelation", "armageddon", "great tribulation", "day of the lord",
      "signs of the times", "end of the world", "is jesus coming soon", "when is rapture",
      "millennium", "thousand years", "beast", "false prophet", "one world government",
    ],
    weight: 1.0,
    response: `**End Times Prophecy** is one of the most urgent messages of Jesus Christ Temple Ministry (JCTM) under Prophet Amos Evomobor.

The Bible is unambiguous: Jesus Christ **will return** physically, visibly, and gloriously — and the signs of that return are happening around us now.

**🔥 The Warri City Crusade 2026 theme says it all:**
*"Be Ready For Rapture: Tribulation Is Coming! Run For Your Soul!"*

## What JCTM Teaches on End Times:

**The Rapture** — The catching away of true believers before or during the tribulation. Not all who call themselves Christians will be taken — only those who are genuinely born again, living in holiness, and watching for His return (1 Thessalonians 4:16-17, Matthew 24:44).

**The Tribulation** — A period of unprecedented global suffering described in Revelation 6-19. The mark of the beast (666) will be enforced as an economic and spiritual allegiance system (Revelation 13:16-18). **Do not take it.**

**The Antichrist** — A political and religious world figure who will demand worship. He will arise from the current world system. Believers must not be deceived.

**Signs Already Happening:**
- Global moral collapse (2 Timothy 3:1-5)
- Apostasy within the church (2 Thessalonians 2:3)
- Wars, famines, earthquakes (Matthew 24:6-8)
- Israel's restoration and global prophetic alignment

> *"Watch therefore, for you do not know what hour your Lord is coming."* — Matthew 24:42

**Prophet Amos's urgent word:** The end-time message is not to cause fear but to provoke holy preparation. Repent. Live holy. Stay close to the Word. Watch and pray.

📺 **Watch end-times teachings:** YouTube **@TEMPLETVJCTM**`,
    enrichment: "End times teaching from JCTM. Rapture, tribulation, antichrist, second coming. Warri Crusade 2026 theme: Be Ready for Rapture. Urgent call to holiness and preparation. Matthew 24, 1 Thessalonians 4:16-17, Revelation 13.",
  },

  {
    id: "fasting_prayer",
    intent: "fasting_prayer",
    keywords: [
      "fasting", "fast", "how to fast", "daniel fast", "prayer and fasting",
      "3 day fast", "7 day fast", "21 day fast", "dry fast", "water fast",
      "break fast", "fasting and prayer", "fasting benefits", "why fast",
      "biblical fasting", "corporate fasting", "consecration fast",
    ],
    weight: 1.0,
    response: `**Fasting** is one of the most powerful spiritual disciplines in the believer's life, consistently practised throughout Scripture and emphasized at Jesus Christ Temple Ministry (JCTM).

## What the Bible Teaches on Fasting:

**🔥 Jesus assumed believers would fast** — He said *"when you fast"* not *"if you fast"* (Matthew 6:16-18). Fasting is not optional for the serious disciple.

**Why Christians Fast:**
1. **To seek God's face** — Fasting shifts your attention from physical appetite to spiritual hunger (Psalm 35:13)
2. **For spiritual breakthrough** — Some demonic bondages only break through prayer AND fasting (Mark 9:29)
3. **For national and personal intercession** — Esther, Nehemiah, Daniel, and Paul all fasted at critical moments
4. **For consecration** — Preparing to receive a word, make a major decision, or enter a new season
5. **For repentance** — Fasting accompanies genuine turning back to God (Joel 2:12)

## Practical Guidelines:

**Types of Biblical Fasting:**
- 🌊 **Complete fast** — No food or water (Moses, Esther — not recommended beyond 3 days without medical guidance)
- 💧 **Water fast** — No food, water only — the most common biblical fast
- 🥦 **Daniel fast** — Vegetables and water only (Daniel 1 & 10) — excellent for longer periods
- ⏱️ **Partial/time fast** — Skip certain meals (e.g., breakfast only, until 6 PM)

**How to fast effectively:**
1. Start with prayer — declare your purpose before God
2. Set a specific duration and stick to it
3. Use the time you would normally eat for prayer, Scripture reading, and worship
4. Break your fast gently — start with fruits or light foods
5. Journal what God speaks to you during the fast

> *"Is this not the fast that I have chosen: to loose the bonds of wickedness, to undo the heavy burdens, to let the oppressed go free?"* — Isaiah 58:6

📺 Watch Prophet Amos teach on fasting and prayer: **YouTube @TEMPLETVJCTM**`,
    enrichment: "Fasting is biblical discipline. Jesus said 'when you fast'. Types: complete, water, Daniel, partial. Purpose: breakthrough, intercession, consecration, repentance. Isaiah 58:6, Matthew 6:16-18, Mark 9:29.",
  },

  {
    id: "spiritual_warfare",
    intent: "spiritual_warfare",
    keywords: [
      "spiritual warfare", "spiritual attack", "spiritual battle", "warfare prayer",
      "demonic attack", "demon", "demons", "deliverance", "oppression", "possession",
      "bind and loose", "binding", "loosing", "principalities", "powers",
      "stronghold", "spiritual stronghold", "rebuke", "cast out", "breaking chains",
      "ancestral curse", "generational curse", "witchcraft", "occult", "dark forces",
    ],
    weight: 1.0,
    response: `**Spiritual Warfare** is a reality that every born-again believer must be equipped to navigate. Jesus Christ Temple Ministry (JCTM) under Prophet Amos Evomobor teaches biblical warfare from a place of authority in Christ — not fear.

## The Reality of Spiritual War:

> *"For we do not wrestle against flesh and blood, but against principalities, against powers, against the rulers of the darkness of this age, against spiritual hosts of wickedness in the heavenly places."* — Ephesians 6:12

**The battle is real, but the victory is already won at the Cross** (Colossians 2:15).

## Your Armour (Ephesians 6:13-18):

🛡️ **Belt of Truth** — Know the Word; lies are the enemy's primary weapon
🛡️ **Breastplate of Righteousness** — Holy living removes openings for attack
🛡️ **Gospel of Peace** — Stability in your footing and identity
🛡️ **Shield of Faith** — Quench every fiery dart; faith is your defence
🛡️ **Helmet of Salvation** — Guard your mind from doubt and deception
⚔️ **Sword of the Spirit** — The Word of God is your only offensive weapon
🙏 **Prayer in the Spirit** — Sustained intercession

## JCTM's Position on Deliverance:

- **Binding and loosing (Matthew 18:18)** operates within the authority of Christ's name and the local church — not as a personal power
- **Generational/ancestral curses** can be broken through genuine repentance, faith in the blood of Jesus, and walking in righteousness (Galatians 3:13)
- **Demonic oppression** (attacks from outside) is different from possession — believers can experience oppression; the solution is always prayer, fasting, and standing firm in God's Word
- **Witchcraft and the occult** must be completely renounced — any involvement opens spiritual doors (Deuteronomy 18:10-12)

⚠️ **Warning:** Prophet Amos cautions against sensationalized "deliverance ministries" that commercialize warfare. True deliverance comes through the Holy Spirit — not through a man's dramatic theatrics.

🙏 **For personal prayer support:** jctm.org.ng/prayer
📺 **Watch warfare teachings:** **YouTube @TEMPLETVJCTM**`,
    enrichment: "Spiritual warfare is real. Ephesians 6:12. Armour of God. JCTM teaches binding/loosing within authority of Christ. Generational curses broken by Christ (Galatians 3:13). Warning against sensationalized deliverance. Prayer at jctm.org.ng/prayer.",
  },

  {
    id: "salvation_new_birth",
    intent: "salvation_new_birth",
    keywords: [
      "salvation", "saved", "how to be saved", "accept jesus", "born again", "new birth",
      "eternal life", "sinner's prayer", "how do i get saved", "give my life to christ",
      "accept christ", "receive jesus", "what must i do to be saved", "plan of salvation",
      "are you saved", "what is salvation", "gospel", "repent and believe",
      "the way of salvation", "path to heaven", "how to go to heaven",
    ],
    weight: 1.0,
    response: `**Salvation** — the most important decision any human being will ever make.

Jesus Christ Temple Ministry (JCTM) presents the pure, uncompromised gospel: **salvation is by grace through faith in Jesus Christ alone** (Ephesians 2:8-9). Not through church attendance, good works, financial giving, or religious ritual.

## The Gospel in Four Points:

**1. 🔴 All have sinned** — *"For all have sinned and fall short of the glory of God."* (Romans 3:23). Every person is born with a sin nature that separates them from God.

**2. ⚠️ Sin's wage is death** — *"For the wages of sin is death."* (Romans 6:23a). Not just physical death — but eternal separation from God.

**3. ✝️ Christ paid the price** — *"But God demonstrates His own love toward us, in that while we were still sinners, Christ died for us."* (Romans 5:8). Jesus took your sin, your guilt, and your punishment on the Cross.

**4. 🎁 Receive the free gift** — *"But the gift of God is eternal life in Christ Jesus our Lord."* (Romans 6:23b). Salvation is a gift — you cannot earn it; you can only receive it by faith.

## How to Be Saved — Right Now:

1. **Acknowledge** — that you are a sinner in need of a Saviour
2. **Believe** — that Jesus Christ died for your sins and rose from the dead (Romans 10:9)
3. **Confess** — with your mouth that Jesus is Lord (Romans 10:10)
4. **Repent** — turn away from your old life and surrender to Christ
5. **Follow** — be baptized, find a doctrinally sound church, and grow in God's Word

You can pray this right now:

> *"Lord Jesus, I confess I am a sinner. I believe You died for my sins and rose again. I receive You as my Lord and Saviour. Forgive me and come into my life. I commit to follow You. Amen."*

If you just prayed that sincerely — welcome to the family of God! 🎉

📩 **Contact JCTM:** info@jctm.org.ng — we'd love to walk with you in your new faith
📺 **New believer resources:** **YouTube @TEMPLETVJCTM**`,
    enrichment: "Salvation by grace through faith alone (Ephesians 2:8-9). Romans 3:23, 6:23, 5:8, 10:9-10. Four points: sin, death, Christ paid, receive gift. Sinner's prayer included. Contact info@jctm.org.ng for follow-up.",
  },

  {
    id: "repentance_restoration",
    intent: "repentance_restoration",
    keywords: [
      "repentance", "repent", "how to repent", "turn from sin", "backsliding", "backslider",
      "restoration", "returning to god", "i drifted away", "i left the church",
      "come back to god", "returning to faith", "rededication", "i sinned",
      "fallen away", "i strayed", "prodigal", "restore me", "how do i come back",
    ],
    weight: 0.95,
    response: `The call to **repentance** is the heartbeat of the gospel — and it is always accompanied by the open arms of a Father who runs to meet His returning child (Luke 15:20).

Jesus Christ Temple Ministry (JCTM) teaches genuine biblical repentance — not guilt, shame, or religious performance, but a transforming change of heart and direction.

## What Repentance Really Means:

The Greek word is **metanoia** — "a change of mind" that leads to a change of direction. True repentance is not:
- ❌ Simply feeling sorry (2 Corinthians 7:10 — "the sorrow of the world produces death")
- ❌ A religious ritual or repeated confession with no change
- ❌ Self-punishment or prolonged guilt

True repentance IS:
- ✅ A genuine turning of the heart toward God
- ✅ Acknowledging specific sin before God with honesty
- ✅ A decision to change direction — empowered by the Holy Spirit, not willpower alone
- ✅ Accompanied by the fruit of changed behaviour (Luke 3:8)

## To the Backslider — God Is Calling You Home:

> *"Return, O backsliding children, says the LORD; for I am married to you."* — Jeremiah 3:14

If you have walked away from faith, drifted from God's standard, or abandoned the church — know this: **the door is open**. The Father is not angry — He is watching and waiting (Luke 15:20).

## Steps to Restoration:

1. **Come as you are** — God does not require you to clean yourself up before coming to Him
2. **Be specific in confession** — name your sin honestly before God (1 John 1:9)
3. **Receive forgiveness** — *"If we confess our sins, He is faithful and just to forgive us our sins and cleanse us from all unrighteousness"* (1 John 1:9)
4. **Return to the Word and to a sound church community**
5. **Don't look back** — Like Lot's wife — keep moving forward (Luke 9:62)

🙏 **Submit a prayer request:** jctm.org.ng/prayer
📩 **Contact the ministry:** info@jctm.org.ng`,
    enrichment: "Repentance is metanoia - change of mind leading to change of direction. Not guilt or shame. Backsliders welcomed: Jeremiah 3:14. 1 John 1:9. Luke 15 prodigal son. Steps to restoration. Contact jctm.org.ng/prayer.",
  },

  {
    id: "praise_worship",
    intent: "praise_worship",
    keywords: [
      "praise", "worship", "praise and worship", "thanksgiving", "glorify god",
      "praise god", "worship songs", "hymns", "singing", "how to worship",
      "spirit of worship", "true worship", "worship in spirit and truth",
      "praise service", "corporate worship", "adoration", "magnify",
    ],
    weight: 0.9,
    response: `**Praise and Worship** is the highest activity of the human soul — the direct ascent of the redeemed heart into the presence of the Living God.

Jesus Christ Temple Ministry (JCTM) maintains a culture of deep, authentic, scripture-grounded worship — not entertainment, not performance, but genuine encounter with the Holy Spirit.

## What True Worship Means:

> *"God is Spirit, and those who worship Him must worship in spirit and truth."* — John 4:24

**Two pillars of authentic worship:**
- **In Spirit** — From the heart, prompted by the Holy Spirit, not manufactured emotion
- **In Truth** — Grounded in the revealed Word of God, not in tradition or personal preference

## Praise vs. Worship:

🎺 **Praise** — Declaring the greatness and acts of God, often with energy and joy (Psalm 150). Praise is the *declaration* of who God is.

🕊️ **Worship** — Intimate adoration of God's person — bowing the heart before His presence. Worship is the *response* to who God is.

## Why Praise Is a Weapon:

2 Chronicles 20 — King Jehoshaphat sent the singers FIRST into battle. God showed up when they began to praise. **Praise is not passive — it is spiritual warfare in its most beautiful form.**

> *"Let the high praises of God be in their mouth, and a two-edged sword in their hand."* — Psalm 149:6

## Practical Encouragement:

- Praise God in private before you praise in public — cultivate an intimate altar
- Sing the Psalms — they are God's own songbook for His people
- Thanksgiving is the gateway into deeper worship (Psalm 100:4)
- Worship should flow from a consecrated life — holiness and worship are inseparable at JCTM

📺 Watch JCTM worship services on Temple TV: **YouTube @TEMPLETVJCTM**`,
    enrichment: "Worship must be in spirit and truth (John 4:24). Praise is declaration; worship is intimate adoration. Praise as warfare (2 Chronicles 20, Psalm 149:6). Psalm 100:4 gateway. Temple TV on YouTube.",
  },

  {
    id: "bible_study_method",
    intent: "bible_study_method",
    keywords: [
      "how to study the bible", "bible study", "bible reading", "quiet time",
      "devotion", "devotional time", "study scripture", "how to read the bible",
      "bible reading plan", "morning devotion", "daily word", "word for today",
      "scripture reading", "how do i study", "inductive bible study",
      "bible study method", "how to understand the bible",
    ],
    negativeKeywords: ["scripture inquiry", "what does this verse mean"],
    weight: 0.9,
    response: `**Studying God's Word** is the most important discipline in a believer's life — and yet many Christians feel unequipped to do it effectively.

Jesus Christ Temple Ministry (JCTM) teaches believers to approach Scripture not as a textbook to be analyzed, but as a living Word to be received (Hebrews 4:12).

## A Practical Bible Study Framework:

**📖 Step 1: OBSERVATION** — What does it say?
Read the passage slowly. Read it multiple times. What is actually written? Who is speaking? To whom? What are the key words and phrases?

**🔍 Step 2: INTERPRETATION** — What does it mean?
- Read in context — never isolate a verse from its surrounding passage
- Compare Scripture with Scripture — the Bible interprets itself
- Consider original language (Greek/Hebrew) — tools like Bible Hub or Blue Letter Bible are free online
- Ask: What did this mean to the original hearers?

**✅ Step 3: APPLICATION** — What should I do?
This is the most important step. Every passage of Scripture has a corresponding demand on your life. Ask:
- What does this teach me about God?
- What does this reveal about my own heart?
- What specific action or change does this require of me today?

## Prophet Amos's Recommendation for Beginners:

Start with these books in order:
1. **John** — The Gospel of Christ's identity and mission
2. **Romans** — The complete theology of salvation
3. **Acts** — The Holy Spirit-powered early church
4. **Ephesians** — Your identity and authority in Christ
5. **Psalms** — The prayer and worship foundation

## Daily Quiet Time Structure:

- 📖 **Read** — One chapter minimum (same passage for 3 days to absorb it)
- 📝 **Write** — One key verse that stood out and why
- 🙏 **Pray** — Respond to what you read in prayer
- 📣 **Declare** — Speak a truth from the passage over your day

*Daily devotions are also available at jctm.org.ng/devotion*
📺 Sermon series on Scripture: **YouTube @TEMPLETVJCTM**`,
    enrichment: "Three-step Bible study: Observation, Interpretation, Application. Beginner books: John, Romans, Acts, Ephesians, Psalms. Daily quiet time structure. Devotions at jctm.org.ng/devotion. Temple TV YouTube.",
  },

  {
    id: "sin_temptation",
    intent: "sin_temptation",
    keywords: [
      "temptation", "sin", "struggling with sin", "overcome sin", "how to stop sinning",
      "sexual sin", "pornography", "fornication", "addiction", "struggling",
      "the flesh", "carnal", "worldliness", "lust", "pride", "lying",
      "habitual sin", "sinful habit", "how do i overcome", "i keep falling",
    ],
    weight: 0.95,
    response: `The struggle with **sin and temptation** is one of the most honest conversations the Bible has — and one of the most urgent for every believer today.

JCTM teaches that overcoming sin is not about willpower — it is about abiding in the life-giving power of the Holy Spirit.

## God's Truth About Temptation:

> *"No temptation has overtaken you except such as is common to man; but God is faithful, who will not allow you to be tempted beyond what you are able, but with the temptation will also make the way of escape."* — 1 Corinthians 10:13

Every temptation has an escape route. Your job is to take it.

## Why Believers Still Struggle:

1. **The flesh is not yet glorified** — Even Paul said: *"I do not do the good I want, but the evil I do not want is what I keep on doing."* (Romans 7:19) — This is the tension of the already-but-not-yet
2. **Spiritual hunger unfed** — Temptation grows when the soul is not regularly nourished by the Word and prayer
3. **Wrong environment** — Continued exposure to triggers makes resistance harder (1 Corinthians 15:33)
4. **No accountability** — God designed believers to live in community, not isolation

## Practical Victory Strategies:

⚔️ **Know your weakness** — Where do you consistently fall? That is where to build your strongest defences
🏃 **Flee, don't fight** — Joseph didn't argue with Potiphar's wife; he ran (Genesis 39:12). Some temptations require escape, not engagement
📖 **Saturate your mind with the Word** — *"Your word I have hidden in my heart, that I might not sin against You."* (Psalm 119:11)
🙏 **Pray immediately** — The moment temptation arises, pray — don't reason with it
👥 **Get accountable** — Confess your struggles to a trusted, mature believer (James 5:16)
🔥 **Walk in the Spirit** — *"Walk in the Spirit and you shall not fulfill the lust of the flesh."* (Galatians 5:16)

🙏 Submit a prayer request for breakthrough: jctm.org.ng/prayer`,
    enrichment: "Overcoming sin and temptation. 1 Corinthians 10:13 - no temptation beyond bearing. Galatians 5:16 - walk in Spirit. Flee, don't engage (Genesis 39:12). Psalm 119:11. James 5:16 accountability. Prayer at jctm.org.ng/prayer.",
  },

  {
    id: "marriage_family",
    intent: "marriage_family",
    keywords: [
      "marriage", "husband", "wife", "spouse", "married", "wedding",
      "christian marriage", "family", "children", "parenting", "raising children",
      "divorce", "separation", "marital problems", "my marriage",
      "relationship", "dating", "courtship", "premarital", "covenant marriage",
      "single", "finding a spouse", "should i get married",
    ],
    weight: 0.9,
    response: `**Marriage and Family** stand at the centre of God's design for human flourishing — and JCTM teaches on these topics with both scriptural authority and pastoral sensitivity.

## God's Design for Marriage:

> *"Therefore a man shall leave his father and mother and be joined to his wife, and they shall become one flesh."* — Genesis 2:24

Marriage is:
- 🔗 **A covenant, not a contract** — covenants are broken only by death or immorality (Matthew 19:6)
- 🪞 **A reflection of Christ and the Church** — Ephesians 5:22-33 is the blueprint
- 🏠 **The foundational institution of society** — when the family collapses, society follows

## Biblical Roles in Marriage:

**Husbands:** Love sacrificially as Christ loved the Church — with servant leadership, not domination (Ephesians 5:25). Provide, protect, and nourish.

**Wives:** Respectful submission — not subjugation or inferiority — as a voluntary honouring of God's ordained order (Ephesians 5:22). This is strength, not weakness.

## On Divorce:

JCTM acknowledges the two grounds Jesus gave for divorce: sexual immorality (Matthew 19:9) and abandonment by an unbelieving spouse (1 Corinthians 7:15). Outside these, JCTM calls believers to pursue reconciliation, counselling, and prayer. God's goal is always restoration.

## On Dating & Courtship:

- Pursue **purity** — sexual intimacy belongs within the covenant of marriage (1 Thessalonians 4:3-5)
- **Character above chemistry** — choose a spouse based on godliness, not just attraction
- Seek **spiritual compatibility** — *"Do not be unequally yoked with unbelievers"* (2 Corinthians 6:14)

## For Families with Children:

- Train children in the Word from childhood (Deuteronomy 6:6-7, Proverbs 22:6)
- Discipline in love — not harshness, not permissiveness (Proverbs 13:24)
- Pray together as a family daily — establish an altar in your home

📩 For counselling: contact the ministry at info@jctm.org.ng`,
    enrichment: "Marriage is covenant (Genesis 2:24). Ephesians 5 blueprint. Husbands: sacrificial love. Wives: respectful submission. Divorce: Matthew 19:9, 1 Corinthians 7:15. Courtship: purity and equal yoke (2 Cor 6:14). Family altar. Contact info@jctm.org.ng.",
  },

  {
    id: "healing_miracles",
    intent: "healing_miracles",
    keywords: [
      "healing", "miracle", "divine healing", "sick", "sickness", "disease",
      "believe for healing", "is healing in the atonement", "by his stripes",
      "can god heal me", "divine health", "i am sick", "pray for healing",
      "medical healing", "faith and healing", "healings in the bible",
      "does god still heal", "pray for my health",
    ],
    weight: 0.95,
    response: `**Divine Healing** is a reality attested throughout the entire Bible — and Jesus Christ Temple Ministry (JCTM) stands on the firm biblical foundation that God is still a Healer today.

> *"But He was wounded for our transgressions, He was bruised for our iniquities; the chastisement for our peace was upon Him, and by His stripes we are healed."* — Isaiah 53:5

## What JCTM Teaches on Healing:

**✅ God heals — because it is His nature:**
- Jehovah Rapha — *"I am the LORD who heals you"* (Exodus 15:26)
- Jesus healed ALL who came to Him during His earthly ministry (Matthew 4:23-24)
- *"Jesus Christ is the same yesterday, today, and forever"* (Hebrews 13:8) — His healing power is unchanged

**✅ Healing is in the atonement:**
Isaiah 53:5 places healing alongside forgiveness in the same verse. Matthew 8:16-17 quotes this as Jesus healed the sick — confirming healing belongs in God's redemptive package.

## JCTM's Balanced Position:

⚠️ **Important:** JCTM does NOT teach the "healing is always guaranteed NOW" position of the prosperity gospel — which leads to false hope and spiritual abuse of the sick.

**What we DO teach:**
- Healing is God's *will* and *ability* — always
- Timing and manifestation may vary — God is sovereign
- **Pray in faith, receive medical care if needed — both are gifts of God's provision**
- Persistent, faith-filled prayer for healing is always right (James 5:14-16)
- If healing does not come immediately, trust God's deeper purpose (2 Corinthians 12:9 — Paul's thorn)

## What to Do When Sick:

1. 🙏 Pray and anoint with oil — call for the elders of the church (James 5:14)
2. 📖 Stand on the healing scriptures — Isaiah 53:5, Psalm 103:3, Mark 16:18
3. 💊 Use available medicine — Luke the physician was Paul's companion (Colossians 4:14)
4. 🤝 Seek intercession — submit a prayer request at jctm.org.ng/prayer
5. ✝️ Trust God's sovereignty — healing is His will; He alone determines the *when*

📺 Healing teaching series: **YouTube @TEMPLETVJCTM**`,
    enrichment: "Divine healing is biblical. Isaiah 53:5, Hebrews 13:8, Matthew 4:23-24. God is Jehovah Rapha. JCTM: balanced position - not prosperity gospel's 'guaranteed now'. James 5:14-16, prayer and medicine both valid. Prayer at jctm.org.ng/prayer.",
  },

  {
    id: "new_believer",
    intent: "new_believer",
    keywords: [
      "new christian", "new believer", "just got saved", "just became a christian",
      "new to faith", "just accepted jesus", "recently saved", "first steps",
      "what do i do now", "i just gave my life", "i am a new convert",
      "baby christian", "beginning my faith", "how to start", "where do i begin",
      "just rededicated", "fresh start with god",
    ],
    weight: 1.0,
    response: `Welcome to the family of God! 🎉

This is the greatest decision you have ever made, and Jesus Christ Temple Ministry (JCTM) wants to walk with you as you begin this incredible journey.

## Your First Steps as a New Believer:

### 1. 📖 Get Into God's Word — Daily
The Bible is your spiritual food. Without it, your faith will not grow.
- Start with the Gospel of **John** — it reveals who Jesus is
- Then read **Acts** — how the early church lived and moved in the Spirit
- Read at least one chapter every day

### 2. 💧 Get Baptized
Water baptism is your first public act of obedience. Jesus commanded it (Matthew 28:19) and modelled it (Matthew 3:16). It is your declaration to the world that you have died to your old life and risen with Christ (Romans 6:3-4).

**Contact JCTM to arrange baptism:** info@jctm.org.ng

### 3. 🙏 Develop a Daily Prayer Life
Talk to God every day — in the morning before the world gets loud. Prayer is simply honest conversation with your Father. Start with 10-15 minutes daily.

### 4. ⛪ Connect With a Doctrinally Sound Church
Do not try to grow alone. God places His people in the Body of Christ for a reason. At JCTM, you are welcome at our Ebrumede Temple (Warri) or at any of our viewing centres.

### 5. 🔥 Pursue the Baptism of the Holy Spirit
This is the supernatural empowerment for your Christian life (Acts 1:8). Pray and ask God to fill you with His Spirit (Luke 11:13).

### 6. 🚫 Guard What You Take In
Your mind is the battlefield. What you feed your eyes, ears, and heart shapes your faith. Be selective with media, friendships, and environments.

### 7. 📝 Get Accountability
Find a mature believer who can walk alongside you, answer your questions, and pray with you.

📩 **Contact JCTM for new believer support:** info@jctm.org.ng
📺 **New believer playlist:** **YouTube @TEMPLETVJCTM**`,
    enrichment: "New believer first steps: Read Bible (start with John), get baptized, daily prayer, join a doctrinally sound church, pursue Holy Spirit baptism, guard your mind, find accountability. Contact info@jctm.org.ng. Temple TV YouTube.",
  },

  {
    id: "lords_supper",
    intent: "lords_supper",
    keywords: ["lord's supper", "holy communion", "lord's table", "eucharist", "breaking bread", "bread and wine", "communion service", "take communion", "transubstantiation"],
    weight: 1.0,
    response: `**The Lord's Supper (Holy Communion)** is a sacred ordinance — not a ritual, but a living memorial of Christ's sacrifice.

**1 Corinthians 11:23-26** — *"The Lord Jesus on the night in which He was betrayed took bread; and when He had given thanks, He broke it and said, Take, eat; this is My body which is broken for you; do this in remembrance of Me."*

**JCTM's teaching on Holy Communion:**

🍞 **The Bread** — represents Christ's body, broken for our healing and redemption (Isaiah 53:5)
🍷 **The Cup** — represents His blood shed for the remission of sins (Matthew 26:28)
✝️ **It is a memorial** — not a re-sacrifice of Christ. He died once for all (Hebrews 9:26-28)
🚫 **JCTM rejects transubstantiation** — the Catholic doctrine that the elements literally become Christ's flesh and blood. This is identified as sacramental corruption.

**Who should partake:** Born-again believers who have examined themselves (1 Corinthians 11:27-29). Unworthy partaking brings judgment — approach with reverence and self-examination.

The Lord's Supper is practised regularly in JCTM services at Ebrumede Temple.`,
    enrichment: "Lord's Supper is a memorial of Christ's sacrifice. Bread = His body, cup = His blood. JCTM rejects transubstantiation. 1 Corinthians 11:23-26. Self-examination required. Practised in JCTM services.",
  },
  {
    id: "great_commission",
    intent: "great_commission",
    keywords: ["great commission", "make disciples", "go into the world", "preach the gospel", "evangelism", "soul winning", "win souls", "share the gospel", "lead someone to christ", "gospel outreach", "missionary"],
    weight: 1.0,
    response: `**The Great Commission** is the final command of Jesus — the supreme assignment of every believer:

> *"Go therefore and make disciples of all nations, baptizing them in the name of the Father and of the Son and of the Holy Spirit, teaching them to observe all things that I have commanded you."* — Matthew 28:18-20

This is not optional for disciples — it is the core mission of the church.

**JCTM fulfils the Great Commission through:**

📺 **Temple TV** — reaching 40+ nations digitally via @TEMPLETVJCTM on YouTube
🏟️ **Crusades** — Warri City Crusade 2026: thousands reached with the gospel in the open air
📡 **Viewing Centres** — multiplying the reach across Nigeria and beyond
🌐 **Digital Sanctuary** — 24/7 ministry access via jctm.org.ng
🤖 **TempleBots** — AI ministry assistant making the gospel accessible to seekers globally

**Your role:** Mark 16:15 — *"Go into all the world and preach the gospel to every creature."* Share your testimony, invite people to Temple TV, and bring the unsaved to JCTM crusades and services.`,
    enrichment: "Great Commission: Matthew 28:18-20. Make disciples of all nations. JCTM fulfils it through Temple TV, crusades, viewing centres, Digital Sanctuary, TempleBots. Every believer called to share the gospel.",
  },
  {
    id: "christian_lifestyle",
    intent: "christian_lifestyle",
    keywords: ["christian lifestyle", "how should christians live", "modest dressing", "worldliness", "social media", "movies", "alcohol", "dress code", "christian standards", "music choices", "entertainment", "what can christians watch", "lifestyle"],
    weight: 0.9,
    response: `**The Christian Lifestyle** is not legalism — it is the natural expression of genuine transformation by the Holy Spirit.

**2 Corinthians 5:17:** *"If anyone is in Christ, he is a new creation; old things have passed away; behold, all things have become new."*

**JCTM's practical standards for holy living:**

👗 **Dress modestly** — the body is God's temple (1 Corinthians 6:19-20). Immodest, sexually provocative, or worldly dressing contradicts your witness
📱 **Social media** — use responsibly. No gossip, sexual display, or worldly conformity
🎬 **Entertainment** — filter by Philippians 4:8: whatever is true, noble, just, pure, lovely, of good report
🍺 **Alcohol** — total abstinence is JCTM's position (Proverbs 20:1, Ephesians 5:18)
🎵 **Music** — reject what promotes sin; embrace what lifts your spirit toward God
🗣️ **Speech** — no corrupt communication (Ephesians 4:29)

**Romans 12:2:** *"Do not be conformed to this world, but be transformed by the renewing of your mind."*

This is not about external rules — it flows from a heart that loves God and takes His Word seriously.`,
    enrichment: "Christian lifestyle: modesty, no worldliness, social media stewardship, no alcohol, godly entertainment, pure speech. Romans 12:2. Not legalism but genuine transformation. JCTM teaches practical holiness.",
  },
  {
    id: "forgiveness",
    intent: "forgiveness",
    keywords: ["forgiveness", "forgive", "unforgiveness", "how to forgive", "can't forgive", "bitter", "bitterness", "offended", "been hurt", "hurt me deeply", "holding grudge", "grudge", "forgive and forget", "reconciliation"],
    weight: 0.9,
    response: `**Forgiveness** is one of the most important — and most misunderstood — commands in scripture.

**Matthew 6:14-15:** *"If you forgive men their trespasses, your heavenly Father will also forgive you. But if you do not forgive men their trespasses, neither will your Father forgive your trespasses."*

This is not an option — unforgiveness blocks your own forgiveness and opens the door to spiritual bondage.

**Key truths about forgiveness:**

✋ **Forgiveness is a decision, not a feeling** — you choose to release, even before the emotion follows
🔓 **Forgiveness is releasing the offender to God** — not condoning what they did, not automatic trust
💔 **Bitterness is spiritual poison** — Hebrews 12:15: "a root of bitterness causes trouble and defiles many"
🤝 **Reconciliation requires two parties** — forgiveness requires only you

**The ultimate model:** On the cross, Jesus said: *"Father, forgive them, for they know not what they do."* (Luke 23:34) — He forgave those actively crucifying Him.

**Joseph's example** (Genesis 50:20): *"You intended to harm me, but God intended it for good."*

If you are struggling to forgive someone, 🙏 submit a prayer request at **jctm.org.ng/prayer** — the JCTM intercession team will stand with you.`,
    enrichment: "Forgiveness is a decision not a feeling. Matthew 6:14-15 — unforgiveness blocks God's forgiveness. Releasing offenders to God. Bitterness poisons you. Jesus and Joseph are models. Prayer support available.",
  },
  {
    id: "heaven_afterlife",
    intent: "heaven_afterlife",
    keywords: ["heaven", "afterlife", "life after death", "what happens when we die", "eternity", "eternal life", "new jerusalem", "paradise", "will i go to heaven", "streets of gold", "eternal home", "resurrection body"],
    weight: 0.9,
    response: `**Heaven is real** — the eternal home of all who are genuinely born again and have lived holy lives before God.

**John 14:2-3:** *"In My Father's house are many mansions; if it were not so, I would have told you. I go to prepare a place for you."*

**What scripture reveals about heaven:**

✨ **Direct presence of God** — Revelation 22:4: *"They shall see His face"* — the beatific vision, unmediated communion with God
🕊️ **No more suffering** — Revelation 21:4: *"God will wipe away every tear from their eyes; there shall be no more death, nor sorrow, nor crying"*
🌟 **Glorified resurrection body** — incorruptible, immortal, spiritual (1 Corinthians 15:42-44)
🏙️ **New Jerusalem** — Revelation 21:1-3 describes a city of glory coming down from God
🎶 **Worship and service** — Revelation 7:15: serving God day and night in His temple

**Who enters:** Only those whose names are written in the Lamb's Book of Life (Revelation 21:27). JCTM does not teach universalism — not everyone goes to heaven regardless of how they lived.

The Christian's greatest motivation is the eternal reward ahead. **2 Timothy 4:7-8:** *"I have fought the good fight... there is laid up for me the crown of righteousness."*`,
    enrichment: "Heaven is real. John 14:2-3. God's direct presence, no suffering, glorified body. New Jerusalem. Revelation 21-22. Only born-again believers enter. Not universalism. Eternal reward awaits the faithful.",
  },
  {
    id: "hell_judgment",
    intent: "hell_judgment",
    keywords: ["hell", "eternal punishment", "lake of fire", "judgment", "hellfire", "is hell real", "what is hell", "eternal damnation", "second death", "condemned", "fire and brimstone", "does god send people to hell"],
    weight: 0.9,
    response: `**Hell is real** — and JCTM teaches it plainly because the gospel's urgency depends on it.

**Matthew 25:41:** *"Depart from Me, you cursed, into the everlasting fire prepared for the devil and his angels."*

**What scripture reveals about hell:**

🔥 **The Lake of Fire** — Revelation 20:14-15: the ultimate destination of the unrepentant — "the second death"
😰 **Conscious torment** — Luke 16:23-24: the rich man in Hades was in "torments" and felt pain — it is not annihilation
🌑 **Eternal separation from God** — 2 Thessalonians 1:9: "everlasting destruction from the presence of the Lord"
♾️ **Eternal duration** — Mark 9:44: *"where their worm does not die and the fire is not quenched"*

**JCTM rejects:**
- **Annihilationism** — the idea that souls cease to exist at death (not supported by scripture)
- **Universalism** — that God eventually saves everyone (contradicts Matthew 25:46)
- **Purgatory** — the Catholic doctrine of a place of purifying after death (Hebrews 9:27)

**The urgency of the gospel:** Hell is why JCTM preaches without compromise. God *"desires all men to be saved"* (1 Timothy 2:4) — and has made the way through Jesus Christ alone (John 3:16-18).

Today is the day of salvation. 2 Corinthians 6:2.`,
    enrichment: "Hell is real and eternal. Conscious torment (Luke 16). Lake of Fire. Second death. JCTM rejects annihilationism and universalism. The gospel's urgency is grounded in hell's reality. Salvation through Christ alone.",
  },
  {
    id: "faith_works",
    intent: "faith_works",
    keywords: ["faith and works", "faith without works", "works-based salvation", "james 2", "saved by faith", "grace and works", "can works save you", "how are we saved", "cheap grace", "antinomianism", "earn salvation"],
    weight: 1.0,
    response: `**Faith vs. Works** — one of the most important theological balances in the New Testament.

**The apparent tension:**
- **Ephesians 2:8-9:** *"By grace you have been saved through faith... not of works"* — salvation is not earned
- **James 2:17:** *"Faith by itself, if it does not have works, is dead"* — genuine faith produces action

**These are NOT contradictions — here's the resolution:**

Paul (Ephesians 2) speaks of works as the **ground of justification** — no work can merit salvation before God.
James speaks of works as the **evidence of genuine faith** — saving faith always produces transformed behaviour.

**JCTM warns against two errors:**

❌ **Works-based salvation** — trusting religious deeds (church attendance, giving, fasting) to earn justification. This is the error of Roman Catholicism and legalistic religion.

❌ **Cheap grace (antinomianism)** — claiming faith while living lawlessly. 1 John 2:4: *"He who says 'I know Him' and does not keep His commandments is a liar."*

✅ **The biblical balance:** Saved by grace, through faith, for good works (Ephesians 2:8-10). True faith changes you. Titus 2:14 — Christ redeemed us to be *"zealous for good works."*`,
    enrichment: "Faith saves, not works (Ephesians 2:8-9). But genuine faith produces works (James 2:17). Warnings against works-based salvation (Catholic error) and cheap grace (antinomianism). Titus 2:14.",
  },
  {
    id: "worship_music",
    intent: "worship_music",
    keywords: ["worship music", "praise music", "christian music", "worship songs", "music in church", "secular music", "can christians listen to secular music", "praise and worship", "worship style", "contemporary worship", "jctm worship"],
    weight: 0.85,
    response: `**Worship is the purpose for which humanity was created** — and music is one of its most powerful expressions.

**John 4:24:** *"God is Spirit, and those who worship Him must worship in spirit and in truth."*

**JCTM's position on worship music:**

📖 **Doctrinal content is supreme** — lyrics must be theologically sound. Entertainment-style worship that promotes the prosperity gospel, sensuality, or theological error is rejected.

🎵 **Colossians 3:16** — *"Teaching and admonishing one another in psalms and hymns and spiritual songs, singing with grace in your hearts to the Lord."*

🙏 **Purpose over performance** — music at JCTM should lead congregants into God's presence, not showcase musicians

⚠️ **Secular music with immoral content** — incompatible with a consecrated life. Philippians 4:8 is the filter.

**The praise-to-worship flow:**
- 🥁 **Praise** — bold, joyful declaration of God's greatness (Psalm 150)
- 🕊️ **Worship** — intimate adoration of God's person (John 4:23)

**Psalm 100:4:** *"Enter His gates with thanksgiving and His courts with praise."*

JCTM's worship services at Ebrumede Temple blend traditional hymns with contemporary praise — always with content supremacy over style.`,
    enrichment: "Worship in spirit and truth (John 4:24). Lyrics must be doctrinally sound. Purpose over performance. Psalms, hymns, spiritual songs (Colossians 3:16). Praise leads into worship. JCTM worship is content-focused.",
  },
  {
    id: "rapture_detailed",
    intent: "rapture_detailed",
    keywords: ["rapture", "caught up", "be ready", "rapture ready", "pre-trib", "post-trib", "when is the rapture", "will i be raptured", "tribulation period", "second coming", "1 thessalonians 4", "caught up together", "harpazo"],
    weight: 1.0,
    response: `**The Rapture** is the imminent, supernatural event in which Jesus Christ will catch away born-again, holy-living believers to meet Him in the air — before the tribulation.

**1 Thessalonians 4:16-17:** *"The Lord Himself will descend from heaven with a shout... and the dead in Christ will rise first. Then we who are alive and remain shall be caught up together with them in the clouds to meet the Lord in the air."*

**JCTM's position: Pre-Tribulation Rapture**

✅ Genuine, consecrated believers are removed BEFORE the 7-year tribulation
✅ This is why holiness and readiness matter NOW — not theoretical future preparation
⚠️ Not everyone who calls themselves Christian will be raptured — only those living holy (Matthew 24:40-41)

**After the rapture:**
- The Holy Spirit's restraining work is withdrawn (2 Thessalonians 2:7)
- The Antichrist rises and signs a peace covenant with Israel
- The Great Tribulation begins (7 years of global suffering — Revelation 6-19)
- The mark of the beast (666) is enforced — **do NOT receive it**
- Christ returns to earth with His saints at His Second Coming (Revelation 19:11-16)

**JCTM 2026 Crusade Theme:** *"Be Ready for Rapture: Tribulation Is Coming! Run For Your Soul!"*

📺 Watch end-times teachings: **YouTube @TEMPLETVJCTM**`,
    enrichment: "Pre-tribulation rapture (1 Thessalonians 4:16-17). Only holy-living believers caught up. Antichrist rises after rapture. Tribulation 7 years. Second Coming after tribulation. Don't take the mark of the beast.",
  },
  {
    id: "antichrist_mark",
    intent: "antichrist_mark",
    keywords: ["antichrist", "mark of the beast", "666", "beast", "false prophet", "new world order", "one world government", "chip implant", "digital id", "revelation 13", "tribulation", "son of perdition", "man of sin"],
    weight: 1.0,
    response: `**The Antichrist** is a coming world leader who will deceive the nations during the 7-year tribulation — and the mark of the beast (666) is his most dangerous tool.

**Revelation 13:16-18:** *"He causes all, both small and great, rich and poor, free and slave, to receive a mark on their right hand or on their foreheads, and that no one may buy or sell except one who has the mark."*

**Key biblical facts about the Antichrist:**

👤 A real human being — not symbolic (2 Thessalonians 2:3-4: "the man of sin... the son of perdition")
🌍 He will control the global economy through the mark system
⛪ He will enter the rebuilt Jewish temple and declare himself to be God (2 Thessalonians 2:4)
❌ He will be destroyed by Christ at the Second Coming (2 Thessalonians 2:8)

**About the mark (666):**
⚠️ **DO NOT RECEIVE IT UNDER ANY CIRCUMSTANCES**
Revelation 14:9-11: *"If anyone worships the beast and receives his mark... he shall be tormented with fire and brimstone... and they have no rest day or night."* — This is eternal damnation.

**JCTM's warning:** The global cashless economy, digital ID systems, and push toward central bank digital currencies may be laying infrastructure for this system. Stay vigilant. Live ready. The rapture removes believers before this mark is enforced.`,
    enrichment: "Antichrist is a real person (2 Thessalonians 2:3-4). Controls global economy with 666 mark. Do NOT take the mark — Revelation 14:9-11 says eternal damnation. Destroyed by Christ at Second Coming. Cashless economy may be preparation.",
  },
  {
    id: "digital_sanctuary",
    intent: "digital_sanctuary",
    keywords: ["digital sanctuary", "website", "jctm website", "jctm.org", "online platform", "templebots", "scripture study", "devotions online", "give online", "watch online", "jctm app", "digital ministry"],
    weight: 0.9,
    response: `**The JCTM Digital Sanctuary** (jctm.org.ng) is the official online ministry platform — bringing every dimension of JCTM's ministry to your screen, wherever you are in the world.

**🌐 What's available at jctm.org.ng:**

📖 **Sermon Library** — Browse 400+ teachings from Prophet Amos Evomobor, filtered by topic, date, or series
📺 **Live Streaming** — Watch Sunday (8 AM WAT) and midweek (5 PM WAT) services LIVE
🤖 **TempleBots AI** — Your 24/7 AI ministry assistant for spiritual guidance, doctrine, and prayer support
🌍 **Global Altar** — A real-time 3D visualization of believers worshipping worldwide simultaneously
📜 **Testimonies** — Submit and read community testimonies of God's faithfulness
📅 **Events** — Register for crusades, conferences, and gatherings
💛 **Give Online** — Paystack (Naira) and Stripe (international) giving portal
📖 **Scripture Study** — AI-powered deep Bible study and contextual teaching
🙏 **Prayer Requests** — Submit personal needs to the JCTM intercession team
📰 **Daily Devotionals** — Subscribe to morning devotionals by email

**For technical support:** info@jctm.org.ng
**Temple TV YouTube:** https://www.youtube.com/@TEMPLETVJCTM`,
    enrichment: "Digital Sanctuary features: sermon library, live streaming, TempleBots AI, Global Altar, testimonies, events, giving, scripture study, prayer requests, devotionals. At jctm.org.ng. Temple TV on YouTube @TEMPLETVJCTM.",
  },
  {
    id: "tongues_gifts",
    intent: "tongues_gifts",
    keywords: ["speaking in tongues", "gift of tongues", "spiritual gifts", "1 corinthians 12", "gifts of the spirit", "word of knowledge", "word of wisdom", "prophecy gift", "gift of healing", "discernment", "are tongues for today", "cessationism"],
    weight: 1.0,
    response: `**The Gifts of the Spirit** (1 Corinthians 12:7-11) are supernatural endowments given by the Holy Spirit to individual believers for the common good of the church.

**The nine gifts:** Word of wisdom, word of knowledge, faith, gifts of healings, working of miracles, prophecy, discerning of spirits, different kinds of tongues, interpretation of tongues.

**JCTM's position:** All nine gifts are still fully operational today — cessationism (the view that gifts ended with the apostles) is not biblically supported.

**Tongues specifically — two distinct purposes:**

🙏 **Private prayer tongues** — praying in the Spirit for personal edification (1 Corinthians 14:4, Jude 20). Encouraged for all Spirit-baptized believers.

📣 **Public tongues in church** — MUST be accompanied by interpretation (1 Corinthians 14:27-28). Without an interpreter, the speaker must remain silent.

**JCTM warnings:**
- ⚠️ Counterfeit tongues — manufactured emotionally, not Spirit-generated
- ⚠️ Uncontrolled public tongues without interpretation — disorderly (1 Corinthians 14:33)
- ⚠️ Tongues as the only measure of spirituality — 1 Corinthians 13:1: even tongues without love is "sounding brass"

All gifts must operate in **love and order** within the assembly. The greatest gift is love (1 Corinthians 13).`,
    enrichment: "Nine spiritual gifts still active today. Tongues: private prayer (1 Corinthians 14:4) and public with interpretation (1 Corinthians 14:27-28). JCTM rejects cessationism and counterfeit tongues. Love is greatest gift.",
  },
  {
    id: "biblical_authority",
    intent: "biblical_authority",
    keywords: ["is the bible true", "bible authority", "bible is word of god", "scripture is inspired", "inerrancy", "infallibility", "bible vs tradition", "can i trust the bible", "which bible translation", "kjv vs nkjv", "is the bible reliable"],
    weight: 0.95,
    response: `**The Bible is the supreme and final authority** on all matters of faith, doctrine, and Christian living — this is the cornerstone of JCTM's entire ministry.

**2 Timothy 3:16-17:** *"All Scripture is given by inspiration of God, and is profitable for doctrine, for reproof, for correction, for instruction in righteousness, that the man of God may be complete, thoroughly equipped for every good work."*

**JCTM's doctrine of scripture:**

📖 **Divine Inspiration** — God breathed His Word through human authors (2 Peter 1:21: "holy men of God spoke as they were moved by the Holy Spirit")
✅ **Inerrancy** — the original manuscripts are without error
🔒 **Sufficiency** — the Bible contains everything necessary for salvation and godly living — nothing may be added (Revelation 22:18-19)
⚖️ **Final Authority** — no prophecy, tradition, church decree, or personal experience can override the written Word

**Why this matters:** The Correction Mandate is grounded here. Every error JCTM corrects is measured against the plumb line of scripture. When the church drifts, the Bible calls it back.

**On translations:** JCTM primarily uses the **King James Version (KJV)** and **New King James Version (NKJV)** for their faithfulness to the received text (Textus Receptus / Masoretic Text). Modern critical-text translations (NIV, ESV) are used for reference but with discernment.`,
    enrichment: "Bible is supreme authority (2 Timothy 3:16-17). Divine inspiration, inerrancy, sufficiency, final authority. No prophecy or tradition can override scripture. JCTM uses KJV and NKJV. Correction Mandate grounded in biblical authority.",
  },
  {
    id: "prosperity_expose",
    intent: "prosperity_expose",
    keywords: ["prosperity gospel", "word of faith", "name it claim it", "kenneth copeland", "kenneth hagin", "benny hinn", "creflo dollar", "seed faith", "hundredfold return", "positive confession", "decree and declare", "prosperity preacher", "health and wealth"],
    weight: 1.0,
    response: `**The Prosperity Gospel is a False Gospel** — and JCTM's Correction Mandate specifically targets it as one of the five major errors deceiving the global church.

**Core claims of the Prosperity Gospel (and JCTM's biblical refutation):**

❌ *"God always wants you financially wealthy"*
✅ Philippians 4:11-12 — Paul learned contentment in both poverty AND abundance. Wealth is NOT the measure of God's blessing.

❌ *"Sow a seed of $1,000 and receive a hundredfold return"*
✅ 2 Corinthians 9:7 — Give as you purpose in your heart, not from compulsion. Giving is worship, not a financial investment.

❌ *"Confess it and possess it — your words create your reality"*
✅ Isaiah 55:8-9 — God's thoughts are not our thoughts. Faith is not a force that moves God through our words.

❌ *"Sickness means lack of faith or unconfessed sin"*
✅ 2 Corinthians 12:7-9 — Paul's thorn in the flesh remained despite prayer. John 9:3 — the blind man's condition was not due to sin.

**Key proponents JCTM identifies as spreading this error:** Kenneth Hagin, Kenneth Copeland, Benny Hinn, Creflo Dollar, and many Nigerian prosperity preachers.

**1 Timothy 6:5-10:** Those who believe *"godliness is a means of gain... the love of money is a root of all kinds of evil."*

📺 Watch Prophet Amos' refutation: **YouTube @TEMPLETVJCTM**`,
    enrichment: "Prosperity gospel is a false gospel (one of 5 Correction Mandate errors). Financial wealth is not always God's will. Giving is not a financial investment. Positive confession errors. Proponents: Copeland, Hagin, Hinn. 1 Timothy 6:5-10.",
  },
  {
    id: "false_prophets",
    intent: "false_prophets",
    keywords: ["false prophet", "how to identify false prophets", "false teachers", "fake pastor", "test the spirits", "wolves in sheep clothing", "fake church", "fake man of god", "manipulative pastor", "prophet asking for money", "is my pastor false"],
    weight: 1.0,
    response: `**False Prophets are among the most dangerous threats** to the body of Christ today — and identifying them is essential to spiritual survival.

**Matthew 7:15-16:** *"Beware of false prophets, who come to you in sheep's clothing, but inwardly they are ravenous wolves. You will know them by their fruits."*

**Red flags of a false prophet or false teacher:**

🚩 **Money-conditioned prophecy** — *"Give $100 and I'll release your prophetic word"* — genuine prophets don't sell spiritual gifts
🚩 **Consistently failed prophecies** — Deuteronomy 18:22: *"If the thing does not happen or come to pass... the prophet has spoken it presumptuously"*
🚩 **Lifestyle inconsistency** — personal immorality, secret sin, lavish excess while congregation suffers
🚩 **Scripture contradiction** — any teaching that contradicts the clear text of the Bible (Galatians 1:8)
🚩 **Control and fear** — manipulating congregants through fear of curses if they leave
🚩 **Celebrity-building** — pointing to themselves rather than to Christ

**1 John 4:1:** *"Beloved, do not believe every spirit, but test the spirits, whether they are of God."*

**The test:** Does it align with scripture? Does it come to pass? Does the prophet live holy?

**Prophet Amos Evomobor's** prophetic office is confirmed by decades of documented accuracy, holy living, and complete alignment with the written Word — not by marketing or self-promotion.`,
    enrichment: "False prophets: money-conditioned prophecy, failed predictions, lifestyle inconsistency, scripture contradiction, control and fear, celebrity-building. Matthew 7:15-16. 1 John 4:1. Test by fruit, prophetic accuracy, and scriptural alignment.",
  },

  {
    id: "ministers_conference",
    intent: "ministers_conference",
    keywords: [
      "ministers conference", "ministers conference 2026", "apostolic fire", "conference 2026",
      "jctm conference", "conference registration", "conference theme", "apostolic fire conference",
      "may conference", "3-day conference", "three day conference", "conference day",
    ],
    weight: 1.1,
    response: `The **JCTM Ministers Conference 2026** — *"Come, receive your apostolic fire from the altar of God"* — is a powerful 3-day gathering of ministers and believers from across the nation and beyond.

**Conference Details:**
- 📅 **Dates:** Friday 8 May → Sunday 10 May, 2026
- ⏰ **Start Time:** 8:00 AM WAT daily
- 📍 **Venue:** JCTM Church Auditorium, Km 1 East West Road, Ebrumede Roundabout, Effurun Uvwie LGA, Delta State, Nigeria
- 🎙️ **Theme:** *"Come, receive your apostolic fire from the altar of God"*

**What to Expect:**
- Deep apostolic and prophetic ministry under Prophet Amos Evomobor
- Impartation of the Holy Spirit and apostolic fire
- Sound doctrine and Correction Mandate teachings
- Live streaming on Temple TV (YouTube @TEMPLETVJCTM)

**Register or Join Online:**
- 🔗 jctm.org.ng/conference-registration
- 📺 Live stream: jctm.org.ng/livestream

**Enquiries:** +234(0)8081313111 | info@jctm.org.ng

> *"And suddenly there came a sound from heaven, as of a rushing mighty wind, and it filled the whole house where they were sitting."* — Acts 2:2`,
    enrichment: "Ministers Conference 2026: May 8-10, 8 AM WAT daily, JCTM Auditorium Ebrumede, theme: apostolic fire, streamed on Temple TV, register at jctm.org.ng/conference-registration, contact +234(0)8081313111.",
  },

  {
    id: "testimony_sharing",
    intent: "testimony_sharing",
    keywords: [
      "testimony", "testimonies", "share a testimony", "my testimony", "what god did",
      "miracle story", "god healed me", "god saved me", "i want to share",
      "god provided", "answered prayer", "prayer was answered", "breakthrough testimony",
      "god showed up", "my experience", "what happened to me",
    ],
    weight: 0.85,
    response: `**Testimonies** are one of the most powerful weapons in the believer's arsenal — Revelation 12:11 tells us that the saints overcame the enemy *"by the blood of the Lamb and by the word of their testimony."*

When you share what God has done for you, you are not simply telling a story — you are releasing a weapon into the spiritual atmosphere that can unlock someone else's breakthrough.

## Why Your Testimony Matters:

- 🛡️ **It defeats the enemy** — the enemy cannot argue with your personal experience (Revelation 12:11)
- 🌟 **It builds faith in others** — Romans 10:17 — faith comes by hearing
- 🙏 **It glorifies God** — the purpose of every testimony is not to magnify the person, but to magnify God
- 📣 **It is evangelism** — a clear testimony of salvation, healing, or breakthrough is one of the most effective ways to share the gospel

## Submit Your Testimony to JCTM:

We welcome testimonies of:
- 🙌 Salvation — coming to Christ
- 💊 Healing — physical restoration
- 🏠 Provision — God's supernatural supply
- 🔓 Deliverance — freedom from bondage
- 🙏 Answered prayer — God responding specifically to what you prayed

**Submit at:** jctm.org.ng/testimonies

Your story might be the turning point for someone who is struggling today. Do not keep it to yourself.

> *"They overcame him by the blood of the Lamb and by the word of their testimony."* — Revelation 12:11

📺 Watch community testimonies and service recordings: **YouTube @TEMPLETVJCTM**`,
    enrichment: "Testimonies are spiritual weapons (Revelation 12:11). Builds faith, glorifies God, evangelism. Submit testimonies at jctm.org.ng/testimonies. Categories: salvation, healing, provision, deliverance, answered prayer.",
  },
];

// ─── Emotional Signal Detection ───────────────────────────────────────────────

const EMOTIONAL_SIGNALS: Record<string, string[]> = {
  anxiety: ["anxious", "anxiety", "worried", "worry", "fear", "scared", "panic", "nervous", "overwhelmed", "dread", "terrified", "afraid"],
  grief: ["grief", "grieving", "lost someone", "depressed", "depression", "heartbroken", "hopeless", "suicidal", "don't want to live", "can't go on", "lost my", "death of", "died", "passed away"],
  anger: ["angry", "furious", "betrayed", "cheated", "unfair", "unjust", "bitter", "resentful", "rage", "hatred"],
  doubt: ["doubting", "lost my faith", "doesn't exist", "why would god", "questioning god", "backsliding", "left the church", "no longer believe", "apostate"],
  despair: ["hopeless", "no point", "giving up", "can't take it", "end it", "tired of living", "worthless", "useless"],
};

// ─── Complex Query Signals (always escalate to OpenAI) ────────────────────────

const COMPLEX_SIGNALS = [
  "explain the greek", "hebrew word", "exegesis", "exegetical", "hermeneutics",
  "commentary on", "interpret", "theological argument", "defend", "refute",
  "compare with", "difference between", "what does the bible say about",
  "how does jctm answer", "prove from scripture", "apologetics",
  "personally", "my situation", "my life", "my marriage", "my family",
  "what should i do", "what do you think", "advise me", "counsel me",
  "prophecy for me", "word for me", "speak into my life",
];

// ─── TF-IDF Inspired Scoring ──────────────────────────────────────────────────

function normalizeText(text: string): string {
  return text.toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return normalizeText(text).split(" ").filter(t => t.length > 1);
}

function scoreEntry(query: string, entry: KnowledgeEntry): number {
  const queryTokens = tokenize(query);
  const queryNorm = normalizeText(query);

  let score = 0;

  for (const keyword of entry.keywords) {
    const kwNorm = normalizeText(keyword);

    if (queryNorm.includes(kwNorm)) {
      const wordCount = keyword.split(" ").length;
      score += wordCount > 1 ? 3.0 * wordCount : 1.5;
    }

    const kwTokens = tokenize(keyword);
    for (const qt of queryTokens) {
      for (const kt of kwTokens) {
        if (qt === kt && qt.length > 3) score += 0.5;
        else if (qt.startsWith(kt) && kt.length > 4) score += 0.2;
      }
    }
  }

  if (entry.negativeKeywords) {
    for (const neg of entry.negativeKeywords) {
      if (queryNorm.includes(normalizeText(neg))) score -= 2.0;
    }
  }

  return score * entry.weight;
}

function detectEmotionalSignals(query: string): { detected: boolean; category: string | null } {
  const norm = normalizeText(query);
  for (const [category, signals] of Object.entries(EMOTIONAL_SIGNALS)) {
    for (const signal of signals) {
      if (norm.includes(signal)) return { detected: true, category };
    }
  }
  return { detected: false, category: null };
}

function detectComplexSignals(query: string): boolean {
  const norm = normalizeText(query);
  return COMPLEX_SIGNALS.some(signal => norm.includes(normalizeText(signal)));
}

function detectGivingSignals(query: string): boolean {
  const norm = normalizeText(query);
  return /\b(seed|sow|give|offering|tithe|donation|financial support|partner with|contribute)\b/.test(norm);
}

// ─── Local Inference (the main engine) ───────────────────────────────────────

const CONFIDENCE_THRESHOLD = 0.65;
const ESCALATION_THRESHOLD = 0.35;

export function runLocalInference(query: string): LocalInferenceResult {
  const emotional = detectEmotionalSignals(query);
  const isComplex = detectComplexSignals(query);
  const isGiving = detectGivingSignals(query);

  const detectedKeywords: string[] = [];

  const scored = KNOWLEDGE_INDEX.map(entry => {
    const rawScore = scoreEntry(query, entry);
    return { entry, rawScore };
  }).sort((a, b) => b.rawScore - a.rawScore);

  const topMatch = scored[0];
  const secondMatch = scored[1];

  const maxPossibleScore = 15;
  const normalizedScore = Math.min(topMatch.rawScore / maxPossibleScore, 1.0);

  const isAmbiguous = secondMatch && (secondMatch.rawScore / (topMatch.rawScore || 1)) > 0.7 && topMatch.rawScore < 4;

  const matchedEntry = topMatch.entry;

  for (const kw of matchedEntry.keywords) {
    if (normalizeText(query).includes(normalizeText(kw))) {
      detectedKeywords.push(kw);
    }
  }

  const shouldEscalate =
    emotional.detected ||
    isComplex ||
    isAmbiguous ||
    normalizedScore < ESCALATION_THRESHOLD ||
    matchedEntry.intent === "unknown";

  const canServeLocally =
    !shouldEscalate &&
    normalizedScore >= CONFIDENCE_THRESHOLD;

  const enrichmentContext = [
    matchedEntry.enrichment,
    emotional.detected ? `[EMOTIONAL SIGNAL: ${emotional.category} detected — prioritize pastoral care]` : "",
    isGiving ? "[GIVING SIGNAL detected — include [ACTION:sow-a-seed] at end of response]" : "",
    isComplex ? "[COMPLEX QUERY — requires deep theological response]" : "",
  ].filter(Boolean).join("\n");

  return {
    intent: canServeLocally || normalizedScore >= ESCALATION_THRESHOLD ? matchedEntry.intent : "unknown",
    confidence: normalizedScore,
    response: canServeLocally ? matchedEntry.response : null,
    enrichmentContext,
    needsEnrichment: shouldEscalate || !canServeLocally,
    emotionalFlag: emotional.detected,
    givingFlag: isGiving,
    detectedKeywords,
  };
}

// ─── Streaming simulation for local responses ─────────────────────────────────

export async function* streamLocalResponse(
  response: string,
  chunkSize = 8,
  delayMs = 12,
): AsyncGenerator<string> {
  const words = response.split(/(\s+)/);
  let buffer = "";

  for (const word of words) {
    buffer += word;
    if (buffer.length >= chunkSize) {
      yield buffer;
      buffer = "";
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  if (buffer) yield buffer;
}

// ─── Engine metadata ─────────────────────────────────────────────────────────

export const ENGINE_METADATA = {
  version: "5.0.0",
  knowledgeEntries: KNOWLEDGE_INDEX.length,
  confidenceThreshold: CONFIDENCE_THRESHOLD,
  escalationThreshold: ESCALATION_THRESHOLD,
  intentsSupported: [...new Set(KNOWLEDGE_INDEX.map(e => e.intent))],
  description: "JCTM Local AI Engine v5 — 58+ intents, Ministers Conference 2026, expanded doctrine, continuous sync, enterprise RAG, fully local",
};

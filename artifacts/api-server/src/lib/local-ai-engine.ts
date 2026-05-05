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
  version: "1.0.0",
  knowledgeEntries: KNOWLEDGE_INDEX.length,
  confidenceThreshold: CONFIDENCE_THRESHOLD,
  escalationThreshold: ESCALATION_THRESHOLD,
  intentsSupported: [...new Set(KNOWLEDGE_INDEX.map(e => e.intent))],
  description: "JCTM Local AI Engine — custom first-principles inference for TempleBots",
};

/**
 * JCTM Knowledge Ingestion — Zero External API
 *
 * Populates the knowledge_chunks table with JCTM-specific content.
 * Embeddings are generated locally using local-embeddings.ts.
 * No OpenAI required — all embedding is local.
 *
 * Strategy:
 *  - Embeddings via local all-MiniLM-L6-v2 transformer model (384-dim)
 *  - TF-IDF hash fallback if transformer fails to load
 *  - Text-only storage fallback if both fail
 *  - Keyword search always works regardless of embedding method
 *
 * Learning sources:
 *  1. Static JCTM canonical doctrine (JCTM_KNOWLEDGE)
 *  2. All sermon videos synced from YouTube (ingestAllSermons)
 *  3. Website activity: prayer themes, testimonies, blog posts, events (ingestActivityLearning)
 */

import pg from "pg";
import type { Logger } from "pino";
import { embed } from "./local-embeddings.js";

const { Pool } = pg;

function normalizeDbUrl(url: string): string {
  return url.replace(
    /([?&])sslmode=(prefer|require|verify-ca)(&|$)/g,
    (_m, prefix, _mode, suffix) => `${prefix}sslmode=verify-full${suffix}`,
  );
}

const pool = new Pool({ connectionString: normalizeDbUrl(process.env.DATABASE_URL ?? "") });

// ─── Version Stamp ────────────────────────────────────────────────────────────
// Increment this when the static JCTM_KNOWLEDGE array changes to force
// re-ingestion even if chunk count looks sufficient.
const KNOWLEDGE_VERSION = "5.0";
const VERSION_SOURCE = `jctm-version-${KNOWLEDGE_VERSION}`;

// ─── JCTM Knowledge Base ──────────────────────────────────────────────────────

const JCTM_KNOWLEDGE = [
  {
    source: "jctm-mission",
    content: `Jesus Christ Temple Ministry (JCTM) is a Christian ministry based in Ebrumede, Warri, Delta State, Nigeria. Founded and led by Prophet Amos Evomobor, JCTM operates under a divine mandate called the "Correction Mandate" — a God-given assignment to restore the original, unadulterated gospel of Jesus Christ to the global Body of Christ. The ministry's mission is to identify, expose, and correct false doctrines that have infiltrated Christianity, and to return believers to Primitive Christianity — the faith as originally delivered to the apostles. JCTM operates Temple TV, a YouTube channel (@TEMPLETVJCTM) that broadcasts sermons, teachings, and live services to a global audience.`,
  },
  {
    source: "prophet-amos-bio",
    content: `Prophet Amos Evomobor is the founder and senior pastor of Jesus Christ Temple Ministry (JCTM), Warri, Nigeria. He is a prophet in the five-fold ministry gifting, called specifically to the office of the prophet in this generation. Prophet Amos received the Correction Mandate directly from God — a divine commission to bring doctrinal correction and reformation to the global church. He teaches with apostolic authority and theological precision, drawing from deep study of the original Greek and Hebrew scriptures. He is known for his bold, uncompromising stance on holiness, doctrinal purity, and the restoration of Primitive Christianity. His YouTube channel Temple TV (@TEMPLETVJCTM) reaches believers worldwide.`,
  },
  {
    source: "correction-mandate",
    content: `The Correction Mandate is the divine assignment given to Jesus Christ Temple Ministry (JCTM) and Prophet Amos Evomobor. It is a call to expose and correct five major areas of error in modern Christianity: 1. The Prosperity Gospel / Word of Faith heresy — teaching that financial prosperity is always God's will. 2. Prophetic manipulation — false prophets using spiritual gifts for financial gain. 3. Apostolic abuse — people falsely claiming the office of apostle. 4. Sacramental corruption — distortion of holy sacraments like baptism and communion. 5. Ecumenism without truth — dangerous blending of Christianity with other religions. The Correction Mandate is not a criticism of individuals but a prophetic correction of doctrinal error for the health of the global church.`,
  },
  {
    source: "primitive-christianity",
    content: `Primitive Christianity, as taught by JCTM and Prophet Amos Evomobor, refers to the original form of the Christian faith as practiced in the first-century apostolic church. Key principles: The Bible is the supreme and final authority. Salvation is by grace through faith in Jesus Christ alone. Water baptism by full immersion is the biblical mode. The Holy Spirit gifts are still active today within proper biblical order. Holiness is not optional — believers are called to live separated, consecrated lives unto God. The church must return to simplicity of worship, sound doctrine, and genuine community as modeled in Acts 2.`,
  },
  {
    source: "holiness-doctrine",
    content: `Holiness is a central pillar of JCTM's teaching under Prophet Amos Evomobor. Holiness means: personal sanctification — being set apart from the world and unto God. Moral purity — rejecting sexual immorality, dishonesty, greed, and worldliness. Doctrinal purity — refusing to compromise God's Word for social acceptance. Practical consecration — living visibly different from the world, reflecting the character of Christ. Key scriptures: Hebrews 12:14 ("Without holiness no one will see the Lord"), 1 Peter 1:15-16, Romans 12:1-2. Prophet Amos warns against the "holiness is legalism" argument used to excuse moral compromise.`,
  },
  {
    source: "warri-city-crusade-2026",
    content: `The Warri City Crusade 2026 is a major outdoor evangelical crusade organized by Jesus Christ Temple Ministry (JCTM). Event Details: Dates: April 30 – May 1, 2026 (two-day event). Location: Ighogbadu Primary School, Warri, Delta State, Nigeria. Organizer: Jesus Christ Temple Ministry (JCTM) under Prophet Amos Evomobor. Theme: "Be Ready For Rapture: Tribulation Is Coming! Run For Your Soul!" Purpose: To bring the message of Primitive Christianity, the Correction Mandate, and the true gospel to the people of Warri and beyond. Features: Open-air gospel preaching, healing and miracle services, worship, testimonies, and doctrinal teachings. All believers, seekers, and the general public are welcome. Expected to draw thousands from across the Niger Delta region.`,
  },
  {
    source: "giving-seed-sowing",
    content: `Seed sowing and giving at JCTM is practiced within biblical stewardship, not the prosperity gospel. JCTM's teaching on giving: Giving is an act of worship and partnership with the ministry's mandate, not a formula for personal enrichment. JCTM does not teach "sow a seed and get a hundredfold return" as a transactional law. Giving supports the spread of the gospel, the Correction Mandate, and Temple TV. Tithes (10% of income) are a covenant principle from Malachi 3:10, given from a heart of love, not compulsion. To give to JCTM: visit jctm.org.ng/give. Prophet Amos warns against ministries that use manipulation and false promises to extract money.`,
  },
  {
    source: "baptism-doctrine",
    content: `JCTM teaches water baptism as a critical ordinance of the Christian faith, practiced by full immersion. Mode: Full immersion in water, following Jesus' baptism in the Jordan River (Matthew 3:16) and the Greek word "baptizo" meaning to immerse. Candidate: Baptism is for believing adults who have consciously confessed faith in Jesus Christ — not infants. Purpose: Baptism is an outward declaration of an inward reality — the death to sin and resurrection to new life in Christ (Romans 6:3-4). It is not the means of salvation but a public ordinance of the saved. Formula: In the name of the Father, Son, and Holy Spirit (Matthew 28:19). This stands against infant baptism which JCTM identifies as an early doctrinal corruption.`,
  },
  {
    source: "five-fold-ministry",
    content: `JCTM teaches the five-fold ministry from Ephesians 4:11 — Apostles, Prophets, Evangelists, Pastors, and Teachers — as still active and necessary today. Prophet Amos Evomobor holds the office of Prophet — not self-appointed, but confirmed by the fruit of his ministry, prophetic accuracy, and divine revelations. JCTM warns against people giving themselves titles of "Apostle" or "Prophet" without genuine divine calling. True five-fold ministers serve the church for its edification, not personal enrichment or celebrity status.`,
  },
  {
    source: "temple-tv-channel",
    content: `Temple TV is the official YouTube channel of Jesus Christ Temple Ministry (JCTM). Handle: @TEMPLETVJCTM. URL: https://www.youtube.com/channel/UCPFFvkE-KGpR37qJgvYriJg. Content: Sermons, live Sunday services, prophetic teachings, doctrinal lectures, testimonies, and crusade coverage. Popular themes: "The Correction Mandate," "What is Primitive Christianity?", exposing the prosperity gospel, Holy Spirit baptism and tongues, end times prophecy. Sunday services are broadcast live and uploaded afterward. If TempleBots cannot answer a question from JCTM doctrine, users should be directed to Temple TV.`,
  },
  {
    source: "church-location-contact",
    content: `Jesus Christ Temple Ministry (JCTM) Contact Information: Physical Location: Ebrumede, Warri, Delta State, Nigeria. YouTube: Temple TV @TEMPLETVJCTM (https://www.youtube.com/templetvjctm). Facebook: @templetvjctm (https://www.facebook.com/templetvjctm). Email: info@jctm.org.ng. Regular Sunday services held at the Ebrumede temple and broadcast live on Temple TV. The JCTM Digital Sanctuary is the official online platform for ministry resources, sermon streaming, live worship, event registration, and the member portal.`,
  },
  {
    source: "holy-spirit-baptism",
    content: `JCTM teaches that the baptism of the Holy Spirit is a distinct experience from water baptism and salvation, available to all believers. It is evidenced by speaking in tongues (Acts 2:4, Acts 10:46, Acts 19:6). This is an endowment of power for Christian witness (Acts 1:8), not a second salvation. JCTM warns against counterfeit tongues in some charismatic circles. The gifts of the Spirit (1 Corinthians 12) are still operational today. Prophecy must be tested against scripture (1 Thessalonians 5:20-21) — no prophecy can contradict the written Word of God.`,
  },
  {
    source: "end-times-teaching",
    content: `JCTM under Prophet Amos Evomobor teaches urgently on end-times prophecy. The rapture is the catching away of born-again believers living in holiness (1 Thessalonians 4:16-17). The tribulation is a coming period of global suffering (Revelation 6-19). The antichrist will demand worship and enforce the mark of the beast (666) as an economic system (Revelation 13:16-18). Signs of the end: global moral collapse (2 Timothy 3:1-5), apostasy in the church (2 Thessalonians 2:3), wars, famines, earthquakes (Matthew 24:6-8). The Warri Crusade 2026 theme: "Be Ready For Rapture: Tribulation Is Coming! Run For Your Soul!" The call is to repent, live holy, and be watchful.`,
  },
  {
    source: "salvation-gospel",
    content: `Salvation at JCTM is by grace through faith in Jesus Christ alone (Ephesians 2:8-9). The gospel: all have sinned (Romans 3:23), the wages of sin is death (Romans 6:23), but Christ died for sinners (Romans 5:8), and eternal life is a free gift received by faith (Romans 10:9-10). The sinner's prayer: confess you are a sinner, believe Jesus died and rose again, receive Him as Lord and Saviour. After salvation: water baptism, finding a doctrinally sound church, pursuing Holy Spirit baptism, daily Bible reading and prayer. JCTM at Ebrumede Temple Warri welcomes all new believers.`,
  },
  {
    source: "fasting-prayer-teaching",
    content: `JCTM teaches biblical fasting as a core spiritual discipline. Jesus said "when you fast" (Matthew 6:16) not "if" — fasting is assumed for disciples. Types: complete fast (no food/water), water fast, Daniel fast (vegetables and water only), partial/time fast. Purposes: seeking God, spiritual breakthrough (Mark 9:29), intercession, consecration, and repentance (Joel 2:12). Isaiah 58:6 describes the true fast: loosing bonds of wickedness. Practical: set duration, pray at meal times instead, read Scripture during the fast, break with fruits. Corporate fasts are held at JCTM regularly.`,
  },
  {
    source: "spiritual-warfare-teaching",
    content: `JCTM teaches that spiritual warfare is real (Ephesians 6:12). The believer's armour: belt of truth, breastplate of righteousness, gospel of peace, shield of faith, helmet of salvation, sword of the Spirit, and prayer in the Spirit (Ephesians 6:13-18). Generational curses are broken through Christ (Galatians 3:13) and genuine repentance. Binding and loosing (Matthew 18:18) operates under Christ's authority through the local church. Believers can experience demonic oppression; the solution is always prayer, fasting, and the Word. JCTM warns against sensationalized deliverance theatrics — true deliverance comes by the Holy Spirit. Submit prayer requests at jctm.org.ng/prayer.`,
  },
  {
    source: "marriage-family-teaching",
    content: `JCTM teaches biblical marriage as a covenant (Genesis 2:24), not a contract. Ephesians 5:22-33 is the blueprint: husbands love sacrificially as Christ loved the church; wives submit respectfully as to the Lord. Divorce is permitted on grounds of sexual immorality (Matthew 19:9) or abandonment by an unbelieving spouse (1 Corinthians 7:15); outside these, JCTM calls for reconciliation. Christian courtship: pursue purity (1 Thessalonians 4:3-5), choose godly character over attraction, do not be unequally yoked (2 Corinthians 6:14). Raise children in the Word (Deuteronomy 6:6-7, Proverbs 22:6). Establish a family altar of daily prayer. Contact info@jctm.org.ng for pastoral counselling.`,
  },
  {
    source: "healing-miracles-teaching",
    content: `JCTM affirms that God is still a Healer — Jehovah Rapha (Exodus 15:26). Healing is grounded in the atonement: Isaiah 53:5, Matthew 8:16-17. Jesus healed all who came to Him (Matthew 4:23-24) and He is the same yesterday, today, and forever (Hebrews 13:8). JCTM teaches a balanced position: healing is God's will and ability always, but timing is God's sovereignty. JCTM does not teach "guaranteed healing now" as the prosperity gospel teaches. Practical steps: pray and anoint with oil (James 5:14-16), stand on healing scriptures, use available medicine (Luke the physician), seek intercession at jctm.org.ng/prayer. Trust God's deeper purpose when healing seems delayed (2 Corinthians 12:9).`,
  },

  // ── EXPANDED KNOWLEDGE BASE v5.0 — 45 additional doctrine, ministry, and practice chunks ──

  {
    source: "lords-supper-communion",
    content: `The Lord's Supper (Holy Communion) is a sacred ordinance instituted by Jesus on the night of His betrayal (Matthew 26:26-29, 1 Corinthians 11:23-26). JCTM teaches it as a memorial feast — "Do this in remembrance of Me." Elements: bread (Christ's broken body) and the cup (His shed blood). It is a proclamation of Christ's death until He comes. JCTM warns against mechanical, unworthy partaking (1 Corinthians 11:27-30) — believers must examine themselves first. Frequency: practiced regularly in JCTM services. The Lord's Table is for born-again believers. JCTM does not teach transubstantiation (the elements becoming the literal body and blood of Christ) — this is a Catholic doctrine identified as sacramental corruption under the Correction Mandate.`,
  },
  {
    source: "great-commission",
    content: `The Great Commission (Matthew 28:18-20) is the mandate given by Jesus to all believers: "Go therefore and make disciples of all nations, baptizing them in the name of the Father and of the Son and of the Holy Spirit, teaching them to observe all things that I have commanded you." JCTM takes this command seriously — through Temple TV (@TEMPLETVJCTM), crusades, viewing centres, the Digital Sanctuary, and personal evangelism. The Warri City Crusade 2026 is a direct expression of the Great Commission. Every believer is called to share the gospel — not just professional ministers. Mark 16:15: "Go into all the world and preach the gospel to every creature."`,
  },
  {
    source: "christian-lifestyle-standards",
    content: `JCTM holds believers to the standard of practical holiness in daily life. Key principles: 1. Dress modestly — the body is the temple of the Holy Spirit (1 Corinthians 6:19-20). Immodest or sexually provocative dressing is incompatible with Christian witness. 2. Entertainment — Christians must guard what they consume. Pornography, occult films, and worldly music that promotes sin have no place in the believer's life (Philippians 4:8). 3. Language — corrupt speech, cursing, and ungodly conversation are forbidden (Ephesians 4:29). 4. Relationships — believers should not be unequally yoked with unbelievers (2 Corinthians 6:14). 5. Social media — must be used responsibly, not for gossip, sexual display, or worldly conformity. JCTM does not teach legalism but genuine transformation of the heart reflected in lifestyle.`,
  },
  {
    source: "evangelism-soul-winning",
    content: `JCTM passionately believes in personal evangelism and soul winning as a core Christian duty. Proverbs 11:30: "He who wins souls is wise." Daniel 12:3: "Those who turn many to righteousness shall shine like stars forever and ever." Methods JCTM encourages: 1. Personal testimony — share what Christ has done for you (Revelation 12:11). 2. Temple TV outreach — share sermon links and JCTM content with unsaved friends. 3. One-on-one conversation — plant seeds patiently. 4. Crusade attendance — bring unsaved family and friends to open-air gospel meetings. 5. Social media evangelism — post sound doctrine and gospel truth. JCTM's crusades (like Warri City Crusade 2026) are major corporate evangelistic events. The goal is not just conversion but discipleship — making disciples, not just decisions.`,
  },
  {
    source: "discipleship-mentorship",
    content: `Discipleship is the process of growing from a new convert into a mature follower of Christ. JCTM teaches: discipleship is intentional and relational, not accidental. Jesus discipled 12 men intensively (Mark 3:14 — "that they might be with Him"). 2 Timothy 2:2: "The things you have heard from me... commit these to faithful men who will be able to teach others also." Marks of a JCTM disciple: consistent in the Word and prayer, submitted to sound doctrine, growing in holiness, actively serving in ministry, mentoring younger believers. JCTM's services, Bible studies, and mid-week teachings are structured to produce disciples, not spectators. Every member is called to be both discipled by a mature believer and actively discipling someone else.`,
  },
  {
    source: "prayer-life-doctrine",
    content: `Prayer is the believer's direct line of communication with God — the lifeline of the Christian life. JCTM teaches: 1. Types of prayer: intercession (standing in the gap for others — Ezekiel 22:30), supplication (personal requests — Philippians 4:6), thanksgiving (Psalm 100:4), worship (adoration of God's person), warfare prayer (binding spiritual forces — Matthew 16:19). 2. The Lord's Prayer (Matthew 6:9-13) as a framework, not a vain repetition. 3. Praying in the Spirit (tongues) for personal edification (Jude 20, 1 Corinthians 14:4). 4. Corporate prayer — the early church prayed together (Acts 2:42, Acts 4:31). 5. Persistence — Luke 18:1: "Men always ought to pray and not lose heart." JCTM holds dedicated prayer meetings and encourages a personal prayer altar of at least 30 minutes daily.`,
  },
  {
    source: "forgiveness-reconciliation",
    content: `Forgiveness is not optional in the Christian life. Matthew 6:14-15: "If you forgive men their trespasses, your heavenly Father will also forgive you. But if you do not forgive men their trespasses, neither will your Father forgive your trespasses." JCTM teaches: 1. Forgiveness is a decision of the will, not a feeling — you choose to release offenders. 2. Forgiveness does not mean condoning wrong or trusting instantly — it means releasing the offender to God. 3. Bitterness is spiritual poison (Hebrews 12:15 — "a root of bitterness springing up causes trouble"). 4. Reconciliation requires two parties willing to engage; forgiveness requires only you. 5. Joseph is the ultimate Old Testament model (Genesis 50:20). Jesus is the ultimate model — "Father, forgive them" from the cross (Luke 23:34). Submit a prayer request for help forgiving at jctm.org.ng/prayer.`,
  },
  {
    source: "christian-suffering-persecution",
    content: `JCTM teaches that suffering and persecution are expected realities for genuine Christians. 2 Timothy 3:12: "All who desire to live godly in Christ Jesus will suffer persecution." John 15:18-19: "If the world hates you, you know that it hated Me before it hated you." Biblical response to suffering: 1. Rejoice — Acts 5:41, believers rejoiced that they were counted worthy to suffer for Jesus. 2. Stand firm — Ephesians 6:13: "Having done all, to stand." 3. Pray for persecutors — Matthew 5:44. 4. Trust God's purpose — Romans 8:28: "All things work together for good." 5. Identify with Christ — Philippians 3:10: "That I may know Him and the power of His resurrection and the fellowship of His sufferings." JCTM does not teach the prosperity gospel view that suffering indicates lack of faith or sin — God refines gold through fire (1 Peter 1:6-7).`,
  },
  {
    source: "divine-calling-purpose",
    content: `Every believer has a divine purpose and calling. Romans 8:28-30: God foreknew, predestined, called, justified, and glorified those who love Him. Ephesians 2:10: "We are His workmanship, created in Christ Jesus for good works, which God prepared beforehand that we should walk in them." JCTM teaching on calling: 1. General calling — all believers are called to holiness, discipleship, and evangelism. 2. Specific calling — God places unique gifts and assignments on individuals (Romans 12:6-8). 3. Discovering your calling: through prayer, the Word, spiritual gifts assessment, and counsel from mature believers. 4. Don't compare callings — 1 Corinthians 12:18-20 explains the body has many members with different functions. 5. Faithfulness in small things (Luke 16:10) precedes promotion to greater assignments. Contact JCTM for pastoral guidance: info@jctm.org.ng.`,
  },
  {
    source: "sabbath-sunday-worship",
    content: `JCTM observes Sunday as the primary day of Christian worship — not the Saturday Sabbath. Why Sunday: Jesus rose from the dead on the first day of the week (John 20:1). The early church met on the first day (Acts 20:7, 1 Corinthians 16:2). Revelation 1:10 refers to "the Lord's Day." The Sabbath (Saturday rest) was a covenant sign for Israel under the Mosaic law (Exodus 31:16-17). Colossians 2:16-17: "Let no one judge you in food or in drink, or regarding a festival or a new moon or sabbaths, which are a shadow of things to come, but the substance is of Christ." JCTM warns against Seventh-Day Adventist Sabbatarianism which insists Saturday is the only valid day of worship — this is identified as a doctrinal error. The principle of one day in seven for rest and worship remains, but Christians are free regarding which day (Romans 14:5-6). JCTM Sunday service: 8:00 AM – 12:00 PM WAT at Ebrumede Temple, Warri.`,
  },
  {
    source: "rapture-detailed",
    content: `The Rapture is the sudden, miraculous catching away of born-again believers to meet the Lord in the air before the tribulation. 1 Thessalonians 4:16-17: "The Lord Himself will descend from heaven with a shout... and the dead in Christ will rise first. Then we who are alive and remain shall be caught up together with them in the clouds to meet the Lord in the air." JCTM's position: Pre-tribulation rapture — genuine, holy-living believers are removed before the 7-year tribulation period begins. Only those living in holiness and genuine faith will be raptured (Matthew 24:40-41 — "One will be taken, another left"). Post-rapture: the Antichrist rises, the mark of the beast (666) is implemented globally, unprecedented suffering follows (Revelation 6-19). The Second Coming (distinct from the rapture) occurs after the tribulation when Christ returns to earth with His saints (Revelation 19:11-16). JCTM's 2026 Crusade theme: "Be Ready for Rapture: Tribulation Is Coming! Run For Your Soul!"`,
  },
  {
    source: "hell-eternal-judgment",
    content: `JCTM teaches the reality of hell as a literal place of eternal conscious punishment for the unrepentant. Matthew 25:41: "Depart from Me, you cursed, into the everlasting fire prepared for the devil and his angels." Revelation 20:14-15: "Death and Hades were cast into the lake of fire. This is the second death... Anyone not found written in the Book of Life was cast into the lake of fire." Hell is characterized by: separation from God, conscious torment (Luke 16:23-24 — the rich man in Hades), fire (Matthew 5:22), darkness (Matthew 8:12), and eternity ("where their worm does not die and the fire is not quenched" — Mark 9:44). JCTM does not teach annihilationism (that souls cease to exist at death) or universalism (all are eventually saved). The urgency of the gospel and the Correction Mandate is rooted in the reality of hell. "Today is the day of salvation" (2 Corinthians 6:2).`,
  },
  {
    source: "heaven-eternal-life",
    content: `Heaven is the eternal home of all who are genuinely born again and have lived holy lives. John 14:2-3: "In My Father's house are many mansions... I go to prepare a place for you." Revelation 21:1-4 describes the New Jerusalem: "No more tears, no more death, no more pain — the former things have passed away." Heaven features: the direct presence of God and Christ (Revelation 22:4 — "they shall see His face"), the absence of sin, sickness, and suffering, an incorruptible resurrection body (1 Corinthians 15:42-44), and joyful, meaningful eternal existence. JCTM does not teach that everyone goes to heaven regardless of how they lived — this universalism contradicts clear scripture. Only those whose names are written in the Lamb's Book of Life enter (Revelation 21:27). The Christian's greatest motivation for holy living is the eternal reward awaiting those who finish well (2 Timothy 4:7-8).`,
  },
  {
    source: "faith-and-works",
    content: `JCTM teaches the biblical balance between faith and works. Ephesians 2:8-9: "By grace you have been saved through faith, and that not of yourselves; it is the gift of God, not of works, lest anyone should boast." Salvation is by faith alone — no amount of good works merits eternal life. However, James 2:17: "Faith by itself, if it does not have works, is dead." Genuine saving faith naturally produces righteous works. This is not a contradiction: Paul speaks of works as the grounds of justification (which is by faith alone); James speaks of works as the evidence of genuine faith. Titus 2:14: Christ redeemed us "to purify for Himself His own special people, zealous for good works." JCTM warns against two errors: 1. Works-based salvation (Catholic/legalistic) — trusting deeds for justification. 2. Cheap grace (antinomian) — claiming faith while living lawlessly (1 John 2:3-4).`,
  },
  {
    source: "anointing-laying-on-hands",
    content: `The anointing of the Holy Spirit is the divine enablement and empowerment for ministry and service. 1 John 2:27: "The anointing which you have received from Him abides in you." Acts 10:38: "God anointed Jesus of Nazareth with the Holy Spirit and with power, who went about doing good and healing all who were oppressed by the devil." Laying on of hands is a foundational doctrine (Hebrews 6:2) used in JCTM for: ordination to ministry (1 Timothy 4:14), healing (Mark 16:18, James 5:14), impartation of the Holy Spirit (Acts 8:17, Acts 19:6), and blessing (Mark 10:16). JCTM warns against people who self-proclaim great anointings for fundraising purposes — true anointing is confirmed by fruit, not self-advertisement. The anointing breaks the yoke (Isaiah 10:27). Seek the Anointer, not just the anointing — pursue intimacy with God through prayer, fasting, and the Word.`,
  },
  {
    source: "music-worship-standards",
    content: `JCTM teaches that worship must be in spirit and in truth (John 4:24). This has direct implications for music in the church. JCTM's position on worship music: 1. Lyrics must be doctrinally sound — entertainment-style Christian music that promotes prosperity gospel or sensuality is rejected. 2. Music should lead into the presence of God, not performance. 3. Colossians 3:16: "Teach and admonish one another in psalms and hymns and spiritual songs, singing with grace in your hearts to the Lord." 4. JCTM maintains traditional and contemporary worship elements, with content supremacy over style. 5. Secular music with immoral content is incompatible with a consecrated life (Ephesians 5:19). 6. Praise leads into worship — Psalm 100:4: "Enter His gates with thanksgiving and His courts with praise." The worship at JCTM Ebrumede Temple and Temple TV services reflect these standards.`,
  },
  {
    source: "prosperity-gospel-expose",
    content: `The Prosperity Gospel (Word of Faith movement) is one of the five major errors the Correction Mandate addresses. Core claims of the prosperity gospel: 1. Financial wealth is always God's will for every believer. 2. Sow a seed (give money to the ministry) and receive a hundredfold return. 3. Positive confession changes your material reality. 4. Sickness is always due to sin or lack of faith. Key proponents include Kenneth Hagin, Kenneth Copeland, Benny Hinn, Creflo Dollar. JCTM's biblical refutation: Jesus said "It is hard for a rich man to enter the kingdom" (Matthew 19:24). Paul was content in poverty and abundance (Philippians 4:11-12). The apostles were not wealthy — they suffered imprisonments and beatings (2 Corinthians 11:23-28). 1 Timothy 6:5-10: "They suppose that godliness is a means of gain... the love of money is a root of all kinds of evil." The prosperity gospel exploits desperate people and distorts the purpose of giving. It must be exposed and rejected.`,
  },
  {
    source: "false-prophets-testing-spirits",
    content: `The Correction Mandate specifically addresses prophetic manipulation — one of the most dangerous errors in modern Christianity. How to identify false prophets (Matthew 7:15-20 — "by their fruits you will know them"): 1. They demand money before prophesying or make giving conditional on receiving a word. 2. Their prophecies consistently fail or are vague enough to be unfalsifiable. 3. They promote themselves and build personal empires rather than pointing to Christ. 4. They contradict the written Word of God in their messages. 5. They operate in fear, manipulation, and control (Jeremiah 23:16). 1 John 4:1: "Beloved, do not believe every spirit, but test the spirits, whether they are of God; because many false prophets have gone out into the world." The test: 1. Does the prophecy align with scripture? 2. Does it come to pass? (Deuteronomy 18:22). 3. Does the prophet live a holy life? Prophet Amos holds the genuine prophetic office confirmed by documented prophetic accuracy over decades.`,
  },
  {
    source: "biblical-authority-scripture",
    content: `JCTM holds the Bible (the 66 canonical books, Old and New Testaments) as the supreme and final authority on all matters of faith, doctrine, and Christian living. 2 Timothy 3:16-17: "All Scripture is given by inspiration of God, and is profitable for doctrine, for reproof, for correction, for instruction in righteousness, that the man of God may be complete, thoroughly equipped for every good work." JCTM's doctrine of scripture: 1. Divine inspiration — God breathed the words through human authors. 2. Inerrancy — in the original manuscripts, scripture is without error. 3. Sufficiency — the Bible contains everything necessary for salvation and godly living. 4. Final authority — no prophecy, experience, tradition, or church decree can override the written Word. The Correction Mandate is grounded in this conviction — where the church has strayed from the Bible, JCTM calls it back. The Bible JCTM primarily uses is the King James Version (KJV) and New King James Version (NKJV) for their faithfulness to the original texts.`,
  },
  {
    source: "creation-and-science",
    content: `JCTM holds to biblical creationism — that God created the heavens and the earth as described in Genesis 1-2. This is foundational to a correct understanding of human identity, dignity, morality, and the gospel itself. Genesis 1:1: "In the beginning God created the heavens and the earth." Colossians 1:16: "For by Him all things were created that are in heaven and that are on earth, visible and invisible." JCTM does not accept macro-evolution (the theory that all life descended from a common ancestor through random mutation and natural selection) as compatible with the Genesis account. Theistic evolution (God used evolution to create) is also rejected as inconsistent with the clear text of Genesis. The age of the earth is not a salvific issue, but the historicity of Adam and Eve, the Fall, and original sin is essential doctrine connected directly to the necessity of Christ's redemption (Romans 5:12-21). Psalm 19:1: "The heavens declare the glory of God."`,
  },
  {
    source: "israel-and-prophecy",
    content: `JCTM teaches that Israel holds a unique place in God's prophetic plan. Romans 11:1: "Has God cast away His people? Certainly not!" God's covenant with Abraham and His promises to Israel are irrevocable (Romans 11:29). Key JCTM positions: 1. Israel's restoration to the land in 1948 is a prophetic fulfillment. 2. Jerusalem's centrality in end-times prophecy remains (Zechariah 12:2-3). 3. The 144,000 in Revelation are literal Jewish witnesses during the tribulation (Revelation 7:4). 4. The Antichrist will make a covenant with Israel and ultimately desecrate the rebuilt temple (Daniel 9:27, 2 Thessalonians 2:4). 5. Christ will return to the Mount of Olives (Zechariah 14:4) and establish His millennial reign from Jerusalem. JCTM does not teach Replacement Theology (that the church has completely replaced Israel in God's plan) — this view is identified as a doctrinal error.`,
  },
  {
    source: "antichrist-mark-of-beast",
    content: `The Antichrist is a coming world leader who will deceive the nations and demand worship during the 7-year tribulation. 2 Thessalonians 2:3-4: "The man of sin is revealed, the son of perdition, who opposes and exalts himself above all that is called God or that is worshiped, so that he sits as God in the temple of God, showing himself that he is God." Key facts about the Antichrist: 1. He is a real human being, not just a symbolic system. 2. He will rise after the rapture removes the restraining influence of the Holy Spirit (2 Thessalonians 2:7-8). 3. He will implement a global economic control system requiring a mark (the number 666) on the right hand or forehead (Revelation 13:16-18). 4. Taking the mark means eternal damnation — Revelation 14:9-11. 5. He will be destroyed by Christ at His Second Coming (2 Thessalonians 2:8). JCTM's urgent warning: Do NOT receive the mark of the beast under any circumstances.`,
  },
  {
    source: "new-birth-born-again",
    content: `Being "born again" is not a religious phrase — it is the supernatural spiritual transformation required for eternal life. John 3:3-8: Jesus told Nicodemus, "Most assuredly, I say to you, unless one is born again, he cannot see the kingdom of God... That which is born of the flesh is flesh, and that which is born of the Spirit is spirit." The new birth involves: 1. Repentance — genuine turning from sin (Acts 2:38). 2. Faith — personal trust in Jesus Christ as Lord and Savior (Romans 10:9-10). 3. Reception — inviting Christ into your life (John 1:12). 4. Regeneration — the Holy Spirit gives you a new nature (2 Corinthians 5:17: "If anyone is in Christ, he is a new creation"). 5. Adoption — you become a child of God (Romans 8:15-16). Signs of genuine new birth: love for God's Word, desire to pray, hatred of sin, love for fellow believers (1 John 3:14). Being "born into a Christian family" is not the new birth — each person must be personally born again.`,
  },
  {
    source: "confession-repentance-restoration",
    content: `Biblical confession and repentance are the pathway back to fellowship with God after sin. 1 John 1:9: "If we confess our sins, He is faithful and just to forgive us our sins and to cleanse us from all unrighteousness." Three levels of confession in JCTM teaching: 1. Confession to God — always required. This is the basis of forgiveness. 2. Confession to those you have wronged — Matthew 5:23-24: reconcile before bringing your offering. 3. Confession to a trusted spiritual leader — James 5:16: "Confess your trespasses to one another and pray for one another, that you may be healed." Repentance (metanoia in Greek) means a genuine change of mind that leads to changed behaviour — not just feeling guilty or saying sorry. Acts 26:20: "They should repent, turn to God, and do works befitting repentance." JCTM's pastor's door is always open to assist any believer seeking genuine restoration.`,
  },
  {
    source: "tithing-new-testament",
    content: `Tithing — giving 10% of income to God — has its roots in the Old Testament covenant with Israel (Malachi 3:10, Leviticus 27:30) but JCTM teaches it as a living principle for New Testament believers. The New Testament raises the standard to grace giving — not merely 10% but cheerful, generous, Spirit-led giving (2 Corinthians 9:6-7). The early church gave sacrificially (Acts 2:44-45). JCTM's teaching on the tithe: 1. The tithe acknowledges God's ownership of all things (Psalm 24:1). 2. It supports the ministry and those who serve the gospel full-time (1 Corinthians 9:14, Galatians 6:6). 3. Malachi 3:10: "Bring all the tithes into the storehouse, that there may be food in My house." 4. JCTM does not teach that failing to tithe is the cause of financial curses — this is prosperity gospel manipulation. 5. Giving should be voluntary, planned, cheerful, and proportional (1 Corinthians 16:2).`,
  },
  {
    source: "jctm-youth-ministry",
    content: `JCTM has a vibrant youth ministry committed to raising a generation of young people grounded in sound doctrine and genuine holiness. Youth ministry mission: equip young people with the Word of God, provide a counter-cultural community of faith, and call them into their divine destiny. Key activities: youth-focused Bible study sessions, mentorship pairing with mature believers, targeted teachings on dating, purity, identity, and purpose, active participation in Temple TV outreach and evangelism. JCTM teaches youth: 1 Timothy 4:12 — "Let no one despise your youth, but be an example to the believers in word, in conduct, in love, in spirit, in faith, in purity." Youth are not the church of tomorrow — they are the church of today. JCTM encourages young people to pursue a personal altar of prayer, consistent Word study, and active service in the body. Contact info@jctm.org.ng for youth ministry information.`,
  },
  {
    source: "jctm-womens-fellowship",
    content: `JCTM's Women's Fellowship is a vital arm of the ministry devoted to the spiritual growth, practical support, and community of women in the faith. Titus 2:3-5: older women teaching younger women — this is the model JCTM follows. Women's fellowship focus areas: 1. Spiritual growth — Bible study, prayer, and devotional life. 2. Marriage and family — supporting wives and mothers in their God-given roles. 3. Widows and single mothers — special care and community support. 4. Mentorship — older women guiding younger women in godly living. 5. Business and calling — helping women discover and develop their gifts for God's Kingdom. JCTM affirms the full spiritual equality of women before God (Galatians 3:28) while maintaining the biblical order for family and church governance. Women minister powerfully in JCTM through prayer, prophecy, teaching (in women's settings), hospitality, and service. Contact info@jctm.org.ng for women's fellowship details.`,
  },
  {
    source: "jctm-prayer-warriors",
    content: `JCTM maintains a dedicated intercessory prayer team — the prayer warriors who cover the ministry, the leadership, the congregation, and the wider community in prayer. Ezekiel 22:30: "I sought for a man among them who would make a wall, and stand in the gap before Me on behalf of the land." JCTM's prayer ministry operates through: 1. Scheduled prayer vigils and corporate intercession sessions. 2. 24-hour prayer chains for national and international crises. 3. Personal intercessors who cover Prophet Amos and the leadership in prayer. 4. Online prayer submission at jctm.org.ng/prayer — all requests are prayed over by the team. Principles of JCTM intercession: standing in agreement (Matthew 18:19-20), praying in the Spirit (Romans 8:26-27), persistence (Luke 18:1-8), and faith (Mark 11:24). You can submit a prayer request at any time — your need will be brought before God's throne.`,
  },
  {
    source: "jctm-viewing-centres",
    content: `JCTM operates a network of viewing centres across Nigeria and beyond — communities where people gather to watch Temple TV live services and Sunday broadcasts together. Viewing centres are ideal for those who cannot travel to Ebrumede Temple in Warri but want to worship with the JCTM community. What happens at a viewing centre: live streaming of Sunday services from Ebrumede Temple, group prayer and fellowship, local pastoral care from appointed leaders, and discipleship activities. To find or establish a viewing centre near you: visit jctm.org.ng/viewing-centres or contact info@jctm.org.ng. Starting a viewing centre: any committed JCTM member with a stable internet connection and a space for gathering can apply to host one. Viewing centres extend the Correction Mandate geographically — bringing the sound doctrine of JCTM to every community.`,
  },
  {
    source: "jctm-founding-history",
    content: `Jesus Christ Temple Ministry (JCTM) was founded on January 3, 2013 by Prophet Amos Evomobor in Ebrumede, Warri, Delta State, Nigeria. The founding followed a direct divine commission received by Prophet Amos — the Correction Mandate — to address five major errors that had infiltrated contemporary Christianity. From its beginning, JCTM distinguished itself from popular Nigerian church culture by refusing to practice the prosperity gospel, rejecting prophetic manipulation for financial gain, and teaching from the original apostolic tradition. The ministry established Temple TV on YouTube (@TEMPLETVJCTM) as its primary broadcast platform, enabling global reach from a local base in Warri. Key milestones: 2013 — Founding. 2015 — Temple TV launched. 2019 — JCTM Digital Sanctuary (online platform) developed. 2026 — Warri City Crusade (major outdoor evangelical thrust). Today JCTM reaches believers in 40+ nations through digital channels, viewing centres, crusades, and the Digital Sanctuary.`,
  },
  {
    source: "prophet-amos-key-teachings",
    content: `Prophet Amos Evomobor has preached over 479 sermons covering a wide range of theological and practical topics. His major teaching series and themes include: 1. The Correction Mandate Series — the definitive JCTM doctrinal series exposing the five major errors. 2. Primitive Christianity Series — recovering the apostolic faith. 3. Holiness Teachings — the non-negotiable standard of holy living. 4. End Times Prophecy Series — detailed, scripturally-grounded eschatology. 5. The Five-Fold Ministry — understanding and operating in divine offices. 6. Exposing the Prosperity Gospel — a systematic biblical refutation of Word of Faith teachings. 7. Prayer and Fasting — practical and biblical guidance. 8. The Holy Spirit — receiving, walking in, and testing the Spirit. 9. The Rapture and Tribulation — readiness and preparation. 10. Sound Doctrine — why theological precision matters. All teachings are available on Temple TV at YouTube (@TEMPLETVJCTM) and the sermon library at jctm.org.ng/sermons.`,
  },
  {
    source: "christian-parenting",
    content: `JCTM teaches that parenting is one of the highest callings and most strategic assignments in God's Kingdom. Deuteronomy 6:6-7: "These words which I command you today shall be in your heart. You shall teach them diligently to your children, and shall talk of them when you sit in your house, when you walk by the way, when you lie down, and when you rise up." Proverbs 22:6: "Train up a child in the way he should go, and when he is old he will not depart from it." JCTM principles for Christian parents: 1. Establish a family altar — daily prayer and Bible reading with your children. 2. Teach doctrine early — children can understand the gospel from age 4-5. 3. Model holiness — children learn more from what they observe than what they hear. 4. Discipline in love — Proverbs 13:24: "He who spares his rod hates his son." Biblical discipline is never abusive but is consistent, loving, and corrective. 5. Guard their media diet — the primary teacher of most children today is their screen. 6. Dedicate them to God — and pray for them by name daily.`,
  },
  {
    source: "stewardship-wealth-biblical",
    content: `JCTM teaches biblical stewardship — the principle that all we have belongs to God and we are managers, not owners. Psalm 24:1: "The earth is the LORD's, and all its fullness." The parable of the talents (Matthew 25:14-30) establishes that God expects His people to invest and multiply what He entrusts to them. Biblical stewardship includes: 1. Financial management — budgeting, saving, avoiding debt traps, generous giving. 2. Time — using your hours for God's purposes (Ephesians 5:15-16). 3. Gifts and talents — deploying your abilities for Kingdom impact. 4. Body — the body is the temple of the Holy Spirit; steward it through healthy habits. 5. Influence — your platform, relationships, and social capital are trust funds from God. JCTM opposes both the prosperity gospel extreme (wealth equals blessing, poverty equals curse) and the poverty gospel extreme (poverty is more holy). The biblical standard is contentment with provision and generosity with surplus (1 Timothy 6:6-8).`,
  },
  {
    source: "ecumenism-false-unity",
    content: `The fifth correction of the Correction Mandate addresses dangerous ecumenism — the movement toward church unity at the cost of doctrinal truth. JCTM is not against Christian unity — Jesus prayed for it (John 17:21). However, true unity can only be built on truth, not compromise. Dangerous ecumenism JCTM identifies includes: 1. Interfaith dialogue that treats Islam, Hinduism, and Christianity as equally valid paths to God (John 14:6: "I am the way, the truth, and the life. No one comes to the Father except through Me"). 2. Roman Catholic-Protestant merger movements that ignore fundamental doctrinal differences. 3. The "all churches are the same" attitude that ignores false doctrine, moral compromise, and heresy. 4. Denominational pressure to stay silent on error in the name of unity. Amos 3:3: "Can two walk together, unless they are agreed?" 2 Corinthians 6:14-17: "Come out from among them and be separate, says the Lord." True Christian unity is built on the apostolic foundation — the Word of God as the final authority.`,
  },
  {
    source: "digital-sanctuary-features",
    content: `The JCTM Digital Sanctuary (jctm.org.ng) is the official online platform of Jesus Christ Temple Ministry, built to extend every aspect of the ministry into the digital realm. Key features: 1. Sermon Library — browse and watch 400+ sermons from Prophet Amos, filterable by topic and date. 2. Live Streaming — watch Sunday and midweek services live from Ebrumede Temple. 3. TempleBots AI — the official ministry AI assistant (powered by local AI + optional OpenAI) for spiritual guidance 24/7. 4. Global Altar — a real-time 3D visualization of believers worshipping simultaneously worldwide. 5. Testimony Vault — submit and browse community testimonies of God's faithfulness. 6. Daily Devotionals — scripture-based devotional content with email subscription. 7. Give Online — Paystack (Naira) and Stripe (international) giving portal. 8. Events — upcoming JCTM crusades, conferences, and gatherings. 9. Scripture Study — AI-powered deep Bible study tool. 10. Gallery — photos from JCTM events and services. 11. Prayer Requests — submit personal prayer needs to the intercession team. 12. Member Portal — member registration, directory, and community features.`,
  },
  {
    source: "alcohol-worldliness",
    content: `JCTM teaches biblical separation from alcohol, substance abuse, and worldly practices that defile the body and compromise witness. 1 Corinthians 6:19-20: "Your body is the temple of the Holy Spirit... glorify God in your body." Alcohol: Proverbs 20:1 — "Wine is a mocker, strong drink is a brawler." Ephesians 5:18: "Do not be drunk with wine, in which is dissipation; but be filled with the Spirit." JCTM's position: total abstinence from alcohol is the wisest choice for a believer, given the risk of addiction, the stumbling of weaker brethren (Romans 14:21), and the witness it projects. Social drinking is inconsistent with a consecrated lifestyle. Smoking: the body is God's temple; smoking defiles it. Drugs: substance abuse opens doors for demonic oppression (Galatians 5:20 — "sorcery" in Greek is "pharmakeia," from which pharmacy derives). JCTM calls believers to be filled with the Spirit (Ephesians 5:18) as the true supernatural alternative to all substance-seeking behaviour.`,
  },
  {
    source: "tongues-gifts-order",
    content: `JCTM teaches that the gift of tongues operates in two distinct contexts with specific biblical rules for each. 1. Private prayer tongues — praying in the Spirit for personal edification (1 Corinthians 14:4, Jude 20). This is encouraged for all Spirit-baptized believers. 2. Public tongues in church — must always be accompanied by interpretation (1 Corinthians 14:27-28): "If anyone speaks in a tongue, let there be two or at the most three, each in turn, and let one interpret. But if there is no interpreter, let him keep silent in church." JCTM warns against: 1. Counterfeit tongues — emotional utterances that are not Spirit-generated, often manufactured under peer pressure. 2. Uncontrolled public tongues without interpretation — this is disorder (1 Corinthians 14:33: "God is not the author of confusion but of peace"). 3. Using tongues as the only test of spirituality — the greatest gift is love (1 Corinthians 13:1-3). 4. Tongues as a performance or show of spirituality. All gifts must operate in love and order within the JCTM assembly.`,
  },
  {
    source: "fivefold-vs-false-offices",
    content: `The difference between genuine and false ministry offices is critical to the Correction Mandate. Genuine five-fold ministry (Ephesians 4:11-13) exists to equip the saints and edify the body of Christ — not to build personal empires or extract financial resources. How to identify genuine vs. false: GENUINE: Confirmed by fruit (Galatians 5:22-23), confirmed by community recognition, aligned with scripture, serves the flock sacrificially, transparent financially, points to Christ not themselves. FALSE: Self-proclaimed titles without fruit, financial exploitation as a condition of ministry, prophetic words conditioned on giving, lifestyle inconsistent with the message, doctrinal deviation, building celebrity rather than discipleship. 2 Peter 2:1-3: "False prophets also arose among the people, just as there will be false teachers among you, who will secretly bring in destructive heresies." Prophet Amos Evomobor's prophetic office is confirmed by decades of documented prophetic accuracy, the fruit of his ministry across nations, and alignment with the written Word.`,
  },
  {
    source: "body-of-christ-church",
    content: `The Church (Ekklesia — "called out ones") is not a building but the living body of Christ worldwide, composed of all genuine born-again believers. 1 Corinthians 12:12-14: "The body is one and has many members, but all the members of that one body, being many, are one body. So also is Christ." The church has two expressions: 1. The universal church — all born-again believers across denominations, nations, and time. 2. The local church — a covenant community of believers gathering regularly for worship, teaching, fellowship, and service. JCTM teaches that local church involvement is essential for every believer (Hebrews 10:25: "Not forsaking the assembling of ourselves together"). The marks of a true church: faithful preaching of the Word, proper administration of the sacraments (baptism and communion), loving community, and exercising church discipline. JCTM identifies as a local expression of the universal body of Christ, calling the body back to the original apostolic standard.`,
  },
  {
    source: "persecution-standing-firm",
    content: `JCTM recognizes that preaching the Correction Mandate provokes opposition — both within the church and from the world. This is not unexpected. Matthew 5:10-12: "Blessed are those who are persecuted for righteousness' sake, for theirs is the kingdom of heaven... Blessed are you when they revile and persecute you, and say all kinds of evil against you falsely for My sake. Rejoice and be exceedingly glad." Acts 5:29: "We ought to obey God rather than men." JCTM's response to persecution and opposition: 1. Continue preaching the uncompromised Word. 2. Pray for those who oppose the ministry. 3. Refuse to retaliate in the flesh (Romans 12:17-19). 4. Document the truth faithfully. 5. Trust God to vindicate in His time (Isaiah 54:17: "No weapon formed against you shall prosper"). The Correction Mandate is not a popular message — it confronts profitable error. But JCTM is committed to the truth regardless of opposition, knowing that God confirms His Word with signs and fruit.`,
  },
  {
    source: "church-discipline",
    content: `Church discipline is a loving, biblical practice designed to restore wayward members and protect the purity of the congregation. Matthew 18:15-17 gives the three-step process: 1. Private confrontation — go alone to the person who has sinned. 2. Witnesses — if unrepentant, bring one or two others. 3. Church involvement — if still unrepentant, involve the church. 4. Exclusion — if completely unrepentant, treat them "as a heathen and tax collector" (removal from fellowship). 1 Corinthians 5:5-6 describes Paul instructing the removal of an unrepentant immoral member — "a little leaven leavens the whole lump." The goal of discipline is always restoration (Galatians 6:1 — "restore such a one in a spirit of gentleness"). JCTM practices church discipline when necessary to: 1. Protect the congregation from moral and doctrinal contamination. 2. Wake up the sinning member to the seriousness of their actions. 3. Preserve the witness of the church before the world. Discipline is never for power or control — it is for love.`,
  },
  {
    source: "christian-death-mourning-hope",
    content: `Death is not the end for the believer — it is a doorway into God's presence. Philippians 1:21-23: "For to me, to live is Christ, and to die is gain... to depart and be with Christ, which is far better." 2 Corinthians 5:8: "We are confident, yes, well pleased rather to be absent from the body and to be present with the Lord." For the believer, death brings: immediate presence with Christ, freedom from sin and suffering, joyful reunion with those who died in the faith. How JCTM approaches bereavement: 1. Grieve honestly — Jesus wept at Lazarus' tomb (John 11:35). Grief is not a lack of faith. 2. Grieve with hope — 1 Thessalonians 4:13: "But I do not want you to be ignorant, brethren, concerning those who have fallen asleep, lest you sorrow as others who have no hope." 3. Trust God's timing — Ecclesiastes 3:2: "A time to be born and a time to die." 4. Celebrate the life and witness of believers who die in the Lord. JCTM provides pastoral support for bereavement — contact info@jctm.org.ng.`,
  },
  {
    source: "dreams-visions-interpretation",
    content: `JCTM acknowledges that God can communicate through dreams and visions — this is biblical (Joel 2:28, Acts 2:17). Numbers 12:6: "If there is a prophet among you, I, the LORD, make Myself known to him in a vision; I speak to him in a dream." However, JCTM teaches critical guidelines for discerning divine dreams and visions: 1. Every dream or vision must be tested against the written Word of God — it cannot contradict scripture. 2. Not every dream is from God — some are from the soul (our own anxieties and desires), some may be demonic (1 Timothy 4:1). 3. Recurring, vivid, or prophetically specific dreams should be prayed over and submitted to mature spiritual counsel. 4. Do not build life decisions solely on a dream without multiple confirmations from scripture and wise counsel. 5. Dreams requiring you to give money to a prophet to be fulfilled are manipulation, not divine communication. JCTM warns against prophets who specialize in "dream interpretation" as a business — extracting money to explain or resolve people's dreams.`,
  },
  {
    source: "intercessory-prayer-deep",
    content: `Intercession is standing before God on behalf of others — the highest form of prayer ministry. Exodus 32:11-14: Moses interceded and God relented from judgment. Romans 8:26-27: "The Spirit also helps in our weaknesses. For we do not know what we should pray for as we ought, but the Spirit Himself makes intercession for us with groanings which cannot be uttered." Types of intercession: 1. Personal intercession — praying for specific individuals by name. 2. National intercession — standing in the gap for Nigeria, the church, and world leaders. 3. Prophetic intercession — praying as the Spirit directs, often without full understanding. 4. Spiritual warfare intercession — specifically targeting demonic strongholds (Daniel 10:12-13). How to develop an intercession ministry: 1. Set aside daily time specifically for intercession. 2. Keep a prayer journal — record requests and note answers. 3. Pray in tongues for extended periods. 4. Fast regularly as an amplifier of intercession (Isaiah 58:6). 5. Join JCTM's intercession team at jctm.org.ng/prayer. "The effective, fervent prayer of a righteous man avails much." — James 5:16`,
  },
  {
    source: "jctm-conference-events",
    content: `JCTM regularly hosts conferences, crusades, and special gatherings as expressions of the Correction Mandate and the Great Commission. Key event types: 1. Annual Ministers' Conference — gathering of ministers, leaders, and five-fold ministry workers for deep doctrinal equipping. 2. Warri City Crusade — major open-air evangelical events bringing the gospel to the streets. 3. Youth Conferences — specifically targeting young people for sound doctrine and consecration. 4. Women's Conference — focused on godly womanhood, marriage, family, and spiritual growth. 5. Prayer Conferences — corporate fasting and intercession events. 6. Online Conferences — live-streamed from Temple TV for global participation. Current major event: Warri City Crusade 2026 (theme: "Be Ready For Rapture: Tribulation Is Coming! Run For Your Soul!"). Visit jctm.org.ng/events for the full events calendar and registration details. All events are open to the public — believers, seekers, and the unchurched are welcome.`,
  },
  {
    source: "jctm-media-outreach",
    content: `JCTM leverages multiple media platforms to fulfill the Correction Mandate globally. Media outreach strategy: 1. Temple TV (YouTube — @TEMPLETVJCTM): Primary broadcast platform. All Sunday services, special teachings, and crusade coverage uploaded regularly. 2. Facebook Live (@templetvjctm): Real-time broadcasts and community engagement. 3. JCTM Digital Sanctuary (jctm.org.ng): Comprehensive website with sermon library, live streaming, AI assistant (TempleBots), devotionals, events, and giving. 4. WhatsApp Ministry Groups: Coordinated through viewing centres for community updates and prayer. 5. Email Newsletter: Devotionals, event announcements, and ministry updates. 6. Physical Crusades: Warri City Crusade and regional outreach meetings for direct gospel impact. JCTM's media philosophy: content must be doctrinally sound, not entertainment-driven; the goal is soul transformation, not audience building for financial gain. TempleBots — the AI ministry assistant — represents JCTM's innovation: making ministry guidance available 24 hours a day, 7 days a week.`,
  },
  {
    source: "sermon-on-the-mount-overview",
    content: `The Sermon on the Mount (Matthew 5-7) is the most comprehensive body of ethical and kingdom teaching from Jesus Christ. It is foundational to JCTM's vision of practical Christian living. Key sections: 1. The Beatitudes (Matthew 5:3-12) — the characteristics of kingdom citizens: poverty of spirit, mourning, meekness, hunger for righteousness, mercy, purity, peacemaking, and willingness to suffer for righteousness. 2. Salt and Light (Matthew 5:13-16) — Christians are called to preserve what is good and illuminate the world. 3. The Higher Righteousness (Matthew 5:17-48) — Jesus intensifies the law, addressing murder, adultery, divorce, oaths, retaliation, and love for enemies. 4. Giving, Prayer, Fasting (Matthew 6:1-18) — all three must be done in secret before God, not for public recognition. 5. Anxiety and Trust (Matthew 6:24-34) — "Seek first the kingdom of God and His righteousness, and all these things shall be added to you." 6. Judgement and the Golden Rule (Matthew 7:1-12). 7. The two builders (Matthew 7:24-27) — only those who hear AND do Jesus' words build on the rock. JCTM emphasizes that the Sermon on the Mount is not aspirational poetry but God's actual standard for Christian living.`,
  },
  {
    source: "jctm-devotionals-prayer-themes",
    content: `JCTM produces daily devotionals available on the Digital Sanctuary (jctm.org.ng/devotion) and by email subscription. The devotionals are scripture-based, doctrinally sound, and practically applicable. Each devotional includes: a key scripture, expository teaching, practical application, and a closing prayer. Email subscription: believers can receive the daily devotional in their inbox every morning — subscribe at jctm.org.ng/devotion. Current devotional themes align with JCTM's annual teaching calendar: Holiness and Consecration, End-Times Readiness, Prayer and Intercession, Sound Doctrine, The Correction Mandate, and Practical Christian Living. JCTM's prayer focus themes for 2026: Revival in the global church, protection of Nigeria from political instability and economic hardship, the salvation of the Niger Delta region, and preparation for the coming rapture. Community members are encouraged to read the devotional, pray through the theme, and share with family members.`,
  },
  {
    source: "baptism-of-holy-spirit-how-to",
    content: `JCTM teaches believers how to receive the baptism of the Holy Spirit — a distinct, post-salvation experience of spiritual empowerment. Steps to receiving Holy Spirit baptism: 1. Be born again first — the Holy Spirit baptism is for believers (Acts 2:38). 2. Hunger and thirst — Luke 11:13: "If you then, being evil, know how to give good gifts to your children, how much more will your heavenly Father give the Holy Spirit to those who ask Him!" 3. Ask in faith — ask God directly in prayer to fill you with His Spirit. 4. Yield your tongue — the evidence is speaking in tongues. You must yield your tongue to the Spirit — He does not force you. 5. Don't analyze or resist — many people receive the Spirit but suppress the tongues by trying to reason it out. 6. Seek prayer with laying on of hands — find a Spirit-filled believer or minister to pray with you (Acts 8:17, Acts 19:6). At JCTM, believers are regularly prayed for to receive the Holy Spirit baptism. Contact info@jctm.org.ng or attend a service at Ebrumede Temple, Warri.`,
  },
  {
    source: "financial-giving-practical",
    content: `How to give to JCTM practically: The Digital Sanctuary provides multiple channels for convenient, secure online giving. 1. Paystack (Nigerian Naira): Visit jctm.org.ng/give and use the Paystack payment gateway — accepts Nigerian debit cards and bank transfers. Ideal for supporters within Nigeria. 2. Stripe (International): For supporters outside Nigeria — accepts Visa, Mastercard, and international debit/credit cards in USD and other currencies. 3. Bank Transfer: Contact info@jctm.org.ng for direct bank account details. What your giving supports: Temple TV production costs and broadcast expenses, Correction Mandate outreach and crusade logistics, the JCTM Digital Sanctuary platform maintenance, pastoral support and ministry operations, supporting missionaries and evangelists in the field. JCTM's financial accountability: The ministry is committed to transparent, accountable use of all funds in direct support of the gospel mission. Receipts available on request.`,
  },
  {
    source: "end-times-signs-current",
    content: `JCTM teaches that the signs of the end times described by Jesus in Matthew 24 are accelerating in our current generation. Current signs (as identified by Prophet Amos): 1. Global moral collapse — 2 Timothy 3:1-5 describes the "last days" as a time of extreme selfishness, pride, and immorality — reflected in the normalization of homosexuality, sexual perversion, and lawlessness. 2. Apostasy in the church — 2 Thessalonians 2:3: "a falling away first." Many churches today openly compromise on homosexuality, prosperity, and moral standards. 3. Wars and rumours of wars — Matthew 24:6. Current global tensions, conflicts, and the threat of nuclear war align with prophecy. 4. Economic instability — the global financial system is building toward a cashless, centralized system that could enable the mark of the beast. 5. Israel's restoration — the existence of modern Israel (1948) is a prophetic sign (Matthew 24:32-34 — the fig tree). 6. The gospel preached to all nations — Matthew 24:14: "This gospel of the kingdom will be preached in all the world as a witness to all nations, and then the end will come." Temple TV is part of this global gospel proclamation.`,
  },
];


// ─── Embedding Helpers ────────────────────────────────────────────────────────

async function generateEmbeddingVector(text: string): Promise<string | null> {
  try {
    const result = await embed(text);
    return `[${result.embedding.join(",")}]`;
  } catch {
    return null;
  }
}

// ─── Version-Stamped Bulk Ingestion ───────────────────────────────────────────

export async function ingestKnowledgeIfEmpty(
  _unused: unknown,
  log: Logger,
): Promise<void> {
  const client = await pool.connect();
  try {
    // Check if the current version stamp exists — if so, skip
    const versionCheck = await client.query<{ count: string }>(
      "SELECT COUNT(*) FROM knowledge_chunks WHERE source = $1",
      [VERSION_SOURCE],
    );
    if (parseInt(versionCheck.rows[0]!.count, 10) > 0) {
      log.info({ version: KNOWLEDGE_VERSION }, "Knowledge base is current — skipping static ingestion");
      return;
    }

    // Delete stale version stamps and re-ingest static knowledge
    await client.query("DELETE FROM knowledge_chunks WHERE source LIKE 'jctm-version-%'");
    await client.query(
      "DELETE FROM knowledge_chunks WHERE source IN (" +
      JCTM_KNOWLEDGE.map(k => `'${k.source}'`).join(",") +
      ")",
    );

    log.info({ version: KNOWLEDGE_VERSION, total: JCTM_KNOWLEDGE.length }, "Populating JCTM knowledge base (local embeddings)...");

    for (let i = 0; i < JCTM_KNOWLEDGE.length; i++) {
      const chunk = JCTM_KNOWLEDGE[i]!;
      const vectorStr = await generateEmbeddingVector(chunk.content);
      await client.query(
        `INSERT INTO knowledge_chunks (content, source, chunk_index, chunk_type, embedding)
         VALUES ($1, $2, $3, 'doctrine', $4)
         ON CONFLICT (source, chunk_index) DO UPDATE
         SET content = EXCLUDED.content, chunk_type = EXCLUDED.chunk_type,
             embedding = EXCLUDED.embedding, updated_at = now()`,
        [chunk.content, chunk.source, i, vectorStr ?? null],
      );
      log.info({ index: i + 1, total: JCTM_KNOWLEDGE.length, source: chunk.source, hasEmbedding: vectorStr !== null }, "Chunk stored");
    }

    // Write version stamp
    await client.query(
      `INSERT INTO knowledge_chunks (content, source, chunk_index, chunk_type, embedding)
       VALUES ($1, $2, 0, 'general', NULL)
       ON CONFLICT (source, chunk_index) DO UPDATE SET content = EXCLUDED.content, updated_at = now()`,
      [`JCTM Knowledge Base version ${KNOWLEDGE_VERSION}`, VERSION_SOURCE],
    );

    const finalCount = await client.query<{ count: string }>("SELECT COUNT(*) FROM knowledge_chunks");
    const embeddedCount = await client.query<{ count: string }>("SELECT COUNT(*) FROM knowledge_chunks WHERE embedding IS NOT NULL");

    log.info(
      { version: KNOWLEDGE_VERSION, total: finalCount.rows[0]!.count, withEmbeddings: embeddedCount.rows[0]!.count },
      "JCTM knowledge base ingestion complete (local embeddings)",
    );
  } catch (err) {
    log.error({ err }, "Knowledge ingestion failed — TempleBots will work without RAG context");
  } finally {
    client.release();
  }
}

// ─── Single Sermon Ingestion ──────────────────────────────────────────────────

export async function ingestSermonSummary(opts: {
  videoId: string;
  title: string;
  summary: string;
  category?: string | null;
  tags?: string[] | null;
  log?: Logger;
}): Promise<void> {
  const { videoId, title, summary, category, tags, log } = opts;
  if (!videoId || !summary) return;

  const source = `sermon-${videoId}`;
  const content = [
    `Sermon: "${title}"`,
    `Category: ${category ?? "teaching"}`,
    tags && tags.length > 0 ? `Tags: ${tags.join(", ")}` : "",
    `Summary: ${summary}`,
    `Watch: https://www.youtube.com/watch?v=${videoId}`,
  ].filter(Boolean).join("\n");

  const client = await pool.connect();
  try {
    const vectorStr = await generateEmbeddingVector(content);
    await client.query(
      `INSERT INTO knowledge_chunks (content, source, chunk_index, chunk_type, embedding)
       VALUES ($1, $2, 0, 'sermon', $3)
       ON CONFLICT (source, chunk_index)
       DO UPDATE SET content = EXCLUDED.content, chunk_type = EXCLUDED.chunk_type,
                     embedding = EXCLUDED.embedding, updated_at = now()`,
      [content, source, vectorStr ?? null],
    );
    log?.info({ videoId, source, hasEmbedding: vectorStr !== null }, "Sermon summary ingested");
  } catch (err) {
    log?.warn({ err, source }, "Sermon knowledge ingestion failed (non-fatal)");
  } finally {
    client.release();
  }
}

// ─── Batch Sermon Ingestion — Learn from ALL Synced Sermons ──────────────────
// Processes every sermon in the sermon_data table and upserts a rich
// knowledge chunk so TempleBots can answer questions about specific sermons.

export async function ingestAllSermons(log?: Logger): Promise<void> {
  const client = await pool.connect();
  try {
    const result = await client.query<{
      video_id: string;
      title: string;
      description: string | null;
      view_count: number | null;
      duration: string | null;
      published_at: string | null;
      category: string | null;
      tags: string[] | null;
      ai_summary: string | null;
    }>(
      `SELECT video_id, title, description, view_count, duration, published_at, category, tags, ai_summary
       FROM sermon_data
       WHERE title IS NOT NULL
       ORDER BY published_at DESC NULLS LAST
       LIMIT 500`,
    );

    const sermons = result.rows;
    if (sermons.length === 0) {
      log?.info("No sermons found in DB — skipping sermon batch ingestion");
      return;
    }

    log?.info({ count: sermons.length }, "Starting batch sermon knowledge ingestion...");

    let ingested = 0;
    let skipped = 0;

    for (const sermon of sermons) {
      const source = `sermon-${sermon.video_id}`;
      const categoryStr = sermon.category ?? "teaching";
      const tagsStr = Array.isArray(sermon.tags) && sermon.tags.length > 0
        ? `Tags: ${sermon.tags.slice(0, 8).join(", ")}`
        : "";
      const viewStr = sermon.view_count ? `Views: ${sermon.view_count.toLocaleString()}` : "";
      const dateStr = sermon.published_at
        ? `Published: ${new Date(sermon.published_at).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}`
        : "";

      // Split long descriptions into two indexed chunks for better RAG coverage
      const fullDesc = sermon.description ? sermon.description.replace(/\n{3,}/g, "\n\n") : "";
      const descPart1 = fullDesc.slice(0, 500);
      const descPart2 = fullDesc.length > 500 ? fullDesc.slice(500, 1200) : "";
      const summaryStr = sermon.ai_summary
        ? `AI Summary: ${sermon.ai_summary.slice(0, 400)}`
        : "";

      const content0 = [
        `Sermon by Prophet Amos Evomobor (JCTM): "${sermon.title}"`,
        `Category: ${categoryStr}`,
        tagsStr,
        viewStr,
        dateStr,
        descPart1 ? `Description: ${descPart1}` : "",
        `Watch on Temple TV: https://www.youtube.com/watch?v=${sermon.video_id}`,
      ].filter(Boolean).join("\n");

      try {
        const vectorStr0 = await generateEmbeddingVector(content0);
        await client.query(
          `INSERT INTO knowledge_chunks (content, source, chunk_index, chunk_type, embedding)
           VALUES ($1, $2, 0, 'sermon', $3)
           ON CONFLICT (source, chunk_index)
           DO UPDATE SET content = EXCLUDED.content, chunk_type = EXCLUDED.chunk_type,
                         embedding = EXCLUDED.embedding, updated_at = now()`,
          [content0, source, vectorStr0 ?? null],
        );
        ingested++;

        // Chunk 1: continuation + AI summary (only for sermons with extra content)
        if (descPart2 || summaryStr) {
          const content1 = [
            `Sermon continued — "${sermon.title}" by Prophet Amos Evomobor (JCTM)`,
            `Watch: https://www.youtube.com/watch?v=${sermon.video_id}`,
            descPart2 ? `Description (continued): ${descPart2}` : "",
            summaryStr,
          ].filter(Boolean).join("\n");

          const vectorStr1 = await generateEmbeddingVector(content1);
          await client.query(
            `INSERT INTO knowledge_chunks (content, source, chunk_index, chunk_type, embedding)
             VALUES ($1, $2, 1, 'sermon', $3)
             ON CONFLICT (source, chunk_index)
             DO UPDATE SET content = EXCLUDED.content, chunk_type = EXCLUDED.chunk_type,
                           embedding = EXCLUDED.embedding, updated_at = now()`,
            [content1, source, vectorStr1 ?? null],
          );
        }
      } catch {
        skipped++;
      }
    }

    log?.info({ ingested, skipped, total: sermons.length }, "Sermon batch knowledge ingestion complete");
  } catch (err) {
    log?.warn({ err }, "Sermon batch ingestion failed (non-fatal)");
  } finally {
    client.release();
  }
}

// ─── Activity Learning — Learn from Website Activities ───────────────────────
// Ingests prayer themes, approved testimonies, published blog posts,
// and upcoming events so TempleBots is aware of real community activity.

export async function ingestActivityLearning(log?: Logger): Promise<void> {
  const client = await pool.connect();
  try {
    log?.info("Starting activity learning ingestion...");

    // 1. Prayer request categories (learn dominant prayer themes)
    try {
      const prayerResult = await client.query<{ category: string; count: string }>(
        `SELECT category, COUNT(*) AS count
         FROM prayer_requests
         WHERE approved = true OR approved IS NULL
         GROUP BY category
         ORDER BY count DESC
         LIMIT 20`,
      );
      if (prayerResult.rows.length > 0) {
        const categories = prayerResult.rows
          .map(r => `${r.category} (${r.count} requests)`)
          .join(", ");
        const content = `JCTM Community Prayer Focus: The JCTM prayer wall reflects the real needs of the community. Current dominant prayer categories: ${categories}. This shows that believers in this community are actively seeking God for these areas. TempleBots should speak to these themes with pastoral sensitivity. Submit prayer requests at jctm.org.ng/prayer — the JCTM prayer team intercedes daily.`;
        const vectorStr = await generateEmbeddingVector(content);
        await client.query(
          `INSERT INTO knowledge_chunks (content, source, chunk_index, chunk_type, embedding)
           VALUES ($1, 'activity-prayer-themes', 0, 'activity', $2)
           ON CONFLICT (source, chunk_index) DO UPDATE SET content = EXCLUDED.content,
             chunk_type = EXCLUDED.chunk_type, embedding = EXCLUDED.embedding, updated_at = now()`,
          [content, vectorStr ?? null],
        );
        log?.info({ categories: prayerResult.rows.length }, "Prayer themes ingested");
      }
    } catch { /* non-fatal */ }

    // 2. Recent approved testimonies (learn what God is doing in the community)
    try {
      const testimoniesResult = await client.query<{
        name: string; title: string; content: string; category: string;
      }>(
        `SELECT name, title, content, category
         FROM testimonies
         WHERE approved = true
         ORDER BY created_at DESC NULLS LAST
         LIMIT 15`,
      );
      if (testimoniesResult.rows.length > 0) {
        const testimonySummaries = testimoniesResult.rows
          .map(t => `• "${t.title}" (${t.category}): ${(t.content ?? "").slice(0, 200)}`)
          .join("\n");
        const content = `JCTM Community Testimonies — What God Is Doing: These are recent verified testimonies from the JCTM community:\n${testimonySummaries}\n\nThese testimonies demonstrate God's active work through JCTM's ministry: salvation, healing, deliverance, financial provision, and answered prayer. Share your testimony at jctm.org.ng/testimonies. As Revelation 12:11 teaches, believers overcome by the blood of the Lamb and the word of their testimony.`;
        const vectorStr = await generateEmbeddingVector(content);
        await client.query(
          `INSERT INTO knowledge_chunks (content, source, chunk_index, chunk_type, embedding)
           VALUES ($1, 'activity-testimonies', 0, 'activity', $2)
           ON CONFLICT (source, chunk_index) DO UPDATE SET content = EXCLUDED.content,
             chunk_type = EXCLUDED.chunk_type, embedding = EXCLUDED.embedding, updated_at = now()`,
          [content, vectorStr ?? null],
        );
        log?.info({ count: testimoniesResult.rows.length }, "Testimonies ingested");
      }
    } catch { /* non-fatal */ }

    // 3. Published blog posts — index + per-article chunks for RAG
    try {
      const blogResult = await client.query<{
        slug: string; title: string; excerpt: string | null; topic: string;
        category: string | null; tags: string[] | null;
      }>(
        `SELECT slug, title, excerpt, topic, category, tags
         FROM blog_posts
         WHERE published = true OR published IS NULL
         ORDER BY generated_at DESC NULLS LAST
         LIMIT 100`,
      );
      if (blogResult.rows.length > 0) {
        // Aggregate index chunk
        const blogSummaries = blogResult.rows
          .map(b => `• "${b.title}" [${b.category ?? b.topic}]: ${(b.excerpt ?? "").slice(0, 160)}`)
          .join("\n");
        const indexContent = `JCTM Blog & Teaching Articles (${blogResult.rows.length} published): ${blogSummaries}\n\nExplore all articles at jctm.org.ng/blog. Topics covered include holiness, salvation, prayer, fasting, testimonies, revival, family, youth, Bible study, and prophetic messages. Each article reflects JCTM's Correction Mandate and Primitive Christianity teaching under Prophet Amos Evomobor.`;
        const indexVector = await generateEmbeddingVector(indexContent);
        await client.query(
          `INSERT INTO knowledge_chunks (content, source, chunk_index, chunk_type, embedding)
           VALUES ($1, 'activity-blog-posts', 0, 'activity', $2)
           ON CONFLICT (source, chunk_index) DO UPDATE SET content = EXCLUDED.content,
             chunk_type = EXCLUDED.chunk_type, embedding = EXCLUDED.embedding, updated_at = now()`,
          [indexContent, indexVector ?? null],
        );

        // Per-article knowledge chunks (up to 80)
        let articleChunks = 0;
        for (const b of blogResult.rows.slice(0, 80)) {
          const articleContent = [
            `JCTM Ministry Article: "${b.title}"`,
            `Category: ${b.category ?? b.topic}`,
            b.tags && b.tags.length > 0 ? `Topics: ${b.tags.join(", ")}` : "",
            b.excerpt ? `Summary: ${b.excerpt}` : "",
            `Read at: https://jctm.org.ng/blog/${b.slug}`,
          ].filter(Boolean).join("\n");
          const articleVector = await generateEmbeddingVector(articleContent);
          await client.query(
            `INSERT INTO knowledge_chunks (content, source, chunk_index, chunk_type, embedding)
             VALUES ($1, $2, 0, 'blog', $3)
             ON CONFLICT (source, chunk_index) DO UPDATE SET content = EXCLUDED.content,
               chunk_type = EXCLUDED.chunk_type, embedding = EXCLUDED.embedding, updated_at = now()`,
            [articleContent, `blog-${b.slug}`, articleVector ?? null],
          );
          articleChunks++;
        }
        log?.info({ total: blogResult.rows.length, articleChunks }, "Blog posts and per-article chunks ingested");
      }
    } catch { /* non-fatal */ }

    // 4. Upcoming events (keep AI current on what's happening)
    try {
      const eventsResult = await client.query<{
        title: string; description: string | null; start_date: string;
        end_date: string | null; location: string | null; event_type: string | null;
      }>(
        `SELECT title, description, start_date, end_date, location, event_type
         FROM event_calendar
         WHERE start_date >= NOW() - INTERVAL '7 days'
         ORDER BY start_date ASC
         LIMIT 10`,
      );
      if (eventsResult.rows.length > 0) {
        const eventSummaries = eventsResult.rows.map(e => {
          const date = new Date(e.start_date).toLocaleDateString("en-GB", {
            weekday: "long", year: "numeric", month: "long", day: "numeric",
          });
          return `• "${e.title}" — ${date}${e.location ? ` at ${e.location}` : ""}${e.description ? `: ${e.description.slice(0, 120)}` : ""}`;
        }).join("\n");
        const content = `JCTM Upcoming Events and Services: Current and upcoming events at Jesus Christ Temple Ministry:\n${eventSummaries}\n\nView the full event calendar at jctm.org.ng/events. Register for specific events at jctm.org.ng. Sunday services are at 8:00 AM – 12:00 PM WAT, Wednesday services at 5:00 PM – 8:00 PM WAT. All services are broadcast live on Temple TV (YouTube @TEMPLETVJCTM).`;
        const vectorStr = await generateEmbeddingVector(content);
        await client.query(
          `INSERT INTO knowledge_chunks (content, source, chunk_index, chunk_type, embedding)
           VALUES ($1, 'activity-events', 0, 'event', $2)
           ON CONFLICT (source, chunk_index) DO UPDATE SET content = EXCLUDED.content,
             chunk_type = EXCLUDED.chunk_type, embedding = EXCLUDED.embedding, updated_at = now()`,
          [content, vectorStr ?? null],
        );
        log?.info({ count: eventsResult.rows.length }, "Events ingested");
      }
    } catch { /* non-fatal */ }

    // 5. AI conversation topics (learn what questions users ask most)
    try {
      const feedbackResult = await client.query<{ query_topic: string; count: string }>(
        `SELECT LEFT(user_message, 80) AS query_topic, COUNT(*) AS count
         FROM ai_feedback
         WHERE rating >= 4 OR rating IS NULL
         GROUP BY LEFT(user_message, 80)
         ORDER BY count DESC
         LIMIT 20`,
      );
      if (feedbackResult.rows.length > 0) {
        const topics = feedbackResult.rows
          .map(r => `• ${r.query_topic}`)
          .join("\n");
        const content = `JCTM Community Questions — Most Frequent Topics: These are the most common topics that believers ask TempleBots about:\n${topics}\n\nThis gives TempleBots insight into the spiritual priorities and questions of the JCTM community. TempleBots should be especially prepared to answer these topics with depth, pastoral care, and scriptural grounding. All answers are grounded in JCTM doctrine under Prophet Amos Evomobor.`;
        const vectorStr = await generateEmbeddingVector(content);
        await client.query(
          `INSERT INTO knowledge_chunks (content, source, chunk_index, chunk_type, embedding)
           VALUES ($1, 'activity-popular-topics', 0, 'activity', $2)
           ON CONFLICT (source, chunk_index) DO UPDATE SET content = EXCLUDED.content,
             chunk_type = EXCLUDED.chunk_type, embedding = EXCLUDED.embedding, updated_at = now()`,
          [content, vectorStr ?? null],
        );
        log?.info({ count: feedbackResult.rows.length }, "Popular topics ingested");
      }
    } catch { /* non-fatal — ai_feedback table may not exist yet */ }

    log?.info("Activity learning ingestion complete");
  } catch (err) {
    log?.warn({ err }, "Activity learning ingestion failed (non-fatal)");
  } finally {
    client.release();
  }
}

// ─── Daily Devotionals Ingestion ─────────────────────────────────────────────
// Indexes the last 45 devotionals (title, scripture, reflection, prayer) so
// TempleBots can answer questions about recent devotionals and point users to
// today's word.

export async function ingestDailyDevotionals(log?: Logger): Promise<void> {
  const client = await pool.connect();
  try {
    const result = await client.query<{
      date: string;
      title: string;
      scripture: string | null;
      reference: string | null;
      reflection: string | null;
      prayer_focus: string | null;
      declaration: string | null;
      prophetic_word: string | null;
    }>(
      `SELECT date, title, scripture, reference, reflection, prayer_focus, declaration, prophetic_word
       FROM daily_devotions
       ORDER BY date DESC
       LIMIT 45`,
    );

    if (result.rows.length === 0) {
      log?.info("No devotionals found — skipping devotional ingestion");
      return;
    }

    // Aggregate index chunk — helps AI know devotionals exist
    const today = result.rows[0]!;
    const todayDate = new Date(today.date).toLocaleDateString("en-GB", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
    const indexContent = [
      `JCTM Daily Devotionals — ${result.rows.length} devotionals available.`,
      `Today's Devotion (${todayDate}): "${today.title}"`,
      today.reference ? `Scripture: ${today.reference}` : "",
      today.scripture ? today.scripture.slice(0, 200) : "",
      today.reflection ? `Reflection: ${today.reflection.slice(0, 300)}` : "",
      today.prayer_focus ? `Prayer Focus: ${today.prayer_focus.slice(0, 150)}` : "",
      today.declaration ? `Declaration: ${today.declaration.slice(0, 150)}` : "",
      `Access daily devotions at jctm.org.ng/devotion. Subscribe by email for daily delivery.`,
    ].filter(Boolean).join("\n");

    const indexVector = await generateEmbeddingVector(indexContent);
    await client.query(
      `INSERT INTO knowledge_chunks (content, source, chunk_index, chunk_type, embedding)
       VALUES ($1, 'activity-devotionals-index', 0, 'devotion', $2)
       ON CONFLICT (source, chunk_index) DO UPDATE SET content = EXCLUDED.content,
         chunk_type = EXCLUDED.chunk_type, embedding = EXCLUDED.embedding, updated_at = now()`,
      [indexContent, indexVector ?? null],
    );

    // Per-devotional chunks for recent devotionals (last 14)
    let ingested = 0;
    for (const devo of result.rows.slice(0, 14)) {
      const dateStr = new Date(devo.date).toLocaleDateString("en-GB", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      });
      const content = [
        `JCTM Daily Devotion — ${dateStr}: "${devo.title}"`,
        devo.reference ? `Scripture: ${devo.reference}` : "",
        devo.scripture ? devo.scripture.slice(0, 300) : "",
        devo.reflection ? `Reflection: ${devo.reflection.slice(0, 400)}` : "",
        devo.prayer_focus ? `Prayer Focus: ${devo.prayer_focus.slice(0, 200)}` : "",
        devo.declaration ? `Declaration: ${devo.declaration.slice(0, 150)}` : "",
        devo.prophetic_word ? `Prophetic Word: ${devo.prophetic_word.slice(0, 150)}` : "",
        `Read full devotion at jctm.org.ng/devotion`,
      ].filter(Boolean).join("\n");

      const vector = await generateEmbeddingVector(content);
      const dateKey = devo.date.slice(0, 10).replace(/-/g, "");
      await client.query(
        `INSERT INTO knowledge_chunks (content, source, chunk_index, chunk_type, embedding)
         VALUES ($1, $2, 0, 'devotion', $3)
         ON CONFLICT (source, chunk_index) DO UPDATE SET content = EXCLUDED.content,
           chunk_type = EXCLUDED.chunk_type, embedding = EXCLUDED.embedding, updated_at = now()`,
        [content, `devotion-${dateKey}`, vector ?? null],
      );
      ingested++;
    }

    log?.info({ total: result.rows.length, ingested }, "Daily devotionals ingested into knowledge base");
  } catch (err) {
    log?.warn({ err }, "Devotionals ingestion failed (non-fatal)");
  } finally {
    client.release();
  }
}

// ─── Ministry FAQs Ingestion ──────────────────────────────────────────────────
// Rich static FAQ knowledge base covering practical questions users ask most.
// Ingested once and updated when the FAQ_VERSION changes.

const FAQ_VERSION = "1.2";

const MINISTRY_FAQS = [
  {
    source: "faq-service-times",
    content: `JCTM Service Times & Schedule:
Sunday Service: 8:00 AM – 12:00 PM WAT (West Africa Time) at Ebrumede Temple, Warri, Delta State.
Wednesday Midweek Service: 5:00 PM – 8:00 PM WAT.
All services are broadcast live on Temple TV YouTube channel (@TEMPLETVJCTM).
Services are also uploaded to YouTube after the live broadcast for on-demand viewing.
Special services (crusades, revivals, conferences) are announced on the website and social media.
Check jctm.org.ng/events for the full event calendar and upcoming special services.`,
  },
  {
    source: "faq-location-directions",
    content: `JCTM Physical Location & Directions:
Jesus Christ Temple Ministry is located at Ebrumede, Ebrumede Roundabout, Effurun, Warri, Delta State, Nigeria.
Landmark: Ebrumede Roundabout, near the Effurun area of Warri.
From Warri town centre: take the Effurun road, pass through the Effurun roundabout, turn towards Ebrumede.
For driving directions: search "Jesus Christ Temple Ministry Ebrumede" on Google Maps.
Contact the church office at info@jctm.org.ng or call for specific directions.
For those outside Nigeria: you can attend services online at jctm.org.ng or YouTube @TEMPLETVJCTM.`,
  },
  {
    source: "faq-membership",
    content: `How to Become a JCTM Member:
1. Attend Sunday services at Ebrumede Temple, Warri or watch online via Temple TV.
2. Receive Jesus Christ as Lord and Saviour if you haven't already.
3. Complete water baptism by full immersion (contact info@jctm.org.ng for baptism dates).
4. Attend the new members/foundation class (announced after services).
5. Register at jctm.org.ng/join or email info@jctm.org.ng with your name, phone, and location.
6. Connect with a home cell or life group in your area.
For online/diaspora members: register on the platform and attend via YouTube live stream.
For youth (13-25): Youth Ministry meets separately — ask at the church or email info@jctm.org.ng.`,
  },
  {
    source: "faq-how-to-give",
    content: `How to Give/Donate to JCTM:
Online giving is available at jctm.org.ng/give.
Payment options:
- Paystack: Naira (NGN) payments for Nigeria-based givers — cards, bank transfer, USSD
- Stripe: USD and international currency for diaspora and global givers
Direct bank transfer: contact info@jctm.org.ng for JCTM bank account details.
What your giving supports: Temple TV productions, global Correction Mandate outreach, church operations, crusades, and community ministry.
JCTM's giving teaching: Giving is an act of worship and partnership (not a prosperity formula). Tithes (10%) and freewill offerings are biblical principles from Malachi 3:10 and 2 Corinthians 9:7. All giving is voluntary and from a heart of love.`,
  },
  {
    source: "faq-prayer-requests",
    content: `How to Submit a Prayer Request to JCTM:
Visit jctm.org.ng/prayer to submit your prayer request online.
Or email your prayer request to info@jctm.org.ng with "Prayer Request" in the subject line.
The JCTM prayer team prays over all submitted requests.
Types of prayer available: healing, salvation for family members, deliverance, financial breakthrough, marriage, children, career/purpose, spiritual growth, and restoration.
Corporate prayer happens at every service. You can also request personal prayer ministry by contacting the church office.
Remember: You can be direct with God about your need. Bring your request to God first (Philippians 4:6-7), then seek the support of the JCTM prayer community.`,
  },
  {
    source: "faq-testimonies",
    content: `How to Share Your Testimony at JCTM:
Visit jctm.org.ng/testimonies to submit your testimony online.
Testimony categories include: salvation, healing, deliverance, financial breakthrough, answered prayer, family restoration, and marriage miracles.
You can also email your testimony to info@jctm.org.ng.
Approved testimonies are shared on the website to encourage the global JCTM community.
Why share: Revelation 12:11 says believers overcome "by the blood of the Lamb and the word of their testimony." Your story releases faith for others.
Selected testimonies may be featured in JCTM broadcasts on Temple TV.`,
  },
  {
    source: "faq-contact",
    content: `How to Contact Jesus Christ Temple Ministry (JCTM):
Email (general inquiries): info@jctm.org.ng
Physical address: Ebrumede Temple, Warri, Delta State, Nigeria
YouTube: Temple TV @TEMPLETVJCTM — https://www.youtube.com/channel/UCPFFvkE-KGpR37qJgvYriJg
Facebook: @templetvjctm — https://www.facebook.com/templetvjctm
Website: jctm.org.ng
For pastoral counselling: email info@jctm.org.ng with "Pastoral Counselling Request"
For media inquiries about Temple TV: email info@jctm.org.ng with "Media Inquiry"
For evangelism partnerships or ministry invitations: email info@jctm.org.ng
Response time is typically within 1-3 business days.`,
  },
  {
    source: "faq-viewing-centres",
    content: `JCTM Viewing Centres — For Those Outside Warri:
JCTM has viewing centres and affiliate congregations in several states across Nigeria and in the diaspora.
To find a viewing centre near you: email info@jctm.org.ng with your city/state and request to join a viewing centre.
If there is no centre in your area: you can start one! Contact info@jctm.org.ng for guidelines on starting an official JCTM viewing centre.
Online community: join the JCTM Digital Sanctuary at jctm.org.ng for sermons, devotions, events, testimonies, and live streams — accessible from any country.
Diaspora members can participate fully online and give through jctm.org.ng/give (Stripe for international payments).`,
  },
  {
    source: "faq-temple-tv-youtube",
    content: `Temple TV — JCTM's YouTube Channel:
Channel: Temple TV @TEMPLETVJCTM
URL: https://www.youtube.com/channel/UCPFFvkE-KGpR37qJgvYriJg
Content published: live Sunday services, midweek teachings, prophetic messages, doctrinal lectures, sermon series, crusade coverage, youth teachings, and testimonies.
Subscribers can set notifications to never miss a live stream.
Archive: hundreds of sermons on topics including Correction Mandate, Primitive Christianity, holiness, end times, healing, Holy Spirit baptism, fasting, marriage, and more.
Live streams: Sunday mornings and special events broadcast live.
Subscribe and click the bell icon to receive notifications for upcoming live streams.
Watch on jctm.org.ng/sermons for a curated, searchable sermon library with the latest uploads.`,
  },
  {
    source: "faq-conference-registration",
    content: `JCTM Conference & Event Registration:
JCTM holds an annual Ministers' Conference and other special events throughout the year.
To register: visit jctm.org.ng/conference-registration or jctm.org.ng/events.
Registration is usually free for in-person attendance; some online events may require registration for access links.
Ministers' Conference: a multi-day intensive gathering for ministers, church leaders, and serious believers. Topics focus on the Correction Mandate, prophetic ministry, sound doctrine, and apostolic leadership.
Conference emails with updates are sent to registered attendees.
For accommodation and travel information for out-of-town attendees: email info@jctm.org.ng.`,
  },
  {
    source: "faq-discipleship-bible-study",
    content: `JCTM Discipleship & Bible Study Resources:
Weekly Bible study is integrated into the midweek service (Wednesday 5-8 PM WAT).
Daily devotionals are available at jctm.org.ng/devotion — a new devotion is published every day.
Subscribe to email devotions: visit jctm.org.ng/devotion and enter your email for daily delivery.
Blog and teaching articles: jctm.org.ng/blog — covers holiness, sound doctrine, prayer, fasting, marriage, youth, and spiritual warfare.
Temple TV YouTube playlist: subscribe to @TEMPLETVJCTM for topical sermon series.
Recommended study order for new believers: John → Acts → Romans → Ephesians → then systematic topics.
For personal discipleship mentoring: email info@jctm.org.ng.`,
  },
  {
    source: "faq-water-baptism-schedule",
    content: `Water Baptism at JCTM:
JCTM practices water baptism by full immersion (the biblical mode — Greek "baptizo" = to immerse).
Baptism is for adult believers who have consciously received Jesus Christ as Lord and Saviour.
Baptism dates are announced during Sunday services and on the website.
To schedule your baptism: attend a Sunday service and speak to an usher or church leader, or email info@jctm.org.ng with "Baptism Request".
Pre-baptism counselling is available — you will receive teaching on the meaning and significance of baptism.
JCTM stands against infant baptism as a doctrinal error (you cannot be baptized on behalf of an unconscious infant; faith is personal and conscious).`,
  },
];

export async function ingestMinistryFAQs(log?: Logger): Promise<void> {
  const client = await pool.connect();
  try {
    // Check if FAQ version is current
    const versionCheck = await client.query<{ count: string }>(
      `SELECT COUNT(*) FROM knowledge_chunks WHERE source = $1`,
      [`faq-version-${FAQ_VERSION}`],
    );
    if (parseInt(versionCheck.rows[0]!.count, 10) > 0) {
      log?.info({ version: FAQ_VERSION }, "Ministry FAQs are current — skipping");
      return;
    }

    // Remove old FAQ version stamps
    await client.query(`DELETE FROM knowledge_chunks WHERE source LIKE 'faq-version-%'`);
    // Remove old FAQ chunks
    await client.query(
      `DELETE FROM knowledge_chunks WHERE source IN (${MINISTRY_FAQS.map(f => `'${f.source}'`).join(",")})`,
    );

    log?.info({ count: MINISTRY_FAQS.length, version: FAQ_VERSION }, "Ingesting ministry FAQ knowledge base");
    let ingested = 0;
    for (const faq of MINISTRY_FAQS) {
      const vector = await generateEmbeddingVector(faq.content);
      await client.query(
        `INSERT INTO knowledge_chunks (content, source, chunk_index, chunk_type, embedding)
         VALUES ($1, $2, 0, 'faq', $3)
         ON CONFLICT (source, chunk_index) DO UPDATE SET content = EXCLUDED.content,
           chunk_type = EXCLUDED.chunk_type, embedding = EXCLUDED.embedding, updated_at = now()`,
        [faq.content, faq.source, vector ?? null],
      );
      ingested++;
    }

    // Write FAQ version stamp
    await client.query(
      `INSERT INTO knowledge_chunks (content, source, chunk_index, chunk_type, embedding)
       VALUES ($1, $2, 0, 'general', NULL)
       ON CONFLICT (source, chunk_index) DO UPDATE SET content = EXCLUDED.content, updated_at = now()`,
      [`Ministry FAQ Knowledge Base version ${FAQ_VERSION}`, `faq-version-${FAQ_VERSION}`],
    );

    log?.info({ ingested, version: FAQ_VERSION }, "Ministry FAQs ingestion complete");
  } catch (err) {
    log?.warn({ err }, "Ministry FAQ ingestion failed (non-fatal)");
  } finally {
    client.release();
  }
}

// ─── Ministry Shorts / Ministry Moments Ingestion ─────────────────────────────
// Indexes the Ministry Moments (short videos ≤30 min) so TempleBots can
// reference and recommend short teaching clips.

export async function ingestMinistryShorts(log?: Logger): Promise<void> {
  const client = await pool.connect();
  try {
    // Ministry Moments: typically shorter sermons, stored in sermon_data
    const result = await client.query<{
      video_id: string;
      title: string;
      description: string | null;
      published_at: string | null;
      duration: string | null;
      view_count: number | null;
    }>(
      `SELECT video_id, title, description, published_at, duration, view_count
       FROM sermon_data
       WHERE duration IS NOT NULL
         AND (
           -- ISO 8601 durations ≤ 30 min: PT1M ... PT30M (no hours component)
           duration ~ '^PT([1-9]|[1-2][0-9]|30)M' OR
           duration NOT LIKE '%H%' AND duration != 'P0D'
         )
       ORDER BY published_at DESC NULLS LAST
       LIMIT 50`,
    );

    if (result.rows.length === 0) {
      log?.info("No ministry shorts found — skipping");
      return;
    }

    // Aggregate index chunk
    const summaries = result.rows.slice(0, 20).map(s =>
      `• "${s.title}"${s.view_count ? ` (${s.view_count.toLocaleString()} views)` : ""} → https://youtube.com/watch?v=${s.video_id}`,
    ).join("\n");
    const indexContent = `JCTM Ministry Moments — Short Teaching Clips (${result.rows.length} available):\n${summaries}\n\nMinistry Moments are short, focused teachings by Prophet Amos Evomobor on specific biblical topics. Watch at jctm.org.ng/sermons or YouTube @TEMPLETVJCTM.`;

    const indexVector = await generateEmbeddingVector(indexContent);
    await client.query(
      `INSERT INTO knowledge_chunks (content, source, chunk_index, chunk_type, embedding)
       VALUES ($1, 'activity-ministry-shorts', 0, 'activity', $2)
       ON CONFLICT (source, chunk_index) DO UPDATE SET content = EXCLUDED.content,
         chunk_type = EXCLUDED.chunk_type, embedding = EXCLUDED.embedding, updated_at = now()`,
      [indexContent, indexVector ?? null],
    );

    log?.info({ count: result.rows.length }, "Ministry Shorts ingested");
  } catch (err) {
    log?.warn({ err }, "Ministry Shorts ingestion failed (non-fatal)");
  } finally {
    client.release();
  }
}

// ─── Live Stream Context Ingestion ───────────────────────────────────────────
// Injects the current broadcast/rebroadcast/live state into the knowledge base
// so TempleBots can tell users whether a service is live right now.

export async function ingestLiveStreamContext(log?: Logger): Promise<void> {
  const client = await pool.connect();
  try {
    // Check for manual override state first
    const overrideResult = await client.query<{
      is_live: boolean | null;
      livestream_url: string | null;
      title: string | null;
      updated_at: string | null;
    }>(
      `SELECT is_live, livestream_url, title, updated_at
       FROM livestream_override_state
       ORDER BY id DESC LIMIT 1`,
    );

    // Check for the latest sermon for rebroadcast state
    const latestSermon = await client.query<{
      video_id: string;
      title: string;
      published_at: string | null;
    }>(
      `SELECT video_id, title, published_at
       FROM sermon_data
       WHERE is_live = false OR is_live IS NULL
       ORDER BY published_at DESC NULLS LAST
       LIMIT 1`,
    );

    const override = overrideResult.rows[0];
    const latest = latestSermon.rows[0];

    let statusText: string;
    if (override?.is_live) {
      statusText = `JCTM is CURRENTLY LIVE on Temple TV. ${override.title ? `Current stream: "${override.title}". ` : ""}Watch at: ${override.livestream_url ?? "https://youtube.com/@TEMPLETVJCTM"}`;
    } else {
      // Determine if we're in a rebroadcast window (within 4 days of last Sunday service)
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu
      const isRebroadcastWindow = dayOfWeek >= 0 && dayOfWeek <= 4;

      if (isRebroadcastWindow && latest) {
        const latestDate = latest.published_at ? new Date(latest.published_at).toLocaleDateString("en-GB", {
          weekday: "long", day: "numeric", month: "long",
        }) : "recently";
        statusText = `JCTM Temple TV is currently in REBROADCAST mode. The latest service — "${latest.title}" (${latestDate}) — is streaming on loop. Watch at: https://youtube.com/watch?v=${latest.video_id}. Next live Sunday service: ${dayOfWeek === 0 ? "TODAY at 8 AM WAT" : `Sunday at 8 AM WAT (${7 - dayOfWeek} days away)`}.`;
      } else {
        statusText = `JCTM Temple TV is not currently live. Next live service: Sunday at 8:00 AM WAT from Ebrumede Temple, Warri. Watch on YouTube @TEMPLETVJCTM or jctm.org.ng/sermons.${latest ? ` Latest sermon available: "${latest.title}".` : ""}`;
      }
    }

    const content = `JCTM Live Stream Status (real-time): ${statusText} JCTM broadcasts every Sunday 8 AM - 12 PM WAT and Wednesday 5-8 PM WAT. Live streams run on Temple TV YouTube (@TEMPLETVJCTM). Visit jctm.org.ng/sermons for the full sermon library.`;
    const vector = await generateEmbeddingVector(content);

    await client.query(
      `INSERT INTO knowledge_chunks (content, source, chunk_index, chunk_type, embedding)
       VALUES ($1, 'activity-livestream-status', 0, 'activity', $2)
       ON CONFLICT (source, chunk_index) DO UPDATE SET content = EXCLUDED.content,
         chunk_type = EXCLUDED.chunk_type, embedding = EXCLUDED.embedding, updated_at = now()`,
      [content, vector ?? null],
    );

    log?.info("Live stream context ingested");
  } catch (err) {
    log?.warn({ err }, "Live stream context ingestion failed (non-fatal)");
  } finally {
    client.release();
  }
}

// ─── Conference & Event Promotions Ingestion ──────────────────────────────────
// Ingests active event promotions and conference registration data so TempleBots
// is aware of upcoming campaigns and can encourage sign-ups.

export async function ingestConferenceData(log?: Logger): Promise<void> {
  const client = await pool.connect();
  try {
    // Active event promotions
    const promotions = await client.query<{
      title: string;
      subtitle: string | null;
      description: string | null;
      event_date: string | null;
      cta_text: string | null;
      event_type: string | null;
    }>(
      `SELECT title, subtitle, description, event_date, cta_text, event_type
       FROM event_promotions
       WHERE is_active = true
         AND (event_date IS NULL OR event_date >= NOW() - INTERVAL '7 days')
       ORDER BY event_date ASC
       LIMIT 5`,
    );

    // Conference registration counts (for major conferences)
    const registrations = await client.query<{ event_name: string; count: string }>(
      `SELECT event_name, COUNT(*) AS count
       FROM conference_registrations
       WHERE created_at >= NOW() - INTERVAL '90 days'
       GROUP BY event_name
       ORDER BY count DESC
       LIMIT 5`,
    );

    const parts: string[] = [];

    if (promotions.rows.length > 0) {
      const promoList = promotions.rows.map(p => {
        const date = p.event_date
          ? new Date(p.event_date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
          : "upcoming";
        return `• ${p.title}${p.subtitle ? ` — ${p.subtitle}` : ""} (${date})${p.description ? `: ${p.description.slice(0, 120)}` : ""}`;
      }).join("\n");
      parts.push(`Active JCTM Events & Promotions:\n${promoList}`);
    }

    if (registrations.rows.length > 0) {
      const regList = registrations.rows.map(r =>
        `• ${r.event_name}: ${r.count} registered`,
      ).join("\n");
      parts.push(`Conference Registration Interest:\n${regList}`);
    }

    if (parts.length === 0) {
      log?.info("No active promotions or recent registrations — skipping conference ingestion");
      return;
    }

    const content = `JCTM Conference & Events Intelligence:\n${parts.join("\n\n")}\n\nRegister at jctm.org.ng/conference-registration or visit jctm.org.ng/events. Contact info@jctm.org.ng for more information about any JCTM event.`;
    const vector = await generateEmbeddingVector(content);

    await client.query(
      `INSERT INTO knowledge_chunks (content, source, chunk_index, chunk_type, embedding)
       VALUES ($1, 'activity-conferences', 0, 'event', $2)
       ON CONFLICT (source, chunk_index) DO UPDATE SET content = EXCLUDED.content,
         chunk_type = EXCLUDED.chunk_type, embedding = EXCLUDED.embedding, updated_at = now()`,
      [content, vector ?? null],
    );

    log?.info({ promotions: promotions.rows.length, registrations: registrations.rows.length }, "Conference data ingested");
  } catch (err) {
    log?.warn({ err }, "Conference data ingestion failed (non-fatal)");
  } finally {
    client.release();
  }
}

// ─── Full Content Sync ─────────────────────────────────────────────────────────
// Orchestrates a complete re-ingestion of all content types in the correct order.
// Safe to call at any time — all operations are idempotent upserts.

// ─── Ingest Testimonies ────────────────────────────────────────────────────────
// Pulls approved community testimonies and encodes them as knowledge chunks.
// These help TempleBots answer questions about what God is doing at JCTM and
// encourage users who are seeking testimonies of healing, salvation, provision.

export async function ingestTestimonies(log?: Logger): Promise<void> {
  const client = await pool.connect();
  try {
    const result = await client.query<{
      id: number;
      title: string;
      content: string;
      category: string;
      author_name: string | null;
      created_at: string;
    }>(
      `SELECT id, title, content, category, author_name, created_at
       FROM testimonies
       WHERE approved = true AND content IS NOT NULL AND length(content) > 50
       ORDER BY created_at DESC LIMIT 40`,
    );

    if (result.rows.length === 0) {
      log?.info("No approved testimonies found — skipping testimony ingestion");
      return;
    }

    let upserted = 0;
    for (const row of result.rows) {
      const dateStr = new Date(row.created_at).toLocaleDateString("en-GB", {
        day: "numeric", month: "long", year: "numeric",
      });
      const author = row.author_name ? ` shared by ${row.author_name}` : "";
      const chunkContent = `JCTM Community Testimony [${row.category}]${author} (${dateStr}):\n"${row.title}"\n${row.content.slice(0, 600)}`;
      const vector = await generateEmbeddingVector(chunkContent);
      const source = `testimony-${row.id}`;

      await client.query(
        `INSERT INTO knowledge_chunks (content, source, chunk_index, chunk_type, embedding)
         VALUES ($1, $2, 0, 'testimony', $3)
         ON CONFLICT (source, chunk_index) DO UPDATE
           SET content = EXCLUDED.content, embedding = EXCLUDED.embedding, updated_at = now()`,
        [chunkContent, source, vector ?? null],
      );
      upserted++;
    }

    log?.info({ upserted, total: result.rows.length }, "Community testimonies ingested into knowledge base");
  } catch (err) {
    log?.warn({ err }, "Testimony ingestion failed (non-fatal)");
  } finally {
    client.release();
  }
}

// ─── Ingest Blog Posts ────────────────────────────────────────────────────────
// Pulls published blog posts (Ministry Moments / articles) into the RAG index.

export async function ingestBlogPosts(log?: Logger): Promise<void> {
  const client = await pool.connect();
  try {
    const result = await client.query<{
      id: number;
      title: string;
      content: string;
      excerpt: string | null;
      category: string | null;
      author: string | null;
      published_at: string | null;
    }>(
      `SELECT id, title, content, excerpt, category, author, published_at
       FROM blog_posts
       WHERE published = true AND content IS NOT NULL AND length(content) > 100
       ORDER BY published_at DESC NULLS LAST LIMIT 30`,
    );

    if (result.rows.length === 0) {
      log?.info("No published blog posts found — skipping blog ingestion");
      return;
    }

    let upserted = 0;
    for (const row of result.rows) {
      const dateStr = row.published_at
        ? new Date(row.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
        : "recent";
      const author = row.author ? ` by ${row.author}` : "";
      const category = row.category ? ` [${row.category}]` : "";
      const body = row.excerpt ?? row.content.slice(0, 500);
      const chunkContent = `JCTM Ministry Article${category}${author} (${dateStr}):\n"${row.title}"\n${body}`;
      const vector = await generateEmbeddingVector(chunkContent);
      const source = `blog-${row.id}`;

      await client.query(
        `INSERT INTO knowledge_chunks (content, source, chunk_index, chunk_type, embedding)
         VALUES ($1, $2, 0, 'blog', $3)
         ON CONFLICT (source, chunk_index) DO UPDATE
           SET content = EXCLUDED.content, embedding = EXCLUDED.embedding, updated_at = now()`,
        [chunkContent, source, vector ?? null],
      );
      upserted++;
    }

    log?.info({ upserted, total: result.rows.length }, "Blog posts ingested into knowledge base");
  } catch (err) {
    log?.warn({ err }, "Blog post ingestion failed (non-fatal)");
  } finally {
    client.release();
  }
}

// ─── Full Content Sync ─────────────────────────────────────────────────────────
// Orchestrates a complete re-ingestion of all content types in the correct order.
// Safe to call at any time — all operations are idempotent upserts.

export async function runFullContentSync(log?: Logger): Promise<{
  sermons: boolean;
  activity: boolean;
  devotionals: boolean;
  faqs: boolean;
  shorts: boolean;
  livestream: boolean;
  conferences: boolean;
  testimonies: boolean;
  blogPosts: boolean;
}> {
  const results = {
    sermons: false, activity: false, devotionals: false,
    faqs: false, shorts: false, livestream: false, conferences: false,
    testimonies: false, blogPosts: false,
  };
  log?.info("Starting full AI knowledge content sync (v4 — 9 content types)...");
  const t0 = Date.now();

  await Promise.allSettled([
    ingestAllSermons(log).then(() => { results.sermons = true; }),
    ingestActivityLearning(log).then(() => { results.activity = true; }),
    ingestDailyDevotionals(log).then(() => { results.devotionals = true; }),
    ingestMinistryFAQs(log).then(() => { results.faqs = true; }),
    ingestMinistryShorts(log).then(() => { results.shorts = true; }),
    ingestLiveStreamContext(log).then(() => { results.livestream = true; }),
    ingestConferenceData(log).then(() => { results.conferences = true; }),
    ingestTestimonies(log).then(() => { results.testimonies = true; }),
    ingestBlogPosts(log).then(() => { results.blogPosts = true; }),
  ]);

  log?.info({ ...results, durationMs: Date.now() - t0 }, "Full AI knowledge content sync v4 complete");
  return results;
}

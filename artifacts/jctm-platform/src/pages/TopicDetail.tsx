import { useParams, Link } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, BookOpen, ChevronRight, ExternalLink, ArrowLeft, MessageCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { TOPICS } from "./Topics";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── Rich topic content ───────────────────────────────────────────────────────
const TOPIC_CONTENT: Record<string, {
  intro: string;
  sections: { heading: string; body: string }[];
  scriptures: { ref: string; text: string }[];
  faqs: { q: string; a: string }[];
  searchKeyword: string;
}> = {
  holiness: {
    searchKeyword: "holiness",
    intro: "Of all the doctrines that Jesus Christ Temple Ministry (JCTM) stands upon, holiness is the most foundational. It is not a suggestion, a preference, or a cultural add-on to the Christian faith — it is a divine requirement. Scripture declares: \"Without holiness, no man shall see the Lord\" (Hebrews 12:14). This is not metaphorical. It is a spiritual law as immovable as gravity.",
    sections: [
      {
        heading: "What Is Holiness?",
        body: "Holiness, as JCTM teaches, is the state of being set apart — consecrated to God and separated from the world, the flesh, and sin. It encompasses purity of heart, righteousness of conduct, and total submission to the will of God. It is not merely external — it begins internally, in the regeneration of the spirit, and works its way outward into every area of life: dress, speech, relationships, finances, and character. True holiness is not legalism; it is the natural fruit of genuine salvation and the indwelling of the Holy Spirit."
      },
      {
        heading: "Why JCTM Emphasises Holiness",
        body: "In a generation where the church has largely abandoned the standard of holiness — tolerating worldliness, immorality, and compromise in the name of grace — JCTM stands as a prophetic voice calling believers back to God's original standard. The Correction Mandate entrusted to Prophet Amos Evomobor specifically includes the restoration of holiness as a central pillar of authentic Christianity. JCTM does not preach holiness to be harsh or exclusive; it preaches holiness because eternity is real, judgement is certain, and the narrow path is the only path that leads to life (Matthew 7:14)."
      },
      {
        heading: "Holiness in Daily Life",
        body: "JCTM teaches that holiness must be practical. It means abstaining from fornication, immorality, and all sexual sin (1 Thessalonians 4:3-4). It means guarding the tongue from filth, deception, and ungodly speech (James 3:6-10). It means dressing modestly, honouring the body as a temple of the Holy Spirit (1 Corinthians 6:19-20). It means separating from worldly entertainment, ungodly friendships, and environments that defile the conscience. This is not performance — this is the lifestyle of those who have truly encountered the living God."
      },
      {
        heading: "The Reward of Holiness",
        body: "Those who pursue holiness will see God — both now, through intimate fellowship with Him, and in eternity. The holy life is not a life of deprivation; it is a life of divine favour, supernatural protection, and deep spiritual authority. JCTM's testimony over decades is that believers who walk in genuine holiness experience the reality of God in ways that worldly Christians never do: answered prayer, divine guidance, miraculous provision, and unshakeable peace."
      }
    ],
    scriptures: [
      { ref: "Hebrews 12:14", text: "Pursue peace with all people, and holiness, without which no one will see the Lord." },
      { ref: "1 Peter 1:15-16", text: "But as He who called you is holy, you also be holy in all your conduct, because it is written, 'Be holy, for I am holy.'" },
      { ref: "1 Thessalonians 4:7", text: "For God did not call us to uncleanness, but in holiness." },
      { ref: "2 Corinthians 7:1", text: "Having these promises, beloved, let us cleanse ourselves from all filthiness of the flesh and spirit, perfecting holiness in the fear of God." },
    ],
    faqs: [
      { q: "What does JCTM teach about holiness?", a: "JCTM teaches that holiness is a divine requirement for seeing God — not optional or cultural, but foundational to authentic Christianity. It encompasses purity of heart, righteousness of conduct, and separation from worldliness, grounded in Hebrews 12:14." },
      { q: "Is holiness the same as legalism?", a: "No. JCTM distinguishes holiness from legalism. True holiness is the fruit of genuine salvation and the Holy Spirit's work in a believer's life. Legalism is external rule-keeping without heart transformation. JCTM preaches holiness from the inside out — heart, motive, and conduct." },
      { q: "How do I live a holy life according to JCTM?", a: "JCTM teaches practical holiness: abstaining from sexual immorality, guarding your speech, dressing modestly, avoiding worldly entertainment that defiles the conscience, and building a prayer and Word-based life that keeps you close to God." },
    ]
  },
  "correction-mandate": {
    searchKeyword: "correction mandate",
    intro: "The Correction Mandate is at the heart of everything Jesus Christ Temple Ministry (JCTM) does. It is not a programme, a strategy, or a theological preference — it is a divine assignment given by God to Prophet Amos Evomobor to expose and correct five major doctrinal errors that have infiltrated and damaged the global Body of Christ. Grounded in Jeremiah 6:16 — \"Stand in the ways and see, and ask for the old paths, where the good way is, and walk in it\" — this mandate is JCTM's prophetic reason for existence.",
    sections: [
      {
        heading: "The Five Errors Being Corrected",
        body: "JCTM identifies five specific areas of doctrinal corruption in the modern church: (1) The Prosperity Gospel — the false teaching that financial wealth is always God's will for every believer, which exploits faith for financial gain and distorts Scripture; (2) Prophetic Manipulation — false prophets who exploit spiritual gifts for control, money, and personal enrichment, misleading millions; (3) Apostolic Abuse — people falsely claiming the office of apostle without genuine divine calling or evidential fruit; (4) Sacramental Corruption — distorting the true meaning and mode of water baptism and Holy Communion from their New Testament forms; and (5) Dangerous Ecumenism — blending Christianity with error and false religions under the guise of unity, at the expense of truth."
      },
      {
        heading: "Why Correction Is Necessary",
        body: "JCTM teaches that doctrinal error is not a minor matter — it has eternal consequences. Millions of souls are being led to a false Christianity that cannot save, cannot sanctify, and will not stand in the day of judgment. The Correction Mandate is therefore an act of love, not criticism. Just as a physician who diagnoses a disease is not the enemy of the patient, JCTM's correction of false doctrine is not an attack on individuals but a prophetic service to the Body of Christ. 'My people are destroyed for lack of knowledge' (Hosea 4:6) — JCTM's mandate is to restore that knowledge."
      },
      {
        heading: "The Mandate's Global Reach",
        body: "Through Temple TV on YouTube, the Correction Mandate has reached believers in over 40 nations. Thousands of pastors, ministers, and ordinary Christians have been transformed — leaving false churches, rebuilding their doctrine on biblical foundations, and discovering the original apostolic Christianity that the first-century church practised. JCTM does not seek to build a mega-church empire; it seeks to restore the global church to God's original standard."
      }
    ],
    scriptures: [
      { ref: "Jeremiah 6:16", text: "Stand in the ways and see, and ask for the old paths, where the good way is, and walk in it; then you will find rest for your souls." },
      { ref: "Hosea 4:6", text: "My people are destroyed for lack of knowledge. Because you have rejected knowledge, I also will reject you." },
      { ref: "2 Timothy 4:2-3", text: "Preach the word! Be ready in season and out of season. Convince, rebuke, exhort, with all longsuffering and teaching. For the time will come when they will not endure sound doctrine." },
      { ref: "Titus 1:9", text: "Holding fast the faithful word as he has been taught, that he may be able, by sound doctrine, both to exhort and convict those who contradict." },
    ],
    faqs: [
      { q: "What is the Correction Mandate of JCTM?", a: "The Correction Mandate is the divine assignment given to Jesus Christ Temple Ministry (JCTM) to identify and correct five major doctrinal errors in the church: Prosperity Gospel, Prophetic Manipulation, Apostolic Abuse, Sacramental Corruption, and Dangerous Ecumenism." },
      { q: "Is JCTM against other churches?", a: "No. JCTM is not against churches or individuals — it is against false doctrine. The Correction Mandate is an act of love, like a doctor diagnosing disease. JCTM's goal is restoration, not division." },
      { q: "What is the scriptural basis of the Correction Mandate?", a: "Jeremiah 6:16 is the cornerstone: 'Ask for the old paths, where the good way is.' Additional foundations include 2 Timothy 4:2-3 (preach the word, correct and rebuke) and Hosea 4:6 (people destroyed for lack of knowledge)." },
    ]
  },
  "primitive-christianity": {
    searchKeyword: "primitive christianity",
    intro: "Primitive Christianity — the original, unadulterated faith of the first-century apostolic church — is the model that Jesus Christ Temple Ministry (JCTM) holds as the standard for all Christian belief and practice. \"Contend earnestly for the faith which was once for all delivered to the saints\" (Jude 1:3). JCTM's thesis is simple: what the apostles established in the first century is what the church must return to today.",
    sections: [
      {
        heading: "What Is Primitive Christianity?",
        body: "Primitive Christianity refers to the Christianity of the New Testament — the faith as practised by Christ's apostles and the early church in the Book of Acts. It is characterised by: apostolic doctrine (Acts 2:42); genuine repentance and new birth; water baptism by immersion; the gifts of the Holy Spirit as God wills; communal prayer and worship; holy living separated from the world; and sound eschatology rooted in the imminent return of Christ. It stands in sharp contrast to the watered-down, entertainment-driven, money-focused version of Christianity that dominates the world today."
      },
      {
        heading: "What JCTM Restores",
        body: "JCTM's Correction Mandate is fundamentally a call to Primitive Christianity. Every error it corrects — the Prosperity Gospel, prophetic manipulation, apostolic abuse, sacramental corruption, ecumenism — is a deviation from the original faith. By exposing these errors and pointing people back to the New Testament standard, JCTM is restoring Primitive Christianity to a generation that has never seen it. This is not nostalgia; this is obedience to the command to contend for the faith once delivered."
      },
      {
        heading: "The Power of the Original Faith",
        body: "The first-century church turned the world upside down without megachurches, celebrity pastors, or prosperity theology. They had the Holy Spirit, the Word of God, genuine holiness, and uncompromising apostolic doctrine. JCTM's testimony is that this same power is available today to churches and believers who return to these original foundations. Testimonies of healing, deliverance, and transformation among JCTM's congregation confirm what the Word promises: the power of God flows where the truth of God is preached without compromise."
      }
    ],
    scriptures: [
      { ref: "Jude 1:3", text: "Beloved, while I was very diligent to write to you concerning our common salvation, I found it necessary to write to you exhorting you to contend earnestly for the faith which was once for all delivered to the saints." },
      { ref: "Acts 2:42", text: "And they continued steadfastly in the apostles' doctrine and fellowship, in the breaking of bread, and in prayers." },
      { ref: "Galatians 1:8", text: "But even if we, or an angel from heaven, preach any other gospel to you than what we have preached to you, let him be accursed." },
    ],
    faqs: [
      { q: "What does JCTM mean by Primitive Christianity?", a: "Primitive Christianity refers to the original apostolic faith of the first-century church — holy in practice, sound in doctrine (Acts 2:42), and powerful in manifestation. JCTM calls believers back to this standard, away from modern innovations and false teachings." },
      { q: "How is Primitive Christianity different from modern Christianity?", a: "Modern Christianity is largely shaped by traditions of men, commercial influences, and cultural compromise. Primitive Christianity is shaped exclusively by the New Testament — apostolic doctrine, genuine holiness, water baptism, the gifts of the Spirit, and readiness for Christ's return." },
    ]
  },
  "healing-miracles": {
    searchKeyword: "healing miracles",
    intro: "Jesus Christ healed the sick, raised the dead, and cast out demons — and He declared: \"He who believes in Me, the works that I do he will do also\" (John 14:12). Jesus Christ Temple Ministry (JCTM) believes in the continuing ministry of healing and miracles as part of the authentic gospel. This is not theatrical performance or emotionalism — this is the power of God working through faith, prayer, and the Word.",
    sections: [
      {
        heading: "JCTM's Biblical Foundation for Healing",
        body: "JCTM teaches that healing is part of the atonement: 'By His stripes we are healed' (Isaiah 53:5; 1 Peter 2:24). This was not merely for the first century — it is the covenant promise of God to every believer in every generation. The ministry of James 5:14-15 — anointing the sick with oil and praying in faith — is a continuing command. JCTM distinguishes between this genuine, faith-based ministry and the exploitative 'healing' performances common in commercial churches, where healing is used to manipulate and fundraise."
      },
      {
        heading: "Healing Through Prayer and Fasting",
        body: "JCTM emphasises that healing is often connected to spiritual conditions: genuine faith, repentance, holy living, and fervent prayer. Some deliverances, as Christ taught, 'come out by nothing but prayer and fasting' (Mark 9:29). JCTM's JCTM Prayer Room offers AI-assisted prayer generation for healing, deliverance, and wholeness — grounded in scripture and the ministry's doctrinal knowledge base. Hundreds of testimonies in JCTM's Testimony Vault document real healings, deliverances, and transformations."
      },
      {
        heading: "Discernment About False Healing Ministries",
        body: "As part of the Correction Mandate, JCTM also teaches believers to discern between genuine healing ministry and counterfeit. False healings used to deceive, raise money, or draw crowds are condemned in Scripture (Matthew 7:22-23). JCTM trains believers to test every spiritual manifestation by the Word of God (1 John 4:1), ensuring they are not led astray by signs and wonders performed without doctrinal integrity."
      }
    ],
    scriptures: [
      { ref: "Isaiah 53:5", text: "But He was wounded for our transgressions, He was bruised for our iniquities; the chastisement for our peace was upon Him, and by His stripes we are healed." },
      { ref: "James 5:14-15", text: "Is anyone among you sick? Let him call for the elders of the church, and let them pray over him, anointing him with oil in the name of the Lord. And the prayer of faith will save the sick." },
      { ref: "Mark 16:18", text: "They will lay hands on the sick, and they will recover." },
    ],
    faqs: [
      { q: "Does JCTM believe in divine healing?", a: "Yes. JCTM believes in divine healing as part of the atonement — grounded in Isaiah 53:5 and James 5:14-15. The ministry teaches and practices healing prayer based on biblical principles, while discerning against false healing performances." },
      { q: "How do I receive healing through JCTM?", a: "JCTM offers a prayer room at jctm.org.ng/prayer where you can generate specific prayers for healing and deliverance. Additionally, many testimonies of healing are documented in the JCTM Testimony Vault at jctm.org.ng/testimonies." },
    ]
  },
  "end-times": {
    searchKeyword: "end times rapture",
    intro: "We are living in the last days. Signs abound. Jesus said: \"Now when these things begin to happen, look up and lift up your heads, because your redemption draws near\" (Luke 21:28). Jesus Christ Temple Ministry (JCTM) preaches with urgency because the return of Christ is not a distant theological concept — it is an imminent reality that every soul must be prepared for.",
    sections: [
      {
        heading: "JCTM's End-Time Message",
        body: "JCTM's end-time preaching is grounded in the New Testament, particularly the Olivet Discourse (Matthew 24-25), the Book of Revelation, Daniel, and Paul's letters to the Thessalonians. JCTM teaches the pre-tribulation rapture — the removal of the church before the Great Tribulation — and emphasises that the primary qualification for being taken is not denominational affiliation but holy, consecrated living. 'Watch therefore, and pray always that you may be counted worthy to escape all these things' (Luke 21:36)."
      },
      {
        heading: "Signs of the Times",
        body: "JCTM identifies multiple converging signs as evidence that we are in the final generation: the widespread apostasy in the church (2 Thessalonians 2:3), the rise of false prophets and false christs (Matthew 24:24), moral collapse and the normalisation of perversion (2 Timothy 3:1-4), geopolitical upheaval in the Middle East, and the proliferation of deception through technology and false religion. These are not causes for fear but for urgent preparation — spiritual, moral, and doctrinal."
      },
      {
        heading: "Readiness Is the Only Response",
        body: "JCTM's end-time preaching always leads to one conclusion: you must be ready. Readiness is not intellectual belief — it is a life of holiness, prayer, and correct doctrine. The parable of the ten virgins (Matthew 25:1-13) illustrates that not all who claim to be Christians will be taken. Only those with oil in their lamps — the Holy Spirit evidenced by genuine holy living — will be caught up. JCTM's entire ministry is oriented around producing this readiness in every soul it reaches."
      }
    ],
    scriptures: [
      { ref: "Matthew 24:44", text: "Therefore you also be ready, for the Son of Man is coming at an hour you do not expect." },
      { ref: "1 Thessalonians 4:16-17", text: "For the Lord Himself will descend from heaven with a shout... and the dead in Christ will rise first. Then we who are alive and remain shall be caught up together with them in the clouds to meet the Lord in the air." },
      { ref: "Luke 21:36", text: "Watch therefore, and pray always that you may be counted worthy to escape all these things that will come to pass, and to stand before the Son of Man." },
    ],
    faqs: [
      { q: "What does JCTM teach about the rapture?", a: "JCTM teaches the pre-tribulation rapture — the imminent removal of the church before the Great Tribulation. The key qualification is not church membership but genuine holiness and readiness, as illustrated in Matthew 25 (the parable of the ten virgins)." },
      { q: "What are the signs of the end times according to JCTM?", a: "JCTM identifies: widespread church apostasy (2 Thess 2:3), rise of false prophets (Matt 24:24), moral collapse (2 Tim 3:1-4), geopolitical instability, and the normalization of deception. These are signs that the return of Christ is near." },
      { q: "How do I prepare for the end times?", a: "JCTM teaches that preparation for the end times is: living a holy, consecrated life; building a strong prayer life; grounding yourself in sound apostolic doctrine; separating from the world; and being ready at all times. Watch jctm.org.ng/sermons for end-time teachings." },
    ]
  },
  "water-baptism": {
    searchKeyword: "water baptism",
    intro: "Water baptism is one of the most misunderstood and distorted sacraments in modern Christianity. Jesus Christ Temple Ministry (JCTM), operating under the Correction Mandate, teaches the New Testament doctrine of water baptism — its meaning, its mode, and its place in the life of the believer. As Paul wrote: \"Do you not know that as many of us as were baptized into Christ Jesus were baptized into His death?\" (Romans 6:3).",
    sections: [
      {
        heading: "What Water Baptism Means",
        body: "JCTM teaches that water baptism is a death, burial, and resurrection — a public declaration that the old man of sin has died and been buried with Christ, and that the believer has been raised to walk in newness of life (Romans 6:3-5). It is not a mere religious ritual, a cultural ceremony, or a symbol with no spiritual weight. It is an act of obedience to Christ's command (Matthew 28:19) and a point of genuine spiritual transaction in the believer's life."
      },
      {
        heading: "The Mode of Baptism",
        body: "JCTM teaches that the New Testament mode of baptism is immersion — total submersion in water. The Greek word 'baptizo' means to immerse or to dip. The early church practiced immersion, as evidenced by John baptising in the Jordan River 'because there was much water there' (John 3:23). JCTM corrects the sacramental corruption of sprinkling or pouring as modes of baptism, which were not practised in the apostolic church and do not adequately represent the death-burial-resurrection meaning of baptism."
      },
      {
        heading: "Baptism and Salvation",
        body: "JCTM's position on baptism and salvation is nuanced and scriptural. While baptism is not the cause of salvation (we are saved by grace through faith — Ephesians 2:8), it is the biblical response to salvation and a critical element of the full obedience Christ commands. Acts 2:38, Mark 16:16, and Acts 22:16 all connect baptism with the forgiveness of sins and the receiving of the Spirit. JCTM teaches that neglecting water baptism after genuine repentance is disobedience, and corrects the trend of treating baptism as optional or merely symbolic."
      }
    ],
    scriptures: [
      { ref: "Romans 6:3-4", text: "Do you not know that as many of us as were baptized into Christ Jesus were baptized into His death? Therefore we were buried with Him through baptism into death, that just as Christ was raised from the dead... we also should walk in newness of life." },
      { ref: "Acts 2:38", text: "Repent, and let every one of you be baptized in the name of Jesus Christ for the remission of sins; and you shall receive the gift of the Holy Spirit." },
      { ref: "Mark 16:16", text: "He who believes and is baptized will be saved; but he who does not believe will be condemned." },
    ],
    faqs: [
      { q: "What does JCTM teach about water baptism?", a: "JCTM teaches that water baptism by full immersion is the New Testament mode, representing death, burial, and resurrection with Christ (Romans 6:3-4). It is an act of obedience to Christ's command and a critical element of the believer's walk." },
      { q: "Is sprinkling a valid form of baptism?", a: "JCTM teaches that the biblical and apostolic mode of baptism is immersion — the Greek word 'baptizo' means to immerse. Sprinkling was not practiced in the apostolic church and does not adequately represent the symbolism of death, burial, and resurrection in Romans 6." },
    ]
  },
  "prayer-intercession": {
    searchKeyword: "prayer intercession",
    intro: "Prayer is the lifeline of the Christian. Jesus prayed. The apostles prayed. The early church prayed — and God moved. Jesus Christ Temple Ministry (JCTM) teaches that prayer is not a religious formality or a last resort — it is the primary means of communion with God, spiritual warfare, and obtaining grace for every need. \"The effectual, fervent prayer of a righteous man avails much\" (James 5:16).",
    sections: [
      {
        heading: "JCTM's Approach to Prayer",
        body: "JCTM teaches biblical prayer — rooted in the Lord's model prayer (Matthew 6:9-13), informed by the prayers of Paul, Daniel, and the Psalms, and empowered by the Holy Spirit (Romans 8:26-27). Prayer at JCTM is not entertainment. There is no performance, no theatrical shouting, no manipulation. There is honest communion with God, deep intercession, and faith-filled petition grounded in the promises of Scripture. JCTM's AI-powered Prayer Room at jctm.org.ng/prayer provides scripture-based prayer for specific needs."
      },
      {
        heading: "Intercession: Standing in the Gap",
        body: "JCTM teaches intercessory prayer — the ministry of standing before God on behalf of others. Ezekiel 22:30 records God saying: 'I sought for a man among them who would make a wall, and stand in the gap before Me on behalf of the land.' Intercession for souls, nations, ministers, and the church is a key ministry at JCTM. Believers are trained to carry burdens in prayer, to travail for souls, and to push back darkness through sustained intercession."
      },
      {
        heading: "Fasting and Prayer",
        body: "JCTM teaches that fasting combined with prayer amplifies spiritual effectiveness. Jesus declared that certain deliverances 'come out by nothing but prayer and fasting' (Mark 9:29). Fasting humbles the soul, sharpens spiritual sensitivity, and demonstrates the seriousness of our petitions before God. JCTM provides guidance on biblical fasting — its purpose, its modes, and its spiritual fruit — as a discipline for every serious disciple."
      }
    ],
    scriptures: [
      { ref: "James 5:16", text: "Confess your trespasses to one another, and pray for one another, that you may be healed. The effective, fervent prayer of a righteous man avails much." },
      { ref: "Philippians 4:6-7", text: "Be anxious for nothing, but in everything by prayer and supplication, with thanksgiving, let your requests be made known to God; and the peace of God, which surpasses all understanding, will guard your hearts." },
      { ref: "1 Thessalonians 5:17", text: "Pray without ceasing." },
    ],
    faqs: [
      { q: "How does JCTM teach about prayer?", a: "JCTM teaches biblical, spirit-led prayer grounded in Matthew 6, Romans 8:26, and James 5:16. Prayer is not performance but honest communion with God — including petition, intercession, thanksgiving, and spiritual warfare." },
      { q: "Does JCTM have a prayer ministry?", a: "Yes. JCTM's Prayer Room at jctm.org.ng/prayer provides AI-assisted, scripture-based prayers for specific needs (healing, deliverance, guidance, peace, provision, family, salvation). The ministry also practices communal intercession and teaches fasting." },
    ]
  },
  "family-marriage": {
    searchKeyword: "family marriage",
    intro: "The family is the first institution God established — before the church, before government. When the family breaks down, society breaks down. Jesus Christ Temple Ministry (JCTM) preaches God's original design for marriage and family with clarity, love, and biblical authority — providing believers with the foundation they need to build homes that honour Christ.",
    sections: [
      {
        heading: "God's Design for Marriage",
        body: "JCTM teaches that marriage is a covenant between one man and one woman, instituted by God in Genesis 2:24: 'Therefore a man shall leave his father and mother and be joined to his wife, and they shall become one flesh.' This definition is not cultural or temporal — it is divine and immutable. JCTM holds the scriptural standard against all redefinitions of marriage, teaching that the covenant of marriage is a holy picture of the relationship between Christ and His church (Ephesians 5:25-32)."
      },
      {
        heading: "Roles in Marriage",
        body: "JCTM teaches the complementarian view of marriage as revealed in Scripture: the husband as the loving, sacrificial head (Ephesians 5:25), and the wife as the helper who lovingly submits to her husband's headship (Ephesians 5:22-24). This is not a hierarchy of worth — husband and wife are equal before God — but a divine functional order that, when lived according to Scripture, produces a home of peace, strength, and spiritual fruitfulness. JCTM also addresses common distortions of these roles: abusive husbands and disrespectful wives are both corrected from Scripture."
      },
      {
        heading: "Raising Godly Children",
        body: "JCTM teaches that children are a heritage from the Lord (Psalm 127:3) and that parents have a sacred responsibility to 'train up a child in the way he should go' (Proverbs 22:6). In a generation of radical secular humiliation, digital dangers, and moral confusion, JCTM equips parents with biblical principles for raising children who know God, honour authority, and carry the values of primitive Christianity into the next generation."
      }
    ],
    scriptures: [
      { ref: "Genesis 2:24", text: "Therefore a man shall leave his father and mother and be joined to his wife, and they shall become one flesh." },
      { ref: "Ephesians 5:25", text: "Husbands, love your wives, just as Christ also loved the church and gave Himself for her." },
      { ref: "Proverbs 22:6", text: "Train up a child in the way he should go, and when he is old he will not depart from it." },
      { ref: "Hebrews 13:4", text: "Marriage is honorable among all, and the bed undefiled; but fornicators and adulterers God will judge." },
    ],
    faqs: [
      { q: "What does JCTM teach about marriage?", a: "JCTM teaches that marriage is a sacred covenant between one man and one woman, instituted by God in Genesis 2:24. It is a picture of Christ and the church (Ephesians 5), and is to be honoured as such — with the husband loving sacrificially and the wife submitting in the Lord." },
      { q: "How does JCTM address divorce?", a: "JCTM teaches the biblical view that God hates divorce (Malachi 2:16) and that marriage is intended to be lifelong. However, the ministry also pastors those who have experienced divorce with compassion, providing biblical counsel for healing and restoration." },
    ]
  }
};

interface SermonItem { id: number; videoId: string; title: string; thumbnailUrl: string; publishedAt: string; description?: string | null; }

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 60, damping: 16 } },
};

export default function TopicDetail() {
  const { slug } = useParams<{ slug: string }>();
  const topic = TOPICS.find(t => t.slug === slug);
  const content = slug ? TOPIC_CONTENT[slug] : undefined;
  const [sermons, setSermons] = useState<SermonItem[]>([]);

  useEffect(() => {
    if (!content?.searchKeyword) return;
    fetch(`${BASE}/api/sermons?search=${encodeURIComponent(content.searchKeyword)}&limit=6`)
      .then(r => r.json())
      .then(setSermons)
      .catch(() => {});
  }, [content?.searchKeyword]);

  if (!topic || !content) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-32 text-center">
          <h1 className="text-2xl font-bold text-primary mb-4">Topic not found</h1>
          <Link href="/topics"><Button variant="outline">Back to Topics</Button></Link>
        </div>
      </Layout>
    );
  }

  const Icon = topic.icon;
  const canonicalPath = `/topics/${slug}`;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      "name": `${topic.title} — JCTM Bible Teaching`,
      "headline": `What Does the Bible Say About ${topic.title}? JCTM's Teaching`,
      "description": content.intro.slice(0, 200),
      "url": `https://jctm.org.ng${canonicalPath}`,
      "inLanguage": "en-NG",
      "datePublished": "2024-01-01",
      "dateModified": "2026-04-09",
      "author": {
        "@type": "Person",
        "name": "Prophet Amos Evomobor",
        "url": "https://jctm.org.ng/leadership"
      },
      "publisher": {
        "@type": "ReligiousOrganization",
        "name": "Jesus Christ Temple Ministry (JCTM)",
        "url": "https://jctm.org.ng",
        "logo": { "@type": "ImageObject", "url": "https://jctm.org.ng/favicon.png" }
      },
      "about": { "@type": "Thing", "name": topic.title },
      "keywords": topic.keywords.join(", ") + ", JCTM, Temple TV, Prophet Amos Evomobor",
      "speakable": { "@type": "SpeakableSpecification", "cssSelector": ["h1", "h2"] }
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": content.faqs.map(faq => ({
        "@type": "Question",
        "name": faq.q,
        "acceptedAnswer": { "@type": "Answer", "text": faq.a }
      }))
    }
  ];

  return (
    <Layout>
      <SEO
        title={`${topic.title} — JCTM Bible Teachings & Sermons`}
        description={`${content.intro.slice(0, 155)}…`}
        path={canonicalPath}
        type="article"
        keywords={`${topic.keywords.join(", ")}, JCTM ${topic.title.toLowerCase()}, Temple TV ${topic.title.toLowerCase()}, Prophet Amos Evomobor ${topic.title.toLowerCase()}, Jesus Christ Temple Ministry ${topic.title.toLowerCase()}`}
        breadcrumbs={[
          { name: "Home", url: "https://jctm.org.ng/" },
          { name: "Bible Topics", url: "https://jctm.org.ng/topics" },
          { name: topic.title, url: `https://jctm.org.ng${canonicalPath}` },
        ]}
        jsonLd={jsonLd}
      />

      <div className="min-h-screen bg-background">

        {/* Hero */}
        <div className={`bg-gradient-to-br ${topic.color} pt-24 pb-16 px-4`}>
          <div className="container mx-auto max-w-4xl">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center gap-2 mb-4">
                <Link href="/topics">
                  <button className="text-white/60 hover:text-white flex items-center gap-1 text-sm transition-colors">
                    <ArrowLeft className="h-4 w-4" /> Topics
                  </button>
                </Link>
                <ChevronRight className="h-4 w-4 text-white/30" />
                <span className="text-white/60 text-sm">{topic.title}</span>
              </div>
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-white/10 rounded-2xl">
                  <Icon className="h-8 w-8 text-white" />
                </div>
                <Badge className="bg-white/20 text-white border-white/20">JCTM Bible Topic</Badge>
              </div>
              <h1 className="text-4xl md:text-5xl font-serif font-bold text-white mb-4">
                {topic.title}
              </h1>
              <p className="text-white/70 text-lg italic mb-2">"{topic.subtitle}"</p>
              <p className="text-white/50 text-sm">— {topic.scripture}</p>
            </motion.div>
          </div>
        </div>

        <div className="container mx-auto max-w-4xl px-4 py-12">

          {/* Intro */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="glass-panel rounded-2xl p-8 mb-10 border border-border/50"
          >
            <p className="text-lg text-foreground leading-relaxed speakable">{content.intro}</p>
          </motion.div>

          {/* Main sections */}
          <div className="space-y-8 mb-12">
            {content.sections.map((section, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-panel rounded-2xl p-8 border border-border/50"
              >
                <h2 className="text-2xl font-serif font-bold text-primary mb-4 speakable">{section.heading}</h2>
                <p className="text-muted-foreground leading-relaxed">{section.body}</p>
              </motion.div>
            ))}
          </div>

          {/* Key Scriptures */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12"
          >
            <h2 className="text-2xl font-serif font-bold text-primary mb-6 flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-accent" /> Key Scriptures
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {content.scriptures.map((s, i) => (
                <div key={i} className="glass-panel rounded-xl p-5 border border-accent/20">
                  <p className="text-sm font-bold text-accent mb-2">{s.ref}</p>
                  <p className="text-muted-foreground text-sm italic leading-relaxed">"{s.text}"</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Related Sermons */}
          {sermons.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mb-12"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-serif font-bold text-primary flex items-center gap-2">
                  <Play className="h-6 w-6 text-accent" /> Related Sermons
                </h2>
                <Link href={`/sermons?search=${encodeURIComponent(content.searchKeyword)}`}>
                  <button className="text-accent text-sm hover:underline flex items-center gap-1">
                    View all <ExternalLink className="h-3 w-3" />
                  </button>
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sermons.slice(0, 6).map(sermon => (
                  <Link key={sermon.id} href={`/sermons/${sermon.id}`}>
                    <div className="group glass-panel rounded-xl overflow-hidden border border-border/50 hover:border-accent/30 transition-all cursor-pointer">
                      <div className="relative aspect-video bg-muted overflow-hidden">
                        <img
                          src={sermon.thumbnailUrl}
                          alt={sermon.title}
                          loading="lazy"
                          width={320}
                          height={180}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={e => { (e.target as HTMLImageElement).src = "https://i.ytimg.com/vi/default/hqdefault.jpg"; }}
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="bg-white/90 rounded-full p-2">
                            <Play className="h-5 w-5 text-primary fill-primary" />
                          </div>
                        </div>
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-medium text-primary line-clamp-2 leading-snug">{sermon.title}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </motion.div>
          )}

          {/* FAQ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12"
          >
            <h2 className="text-2xl font-serif font-bold text-primary mb-6 flex items-center gap-2">
              <MessageCircle className="h-6 w-6 text-accent" /> Frequently Asked Questions
            </h2>
            <div className="space-y-4">
              {content.faqs.map((faq, i) => (
                <div key={i} className="glass-panel rounded-xl p-6 border border-border/50">
                  <h3 className="font-semibold text-primary mb-2">{faq.q}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <Link href={`/sermons?search=${encodeURIComponent(content.searchKeyword)}`}>
              <div className="glass-panel rounded-2xl p-6 border border-accent/20 hover:border-accent/40 transition-colors cursor-pointer group text-center">
                <Play className="h-8 w-8 text-accent mx-auto mb-3" />
                <h3 className="font-bold text-primary mb-1">Watch Sermons on {topic.title}</h3>
                <p className="text-sm text-muted-foreground">Browse Temple TV's full library on this topic</p>
              </div>
            </Link>
            <Link href="/prayer">
              <div className="glass-panel rounded-2xl p-6 border border-border/50 hover:border-accent/20 transition-colors cursor-pointer text-center">
                <MessageCircle className="h-8 w-8 text-accent mx-auto mb-3" />
                <h3 className="font-bold text-primary mb-1">Generate a Prayer</h3>
                <p className="text-sm text-muted-foreground">Let TempleBots AI create a personal prayer for you</p>
              </div>
            </Link>
          </motion.div>

        </div>
      </div>
    </Layout>
  );
}

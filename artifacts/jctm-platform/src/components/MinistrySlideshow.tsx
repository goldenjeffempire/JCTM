import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

// ─── Sermon-Driven Slide Content ─────────────────────────────────────────────
type Slide = {
  theme: string;
  point: string;
  quote: string;
  ref: string;
  sourceTitle?: string;
  sourceVideoId?: string;
  publishedAt?: string;
};

type TeachingPointsResponse = {
  source?: string;
  generatedAt?: string;
  refreshSeconds?: number;
  themes?: string[];
  points?: Slide[];
};

const SLIDES: Slide[] = [
  // ── IDENTITY IN CHRIST (1–20) ──────────────────────────────────────────────
  {
    theme: "Identity in Christ",
    point: "You Are a Child of God",
    quote: "But to all who did receive him, who believed in his name, he gave the right to become children of God.",
    ref: "John 1:12",
  },
  {
    theme: "Identity in Christ",
    point: "You Are Chosen and Not Rejected",
    quote: "But you are a chosen race, a royal priesthood, a holy nation, a people for his own possession, that you may proclaim the excellencies of him who called you out of darkness into his marvellous light.",
    ref: "1 Peter 2:9",
  },
  {
    theme: "Identity in Christ",
    point: "You Are a New Creation in Christ",
    quote: "Therefore, if anyone is in Christ, he is a new creation. The old has passed away; behold, the new has come.",
    ref: "2 Corinthians 5:17",
  },
  {
    theme: "Identity in Christ",
    point: "You Are Loved Unconditionally by God",
    quote: "But God demonstrates his own love for us in this: While we were still sinners, Christ died for us.",
    ref: "Romans 5:8",
  },
  {
    theme: "Identity in Christ",
    point: "You Are Redeemed by the Blood of Jesus",
    quote: "In him we have redemption through his blood, the forgiveness of sins, in accordance with the riches of God's grace.",
    ref: "Ephesians 1:7",
  },
  {
    theme: "Identity in Christ",
    point: "You Are Sealed by the Holy Spirit",
    quote: "When you believed, you were marked in him with a seal, the promised Holy Spirit, who is a deposit guaranteeing our inheritance.",
    ref: "Ephesians 1:13",
  },
  {
    theme: "Identity in Christ",
    point: "You Are More Than a Conqueror",
    quote: "No, in all these things we are more than conquerors through him who loved us.",
    ref: "Romans 8:37",
  },
  {
    theme: "Identity in Christ",
    point: "You Are God's Workmanship",
    quote: "For we are God's handiwork, created in Christ Jesus to do good works, which God prepared in advance for us to do.",
    ref: "Ephesians 2:10",
  },
  {
    theme: "Identity in Christ",
    point: "You Are Justified by Faith",
    quote: "Therefore, since we have been justified through faith, we have peace with God through our Lord Jesus Christ.",
    ref: "Romans 5:1",
  },
  {
    theme: "Identity in Christ",
    point: "You Are Free From Condemnation",
    quote: "Therefore, there is now no condemnation for those who are in Christ Jesus, because through Christ Jesus the law of the Spirit who gives life has set you free.",
    ref: "Romans 8:1",
  },
  {
    theme: "Identity in Christ",
    point: "You Are the Salt of the Earth",
    quote: "You are the salt of the earth. But if the salt loses its saltiness, how can it be made salty again? It is no longer good for anything, except to be thrown out.",
    ref: "Matthew 5:13",
  },
  {
    theme: "Identity in Christ",
    point: "You Are the Light of the World",
    quote: "You are the light of the world. A town built on a hill cannot be hidden. Let your light shine before others, that they may see your good deeds and glorify your Father in heaven.",
    ref: "Matthew 5:14",
  },
  {
    theme: "Identity in Christ",
    point: "You Are God's Temple",
    quote: "Do you not know that your bodies are temples of the Holy Spirit, who is in you, whom you have received from God? You are not your own; you were bought at a price.",
    ref: "1 Corinthians 6:19",
  },
  {
    theme: "Identity in Christ",
    point: "You Are a Royal Priesthood",
    quote: "But you are a chosen race, a royal priesthood, a holy nation, a people for his own possession, that you may proclaim the excellencies of him who called you.",
    ref: "1 Peter 2:9",
  },
  {
    theme: "Identity in Christ",
    point: "You Are Seated in Heavenly Places",
    quote: "And God raised us up with Christ and seated us with him in the heavenly realms in Christ Jesus, in order that in the coming ages he might show the incomparable riches of his grace.",
    ref: "Ephesians 2:6",
  },
  {
    theme: "Identity in Christ",
    point: "You Are God's Ambassador",
    quote: "We are therefore Christ's ambassadors, as though God were making his appeal through us. We implore you on Christ's behalf: Be reconciled to God.",
    ref: "2 Corinthians 5:20",
  },
  {
    theme: "Identity in Christ",
    point: "You Are Victorious in Christ",
    quote: "But thanks be to God! He gives us the victory through our Lord Jesus Christ.",
    ref: "1 Corinthians 15:57",
  },
  {
    theme: "Identity in Christ",
    point: "You Are Adopted Into God's Family",
    quote: "The Spirit you received brought about your adoption to sonship. And by him we cry, 'Abba, Father.' The Spirit himself testifies with our spirit that we are God's children.",
    ref: "Romans 8:15",
  },
  {
    theme: "Identity in Christ",
    point: "You Are Strengthened by Christ",
    quote: "I can do all this through him who gives me strength.",
    ref: "Philippians 4:13",
  },
  {
    theme: "Identity in Christ",
    point: "You Are Complete in Him",
    quote: "And in Christ you have been brought to fullness. He is the head over every power and authority.",
    ref: "Colossians 2:10",
  },
  // ── FAITH & BELIEF (21–40) ─────────────────────────────────────────────────
  {
    theme: "Faith",
    point: "Faith Pleases God",
    quote: "And without faith it is impossible to please God, because anyone who comes to him must believe that he exists and that he rewards those who earnestly seek him.",
    ref: "Hebrews 11:6",
  },
  {
    theme: "Faith",
    point: "Faith Comes by Hearing the Word",
    quote: "Consequently, faith comes from hearing the message, and the message is heard through the word about Christ.",
    ref: "Romans 10:17",
  },
  {
    theme: "Faith",
    point: "Walk by Faith, Not by Sight",
    quote: "For we live by faith, not by sight.",
    ref: "2 Corinthians 5:7",
  },
  {
    theme: "Faith",
    point: "Faith Can Move Mountains",
    quote: "Truly I tell you, if you have faith as small as a mustard seed, you can say to this mountain, 'Move from here to there,' and it will move. Nothing will be impossible for you.",
    ref: "Matthew 17:20",
  },
  {
    theme: "Faith",
    point: "Without Faith, Nothing Is Impossible",
    quote: "Jesus said to him, 'If you can believe, all things are possible to him who believes.'",
    ref: "Mark 9:23",
  },
  {
    theme: "Faith",
    point: "Faith Is the Substance of Hope",
    quote: "Now faith is confidence in what we hope for and assurance about what we do not see.",
    ref: "Hebrews 11:1",
  },
  {
    theme: "Faith",
    point: "Stand Firm in Faith",
    quote: "Be on your guard; stand firm in the faith; be courageous; be strong. Do everything in love.",
    ref: "1 Corinthians 16:13",
  },
  {
    theme: "Faith",
    point: "Faith Overcomes the World",
    quote: "For everyone born of God overcomes the world. This is the victory that has overcome the world, even our faith.",
    ref: "1 John 5:4",
  },
  {
    theme: "Faith",
    point: "Be Strong in Faith",
    quote: "Yet he did not waver through unbelief regarding the promise of God, but was strengthened in his faith and gave glory to God.",
    ref: "Romans 4:20",
  },
  {
    theme: "Faith",
    point: "Faith Brings Righteousness",
    quote: "However, to the one who does not work but trusts God who justifies the ungodly, their faith is credited as righteousness.",
    ref: "Romans 4:5",
  },
  {
    theme: "Faith",
    point: "Trust in the Lord Always",
    quote: "Trust in the LORD with all your heart and lean not on your own understanding; in all your ways submit to him, and he will make your paths straight.",
    ref: "Proverbs 3:5",
  },
  {
    theme: "Faith",
    point: "God Rewards Those Who Seek Him in Faith",
    quote: "And without faith it is impossible to please God, because anyone who comes to him must believe that he exists and that he rewards those who earnestly seek him.",
    ref: "Hebrews 11:6",
  },
  {
    theme: "Faith",
    point: "Faith Produces Patience",
    quote: "Because you know that the testing of your faith produces perseverance. Let perseverance finish its work so that you may be mature and complete.",
    ref: "James 1:3",
  },
  {
    theme: "Faith",
    point: "Faith Activates Miracles",
    quote: "Therefore I tell you, whatever you ask for in prayer, believe that you have received it, and it will be yours.",
    ref: "Mark 11:24",
  },
  {
    theme: "Faith",
    point: "Faith Opens Doors",
    quote: "Ask and it will be given to you; seek and you will find; knock and the door will be opened to you.",
    ref: "Matthew 7:7",
  },
  {
    theme: "Faith",
    point: "Faith Sustains Through Every Trial",
    quote: "Blessed is the one who perseveres under trial because, having stood the test, that person will receive the crown of life that the Lord has promised to those who love him.",
    ref: "James 1:12",
  },
  {
    theme: "Faith",
    point: "Faith Brings Salvation",
    quote: "For it is by grace you have been saved, through faith — and this is not from yourselves, it is the gift of God — not by works, so that no one can boast.",
    ref: "Ephesians 2:8",
  },
  {
    theme: "Faith",
    point: "Faith Grows Through Testing",
    quote: "These have come so that the proven genuineness of your faith — of greater worth than gold, which perishes even though refined by fire — may result in praise, glory and honor when Jesus Christ is revealed.",
    ref: "1 Peter 1:7",
  },
  {
    theme: "Faith",
    point: "Faith Defeats Fear",
    quote: "So do not fear, for I am with you; do not be dismayed, for I am your God. I will strengthen you and help you; I will uphold you with my righteous right hand.",
    ref: "Isaiah 41:10",
  },
  {
    theme: "Faith",
    point: "Faith Anchors the Soul",
    quote: "We have this hope as an anchor for the soul, firm and secure. It enters the inner sanctuary behind the curtain.",
    ref: "Hebrews 6:19",
  },
  // ── HOLY SPIRIT & POWER (41–60) ────────────────────────────────────────────
  {
    theme: "Holy Spirit",
    point: "The Holy Spirit Empowers Believers",
    quote: "But you will receive power when the Holy Spirit comes on you; and you will be my witnesses in Jerusalem, and in all Judea and Samaria, and to the ends of the earth.",
    ref: "Acts 1:8",
  },
  {
    theme: "Holy Spirit",
    point: "The Spirit Leads Into All Truth",
    quote: "But when he, the Spirit of truth, comes, he will guide you into all the truth. He will not speak on his own; he will speak only what he hears.",
    ref: "John 16:13",
  },
  {
    theme: "Holy Spirit",
    point: "The Spirit Gives Life",
    quote: "And if the Spirit of him who raised Jesus from the dead is living in you, he who raised Christ from the dead will also give life to your mortal bodies because of his Spirit who lives in you.",
    ref: "Romans 8:11",
  },
  {
    theme: "Holy Spirit",
    point: "Be Filled With the Spirit",
    quote: "Do not get drunk on wine, which leads to debauchery. Instead, be filled with the Spirit, speaking to one another with psalms, hymns, and songs from the Spirit.",
    ref: "Ephesians 5:18",
  },
  {
    theme: "Holy Spirit",
    point: "The Spirit Produces Fruit",
    quote: "But the fruit of the Spirit is love, joy, peace, forbearance, kindness, goodness, faithfulness, gentleness and self-control. Against such things there is no law.",
    ref: "Galatians 5:22",
  },
  {
    theme: "Holy Spirit",
    point: "The Spirit Teaches All Things",
    quote: "But the Advocate, the Holy Spirit, whom the Father will send in my name, will teach you all things and will remind you of everything I have said to you.",
    ref: "John 14:26",
  },
  {
    theme: "Holy Spirit",
    point: "The Spirit Intercedes for Us",
    quote: "In the same way, the Spirit helps us in our weakness. We do not know what we ought to pray for, but the Spirit himself intercedes for us through wordless groans.",
    ref: "Romans 8:26",
  },
  {
    theme: "Holy Spirit",
    point: "The Spirit Gives Gifts",
    quote: "Now to each one the manifestation of the Spirit is given for the common good.",
    ref: "1 Corinthians 12:7",
  },
  {
    theme: "Holy Spirit",
    point: "The Spirit Brings Freedom",
    quote: "Now the Lord is the Spirit, and where the Spirit of the Lord is, there is freedom.",
    ref: "2 Corinthians 3:17",
  },
  {
    theme: "Holy Spirit",
    point: "The Spirit Strengthens the Inner Man",
    quote: "I pray that out of his glorious riches he may strengthen you with power through his Spirit in your inner being, so that Christ may dwell in your hearts through faith.",
    ref: "Ephesians 3:16",
  },
  {
    theme: "Holy Spirit",
    point: "The Spirit Convicts of Sin",
    quote: "When he comes, he will prove the world to be in the wrong about sin and righteousness and judgment.",
    ref: "John 16:8",
  },
  {
    theme: "Holy Spirit",
    point: "The Spirit Reveals Mysteries",
    quote: "These are the things God has revealed to us by his Spirit. The Spirit searches all things, even the deep things of God.",
    ref: "1 Corinthians 2:10",
  },
  {
    theme: "Holy Spirit",
    point: "The Spirit Guides Every Decision",
    quote: "For those who are led by the Spirit of God are the children of God.",
    ref: "Romans 8:14",
  },
  {
    theme: "Holy Spirit",
    point: "The Spirit Brings Boldness",
    quote: "After they prayed, the place where they were meeting was shaken. And they were all filled with the Holy Spirit and spoke the word of God boldly.",
    ref: "Acts 4:31",
  },
  {
    theme: "Holy Spirit",
    point: "The Spirit Sanctifies Believers",
    quote: "God chose you as firstfruits to be saved through the sanctifying work of the Spirit and through belief in the truth.",
    ref: "Romans 15:16",
  },
  {
    theme: "Holy Spirit",
    point: "The Spirit Brings Revival and Renewal",
    quote: "He saved us through the washing of rebirth and renewing by the Holy Spirit, whom he poured out on us generously through Jesus Christ our Saviour.",
    ref: "Titus 3:5",
  },
  {
    theme: "Holy Spirit",
    point: "The Spirit Renews the Mind",
    quote: "Do not conform to the pattern of this world, but be transformed by the renewing of your mind. Then you will be able to test and approve what God's will is.",
    ref: "Romans 12:2",
  },
  {
    theme: "Holy Spirit",
    point: "The Spirit Strengthens Your Prayer Life",
    quote: "But you, dear friends, by building yourselves up in your most holy faith and praying in the Holy Spirit, keep yourselves in God's love.",
    ref: "Jude 1:20",
  },
  {
    theme: "Holy Spirit",
    point: "The Spirit Brings Joy",
    quote: "For the kingdom of God is not a matter of eating and drinking, but of righteousness, peace and joy in the Holy Spirit.",
    ref: "Romans 14:17",
  },
  {
    theme: "Holy Spirit",
    point: "The Spirit Confirms Your Sonship",
    quote: "The Spirit himself testifies with our spirit that we are God's children. Now if we are children, then we are heirs — heirs of God and co-heirs with Christ.",
    ref: "Romans 8:16",
  },
  // ── PRAYER & SPIRITUAL LIFE (61–80) ────────────────────────────────────────
  {
    theme: "Prayer",
    point: "Pray Without Ceasing",
    quote: "Pray continually, give thanks in all circumstances; for this is God's will for you in Christ Jesus.",
    ref: "1 Thessalonians 5:17",
  },
  {
    theme: "Prayer",
    point: "Prayer Brings the Peace That Surpasses Understanding",
    quote: "Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God. And the peace of God, which transcends all understanding, will guard your hearts and your minds in Christ Jesus.",
    ref: "Philippians 4:6–7",
  },
  {
    theme: "Prayer",
    point: "Ask and You Shall Receive",
    quote: "Ask and it will be given to you; seek and you will find; knock and the door will be opened to you. For everyone who asks receives.",
    ref: "Matthew 7:7",
  },
  {
    theme: "Prayer",
    point: "The Prayer of Faith Heals the Sick",
    quote: "And the prayer offered in faith will make the sick person well; the Lord will raise them up. If they have sinned, they will be forgiven.",
    ref: "James 5:15",
  },
  {
    theme: "Prayer",
    point: "Pray in the Spirit on All Occasions",
    quote: "And pray in the Spirit on all occasions with all kinds of prayers and requests. With this in mind, be alert and always keep on praying for all the Lord's people.",
    ref: "Ephesians 6:18",
  },
  {
    theme: "Prayer",
    point: "Prayer Changes Every Situation",
    quote: "Therefore I tell you, whatever you ask for in prayer, believe that you have received it, and it will be yours.",
    ref: "Mark 11:24",
  },
  {
    theme: "Prayer",
    point: "Seek God in Prayer With Your Whole Heart",
    quote: "You will seek me and find me when you seek me with all your heart.",
    ref: "Jeremiah 29:13",
  },
  {
    theme: "Prayer",
    point: "Prayer Brings Supernatural Breakthrough",
    quote: "About midnight Paul and Silas were praying and singing hymns to God. Suddenly there was such a violent earthquake that the foundations of the prison were shaken. At once all the prison doors flew open.",
    ref: "Acts 16:25–26",
  },
  {
    theme: "Prayer",
    point: "Pray for All People — Intercession Is Our Calling",
    quote: "I urge, then, first of all, that petitions, prayers, intercession and thanksgiving be made for all people — for kings and all those in authority.",
    ref: "1 Timothy 2:1",
  },
  {
    theme: "Prayer",
    point: "Prayer Aligns Your Will With God's Will",
    quote: "Your kingdom come, your will be done, on earth as it is in heaven.",
    ref: "Matthew 6:10",
  },
  {
    theme: "Prayer",
    point: "Prayer Releases the Power of God",
    quote: "After they prayed, the place where they were meeting was shaken. And they were all filled with the Holy Spirit and spoke the word of God boldly.",
    ref: "Acts 4:31",
  },
  {
    theme: "Prayer",
    point: "Prayer Brings Healing and Restoration to the Land",
    quote: "If my people, who are called by my name, will humble themselves and pray and seek my face and turn from their wicked ways, then I will hear from heaven, and I will forgive their sin and will heal their land.",
    ref: "2 Chronicles 7:14",
  },
  {
    theme: "Prayer",
    point: "Pray With Thanksgiving — Devote Yourself to It",
    quote: "Devote yourselves to prayer, being watchful and thankful.",
    ref: "Colossians 4:2",
  },
  {
    theme: "Prayer",
    point: "Prayer Is Your Shield Against Temptation",
    quote: "Watch and pray so that you will not fall into temptation. The spirit is willing, but the flesh is weak.",
    ref: "Matthew 26:41",
  },
  {
    theme: "Prayer",
    point: "Prayer Builds Intimacy With the Most High",
    quote: "Whoever dwells in the shelter of the Most High will rest in the shadow of the Almighty. I will say of the LORD, 'He is my refuge and my fortress, my God, in whom I trust.'",
    ref: "Psalm 91:1",
  },
  {
    theme: "Prayer",
    point: "Prayer Brings Wisdom From Above",
    quote: "If any of you lacks wisdom, you should ask God, who gives generously to all without finding fault, and it will be given to you.",
    ref: "James 1:5",
  },
  {
    theme: "Prayer",
    point: "Prayer Opens the Heavens",
    quote: "When all the people were being baptized, Jesus was baptized too. And as he was praying, heaven was opened and the Holy Spirit descended on him in bodily form like a dove.",
    ref: "Luke 3:21–22",
  },
  {
    theme: "Prayer",
    point: "Prayer Strengthens and Fortifies Faith",
    quote: "But I have prayed for you, Simon, that your faith may not fail. And when you have turned back, strengthen your brothers.",
    ref: "Luke 22:32",
  },
  {
    theme: "Prayer",
    point: "Persistent Prayer Brings Miracles",
    quote: "So Peter was kept in prison, but the church was earnestly praying to God for him. Suddenly an angel of the Lord appeared and a light shone in the cell. He struck Peter on the side and woke him up.",
    ref: "Acts 12:5–7",
  },
  {
    theme: "Prayer",
    point: "Pray With Persistence and Never Give Up",
    quote: "Then Jesus told his disciples a parable to show them that they should always pray and not give up.",
    ref: "Luke 18:1",
  },
  // ── HOLINESS & RIGHTEOUS LIVING (81–100) ───────────────────────────────────
  {
    theme: "Holiness",
    point: "Be Holy as God Is Holy",
    quote: "But just as he who called you is holy, so be holy in all you do; for it is written: 'Be holy, because I am holy.'",
    ref: "1 Peter 1:16",
  },
  {
    theme: "Holiness",
    point: "Righteousness Exalts a Nation",
    quote: "Righteousness exalts a nation, but sin condemns any people.",
    ref: "Proverbs 14:34",
  },
  {
    theme: "Holiness",
    point: "Walk in the Spirit",
    quote: "So I say, walk by the Spirit, and you will not gratify the desires of the flesh.",
    ref: "Galatians 5:16",
  },
  {
    theme: "Holiness",
    point: "Do Not Let Sin Reign in Your Body",
    quote: "Therefore do not let sin reign in your mortal body so that you obey its evil desires.",
    ref: "Romans 6:12",
  },
  {
    theme: "Holiness",
    point: "Clean Hands and a Pure Heart",
    quote: "The one who has clean hands and a pure heart, who does not trust in an idol or swear by a false god. They will receive blessing from the LORD.",
    ref: "Psalm 24:4",
  },
  {
    theme: "Holiness",
    point: "Flee Every Form of Temptation",
    quote: "Flee from sexual immorality. All other sins a person commits are outside the body, but whoever sins sexually, sins against their own body.",
    ref: "1 Corinthians 6:18",
  },
  {
    theme: "Holiness",
    point: "Live as Children of Light",
    quote: "For you were once darkness, but now you are light in the Lord. Live as children of light, for the fruit of the light consists in all goodness, righteousness and truth.",
    ref: "Ephesians 5:8",
  },
  {
    theme: "Holiness",
    point: "Be Transformed by the Renewing of Your Mind",
    quote: "Do not conform to the pattern of this world, but be transformed by the renewing of your mind. Then you will be able to test and approve what God's will is — his good, pleasing and perfect will.",
    ref: "Romans 12:2",
  },
  {
    theme: "Holiness",
    point: "Pursue God's Kingdom and His Righteousness First",
    quote: "But seek first his kingdom and his righteousness, and all these things will be given to you as well.",
    ref: "Matthew 6:33",
  },
  {
    theme: "Holiness",
    point: "Sin Brings Separation From God",
    quote: "But your iniquities have separated you from your God; your sins have hidden his face from you, so that he will not hear.",
    ref: "Isaiah 59:2",
  },
  {
    theme: "Holiness",
    point: "God Disciplines Every Son He Loves",
    quote: "Because the Lord disciplines the one he loves, and he chastens everyone he accepts as his son. Endure hardship as discipline; God is treating you as his children.",
    ref: "Hebrews 12:6",
  },
  {
    theme: "Holiness",
    point: "Walk Worthy of the Calling You Have Received",
    quote: "As a prisoner for the Lord, then, I urge you to live a life worthy of the calling you have received — be completely humble and gentle; be patient, bearing with one another in love.",
    ref: "Ephesians 4:1",
  },
  {
    theme: "Holiness",
    point: "Do Not Love the World or Anything in It",
    quote: "Do not love the world or anything in the world. If anyone loves the world, love for the Father is not in them.",
    ref: "1 John 2:15",
  },
  {
    theme: "Holiness",
    point: "Purify Yourself and Draw Near to God",
    quote: "Come near to God and he will come near to you. Wash your hands, you sinners, and purify your hearts, you double-minded.",
    ref: "James 4:8",
  },
  {
    theme: "Holiness",
    point: "Overcome Evil With Good",
    quote: "Do not be overcome by evil, but overcome evil with good.",
    ref: "Romans 12:21",
  },
  {
    theme: "Holiness",
    point: "Guard Your Heart Above All Else",
    quote: "Above all else, guard your heart, for everything you do flows from it.",
    ref: "Proverbs 4:23",
  },
  {
    theme: "Holiness",
    point: "Speak Truth Always — Put Away Falsehood",
    quote: "Therefore each of you must put off falsehood and speak truthfully to your neighbor, for we are all members of one body.",
    ref: "Ephesians 4:25",
  },
  {
    theme: "Holiness",
    point: "Love Righteousness and Hate Wickedness",
    quote: "You love righteousness and hate wickedness; therefore God, your God, has set you above your companions by anointing you with the oil of joy.",
    ref: "Psalm 45:7",
  },
  {
    theme: "Holiness",
    point: "Live Blamelessly as Children of God",
    quote: "So that you may become blameless and pure, children of God without fault in a warped and crooked generation. Then you will shine among them like stars in the sky.",
    ref: "Philippians 2:15",
  },
  {
    theme: "Holiness",
    point: "God Rewards Those Who Hunger for Righteousness",
    quote: "Blessed are those who hunger and thirst for righteousness, for they will be filled.",
    ref: "Matthew 5:6",
  },
  // ── GOD'S PROMISES (101–110) ────────────────────────────────────────────────
  {
    theme: "God's Promises",
    point: "God Provides for Every Need",
    quote: "And my God will meet all your needs according to the riches of his glory in Christ Jesus.",
    ref: "Philippians 4:19",
  },
  {
    theme: "God's Promises",
    point: "God Is Your Refuge and Fortress",
    quote: "I will say of the LORD, 'He is my refuge and my fortress, my God, in whom I trust.'",
    ref: "Psalm 91:2",
  },
  {
    theme: "God's Promises",
    point: "God Heals — He Is the LORD Who Heals You",
    quote: "He said, 'If you listen carefully to the LORD your God and do what is right in his eyes, you will be healed, for I am the LORD, who heals you.'",
    ref: "Exodus 15:26",
  },
  {
    theme: "God's Promises",
    point: "God Restores the Years the Enemy Has Stolen",
    quote: "I will repay you for the years the locusts have eaten — the great locust and the young locust, the other locusts and the locust swarm — my great army that I sent among you.",
    ref: "Joel 2:25",
  },
  {
    theme: "God's Promises",
    point: "God Fights Your Battles — You Need Only to Be Still",
    quote: "The LORD will fight for you; you need only to be still.",
    ref: "Exodus 14:14",
  },
  {
    theme: "God's Promises",
    point: "God Gives Wisdom Generously to All Who Ask",
    quote: "If any of you lacks wisdom, you should ask God, who gives generously to all without finding fault, and it will be given to you.",
    ref: "James 1:5",
  },
  {
    theme: "God's Promises",
    point: "God Is Faithful — His Compassions Never Fail",
    quote: "Because of the LORD's great love we are not consumed, for his compassions never fail. They are new every morning; great is your faithfulness.",
    ref: "Lamentations 3:22",
  },
  {
    theme: "God's Promises",
    point: "God Will Never Leave You nor Forsake You",
    quote: "Never will I leave you; never will I forsake you. So we say with confidence, 'The Lord is my helper; I will not be afraid.'",
    ref: "Hebrews 13:5",
  },
  {
    theme: "God's Promises",
    point: "God Gives a Peace the World Cannot Give",
    quote: "Peace I leave with you; my peace I give you. I do not give to you as the world gives. Do not let your hearts be troubled and do not be afraid.",
    ref: "John 14:27",
  },
  {
    theme: "God's Promises",
    point: "God Strengthens Those Who Are Weak",
    quote: "He gives strength to the weary and increases the power of the weak. Even youths grow tired and weary, but those who hope in the LORD will renew their strength.",
    ref: "Isaiah 40:29",
  },
];

const THEME: Record<string, { accent: string; pill: string; bg: string; quoteColor: string }> = {
  "Identity in Christ": {
    accent: "#F472B6",
    pill: "rgba(244,114,182,0.14)",
    bg: "linear-gradient(160deg,#3d0028 0%,#1a000f 100%)",
    quoteColor: "rgba(251,207,232,0.90)",
  },
  "Holy Spirit": {
    accent: "#67E8F9",
    pill: "rgba(103,232,249,0.14)",
    bg: "linear-gradient(160deg,#003040 0%,#00131a 100%)",
    quoteColor: "rgba(207,250,254,0.90)",
  },
  "God's Promises": {
    accent: "#86EFAC",
    pill: "rgba(134,239,172,0.14)",
    bg: "linear-gradient(160deg,#063018 0%,#02130a 100%)",
    quoteColor: "rgba(187,247,208,0.90)",
  },
  Truth: {
    accent: "#38BDF8",
    pill: "rgba(56,189,248,0.14)",
    bg: "linear-gradient(160deg,#002a5c 0%,#001228 100%)",
    quoteColor: "rgba(186,230,255,0.85)",
  },
  Holiness: {
    accent: "#C084FC",
    pill: "rgba(192,132,252,0.14)",
    bg: "linear-gradient(160deg,#2a004a 0%,#120020 100%)",
    quoteColor: "rgba(233,213,255,0.85)",
  },
  Salvation: {
    accent: "#34D399",
    pill: "rgba(52,211,153,0.14)",
    bg: "linear-gradient(160deg,#003828 0%,#001810 100%)",
    quoteColor: "rgba(167,243,208,0.85)",
  },
  Justice: {
    accent: "#F59E0B",
    pill: "rgba(245,158,11,0.14)",
    bg: "linear-gradient(160deg,#3a1f00 0%,#1a0d00 100%)",
    quoteColor: "rgba(253,230,138,0.85)",
  },
  Repentance: {
    accent: "#FB923C",
    pill: "rgba(251,146,60,0.14)",
    bg: "linear-gradient(160deg,#3a1500 0%,#1a0800 100%)",
    quoteColor: "rgba(254,215,170,0.85)",
  },
  Faith: {
    accent: "#60A5FA",
    pill: "rgba(96,165,250,0.14)",
    bg: "linear-gradient(160deg,#082f5f 0%,#031326 100%)",
    quoteColor: "rgba(191,219,254,0.88)",
  },
  Prayer: {
    accent: "#A78BFA",
    pill: "rgba(167,139,250,0.14)",
    bg: "linear-gradient(160deg,#25145a 0%,#100622 100%)",
    quoteColor: "rgba(221,214,254,0.88)",
  },
  Grace: {
    accent: "#22C55E",
    pill: "rgba(34,197,94,0.14)",
    bg: "linear-gradient(160deg,#063d1e 0%,#03180d 100%)",
    quoteColor: "rgba(187,247,208,0.88)",
  },
  "Spiritual Growth": {
    accent: "#14B8A6",
    pill: "rgba(20,184,166,0.14)",
    bg: "linear-gradient(160deg,#043f3a 0%,#021716 100%)",
    quoteColor: "rgba(153,246,228,0.88)",
  },
  Deliverance: {
    accent: "#E879F9",
    pill: "rgba(232,121,249,0.14)",
    bg: "linear-gradient(160deg,#431047 0%,#1b061d 100%)",
    quoteColor: "rgba(245,208,254,0.88)",
  },
  Obedience: {
    accent: "#FACC15",
    pill: "rgba(250,204,21,0.14)",
    bg: "linear-gradient(160deg,#403700 0%,#171300 100%)",
    quoteColor: "rgba(254,249,195,0.88)",
  },
  Worship: {
    accent: "#FBBF24",
    pill: "rgba(251,191,36,0.14)",
    bg: "linear-gradient(160deg,#3b2600 0%,#170d00 100%)",
    quoteColor: "rgba(254,240,138,0.88)",
  },
  Accountability: {
    accent: "#F87171",
    pill: "rgba(248,113,113,0.14)",
    bg: "linear-gradient(160deg,#3a0000 0%,#1a0000 100%)",
    quoteColor: "rgba(254,202,202,0.85)",
  },
  Oppression: {
    accent: "#FB7185",
    pill: "rgba(251,113,133,0.14)",
    bg: "linear-gradient(160deg,#2d0a12 0%,#140006 100%)",
    quoteColor: "rgba(255,205,215,0.85)",
  },
  "True Worship": {
    accent: "#FBBF24",
    pill: "rgba(251,191,36,0.14)",
    bg: "linear-gradient(160deg,#2c2000 0%,#120e00 100%)",
    quoteColor: "rgba(254,240,138,0.85)",
  },
  "Judgment & Mercy": {
    accent: "#2DD4BF",
    pill: "rgba(45,212,191,0.14)",
    bg: "linear-gradient(160deg,#003033 0%,#001518 100%)",
    quoteColor: "rgba(153,246,228,0.85)",
  },
};

const INTERVAL_MS = 10000;
const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function slideKey(slide: Slide): string {
  return `${slide.theme}:${slide.sourceVideoId ?? slide.point}`.toLowerCase();
}

function isValidSlide(value: unknown): value is Slide {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Slide>;
  return Boolean(
    candidate.theme &&
    candidate.point &&
    candidate.quote &&
    candidate.ref &&
    typeof candidate.theme === "string" &&
    typeof candidate.point === "string" &&
    typeof candidate.quote === "string" &&
    typeof candidate.ref === "string",
  );
}

function spreadSlideThemes(slides: Slide[]): Slide[] {
  const buckets = new Map<string, Slide[]>();
  for (const slide of slides) {
    const bucket = buckets.get(slide.theme) ?? [];
    bucket.push(slide);
    buckets.set(slide.theme, bucket);
  }
  const output: Slide[] = [];
  while (buckets.size > 0) {
    const entries = [...buckets.entries()].sort((a, b) => b[1].length - a[1].length);
    let progressed = false;
    for (const [theme, bucket] of entries) {
      if (output.at(-1)?.theme === theme && entries.length > 1) continue;
      const next = bucket.shift();
      if (next) {
        output.push(next);
        progressed = true;
      }
      if (bucket.length === 0) buckets.delete(theme);
    }
    if (!progressed) {
      const [theme, bucket] = entries[0]!;
      const next = bucket.shift();
      if (next) output.push(next);
      if (bucket.length === 0) buckets.delete(theme);
    }
  }
  return output;
}

function buildSlideDeck(dynamicSlides: Slide[]): Slide[] {
  const seen = new Set<string>();
  const primary = dynamicSlides.filter((slide) => {
    const key = slideKey(slide);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const fallback = shuffleArray(SLIDES).filter((slide) => {
    const key = slideKey(slide);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return spreadSlideThemes([...shuffleArray(primary), ...fallback]).slice(0, 96);
}

// ─── Image asset maps ─────────────────────────────────────────────────────────
const webpModules = import.meta.glob(
  "../../../../attached_assets/webp/*.webp",
  { eager: true, query: "?url", import: "default" },
) as Record<string, string>;

const jpgModules = import.meta.glob(
  "../../../../attached_assets/*.jpg",
  { eager: true, query: "?url", import: "default" },
) as Record<string, string>;

interface ImageEntry { webp: string; jpg: string }
type FeaturedGalleryImage = {
  objectPath: string;
  thumbnailPath?: string | null;
  title?: string | null;
  altText?: string | null;
};

function buildImageEntries(): ImageEntry[] {
  const webpByBase: Record<string, string> = {};
  for (const [p, url] of Object.entries(webpModules)) {
    webpByBase[p.split("/").pop()!.replace(/\.webp$/, "")] = url;
  }
  const jpgByBase: Record<string, string> = {};
  for (const [p, url] of Object.entries(jpgModules)) {
    jpgByBase[p.split("/").pop()!.replace(/\.(jpg|jpeg)$/i, "")] = url;
  }
  return Object.keys(webpByBase)
    .filter((b) => jpgByBase[b])
    .map((b) => ({ webp: webpByBase[b], jpg: jpgByBase[b] }));
}

const ALL_IMAGES: ImageEntry[] = buildImageEntries();

function galleryImageUrl(objectPath: string) {
  return `${BASE_URL}/api/storage${objectPath}`;
}

function galleryEntries(images: FeaturedGalleryImage[]): ImageEntry[] {
  return images
    .filter((image) => typeof image.objectPath === "string" && image.objectPath.startsWith("/objects/"))
    .map((image) => {
      const fullSrc = galleryImageUrl(image.objectPath);
      // Use the WebP thumbnail as the preferred source if available — much smaller payload
      const thumbSrc = image.thumbnailPath ? galleryImageUrl(image.thumbnailPath) : fullSrc;
      return { webp: thumbSrc, jpg: fullSrc };
    });
}

type Orientation = "landscape" | "portrait";

// ─── Preload first slide ──────────────────────────────────────────────────────
function injectPreload(entry: ImageEntry) {
  if (document.querySelector("link[data-jctm-preload]")) return;
  const supportsWebP = document.createElement("canvas")
    .toDataURL("image/webp").startsWith("data:image/webp");
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = supportsWebP ? entry.webp : entry.jpg;
  link.dataset.jctmPreload = "1";
  document.head.appendChild(link);
}

// ─── <picture> wrapper that fills its container properly ─────────────────────
function MinistryImage({
  entry, alt, className, style, eager,
}: {
  entry: ImageEntry;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  eager?: boolean;
}) {
  return (
    // picture must be block & fill the container so img sizing classes work
    <picture style={{ display: "block", width: "100%", height: "100%" }}>
      <source
        type="image/webp"
        srcSet={`${entry.webp} 1920w`}
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 1920px"
      />
      <img
        src={entry.jpg}
        alt={alt}
        className={className}
        style={style}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={eager ? "high" : "auto"}
      />
    </picture>
  );
}

// ─── Sliding-window dot indicator (max 5 visible) ────────────────────────────
function SlideDots({
  total, current, accent,
}: {
  total: number; current: number; accent: string;
}) {
  const WINDOW = 5;
  const half = Math.floor(WINDOW / 2);
  let start = Math.max(0, current - half);
  const end = Math.min(total, start + WINDOW);
  start = Math.max(0, end - WINDOW);
  const visible = Array.from({ length: end - start }, (_, i) => start + i);

  return (
    <div className="flex items-center gap-1.5">
      {visible.map((i) => {
        const active = i === current;
        return (
          <motion.div
            key={i}
            animate={{ width: active ? 20 : 5, opacity: active ? 1 : 0.3 }}
            transition={{ duration: 0.28 }}
            className="h-1 rounded-full"
            style={{ background: active ? accent : "rgba(255,255,255,0.6)" }}
          />
        );
      })}
    </div>
  );
}

// ─── Caption content ──────────────────────────────────────────────────────────
function CaptionContent({
  slide, layout,
}: {
  slide: Slide; layout: "overlay" | "side";
}) {
  const th = THEME[slide.theme] ?? THEME["Spiritual Growth"];
  const isSide = layout === "side";
  return (
    <div className={isSide ? "flex flex-col justify-center h-full" : "text-center"}>
      {/* Theme pill */}
      <div className="mb-3 inline-flex">
        <span
          className="text-[10px] font-bold uppercase tracking-[0.18em] px-2.5 py-1 rounded-full"
          style={{ color: th.accent, background: th.pill }}
        >
          {slide.theme}
        </span>
      </div>

      {/* Sermon point */}
      <h2
        className={`font-serif font-bold leading-snug text-white mb-4 ${
          isSide ? "text-base sm:text-xl lg:text-2xl" : "text-xl sm:text-2xl md:text-3xl"
        }`}
        style={{ textShadow: isSide ? "none" : "0 2px 22px rgba(0,0,0,0.75)" }}
      >
        {slide.point}
      </h2>

      {/* Accent rule */}
      <div
        className={`h-px mb-4 rounded-full ${isSide ? "w-10" : "w-10 mx-auto"}`}
        style={{ background: `${th.accent}65` }}
      />

      {/* Scripture quote */}
      <p
        className={`font-serif italic leading-relaxed mb-2 ${
          isSide ? "text-xs sm:text-sm" : "text-sm sm:text-base"
        }`}
        style={{ color: th.quoteColor }}
      >
        "{slide.quote}"
      </p>

      {/* Reference */}
      <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: `${th.accent}CC` }}>
        — {slide.ref}
      </p>

      <p className={`text-white/25 text-[9px] uppercase tracking-widest ${isSide ? "mt-5 hidden sm:block" : "mt-3"}`}>
        {slide.sourceTitle ? "From Temple TV Sermons · JCTM Warri" : "Jesus Christ Temple Ministry · Warri, Nigeria"}
      </p>
    </div>
  );
}

function SlideCaption({ slide, slideIdx, layout }: { slide: Slide; slideIdx: number; layout: "overlay" | "side" }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${slideIdx}-${slideKey(slide)}`}
        initial={{ opacity: 0, y: layout === "overlay" ? 18 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: layout === "overlay" ? -12 : -6 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <CaptionContent slide={slide} layout={layout} />
      </motion.div>
    </AnimatePresence>
  );
}

const SYNC_INTERVAL_MS = 3 * 60 * 1000; // re-fetch featured images every 3 minutes

// ─── Main component ───────────────────────────────────────────────────────────
export function MinistrySlideshow() {
  const [shuffled, setShuffled] = useState<ImageEntry[]>([]);
  const [imgIdx, setImgIdx]     = useState(0);
  const [slideIdx, setSlideIdx] = useState(0);
  const [slides, setSlides]     = useState<Slide[]>(() => buildSlideDeck([]));
  const [orientations, setOrientations] = useState<Record<string, Orientation>>({});

  const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const preloadedRef   = useRef(false);
  const lastKeyRef     = useRef<string>("");   // tracks last-seen image set for diffing
  const lastSlideKeyRef = useRef<string>("");
  const initializedRef = useRef(false);

  // ── Fetch + smart-update featured images ─────────────────────────────────
  const fetchFeatured = useCallback(async (isInitial = false) => {
    let entries: ImageEntry[] = ALL_IMAGES;
    try {
      const res = await fetch(`${BASE_URL}/api/gallery/featured`, {
        // bypass cache so polling always reflects latest admin changes
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const dynamicEntries = galleryEntries(data as FeaturedGalleryImage[]);
          if (dynamicEntries.length > 0) entries = dynamicEntries;
        }
      }
    } catch {
      // on error keep entries = ALL_IMAGES (fallback to static assets)
    }

    // Smart diff — only reshuffle when the image set actually changed
    const key = entries.map(e => e.jpg).join(",");
    if (key === lastKeyRef.current && !isInitial) return;
    lastKeyRef.current = key;

    const s = shuffleArray(entries);
    setShuffled(s);

    if (isInitial) {
      setSlideIdx(Math.floor(Math.random() * SLIDES.length));
      if (s.length > 0 && !preloadedRef.current) {
        preloadedRef.current = true;
        injectPreload(s[0]);
      }
    } else {
      setImgIdx(0);
    }
  }, []);

  const fetchTeachingPoints = useCallback(async (isInitial = false) => {
    try {
      const res = await fetch(`${BASE_URL}/api/sermons/teaching-points?limit=60`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json() as TeachingPointsResponse;
      const dynamicSlides = Array.isArray(data.points) ? data.points.filter(isValidSlide) : [];
      if (dynamicSlides.length === 0) return;

      const key = dynamicSlides.map(slideKey).join("|");
      if (key === lastSlideKeyRef.current && !isInitial) return;
      lastSlideKeyRef.current = key;

      const nextDeck = buildSlideDeck(dynamicSlides);
      setSlides(nextDeck);
      setSlideIdx((current) => isInitial ? Math.floor(Math.random() * nextDeck.length) : current % nextDeck.length);
    } catch {
      if (isInitial) setSlides(buildSlideDeck([]));
    }
  }, []);

  // ── Initialise once ──────────────────────────────────────────────────────
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    fetchFeatured(true);
    fetchTeachingPoints(true);

    // Poll every 3 minutes for new featured images added by admins
    const syncTimer = setInterval(() => {
      fetchFeatured(false);
      fetchTeachingPoints(false);
    }, SYNC_INTERVAL_MS);

    // Also refresh immediately when the tab regains focus
    const handleVisibility = () => {
      if (!document.hidden) {
        fetchFeatured(false);
        fetchTeachingPoints(false);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const galleryEvents = new EventSource(`${BASE_URL}/api/gallery/stream`);
    galleryEvents.addEventListener("gallery_updated", () => {
      fetchFeatured(false);
    });
    galleryEvents.onerror = () => {};

    const sermonEvents = new EventSource(`${BASE_URL}/api/sermons/stream`);
    sermonEvents.addEventListener("new_sermon", () => {
      fetchTeachingPoints(false);
    });
    sermonEvents.addEventListener("sync_complete", () => {
      fetchTeachingPoints(false);
    });
    sermonEvents.onerror = () => {};

    return () => {
      clearInterval(syncTimer);
      document.removeEventListener("visibilitychange", handleVisibility);
      galleryEvents.close();
      sermonEvents.close();
    };
  }, [fetchFeatured, fetchTeachingPoints]);

  // ── Orientation detection + background preload ───────────────────────────
  const detectOrientation = useCallback((entry: ImageEntry) => {
    setOrientations((prev) => {
      if (prev[entry.webp]) return prev;
      const img = new Image();
      img.onload = () => {
        const o: Orientation = img.naturalWidth >= img.naturalHeight ? "landscape" : "portrait";
        setOrientations((p) => ({ ...p, [entry.webp]: o }));
      };
      img.src = entry.webp;
      return prev;
    });
  }, []);

  useEffect(() => {
    if (!shuffled.length) return;
    [0, 1, 2, 3].forEach((offset) => {
      const e = shuffled[(imgIdx + offset) % shuffled.length];
      if (e) {
        detectOrientation(e);
        if (offset > 0) { const i = new Image(); i.src = e.webp; }
      }
    });
  }, [imgIdx, shuffled, detectOrientation]);

  // ── Auto-advance (always running — no pause) ─────────────────────────────
  useEffect(() => {
    if (!shuffled.length || !slides.length) return;
    intervalRef.current = setInterval(() => {
      setImgIdx((i)   => (i   + 1) % shuffled.length);
      setSlideIdx((s) => (s   + 1) % slides.length);
    }, INTERVAL_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [shuffled, slides.length]);

  const currentEntry = shuffled[imgIdx];
  const orientation  = currentEntry ? (orientations[currentEntry.webp] ?? "landscape") : "landscape";
  const isPortrait   = orientation === "portrait";
  const slide        = slides[slideIdx % slides.length] ?? SLIDES[0]!;
  const theme        = THEME[slide.theme] ?? THEME["Spiritual Growth"];
  const isEager      = imgIdx < 2;

  if (!shuffled.length || !currentEntry) return null;

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl shadow-2xl"
      style={{ minHeight: 460, maxHeight: 720, height: "62vw" }}
    >
      {/* ── Slide content ─────────────────────────────────────────────── */}
      <AnimatePresence mode="sync">
        {isPortrait ? (
          /* Portrait — two columns on md+, stacked on mobile */
          <motion.div
            key={`p-${currentEntry.webp}`}
            className="absolute inset-0 flex flex-col sm:flex-row"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.85, ease: "easeInOut" }}
          >
            {/* Image column */}
            <motion.div
              className="relative flex items-center justify-center overflow-hidden"
              style={{ background: "#07101e" }}
              /* On mobile: fixed portrait height; on sm+: 45% width full height */
              initial={{ x: -14, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Blurred backdrop */}
              <div className="absolute inset-0 overflow-hidden">
                <MinistryImage
                  entry={currentEntry} alt=""
                  className="absolute inset-0 w-full h-full object-cover scale-110"
                  style={{ filter: "blur(22px) brightness(0.25) saturate(1.4)" }}
                  eager={isEager}
                />
              </div>
              {/* Full portrait — no cropping */}
              <div className="relative z-10 w-full h-full">
                <MinistryImage
                  entry={currentEntry}
                  alt="JCTM Ministry — full portrait view"
                  className="w-full h-full object-contain"
                  style={{ padding: "10px", filter: "brightness(1.06) contrast(1.02) saturate(1.1)" }}
                  eager={isEager}
                />
              </div>
              {/* Accent divider */}
              <div
                className="absolute inset-y-0 right-0 w-px hidden sm:block"
                style={{ background: `linear-gradient(to bottom, transparent, ${theme.accent}55, transparent)` }}
              />
            </motion.div>

            {/* Caption column — scrollable on very small heights */}
            <div
              className="relative flex flex-col justify-center overflow-y-auto"
              style={{ background: theme.bg, flex: "0 0 55%", minWidth: 0 }}
            >
              {/* Dot texture */}
              <div
                className="absolute inset-0 opacity-[0.032] pointer-events-none"
                style={{
                  backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)",
                  backgroundSize: "26px 26px",
                }}
              />
              <div className="relative z-10 px-6 sm:px-9 py-7">
                <SlideCaption slide={slide} slideIdx={slideIdx} layout="side" />
              </div>
            </div>
          </motion.div>
        ) : (
          /* Landscape — full-width image with bottom text overlay */
          <motion.div
            key={`l-${currentEntry.webp}`}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.85, ease: "easeInOut" }}
          >
            {/* Blurred backdrop */}
            <div className="absolute inset-0 overflow-hidden">
              <MinistryImage
                entry={currentEntry} alt=""
                className="absolute inset-0 w-full h-full object-cover scale-110"
                style={{ filter: "blur(20px) brightness(0.32) saturate(1.5)" }}
                eager={isEager}
              />
            </div>
            {/* Main image — full, no cropping */}
            <motion.div
              className="absolute inset-0"
              initial={{ scale: 1.03 }}
              animate={{ scale: 1 }}
              transition={{ duration: 6, ease: "linear" }}
            >
              <MinistryImage
                entry={currentEntry}
                alt="JCTM Ministry"
                className="w-full h-full object-contain"
                style={{ filter: "brightness(1.07) contrast(1.03) saturate(1.12)" }}
                eager={isEager}
              />
            </motion.div>
            {/* Bottom gradient */}
            <div
              className="absolute inset-x-0 bottom-0 pointer-events-none"
              style={{ height: "68%", background: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.52) 40%, transparent 100%)" }}
            />
            {/* Top vignette */}
            <div
              className="absolute inset-x-0 top-0 h-20 pointer-events-none"
              style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.30) 0%, transparent 100%)" }}
            />
            {/* Caption */}
            <div className="absolute inset-x-0 bottom-0 px-7 sm:px-14 pb-10 sm:pb-12">
              <SlideCaption slide={slide} slideIdx={slideIdx} layout="overlay" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Progress bar ──────────────────────────────────────────────── */}
      <div className="absolute top-0 inset-x-0 h-0.5 z-40 bg-white/10 pointer-events-none">
        <AnimatePresence>
          <motion.div
            key={imgIdx}
            className="h-full rounded-r-full"
            style={{ background: theme.accent }}
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: INTERVAL_MS / 1000, ease: "linear" }}
          />
        </AnimatePresence>
      </div>

      {/* ── Bottom bar: dots ──────────────────────────── */}
      <div className="absolute bottom-3 inset-x-0 flex items-center justify-center z-40 pointer-events-none">
        <SlideDots total={slides.length} current={slideIdx % slides.length} accent={theme.accent} />
      </div>
    </div>
  );
}

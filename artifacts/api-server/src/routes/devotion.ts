import { Router, type IRouter, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, devotionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

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
- Draw from KJV/NKJV scriptures — explore the FULL breadth of scripture: Old Testament (Torah, Prophets, Psalms, Wisdom books), Epistles, Gospels, Revelation
- Focus on practical holiness, faith, and doctrinal truth
- Avoid prosperity gospel themes
- Write with warmth, depth, and pastoral care
- Connect the devotion to everyday Nigerian and global Christian life
- Each devotion must feel entirely fresh and distinct from every previous devotion — unique title, unique scripture, unique angle
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
    scripture: "The LORD will fight for you; you need only to be still.",
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
    scripture: "Pray without ceasing.",
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
  {
    title: "Repentance Opens the Door to Restoration",
    scripture:
      "If we confess our sins, he is faithful and just to forgive us our sins, and to cleanse us from all unrighteousness.",
    reference: "1 John 1:9",
    reflection:
      "Repentance is not a sign of weakness — it is the doorway into God's fullness. The enemy works hard to keep believers from this doorway, convincing them that their failures disqualify them, that God is too disappointed, or that confession is unnecessary. But the Word of God dismantles every lie: He is faithful and just to forgive.\n\nTrue repentance is not merely feeling sorry — it is a genuine turning. A turning away from what grieved God and a turning toward His purpose. And when that turning happens, heaven responds with restoration. Cleansing, not just forgiveness. Renewal, not merely pardon. God's grace is not just a covering — it is a transformation.\n\nIf something in your heart has been keeping you from full freedom, bring it to God today. He already knows. He is not waiting to condemn — He is waiting to restore. The door of repentance is always open, and on the other side is everything you were made to walk in.",
    propheticWord:
      "Come to Me as you are — I will not turn you away. My arms are open and My grace is sufficient. As you humble yourself before Me, I will lift you and restore what the enemy has stolen. This is a season of restoration for those who return to Me with a whole heart.",
    prayerFocus:
      "Lord, search my heart and reveal anything that separates me from Your fullness. I choose to confess and turn — receive me and cleanse me now.",
    declaration:
      "I am forgiven, cleansed, and fully restored — God's grace covers me completely, and I walk in the freedom of His mercy today.",
  },
  {
    title: "The Holy Spirit Is Your Counsellor",
    scripture:
      "But the Comforter, which is the Holy Ghost, whom the Father will send in my name, he shall teach you all things.",
    reference: "John 14:26",
    reflection:
      "Before Jesus departed, He made a promise that would change everything for the disciples — and for every believer who has followed since. He would not leave us alone. The Holy Spirit — the Comforter, the Helper, the Counsellor — would come and take up residence in every yielded heart.\n\nIn a world full of noise, opinions, and conflicting counsel, the believer has access to the perfect Counsellor. He knows the mind of God, the plan of God, and the purpose of God for your life. When you are confused, He brings clarity. When you are grieving, He brings comfort. When you are weak, He brings strength that defies natural explanation.\n\nBut the Holy Spirit is not a vending machine dispensing guidance on demand — He is a Person. A holy, gentle, powerful Person who is grieved by sin and ignited by surrender. Cultivate sensitivity to Him today. Slow down enough to hear His whisper. He is speaking — the question is whether we are listening.",
    propheticWord:
      "I have not left you without a guide. My Spirit is within you, ready to lead you into all truth. Do not rely solely on human wisdom — ask Me and I will show you things you have not yet seen. This is the hour of the Spirit, and those who yield to Me will walk in unusual clarity and power.",
    prayerFocus:
      "Holy Spirit, fill me afresh today. Teach me to be sensitive to Your leading, to hear Your voice above all others, and to obey Your promptings without delay.",
    declaration:
      "The Holy Spirit lives in me, guides me, and empowers me — I am never alone, never without counsel, and never without the strength I need today.",
  },
  {
    title: "You Are a New Creation in Christ",
    scripture:
      "Therefore, if anyone is in Christ, he is a new creation. The old has passed away; behold, the new has come.",
    reference: "2 Corinthians 5:17",
    reflection:
      "This is one of the most radical declarations in all of Scripture. Not improved — new. Not reformed — recreated. The word Paul uses speaks of something that has never existed before. When God saves a soul, He does not patch up the old nature with religious behaviour; He creates something entirely new from the inside out.\n\nThe challenge for many believers is that they continue to live according to the old identity long after it has been replaced. They carry guilt that no longer belongs to them, limitations that no longer define them, and labels that no longer apply. The enemy counts on this. He wants you to forget who you became when you came to Christ.\n\nYou are not who you used to be. Your past does not have the final word. The same power that raised Jesus from the dead lives in you, and it has made you new. Walk in that newness today. Speak it. Believe it. Let it shape every thought, every choice, every interaction.",
    propheticWord:
      "I have made you new — walk in that truth. Stop reaching back for the old garment; I have clothed you in righteousness and covered you with My grace. The old self has no authority over the new creation I have made you. Rise and live as who you truly are in Me.",
    prayerFocus:
      "Lord, help me to fully embrace my identity as a new creation. Where my mind tries to pull me back to the old, remind me of who I am in Christ.",
    declaration:
      "I am a new creation in Christ — the old has gone, the new has come, and I live today from the fullness of who God has made me.",
  },
  {
    title: "God's Strength Is Perfect in Weakness",
    scripture:
      "And he said unto me, My grace is sufficient for thee: for my strength is made perfect in weakness.",
    reference: "2 Corinthians 12:9",
    reflection:
      "Paul's thorn in the flesh is one of the most misunderstood passages in the New Testament. We often read it looking for the diagnosis — but God's answer tells us what really matters: not the removal of the weakness, but the revelation of His sufficiency within it. My grace is sufficient. My strength is made perfect in weakness.\n\nWe live in a world that glorifies strength, achievement, and self-sufficiency. But the Kingdom of God operates on a different currency — surrender. The more you acknowledge your dependence on God, the more room there is for His power to operate. Pride fills a room with self; humility empties it for God.\n\nWhatever weakness you are carrying today — physical, emotional, spiritual — do not be ashamed of it. Bring it to the Lord as an altar. Say, 'God, I cannot. But You can.' And watch how His strength shows up in precisely the place where you felt most inadequate.",
    propheticWord:
      "Your weakness is not a disqualification — it is an invitation for My glory. Where you feel most insufficient, I am most present. Do not hide your need from Me; bring it as an offering and I will turn it into a testimony. My power is most visible through surrendered vessels.",
    prayerFocus:
      "Lord, I surrender my weakness to You today. Where I am not enough, let Your grace be sufficient. Work through my limitations for Your glory.",
    declaration:
      "God's strength is perfected in my weakness — I am strong in Him, sufficient through His grace, and more than capable through His power today.",
  },
  {
    title: "The Cross Is the Center of Everything",
    scripture:
      "For I determined not to know any thing among you, save Jesus Christ, and him crucified.",
    reference: "1 Corinthians 2:2",
    reflection:
      "The Apostle Paul, a man of extraordinary intellect and education, deliberately chose to center everything on one message: Christ crucified. Not philosophy, not eloquence, not strategic persuasion — just the cross. This was not simplicity born from ignorance; it was clarity born from revelation. The cross is not a starting point to graduate from — it is the permanent center of all Christian life.\n\nThe cross declares three things simultaneously: the depth of human sin, the height of divine love, and the totality of Christ's victory. Every blessing we enjoy, every prayer that is answered, every soul that is saved — it all flows from what happened on Calvary. We never move beyond the cross; we move deeper into it.\n\nIn a generation that is distracted by signs, spectacle, and social media Christianity, JCTM's Correction Mandate calls the body of Christ back to the cross. Let your life today be shaped by Calvary — its humility, its love, its radical obedience, its complete surrender.",
    propheticWord:
      "The cross is still the power of God. Do not be ashamed of it, do not dilute it, and do not add to it. I am calling My people back to the simplicity and power of Calvary — for it is there that every chain is broken and every yoke is destroyed. Preach the cross. Live the cross. The cross is enough.",
    prayerFocus:
      "Lord, keep the cross at the center of my life and my faith. Let the love demonstrated at Calvary be the lens through which I see everything.",
    declaration:
      "The cross of Christ is my foundation, my power, and my boast — I live today fully surrendered to the One who gave everything for me.",
  },
  {
    title: "Spiritual Armor Protects the Surrendered",
    scripture:
      "Put on the whole armour of God, that ye may be able to stand against the wiles of the devil.",
    reference: "Ephesians 6:11",
    reflection:
      "Paul's instruction to put on the full armor of God assumes one crucial thing: that there is a real enemy who wages real warfare against real believers. Spiritual warfare is not a metaphor for difficult circumstances — it is a genuine battle in the unseen realm with genuine consequences. The believer who ignores this reality is the one most vulnerable to the enemy's attacks.\n\nEach piece of the armor Paul describes is not passive equipment — it is active positioning. The belt of truth means you are committed to honest living. The breastplate of righteousness means your heart is guarded by right standing with God. The shield of faith means you actively choose to believe God's Word over the enemy's accusations.\n\nDress for the battle every day. Not in fear, but in faith. Not in anxiety, but in authority. The Christian who stands fully armored is the one who stands — when everyone around them has fallen, when the pressure intensifies, when the enemy sends his worst. You are more than a conqueror — but only if you are clothed.",
    propheticWord:
      "The enemy has targeted you precisely because you carry something of value for My Kingdom. Do not be alarmed — be armored. I have given you authority over all the power of the enemy. Stand in that authority today and the gates of hell will not prevail against you.",
    prayerFocus:
      "Lord, help me to be fully dressed in Your armor today. Make me alert to the enemy's strategies and rooted in Your authority as I stand firm.",
    declaration:
      "I am fully armored in God's strength — I stand firm against every strategy of the enemy, and no weapon formed against me will prosper today.",
  },
  {
    title: "Worship Breaks Every Chain",
    scripture:
      "And at midnight Paul and Silas prayed, and sang praises unto God: and the prisoners heard them. And suddenly there was a great earthquake.",
    reference: "Acts 16:25-26",
    reflection:
      "Paul and Silas were not worshipping because their circumstances were comfortable — they were worshipping at midnight, with backs bleeding from flogging and feet in stocks. Their praise was not a response to answered prayer; it was a declaration of faith in the middle of unanswered questions. And heaven shook.\n\nWorship is the most powerful weapon available to the believer, and it is also the most counterintuitive one. When circumstances scream hopelessness, the natural response is silence or complaint. But the supernatural response — the Kingdom response — is to lift a song. To declare God's goodness before the evidence arrives. To praise your way through the prison walls.\n\nWhat midnight are you in right now? What situation has you feeling bound, restricted, or helpless? Begin to worship — not because you feel like it, but because God is worthy regardless of how you feel. History is full of testimonies that began with midnight praise. Add yours today.",
    propheticWord:
      "Praise is the language of victory, and I am calling you to speak it now — before you see the breakthrough. The sound of your worship reaches Me, and I am responding. As you praise, chains are breaking in the unseen realm. Do not stop; your deliverance is on the other side of your praise.",
    prayerFocus:
      "Lord, teach me to worship You in the middle of difficulty. Let praise rise from my spirit even when my soul is heavy and my circumstances are dark.",
    declaration:
      "I worship God in every season — in the midnight hours and the morning light — and my praise releases the power of heaven into my situation today.",
  },
  {
    title: "Forgiveness Frees the One Who Gives It",
    scripture:
      "And forgive us our debts, as we forgive our debtors.",
    reference: "Matthew 6:12",
    reflection:
      "Jesus links our reception of forgiveness to our extension of it — not because God's grace is conditional, but because unforgiveness builds a wall that blocks the flow of grace in our own hearts. A person who holds bitterness tightly does not only wound the one they refuse to forgive — they wound themselves far more deeply, day after day.\n\nForgiveness is not minimising the hurt. It is not saying what happened was acceptable. It is releasing your right to revenge and entrusting justice to God. It is cutting the cord that ties your emotional wellbeing to the actions of someone who may never apologise, never change, and never acknowledge the damage they caused.\n\nWho do you need to forgive today? Who has your heart locked up in a cell of resentment? The keys to that cell are forgiveness. And when you open that door, you will find — counterintuitively — that the one who walks out free is you. Unforgiveness is a poison; forgiveness is its antidote.",
    propheticWord:
      "I have forgiven you of a debt you could never repay. Now I am asking you to pass that gift forward. Release the one who wronged you — not for their sake alone, but for the sake of your own freedom. As you forgive, I will release a peace in your heart that surpasses all understanding.",
    prayerFocus:
      "Lord, help me to genuinely forgive those who have hurt me. Remove every root of bitterness and replace it with the peace that only comes from releasing others.",
    declaration:
      "I choose to forgive freely and fully — I release every offence, walk in peace, and experience the freedom that forgiveness brings to my own heart.",
  },
  {
    title: "Faith That Moves Mountains Starts Small",
    scripture:
      "And Jesus said unto them, Because of your unbelief: for verily I say unto you, If ye have faith as a grain of mustard seed, ye shall say unto this mountain, Remove hence to yonder place; and it shall remove.",
    reference: "Matthew 17:20",
    reflection:
      "The mustard seed is the smallest of all seeds, yet Jesus chose it as His illustration of mountain-moving faith. This tells us something profound: the size of your faith is less important than the source of your faith. Faith in a big God — even the tiniest, most sincere faith — carries world-altering power.\n\nMany believers are waiting until they have enough faith before they pray boldly, speak boldly, or act boldly. But Jesus says the seed is already sufficient. The problem is not insufficiency of faith — it is often the presence of unbelief competing alongside the faith we do have. We believe and doubt simultaneously, and the doubt drowns the voice of the faith.\n\nToday, act on the faith you have — even if it is small. Speak to your mountain. Pray for the impossible. Trust God with the thing that seems beyond reach. Your seed of faith is enough — because it is connected to a God who is more than enough.",
    propheticWord:
      "I am not waiting for you to have great faith — I am waiting for you to use the faith you have. Plant your seed of belief today, and I will cause it to grow. The mountain you are facing has already been moved in the Spirit realm; now agree with what I have done and watch it manifest.",
    prayerFocus:
      "Lord, help me to act on the faith I have rather than waiting for more. Silence the unbelief in my heart and let even my smallest trust produce great results.",
    declaration:
      "My faith moves mountains — not because of its size, but because of the God it is placed in, and today I speak to my mountain with confidence.",
  },
  {
    title: "God's Word Does Not Return Void",
    scripture:
      "So shall my word be that goeth forth out of my mouth: it shall not return unto me void, but it shall accomplish that which I please.",
    reference: "Isaiah 55:11",
    reflection:
      "Every word that God speaks carries within it the power to accomplish its own purpose. This is not true of human words — we can speak promises and fail to keep them, declare plans and abandon them. But God's Word is categorically different. It goes out loaded with divine energy and does not return until it has done what God intended.\n\nThis truth should radically change how we engage with Scripture. When you declare a promise from God's Word over your life, you are not performing a religious ritual — you are releasing a force. When you stand on a verse in prayer, you are standing on something that has never failed and will never fail. God's Word is alive, active, and always working.\n\nWhatever Word you have received — from Scripture, from the Spirit, from the mouth of a servant of God — do not abandon it simply because time has passed. God's Word is still working, still moving, still accomplishing. Wait for it. It will not return void.",
    propheticWord:
      "Every word I have spoken over your life is still working. Do not discard what I said in times of breakthrough just because the season has shifted. My Word is alive in your situation, and it is accomplishing My perfect will. Stand on what I have said — the harvest of My Word is coming.",
    prayerFocus:
      "Lord, help me to trust the power of Your Word. Where I am tempted to doubt or give up, remind me that Your promises are always in motion and never return empty.",
    declaration:
      "God's Word over my life is active and powerful — it is accomplishing His purposes, and I stand confidently on every promise He has spoken.",
  },
  {
    title: "Abide in the Vine, Bear Much Fruit",
    scripture:
      "I am the vine, ye are the branches: He that abideth in me, and I in him, the same bringeth forth much fruit: for without me ye can do nothing.",
    reference: "John 15:5",
    reflection:
      "In a single verse, Jesus both invites and humbles. He invites us into the most fruitful kind of life — one that is connected to Him, drawing from Him, and producing through Him. But He also strips away every illusion of independent spiritual productivity: without Me, you can do nothing. Not a little — nothing.\n\nThe branch does not strain to produce fruit. It does not need a training programme or a strategy. It simply remains connected to the vine, and fruit is the natural result. When a branch is connected, the life of the vine flows through it without effort. The work of the believer is not to produce fruit — it is to abide.\n\nAbiding looks like daily time in the Word. It looks like prayer as a lifestyle, not a duty. It looks like keeping your spirit soft toward God, your ear open to the Spirit, and your heart surrendered to His purposes. The fruit will come. Abide first.",
    propheticWord:
      "Stay connected to Me and the fruit will be abundant. I am not asking you to produce — I am asking you to remain. Those who abide in Me will bear fruit that remains, fruit that blesses nations, fruit that outlasts their generation. Do not strive; abide. The rest belongs to Me.",
    prayerFocus:
      "Lord, teach me the art of abiding. Let my relationship with You be the well from which everything else in my life flows — not striving, but resting in You.",
    declaration:
      "I abide in Christ the Vine — His life flows through me, His fruit grows in me, and everything I produce today comes from that unbroken connection.",
  },
  {
    title: "The Name of Jesus Is Your Stronghold",
    scripture: "The name of the LORD is a strong tower: the righteous runneth into it, and is safe.",
    reference: "Proverbs 18:10",
    reflection:
      "In ancient times, a strong tower was a place of refuge when enemy armies approached. The residents would flee from the open fields — where they were vulnerable — into the fortified walls that could withstand assault. The Proverb writer paints this same image for the believer: the Name of the Lord is that tower.\n\nThe Name of Jesus is not a slogan or a lucky charm. It is the full weight of who He is — His authority, His power, His covenant, His finished work. When you call on His Name in faith, you are not throwing a word into the air. You are stepping under the protection of the most powerful Person in the universe.\n\nRun to that Name today. Not because your situation is small, but because He is greater. Whatever is pressing against you — fear, sickness, confusion, spiritual attack — run into the Name of Jesus. That Name has never failed, and it will not fail you now.",
    propheticWord:
      "My Name is your refuge and your weapon. Call on it in faith and I will answer. The enemy flees at the mention of My Name, and every chain dissolves in My presence. Do not be afraid to run to Me — I am your strong tower, and you are safe here.",
    prayerFocus:
      "Lord, teach me to run to Your Name as my first response, not my last resort. Let the Name of Jesus be the word that rises in my heart in every moment of pressure.",
    declaration:
      "The Name of Jesus is my strong tower — I run to it freely, I stand safely within it, and every enemy must bow before that Name today.",
  },
  {
    title: "Sound Doctrine Is a Shield, Not a Cage",
    scripture:
      "Till we all come in the unity of the faith, and of the knowledge of the Son of God, unto a perfect man, unto the measure of the stature of the fulness of Christ.",
    reference: "Ephesians 4:13",
    reflection:
      "We live in a generation that is suspicious of doctrine — where theological precision is mistaken for cold orthodoxy and where feelings are elevated above truth. But the Correction Mandate that shapes JCTM's ministry consistently points to a different reality: sound doctrine is not the enemy of spiritual life, it is the guardian of it.\n\nWithout sound doctrine, faith has no anchor. Prayer has no direction. Worship has no object. A church without doctrinal clarity is like a ship without a rudder — moved by every wave of popular sentiment and carried wherever culture dictates. The result is believers who are sincere but spiritually confused.\n\nKnowledge of the Son of God — deep, accurate, scripture-grounded knowledge — produces spiritual maturity. It produces the 'perfect man' Paul describes: one who is not tossed around by every new teaching but stands firm in the fullness of who Christ is. Pursue truth today, not as an intellectual exercise, but as an act of love for the One who is the Truth.",
    propheticWord:
      "Guard the truth that has been delivered to you. In this hour of deception, those who are rooted in My Word will not be moved by the winds of false doctrine. I am raising up a people who love truth — not only in feeling, but in knowledge. The depth of your doctrine is the depth of your protection.",
    prayerFocus:
      "Lord, give me a love for sound doctrine and a heart that pursues truth. Protect me from deception and root me deeper in the knowledge of who You truly are.",
    declaration:
      "I am rooted in sound doctrine and the truth of God's Word — I am not moved by false teaching, and I grow into the full stature of Christ every day.",
  },
  {
    title: "Gratitude Is the Language of a Living Faith",
    scripture:
      "In every thing give thanks: for this is the will of God in Christ Jesus concerning you.",
    reference: "1 Thessalonians 5:18",
    reflection:
      "Paul does not say give thanks for everything — he says give thanks in everything. There is a profound difference. We are not commanded to be grateful for suffering as if it were a gift. We are commanded to maintain a posture of gratitude within every circumstance, trusting that the God who is present in our hardest moments is still sovereign and still good.\n\nGratitude is a discipline before it is a feeling. It is a choice — often a hard one — to see what God has done rather than fixating on what He has not yet done. It is a reorientation of perspective from the problem in front of you to the Provider behind the problem.\n\nWhen gratitude becomes a lifestyle, something shifts in the spirit. The complaints that once consumed hours of mental energy lose their power. The anxiety that once defined mornings gives way to a quiet trust. Start with what you know: you are alive, you are forgiven, you are loved. That is always enough to begin with.",
    propheticWord:
      "Thankfulness is the atmosphere where My glory dwells. As you cultivate gratitude, you will begin to see the many ways I have been at work that you have overlooked. A grateful heart is an open heaven. Begin today with thanksgiving and watch how your perspective and your circumstances begin to align with My purposes.",
    prayerFocus:
      "Lord, teach me to be genuinely thankful in every situation. Shift my focus from what I lack to the abundance of what You have already given me.",
    declaration:
      "I give thanks in every circumstance — my gratitude is an act of faith, an open door for God's glory, and my constant posture before Him today.",
  },
  {
    title: "Consecration Sets You Apart for Purpose",
    scripture:
      "But ye are a chosen generation, a royal priesthood, an holy nation, a peculiar people; that ye should shew forth the praises of him who hath called you out of darkness.",
    reference: "1 Peter 2:9",
    reflection:
      "Peter addresses ordinary, scattered, persecuted believers and calls them a royal priesthood. Not because of their social status or natural qualifications, but because of who called them. In God's economy, the calling defines the identity — and the identity demands a corresponding lifestyle of consecration.\n\nTo be set apart is not to be isolated from the world — it is to be distinct within it. Like a lamp in a dark room, the believer's consecration does not remove them from darkness; it makes them visible in it. The world needs to see something different, something that cannot be explained by natural talent or cultural conditioning. That something is holiness.\n\nThe Correction Mandate carries this call at its core. JCTM was raised to declare that the Church must look different from the world — not in petty external conformity, but in the deep internal transformation that only the Holy Spirit produces. You are set apart for a purpose larger than comfort. Walk in it today.",
    propheticWord:
      "I have not called you to blend in — I have called you to shine. Your distinctiveness is not a social disadvantage; it is a spiritual weapon. As you walk in consecration, you will carry My presence into every room you enter, and lives will be changed. Do not shrink your calling to fit your culture.",
    prayerFocus:
      "Lord, help me to fully embrace my identity as one who is set apart for Your purposes. Give me the courage to live differently and the grace to love those I am sent to reach.",
    declaration:
      "I am chosen, set apart, and consecrated for God's purposes — I carry His presence everywhere I go and I shine His light in every dark place today.",
  },
  {
    title: "Fasting Sharpens Spiritual Sensitivity",
    scripture:
      "Is not this the fast that I have chosen? to loose the bands of wickedness, to undo the heavy burdens, and to let the oppressed go free?",
    reference: "Isaiah 58:6",
    reflection:
      "Fasting in its truest form is not an act of self-punishment or religious performance — it is a strategic spiritual discipline that realigns the believer's entire being toward God. When we fast, we are declaring with our bodies what we believe in our spirits: that God is more essential than physical sustenance. That the unseen is more real than the seen.\n\nThe prophet Isaiah describes the kind of fast God endorses: one that is connected to justice, compassion, and the loosening of oppressive chains. This is not merely abstaining from food — it is a posture of the whole person toward the Kingdom of God. Heart, hands, and hunger all yielded together.\n\nFasting sharpens prophetic sensitivity. It quietens the noise of the flesh and amplifies the voice of the Spirit. Throughout JCTM's history, seasons of fasting have preceded seasons of significant breakthrough. The spiritual atmosphere changes when God's people fast. Consider adding this discipline to your spiritual life — not as legalism, but as love.",
    propheticWord:
      "When you fast, I take notice. There is a breakthrough awaiting the believer who will deny themselves and press into My presence with consecration. This is the season to fast and pray — chains are being broken, captives are being freed, and the atmosphere over your life is shifting as you seek My face.",
    prayerFocus:
      "Lord, give me a heart that desires to seek You with fasting and prayer. Let my seasons of fasting be genuine acts of love and surrender, not religious performance.",
    declaration:
      "I yield my whole self to God — spirit, soul, and body — and as I consecrate my life through prayer and fasting, chains break and breakthroughs come.",
  },
  {
    title: "God Sees What Men Cannot",
    scripture:
      "For the LORD seeth not as man seeth; for man looketh on the outward appearance, but the LORD looketh on the heart.",
    reference: "1 Samuel 16:7",
    reflection:
      "When God sent Samuel to anoint a king from Jesse's sons, He rejected the tall, impressive, eldest son and chose the youngest — the shepherd boy who was not even invited to the gathering. David was overlooked by his own family. But God saw something in him that human eyes could not perceive.\n\nThis truth carries enormous comfort and significant accountability. Comfort, because God's assessment of you is not based on outward appearance, social standing, or the opinions of others. Those who have been overlooked, underestimated, or dismissed by people are seen fully and accurately by a God who judges by the heart. Accountability, because that same God who sees your public ministry also sees your private life — and finds them equally important.\n\nLet the gaze of God reorient you today. Stop performing for human approval and start living for divine pleasure. The one who truly lives for an audience of One will discover that God's affirmation is worth infinitely more than any human recognition.",
    propheticWord:
      "I have seen you — not as others see you, but as you truly are. I see the faithfulness in your private moments, the tears no one else has witnessed, and the obedience that went unacknowledged. I am the God who rewards what is done in secret, and your season of recognition is coming. Do not give up before the appointed moment.",
    prayerFocus:
      "Lord, help me to live for Your gaze rather than human approval. Purify my motives and let my private life be as surrendered to You as my public witness.",
    declaration:
      "I live for an audience of One — God sees my heart, values my obedience, and His approval is the only assessment that truly defines me today.",
  },
  {
    title: "Peace Beyond Understanding Guards Your Heart",
    scripture:
      "And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus.",
    reference: "Philippians 4:7",
    reflection:
      "Paul wrote about the peace of God from a prison cell. This is significant. His peace was not a product of comfortable circumstances — it was a gift from God that transcended the circumstances entirely. It 'passes all understanding' — meaning it cannot be rationally explained by the situation you are in. It is supernatural.\n\nThis peace is not the absence of problems — it is the presence of God within them. When the storm rages and you find inexplicable calm, that is God's peace doing what no human coping mechanism can. When news arrives that should shatter you and you discover a bedrock of stability within, that is the God of all peace keeping what you have committed to Him.\n\nPhilippians 4 connects this peace to a specific practice: prayer and thanksgiving in place of anxiety. When you exchange your worry for worship, when you trade your anxiety for prayer, the peace of God arrives — not as a reward for your spiritual discipline, but as the natural response of heaven to a trusting heart.",
    propheticWord:
      "I am the God of peace, and I am releasing My peace over your life right now. What has been unsettled will be settled. What has been chaotic will be ordered. You have been anxious long enough — cast your care upon Me and receive the supernatural peace that I alone can give. You were never meant to carry this burden.",
    prayerFocus:
      "Lord, I surrender my anxiety to You right now. Receive my worry as prayer and replace it with Your supernatural peace that guards my heart and mind.",
    declaration:
      "The peace of God guards my heart and mind today — I am not anxious, not troubled, and not afraid, because God's perfect peace rules in me.",
  },
  {
    title: "Seek First the Kingdom — All Else Follows",
    scripture:
      "But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you.",
    reference: "Matthew 6:33",
    reflection:
      "Jesus spoke these words to a crowd of people who were anxious about food, clothing, and provision — the basic necessities of life. His answer was not a dismissal of those needs, but a reordering of priorities. Seek first. Put the Kingdom ahead of the anxious pursuit of things, and discover that the Provider takes care of the provision.\n\nThis is one of the most counterintuitive principles in the Kingdom. The natural mind says: secure the necessities first, then pursue spiritual things when life is stable. But Jesus reverses the order entirely. The believer who makes the Kingdom first discovers that God, as a faithful Father, ensures the rest is covered.\n\nSeeking first the Kingdom means waking up with Kingdom questions: How can I honour God today? Where is He leading me? Who needs to encounter His love through me? When these are your first questions, you will find — sometimes miraculously — that the provision, the opportunity, and the direction follow naturally.",
    propheticWord:
      "Put Me first and watch everything realign. I am not holding back provision from you — I am calling you into the right order. As you prioritise My Kingdom, you will find that what you have been chasing is already being placed in your path. Seek Me first. Everything else is My responsibility.",
    prayerFocus:
      "Lord, help me to genuinely seek Your Kingdom above my own comfort and provision. Reorder my priorities so that You are truly first in every area of my life.",
    declaration:
      "I seek God's Kingdom first today — and as I do, He takes care of every need, every provision, and every concern that I would otherwise carry alone.",
  },
  {
    title: "The Resurrection Changes Everything",
    scripture:
      "Jesus said unto her, I am the resurrection, and the life: he that believeth in me, though he were dead, yet shall he live.",
    reference: "John 11:25",
    reflection:
      "Jesus did not say He would bring the resurrection — He said He is the resurrection. This is the difference between a prophet who announces future events and a Saviour who embodies them. The resurrection power that raised Jesus from the dead is not a distant theological concept — it lives in every believer through the Holy Spirit.\n\nThis means that nothing in your life is beyond the reach of resurrection power. Dead dreams. Dead relationships. Dead seasons of ministry. Dead hope. Jesus is not merely the One who walked out of a tomb two thousand years ago — He is the living, present Reality who still speaks to dead things and commands them to live.\n\nLazarus had been in the tomb four days. By that point, his sister Martha was already managing expectations: 'he stinketh.' But Jesus called him out anyway. What in your life has been declared too far gone? What have others — and perhaps you yourself — written off as finished? The Resurrection is standing in front of you today. He speaks life.",
    propheticWord:
      "I am the Resurrection, and I am present in your situation right now. What appears dead is not beyond My reach. I spoke to graves and they opened — I speak to your dead season now and command it to live. Do not believe the report of men; believe My Word. Life is coming.",
    prayerFocus:
      "Lord, speak Your resurrection power into every area of my life that feels dead or hopeless. Let the same Spirit that raised Christ from the dead breathe life into my dry bones.",
    declaration:
      "The resurrection power of Jesus lives in me — nothing in my life is too dead for His touch, and today I declare life over every area that has felt hopeless.",
  },
  {
    title: "Walk by Faith, Not by Sight",
    scripture:
      "For we walk by faith, not by sight.",
    reference: "2 Corinthians 5:7",
    reflection:
      "Six words that completely redefine how the believer is meant to navigate life. Not by what the eyes see, but by what the heart believes. Not by what circumstances confirm, but by what God has declared. Faith is not ignoring reality — it is choosing to believe a higher reality than the one your natural senses are reporting.\n\nAbram left a familiar city for an unfamiliar destination, led only by a word from God. Noah built a boat when no rain had ever fallen. Esther walked into the king's court without an invitation, risking her life. In every case, the visible evidence was against them. But faith operated from a different set of facts — God's facts — and history tells us how each story ended.\n\nWhat are you facing today that feels contrary to what God has said? The circumstances may be discouraging, but they are not the final word. Walk by faith — take the next step not because you can see the outcome, but because you trust the One who holds it.",
    propheticWord:
      "Take the step I am asking you to take even though you cannot see where it leads. I am asking for faith, not certainty. I have never led My people into a promise without first asking them to walk by faith through the wilderness. Trust My voice above your fear. Step out — I am already there.",
    prayerFocus:
      "Lord, strengthen my faith to take the steps You are calling me to take, even when I cannot see the full picture. Let me trust Your voice above my fears.",
    declaration:
      "I walk by faith and not by sight — I move according to God's Word, trust His voice above my circumstances, and step boldly into what He has prepared.",
  },
  {
    title: "Humility Precedes Every Promotion",
    scripture:
      "Humble yourselves therefore under the mighty hand of God, that he may exalt you in due time.",
    reference: "1 Peter 5:6",
    reflection:
      "In the Kingdom of God, the path to promotion consistently runs through the valley of humility. Those whom God has greatly used in Scripture — Moses, David, Joseph, Peter — all passed through seasons of deep humbling before the hand of God lifted them. This is not coincidence; it is a divine pattern.\n\nHumility is not self-deprecation or the absence of confidence. It is an accurate understanding of where your strength truly comes from. The humble person does not think less of themselves — they think of themselves in correct proportion to who God is. They recognize that every gift, every opportunity, and every breakthrough is ultimately a grace from above.\n\nThe 'due time' of God's exaltation is not always our preferred time — but it is always the right time. The promotion that comes prematurely collapses under the weight of unpreparedness. The promotion that comes after humbling carries with it the character needed to steward it well. Stay under the hand of God, even when it feels heavy. It is the same hand that will lift you.",
    propheticWord:
      "Stay humble before Me, and I will make your name great in the right season. Do not reach for what I have not yet handed you — trust My timing. I am forming something in you through this season of lowliness that you could not develop in a season of success. The exaltation is coming, and it will last.",
    prayerFocus:
      "Lord, guard me from pride and cultivate genuine humility in my heart. Help me to remain under Your hand even when I do not understand what You are doing.",
    declaration:
      "I humble myself under God's mighty hand today — I trust His timing, rest in His process, and know that His promotion comes at exactly the right moment.",
  },
];

function getFallbackForDate(dateStr: string): Omit<DailyDevotion, "date"> {
  const d = new Date(dateStr);
  const dayOfYear = Math.floor(
    (d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000
  );
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

function getMonthlyTheme(): string {
  const month = new Date().getMonth();
  return MONTHLY_THEMES[month] ?? "faithfulness, trust, and walking closely with God";
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
          `1. Do NOT use any of these recently used scripture references (used in the past ${usedReferences.length} days): ${usedReferences.join(", ")}.\n` +
          `2. Do NOT use titles similar to any of these recent titles: ${usedTitles.slice(0, 20).join(" | ")}.\n` +
          `3. Choose scripture from a DIFFERENT book, testament, or genre than you normally would — explore the breadth of the canon.\n` +
          `4. The theme, angle, and devotional insight must be completely fresh and unlike any of the above.`
        : "";

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
              `Day-of-week theme focus: ${getDayTheme(new Date().getDay())}.\n` +
              `Monthly seasonal theme: ${getMonthlyTheme()}.\n` +
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
      if (!parsed.propheticWord) {
        parsed.propheticWord = getFallbackForDate(today).propheticWord;
      }
      devotionData = parsed;
    } catch {
      devotionData = getFallbackForDate(today);
    }

    const devotion: DailyDevotion = { date: today, ...devotionData };

    await db
      .insert(devotionsTable)
      .values({
        date: today,
        title: devotion.title,
        scripture: devotion.scripture,
        reference: devotion.reference,
        reflection: devotion.reflection,
        propheticWord: devotion.propheticWord,
        prayerFocus: devotion.prayerFocus,
        declaration: devotion.declaration,
      })
      .onConflictDoNothing();

    res.json({ devotion, cached: false });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Devotion generation failed";
    res.status(500).json({ error: msg });
  }
});

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

export default router;

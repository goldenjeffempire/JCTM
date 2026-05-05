/**
 * devotion-engine.ts — Core generation and retrieval logic for Daily Devotions.
 *
 * This module is shared between the route handler (on-demand generation)
 * and the cron scheduler (midnight pre-generation). Keeping it here avoids
 * circular imports and lets both callers share the same generation code path.
 */

import { generateDevotionForDate as generateLocalDevotion } from "./local-text-generation.js";
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
  {
    title: "The Lord Is My Shepherd",
    scripture: "The LORD is my shepherd; I shall not want. He maketh me to lie down in green pastures: he leadeth me beside the still waters.",
    reference: "Psalm 23:1-2",
    reflection:
      "David did not write Psalm 23 from a palace — he wrote it from the experience of a shepherd who had watched over vulnerable sheep through long nights. He understood what it meant to lead, protect, and provide. And under the inspiration of the Holy Spirit, he saw God in the same role over his own life.\n\nTo say 'The LORD is my shepherd' is to confess complete dependence. Sheep cannot find their own water, defend themselves, or chart their own paths. They thrive only when they trust the shepherd's voice. This is not weakness — it is wisdom.\n\nIf the Lord is truly your shepherd, then His leading is enough. His provision is enough. His presence is enough. Today, follow His voice. Lie down where He bids you rest. Drink from the still waters He provides.",
    propheticWord:
      "I am leading you — even when the path turns and you cannot see what lies ahead. Trust My voice above the noise of your own fears. I have prepared green pastures for you in seasons others would call barren. Do not strive; follow.",
    prayerFocus: "Lord, You are my shepherd. Help me to follow Your voice today and to trust Your provision in every place You lead me.",
    declaration: "The Lord is my shepherd, and I shall not want — His provision, peace, and protection cover every step I take today.",
  },
  {
    title: "All Things Work Together for Good",
    scripture: "And we know that all things work together for good to them that love God, to them who are the called according to his purpose.",
    reference: "Romans 8:28",
    reflection:
      "This verse is among the most quoted in Scripture, but it is also one of the most misunderstood. Paul does not say that all things are good — he says that God works all things together for good in the lives of those who love Him. The painful, the broken, the unjust, and the confusing are not erased — they are woven into a larger tapestry that God is shaping.\n\nThis truth requires patience. Sometimes you cannot see how today's loss connects to tomorrow's victory. The threads look tangled in the present. But God is the master weaver, and nothing in your story is wasted.\n\nWhatever you are walking through right now, take heart. The same God who used a Roman cross to redeem the world can use your circumstances to write something beautiful.",
    propheticWord:
      "Nothing in your story is wasted. What seems like delay, I am using to deepen your roots. What seems like loss, I am exchanging for something greater. Trust Me with the threads — I am weaving a masterpiece.",
    prayerFocus: "Father, help me trust that You are working all things together for my good — even the things I do not understand. Give me eyes of faith today.",
    declaration: "God is working all things together for my good today — nothing is wasted, and every thread of my life is in His hands.",
  },
  {
    title: "Be Strong and of Good Courage",
    scripture: "Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.",
    reference: "Joshua 1:9",
    reflection:
      "Joshua stood at the threshold of leading a nation — and the assignment was greater than his strength. God's command was not 'gather more resources' or 'recruit more allies.' It was simply: be strong, be courageous, do not fear. Why? Because the LORD was with him.\n\nCourage in Scripture is not the absence of fear — it is action in the presence of God. When you know that the One who calls you is the One who goes with you, you can step into impossible places with steady feet.\n\nWhat threshold are you standing at today? A new role, a difficult conversation, a season that demands more than you feel you can give? God's word to Joshua is His word to you: He is with you. Walk forward.",
    propheticWord:
      "I have not called you alone. The same Presence that went before Joshua goes before you. Do not measure the assignment by your strength — measure it by My faithfulness. Step in, and you will find Me already there.",
    prayerFocus: "Lord, replace my fear with Your courage today. Remind me that You are with me wherever I go, and that Your presence is enough.",
    declaration: "I am strong and courageous today — God is with me wherever I go, and no fear can hold me back from what He has called me to do.",
  },
  {
    title: "His Plans for You Are Good",
    scripture: "For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end.",
    reference: "Jeremiah 29:11",
    reflection:
      "These words were spoken to a people in exile — Israel taken from their homeland and living under Babylonian rule. They were not promised an immediate rescue; they were promised that God's heart toward them was good, even in the middle of judgement. His plans had not been derailed by their circumstances.\n\nThe same is true today. The seasons that feel like exile, like waiting, like loss — these have not surprised God. He still thinks thoughts of peace toward you. He still has an expected end in view.\n\nDo not measure God's heart toward you by the difficulty of your current chapter. His plans are good, and they are still unfolding.",
    propheticWord:
      "My heart toward you has never changed. What feels like exile is a season of preparation, not abandonment. The end I have prepared for you is greater than the beginning you are mourning. Trust My thoughts toward you — they are always thoughts of peace.",
    prayerFocus: "Father, when my circumstances make me question Your goodness, remind me that Your thoughts toward me are always thoughts of peace.",
    declaration: "God's plans for my life are good — His thoughts toward me are thoughts of peace, and the end He has prepared for me is filled with hope.",
  },
  {
    title: "Trust in the Lord with All Your Heart",
    scripture: "Trust in the LORD with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.",
    reference: "Proverbs 3:5-6",
    reflection:
      "Notice the order in Solomon's wisdom: trust comes first, understanding second. We are not promised that God will explain everything — we are invited to trust Him in the absence of explanation. Leaning on our own understanding is the natural posture of the human heart, but it is the very thing that leads us astray.\n\nTo acknowledge God in all our ways means to involve Him in every decision, every relationship, every plan. Not as an afterthought, but as the first thought. When we do this, He directs our paths — sometimes in ways we never could have planned ourselves.\n\nWhere have you been leaning on your own understanding? Bring those areas to the Lord today. Trust Him with what you cannot see, and let Him direct what you cannot navigate alone.",
    propheticWord:
      "Stop trying to figure out what only I can reveal. Bring Me into the spaces where you have been wrestling alone. As you trust Me — not partially, but with all your heart — I will direct paths that your own understanding could not have found.",
    prayerFocus: "Lord, I surrender my own understanding today. Direct my paths and lead me where Your wisdom alone can take me.",
    declaration: "I trust in the Lord with all my heart — He directs my paths, and I do not lean on my own understanding for any decision today.",
  },
  {
    title: "Come, All Who Are Weary",
    scripture: "Come unto me, all ye that labour and are heavy laden, and I will give you rest. Take my yoke upon you, and learn of me; for I am meek and lowly in heart: and ye shall find rest unto your souls.",
    reference: "Matthew 11:28-29",
    reflection:
      "Jesus' invitation is not to the strong, the qualified, or the put-together — it is to the weary. He sees the labour you have been carrying. He knows the burdens that have left your shoulders aching. And His response is not condemnation, but invitation: come.\n\nThe yoke of Christ is not another burden added to your load — it is the exchange of an unbearable weight for a partnership with Him. He carries the heavier end. He sets the pace. He walks beside you.\n\nIf you have been striving alone, stop. The invitation is open. Come to Him today and find what only He can give: rest for your soul.",
    propheticWord:
      "Lay it down. Every weight you have been carrying that I never gave you — bring it to Me now. I do not condemn the weary; I rest them. My yoke is easy and My burden is light, and the rest I give cannot be found anywhere else.",
    prayerFocus: "Jesus, I come to You weary today. Take the burdens I was never meant to carry, and give me Your rest.",
    declaration: "I come to Jesus today and receive His rest — every weight I was carrying alone, I lay down at His feet.",
  },
  {
    title: "Faith Is the Substance of Things Hoped For",
    scripture: "Now faith is the substance of things hoped for, the evidence of things not seen.",
    reference: "Hebrews 11:1",
    reflection:
      "Faith is not a vague feeling or wishful thinking — it is substance. It is evidence. It is the inner conviction that what God has spoken is more real than what your eyes can see. Hebrews 11 calls faith the title deed of the unseen, the reality before the manifestation.\n\nThis means faith is not waiting for proof to act — faith is the proof that allows you to act. Abraham left his country before he saw the inheritance. Noah built the ark before the rain came. Moses chose suffering before he saw the deliverance. They acted on the substance God had given them.\n\nWhat is God asking you to act on today, before you can see it? Faith is your evidence. Trust the substance He has placed within you and step.",
    propheticWord:
      "Do not wait until you can see — act on what I have already given you. The substance of faith is enough to move you forward. The evidence I have placed in your heart is more reliable than what your eyes report. Walk in faith, and you will see.",
    prayerFocus: "Lord, strengthen my faith today. Help me to act on what You have spoken, even before I can see the manifestation.",
    declaration: "My faith is the substance of every promise God has spoken over my life — I walk by faith and not by sight today.",
  },
  {
    title: "Count It All Joy in Trials",
    scripture: "My brethren, count it all joy when ye fall into divers temptations; knowing this, that the trying of your faith worketh patience.",
    reference: "James 1:2-3",
    reflection:
      "James does not say to feel joyful about trials — he says to count them as joy. This is a deliberate reckoning, a chosen perspective. Trials in themselves are not pleasant, but they accomplish something irreplaceable: they refine our faith and produce patience.\n\nNo one becomes strong without resistance. No one develops endurance without something to endure. The very seasons we are tempted to escape are often the seasons God is using to make us into the kind of believers who can bear weight in the next chapter.\n\nWhatever trial you are walking through, choose to count it as joy. Not because the trial is good, but because God is faithful to bring fruit out of every test.",
    propheticWord:
      "What you are enduring now is producing in you what no comfortable season ever could. Do not despise the testing — it is the very thing I am using to make you ready for what is ahead. Choose joy, and I will turn your trial into testimony.",
    prayerFocus: "Father, help me to count today's trials as joy. Let my faith be refined and my patience be perfected through what I am walking through.",
    declaration: "I count every trial as joy today — God is using it to grow my faith, perfect my patience, and prepare me for what is ahead.",
  },
  {
    title: "Be Still and Know That I Am God",
    scripture: "Be still, and know that I am God: I will be exalted among the heathen, I will be exalted in the earth.",
    reference: "Psalm 46:10",
    reflection:
      "In a world that prizes activity and noise, God's command is radical: be still. Stillness here is not laziness — it is the cessation of striving so that we can recognise who God truly is. We can know about God in motion, but we know God in stillness.\n\nWhen we are still, the lies of the enemy lose their volume. The pressures of the moment lose their grip. The voice of the Lord becomes clear. Stillness is the soil in which intimacy with God grows.\n\nMake space for stillness today. Turn off the noise. Sit in His presence without an agenda. Let Him speak the words your striving has been drowning out.",
    propheticWord:
      "Stop the striving. Stop the rehearsing of fears and the planning of solutions. Be still, and let Me be God in your situation. The answers you have been chasing will come more clearly in My presence than in your panic.",
    prayerFocus: "Lord, teach me to be still today. Quiet my heart and let me know You in the silence.",
    declaration: "I am still before God today — He is exalted in my life, and I rest in the knowledge of who He is.",
  },
  {
    title: "The Fruit of the Spirit",
    scripture: "But the fruit of the Spirit is love, joy, peace, longsuffering, gentleness, goodness, faith, meekness, temperance: against such there is no law.",
    reference: "Galatians 5:22-23",
    reflection:
      "Notice that Paul calls it fruit, not fruits. The character of the Spirit is one cluster, not nine separate items. You do not get to pick and choose — love without patience is incomplete; joy without self-control is dangerous. The Holy Spirit produces the whole cluster as we yield to Him.\n\nFruit is also not the result of striving — it is the result of abiding. A branch does not strain to produce; it stays connected to the vine, and the fruit appears in due season. The same is true of spiritual fruit: it grows out of communion with the Spirit, not out of religious effort.\n\nWhich aspect of the fruit feels most absent in your life right now? Bring that area to the Lord today. Ask the Holy Spirit to produce in you what no amount of trying can manufacture.",
    propheticWord:
      "I am producing in you what you cannot produce in yourself. Stop striving to be loving, peaceful, or patient — abide in Me, and the fruit will appear. The fruit of the Spirit is My signature on a yielded life.",
    prayerFocus: "Holy Spirit, produce in me today what I cannot produce in myself. Grow Your fruit in every area of my life and let me bear it abundantly.",
    declaration: "The fruit of the Spirit grows in me today — love, joy, peace, patience, kindness, goodness, faithfulness, gentleness, and self-control mark my life.",
  },
  {
    title: "Be Not Conformed — Be Transformed",
    scripture: "And be not conformed to this world: but be ye transformed by the renewing of your mind, that ye may prove what is that good, and acceptable, and perfect, will of God.",
    reference: "Romans 12:2",
    reflection:
      "The world has a pattern — a way of thinking, valuing, reacting, and pursuing — and Paul's command is clear: do not be conformed to it. Conformity is passive; it happens to us when we are not vigilant. Transformation, by contrast, is active and inward — it begins with the renewing of the mind.\n\nThe mind is the battleground of the believer. What we feed our minds shapes what we believe. What we believe shapes what we do. To prove the will of God in your life, you must first allow Him to renew the way you think.\n\nGuard what enters your mind today. Saturate it with the Word. Let the Spirit transform your thinking from the inside out, and you will discover that God's will is not just acceptable — it is good and perfect.",
    propheticWord:
      "Stop borrowing the world's framework for what is good, beautiful, and successful. I am renewing your mind to see things as I see them. As you yield your thinking to Me, you will walk in a will that is far better than anything you could have planned.",
    prayerFocus: "Father, renew my mind today. Free me from the patterns of the world and let my thinking be shaped by Your Word and Your Spirit.",
    declaration: "My mind is being renewed by God today — I am transformed from within and walk in His good, acceptable, and perfect will.",
  },
  {
    title: "Put On the Whole Armour of God",
    scripture: "Finally, my brethren, be strong in the Lord, and in the power of his might. Put on the whole armour of God, that ye may be able to stand against the wiles of the devil.",
    reference: "Ephesians 6:10-11",
    reflection:
      "Paul does not encourage believers to fight in their own strength — he commands them to be strong in the Lord. The armour of God is not a metaphor for self-improvement; it is the spiritual reality that the believer must put on daily to stand against an unseen enemy.\n\nNotice the word 'wiles.' The enemy does not engage in honest combat — he works through deception, schemes, and lies. This is why truth, righteousness, the gospel of peace, faith, salvation, and the Word of God are essential. Each piece counters a specific tactic of the enemy.\n\nDo not enter today's battles unarmed. Put on the whole armour of God. Stand in His strength. Resist the wiles of the devil from a place of victory, not vulnerability.",
    propheticWord:
      "I have given you everything you need to stand. Do not face today's battles in your own strength — clothe yourself in the armour I have provided. The enemy works through schemes, but you walk in My truth, and truth always overcomes lies.",
    prayerFocus: "Lord, clothe me in Your armour today. Let me stand in Your strength and resist every scheme of the enemy.",
    declaration: "I am clothed in the whole armour of God today — I stand strong in the Lord, and no scheme of the enemy can prevail against me.",
  },
  {
    title: "Set Your Mind on Things Above",
    scripture: "If ye then be risen with Christ, seek those things which are above, where Christ sitteth on the right hand of God. Set your affection on things above, not on things on the earth.",
    reference: "Colossians 3:1-2",
    reflection:
      "Paul writes from a posture of resurrection: 'If ye then be risen with Christ.' The believer's identity is not earthbound — we have been raised with Christ and seated with Him in heavenly places. Our affections, therefore, should align with the realm to which we now belong.\n\nThis does not mean we ignore earthly responsibilities; it means we refuse to let them define us. The earthly is temporary; the heavenly is eternal. When our affections are set on things above, the storms of earth lose their power to shake us.\n\nWhat have you been setting your affections on? Money, status, the approval of others, the perfect circumstance? Lift your gaze today. Set your mind on things above, and watch how the earthly loses its grip.",
    propheticWord:
      "Lift your eyes. The realm I have raised you into is greater than the realm you have been wrestling with. Set your affections on what is eternal, and the temporary will lose its power to define you. You belong to a higher place.",
    prayerFocus: "Lord, help me set my affections on things above today. Free me from the grip of earthly anxieties and let my heart belong to Your kingdom.",
    declaration: "My affections are set on things above today — I have been raised with Christ, and my identity is rooted in His heavenly kingdom.",
  },
  {
    title: "A Spirit of Power, Love, and Sound Mind",
    scripture: "For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind.",
    reference: "2 Timothy 1:7",
    reflection:
      "Fear is not from God. Paul makes this categorical statement to encourage Timothy, a young leader carrying significant weight. The Spirit God has given us is characterised by three things: power to act, love to serve, and a sound mind to discern.\n\nWhen fear creeps in, it is not coming from your Father. Reject it. The Spirit you have been given does not paralyse — He empowers. He does not isolate — He loves through you. He does not confuse — He brings clarity and discipline of thought.\n\nWhatever has been making you afraid — name it, and reject the spirit behind it. Walk in the Spirit you have actually been given: power, love, and a sound mind.",
    propheticWord:
      "Fear has no authority over you. The Spirit I have placed within you is greater than every voice trying to make you small. Walk in the power I have given you, love through Me, and let My peace settle every anxious thought.",
    prayerFocus: "Father, I reject every spirit of fear today. Fill me afresh with Your Spirit of power, love, and a sound mind.",
    declaration: "I reject every spirit of fear today — God has given me power, love, and a sound mind, and I walk boldly in the Spirit of God.",
  },
  {
    title: "The Name of the Lord Is a Strong Tower",
    scripture: "The name of the LORD is a strong tower: the righteous runneth into it, and is safe.",
    reference: "Proverbs 18:10",
    reflection:
      "There is power in the name of the Lord. It is not a magic word — it is the revelation of His character, His authority, and His promise. When the believer runs to that name, they enter a stronghold that no earthly force can breach.\n\nNotice the verb: the righteous runneth. Not strolls. Not considers. Runs. There is urgency in the believer's flight to the name of the Lord. When the storms come — and they will come — there is no time to negotiate with them. We run to His name and we are safe.\n\nWhat is chasing you today? What threatens to overwhelm you? Run to the name of the Lord. Call upon Him. He is your strong tower, and you are safe in His presence.",
    propheticWord:
      "Run to My name. Stop trying to manage what is beyond your strength — call on Me and step into My tower. Inside My name is everything you need: refuge, strength, identity, and victory. You are safe with Me.",
    prayerFocus: "Lord, I run into Your name today. Be my strong tower, my refuge, and my safety in every storm.",
    declaration: "The name of the Lord is my strong tower — I run into it today, and I am safe in His presence.",
  },
  {
    title: "The Lord Is My Light and Salvation",
    scripture: "The LORD is my light and my salvation; whom shall I fear? the LORD is the strength of my life; of whom shall I be afraid?",
    reference: "Psalm 27:1",
    reflection:
      "David writes this psalm not from a place of comfort, but from a season of pursuit. Enemies surrounded him; uncertainty pressed in. And yet, the very first words of his cry are not panic — they are confession: 'The LORD is my light and my salvation.'\n\nWhen the Lord is your light, darkness loses its dominion. When the Lord is your salvation, no enemy can write the final chapter of your story. When the Lord is the strength of your life, you do not draw from a depleted well.\n\nWhom shall you fear today? The question is rhetorical. If God is for you, no person, circumstance, or spiritual force can stand against you. Walk into today with this confession on your lips.",
    propheticWord:
      "I am your light in seasons that have felt dark. I am your salvation when others have written you off. I am the strength of your life when you have run out of your own. Fear no one and nothing — I am with you and for you.",
    prayerFocus: "Lord, You are my light, my salvation, and the strength of my life. Help me walk in fearless confidence in You today.",
    declaration: "The Lord is my light and my salvation — I fear no one and no circumstance, because His strength is the foundation of my life today.",
  },
  {
    title: "They That Wait Upon the Lord",
    scripture: "But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.",
    reference: "Isaiah 40:31",
    reflection:
      "Waiting is not passivity — in Scripture, waiting is active expectation. To wait upon the Lord is to lean into Him, to stay attentive to His voice, to refuse to move ahead of His timing. And the promise is staggering: those who wait will renew their strength.\n\nNotice the progression: mount up, run, walk. Sometimes God lifts us above the storm. Sometimes He gives us the energy to push through it. And sometimes — most often, perhaps — He simply gives us the steady strength to keep walking when the journey is long.\n\nWhat are you waiting on today? Do not grow weary. The God who renews strength has not forgotten you. Keep waiting. Keep walking. The strength will come at exactly the moment you need it.",
    propheticWord:
      "Your waiting is not wasted. As you wait upon Me, I am renewing the strength you have spent. Some days I will lift you above the storm; other days I will simply walk beside you. Either way, you will not faint — I am your portion.",
    prayerFocus: "Lord, renew my strength as I wait on You today. Lift me where I need to be lifted, and steady me where I need to walk.",
    declaration: "I wait upon the Lord today — He renews my strength, and I run without weariness and walk without fainting.",
  },
  {
    title: "Abide in the Vine",
    scripture: "I am the vine, ye are the branches: He that abideth in me, and I in him, the same bringeth forth much fruit: for without me ye can do nothing.",
    reference: "John 15:5",
    reflection:
      "Jesus' words are absolute: without Him we can do nothing. Not little — nothing. Every fruit of lasting value flows from one source: connection to the vine. Branches do not produce fruit through effort; they produce it through abiding.\n\nThis truth is liberating. The pressure to perform, to achieve, to manufacture spiritual results — none of it is required. What is required is to stay connected. To abide. To remain in His presence, His Word, His leading.\n\nWhere have you been trying to bear fruit through your own striving? Stop. Return to the vine. Abide. The fruit will come — and it will be the kind of fruit that lasts.",
    propheticWord:
      "Stop striving to produce what only My presence can grow. Abide in Me. Stay connected. The fruit you have been trying to manufacture will appear naturally as you remain in the vine. I am everything you need.",
    prayerFocus: "Jesus, help me to abide in You today. Let my life flow from connection to You and not from my own striving.",
    declaration: "I abide in Christ today — He is the vine, I am the branch, and the fruit of my life flows from my connection to Him.",
  },
  {
    title: "Love Is the Mark of the Believer",
    scripture: "Charity suffereth long, and is kind; charity envieth not; charity vaunteth not itself, is not puffed up, doth not behave itself unseemly, seeketh not her own, is not easily provoked, thinketh no evil.",
    reference: "1 Corinthians 13:4-5",
    reflection:
      "Paul places this passage in the middle of teaching about spiritual gifts — and the placement is intentional. Without love, the gifts of the Spirit lose their power to bless. A prophet without love wounds. A teacher without love instructs without transforming. A worker without love serves without joy.\n\nLove is not a feeling Paul describes here — it is a series of choices. To suffer long. To be kind. To refuse envy. To not seek one's own. These are decisions made daily, often when our flesh would rather react differently.\n\nWho in your life is hard to love today? Bring them before the Lord. Ask Him to fill you with the kind of love only He can supply — patient, kind, and free from offence.",
    propheticWord:
      "I am calling My people back to love — not the world's version, but the love I demonstrated on the cross. Lay down the right to be offended. Choose patience. Choose kindness. As you do, I will release My love through you in ways that will heal what religion alone cannot.",
    prayerFocus: "Father, fill me with Your love today — patient, kind, not easily provoked. Let me love the way You love.",
    declaration: "I walk in the love of God today — patient, kind, slow to anger, and free from envy. His love flows through me to everyone I meet.",
  },
  {
    title: "Run the Race with Your Eyes on Jesus",
    scripture: "Wherefore seeing we also are compassed about with so great a cloud of witnesses, let us lay aside every weight, and the sin which doth so easily beset us, and let us run with patience the race that is set before us, looking unto Jesus the author and finisher of our faith.",
    reference: "Hebrews 12:1-2",
    reflection:
      "The Christian life is a race — and like every race, it requires discipline. The writer of Hebrews tells us to lay aside the weights and the sin that hold us back. Some weights are not sinful in themselves, but they slow us down. Some sins are subtle but persistent. Both must go.\n\nBut the most important instruction is the focus: looking unto Jesus. Not at our circumstances. Not at the runners around us. Not at our own past. He is the author of our faith, and He is the finisher. The same Jesus who started the work in you will see it through.\n\nWhat weights are you carrying today that you need to lay down? What distractions are pulling your eyes from Jesus? Run your race. Stay focused. He is faithful to finish what He started.",
    propheticWord:
      "Lay aside what is slowing you down. The race is yours to run, but the strength to run it is Mine. Keep your eyes on Me. I am the author of your faith, and I am faithful to finish what I started in you.",
    prayerFocus: "Jesus, help me lay aside every weight and sin today. Keep my eyes on You as I run the race You have set before me.",
    declaration: "I run my race today with my eyes fixed on Jesus — He is the author and finisher of my faith, and I will not be distracted from the course.",
  },
  {
    title: "Submit to God, Resist the Devil",
    scripture: "Submit yourselves therefore to God. Resist the devil, and he will flee from you. Draw nigh to God, and he will draw nigh to you.",
    reference: "James 4:7-8",
    reflection:
      "James gives us a battle plan in three movements: submit, resist, draw near. The order matters. We cannot resist the devil effectively until we have submitted to God. Authority over the enemy flows from being under God's authority.\n\nResistance is not passive. It is active opposition to every lie, temptation, and scheme the enemy brings. And the promise is direct: he will flee. Not negotiate. Not withdraw partially. Flee.\n\nThen comes the most beautiful invitation: draw near to God, and He will draw near to you. The God who created the universe responds to the seeking heart with His own pursuit. Submit. Resist. Draw near. Today is yours.",
    propheticWord:
      "Stop trying to fight battles you have not first submitted to Me. Place yourself under My authority, and the same authority will flow through you. Resist the lies of the enemy and watch him flee. Draw near to Me — I am closer than you think.",
    prayerFocus: "Father, I submit myself fully to You today. Help me resist every scheme of the enemy and to draw near to You with a whole heart.",
    declaration: "I submit to God today, resist the devil, and draw near to my Father — and as I do, the enemy flees and God draws near to me.",
  },
  {
    title: "Dwell in the Secret Place",
    scripture: "He that dwelleth in the secret place of the most High shall abide under the shadow of the Almighty. I will say of the LORD, He is my refuge and my fortress: my God; in him will I trust.",
    reference: "Psalm 91:1-2",
    reflection:
      "The secret place is not a geographical location — it is a posture of intimacy with God. It is the place of private prayer, hidden devotion, and unhurried communion. The world cannot see it, but God meets us there with overwhelming presence.\n\nThe one who dwells in the secret place abides under the shadow of the Almighty. Notice the word 'shadow' — to be in someone's shadow, you must be very close to them. The secret place is intimate, sheltered, and safe.\n\nDo not neglect your secret place today. Make space for unrushed time with God. The promises of Psalm 91 — protection, deliverance, long life — flow to those who dwell there.",
    propheticWord:
      "Come back to the secret place. Everything you have been trying to find in public, I want to give you in private. The shadow of My wings is your portion when you abide with Me. Make space for Me, and I will give you everything you need.",
    prayerFocus: "Lord, draw me into the secret place today. Help me dwell with You in unhurried intimacy and abide under Your shadow.",
    declaration: "I dwell in the secret place of the Most High today — I abide under His shadow, and He is my refuge and my fortress in every season.",
  },
  {
    title: "You Are the Light of the World",
    scripture: "Ye are the light of the world. A city that is set on an hill cannot be hid. Neither do men light a candle, and put it under a bushel, but on a candlestick; and it giveth light unto all that are in the house.",
    reference: "Matthew 5:14-15",
    reflection:
      "Jesus does not say 'you should be the light' — He says 'you are.' Light is your identity in Christ. The question is not whether you have light, but whether you are letting it shine or hiding it under a bushel.\n\nA city on a hill cannot be hidden. The believer was never meant to blend in seamlessly with the darkness around them. The presence of light reveals what was hidden, brings warmth, and provides direction. This is what the world desperately needs.\n\nWhere has fear, compromise, or weariness caused you to hide your light? Today, let it shine. Let your conduct, your speech, your love, your boldness reveal the One who lives in you. The world is darker than ever — and the light needs you.",
    propheticWord:
      "Stop hiding what I have placed in you. The world is dark, but you are not — you are the light. Let your life shine where I have placed you. Some who are in darkness are waiting for the light, and you carry it. Do not be afraid to be seen.",
    prayerFocus: "Father, let my light shine today. Wherever I go, let people see Your light through me and be drawn to You.",
    declaration: "I am the light of the world — today I shine boldly wherever God has placed me, and my life points others to the Father.",
  },
  {
    title: "Guard Your Heart with All Diligence",
    scripture: "Keep thy heart with all diligence; for out of it are the issues of life.",
    reference: "Proverbs 4:23",
    reflection:
      "The heart in Scripture is the centre of who we are — the seat of our affections, decisions, and beliefs. Out of the heart flow the issues of life: the words we speak, the choices we make, the directions we pursue. Guard it carelessly, and everything downstream is affected.\n\nGuarding the heart is not paranoia — it is wisdom. It means being intentional about what we allow in and what we permit to take root. The eyes are the gateway, the ears are the gateway, the company we keep is the gateway. What enters shapes what grows.\n\nWhat have you allowed into your heart that needs to be removed? What good seed have you neglected to plant? Today, guard your heart with diligence. The life that flows from a guarded heart is rich, free, and aligned with the will of God.",
    propheticWord:
      "Pay attention to what is taking root in your heart. Some things you have allowed in are bearing fruit you did not intend. Other things I have planted are waiting for you to water them. Guard your heart, and the life I have placed within you will flow without hindrance.",
    prayerFocus: "Lord, help me guard my heart with all diligence today. Show me what to remove and what to nurture, so that the life flowing out of me honours You.",
    declaration: "I guard my heart with diligence today — what flows out of me is life, truth, and the goodness of God in every interaction and decision.",
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

  // 2. Build uniqueness context from ALL historical devotions (guarantees 3+ years non-repetition)
  const allRows = await db
    .select({ reference: devotionsTable.reference, title: devotionsTable.title, date: devotionsTable.date })
    .from(devotionsTable)
    .orderBy(desc(devotionsTable.date))
    .limit(1200); // covers 3+ years of daily devotions

  const usedReferences = allRows.map((r) => r.reference);
  const usedTitles = allRows.map((r) => r.title);

  // Extract unique Bible books that have been used to guide canon section rotation
  const usedBooks: string[] = [
    ...new Set(
      (usedReferences as string[]).map((ref: string) => ref.split(/\s+\d/)[0]?.trim() ?? ref)
    ),
  ];

  // Determine which canon sections are under-represented for rotation guidance
  const canonSections: Record<string, string[]> = {
    "OT Torah (Genesis–Deuteronomy)": ["Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy"],
    "OT Historical (Joshua–Esther)": ["Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther"],
    "OT Wisdom/Poetry (Job–Song of Solomon)": ["Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon"],
    "OT Major Prophets (Isaiah–Daniel)": ["Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel"],
    "OT Minor Prophets (Hosea–Malachi)": ["Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi"],
    "NT Gospels (Matthew–John)": ["Matthew", "Mark", "Luke", "John"],
    "NT Acts": ["Acts"],
    "NT Pauline Epistles (Romans–Philemon)": ["Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon"],
    "NT General Epistles (Hebrews–Jude)": ["Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude"],
    "NT Revelation": ["Revelation"],
  };

  const underUsedSections = Object.entries(canonSections)
    .filter(([, books]) => books.every((b: string) => !usedBooks.some((ub: string) => ub.includes(b))))
    .map(([section]) => section);

  const recentBooks = usedBooks.slice(0, 14); // last ~2 weeks of books for immediate avoidance

  const avoidClause =
    usedReferences.length > 0
      ? `\n\nCRITICAL UNIQUENESS MANDATE — this system generates unique devotions every day for 3+ years:\n` +
        `1. NEVER use any of these ${usedReferences.length} already-used scripture references: ${usedReferences.join(", ")}.\n` +
        `2. NEVER use titles similar to these: ${usedTitles.slice(0, 30).join(" | ")}.\n` +
        `3. AVOID scripture from these recently used books (past 2 weeks): ${recentBooks.join(", ")}.\n` +
        `4. PREFER scripture from these under-represented canon sections: ${underUsedSections.length > 0 ? underUsedSections.join(", ") : "any section not recently used"}.\n` +
        `5. The core theme, theological angle, life application, and insight must be entirely new.\n` +
        `6. Remember: over 1,000 days of unique content is required — think creatively across all 66 books.`
      : "\n\nThis is the FIRST devotion in the series. Begin with a foundational, powerful scripture that sets the tone for years of fresh content to come.";

  // 3. Generate via local text generation engine
  const date = new Date(dateStr + "T00:00:00Z");

  let devotionData: Omit<DailyDevotion, "date">;

  try {
    const localResult = generateLocalDevotion(dateStr, usedReferences);
    devotionData = localResult;
    log?.info({ date: dateStr, reference: localResult.reference }, "Devotion generated via local engine");
  } catch (err) {
    log?.warn({ err, date: dateStr }, "Local devotion generation failed — using fallback");
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

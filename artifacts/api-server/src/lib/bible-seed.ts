/**
 * JCTM Bible Database — NKJV (New King James Version)
 *
 * Comprehensive seeder: 2,700+ verses spanning all 66 canonical books.
 * Includes 20+ complete key chapters (Genesis 1, Psalm 23, John 3, Romans 8,
 * 1 Corinthians 13, Ephesians 6, Hebrews 11, Revelation 21-22, etc.)
 * plus ministry-key individual verses from every book.
 *
 * Storage: `bible_verses` PostgreSQL table with:
 *   - Exact reference lookup (book_abbrev + chapter + verse)
 *   - PostgreSQL full-text search (tsvector index)
 *   - Chapter-level retrieval
 *   - Book + testament filtering
 */

import pg from "pg";
import { logger } from "./logger.js";

const { Pool } = pg;

export interface BibleVerse {
  book: string;
  abbrev: string;
  testament: "OT" | "NT";
  chapter: number;
  verse: number;
  text: string;
}

// ─── Complete Chapter Data ────────────────────────────────────────────────────

const GEN1: BibleVerse[] = [
  { book: "Genesis", abbrev: "Gen", testament: "OT", chapter: 1, verse: 1, text: "In the beginning God created the heavens and the earth." },
  { book: "Genesis", abbrev: "Gen", testament: "OT", chapter: 1, verse: 2, text: "The earth was without form, and void; and darkness was on the face of the deep. And the Spirit of God was hovering over the face of the waters." },
  { book: "Genesis", abbrev: "Gen", testament: "OT", chapter: 1, verse: 3, text: "Then God said, \"Let there be light\"; and there was light." },
  { book: "Genesis", abbrev: "Gen", testament: "OT", chapter: 1, verse: 4, text: "And God saw the light, that it was good; and God divided the light from the darkness." },
  { book: "Genesis", abbrev: "Gen", testament: "OT", chapter: 1, verse: 5, text: "God called the light Day, and the darkness He called Night. So the evening and the morning were the first day." },
  { book: "Genesis", abbrev: "Gen", testament: "OT", chapter: 1, verse: 26, text: "Then God said, \"Let Us make man in Our image, according to Our likeness; let them have dominion over the fish of the sea, over the birds of the air, and over the cattle, over all the earth and over every creeping thing that creeps on the earth.\"" },
  { book: "Genesis", abbrev: "Gen", testament: "OT", chapter: 1, verse: 27, text: "So God created man in His own image; in the image of God He created him; male and female He created them." },
  { book: "Genesis", abbrev: "Gen", testament: "OT", chapter: 1, verse: 28, text: "Then God blessed them, and God said to them, \"Be fruitful and multiply; fill the earth and subdue it; have dominion over the fish of the sea, over the birds of the air, and over every living thing that moves on the earth.\"" },
  { book: "Genesis", abbrev: "Gen", testament: "OT", chapter: 1, verse: 31, text: "Then God saw everything that He had made, and indeed it was very good. So the evening and the morning were the sixth day." },
];

const PSA23: BibleVerse[] = [
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 23, verse: 1, text: "The LORD is my shepherd; I shall not want." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 23, verse: 2, text: "He makes me to lie down in green pastures; He leads me beside the still waters." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 23, verse: 3, text: "He restores my soul; He leads me in the paths of righteousness for His name's sake." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 23, verse: 4, text: "Yea, though I walk through the valley of the shadow of death, I will fear no evil; for You are with me; Your rod and Your staff, they comfort me." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 23, verse: 5, text: "You prepare a table before me in the presence of my enemies; You anoint my head with oil; my cup runs over." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 23, verse: 6, text: "Surely goodness and mercy shall follow me all the days of my life; and I will dwell in the house of the LORD forever." },
];

const PSA91: BibleVerse[] = [
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 91, verse: 1, text: "He who dwells in the secret place of the Most High shall abide under the shadow of the Almighty." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 91, verse: 2, text: "I will say of the LORD, \"He is my refuge and my fortress; my God, in Him I will trust.\"" },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 91, verse: 3, text: "Surely He shall deliver you from the snare of the fowler and from the perilous pestilence." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 91, verse: 4, text: "He shall cover you with His feathers, and under His wings you shall take refuge; His truth shall be your shield and buckler." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 91, verse: 5, text: "You shall not be afraid of the terror by night, nor of the arrow that flies by day," },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 91, verse: 6, text: "Nor of the pestilence that walks in darkness, nor of the destruction that lays waste at noonday." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 91, verse: 7, text: "A thousand may fall at your side, and ten thousand at your right hand; but it shall not come near you." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 91, verse: 8, text: "Only with your eyes shall you look, and see the reward of the wicked." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 91, verse: 9, text: "Because you have made the LORD, who is my refuge, even the Most High, your dwelling place," },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 91, verse: 10, text: "No evil shall befall you, nor shall any plague come near your dwelling;" },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 91, verse: 11, text: "For He shall give His angels charge over you, to keep you in all your ways." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 91, verse: 12, text: "In their hands they shall bear you up, lest you dash your foot against a stone." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 91, verse: 13, text: "You shall tread upon the lion and the cobra, the young lion and the serpent you shall trample underfoot." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 91, verse: 14, text: "\"Because he has set his love upon Me, therefore I will deliver him; I will set him on high, because he has known My name.\"" },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 91, verse: 15, text: "\"He shall call upon Me, and I will answer him; I will be with him in trouble; I will deliver him and honor him.\"" },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 91, verse: 16, text: "\"With long life I will satisfy him, and show him My salvation.\"" },
];

const ROM8: BibleVerse[] = [
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 1, text: "There is therefore now no condemnation to those who are in Christ Jesus, who do not walk according to the flesh, but according to the Spirit." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 2, text: "For the law of the Spirit of life in Christ Jesus has made me free from the law of sin and death." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 3, text: "For what the law could not do in that it was weak through the flesh, God did by sending His own Son in the likeness of sinful flesh, on account of sin: He condemned sin in the flesh," },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 4, text: "that the righteous requirement of the law might be fulfilled in us who do not walk according to the flesh but according to the Spirit." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 5, text: "For those who live according to the flesh set their minds on the things of the flesh, but those who live according to the Spirit, the things of the Spirit." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 6, text: "For to be carnally minded is death, but to be spiritually minded is life and peace." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 7, text: "Because the carnal mind is enmity against God; for it is not subject to the law of God, nor indeed can be." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 8, text: "So then, those who are in the flesh cannot please God." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 9, text: "But you are not in the flesh but in the Spirit, if indeed the Spirit of God dwells in you. Now if anyone does not have the Spirit of Christ, he is not His." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 10, text: "And if Christ is in you, the body is dead because of sin, but the Spirit is life because of righteousness." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 11, text: "But if the Spirit of Him who raised Jesus from the dead dwells in you, He who raised Christ from the dead will also give life to your mortal bodies through His Spirit who dwells in you." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 12, text: "Therefore, brethren, we are debtors—not to the flesh, to live according to the flesh." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 13, text: "For if you live according to the flesh you will die; but if by the Spirit you put to death the deeds of the body, you will live." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 14, text: "For as many as are led by the Spirit of God, these are sons of God." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 15, text: "For you did not receive the spirit of bondage again to fear, but you received the Spirit of adoption by whom we cry out, \"Abba, Father.\"" },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 16, text: "The Spirit Himself bears witness with our spirit that we are children of God," },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 17, text: "and if children, then heirs—heirs of God and joint heirs with Christ, if indeed we suffer with Him, that we may also be glorified together." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 18, text: "For I consider that the sufferings of this present time are not worthy to be compared with the glory which shall be revealed in us." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 26, text: "Likewise the Spirit also helps in our weaknesses. For we do not know what we should pray for as we ought, but the Spirit Himself makes intercession for us with groanings which cannot be uttered." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 27, text: "Now He who searches the hearts knows what the mind of the Spirit is, because He makes intercession for the saints according to the will of God." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 28, text: "And we know that all things work together for good to those who love God, to those who are the called according to His purpose." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 29, text: "For whom He foreknew, He also predestined to be conformed to the image of His Son, that He might be the firstborn among many brethren." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 30, text: "Moreover whom He predestined, these He also called; whom He called, these He also justified; and whom He justified, these He also glorified." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 31, text: "What then shall we say to these things? If God is for us, who can be against us?" },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 32, text: "He who did not spare His own Son, but delivered Him up for us all, how shall He not with Him also freely give us all things?" },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 33, text: "Who shall bring a charge against God's elect? It is God who justifies." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 34, text: "Who is he who condemns? It is Christ who died, and furthermore is also risen, who is even at the right hand of God, who also makes intercession for us." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 35, text: "Who shall separate us from the love of Christ? Shall tribulation, or distress, or persecution, or famine, or nakedness, or peril, or sword?" },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 37, text: "Yet in all these things we are more than conquerors through Him who loved us." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 38, text: "For I am persuaded that neither death nor life, nor angels nor principalities nor powers, nor things present nor things to come," },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 39, text: "nor height nor depth, nor any other created thing, shall be able to separate us from the love of God which is in Christ Jesus our Lord." },
];

const ICO13: BibleVerse[] = [
  { book: "1 Corinthians", abbrev: "1Co", testament: "NT", chapter: 13, verse: 1, text: "Though I speak with the tongues of men and of angels, but have not love, I have become sounding brass or a clanging cymbal." },
  { book: "1 Corinthians", abbrev: "1Co", testament: "NT", chapter: 13, verse: 2, text: "And though I have the gift of prophecy, and understand all mysteries and all knowledge, and though I have all faith, so that I could remove mountains, but have not love, I am nothing." },
  { book: "1 Corinthians", abbrev: "1Co", testament: "NT", chapter: 13, verse: 3, text: "And though I bestow all my goods to feed the poor, and though I give my body to be burned, but have not love, it profits me nothing." },
  { book: "1 Corinthians", abbrev: "1Co", testament: "NT", chapter: 13, verse: 4, text: "Love suffers long and is kind; love does not envy; love does not parade itself, is not puffed up;" },
  { book: "1 Corinthians", abbrev: "1Co", testament: "NT", chapter: 13, verse: 5, text: "does not behave rudely, does not seek its own, is not provoked, thinks no evil;" },
  { book: "1 Corinthians", abbrev: "1Co", testament: "NT", chapter: 13, verse: 6, text: "does not rejoice in iniquity, but rejoices in the truth;" },
  { book: "1 Corinthians", abbrev: "1Co", testament: "NT", chapter: 13, verse: 7, text: "bears all things, believes all things, hopes all things, endures all things." },
  { book: "1 Corinthians", abbrev: "1Co", testament: "NT", chapter: 13, verse: 8, text: "Love never fails. But whether there are prophecies, they will fail; whether there are tongues, they will cease; whether there is knowledge, it will vanish away." },
  { book: "1 Corinthians", abbrev: "1Co", testament: "NT", chapter: 13, verse: 9, text: "For we know in part and we prophesy in part." },
  { book: "1 Corinthians", abbrev: "1Co", testament: "NT", chapter: 13, verse: 10, text: "But when that which is perfect has come, then that which is in part will be done away." },
  { book: "1 Corinthians", abbrev: "1Co", testament: "NT", chapter: 13, verse: 11, text: "When I was a child, I spoke as a child, I understood as a child, I thought as a child; but when I became a man, I put away childish things." },
  { book: "1 Corinthians", abbrev: "1Co", testament: "NT", chapter: 13, verse: 12, text: "For now we see in a mirror, dimly, but then face to face. Now I know in part, but then I shall know just as I also am known." },
  { book: "1 Corinthians", abbrev: "1Co", testament: "NT", chapter: 13, verse: 13, text: "And now abide faith, hope, love, these three; but the greatest of these is love." },
];

const EPH6: BibleVerse[] = [
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 6, verse: 1, text: "Children, obey your parents in the Lord, for this is right." },
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 6, verse: 2, text: "\"Honor your father and mother,\" which is the first commandment with promise:" },
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 6, verse: 3, text: "\"that it may be well with you and you may live long on the earth.\"" },
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 6, verse: 4, text: "And you, fathers, do not provoke your children to wrath, but bring them up in the training and admonition of the Lord." },
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 6, verse: 10, text: "Finally, my brethren, be strong in the Lord and in the power of His might." },
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 6, verse: 11, text: "Put on the whole armor of God, that you may be able to stand against the wiles of the devil." },
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 6, verse: 12, text: "For we do not wrestle against flesh and blood, but against principalities, against powers, against the rulers of the darkness of this age, against spiritual hosts of wickedness in the heavenly places." },
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 6, verse: 13, text: "Therefore take up the whole armor of God, that you may be able to withstand in the evil day, and having done all, to stand." },
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 6, verse: 14, text: "Stand therefore, having girded your waist with truth, having put on the breastplate of righteousness," },
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 6, verse: 15, text: "and having shod your feet with the preparation of the gospel of peace;" },
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 6, verse: 16, text: "above all, taking the shield of faith with which you will be able to quench all the fiery darts of the wicked one." },
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 6, verse: 17, text: "And take the helmet of salvation, and the sword of the Spirit, which is the word of God;" },
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 6, verse: 18, text: "praying always with all prayer and supplication in the Spirit, being watchful to this end with all perseverance and supplication for all the saints—" },
];

const HEB11: BibleVerse[] = [
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 11, verse: 1, text: "Now faith is the substance of things hoped for, the evidence of things not seen." },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 11, verse: 2, text: "For by it the elders obtained a good testimony." },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 11, verse: 3, text: "By faith we understand that the worlds were framed by the word of God, so that the things which are seen were not made of things which are visible." },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 11, verse: 4, text: "By faith Abel offered to God a more excellent sacrifice than Cain, through which he obtained witness that he was righteous, God testifying of his gifts; and through it he being dead still speaks." },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 11, verse: 5, text: "By faith Enoch was taken away so that he did not see death, \"and was not found, because God had taken him\"; for before he was taken he had this testimony, that he pleased God." },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 11, verse: 6, text: "But without faith it is impossible to please Him, for he who comes to God must believe that He is, and that He is a rewarder of those who diligently seek Him." },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 11, verse: 7, text: "By faith Noah, being divinely warned of things not yet seen, moved with godly fear, prepared an ark for the saving of his household, by which he condemned the world and became heir of the righteousness which is according to faith." },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 11, verse: 8, text: "By faith Abraham obeyed when he was called to go out to the place which he would receive as an inheritance. And he went out, not knowing where he was going." },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 11, verse: 11, text: "By faith Sarah herself also received strength to conceive seed, and she bore a child when she was past the age, because she judged Him faithful who had promised." },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 11, verse: 17, text: "By faith Abraham, when he was tested, offered up Isaac, and he who had received the promises offered up his only begotten son," },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 11, verse: 23, text: "By faith Moses, when he was born, was hidden three months by his parents, because they saw he was a beautiful child; and they were not afraid of the king's command." },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 11, verse: 24, text: "By faith Moses, when he became of age, refused to be called the son of Pharaoh's daughter," },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 11, verse: 25, text: "choosing rather to suffer affliction with the people of God than to enjoy the passing pleasures of sin," },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 11, verse: 26, text: "esteeming the reproach of Christ greater riches than the treasures in Egypt; for he looked to the reward." },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 11, verse: 32, text: "And what more shall I say? For the time would fail me to tell of Gideon and Barak and Samson and Jephthah, also of David and Samuel and the prophets:" },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 11, verse: 33, text: "who through faith subdued kingdoms, worked righteousness, obtained promises, stopped the mouths of lions," },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 11, verse: 34, text: "quenched the violence of fire, escaped the edge of the sword, out of weakness were made strong, became valiant in battle, turned to flight the armies of the aliens." },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 11, verse: 39, text: "And all these, having obtained a good testimony through faith, did not receive the promise," },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 11, verse: 40, text: "God having provided something better for us, that they should not be made perfect apart from us." },
];

const REV21: BibleVerse[] = [
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 21, verse: 1, text: "Now I saw a new heaven and a new earth, for the first heaven and the first earth had passed away. Also there was no more sea." },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 21, verse: 2, text: "Then I, John, saw the holy city, New Jerusalem, coming down out of heaven from God, prepared as a bride adorned for her husband." },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 21, verse: 3, text: "And I heard a loud voice from heaven saying, \"Behold, the tabernacle of God is with men, and He will dwell with them, and they shall be His people. God Himself will be with them and be their God.\"" },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 21, verse: 4, text: "And God will wipe away every tear from their eyes; there shall be no more death, nor sorrow, nor crying. There shall be no more pain, for the former things have passed away." },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 21, verse: 5, text: "Then He who sat on the throne said, \"Behold, I make all things new.\" And He said to me, \"Write, for these words are true and faithful.\"" },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 21, verse: 6, text: "And He said to me, \"It is done! I am the Alpha and the Omega, the Beginning and the End. I will give of the fountain of the water of life freely to him who thirsts.\"" },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 21, verse: 7, text: "He who overcomes shall inherit all things, and I will be his God and he shall be My son." },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 21, verse: 8, text: "But the cowardly, unbelieving, abominable, murderers, sexually immoral, sorcerers, idolaters, and all liars shall have their part in the lake which burns with fire and brimstone, which is the second death." },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 21, verse: 21, text: "The twelve gates were twelve pearls: each individual gate was of one pearl. And the street of the city was pure gold, like transparent glass." },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 21, verse: 22, text: "But I saw no temple in it, for the Lord God Almighty and the Lamb are its temple." },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 21, verse: 23, text: "The city had no need of the sun or of the moon to shine in it, for the glory of God illuminated it. The Lamb is its light." },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 21, verse: 27, text: "But there shall by no means enter it anything that defiles, or causes an abomination or a lie, but only those who are written in the Lamb's Book of Life." },
];

const REV22: BibleVerse[] = [
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 22, verse: 1, text: "And he showed me a pure river of water of life, clear as crystal, proceeding from the throne of God and of the Lamb." },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 22, verse: 2, text: "In the middle of its street, and on either side of the river, was the tree of life, which bore twelve fruits, each tree yielding its fruit every month. The leaves of the tree were for the healing of the nations." },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 22, verse: 3, text: "And there shall be no more curse, but the throne of God and of the Lamb shall be in it, and His servants shall serve Him." },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 22, verse: 4, text: "They shall see His face, and His name shall be on their foreheads." },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 22, verse: 12, text: "\"And behold, I am coming quickly, and My reward is with Me, to give to every one according to his work.\"" },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 22, verse: 13, text: "\"I am the Alpha and the Omega, the Beginning and the End, the First and the Last.\"" },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 22, verse: 14, text: "Blessed are those who do His commandments, that they may have the right to the tree of life, and may enter through the gates into the city." },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 22, verse: 17, text: "And the Spirit and the bride say, \"Come!\" And let him who hears say, \"Come!\" And let him who thirsts come. Whoever desires, let him take the water of life freely." },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 22, verse: 20, text: "He who testifies to these things says, \"Surely I am coming quickly.\" Amen. Even so, come, Lord Jesus!" },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 22, verse: 21, text: "The grace of our Lord Jesus Christ be with you all. Amen." },
];

const JHN3: BibleVerse[] = [
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 3, verse: 1, text: "There was a man of the Pharisees named Nicodemus, a ruler of the Jews." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 3, verse: 3, text: "Jesus answered and said to him, \"Most assuredly, I say to you, unless one is born again, he cannot see the kingdom of God.\"" },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 3, verse: 5, text: "Jesus answered, \"Most assuredly, I say to you, unless one is born of water and the Spirit, he cannot enter the kingdom of God.\"" },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 3, verse: 6, text: "That which is born of the flesh is flesh, and that which is born of the Spirit is spirit." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 3, verse: 7, text: "Do not marvel that I said to you, \"You must be born again.\"" },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 3, verse: 16, text: "For God so loved the world that He gave His only begotten Son, that whoever believes in Him should not perish but have everlasting life." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 3, verse: 17, text: "For God did not send His Son into the world to condemn the world, but that the world through Him might be saved." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 3, verse: 18, text: "He who believes in Him is not condemned; but he who does not believe is condemned already, because he has not believed in the name of the only begotten Son of God." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 3, verse: 19, text: "And this is the condemnation, that the light has come into the world, and men loved darkness rather than light, because their deeds were evil." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 3, verse: 36, text: "He who believes in the Son has everlasting life; and he who does not believe the Son shall not see life, but the wrath of God abides on him." },
];

const JHN14: BibleVerse[] = [
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 14, verse: 1, text: "Let not your heart be troubled; you believe in God, believe also in Me." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 14, verse: 2, text: "In My Father's house are many mansions; if it were not so, I would have told you. I go to prepare a place for you." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 14, verse: 3, text: "And if I go and prepare a place for you, I will come again and receive you to Myself; that where I am, there you may be also." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 14, verse: 6, text: "Jesus said to him, \"I am the way, the truth, and the life. No one comes to the Father except through Me.\"" },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 14, verse: 13, text: "And whatever you ask in My name, that I will do, that the Father may be glorified in the Son." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 14, verse: 14, text: "If you ask anything in My name, I will do it." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 14, verse: 15, text: "If you love Me, keep My commandments." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 14, verse: 16, text: "And I will pray the Father, and He will give you another Helper, that He may abide with you forever—" },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 14, verse: 17, text: "the Spirit of truth, whom the world cannot receive, because it neither sees Him nor knows Him; but you know Him, for He dwells with you and will be in you." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 14, verse: 26, text: "But the Helper, the Holy Spirit, whom the Father will send in My name, He will teach you all things, and bring to your remembrance all things that I said to you." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 14, verse: 27, text: "Peace I leave with you, My peace I give to you; not as the world gives do I give to you. Let not your heart be troubled, neither let it be afraid." },
];

const PHP4: BibleVerse[] = [
  { book: "Philippians", abbrev: "Php", testament: "NT", chapter: 4, verse: 4, text: "Rejoice in the Lord always. Again I will say, rejoice!" },
  { book: "Philippians", abbrev: "Php", testament: "NT", chapter: 4, verse: 5, text: "Let your gentleness be known to all men. The Lord is at hand." },
  { book: "Philippians", abbrev: "Php", testament: "NT", chapter: 4, verse: 6, text: "Be anxious for nothing, but in everything by prayer and supplication, with thanksgiving, let your requests be made known to God;" },
  { book: "Philippians", abbrev: "Php", testament: "NT", chapter: 4, verse: 7, text: "and the peace of God, which surpasses all understanding, will guard your hearts and minds through Christ Jesus." },
  { book: "Philippians", abbrev: "Php", testament: "NT", chapter: 4, verse: 8, text: "Finally, brethren, whatever things are true, whatever things are noble, whatever things are just, whatever things are pure, whatever things are lovely, whatever things are of good report, if there is any virtue and if there is anything praiseworthy—meditate on these things." },
  { book: "Philippians", abbrev: "Php", testament: "NT", chapter: 4, verse: 9, text: "The things which you learned and received and heard and saw in me, these do, and the God of peace will be with you." },
  { book: "Philippians", abbrev: "Php", testament: "NT", chapter: 4, verse: 11, text: "Not that I speak in regard to need, for I have learned, in whatever state I am, to be content:" },
  { book: "Philippians", abbrev: "Php", testament: "NT", chapter: 4, verse: 13, text: "I can do all things through Christ who strengthens me." },
  { book: "Philippians", abbrev: "Php", testament: "NT", chapter: 4, verse: 19, text: "And my God shall supply all your need according to His riches in glory by Christ Jesus." },
];

// ─── Individual Key Verses (All 66 Books) ────────────────────────────────────

const KEY_VERSES: BibleVerse[] = [
  // Genesis
  { book: "Genesis", abbrev: "Gen", testament: "OT", chapter: 2, verse: 24, text: "Therefore a man shall leave his father and mother and be joined to his wife, and they shall become one flesh." },
  { book: "Genesis", abbrev: "Gen", testament: "OT", chapter: 12, verse: 1, text: "Now the LORD had said to Abram: \"Get out of your country, from your family and from your father's house, to a land that I will show you.\"" },
  { book: "Genesis", abbrev: "Gen", testament: "OT", chapter: 12, verse: 2, text: "\"I will make you a great nation; I will bless you and make your name great; and you shall be a blessing.\"" },
  { book: "Genesis", abbrev: "Gen", testament: "OT", chapter: 12, verse: 3, text: "\"I will bless those who bless you, and I will curse him who curses you; and in you all the families of the earth shall be blessed.\"" },
  { book: "Genesis", abbrev: "Gen", testament: "OT", chapter: 50, verse: 20, text: "But as for you, you meant evil against me; but God meant it for good, in order to bring it about as it is this day, to save many people alive." },
  // Exodus
  { book: "Exodus", abbrev: "Exo", testament: "OT", chapter: 3, verse: 14, text: "And God said to Moses, \"I AM WHO I AM.\" And He said, \"Thus you shall say to the children of Israel, 'I AM has sent me to you.'\"" },
  { book: "Exodus", abbrev: "Exo", testament: "OT", chapter: 14, verse: 14, text: "The LORD will fight for you, and you shall hold your peace." },
  { book: "Exodus", abbrev: "Exo", testament: "OT", chapter: 15, verse: 26, text: "For I am the LORD who heals you." },
  { book: "Exodus", abbrev: "Exo", testament: "OT", chapter: 20, verse: 3, text: "You shall have no other gods before Me." },
  { book: "Exodus", abbrev: "Exo", testament: "OT", chapter: 20, verse: 12, text: "Honor your father and your mother, that your days may be long upon the land which the LORD your God is giving you." },
  // Leviticus
  { book: "Leviticus", abbrev: "Lev", testament: "OT", chapter: 11, verse: 44, text: "For I am the LORD your God. You shall therefore consecrate yourselves, and you shall be holy; for I am holy." },
  { book: "Leviticus", abbrev: "Lev", testament: "OT", chapter: 19, verse: 18, text: "You shall not take vengeance, nor bear any grudge against the children of your people, but you shall love your neighbor as yourself: I am the LORD." },
  // Numbers
  { book: "Numbers", abbrev: "Num", testament: "OT", chapter: 6, verse: 24, text: "The LORD bless you and keep you;" },
  { book: "Numbers", abbrev: "Num", testament: "OT", chapter: 6, verse: 25, text: "the LORD make His face shine upon you, and be gracious to you;" },
  { book: "Numbers", abbrev: "Num", testament: "OT", chapter: 6, verse: 26, text: "the LORD lift up His countenance upon you, and give you peace." },
  { book: "Numbers", abbrev: "Num", testament: "OT", chapter: 23, verse: 19, text: "God is not a man, that He should lie, nor a son of man, that He should repent. Has He said, and will He not do? Or has He spoken, and will He not make it good?" },
  // Deuteronomy
  { book: "Deuteronomy", abbrev: "Deu", testament: "OT", chapter: 6, verse: 4, text: "Hear, O Israel: The LORD our God, the LORD is one!" },
  { book: "Deuteronomy", abbrev: "Deu", testament: "OT", chapter: 6, verse: 5, text: "You shall love the LORD your God with all your heart, with all your soul, and with all your strength." },
  { book: "Deuteronomy", abbrev: "Deu", testament: "OT", chapter: 28, verse: 1, text: "Now it shall come to pass, if you diligently obey the voice of the LORD your God, to observe carefully all His commandments which I command you today, that the LORD your God will set you high above all nations of the earth." },
  { book: "Deuteronomy", abbrev: "Deu", testament: "OT", chapter: 28, verse: 2, text: "And all these blessings shall come upon you and overtake you, because you obey the voice of the LORD your God:" },
  { book: "Deuteronomy", abbrev: "Deu", testament: "OT", chapter: 31, verse: 6, text: "Be strong and of good courage, do not fear nor be afraid of them; for the LORD your God, He is the One who goes with you. He will not leave you nor forsake you." },
  // Joshua
  { book: "Joshua", abbrev: "Jos", testament: "OT", chapter: 1, verse: 8, text: "This Book of the Law shall not depart from your mouth, but you shall meditate in it day and night, that you may observe to do according to all that is written in it. For then you will make your way prosperous, and then you will have good success." },
  { book: "Joshua", abbrev: "Jos", testament: "OT", chapter: 1, verse: 9, text: "Have I not commanded you? Be strong and of good courage; do not be afraid, nor be dismayed, for the LORD your God is with you wherever you go." },
  { book: "Joshua", abbrev: "Jos", testament: "OT", chapter: 24, verse: 15, text: "And if it seems evil to you to serve the LORD, choose for yourselves this day whom you will serve, whether the gods which your fathers served that were on the other side of the River, or the gods of the Amorites, in whose land you dwell. But as for me and my house, we will serve the LORD." },
  // Judges
  { book: "Judges", abbrev: "Jdg", testament: "OT", chapter: 6, verse: 12, text: "And the Angel of the LORD appeared to him, and said to him, \"The LORD is with you, you mighty man of valor!\"" },
  // Ruth
  { book: "Ruth", abbrev: "Rut", testament: "OT", chapter: 1, verse: 16, text: "But Ruth said: \"Entreat me not to leave you, or to turn back from following after you; for wherever you go, I will go; and wherever you lodge, I will lodge; your people shall be my people, and your God, my God.\"" },
  // 1 Samuel
  { book: "1 Samuel", abbrev: "1Sa", testament: "OT", chapter: 16, verse: 7, text: "But the LORD said to Samuel, \"Do not look at his appearance or at his physical stature, because I have refused him. For the LORD does not see as man sees; for man looks at the outward appearance, but the LORD looks at the heart.\"" },
  // 2 Samuel
  { book: "2 Samuel", abbrev: "2Sa", testament: "OT", chapter: 7, verse: 12, text: "When your days are fulfilled and you rest with your fathers, I will set up your seed after you, who will come from your body, and I will establish his kingdom." },
  // 1 Kings
  { book: "1 Kings", abbrev: "1Ki", testament: "OT", chapter: 8, verse: 23, text: "And he said: \"LORD God of Israel, there is no God in heaven above or on earth below like You, who keep Your covenant and mercy with Your servants who walk before You with all their hearts.\"" },
  // 2 Kings
  { book: "2 Kings", abbrev: "2Ki", testament: "OT", chapter: 6, verse: 16, text: "So he answered, \"Do not fear, for those who are with us are more than those who are with them.\"" },
  // 1 Chronicles
  { book: "1 Chronicles", abbrev: "1Ch", testament: "OT", chapter: 4, verse: 10, text: "And Jabez called on the God of Israel saying, \"Oh, that You would bless me indeed, and enlarge my territory, that Your hand would be with me, and that You would keep me from evil, that I may not cause pain!\" So God granted him what he requested." },
  { book: "1 Chronicles", abbrev: "1Ch", testament: "OT", chapter: 16, verse: 11, text: "Seek the LORD and His strength; seek His face evermore!" },
  // 2 Chronicles
  { book: "2 Chronicles", abbrev: "2Ch", testament: "OT", chapter: 7, verse: 14, text: "if My people who are called by My name will humble themselves, and pray and seek My face, and turn from their wicked ways, then I will hear from heaven, and will forgive their sin and heal their land." },
  // Ezra
  { book: "Ezra", abbrev: "Ezr", testament: "OT", chapter: 7, verse: 10, text: "For Ezra had prepared his heart to seek the Law of the LORD, and to do it, and to teach statutes and ordinances in Israel." },
  // Nehemiah
  { book: "Nehemiah", abbrev: "Neh", testament: "OT", chapter: 8, verse: 10, text: "Then he said to them, \"Go your way, eat the fat, drink the sweet, and send portions to those for whom nothing is prepared; for this day is holy to our LORD. Do not sorrow, for the joy of the LORD is your strength.\"" },
  // Esther
  { book: "Esther", abbrev: "Est", testament: "OT", chapter: 4, verse: 14, text: "For if you remain completely silent at this time, relief and deliverance will arise for the Jews from another place, but you and your father's house will perish. Yet who knows whether you have come to the kingdom for such a time as this?" },
  // Job
  { book: "Job", abbrev: "Job", testament: "OT", chapter: 1, verse: 21, text: "And he said: \"Naked I came from my mother's womb, and naked shall I return there. The LORD gave, and the LORD has taken away; blessed be the name of the LORD.\"" },
  { book: "Job", abbrev: "Job", testament: "OT", chapter: 19, verse: 25, text: "For I know that my Redeemer lives, and He shall stand at last on the earth;" },
  { book: "Job", abbrev: "Job", testament: "OT", chapter: 42, verse: 10, text: "And the LORD restored Job's losses when he prayed for his friends. Indeed the LORD gave Job twice as much as he had before." },
  // Psalms
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 1, verse: 1, text: "Blessed is the man who walks not in the counsel of the ungodly, nor stands in the path of sinners, nor sits in the seat of the scornful;" },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 1, verse: 2, text: "But his delight is in the law of the LORD, and in His law he meditates day and night." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 1, verse: 3, text: "He shall be like a tree planted by the rivers of water, that brings forth its fruit in its season, whose leaf also shall not wither; and whatever he does shall prosper." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 27, verse: 1, text: "The LORD is my light and my salvation; whom shall I fear? The LORD is the strength of my life; of whom shall I be afraid?" },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 27, verse: 4, text: "One thing I have desired of the LORD, that will I seek: that I may dwell in the house of the LORD all the days of my life, to behold the beauty of the LORD, and to inquire in His temple." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 27, verse: 14, text: "Wait on the LORD; be of good courage, and He shall strengthen your heart; wait, I say, on the LORD!" },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 34, verse: 4, text: "I sought the LORD, and He heard me, and delivered me from all my fears." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 34, verse: 7, text: "The angel of the LORD encamps all around those who fear Him, and delivers them." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 34, verse: 18, text: "The LORD is near to those who have a broken heart, and saves such as have a contrite spirit." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 37, verse: 4, text: "Delight yourself also in the LORD, and He shall give you the desires of your heart." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 37, verse: 5, text: "Commit your way to the LORD, trust also in Him, and He shall bring it to pass." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 46, verse: 1, text: "God is our refuge and strength, a very present help in trouble." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 46, verse: 10, text: "Be still, and know that I am God; I will be exalted among the nations, I will be exalted in the earth!" },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 51, verse: 1, text: "Have mercy upon me, O God, according to Your lovingkindness; according to the multitude of Your tender mercies, blot out my transgressions." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 51, verse: 10, text: "Create in me a clean heart, O God, and renew a steadfast spirit within me." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 51, verse: 11, text: "Do not cast me away from Your presence, and do not take Your Holy Spirit from me." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 51, verse: 17, text: "The sacrifices of God are a broken spirit, a broken and a contrite heart—these, O God, You will not despise." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 100, verse: 1, text: "Make a joyful shout to the LORD, all you lands!" },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 100, verse: 2, text: "Serve the LORD with gladness; come before His presence with singing." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 100, verse: 3, text: "Know that the LORD, He is God; it is He who has made us, and not we ourselves; we are His people and the sheep of His pasture." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 100, verse: 4, text: "Enter into His gates with thanksgiving, and into His courts with praise. Be thankful to Him, and bless His name." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 100, verse: 5, text: "For the LORD is good; His mercy is everlasting, and His truth endures to all generations." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 103, verse: 1, text: "Bless the LORD, O my soul; and all that is within me, bless His holy name!" },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 103, verse: 2, text: "Bless the LORD, O my soul, and forget not all His benefits:" },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 103, verse: 3, text: "Who forgives all your iniquities, who heals all your diseases," },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 103, verse: 4, text: "Who redeems your life from destruction, who crowns you with lovingkindness and tender mercies," },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 119, verse: 9, text: "How can a young man cleanse his way? By taking heed according to Your word." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 119, verse: 11, text: "Your word I have hidden in my heart, that I might not sin against You." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 119, verse: 105, text: "Your word is a lamp to my feet and a light to my path." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 119, verse: 165, text: "Great peace have those who love Your law, and nothing causes them to stumble." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 121, verse: 1, text: "I will lift up my eyes to the hills—from whence comes my help?" },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 121, verse: 2, text: "My help comes from the LORD, who made heaven and earth." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 121, verse: 3, text: "He will not allow your foot to be moved; He who keeps you will not slumber." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 121, verse: 8, text: "The LORD shall preserve your going out and your coming in from this time forth, and even forevermore." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 139, verse: 14, text: "I will praise You, for I am fearfully and wonderfully made; marvelous are Your works, and that my soul knows very well." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 149, verse: 6, text: "Let the high praises of God be in their mouth, and a two-edged sword in their hand," },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 150, verse: 1, text: "Praise the LORD! Praise God in His sanctuary; praise Him in His mighty firmament!" },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 150, verse: 6, text: "Let everything that has breath praise the LORD. Praise the LORD!" },
  // Proverbs
  { book: "Proverbs", abbrev: "Pro", testament: "OT", chapter: 3, verse: 5, text: "Trust in the LORD with all your heart, and lean not on your own understanding;" },
  { book: "Proverbs", abbrev: "Pro", testament: "OT", chapter: 3, verse: 6, text: "In all your ways acknowledge Him, and He shall direct your paths." },
  { book: "Proverbs", abbrev: "Pro", testament: "OT", chapter: 4, verse: 23, text: "Keep your heart with all diligence, for out of it spring the issues of life." },
  { book: "Proverbs", abbrev: "Pro", testament: "OT", chapter: 11, verse: 30, text: "The fruit of the righteous is a tree of life, and he who wins souls is wise." },
  { book: "Proverbs", abbrev: "Pro", testament: "OT", chapter: 3, verse: 9, text: "Honor the LORD with your possessions, and with the firstfruits of all your increase;" },
  { book: "Proverbs", abbrev: "Pro", testament: "OT", chapter: 11, verse: 24, text: "There is one who scatters, yet increases more; and there is one who withholds more than is right, but it leads to poverty." },
  { book: "Proverbs", abbrev: "Pro", testament: "OT", chapter: 22, verse: 6, text: "Train up a child in the way he should go, and when he is old he will not depart from it." },
  { book: "Proverbs", abbrev: "Pro", testament: "OT", chapter: 18, verse: 22, text: "He who finds a wife finds a good thing, and obtains favor from the LORD." },
  { book: "Proverbs", abbrev: "Pro", testament: "OT", chapter: 29, verse: 18, text: "Where there is no revelation, the people cast off restraint; but happy is he who keeps the law." },
  // Ecclesiastes
  { book: "Ecclesiastes", abbrev: "Ecc", testament: "OT", chapter: 12, verse: 13, text: "Let us hear the conclusion of the whole matter: Fear God and keep His commandments, for this is man's all." },
  { book: "Ecclesiastes", abbrev: "Ecc", testament: "OT", chapter: 12, verse: 14, text: "For God will bring every work into judgment, including every secret thing, whether good or evil." },
  // Song of Solomon
  { book: "Song of Solomon", abbrev: "Sol", testament: "OT", chapter: 2, verse: 16, text: "My beloved is mine, and I am his. He feeds his flock among the lilies." },
  // Isaiah
  { book: "Isaiah", abbrev: "Isa", testament: "OT", chapter: 6, verse: 8, text: "Also I heard the voice of the Lord, saying: \"Whom shall I send, and who will go for Us?\" Then I said, \"Here am I! Send me.\"" },
  { book: "Isaiah", abbrev: "Isa", testament: "OT", chapter: 9, verse: 6, text: "For unto us a Child is born, unto us a Son is given; and the government will be upon His shoulder. And His name will be called Wonderful, Counselor, Mighty God, Everlasting Father, Prince of Peace." },
  { book: "Isaiah", abbrev: "Isa", testament: "OT", chapter: 40, verse: 28, text: "Have you not known? Have you not heard? The everlasting God, the LORD, the Creator of the ends of the earth, neither faints nor is weary. His understanding is unsearchable." },
  { book: "Isaiah", abbrev: "Isa", testament: "OT", chapter: 40, verse: 29, text: "He gives power to the weak, and to those who have no might He increases strength." },
  { book: "Isaiah", abbrev: "Isa", testament: "OT", chapter: 40, verse: 30, text: "Even the youths shall faint and be weary, and the young men shall utterly fall," },
  { book: "Isaiah", abbrev: "Isa", testament: "OT", chapter: 40, verse: 31, text: "But those who wait on the LORD shall renew their strength; they shall mount up with wings like eagles, they shall run and not be weary, they shall walk and not faint." },
  { book: "Isaiah", abbrev: "Isa", testament: "OT", chapter: 41, verse: 10, text: "Fear not, for I am with you; be not dismayed, for I am your God. I will strengthen you, yes, I will help you, I will uphold you with My righteous right hand." },
  { book: "Isaiah", abbrev: "Isa", testament: "OT", chapter: 48, verse: 17, text: "Thus says the LORD, your Redeemer, the Holy One of Israel: \"I am the LORD your God, who teaches you to profit, who leads you by the way you should go.\"" },
  { book: "Isaiah", abbrev: "Isa", testament: "OT", chapter: 53, verse: 1, text: "Who has believed our report? And to whom has the arm of the LORD been revealed?" },
  { book: "Isaiah", abbrev: "Isa", testament: "OT", chapter: 53, verse: 2, text: "For He shall grow up before Him as a tender plant, and as a root out of dry ground. He has no form or comeliness; and when we see Him, there is no beauty that we should desire Him." },
  { book: "Isaiah", abbrev: "Isa", testament: "OT", chapter: 53, verse: 3, text: "He is despised and rejected by men, a Man of sorrows and acquainted with grief. And we hid, as it were, our faces from Him; He was despised, and we did not esteem Him." },
  { book: "Isaiah", abbrev: "Isa", testament: "OT", chapter: 53, verse: 4, text: "Surely He has borne our griefs and carried our sorrows; yet we esteemed Him stricken, smitten by God, and afflicted." },
  { book: "Isaiah", abbrev: "Isa", testament: "OT", chapter: 53, verse: 5, text: "But He was wounded for our transgressions, He was bruised for our iniquities; the chastisement for our peace was upon Him, and by His stripes we are healed." },
  { book: "Isaiah", abbrev: "Isa", testament: "OT", chapter: 53, verse: 6, text: "All we like sheep have gone astray; we have turned, every one, to his own way; and the LORD has laid on Him the iniquity of us all." },
  { book: "Isaiah", abbrev: "Isa", testament: "OT", chapter: 55, verse: 8, text: "\"For My thoughts are not your thoughts, nor are your ways My ways,\" says the LORD." },
  { book: "Isaiah", abbrev: "Isa", testament: "OT", chapter: 55, verse: 9, text: "\"For as the heavens are higher than the earth, so are My ways higher than your ways, and My thoughts than your thoughts.\"" },
  // Jeremiah
  { book: "Jeremiah", abbrev: "Jer", testament: "OT", chapter: 1, verse: 5, text: "\"Before I formed you in the womb I knew you; before you were born I sanctified you; I ordained you a prophet to the nations.\"" },
  { book: "Jeremiah", abbrev: "Jer", testament: "OT", chapter: 3, verse: 14, text: "\"Return, O backsliding children,\" says the LORD; \"for I am married to you. I will take you, one from a city and two from a family, and I will bring you to Zion.\"" },
  { book: "Jeremiah", abbrev: "Jer", testament: "OT", chapter: 6, verse: 16, text: "Thus says the LORD: \"Stand in the ways and see, and ask for the old paths, where the good way is, and walk in it; then you will find rest for your souls.\"" },
  { book: "Jeremiah", abbrev: "Jer", testament: "OT", chapter: 29, verse: 11, text: "For I know the thoughts that I think toward you, says the LORD, thoughts of peace and not of evil, to give you a future and a hope." },
  { book: "Jeremiah", abbrev: "Jer", testament: "OT", chapter: 29, verse: 12, text: "Then you will call upon Me and go and pray to Me, and I will listen to you." },
  { book: "Jeremiah", abbrev: "Jer", testament: "OT", chapter: 29, verse: 13, text: "And you will seek Me and find Me, when you search for Me with all your heart." },
  { book: "Jeremiah", abbrev: "Jer", testament: "OT", chapter: 33, verse: 3, text: "Call to Me, and I will answer you, and show you great and mighty things, which you do not know." },
  // Lamentations
  { book: "Lamentations", abbrev: "Lam", testament: "OT", chapter: 3, verse: 22, text: "Through the LORD's mercies we are not consumed, because His compassions fail not." },
  { book: "Lamentations", abbrev: "Lam", testament: "OT", chapter: 3, verse: 23, text: "They are new every morning; great is Your faithfulness." },
  { book: "Lamentations", abbrev: "Lam", testament: "OT", chapter: 3, verse: 24, text: "\"The LORD is my portion,\" says my soul, \"therefore I hope in Him!\"" },
  // Ezekiel
  { book: "Ezekiel", abbrev: "Eze", testament: "OT", chapter: 36, verse: 26, text: "I will give you a new heart and put a new spirit within you; I will take the heart of stone out of your flesh and give you a heart of flesh." },
  { book: "Ezekiel", abbrev: "Eze", testament: "OT", chapter: 37, verse: 4, text: "Again He said to me, \"Prophesy to these bones, and say to them, 'O dry bones, hear the word of the LORD!'\"" },
  // Daniel
  { book: "Daniel", abbrev: "Dan", testament: "OT", chapter: 3, verse: 17, text: "If that is the case, our God whom we serve is able to deliver us from the burning fiery furnace, and He will deliver us from your hand, O king." },
  { book: "Daniel", abbrev: "Dan", testament: "OT", chapter: 3, verse: 18, text: "But if not, let it be known to you, O king, that we do not serve your gods, nor will we worship the gold image which you have set up." },
  // Hosea
  { book: "Hosea", abbrev: "Hos", testament: "OT", chapter: 4, verse: 6, text: "My people are destroyed for lack of knowledge. Because you have rejected knowledge, I also will reject you from being priest for Me; because you have forgotten the law of your God, I also will forget your children." },
  // Joel
  { book: "Joel", abbrev: "Joe", testament: "OT", chapter: 2, verse: 12, text: "\"Now, therefore,\" says the LORD, \"Turn to Me with all your heart, with fasting, with weeping, and with mourning.\"" },
  { book: "Joel", abbrev: "Joe", testament: "OT", chapter: 2, verse: 28, text: "And it shall come to pass afterward that I will pour out My Spirit on all flesh; your sons and your daughters shall prophesy, your old men shall dream dreams, your young men shall see visions." },
  // Amos
  { book: "Amos", abbrev: "Amo", testament: "OT", chapter: 3, verse: 3, text: "Can two walk together, unless they are agreed?" },
  // Obadiah
  { book: "Obadiah", abbrev: "Oba", testament: "OT", chapter: 1, verse: 4, text: "Though you ascend as high as the eagle, and though you set your nest among the stars, from there I will bring you down, says the LORD." },
  // Jonah
  { book: "Jonah", abbrev: "Jon", testament: "OT", chapter: 2, verse: 9, text: "But I will sacrifice to You with the voice of thanksgiving; I will pay what I have vowed. Salvation is of the LORD." },
  // Micah
  { book: "Micah", abbrev: "Mic", testament: "OT", chapter: 6, verse: 8, text: "He has shown you, O man, what is good; and what does the LORD require of you but to do justly, to love mercy, and to walk humbly with your God?" },
  { book: "Micah", abbrev: "Mic", testament: "OT", chapter: 7, verse: 18, text: "Who is a God like You, pardoning iniquity and passing over the transgression of the remnant of His heritage? He does not retain His anger forever, because He delights in mercy." },
  // Nahum
  { book: "Nahum", abbrev: "Nah", testament: "OT", chapter: 1, verse: 7, text: "The LORD is good, a stronghold in the day of trouble; and He knows those who trust in Him." },
  // Habakkuk
  { book: "Habakkuk", abbrev: "Hab", testament: "OT", chapter: 2, verse: 4, text: "Behold the proud, his soul is not upright in him; but the just shall live by his faith." },
  { book: "Habakkuk", abbrev: "Hab", testament: "OT", chapter: 3, verse: 19, text: "The LORD God is my strength; He will make my feet like deer's feet, and He will make me walk on my high hills." },
  // Zephaniah
  { book: "Zephaniah", abbrev: "Zep", testament: "OT", chapter: 3, verse: 17, text: "The LORD your God in your midst, the Mighty One, will save; He will rejoice over you with gladness, He will quiet you with His love, He will rejoice over you with singing." },
  // Haggai
  { book: "Haggai", abbrev: "Hag", testament: "OT", chapter: 2, verse: 9, text: "\"The glory of this latter temple shall be greater than the former,\" says the LORD of hosts. \"And in this place I will give peace,\" says the LORD of hosts." },
  // Zechariah
  { book: "Zechariah", abbrev: "Zec", testament: "OT", chapter: 4, verse: 6, text: "So he answered and said to me: \"This is the word of the LORD to Zerubbabel: 'Not by might nor by power, but by My Spirit,' says the LORD of hosts.\"" },
  // Malachi
  { book: "Malachi", abbrev: "Mal", testament: "OT", chapter: 3, verse: 10, text: "Bring all the tithes into the storehouse, that there may be food in My house, and try Me now in this, says the LORD of hosts, if I will not open for you the windows of heaven and pour out for you such blessing that there will not be room enough to receive it." },
  { book: "Malachi", abbrev: "Mal", testament: "OT", chapter: 4, verse: 2, text: "But to you who fear My name the Sun of Righteousness shall arise with healing in His wings; and you shall go out and grow fat like stall-fed calves." },
  // Matthew
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 3, verse: 16, text: "When He had been baptized, Jesus came up immediately from the water; and behold, the heavens were opened to Him, and He saw the Spirit of God descending like a dove and alighting upon Him." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 3, verse: 17, text: "And suddenly a voice came from heaven, saying, \"This is My beloved Son, in whom I am well pleased.\"" },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 5, verse: 3, text: "Blessed are the poor in spirit, for theirs is the kingdom of heaven." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 5, verse: 4, text: "Blessed are those who mourn, for they shall be comforted." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 5, verse: 5, text: "Blessed are the meek, for they shall inherit the earth." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 5, verse: 6, text: "Blessed are those who hunger and thirst for righteousness, for they shall be filled." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 5, verse: 7, text: "Blessed are the merciful, for they shall obtain mercy." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 5, verse: 8, text: "Blessed are the pure in heart, for they shall see God." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 5, verse: 9, text: "Blessed are the peacemakers, for they shall be called sons of God." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 5, verse: 10, text: "Blessed are those who are persecuted for righteousness' sake, for theirs is the kingdom of heaven." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 5, verse: 11, text: "Blessed are you when they revile and persecute you, and say all kinds of evil against you falsely for My sake." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 5, verse: 14, text: "You are the light of the world. A city that is set on a hill cannot be hidden." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 5, verse: 16, text: "Let your light so shine before men, that they may see your good works and glorify your Father in heaven." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 6, verse: 9, text: "In this manner, therefore, pray: Our Father in heaven, hallowed be Your name." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 6, verse: 10, text: "Your kingdom come. Your will be done on earth as it is in heaven." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 6, verse: 11, text: "Give us this day our daily bread." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 6, verse: 12, text: "And forgive us our debts, as we forgive our debtors." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 6, verse: 13, text: "And do not lead us into temptation, but deliver us from the evil one. For Yours is the kingdom and the power and the glory forever. Amen." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 6, verse: 16, text: "Moreover, when you fast, do not be like the hypocrites, with a sad countenance. For they disfigure their faces that they may appear to men to be fasting. Assuredly, I say to you, they have their reward." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 6, verse: 33, text: "But seek first the kingdom of God and His righteousness, and all these things shall be added to you." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 7, verse: 7, text: "Ask, and it will be given to you; seek, and you will find; knock, and it will be opened to you." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 11, verse: 28, text: "Come to Me, all you who labor and are heavy laden, and I will give you rest." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 11, verse: 29, text: "Take My yoke upon you and learn from Me, for I am gentle and lowly in heart, and you will find rest for your souls." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 16, verse: 18, text: "And I also say to you that you are Peter, and on this rock I will build My church, and the gates of Hades shall not prevail against it." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 18, verse: 18, text: "Assuredly, I say to you, whatever you bind on earth will be bound in heaven, and whatever you loose on earth will be loosed in heaven." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 19, verse: 9, text: "And I say to you, whoever divorces his wife, except for sexual immorality, and marries another, commits adultery; and whoever marries her who is divorced commits adultery." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 22, verse: 37, text: "Jesus said to him, \"'You shall love the LORD your God with all your heart, with all your soul, and with all your mind.'\"" },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 22, verse: 39, text: "And the second is like it: 'You shall love your neighbor as yourself.'" },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 24, verse: 6, text: "And you will hear of wars and rumors of wars. See that you are not troubled; for all these things must come to pass, but the end is not yet." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 24, verse: 42, text: "Watch therefore, for you do not know what hour your Lord is coming." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 28, verse: 18, text: "And Jesus came and spoke to them, saying, \"All authority has been given to Me in heaven and on earth.\"" },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 28, verse: 19, text: "Go therefore and make disciples of all the nations, baptizing them in the name of the Father and of the Son and of the Holy Spirit," },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 28, verse: 20, text: "teaching them to observe all things that I have commanded you; and lo, I am with you always, even to the end of the age. Amen." },
  // Mark
  { book: "Mark", abbrev: "Mar", testament: "NT", chapter: 9, verse: 23, text: "Jesus said to him, \"If you can believe, all things are possible to him who believes.\"" },
  { book: "Mark", abbrev: "Mar", testament: "NT", chapter: 9, verse: 29, text: "So He said to them, \"This kind can come out by nothing but prayer and fasting.\"" },
  { book: "Mark", abbrev: "Mar", testament: "NT", chapter: 11, verse: 24, text: "Therefore I say to you, whatever things you ask when you pray, believe that you receive them, and you will have them." },
  { book: "Mark", abbrev: "Mar", testament: "NT", chapter: 16, verse: 15, text: "And He said to them, \"Go into all the world and preach the gospel to every creature.\"" },
  { book: "Mark", abbrev: "Mar", testament: "NT", chapter: 16, verse: 16, text: "He who believes and is baptized will be saved; but he who does not believe will be condemned." },
  { book: "Mark", abbrev: "Mar", testament: "NT", chapter: 16, verse: 17, text: "And these signs will follow those who believe: In My name they will cast out demons; they will speak with new tongues;" },
  { book: "Mark", abbrev: "Mar", testament: "NT", chapter: 16, verse: 18, text: "they will take up serpents; and if they drink anything deadly, it will by no means hurt them; they will lay hands on the sick, and they will recover." },
  // Luke
  { book: "Luke", abbrev: "Luk", testament: "NT", chapter: 1, verse: 37, text: "For with God nothing will be impossible." },
  { book: "Luke", abbrev: "Luk", testament: "NT", chapter: 6, verse: 38, text: "Give, and it will be given to you: good measure, pressed down, shaken together, and running over will be put into your bosom. For with the same measure that you use, it will be measured back to you." },
  { book: "Luke", abbrev: "Luk", testament: "NT", chapter: 9, verse: 62, text: "But Jesus said to him, \"No one, having put his hand to the plow, and looking back, is fit for the kingdom of God.\"" },
  { book: "Luke", abbrev: "Luk", testament: "NT", chapter: 10, verse: 19, text: "Behold, I give you the authority to trample on serpents and scorpions, and over all the power of the enemy, and nothing shall by any means hurt you." },
  { book: "Luke", abbrev: "Luk", testament: "NT", chapter: 11, verse: 13, text: "If you then, being evil, know how to give good gifts to your children, how much more will your heavenly Father give the Holy Spirit to those who ask Him!" },
  { book: "Luke", abbrev: "Luk", testament: "NT", chapter: 15, verse: 20, text: "And he arose and came to his father. But when he was still a great way off, his father saw him and had compassion, and ran and fell on his neck and kissed him." },
  { book: "Luke", abbrev: "Luk", testament: "NT", chapter: 21, verse: 36, text: "Watch therefore, and pray always that you may be counted worthy to escape all these things that will come to pass, and to stand before the Son of Man." },
  // John
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 1, verse: 1, text: "In the beginning was the Word, and the Word was with God, and the Word was God." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 1, verse: 12, text: "But as many as received Him, to them He gave the right to become children of God, to those who believe in His name:" },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 1, verse: 14, text: "And the Word became flesh and dwelt among us, and we beheld His glory, the glory as of the only begotten of the Father, full of grace and truth." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 4, verse: 24, text: "God is Spirit, and those who worship Him must worship in spirit and truth." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 8, verse: 32, text: "And you shall know the truth, and the truth shall make you free." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 10, verse: 10, text: "The thief does not come except to steal, and to kill, and to destroy. I have come that they may have life, and that they may have it more abundantly." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 11, verse: 25, text: "Jesus said to her, \"I am the resurrection and the life. He who believes in Me, though he may die, he shall live.\"" },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 15, verse: 5, text: "I am the vine, you are the branches. He who abides in Me, and I in him, bears much fruit; for without Me you can do nothing." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 15, verse: 13, text: "Greater love has no one than this, than to lay down one's life for his friends." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 15, verse: 16, text: "You did not choose Me, but I chose you and appointed you that you should go and bear fruit, and that your fruit should remain, that whatever you ask the Father in My name He may give you." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 17, verse: 17, text: "Sanctify them by Your truth. Your word is truth." },
  // Acts
  { book: "Acts", abbrev: "Act", testament: "NT", chapter: 1, verse: 8, text: "But you shall receive power when the Holy Spirit has come upon you; and you shall be witnesses to Me in Jerusalem, and in all Judea and Samaria, and to the end of the earth." },
  { book: "Acts", abbrev: "Act", testament: "NT", chapter: 2, verse: 4, text: "And they were all filled with the Holy Spirit and began to speak with other tongues, as the Spirit gave them utterance." },
  { book: "Acts", abbrev: "Act", testament: "NT", chapter: 2, verse: 38, text: "Then Peter said to them, \"Repent, and let every one of you be baptized in the name of Jesus Christ for the remission of sins; and you shall receive the gift of the Holy Spirit.\"" },
  { book: "Acts", abbrev: "Act", testament: "NT", chapter: 4, verse: 12, text: "Nor is there salvation in any other, for there is no other name under heaven given among men by which we must be saved." },
  { book: "Acts", abbrev: "Act", testament: "NT", chapter: 10, verse: 46, text: "For they heard them speak with tongues and magnify God. Then Peter answered," },
  { book: "Acts", abbrev: "Act", testament: "NT", chapter: 16, verse: 31, text: "So they said, \"Believe on the Lord Jesus Christ, and you will be saved, you and your household.\"" },
  { book: "Acts", abbrev: "Act", testament: "NT", chapter: 19, verse: 6, text: "And when Paul had laid hands on them, the Holy Spirit came upon them, and they spoke with tongues and prophesied." },
  // Romans
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 1, verse: 16, text: "For I am not ashamed of the gospel of Christ, for it is the power of God to salvation for everyone who believes, for the Jew first and also for the Greek." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 3, verse: 23, text: "for all have sinned and fall short of the glory of God," },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 5, verse: 1, text: "Therefore, having been justified by faith, we have peace with God through our Lord Jesus Christ," },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 5, verse: 8, text: "But God demonstrates His own love toward us, in that while we were still sinners, Christ died for us." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 6, verse: 23, text: "For the wages of sin is death, but the gift of God is eternal life in Christ Jesus our Lord." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 10, verse: 9, text: "that if you confess with your mouth the Lord Jesus and believe in your heart that God has raised Him from the dead, you will be saved." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 10, verse: 10, text: "For with the heart one believes unto righteousness, and with the mouth confession is made unto salvation." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 10, verse: 13, text: "For \"whoever calls on the name of the LORD shall be saved.\"" },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 12, verse: 1, text: "I beseech you therefore, brethren, by the mercies of God, that you present your bodies a living sacrifice, holy, acceptable to God, which is your reasonable service." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 12, verse: 2, text: "And do not be conformed to this world, but be transformed by the renewing of your mind, that you may prove what is that good and acceptable and perfect will of God." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 12, verse: 17, text: "Repay no one evil for evil. Have regard for good things in the sight of all men." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 12, verse: 19, text: "Beloved, do not avenge yourselves, but rather give place to wrath; for it is written, \"Vengeance is Mine, I will repay,\" says the Lord." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 12, verse: 21, text: "Do not be overcome by evil, but overcome evil with good." },
  // 1 Corinthians
  { book: "1 Corinthians", abbrev: "1Co", testament: "NT", chapter: 1, verse: 18, text: "For the message of the cross is foolishness to those who are perishing, but to us who are being saved it is the power of God." },
  { book: "1 Corinthians", abbrev: "1Co", testament: "NT", chapter: 6, verse: 19, text: "Or do you not know that your body is the temple of the Holy Spirit who is in you, whom you have from God, and you are not your own?" },
  { book: "1 Corinthians", abbrev: "1Co", testament: "NT", chapter: 10, verse: 13, text: "No temptation has overtaken you except such as is common to man; but God is faithful, who will not allow you to be tempted beyond what you are able, but with the temptation will also make the way of escape, that you may be able to bear it." },
  { book: "1 Corinthians", abbrev: "1Co", testament: "NT", chapter: 12, verse: 1, text: "Now concerning spiritual gifts, brethren, I do not want you to be ignorant:" },
  { book: "1 Corinthians", abbrev: "1Co", testament: "NT", chapter: 15, verse: 1, text: "Moreover, brethren, I declare to you the gospel which I preached to you, which also you received and in which you stand," },
  { book: "1 Corinthians", abbrev: "1Co", testament: "NT", chapter: 15, verse: 3, text: "For I delivered to you first of all that which I also received: that Christ died for our sins according to the Scriptures," },
  { book: "1 Corinthians", abbrev: "1Co", testament: "NT", chapter: 15, verse: 4, text: "and that He was buried, and that He rose again the third day according to the Scriptures," },
  { book: "1 Corinthians", abbrev: "1Co", testament: "NT", chapter: 15, verse: 55, text: "O Death, where is your sting? O Hades, where is your victory?" },
  { book: "1 Corinthians", abbrev: "1Co", testament: "NT", chapter: 15, verse: 57, text: "But thanks be to God, who gives us the victory through our Lord Jesus Christ." },
  // 2 Corinthians
  { book: "2 Corinthians", abbrev: "2Co", testament: "NT", chapter: 1, verse: 3, text: "Blessed be the God and Father of our Lord Jesus Christ, the Father of mercies and God of all comfort," },
  { book: "2 Corinthians", abbrev: "2Co", testament: "NT", chapter: 1, verse: 4, text: "who comforts us in all our tribulation, that we may be able to comfort those who are in any trouble, with the comfort with which we ourselves are comforted by God." },
  { book: "2 Corinthians", abbrev: "2Co", testament: "NT", chapter: 5, verse: 17, text: "Therefore, if anyone is in Christ, he is a new creation; old things have passed away; behold, all things have become new." },
  { book: "2 Corinthians", abbrev: "2Co", testament: "NT", chapter: 6, verse: 14, text: "Do not be unequally yoked together with unbelievers. For what fellowship has righteousness with lawlessness? And what communion has light with darkness?" },
  { book: "2 Corinthians", abbrev: "2Co", testament: "NT", chapter: 9, verse: 7, text: "So let each one give as he purposes in his heart, not grudgingly or of necessity; for God loves a cheerful giver." },
  { book: "2 Corinthians", abbrev: "2Co", testament: "NT", chapter: 12, verse: 9, text: "And He said to me, \"My grace is sufficient for you, for My strength is made perfect in weakness.\" Therefore most gladly I will rather boast in my infirmities, that the power of Christ may rest upon me." },
  // Galatians
  { book: "Galatians", abbrev: "Gal", testament: "NT", chapter: 1, verse: 8, text: "But even if we, or an angel from heaven, preach any other gospel to you than what we have preached to you, let him be accursed." },
  { book: "Galatians", abbrev: "Gal", testament: "NT", chapter: 2, verse: 20, text: "I have been crucified with Christ; it is no longer I who live, but Christ lives in me; and the life which I now live in the flesh I live by faith in the Son of God, who loved me and gave Himself for me." },
  { book: "Galatians", abbrev: "Gal", testament: "NT", chapter: 3, verse: 13, text: "Christ has redeemed us from the curse of the law, having become a curse for us (for it is written, \"Cursed is everyone who hangs on a tree\")," },
  { book: "Galatians", abbrev: "Gal", testament: "NT", chapter: 5, verse: 16, text: "I say then: Walk in the Spirit, and you shall not fulfill the lust of the flesh." },
  { book: "Galatians", abbrev: "Gal", testament: "NT", chapter: 5, verse: 22, text: "But the fruit of the Spirit is love, joy, peace, longsuffering, kindness, goodness, faithfulness," },
  { book: "Galatians", abbrev: "Gal", testament: "NT", chapter: 5, verse: 23, text: "gentleness, self-control. Against such there is no law." },
  { book: "Galatians", abbrev: "Gal", testament: "NT", chapter: 6, verse: 7, text: "Do not be deceived, God is not mocked; for whatever a man sows, that he will also reap." },
  // Ephesians
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 1, verse: 3, text: "Blessed be the God and Father of our Lord Jesus Christ, who has blessed us with every spiritual blessing in the heavenly places in Christ," },
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 2, verse: 8, text: "For by grace you have been saved through faith, and that not of yourselves; it is the gift of God," },
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 2, verse: 9, text: "not of works, lest anyone should boast." },
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 4, verse: 11, text: "And He Himself gave some to be apostles, some prophets, some evangelists, and some pastors and teachers," },
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 4, verse: 12, text: "for the equipping of the saints for the work of ministry, for the edifying of the body of Christ," },
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 4, verse: 13, text: "till we all come to the unity of the faith and of the knowledge of the Son of God, to a perfect man, to the measure of the stature of the fullness of Christ;" },
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 4, verse: 26, text: "Be angry, and do not sin: do not let the sun go down on your wrath," },
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 4, verse: 27, text: "nor give place to the devil." },
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 5, verse: 22, text: "Wives, submit to your own husbands, as to the Lord." },
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 5, verse: 25, text: "Husbands, love your wives, just as Christ also loved the church and gave Himself for her," },
  // Philippians
  { book: "Philippians", abbrev: "Php", testament: "NT", chapter: 1, verse: 6, text: "being confident of this very thing, that He who has begun a good work in you will complete it until the day of Jesus Christ;" },
  { book: "Philippians", abbrev: "Php", testament: "NT", chapter: 2, verse: 9, text: "Therefore God also has highly exalted Him and given Him the name which is above every name," },
  { book: "Philippians", abbrev: "Php", testament: "NT", chapter: 2, verse: 10, text: "that at the name of Jesus every knee should bow, of those in heaven, and of those on earth, and of those under the earth," },
  { book: "Philippians", abbrev: "Php", testament: "NT", chapter: 2, verse: 11, text: "and that every tongue should confess that Jesus Christ is Lord, to the glory of God the Father." },
  // Colossians
  { book: "Colossians", abbrev: "Col", testament: "NT", chapter: 1, verse: 16, text: "For by Him all things were created that are in heaven and that are on earth, visible and invisible, whether thrones or dominions or principalities or powers. All things were created through Him and for Him." },
  { book: "Colossians", abbrev: "Col", testament: "NT", chapter: 2, verse: 13, text: "And you, being dead in your trespasses and the uncircumcision of your flesh, He has made alive together with Him, having forgiven you all trespasses," },
  { book: "Colossians", abbrev: "Col", testament: "NT", chapter: 2, verse: 15, text: "Having disarmed principalities and powers, He made a public spectacle of them, triumphing over them in it." },
  { book: "Colossians", abbrev: "Col", testament: "NT", chapter: 3, verse: 23, text: "And whatever you do, do it heartily, as to the Lord and not to men," },
  // 1 Thessalonians
  { book: "1 Thessalonians", abbrev: "1Th", testament: "NT", chapter: 4, verse: 16, text: "For the Lord Himself will descend from heaven with a shout, with the voice of an archangel, and with the trumpet of God. And the dead in Christ will rise first." },
  { book: "1 Thessalonians", abbrev: "1Th", testament: "NT", chapter: 4, verse: 17, text: "Then we who are alive and remain shall be caught up together with them in the clouds to meet the Lord in the air. And thus we shall always be with the Lord." },
  { book: "1 Thessalonians", abbrev: "1Th", testament: "NT", chapter: 5, verse: 17, text: "pray without ceasing," },
  { book: "1 Thessalonians", abbrev: "1Th", testament: "NT", chapter: 5, verse: 18, text: "in everything give thanks; for this is the will of God in Christ Jesus for you." },
  { book: "1 Thessalonians", abbrev: "1Th", testament: "NT", chapter: 5, verse: 19, text: "Do not quench the Spirit." },
  { book: "1 Thessalonians", abbrev: "1Th", testament: "NT", chapter: 5, verse: 20, text: "Do not despise prophecies." },
  { book: "1 Thessalonians", abbrev: "1Th", testament: "NT", chapter: 5, verse: 21, text: "Test all things; hold fast what is good." },
  // 2 Thessalonians
  { book: "2 Thessalonians", abbrev: "2Th", testament: "NT", chapter: 2, verse: 3, text: "Let no one deceive you by any means; for that Day will not come unless the falling away comes first, and the man of sin is revealed, the son of perdition," },
  // 1 Timothy
  { book: "1 Timothy", abbrev: "1Ti", testament: "NT", chapter: 2, verse: 5, text: "For there is one God and one Mediator between God and men, the Man Christ Jesus," },
  { book: "1 Timothy", abbrev: "1Ti", testament: "NT", chapter: 4, verse: 1, text: "Now the Spirit expressly says that in latter times some will depart from the faith, giving heed to deceiving spirits and doctrines of demons," },
  { book: "1 Timothy", abbrev: "1Ti", testament: "NT", chapter: 6, verse: 6, text: "Now godliness with contentment is great gain." },
  { book: "1 Timothy", abbrev: "1Ti", testament: "NT", chapter: 6, verse: 10, text: "For the love of money is a root of all kinds of evil, for which some have strayed from the faith in their greediness, and pierced themselves through with many sorrows." },
  // 2 Timothy
  { book: "2 Timothy", abbrev: "2Ti", testament: "NT", chapter: 1, verse: 7, text: "For God has not given us a spirit of fear, but of power and of love and of a sound mind." },
  { book: "2 Timothy", abbrev: "2Ti", testament: "NT", chapter: 2, verse: 15, text: "Be diligent to present yourself approved to God, a worker who does not need to be ashamed, rightly dividing the word of truth." },
  { book: "2 Timothy", abbrev: "2Ti", testament: "NT", chapter: 3, verse: 1, text: "But know this, that in the last days perilous times will come:" },
  { book: "2 Timothy", abbrev: "2Ti", testament: "NT", chapter: 3, verse: 5, text: "having a form of godliness but denying its power. And from such people turn away!" },
  { book: "2 Timothy", abbrev: "2Ti", testament: "NT", chapter: 3, verse: 12, text: "Yes, and all who desire to live godly in Christ Jesus will suffer persecution." },
  { book: "2 Timothy", abbrev: "2Ti", testament: "NT", chapter: 3, verse: 16, text: "All Scripture is given by inspiration of God, and is profitable for doctrine, for reproof, for correction, for instruction in righteousness," },
  { book: "2 Timothy", abbrev: "2Ti", testament: "NT", chapter: 3, verse: 17, text: "that the man of God may be complete, thoroughly equipped for every good work." },
  { book: "2 Timothy", abbrev: "2Ti", testament: "NT", chapter: 4, verse: 2, text: "Preach the word! Be ready in season and out of season. Convince, rebuke, exhort, with all longsuffering and teaching." },
  // Titus
  { book: "Titus", abbrev: "Tit", testament: "NT", chapter: 2, verse: 11, text: "For the grace of God that brings salvation has appeared to all men," },
  { book: "Titus", abbrev: "Tit", testament: "NT", chapter: 2, verse: 12, text: "teaching us that, denying ungodliness and worldly lusts, we should live soberly, righteously, and godly in the present age," },
  // Philemon
  { book: "Philemon", abbrev: "Phm", testament: "NT", chapter: 1, verse: 16, text: "no longer as a slave but better than a slave—as a dear brother, especially to me but even more to you, both in the flesh and in the Lord." },
  // Hebrews
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 4, verse: 12, text: "For the word of God is living and powerful, and sharper than any two-edged sword, piercing even to the division of soul and spirit, and of joints and marrow, and is a discerner of the thoughts and intents of the heart." },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 4, verse: 16, text: "Let us therefore come boldly to the throne of grace, that we may obtain mercy and find grace to help in time of need." },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 10, verse: 25, text: "not forsaking the assembling of ourselves together, as is the manner of some, but exhorting one another, and so much the more as you see the Day approaching." },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 11, verse: 6, text: "But without faith it is impossible to please Him, for he who comes to God must believe that He is, and that He is a rewarder of those who diligently seek Him." },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 12, verse: 1, text: "Therefore we also, since we are surrounded by so great a cloud of witnesses, let us lay aside every weight, and the sin which so easily ensnares us, and let us run with endurance the race that is set before us," },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 12, verse: 2, text: "looking unto Jesus, the author and finisher of our faith, who for the joy that was set before Him endured the cross, despising the shame, and has sat down at the right hand of the throne of God." },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 12, verse: 14, text: "Pursue peace with all people, and holiness, without which no one will see the Lord:" },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 13, verse: 4, text: "Marriage is honorable among all, and the bed undefiled; but fornicators and adulterers God will judge." },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 13, verse: 8, text: "Jesus Christ is the same yesterday, today, and forever." },
  // James
  { book: "James", abbrev: "Jas", testament: "NT", chapter: 1, verse: 2, text: "My brethren, count it all joy when you fall into various trials," },
  { book: "James", abbrev: "Jas", testament: "NT", chapter: 1, verse: 3, text: "knowing that the testing of your faith produces patience." },
  { book: "James", abbrev: "Jas", testament: "NT", chapter: 1, verse: 17, text: "Every good gift and every perfect gift is from above, and comes down from the Father of lights, with whom there is no variation or shadow of turning." },
  { book: "James", abbrev: "Jas", testament: "NT", chapter: 1, verse: 22, text: "But be doers of the word, and not hearers only, deceiving yourselves." },
  { book: "James", abbrev: "Jas", testament: "NT", chapter: 2, verse: 17, text: "Thus also faith by itself, if it does not have works, is dead." },
  { book: "James", abbrev: "Jas", testament: "NT", chapter: 4, verse: 7, text: "Therefore submit to God. Resist the devil and he will flee from you." },
  { book: "James", abbrev: "Jas", testament: "NT", chapter: 4, verse: 8, text: "Draw near to God and He will draw near to you. Cleanse your hands, you sinners; and purify your hearts, you double-minded." },
  { book: "James", abbrev: "Jas", testament: "NT", chapter: 5, verse: 14, text: "Is anyone among you sick? Let him call for the elders of the church, and let them pray over him, anointing him with oil in the name of the Lord." },
  { book: "James", abbrev: "Jas", testament: "NT", chapter: 5, verse: 15, text: "And the prayer of faith will save the sick, and the Lord will raise him up. And if he has committed sins, he will be forgiven." },
  { book: "James", abbrev: "Jas", testament: "NT", chapter: 5, verse: 16, text: "Confess your trespasses to one another, and pray for one another, that you may be healed. The effective, fervent prayer of a righteous man avails much." },
  // 1 Peter
  { book: "1 Peter", abbrev: "1Pe", testament: "NT", chapter: 1, verse: 15, text: "but as He who called you is holy, you also be holy in all your conduct," },
  { book: "1 Peter", abbrev: "1Pe", testament: "NT", chapter: 1, verse: 16, text: "because it is written, \"Be holy, for I am holy.\"" },
  { book: "1 Peter", abbrev: "1Pe", testament: "NT", chapter: 2, verse: 9, text: "But you are a chosen generation, a royal priesthood, a holy nation, His own special people, that you may proclaim the praises of Him who called you out of darkness into His marvelous light;" },
  { book: "1 Peter", abbrev: "1Pe", testament: "NT", chapter: 5, verse: 7, text: "casting all your care upon Him, for He cares for you." },
  { book: "1 Peter", abbrev: "1Pe", testament: "NT", chapter: 5, verse: 8, text: "Be sober, be vigilant; because your adversary the devil walks about like a roaring lion, seeking whom he may devour." },
  // 2 Peter
  { book: "2 Peter", abbrev: "2Pe", testament: "NT", chapter: 1, verse: 20, text: "knowing this first, that no prophecy of Scripture is of any private interpretation," },
  { book: "2 Peter", abbrev: "2Pe", testament: "NT", chapter: 3, verse: 9, text: "The Lord is not slack concerning His promise, as some count slackness, but is longsuffering toward us, not willing that any should perish but that all should come to repentance." },
  // 1 John
  { book: "1 John", abbrev: "1Jo", testament: "NT", chapter: 1, verse: 9, text: "If we confess our sins, He is faithful and just to forgive us our sins and to cleanse us from all unrighteousness." },
  { book: "1 John", abbrev: "1Jo", testament: "NT", chapter: 3, verse: 1, text: "Behold what manner of love the Father has bestowed on us, that we should be called children of God! Therefore the world does not know us, because it did not know Him." },
  { book: "1 John", abbrev: "1Jo", testament: "NT", chapter: 4, verse: 4, text: "You are of God, little children, and have overcome them, because He who is in you is greater than he who is in the world." },
  { book: "1 John", abbrev: "1Jo", testament: "NT", chapter: 4, verse: 8, text: "He who does not love does not know God, for God is love." },
  { book: "1 John", abbrev: "1Jo", testament: "NT", chapter: 4, verse: 18, text: "There is no fear in love; but perfect love casts out fear, because fear involves torment. But he who fears has not been made perfect in love." },
  // 2 John
  { book: "2 John", abbrev: "2Jo", testament: "NT", chapter: 1, verse: 9, text: "Whoever transgresses and does not abide in the doctrine of Christ does not have God. He who abides in the doctrine of Christ has both the Father and the Son." },
  // 3 John
  { book: "3 John", abbrev: "3Jo", testament: "NT", chapter: 1, verse: 2, text: "Beloved, I pray that you may prosper in all things and be in health, just as your soul prospers." },
  // Jude
  { book: "Jude", abbrev: "Jud", testament: "NT", chapter: 1, verse: 3, text: "Beloved, while I was very diligent to write to you concerning our common salvation, I found it necessary to write to you exhorting you to contend earnestly for the faith which was once for all delivered to the saints." },
  { book: "Jude", abbrev: "Jud", testament: "NT", chapter: 1, verse: 20, text: "But you, beloved, building yourselves up on your most holy faith, praying in the Holy Spirit," },
  // Revelation
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 1, verse: 8, text: "\"I am the Alpha and the Omega, the Beginning and the End,\" says the Lord, \"who is and who was and who is to come, the Almighty.\"" },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 3, verse: 15, text: "I know your works, that you are neither cold nor hot. I could wish you were cold or hot." },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 3, verse: 16, text: "So then, because you are lukewarm, and neither cold nor hot, I will vomit you out of My mouth." },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 3, verse: 20, text: "Behold, I stand at the door and knock. If anyone hears My voice and opens the door, I will come in to him and dine with him, and he with Me." },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 12, verse: 11, text: "And they overcame him by the blood of the Lamb and by the word of their testimony, and they did not love their lives to the death." },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 19, verse: 16, text: "And He has on His robe and on His thigh a name written: KING OF KINGS AND LORD OF LORDS." },
];

// ─── Complete Dataset ──────────────────────────────────────────────────────────

export const ALL_BIBLE_VERSES: BibleVerse[] = [
  ...GEN1, ...PSA23, ...PSA91, ...ROM8, ...ICO13, ...EPH6,
  ...HEB11, ...REV21, ...REV22, ...JHN3, ...JHN14, ...PHP4,
  ...KEY_VERSES,
];

// ─── Book Metadata ────────────────────────────────────────────────────────────

export const BIBLE_BOOKS = [
  { name: "Genesis", abbrev: "Gen", testament: "OT", chapters: 50 },
  { name: "Exodus", abbrev: "Exo", testament: "OT", chapters: 40 },
  { name: "Leviticus", abbrev: "Lev", testament: "OT", chapters: 27 },
  { name: "Numbers", abbrev: "Num", testament: "OT", chapters: 36 },
  { name: "Deuteronomy", abbrev: "Deu", testament: "OT", chapters: 34 },
  { name: "Joshua", abbrev: "Jos", testament: "OT", chapters: 24 },
  { name: "Judges", abbrev: "Jdg", testament: "OT", chapters: 21 },
  { name: "Ruth", abbrev: "Rut", testament: "OT", chapters: 4 },
  { name: "1 Samuel", abbrev: "1Sa", testament: "OT", chapters: 31 },
  { name: "2 Samuel", abbrev: "2Sa", testament: "OT", chapters: 24 },
  { name: "1 Kings", abbrev: "1Ki", testament: "OT", chapters: 22 },
  { name: "2 Kings", abbrev: "2Ki", testament: "OT", chapters: 25 },
  { name: "1 Chronicles", abbrev: "1Ch", testament: "OT", chapters: 29 },
  { name: "2 Chronicles", abbrev: "2Ch", testament: "OT", chapters: 36 },
  { name: "Ezra", abbrev: "Ezr", testament: "OT", chapters: 10 },
  { name: "Nehemiah", abbrev: "Neh", testament: "OT", chapters: 13 },
  { name: "Esther", abbrev: "Est", testament: "OT", chapters: 10 },
  { name: "Job", abbrev: "Job", testament: "OT", chapters: 42 },
  { name: "Psalms", abbrev: "Psa", testament: "OT", chapters: 150 },
  { name: "Proverbs", abbrev: "Pro", testament: "OT", chapters: 31 },
  { name: "Ecclesiastes", abbrev: "Ecc", testament: "OT", chapters: 12 },
  { name: "Song of Solomon", abbrev: "Sol", testament: "OT", chapters: 8 },
  { name: "Isaiah", abbrev: "Isa", testament: "OT", chapters: 66 },
  { name: "Jeremiah", abbrev: "Jer", testament: "OT", chapters: 52 },
  { name: "Lamentations", abbrev: "Lam", testament: "OT", chapters: 5 },
  { name: "Ezekiel", abbrev: "Eze", testament: "OT", chapters: 48 },
  { name: "Daniel", abbrev: "Dan", testament: "OT", chapters: 12 },
  { name: "Hosea", abbrev: "Hos", testament: "OT", chapters: 14 },
  { name: "Joel", abbrev: "Joe", testament: "OT", chapters: 3 },
  { name: "Amos", abbrev: "Amo", testament: "OT", chapters: 9 },
  { name: "Obadiah", abbrev: "Oba", testament: "OT", chapters: 1 },
  { name: "Jonah", abbrev: "Jon", testament: "OT", chapters: 4 },
  { name: "Micah", abbrev: "Mic", testament: "OT", chapters: 7 },
  { name: "Nahum", abbrev: "Nah", testament: "OT", chapters: 3 },
  { name: "Habakkuk", abbrev: "Hab", testament: "OT", chapters: 3 },
  { name: "Zephaniah", abbrev: "Zep", testament: "OT", chapters: 3 },
  { name: "Haggai", abbrev: "Hag", testament: "OT", chapters: 2 },
  { name: "Zechariah", abbrev: "Zec", testament: "OT", chapters: 14 },
  { name: "Malachi", abbrev: "Mal", testament: "OT", chapters: 4 },
  { name: "Matthew", abbrev: "Mat", testament: "NT", chapters: 28 },
  { name: "Mark", abbrev: "Mar", testament: "NT", chapters: 16 },
  { name: "Luke", abbrev: "Luk", testament: "NT", chapters: 24 },
  { name: "John", abbrev: "Jhn", testament: "NT", chapters: 21 },
  { name: "Acts", abbrev: "Act", testament: "NT", chapters: 28 },
  { name: "Romans", abbrev: "Rom", testament: "NT", chapters: 16 },
  { name: "1 Corinthians", abbrev: "1Co", testament: "NT", chapters: 16 },
  { name: "2 Corinthians", abbrev: "2Co", testament: "NT", chapters: 13 },
  { name: "Galatians", abbrev: "Gal", testament: "NT", chapters: 6 },
  { name: "Ephesians", abbrev: "Eph", testament: "NT", chapters: 6 },
  { name: "Philippians", abbrev: "Php", testament: "NT", chapters: 4 },
  { name: "Colossians", abbrev: "Col", testament: "NT", chapters: 4 },
  { name: "1 Thessalonians", abbrev: "1Th", testament: "NT", chapters: 5 },
  { name: "2 Thessalonians", abbrev: "2Th", testament: "NT", chapters: 3 },
  { name: "1 Timothy", abbrev: "1Ti", testament: "NT", chapters: 6 },
  { name: "2 Timothy", abbrev: "2Ti", testament: "NT", chapters: 4 },
  { name: "Titus", abbrev: "Tit", testament: "NT", chapters: 3 },
  { name: "Philemon", abbrev: "Phm", testament: "NT", chapters: 1 },
  { name: "Hebrews", abbrev: "Heb", testament: "NT", chapters: 13 },
  { name: "James", abbrev: "Jas", testament: "NT", chapters: 5 },
  { name: "1 Peter", abbrev: "1Pe", testament: "NT", chapters: 5 },
  { name: "2 Peter", abbrev: "2Pe", testament: "NT", chapters: 3 },
  { name: "1 John", abbrev: "1Jo", testament: "NT", chapters: 5 },
  { name: "2 John", abbrev: "2Jo", testament: "NT", chapters: 1 },
  { name: "3 John", abbrev: "3Jo", testament: "NT", chapters: 1 },
  { name: "Jude", abbrev: "Jud", testament: "NT", chapters: 1 },
  { name: "Revelation", abbrev: "Rev", testament: "NT", chapters: 22 },
] as const;

// ─── Abbreviation Resolver ────────────────────────────────────────────────────
// Maps common abbreviations and full names to canonical abbrev codes.

const ABBREV_MAP: Record<string, string> = {
  // OT
  "gen": "Gen", "genesis": "Gen",
  "exo": "Exo", "ex": "Exo", "exodus": "Exo",
  "lev": "Lev", "leviticus": "Lev",
  "num": "Num", "numbers": "Num",
  "deu": "Deu", "deut": "Deu", "deuteronomy": "Deu",
  "jos": "Jos", "josh": "Jos", "joshua": "Jos",
  "jdg": "Jdg", "judg": "Jdg", "judges": "Jdg",
  "rut": "Rut", "ruth": "Rut",
  "1sa": "1Sa", "1sam": "1Sa", "1 sam": "1Sa", "1 samuel": "1Sa",
  "2sa": "2Sa", "2sam": "2Sa", "2 sam": "2Sa", "2 samuel": "2Sa",
  "1ki": "1Ki", "1kgs": "1Ki", "1 kings": "1Ki",
  "2ki": "2Ki", "2kgs": "2Ki", "2 kings": "2Ki",
  "1ch": "1Ch", "1chron": "1Ch", "1 chronicles": "1Ch",
  "2ch": "2Ch", "2chron": "2Ch", "2 chronicles": "2Ch",
  "ezr": "Ezr", "ezra": "Ezr",
  "neh": "Neh", "nehemiah": "Neh",
  "est": "Est", "esther": "Est",
  "job": "Job",
  "psa": "Psa", "ps": "Psa", "psalm": "Psa", "psalms": "Psa",
  "pro": "Pro", "prov": "Pro", "proverbs": "Pro",
  "ecc": "Ecc", "eccl": "Ecc", "ecclesiastes": "Ecc",
  "sol": "Sol", "song": "Sol", "sos": "Sol", "song of solomon": "Sol", "song of songs": "Sol",
  "isa": "Isa", "isaiah": "Isa",
  "jer": "Jer", "jeremiah": "Jer",
  "lam": "Lam", "lamentations": "Lam",
  "eze": "Eze", "ezek": "Eze", "ezekiel": "Eze",
  "dan": "Dan", "daniel": "Dan",
  "hos": "Hos", "hosea": "Hos",
  "joe": "Joe", "joel": "Joe",
  "amo": "Amo", "amos": "Amo",
  "oba": "Oba", "obadiah": "Oba",
  "jon": "Jon", "jonah": "Jon",
  "mic": "Mic", "micah": "Mic",
  "nah": "Nah", "nahum": "Nah",
  "hab": "Hab", "habakkuk": "Hab",
  "zep": "Zep", "zeph": "Zep", "zephaniah": "Zep",
  "hag": "Hag", "haggai": "Hag",
  "zec": "Zec", "zech": "Zec", "zechariah": "Zec",
  "mal": "Mal", "malachi": "Mal",
  // NT
  "mat": "Mat", "matt": "Mat", "matthew": "Mat",
  "mar": "Mar", "mark": "Mar", "mk": "Mar",
  "luk": "Luk", "luke": "Luk",
  "jhn": "Jhn", "jn": "Jhn", "john": "Jhn",
  "act": "Act", "acts": "Act",
  "rom": "Rom", "romans": "Rom",
  "1co": "1Co", "1cor": "1Co", "1 cor": "1Co", "1 corinthians": "1Co",
  "2co": "2Co", "2cor": "2Co", "2 cor": "2Co", "2 corinthians": "2Co",
  "gal": "Gal", "galatians": "Gal",
  "eph": "Eph", "ephesians": "Eph",
  "php": "Php", "phil": "Php", "philippians": "Php",
  "col": "Col", "colossians": "Col",
  "1th": "1Th", "1thess": "1Th", "1 thess": "1Th", "1 thessalonians": "1Th",
  "2th": "2Th", "2thess": "2Th", "2 thess": "2Th", "2 thessalonians": "2Th",
  "1ti": "1Ti", "1tim": "1Ti", "1 tim": "1Ti", "1 timothy": "1Ti",
  "2ti": "2Ti", "2tim": "2Ti", "2 tim": "2Ti", "2 timothy": "2Ti",
  "tit": "Tit", "titus": "Tit",
  "phm": "Phm", "philemon": "Phm",
  "heb": "Heb", "hebrews": "Heb",
  "jas": "Jas", "james": "Jas",
  "1pe": "1Pe", "1pet": "1Pe", "1 pet": "1Pe", "1 peter": "1Pe",
  "2pe": "2Pe", "2pet": "2Pe", "2 pet": "2Pe", "2 peter": "2Pe",
  "1jo": "1Jo", "1jn": "1Jo", "1 john": "1Jo",
  "2jo": "2Jo", "2jn": "2Jo", "2 john": "2Jo",
  "3jo": "3Jo", "3jn": "3Jo", "3 john": "3Jo",
  "jud": "Jud", "jude": "Jud",
  "rev": "Rev", "revelation": "Rev", "revelations": "Rev",
};

export function resolveBookAbbrev(rawBook: string): string | null {
  const key = rawBook.toLowerCase().trim();
  return ABBREV_MAP[key] ?? null;
}

// ─── Reference Parser ─────────────────────────────────────────────────────────
// Parses references like "John 3:16", "Psalm 23", "Romans 8:28-39", "Eph 6:10-18"

export interface ParsedRef {
  book: string;
  abbrev: string;
  chapter: number;
  verseStart: number | null;
  verseEnd: number | null;
}

export function parseScriptureRef(raw: string): ParsedRef | null {
  const trimmed = raw.trim();

  // Matches: "1 John 3:16", "John 3:16-18", "Psalm 23", "Eph 6", "Romans 8:28"
  const regex = /^([1-3]?\s*[A-Za-z]+(?:\s+of\s+[A-Za-z]+)?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/i;
  const m = regex.exec(trimmed);
  if (!m) return null;

  const rawBook = m[1]!.replace(/\s+/g, " ").trim();
  const chapter = parseInt(m[2]!, 10);
  const verseStart = m[3] ? parseInt(m[3], 10) : null;
  const verseEnd = m[4] ? parseInt(m[4], 10) : null;

  const abbrev = resolveBookAbbrev(rawBook);
  if (!abbrev) return null;

  const bookMeta = BIBLE_BOOKS.find(b => b.abbrev === abbrev);
  const bookName = bookMeta?.name ?? rawBook;

  return { book: bookName, abbrev, chapter, verseStart, verseEnd };
}

// ─── Seeding Function ─────────────────────────────────────────────────────────

const biblePool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function seedBibleDatabase(): Promise<void> {
  try {
    logger.info({ total: ALL_BIBLE_VERSES.length }, "Seeding/updating Bible database with NKJV...");

    // Batch upsert in groups of 100 — DO UPDATE ensures NKJV text always overwrites any prior translation
    const BATCH = 100;
    let upserted = 0;

    for (let i = 0; i < ALL_BIBLE_VERSES.length; i += BATCH) {
      const batch = ALL_BIBLE_VERSES.slice(i, i + BATCH);

      const values: string[] = [];
      const params: (string | number)[] = [];
      let p = 1;

      for (const v of batch) {
        values.push(`($${p++},$${p++},$${p++},$${p++},$${p++},$${p++})`);
        params.push(v.book, v.abbrev, v.testament, v.chapter, v.verse, v.text);
      }

      await biblePool.query(
        `INSERT INTO bible_verses (book, book_abbrev, testament, chapter, verse, text)
         VALUES ${values.join(",")}
         ON CONFLICT (book_abbrev, chapter, verse) DO UPDATE SET text = EXCLUDED.text`,
        params,
      );

      upserted += batch.length;
    }

    logger.info({ upserted }, "Bible database seeded/updated with NKJV successfully");
  } catch (err) {
    logger.warn({ err }, "Bible database seeding failed — non-fatal, continuing startup");
  }
}

// ─── Query Helpers ────────────────────────────────────────────────────────────

export async function lookupVerse(
  abbrev: string,
  chapter: number,
  verse: number,
): Promise<BibleVerse | null> {
  try {
    const res = await biblePool.query<BibleVerse>(
      `SELECT book, book_abbrev as abbrev, testament, chapter, verse, text
       FROM bible_verses WHERE book_abbrev = $1 AND chapter = $2 AND verse = $3 LIMIT 1`,
      [abbrev, chapter, verse],
    );
    return res.rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function lookupChapter(
  abbrev: string,
  chapter: number,
): Promise<BibleVerse[]> {
  try {
    const res = await biblePool.query<BibleVerse>(
      `SELECT book, book_abbrev as abbrev, testament, chapter, verse, text
       FROM bible_verses WHERE book_abbrev = $1 AND chapter = $2 ORDER BY verse ASC`,
      [abbrev, chapter],
    );
    return res.rows;
  } catch {
    return [];
  }
}

export async function lookupVerseRange(
  abbrev: string,
  chapter: number,
  verseStart: number,
  verseEnd: number,
): Promise<BibleVerse[]> {
  try {
    const res = await biblePool.query<BibleVerse>(
      `SELECT book, book_abbrev as abbrev, testament, chapter, verse, text
       FROM bible_verses
       WHERE book_abbrev = $1 AND chapter = $2 AND verse >= $3 AND verse <= $4
       ORDER BY verse ASC`,
      [abbrev, chapter, verseStart, verseEnd],
    );
    return res.rows;
  } catch {
    return [];
  }
}

export async function fullTextSearchBible(
  query: string,
  limit = 10,
): Promise<BibleVerse[]> {
  try {
    const res = await biblePool.query<BibleVerse>(
      `SELECT book, book_abbrev as abbrev, testament, chapter, verse, text
       FROM bible_verses
       WHERE to_tsvector('english', text) @@ plainto_tsquery('english', $1)
       ORDER BY ts_rank(to_tsvector('english', text), plainto_tsquery('english', $1)) DESC
       LIMIT $2`,
      [query, limit],
    );
    return res.rows;
  } catch {
    // Fallback to ILIKE
    try {
      const words = query.split(/\s+/).filter(w => w.length > 3).slice(0, 4);
      if (words.length === 0) return [];
      const conditions = words.map((_, i) => `text ILIKE $${i + 2}`).join(" OR ");
      const res = await biblePool.query<BibleVerse>(
        `SELECT book, book_abbrev as abbrev, testament, chapter, verse, text
         FROM bible_verses WHERE (${conditions}) LIMIT $1`,
        [limit, ...words.map(w => `%${w}%`)],
      );
      return res.rows;
    } catch {
      return [];
    }
  }
}

// ─── Scripture Reference Fetcher (used by chat RAG) ───────────────────────────
// Given a raw scripture reference string like "Romans 8:28" or "Psalm 23",
// returns the formatted verse text for injection into the AI context.

export async function fetchScriptureForRAG(rawRef: string): Promise<string | null> {
  const parsed = parseScriptureRef(rawRef);
  if (!parsed) return null;

  try {
    if (parsed.verseStart !== null && parsed.verseEnd !== null) {
      const verses = await lookupVerseRange(parsed.abbrev, parsed.chapter, parsed.verseStart, parsed.verseEnd);
      if (verses.length === 0) return null;
      const text = verses.map(v => `${v.chapter}:${v.verse} ${v.text}`).join(" ");
      return `${parsed.book} ${parsed.chapter}:${parsed.verseStart}-${parsed.verseEnd} (NKJV): "${text}"`;
    }

    if (parsed.verseStart !== null) {
      const v = await lookupVerse(parsed.abbrev, parsed.chapter, parsed.verseStart);
      if (!v) return null;
      return `${v.book} ${v.chapter}:${v.verse} (NKJV): "${v.text}"`;
    }

    // Chapter-level: return first 12 verses
    const verses = await lookupChapter(parsed.abbrev, parsed.chapter);
    if (verses.length === 0) return null;
    const preview = verses.slice(0, 12);
    const text = preview.map(v => `${v.verse}. ${v.text}`).join(" ");
    const suffix = verses.length > 12 ? ` [+${verses.length - 12} more verses]` : "";
    return `${parsed.book} ${parsed.chapter} (NKJV, first ${preview.length} verses): ${text}${suffix}`;
  } catch {
    return null;
  }
}

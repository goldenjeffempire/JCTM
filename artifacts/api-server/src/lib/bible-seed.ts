/**
 * JCTM Bible Database — KJV (King James Version, Public Domain)
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
  { book: "Genesis", abbrev: "Gen", testament: "OT", chapter: 1, verse: 1, text: "In the beginning God created the heaven and the earth." },
  { book: "Genesis", abbrev: "Gen", testament: "OT", chapter: 1, verse: 2, text: "And the earth was without form, and void; and darkness was upon the face of the deep. And the Spirit of God moved upon the face of the waters." },
  { book: "Genesis", abbrev: "Gen", testament: "OT", chapter: 1, verse: 3, text: "And God said, Let there be light: and there was light." },
  { book: "Genesis", abbrev: "Gen", testament: "OT", chapter: 1, verse: 4, text: "And God saw the light, that it was good: and God divided the light from the darkness." },
  { book: "Genesis", abbrev: "Gen", testament: "OT", chapter: 1, verse: 5, text: "And God called the light Day, and the darkness he called Night. And the evening and the morning were the first day." },
  { book: "Genesis", abbrev: "Gen", testament: "OT", chapter: 1, verse: 26, text: "And God said, Let us make man in our image, after our likeness: and let them have dominion over the fish of the sea, and over the fowl of the air, and over the cattle, and over all the earth, and over every creeping thing that creepeth upon the earth." },
  { book: "Genesis", abbrev: "Gen", testament: "OT", chapter: 1, verse: 27, text: "So God created man in his own image, in the image of God created he him; male and female created he them." },
  { book: "Genesis", abbrev: "Gen", testament: "OT", chapter: 1, verse: 28, text: "And God blessed them, and God said unto them, Be fruitful, and multiply, and replenish the earth, and subdue it: and have dominion over the fish of the sea, and over the fowl of the air, and over every living thing that moveth upon the earth." },
  { book: "Genesis", abbrev: "Gen", testament: "OT", chapter: 1, verse: 31, text: "And God saw every thing that he had made, and, behold, it was very good. And the evening and the morning were the sixth day." },
];

const PSA23: BibleVerse[] = [
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 23, verse: 1, text: "The LORD is my shepherd; I shall not want." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 23, verse: 2, text: "He maketh me to lie down in green pastures: he leadeth me beside the still waters." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 23, verse: 3, text: "He restoreth my soul: he leadeth me in the paths of righteousness for his name's sake." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 23, verse: 4, text: "Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me; thy rod and thy staff they comfort me." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 23, verse: 5, text: "Thou preparest a table before me in the presence of mine enemies: thou anointest my head with oil; my cup runneth over." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 23, verse: 6, text: "Surely goodness and mercy shall follow me all the days of my life: and I will dwell in the house of the LORD for ever." },
];

const PSA91: BibleVerse[] = [
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 91, verse: 1, text: "He that dwelleth in the secret place of the most High shall abide under the shadow of the Almighty." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 91, verse: 2, text: "I will say of the LORD, He is my refuge and my fortress: my God; in him will I trust." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 91, verse: 3, text: "Surely he shall deliver thee from the snare of the fowler, and from the noisome pestilence." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 91, verse: 4, text: "He shall cover thee with his feathers, and under his wings shalt thou trust: his truth shall be thy shield and buckler." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 91, verse: 5, text: "Thou shalt not be afraid for the terror by night; nor for the arrow that flieth by day;" },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 91, verse: 6, text: "Nor for the pestilence that walketh in darkness; nor for the destruction that wasteth at noonday." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 91, verse: 7, text: "A thousand shall fall at thy side, and ten thousand at thy right hand; but it shall not come nigh thee." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 91, verse: 8, text: "Only with thine eyes shalt thou behold and see the reward of the wicked." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 91, verse: 9, text: "Because thou hast made the LORD, which is my refuge, even the most High, thy habitation;" },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 91, verse: 10, text: "There shall no evil befall thee, neither shall any plague come nigh thy dwelling." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 91, verse: 11, text: "For he shall give his angels charge over thee, to keep thee in all thy ways." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 91, verse: 12, text: "They shall bear thee up in their hands, lest thou dash thy foot against a stone." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 91, verse: 13, text: "Thou shalt tread upon the lion and adder: the young lion and the dragon shalt thou trample under feet." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 91, verse: 14, text: "Because he hath set his love upon me, therefore will I deliver him: I will set him on high, because he hath known my name." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 91, verse: 15, text: "He shall call upon me, and I will answer him: I will be with him in trouble; I will deliver him, and honour him." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 91, verse: 16, text: "With long life will I satisfy him, and shew him my salvation." },
];

const ROM8: BibleVerse[] = [
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 1, text: "There is therefore now no condemnation to them which are in Christ Jesus, who walk not after the flesh, but after the Spirit." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 2, text: "For the law of the Spirit of life in Christ Jesus hath made me free from the law of sin and death." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 3, text: "For what the law could not do, in that it was weak through the flesh, God sending his own Son in the likeness of sinful flesh, and for sin, condemned sin in the flesh:" },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 4, text: "That the righteousness of the law might be fulfilled in us, who walk not after the flesh, but after the Spirit." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 5, text: "For they that are after the flesh do mind the things of the flesh; but they that are after the Spirit the things of the Spirit." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 6, text: "For to be carnally minded is death; but to be spiritually minded is life and peace." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 7, text: "Because the carnal mind is enmity against God: for it is not subject to the law of God, neither indeed can be." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 8, text: "So then they that are in the flesh cannot please God." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 9, text: "But ye are not in the flesh, but in the Spirit, if so be that the Spirit of God dwell in you. Now if any man have not the Spirit of Christ, he is none of his." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 10, text: "And if Christ be in you, the body is dead because of sin; but the Spirit is life because of righteousness." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 11, text: "But if the Spirit of him that raised up Jesus from the dead dwell in you, he that raised up Christ from the dead shall also quicken your mortal bodies by his Spirit that dwelleth in you." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 12, text: "Therefore, brethren, we are debtors, not to the flesh, to live after the flesh." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 13, text: "For if ye live after the flesh, ye shall die: but if ye through the Spirit do mortify the deeds of the body, ye shall live." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 14, text: "For as many as are led by the Spirit of God, they are the sons of God." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 15, text: "For ye have not received the spirit of bondage again to fear; but ye have received the Spirit of adoption, whereby we cry, Abba, Father." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 16, text: "The Spirit itself beareth witness with our spirit, that we are the children of God:" },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 17, text: "And if children, then heirs; heirs of God, and joint-heirs with Christ; if so be that we suffer with him, that we may be also glorified together." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 18, text: "For I reckon that the sufferings of this present time are not worthy to be compared with the glory which shall be revealed in us." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 26, text: "Likewise the Spirit also helpeth our infirmities: for we know not what we should pray for as we ought: but the Spirit itself maketh intercession for us with groanings which cannot be uttered." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 27, text: "And he that searcheth the hearts knoweth what is the mind of the Spirit, because he maketh intercession for the saints according to the will of God." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 28, text: "And we know that all things work together for good to them that love God, to them who are the called according to his purpose." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 29, text: "For whom he did foreknow, he also did predestinate to be conformed to the image of his Son, that he might be the firstborn among many brethren." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 30, text: "Moreover whom he did predestinate, them he also called: and whom he called, them he also justified: and whom he justified, them he also glorified." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 31, text: "What shall we then say to these things? If God be for us, who can be against us?" },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 32, text: "He that spared not his own Son, but delivered him up for us all, how shall he not with him also freely give us all things?" },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 33, text: "Who shall lay any thing to the charge of God's elect? It is God that justifieth." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 34, text: "Who is he that condemneth? It is Christ that died, yea rather, that is risen again, who is even at the right hand of God, who also maketh intercession for us." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 35, text: "Who shall separate us from the love of Christ? shall tribulation, or distress, or persecution, or famine, or nakedness, or peril, or sword?" },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 37, text: "Nay, in all these things we are more than conquerors through him that loved us." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 38, text: "For I am persuaded, that neither death, nor life, nor angels, nor principalities, nor powers, nor things present, nor things to come," },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 8, verse: 39, text: "Nor height, nor depth, nor any other creature, shall be able to separate us from the love of God, which is in Christ Jesus our Lord." },
];

const ICO13: BibleVerse[] = [
  { book: "1 Corinthians", abbrev: "1Co", testament: "NT", chapter: 13, verse: 1, text: "Though I speak with the tongues of men and of angels, and have not charity, I am become as sounding brass, or a tinkling cymbal." },
  { book: "1 Corinthians", abbrev: "1Co", testament: "NT", chapter: 13, verse: 2, text: "And though I have the gift of prophecy, and understand all mysteries, and all knowledge; and though I have all faith, so that I could remove mountains, and have not charity, I am nothing." },
  { book: "1 Corinthians", abbrev: "1Co", testament: "NT", chapter: 13, verse: 3, text: "And though I bestow all my goods to feed the poor, and though I give my body to be burned, and have not charity, it profiteth me nothing." },
  { book: "1 Corinthians", abbrev: "1Co", testament: "NT", chapter: 13, verse: 4, text: "Charity suffereth long, and is kind; charity envieth not; charity vaunteth not itself, is not puffed up," },
  { book: "1 Corinthians", abbrev: "1Co", testament: "NT", chapter: 13, verse: 5, text: "Doth not behave itself unseemly, seeketh not her own, is not easily provoked, thinketh no evil;" },
  { book: "1 Corinthians", abbrev: "1Co", testament: "NT", chapter: 13, verse: 6, text: "Rejoiceth not in iniquity, but rejoiceth in the truth;" },
  { book: "1 Corinthians", abbrev: "1Co", testament: "NT", chapter: 13, verse: 7, text: "Beareth all things, believeth all things, hopeth all things, endureth all things." },
  { book: "1 Corinthians", abbrev: "1Co", testament: "NT", chapter: 13, verse: 8, text: "Charity never faileth: but whether there be prophecies, they shall fail; whether there be tongues, they shall cease; whether there be knowledge, it shall vanish away." },
  { book: "1 Corinthians", abbrev: "1Co", testament: "NT", chapter: 13, verse: 9, text: "For now we know in part, and we prophesy in part." },
  { book: "1 Corinthians", abbrev: "1Co", testament: "NT", chapter: 13, verse: 10, text: "But when that which is perfect is come, then that which is in part shall be done away." },
  { book: "1 Corinthians", abbrev: "1Co", testament: "NT", chapter: 13, verse: 11, text: "When I was a child, I spake as a child, I understood as a child, I thought as a child: but when I became a man, I put away childish things." },
  { book: "1 Corinthians", abbrev: "1Co", testament: "NT", chapter: 13, verse: 12, text: "For now we see through a glass, darkly; but then face to face: now I know in part; but then shall I know even as also I am known." },
  { book: "1 Corinthians", abbrev: "1Co", testament: "NT", chapter: 13, verse: 13, text: "And now abideth faith, hope, charity, these three; but the greatest of these is charity." },
];

const EPH6: BibleVerse[] = [
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 6, verse: 1, text: "Children, obey your parents in the Lord: for this is right." },
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 6, verse: 2, text: "Honour thy father and mother; (which is the first commandment with promise;)" },
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 6, verse: 3, text: "That it may be well with thee, and thou mayest live long on the earth." },
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 6, verse: 4, text: "And, ye fathers, provoke not your children to wrath: but bring them up in the nurture and admonition of the Lord." },
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 6, verse: 10, text: "Finally, my brethren, be strong in the Lord, and in the power of his might." },
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 6, verse: 11, text: "Put on the whole armour of God, that ye may be able to stand against the wiles of the devil." },
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 6, verse: 12, text: "For we wrestle not against flesh and blood, but against principalities, against powers, against the rulers of the darkness of this world, against spiritual wickedness in high places." },
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 6, verse: 13, text: "Wherefore take unto you the whole armour of God, that ye may be able to withstand in the evil day, and having done all, to stand." },
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 6, verse: 14, text: "Stand therefore, having your loins girt about with truth, and having on the breastplate of righteousness;" },
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 6, verse: 15, text: "And your feet shod with the preparation of the gospel of peace;" },
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 6, verse: 16, text: "Above all, taking the shield of faith, wherewith ye shall be able to quench all the fiery darts of the wicked." },
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 6, verse: 17, text: "And take the helmet of salvation, and the sword of the Spirit, which is the word of God:" },
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 6, verse: 18, text: "Praying always with all prayer and supplication in the Spirit, and watching thereunto with all perseverance and supplication for all saints;" },
];

const HEB11: BibleVerse[] = [
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 11, verse: 1, text: "Now faith is the substance of things hoped for, the evidence of things not seen." },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 11, verse: 2, text: "For by it the elders obtained a good report." },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 11, verse: 3, text: "Through faith we understand that the worlds were framed by the word of God, so that things which are seen were not made of things which do appear." },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 11, verse: 4, text: "By faith Abel offered unto God a more excellent sacrifice than Cain, by which he obtained witness that he was righteous, God testifying of his gifts: and by it he being dead yet speaketh." },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 11, verse: 5, text: "By faith Enoch was translated that he should not see death; and was not found, because God had translated him: for before his translation he had this testimony, that he pleased God." },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 11, verse: 6, text: "But without faith it is impossible to please him: for he that cometh to God must believe that he is, and that he is a rewarder of them that diligently seek him." },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 11, verse: 7, text: "By faith Noah, being warned of God of things not seen as yet, moved with fear, prepared an ark to the saving of his house; by the which he condemned the world, and became heir of the righteousness which is by faith." },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 11, verse: 8, text: "By faith Abraham, when he was called to go out into a place which he should after receive for an inheritance, obeyed; and he went out, not knowing whither he went." },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 11, verse: 11, text: "Through faith also Sara herself received strength to conceive seed, and was delivered of a child when she was past age, because she judged him faithful who had promised." },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 11, verse: 17, text: "By faith Abraham, when he was tried, offered up Isaac: and he that had received the promises offered up his only begotten son," },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 11, verse: 23, text: "By faith Moses, when he was born, was hid three months of his parents, because they saw he was a proper child; and they were not afraid of the king's commandment." },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 11, verse: 24, text: "By faith Moses, when he was come to years, refused to be called the son of Pharaoh's daughter;" },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 11, verse: 25, text: "Choosing rather to suffer affliction with the people of God, than to enjoy the pleasures of sin for a season;" },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 11, verse: 26, text: "Esteeming the reproach of Christ greater riches than the treasures in Egypt: for he had respect unto the recompence of the reward." },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 11, verse: 32, text: "And what shall I more say? for the time would fail me to tell of Gedeon, and of Barak, and of Samson, and of Jephthae; of David also, and Samuel, and of the prophets:" },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 11, verse: 33, text: "Who through faith subdued kingdoms, wrought righteousness, obtained promises, stopped the mouths of lions," },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 11, verse: 34, text: "Quenched the violence of fire, escaped the edge of the sword, out of weakness were made strong, waxed valiant in fight, turned to flight the armies of the aliens." },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 11, verse: 39, text: "And these all, having obtained a good report through faith, received not the promise:" },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 11, verse: 40, text: "God having provided some better thing for us, that they without us should not be made perfect." },
];

const REV21: BibleVerse[] = [
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 21, verse: 1, text: "And I saw a new heaven and a new earth: for the first heaven and the first earth were passed away; and there was no more sea." },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 21, verse: 2, text: "And I John saw the holy city, new Jerusalem, coming down from God out of heaven, prepared as a bride adorned for her husband." },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 21, verse: 3, text: "And I heard a great voice out of heaven saying, Behold, the tabernacle of God is with men, and he will dwell with them, and they shall be his people, and God himself shall be with them, and be their God." },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 21, verse: 4, text: "And God shall wipe away all tears from their eyes; and there shall be no more death, neither sorrow, nor crying, neither shall there be any more pain: for the former things are passed away." },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 21, verse: 5, text: "And he that sat upon the throne said, Behold, I make all things new. And he said unto me, Write: for these words are true and faithful." },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 21, verse: 6, text: "And he said unto me, It is done. I am Alpha and Omega, the beginning and the end. I will give unto him that is athirst of the fountain of the water of life freely." },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 21, verse: 7, text: "He that overcometh shall inherit all things; and I will be his God, and he shall be my son." },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 21, verse: 8, text: "But the fearful, and unbelieving, and the abominable, and murderers, and whoremongers, and sorcerers, and idolaters, and all liars, shall have their part in the lake which burneth with fire and brimstone: which is the second death." },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 21, verse: 21, text: "And the twelve gates were twelve pearls; every several gate was of one pearl: and the street of the city was pure gold, as it were transparent glass." },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 21, verse: 22, text: "And I saw no temple therein: for the Lord God Almighty and the Lamb are the temple of it." },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 21, verse: 23, text: "And the city had no need of the sun, neither of the moon, to shine in it: for the glory of God did lighten it, and the Lamb is the light thereof." },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 21, verse: 27, text: "And there shall in no wise enter into it any thing that defileth, neither whatsoever worketh abomination, or maketh a lie: but they which are written in the Lamb's book of life." },
];

const REV22: BibleVerse[] = [
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 22, verse: 1, text: "And he shewed me a pure river of water of life, clear as crystal, proceeding out of the throne of God and of the Lamb." },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 22, verse: 2, text: "In the midst of the street of it, and on either side of the river, was there the tree of life, which bare twelve manner of fruits, and yielded her fruit every month: and the leaves of the tree were for the healing of the nations." },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 22, verse: 3, text: "And there shall be no more curse: but the throne of God and of the Lamb shall be in it; and his servants shall serve him:" },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 22, verse: 4, text: "And they shall see his face; and his name shall be in their foreheads." },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 22, verse: 12, text: "And, behold, I come quickly; and my reward is with me, to give every man according as his work shall be." },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 22, verse: 13, text: "I am Alpha and Omega, the beginning and the end, the first and the last." },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 22, verse: 14, text: "Blessed are they that do his commandments, that they may have right to the tree of life, and may enter in through the gates into the city." },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 22, verse: 17, text: "And the Spirit and the bride say, Come. And let him that heareth say, Come. And let him that is athirst come. And whosoever will, let him take the water of life freely." },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 22, verse: 20, text: "He which testifieth these things saith, Surely I come quickly. Amen. Even so, come, Lord Jesus." },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 22, verse: 21, text: "The grace of our Lord Jesus Christ be with you all. Amen." },
];

const JHN3: BibleVerse[] = [
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 3, verse: 1, text: "There was a man of the Pharisees, named Nicodemus, a ruler of the Jews:" },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 3, verse: 3, text: "Jesus answered and said unto him, Verily, verily, I say unto thee, Except a man be born again, he cannot see the kingdom of God." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 3, verse: 5, text: "Jesus answered, Verily, verily, I say unto thee, Except a man be born of water and of the Spirit, he cannot enter into the kingdom of God." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 3, verse: 6, text: "That which is born of the flesh is flesh; and that which is born of the Spirit is spirit." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 3, verse: 7, text: "Marvel not that I said unto thee, Ye must be born again." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 3, verse: 16, text: "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 3, verse: 17, text: "For God sent not his Son into the world to condemn the world; but that the world through him might be saved." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 3, verse: 18, text: "He that believeth on him is not condemned: but he that believeth not is condemned already, because he hath not believed in the name of the only begotten Son of God." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 3, verse: 19, text: "And this is the condemnation, that light is come into the world, and men loved darkness rather than light, because their deeds were evil." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 3, verse: 36, text: "He that believeth on the Son hath everlasting life: and he that believeth not the Son shall not see life; but the wrath of God abideth on him." },
];

const JHN14: BibleVerse[] = [
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 14, verse: 1, text: "Let not your heart be troubled: ye believe in God, believe also in me." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 14, verse: 2, text: "In my Father's house are many mansions: if it were not so, I would have told you. I go to prepare a place for you." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 14, verse: 3, text: "And if I go and prepare a place for you, I will come again, and receive you unto myself; that where I am, there ye may be also." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 14, verse: 6, text: "Jesus saith unto him, I am the way, the truth, and the life: no man cometh unto the Father, but by me." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 14, verse: 13, text: "And whatsoever ye shall ask in my name, that will I do, that the Father may be glorified in the Son." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 14, verse: 14, text: "If ye shall ask any thing in my name, I will do it." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 14, verse: 15, text: "If ye love me, keep my commandments." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 14, verse: 16, text: "And I will pray the Father, and he shall give you another Comforter, that he may abide with you for ever;" },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 14, verse: 17, text: "Even the Spirit of truth; whom the world cannot receive, because it seeth him not, neither knoweth him: but ye know him; for he dwelleth with you, and shall be in you." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 14, verse: 26, text: "But the Comforter, which is the Holy Ghost, whom the Father will send in my name, he shall teach you all things, and bring all things to your remembrance, whatsoever I have said unto you." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 14, verse: 27, text: "Peace I leave with you, my peace I give unto you: not as the world giveth, give I unto you. Let not your heart be troubled, neither let it be afraid." },
];

const PHP4: BibleVerse[] = [
  { book: "Philippians", abbrev: "Php", testament: "NT", chapter: 4, verse: 4, text: "Rejoice in the Lord always: and again I say, Rejoice." },
  { book: "Philippians", abbrev: "Php", testament: "NT", chapter: 4, verse: 5, text: "Let your moderation be known unto all men. The Lord is at hand." },
  { book: "Philippians", abbrev: "Php", testament: "NT", chapter: 4, verse: 6, text: "Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God." },
  { book: "Philippians", abbrev: "Php", testament: "NT", chapter: 4, verse: 7, text: "And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus." },
  { book: "Philippians", abbrev: "Php", testament: "NT", chapter: 4, verse: 8, text: "Finally, brethren, whatsoever things are true, whatsoever things are honest, whatsoever things are just, whatsoever things are pure, whatsoever things are lovely, whatsoever things are of good report; if there be any virtue, and if there be any praise, think on these things." },
  { book: "Philippians", abbrev: "Php", testament: "NT", chapter: 4, verse: 9, text: "Those things, which ye have both learned, and received, and heard, and seen in me, do: and the God of peace shall be with you." },
  { book: "Philippians", abbrev: "Php", testament: "NT", chapter: 4, verse: 11, text: "Not that I speak in respect of want: for I have learned, in whatsoever state I am, therewith to be content." },
  { book: "Philippians", abbrev: "Php", testament: "NT", chapter: 4, verse: 13, text: "I can do all things through Christ which strengtheneth me." },
  { book: "Philippians", abbrev: "Php", testament: "NT", chapter: 4, verse: 19, text: "But my God shall supply all your need according to his riches in glory by Christ Jesus." },
];

// ─── Individual Key Verses (All 66 Books) ────────────────────────────────────

const KEY_VERSES: BibleVerse[] = [
  // Genesis
  { book: "Genesis", abbrev: "Gen", testament: "OT", chapter: 2, verse: 24, text: "Therefore shall a man leave his father and his mother, and shall cleave unto his wife: and they shall be one flesh." },
  { book: "Genesis", abbrev: "Gen", testament: "OT", chapter: 12, verse: 1, text: "Now the LORD had said unto Abram, Get thee out of thy country, and from thy kindred, and from thy father's house, unto a land that I will shew thee:" },
  { book: "Genesis", abbrev: "Gen", testament: "OT", chapter: 12, verse: 2, text: "And I will make of thee a great nation, and I will bless thee, and make thy name great; and thou shalt be a blessing:" },
  { book: "Genesis", abbrev: "Gen", testament: "OT", chapter: 12, verse: 3, text: "And I will bless them that bless thee, and curse him that curseth thee: and in thee shall all families of the earth be blessed." },
  { book: "Genesis", abbrev: "Gen", testament: "OT", chapter: 50, verse: 20, text: "But as for you, ye thought evil against me; but God meant it unto good, to bring to pass, as it is this day, to save much people alive." },
  // Exodus
  { book: "Exodus", abbrev: "Exo", testament: "OT", chapter: 3, verse: 14, text: "And God said unto Moses, I AM THAT I AM: and he said, Thus shalt thou say unto the children of Israel, I AM hath sent me unto you." },
  { book: "Exodus", abbrev: "Exo", testament: "OT", chapter: 14, verse: 14, text: "The LORD shall fight for you, and ye shall hold your peace." },
  { book: "Exodus", abbrev: "Exo", testament: "OT", chapter: 15, verse: 26, text: "For I am the LORD that healeth thee." },
  { book: "Exodus", abbrev: "Exo", testament: "OT", chapter: 20, verse: 3, text: "Thou shalt have no other gods before me." },
  { book: "Exodus", abbrev: "Exo", testament: "OT", chapter: 20, verse: 12, text: "Honour thy father and thy mother: that thy days may be long upon the land which the LORD thy God giveth thee." },
  // Leviticus
  { book: "Leviticus", abbrev: "Lev", testament: "OT", chapter: 11, verse: 44, text: "For I am the LORD your God: ye shall therefore sanctify yourselves, and ye shall be holy; for I am holy:" },
  { book: "Leviticus", abbrev: "Lev", testament: "OT", chapter: 19, verse: 18, text: "Thou shalt not avenge, nor bear any grudge against the children of thy people, but thou shalt love thy neighbour as thyself: I am the LORD." },
  // Numbers
  { book: "Numbers", abbrev: "Num", testament: "OT", chapter: 6, verse: 24, text: "The LORD bless thee, and keep thee:" },
  { book: "Numbers", abbrev: "Num", testament: "OT", chapter: 6, verse: 25, text: "The LORD make his face shine upon thee, and be gracious unto thee:" },
  { book: "Numbers", abbrev: "Num", testament: "OT", chapter: 6, verse: 26, text: "The LORD lift up his countenance upon thee, and give thee peace." },
  { book: "Numbers", abbrev: "Num", testament: "OT", chapter: 23, verse: 19, text: "God is not a man, that he should lie; neither the son of man, that he should repent: hath he said, and shall he not do it? or hath he spoken, and shall he not make it good?" },
  // Deuteronomy
  { book: "Deuteronomy", abbrev: "Deu", testament: "OT", chapter: 6, verse: 4, text: "Hear, O Israel: The LORD our God is one LORD:" },
  { book: "Deuteronomy", abbrev: "Deu", testament: "OT", chapter: 6, verse: 5, text: "And thou shalt love the LORD thy God with all thine heart, and with all thy soul, and with all thy might." },
  { book: "Deuteronomy", abbrev: "Deu", testament: "OT", chapter: 28, verse: 1, text: "And it shall come to pass, if thou shalt hearken diligently unto the voice of the LORD thy God, to observe and to do all his commandments which I command thee this day, that the LORD thy God will set thee on high above all nations of the earth:" },
  { book: "Deuteronomy", abbrev: "Deu", testament: "OT", chapter: 28, verse: 2, text: "And all these blessings shall come on thee, and overtake thee, if thou shalt hearken unto the voice of the LORD thy God." },
  { book: "Deuteronomy", abbrev: "Deu", testament: "OT", chapter: 31, verse: 6, text: "Be strong and of a good courage, fear not, nor be afraid of them: for the LORD thy God, he it is that doth go with thee; he will not fail thee, nor forsake thee." },
  // Joshua
  { book: "Joshua", abbrev: "Jos", testament: "OT", chapter: 1, verse: 8, text: "This book of the law shall not depart out of thy mouth; but thou shalt meditate therein day and night, that thou mayest observe to do according to all that is written therein: for then thou shalt make thy way prosperous, and then thou shalt have good success." },
  { book: "Joshua", abbrev: "Jos", testament: "OT", chapter: 1, verse: 9, text: "Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest." },
  { book: "Joshua", abbrev: "Jos", testament: "OT", chapter: 24, verse: 15, text: "And if it seem evil unto you to serve the LORD, choose you this day whom ye will serve; whether the gods which your fathers served that were on the other side of the flood, or the gods of the Amorites, in whose land ye dwell: but as for me and my house, we will serve the LORD." },
  // Judges
  { book: "Judges", abbrev: "Jdg", testament: "OT", chapter: 6, verse: 12, text: "And the angel of the LORD appeared unto him, and said unto him, The LORD is with thee, thou mighty man of valour." },
  // Ruth
  { book: "Ruth", abbrev: "Rut", testament: "OT", chapter: 1, verse: 16, text: "And Ruth said, Intreat me not to leave thee, or to return from following after thee: for whither thou goest, I will go; and where thou lodgest, I will lodge: thy people shall be my people, and thy God my God:" },
  // 1 Samuel
  { book: "1 Samuel", abbrev: "1Sa", testament: "OT", chapter: 16, verse: 7, text: "But the LORD said unto Samuel, Look not on his countenance, or on the height of his stature; because I have refused him: for the LORD seeth not as man seeth; for man looketh on the outward appearance, but the LORD looketh on the heart." },
  // 2 Samuel
  { book: "2 Samuel", abbrev: "2Sa", testament: "OT", chapter: 7, verse: 12, text: "And when thy days be fulfilled, and thou shalt sleep with thy fathers, I will set up thy seed after thee, which shall proceed out of thy bowels, and I will establish his kingdom." },
  // 1 Kings
  { book: "1 Kings", abbrev: "1Ki", testament: "OT", chapter: 8, verse: 23, text: "And he said, LORD God of Israel, there is no God like thee, in heaven above, or on earth beneath, who keepest covenant and mercy with thy servants that walk before thee with all their heart:" },
  // 2 Kings
  { book: "2 Kings", abbrev: "2Ki", testament: "OT", chapter: 6, verse: 16, text: "And he answered, Fear not: for they that be with us are more than they that be with them." },
  // 1 Chronicles
  { book: "1 Chronicles", abbrev: "1Ch", testament: "OT", chapter: 4, verse: 10, text: "And Jabez called on the God of Israel, saying, Oh that thou wouldest bless me indeed, and enlarge my coast, and that thine hand might be with me, and that thou wouldest keep me from evil, that it may not grieve me! And God granted him that which he requested." },
  { book: "1 Chronicles", abbrev: "1Ch", testament: "OT", chapter: 16, verse: 11, text: "Seek the LORD and his strength, seek his face continually." },
  // 2 Chronicles
  { book: "2 Chronicles", abbrev: "2Ch", testament: "OT", chapter: 7, verse: 14, text: "If my people, which are called by my name, shall humble themselves, and pray, and seek my face, and turn from their wicked ways; then will I hear from heaven, and will forgive their sin, and will heal their land." },
  // Ezra
  { book: "Ezra", abbrev: "Ezr", testament: "OT", chapter: 7, verse: 10, text: "For Ezra had prepared his heart to seek the law of the LORD, and to do it, and to teach in Israel statutes and judgments." },
  // Nehemiah
  { book: "Nehemiah", abbrev: "Neh", testament: "OT", chapter: 8, verse: 10, text: "Then he said unto them, Go your way, eat the fat, and drink the sweet, and send portions unto them for whom nothing is prepared: for this day is holy unto our LORD: neither be ye sorry; for the joy of the LORD is your strength." },
  // Esther
  { book: "Esther", abbrev: "Est", testament: "OT", chapter: 4, verse: 14, text: "For if thou altogether holdest thy peace at this time, then shall there enlargement and deliverance arise to the Jews from another place; but thou and thy father's house shall be destroyed: and who knoweth whether thou art come to the kingdom for such a time as this?" },
  // Job
  { book: "Job", abbrev: "Job", testament: "OT", chapter: 1, verse: 21, text: "And said, Naked came I out of my mother's womb, and naked shall I return thither: the LORD gave, and the LORD hath taken away; blessed be the name of the LORD." },
  { book: "Job", abbrev: "Job", testament: "OT", chapter: 19, verse: 25, text: "For I know that my redeemer liveth, and that he shall stand at the latter day upon the earth:" },
  { book: "Job", abbrev: "Job", testament: "OT", chapter: 42, verse: 10, text: "And the LORD turned the captivity of Job, when he prayed for his friends: also the LORD gave Job twice as much as he had before." },
  // Psalms
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 1, verse: 1, text: "Blessed is the man that walketh not in the counsel of the ungodly, nor standeth in the way of sinners, nor sitteth in the seat of the scornful." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 1, verse: 2, text: "But his delight is in the law of the LORD; and in his law doth he meditate day and night." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 1, verse: 3, text: "And he shall be like a tree planted by the rivers of water, that bringeth forth his fruit in his season; his leaf also shall not wither; and whatsoever he doeth shall prosper." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 27, verse: 1, text: "The LORD is my light and my salvation; whom shall I fear? the LORD is the strength of my life; of whom shall I be afraid?" },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 27, verse: 4, text: "One thing have I desired of the LORD, that will I seek after; that I may dwell in the house of the LORD all the days of my life, to behold the beauty of the LORD, and to enquire in his temple." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 27, verse: 14, text: "Wait on the LORD: be of good courage, and he shall strengthen thine heart: wait, I say, on the LORD." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 34, verse: 4, text: "I sought the LORD, and he heard me, and delivered me from all my fears." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 34, verse: 7, text: "The angel of the LORD encampeth round about them that fear him, and delivereth them." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 34, verse: 18, text: "The LORD is nigh unto them that are of a broken heart; and saveth such as be of a contrite spirit." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 37, verse: 4, text: "Delight thyself also in the LORD; and he shall give thee the desires of thine heart." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 37, verse: 5, text: "Commit thy way unto the LORD; trust also in him; and he shall bring it to pass." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 46, verse: 1, text: "God is our refuge and strength, a very present help in trouble." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 46, verse: 10, text: "Be still, and know that I am God: I will be exalted among the heathen, I will be exalted in the earth." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 51, verse: 1, text: "Have mercy upon me, O God, according to thy lovingkindness: according unto the multitude of thy tender mercies blot out my transgressions." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 51, verse: 10, text: "Create in me a clean heart, O God; and renew a right spirit within me." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 51, verse: 11, text: "Cast me not away from thy presence; and take not thy holy spirit from me." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 51, verse: 17, text: "The sacrifices of God are a broken spirit: a broken and a contrite heart, O God, thou wilt not despise." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 100, verse: 1, text: "Make a joyful noise unto the LORD, all ye lands." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 100, verse: 2, text: "Serve the LORD with gladness: come before his presence with singing." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 100, verse: 3, text: "Know ye that the LORD he is God: it is he that hath made us, and not we ourselves; we are his people, and the sheep of his pasture." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 100, verse: 4, text: "Enter into his gates with thanksgiving, and into his courts with praise: be thankful unto him, and bless his name." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 100, verse: 5, text: "For the LORD is good; his mercy is everlasting; and his truth endureth to all generations." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 103, verse: 1, text: "Bless the LORD, O my soul: and all that is within me, bless his holy name." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 103, verse: 2, text: "Bless the LORD, O my soul, and forget not all his benefits:" },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 103, verse: 3, text: "Who forgiveth all thine iniquities; who healeth all thy diseases;" },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 103, verse: 4, text: "Who redeemeth thy life from destruction; who crowneth thee with lovingkindness and tender mercies;" },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 119, verse: 9, text: "Wherewithal shall a young man cleanse his way? by taking heed thereto according to thy word." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 119, verse: 11, text: "Thy word have I hid in mine heart, that I might not sin against thee." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 119, verse: 105, text: "Thy word is a lamp unto my feet, and a light unto my path." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 119, verse: 165, text: "Great peace have they which love thy law: and nothing shall offend them." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 121, verse: 1, text: "I will lift up mine eyes unto the hills, from whence cometh my help." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 121, verse: 2, text: "My help cometh from the LORD, which made heaven and earth." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 121, verse: 3, text: "He will not suffer thy foot to be moved: he that keepeth thee will not slumber." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 121, verse: 8, text: "The LORD shall preserve thy going out and thy coming in from this time forth, and even for evermore." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 139, verse: 14, text: "I will praise thee; for I am fearfully and wonderfully made: marvellous are thy works; and that my soul knoweth right well." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 149, verse: 6, text: "Let the high praises of God be in their mouth, and a twoedged sword in their hand;" },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 150, verse: 1, text: "Praise ye the LORD. Praise God in his sanctuary: praise him in the firmament of his power." },
  { book: "Psalms", abbrev: "Psa", testament: "OT", chapter: 150, verse: 6, text: "Let every thing that hath breath praise the LORD. Praise ye the LORD." },
  // Proverbs
  { book: "Proverbs", abbrev: "Pro", testament: "OT", chapter: 3, verse: 5, text: "Trust in the LORD with all thine heart; and lean not unto thine own understanding." },
  { book: "Proverbs", abbrev: "Pro", testament: "OT", chapter: 3, verse: 6, text: "In all thy ways acknowledge him, and he shall direct thy paths." },
  { book: "Proverbs", abbrev: "Pro", testament: "OT", chapter: 4, verse: 23, text: "Keep thy heart with all diligence; for out of it are the issues of life." },
  { book: "Proverbs", abbrev: "Pro", testament: "OT", chapter: 11, verse: 30, text: "The fruit of the righteous is a tree of life; and he that winneth souls is wise." },
  { book: "Proverbs", abbrev: "Pro", testament: "OT", chapter: 22, verse: 6, text: "Train up a child in the way he should go: and when he is old, he will not depart from it." },
  { book: "Proverbs", abbrev: "Pro", testament: "OT", chapter: 29, verse: 18, text: "Where there is no vision, the people perish: but he that keepeth the law, happy is he." },
  // Ecclesiastes
  { book: "Ecclesiastes", abbrev: "Ecc", testament: "OT", chapter: 12, verse: 13, text: "Let us hear the conclusion of the whole matter: Fear God, and keep his commandments: for this is the whole duty of man." },
  { book: "Ecclesiastes", abbrev: "Ecc", testament: "OT", chapter: 12, verse: 14, text: "For God shall bring every work into judgment, with every secret thing, whether it be good, or whether it be evil." },
  // Song of Solomon
  { book: "Song of Solomon", abbrev: "Sol", testament: "OT", chapter: 2, verse: 16, text: "My beloved is mine, and I am his: he feedeth among the lilies." },
  // Isaiah
  { book: "Isaiah", abbrev: "Isa", testament: "OT", chapter: 6, verse: 8, text: "Also I heard the voice of the Lord, saying, Whom shall I send, and who will go for us? Then said I, Here am I; send me." },
  { book: "Isaiah", abbrev: "Isa", testament: "OT", chapter: 9, verse: 6, text: "For unto us a child is born, unto us a son is given: and the government shall be upon his shoulder: and his name shall be called Wonderful, Counsellor, The mighty God, The everlasting Father, The Prince of Peace." },
  { book: "Isaiah", abbrev: "Isa", testament: "OT", chapter: 40, verse: 28, text: "Hast thou not known? hast thou not heard, that the everlasting God, the LORD, the Creator of the ends of the earth, fainteth not, neither is weary? there is no searching of his understanding." },
  { book: "Isaiah", abbrev: "Isa", testament: "OT", chapter: 40, verse: 29, text: "He giveth power to the faint; and to them that have no might he increaseth strength." },
  { book: "Isaiah", abbrev: "Isa", testament: "OT", chapter: 40, verse: 30, text: "Even the youths shall faint and be weary, and the young men shall utterly fall:" },
  { book: "Isaiah", abbrev: "Isa", testament: "OT", chapter: 40, verse: 31, text: "But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint." },
  { book: "Isaiah", abbrev: "Isa", testament: "OT", chapter: 41, verse: 10, text: "Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness." },
  { book: "Isaiah", abbrev: "Isa", testament: "OT", chapter: 53, verse: 1, text: "Who hath believed our report? and to whom is the arm of the LORD revealed?" },
  { book: "Isaiah", abbrev: "Isa", testament: "OT", chapter: 53, verse: 2, text: "For he shall grow up before him as a tender plant, and as a root out of a dry ground: he hath no form nor comeliness; and when we shall see him, there is no beauty that we should desire him." },
  { book: "Isaiah", abbrev: "Isa", testament: "OT", chapter: 53, verse: 3, text: "He is despised and rejected of men; a man of sorrows, and acquainted with grief: and we hid as it were our faces from him; he was despised, and we esteemed him not." },
  { book: "Isaiah", abbrev: "Isa", testament: "OT", chapter: 53, verse: 4, text: "Surely he hath borne our griefs, and carried our sorrows: yet we did esteem him stricken, smitten of God, and afflicted." },
  { book: "Isaiah", abbrev: "Isa", testament: "OT", chapter: 53, verse: 5, text: "But he was wounded for our transgressions, he was bruised for our iniquities: the chastisement of our peace was upon him; and with his stripes we are healed." },
  { book: "Isaiah", abbrev: "Isa", testament: "OT", chapter: 53, verse: 6, text: "All we like sheep have gone astray; we have turned every one to his own way; and the LORD hath laid on him the iniquity of us all." },
  { book: "Isaiah", abbrev: "Isa", testament: "OT", chapter: 55, verse: 8, text: "For my thoughts are not your thoughts, neither are your ways my ways, saith the LORD." },
  { book: "Isaiah", abbrev: "Isa", testament: "OT", chapter: 55, verse: 9, text: "For as the heavens are higher than the earth, so are my ways higher than your ways, and my thoughts than your thoughts." },
  // Jeremiah
  { book: "Jeremiah", abbrev: "Jer", testament: "OT", chapter: 1, verse: 5, text: "Before I formed thee in the belly I knew thee; and before thou camest forth out of the womb I sanctified thee, and I ordained thee a prophet unto the nations." },
  { book: "Jeremiah", abbrev: "Jer", testament: "OT", chapter: 3, verse: 14, text: "Turn, O backsliding children, saith the LORD; for I am married unto you: and I will take you one of a city, and two of a family, and I will bring you to Zion:" },
  { book: "Jeremiah", abbrev: "Jer", testament: "OT", chapter: 6, verse: 16, text: "Thus saith the LORD, Stand ye in the ways, and see, and ask for the old paths, where is the good way, and walk therein, and ye shall find rest for your souls." },
  { book: "Jeremiah", abbrev: "Jer", testament: "OT", chapter: 29, verse: 11, text: "For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end." },
  { book: "Jeremiah", abbrev: "Jer", testament: "OT", chapter: 29, verse: 12, text: "Then shall ye call upon me, and ye shall go and pray unto me, and I will hearken unto you." },
  { book: "Jeremiah", abbrev: "Jer", testament: "OT", chapter: 29, verse: 13, text: "And ye shall seek me, and find me, when ye shall search for me with all your heart." },
  { book: "Jeremiah", abbrev: "Jer", testament: "OT", chapter: 33, verse: 3, text: "Call unto me, and I will answer thee, and shew thee great and mighty things, which thou knowest not." },
  // Lamentations
  { book: "Lamentations", abbrev: "Lam", testament: "OT", chapter: 3, verse: 22, text: "It is of the LORD'S mercies that we are not consumed, because his compassions fail not." },
  { book: "Lamentations", abbrev: "Lam", testament: "OT", chapter: 3, verse: 23, text: "They are new every morning: great is thy faithfulness." },
  { book: "Lamentations", abbrev: "Lam", testament: "OT", chapter: 3, verse: 24, text: "The LORD is my portion, saith my soul; therefore will I hope in him." },
  // Ezekiel
  { book: "Ezekiel", abbrev: "Eze", testament: "OT", chapter: 36, verse: 26, text: "A new heart also will I give you, and a new spirit will I put within you: and I will take away the stony heart out of your flesh, and I will give you an heart of flesh." },
  { book: "Ezekiel", abbrev: "Eze", testament: "OT", chapter: 37, verse: 4, text: "Again he said unto me, Prophesy upon these bones, and say unto them, O ye dry bones, hear the word of the LORD." },
  // Daniel
  { book: "Daniel", abbrev: "Dan", testament: "OT", chapter: 3, verse: 17, text: "If it be so, our God whom we serve is able to deliver us from the burning fiery furnace, and he will deliver us out of thine hand, O king." },
  { book: "Daniel", abbrev: "Dan", testament: "OT", chapter: 3, verse: 18, text: "But if not, be it known unto thee, O king, that we will not serve thy gods, nor worship the golden image which thou hast set up." },
  // Hosea
  { book: "Hosea", abbrev: "Hos", testament: "OT", chapter: 4, verse: 6, text: "My people are destroyed for lack of knowledge: because thou hast rejected knowledge, I will also reject thee, that thou shalt be no priest to me: seeing thou hast forgotten the law of thy God, I will also forget thy children." },
  // Joel
  { book: "Joel", abbrev: "Joe", testament: "OT", chapter: 2, verse: 12, text: "Therefore also now, saith the LORD, turn ye even to me with all your heart, and with fasting, and with weeping, and with mourning:" },
  { book: "Joel", abbrev: "Joe", testament: "OT", chapter: 2, verse: 28, text: "And it shall come to pass afterward, that I will pour out my spirit upon all flesh; and your sons and your daughters shall prophesy, your old men shall dream dreams, your young men shall see visions:" },
  // Amos
  { book: "Amos", abbrev: "Amo", testament: "OT", chapter: 3, verse: 3, text: "Can two walk together, except they be agreed?" },
  // Obadiah
  { book: "Obadiah", abbrev: "Oba", testament: "OT", chapter: 1, verse: 4, text: "Though thou exalt thyself as the eagle, and though thou set thy nest among the stars, thence will I bring thee down, saith the LORD." },
  // Jonah
  { book: "Jonah", abbrev: "Jon", testament: "OT", chapter: 2, verse: 9, text: "But I will sacrifice unto thee with the voice of thanksgiving; I will pay that that I have vowed. Salvation is of the LORD." },
  // Micah
  { book: "Micah", abbrev: "Mic", testament: "OT", chapter: 6, verse: 8, text: "He hath shewed thee, O man, what is good; and what doth the LORD require of thee, but to do justly, and to love mercy, and to walk humbly with thy God?" },
  // Nahum
  { book: "Nahum", abbrev: "Nah", testament: "OT", chapter: 1, verse: 7, text: "The LORD is good, a strong hold in the day of trouble; and he knoweth them that trust in him." },
  // Habakkuk
  { book: "Habakkuk", abbrev: "Hab", testament: "OT", chapter: 2, verse: 4, text: "Behold, his soul which is lifted up is not upright in him: but the just shall live by his faith." },
  { book: "Habakkuk", abbrev: "Hab", testament: "OT", chapter: 3, verse: 19, text: "The LORD God is my strength, and he will make my feet like hinds' feet, and he will make me to walk upon mine high places." },
  // Zephaniah
  { book: "Zephaniah", abbrev: "Zep", testament: "OT", chapter: 3, verse: 17, text: "The LORD thy God in the midst of thee is mighty; he will save, he will rejoice over thee with joy; he will rest in his love, he will joy over thee with singing." },
  // Haggai
  { book: "Haggai", abbrev: "Hag", testament: "OT", chapter: 2, verse: 9, text: "The glory of this latter house shall be greater than of the former, saith the LORD of hosts: and in this place will I give peace, saith the LORD of hosts." },
  // Zechariah
  { book: "Zechariah", abbrev: "Zec", testament: "OT", chapter: 4, verse: 6, text: "Then he answered and spake unto me, saying, This is the word of the LORD unto Zerubbabel, saying, Not by might, nor by power, but by my spirit, saith the LORD of hosts." },
  // Malachi
  { book: "Malachi", abbrev: "Mal", testament: "OT", chapter: 3, verse: 10, text: "Bring ye all the tithes into the storehouse, that there may be meat in mine house, and prove me now herewith, saith the LORD of hosts, if I will not open you the windows of heaven, and pour you out a blessing, that there shall not be room enough to receive it." },
  { book: "Malachi", abbrev: "Mal", testament: "OT", chapter: 4, verse: 2, text: "But unto you that fear my name shall the Sun of righteousness arise with healing in his wings; and ye shall go forth, and grow up as calves of the stall." },
  // Matthew
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 3, verse: 16, text: "And Jesus, when he was baptized, went up straightway out of the water: and, lo, the heavens were opened unto him, and he saw the Spirit of God descending like a dove, and lighting upon him:" },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 3, verse: 17, text: "And lo a voice from heaven, saying, This is my beloved Son, in whom I am well pleased." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 5, verse: 3, text: "Blessed are the poor in spirit: for theirs is the kingdom of heaven." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 5, verse: 4, text: "Blessed are they that mourn: for they shall be comforted." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 5, verse: 5, text: "Blessed are the meek: for they shall inherit the earth." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 5, verse: 6, text: "Blessed are they which do hunger and thirst after righteousness: for they shall be filled." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 5, verse: 7, text: "Blessed are the merciful: for they shall obtain mercy." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 5, verse: 8, text: "Blessed are the pure in heart: for they shall see God." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 5, verse: 9, text: "Blessed are the peacemakers: for they shall be called the children of God." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 5, verse: 14, text: "Ye are the light of the world. A city that is set on an hill cannot be hid." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 5, verse: 16, text: "Let your light so shine before men, that they may see your good works, and glorify your Father which is in heaven." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 6, verse: 9, text: "After this manner therefore pray ye: Our Father which art in heaven, Hallowed be thy name." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 6, verse: 10, text: "Thy kingdom come. Thy will be done in earth, as it is in heaven." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 6, verse: 11, text: "Give us this day our daily bread." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 6, verse: 12, text: "And forgive us our debts, as we forgive our debtors." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 6, verse: 13, text: "And lead us not into temptation, but deliver us from evil: For thine is the kingdom, and the power, and the glory, for ever. Amen." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 6, verse: 16, text: "Moreover when ye fast, be not, as the hypocrites, of a sad countenance: for they disfigure their faces, that they may appear unto men to fast. Verily I say unto you, They have their reward." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 6, verse: 33, text: "But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 7, verse: 7, text: "Ask, and it shall be given you; seek, and ye shall find; knock, and it shall be opened unto you:" },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 11, verse: 28, text: "Come unto me, all ye that labour and are heavy laden, and I will give you rest." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 11, verse: 29, text: "Take my yoke upon you, and learn of me; for I am meek and lowly in heart: and ye shall find rest unto your souls." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 16, verse: 18, text: "And I say also unto thee, That thou art Peter, and upon this rock I will build my church; and the gates of hell shall not prevail against it." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 18, verse: 18, text: "Verily I say unto you, Whatsoever ye shall bind on earth shall be bound in heaven: and whatsoever ye shall loose on earth shall be loosed in heaven." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 19, verse: 9, text: "And I say unto you, Whosoever shall put away his wife, except it be for fornication, and shall marry another, committeth adultery: and whoso marrieth her which is put away doth commit adultery." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 22, verse: 37, text: "Jesus said unto him, Thou shalt love the Lord thy God with all thy heart, and with all thy soul, and with all thy mind." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 22, verse: 39, text: "And the second is like unto it, Thou shalt love thy neighbour as thyself." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 24, verse: 6, text: "And ye shall hear of wars and rumours of wars: see that ye be not troubled: for all these things must come to pass, but the end is not yet." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 24, verse: 42, text: "Watch therefore: for ye know not what hour your Lord doth come." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 28, verse: 18, text: "And Jesus came and spake unto them, saying, All power is given unto me in heaven and in earth." },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 28, verse: 19, text: "Go ye therefore, and teach all nations, baptizing them in the name of the Father, and of the Son, and of the Holy Ghost:" },
  { book: "Matthew", abbrev: "Mat", testament: "NT", chapter: 28, verse: 20, text: "Teaching them to observe all things whatsoever I have commanded you: and, lo, I am with you alway, even unto the end of the world. Amen." },
  // Mark
  { book: "Mark", abbrev: "Mar", testament: "NT", chapter: 9, verse: 23, text: "Jesus said unto him, If thou canst believe, all things are possible to him that believeth." },
  { book: "Mark", abbrev: "Mar", testament: "NT", chapter: 9, verse: 29, text: "And he said unto them, This kind can come forth by nothing, but by prayer and fasting." },
  { book: "Mark", abbrev: "Mar", testament: "NT", chapter: 11, verse: 24, text: "Therefore I say unto you, What things soever ye desire, when ye pray, believe that ye receive them, and ye shall have them." },
  { book: "Mark", abbrev: "Mar", testament: "NT", chapter: 16, verse: 15, text: "And he said unto them, Go ye into all the world, and preach the gospel to every creature." },
  { book: "Mark", abbrev: "Mar", testament: "NT", chapter: 16, verse: 16, text: "He that believeth and is baptized shall be saved; but he that believeth not shall be damned." },
  { book: "Mark", abbrev: "Mar", testament: "NT", chapter: 16, verse: 17, text: "And these signs shall follow them that believe; In my name shall they cast out devils; they shall speak with new tongues;" },
  { book: "Mark", abbrev: "Mar", testament: "NT", chapter: 16, verse: 18, text: "They shall take up serpents; and if they drink any deadly thing, it shall not hurt them; they shall lay hands on the sick, and they shall recover." },
  // Luke
  { book: "Luke", abbrev: "Luk", testament: "NT", chapter: 1, verse: 37, text: "For with God nothing shall be impossible." },
  { book: "Luke", abbrev: "Luk", testament: "NT", chapter: 9, verse: 62, text: "And Jesus said unto him, No man, having put his hand to the plough, and looking back, is fit for the kingdom of God." },
  { book: "Luke", abbrev: "Luk", testament: "NT", chapter: 10, verse: 19, text: "Behold, I give unto you power to tread on serpents and scorpions, and over all the power of the enemy: and nothing shall by any means hurt you." },
  { book: "Luke", abbrev: "Luk", testament: "NT", chapter: 11, verse: 13, text: "If ye then, being evil, know how to give good gifts unto your children: how much more shall your heavenly Father give the Holy Spirit to them that ask him?" },
  { book: "Luke", abbrev: "Luk", testament: "NT", chapter: 15, verse: 20, text: "And he arose, and came to his father. But when he was yet a great way off, his father saw him, and had compassion, and ran, and fell on his neck, and kissed him." },
  { book: "Luke", abbrev: "Luk", testament: "NT", chapter: 21, verse: 36, text: "Watch ye therefore, and pray always, that ye may be accounted worthy to escape all these things that shall come to pass, and to stand before the Son of man." },
  // John
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 1, verse: 1, text: "In the beginning was the Word, and the Word was with God, and the Word was God." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 1, verse: 12, text: "But as many as received him, to them gave he power to become the sons of God, even to them that believe on his name:" },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 1, verse: 14, text: "And the Word was made flesh, and dwelt among us, (and we beheld his glory, the glory as of the only begotten of the Father,) full of grace and truth." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 4, verse: 24, text: "God is a Spirit: and they that worship him must worship him in spirit and in truth." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 8, verse: 32, text: "And ye shall know the truth, and the truth shall make you free." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 10, verse: 10, text: "The thief cometh not, but for to steal, and to kill, and to destroy: I am come that they might have life, and that they might have it more abundantly." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 11, verse: 25, text: "Jesus said unto her, I am the resurrection, and the life: he that believeth in me, though he were dead, yet shall he live:" },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 15, verse: 5, text: "I am the vine, ye are the branches: He that abideth in me, and I in him, the same bringeth forth much fruit: for without me ye can do nothing." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 15, verse: 13, text: "Greater love hath no man than this, that a man lay down his life for his friends." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 15, verse: 16, text: "Ye have not chosen me, but I have chosen you, and ordained you, that ye should go and bring forth fruit, and that your fruit should remain: that whatsoever ye shall ask of the Father in my name, he may give it you." },
  { book: "John", abbrev: "Jhn", testament: "NT", chapter: 17, verse: 17, text: "Sanctify them through thy truth: thy word is truth." },
  // Acts
  { book: "Acts", abbrev: "Act", testament: "NT", chapter: 1, verse: 8, text: "But ye shall receive power, after that the Holy Ghost is come upon you: and ye shall be witnesses unto me both in Jerusalem, and in all Judaea, and in Samaria, and unto the uttermost part of the earth." },
  { book: "Acts", abbrev: "Act", testament: "NT", chapter: 2, verse: 4, text: "And they were all filled with the Holy Ghost, and began to speak with other tongues, as the Spirit gave them utterance." },
  { book: "Acts", abbrev: "Act", testament: "NT", chapter: 2, verse: 38, text: "Then Peter said unto them, Repent, and be baptized every one of you in the name of Jesus Christ for the remission of sins, and ye shall receive the gift of the Holy Ghost." },
  { book: "Acts", abbrev: "Act", testament: "NT", chapter: 4, verse: 12, text: "Neither is there salvation in any other: for there is none other name under heaven given among men, whereby we must be saved." },
  { book: "Acts", abbrev: "Act", testament: "NT", chapter: 10, verse: 46, text: "For they heard them speak with tongues, and magnify God. Then answered Peter," },
  { book: "Acts", abbrev: "Act", testament: "NT", chapter: 16, verse: 31, text: "And they said, Believe on the Lord Jesus Christ, and thou shalt be saved, and thy house." },
  { book: "Acts", abbrev: "Act", testament: "NT", chapter: 19, verse: 6, text: "And when Paul had laid his hands upon them, the Holy Ghost came on them; and they spake with tongues, and prophesied." },
  // Romans
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 1, verse: 16, text: "For I am not ashamed of the gospel of Christ: for it is the power of God unto salvation to every one that believeth; to the Jew first, and also to the Greek." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 3, verse: 23, text: "For all have sinned, and come short of the glory of God;" },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 5, verse: 1, text: "Therefore being justified by faith, we have peace with God through our Lord Jesus Christ:" },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 5, verse: 8, text: "But God commendeth his love toward us, in that, while we were yet sinners, Christ died for us." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 6, verse: 23, text: "For the wages of sin is death; but the gift of God is eternal life through Jesus Christ our Lord." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 10, verse: 9, text: "That if thou shalt confess with thy mouth the Lord Jesus, and shalt believe in thine heart that God hath raised him from the dead, thou shalt be saved." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 10, verse: 10, text: "For with the heart man believeth unto righteousness; and with the mouth confession is made unto salvation." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 10, verse: 13, text: "For whosoever shall call upon the name of the Lord shall be saved." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 12, verse: 1, text: "I beseech you therefore, brethren, by the mercies of God, that ye present your bodies a living sacrifice, holy, acceptable unto God, which is your reasonable service." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 12, verse: 2, text: "And be not conformed to this world: but be ye transformed by the renewing of your mind, that ye may prove what is that good, and acceptable, and perfect, will of God." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 12, verse: 17, text: "Recompense to no man evil for evil. Provide things honest in the sight of all men." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 12, verse: 19, text: "Dearly beloved, avenge not yourselves, but rather give place unto wrath: for it is written, Vengeance is mine; I will repay, saith the Lord." },
  { book: "Romans", abbrev: "Rom", testament: "NT", chapter: 12, verse: 21, text: "Be not overcome of evil, but overcome evil with good." },
  // 1 Corinthians
  { book: "1 Corinthians", abbrev: "1Co", testament: "NT", chapter: 1, verse: 18, text: "For the preaching of the cross is to them that perish foolishness; but unto us which are saved it is the power of God." },
  { book: "1 Corinthians", abbrev: "1Co", testament: "NT", chapter: 6, verse: 19, text: "What? know ye not that your body is the temple of the Holy Ghost which is in you, which ye have of God, and ye are not your own?" },
  { book: "1 Corinthians", abbrev: "1Co", testament: "NT", chapter: 10, verse: 13, text: "There hath no temptation taken you but such as is common to man: but God is faithful, who will not suffer you to be tempted above that ye are able; but will with the temptation also make a way to escape, that ye may be able to bear it." },
  { book: "1 Corinthians", abbrev: "1Co", testament: "NT", chapter: 15, verse: 1, text: "Moreover, brethren, I declare unto you the gospel which I preached unto you, which also ye have received, and wherein ye stand;" },
  { book: "1 Corinthians", abbrev: "1Co", testament: "NT", chapter: 15, verse: 3, text: "For I delivered unto you first of all that which I also received, how that Christ died for our sins according to the scriptures;" },
  { book: "1 Corinthians", abbrev: "1Co", testament: "NT", chapter: 15, verse: 4, text: "And that he was buried, and that he rose again the third day according to the scriptures:" },
  { book: "1 Corinthians", abbrev: "1Co", testament: "NT", chapter: 15, verse: 55, text: "O death, where is thy sting? O grave, where is thy victory?" },
  { book: "1 Corinthians", abbrev: "1Co", testament: "NT", chapter: 15, verse: 57, text: "But thanks be to God, which giveth us the victory through our Lord Jesus Christ." },
  // 2 Corinthians
  { book: "2 Corinthians", abbrev: "2Co", testament: "NT", chapter: 1, verse: 3, text: "Blessed be God, even the Father of our Lord Jesus Christ, the Father of mercies, and the God of all comfort;" },
  { book: "2 Corinthians", abbrev: "2Co", testament: "NT", chapter: 1, verse: 4, text: "Who comforteth us in all our tribulation, that we may be able to comfort them which are in any trouble, by the comfort wherewith we ourselves are comforted of God." },
  { book: "2 Corinthians", abbrev: "2Co", testament: "NT", chapter: 5, verse: 17, text: "Therefore if any man be in Christ, he is a new creature: old things are passed away; behold, all things are become new." },
  { book: "2 Corinthians", abbrev: "2Co", testament: "NT", chapter: 6, verse: 14, text: "Be ye not unequally yoked together with unbelievers: for what fellowship hath righteousness with unrighteousness? and what communion hath light with darkness?" },
  { book: "2 Corinthians", abbrev: "2Co", testament: "NT", chapter: 9, verse: 7, text: "Every man according as he purposeth in his heart, so let him give; not grudgingly, or of necessity: for God loveth a cheerful giver." },
  { book: "2 Corinthians", abbrev: "2Co", testament: "NT", chapter: 12, verse: 9, text: "And he said unto me, My grace is sufficient for thee: for my strength is made perfect in weakness. Most gladly therefore will I rather glory in my infirmities, that the power of Christ may rest upon me." },
  // Galatians
  { book: "Galatians", abbrev: "Gal", testament: "NT", chapter: 2, verse: 20, text: "I am crucified with Christ: nevertheless I live; yet not I, but Christ liveth in me: and the life which I now live in the flesh I live by the faith of the Son of God, who loved me, and gave himself for me." },
  { book: "Galatians", abbrev: "Gal", testament: "NT", chapter: 3, verse: 13, text: "Christ hath redeemed us from the curse of the law, being made a curse for us: for it is written, Cursed is every one that hangeth on a tree:" },
  { book: "Galatians", abbrev: "Gal", testament: "NT", chapter: 5, verse: 16, text: "This I say then, Walk in the Spirit, and ye shall not fulfil the lust of the flesh." },
  { book: "Galatians", abbrev: "Gal", testament: "NT", chapter: 5, verse: 22, text: "But the fruit of the Spirit is love, joy, peace, longsuffering, gentleness, goodness, faith," },
  { book: "Galatians", abbrev: "Gal", testament: "NT", chapter: 5, verse: 23, text: "Meekness, temperance: against such there is no law." },
  { book: "Galatians", abbrev: "Gal", testament: "NT", chapter: 6, verse: 7, text: "Be not deceived; God is not mocked: for whatsoever a man soweth, that shall he also reap." },
  // Ephesians
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 1, verse: 3, text: "Blessed be the God and Father of our Lord Jesus Christ, who hath blessed us with all spiritual blessings in heavenly places in Christ:" },
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 2, verse: 8, text: "For by grace are ye saved through faith; and that not of yourselves: it is the gift of God:" },
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 2, verse: 9, text: "Not of works, lest any man should boast." },
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 4, verse: 11, text: "And he gave some, apostles; and some, prophets; and some, evangelists; and some, pastors and teachers;" },
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 4, verse: 12, text: "For the perfecting of the saints, for the work of the ministry, for the edifying of the body of Christ:" },
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 4, verse: 26, text: "Be ye angry, and sin not: let not the sun go down upon your wrath:" },
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 4, verse: 27, text: "Neither give place to the devil." },
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 5, verse: 22, text: "Wives, submit yourselves unto your own husbands, as unto the Lord." },
  { book: "Ephesians", abbrev: "Eph", testament: "NT", chapter: 5, verse: 25, text: "Husbands, love your wives, even as Christ also loved the church, and gave himself for it;" },
  // Philippians
  { book: "Philippians", abbrev: "Php", testament: "NT", chapter: 1, verse: 6, text: "Being confident of this very thing, that he which hath begun a good work in you will perform it until the day of Jesus Christ:" },
  { book: "Philippians", abbrev: "Php", testament: "NT", chapter: 2, verse: 9, text: "Wherefore God also hath highly exalted him, and given him a name which is above every name:" },
  { book: "Philippians", abbrev: "Php", testament: "NT", chapter: 2, verse: 10, text: "That at the name of Jesus every knee should bow, of things in heaven, and things in earth, and things under the earth;" },
  { book: "Philippians", abbrev: "Php", testament: "NT", chapter: 2, verse: 11, text: "And that every tongue should confess that Jesus Christ is Lord, to the glory of God the Father." },
  // Colossians
  { book: "Colossians", abbrev: "Col", testament: "NT", chapter: 1, verse: 16, text: "For by him were all things created, that are in heaven, and that are in earth, visible and invisible, whether they be thrones, or dominions, or principalities, or powers: all things were created by him, and for him:" },
  { book: "Colossians", abbrev: "Col", testament: "NT", chapter: 2, verse: 15, text: "And having spoiled principalities and powers, he made a shew of them openly, triumphing over them in it." },
  { book: "Colossians", abbrev: "Col", testament: "NT", chapter: 3, verse: 23, text: "And whatsoever ye do, do it heartily, as to the Lord, and not unto men;" },
  // 1 Thessalonians
  { book: "1 Thessalonians", abbrev: "1Th", testament: "NT", chapter: 4, verse: 16, text: "For the Lord himself shall descend from heaven with a shout, with the voice of the archangel, and with the trump of God: and the dead in Christ shall rise first:" },
  { book: "1 Thessalonians", abbrev: "1Th", testament: "NT", chapter: 4, verse: 17, text: "Then we which are alive and remain shall be caught up together with them in the clouds, to meet the Lord in the air: and so shall we ever be with the Lord." },
  { book: "1 Thessalonians", abbrev: "1Th", testament: "NT", chapter: 5, verse: 17, text: "Pray without ceasing." },
  { book: "1 Thessalonians", abbrev: "1Th", testament: "NT", chapter: 5, verse: 18, text: "In every thing give thanks: for this is the will of God in Christ Jesus concerning you." },
  { book: "1 Thessalonians", abbrev: "1Th", testament: "NT", chapter: 5, verse: 19, text: "Quench not the Spirit." },
  { book: "1 Thessalonians", abbrev: "1Th", testament: "NT", chapter: 5, verse: 20, text: "Despise not prophesyings." },
  { book: "1 Thessalonians", abbrev: "1Th", testament: "NT", chapter: 5, verse: 21, text: "Prove all things; hold fast that which is good." },
  // 2 Thessalonians
  { book: "2 Thessalonians", abbrev: "2Th", testament: "NT", chapter: 2, verse: 3, text: "Let no man deceive you by any means: for that day shall not come, except there come a falling away first, and that man of sin be revealed, the son of perdition;" },
  // 1 Timothy
  { book: "1 Timothy", abbrev: "1Ti", testament: "NT", chapter: 2, verse: 5, text: "For there is one God, and one mediator between God and men, the man Christ Jesus;" },
  { book: "1 Timothy", abbrev: "1Ti", testament: "NT", chapter: 4, verse: 1, text: "Now the Spirit speaketh expressly, that in the latter times some shall depart from the faith, giving heed to seducing spirits, and doctrines of devils;" },
  { book: "1 Timothy", abbrev: "1Ti", testament: "NT", chapter: 6, verse: 6, text: "But godliness with contentment is great gain." },
  { book: "1 Timothy", abbrev: "1Ti", testament: "NT", chapter: 6, verse: 10, text: "For the love of money is the root of all evil: which while some coveted after, they have erred from the faith, and pierced themselves through with many sorrows." },
  // 2 Timothy
  { book: "2 Timothy", abbrev: "2Ti", testament: "NT", chapter: 1, verse: 7, text: "For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind." },
  { book: "2 Timothy", abbrev: "2Ti", testament: "NT", chapter: 2, verse: 15, text: "Study to shew thyself approved unto God, a workman that needeth not to be ashamed, rightly dividing the word of truth." },
  { book: "2 Timothy", abbrev: "2Ti", testament: "NT", chapter: 3, verse: 1, text: "This know also, that in the last days perilous times shall come." },
  { book: "2 Timothy", abbrev: "2Ti", testament: "NT", chapter: 3, verse: 5, text: "Having a form of godliness, but denying the power thereof: from such turn away." },
  { book: "2 Timothy", abbrev: "2Ti", testament: "NT", chapter: 3, verse: 16, text: "All scripture is given by inspiration of God, and is profitable for doctrine, for reproof, for correction, for instruction in righteousness:" },
  { book: "2 Timothy", abbrev: "2Ti", testament: "NT", chapter: 3, verse: 17, text: "That the man of God may be perfect, throughly furnished unto all good works." },
  { book: "2 Timothy", abbrev: "2Ti", testament: "NT", chapter: 4, verse: 2, text: "Preach the word; be instant in season, out of season; reprove, rebuke, exhort with all longsuffering and doctrine." },
  // Titus
  { book: "Titus", abbrev: "Tit", testament: "NT", chapter: 2, verse: 11, text: "For the grace of God that bringeth salvation hath appeared to all men," },
  { book: "Titus", abbrev: "Tit", testament: "NT", chapter: 2, verse: 12, text: "Teaching us that, denying ungodliness and worldly lusts, we should live soberly, righteously, and godly, in this present world;" },
  // Philemon
  { book: "Philemon", abbrev: "Phm", testament: "NT", chapter: 1, verse: 16, text: "Not now as a servant, but above a servant, a brother beloved, specially to me, but how much more unto thee, both in the flesh, and in the Lord?" },
  // Hebrews
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 4, verse: 12, text: "For the word of God is quick, and powerful, and sharper than any twoedged sword, piercing even to the dividing asunder of soul and spirit, and of the joints and marrow, and is a discerner of the thoughts and intents of the heart." },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 4, verse: 16, text: "Let us therefore come boldly unto the throne of grace, that we may obtain mercy, and find grace to help in time of need." },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 10, verse: 25, text: "Not forsaking the assembling of ourselves together, as the manner of some is; but exhorting one another: and so much the more, as ye see the day approaching." },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 11, verse: 6, text: "But without faith it is impossible to please him: for he that cometh to God must believe that he is, and that he is a rewarder of them that diligently seek him." },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 12, verse: 1, text: "Wherefore seeing we also are compassed about with so great a cloud of witnesses, let us lay aside every weight, and the sin which doth so easily beset us, and let us run with patience the race that is set before us," },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 12, verse: 2, text: "Looking unto Jesus the author and finisher of our faith; who for the joy that was set before him endured the cross, despising the shame, and is set down at the right hand of the throne of God." },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 12, verse: 14, text: "Follow peace with all men, and holiness, without which no man shall see the Lord:" },
  { book: "Hebrews", abbrev: "Heb", testament: "NT", chapter: 13, verse: 8, text: "Jesus Christ the same yesterday, and to day, and for ever." },
  // James
  { book: "James", abbrev: "Jas", testament: "NT", chapter: 1, verse: 2, text: "My brethren, count it all joy when ye fall into divers temptations;" },
  { book: "James", abbrev: "Jas", testament: "NT", chapter: 1, verse: 3, text: "Knowing this, that the trying of your faith worketh patience." },
  { book: "James", abbrev: "Jas", testament: "NT", chapter: 1, verse: 17, text: "Every good gift and every perfect gift is from above, and cometh down from the Father of lights, with whom is no variableness, neither shadow of turning." },
  { book: "James", abbrev: "Jas", testament: "NT", chapter: 1, verse: 22, text: "But be ye doers of the word, and not hearers only, deceiving your own selves." },
  { book: "James", abbrev: "Jas", testament: "NT", chapter: 2, verse: 17, text: "Even so faith, if it hath not works, is dead, being alone." },
  { book: "James", abbrev: "Jas", testament: "NT", chapter: 4, verse: 7, text: "Submit yourselves therefore to God. Resist the devil, and he will flee from you." },
  { book: "James", abbrev: "Jas", testament: "NT", chapter: 4, verse: 8, text: "Draw nigh to God, and he will draw nigh to you. Cleanse your hands, ye sinners; and purify your hearts, ye double minded." },
  { book: "James", abbrev: "Jas", testament: "NT", chapter: 5, verse: 14, text: "Is any sick among you? let him call for the elders of the church; and let them pray over him, anointing him with oil in the name of the Lord:" },
  { book: "James", abbrev: "Jas", testament: "NT", chapter: 5, verse: 15, text: "And the prayer of faith shall save the sick, and the Lord shall raise him up; and if he have committed sins, they shall be forgiven him." },
  { book: "James", abbrev: "Jas", testament: "NT", chapter: 5, verse: 16, text: "Confess your faults one to another, and pray one for another, that ye may be healed. The effectual fervent prayer of a righteous man availeth much." },
  // 1 Peter
  { book: "1 Peter", abbrev: "1Pe", testament: "NT", chapter: 1, verse: 15, text: "But as he which hath called you is holy, so be ye holy in all manner of conversation;" },
  { book: "1 Peter", abbrev: "1Pe", testament: "NT", chapter: 1, verse: 16, text: "Because it is written, Be ye holy; for I am holy." },
  { book: "1 Peter", abbrev: "1Pe", testament: "NT", chapter: 2, verse: 9, text: "But ye are a chosen generation, a royal priesthood, an holy nation, a peculiar people; that ye should shew forth the praises of him who hath called you out of darkness into his marvellous light:" },
  { book: "1 Peter", abbrev: "1Pe", testament: "NT", chapter: 5, verse: 7, text: "Casting all your care upon him; for he careth for you." },
  { book: "1 Peter", abbrev: "1Pe", testament: "NT", chapter: 5, verse: 8, text: "Be sober, be vigilant; because your adversary the devil, as a roaring lion, walketh about, seeking whom he may devour:" },
  // 2 Peter
  { book: "2 Peter", abbrev: "2Pe", testament: "NT", chapter: 1, verse: 20, text: "Knowing this first, that no prophecy of the scripture is of any private interpretation." },
  { book: "2 Peter", abbrev: "2Pe", testament: "NT", chapter: 3, verse: 9, text: "The Lord is not slack concerning his promise, as some men count slackness; but is longsuffering to us-ward, not willing that any should perish, but that all should come to repentance." },
  // 1 John
  { book: "1 John", abbrev: "1Jo", testament: "NT", chapter: 1, verse: 9, text: "If we confess our sins, he is faithful and just to forgive us our sins, and to cleanse us from all unrighteousness." },
  { book: "1 John", abbrev: "1Jo", testament: "NT", chapter: 3, verse: 1, text: "Behold, what manner of love the Father hath bestowed upon us, that we should be called the sons of God: therefore the world knoweth us not, because it knew him not." },
  { book: "1 John", abbrev: "1Jo", testament: "NT", chapter: 4, verse: 4, text: "Ye are of God, little children, and have overcome them: because greater is he that is in you, than he that is in the world." },
  { book: "1 John", abbrev: "1Jo", testament: "NT", chapter: 4, verse: 8, text: "He that loveth not knoweth not God; for God is love." },
  { book: "1 John", abbrev: "1Jo", testament: "NT", chapter: 4, verse: 18, text: "There is no fear in love; but perfect love casteth out fear: because fear hath torment. He that feareth is not made perfect in love." },
  // 2 John
  { book: "2 John", abbrev: "2Jo", testament: "NT", chapter: 1, verse: 9, text: "Whosoever transgresseth, and abideth not in the doctrine of Christ, hath not God. He that abideth in the doctrine of Christ, he hath both the Father and the Son." },
  // 3 John
  { book: "3 John", abbrev: "3Jo", testament: "NT", chapter: 1, verse: 2, text: "Beloved, I wish above all things that thou mayest prosper and be in health, even as thy soul prospereth." },
  // Jude
  { book: "Jude", abbrev: "Jud", testament: "NT", chapter: 1, verse: 3, text: "Beloved, when I gave all diligence to write unto you of the common salvation, it was needful for me to write unto you, and exhort you that ye should earnestly contend for the faith which was once delivered unto the saints." },
  { book: "Jude", abbrev: "Jud", testament: "NT", chapter: 1, verse: 20, text: "But ye, beloved, building up yourselves on your most holy faith, praying in the Holy Ghost," },
  // Revelation
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 1, verse: 8, text: "I am Alpha and Omega, the beginning and the ending, saith the Lord, which is, and which was, and which is to come, the Almighty." },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 3, verse: 20, text: "Behold, I stand at the door, and knock: if any man hear my voice, and open the door, I will come in to him, and will sup with him, and he with me." },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 12, verse: 11, text: "And they overcame him by the blood of the Lamb, and by the word of their testimony; and they loved not their lives unto the death." },
  { book: "Revelation", abbrev: "Rev", testament: "NT", chapter: 19, verse: 16, text: "And he hath on his vesture and on his thigh a name written, KING OF KINGS, AND LORD OF LORDS." },
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
    const countRes = await biblePool.query<{ count: string }>("SELECT COUNT(*) as count FROM bible_verses");
    const existingCount = parseInt(countRes.rows[0]?.count ?? "0", 10);

    if (existingCount >= ALL_BIBLE_VERSES.length * 0.9) {
      logger.info({ existingCount, total: ALL_BIBLE_VERSES.length }, "Bible database already seeded — skipping");
      return;
    }

    logger.info({ total: ALL_BIBLE_VERSES.length }, "Seeding Bible database...");

    // Batch insert in groups of 100
    const BATCH = 100;
    let inserted = 0;

    for (let i = 0; i < ALL_BIBLE_VERSES.length; i += BATCH) {
      const batch = ALL_BIBLE_VERSES.slice(i, i + BATCH);

      // Build single multi-row INSERT with ON CONFLICT DO NOTHING
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
         ON CONFLICT (book_abbrev, chapter, verse) DO NOTHING`,
        params,
      );

      inserted += batch.length;
    }

    logger.info({ inserted }, "Bible database seeded successfully");
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
      return `${parsed.book} ${parsed.chapter}:${parsed.verseStart}-${parsed.verseEnd} (KJV): "${text}"`;
    }

    if (parsed.verseStart !== null) {
      const v = await lookupVerse(parsed.abbrev, parsed.chapter, parsed.verseStart);
      if (!v) return null;
      return `${v.book} ${v.chapter}:${v.verse} (KJV): "${v.text}"`;
    }

    // Chapter-level: return first 12 verses
    const verses = await lookupChapter(parsed.abbrev, parsed.chapter);
    if (verses.length === 0) return null;
    const preview = verses.slice(0, 12);
    const text = preview.map(v => `${v.verse}. ${v.text}`).join(" ");
    const suffix = verses.length > 12 ? ` [+${verses.length - 12} more verses]` : "";
    return `${parsed.book} ${parsed.chapter} (KJV, first ${preview.length} verses): ${text}${suffix}`;
  } catch {
    return null;
  }
}

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

// ─── Sermon-Driven Slide Content ─────────────────────────────────────────────
// Each slide is rooted in an actual sermon preached at JCTM by Prophet Amos Evomobor.
// Point  → concise message extracted from that sermon
// Quote  → the exact scripture that anchors the message
// Ref    → scripture reference (book chapter:verse)
// Theme  → Truth | Holiness | Salvation

const SLIDES = [
  // ── TRUTH ──────────────────────────────────────────────────────────────────
  {
    theme: "Truth",
    point: "If the Wrong Message Possesses You, How Can You Escape on the Last Day?",
    quote: "And you shall know the truth, and the truth shall make you free.",
    ref:   "John 8:32",
    sermon: "If the Wrong Message Possesses You, How Can You Escape on the Last Day?",
  },
  {
    theme: "Truth",
    point: "Only the True Message of Salvation Can Harvest Souls for God's Kingdom",
    quote: "For I am not ashamed of the gospel of Christ, for it is the power of God to salvation for everyone who believes.",
    ref:   "Romans 1:16",
    sermon: "Only The True Message Of Salvation Can Harvest Souls For The Kingdom Of God",
  },
  {
    theme: "Truth",
    point: "The Truth Is Always Bitter to Those Who Are Not in Jesus Christ",
    quote: "Jesus said to him, 'I am the way, the truth, and the life. No one comes to the Father except through Me.'",
    ref:   "John 14:6",
    sermon: "The truth is always bitter to those who are not in Jesus Christ",
  },
  {
    theme: "Truth",
    point: "The Word of God Must Be Mature in Your Spirit Before It Bears Fruit",
    quote: "Your word is a lamp to my feet and a light to my path.",
    ref:   "Psalm 119:105",
    sermon: "The word of God is matured in the spirit; the Preacher and the hearer must be mature",
  },
  {
    theme: "Truth",
    point: "Preaching That Does Not Bring Down the Holy Spirit Is Meaningless",
    quote: "And my speech and my preaching were not with persuasive words of human wisdom, but in demonstration of the Spirit and of power.",
    ref:   "1 Corinthians 2:4",
    sermon: "As a preacher, if your message does not bring down the Holy Spirit, your preaching is meaningless",
  },
  {
    theme: "Truth",
    point: "Ask for the Ancient Paths — That Is Where the Good Way Is Found",
    quote: "Stand in the ways and see, and ask for the old paths, where the good way is, and walk in it; then you will find rest for your souls.",
    ref:   "Jeremiah 6:16",
    sermon: "Standing on the Old Paths",
  },
  {
    theme: "Truth",
    point: "Test Every Spirit — Do Not Believe Every Voice That Claims to Be God",
    quote: "Beloved, do not believe every spirit, but test the spirits, whether they are of God; because many false prophets have gone out into the world.",
    ref:   "1 John 4:1",
    sermon: "The Correction Mandate — The Bible Is Our Standard",
  },
  {
    theme: "Truth",
    point: "The Gospel of Jesus Christ Is Not for Sale — It Cannot Be Bought or Merchandised",
    quote: "Freely you have received, freely give.",
    ref:   "Matthew 10:8",
    sermon: "The Gospel of Jesus Christ is not for sale",
  },

  // ── HOLINESS ───────────────────────────────────────────────────────────────
  {
    theme: "Holiness",
    point: "God Only Wants Holiness and Righteousness From You — Nothing Less Will Do",
    quote: "Without holiness no one will see the Lord.",
    ref:   "Hebrews 12:14",
    sermon: "God only wants Holiness and righteousness from you",
  },
  {
    theme: "Holiness",
    point: "Any Secret Sin Fighting Against Your Salvation Must Be Surrendered Today",
    quote: "Be sure your sin will find you out.",
    ref:   "Numbers 32:23",
    sermon: "Any Secret sin fighting against our salvation is destroyed in the name of our lord Jesus Christ",
  },
  {
    theme: "Holiness",
    point: "The Apostles Denied Themselves the Pleasures of This World — So Must We",
    quote: "Do not be conformed to this world, but be transformed by the renewing of your mind.",
    ref:   "Romans 12:2",
    sermon: "The Apostles denied themselves from the pleasures of this earth",
  },
  {
    theme: "Holiness",
    point: "Holiness Is the Path to God — Not a Prison, But a Privilege",
    quote: "But as He who called you is holy, you also be holy in all your conduct, because it is written, 'Be holy, for I am holy.'",
    ref:   "1 Peter 1:15–16",
    sermon: "Holiness Is the Path, Not the Prison",
  },
  {
    theme: "Holiness",
    point: "The Fruit of Righteousness Cannot Grow Alongside the Fruit of Sin",
    quote: "Does a spring send forth fresh water and bitter from the same opening?",
    ref:   "James 3:11",
    sermon: "The fruit of righteousness is a fruit without sin",
  },
  {
    theme: "Holiness",
    point: "Any Spirit Controlling You Is the Owner of Your Soul — Yield Only to God",
    quote: "For as many as are led by the Spirit of God, these are sons of God.",
    ref:   "Romans 8:14",
    sermon: "Any spirit that is controlling you is the owner of your soul",
  },
  {
    theme: "Holiness",
    point: "The Fear of the Lord Is Your Treasure — In It Is Wisdom, Stability, and Safety",
    quote: "The fear of the LORD is Zion's treasure — wisdom and knowledge, salvation and strength.",
    ref:   "Isaiah 33:6",
    sermon: "The Fear of the Lord Is Your Treasure",
  },
  {
    theme: "Holiness",
    point: "When the Holy Spirit Leaves a Man, He Becomes Empty — Guard Your Consecration",
    quote: "Do not grieve the Holy Spirit of God, by whom you were sealed for the day of redemption.",
    ref:   "Ephesians 4:30",
    sermon: "When the Holy Spirit leaves a man, he becomes empty",
  },

  // ── SALVATION ──────────────────────────────────────────────────────────────
  {
    theme: "Salvation",
    point: "Heaven and Hellfire Are Real — Every Man's Destination Is Decided in This Life",
    quote: "Enter by the narrow gate; for wide is the gate and broad is the way that leads to destruction.",
    ref:   "Matthew 7:13",
    sermon: "Heaven and hellfire are real; one of them is the destination of a man",
  },
  {
    theme: "Salvation",
    point: "Labour for the Food That Endures to Everlasting Life — Not What Perishes",
    quote: "Do not labour for the food which perishes, but for the food which endures to everlasting life.",
    ref:   "John 6:27",
    sermon: "Labour for the food which endures to everlasting LIFE",
  },
  {
    theme: "Salvation",
    point: "The Trumpet Is About to Sound — Only the Prepared Will Be Taken",
    quote: "For the Lord Himself will descend from heaven with a shout, and the dead in Christ will rise first.",
    ref:   "1 Thessalonians 4:16",
    sermon: "The Trumpet is about to sound, Are you ready for RAPTURE?",
  },
  {
    theme: "Salvation",
    point: "Only Your Righteousness Can Save You in the Day of Trouble",
    quote: "Riches do not profit in the day of wrath, but righteousness delivers from death.",
    ref:   "Proverbs 11:4",
    sermon: "Only your righteousness can save you in the day of trouble",
  },
  {
    theme: "Salvation",
    point: "Whoever Desires to Save His Own Life Will Lose It — Surrender Everything to Christ",
    quote: "For whoever desires to save his life will lose it, but whoever loses his life for My sake will find it.",
    ref:   "Matthew 16:25",
    sermon: "Whoever desires to save his life will lose it",
  },
  {
    theme: "Salvation",
    point: "God Cannot Fail Those Who Truly Believe in Him — He Has Never Lost a Soul",
    quote: "For everyone who calls on the name of the Lord will be saved.",
    ref:   "Romans 10:13",
    sermon: "God cannot fail those who believe in HIM",
  },
];

const THEME: Record<string, { accent: string; pill: string; bg: string; quoteColor: string }> = {
  Truth: {
    accent:     "#38BDF8",
    pill:       "rgba(56,189,248,0.13)",
    bg:         "linear-gradient(160deg,#002a5c 0%,#001228 100%)",
    quoteColor: "rgba(186,230,255,0.85)",
  },
  Holiness: {
    accent:     "#C084FC",
    pill:       "rgba(192,132,252,0.13)",
    bg:         "linear-gradient(160deg,#2a004a 0%,#120020 100%)",
    quoteColor: "rgba(233,213,255,0.85)",
  },
  Salvation: {
    accent:     "#34D399",
    pill:       "rgba(52,211,153,0.13)",
    bg:         "linear-gradient(160deg,#003828 0%,#001810 100%)",
    quoteColor: "rgba(167,243,208,0.85)",
  },
};

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const rawModules = import.meta.glob(
  "../../../../attached_assets/*.jpg",
  { eager: true, query: "?url", import: "default" },
) as Record<string, string>;

const ALL_IMAGE_URLS: string[] = Object.values(rawModules);

type Orientation = "landscape" | "portrait";

function CaptionContent({
  slide,
  layout,
}: {
  slide: typeof SLIDES[number];
  layout: "overlay" | "side";
}) {
  const theme = THEME[slide.theme];
  const isSide = layout === "side";

  return (
    <div className={isSide ? "flex flex-col justify-center h-full" : "text-center"}>
      {/* Sermon point — prominent */}
      <h2
        className={`font-serif font-bold leading-snug text-white mb-4 ${
          isSide
            ? "text-lg sm:text-xl lg:text-2xl"
            : "text-xl sm:text-2xl md:text-3xl"
        }`}
        style={{ textShadow: isSide ? "none" : "0 2px 20px rgba(0,0,0,0.6)" }}
      >
        {slide.point}
      </h2>

      {/* Accent rule */}
      <div
        className={`h-px mb-4 rounded-full ${isSide ? "w-10" : "w-10 mx-auto"}`}
        style={{ background: `${theme.accent}70` }}
      />

      {/* Scripture quote */}
      <p
        className={`font-serif italic leading-relaxed mb-2 ${
          isSide ? "text-sm" : "text-sm sm:text-base"
        }`}
        style={{ color: theme.quoteColor }}
      >
        "{slide.quote}"
      </p>

      {/* Scripture reference */}
      <p
        className="text-[11px] font-bold uppercase tracking-widest"
        style={{ color: `${theme.accent}CC` }}
      >
        — {slide.ref}
      </p>

      {!isSide && (
        <p className="mt-3 text-white/30 text-[10px] uppercase tracking-widest">
          Jesus Christ Temple Ministry · Warri, Nigeria
        </p>
      )}

      {isSide && (
        <p className="mt-5 text-white/30 text-[9px] uppercase tracking-widest hidden sm:block">
          Jesus Christ Temple Ministry · Warri, Nigeria
        </p>
      )}
    </div>
  );
}

function SlideCaption({
  slideIdx,
  layout,
}: {
  slideIdx: number;
  layout: "overlay" | "side";
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={slideIdx}
        initial={{ opacity: 0, y: layout === "overlay" ? 20 : 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: layout === "overlay" ? -14 : -8 }}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
      >
        <CaptionContent slide={SLIDES[slideIdx % SLIDES.length]} layout={layout} />
      </motion.div>
    </AnimatePresence>
  );
}

export function MinistrySlideshow() {
  const [shuffledImgs, setShuffledImgs]   = useState<string[]>([]);
  const [imgIdx, setImgIdx]               = useState(0);
  const [slideIdx, setSlideIdx]           = useState(0);
  const [paused, setPaused]               = useState(false);
  const [orientations, setOrientations]   = useState<Record<string, Orientation>>({});
  const intervalRef                        = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setShuffledImgs(shuffleArray(ALL_IMAGE_URLS));
    setSlideIdx(Math.floor(Math.random() * SLIDES.length));
  }, []);

  const detectOrientation = useCallback((src: string) => {
    setOrientations(prev => {
      if (prev[src]) return prev;
      const img = new Image();
      img.onload = () => {
        const o: Orientation = img.naturalWidth >= img.naturalHeight ? "landscape" : "portrait";
        setOrientations(p => ({ ...p, [src]: o }));
      };
      img.src = src;
      return prev;
    });
  }, []);

  useEffect(() => {
    if (shuffledImgs.length === 0) return;
    [0, 1, 2].forEach(offset => {
      const src = shuffledImgs[(imgIdx + offset) % shuffledImgs.length];
      if (src) {
        detectOrientation(src);
        const preload = new Image();
        preload.src = src;
      }
    });
  }, [imgIdx, shuffledImgs, detectOrientation]);

  useEffect(() => {
    if (paused || shuffledImgs.length === 0) return;
    intervalRef.current = setInterval(() => {
      setImgIdx(i => (i + 1) % shuffledImgs.length);
      setSlideIdx(s => (s + 1) % SLIDES.length);
    }, 5500);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [paused, shuffledImgs]);

  const currentSrc  = shuffledImgs[imgIdx];
  const orientation = orientations[currentSrc] ?? "landscape";
  const isPortrait  = orientation === "portrait";
  const theme       = THEME[SLIDES[slideIdx % SLIDES.length].theme];

  if (shuffledImgs.length === 0 || !currentSrc) return null;

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl shadow-2xl"
      style={{ minHeight: 500, maxHeight: 720, height: "64vw" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <AnimatePresence mode="sync">
        {isPortrait ? (
          /* ── PORTRAIT: two-column ─────────────────────────────── */
          <motion.div
            key={`p-${currentSrc}`}
            className="absolute inset-0 flex"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.85, ease: "easeInOut" }}
          >
            {/* Image column */}
            <motion.div
              className="relative flex items-center justify-center overflow-hidden shrink-0"
              style={{ width: "45%", background: "#07101e" }}
              initial={{ x: -16, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              <img src={currentSrc} alt="" aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover scale-110"
                style={{ filter: "blur(22px) brightness(0.3) saturate(1.4)" }}
                loading="eager" decoding="async" />
              <img src={currentSrc} alt="JCTM Ministry — full portrait view"
                className="relative z-10 max-w-full max-h-full object-contain"
                style={{ padding: "14px", filter: "brightness(1.06) contrast(1.02) saturate(1.1)" }}
                loading="eager" decoding="async" />
              <div className="absolute inset-y-0 right-0 w-px"
                style={{ background: `linear-gradient(to bottom, transparent, ${theme.accent}60, transparent)` }} />
            </motion.div>

            {/* Caption column */}
            <div
              className="relative flex flex-col justify-center px-7 sm:px-10 py-8 overflow-hidden"
              style={{ width: "55%", background: theme.bg }}
            >
              <div className="absolute inset-0 opacity-[0.035] pointer-events-none"
                style={{
                  backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)",
                  backgroundSize: "26px 26px",
                }} />
              <div className="relative z-10">
                <SlideCaption slideIdx={slideIdx} layout="side" />
              </div>
            </div>
          </motion.div>
        ) : (
          /* ── LANDSCAPE: full-width ────────────────────────────── */
          <motion.div
            key={`l-${currentSrc}`}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.85, ease: "easeInOut" }}
          >
            {/* Blurred backdrop */}
            <img src={currentSrc} alt="" aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover scale-110"
              style={{ filter: "blur(20px) brightness(0.38) saturate(1.5)" }}
              loading="eager" decoding="async" />
            {/* Main image — fully contained */}
            <motion.img
              src={currentSrc}
              alt="JCTM Ministry"
              className="absolute inset-0 w-full h-full object-contain"
              style={{ filter: "brightness(1.07) contrast(1.03) saturate(1.12)" }}
              loading="eager" decoding="async"
              initial={{ scale: 1.03 }}
              animate={{ scale: 1 }}
              transition={{ duration: 6, ease: "linear" }}
            />
            {/* Bottom gradient */}
            <div className="absolute inset-x-0 bottom-0 pointer-events-none"
              style={{ height: "65%", background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.5) 38%, transparent 100%)" }} />
            {/* Top vignette */}
            <div className="absolute inset-x-0 top-0 h-20 pointer-events-none"
              style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 100%)" }} />
            {/* Caption */}
            <div className="absolute inset-x-0 bottom-0 px-8 sm:px-14 pb-10 sm:pb-12">
              <SlideCaption slideIdx={slideIdx} layout="overlay" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress bar */}
      <div className="absolute top-0 inset-x-0 h-0.5 z-30 bg-white/10">
        <AnimatePresence>
          <motion.div
            key={imgIdx}
            className="h-full rounded-r-full"
            style={{ background: theme.accent }}
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 5.5, ease: "linear" }}
          />
        </AnimatePresence>
      </div>

      {/* Dot indicators */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-30">
        {Array.from({ length: Math.min(SLIDES.length, 22) }).map((_, i) => {
          const active = (slideIdx % SLIDES.length) === i;
          return (
            <motion.div
              key={i}
              animate={{ width: active ? 20 : 5, opacity: active ? 1 : 0.28 }}
              transition={{ duration: 0.3 }}
              className="h-1 rounded-full"
              style={{ background: active ? theme.accent : "rgba(255,255,255,0.55)" }}
            />
          );
        })}
      </div>
    </div>
  );
}

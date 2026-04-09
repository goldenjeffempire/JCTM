import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

// ─── Sermon-Driven Slide Content ─────────────────────────────────────────────
const SLIDES = [
  // ── TRUTH ──────────────────────────────────────────────────────────────────
  {
    theme: "Truth",
    point: "If the Wrong Message Possesses You, How Can You Escape on the Last Day?",
    quote: "And you shall know the truth, and the truth shall make you free.",
    ref: "John 8:32",
  },
  {
    theme: "Truth",
    point: "Only the True Message of Salvation Can Harvest Souls for God's Kingdom",
    quote: "For I am not ashamed of the gospel of Christ, for it is the power of God to salvation for everyone who believes.",
    ref: "Romans 1:16",
  },
  {
    theme: "Truth",
    point: "The Truth Is Always Bitter to Those Who Are Not in Jesus Christ",
    quote: "Jesus said to him, 'I am the way, the truth, and the life. No one comes to the Father except through Me.'",
    ref: "John 14:6",
  },
  {
    theme: "Truth",
    point: "The Word of God Must Be Mature in Your Spirit Before It Bears Fruit",
    quote: "Your word is a lamp to my feet and a light to my path.",
    ref: "Psalm 119:105",
  },
  {
    theme: "Truth",
    point: "Preaching That Does Not Bring Down the Holy Spirit Is Meaningless",
    quote: "And my speech and my preaching were not with persuasive words of human wisdom, but in demonstration of the Spirit and of power.",
    ref: "1 Corinthians 2:4",
  },
  {
    theme: "Truth",
    point: "Ask for the Ancient Paths — That Is Where the Good Way Is Found",
    quote: "Stand in the ways and see, and ask for the old paths, where the good way is, and walk in it; then you will find rest for your souls.",
    ref: "Jeremiah 6:16",
  },
  {
    theme: "Truth",
    point: "Test Every Spirit — Do Not Believe Every Voice That Claims to Be God",
    quote: "Beloved, do not believe every spirit, but test the spirits, whether they are of God; because many false prophets have gone out into the world.",
    ref: "1 John 4:1",
  },
  {
    theme: "Truth",
    point: "The Gospel of Jesus Christ Is Not for Sale — It Cannot Be Bought or Merchandised",
    quote: "Freely you have received, freely give.",
    ref: "Matthew 10:8",
  },
  // ── HOLINESS ───────────────────────────────────────────────────────────────
  {
    theme: "Holiness",
    point: "God Only Wants Holiness and Righteousness From You — Nothing Less Will Do",
    quote: "Without holiness no one will see the Lord.",
    ref: "Hebrews 12:14",
  },
  {
    theme: "Holiness",
    point: "Any Secret Sin Fighting Against Your Salvation Must Be Surrendered Today",
    quote: "Be sure your sin will find you out.",
    ref: "Numbers 32:23",
  },
  {
    theme: "Holiness",
    point: "The Apostles Denied Themselves the Pleasures of This World — So Must We",
    quote: "Do not be conformed to this world, but be transformed by the renewing of your mind.",
    ref: "Romans 12:2",
  },
  {
    theme: "Holiness",
    point: "Holiness Is the Path to God — Not a Prison, But a Privilege",
    quote: "But as He who called you is holy, you also be holy in all your conduct, because it is written, 'Be holy, for I am holy.'",
    ref: "1 Peter 1:15–16",
  },
  {
    theme: "Holiness",
    point: "The Fruit of Righteousness Cannot Grow Alongside the Fruit of Sin",
    quote: "Does a spring send forth fresh water and bitter from the same opening?",
    ref: "James 3:11",
  },
  {
    theme: "Holiness",
    point: "Any Spirit Controlling You Is the Owner of Your Soul — Yield Only to God",
    quote: "For as many as are led by the Spirit of God, these are sons of God.",
    ref: "Romans 8:14",
  },
  {
    theme: "Holiness",
    point: "The Fear of the Lord Is Your Treasure — In It Is Wisdom, Stability, and Safety",
    quote: "The fear of the LORD is Zion's treasure — wisdom and knowledge, salvation and strength.",
    ref: "Isaiah 33:6",
  },
  {
    theme: "Holiness",
    point: "When the Holy Spirit Leaves a Man, He Becomes Empty — Guard Your Consecration",
    quote: "Do not grieve the Holy Spirit of God, by whom you were sealed for the day of redemption.",
    ref: "Ephesians 4:30",
  },
  // ── SALVATION ──────────────────────────────────────────────────────────────
  {
    theme: "Salvation",
    point: "Heaven and Hellfire Are Real — Every Man's Destination Is Decided in This Life",
    quote: "Enter by the narrow gate; for wide is the gate and broad is the way that leads to destruction.",
    ref: "Matthew 7:13",
  },
  {
    theme: "Salvation",
    point: "Labour for the Food That Endures to Everlasting Life — Not What Perishes",
    quote: "Do not labour for the food which perishes, but for the food which endures to everlasting life.",
    ref: "John 6:27",
  },
  {
    theme: "Salvation",
    point: "The Trumpet Is About to Sound — Only the Prepared Will Be Taken",
    quote: "For the Lord Himself will descend from heaven with a shout, and the dead in Christ will rise first.",
    ref: "1 Thessalonians 4:16",
  },
  {
    theme: "Salvation",
    point: "Only Your Righteousness Can Save You in the Day of Trouble",
    quote: "Riches do not profit in the day of wrath, but righteousness delivers from death.",
    ref: "Proverbs 11:4",
  },
  {
    theme: "Salvation",
    point: "Whoever Desires to Save His Own Life Will Lose It — Surrender Everything to Christ",
    quote: "For whoever desires to save his life will lose it, but whoever loses his life for My sake will find it.",
    ref: "Matthew 16:25",
  },
  {
    theme: "Salvation",
    point: "God Cannot Fail Those Who Truly Believe in Him — He Has Never Lost a Soul",
    quote: "For everyone who calls on the name of the Lord will be saved.",
    ref: "Romans 10:13",
  },
];

const THEME: Record<string, { accent: string; pill: string; bg: string; quoteColor: string }> = {
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
};

const INTERVAL_MS = 10000;

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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
  slide: typeof SLIDES[number]; layout: "overlay" | "side";
}) {
  const th = THEME[slide.theme];
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
        Jesus Christ Temple Ministry · Warri, Nigeria
      </p>
    </div>
  );
}

function SlideCaption({ slideIdx, layout }: { slideIdx: number; layout: "overlay" | "side" }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={slideIdx}
        initial={{ opacity: 0, y: layout === "overlay" ? 18 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: layout === "overlay" ? -12 : -6 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <CaptionContent slide={SLIDES[slideIdx % SLIDES.length]} layout={layout} />
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function MinistrySlideshow() {
  const [shuffled, setShuffled] = useState<ImageEntry[]>([]);
  const [imgIdx, setImgIdx]     = useState(0);
  const [slideIdx, setSlideIdx] = useState(0);
  const [orientations, setOrientations] = useState<Record<string, Orientation>>({});

  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const preloadedRef = useRef(false);

  // ── Initialise ───────────────────────────────────────────────────────────
  useEffect(() => {
    const s = shuffleArray(ALL_IMAGES);
    setShuffled(s);
    setSlideIdx(Math.floor(Math.random() * SLIDES.length));
    if (s.length > 0 && !preloadedRef.current) {
      preloadedRef.current = true;
      injectPreload(s[0]);
    }
  }, []);

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
    if (!shuffled.length) return;
    intervalRef.current = setInterval(() => {
      setImgIdx((i)   => (i   + 1) % shuffled.length);
      setSlideIdx((s) => (s   + 1) % SLIDES.length);
    }, INTERVAL_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [shuffled]);

  const currentEntry = shuffled[imgIdx];
  const orientation  = currentEntry ? (orientations[currentEntry.webp] ?? "landscape") : "landscape";
  const isPortrait   = orientation === "portrait";
  const slide        = SLIDES[slideIdx % SLIDES.length];
  const theme        = THEME[slide.theme];
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
                <SlideCaption slideIdx={slideIdx} layout="side" />
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
              <SlideCaption slideIdx={slideIdx} layout="overlay" />
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

      {/* ── Bottom bar: dots + slide counter ──────────────────────────── */}
      <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-3 z-40 pointer-events-none">
        <SlideDots total={SLIDES.length} current={slideIdx % SLIDES.length} accent={theme.accent} />
        <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: `${theme.accent}90` }}>
          {(imgIdx % shuffled.length) + 1} / {shuffled.length}
        </span>
      </div>
    </div>
  );
}

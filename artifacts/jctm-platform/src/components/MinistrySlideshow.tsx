import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const STORY_CAPTIONS = [
  { headline: "The Truth Shall Set You Free",          verse: "John 8:32",          theme: "Truth" },
  { headline: "Be Holy, For I Am Holy",                verse: "1 Peter 1:16",       theme: "Holiness" },
  { headline: "Salvation Through Christ Alone",        verse: "Acts 4:12",          theme: "Salvation" },
  { headline: "The Bible Is Our Standard",             verse: "JCTM Core Mandate",  theme: "Truth" },
  { headline: "Sanctify Them By Your Truth",           verse: "John 17:17",         theme: "Holiness" },
  { headline: "Believe and Be Saved",                  verse: "Acts 16:31",         theme: "Salvation" },
  { headline: "Standing on the Old Paths",             verse: "Jeremiah 6:16",      theme: "Truth" },
  { headline: "Without Holiness No Man Shall See God", verse: "Hebrews 12:14",     theme: "Holiness" },
  { headline: "Repentance Toward Life",                verse: "Acts 11:18",         theme: "Salvation" },
  { headline: "Testing the Spirits",                   verse: "1 John 4:1",         theme: "Truth" },
  { headline: "A Chosen and Holy Nation",              verse: "1 Peter 2:9",        theme: "Holiness" },
  { headline: "The Gospel: Power Unto Salvation",      verse: "Romans 1:16",        theme: "Salvation" },
];

const THEME: Record<string, { accent: string; badge: string; pill: string; bg: string }> = {
  Truth: {
    accent: "#38BDF8",
    badge:  "rgba(56,189,248,0.18)",
    pill:   "rgba(56,189,248,0.12)",
    bg:     "linear-gradient(135deg,#003d7a 0%,#001a40 100%)",
  },
  Holiness: {
    accent: "#C084FC",
    badge:  "rgba(192,132,252,0.18)",
    pill:   "rgba(192,132,252,0.12)",
    bg:     "linear-gradient(135deg,#2e0050 0%,#12002a 100%)",
  },
  Salvation: {
    accent: "#34D399",
    badge:  "rgba(52,211,153,0.18)",
    pill:   "rgba(52,211,153,0.12)",
    bg:     "linear-gradient(135deg,#003d2e 0%,#001a14 100%)",
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

function CaptionPanel({
  captionIdx,
  theme,
  layout,
}: {
  captionIdx: number;
  theme: ReturnType<typeof THEME[string]>;
  layout: "overlay" | "side";
}) {
  const caption = STORY_CAPTIONS[captionIdx];
  if (!caption) return null;

  const isOverlay = layout === "overlay";

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={captionIdx}
        initial={{ opacity: 0, y: isOverlay ? 22 : 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: isOverlay ? -14 : -10 }}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        className={isOverlay ? "text-center" : "flex flex-col justify-center h-full"}
      >
        <span
          className="inline-block text-[10px] font-bold uppercase tracking-[0.28em] mb-3 px-3.5 py-1.5 rounded-full border"
          style={{
            color: theme.accent,
            borderColor: `${theme.accent}50`,
            background: theme.pill,
          }}
        >
          {caption.theme}
        </span>

        <h2
          className={`font-serif font-bold leading-tight mb-4 text-white ${
            isOverlay
              ? "text-2xl sm:text-3xl md:text-[2rem]"
              : "text-xl sm:text-2xl lg:text-3xl"
          }`}
          style={{ textShadow: isOverlay ? "0 2px 24px rgba(0,0,0,0.55)" : "none" }}
        >
          {caption.headline}
        </h2>

        <div
          className="h-px w-12 mb-4 rounded-full"
          style={{ background: `${theme.accent}80` }}
        />

        <p
          className="text-sm font-semibold tracking-widest uppercase"
          style={{ color: `${theme.accent}CC` }}
        >
          {caption.verse}
        </p>

        <p className="mt-4 text-white/50 text-xs leading-relaxed hidden sm:block">
          Jesus Christ Temple Ministry — Warri, Nigeria
        </p>
      </motion.div>
    </AnimatePresence>
  );
}

export function MinistrySlideshow() {
  const [shuffled, setShuffled]           = useState<string[]>([]);
  const [idx, setIdx]                     = useState(0);
  const [captionIdx, setCaptionIdx]       = useState(0);
  const [paused, setPaused]               = useState(false);
  const [orientations, setOrientations]   = useState<Record<string, Orientation>>({});
  const intervalRef                        = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setShuffled(shuffleArray(ALL_IMAGE_URLS));
    setCaptionIdx(Math.floor(Math.random() * STORY_CAPTIONS.length));
  }, []);

  const detectOrientation = useCallback((src: string) => {
    if (orientations[src]) return;
    const img = new Image();
    img.onload = () => {
      const o: Orientation = img.naturalWidth >= img.naturalHeight ? "landscape" : "portrait";
      setOrientations(prev => ({ ...prev, [src]: o }));
    };
    img.src = src;
  }, [orientations]);

  useEffect(() => {
    if (shuffled.length === 0) return;
    const toPreload = [0, 1, 2].map(offset => shuffled[(idx + offset) % shuffled.length]).filter(Boolean);
    toPreload.forEach(src => {
      detectOrientation(src);
      const img = new Image();
      img.src = src;
    });
  }, [idx, shuffled, detectOrientation]);

  useEffect(() => {
    if (paused || shuffled.length === 0) return;
    intervalRef.current = setInterval(() => {
      setIdx(i => {
        const next = (i + 1) % shuffled.length;
        if (next % 3 === 0) setCaptionIdx(c => (c + 1) % STORY_CAPTIONS.length);
        return next;
      });
    }, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [paused, shuffled]);

  const currentSrc   = shuffled[idx];
  const orientation  = orientations[currentSrc] ?? "landscape";
  const isPortrait   = orientation === "portrait";
  const caption      = STORY_CAPTIONS[captionIdx];
  const theme        = THEME[caption?.theme ?? "Truth"];

  if (shuffled.length === 0 || !currentSrc) return null;

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl shadow-2xl"
      style={{ minHeight: 500, maxHeight: 720, height: "64vw", maxWidth: "100%" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <AnimatePresence mode="sync">
        {isPortrait ? (
          /* ── PORTRAIT: two-column ─────────────────────────────── */
          <motion.div
            key={`portrait-${currentSrc}`}
            className="absolute inset-0 flex"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: "easeInOut" }}
          >
            {/* Left — image (fully contained, no crop) */}
            <motion.div
              className="relative flex items-center justify-center overflow-hidden"
              style={{
                width: "45%",
                background: "#08101e",
              }}
              initial={{ x: -18, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Subtle blurred backdrop from same image */}
              <img
                src={currentSrc}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover scale-110"
                style={{ filter: "blur(24px) brightness(0.35) saturate(1.3)", opacity: 0.9 }}
                loading="eager"
                decoding="async"
              />
              {/* Main image, fully contained */}
              <img
                src={currentSrc}
                alt="JCTM Ministry"
                className="relative z-10 max-w-full max-h-full object-contain drop-shadow-2xl"
                style={{ maxHeight: "100%", padding: "16px" }}
                loading="eager"
                decoding="async"
              />
              {/* Thin accent edge */}
              <div
                className="absolute inset-y-0 right-0 w-0.5"
                style={{ background: `linear-gradient(to bottom, transparent, ${theme.accent}50, transparent)` }}
              />
            </motion.div>

            {/* Right — caption panel */}
            <div
              className="flex flex-col justify-center px-8 sm:px-10 py-8"
              style={{ width: "55%", background: theme.bg }}
            >
              {/* Subtle pattern */}
              <div
                className="absolute inset-0 opacity-[0.04] pointer-events-none"
                style={{
                  backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)",
                  backgroundSize: "28px 28px",
                  width: "55%",
                  right: 0,
                  left: "auto",
                }}
              />
              <div className="relative z-10">
                <CaptionPanel captionIdx={captionIdx} theme={theme} layout="side" />
              </div>
            </div>
          </motion.div>
        ) : (
          /* ── LANDSCAPE: full-width with blurred backdrop ──────── */
          <motion.div
            key={`landscape-${currentSrc}`}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: "easeInOut" }}
          >
            {/* Blurred backdrop (fills the container, covers letterbox bars) */}
            <img
              src={currentSrc}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover scale-110"
              style={{ filter: "blur(20px) brightness(0.45) saturate(1.4)" }}
              loading="eager"
              decoding="async"
            />
            {/* Main image — fully contained, no crop */}
            <motion.img
              src={currentSrc}
              alt="JCTM Ministry"
              className="absolute inset-0 w-full h-full object-contain"
              style={{ filter: "brightness(1.05) contrast(1.03) saturate(1.1)" }}
              loading="eager"
              decoding="async"
              initial={{ scale: 1.03 }}
              animate={{ scale: 1 }}
              transition={{ duration: 6, ease: "linear" }}
            />
            {/* Bottom caption gradient */}
            <div
              className="absolute inset-x-0 bottom-0 h-56 pointer-events-none"
              style={{
                background: "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.45) 50%, transparent 100%)",
              }}
            />
            {/* Top vignette for brightness balance */}
            <div
              className="absolute inset-x-0 top-0 h-24 pointer-events-none"
              style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, transparent 100%)" }}
            />
            {/* Caption */}
            <div className="absolute inset-x-0 bottom-0 px-8 sm:px-12 pb-8 sm:pb-10">
              <CaptionPanel captionIdx={captionIdx} theme={theme} layout="overlay" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress bar — thin strip at top */}
      <div className="absolute top-0 inset-x-0 h-0.5 z-30 bg-white/10">
        <AnimatePresence>
          <motion.div
            key={idx}
            className="h-full rounded-r-full"
            style={{ background: theme.accent }}
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 5, ease: "linear" }}
          />
        </AnimatePresence>
      </div>

      {/* Dot indicators */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-30">
        {Array.from({ length: Math.min(shuffled.length, 12) }).map((_, i) => {
          const segSize = Math.max(1, Math.floor(shuffled.length / 12));
          const active  = Math.floor(idx / segSize) === i;
          return (
            <motion.div
              key={i}
              animate={{ width: active ? 20 : 5, opacity: active ? 1 : 0.3 }}
              transition={{ duration: 0.3 }}
              className="h-1 rounded-full"
              style={{ background: active ? theme.accent : "rgba(255,255,255,0.6)" }}
            />
          );
        })}
      </div>
    </div>
  );
}

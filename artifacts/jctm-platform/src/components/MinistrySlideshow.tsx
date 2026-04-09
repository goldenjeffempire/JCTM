import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const STORY_CAPTIONS = [
  { headline: "The Truth Shall Set You Free",        verse: "John 8:32",         theme: "Truth" },
  { headline: "Be Holy, For I Am Holy",              verse: "1 Peter 1:16",      theme: "Holiness" },
  { headline: "Salvation Through Christ Alone",      verse: "Acts 4:12",         theme: "Salvation" },
  { headline: "The Bible Is Our Standard",           verse: "JCTM Core Mandate", theme: "Truth" },
  { headline: "Sanctify Them By Your Truth",         verse: "John 17:17",        theme: "Holiness" },
  { headline: "Believe and Be Saved",                verse: "Acts 16:31",        theme: "Salvation" },
  { headline: "Standing on the Old Paths",           verse: "Jeremiah 6:16",     theme: "Truth" },
  { headline: "Without Holiness No Man Shall See God", verse: "Hebrews 12:14",  theme: "Holiness" },
  { headline: "Repentance Toward Life",              verse: "Acts 11:18",        theme: "Salvation" },
  { headline: "Testing the Spirits",                 verse: "1 John 4:1",        theme: "Truth" },
  { headline: "A Chosen and Holy Nation",            verse: "1 Peter 2:9",       theme: "Holiness" },
  { headline: "The Gospel: Power Unto Salvation",    verse: "Romans 1:16",       theme: "Salvation" },
];

const THEME_COLORS: Record<string, string> = {
  Truth:     "from-[#003366]/90 to-[#001a40]/70",
  Holiness:  "from-[#1a0033]/90 to-[#0d001a]/70",
  Salvation: "from-[#001a2e]/90 to-[#000f1a]/70",
};

const THEME_ACCENT: Record<string, string> = {
  Truth:     "#38BDF8",
  Holiness:  "#C084FC",
  Salvation: "#34D399",
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

export function MinistrySlideshow() {
  const [shuffled, setShuffled] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [captionIdx, setCaptionIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setShuffled(shuffleArray(ALL_IMAGE_URLS));
    setCaptionIdx(Math.floor(Math.random() * STORY_CAPTIONS.length));
  }, []);

  useEffect(() => {
    if (paused || shuffled.length === 0) return;
    intervalRef.current = setInterval(() => {
      setIdx(i => {
        const next = (i + 1) % shuffled.length;
        if (next % 3 === 0) {
          setCaptionIdx(c => (c + 1) % STORY_CAPTIONS.length);
        }
        return next;
      });
    }, 4500);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [paused, shuffled]);

  const caption = STORY_CAPTIONS[captionIdx];
  const accentColor = caption ? THEME_ACCENT[caption.theme] : "#38BDF8";
  const gradientClass = caption ? THEME_COLORS[caption.theme] : THEME_COLORS.Truth;
  const currentSrc = shuffled[idx];

  if (shuffled.length === 0 || !currentSrc) return null;

  return (
    <div
      className="relative w-full overflow-hidden rounded-3xl"
      style={{ aspectRatio: "16/9", maxHeight: "560px" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Image crossfade layer */}
      <AnimatePresence mode="sync">
        <motion.div
          key={currentSrc}
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 1.1, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <img
            src={currentSrc}
            alt="JCTM Ministry"
            className="w-full h-full object-cover object-center"
            loading="eager"
            decoding="async"
          />
        </motion.div>
      </AnimatePresence>

      {/* Gradient overlay */}
      <AnimatePresence mode="wait">
        <motion.div
          key={caption?.theme}
          className={`absolute inset-0 bg-gradient-to-t ${gradientClass}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2 }}
        />
      </AnimatePresence>

      {/* Caption */}
      <div className="absolute inset-0 flex flex-col items-center justify-end p-8 sm:p-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={captionIdx}
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="text-center"
          >
            <motion.span
              className="inline-block text-[10px] font-bold uppercase tracking-[0.3em] mb-3 px-4 py-1.5 rounded-full border"
              style={{ color: accentColor, borderColor: `${accentColor}40`, background: `${accentColor}15` }}
            >
              {caption?.theme}
            </motion.span>
            <h2
              className="text-white font-serif font-bold text-2xl sm:text-3xl md:text-4xl leading-tight mb-3 drop-shadow-lg"
              style={{ textShadow: "0 2px 20px rgba(0,0,0,0.6)" }}
            >
              {caption?.headline}
            </h2>
            <p
              className="text-sm font-medium tracking-widest"
              style={{ color: `${accentColor}CC` }}
            >
              — {caption?.verse}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress dots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
        {Array.from({ length: Math.min(shuffled.length, 12) }).map((_, i) => {
          const segSize = Math.floor(shuffled.length / 12);
          const active = Math.floor(idx / segSize) === i;
          return (
            <motion.div
              key={i}
              animate={{ width: active ? 24 : 6, opacity: active ? 1 : 0.35 }}
              transition={{ duration: 0.35 }}
              className="h-1.5 rounded-full"
              style={{ background: active ? accentColor : "rgba(255,255,255,0.5)" }}
            />
          );
        })}
      </div>

      {/* Pause indicator */}
      <AnimatePresence>
        {paused && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-4 right-4 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5 text-white/70 text-[10px] uppercase tracking-widest font-medium"
          >
            Paused
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image counter */}
      <div className="absolute top-4 left-4 bg-black/30 backdrop-blur-sm rounded-full px-3 py-1.5 text-white/50 text-[10px] font-mono">
        {idx + 1} / {shuffled.length}
      </div>
    </div>
  );
}

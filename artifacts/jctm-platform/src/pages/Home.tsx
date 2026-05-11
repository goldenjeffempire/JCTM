import { useEffect, useRef, useState, useCallback, lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  motion, Variants, useScroll, useTransform, useInView,
  AnimatePresence, useMotionValue, useSpring,
} from "framer-motion";
import { format, formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import {
  Calendar, ArrowRight, MapPin, ShieldCheck, Flame, Users,
  Radio, BookOpen, Heart, Sparkles, ChevronRight, Globe,
  Star, Mic2, Play, ExternalLink, Clock, MessageSquare, Quote,
  Youtube, Facebook, Mail, CheckCircle2, ChevronDown,
  Tv, Award, TrendingUp, Zap, Radio as LiveIcon, X, Download, Share2,
  Bot, Send, Bell, ImageIcon, Pen, ChevronLeft, Eye, Camera,
  BookMarked, BrainCircuit, Loader2, CheckCheck, Link2,
} from "lucide-react";
import {
  useGetFeaturedSermon, getGetFeaturedSermonQueryKey,
  useGetUpcomingEvents, getGetUpcomingEventsQueryKey,
  useGetSermonStats, getGetSermonStatsQueryKey,
} from "@workspace/api-client-react";
import { useLivestreamStatus } from "@/hooks/useLivestreamStatus";
import { DualStreamToggle, useStreamQuality, buildYouTubeUrl, NetworkQualityBadge } from "@/components/DualStreamToggle";
import { StreamPlayer } from "@/components/StreamPlayer";
import { YouTubeEmbed } from "@/components/YouTubeEmbed";
import { MutedVideoPlayer } from "@/components/MutedVideoPlayer";
import { Layout } from "@/components/layout/Layout";
import { EventPopupModal } from "@/components/event-promo/EventPopupModal";
import { VideoDownloadButton } from "@/components/VideoDownloadButton";

import { Button } from "@/components/ui/button";
import { ChurchAddressBlock } from "@/components/ChurchAddressBlock";
import DevotionEmailSubscribe from "@/components/DevotionEmailSubscribe";
import DevotionShareDialog from "@/components/DevotionShareDialog";
import { Helmet } from "react-helmet-async";
import { SEO } from "@/components/SEO";
import { useLiveViewerCount } from "@/hooks/useLiveViewerCount";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GlobalAltar } from "@/components/GlobalAltar";
import { GeoServiceTimes } from "@/components/GeoServiceTimes";
import { GeoContentBanner } from "@/components/GeoContentBanner";
import { ADSENSE_SLOTS, AdSlot, useAdPageTracker } from "@/components/ads/AdSense";
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary";
import { toast } from "sonner";

const GlobalAltar3D = lazy(() => import("@/components/GlobalAltar3D").then(m => ({ default: m.GlobalAltar3D })));
const MinistrySlideshow = lazy(() => import("@/components/MinistrySlideshow").then(m => ({ default: m.MinistrySlideshow })));

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const LIVE_STREAM_VIDEO_ID = "mOgPT4UT0qQ";
const WAT_TIME_ZONE = "Africa/Lagos";

const SCRIPTURES = [
  { verse: "\"The Bible Is Our Standard.\"", ref: "JCTM Core Mandate" },
  { verse: "\"Sanctify them by Your truth. Your word is truth.\"", ref: "John 17:17" },
  { verse: "\"Beloved, do not believe every spirit, but test the spirits, whether they are of God.\"", ref: "1 John 4:1" },
  { verse: "\"Stand in the ways and see, and ask for the old paths, where the good way is.\"", ref: "Jeremiah 6:16" },
];

const FALLBACK_TESTIMONIES = [
  { name: "Brother Emmanuel", content: "God used the Correction Mandate to open my eyes to the truth. The preaching of holiness has completely transformed my life.", category: "Transformation" },
  { name: "Sister Grace", content: "I was in a prosperity church for 10 years. Through JCTM teachings, I finally found true apostolic Christianity and peace.", category: "Restoration" },
  { name: "Pastor Daniel", content: "Prophet Amos' teaching on doctrinal correction helped me rebuild my ministry on the solid foundation of scripture alone.", category: "Ministry" },
  { name: "Brother Chukwuma", content: "The revelation of primitive Christianity through JCTM has been the greatest spiritual awakening of my entire life.", category: "Revelation" },
  { name: "Sister Amara", content: "JCTM prayers and prophetic ministry led to my miraculous healing. God is truly working through this ministry.", category: "Healing" },
  { name: "Brother Moses", content: "Temple TV reached me in the diaspora. Finding this ministry was finding my way back to true New Testament Christianity.", category: "Discovery" },
  { name: "Sister Obiageli", content: "I had given up on the church after years of manipulation. JCTM restored my faith in God and in His Word.", category: "Restoration" },
  { name: "Deacon Paul", content: "The clarity of teaching here is unmatched. No emotionalism — just pure, verified, biblical truth. My family is grateful.", category: "Family" },
];

// ─── Animation Variants (Spring Physics) ───────────────────────────────────
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 70, damping: 18 } },
};
const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

// ─── Typewriter Hook ────────────────────────────────────────────────────────
function useTypewriter(words: string[], speed = 70, pauseMs = 2600) {
  const [displayed, setDisplayed] = useState(words[0] ?? "");
  const [wordIdx, setWordIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(words[0]?.length ?? 0);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    const word = words[wordIdx] ?? "";
    let t: ReturnType<typeof setTimeout>;
    if (!deleting && charIdx < word.length) {
      t = setTimeout(() => { setDisplayed(word.slice(0, charIdx + 1)); setCharIdx(c => c + 1); }, speed);
    } else if (!deleting && charIdx === word.length) {
      t = setTimeout(() => setDeleting(true), pauseMs);
    } else if (deleting && charIdx > 0) {
      t = setTimeout(() => { setDisplayed(word.slice(0, charIdx - 1)); setCharIdx(c => c - 1); }, speed / 2.2);
    } else {
      setDeleting(false);
      setWordIdx(i => (i + 1) % words.length);
    }
    return () => clearTimeout(t);
  }, [charIdx, deleting, wordIdx, words, speed, pauseMs]);
  return displayed;
}

// ─── WAT helpers ───────────────────────────────────────────────────────────
type WatParts = {
  year: number;
  month: number;
  day: number;
  weekday: string;
  hour: number;
  minute: number;
  second: number;
};

function getWatParts(now = new Date()): WatParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: WAT_TIME_ZONE,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? "0";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday: get("weekday"),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
  };
}

function getWatDate(now = new Date()) {
  const parts = getWatParts(now);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second));
}

function getSundayServiceWindow(now = new Date()) {
  const wat = getWatParts(now);
  const isSunday = wat.weekday === "Sun";
  const totalMinutes = wat.hour * 60 + wat.minute;
  const isCountdownWindow = isSunday && totalMinutes >= 360 && totalMinutes < 480;
  const serviceStartUtcMs = Date.UTC(wat.year, wat.month - 1, wat.day, 7, 0, 0);
  const diff = Math.max(0, serviceStartUtcMs - now.getTime());
  return { isSunday, isCountdownWindow, diff, wat };
}

function formatCountdown(diff: number) {
  return {
    hours: Math.floor(diff / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

// ─── Live Countdown (to next Sunday 8 AM WAT) ──────────────────────────────
function useNextService() {
  const [cd, setCd] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  useEffect(() => {
    const getNextSundayWat = () => {
      const wat = getWatDate();
      const dow = wat.getDay();
      const daysUntilSun = dow === 0 ? (wat.getHours() >= 8 ? 7 : 0) : 7 - dow;
      const next = new Date(wat);
      next.setDate(wat.getDate() + daysUntilSun);
      next.setHours(8, 0, 0, 0);
      // Convert back to UTC ms for diff calculation
      const nextUtcMs = next.getTime() - 3600000;
      return nextUtcMs;
    };
    const tick = () => {
      const diff = Math.max(0, getNextSundayWat() - Date.now());
      setCd({ days: Math.floor(diff / 86400000), hours: Math.floor((diff % 86400000) / 3600000), minutes: Math.floor((diff % 3600000) / 60000), seconds: Math.floor((diff % 60000) / 1000) });
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return cd;
}

// ─── Magnetic Button ───────────────────────────────────────────────────────
function MagneticButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0); const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 180, damping: 12 });
  const sy = useSpring(y, { stiffness: 180, damping: 12 });
  const onMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    x.set((e.clientX - r.left - r.width / 2) * 0.38);
    y.set((e.clientY - r.top - r.height / 2) * 0.38);
  };
  return <motion.div ref={ref} style={{ x: sx, y: sy }} onMouseMove={onMove} onMouseLeave={() => { x.set(0); y.set(0); }} className={className}>{children}</motion.div>;
}

// ─── Tilt Card ─────────────────────────────────────────────────────────────
function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const rx = useMotionValue(0); const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 200, damping: 18 });
  const sry = useSpring(ry, { stiffness: 200, damping: 18 });
  const onMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    rx.set(-((e.clientY - top) / height - 0.5) * 10);
    ry.set(((e.clientX - left) / width - 0.5) * 10);
  };
  return <motion.div ref={ref} style={{ rotateX: srx, rotateY: sry, transformStyle: "preserve-3d" }} onMouseMove={onMove} onMouseLeave={() => { rx.set(0); ry.set(0); }} className={className}>{children}</motion.div>;
}

// ─── Animated Counter ──────────────────────────────────────────────────────
function AnimatedCounter({ target, suffix = "", duration = 2000 }: { target: number; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let s = 0; const step = Math.ceil(target / (duration / 16));
    const t = setInterval(() => { s = Math.min(s + step, target); setCount(s); if (s >= target) clearInterval(t); }, 16);
    return () => clearInterval(t);
  }, [inView, target, duration]);
  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

// ─── Broadcast Status Notification ─────────────────────────────────────────
function BroadcastStatusNotification({
  isLive,
  isUpcoming,
  liveTitle,
  onJoin,
}: {
  isLive: boolean;
  isUpcoming: boolean;
  liveTitle: string | null;
  onJoin: () => void;
}) {
  const [now, setNow] = useState(() => new Date());
  const [dismissed, setDismissed] = useState(false);
  const prevPhase = useRef<"service-soon" | "live" | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const serviceWindow = getSundayServiceWindow(now);
  const countdown = formatCountdown(serviceWindow.diff);
  const phase: "service-soon" | "live" | null = (() => {
    if (serviceWindow.isCountdownWindow && !isLive) return "service-soon";
    if (isLive) return "live";
    return null;
  })();

  useEffect(() => {
    if (phase === prevPhase.current) return;
    prevPhase.current = phase;
    setDismissed(false);
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [phase]);

  const pad = (n: number) => String(n).padStart(2, "0");
  const openServiceSoon = () => {
    onJoin();
  };

  if (!phase || dismissed) return null;

  return (
    <div className="absolute top-[4.5rem] sm:top-20 md:top-24 right-3 sm:right-4 z-20 pointer-events-auto select-none">
      <AnimatePresence mode="wait">
        {phase === "service-soon" ? (
          <motion.div
            key="service-soon"
            initial={{ opacity: 0, x: 40, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="relative"
          >
            <motion.div
              animate={{ opacity: [0.35, 0.7, 0.35], scale: [1, 1.08, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -inset-4 rounded-[2rem] blur-2xl"
              style={{ background: "radial-gradient(circle, rgba(245,158,11,0.45), rgba(239,68,68,0.2))" }}
            />
            <button
              onClick={openServiceSoon}
              className="relative flex flex-col gap-2 w-[168px] sm:w-[196px] md:w-[224px] rounded-[1.35rem] sm:rounded-[1.6rem] px-3.5 sm:px-4 pt-3.5 sm:pt-4 pb-3 text-left cursor-pointer group"
              style={{
                background: "linear-gradient(145deg, rgba(24,12,0,0.94) 0%, rgba(92,38,0,0.95) 52%, rgba(120,20,20,0.92) 100%)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                border: "1px solid rgba(245,158,11,0.42)",
                boxShadow: "0 0 0 1px rgba(245,158,11,0.18), 0 14px 42px rgba(180,83,9,0.32), inset 0 1px 0 rgba(255,255,255,0.08)",
              }}
              aria-label="Sunday service starts by 8:00 AM WAT"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-75" />
                    <span className="relative inline-flex rounded-full h-full w-full bg-amber-300" />
                  </span>
                  <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.14em] text-amber-300 whitespace-nowrap">
                    Temple TV
                  </span>
                </div>
                <span className="rounded-full bg-white/12 px-2 py-1 text-[9px] font-black text-white tabular-nums border border-white/10">
                  {pad(countdown.hours)}:{pad(countdown.minutes)}:{pad(countdown.seconds)}
                </span>
              </div>
              <div>
                <p className="text-white font-serif font-bold text-xs sm:text-sm leading-snug">
                  Sunday Service Begins Soon
                </p>
                <p className="text-white/55 text-[9px] sm:text-[10px] mt-0.5 font-medium">
                  Join us live at 8:00 AM (WAT)
                </p>
                <p className="text-white/50 text-[9px] sm:text-[10px] mt-1 leading-snug font-medium">
                  Prepare your heart and connect to the presence of God.
                </p>
              </div>
              <div
                className="mt-0.5 flex items-center justify-between rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 transition-all duration-200 group-hover:opacity-90"
                style={{ background: "linear-gradient(90deg, rgba(245,158,11,0.95), rgba(239,68,68,0.82))" }}
              >
                <span className="text-white font-bold text-[10px] sm:text-[11px] uppercase tracking-widest whitespace-nowrap">
                  Prepare to Watch
                </span>
                <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-white" />
              </div>
            </button>
          </motion.div>
        ) : phase === "live" ? (
          <motion.div
            key="live"
            initial={{ opacity: 0, x: 40, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="relative"
          >
            <motion.div
              animate={{ opacity: [0.45, 0.75, 0.45], scale: [1, 1.08, 1] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -inset-4 rounded-[2rem] blur-2xl"
              style={{ background: "radial-gradient(circle, rgba(239,68,68,0.45), rgba(185,28,28,0.25))" }}
            />
            <div
              role="button"
              tabIndex={0}
              onClick={onJoin}
              onKeyDown={e => e.key === "Enter" && onJoin()}
              className="relative flex flex-col gap-1.5 sm:gap-2 w-[152px] sm:w-[178px] md:w-[198px] rounded-[1.25rem] sm:rounded-[1.5rem] px-3 sm:px-4 pt-3.5 sm:pt-4 pb-3 text-left cursor-pointer group"
              style={{
                background: "linear-gradient(145deg, rgba(20,0,0,0.92) 0%, rgba(80,10,10,0.96) 100%)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                border: "1px solid rgba(239,68,68,0.35)",
                boxShadow: "0 0 0 1px rgba(239,68,68,0.18), 0 12px 40px rgba(185,28,28,0.35), inset 0 1px 0 rgba(255,255,255,0.07)",
              }}
            >
              <button
                onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
                className="absolute top-2 right-2 h-5 w-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <X className="h-2.5 w-2.5 text-white/50" />
              </button>
              <div className="flex items-center gap-1.5 pr-5">
                <span className="relative flex h-2 w-2 sm:h-2.5 sm:w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-full w-full bg-red-500" />
                </span>
                <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.15em] text-red-400 whitespace-nowrap">Now Streaming Live</span>
              </div>
              <div className="pr-1">
                <p className="text-white font-serif font-bold text-xs sm:text-sm leading-snug line-clamp-2">
                  {liveTitle ?? "Temple TV"}
                </p>
                <p className="text-white/40 text-[9px] sm:text-[10px] mt-0.5 font-medium truncate">Jesus Christ Temple Ministry</p>
              </div>
              <div
                className="mt-0.5 flex items-center justify-between rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 transition-all duration-200 group-hover:opacity-90"
                style={{ background: "linear-gradient(90deg, rgba(239,68,68,0.9), rgba(220,38,38,0.8))" }}
              >
                <span className="text-white font-bold text-[10px] sm:text-[11px] uppercase tracking-widest whitespace-nowrap">You Are Watching Live</span>
                <motion.div animate={{ x: [0, 3, 0] }} transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}>
                  <ChevronRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-white" />
                </motion.div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

// ─── Scripture Ticker ──────────────────────────────────────────────────────
function ScriptureTicker() {
  const [idx, setIdx] = useState(0);
  useEffect(() => { const t = setInterval(() => setIdx(i => (i + 1) % SCRIPTURES.length), 5000); return () => clearInterval(t); }, []);
  const s = SCRIPTURES[idx];
  return (
    <div className="relative h-14 overflow-hidden flex items-center justify-center">
      <AnimatePresence mode="wait">
        <motion.div key={idx} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.5 }} className="text-center px-4">
          <span className="text-primary/50 text-sm italic">{s.verse}</span>
          <span className="text-accent text-xs ml-2 font-semibold">— {s.ref}</span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ─── Ripple Button ──────────────────────────────────────────────────────────
function RippleButton({ children, className, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) {
  const [ripples, setRipples] = useState<{ x: number; y: number; id: number }[]>([]);
  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const id = Date.now();
    setRipples(prev => [...prev, { x: e.clientX - rect.left, y: e.clientY - rect.top, id }]);
    setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 700);
    onClick?.(e);
  }, [onClick]);
  return (
    <button {...props} onClick={handleClick} className={`relative overflow-hidden ${className ?? ""}`}>
      {ripples.map(r => (
        <span key={r.id} className="ripple-effect" style={{ left: r.x, top: r.y }} />
      ))}
      {children}
    </button>
  );
}

// ─── Cursor Gradient Mesh ────────────────────────────────────────────────────
function CursorMesh() {
  const x = useMotionValue(50);
  const y = useMotionValue(50);
  const sx = useSpring(x, { stiffness: 40, damping: 18 });
  const sy = useSpring(y, { stiffness: 40, damping: 18 });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      x.set((e.clientX / window.innerWidth) * 100);
      y.set((e.clientY / window.innerHeight) * 100);
    };
    window.addEventListener("mousemove", handler, { passive: true });
    return () => window.removeEventListener("mousemove", handler);
  }, [x, y]);

  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-0"
      style={{
        background: `radial-gradient(ellipse 65% 45% at ${sx}% ${sy}%, rgba(56,189,248,0.075) 0%, transparent 72%)`,
      }}
    />
  );
}

// ─── Staggered Word Reveal ───────────────────────────────────────────────────
function KineticHeadline({ lines }: { lines: { text: string; gradient?: boolean }[] }) {
  return (
    <div className="text-6xl sm:text-7xl md:text-8xl lg:text-[5.5rem] font-serif font-bold leading-[1.04] tracking-tight mb-4">
      {lines.map((line, li) => (
        <div key={li} className="overflow-hidden block">
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04, delayChildren: 0.3 + li * 0.18 } } }}
            className="flex flex-wrap justify-center"
          >
            {line.text.split("").map((char, ci) => (
              <motion.span
                key={ci}
                variants={{ hidden: { opacity: 0, y: 60, rotateX: -40 }, show: { opacity: 1, y: 0, rotateX: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } } }}
                className={`inline-block ${char === " " ? "w-[0.3em]" : ""} ${line.gradient ? "text-transparent bg-clip-text bg-gradient-to-r from-[#003366] via-[#38BDF8] to-[#0284C7]" : "text-primary"}`}
                style={{ perspective: 800, transformStyle: "preserve-3d" }}
              >
                {char === " " ? "\u00A0" : char}
              </motion.span>
            ))}
          </motion.div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// REBROADCAST BANNER — Shown for 3.5 days after each live broadcast ends
// ═══════════════════════════════════════════════════════════════════════════
function RebroadcastBanner() {
  const liveStatus = useLivestreamStatus();
  const rb = liveStatus.rebroadcast;
  // Mirror the same shape that the old REST response used
  const data = (rb.available && rb.videoId && !liveStatus.isLive)
    ? { available: rb.available, videoId: rb.videoId, title: rb.title, expiresAt: rb.expiresAt }
    : null;
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem("rebroadcast_dismissed") === "true"; } catch { return false; }
  });
  const [playerOpen, setPlayerOpen] = useState(false);
  const { quality: bannerQuality } = useStreamQuality();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPlayerOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem("rebroadcast_dismissed", "true"); } catch { /* noop */ }
  };

  if (!data?.available || !data.videoId || dismissed) return null;

  const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
  const timeLeft = expiresAt ? formatDistanceToNow(expiresAt, { addSuffix: true }) : null;

  return (
    <>
      {/* ── REBROADCAST PLAYER OVERLAY ── */}
      <AnimatePresence>
        {playerOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center"
            style={{ backdropFilter: "blur(20px)", background: "rgba(0,5,20,0.93)" }}
            onClick={() => setPlayerOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.88, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 240, damping: 26 }}
              className="relative w-full max-w-4xl mx-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="absolute -inset-8 rounded-[3rem] blur-3xl opacity-30" style={{ background: "radial-gradient(circle, rgba(56,189,248,0.6), rgba(0,51,102,0.4))" }} />
              <div className="relative flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
                  <span className="text-white/80 text-sm font-medium tracking-wide">Rebroadcast</span>
                  {data.title && <span className="text-white/50 text-xs hidden sm:inline truncate max-w-[300px]">— {data.title}</span>}
                </div>
                <button onClick={() => setPlayerOpen(false)} className="h-8 w-8 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl aspect-video bg-black">
                <StreamPlayer
                  key={`rb-banner-${data.videoId}-${bannerQuality}`}
                  hlsManifestUrl={liveStatus.stream?.hlsManifestUrl ?? null}
                  dashManifestUrl={liveStatus.stream?.dashManifestUrl ?? null}
                  youtubeVideoId={data.videoId}
                  isLive={false}
                  title={data.title ?? "Rebroadcast"}
                  autoPlay={true}
                  preferredQuality={bannerQuality}
                  className="absolute inset-0 w-full h-full"
                />
              </div>
              <p className="text-center text-white/25 text-[10px] mt-3 uppercase tracking-widest">Click outside or press Esc to close</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── BANNER STRIP ── */}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -48 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -48 }}
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
          className="relative z-40 w-full"
          style={{ background: "linear-gradient(90deg, #003366 0%, #0284C7 50%, #003366 100%)" }}
        >
          {/* Animated shimmer */}
          <div className="absolute inset-0 overflow-hidden">
            <motion.div
              className="absolute inset-0 opacity-20"
              style={{ background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%)" }}
              animate={{ x: ["−100%", "200%"] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "linear", repeatDelay: 4 }}
            />
          </div>

          <div className="relative max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-3 flex-wrap sm:flex-nowrap">
            {/* Icon + label */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="relative flex h-6 w-6 items-center justify-center rounded-full bg-sky-400/20 border border-sky-400/40">
                <Play className="h-3 w-3 text-sky-300 fill-sky-300" />
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-sky-400 animate-ping" />
              </div>
              <span className="text-white font-bold text-xs uppercase tracking-widest whitespace-nowrap">Rebroadcast</span>
            </div>

            {/* Divider */}
            <div className="hidden sm:block h-4 w-px bg-white/20 shrink-0" />

            {/* Title */}
            <p className="text-white/85 text-xs sm:text-sm font-medium truncate flex-1 min-w-0">
              {data.title ?? "Recently Concluded Service — Watch it now"}
            </p>

            {/* Expiry badge */}
            {timeLeft && (
              <span className="text-sky-200/60 text-[10px] font-medium whitespace-nowrap shrink-0 hidden md:inline">
                Expires {timeLeft}
              </span>
            )}

            {/* Watch button */}
            <motion.button
              whileHover={{ scale: 1.05 } as never}
              whileTap={{ scale: 0.96 } as never}
              onClick={() => setPlayerOpen(true)}
              className="shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white text-[#003366] text-xs font-bold shadow-lg hover:shadow-sky-400/30 transition-all"
            >
              <Play className="h-3 w-3 fill-current" />
              Watch Now
            </motion.button>

            {/* Dismiss */}
            <button
              onClick={handleDismiss}
              className="shrink-0 text-white/40 hover:text-white/70 transition-colors p-0.5"
              aria-label="Dismiss rebroadcast banner"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HERO — Cinematic Multi-Image Sanctuary: Immersive Full-Viewport
// ═══════════════════════════════════════════════════════════════════════════
const HERO_IMAGES = [
  { key: "img1", src: "/founder/DSC3371.webp", fallback: "/founder/DSC3371.jpg", label: "Prophetic Word", tag: "Prophet", title: "Prophetic Declaration", sub: "Jesus Christ Temple Ministry — Warri, Nigeria" },
  { key: "img2", src: "/founder/DSC3376.webp", fallback: "/founder/DSC3376.jpg", label: "Apostolic Voice", tag: "Ministry", title: "Apostolic Mandate", sub: "Jesus Christ Temple Ministry — Warri, Nigeria" },
  { key: "img3", src: "/founder/DSC1657.jpg", label: "Worship", tag: "Praise", title: "Corporate Worship", sub: "Jesus Christ Temple Ministry — Warri, Nigeria" },
  { key: "img4", src: "/founder/DSC1671.jpg", label: "Crusade", tag: "Outreach", title: "Crusade & Evangelism", sub: "Jesus Christ Temple Ministry — Warri, Nigeria" },
  { key: "img5", src: "/founder/DSC1743.jpg", label: "Preaching", tag: "Ministry", title: "The Preaching Mandate", sub: "Jesus Christ Temple Ministry — Warri, Nigeria" },
  { key: "img6", src: "/founder/DSC1774.jpg", label: "Prayer", tag: "Intercession", title: "Intercession & Prayer", sub: "Jesus Christ Temple Ministry — Warri, Nigeria" },
  { key: "img7", src: "/founder/DSC5377.jpg", label: "Anointing", tag: "Prophet", title: "The Anointed Voice", sub: "Jesus Christ Temple Ministry — Warri, Nigeria" },
  { key: "img8", src: "/founder/DSC5382.jpg", label: "Proclamation", tag: "Apostolic", title: "Apostolic Proclamation", sub: "Jesus Christ Temple Ministry — Warri, Nigeria" },
  { key: "img9", src: "/founder/DSC6453.jpg", label: "Prophetic Gathering", tag: "Prophetic", title: "Prophetic Gathering", sub: "Jesus Christ Temple Ministry — Warri, Nigeria" },
  { key: "img10", src: "/founder/DSC6455.jpg", label: "The Word", tag: "Apostolic", title: "Declaring the Apostolic Word", sub: "Jesus Christ Temple Ministry — Warri, Nigeria" },
  { key: "img11", src: "/founder/DSC6459.jpg", label: "The Mandate", tag: "Ministry", title: "Walking in the Mandate", sub: "Jesus Christ Temple Ministry — Warri, Nigeria" },
  { key: "img12", src: "/founder/DSC6468.jpg", label: "Triumphant", tag: "Victory", title: "Triumphant in the Spirit", sub: "Jesus Christ Temple Ministry — Warri, Nigeria" },
  { key: "img13", src: "/founder/P1409629.jpg", label: "Congregation", tag: "Gathering", title: "Gathered Under the Word", sub: "Jesus Christ Temple Ministry — Warri, Nigeria" },
];

function HeroSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const yBg = useTransform(scrollYProgress, [0, 1], [0, 60]);
  const yOrbs = useTransform(scrollYProgress, [0, 1], [0, 90]);
  const yLogo = useTransform(scrollYProgress, [0, 1], [0, -25]);
  const yContent = useTransform(scrollYProgress, [0, 1], [0, 130]);
  const yLeft = useTransform(scrollYProgress, [0, 1], [0, -40]);
  const yRight = useTransform(scrollYProgress, [0, 1], [0, 40]);
  const opacity = useTransform(scrollYProgress, [0, 0.75], [1, 0]);
  const bgScale = useTransform(scrollYProgress, [0, 1], [1, 1.08]);
  // Real-time live/rebroadcast state via SSE — updates within seconds of any state change
  const liveStatus = useLivestreamStatus();
  const isLive = liveStatus.isLive;
  const isUpcoming = liveStatus.isUpcoming;
  const liveVideoId = liveStatus.videoId;
  const liveTitle = liveStatus.title;
  const [livePlayerOpen, setLivePlayerOpen] = useState(false);
  const [rebroadcastWidgetOpen, setRebroadcastWidgetOpen] = useState(false);
  const [playerLoading, setPlayerLoading] = useState(true);
  const [playerError, setPlayerError] = useState(false);
  const [playerKey, setPlayerKey] = useState(0);
  const liveIframeRef = useRef<HTMLDivElement>(null);
  const { quality: liveQuality, toggle: toggleLiveQuality } = useStreamQuality();
  const [imgHovered, setImgHovered] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [swipeStartX, setSwipeStartX] = useState<number | null>(null);


  // Rebroadcast widget: derived from SSE hook — same real-time updates as live state
  const rebroadcastForWidget = (liveStatus.rebroadcast.available && liveStatus.rebroadcast.videoId && !isLive && !isUpcoming)
    ? { videoId: liveStatus.rebroadcast.videoId, title: liveStatus.rebroadcast.title }
    : null;
  const liveViewerCount = useLiveViewerCount(livePlayerOpen && isLive, "live");
  const rebroadcastViewerCount = useLiveViewerCount(rebroadcastWidgetOpen && Boolean(rebroadcastForWidget), "rebroadcast");

  const n = HERO_IMAGES.length;
  const leftImages = [0, 1, 2].map(offset => HERO_IMAGES[(activeSlide + offset) % n]);
  const rightImages = [3, 4, 5].map(offset => HERO_IMAGES[(activeSlide + offset) % n]);
  const lightboxImg = HERO_IMAGES.find(i => i.key === lightbox) ?? null;

  const typeword = useTypewriter([
    "The Lost Souls.",
    "Scriptural Purity.",
    "True Worship.",
    "Doctrinal Correction.",
    "Apostolic Truth.",
  ]);

  useEffect(() => {
    if (livePlayerOpen) { setPlayerLoading(true); setPlayerError(false); }
  }, [livePlayerOpen, playerKey]);

  // YouTube Player postMessage — detect stream errors and playing state
  useEffect(() => {
    if (!livePlayerOpen) return;

    const handleMessage = (e: MessageEvent) => {
      if (e.origin !== "https://www.youtube.com") return;
      try {
        const data = JSON.parse(typeof e.data === "string" ? e.data : JSON.stringify(e.data)) as {
          event?: string;
          info?: number;
        };
        if (data.event === "onError") {
          setPlayerError(true);
          setPlayerLoading(false);
        }
        if (data.event === "onStateChange" && data.info === 1) {
          // Playing — clear both loading and error states
          setPlayerError(false);
          setPlayerLoading(false);
        }
      } catch { /* ignore */ }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [livePlayerOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setLightbox(null); setLivePlayerOpen(false); setRebroadcastWidgetOpen(false); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (isPaused || lightbox) return;
    const t = setInterval(() => setActiveSlide(prev => (prev + 1) % HERO_IMAGES.length), 6000);
    return () => clearInterval(t);
  }, [isPaused, lightbox]);

  const goPrev = () => setActiveSlide(prev => (prev - 1 + HERO_IMAGES.length) % HERO_IMAGES.length);
  const goNext = () => setActiveSlide(prev => (prev + 1) % HERO_IMAGES.length);

  const handlePointerDown = (e: React.PointerEvent) => setSwipeStartX(e.clientX);
  const handlePointerUp = (e: React.PointerEvent) => {
    if (swipeStartX === null) return;
    const diff = e.clientX - swipeStartX;
    if (Math.abs(diff) > 60) diff < 0 ? goNext() : goPrev();
    setSwipeStartX(null);
  };

  const metrics = [
    { value: 479, suffix: "+", label: "Sermons", icon: Mic2 },
    { value: 40, suffix: "+", label: "Nations", icon: Globe },
    { value: 13, suffix: "yrs", label: "Ministry", icon: Award },
  ];

  return (
    <section
      ref={ref}
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
      style={{ background: "#FFFFFF" }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <CursorMesh />

      {/* ── LIGHTBOX OVERLAY ── */}
      <AnimatePresence>
        {lightbox && lightboxImg && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center"
            style={{ backdropFilter: "blur(18px)", background: "rgba(0,10,30,0.88)" }}
            onClick={() => setLightbox(null)}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.88, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
              className="relative max-w-lg w-full mx-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="absolute -inset-6 rounded-[3rem] blur-3xl opacity-40" style={{ background: "radial-gradient(circle, rgba(56,189,248,0.5), rgba(0,51,102,0.4))" }} />
              <div className="relative rounded-[2.5rem] overflow-hidden border-2 border-white/20 shadow-2xl">
                <img src={lightboxImg.src} alt={lightboxImg.title} className="w-full object-cover object-center max-h-[70vh]" loading="lazy" decoding="async" onError={(e) => { if ("fallback" in lightboxImg && lightboxImg.fallback) (e.target as HTMLImageElement).src = (lightboxImg as { fallback: string }).fallback; }} />
                <div className="absolute inset-0 bg-gradient-to-t from-[#001830]/90 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-7">
                  <p className="text-accent text-[10px] font-bold uppercase tracking-widest mb-1">Jesus Christ Temple Ministry</p>
                  <h3 className="text-white font-serif font-bold text-2xl leading-tight mb-1">{lightboxImg.title}</h3>
                  <p className="text-white/60 text-sm">{lightboxImg.sub}</p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.12 } as never} whileTap={{ scale: 0.92 } as never}
                onClick={() => setLightbox(null)}
                className="absolute -top-4 -right-4 h-10 w-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-colors shadow-xl"
              >
                ✕
              </motion.button>
              <div className="flex gap-2 justify-center mt-5 flex-wrap">
                {HERO_IMAGES.map(img => (
                  <motion.button key={img.key} onClick={() => setLightbox(img.key)}
                    whileHover={{ scale: 1.06 } as never}
                    className={`relative h-12 w-10 rounded-xl overflow-hidden border-2 transition-all ${lightbox === img.key ? "border-accent shadow-lg shadow-accent/30" : "border-white/20 opacity-60 hover:opacity-90"}`}
                  >
                    <img src={img.src} alt={img.label} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                  </motion.button>
                ))}
              </div>
              <p className="text-center text-white/30 text-[10px] mt-3 uppercase tracking-widest">Click outside or press Esc to close</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── LIVE PLAYER OVERLAY ── */}
      <AnimatePresence>
        {livePlayerOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center"
            style={{ backdropFilter: "blur(20px)", background: "rgba(0,5,20,0.92)" }}
            onClick={() => setLivePlayerOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.88, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 240, damping: 26 }}
              className="relative w-full max-w-4xl mx-4"
              onClick={e => e.stopPropagation()}
            >
              {/* Glow halo */}
              <div className="absolute -inset-8 rounded-[3rem] blur-3xl opacity-30" style={{ background: "radial-gradient(circle, rgba(239,68,68,0.6), rgba(0,51,102,0.4))" }} />

              {/* Header bar */}
              <div className="relative flex items-center justify-between mb-3 px-1 gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="relative flex h-3 w-3 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                  </span>
                  <span className="text-white font-bold text-sm uppercase tracking-widest">Live</span>
                  {liveTitle && (
                    <span className="text-white/50 text-xs hidden sm:inline truncate max-w-[180px]">— {liveTitle}</span>
                  )}
                  {liveViewerCount > 0 && (
                    <span className="hidden sm:flex items-center gap-1 text-white/50 text-xs">
                      <Users className="h-3.5 w-3.5" />
                      <span className="tabular-nums">{liveViewerCount}</span>
                      watching
                    </span>
                  )}
                  <NetworkQualityBadge quality={liveQuality} />
                </div>
                <div className="flex items-center gap-2">
                  <DualStreamToggle
                    quality={liveQuality}
                    onToggle={q => { toggleLiveQuality(q); setPlayerKey(k => k + 1); }}
                    className="[&_span]:text-white/80 [&_button]:text-white/60 [&_button[class*='bg-background']]:bg-white/15 [&_button[class*='bg-background']]:text-white [&_.border-border]:border-white/20 [&_.bg-muted]:bg-white/10"
                  />
                  <button
                    onClick={() => setLivePlayerOpen(false)}
                    className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-colors shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Embedded player */}
              <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black" style={{ paddingBottom: "56.25%" }}>
                {playerLoading && !playerError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 bg-black">
                    <span className="relative flex h-10 w-10">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-40" />
                      <span className="relative inline-flex rounded-full h-10 w-10 bg-red-500/20 border border-red-500/40 items-center justify-center">
                        <Play className="h-4 w-4 text-red-400 fill-red-400" />
                      </span>
                    </span>
                    <p className="text-white/40 text-xs uppercase tracking-widest font-medium">Loading stream…</p>
                  </div>
                )}
                {playerError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 bg-black/95">
                    <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                      <Radio className="h-5 w-5 text-red-400" />
                    </div>
                    <div className="text-center px-6">
                      <p className="text-white/80 text-sm font-semibold">Stream Interrupted</p>
                      <p className="text-white/40 text-xs mt-1">Connection lost or stream unavailable</p>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => { setPlayerError(false); setPlayerLoading(true); setPlayerKey(k => k + 1); }}
                        className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold px-4 py-2 rounded-full transition-colors"
                      >
                        <Play className="h-3.5 w-3.5 fill-white" />
                        Retry Stream
                      </button>
                      <a
                        href={`https://www.youtube.com/watch?v=${liveVideoId ?? LIVE_STREAM_VIDEO_ID}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-4 py-2 rounded-full transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Watch on YouTube
                      </a>
                    </div>
                  </div>
                )}
                <div
                  key={`live-${liveVideoId ?? LIVE_STREAM_VIDEO_ID}-${liveQuality}-${playerKey}`}
                  ref={liveIframeRef}
                  className="absolute inset-0 w-full h-full"
                >
                  <StreamPlayer
                    hlsManifestUrl={liveStatus.stream?.hlsManifestUrl ?? null}
                    dashManifestUrl={liveStatus.stream?.dashManifestUrl ?? null}
                    youtubeVideoId={liveVideoId ?? LIVE_STREAM_VIDEO_ID}
                    isLive={true}
                    title={liveTitle ?? "Temple TV"}
                    autoPlay={true}
                    viewerCount={liveViewerCount}
                    onLoad={() => { if (!playerError) setPlayerLoading(false); }}
                    onError={() => { setPlayerError(true); setPlayerLoading(false); }}
                    className="w-full h-full"
                  />
                </div>
              </div>

              <p className="text-center text-white/25 text-[10px] mt-3 uppercase tracking-widest">Click outside or press Esc to close</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── REBROADCAST WIDGET PLAYER OVERLAY ── */}
      <AnimatePresence>
        {rebroadcastWidgetOpen && rebroadcastForWidget && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[115] flex items-center justify-center"
            style={{ backdropFilter: "blur(20px)", background: "rgba(0,5,20,0.93)" }}
            onClick={() => setRebroadcastWidgetOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.88, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 240, damping: 26 }}
              className="relative w-full max-w-4xl mx-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="absolute -inset-8 rounded-[3rem] blur-3xl opacity-30" style={{ background: "radial-gradient(circle, rgba(56,189,248,0.6), rgba(0,51,102,0.4))" }} />
              <div className="relative flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
                  <span className="text-white/80 text-sm font-medium tracking-wide">Rebroadcast</span>
                  {rebroadcastForWidget.title && (
                    <span className="text-white/50 text-xs hidden sm:inline truncate max-w-[300px]">— {rebroadcastForWidget.title}</span>
                  )}
                  {rebroadcastViewerCount > 0 && (
                    <span className="hidden sm:flex items-center gap-1 text-white/50 text-xs">
                      <Users className="h-3.5 w-3.5" />
                      <span className="tabular-nums">{rebroadcastViewerCount}</span>
                      watching
                    </span>
                  )}
                </div>
                <button onClick={() => setRebroadcastWidgetOpen(false)} className="h-8 w-8 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl aspect-video bg-black">
                <StreamPlayer
                  key={`rb-widget-${rebroadcastForWidget.videoId}-${liveQuality}`}
                  hlsManifestUrl={liveStatus.stream?.hlsManifestUrl ?? null}
                  dashManifestUrl={liveStatus.stream?.dashManifestUrl ?? null}
                  youtubeVideoId={rebroadcastForWidget.videoId}
                  isLive={false}
                  title={rebroadcastForWidget.title ?? "Rebroadcast"}
                  autoPlay={true}
                  preferredQuality={liveQuality}
                  viewerCount={rebroadcastViewerCount}
                  className="absolute inset-0 w-full h-full"
                />
              </div>
              <p className="text-center text-white/25 text-[10px] mt-3 uppercase tracking-widest">Click outside or press Esc to close</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Parallax BG layers */}
      <motion.div style={{ y: yBg, scale: bgScale }} className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-[#F8FBFF] via-[#EDF5FF] to-[#DDEEFF]" />
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(ellipse 80% 55% at 50% 0%, rgba(56,189,248,0.18) 0%, transparent 60%)" }} />
        <div className="absolute inset-0 opacity-[0.018]" style={{ backgroundImage: "linear-gradient(rgba(0,51,102,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,51,102,1) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
      </motion.div>

      {/* Orbs + particles */}
      <motion.div style={{ y: yOrbs }} className="absolute inset-0 pointer-events-none">
        <motion.div animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0.7, 0.4] }} transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }} className="absolute top-1/3 left-1/3 w-[600px] h-[600px] rounded-full" style={{ background: "radial-gradient(circle, rgba(56,189,248,0.13) 0%, transparent 70%)" }} />
        <motion.div animate={{ scale: [1, 1.18, 1], opacity: [0.2, 0.45, 0.2] }} transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }} className="absolute bottom-1/4 right-1/3 w-80 h-80 rounded-full" style={{ background: "radial-gradient(circle, rgba(0,51,102,0.09) 0%, transparent 70%)" }} />
        {[...Array(12)].map((_, i) => (
          <motion.div key={i}
            animate={{ x: [0, (i % 2 ? 1 : -1) * (15 + i * 4), 0], y: [0, (i % 3 ? -1 : 1) * (10 + i * 3), 0], opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 7 + i * 1.2, repeat: Infinity, ease: "easeInOut", delay: i * 0.55 }}
            className="absolute rounded-full"
            style={{ width: 3 + (i % 4) * 2, height: 3 + (i % 4) * 2, background: i % 3 === 0 ? "rgba(56,189,248,0.4)" : i % 3 === 1 ? "rgba(0,51,102,0.2)" : "rgba(255,255,255,0.6)", top: `${8 + i * 7}%`, left: `${4 + i * 8}%` }}
          />
        ))}
      </motion.div>

      {/* ── LEFT: 3 Floating Image Cards (Slideshow) ── */}
      <motion.div
        style={{ y: yLeft }}
        initial={{ opacity: 0, x: -80 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: "spring", stiffness: 42, damping: 18, delay: 0.7 }}
        className="absolute left-2 xl:left-8 top-1/2 -translate-y-1/2 z-10 hidden lg:flex flex-col gap-4"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {leftImages.map((img, i) => (
          <motion.div
            key={i}
            animate={{ y: [0, i % 2 === 0 ? 12 : -12, 0] }}
            transition={{ duration: 7 + i * 1.5, repeat: Infinity, ease: "easeInOut", delay: i * 0.8 }}
            className="cursor-pointer"
            onClick={() => setLightbox(img.key)}
            whileHover={{ scale: 1.06, transition: { duration: 0.3 } } as never}
            whileTap={{ scale: 0.97 } as never}
          >
            <div className="relative" style={{ transform: `rotate(${[-4, -2, -5][i]}deg)`, marginLeft: [0, 16, 4][i] }}>
              <motion.div animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: i * 0.6 }} className="absolute -inset-3 rounded-2xl blur-xl" style={{ background: "linear-gradient(135deg, rgba(0,51,102,0.3), rgba(56,189,248,0.2))" }} />
              <div
                className="relative w-32 h-40 rounded-2xl overflow-hidden shadow-xl border-2 border-white/90"
                style={{ boxShadow: "0 20px 60px rgba(0,51,102,0.2), 0 0 0 1px rgba(56,189,248,0.12)" }}
                onMouseEnter={() => setImgHovered(img.key)}
                onMouseLeave={() => setImgHovered(null)}
              >
                {/* Shimmer skeleton — visible until image paints */}
                <div className="absolute inset-0 overflow-hidden rounded-2xl">
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 animate-pulse" />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)", backgroundSize: "200% 100%", animation: "slideShimmer 1.6s infinite" }} />
                </div>
                <AnimatePresence mode="wait">
                  <motion.img
                    key={img.key}
                    src={img.src}
                    alt={img.label}
                    initial={{ opacity: 0, scale: 1.08 }}
                    animate={{ opacity: 1, scale: imgHovered === img.key ? 1.12 : 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.7, ease: "easeInOut" }}
                    className="w-full h-full object-cover absolute inset-0"
                    loading="eager"
                    decoding="async"
                    fetchPriority={i === 0 ? "high" : "auto"}
                    onError={(e) => { if ("fallback" in img && img.fallback) (e.target as HTMLImageElement).src = (img as { fallback: string }).fallback; }}
                  />
                </AnimatePresence>
                <div className="absolute inset-0 bg-gradient-to-t from-[#001830]/75 via-transparent to-transparent" />
                <motion.div animate={{ opacity: imgHovered === img.key ? 1 : 0 }} transition={{ duration: 0.2 }} className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-white/20 backdrop-blur-sm rounded-full p-2 border border-white/30">
                    <ExternalLink className="h-3 w-3 text-white" />
                  </div>
                </motion.div>
                <div className="absolute bottom-0 left-0 right-0 p-2.5 z-10">
                  <AnimatePresence mode="wait">
                    <motion.div key={img.key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.4 }}>
                      <p className="text-white font-serif font-bold text-xs leading-tight">{img.label}</p>
                      <p className="text-accent text-[9px] font-semibold">{img.tag}</p>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
              {i === 0 && (
                <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }} className="absolute -top-4 -right-4 bg-accent rounded-2xl shadow-xl px-3 py-2 flex items-center gap-1.5" style={{ boxShadow: "0 8px 24px rgba(56,189,248,0.4)" }}>
                  <Mic2 className="h-3 w-3 text-white" />
                  <p className="text-white text-[10px] font-bold whitespace-nowrap">13 yrs Active</p>
                </motion.div>
              )}
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Center content */}
      <motion.div style={{ opacity }} className="container mx-auto px-4 relative z-10 text-center pt-12">
        <div className="max-w-5xl mx-auto">
          {/* Logo */}
          <motion.div style={{ y: yLogo }} className="mb-7 flex justify-center">
            <motion.div initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }} className="relative">
              <motion.div animate={{ scale: [1, 1.16, 1], opacity: [0.25, 0.55, 0.25] }} transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }} className="absolute inset-0 rounded-full blur-2xl scale-150" style={{ background: "rgba(56,189,248,0.32)" }} />
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 30, repeat: Infinity, ease: "linear" }} className="absolute -inset-2 rounded-full opacity-40" style={{ background: "conic-gradient(from 0deg, rgba(56,189,248,0.6), transparent, rgba(0,51,102,0.4), transparent, rgba(56,189,248,0.6))" }} />
              <img src="/jctm-logo-sm.jpeg" alt="JCTM" className="relative h-28 w-28 rounded-full object-cover ring-4 ring-white/80 shadow-2xl" style={{ boxShadow: "0 0 60px rgba(56,189,248,0.3), 0 20px 60px rgba(0,51,102,0.16)" }} decoding="async" />
            </motion.div>
          </motion.div>

          <motion.div style={{ y: yContent }}>
            {/* Identity badge + LIVE */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="flex items-center justify-center gap-3 mb-7 flex-wrap">
              <span
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-[0.16em] text-primary/70 bg-white/75 backdrop-blur-md border border-primary/10 elev-1"
              >
                <Sparkles className="h-3 w-3 text-accent" />
                Jesus Christ Temple Ministry · Warri, Nigeria
              </span>
              <AnimatePresence>
                {(isLive || rebroadcastForWidget) && (
                  <motion.button
                    onClick={() => isLive ? setLivePlayerOpen(true) : setRebroadcastWidgetOpen(true)}
                    initial={{ opacity: 0, scale: 0.8, x: -10 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 0.8 }}
                    className={`inline-flex items-center gap-1.5 ${isLive ? "bg-red-500 hover:bg-red-600 shadow-red-500/30" : "bg-accent hover:bg-accent/90 shadow-accent/30"} text-white px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-[0.16em] shadow-lg transition-colors cursor-pointer`}
                  >
                    <span className="relative flex h-2 w-2">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-white ${isLive ? "opacity-75" : "opacity-60"}`} />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                    </span>
                    {isLive ? "Now Streaming Live" : "Watch Rebroadcast"}
                  </motion.button>
                )}
              </AnimatePresence>
            </motion.div>

            <KineticHeadline lines={[
              { text: "The Land of" },
              { text: "Good News", gradient: true },
            ]} />

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.0 }} className="mb-4 h-9 flex items-center justify-center">
              <span className="text-lg md:text-xl font-light text-primary/65">Restoring </span>
              <span className="text-lg md:text-xl font-semibold text-accent ml-2 min-w-[210px] text-left">
                {typeword}<span className="animate-[blink_1s_step-end_infinite] text-accent">|</span>
              </span>
            </motion.div>

            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1 }} className="text-base md:text-lg text-primary/70 mb-8 max-w-xl mx-auto leading-relaxed">
              Under the prophetic leadership of{" "}
              <span className="text-accent font-semibold">Prophet Amos Evomobor</span>
              {" "}— proclaiming the Good News from Warri to the world.
            </motion.p>

            <ScriptureTicker />

            {/* CTA buttons */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }} className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-6 mb-8">
              <MagneticButton>
                <Link href="/sermons">
                  <RippleButton className="group inline-flex items-center justify-center h-14 px-10 rounded-full text-base font-semibold bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/25 transition-all duration-300 hover:-translate-y-1 min-h-[44px]">
                    <Play className="h-4 w-4 mr-2 group-hover:scale-125 transition-transform fill-white" />
                    Experience the Word
                  </RippleButton>
                </Link>
              </MagneticButton>
              <MagneticButton>
                {(isLive || rebroadcastForWidget) ? (
                  <RippleButton
                    onClick={() => isLive ? setLivePlayerOpen(true) : setRebroadcastWidgetOpen(true)}
                    className={`group inline-flex items-center justify-center h-14 px-10 rounded-full text-base font-semibold text-white shadow-xl transition-all duration-300 hover:-translate-y-1 min-h-[44px] ${isLive ? "bg-red-500 hover:bg-red-600 shadow-red-500/30" : "bg-accent hover:bg-accent/90 shadow-accent/30"}`}
                  >
                    <span className="relative flex h-2.5 w-2.5 mr-2.5 shrink-0">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-white ${isLive ? "opacity-75" : "opacity-60"}`} />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
                    </span>
                    {isLive ? "Live Broadcast in Progress" : "Watch Rebroadcast"}
                  </RippleButton>
                ) : (
                  <RippleButton
                    onClick={() => setLivePlayerOpen(true)}
                    className="group inline-flex items-center justify-center h-14 px-10 rounded-full text-base font-medium text-primary hover:text-primary bg-white/85 hover:bg-white border border-primary/15 hover:border-primary/30 backdrop-blur-md transition-all duration-300 elev-2 hover:elev-3 hover:-translate-y-1 min-h-[44px]"
                  >
                    <Youtube className="h-4 w-4 mr-2 text-red-500" /> Watch Temple TV Here
                  </RippleButton>
                )}
              </MagneticButton>
            </motion.div>

            {/* Metric pills */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4 }} className="flex flex-wrap justify-center gap-3 mb-10">
              {metrics.map((m, i) => (
                <motion.div key={i}
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 3.5 + i * 0.5, repeat: Infinity, ease: "easeInOut", delay: i * 0.4 }}
                  whileHover={{ scale: 1.05, y: -8 } as never}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-2xl cursor-default bg-white/85 backdrop-blur-md border border-primary/10 elev-2 hover:elev-3 transition-shadow"
                >
                  <div className="h-9 w-9 rounded-xl bg-accent/12 flex items-center justify-center shrink-0">
                    <m.icon className="h-4 w-4 text-accent" />
                  </div>
                  <div className="leading-tight">
                    <span className="font-serif font-bold text-primary text-lg block leading-none tabular-nums">
                      <AnimatedCounter target={m.value} suffix={m.suffix} />
                    </span>
                    <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-[0.12em] mt-0.5 block">
                      {m.label}
                    </span>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* ── Ministry Gallery Strip + Slideshow Controls ── */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.6 }} className="flex flex-col items-center gap-3">
              <p className="text-primary/40 text-[10px] uppercase tracking-[0.18em] font-semibold">Ministry Gallery</p>
              <div className="flex items-center justify-center gap-2 flex-wrap">
              {HERO_IMAGES.map((img, i) => {
                const isActive = i === activeSlide;
                return (
                <motion.button
                  key={img.key}
                  onClick={() => setActiveSlide(i)}
                  whileHover={{ scale: 1.06, y: -4 } as never}
                  whileTap={{ scale: 0.95 } as never}
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.7 + i * 0.08 }}
                  className="group relative flex flex-col items-center gap-1.5"
                  aria-label={`Go to slide ${i + 1}: ${img.label}`}
                >
                  <div className={`relative w-14 h-[72px] md:w-16 md:h-20 rounded-2xl overflow-hidden border-2 shadow-lg transition-all duration-300 ${isActive ? "border-accent shadow-accent/30 shadow-xl scale-105" : "border-white/80 group-hover:border-accent/60 group-hover:shadow-accent/20 group-hover:shadow-xl"}`}>
                    <img src={img.src} alt={img.label} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" decoding="async" onError={(e) => { if ("fallback" in img && img.fallback) (e.target as HTMLImageElement).src = (img as { fallback: string }).fallback; }} />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#001830]/70 via-transparent to-transparent" />
                    {isActive && (
                      <motion.div layoutId="activeGalleryIndicator" className="absolute inset-0 border-2 border-accent/50 rounded-2xl" />
                    )}
                    <motion.div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <div className="bg-white/25 backdrop-blur-sm rounded-full p-1.5">
                        <ExternalLink className="h-3 w-3 text-white" />
                      </div>
                    </motion.div>
                  </div>
                  <span className={`text-[9px] font-semibold uppercase tracking-wider transition-colors ${isActive ? "text-accent" : "text-primary/50 group-hover:text-accent"}`}>{img.tag}</span>
                </motion.button>
                );
              })}
              {(isLive || rebroadcastForWidget) ? (
                <motion.button
                  onClick={() => isLive ? setLivePlayerOpen(true) : setRebroadcastWidgetOpen(true)}
                  whileHover={{ scale: 1.06, y: -4 } as never}
                  whileTap={{ scale: 0.95 } as never}
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.2 }}
                  className="group relative flex flex-col items-center gap-1.5"
                >
                  <div className={`relative w-14 h-[72px] md:w-16 md:h-20 rounded-2xl overflow-hidden border-2 shadow-lg flex items-center justify-center transition-all duration-300 group-hover:shadow-xl ${isLive ? "border-red-400/70 shadow-red-400/30 bg-gradient-to-br from-red-500 to-red-700" : "border-accent/70 shadow-accent/30 bg-gradient-to-br from-accent to-sky-700"}`}>
                    <motion.div animate={{ scale: [1, 1.18, 1] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className={`absolute inset-0 rounded-2xl ${isLive ? "bg-red-400/20" : "bg-accent/20"}`} />
                    <Play className="h-5 w-5 text-white relative z-10 fill-white" />
                    <span className="absolute top-1.5 left-1.5 flex h-1.5 w-1.5 z-10">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-white ${isLive ? "opacity-75" : "opacity-60"}`} />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                    </span>
                  </div>
                  <span className={`text-[9px] font-semibold uppercase tracking-wider ${isLive ? "text-red-500" : "text-accent"}`}>{isLive ? "Live Now" : "Rebroadcast"}</span>
                </motion.button>
              ) : (
                <motion.button
                  type="button"
                  onClick={() => setLivePlayerOpen(true)}
                  whileHover={{ scale: 1.06, y: -4 } as never}
                  whileTap={{ scale: 0.95 } as never}
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.2 }}
                  className="group relative flex flex-col items-center gap-1.5"
                  aria-label="Watch Temple TV inside the website"
                >
                  <div className="relative w-14 h-[72px] md:w-16 md:h-20 rounded-2xl overflow-hidden border-2 border-white/80 shadow-lg bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center transition-all duration-300 group-hover:border-red-400/70 group-hover:shadow-red-400/30 group-hover:shadow-xl">
                    <motion.div animate={{ scale: [1, 1.18, 1] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="absolute inset-0 rounded-2xl bg-red-400/20" />
                    <Youtube className="h-6 w-6 text-white relative z-10" />
                  </div>
                  <span className="text-[9px] font-semibold text-primary/50 uppercase tracking-wider group-hover:text-red-500 transition-colors">Temple TV</span>
                </motion.button>
              )}
              </div>

            </motion.div>
          </motion.div>
        </div>
      </motion.div>

      {/* ── RIGHT: 3 Floating Image Cards (Slideshow) ── */}
      <motion.div
        style={{ y: yRight }}
        initial={{ opacity: 0, x: 80 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: "spring", stiffness: 42, damping: 18, delay: 0.9 }}
        className="absolute right-2 xl:right-8 top-1/2 -translate-y-1/2 z-10 hidden lg:flex flex-col gap-4"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {rightImages.map((img, i) => (
          <motion.div
            key={i}
            animate={{ y: [0, i % 2 === 0 ? -12 : 12, 0] }}
            transition={{ duration: 6.5 + i * 1.5, repeat: Infinity, ease: "easeInOut", delay: i * 0.9 }}
            className="cursor-pointer"
            onClick={() => setLightbox(img.key)}
            whileHover={{ scale: 1.06, transition: { duration: 0.3 } } as never}
            whileTap={{ scale: 0.97 } as never}
          >
            <div className="relative" style={{ transform: `rotate(${[4, 2, 5][i]}deg)`, marginRight: [0, 16, 4][i] }}>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 20 + i * 4, repeat: Infinity, ease: "linear" }} className="absolute -inset-2 rounded-2xl opacity-50" style={{ background: "conic-gradient(from 0deg, rgba(56,189,248,0.4), rgba(0,51,102,0.15), rgba(56,189,248,0.4))", filter: "blur(5px)" }} />
              <div
                className="relative w-32 h-40 rounded-2xl overflow-hidden shadow-xl border-2 border-white/90"
                style={{ boxShadow: "0 20px 60px rgba(0,51,102,0.18), 0 0 0 1px rgba(56,189,248,0.12)" }}
                onMouseEnter={() => setImgHovered(img.key)}
                onMouseLeave={() => setImgHovered(null)}
              >
                {/* Shimmer skeleton — visible until image paints */}
                <div className="absolute inset-0 overflow-hidden rounded-2xl">
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 animate-pulse" />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)", backgroundSize: "200% 100%", animation: "slideShimmer 1.6s infinite" }} />
                </div>
                <AnimatePresence mode="wait">
                  <motion.img
                    key={img.key}
                    src={img.src}
                    alt={img.label}
                    initial={{ opacity: 0, scale: 1.08 }}
                    animate={{ opacity: 1, scale: imgHovered === img.key ? 1.12 : 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.7, ease: "easeInOut" }}
                    className="w-full h-full object-cover absolute inset-0"
                    loading="eager"
                    decoding="async"
                    fetchPriority={i === 0 ? "high" : "auto"}
                    onError={(e) => { if ("fallback" in img && img.fallback) (e.target as HTMLImageElement).src = (img as { fallback: string }).fallback; }}
                  />
                </AnimatePresence>
                <div className="absolute inset-0 bg-gradient-to-t from-[#001830]/75 via-transparent to-transparent" />
                <motion.div animate={{ opacity: imgHovered === img.key ? 1 : 0 }} transition={{ duration: 0.2 }} className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-white/20 backdrop-blur-sm rounded-full p-2 border border-white/30">
                    <ExternalLink className="h-3 w-3 text-white" />
                  </div>
                </motion.div>
                <div className="absolute bottom-0 left-0 right-0 p-2.5 z-10">
                  <AnimatePresence mode="wait">
                    <motion.div key={img.key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.4 }}>
                      <p className="text-white font-serif font-bold text-xs leading-tight">{img.label}</p>
                      <p className="text-accent text-[9px] font-semibold">{img.tag}</p>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
              {i === 0 && (
                <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }} className="absolute -bottom-3 -left-4 bg-white rounded-2xl shadow-xl border border-border/60 px-3 py-1.5 flex items-center gap-2" style={{ boxShadow: "0 8px 32px rgba(0,51,102,0.12)" }}>
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <p className="text-primary text-[10px] font-bold whitespace-nowrap">Ministry Active</p>
                </motion.div>
              )}
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* ── BROADCAST STATUS NOTIFICATION ── */}
      <BroadcastStatusNotification
        isLive={isLive}
        isUpcoming={isUpcoming}
        liveTitle={liveTitle}
        onJoin={() => setLivePlayerOpen(true)}
      />

      {/* Scroll indicator */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.0 }} className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2">
        <p className="text-primary/40 text-[10px] uppercase tracking-[0.18em] font-semibold">Scroll to explore</p>
        <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }} className="w-5 h-8 rounded-full border-2 border-primary/20 flex justify-center pt-1.5" style={{ backdropFilter: "blur(8px)", background: "rgba(255,255,255,0.5)" }}>
          <div className="w-1 h-2 rounded-full bg-accent" />
        </motion.div>
      </motion.div>
    </section>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// TODAY STRIP — at-a-glance daily strip (greeting · date · scripture · jumps)
// ═══════════════════════════════════════════════════════════════════════════
function getWatGreeting(hourWat: number) {
  if (hourWat < 12) return "Good morning";
  if (hourWat < 17) return "Good afternoon";
  if (hourWat < 21) return "Good evening";
  return "Peace tonight";
}

function TodayStrip() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const wat = getWatParts(now);
  const greeting = getWatGreeting(wat.hour);
  const dateLabel = new Intl.DateTimeFormat("en-NG", {
    timeZone: WAT_TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);

  const scripture = useLiveDailyVerse();

  // Soften & shorten the scripture for a single-line marquee read
  const shortVerse = scripture.verse.length > 140
    ? scripture.verse.slice(0, 140).replace(/\s+\S*$/, "") + "…"
    : scripture.verse;

  return (
    <section
      aria-labelledby="today-strip-heading"
      className="relative ambient-sky border-y border-border/50"
    >
      <h2 id="today-strip-heading" className="sr-only">
        Your sanctuary today
      </h2>
      <div className="container mx-auto px-4">
        <div className="py-5 md:py-6 grid grid-cols-1 lg:grid-cols-[auto_1fr_auto] gap-5 lg:gap-8 items-center">
          {/* ── Greeting + date ── */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-3 lg:border-r lg:border-border/50 lg:pr-8 min-w-0"
          >
            <span
              aria-hidden
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent shrink-0"
            >
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-primary font-serif font-semibold text-sm sm:text-[15px] leading-tight tracking-tight">
                {greeting}
              </p>
              <p className="text-muted-foreground text-[11px] sm:text-xs mt-0.5 tabular-nums truncate">
                {dateLabel} · WAT
              </p>
            </div>
          </motion.div>

          {/* ── Scripture of the day ── */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-start gap-3 min-w-0"
          >
            <BookOpen className="h-3.5 w-3.5 text-accent mt-1.5 shrink-0 hidden sm:inline-block" aria-hidden />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent mb-1">
                Today's Word
              </p>
              <p className="text-primary/90 font-serif italic text-sm sm:text-[15px] leading-snug text-balance line-clamp-2 lg:line-clamp-1">
                <span aria-hidden className="text-accent/40 mr-0.5">“</span>
                {shortVerse}
                <span aria-hidden className="text-accent/40 ml-0.5">”</span>
                <span className="not-italic font-sans font-semibold text-primary/55 text-[11px] sm:text-xs ml-2 whitespace-nowrap">
                  — {scripture.ref}
                </span>
              </p>
            </div>
          </motion.div>

          {/* ── Quick jumps ── */}
          <motion.nav
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            aria-label="Quick links for today"
            className="flex items-center gap-2 flex-wrap lg:flex-nowrap lg:border-l lg:border-border/50 lg:pl-8"
          >
            <a
              href="#daily-devotion"
              onClick={(e) => {
                e.preventDefault();
                const el = document.getElementById("daily-devotion");
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="group inline-flex items-center gap-2 h-10 px-4 rounded-full bg-primary text-white text-[13px] font-semibold tracking-tight transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/90 elev-1 hover:elev-2"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Devotion</span>
              <ChevronDown className="h-3 w-3 transition-transform group-hover:translate-y-0.5" />
            </a>
            <Link
              href="/prayer"
              className="group inline-flex items-center gap-2 h-10 px-4 rounded-full bg-white text-primary text-[13px] font-semibold tracking-tight border border-border/70 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:bg-accent/5 elev-1 hover:elev-2"
            >
              <Heart className="h-3.5 w-3.5 text-accent transition-transform group-hover:scale-110" />
              <span>Pray</span>
            </Link>
            <Link
              href="/sermons"
              className="group inline-flex items-center gap-2 h-10 px-4 rounded-full bg-white text-primary text-[13px] font-semibold tracking-tight border border-border/70 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:bg-accent/5 elev-1 hover:elev-2"
            >
              <Play className="h-3.5 w-3.5 fill-accent text-accent transition-transform group-hover:scale-110" />
              <span>Watch</span>
            </Link>
          </motion.nav>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PLATFORM BAR — Social proof strip with live counters
// ═══════════════════════════════════════════════════════════════════════════
function PlatformBar() {
  const platforms = [
    { icon: Youtube, label: "Temple TV", sub: "YouTube Channel", color: "#FF0000", href: "https://www.youtube.com/templetvjctm", stat: "2.9M+ Views" },
    { icon: Facebook, label: "JCTM Live", sub: "Facebook Ministry", color: "#1877F2", href: "https://www.facebook.com/templetvjctm", stat: "Live Events" },
    { icon: Tv, label: "Temple TV", sub: "Live Broadcasting", color: "#003366", href: "#", stat: "12+ Weekly" },
    { icon: Globe, label: "40+ Nations", sub: "Global Audience", color: "#38BDF8", href: "#", stat: "International" },
  ];
  return (
    <section className="border-y border-border/50 bg-white/85 backdrop-blur-md">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 md:divide-x divide-border/50">
          {platforms.map((p, i) => (
            <motion.a key={i} href={p.href} target={p.href !== "#" ? "_blank" : undefined} rel="noopener noreferrer"
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.4 }}
              className="group flex items-center gap-3 px-4 sm:px-5 py-3.5 sm:py-4 min-h-[60px] hover:bg-primary/[0.03] focus-visible:bg-primary/[0.04] transition-colors duration-200"
              aria-label={`${p.label} — ${p.sub}`}
            >
              <motion.div
                whileHover={{ scale: 1.08 } as never}
                whileTap={{ scale: 0.96 } as never}
                className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-transform"
                style={{ background: `${p.color}14` }}
              >
                <p.icon className="h-4 w-4" style={{ color: p.color }} />
              </motion.div>
              <div className="min-w-0 flex-1">
                <p className="text-primary font-semibold text-[13px] sm:text-sm leading-tight tracking-tight">{p.label}</p>
                <p className="text-muted-foreground text-[10px] sm:text-[11px] truncate mt-0.5">{p.sub}</p>
              </div>
              <span className="ml-auto text-[10px] font-bold hidden xl:block tabular-nums opacity-80 group-hover:opacity-100 transition-opacity" style={{ color: p.color }}>{p.stat}</span>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BENTO KNOWLEDGE HUB — Elite 5-tile layout
// ═══════════════════════════════════════════════════════════════════════════
const PROPHETIC_WORDS = [
  { verse: "\"Stand in the ways and see, and ask for the old paths, where the good way is; and walk in it.\"", ref: "Jeremiah 6:16" },
  { verse: "\"Sanctify them by Your truth. Your word is truth.\"", ref: "John 17:17" },
  { verse: "\"Contend earnestly for the faith which was once for all delivered to the saints.\"", ref: "Jude 1:3" },
  { verse: "\"Buy the truth, and do not sell it, also wisdom and instruction and understanding.\"", ref: "Proverbs 23:23" },
  { verse: "\"Pursue peace with all people, and holiness, without which no one will see the Lord.\"", ref: "Hebrews 12:14" },
];

function BentoGrid() {
  const { data: sermon, isLoading: sermonLoading } = useGetFeaturedSermon({
    query: { queryKey: getGetFeaturedSermonQueryKey(), refetchInterval: 30_000, staleTime: 15_000 },
  });
  const { data: stats } = useGetSermonStats({ query: { queryKey: getGetSermonStatsQueryKey() } });
  const { data: homeVideos } = useQuery<{ highlightVideoId: string | null; broadcastVideoId: string | null }>({
    queryKey: ["home-videos"],
    queryFn: () => fetch(`${BASE}/api/home-videos`).then(r => r.json()),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const countdown = useNextService();
  const [wordIdx, setWordIdx] = useState(0);
  const [hoveredSermon, setHoveredSermon] = useState(false);
  const featuredYtId = (sermon as { videoId?: string })?.videoId;

  // Custom admin override takes priority over the featured sermon
  const hasCustomHighlight = !!homeVideos?.highlightVideoId;
  const ytId = homeVideos?.highlightVideoId ?? featuredYtId;
  const bentoThumbnailUrl = hasCustomHighlight
    ? `https://i.ytimg.com/vi/${homeVideos!.highlightVideoId}/maxresdefault.jpg`
    : sermon?.thumbnailUrl;

  // "Latest Broadcast" badge: show if this was an actual live stream (broadcastEndedAt set by
  // live-stream detection) OR if the video was published within the last 48 hours.
  const bentoBroadcastEndedAt = (sermon as { broadcastEndedAt?: string | null })?.broadcastEndedAt;
  const bentoPublishedAt = sermon?.publishedAt ? new Date(sermon.publishedAt).getTime() : 0;
  const bentoIsRecentBroadcast = hasCustomHighlight || (
    (!!bentoBroadcastEndedAt && (Date.now() - new Date(bentoBroadcastEndedAt).getTime()) < 8 * 24 * 60 * 60 * 1000) ||
    (bentoPublishedAt > 0 && (Date.now() - bentoPublishedAt) < 48 * 60 * 60 * 1000)
  );

  useEffect(() => {
    const t = setInterval(() => setWordIdx(i => (i + 1) % PROPHETIC_WORDS.length), 6000);
    return () => clearInterval(t);
  }, []);

  const pw = PROPHETIC_WORDS[wordIdx];

  return (
    <section className="home-section ambient-ivory">
      <div className="container mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-10% 0px" }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="section-header start max-w-2xl">
          <span className="inline-flex items-center gap-2 text-accent text-[11px] font-semibold uppercase tracking-[0.18em] mb-3">
            <span className="h-px w-7 bg-accent inline-block" /> Knowledge Hub
          </span>
          <h2 className="heading-lg text-primary mb-2.5">Today's Highlights</h2>
          <p className="lede">Live feeds, scripture, and ministry news — all in one place.</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 auto-rows-auto">
          {/* ── LARGE TILE: Latest from Temple TV ── */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 70, damping: 18 }}
            className="md:col-span-7 md:row-span-2"
          >
            <TiltCard className="h-full">
              <div
                className="rounded-3xl overflow-hidden border border-border bg-primary shadow-xl hover:shadow-2xl transition-all duration-500 group h-full flex flex-col"
                onMouseEnter={() => setHoveredSermon(true)}
                onMouseLeave={() => setHoveredSermon(false)}
              >
                {sermonLoading ? (
                  <><Skeleton className="aspect-video w-full" /><div className="p-5 flex-1"><Skeleton className="h-4 w-3/4 mb-2" /><Skeleton className="h-3 w-1/3" /></div></>
                ) : ytId ? (
                  <>
                    <div className="relative overflow-hidden" style={{ aspectRatio: "16/9" }}>
                      {/* Facade preview — clicking the play button mounts the
                          monetized iframe so YouTube serves pre-roll ads. */}
                      <YouTubeEmbed
                        videoId={ytId}
                        title={hasCustomHighlight ? "Today's Highlight" : (sermon?.title ?? "Today's Highlight")}
                        thumbnailUrl={bentoThumbnailUrl ?? `https://i.ytimg.com/vi/${ytId}/maxresdefault.jpg`}
                        mode="facade"
                        analyticsPage="/"
                        className="rounded-none"
                      />
                    </div>
                    {/* Title strip beneath the embed (shown alongside the
                        facade thumbnail, so users see the context even before
                        clicking play). */}
                    <div className="px-5 pt-3 pb-1 bg-primary">
                      <span className="text-accent text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                        <span className="h-1.5 w-1.5 bg-accent rounded-full animate-pulse" />
                        {bentoIsRecentBroadcast ? "Latest Broadcast" : "Latest from Temple TV"}
                      </span>
                      <h3 className="text-white font-serif font-bold text-lg leading-snug line-clamp-2">
                        {hasCustomHighlight ? "Today's Highlight" : (sermon?.title ?? "Today's Highlight")}
                      </h3>
                      <p className="text-white/50 text-xs mt-1">
                        {!hasCustomHighlight && sermon && (bentoIsRecentBroadcast && bentoBroadcastEndedAt
                          ? `Aired ${formatDistanceToNow(new Date(bentoBroadcastEndedAt), { addSuffix: true })}`
                          : `Published ${formatDistanceToNow(new Date(sermon.publishedAt), { addSuffix: true })}`)}
                      </p>
                    </div>
                    <div className="p-5 flex items-center justify-between bg-primary">
                      <Badge variant="secondary" className={`text-[10px] rounded-full border ${bentoIsRecentBroadcast ? "bg-red-500/20 text-red-300 border-red-500/30" : "bg-white/10 text-white border-white/10"}`}>
                        {bentoIsRecentBroadcast ? (
                          <span className="flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                            Latest Broadcast
                          </span>
                        ) : "Featured Message"}
                      </Badge>
                      <Link href="/sermons">
                        <Button size="sm" className="rounded-full bg-accent hover:bg-accent/90 text-white text-xs h-8 px-4">
                          <Play className="h-3 w-3 mr-1.5 fill-white" />Watch Full
                        </Button>
                      </Link>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center aspect-video text-white/30">
                    <Tv className="h-12 w-12" />
                  </div>
                )}
              </div>
            </TiltCard>
          </motion.div>

          {/* ── SMALL TILE: Today's Prophetic Word ── */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 70, damping: 18, delay: 0.1 }}
            className="md:col-span-5"
          >
            <TiltCard className="h-full">
              <div className="rounded-3xl border border-border bg-gradient-to-br from-[#EEF4FF] via-[#F0F6FF] to-white p-6 shadow-sm hover:shadow-xl transition-all duration-500 h-full flex flex-col relative overflow-hidden min-h-[180px]">
                <div className="absolute top-0 right-0 w-40 h-40 opacity-[0.06]" style={{ background: "radial-gradient(circle, #003366 0%, transparent 70%)" }} />
                <div className="flex items-center gap-2.5 mb-4 relative z-10">
                  <div className="h-8 w-8 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
                    <BookOpen className="h-4 w-4 text-accent" />
                  </div>
                  <p className="text-primary/80 text-[11px] font-semibold uppercase tracking-[0.16em]">Today's Prophetic Word</p>
                </div>
                <div className="flex-1 relative z-10 overflow-hidden">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={wordIdx}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -16 }}
                      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <p className="text-primary/75 text-sm leading-relaxed italic font-serif mb-2 line-clamp-3">
                        {pw.verse}
                      </p>
                      <p className="text-accent font-bold text-xs">{pw.ref}</p>
                    </motion.div>
                  </AnimatePresence>
                </div>
                <div className="flex gap-1 mt-3 relative z-10">
                  {PROPHETIC_WORDS.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setWordIdx(i)}
                      className={`h-1.5 rounded-full transition-all duration-300 ${i === wordIdx ? "w-6 bg-accent" : "w-1.5 bg-primary/15"}`}
                    />
                  ))}
                </div>
              </div>
            </TiltCard>
          </motion.div>

          {/* ── MEDIUM TILE: Our Mandate (Correction Timeline Teaser) ── */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 70, damping: 18, delay: 0.18 }}
            className="md:col-span-3"
          >
            <TiltCard className="h-full">
              <Link href="/correction-timeline">
                <div className="rounded-3xl border border-accent/20 bg-gradient-to-br from-[#003366] to-[#001a40] p-6 shadow-sm hover:shadow-2xl hover:border-accent/40 transition-all duration-500 h-full flex flex-col group cursor-pointer min-h-[160px] relative overflow-hidden">
                  <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 80%, #38BDF8 0%, transparent 60%)" }} />
                  <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(circle, rgba(56,189,248,0.6) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
                  <div className="relative z-10 flex-1 flex flex-col">
                    <div className="h-9 w-9 rounded-xl bg-accent/20 flex items-center justify-center mb-4">
                      <Sparkles className="h-4 w-4 text-accent" />
                    </div>
                    <p className="text-accent text-[10px] font-bold uppercase tracking-widest mb-1.5">Our Mandate</p>
                    <h3 className="text-white font-serif font-bold text-base leading-snug mb-2">The Correction Timeline</h3>
                    <p className="text-white/50 text-xs leading-relaxed flex-1">From divine calling to global broadcast — explore our living history.</p>
                    <div className="flex items-center gap-1 mt-3 text-accent text-xs font-semibold group-hover:gap-2 transition-all">
                      Explore <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>
                </div>
              </Link>
            </TiltCard>
          </motion.div>

          {/* ── SERVICE COUNTDOWN ── */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 70, damping: 18, delay: 0.26 }}
            className="md:col-span-2"
          >
            <div className="rounded-3xl border border-border bg-white p-5 elev-2 hover:elev-3 transition-all duration-300 flex flex-col h-full min-h-[160px]">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-7 w-7 rounded-lg bg-accent/12 flex items-center justify-center shrink-0"><Clock className="h-3.5 w-3.5 text-accent" /></div>
                <p className="text-primary/80 text-[11px] font-semibold uppercase tracking-[0.16em]">Next Service</p>
              </div>
              <div className="grid grid-cols-2 gap-1.5 flex-1">
                {[{ v: countdown.days, l: "D" }, { v: countdown.hours, l: "H" }, { v: countdown.minutes, l: "M" }, { v: countdown.seconds, l: "S" }].map(({ v, l }) => (
                  <div key={l} className="bg-primary/5 rounded-xl p-1.5 text-center">
                    <AnimatePresence mode="wait">
                      <motion.div key={v} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 6, opacity: 0 }} transition={{ duration: 0.18 }} className="text-lg font-serif font-bold text-primary leading-none">
                        {String(v).padStart(2, "0")}
                      </motion.div>
                    </AnimatePresence>
                    <p className="text-[8px] text-muted-foreground uppercase tracking-wider mt-0.5">{l}</p>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-[10px] text-muted-foreground text-center">Sun · 8:00 AM WAT</div>
            </div>
          </motion.div>

          {/* ── IMPACT STATS ── */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 70, damping: 18, delay: 0.32 }}
            className="md:col-span-12"
          >
            <div className="rounded-3xl border border-border bg-gradient-to-r from-[#F9FAFB] via-white to-[#F9FAFB] p-6 elev-2">
              <div className="grid grid-cols-3 md:grid-cols-6 gap-4 divide-x divide-border">
                {[
                  { v: stats?.total ?? 479, s: "+", l: "Sermons", icon: Mic2 },
                  { v: stats?.totalViews ?? 2951335, s: "", l: "YouTube Views", icon: Youtube },
                  { v: 40, s: "+", l: "Nations Reached", icon: Globe },
                  { v: 13, s: "yrs", l: "Ministry", icon: Award },
                  { v: 12, s: "+", l: "Weekly Broadcasts", icon: Tv },
                  { v: 8, s: "+", l: "Ministry Units", icon: Users },
                ].map(({ v, s, l, icon: Icon }, i) => (
                  <div key={i} className="text-center px-4 first:pl-0 last:pr-0">
                    <Icon className="h-4 w-4 text-accent mx-auto mb-2" />
                    <div className="text-xl font-serif font-bold text-primary tabular-nums leading-none"><AnimatedCounter target={v} suffix={s} /></div>
                    <div className="text-[10px] text-muted-foreground leading-tight mt-1.5 font-medium">{l}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTIMONIES MARQUEE — Premium infinite-loop horizontal slider
// ═══════════════════════════════════════════════════════════════════════════
function TestimonyCard({ t, reverse = false }: { t: { name?: string; content?: string; category?: string }; reverse?: boolean }) {
  const initials = (t.name ?? "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const gradient = reverse
    ? "from-primary to-[#0284C7]"
    : "from-accent to-[#003366]";
  return (
    <div className="shrink-0 w-[340px] md:w-[400px] testimony-card bg-white/95 border border-border/60 rounded-3xl p-7 elev-2 hover:elev-4 hover:-translate-y-1 transition-all duration-300 flex flex-col gap-4">
      {/* Large decorative quote */}
      <div className="text-accent/15 font-serif text-7xl leading-none select-none -mb-4">"</div>
      {/* Quote text */}
      <p className="text-primary/80 text-base md:text-lg leading-relaxed font-serif italic line-clamp-4 flex-1">
        {t.content}
      </p>
      {/* Stars */}
      <div className="flex gap-0.5">
        {[...Array(5)].map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />)}
      </div>
      {/* Author */}
      <div className="flex items-center gap-3 pt-3 border-t border-border/40">
        <div className={`h-11 w-11 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0 text-white font-bold text-sm elev-2`}>
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-primary font-semibold text-sm leading-tight truncate">{t.name}</p>
          <Badge variant="secondary" className="text-[10px] rounded-full mt-1 bg-accent/10 text-accent border-accent/20 font-semibold">{t.category}</Badge>
        </div>
      </div>
    </div>
  );
}

function TestimoniesMarquee() {
  const [testimonies, setTestimonies] = useState(FALLBACK_TESTIMONIES);
  useEffect(() => {
    fetch(`${BASE}/api/testimonies?limit=16`)
      .then(r => r.json())
      .then((d: typeof FALLBACK_TESTIMONIES) => { if (d?.length >= 4) setTestimonies(d); })
      .catch(() => {});
  }, []);

  const row1 = [...testimonies, ...testimonies];
  const row2 = [...testimonies.slice().reverse(), ...testimonies.slice().reverse()];

  return (
    <section className="home-section bg-gradient-to-b from-[#F0F6FF]/70 via-white to-[#F0F6FF]/50 overflow-hidden">
      <div className="container mx-auto px-4 mb-14">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 70 }}
          className="text-center"
        >
          <span className="inline-flex items-center justify-center gap-2 text-accent text-[11px] font-semibold uppercase tracking-[0.18em] mb-4">
            <span className="h-px w-8 bg-accent inline-block" /> Testimony Vault <span className="h-px w-8 bg-accent inline-block" />
          </span>
          <h2 className="heading-xl text-primary mb-4">God Is Faithful</h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto leading-relaxed">
            Real stories of transformation, healing, and revelation from our global community.
          </p>
        </motion.div>
      </div>

      {/* Row 1 — left to right, pause on hover */}
      <div className="pause-on-hover overflow-hidden mb-5">
        <div className="flex gap-5 animate-marquee shrink-0">
          {row1.map((t, i) => <TestimonyCard key={i} t={t} />)}
        </div>
      </div>

      {/* Row 2 — right to left, pause on hover */}
      <div className="pause-on-hover overflow-hidden">
        <div className="flex gap-5 animate-marquee-reverse shrink-0">
          {row2.map((t, i) => <TestimonyCard key={i} t={t} reverse />)}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ type: "spring", stiffness: 70, delay: 0.2 }}
        className="text-center mt-14"
      >
        <MagneticButton>
          <Link href="/testimonies">
            <RippleButton className="group inline-flex items-center justify-center h-14 px-10 rounded-full text-base font-semibold bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20 transition-all duration-300 hover:-translate-y-0.5 min-h-[44px]">
              View All Testimonies <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </RippleButton>
          </Link>
        </MagneticButton>
      </motion.div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PROPHET SECTION — Cinematic dual-photo editorial layout with interactive gallery
// ═══════════════════════════════════════════════════════════════════════════
const FOUNDER_PHOTOS = [
  { key: "photo1", src: "/founder/DSC3371.webp", fallback: "/founder/DSC3371.jpg", label: "Portrait" },
  { key: "photo2", src: "/founder/DSC3376.webp", fallback: "/founder/DSC3376.jpg", label: "Preaching" },
  { key: "photo3", src: "/founder/DSC1657.jpg", label: "Worship" },
  { key: "photo4", src: "/founder/DSC1671.jpg", label: "Crusade" },
  { key: "photo5", src: "/founder/DSC1743.jpg", label: "Ministry" },
  { key: "photo6", src: "/founder/DSC1774.jpg", label: "Prayer" },
  { key: "photo7", src: "/founder/DSC5377.jpg", label: "Anointing" },
  { key: "photo8", src: "/founder/DSC5382.jpg", label: "Proclamation" },
  { key: "photo9", src: "/founder/DSC6453.jpg", label: "Conference" },
  { key: "photo10", src: "/founder/DSC6455.jpg", label: "The Word" },
  { key: "photo11", src: "/founder/DSC6459.jpg", label: "The Mandate" },
  { key: "photo12", src: "/founder/DSC6468.jpg", label: "Triumphant" },
  { key: "photo13", src: "/founder/P1409629.jpg", label: "Gathered" },
];

function ProphetSection() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const yImg = useTransform(scrollYProgress, [0, 1], [-30, 30]);

  const [activeIdx, setActiveIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const filmstripRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  // Auto-advance: runs every 3 s, fully independent of renders
  useEffect(() => {
    if (isPaused) return;
    const id = setInterval(() => {
      setActiveIdx(i => (i + 1) % FOUNDER_PHOTOS.length);
    }, 3000);
    return () => clearInterval(id);
  }, [isPaused]);

  // Auto-scroll filmstrip to keep active thumb centred
  useEffect(() => {
    const strip = filmstripRef.current;
    if (!strip) return;
    const thumb = strip.children[activeIdx] as HTMLElement | undefined;
    if (!thumb) return;
    const stripRect  = strip.getBoundingClientRect();
    const thumbRect  = thumb.getBoundingClientRect();
    const offset     = thumbRect.left - stripRect.left - (stripRect.width - thumbRect.width) / 2;
    strip.scrollBy({ left: offset, behavior: "smooth" });
  }, [activeIdx]);

  const activePhoto = FOUNDER_PHOTOS[activeIdx]!;

  const handleThumbClick = (idx: number) => {
    setActiveIdx(idx);
    setIsPaused(true);
    // Resume auto-play after 6 s of manual control
    setTimeout(() => setIsPaused(false), 6000);
  };

  const handlePrev = () => { setActiveIdx(i => (i - 1 + FOUNDER_PHOTOS.length) % FOUNDER_PHOTOS.length); setIsPaused(true); setTimeout(() => setIsPaused(false), 6000); };
  const handleNext = () => { setActiveIdx(i => (i + 1) % FOUNDER_PHOTOS.length); setIsPaused(true); setTimeout(() => setIsPaused(false), 6000); };

  const credentials = [
    { icon: Award, label: "13+ Years in Ministry", color: "from-amber-400 to-orange-500" },
    { icon: Mic2, label: "Verified Prophetic Office", color: "from-accent to-[#0284C7]" },
    { icon: BookOpen, label: "Apostolic Teacher", color: "from-emerald-400 to-teal-600" },
    { icon: Globe, label: "International Broadcaster", color: "from-primary to-[#003d80]" },
  ];

  return (
    <section ref={ref} className="py-0 bg-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: "radial-gradient(circle at 70% 50%, #003366 0%, transparent 55%)" }} />

      <div className="grid lg:grid-cols-2 min-h-[720px]">
        {/* ── LEFT: Interactive Dual-Photo Frame ── */}
        <motion.div
          initial={{ opacity: 0, x: -60 }}
          animate={inView ? { opacity: 1, x: 0 } : {}}
          transition={{ type: "spring", stiffness: 55, damping: 20 }}
          className="relative overflow-hidden min-h-[480px] lg:min-h-full"
          onTouchStart={(e) => { touchStartX.current = e.touches[0]!.clientX; }}
          onTouchEnd={(e) => {
            if (touchStartX.current === null) return;
            const delta = e.changedTouches[0]!.clientX - touchStartX.current;
            touchStartX.current = null;
            if (Math.abs(delta) < 40) return;
            if (delta < 0) handleNext(); else handlePrev();
          }}
        >
          {/* Background base photo */}
          <motion.div style={{ y: yImg }} className="absolute inset-0 scale-110">
            <AnimatePresence mode="wait">
              <motion.img
                key={activePhoto.key}
                src={activePhoto.src}
                alt="Prophet Amos Evomobor"
                className="w-full h-full object-cover object-top absolute inset-0"
                initial={{ opacity: 0, scale: 1.08 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                loading="lazy" decoding="async"
                fetchPriority="low"
                onError={(e) => { if ("fallback" in activePhoto && activePhoto.fallback) (e.target as HTMLImageElement).src = (activePhoto as { fallback: string }).fallback; }}
              />
            </AnimatePresence>
          </motion.div>

          {/* Overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#001830]/90 via-[#001830]/25 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#001830]/20 via-transparent to-transparent" />

          {/* ── Horizontal filmstrip tray ── */}
          <motion.div
            className="absolute bottom-[88px] left-0 right-0 z-20 px-4"
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.55 }}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            {/* Frosted tray */}
            <div className="flex items-center gap-2 bg-[#001830]/70 backdrop-blur-xl rounded-2xl px-3 py-2.5 border border-white/10 shadow-2xl">

              {/* Prev arrow */}
              <button
                onClick={handlePrev}
                className="shrink-0 w-7 h-7 rounded-full bg-white/10 hover:bg-white/25 border border-white/20 flex items-center justify-center transition-all duration-200 active:scale-90"
                aria-label="Previous photo"
              >
                <ChevronLeft className="h-3.5 w-3.5 text-white" />
              </button>

              {/* Scrollable thumbnail row */}
              <div
                ref={filmstripRef}
                className="flex gap-2 overflow-x-auto scroll-smooth"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {FOUNDER_PHOTOS.map((photo, i) => (
                  <button
                    key={photo.key}
                    onClick={() => handleThumbClick(i)}
                    className={`relative shrink-0 rounded-xl overflow-hidden border-2 transition-all duration-300 shadow-lg
                      ${activeIdx === i
                        ? "w-[52px] h-[66px] border-accent shadow-accent/40 scale-105"
                        : "w-[44px] h-[56px] border-white/20 hover:border-white/55 opacity-70 hover:opacity-100"
                      }`}
                    style={{ transition: "width 0.3s, height 0.3s, opacity 0.3s, border-color 0.3s, transform 0.3s" }}
                  >
                    <img
                      src={photo.src}
                      alt={photo.label}
                      className="w-full h-full object-cover object-top"
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        if ("fallback" in photo && photo.fallback)
                          (e.target as HTMLImageElement).src = (photo as { fallback: string }).fallback;
                      }}
                    />
                    {activeIdx === i && (
                      <div className="absolute inset-0 ring-2 ring-inset ring-accent/60 rounded-xl pointer-events-none" />
                    )}
                    {activeIdx === i && (
                      <div className="absolute top-1 right-1 h-1.5 w-1.5 bg-accent rounded-full animate-pulse shadow-sm shadow-accent" />
                    )}
                  </button>
                ))}
              </div>

              {/* Next arrow */}
              <button
                onClick={handleNext}
                className="shrink-0 w-7 h-7 rounded-full bg-white/10 hover:bg-white/25 border border-white/20 flex items-center justify-center transition-all duration-200 active:scale-90"
                aria-label="Next photo"
              >
                <ChevronRight className="h-3.5 w-3.5 text-white" />
              </button>

            </div>
          </motion.div>

          {/* Floating credentials badges */}
          <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} className="absolute top-6 left-6 z-10">
            <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 p-3 flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-accent to-[#0284C7] flex items-center justify-center shrink-0">
                <Zap className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-primary text-xs font-bold leading-tight">Prophetic Office</p>
                <p className="text-muted-foreground text-[10px]">Verified · JCTM</p>
              </div>
            </div>
          </motion.div>

          <motion.div animate={{ y: [0, 10, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1.5 }} className="absolute top-24 left-6 z-10">
            <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-border/50 px-4 py-2.5 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <div>
                <p className="text-primary text-xs font-bold">13+ Years</p>
                <p className="text-muted-foreground text-[10px]">Faithful Ministry</p>
              </div>
            </div>
          </motion.div>

          {/* Bottom label */}
          <div className="absolute bottom-0 left-0 right-0 p-8 z-10">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.4 }}>
              <p className="text-accent text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                <span className="h-px w-5 bg-accent inline-block" />The Prophetic Voice
              </p>
              <h3 className="text-white font-serif font-bold text-3xl md:text-4xl leading-tight mb-1">
                Prophet Amos<br />Evomobor
              </h3>
              <p className="text-white/60 text-sm">Senior Prophet, JCTM · Warri, Nigeria</p>

            </motion.div>
          </div>
        </motion.div>

        {/* ── RIGHT: Bio & Credentials ── */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate={inView ? "show" : "hidden"}
          className="flex flex-col justify-center px-8 md:px-12 lg:px-16 py-20"
        >
          <motion.div variants={fadeUp}>
            <span className="inline-flex items-center gap-2 text-accent text-xs font-bold uppercase tracking-widest mb-6">
              <span className="h-px w-8 bg-accent inline-block" /> Meet the Founder
            </span>
          </motion.div>

          <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-primary mb-6 leading-tight">
            A Voice Crying in the{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-[#0284C7]">Wilderness</span>
          </motion.h2>

          <motion.p variants={fadeUp} className="text-muted-foreground leading-relaxed mb-4 text-base">
            Prophet Amos Evomobor received a sovereign divine mandate to correct the church from within — not through rebellion, but through the clear light of scripture. He established the Jesus Christ Temple Ministry in Warri, Nigeria as the base for this global corrective mission.
          </motion.p>

          <motion.p variants={fadeUp} className="text-muted-foreground leading-relaxed mb-8 text-base">
            His ministry is marked by expository preaching, the manifestation of signs, and an uncompromising stand against false doctrines — particularly the prosperity gospel, prophetic manipulation, and spiritual exploitation that pervades modern Christianity.
          </motion.p>

          {/* Pull quote */}
          <motion.div variants={fadeUp} className="relative mb-8 pl-5 border-l-2 border-accent/40 bg-gradient-to-r from-accent/5 to-transparent rounded-r-2xl py-4 pr-4">
            <Quote className="h-5 w-5 text-accent/40 mb-2" />
            <p className="text-primary/80 font-serif italic text-lg leading-relaxed">
              "God has sent me not to start a new church, but to call His people back to what was already established — the New Testament standard."
            </p>
            <p className="text-accent font-bold text-xs mt-3 uppercase tracking-wider">— Prophet Amos Evomobor</p>
          </motion.div>

          {/* Credentials grid */}
          <motion.div variants={stagger} className="grid grid-cols-2 gap-3 mb-10">
            {credentials.map(({ icon: Icon, label, color }, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-border hover:border-accent/20 hover:shadow-lg transition-all duration-300 group"
              >
                <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shrink-0 shadow-sm group-hover:scale-110 transition-transform`}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <span className="text-primary text-sm font-medium leading-tight">{label}</span>
              </motion.div>
            ))}
          </motion.div>

          <motion.div variants={fadeUp} className="flex flex-wrap gap-3">
            <MagneticButton>
              <Link href="/about">
                <RippleButton className="group inline-flex items-center justify-center h-12 px-8 rounded-full text-sm font-semibold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 transition-all duration-300 hover:-translate-y-0.5 min-h-[44px]">
                  Learn About the Ministry <ChevronRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </RippleButton>
              </Link>
            </MagneticButton>
            <MagneticButton>
              <Link href="/sermons">
                <RippleButton className="group inline-flex items-center justify-center h-12 px-8 rounded-full text-sm font-semibold bg-white border border-primary/15 text-primary hover:bg-primary/5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 min-h-[44px]">
                  <Youtube className="h-4 w-4 mr-2 text-red-500" /> Watch Sermons
                </RippleButton>
              </Link>
            </MagneticButton>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MANDATE REVEAL — Scroll-Linked Text Animation
// ═══════════════════════════════════════════════════════════════════════════
function MandateReveal() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const x1 = useTransform(scrollYProgress, [0.05, 0.4], [-80, 0]);
  const x2 = useTransform(scrollYProgress, [0.2, 0.55], [80, 0]);
  const x3 = useTransform(scrollYProgress, [0.35, 0.7], [-80, 0]);
  const op1 = useTransform(scrollYProgress, [0.05, 0.35, 0.75, 0.95], [0, 1, 1, 0]);
  const op2 = useTransform(scrollYProgress, [0.2, 0.5, 0.75, 0.95], [0, 1, 1, 0]);
  const op3 = useTransform(scrollYProgress, [0.35, 0.65, 0.75, 0.95], [0, 1, 1, 0]);
  const bgScale = useTransform(scrollYProgress, [0, 1], [1.06, 1.0]);

  const OVERSEER_PHOTOS = [
    { src: "/founder/DSC6468.jpg", label: "Triumphant in the Spirit" },
    { src: "/founder/DSC6459.jpg", label: "Walking in the Mandate" },
    { src: "/founder/P1409629.jpg", label: "Gathered Under the Word" },
  ];

  return (
    <section ref={ref} className="relative py-40 overflow-hidden" style={{ background: "#020b18" }}>
      {/* ── Cinematic photo backdrop ── */}
      <motion.div style={{ scale: bgScale }} className="absolute inset-0">
        {/* Split-panel photo mosaic */}
        <div className="absolute inset-0 flex">
          {OVERSEER_PHOTOS.map((photo, i) => (
            <div key={i} className="relative flex-1 overflow-hidden">
              <img
                src={photo.src}
                alt={photo.label}
                className="absolute inset-0 w-full h-full object-cover object-top"
                style={{ filter: "grayscale(40%) contrast(1.1)" }}
                loading="lazy"
                decoding="async"
              />
              {/* Deep ink wash per panel */}
              <div
                className="absolute inset-0"
                style={{
                  background: i === 1
                    ? "linear-gradient(180deg, rgba(2,11,24,0.55) 0%, rgba(2,11,24,0.72) 100%)"
                    : "linear-gradient(180deg, rgba(2,11,24,0.72) 0%, rgba(2,11,24,0.85) 100%)",
                }}
              />
            </div>
          ))}
        </div>
        {/* Full-width overlay to unify the mosaic */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#020b18]/60 via-transparent to-[#020b18]/70" />
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, rgba(56,189,248,0.08) 0%, transparent 60%), radial-gradient(circle at 80% 50%, rgba(0,51,102,0.15) 0%, transparent 60%)" }} />
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "radial-gradient(circle, rgba(56,189,248,0.4) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
      </motion.div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto space-y-10 text-center">
          <motion.div style={{ x: x1, opacity: op1 }}>
            <p className="text-accent text-xs font-bold uppercase tracking-widest mb-3">The Foundation</p>
            <h2 className="text-5xl md:text-7xl font-serif font-bold text-white leading-tight">The Bible Is<br />Our Standard.</h2>
          </motion.div>
          <motion.div style={{ x: x2, opacity: op2 }}>
            <div className="h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent max-w-xs mx-auto" />
          </motion.div>
          <motion.div style={{ x: x3, opacity: op3 }}>
            <h3 className="text-3xl md:text-5xl font-serif font-bold text-white/90 leading-tight">
              Restoring{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#38BDF8] to-[#7DD3FC]">Primitive Christianity</span>
            </h3>
            <p className="text-white/50 text-lg mt-4 max-w-2xl mx-auto leading-relaxed">
              Not tradition. Not sentiment. Not denominational preference. Only the apostolic pattern of the New Testament church.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SERMON SPOTLIGHT
// ═══════════════════════════════════════════════════════════════════════════
function SermonSpotlight() {
  const { data: sermon, isLoading } = useGetFeaturedSermon({
    query: { queryKey: getGetFeaturedSermonQueryKey(), refetchInterval: 30_000, staleTime: 15_000 },
  });
  const { data: stats } = useGetSermonStats({ query: { queryKey: getGetSermonStatsQueryKey() } });
  const { data: homeVideos } = useQuery<{ highlightVideoId: string | null; broadcastVideoId: string | null }>({
    queryKey: ["home-videos"],
    queryFn: () => fetch(`${BASE}/api/home-videos`).then(r => r.json()),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const [playing, setPlaying] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const featuredYtId = (sermon as { videoId?: string })?.videoId;

  // Custom admin override takes priority over the featured sermon for Latest Broadcast
  const hasCustomBroadcast = !!homeVideos?.broadcastVideoId;
  const ytId = homeVideos?.broadcastVideoId ?? featuredYtId;
  const spotThumbnailUrl = hasCustomBroadcast
    ? `https://i.ytimg.com/vi/${homeVideos!.broadcastVideoId}/maxresdefault.jpg`
    : sermon?.thumbnailUrl;

  // "Latest Broadcast" badge: show if admin pinned a custom broadcast video, or if this was an
  // actual live stream, or if the video was published within the last 48 hours.
  const broadcastEndedAt = (sermon as { broadcastEndedAt?: string | null })?.broadcastEndedAt;
  const spotPublishedAt = sermon?.publishedAt ? new Date(sermon.publishedAt).getTime() : 0;
  const isRecentBroadcast = hasCustomBroadcast || (
    (!!broadcastEndedAt && (Date.now() - new Date(broadcastEndedAt).getTime()) < 8 * 24 * 60 * 60 * 1000) ||
    (spotPublishedAt > 0 && (Date.now() - spotPublishedAt) < 48 * 60 * 60 * 1000)
  );
  const broadcastAgo = broadcastEndedAt ? formatDistanceToNow(new Date(broadcastEndedAt), { addSuffix: true }) : null;

  return (
    <section ref={ref} className="home-section bg-white">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div variants={stagger} initial="hidden" animate={inView ? "show" : "hidden"}>
            <motion.div variants={fadeUp}>
              <span className="inline-flex items-center gap-2 text-accent text-xs font-bold uppercase tracking-widest mb-5">
                <span className="h-px w-8 bg-accent inline-block" />
                {isRecentBroadcast ? "Latest Broadcast" : "Featured Message"}
                {isRecentBroadcast && broadcastAgo && (
                  <span className="ml-1 text-white/50 normal-case font-normal tracking-normal">— aired {broadcastAgo}</span>
                )}
              </span>
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-serif font-bold text-primary mb-6 leading-tight">
              Restoring the Path of{" "}<span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-[#0284C7]">True Worship</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-muted-foreground mb-8 leading-relaxed">
              The Correction Mandate is a divine instruction to lead a return to primitive Christianity — undiluted truth, spiritual discipline, and the manifestation of God's power.
            </motion.p>
            <motion.div variants={stagger} className="grid sm:grid-cols-2 gap-4 mb-10">
              {[
                { icon: ShieldCheck, label: "Scriptural Purity", desc: "Strict adherence to the apostolic foundation" },
                { icon: Flame, label: "Holiness Doctrine", desc: "Proclaiming holiness without compromise" },
                { icon: Users, label: "Community", desc: "A family bound by the love of Christ" },
                { icon: Globe, label: "Global Reach", desc: "Temple TV broadcasting to 40+ nations" },
              ].map(({ icon: Icon, label, desc }, i) => (
                <TiltCard key={i}>
                  <motion.div variants={fadeUp} className="flex gap-3 p-4 rounded-2xl border border-border hover:border-accent/30 hover:shadow-md transition-all duration-200 bg-white">
                    <div className="h-9 w-9 shrink-0 rounded-xl bg-primary/5 flex items-center justify-center"><Icon className="h-5 w-5 text-primary" /></div>
                    <div><h4 className="font-bold text-primary text-sm">{label}</h4><p className="text-xs text-muted-foreground mt-0.5">{desc}</p></div>
                  </motion.div>
                </TiltCard>
              ))}
            </motion.div>
            <motion.div variants={fadeUp}>
              <MagneticButton>
                <Link href="/sermons">
                  <Button className="group rounded-full px-8 h-12 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5">
                    Browse All {stats?.total ?? "All"} Sermons <ChevronRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </MagneticButton>
            </motion.div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 40 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}>
            {isLoading ? (
              <div className="rounded-3xl overflow-hidden shadow-2xl"><Skeleton className="aspect-video w-full" /><div className="p-6 bg-primary"><Skeleton className="h-3 w-24 bg-white/10 mb-3" /><Skeleton className="h-6 w-full bg-white/10 mb-2" /><Skeleton className="h-6 w-3/4 bg-white/10 mb-4" /><div className="flex gap-3"><Skeleton className="h-10 flex-1 bg-white/10 rounded-xl" /><Skeleton className="h-10 w-20 bg-white/10 rounded-xl" /></div></div></div>
            ) : (sermon || hasCustomBroadcast) && ytId ? (
              <TiltCard>
                <div className="relative group">
                  <div className="absolute -inset-4 bg-gradient-to-r from-accent/15 to-primary/15 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative rounded-3xl overflow-hidden shadow-2xl bg-primary">
                    {playing && ytId ? (
                      <YouTubeEmbed
                        videoId={ytId}
                        title={hasCustomBroadcast ? "Latest Broadcast" : (sermon?.title ?? "Latest Broadcast")}
                        thumbnailUrl={spotThumbnailUrl ?? `https://i.ytimg.com/vi/${ytId}/maxresdefault.jpg`}
                        mode="eager"
                        analyticsPage="/"
                      />
                    ) : (
                      <>
                        <div className="aspect-video relative overflow-hidden">
                          <img src={spotThumbnailUrl ?? `https://i.ytimg.com/vi/${ytId}/maxresdefault.jpg`} alt={hasCustomBroadcast ? "Latest Broadcast" : (sermon?.title ?? "Latest Broadcast")} className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700" loading="lazy" decoding="async" onError={(e) => { (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`; }} />
                          <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/20 to-transparent" />
                          {isRecentBroadcast && (
                            <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                              </span>
                              LATEST BROADCAST
                            </div>
                          )}
                          <button onClick={() => setPlaying(true)} className="absolute inset-0 flex items-center justify-center" aria-label="Play sermon">
                            <motion.div whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.95 }} className="h-20 w-20 bg-accent rounded-full flex items-center justify-center shadow-2xl shadow-accent/50 ring-4 ring-white/20">
                              <Play className="h-9 w-9 text-white fill-white ml-1" />
                            </motion.div>
                          </button>
                        </div>
                        <div className="p-6 bg-primary text-white">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-accent text-xs font-bold uppercase tracking-widest">
                              {isRecentBroadcast ? "Latest Broadcast" : "Featured Message"}
                            </span>
                            {isRecentBroadcast && broadcastAgo && (
                              <span className="text-white/40 text-xs">aired {broadcastAgo}</span>
                            )}
                          </div>
                          <h3 className="text-xl font-serif font-bold mt-2 mb-1 leading-tight line-clamp-2">
                            {hasCustomBroadcast ? "Latest Broadcast" : (sermon?.title ?? "Latest Broadcast")}
                          </h3>
                          <p className="text-white/50 text-xs mb-4">
                            {!hasCustomBroadcast && sermon && (isRecentBroadcast && broadcastEndedAt
                              ? `Broadcast ended ${formatDistanceToNow(new Date(broadcastEndedAt), { addSuffix: true })}`
                              : formatDistanceToNow(new Date(sermon.publishedAt), { addSuffix: true }))}
                          </p>
                          <div className="flex gap-3">
                            <button onClick={() => setPlaying(true)} className="flex-1 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors flex items-center justify-center gap-2">
                              <Play className="h-4 w-4 fill-white" />
                              {isRecentBroadcast ? "Watch Broadcast" : "Watch Now"}
                            </button>
                            {ytId && (
                              <VideoDownloadButton
                                videoId={ytId}
                                title={hasCustomBroadcast ? "Latest Broadcast" : (sermon?.title ?? "Latest Broadcast")}
                                thumbnailUrl={spotThumbnailUrl ?? `https://i.ytimg.com/vi/${ytId}/maxresdefault.jpg`}
                                variant="inline"
                              />
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </TiltCard>
            ) : null}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// RECENT SERMONS CAROUSEL
// ═══════════════════════════════════════════════════════════════════════════
type RecentSermon = { id: number; videoId: string; title: string; thumbnailUrl: string; publishedAt: string; isFeatured?: boolean; isLive?: boolean };

function RecentSermonCard({ sermon: s, index: i, playingId, onPlay, onClose }: {
  sermon: RecentSermon;
  index: number;
  playingId: string | null;
  onPlay: (id: string) => void;
  onClose: () => void;
}) {
  const playing = playingId === s.videoId;
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const sermonUrl = `${window.location.origin}${BASE}/sermons/${s.id}`;
  const sermonText = `"${s.title}" — JCTM Temple TV`;

  const copyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(sermonUrl);
    setCopied(true);
    toast.success("Link copied!");
    setTimeout(() => { setCopied(false); setShareOpen(false); }, 2000);
  };

  const shareWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`https://wa.me/?text=${encodeURIComponent(sermonText + "\n" + sermonUrl)}`, "_blank", "noopener");
    setShareOpen(false);
  };

  const shareFacebook = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(sermonUrl)}`, "_blank", "noopener");
    setShareOpen(false);
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
      transition={{ delay: i * 0.05, duration: 0.5 }}
      className={`shrink-0 w-72 rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-xl transition-all duration-300 snap-start group ${s.isLive ? "ring-2 ring-red-400" : s.isFeatured ? "ring-1 ring-accent/40" : ""}`}
    >
      <div className="relative aspect-video overflow-hidden">
        {playing ? (
          <>
            <YouTubeEmbed
              videoId={s.videoId}
              title={s.title}
              mode="eager"
              analyticsPage="/"
              className="absolute inset-0"
            />
            <button
              onClick={() => onClose()}
              className="absolute top-2 right-2 z-10 bg-black/70 hover:bg-black/90 text-white rounded-full p-1.5 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </>
        ) : (
          <>
            <img src={s.thumbnailUrl} alt={s.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={(e) => { (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${s.videoId}/hqdefault.jpg`; }} loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            {s.isLive && <div className="absolute top-2 left-2 flex items-center gap-1 bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full"><span className="h-1.5 w-1.5 bg-white rounded-full animate-ping inline-block" />LIVE</div>}
            {!s.isLive && s.isFeatured && <div className="absolute top-2 left-2 flex items-center gap-1 bg-accent text-white text-[9px] font-bold px-2 py-0.5 rounded-full"><Star className="h-2.5 w-2.5 fill-white" />Featured</div>}
            <button
              onClick={() => onPlay(s.videoId)}
              className="absolute bottom-3 right-3 h-9 w-9 rounded-full bg-accent/90 hover:bg-accent flex items-center justify-center transition-all shadow-lg"
            >
              <Play className="h-4 w-4 text-white fill-white ml-0.5" />
            </button>
          </>
        )}
      </div>
      <div className="p-4">
        <Link href={`/sermons/${s.id}`}>
          <p className="text-primary font-semibold text-sm line-clamp-2 leading-snug mb-2 hover:text-accent transition-colors cursor-pointer">{s.title}</p>
        </Link>
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(s.publishedAt), { addSuffix: true })}</p>
          <div className="flex items-center gap-0.5">
            <VideoDownloadButton
              videoId={s.videoId}
              title={s.title}
              thumbnailUrl={s.thumbnailUrl}
              variant="button"
              className="border-0 bg-transparent px-1.5 py-1"
              stopPropagation
            />
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShareOpen(o => !o); }}
              className="p-1.5 rounded-full text-muted-foreground hover:text-accent hover:bg-accent/10 transition-colors"
              title="Share this sermon"
            >
              <Share2 className="h-3.5 w-3.5" />
            </button>
            <AnimatePresence>
              {shareOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-full right-0 mb-2 bg-white border border-border rounded-xl shadow-xl z-50 py-1 min-w-[160px]"
                >
                  <button onClick={copyLink} className="flex items-center gap-2.5 w-full px-3 py-2 text-xs hover:bg-muted/60 transition-colors text-left">
                    {copied ? <CheckCheck className="h-3.5 w-3.5 text-green-500" /> : <Link2 className="h-3.5 w-3.5 text-muted-foreground" />}
                    {copied ? "Copied!" : "Copy Link"}
                  </button>
                  <button onClick={shareWhatsApp} className="flex items-center gap-2.5 w-full px-3 py-2 text-xs hover:bg-muted/60 transition-colors text-left">
                    <svg className="h-3.5 w-3.5 text-green-500" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    WhatsApp
                  </button>
                  <button onClick={shareFacebook} className="flex items-center gap-2.5 w-full px-3 py-2 text-xs hover:bg-muted/60 transition-colors text-left">
                    <svg className="h-3.5 w-3.5 text-blue-600" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    Facebook
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function RecentSermonsCarousel() {
  const [sermons, setSermons] = useState<{ id: number; videoId: string; title: string; thumbnailUrl: string; publishedAt: string; isFeatured?: boolean; isLive?: boolean; }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  useEffect(() => {
    fetch(`${BASE}/api/sermons?limit=12&offset=0`).then(r => r.json())
      .then(d => { setSermons(Array.isArray(d) ? d : []); setIsLoading(false); })
      .catch(() => setIsLoading(false));
  }, []);

  return (
    <section className="home-section bg-[#F0F6FF]/60">
      <div className="container mx-auto px-4 mb-8">
        <div className="flex items-end justify-between">
          <div>
            <span className="text-accent text-xs font-bold uppercase tracking-widest flex items-center gap-2 mb-3"><span className="h-px w-6 bg-accent inline-block" />Temple TV</span>
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-primary">Recent Messages</h2>
          </div>
          <Link href="/sermons"><Button variant="outline" className="rounded-full group hidden sm:flex border-primary/20">All Sermons <ChevronRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" /></Button></Link>
        </div>
      </div>
      <div className="relative">
        {isLoading ? (
          <div className="flex gap-5 overflow-x-auto pb-4 px-4 scrollbar-hide">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="shrink-0 w-72 rounded-2xl overflow-hidden bg-white shadow-sm"><Skeleton className="aspect-video w-full" /><div className="p-4"><Skeleton className="h-4 w-full mb-2" /><Skeleton className="h-3 w-2/3" /></div></div>)}
          </div>
        ) : (
          <div className="flex gap-5 overflow-x-auto pb-4 px-4 md:px-[calc((100vw-1280px)/2+1rem)] scrollbar-hide snap-x snap-mandatory">
            {sermons.map((s, i) => (
              <RecentSermonCard
                key={s.id}
                sermon={s}
                index={i}
                playingId={playingId}
                onPlay={(id) => setPlayingId(id)}
                onClose={() => setPlayingId(null)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MINISTRY PILLARS — Accordion UX with tilt cards grid
// ═══════════════════════════════════════════════════════════════════════════
function MinistryPillars() {
  const [open, setOpen] = useState<number | null>(null);

  const pillars = [
    { icon: BookOpen, title: "The Bible Is Our Standard", desc: "Every doctrine, every practice, every correction is measured strictly against the Word of God. No tradition can override Scripture.", gradient: "from-blue-600 to-[#003366]", scripture: "\"All Scripture is given by inspiration of God...\" — 2 Tim 3:16" },
    { icon: ShieldCheck, title: "Doctrinal Correction", desc: "Standing against false doctrines — prosperity gospel, prophetic manipulation, and spiritual abuse — restoring the apostolic standard.", gradient: "from-[#38BDF8] to-[#0284C7]", scripture: "\"Contend earnestly for the faith...\" — Jude 1:3" },
    { icon: Flame, title: "Holiness & Purity", desc: "We preach genuine holiness of heart, mind, and conduct, as set forth in the New Testament and modelled by the early church.", gradient: "from-orange-500 to-red-600", scripture: "\"Pursue peace with all people, and holiness...\" — Heb 12:14" },
    { icon: Mic2, title: "Prophetic Ministry", desc: "Prophet Amos Evomobor operates under a verified prophetic anointing, bringing divine messages and confirmatory signs.", gradient: "from-purple-600 to-violet-800", scripture: "\"Believe His prophets, and you shall prosper.\" — 2 Chr 20:20" },
    { icon: Radio, title: "Temple TV Broadcasts", desc: "Live and recorded services streamed globally via Temple TV on YouTube — making the Correction Mandate accessible worldwide.", gradient: "from-red-500 to-rose-700", scripture: "\"Go into all the world and preach the gospel...\" — Mark 16:15" },
    { icon: Heart, title: "Community & Welfare", desc: "We care for our members and community through prayer, fellowship, counselling, and practical support in Christ's name.", gradient: "from-emerald-500 to-teal-700", scripture: "\"Bear one another's burdens...\" — Gal 6:2" },
  ];

  return (
    <section className="home-section bg-[#FAFBFF]">
      <div className="container mx-auto px-4">
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }} className="text-center mb-16">
          <motion.span variants={fadeUp} className="text-accent text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 mb-4">
            <span className="h-px w-6 bg-accent inline-block" /> Our Mandate <span className="h-px w-6 bg-accent inline-block" />
          </motion.span>
          <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-serif font-bold text-primary mb-4">The Six Pillars of JCTM</motion.h2>
          <motion.p variants={fadeUp} className="text-muted-foreground text-lg max-w-2xl mx-auto">Every dimension of our ministry flows from one source — the apostolic truth of the New Testament church.</motion.p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {pillars.map(({ icon: Icon, title, desc, gradient, scripture }, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
              <TiltCard>
                <div className="group relative rounded-3xl border border-border bg-white overflow-hidden hover:shadow-2xl transition-all duration-300 h-full cursor-pointer" onClick={() => setOpen(open === i ? null : i)}>
                  <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient} opacity-0 group-hover:opacity-100 transition-opacity`} />
                  <div className="p-8">
                    <div className={`inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br ${gradient} mb-5 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className="h-7 w-7 text-white" />
                    </div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <h3 className="font-bold text-primary text-base leading-snug">{title}</h3>
                      <motion.div animate={{ rotate: open === i ? 180 : 0 }} transition={{ duration: 0.2 }} className="shrink-0 mt-0.5">
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </motion.div>
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
                    <AnimatePresence>
                      {open === i && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                          <div className={`mt-4 pt-4 border-t border-border bg-gradient-to-br ${gradient} bg-opacity-5 -mx-8 px-8 pb-0 rounded-b-3xl`}>
                            <p className="text-primary/60 text-xs italic leading-relaxed">📖 {scripture}</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </TiltCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCRIPTURE FEATURE — Daily Scripture section
// ═══════════════════════════════════════════════════════════════════════════
const DAILY_SCRIPTURES = [
  { verse: "Stand in the ways and see, and ask for the old paths, where the good way is; and walk in it.", ref: "Jeremiah 6:16" },
  { verse: "Sanctify them by Your truth. Your word is truth.", ref: "John 17:17" },
  { verse: "Contend earnestly for the faith which was once for all delivered to the saints.", ref: "Jude 1:3" },
  { verse: "Buy the truth, and do not sell it, also wisdom and instruction and understanding.", ref: "Proverbs 23:23" },
  { verse: "Pursue peace with all people, and holiness, without which no one will see the Lord.", ref: "Hebrews 12:14" },
  { verse: "All Scripture is given by inspiration of God, and is profitable for doctrine, for reproof, for correction, for instruction in righteousness.", ref: "2 Timothy 3:16" },
  { verse: "Beloved, do not believe every spirit, but test the spirits, whether they are of God; because many false prophets have gone out into the world.", ref: "1 John 4:1" },
  { verse: "Be diligent to present yourself approved to God, a worker who does not need to be ashamed, rightly dividing the word of truth.", ref: "2 Timothy 2:15" },
  { verse: "Thus says the Lord: \"Let not the wise man glory in his wisdom, let not the mighty man glory in his might, nor let the rich man glory in his riches; but let him who glories glory in this, that he understands and knows Me.\"", ref: "Jeremiah 9:23–24" },
  { verse: "For the time will come when they will not endure sound doctrine, but according to their own desires, because they have itching ears, they will heap up for themselves teachers.", ref: "2 Timothy 4:3" },
  { verse: "Preach the word! Be ready in season and out of season. Convince, rebuke, exhort, with all longsuffering and teaching.", ref: "2 Timothy 4:2" },
  { verse: "The entrance of Your words gives light; it gives understanding to the simple.", ref: "Psalm 119:130" },
  { verse: "Your word is a lamp to my feet and a light to my path.", ref: "Psalm 119:105" },
  { verse: "Heaven and earth will pass away, but My words will by no means pass away.", ref: "Matthew 24:35" },
  { verse: "If you abide in My word, you are My disciples indeed. And you shall know the truth, and the truth shall make you free.", ref: "John 8:31–32" },
  { verse: "For I testify to everyone who hears the words of the prophecy of this book: If anyone adds to these things, God will add to him the plagues that are written in this book.", ref: "Revelation 22:18" },
  { verse: "To the law and to the testimony! If they do not speak according to this word, it is because there is no light in them.", ref: "Isaiah 8:20" },
  { verse: "Beware of false prophets, who come to you in sheep's clothing, but inwardly they are ravenous wolves.", ref: "Matthew 7:15" },
  { verse: "Now I urge you, brethren, note those who cause divisions and offenses, contrary to the doctrine which you learned, and avoid them.", ref: "Romans 16:17" },
  { verse: "But even if we, or an angel from heaven, preach any other gospel to you than what we have preached to you, let him be accursed.", ref: "Galatians 1:8" },
  { verse: "Test all things; hold fast what is good.", ref: "1 Thessalonians 5:21" },
  { verse: "Not everyone who says to Me, 'Lord, Lord,' shall enter the kingdom of heaven, but he who does the will of My Father in heaven.", ref: "Matthew 7:21" },
  { verse: "For false christs and false prophets will rise and show great signs and wonders to deceive, if possible, even the elect.", ref: "Matthew 24:24" },
  { verse: "But as for you, speak the things which are proper for sound doctrine.", ref: "Titus 2:1" },
  { verse: "Holding fast the faithful word as he has been taught, that he may be able, by sound doctrine, both to exhort and convict those who contradict.", ref: "Titus 1:9" },
  { verse: "So shall My word be that goes forth from My mouth; it shall not return to Me void, but it shall accomplish what I please.", ref: "Isaiah 55:11" },
  { verse: "The grass withers, the flower fades, but the word of our God stands forever.", ref: "Isaiah 40:8" },
  { verse: "For the word of God is living and powerful, and sharper than any two-edged sword.", ref: "Hebrews 4:12" },
  { verse: "Man shall not live by bread alone, but by every word that proceeds from the mouth of God.", ref: "Matthew 4:4" },
  { verse: "Let the word of Christ dwell in you richly in all wisdom, teaching and admonishing one another in psalms and hymns and spiritual songs.", ref: "Colossians 3:16" },
  { verse: "You shall not add to the word which I command you, nor take from it.", ref: "Deuteronomy 4:2" },
];

function getDailyScripture() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return DAILY_SCRIPTURES[dayOfYear % DAILY_SCRIPTURES.length];
}

// ── Live Verse-of-Day hook — fetches from NKJV DB, falls back to static ────────
interface LiveVerse { verse: string; ref: string; reference: string; book: string; chapter: number; verseNum: number; fromDB: boolean }

function useLiveDailyVerse(): LiveVerse {
  const fallback = getDailyScripture();
  const [live, setLive] = useState<LiveVerse | null>(null);

  useEffect(() => {
    fetch(`${BASE}/api/bible/verse-of-day`)
      .then(r => r.ok ? r.json() : null)
      .then((data: { text?: string; reference?: string; book?: string; chapter?: number; verse?: number } | null) => {
        if (data?.text && data.reference) {
          setLive({ verse: data.text, ref: data.reference, reference: data.reference, book: data.book ?? "", chapter: data.chapter ?? 1, verseNum: data.verse ?? 1, fromDB: true });
        }
      })
      .catch(() => {});
  }, []);

  return live ?? { verse: fallback.verse, ref: fallback.ref, reference: fallback.ref, book: "", chapter: 1, verseNum: 1, fromDB: false };
}

function ScriptureFeature() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [-30, 30]);
  const daily = useLiveDailyVerse();
  const [copied, setCopied] = useState(false);
  const today = new Date().toLocaleDateString("en-NG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const handleCopy = () => {
    navigator.clipboard.writeText(`"${daily.verse}" — ${daily.ref} (NKJV)`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
  };

  return (
    <section ref={sectionRef} className="relative py-28 overflow-hidden bg-gradient-to-br from-[#001830] via-[#003366] to-[#001830]">
      <motion.div style={{ y, backgroundImage: "radial-gradient(circle, rgba(56,189,248,0.4) 1px, transparent 1px)", backgroundSize: "48px 48px" }} className="absolute inset-0 opacity-10" />
      <div className="container mx-auto px-4 relative z-10 text-center">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.8 }}>
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-accent/70 border border-accent/20 rounded-full px-4 py-1.5 mb-6">
            {daily.fromDB && <span className="h-1.5 w-1.5 rounded-full bg-accent/60 animate-pulse" />}
            Daily Scripture · {today}
          </span>
          <div className="text-accent/40 text-[120px] font-serif leading-none -mb-8 select-none">"</div>
          <blockquote className="text-3xl md:text-5xl lg:text-6xl font-serif font-bold text-white leading-tight max-w-4xl mx-auto">
            {daily.verse}
          </blockquote>
          <div className="text-accent/40 text-[120px] font-serif leading-none -mt-8 select-none rotate-180">"</div>
          <p className="text-accent font-semibold text-lg mt-2">{daily.ref}</p>
          <p className="text-white/40 text-sm mt-3">A fresh word for today from the Word of God</p>

          {/* Action row */}
          <div className="flex items-center justify-center gap-3 mt-8 flex-wrap">
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-5 py-2 rounded-full bg-white/8 border border-white/15 hover:bg-white/15 text-white/70 hover:text-white text-xs font-medium transition-all"
            >
              {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-accent" /> : <BookMarked className="h-3.5 w-3.5" />}
              {copied ? "Copied!" : "Copy verse"}
            </button>
            <Link href={`/scripture-study`}>
              <span className="flex items-center gap-2 px-5 py-2 rounded-full bg-accent/20 border border-accent/30 hover:bg-accent/30 text-accent text-xs font-semibold transition-all cursor-pointer">
                <BookOpen className="h-3.5 w-3.5" />
                Study this passage
              </span>
            </Link>
          </div>

          <div className="flex justify-center mt-8">
            <div className="h-px w-16 bg-accent/40" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// UPCOMING EVENTS
// ═══════════════════════════════════════════════════════════════════════════

function EventsSection() {
  return (
    <section className="home-section bg-gradient-to-b from-[#f0f6ff] to-white">
      <div className="container mx-auto px-4">
        {/* Section header */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-14 gap-6">
          <div>
            <span className="text-accent text-xs font-bold uppercase tracking-widest flex items-center gap-2 mb-3">
              <span className="h-px w-6 bg-accent inline-block" />Gatherings
            </span>
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-primary">Gather With Us</h2>
            <p className="text-muted-foreground mt-3 text-lg max-w-md">
              Experience transformation through our weekly services and special prophetic encounters.
            </p>
          </div>
          <Link href="/events">
            <Button variant="outline" className="rounded-full px-7 group border-primary/20">
              Browse Calendar <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>

        {/* ── Upcoming Special Events ── */}
        <div>
          <div className="flex items-center gap-3 mb-8">
            <span className="h-px flex-1 bg-border/60" />
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-accent" /> Upcoming Events
            </span>
            <span className="h-px flex-1 bg-border/60" />
          </div>

          {/* Empty state */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center justify-center py-20 px-6 rounded-3xl border border-border/50 bg-white/60 text-center"
          >
            <div className="h-16 w-16 rounded-2xl bg-accent/8 flex items-center justify-center mb-5 border border-accent/10">
              <Calendar className="h-7 w-7 text-accent/40" />
            </div>
            <h3 className="text-xl font-serif font-bold text-primary mb-2">No Upcoming Events Available</h3>
            <p className="text-muted-foreground text-sm max-w-sm mb-7 leading-relaxed">
              There are no events scheduled at this time. Check back soon or explore our event history for past gatherings.
            </p>
            <Link href="/events">
              <Button variant="outline" className="rounded-full px-7 group border-primary/20">
                View Past Events <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL REACH — Dramatic dark-theme impact visualization
// ═══════════════════════════════════════════════════════════════════════════
function GlobalReach() {
  const { data: stats } = useGetSermonStats({ query: { queryKey: getGetSermonStatsQueryKey() } });
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const bgY = useTransform(scrollYProgress, [0, 1], [-40, 40]);

  const impacts = [
    { value: stats?.total ?? 479, suffix: "+", label: "Sermons Preached", icon: Mic2, color: "from-accent to-[#0284C7]" },
    { value: stats?.totalViews ?? 2951335, suffix: "", label: "YouTube Views", icon: Youtube, color: "from-red-400 to-red-600" },
    { value: 40, suffix: "+", label: "Nations Reached", icon: Globe, color: "from-emerald-400 to-teal-600" },
    { value: 13, suffix: "+", label: "Years of Ministry", icon: Award, color: "from-amber-400 to-orange-500" },
  ];

  return (
    <section ref={ref} className="py-28 relative overflow-hidden" style={{ background: "#020b18" }}>
      {/* Animated background */}
      <motion.div style={{ y: bgY }} className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(ellipse 80% 70% at 50% 60%, rgba(0,51,102,0.5) 0%, transparent 70%)" }} />
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(ellipse 60% 50% at 20% 30%, rgba(56,189,248,0.08) 0%, transparent 60%)" }} />
        <div className="absolute inset-0 opacity-[0.055]" style={{ backgroundImage: "linear-gradient(rgba(56,189,248,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.5) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        {/* Animated "stars" */}
        {[...Array(16)].map((_, i) => (
          <motion.div key={i}
            animate={{ opacity: [0.3, 0.8, 0.3], scale: [1, 1.4, 1] }}
            transition={{ duration: 2 + i * 0.5, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 }}
            className="absolute rounded-full bg-white"
            style={{ width: 1 + (i % 2), height: 1 + (i % 2), top: `${8 + i * 5.5}%`, left: `${5 + i * 5.8}%`, opacity: 0.4 }}
          />
        ))}
      </motion.div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }} className="text-center mb-16">
          <motion.span variants={fadeUp} className="inline-flex items-center gap-2 border border-accent/30 text-accent px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6 bg-accent/10">
            <Globe className="h-3 w-3" /> Global Impact
          </motion.span>
          <motion.h2 variants={fadeUp} className="text-4xl md:text-6xl font-serif font-bold text-white mb-4 leading-tight">
            Reaching the{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-[#7DD3FC]">World</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-white/50 text-lg max-w-2xl mx-auto">
            Temple TV broadcasts the Correction Mandate to every corner of the earth — from Warri to the world.
          </motion.p>
        </motion.div>

        {/* Impact numbers */}
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }} className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-16">
          {impacts.map(({ value, suffix, label, icon: Icon, color }, i) => (
            <motion.div key={i} variants={fadeUp}>
              <TiltCard>
                <div className="relative bg-white/5 border border-white/8 rounded-3xl p-6 text-center group hover:bg-white/10 transition-all duration-300 hover:border-white/20 overflow-hidden">
                  <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${color} opacity-0 group-hover:opacity-100 transition-opacity`} />
                  <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${color} bg-opacity-20 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform shadow-lg`} style={{ opacity: 0.9 }}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="text-4xl md:text-5xl font-serif font-bold text-white mb-2 leading-none">
                    <AnimatedCounter target={value} suffix={suffix} />
                  </div>
                  <p className="text-white/45 text-xs uppercase tracking-wider font-medium mt-1">{label}</p>
                </div>
              </TiltCard>
            </motion.div>
          ))}
        </motion.div>

        {/* Ministry Slideshow */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 60, damping: 18 }}
        >
          <p className="text-white/35 text-[10px] uppercase tracking-[0.25em] mb-4 font-medium text-center">Ministry in Pictures — Moments of Faith, Worship & Spiritual Life at JCTM</p>
          <Suspense fallback={<div className="h-64 animate-pulse bg-white/5 rounded-2xl" />}>
            <MinistrySlideshow />
          </Suspense>
          <div className="flex justify-center mt-6">
            <a
              href="/gallery"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-white/20 text-white/70 hover:text-white hover:border-white/40 text-sm font-semibold transition-all duration-200 backdrop-blur-sm hover:bg-white/5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
              View Full Gallery
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// GIVING BAND — Enhanced
// ═══════════════════════════════════════════════════════════════════════════
function GivingBand() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: false, margin: "-20% 0px -20% 0px" });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const bgX = useTransform(scrollYProgress, [0, 1], [-20, 20]);
  useEffect(() => { if (inView) window.dispatchEvent(new CustomEvent("jctm:section-enter", { detail: "giving" })); }, [inView]);

  const givingOptions = [
    { label: "Tithe", desc: "Ten percent returned to God — the foundation of kingdom finance", icon: "🌿", color: "from-emerald-400/20 to-teal-500/10", border: "border-emerald-400/20" },
    { label: "Offerings", desc: "Freewill giving from a pure and grateful heart", icon: "✨", color: "from-accent/20 to-[#0284C7]/10", border: "border-accent/20" },
    { label: "Missions", desc: "Support the global Temple TV broadcasting mandate", icon: "🌍", color: "from-purple-400/20 to-violet-600/10", border: "border-purple-400/20" },
  ];

  return (
    <section
      ref={ref}
      className="py-28 relative overflow-hidden"
      onMouseEnter={() => window.dispatchEvent(new CustomEvent("jctm:hover-enter", { detail: "giving" }))}
      onMouseLeave={() => window.dispatchEvent(new CustomEvent("jctm:hover-leave"))}
    >
      {/* Background */}
      <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #001020 0%, #002a5c 45%, #001020 100%)" }} />
      <motion.div style={{ x: bgX }} className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 opacity-12" style={{ backgroundImage: "repeating-linear-gradient(45deg, rgba(56,189,248,0.25) 0px, rgba(56,189,248,0.25) 1px, transparent 1px, transparent 20px)" }} />
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(ellipse 70% 60% at 50% 100%, rgba(56,189,248,0.12) 0%, transparent 70%)" }} />
      </motion.div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }} className="text-center mb-14">
          <motion.span variants={fadeUp} className="inline-flex items-center gap-2 border border-accent/30 text-accent px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6 bg-accent/10">
            <Heart className="h-3 w-3 fill-accent" /> Partner With Us
          </motion.span>
          <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-white mb-5 leading-tight">
            Partner With<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-[#7DD3FC]">the Mandate</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-white/55 text-lg max-w-xl mx-auto leading-relaxed">
            Your giving fuels the global spread of the Correction Mandate.
          </motion.p>
          <motion.p variants={fadeUp} className="text-accent/70 font-serif italic text-sm mt-2">
            "The Lord loveth a cheerful giver." — 2 Cor 9:7
          </motion.p>
        </motion.div>

        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }} className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
          {givingOptions.map(({ label, desc, icon, color, border }, i) => (
            <motion.div key={i} variants={fadeUp}>
              <TiltCard>
                <div className={`relative bg-gradient-to-br ${color} border ${border} rounded-3xl p-8 text-center hover:scale-[1.02] transition-all duration-300 group overflow-hidden`}>
                  <div className="absolute top-0 right-0 w-24 h-24 opacity-5 text-8xl leading-none select-none">{icon}</div>
                  <div className="text-4xl mb-4">{icon}</div>
                  <h3 className="text-white font-bold text-xl mb-2">{label}</h3>
                  <p className="text-white/55 text-sm leading-relaxed">{desc}</p>
                </div>
              </TiltCard>
            </motion.div>
          ))}
        </motion.div>

        <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <MagneticButton>
            <Link href="/give">
              <RippleButton className="group inline-flex items-center justify-center h-14 px-14 rounded-full bg-accent hover:bg-accent/90 text-white font-bold text-base shadow-xl shadow-accent/30 transition-all duration-300 hover:-translate-y-1 min-h-[44px]">
                <Heart className="mr-2 h-5 w-5 fill-white group-hover:scale-110 transition-transform" /> Give Now
              </RippleButton>
            </Link>
          </MagneticButton>
          <Link href="/testimonies">
            <motion.button whileHover={{ scale: 1.02 } as never} className="h-14 px-10 rounded-full text-white border border-white/20 hover:bg-white/8 transition-all duration-200 min-h-[44px] inline-flex items-center gap-2 text-base">
              Read Testimonies <ArrowRight className="h-4 w-4" />
            </motion.button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// NEWCOMERS SECTION
// ═══════════════════════════════════════════════════════════════════════════
function NewcomerSection() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: false, margin: "-20% 0px -20% 0px" });
  useEffect(() => { if (inView) window.dispatchEvent(new CustomEvent("jctm:section-enter", { detail: "testimonies" })); }, [inView]);

  const steps = [
    { icon: BookOpen, title: "Our Beliefs", desc: "Discover what JCTM stands for and the doctrinal foundations of our faith.", href: "/about", cta: "Learn More" },
    { icon: MapPin, title: "Find a Viewing Centre", desc: "Our headquarters is in Warri. Connect with our services in person or online.", href: "/viewing-centres", cta: "Get Directions" },
  ];

  return (
    <section ref={ref} className="home-section bg-white">
      <div className="container mx-auto px-4">
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }} className="text-center max-w-2xl mx-auto mb-16">
          <motion.span variants={fadeUp} className="text-accent text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 mb-4">
            <span className="h-px w-6 bg-accent inline-block" /> Welcome <span className="h-px w-6 bg-accent inline-block" />
          </motion.span>
          <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-serif font-bold text-primary mb-5">New to the Temple?</motion.h2>
          <motion.p variants={fadeUp} className="text-lg text-muted-foreground leading-relaxed">
            Whether you're visiting online or at our Warri headquarters, we want to help you take your next step in the Correction Mandate.
          </motion.p>
        </motion.div>
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }} className="grid sm:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {steps.map(({ icon: Icon, title, desc, href, cta }, i) => (
            <motion.div key={i} variants={fadeUp}>
              <TiltCard>
                <div className="text-center p-8 rounded-3xl border border-border hover:border-accent/30 hover:shadow-2xl transition-all duration-300 bg-white group h-full flex flex-col">
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-accent to-[#0284C7] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-accent/20 group-hover:scale-110 transition-transform">
                    <Icon className="h-7 w-7 text-white" />
                  </div>
                  <h4 className="font-bold text-primary text-lg mb-3">{title}</h4>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-6 flex-1">{desc}</p>
                  <Link href={href}><Button variant="outline" className="rounded-full text-accent border-accent/30 hover:bg-accent hover:text-white hover:border-accent transition-all min-h-[44px]">{cta}</Button></Link>
                </div>
              </TiltCard>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CONNECT / SOCIAL — Media links + location
// ═══════════════════════════════════════════════════════════════════════════
function ConnectSection() {
  const channels = [
    { name: "Temple TV", sub: "youtube.com/templetvjctm", icon: Youtube, color: "#FF0000", bg: "from-red-50 to-rose-50", border: "border-red-100", href: "https://www.youtube.com/templetvjctm" },
    { name: "Facebook", sub: "facebook.com/templetvjctm", icon: Facebook, color: "#1877F2", bg: "from-blue-50 to-indigo-50", border: "border-blue-100", href: "https://www.facebook.com/templetvjctm" },
    { name: "Email Us", sub: "info@jctm.org.ng", icon: Mail, color: "#003366", bg: "from-sky-50 to-blue-50", border: "border-sky-100", href: "mailto:info@jctm.org.ng" },
  ];

  return (
    <section className="home-section bg-gradient-to-b from-white to-[#f0f6ff]/50">
      <div className="container mx-auto px-4">
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }} className="text-center mb-12">
          <motion.span variants={fadeUp} className="text-accent text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 mb-3">
            <span className="h-px w-6 bg-accent inline-block" /> Connect <span className="h-px w-6 bg-accent inline-block" />
          </motion.span>
          <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-serif font-bold text-primary mb-3">Stay Connected</motion.h2>
          <motion.p variants={fadeUp} className="text-muted-foreground max-w-lg mx-auto">Follow JCTM across platforms to never miss a broadcast, sermon, or prophetic update.</motion.p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-3xl mx-auto mb-10">
          {channels.map(({ name, sub, icon: Icon, color, bg, border, href }, i) => (
            <motion.a key={i} href={href} target={href.startsWith("mailto") ? undefined : "_blank"} rel="noopener noreferrer"
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              className={`group flex flex-col items-center gap-3 p-6 rounded-2xl border ${border} bg-gradient-to-br ${bg} hover:shadow-lg transition-all duration-300 hover:-translate-y-1`}
            >
              <div className="h-12 w-12 rounded-2xl flex items-center justify-center" style={{ background: `${color}18` }}>
                <Icon className="h-6 w-6" style={{ color }} />
              </div>
              <div className="text-center">
                <p className="text-primary font-bold text-sm">{name}</p>
                <p className="text-muted-foreground text-[11px] truncate max-w-[160px]">{sub}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" style={{ color }} />
            </motion.a>
          ))}
        </div>

        {/* Geo-targeted content banner */}
        <div className="max-w-3xl mx-auto mt-8">
          <GeoContentBanner />
        </div>

        {/* Geo Service Times */}
        <div className="max-w-3xl mx-auto mt-6">
          <GeoServiceTimes />
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TIMELINE TEASER
// ═══════════════════════════════════════════════════════════════════════════
function TimelineTeaser() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const scale = useTransform(scrollYProgress, [0, 1], [1.1, 1.0]);

  return (
    <section ref={ref} className="relative py-32 overflow-hidden" style={{ background: "#020b18" }}>
      <motion.div style={{ scale }} className="absolute inset-0 opacity-15">
        <div className="absolute inset-0 bg-gradient-to-br from-[#001830] to-[#020b18]" />
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, rgba(56,189,248,0.15) 0%, transparent 60%), radial-gradient(circle at 80% 50%, rgba(0,51,102,0.3) 0%, transparent 60%)" }} />
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle, rgba(56,189,248,0.4) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
      </motion.div>
      <div className="container mx-auto px-4 relative z-10 text-center">
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }} className="max-w-3xl mx-auto">
          <motion.span variants={fadeUp} className="inline-flex items-center gap-2 border border-accent/30 text-accent px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-8 bg-accent/10">
            <Sparkles className="h-3 w-3" /> Divine History
          </motion.span>
          <motion.h2 variants={fadeUp} className="text-5xl md:text-6xl font-serif font-bold text-white mb-6 leading-tight">History in the Making</motion.h2>
          <motion.p variants={fadeUp} className="text-lg text-white/60 mb-12 leading-relaxed">
            From the initial prophetic calling to the establishment of the Land of Good News, explore the milestones of our journey — a living testament to divine faithfulness.
          </motion.p>
          <motion.div variants={fadeUp}>
            <MagneticButton>
              <Link href="/correction-timeline">
                <Button size="lg" className="bg-gradient-to-r from-accent to-[#0284C7] hover:from-[#0284C7] hover:to-accent text-white h-16 px-14 rounded-full text-lg font-bold shadow-2xl shadow-accent/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-accent/50 min-h-[44px]">
                  View Our Timeline <ArrowRight className="ml-3 h-5 w-5" />
                </Button>
              </Link>
            </MagneticButton>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DAILY DEVOTION — AI-Generated Fresh Word
// ═══════════════════════════════════════════════════════════════════════════
interface Devotion {
  date: string;
  title: string;
  scripture: string;
  reference: string;
  reflection: string;
  propheticWord: string;
  prayerFocus: string;
  declaration: string;
}

function DevotionShareButton({ devotion }: { devotion: Devotion }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Share today's devotion"
        className="cta-ghost group"
        data-testid="button-open-share-devotion"
      >
        <Share2 className="h-3.5 w-3.5 text-accent transition-transform group-hover:scale-110" />
        Share
      </button>
      <DevotionShareDialog
        open={open}
        onOpenChange={setOpen}
        devotion={{
          title: devotion.title,
          scripture: devotion.scripture,
          reference: devotion.reference,
          propheticWord: devotion.propheticWord,
          declaration: devotion.declaration,
        }}
      />
    </>
  );
}

function DevotionSectionLabel({ icon: Icon, label, n }: { icon: React.ComponentType<{ className?: string }>; label: string; n: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-accent/10 text-accent shrink-0">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/40 tabular-nums">{n}</span>
      <span className="h-px flex-1 bg-gradient-to-r from-border via-border/40 to-transparent" />
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/70">{label}</span>
    </div>
  );
}

function DailyDevotionSection() {
  const [devotion, setDevotion] = useState<Devotion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${BASE}/api/devotion/daily`);
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        if (!cancelled) setDevotion(data.devotion);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const todayParts = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }).split(", ");
  const weekday = todayParts[0] ?? "";
  const monthDay = todayParts[1] ?? "";

  const reflectionWords = devotion ? devotion.reflection.split(/\s+/).filter(Boolean).length : 0;
  const totalWords = devotion ? reflectionWords + devotion.scripture.split(/\s+/).length + (devotion.propheticWord?.split(/\s+/).length ?? 0) + devotion.prayerFocus.split(/\s+/).length + devotion.declaration.split(/\s+/).length : 0;
  const readMinutes = Math.max(2, Math.round(totalWords / 220));

  return (
    <section
      ref={ref}
      id="daily-devotion"
      className="home-section ambient-ivory relative overflow-hidden"
    >
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: "radial-gradient(circle, #003366 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="container mx-auto px-4 relative">
        <div className="max-w-3xl mx-auto">
          {/* ── Section header ── */}
          <motion.header
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15% 0px" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="section-header"
          >
            <div className="inline-flex items-center gap-2.5 h-8 px-4 rounded-full bg-white/80 border border-border/60 elev-1 mb-6">
              <Calendar className="h-3.5 w-3.5 text-accent" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/70 tabular-nums">{weekday}<span className="text-primary/30 mx-1.5">·</span>{monthDay}</span>
            </div>
            <span className="block text-accent text-[11px] font-semibold uppercase tracking-[0.22em] mb-3">Daily Devotion</span>
            <h2 className="heading-xl text-primary mb-4">Today's Word for You</h2>
            <p className="lede mx-auto">
              A fresh portion from the Father's heart — meditate, receive, and walk in it today.
            </p>
          </motion.header>

          {/* ── Loading state ── */}
          {loading && (
            <div className="rounded-3xl bg-white/70 border border-border/60 p-10 elev-2 backdrop-blur-sm">
              <div className="flex items-center justify-center gap-3 text-primary/50 text-sm">
                <span className="inline-flex h-2 w-2 rounded-full bg-accent animate-pulse" />
                <span className="inline-flex h-2 w-2 rounded-full bg-accent/70 animate-pulse" style={{ animationDelay: "150ms" }} />
                <span className="inline-flex h-2 w-2 rounded-full bg-accent/40 animate-pulse" style={{ animationDelay: "300ms" }} />
                <span className="ml-2 italic font-serif">Drawing today's word from the well…</span>
              </div>
            </div>
          )}

          {/* ── Error state ── */}
          {error && !loading && (
            <div className="rounded-3xl bg-white/80 border border-border/60 p-10 md:p-14 text-center elev-2 backdrop-blur-sm">
              <BookOpen className="h-8 w-8 text-accent/60 mx-auto mb-5" />
              <p className="text-primary/80 text-xl md:text-2xl font-serif italic leading-relaxed mb-3 text-balance">
                "Thy word is a lamp unto my feet, and a light unto my path."
              </p>
              <p className="text-accent text-xs font-semibold uppercase tracking-[0.18em]">Psalm 119:105</p>
              <p className="text-muted-foreground text-sm mt-6">A fresh devotion will be available shortly.</p>
            </div>
          )}

          {/* ── Devotion article ── */}
          {devotion && !loading && (
            <motion.article
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10% 0px" }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-3xl bg-white/85 border border-border/60 elev-3 backdrop-blur-sm overflow-hidden"
            >
              {/* Article header */}
              <div className="px-6 md:px-12 pt-10 md:pt-14 pb-2">
                <div className="flex items-center gap-3 text-[11px] text-primary/50 mb-4">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <Clock className="h-3 w-3" />
                    <span className="tabular-nums">{readMinutes} min read</span>
                  </span>
                  <span className="h-1 w-1 rounded-full bg-primary/20" />
                  <span className="font-medium">Reflective</span>
                </div>
                <h3 className="heading-lg text-primary text-balance">
                  {devotion.title}
                </h3>
              </div>

              <div className="px-6 md:px-12 py-8 md:py-10 space-y-12">
                {/* ── 01. Scripture — anchored pull-quote ── */}
                <section>
                  <DevotionSectionLabel icon={BookOpen} label="Scripture" n="01" />
                  <figure className="relative pl-6 md:pl-8 border-l-2 border-accent/40">
                    <span aria-hidden className="absolute -left-2 -top-3 text-accent/20 font-serif text-6xl leading-none select-none">"</span>
                    <blockquote className="text-primary/90 text-xl md:text-2xl font-serif italic leading-relaxed text-balance">
                      {devotion.scripture}
                    </blockquote>
                    <figcaption className="mt-4 text-accent text-xs font-semibold uppercase tracking-[0.18em]">
                      {devotion.reference}
                    </figcaption>
                  </figure>
                </section>

                {/* ── 02. Reflection — long-form with drop cap ── */}
                <section>
                  <DevotionSectionLabel icon={Sparkles} label="Reflection" n="02" />
                  <div className="space-y-6 text-primary/85 text-[17px] md:text-[19px] leading-[1.85] font-medium devotion-prose">
                    {devotion.reflection.split(/\n+/).filter(Boolean).map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                  </div>
                </section>

                {/* ── 03. Prophetic Word — framed callout ── */}
                {devotion.propheticWord && (
                  <section>
                    <DevotionSectionLabel icon={Mic2} label="Prophetic Word" n="03" />
                    <div className="rounded-2xl bg-gradient-to-br from-[#F0F6FF] via-white to-[#EEF4FF] border border-accent/15 p-6 md:p-7 elev-1 relative overflow-hidden">
                      <div aria-hidden className="absolute top-0 right-0 w-32 h-32 opacity-[0.08]" style={{ background: "radial-gradient(circle, #003366 0%, transparent 70%)" }} />
                      <p className="text-primary/90 text-base md:text-lg leading-relaxed relative z-10">
                        {devotion.propheticWord}
                      </p>
                      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent relative z-10">
                        — Through Prophet Amos Evomobor · JCTM
                      </p>
                    </div>
                  </section>
                )}

                {/* ── 04. Prayer Focus ── */}
                <section>
                  <DevotionSectionLabel icon={Heart} label="Prayer Focus" n="04" />
                  <p className="text-primary/80 text-base md:text-[17px] leading-[1.75]">
                    {devotion.prayerFocus}
                  </p>
                </section>

                {/* ── 05. Declaration — sacred callout ── */}
                <section>
                  <DevotionSectionLabel icon={Flame} label="Declaration" n="05" />
                  <div className="rounded-2xl bg-gradient-to-br from-primary to-[#001a40] p-7 md:p-9 elev-3 relative overflow-hidden">
                    <div aria-hidden className="absolute inset-0 opacity-10" style={{ background: "radial-gradient(circle at 80% 20%, #38BDF8 0%, transparent 55%)" }} />
                    <p className="text-accent text-[10px] font-semibold uppercase tracking-[0.22em] mb-3 relative z-10">Speak this aloud</p>
                    <blockquote className="text-white text-xl md:text-2xl font-serif leading-relaxed font-medium text-balance relative z-10">
                      "{devotion.declaration}"
                    </blockquote>
                  </div>
                </section>
              </div>

              {/* ── Action bar ── */}
              <div className="px-6 md:px-12 py-7 border-t border-border/50 bg-gradient-to-b from-transparent to-[#FAF7EE]/40">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/50 mb-4">Carry this further</p>
                <div className="flex flex-wrap gap-2.5">
                  <Link href="/devotion" className="cta-primary group">
                    <BookOpen className="h-3.5 w-3.5" />
                    Read full devotion
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                  <Link href="/prayer" className="cta-ghost group">
                    <Heart className="h-3.5 w-3.5 text-accent transition-transform group-hover:scale-110" />
                    Generate a prayer
                  </Link>
                  <Link href="/sermons" className="cta-ghost group">
                    <Play className="h-3.5 w-3.5 fill-accent text-accent transition-transform group-hover:scale-110" />
                    Today's sermon
                  </Link>
                  <DevotionShareButton devotion={devotion} />
                </div>
              </div>

              {/* ── Email subscribe ── */}
              <div className="px-6 md:px-12 py-8 border-t border-border/50 bg-[#FAF7EE]/60">
                <DevotionEmailSubscribe source="home-daily-devotion" variant="compact" />
              </div>
            </motion.article>
          )}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL ALTAR — Live Worshipper Counter
// ═══════════════════════════════════════════════════════════════════════════
function GlobalAltarSection() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: false, margin: "-20% 0px -20% 0px" });
  useEffect(() => {
    if (inView) window.dispatchEvent(new CustomEvent("jctm:section-enter", { detail: "altar" }));
  }, [inView]);

  return (
    <section
      ref={ref}
      className="py-24 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #020b18 0%, #001225 50%, #020b18 100%)" }}
      onMouseEnter={() => window.dispatchEvent(new CustomEvent("jctm:hover-enter", { detail: "altar" }))}
      onMouseLeave={() => window.dispatchEvent(new CustomEvent("jctm:hover-leave"))}
    >
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(56,189,248,0.08) 0%, transparent 70%)" }} />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "radial-gradient(circle, rgba(56,189,248,0.6) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }} className="text-center mb-12">
          <motion.span variants={fadeUp} className="inline-flex items-center gap-2 border border-accent/30 text-accent px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6 bg-accent/10">
            <Radio className="h-3 w-3" /> Global Altar
          </motion.span>
          <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-serif font-bold text-white mb-4 leading-tight">
            One Altar,{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-[#7DD3FC]">Every Nation</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-white/50 text-lg max-w-xl mx-auto">
            Join believers worshipping in real-time from across the globe — the Digital Sanctuary never sleeps.
          </motion.p>
        </motion.div>

        {/* 3D WebGL Global Altar */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="mb-8"
        >
          <SectionErrorBoundary
            name="GlobalAltar3D"
            fallback={
              <div className="h-80 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center text-center px-6">
                <p className="text-white/60 text-sm max-w-md">
                  The 3D Global Altar is unavailable on this device. The rest of the page is unaffected.
                </p>
              </div>
            }
          >
            <Suspense fallback={<div className="h-80 animate-pulse bg-white/5 rounded-2xl" />}>
              <GlobalAltar3D />
            </Suspense>
          </SectionErrorBoundary>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 80, damping: 18 }}
          className="max-w-md mx-auto"
        >
          <div
            className="rounded-3xl p-10 text-center border border-white/8"
            style={{
              background: "rgba(255,255,255,0.03)",
              backdropFilter: "blur(20px)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 0 60px rgba(56,189,248,0.08)",
            }}
          >
            <GlobalAltar />
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-center text-white/25 text-[11px] uppercase tracking-widest mt-8 font-medium"
        >
          Real-time · Updates every few seconds · Powered by Digital Sanctuary
        </motion.p>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BLOG PREVIEW SECTION
// ═══════════════════════════════════════════════════════════════════════════
function BlogPreviewSection() {
  const { data, isLoading } = useQuery<{ posts: Array<{ slug: string; title: string; excerpt: string | null; category: string | null; readTimeMinutes: number | null; publishedAt: string | null }> }>({
    queryKey: ["/api/blog?limit=3"],
    queryFn: () => fetch("/api/blog?limit=3").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });
  const posts = data?.posts ?? [];
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });

  const CATEGORY_COLORS: Record<string, string> = {
    Doctrine: "from-violet-500 to-purple-600",
    Prophecy: "from-amber-500 to-orange-500",
    Holiness: "from-sky-500 to-blue-600",
    Ministry: "from-emerald-500 to-teal-600",
    Prayer: "from-pink-500 to-rose-600",
    default: "from-accent to-blue-500",
  };

  return (
    <section ref={ref} className="relative py-24 overflow-hidden" style={{ background: "linear-gradient(180deg, #0a0f1e 0%, #060b18 100%)" }}>
      <div className="absolute inset-0 grid-bg opacity-20" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[1px] bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial="hidden" animate={inView ? "show" : "hidden"} variants={stagger}
          className="text-center mb-14"
        >
          <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-accent/25 bg-accent/8 mb-5">
            <Pen className="w-3.5 h-3.5 text-accent" />
            <span className="text-accent text-xs font-semibold tracking-widest uppercase">Ministry Articles</span>
          </motion.div>
          <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-serif font-bold text-white mb-3">
            From the{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-sky-400">Digital Pulpit</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-white/45 max-w-xl mx-auto">
            Deep-dive articles on doctrine, prophecy, and ministry — anchored in Scripture.
          </motion.p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-white/8 bg-white/3 h-64 animate-pulse" />
              ))
            : posts.slice(0, 3).map((post, i) => {
                const colorClass = CATEGORY_COLORS[post.category ?? ""] ?? CATEGORY_COLORS.default;
                return (
                  <motion.div
                    key={post.slug}
                    initial={{ opacity: 0, y: 30 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: i * 0.12, type: "spring", stiffness: 80, damping: 18 }}
                  >
                    <Link href={`/blog/${post.slug}`}>
                      <div className="group relative rounded-2xl border border-white/8 bg-white/3 overflow-hidden cursor-pointer transition-all duration-300 hover:border-accent/30 hover:bg-white/5 hover:-translate-y-1 hover:shadow-[0_0_40px_rgba(56,189,248,0.08)]">
                        <div className={`h-1 bg-gradient-to-r ${colorClass}`} />
                        <div className="p-6">
                          <div className="flex items-center gap-2 mb-4">
                            {post.category && (
                              <span className={`text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full bg-gradient-to-r ${colorClass} text-white`}>
                                {post.category}
                              </span>
                            )}
                            <span className="text-white/25 text-xs ml-auto flex items-center gap-1">
                              <Clock className="w-3 h-3" />{post.readTimeMinutes ?? 5} min
                            </span>
                          </div>
                          <h3 className="font-bold text-white text-lg leading-tight mb-3 group-hover:text-sky-300 transition-colors line-clamp-2">
                            {post.title}
                          </h3>
                          {post.excerpt && (
                            <p className="text-white/45 text-sm leading-relaxed line-clamp-3">{post.excerpt}</p>
                          )}
                          <div className="mt-4 flex items-center gap-1 text-accent text-xs font-semibold group-hover:gap-2 transition-all">
                            Read Article <ArrowRight className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
        </div>

        <div className="text-center">
          <Link href="/blog">
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-full border border-accent/30 text-accent text-sm font-semibold hover:bg-accent/8 transition-all"
            >
              Explore All Articles <ArrowRight className="w-4 h-4" />
            </motion.button>
          </Link>
        </div>
      </div>
    </section>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// AI ASSISTANT TEASER
// ═══════════════════════════════════════════════════════════════════════════
const DEMO_MESSAGES = [
  { q: "What is the Correction Mandate?", a: "The Correction Mandate is JCTM's divine assignment — a God-given call to expose five major errors in modern Christianity and restore Primitive Christianity. It's not criticism; it's prophetic reformation." },
  { q: "How do I grow in holiness?", a: "Holiness begins with surrendering your will to God daily. Study His Word, pray consistently, flee every form of evil, and fellowship with believers who hold the same standard. Hebrews 12:14 says without holiness, no one will see the Lord." },
  { q: "When is the next JCTM service?", a: "Sunday services are held at Ebrumede Temple, Warri from 8:00 AM – 12:00 PM WAT. All services are also broadcast live on Temple TV (YouTube @TEMPLETVJCTM). See our Events page for special programs." },
];

function AIAssistantTeaser() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [phase, setPhase] = useState<"question" | "typing" | "answer">("question");
  const [displayedText, setDisplayedText] = useState("");
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });

  useEffect(() => {
    if (!inView) return;
    let timeout: ReturnType<typeof setTimeout>;
    const msg = DEMO_MESSAGES[activeIdx]!;

    if (phase === "question") {
      timeout = setTimeout(() => setPhase("typing"), 1200);
    } else if (phase === "typing") {
      const answer = msg.a;
      let i = 0;
      setDisplayedText("");
      const interval = setInterval(() => {
        i++;
        setDisplayedText(answer.slice(0, i));
        if (i >= answer.length) {
          clearInterval(interval);
          setTimeout(() => setPhase("answer"), 800);
        }
      }, 18);
      return () => clearInterval(interval);
    } else {
      timeout = setTimeout(() => {
        setActiveIdx(prev => (prev + 1) % DEMO_MESSAGES.length);
        setPhase("question");
        setDisplayedText("");
      }, 3500);
    }
    return () => clearTimeout(timeout);
  }, [phase, activeIdx, inView]);

  const msg = DEMO_MESSAGES[activeIdx]!;

  return (
    <section ref={ref} className="relative py-28 overflow-hidden" style={{ background: "linear-gradient(135deg, #08091a 0%, #0d0e24 50%, #080916 100%)" }}>
      <div className="absolute inset-0 grid-bg opacity-25" />
      <div className="absolute inset-0 scanlines opacity-[0.02]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.04]"
        style={{ background: "radial-gradient(circle, rgba(56,189,248,1) 0%, transparent 70%)" }} />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial="hidden" animate={inView ? "show" : "hidden"} variants={stagger}
          >
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-accent/30 bg-accent/10 mb-6">
              <BrainCircuit className="w-3.5 h-3.5 text-accent" />
              <span className="text-accent text-xs font-bold tracking-widest uppercase">TempleBots AI — Fully Local</span>
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-serif font-bold text-white mb-5 leading-tight">
              Your Personal{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent via-violet-400 to-sky-300">Ministry Companion</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="text-white/50 text-lg mb-8 leading-relaxed">
              TempleBots is JCTM's local AI assistant — trained on sound doctrine, JCTM teachings, and the Word of God. Ask anything about the faith, ministry, or Scripture. Zero external API. Always available.
            </motion.p>
            <motion.div variants={fadeUp} className="space-y-3 mb-8">
              {[
                { icon: BookMarked, label: "Answers from JCTM's doctrinal knowledge base" },
                { icon: BrainCircuit, label: "Spiritually-aware responses with Scripture" },
                { icon: Heart, label: "Compassionate pastoral care in every reply" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-3 text-white/65 text-sm">
                  <div className="w-6 h-6 rounded-full bg-accent/15 border border-accent/25 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-3 h-3 text-accent" />
                  </div>
                  {label}
                </div>
              ))}
            </motion.div>
            <motion.div variants={fadeUp}>
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => window.dispatchEvent(new CustomEvent("jctm:open-templebots", { detail: { message: "Hello TempleBots! I just discovered the Digital Sanctuary. Can you introduce me to JCTM and the Correction Mandate?" } }))}
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full text-sm font-bold text-white shadow-lg transition-all cursor-pointer"
                style={{ background: "linear-gradient(135deg, #38BDF8 0%, #7C3AED 100%)", boxShadow: "0 0 30px rgba(56,189,248,0.25)" }}
              >
                <Bot className="w-4 h-4" /> Chat with TempleBots
              </motion.button>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.3, type: "spring", stiffness: 70, damping: 20 }}
            className="relative"
          >
            <div
              className="rounded-3xl border border-white/10 overflow-hidden"
              style={{
                background: "rgba(10,15,35,0.8)",
                backdropFilter: "blur(24px)",
                boxShadow: "0 0 60px rgba(56,189,248,0.1), inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
            >
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/8">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <div className="w-5 h-5 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center">
                    <Bot className="w-3 h-3 text-accent" />
                  </div>
                  <span className="text-white/50 text-xs font-medium">TempleBots · JCTM</span>
                </div>
                <div className="ml-auto flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-400 text-[10px]">Live</span>
                </div>
              </div>

              <div className="p-5 min-h-[220px] flex flex-col gap-4">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`q-${activeIdx}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex justify-end"
                  >
                    <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm text-white font-medium"
                      style={{ background: "linear-gradient(135deg, rgba(56,189,248,0.2), rgba(124,58,237,0.2))", border: "1px solid rgba(56,189,248,0.2)" }}>
                      {msg.q}
                    </div>
                  </motion.div>
                </AnimatePresence>

                {phase !== "question" && (
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot className="w-3.5 h-3.5 text-accent" />
                    </div>
                    <div className="flex-1 max-w-[85%] px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm text-white/80 leading-relaxed border border-white/8"
                      style={{ background: "rgba(255,255,255,0.04)" }}>
                      <AnimatePresence mode="wait">
                        {phase === "typing" ? (
                          <motion.span key="typing" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            {displayedText}
                            <span className="inline-block w-0.5 h-4 bg-accent ml-0.5 animate-pulse align-middle" />
                          </motion.span>
                        ) : (
                          <motion.span key="answer" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            {msg.a}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                )}
              </div>

              <div className="px-5 py-3.5 border-t border-white/8 flex items-center gap-3">
                <div className="flex-1 h-9 rounded-xl border border-white/10 bg-white/4 px-4 flex items-center">
                  <span className="text-white/20 text-xs">Ask anything about JCTM or Scripture…</span>
                </div>
                <button className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
                  style={{ background: "linear-gradient(135deg, #38BDF8, #7C3AED)" }}>
                  <Send className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
            </div>

            <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full opacity-20 blur-2xl"
              style={{ background: "radial-gradient(circle, #38BDF8, transparent)" }} />
            <div className="absolute -top-4 -left-4 w-20 h-20 rounded-full opacity-15 blur-xl"
              style={{ background: "radial-gradient(circle, #7C3AED, transparent)" }} />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PRAYER WALL SECTION
// ═══════════════════════════════════════════════════════════════════════════
function PrayerWallSection() {
  const [form, setForm] = useState({ name: "", request: "", category: "general", isAnonymous: false });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.1 });

  const { data: prayers = [] } = useQuery<Array<{ id: number; name: string | null; request: string; category: string; pray_count: number; is_anonymous?: boolean }>>({
    queryKey: ["/api/prayer/requests?limit=5"],
    queryFn: () => fetch("/api/prayer/requests?limit=5").then(r => r.json()).then(d => Array.isArray(d) ? d : (d.requests ?? d.data ?? [])),
    staleTime: 3 * 60 * 1000,
  });

  const PRAYER_CATEGORIES = ["general", "healing", "deliverance", "provision", "guidance", "family", "salvation", "protection", "gratitude"];
  const CATEGORY_ICONS: Record<string, string> = {
    healing: "🙏", deliverance: "⛓️", provision: "💰", guidance: "🧭",
    family: "👨‍👩‍👧", salvation: "✝️", protection: "🛡️", gratitude: "🌟", general: "❤️",
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.request.trim() || form.request.trim().length < 15) {
      toast.error("Please write at least 15 characters for your prayer request.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/prayer/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.isAnonymous ? "Anonymous" : (form.name.trim() || "Anonymous"),
          request: form.request.trim(),
          category: form.category,
          isAnonymous: form.isAnonymous,
        }),
      });
      if (res.ok) {
        setSubmitted(true);
        toast.success("Your prayer request has been submitted. The JCTM prayer team will stand with you.");
      } else {
        toast.error("Could not submit prayer request. Please try again.");
      }
    } catch {
      toast.error("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section ref={ref} className="relative py-24 overflow-hidden" style={{ background: "linear-gradient(180deg, #080e1c 0%, #0a0a1e 100%)" }}>
      <div className="absolute inset-0 grid-bg opacity-20" />
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />
      <div className="absolute top-1/2 right-0 w-72 h-72 rounded-full blur-3xl opacity-[0.06]"
        style={{ background: "radial-gradient(circle, #7C3AED, transparent)" }} />

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial="hidden" animate={inView ? "show" : "hidden"} variants={stagger}
          className="text-center mb-14"
        >
          <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-violet-500/25 bg-violet-500/8 mb-5">
            <Heart className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-violet-400 text-xs font-semibold tracking-widest uppercase">Global Prayer Wall</span>
          </motion.div>
          <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-serif font-bold text-white mb-3">
            We Stand{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-pink-400">With You</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-white/45 max-w-xl mx-auto">
            Submit your prayer request to the JCTM prayer community. You are not alone.
          </motion.p>
        </motion.div>

        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.2, type: "spring", stiffness: 80, damping: 18 }}
          >
            <div
              className="rounded-2xl border border-white/10 p-6"
              style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(16px)" }}
            >
              <h3 className="text-white font-bold text-lg mb-5 flex items-center gap-2">
                <Heart className="w-4 h-4 text-violet-400" /> Submit a Prayer Request
              </h3>

              {submitted ? (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
                  <div className="w-14 h-14 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center mx-auto mb-4">
                    <CheckCheck className="w-6 h-6 text-violet-400" />
                  </div>
                  <p className="text-white font-semibold mb-2">Prayer Request Submitted</p>
                  <p className="text-white/50 text-sm">The JCTM prayer team will stand in agreement with you. God hears every cry of faith.</p>
                  <button
                    onClick={() => { setSubmitted(false); setForm({ name: "", request: "", category: "general", isAnonymous: false }); }}
                    className="mt-5 text-violet-400 text-sm hover:text-violet-300 transition-colors"
                  >
                    Submit another request
                  </button>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="text-white/50 text-xs uppercase tracking-wider block mb-1.5">Your Name (optional)</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      disabled={form.isAnonymous}
                      placeholder="Your name or leave blank"
                      className="w-full rounded-xl border border-white/10 bg-white/4 px-4 py-2.5 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-violet-500/40 transition-colors disabled:opacity-40"
                    />
                  </div>
                  <div>
                    <label className="text-white/50 text-xs uppercase tracking-wider block mb-1.5">Category</label>
                    <select
                      value={form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      className="w-full rounded-xl border border-white/10 bg-white/4 px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500/40 transition-colors"
                      style={{ background: "rgba(255,255,255,0.04)" }}
                    >
                      {PRAYER_CATEGORIES.map(cat => (
                        <option key={cat} value={cat} style={{ background: "#0a0f1e" }}>
                          {CATEGORY_ICONS[cat]} {cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-white/50 text-xs uppercase tracking-wider block mb-1.5">Your Prayer Request</label>
                    <textarea
                      value={form.request}
                      onChange={e => setForm(f => ({ ...f, request: e.target.value }))}
                      placeholder="Share your need with the JCTM prayer community…"
                      rows={4}
                      className="w-full rounded-xl border border-white/10 bg-white/4 px-4 py-2.5 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-violet-500/40 transition-colors resize-none"
                    />
                    <p className="text-white/25 text-xs mt-1">{form.request.length}/500 characters</p>
                  </div>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isAnonymous}
                      onChange={e => setForm(f => ({ ...f, isAnonymous: e.target.checked }))}
                      className="w-4 h-4 rounded border-white/20 accent-violet-500"
                    />
                    <span className="text-white/50 text-sm">Submit anonymously</span>
                  </label>
                  <button
                    type="submit"
                    disabled={submitting || form.request.trim().length < 15}
                    className="w-full py-3 rounded-xl font-semibold text-white text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, #7C3AED, #DB2777)" }}
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Heart className="w-4 h-4" />}
                    {submitting ? "Submitting…" : "Submit Prayer Request"}
                  </button>
                </form>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.3, type: "spring", stiffness: 80, damping: 18 }}
            className="space-y-3"
          >
            <h3 className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-4 flex items-center gap-2">
              <Users className="w-3.5 h-3.5" /> Community Prayer Wall
            </h3>
            {prayers.length === 0 ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-white/8 bg-white/2 p-4 h-20 animate-pulse" />
              ))
            ) : (
              prayers.map((prayer, i) => (
                <motion.div
                  key={prayer.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.3 + i * 0.08 }}
                  className="rounded-xl border border-white/8 bg-white/3 p-4 hover:border-violet-500/20 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-violet-500/15 border border-violet-500/20 flex items-center justify-center flex-shrink-0 text-sm">
                      {CATEGORY_ICONS[prayer.category] ?? "🙏"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white/70 text-xs font-semibold">{prayer.is_anonymous ? "Anonymous" : (prayer.name ?? "Believer")}</span>
                        <span className="text-white/25 text-[10px] capitalize">{prayer.category}</span>
                      </div>
                      <p className="text-white/50 text-xs leading-relaxed line-clamp-2">{prayer.request}</p>
                    </div>
                    <div className="flex items-center gap-1 text-violet-400/60 text-[10px] flex-shrink-0">
                      <Heart className="w-3 h-3" /> {prayer.pray_count ?? 0}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
            <div className="text-center mt-4">
              <Link href="/prayer">
                <span className="text-violet-400 text-xs hover:text-violet-300 transition-colors">
                  View all prayer requests →
                </span>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// NEWSLETTER SECTION
// ═══════════════════════════════════════════════════════════════════════════
function NewsletterSection() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/devotion/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), name: name.trim() || undefined }),
      });
      if (res.ok) {
        setSubmitted(true);
        toast.success("Subscribed! Daily devotions will arrive in your inbox.");
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Subscription failed. Please try again.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section ref={ref} className="relative py-24 overflow-hidden" style={{ background: "linear-gradient(180deg, #0a0a1e 0%, #06080f 100%)" }}>
      <div className="absolute inset-0 grid-bg opacity-15" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[200px] opacity-10 blur-3xl rounded-full"
        style={{ background: "linear-gradient(90deg, #38BDF8, #7C3AED)" }} />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            initial="hidden" animate={inView ? "show" : "hidden"} variants={stagger}
          >
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/25 bg-amber-500/8 mb-6">
              <Bell className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-amber-400 text-xs font-semibold tracking-widest uppercase">Daily Devotion</span>
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-serif font-bold text-white mb-4 leading-tight">
              Start Every Day{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">With the Word</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="text-white/45 text-lg mb-8">
              Receive daily devotions, prophetic words, and Scripture declarations from JCTM directly in your inbox — free, forever.
            </motion.p>

            {submitted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-2xl border border-amber-500/25 bg-amber-500/8 p-8"
              >
                <div className="w-14 h-14 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mx-auto mb-4">
                  <CheckCheck className="w-7 h-7 text-amber-400" />
                </div>
                <p className="text-white font-bold text-xl mb-2">You're Subscribed!</p>
                <p className="text-white/50">Your first devotion is on its way. Check your inbox — and your spam folder just in case.</p>
              </motion.div>
            ) : (
              <motion.form variants={fadeUp} onSubmit={handleSubmit} className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Your first name (optional)"
                    className="flex-1 h-12 rounded-xl border border-white/10 bg-white/5 px-5 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-amber-500/40 transition-colors"
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Your email address"
                    required
                    className="flex-1 h-12 rounded-xl border border-white/10 bg-white/5 px-5 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-amber-500/40 transition-colors"
                  />
                </div>
                <motion.button
                  type="submit"
                  disabled={submitting}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full h-12 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)", boxShadow: "0 0 30px rgba(245,158,11,0.2)" }}
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                  {submitting ? "Subscribing…" : "Subscribe to Daily Devotions — Free"}
                </motion.button>
                <p className="text-white/25 text-xs">No spam. Unsubscribe anytime. We respect your inbox.</p>
              </motion.form>
            )}

            <motion.div variants={fadeUp} className="grid grid-cols-3 gap-4 mt-10 pt-8 border-t border-white/8">
              {[
                { icon: BookMarked, label: "Daily Scripture", sub: "Fresh Word every morning" },
                { icon: Heart, label: "Prophetic Word", sub: "From Prophet Amos' teachings" },
                { icon: Sparkles, label: "Prayer Focus", sub: "Daily prayer declaration" },
              ].map(({ icon: Icon, label, sub }) => (
                <div key={label} className="text-center">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center mx-auto mb-2">
                    <Icon className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="text-white/70 text-xs font-semibold">{label}</p>
                  <p className="text-white/30 text-[10px] mt-0.5">{sub}</p>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE ASSEMBLY
// ═══════════════════════════════════════════════════════════════════════════
export default function Home() {
  useAdPageTracker("/", 2);
  return (
    <Layout>
      <Helmet>
        <link rel="preload" as="image" href="/founder/DSC3371.webp" type="image/webp" fetchPriority="high" />
        <link rel="preload" as="image" href="/founder/DSC3376.webp" type="image/webp" fetchPriority="high" />
      </Helmet>
      <SEO
        title="Jesus Christ Temple Ministry (JCTM) — Official Digital Sanctuary"
        description="Welcome to JCTM — Jesus Christ Temple Ministry, Warri Nigeria. Watch Temple TV sermons and rebroadcasts, give online, experience the Correction Mandate, and connect with Prophet Amos Evomobor's ministry."
        path="/"
        keywords="Jesus Christ Temple Ministry, JCTM, Temple TV, JCTM Warri Nigeria, Prophet Amos Evomobor, Correction Mandate, holiness church Nigeria, apostolic Christianity, Temple Ministry, primitive Christianity Nigeria, end time church Nigeria, holiness preaching"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": "JCTM Digital Sanctuary — Jesus Christ Temple Ministry Official Homepage",
            "url": "https://jctm.org.ng/",
            "description": "Official digital home of Jesus Christ Temple Ministry (JCTM), Warri Nigeria. Watch Temple TV sermons, give online, experience the Correction Mandate, and connect with Prophet Amos Evomobor.",
            "inLanguage": "en-NG",
            "speakable": {
              "@type": "SpeakableSpecification",
              "cssSelector": ["h1", "h2", ".speakable"]
            },
            "isPartOf": { "@type": "WebSite", "name": "JCTM Digital Sanctuary", "url": "https://jctm.org.ng" },
            "about": {
              "@type": "ReligiousOrganization",
              "name": "Jesus Christ Temple Ministry",
              "alternateName": ["JCTM", "Temple TV"]
            },
            "breadcrumb": {
              "@type": "BreadcrumbList",
              "itemListElement": [
                { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://jctm.org.ng/" }
              ]
            },
            "mainEntity": {
              "@type": "ReligiousOrganization",
              "name": "Jesus Christ Temple Ministry (JCTM)",
              "url": "https://jctm.org.ng",
              "sameAs": [
                "https://www.youtube.com/@TEMPLETVJCTM",
                "https://www.facebook.com/templetvjctm"
              ]
            }
          }
        ]}
      />
      <HeroSection />
      <EventPopupModal />
      <div className="container mx-auto px-4 py-4">
        <AdSlot slot={ADSENSE_SLOTS.homeHero} minHeight={120} className="mx-auto max-w-5xl" lazy={false} />
      </div>
      <TodayStrip />
      <PlatformBar />
      <DailyDevotionSection />
      <BentoGrid />
      <div className="container mx-auto px-4 py-8">
        <AdSlot slot={ADSENSE_SLOTS.homeMid} minHeight={250} className="mx-auto max-w-4xl" />
      </div>
      <TestimoniesMarquee />
      <ProphetSection />
      <MandateReveal />
      <SermonSpotlight />
      <RecentSermonsCarousel />
      <MinistryPillars />
      <ScriptureFeature />
      <EventsSection />
      <GlobalReach />
      <GlobalAltarSection />
      <GivingBand />
      <BlogPreviewSection />
      <AIAssistantTeaser />
      <PrayerWallSection />
      <NewsletterSection />
      <NewcomerSection />
      <ConnectSection />
      <TimelineTeaser />
    </Layout>
  );
}

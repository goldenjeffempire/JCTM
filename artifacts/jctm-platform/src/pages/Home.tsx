import { useEffect, useRef, useState } from "react";
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
  Youtube, Facebook, Mail, CheckCircle2, ChevronDown, ChevronUp,
  Tv, Award, TrendingUp, Zap,
} from "lucide-react";
import {
  useGetFeaturedSermon, getGetFeaturedSermonQueryKey,
  useGetUpcomingEvents, getGetUpcomingEventsQueryKey,
  useGetSermonStats, getGetSermonStatsQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const SCRIPTURES = [
  { verse: "\"The Bible Is Our Standard.\"", ref: "JCTM Core Mandate" },
  { verse: "\"Sanctify them through thy truth: thy word is truth.\"", ref: "John 17:17" },
  { verse: "\"Beloved, believe not every spirit, but try the spirits whether they are of God.\"", ref: "1 John 4:1" },
  { verse: "\"Stand ye in the ways, and see, and ask for the old paths, where is the good way.\"", ref: "Jeremiah 6:16" },
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

// ─── Animation Variants ────────────────────────────────────────────────────
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
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

// ─── Live Countdown ────────────────────────────────────────────────────────
function useNextService() {
  const [cd, setCd] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  useEffect(() => {
    const getNext = () => {
      const now = new Date();
      const d = new Date(now);
      const dow = now.getDay();
      d.setDate(now.getDate() + (dow === 0 ? (now.getHours() >= 9 ? 7 : 0) : 7 - dow));
      d.setHours(9, 0, 0, 0);
      return d;
    };
    const tick = () => {
      const diff = getNext().getTime() - Date.now();
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

// ═══════════════════════════════════════════════════════════════════════════
// HERO — Enhanced Light Sanctuary + Typewriter + Floating Metrics
// ═══════════════════════════════════════════════════════════════════════════
function HeroSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const yBg = useTransform(scrollYProgress, [0, 1], [0, 60]);
  const yOrbs = useTransform(scrollYProgress, [0, 1], [0, 90]);
  const yLogo = useTransform(scrollYProgress, [0, 1], [0, -25]);
  const yContent = useTransform(scrollYProgress, [0, 1], [0, 130]);
  const opacity = useTransform(scrollYProgress, [0, 0.75], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.08]);

  const typeword = useTypewriter([
    "Primitive Christianity.",
    "Scriptural Purity.",
    "True Worship.",
    "Doctrinal Correction.",
    "Apostolic Truth.",
  ]);

  const metrics = [
    { value: 479, suffix: "+", label: "Sermons" },
    { value: 40, suffix: "+", label: "Nations" },
    { value: 25, suffix: "yrs", label: "Ministry" },
  ];

  return (
    <section ref={ref} className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden" style={{ background: "#FFFEF8" }}>
      {/* Parallax BG */}
      <motion.div style={{ y: yBg, scale }} className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-[#FFFEF8] via-[#EEF4FF] to-[#DDE8FF]" />
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(ellipse 90% 60% at 50% -10%, rgba(56,189,248,0.14) 0%, transparent 65%)" }} />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(0,51,102,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,51,102,1) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
      </motion.div>

      {/* Orbs */}
      <motion.div style={{ y: yOrbs }} className="absolute inset-0 pointer-events-none">
        <motion.div animate={{ scale: [1, 1.18, 1], opacity: [0.5, 0.8, 0.5] }} transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }} className="absolute top-1/4 left-1/4 w-[520px] h-[520px] rounded-full" style={{ background: "radial-gradient(circle, rgba(56,189,248,0.13) 0%, transparent 70%)" }} />
        <motion.div animate={{ scale: [1, 1.22, 1], opacity: [0.3, 0.55, 0.3] }} transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 2 }} className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full" style={{ background: "radial-gradient(circle, rgba(0,51,102,0.09) 0%, transparent 70%)" }} />
        <motion.div animate={{ x: [0, 30, 0], y: [0, -20, 0] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} className="absolute top-20 right-20 w-4 h-4 bg-accent/30 rounded-full" />
        <motion.div animate={{ x: [0, -20, 0], y: [0, 30, 0] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }} className="absolute bottom-32 left-24 w-3 h-3 bg-primary/20 rounded-full" />
        <motion.div animate={{ x: [0, 15, 0], y: [0, 15, 0] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 3 }} className="absolute top-1/2 left-16 w-2 h-2 bg-accent/40 rounded-full" />
      </motion.div>

      <motion.div style={{ opacity }} className="container mx-auto px-4 relative z-10 text-center pt-12">
        <div className="max-w-5xl mx-auto">
          {/* Logo */}
          <motion.div style={{ y: yLogo }} className="mb-8 flex justify-center">
            <motion.div initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }} className="relative">
              <motion.div animate={{ scale: [1, 1.14, 1], opacity: [0.3, 0.65, 0.3] }} transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }} className="absolute inset-0 rounded-full blur-2xl scale-150" style={{ background: "rgba(56,189,248,0.28)" }} />
              <img src="/jctm-logo.jpeg" alt="JCTM" className="relative h-32 w-32 rounded-full object-cover ring-4 ring-accent/30 shadow-2xl" style={{ boxShadow: "0 0 60px rgba(56,189,248,0.25), 0 24px 60px rgba(0,51,102,0.15)" }} />
            </motion.div>
          </motion.div>

          {/* Content layer */}
          <motion.div style={{ y: yContent }}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <span className="inline-flex items-center gap-2 border border-primary/12 text-primary/65 px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-7 bg-white/60 backdrop-blur-sm shadow-sm">
                <Sparkles className="h-3 w-3 text-accent" />
                Jesus Christ Temple Ministry · Warri, Nigeria
              </span>
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.9, ease: [0.16, 1, 0.3, 1] }} className="text-6xl sm:text-7xl md:text-8xl lg:text-[5.5rem] font-serif font-bold text-primary mb-4 leading-[1.04] tracking-tight">
              The<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#003366] via-[#38BDF8] to-[#003366] animate-[shimmer_3s_linear_infinite]">
                Correction
              </span>
              <br />Mandate
            </motion.h1>

            {/* Typewriter subtitle */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mb-3 h-8 flex items-center justify-center">
              <span className="text-lg md:text-xl font-light text-primary/50">Restoring </span>
              <span className="text-lg md:text-xl font-semibold text-accent ml-2 min-w-[200px] text-left">
                {typeword}<span className="animate-[blink_1s_step-end_infinite] text-accent">|</span>
              </span>
            </motion.div>

            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} className="text-base md:text-lg text-primary/50 mb-8 max-w-xl mx-auto font-light leading-relaxed">
              Under the prophetic leadership of{" "}
              <span className="text-accent font-semibold">Prophet Amos Evomobor</span>{" "}
              — proclaiming the Good News from Warri to the world.
            </motion.p>

            <ScriptureTicker />

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85 }} className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-6 mb-10">
              <MagneticButton>
                <Link href="/sermons">
                  <Button size="lg" className="group h-14 px-10 rounded-full text-base font-semibold bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/25 transition-all duration-300 hover:-translate-y-0.5">
                    <Play className="h-4 w-4 mr-2 group-hover:scale-125 transition-transform fill-white" />
                    Experience the Word
                  </Button>
                </Link>
              </MagneticButton>
              <MagneticButton>
                <a href="https://www.youtube.com/templetvjctm" target="_blank" rel="noopener noreferrer">
                  <Button size="lg" variant="ghost" className="h-14 px-10 rounded-full text-base text-primary/70 hover:text-primary hover:bg-primary/5 border border-primary/12 transition-all duration-300">
                    <Youtube className="h-4 w-4 mr-2 text-red-500" /> Watch Live
                  </Button>
                </a>
              </MagneticButton>
            </motion.div>

            {/* Floating metric pills */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1 }} className="flex flex-wrap justify-center gap-4">
              {metrics.map((m, i) => (
                <motion.div key={i} animate={{ y: [0, -4, 0] }} transition={{ duration: 3.5 + i * 0.5, repeat: Infinity, ease: "easeInOut", delay: i * 0.4 }}
                  className="flex items-center gap-2.5 bg-white/80 backdrop-blur-sm border border-primary/10 px-5 py-2.5 rounded-2xl shadow-sm"
                >
                  <span className="font-serif font-bold text-primary text-xl"><AnimatedCounter target={m.value} suffix={m.suffix} /></span>
                  <span className="text-muted-foreground text-xs font-medium">{m.label}</span>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }} className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
        <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }} className="w-5 h-8 rounded-full border-2 border-primary/20 flex justify-center pt-1.5">
          <div className="w-1 h-2 rounded-full bg-accent" />
        </motion.div>
      </motion.div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PLATFORM BAR — Social proof strip
// ═══════════════════════════════════════════════════════════════════════════
function PlatformBar() {
  const platforms = [
    { icon: Youtube, label: "Temple TV", sub: "YouTube Channel", color: "#FF0000", href: "https://www.youtube.com/templetvjctm" },
    { icon: Facebook, label: "JCTM Live", sub: "Facebook Ministry", color: "#1877F2", href: "https://www.facebook.com/templetvjctm" },
    { icon: Tv, label: "Temple TV", sub: "Live Broadcasting", color: "#003366", href: "#" },
    { icon: Globe, label: "40+ Nations", sub: "Global Audience", color: "#38BDF8", href: "#" },
  ];
  return (
    <section className="py-0 border-b border-border bg-white">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4">
          {platforms.map((p, i) => (
            <motion.a key={i} href={p.href} target={p.href !== "#" ? "_blank" : undefined} rel="noopener noreferrer"
              initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              className="group flex items-center gap-3 px-6 py-5 border-r last:border-r-0 border-border hover:bg-primary/[0.03] transition-colors duration-200"
            >
              <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 duration-200" style={{ background: `${p.color}18` }}>
                <p.icon className="h-4 w-4" style={{ color: p.color }} />
              </div>
              <div>
                <p className="text-primary font-semibold text-sm leading-tight">{p.label}</p>
                <p className="text-muted-foreground text-[11px]">{p.sub}</p>
              </div>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BENTO GRID — 5-card layout
// ═══════════════════════════════════════════════════════════════════════════
function BentoGrid() {
  const { data: sermon, isLoading: sermonLoading } = useGetFeaturedSermon({ query: { queryKey: getGetFeaturedSermonQueryKey() } });
  const { data: stats } = useGetSermonStats({ query: { queryKey: getGetSermonStatsQueryKey() } });
  const countdown = useNextService();
  const [testimony, setTestimony] = useState<{ name?: string; content?: string; category?: string } | null>(null);

  useEffect(() => {
    fetch(`${BASE}/api/testimonies?limit=1`).then(r => r.json())
      .then((d: { name?: string; content?: string; category?: string }[]) => { if (d?.[0]) setTestimony(d[0]); })
      .catch(() => {});
  }, []);

  const ytId = (sermon as { videoId?: string })?.videoId;

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-10">
          <span className="text-accent text-xs font-bold uppercase tracking-widest flex items-center gap-2 mb-2">
            <span className="h-px w-6 bg-accent inline-block" /> Digital Sanctuary
          </span>
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-primary">Today's Highlights</h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 auto-rows-auto">
          {/* Card 1: Latest Sermon — large */}
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="md:col-span-7">
            <TiltCard>
              <div className="rounded-3xl overflow-hidden border border-border bg-white shadow-sm hover:shadow-2xl transition-shadow duration-500 group h-full">
                {sermonLoading ? (
                  <><Skeleton className="aspect-video w-full" /><div className="p-5"><Skeleton className="h-4 w-3/4 mb-2" /><Skeleton className="h-3 w-1/3" /></div></>
                ) : sermon ? (
                  <>
                    <div className="relative overflow-hidden" style={{ aspectRatio: "16/9" }}>
                      <img src={sermon.thumbnailUrl} alt={sermon.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        onError={(e) => { (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`; }} />
                      <div className="absolute inset-0 bg-gradient-to-t from-primary/85 via-primary/15 to-transparent" />
                      <a href={ytId ? `https://www.youtube.com/watch?v=${ytId}` : "#"} target="_blank" rel="noopener noreferrer" className="absolute inset-0 flex items-end p-6">
                        <div>
                          <span className="text-accent text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 mb-2"><span className="h-1.5 w-1.5 bg-accent rounded-full" />Latest Broadcast</span>
                          <h3 className="text-white font-serif font-bold text-xl leading-snug mb-3 line-clamp-2">{sermon.title}</h3>
                          <div className="flex items-center gap-2">
                            <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                              <Play className="h-4 w-4 text-white fill-white ml-0.5" />
                            </div>
                            <span className="text-white/60 text-xs">Watch on YouTube</span>
                          </div>
                        </div>
                      </a>
                    </div>
                    <div className="p-5 flex items-center justify-between">
                      <p className="text-muted-foreground text-xs">Published {formatDistanceToNow(new Date(sermon.publishedAt), { addSuffix: true })}</p>
                      <Badge variant="secondary" className="text-[10px] rounded-full">Featured Message</Badge>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center aspect-video text-muted-foreground">
                    <BookOpen className="h-10 w-10 opacity-20" />
                  </div>
                )}
              </div>
            </TiltCard>
          </motion.div>

          {/* Right column: 3 stacked cards */}
          <div className="md:col-span-5 flex flex-col gap-5">
            {/* Live Countdown */}
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}>
              <TiltCard>
                <div className="rounded-3xl border border-border bg-primary text-white p-6 shadow-sm hover:shadow-2xl transition-shadow duration-500 relative overflow-hidden">
                  <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "radial-gradient(circle at 90% 10%, #38BDF8 0%, transparent 55%)" }} />
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-8 w-8 rounded-xl bg-accent/20 flex items-center justify-center"><Clock className="h-4 w-4 text-accent" /></div>
                      <div><p className="text-white/80 text-xs font-bold uppercase tracking-widest">Next Service</p><p className="text-white/45 text-[10px]">Sunday · 9:00 AM WAT</p></div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mb-4">
                      {[{ v: countdown.days, l: "Days" }, { v: countdown.hours, l: "Hrs" }, { v: countdown.minutes, l: "Min" }, { v: countdown.seconds, l: "Sec" }].map(({ v, l }) => (
                        <div key={l} className="bg-white/10 rounded-xl p-2 text-center">
                          <AnimatePresence mode="wait">
                            <motion.div key={v} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 8, opacity: 0 }} transition={{ duration: 0.2 }} className="text-xl font-serif font-bold text-white">{String(v).padStart(2, "0")}</motion.div>
                          </AnimatePresence>
                          <p className="text-white/45 text-[9px] uppercase tracking-widest">{l}</p>
                        </div>
                      ))}
                    </div>
                    <Link href="/events">
                      <Button size="sm" className="w-full rounded-xl bg-accent hover:bg-accent/90 text-white text-xs h-9 min-h-[44px]"><Radio className="h-3 w-3 mr-1.5" />Join Live</Button>
                    </Link>
                  </div>
                </div>
              </TiltCard>
            </motion.div>

            {/* Testimony */}
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.18 }} className="flex-1">
              <TiltCard className="h-full">
                <div className="rounded-3xl border border-border bg-gradient-to-br from-sky-50 to-blue-50/60 p-6 h-full shadow-sm hover:shadow-2xl transition-shadow duration-500 relative overflow-hidden flex flex-col">
                  <div className="absolute top-3 right-3 opacity-8"><Quote className="h-14 w-14 text-primary" /></div>
                  <div className="flex items-center gap-2 mb-3 relative z-10">
                    <div className="h-8 w-8 rounded-xl bg-accent/15 flex items-center justify-center"><MessageSquare className="h-4 w-4 text-accent" /></div>
                    <p className="text-primary text-xs font-bold uppercase tracking-widest">Testimony</p>
                  </div>
                  <p className="text-primary/70 text-sm leading-relaxed italic flex-1 line-clamp-4 relative z-10">
                    "{testimony?.content ?? FALLBACK_TESTIMONIES[0].content}"
                  </p>
                  <div className="mt-3 flex items-center justify-between relative z-10">
                    <span className="text-primary font-semibold text-xs">— {testimony?.name ?? FALLBACK_TESTIMONIES[0].name}</span>
                    <Link href="/testimonies"><Button size="sm" variant="ghost" className="text-accent text-xs h-7 px-2 hover:bg-accent/10">More →</Button></Link>
                  </div>
                </div>
              </TiltCard>
            </motion.div>

            {/* Impact numbers mini card */}
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.26 }}>
              <div className="rounded-3xl border border-border bg-white p-5 shadow-sm hover:shadow-lg transition-shadow duration-300">
                <p className="text-primary text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5 text-accent" />Ministry Impact</p>
                <div className="grid grid-cols-3 gap-2">
                  {[{ v: stats?.total ?? 479, s: "+", l: "Sermons" }, { v: stats?.totalViews ?? 2951335, s: "", l: "Views" }, { v: 40, s: "+", l: "Nations" }].map((m, i) => (
                    <div key={i} className="text-center">
                      <div className="text-lg font-serif font-bold text-primary"><AnimatedCounter target={m.v} suffix={m.s} /></div>
                      <div className="text-[10px] text-muted-foreground">{m.l}</div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTIMONIES MARQUEE — Infinite scroll, two rows
// ═══════════════════════════════════════════════════════════════════════════
function TestimoniesMarquee() {
  const [testimonies, setTestimonies] = useState(FALLBACK_TESTIMONIES);
  useEffect(() => {
    fetch(`${BASE}/api/testimonies?limit=12`)
      .then(r => r.json())
      .then((d: typeof FALLBACK_TESTIMONIES) => { if (d?.length >= 4) setTestimonies(d); })
      .catch(() => {});
  }, []);

  const row1 = [...testimonies, ...testimonies];
  const row2 = [...testimonies.slice().reverse(), ...testimonies.slice().reverse()];

  return (
    <section className="py-20 bg-gradient-to-b from-[#f0f6ff]/60 to-white overflow-hidden">
      <div className="container mx-auto px-4 mb-10">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center">
          <span className="text-accent text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 mb-3">
            <span className="h-px w-6 bg-accent inline-block" /> Testimony Vault <span className="h-px w-6 bg-accent inline-block" />
          </span>
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-primary mb-2">God Is Faithful</h2>
          <p className="text-muted-foreground text-base max-w-lg mx-auto">Stories of transformation from the JCTM Digital Sanctuary community.</p>
        </motion.div>
      </div>

      {/* Row 1 — left to right */}
      <div className="flex overflow-hidden mb-4">
        <div className="flex gap-4 animate-marquee hover:pause-animation shrink-0">
          {row1.map((t, i) => (
            <div key={i} className="shrink-0 w-72 bg-white rounded-2xl border border-border p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3 mb-3">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-accent to-primary/80 flex items-center justify-center shrink-0 text-white font-bold text-sm">
                  {t.name?.[0] ?? "?"}
                </div>
                <div>
                  <p className="text-primary font-semibold text-sm">{t.name}</p>
                  <Badge variant="secondary" className="text-[10px] rounded-full mt-0.5">{t.category}</Badge>
                </div>
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed line-clamp-4 italic">"{t.content}"</p>
              <div className="flex mt-3 gap-0.5">{[...Array(5)].map((_, i) => <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Row 2 — right to left */}
      <div className="flex overflow-hidden">
        <div className="flex gap-4 animate-marquee-reverse hover:pause-animation shrink-0">
          {row2.map((t, i) => (
            <div key={i} className="shrink-0 w-72 bg-white rounded-2xl border border-border p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3 mb-3">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-accent/80 flex items-center justify-center shrink-0 text-white font-bold text-sm">
                  {t.name?.[0] ?? "?"}
                </div>
                <div>
                  <p className="text-primary font-semibold text-sm">{t.name}</p>
                  <Badge variant="secondary" className="text-[10px] rounded-full mt-0.5">{t.category}</Badge>
                </div>
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed line-clamp-4 italic">"{t.content}"</p>
              <div className="flex mt-3 gap-0.5">{[...Array(5)].map((_, i) => <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-center mt-10">
        <MagneticButton>
          <Link href="/testimonies">
            <Button variant="outline" className="rounded-full px-8 border-primary/20 text-primary hover:bg-primary hover:text-white transition-all">
              View All Testimonies <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </MagneticButton>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PROPHET SECTION — About Prophet Amos, split layout
// ═══════════════════════════════════════════════════════════════════════════
function ProphetSection() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15%" });

  const credentials = [
    { icon: Award, label: "25+ Years in Ministry" },
    { icon: Mic2, label: "Verified Prophetic Office" },
    { icon: BookOpen, label: "Apostolic Teacher" },
    { icon: Globe, label: "International Broadcaster" },
  ];

  return (
    <section ref={ref} className="py-28 bg-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: "radial-gradient(circle at 80% 50%, #003366 0%, transparent 60%)" }} />
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Visual */}
          <motion.div initial={{ opacity: 0, x: -50 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}>
            <div className="relative max-w-md mx-auto">
              {/* Main card */}
              <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-primary via-[#003d80] to-[#001a40] p-10 text-white shadow-2xl">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 30% 70%, #38BDF8 0%, transparent 60%)" }} />
                <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />

                {/* Avatar */}
                <div className="relative z-10 flex flex-col items-center text-center mb-8">
                  <div className="relative mb-4">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="absolute -inset-1.5 rounded-full" style={{ background: "conic-gradient(from 0deg, #38BDF8, #003366, #38BDF8)" }} />
                    <div className="relative h-24 w-24 rounded-full bg-gradient-to-br from-[#38BDF8] to-[#0284C7] flex items-center justify-center text-white font-serif font-bold text-5xl shadow-xl">
                      A
                    </div>
                  </div>
                  <h3 className="text-2xl font-serif font-bold text-white mb-0.5">Prophet Amos Evomobor</h3>
                  <p className="text-accent text-sm font-medium">Founder & Senior Prophet, JCTM</p>
                  <p className="text-white/50 text-xs mt-1">Warri, Delta State, Nigeria</p>
                </div>

                {/* Pull quote */}
                <div className="relative z-10 border-t border-white/10 pt-6">
                  <Quote className="h-6 w-6 text-accent/50 mb-2" />
                  <p className="text-white/75 text-sm leading-relaxed italic">
                    "God has sent me not to start a new church, but to call His people back to what was already established — the New Testament standard."
                  </p>
                  <p className="text-accent text-xs font-semibold mt-3">— Prophet Amos Evomobor</p>
                </div>
              </div>

              {/* Floating badge cards */}
              <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-4 -right-4 bg-white rounded-2xl shadow-xl border border-border p-3 flex items-center gap-2"
              >
                <Zap className="h-5 w-5 text-accent" />
                <div><p className="text-primary text-xs font-bold">Prophetic Office</p><p className="text-muted-foreground text-[10px]">Verified Ministry</p></div>
              </motion.div>
              <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute -bottom-4 -left-4 bg-white rounded-2xl shadow-xl border border-border p-3 flex items-center gap-2"
              >
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <div><p className="text-primary text-xs font-bold">25+ Years</p><p className="text-muted-foreground text-[10px]">Faithful Ministry</p></div>
              </motion.div>
            </div>
          </motion.div>

          {/* Right: Bio */}
          <motion.div variants={stagger} initial="hidden" animate={inView ? "show" : "hidden"}>
            <motion.div variants={fadeUp}>
              <span className="inline-flex items-center gap-2 text-accent text-xs font-bold uppercase tracking-widest mb-5">
                <span className="h-px w-8 bg-accent inline-block" /> The Prophetic Voice
              </span>
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-serif font-bold text-primary mb-6 leading-tight">
              A Voice Crying in the{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-[#0284C7]">Wilderness</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="text-muted-foreground leading-relaxed mb-4">
              Prophet Amos Evomobor received a sovereign divine mandate to correct the church from within — not through rebellion, but through the clear light of scripture. He established the Jesus Christ Temple Ministry in Warri, Nigeria as the base for this global corrective mission.
            </motion.p>
            <motion.p variants={fadeUp} className="text-muted-foreground leading-relaxed mb-8">
              His ministry is marked by expository preaching, the manifestation of signs, and an uncompromising stand against false doctrines — particularly the prosperity gospel, prophetic manipulation, and spiritual exploitation that pervades modern Christianity.
            </motion.p>

            {/* Credentials grid */}
            <motion.div variants={stagger} className="grid grid-cols-2 gap-3 mb-8">
              {credentials.map(({ icon: Icon, label }, i) => (
                <motion.div key={i} variants={fadeUp} className="flex items-center gap-3 p-3 rounded-xl bg-primary/[0.04] border border-primary/8">
                  <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0"><Icon className="h-4 w-4 text-accent" /></div>
                  <span className="text-primary text-sm font-medium">{label}</span>
                </motion.div>
              ))}
            </motion.div>

            <motion.div variants={fadeUp}>
              <MagneticButton>
                <Link href="/about">
                  <Button className="rounded-full px-8 h-12 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20">
                    Learn About the Ministry <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </MagneticButton>
            </motion.div>
          </motion.div>
        </div>
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

  return (
    <section ref={ref} className="relative py-40 overflow-hidden" style={{ background: "#020b18" }}>
      <motion.div style={{ scale: bgScale }} className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#001830] to-[#020b18]" />
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, rgba(56,189,248,0.1) 0%, transparent 60%), radial-gradient(circle at 80% 50%, rgba(0,51,102,0.2) 0%, transparent 60%)" }} />
        <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "radial-gradient(circle, rgba(56,189,248,0.4) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
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
  const { data: sermon, isLoading } = useGetFeaturedSermon({ query: { queryKey: getGetFeaturedSermonQueryKey() } });
  const [playing, setPlaying] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const ytId = (sermon as { videoId?: string })?.videoId;

  return (
    <section ref={ref} className="py-28 bg-background">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div variants={stagger} initial="hidden" animate={inView ? "show" : "hidden"}>
            <motion.div variants={fadeUp}>
              <span className="inline-flex items-center gap-2 text-accent text-xs font-bold uppercase tracking-widest mb-5"><span className="h-px w-8 bg-accent inline-block" />Latest Broadcast</span>
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
                    Browse All 479 Sermons <ChevronRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </MagneticButton>
            </motion.div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 40 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}>
            {isLoading ? (
              <div className="rounded-3xl overflow-hidden shadow-2xl"><Skeleton className="aspect-video w-full" /><div className="p-6 bg-primary"><Skeleton className="h-3 w-24 bg-white/10 mb-3" /><Skeleton className="h-6 w-full bg-white/10 mb-2" /><Skeleton className="h-6 w-3/4 bg-white/10 mb-4" /><div className="flex gap-3"><Skeleton className="h-10 flex-1 bg-white/10 rounded-xl" /><Skeleton className="h-10 w-20 bg-white/10 rounded-xl" /></div></div></div>
            ) : sermon ? (
              <TiltCard>
                <div className="relative group">
                  <div className="absolute -inset-4 bg-gradient-to-r from-accent/15 to-primary/15 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative rounded-3xl overflow-hidden shadow-2xl bg-primary">
                    {playing && ytId ? (
                      <iframe className="w-full aspect-video" src={`https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0`} allow="autoplay; fullscreen" allowFullScreen title={sermon.title} />
                    ) : (
                      <>
                        <div className="aspect-video relative overflow-hidden">
                          <img src={sermon.thumbnailUrl} alt={sermon.title} className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700" onError={(e) => { (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`; }} />
                          <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/20 to-transparent" />
                          {(sermon as { isLive?: boolean }).isLive && (
                            <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full"><span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-white" /></span>LIVE NOW</div>
                          )}
                          <button onClick={() => setPlaying(true)} className="absolute inset-0 flex items-center justify-center" aria-label="Play sermon">
                            <motion.div whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.95 }} className="h-20 w-20 bg-accent rounded-full flex items-center justify-center shadow-2xl shadow-accent/50 ring-4 ring-white/20">
                              <Play className="h-9 w-9 text-white fill-white ml-1" />
                            </motion.div>
                          </button>
                        </div>
                        <div className="p-6 bg-primary text-white">
                          <span className="text-accent text-xs font-bold uppercase tracking-widest">Featured Message</span>
                          <h3 className="text-xl font-serif font-bold mt-2 mb-1 leading-tight line-clamp-2">{sermon.title}</h3>
                          <p className="text-white/50 text-xs mb-4">{formatDistanceToNow(new Date(sermon.publishedAt), { addSuffix: true })}</p>
                          <div className="flex gap-3">
                            <button onClick={() => setPlaying(true)} className="flex-1 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors flex items-center justify-center gap-2"><Play className="h-4 w-4 fill-white" />Watch Now</button>
                            {ytId && <a href={`https://www.youtube.com/watch?v=${ytId}`} target="_blank" rel="noopener noreferrer" className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors flex items-center gap-1.5 text-white text-sm"><ExternalLink className="h-3.5 w-3.5" />YouTube</a>}
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
function RecentSermonsCarousel() {
  const [sermons, setSermons] = useState<{ id: number; videoId: string; title: string; thumbnailUrl: string; publishedAt: string; isFeatured?: boolean; isLive?: boolean; }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    fetch(`${BASE}/api/sermons?limit=12&offset=0`).then(r => r.json())
      .then(d => { setSermons(d); setIsLoading(false); })
      .catch(() => setIsLoading(false));
  }, []);

  return (
    <section className="py-20 bg-secondary/30">
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
              <motion.a key={s.id} href={`https://www.youtube.com/watch?v=${s.videoId}`} target="_blank" rel="noopener noreferrer"
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05, duration: 0.5 }} whileHover={{ y: -4 }}
                className={`shrink-0 w-72 rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-xl transition-all duration-300 snap-start group ${s.isLive ? "ring-2 ring-red-400" : s.isFeatured ? "ring-1 ring-accent/40" : ""}`}
              >
                <div className="relative aspect-video overflow-hidden">
                  <img src={s.thumbnailUrl} alt={s.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={(e) => { (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${s.videoId}/hqdefault.jpg`; }} loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  {s.isLive && <div className="absolute top-2 left-2 flex items-center gap-1 bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full"><span className="h-1.5 w-1.5 bg-white rounded-full animate-ping inline-block" />LIVE</div>}
                  {!s.isLive && s.isFeatured && <div className="absolute top-2 left-2 flex items-center gap-1 bg-accent text-white text-[9px] font-bold px-2 py-0.5 rounded-full"><Star className="h-2.5 w-2.5 fill-white" />Featured</div>}
                  <div className="absolute bottom-3 right-3 h-9 w-9 rounded-full bg-accent/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"><Play className="h-4 w-4 text-white fill-white ml-0.5" /></div>
                </div>
                <div className="p-4">
                  <p className="text-primary font-semibold text-sm line-clamp-2 leading-snug mb-2">{s.title}</p>
                  <p className="text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(s.publishedAt), { addSuffix: true })}</p>
                </div>
              </motion.a>
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
    { icon: BookOpen, title: "The Bible Is Our Standard", desc: "Every doctrine, every practice, every correction is measured strictly against the Word of God. No tradition can override Scripture.", gradient: "from-blue-600 to-[#003366]", scripture: "\"All scripture is given by inspiration of God...\" — 2 Tim 3:16" },
    { icon: ShieldCheck, title: "Doctrinal Correction", desc: "Standing against false doctrines — prosperity gospel, prophetic manipulation, and spiritual abuse — restoring the apostolic standard.", gradient: "from-[#38BDF8] to-[#0284C7]", scripture: "\"Contend earnestly for the faith...\" — Jude 1:3" },
    { icon: Flame, title: "Holiness & Purity", desc: "We preach genuine holiness of heart, mind, and conduct, as set forth in the New Testament and modelled by the early church.", gradient: "from-orange-500 to-red-600", scripture: "\"Follow peace with all men, and holiness...\" — Heb 12:14" },
    { icon: Mic2, title: "Prophetic Ministry", desc: "Prophet Amos Evomobor operates under a verified prophetic anointing, bringing divine messages and confirmatory signs.", gradient: "from-purple-600 to-violet-800", scripture: "\"Believe his prophets, so shall ye prosper.\" — 2 Chr 20:20" },
    { icon: Radio, title: "Temple TV Broadcasts", desc: "Live and recorded services streamed globally via Temple TV on YouTube — making the Correction Mandate accessible worldwide.", gradient: "from-red-500 to-rose-700", scripture: "\"Go ye into all the world...\" — Mark 16:15" },
    { icon: Heart, title: "Community & Welfare", desc: "We care for our members and community through prayer, fellowship, counselling, and practical support in Christ's name.", gradient: "from-emerald-500 to-teal-700", scripture: "\"Bear ye one another's burdens...\" — Gal 6:2" },
  ];

  return (
    <section className="py-28 bg-background">
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
// SCRIPTURE FEATURE — Full-width typographic section
// ═══════════════════════════════════════════════════════════════════════════
function ScriptureFeature() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [-30, 30]);

  return (
    <section ref={ref} className="relative py-32 overflow-hidden bg-gradient-to-br from-[#001830] via-[#003366] to-[#001830]">
      <motion.div style={{ y, backgroundImage: "radial-gradient(circle, rgba(56,189,248,0.4) 1px, transparent 1px)", backgroundSize: "48px 48px" }} className="absolute inset-0 opacity-10" />
      <div className="container mx-auto px-4 relative z-10 text-center">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.8 }}>
          <div className="text-accent/40 text-[120px] font-serif leading-none -mb-8 select-none">"</div>
          <blockquote className="text-3xl md:text-5xl lg:text-6xl font-serif font-bold text-white leading-tight max-w-4xl mx-auto">
            Stand ye in the ways, and see, and ask for the old paths, where is the good way, and walk therein.
          </blockquote>
          <div className="text-accent/40 text-[120px] font-serif leading-none -mt-8 select-none rotate-180">"</div>
          <p className="text-accent font-semibold text-lg mt-2">Jeremiah 6:16</p>
          <p className="text-white/40 text-sm mt-2">The foundational scripture of the Correction Mandate</p>
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
  const { data: events, isLoading } = useGetUpcomingEvents({ query: { queryKey: getGetUpcomingEventsQueryKey() } });
  return (
    <section className="py-28 bg-gradient-to-b from-[#f0f6ff] to-white">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-end mb-14 gap-6">
          <div>
            <span className="text-accent text-xs font-bold uppercase tracking-widest flex items-center gap-2 mb-3"><span className="h-px w-6 bg-accent inline-block" />Gatherings</span>
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-primary">Gather With Us</h2>
            <p className="text-muted-foreground mt-3 text-lg max-w-md">Experience transformation through our weekly services and special prophetic encounters.</p>
          </div>
          <Link href="/events"><Button variant="outline" className="rounded-full px-7 group border-primary/20">Browse Calendar <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" /></Button></Link>
        </div>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="bg-white rounded-3xl p-8 shadow-sm border border-border"><Skeleton className="h-16 w-20 rounded-2xl mb-6" /><Skeleton className="h-6 w-full mb-3" /><Skeleton className="h-4 w-3/4 mb-2" /><Skeleton className="h-4 w-1/2 mb-6" /><Skeleton className="h-10 w-full rounded-xl" /></div>)}
          </div>
        ) : events && events.length > 0 ? (
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {events.slice(0, 3).map((event) => {
              const date = new Date(event.startDate);
              return (
                <motion.div key={event.id} variants={fadeUp}>
                  <TiltCard>
                    <div className="bg-white rounded-3xl p-8 shadow-sm hover:shadow-2xl transition-all duration-300 border border-border group relative overflow-hidden h-full">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent to-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="flex justify-between items-start mb-6">
                        <div className="bg-gradient-to-br from-accent to-[#0284C7] p-4 rounded-2xl text-center min-w-[70px] text-white shadow-lg shadow-accent/20">
                          <span className="block text-white/80 font-bold text-[10px] uppercase">{format(date, "MMM")}</span>
                          <span className="block font-serif font-bold text-4xl leading-none">{format(date, "dd")}</span>
                        </div>
                        <Badge variant="secondary" className="rounded-full text-xs">{event.eventType}</Badge>
                      </div>
                      <h3 className="text-xl font-bold text-primary mb-3 leading-tight group-hover:text-accent transition-colors">{event.title}</h3>
                      <div className="space-y-2 mb-6 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-accent" />{format(date, "EEEE, h:mm a")}</div>
                        <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-accent" />{event.location || "Main Sanctuary, Warri"}</div>
                      </div>
                      <Button className="w-full rounded-xl bg-primary/5 text-primary hover:bg-primary hover:text-white border-none shadow-none transition-all duration-200">Event Details</Button>
                    </div>
                  </TiltCard>
                </motion.div>
              );
            })}
          </motion.div>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>No upcoming events at this time. Check back soon.</p>
          </div>
        )}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL REACH — Impact visualization
// ═══════════════════════════════════════════════════════════════════════════
function GlobalReach() {
  const { data: stats } = useGetSermonStats({ query: { queryKey: getGetSermonStatsQueryKey() } });

  const impacts = [
    { value: stats?.total ?? 479, suffix: "+", label: "Sermons Preached", icon: Mic2 },
    { value: stats?.totalViews ?? 2951335, suffix: "", label: "YouTube Views", icon: Youtube },
    { value: 40, suffix: "+", label: "Nations Reached", icon: Globe },
    { value: 25, suffix: "+", label: "Years of Ministry", icon: Award },
  ];

  const regions = [
    { name: "West Africa", icon: "🌍", highlight: true },
    { name: "East Africa", icon: "🌍" },
    { name: "UK & Europe", icon: "🌍" },
    { name: "United States", icon: "🌎" },
    { name: "Canada", icon: "🌎" },
    { name: "Caribbean", icon: "🌎" },
    { name: "Asia Pacific", icon: "🌏" },
    { name: "Middle East", icon: "🌍" },
  ];

  return (
    <section className="py-28 relative overflow-hidden" style={{ background: "#020b18" }}>
      <div className="absolute inset-0">
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 50% 50%, rgba(0,51,102,0.4) 0%, transparent 70%)" }} />
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "linear-gradient(rgba(56,189,248,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.5) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }} className="text-center mb-16">
          <motion.span variants={fadeUp} className="inline-flex items-center gap-2 border border-accent/30 text-accent px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6 bg-accent/10">
            <Globe className="h-3 w-3" /> Global Impact
          </motion.span>
          <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-serif font-bold text-white mb-4">Reaching the World</motion.h2>
          <motion.p variants={fadeUp} className="text-white/50 text-lg max-w-2xl mx-auto">
            Temple TV broadcasts the Correction Mandate to every corner of the earth — from Warri to the world.
          </motion.p>
        </motion.div>

        {/* Impact numbers */}
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }} className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
          {impacts.map(({ value, suffix, label, icon: Icon }, i) => (
            <motion.div key={i} variants={fadeUp}>
              <TiltCard>
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 text-center group hover:bg-white/10 transition-colors duration-300 hover:border-accent/30">
                  <div className="h-10 w-10 rounded-2xl bg-accent/15 flex items-center justify-center mx-auto mb-4 group-hover:bg-accent/25 transition-colors">
                    <Icon className="h-5 w-5 text-accent" />
                  </div>
                  <div className="text-4xl md:text-5xl font-serif font-bold text-white mb-2">
                    <AnimatedCounter target={value} suffix={suffix} />
                  </div>
                  <p className="text-white/50 text-xs uppercase tracking-wider font-medium">{label}</p>
                </div>
              </TiltCard>
            </motion.div>
          ))}
        </motion.div>

        {/* Regions */}
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center">
          <p className="text-white/40 text-sm uppercase tracking-widest mb-5 font-medium">Regions Reached</p>
          <div className="flex flex-wrap gap-3 justify-center">
            {regions.map((r, i) => (
              <motion.span key={i} initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-colors ${r.highlight ? "bg-accent/20 border-accent/40 text-accent" : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:border-white/20"}`}
              >
                <span>{r.icon}</span> {r.name}
              </motion.span>
            ))}
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
  useEffect(() => { if (inView) window.dispatchEvent(new CustomEvent("jctm:section-enter", { detail: "giving" })); }, [inView]);

  const givingOptions = [
    { label: "Tithe", desc: "Ten percent returned to God", icon: "🌿" },
    { label: "Offerings", desc: "Freewill giving from the heart", icon: "✨" },
    { label: "Missions", desc: "Support global broadcasting", icon: "🌍" },
  ];

  return (
    <section ref={ref} className="py-28 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #001a40 0%, #003d80 50%, #001a40 100%)" }}>
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "repeating-linear-gradient(45deg, rgba(56,189,248,0.3) 0px, rgba(56,189,248,0.3) 1px, transparent 1px, transparent 16px)" }} />
      <div className="container mx-auto px-4 relative z-10">
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }} className="text-center mb-12">
          <motion.span variants={fadeUp} className="inline-flex items-center gap-2 border border-accent/30 text-accent px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6 bg-accent/10">
            <Heart className="h-3 w-3 fill-accent" /> Partner With Us
          </motion.span>
          <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-serif font-bold text-white mb-4">Partner With the Mandate</motion.h2>
          <motion.p variants={fadeUp} className="text-white/60 text-lg max-w-xl mx-auto leading-relaxed">
            Your giving fuels the global spread of the Correction Mandate. "The Lord loveth a cheerful giver." — 2 Cor 9:7
          </motion.p>
        </motion.div>

        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }} className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
          {givingOptions.map(({ label, desc, icon }, i) => (
            <motion.div key={i} variants={fadeUp}>
              <TiltCard>
                <div className="bg-white/8 border border-white/12 rounded-2xl p-6 text-center hover:bg-white/12 transition-colors group">
                  <div className="text-3xl mb-3">{icon}</div>
                  <h3 className="text-white font-bold text-lg mb-1">{label}</h3>
                  <p className="text-white/50 text-sm">{desc}</p>
                </div>
              </TiltCard>
            </motion.div>
          ))}
        </motion.div>

        <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} className="flex flex-col sm:flex-row gap-4 justify-center">
          <MagneticButton>
            <Link href="/give">
              <Button size="lg" className="h-14 px-12 rounded-full bg-accent hover:bg-accent/90 text-white font-bold text-base shadow-xl shadow-accent/30 min-h-[44px]">
                <Heart className="mr-2 h-5 w-5 fill-white" /> Give Now
              </Button>
            </Link>
          </MagneticButton>
          <Link href="/testimonies">
            <Button size="lg" variant="ghost" className="h-14 px-10 rounded-full text-white border border-white/20 hover:bg-white/10 min-h-[44px]">
              Read Testimonies <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
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
    { icon: MapPin, title: "Find a Branch", desc: "Our headquarters is in Warri. Connect with our services in person or online.", href: "/about", cta: "Get Directions" },
    { icon: Users, title: "Join a Unit", desc: "Become part of the worshipping community and get involved in ministry.", href: "/join", cta: "Get Involved" },
  ];

  return (
    <section ref={ref} className="py-28 bg-white">
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
    { name: "Email Us", sub: "jesuschristtempleministryng@gmail.com", icon: Mail, color: "#003366", bg: "from-sky-50 to-blue-50", border: "border-sky-100", href: "mailto:jesuschristtempleministryng@gmail.com" },
  ];

  return (
    <section className="py-20 bg-gradient-to-b from-white to-[#f0f6ff]/50">
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

        {/* Location card */}
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="max-w-md mx-auto">
          <div className="bg-white border border-border rounded-2xl p-6 flex items-center gap-4 shadow-sm">
            <div className="h-12 w-12 rounded-2xl bg-primary/8 flex items-center justify-center shrink-0"><MapPin className="h-6 w-6 text-primary" /></div>
            <div>
              <p className="text-primary font-bold text-sm">Headquarters</p>
              <p className="text-muted-foreground text-xs leading-relaxed">Ebrumede, Warri, Delta State, Nigeria<br />Sunday Services · 9:00 AM WAT</p>
            </div>
            <a href="https://maps.google.com/?q=Warri,+Delta+State,+Nigeria" target="_blank" rel="noopener noreferrer" className="ml-auto">
              <Button size="sm" variant="outline" className="rounded-full text-xs border-primary/20 min-h-[44px]">Directions</Button>
            </a>
          </div>
        </motion.div>
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
// PAGE ASSEMBLY
// ═══════════════════════════════════════════════════════════════════════════
export default function Home() {
  return (
    <Layout>
      <HeroSection />
      <PlatformBar />
      <BentoGrid />
      <TestimoniesMarquee />
      <ProphetSection />
      <MandateReveal />
      <SermonSpotlight />
      <RecentSermonsCarousel />
      <MinistryPillars />
      <ScriptureFeature />
      <EventsSection />
      <GlobalReach />
      <GivingBand />
      <NewcomerSection />
      <ConnectSection />
      <TimelineTeaser />
    </Layout>
  );
}

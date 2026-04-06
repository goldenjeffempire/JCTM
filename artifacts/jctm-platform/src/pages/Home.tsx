import { useEffect, useRef, useState, useCallback } from "react";
import {
  motion, Variants, useScroll, useTransform, useInView,
  AnimatePresence, useMotionValue, useSpring,
} from "framer-motion";
import { format, formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import {
  PlayCircle, Calendar, ArrowRight,
  MapPin, ShieldCheck, Flame, Users,
  Radio, BookOpen, Heart, Sparkles, ChevronRight,
  Globe, Star, Mic2, Play, ExternalLink, Clock,
  MessageSquare, Quote,
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

// ─── Animation Variants ────────────────────────────────────────────────────
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
};

const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.6 } },
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

// ─── Magnetic Button ───────────────────────────────────────────────────────
function MagneticButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 180, damping: 12 });
  const springY = useSpring(y, { stiffness: 180, damping: 12 });

  const handleMouse = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    x.set((e.clientX - cx) * 0.4);
    y.set((e.clientY - cy) * 0.4);
  };

  const reset = () => { x.set(0); y.set(0); };

  return (
    <motion.div
      ref={ref}
      style={{ x: springX, y: springY }}
      onMouseMove={handleMouse}
      onMouseLeave={reset}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Tilt Card ─────────────────────────────────────────────────────────────
function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const rotX = useMotionValue(0);
  const rotY = useMotionValue(0);
  const springRotX = useSpring(rotX, { stiffness: 200, damping: 18 });
  const springRotY = useSpring(rotY, { stiffness: 200, damping: 18 });

  const handleMouse = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    const px = (e.clientX - left) / width - 0.5;
    const py = (e.clientY - top) / height - 0.5;
    rotX.set(-py * 10);
    rotY.set(px * 10);
  };

  return (
    <motion.div
      ref={ref}
      style={{ rotateX: springRotX, rotateY: springRotY, transformStyle: "preserve-3d" }}
      onMouseMove={handleMouse}
      onMouseLeave={() => { rotX.set(0); rotY.set(0); }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Animated Counter ──────────────────────────────────────────────────────
function AnimatedCounter({ target, suffix = "", duration = 2000 }: { target: number; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = Math.ceil(target / (duration / 16));
    const timer = setInterval(() => {
      start = Math.min(start + step, target);
      setCount(start);
      if (start >= target) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [inView, target, duration]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

// ─── Scripture Ticker ──────────────────────────────────────────────────────
function ScriptureTicker() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % SCRIPTURES.length), 5000);
    return () => clearInterval(t);
  }, []);

  const s = SCRIPTURES[idx];
  return (
    <div className="relative h-14 overflow-hidden flex items-center justify-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <span className="text-primary/50 text-sm italic">{s.verse}</span>
          <span className="text-accent text-xs ml-2 font-semibold">— {s.ref}</span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ─── Live Countdown ────────────────────────────────────────────────────────
function useNextService() {
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const getNextSunday = () => {
      const now = new Date();
      const sunday = new Date(now);
      const dayOfWeek = now.getDay();
      const daysUntilSunday = dayOfWeek === 0 ? (now.getHours() >= 9 ? 7 : 0) : 7 - dayOfWeek;
      sunday.setDate(now.getDate() + daysUntilSunday);
      sunday.setHours(9, 0, 0, 0);
      return sunday;
    };

    const update = () => {
      const diff = getNextSunday().getTime() - Date.now();
      setCountdown({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };

    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);

  return countdown;
}

// ═══════════════════════════════════════════════════════════════════════════
// HERO — Light Sanctuary Aesthetic
// ═══════════════════════════════════════════════════════════════════════════
function HeroSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });

  // Layered parallax — each element moves at a different rate
  const yBg = useTransform(scrollYProgress, [0, 1], [0, 60]);
  const yOrbs = useTransform(scrollYProgress, [0, 1], [0, 90]);
  const yLogo = useTransform(scrollYProgress, [0, 1], [0, -25]);
  const yContent = useTransform(scrollYProgress, [0, 1], [0, 130]);
  const opacity = useTransform(scrollYProgress, [0, 0.75], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.08]);

  return (
    <section ref={ref} className="relative min-h-screen flex items-center overflow-hidden" style={{ background: "#FFFEF8" }}>
      {/* Layer 1: Parallax background gradient */}
      <motion.div style={{ y: yBg, scale }} className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-[#FFFEF8] via-[#EEF4FF] to-[#E0EDFF]" />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(56,189,248,0.12) 0%, transparent 60%)",
          }}
        />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(rgba(0,51,102,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,51,102,1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </motion.div>

      {/* Layer 2: Animated orbs — move at different parallax rate */}
      <motion.div style={{ y: yOrbs }} className="absolute inset-0 pointer-events-none">
        <motion.div
          animate={{ scale: [1, 1.18, 1], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(56,189,248,0.12) 0%, transparent 70%)" }}
        />
        <motion.div
          animate={{ scale: [1, 1.22, 1], opacity: [0.25, 0.45, 0.25] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(0,51,102,0.08) 0%, transparent 70%)" }}
        />
        <motion.div
          animate={{ scale: [1, 1.12, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 13, repeat: Infinity, ease: "easeInOut", delay: 5 }}
          className="absolute top-1/3 right-1/3 w-64 h-64 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(56,189,248,0.09) 0%, transparent 70%)" }}
        />
      </motion.div>

      {/* Main content wrapper */}
      <motion.div style={{ opacity }} className="container mx-auto px-4 relative z-10">
        <div className="max-w-5xl mx-auto text-center">

          {/* Layer 3: LOGO — moves at its own parallax rate (floats up) */}
          <motion.div style={{ y: yLogo }} className="mb-8 flex justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.75 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
            >
              <motion.div
                animate={{ scale: [1, 1.12, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 rounded-full blur-2xl scale-150"
                style={{ background: "rgba(56,189,248,0.25)" }}
              />
              <img
                src="/jctm-logo.jpeg"
                alt="JCTM"
                className="relative h-32 w-32 rounded-full object-cover ring-4 shadow-2xl"
                style={{ boxShadow: "0 0 60px rgba(56,189,248,0.3), 0 20px 60px rgba(0,51,102,0.15)", ringColor: "rgba(56,189,248,0.4)" }}
              />
            </motion.div>
          </motion.div>

          {/* Layer 4: Content — moves fastest (standard parallax) */}
          <motion.div style={{ y: yContent }}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              <span className="inline-flex items-center gap-2 border border-primary/15 text-primary/70 px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-8 bg-white/60 backdrop-blur-sm shadow-sm">
                <Sparkles className="h-3 w-3 text-accent" />
                Jesus Christ Temple Ministry · Warri, Nigeria
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-serif font-bold text-primary mb-6 leading-[1.04] tracking-tight"
            >
              The<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#003366] via-[#38BDF8] to-[#003366] animate-[shimmer_3s_linear_infinite]">
                Correction
              </span>
              <br />Mandate
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.7 }}
              className="text-lg md:text-xl text-primary/55 mb-8 max-w-2xl mx-auto font-light leading-relaxed"
            >
              Equipping the saints, restoring the primitive church, and proclaiming the{" "}
              <span className="text-primary font-medium">Good News</span> — under the prophetic leadership of{" "}
              <span className="text-accent font-semibold">Prophet Amos Evomobor.</span>
            </motion.p>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="mb-10">
              <ScriptureTicker />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.85, duration: 0.6 }}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            >
              <MagneticButton>
                <Link href="/sermons">
                  <Button
                    size="lg"
                    className="group h-14 px-10 rounded-full text-base font-semibold bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/25 transition-all duration-300 hover:-translate-y-0.5"
                  >
                    <Play className="h-4 w-4 mr-2 group-hover:scale-125 transition-transform fill-white" />
                    Experience the Word
                  </Button>
                </Link>
              </MagneticButton>
              <MagneticButton>
                <Link href="/about">
                  <Button
                    size="lg"
                    variant="ghost"
                    className="h-14 px-10 rounded-full text-base text-primary/70 hover:text-primary hover:bg-primary/6 border border-primary/15 backdrop-blur-sm transition-all duration-300"
                  >
                    Our Mission
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </MagneticButton>
            </motion.div>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.3 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2"
          >
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className="w-5 h-8 rounded-full border-2 border-primary/20 flex justify-center pt-1.5"
            >
              <div className="w-1 h-2 rounded-full bg-accent" />
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STATS BAR
// ═══════════════════════════════════════════════════════════════════════════
function StatsBar() {
  const { data: stats } = useGetSermonStats({ query: { queryKey: getGetSermonStatsQueryKey() } });

  const items = [
    { label: "Sermons in Library", value: stats?.total ?? 479, suffix: "+" },
    { label: "Total YouTube Views", value: stats?.totalViews ?? 2951335, suffix: "" },
    { label: "Years of Ministry", value: 25, suffix: "+" },
    { label: "Nations Reached", value: 40, suffix: "+" },
  ];

  return (
    <section className="py-0 bg-background">
      <div className="container mx-auto px-4">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border border border-border rounded-2xl overflow-hidden shadow-xl bg-white -mt-8 relative z-10"
        >
          {items.map((item, i) => (
            <motion.div
              key={i}
              variants={fadeUp}
              className="px-8 py-8 text-center group hover:bg-primary transition-colors duration-300"
            >
              <div className="text-4xl md:text-5xl font-serif font-bold text-primary group-hover:text-white transition-colors mb-1">
                <AnimatedCounter target={item.value} suffix={item.suffix} />
              </div>
              <p className="text-xs text-muted-foreground group-hover:text-white/70 transition-colors uppercase tracking-wider font-medium mt-1">
                {item.label}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BENTO GRID SECTION — Latest Sermon · Testimony · Live Countdown
// ═══════════════════════════════════════════════════════════════════════════
function BentoGrid() {
  const { data: sermon, isLoading: sermonLoading } = useGetFeaturedSermon({
    query: { queryKey: getGetFeaturedSermonQueryKey() }
  });
  const countdown = useNextService();
  const [testimony, setTestimony] = useState<{ name?: string; content?: string; category?: string } | null>(null);

  useEffect(() => {
    fetch(`${BASE}/api/testimonies?limit=1`)
      .then(r => r.json())
      .then((d: { name?: string; content?: string; category?: string }[]) => { if (d?.[0]) setTestimony(d[0]); })
      .catch(() => {});
  }, []);

  const ytId = (sermon as { videoId?: string })?.videoId;

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex items-end justify-between mb-10"
        >
          <div>
            <span className="text-accent text-xs font-bold uppercase tracking-widest flex items-center gap-2 mb-2">
              <span className="h-px w-6 bg-accent inline-block" /> Today's Highlights
            </span>
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-primary">Digital Sanctuary</h2>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-5 auto-rows-auto">

          {/* Bento Card 1: Latest Sermon (wide) */}
          <TiltCard className="md:col-span-3 md:row-span-2">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="rounded-3xl overflow-hidden border border-border bg-white shadow-sm hover:shadow-2xl transition-shadow duration-500 h-full group"
            >
              {sermonLoading ? (
                <div className="h-72 bg-muted animate-pulse rounded-3xl" />
              ) : sermon ? (
                <>
                  <div className="relative aspect-video overflow-hidden">
                    <img
                      src={sermon.thumbnailUrl}
                      alt={sermon.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/20 to-transparent" />
                    <a
                      href={ytId ? `https://www.youtube.com/watch?v=${ytId}` : "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute inset-0 flex items-end p-6"
                    >
                      <div>
                        <span className="text-accent text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 mb-2">
                          <span className="h-1.5 w-1.5 bg-accent rounded-full" />
                          Latest Broadcast
                        </span>
                        <h3 className="text-white font-serif font-bold text-xl leading-snug mb-3 line-clamp-2">{sermon.title}</h3>
                        <div className="flex items-center gap-2">
                          <div className="h-9 w-9 rounded-full bg-accent flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                            <Play className="h-4 w-4 text-white fill-white ml-0.5" />
                          </div>
                          <span className="text-white/60 text-xs">Watch on YouTube</span>
                        </div>
                      </div>
                    </a>
                  </div>
                  <div className="p-5">
                    <p className="text-muted-foreground text-xs">
                      Published {formatDistanceToNow(new Date(sermon.publishedAt), { addSuffix: true })}
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  <BookOpen className="h-8 w-8 opacity-30" />
                </div>
              )}
            </motion.div>
          </TiltCard>

          {/* Bento Card 2: Live Countdown */}
          <TiltCard className="md:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="rounded-3xl border border-border bg-primary text-white p-7 h-full shadow-sm hover:shadow-2xl transition-shadow duration-500 relative overflow-hidden"
            >
              <div
                className="absolute inset-0 opacity-5"
                style={{ backgroundImage: "radial-gradient(circle at 80% 20%, #38BDF8 0%, transparent 60%)" }}
              />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-5">
                  <div className="h-8 w-8 rounded-xl bg-accent/20 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-accent" />
                  </div>
                  <div>
                    <p className="text-white/80 text-xs font-bold uppercase tracking-widest">Next Service</p>
                    <p className="text-white/50 text-[10px]">Sunday · 9:00 AM WAT</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 mb-5">
                  {[
                    { v: countdown.days, l: "Days" },
                    { v: countdown.hours, l: "Hrs" },
                    { v: countdown.minutes, l: "Min" },
                    { v: countdown.seconds, l: "Sec" },
                  ].map(({ v, l }) => (
                    <div key={l} className="bg-white/10 rounded-xl p-2 text-center">
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={v}
                          initial={{ y: -8, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={{ y: 8, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="text-2xl font-serif font-bold text-white"
                        >
                          {String(v).padStart(2, "0")}
                        </motion.div>
                      </AnimatePresence>
                      <p className="text-white/50 text-[9px] uppercase tracking-widest">{l}</p>
                    </div>
                  ))}
                </div>
                <Link href="/events">
                  <Button size="sm" className="w-full rounded-xl bg-accent hover:bg-accent/90 text-white text-xs h-9">
                    <Radio className="h-3 w-3 mr-1.5" /> Join Live
                  </Button>
                </Link>
              </div>
            </motion.div>
          </TiltCard>

          {/* Bento Card 3: Testimony of the Day */}
          <TiltCard className="md:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.18 }}
              className="rounded-3xl border border-border bg-gradient-to-br from-sky-50 to-blue-50 p-7 h-full shadow-sm hover:shadow-2xl transition-shadow duration-500 relative overflow-hidden"
            >
              <div className="absolute top-4 right-4 opacity-10">
                <Quote className="h-16 w-16 text-primary" />
              </div>
              <div className="relative z-10 h-full flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-8 w-8 rounded-xl bg-accent/15 flex items-center justify-center">
                    <MessageSquare className="h-4 w-4 text-accent" />
                  </div>
                  <p className="text-primary text-xs font-bold uppercase tracking-widest">Testimony of the Day</p>
                </div>

                {testimony ? (
                  <>
                    <p className="text-primary/75 text-sm leading-relaxed italic flex-1 line-clamp-5">
                      "{testimony.content}"
                    </p>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-primary font-semibold text-xs">— {testimony.name || "Anonymous"}</span>
                      {testimony.category && (
                        <Badge variant="secondary" className="text-[10px] rounded-full">{testimony.category}</Badge>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col justify-between">
                    <p className="text-primary/75 text-sm leading-relaxed italic">
                      "God has been faithful through the ministry of Prophet Amos. The Word of God, as our standard, has set us free from every tradition of men."
                    </p>
                    <Link href="/testimonies">
                      <Button size="sm" variant="outline" className="mt-4 rounded-full text-primary border-primary/20 hover:border-accent hover:text-accent text-xs">
                        Read More Testimonies <ArrowRight className="ml-1 h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          </TiltCard>
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
  const bgScale = useTransform(scrollYProgress, [0, 1], [1.05, 1.0]);

  return (
    <section ref={ref} className="relative py-40 overflow-hidden" style={{ background: "#020b18" }}>
      {/* Parallax bg */}
      <motion.div style={{ scale: bgScale }} className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#001830] to-[#020b18]" />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle at 20% 50%, rgba(56,189,248,0.1) 0%, transparent 60%), radial-gradient(circle at 80% 50%, rgba(0,51,102,0.2) 0%, transparent 60%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(56,189,248,0.3) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </motion.div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto space-y-10 text-center">
          <motion.div style={{ x: x1, opacity: op1 }}>
            <p className="text-accent text-xs font-bold uppercase tracking-widest mb-3">The Foundation</p>
            <h2 className="text-5xl md:text-7xl font-serif font-bold text-white leading-tight">
              The Bible Is<br />Our Standard.
            </h2>
          </motion.div>

          <motion.div style={{ x: x2, opacity: op2 }}>
            <div className="h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent max-w-xs mx-auto" />
          </motion.div>

          <motion.div style={{ x: x3, opacity: op3 }}>
            <h3 className="text-3xl md:text-5xl font-serif font-bold text-white/90 leading-tight">
              Restoring{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#38BDF8] to-[#7DD3FC]">
                Primitive Christianity
              </span>
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
// FEATURED SERMON SPOTLIGHT
// ═══════════════════════════════════════════════════════════════════════════
function SermonSpotlight() {
  const { data: sermon, isLoading } = useGetFeaturedSermon({
    query: { queryKey: getGetFeaturedSermonQueryKey() }
  });
  const [playing, setPlaying] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });

  const ytId = (sermon as { videoId?: string })?.videoId;

  return (
    <section ref={ref} className="py-28 bg-background">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Text */}
          <motion.div variants={stagger} initial="hidden" animate={inView ? "show" : "hidden"}>
            <motion.div variants={fadeUp}>
              <span className="inline-flex items-center gap-2 text-accent text-xs font-bold uppercase tracking-widest mb-5">
                <span className="h-px w-8 bg-accent inline-block" />
                Latest Broadcast
              </span>
            </motion.div>

            <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-serif font-bold text-primary mb-6 leading-tight">
              Restoring the Path of{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-[#0284C7]">
                True Worship
              </span>
            </motion.h2>

            <motion.p variants={fadeUp} className="text-lg text-muted-foreground mb-8 leading-relaxed">
              The Correction Mandate is a divine instruction given to Prophet Amos Evomobor to lead a return to primitive Christianity — undiluted truth, spiritual discipline, and the manifestation of God's power.
            </motion.p>

            <motion.div variants={stagger} className="grid sm:grid-cols-2 gap-5 mb-10">
              {[
                { icon: ShieldCheck, label: "Scriptural Purity", desc: "Strict adherence to the apostolic foundation" },
                { icon: Flame, label: "Holiness Doctrine", desc: "Proclaiming holiness without compromise" },
                { icon: Users, label: "Community", desc: "A family bound by the love of Christ" },
                { icon: Globe, label: "Global Reach", desc: "Temple TV broadcasting to 40+ nations" },
              ].map(({ icon: Icon, label, desc }, i) => (
                <TiltCard key={i}>
                  <motion.div
                    variants={fadeUp}
                    className="flex gap-4 p-4 rounded-2xl border border-border hover:border-accent/30 hover:shadow-lg transition-all duration-200 bg-white"
                  >
                    <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/5 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-bold text-primary text-sm">{label}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                  </motion.div>
                </TiltCard>
              ))}
            </motion.div>

            <motion.div variants={fadeUp}>
              <MagneticButton>
                <Link href="/sermons">
                  <Button className="group rounded-full px-8 h-12 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5">
                    Browse All 479 Sermons
                    <ChevronRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </MagneticButton>
            </motion.div>
          </motion.div>

          {/* Right: Video Card */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          >
            {isLoading ? (
              <div className="rounded-3xl overflow-hidden shadow-2xl">
                <Skeleton className="aspect-video w-full" />
                <div className="p-6 bg-primary">
                  <Skeleton className="h-3 w-24 bg-white/10 mb-3" />
                  <Skeleton className="h-6 w-full bg-white/10 mb-2" />
                  <Skeleton className="h-6 w-3/4 bg-white/10 mb-4" />
                  <div className="flex gap-3">
                    <Skeleton className="h-10 flex-1 bg-white/10 rounded-xl" />
                    <Skeleton className="h-10 w-20 bg-white/10 rounded-xl" />
                  </div>
                </div>
              </div>
            ) : sermon ? (
              <TiltCard>
                <div className="relative group">
                  <div className="absolute -inset-4 bg-gradient-to-r from-accent/15 to-primary/15 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative rounded-3xl overflow-hidden shadow-2xl bg-primary">
                    {playing && ytId ? (
                      <iframe
                        className="w-full aspect-video"
                        src={`https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0`}
                        allow="autoplay; fullscreen"
                        allowFullScreen
                        title={sermon.title}
                      />
                    ) : (
                      <>
                        <div className="aspect-video relative overflow-hidden">
                          <img
                            src={sermon.thumbnailUrl}
                            alt={sermon.title}
                            className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/20 to-transparent" />

                          {(sermon as { isLive?: boolean }).isLive && (
                            <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                              </span>
                              LIVE NOW
                            </div>
                          )}

                          <button
                            onClick={() => setPlaying(true)}
                            className="absolute inset-0 flex items-center justify-center"
                            aria-label="Play sermon"
                          >
                            <motion.div
                              whileHover={{ scale: 1.12 }}
                              whileTap={{ scale: 0.95 }}
                              className="h-20 w-20 bg-accent rounded-full flex items-center justify-center shadow-2xl shadow-accent/50 ring-4 ring-white/20"
                            >
                              <Play className="h-9 w-9 text-white fill-white ml-1" />
                            </motion.div>
                          </button>
                        </div>

                        <div className="p-6 bg-primary text-white">
                          <span className="text-accent text-xs font-bold uppercase tracking-widest">Featured Message</span>
                          <h3 className="text-xl font-serif font-bold mt-2 mb-1 leading-tight line-clamp-2">{sermon.title}</h3>
                          <p className="text-white/50 text-xs mb-4">
                            {formatDistanceToNow(new Date(sermon.publishedAt), { addSuffix: true })}
                          </p>
                          <div className="flex gap-3">
                            <button onClick={() => setPlaying(true)} className="flex-1 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors flex items-center justify-center gap-2">
                              <Play className="h-4 w-4 fill-white" /> Watch Now
                            </button>
                            {ytId && (
                              <a
                                href={`https://www.youtube.com/watch?v=${ytId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors flex items-center gap-1.5 text-white text-sm"
                              >
                                <ExternalLink className="h-3.5 w-3.5" /> YouTube
                              </a>
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
function RecentSermonsCarousel() {
  const [sermons, setSermons] = useState<{
    id: number; videoId: string; title: string;
    thumbnailUrl: string; publishedAt: string;
    isFeatured?: boolean; isLive?: boolean;
  }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/api/sermons?limit=12&offset=0`)
      .then(r => r.json())
      .then(d => { setSermons(d); setIsLoading(false); })
      .catch(() => setIsLoading(false));
  }, []);

  return (
    <section className="py-20 bg-secondary/30">
      <div className="container mx-auto px-4 mb-8">
        <div className="flex items-end justify-between">
          <div>
            <span className="text-accent text-xs font-bold uppercase tracking-widest flex items-center gap-2 mb-3">
              <span className="h-px w-6 bg-accent inline-block" /> Temple TV
            </span>
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-primary">Recent Messages</h2>
          </div>
          <Link href="/sermons">
            <Button variant="outline" className="rounded-full group hidden sm:flex border-primary/20">
              All Sermons <ChevronRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="relative">
        {isLoading ? (
          <div className="flex gap-5 overflow-x-auto pb-4 px-4 md:px-[calc((100vw-1280px)/2+1rem)] scrollbar-hide">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="shrink-0 w-72 rounded-2xl overflow-hidden bg-white shadow-sm">
                <Skeleton className="aspect-video w-full" />
                <div className="p-4">
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-5 overflow-x-auto pb-4 px-4 md:px-[calc((100vw-1280px)/2+1rem)] scrollbar-hide snap-x snap-mandatory">
            {sermons.map((s, i) => (
              <motion.a
                key={s.id}
                href={`https://www.youtube.com/watch?v=${s.videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05, duration: 0.5 }}
                whileHover={{ y: -4 }}
                className={`shrink-0 w-72 rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-xl transition-all duration-300 snap-start group ${
                  s.isLive ? "ring-2 ring-red-400" : s.isFeatured ? "ring-1 ring-accent/40" : ""
                }`}
              >
                <div className="relative aspect-video overflow-hidden">
                  <img
                    src={s.thumbnailUrl}
                    alt={s.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => { (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${s.videoId}/hqdefault.jpg`; }}
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  {s.isLive && (
                    <div className="absolute top-2 left-2 flex items-center gap-1 bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                      <span className="h-1.5 w-1.5 bg-white rounded-full animate-ping inline-block" /> LIVE
                    </div>
                  )}
                  {!s.isLive && s.isFeatured && (
                    <div className="absolute top-2 left-2 flex items-center gap-1 bg-accent text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                      <Star className="h-2.5 w-2.5 fill-white" /> Featured
                    </div>
                  )}
                  <div className="absolute bottom-3 right-3 h-9 w-9 rounded-full bg-accent/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                    <Play className="h-4 w-4 text-white fill-white ml-0.5" />
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-primary font-semibold text-sm line-clamp-2 leading-snug mb-2">{s.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(s.publishedAt), { addSuffix: true })}
                  </p>
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
// MINISTRY PILLARS — with Tilt Physics
// ═══════════════════════════════════════════════════════════════════════════
function MinistryPillars() {
  const pillars = [
    {
      icon: BookOpen, title: "The Bible Is Our Standard",
      desc: "Every doctrine, every practice, every correction is measured strictly against the Word of God. No tradition can override Scripture.",
      gradient: "from-blue-600 to-[#003366]",
    },
    {
      icon: ShieldCheck, title: "Doctrinal Correction",
      desc: "Standing against false doctrines — prosperity gospel, prophetic manipulation, and spiritual abuse — restoring the apostolic standard.",
      gradient: "from-[#38BDF8] to-[#0284C7]",
    },
    {
      icon: Flame, title: "Holiness & Purity",
      desc: "We preach genuine holiness of heart, mind, and conduct, as set forth in the New Testament and modelled by the early church.",
      gradient: "from-orange-500 to-red-600",
    },
    {
      icon: Mic2, title: "Prophetic Ministry",
      desc: "Prophet Amos Evomobor operates under a verified prophetic anointing, bringing divine messages and confirmatory signs.",
      gradient: "from-purple-600 to-violet-800",
    },
    {
      icon: Radio, title: "Temple TV Broadcasts",
      desc: "Live and recorded services streamed globally via Temple TV on YouTube — making the Correction Mandate accessible worldwide.",
      gradient: "from-red-500 to-rose-700",
    },
    {
      icon: Heart, title: "Community & Welfare",
      desc: "We care for our members and community — through prayer, fellowship, counselling, and practical support in Christ's name.",
      gradient: "from-emerald-500 to-teal-700",
    },
  ];

  return (
    <section className="py-28 bg-background">
      <div className="container mx-auto px-4">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <motion.span variants={fadeUp} className="text-accent text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 mb-4">
            <span className="h-px w-6 bg-accent inline-block" /> Our Mandate <span className="h-px w-6 bg-accent inline-block" />
          </motion.span>
          <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-serif font-bold text-primary mb-4">
            The Six Pillars of JCTM
          </motion.h2>
          <motion.p variants={fadeUp} className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Every dimension of our ministry flows from one source — the apostolic truth of the New Testament church.
          </motion.p>
        </motion.div>

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {pillars.map(({ icon: Icon, title, desc, gradient }, i) => (
            <motion.div key={i} variants={fadeUp}>
              <TiltCard>
                <div className="group relative rounded-3xl border border-border bg-white p-8 overflow-hidden hover:shadow-2xl transition-all duration-300 h-full">
                  <div className={`absolute inset-0 opacity-0 group-hover:opacity-[0.03] transition-opacity duration-500 bg-gradient-to-br ${gradient}`} />
                  <div className={`inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br ${gradient} mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="font-bold text-primary text-lg mb-3 leading-snug">{title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
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
// UPCOMING EVENTS
// ═══════════════════════════════════════════════════════════════════════════
function EventsSection() {
  const { data: events, isLoading } = useGetUpcomingEvents({ query: { queryKey: getGetUpcomingEventsQueryKey() } });

  return (
    <section className="py-28 bg-gradient-to-b from-[#f0f6ff] to-white">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-end mb-14 gap-6">
          <div>
            <span className="text-accent text-xs font-bold uppercase tracking-widest flex items-center gap-2 mb-3">
              <span className="h-px w-6 bg-accent inline-block" /> Gatherings
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

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-3xl p-8 shadow-sm border border-border">
                <Skeleton className="h-16 w-20 rounded-2xl mb-6" />
                <Skeleton className="h-6 w-full mb-3" />
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2 mb-6" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            ))}
          </div>
        ) : events && events.length > 0 ? (
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
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
                      <h3 className="text-xl font-bold text-primary mb-3 leading-tight group-hover:text-accent transition-colors">
                        {event.title}
                      </h3>
                      <div className="space-y-2 mb-6 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-accent" />
                          {format(date, "EEEE, h:mm a")}
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-accent" />
                          {event.location || "Main Sanctuary, Warri"}
                        </div>
                      </div>
                      <Button className="w-full rounded-xl bg-primary/5 text-primary hover:bg-primary hover:text-white border-none shadow-none transition-all duration-200">
                        Event Details
                      </Button>
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
// GIVING CTA BAND  — TempleBots notification trigger zone
// ═══════════════════════════════════════════════════════════════════════════
function GivingBand() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: false, margin: "-20% 0px -20% 0px" });

  useEffect(() => {
    if (inView) {
      window.dispatchEvent(new CustomEvent("jctm:section-enter", { detail: "giving" }));
    }
  }, [inView]);

  return (
    <section ref={ref} className="py-20 bg-gradient-to-r from-primary via-[#003d80] to-primary relative overflow-hidden">
      <div className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: "repeating-linear-gradient(45deg, rgba(56,189,248,0.3) 0px, rgba(56,189,248,0.3) 1px, transparent 1px, transparent 16px)",
        }}
      />
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="flex flex-col md:flex-row items-center justify-between gap-8"
        >
          <motion.div variants={fadeUp} className="text-white text-center md:text-left">
            <h2 className="text-3xl md:text-4xl font-serif font-bold mb-2">Partner With the Mandate</h2>
            <p className="text-white/70 text-lg max-w-lg">
              Your giving fuels the global spread of the Correction Mandate. "The Lord loveth a cheerful giver." — 2 Cor 9:7
            </p>
          </motion.div>
          <motion.div variants={fadeUp} className="flex gap-4">
            <MagneticButton>
              <Link href="/give">
                <Button size="lg" className="h-14 px-10 rounded-full bg-accent hover:bg-accent/90 text-white font-bold text-base shadow-xl shadow-accent/30 min-h-[44px]">
                  <Heart className="mr-2 h-5 w-5 fill-white" /> Give Now
                </Button>
              </Link>
            </MagneticButton>
            <Link href="/testimonies">
              <Button size="lg" variant="ghost" className="h-14 px-10 rounded-full text-white border border-white/20 hover:bg-white/10 min-h-[44px]">
                Testimonies
              </Button>
            </Link>
          </motion.div>
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

  useEffect(() => {
    if (inView) {
      window.dispatchEvent(new CustomEvent("jctm:section-enter", { detail: "testimonies" }));
    }
  }, [inView]);

  const steps = [
    { icon: BookOpen, title: "Our Beliefs", desc: "Discover what JCTM stands for and the doctrinal foundations of our faith.", href: "/about", cta: "Learn More" },
    { icon: MapPin, title: "Find a Branch", desc: "Our headquarters is in Warri. Connect with our services in person or online.", href: "/about", cta: "Get Directions" },
    { icon: Users, title: "Join a Unit", desc: "Become part of the worshipping community and get involved in ministry.", href: "/join", cta: "Get Involved" },
  ];

  return (
    <section ref={ref} className="py-28 bg-white">
      <div className="container mx-auto px-4">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <motion.span variants={fadeUp} className="text-accent text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 mb-4">
            <span className="h-px w-6 bg-accent inline-block" /> Welcome <span className="h-px w-6 bg-accent inline-block" />
          </motion.span>
          <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-serif font-bold text-primary mb-5">
            New to the Temple?
          </motion.h2>
          <motion.p variants={fadeUp} className="text-lg text-muted-foreground leading-relaxed">
            Whether you're visiting online or at our Warri headquarters, we want to help you take your next step in the Correction Mandate.
          </motion.p>
        </motion.div>

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid sm:grid-cols-3 gap-8 max-w-4xl mx-auto"
        >
          {steps.map(({ icon: Icon, title, desc, href, cta }, i) => (
            <motion.div key={i} variants={fadeUp}>
              <TiltCard>
                <div className="text-center p-8 rounded-3xl border border-border hover:border-accent/30 hover:shadow-2xl transition-all duration-300 bg-white group h-full flex flex-col">
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-accent to-[#0284C7] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-accent/20 group-hover:scale-110 transition-transform">
                    <Icon className="h-7 w-7 text-white" />
                  </div>
                  <h4 className="font-bold text-primary text-lg mb-3">{title}</h4>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-6 flex-1">{desc}</p>
                  <Link href={href}>
                    <Button variant="outline" className="rounded-full text-accent border-accent/30 hover:bg-accent hover:text-white hover:border-accent transition-all min-h-[44px]">
                      {cta}
                    </Button>
                  </Link>
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
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle at 20% 50%, rgba(56,189,248,0.15) 0%, transparent 60%), radial-gradient(circle at 80% 50%, rgba(0,51,102,0.3) 0%, transparent 60%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(56,189,248,0.4) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </motion.div>

      <div className="container mx-auto px-4 relative z-10 text-center">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="max-w-3xl mx-auto"
        >
          <motion.span variants={fadeUp} className="inline-flex items-center gap-2 border border-accent/30 text-accent px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-8 bg-accent/10">
            <Sparkles className="h-3 w-3" /> Divine History
          </motion.span>
          <motion.h2 variants={fadeUp} className="text-5xl md:text-6xl font-serif font-bold text-white mb-6 leading-tight">
            History in the Making
          </motion.h2>
          <motion.p variants={fadeUp} className="text-lg text-white/60 mb-12 leading-relaxed">
            From the initial prophetic calling to the establishment of the Land of Good News, explore the milestones of our journey — a living testament to divine faithfulness.
          </motion.p>
          <motion.div variants={fadeUp}>
            <MagneticButton>
              <Link href="/correction-timeline">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-accent to-[#0284C7] hover:from-[#0284C7] hover:to-accent text-white h-16 px-14 rounded-full text-lg font-bold shadow-2xl shadow-accent/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-accent/50 min-h-[44px]"
                >
                  View Our Timeline
                  <ArrowRight className="ml-3 h-5 w-5" />
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
      <BentoGrid />
      <MandateReveal />
      <SermonSpotlight />
      <RecentSermonsCarousel />
      <MinistryPillars />
      <EventsSection />
      <GivingBand />
      <NewcomerSection />
      <TimelineTeaser />
    </Layout>
  );
}

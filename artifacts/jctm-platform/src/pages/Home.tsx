import { useEffect, useRef, useState } from "react";
import { motion, Variants, useScroll, useTransform, useInView, AnimatePresence } from "framer-motion";
import { format, formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import {
  PlayCircle, Calendar, ArrowRight,
  MapPin, ShieldCheck, Flame, Users,
  Radio, BookOpen, Heart, Sparkles, ChevronRight,
  Globe, Star, Mic2, Play, ExternalLink,
} from "lucide-react";
import {
  useGetFeaturedSermon, getGetFeaturedSermonQueryKey,
  useGetUpcomingEvents, getGetUpcomingEventsQueryKey,
  useGetSermonStats, getGetSermonStatsQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
          <span className="text-white/70 text-sm italic">{s.verse}</span>
          <span className="text-accent text-xs ml-2 font-semibold">— {s.ref}</span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HERO
// ═══════════════════════════════════════════════════════════════════════════
function HeroSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const opacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  return (
    <section ref={ref} className="relative min-h-screen flex items-center overflow-hidden bg-[#020b18]">
      {/* Deep animated gradient bg */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#001830] via-[#020b18] to-[#001020]" />
        {/* Glowing orbs */}
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-[#003366]/40 blur-[100px]"
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-1/3 right-1/4 w-80 h-80 rounded-full bg-[#38BDF8]/20 blur-[100px]"
        />
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.15, 0.3, 0.15] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 4 }}
          className="absolute top-1/2 right-1/3 w-64 h-64 rounded-full bg-red-500/10 blur-[80px]"
        />
        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "linear-gradient(rgba(56,189,248,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.5) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <motion.div style={{ y, opacity }} className="container mx-auto px-4 relative z-10">
        <div className="max-w-5xl mx-auto text-center">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="mb-8 flex justify-center"
          >
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-accent/20 blur-2xl scale-150 animate-pulse" />
              <img
                src="/jctm-logo.jpeg"
                alt="JCTM"
                className="relative h-28 w-28 rounded-full object-cover ring-4 ring-accent/40 shadow-2xl shadow-accent/30"
              />
            </div>
          </motion.div>

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-2 border border-accent/30 text-accent px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-8 bg-accent/10 backdrop-blur-sm">
              <Sparkles className="h-3 w-3" />
              Jesus Christ Temple Ministry · Warri, Nigeria
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-serif font-bold text-white mb-6 leading-[1.05] tracking-tight"
          >
            The<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#38BDF8] via-[#7DD3FC] to-[#38BDF8] animate-[shimmer_3s_linear_infinite]">
              Correction
            </span>
            <br />Mandate
          </motion.h1>

          {/* Subtext */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.7 }}
            className="text-lg md:text-xl text-white/60 mb-8 max-w-2xl mx-auto font-light leading-relaxed"
          >
            Equipping the saints, restoring the primitive church, and proclaiming the{" "}
            <span className="text-white font-medium">Good News</span> — under the prophetic leadership of{" "}
            <span className="text-accent font-medium">Prophet Amos Evomobor.</span>
          </motion.p>

          {/* Scripture ticker */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mb-10"
          >
            <ScriptureTicker />
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Link href="/sermons">
              <Button
                size="lg"
                className="group h-14 px-10 rounded-full text-base font-semibold bg-gradient-to-r from-[#38BDF8] to-[#0284C7] hover:from-[#0284C7] hover:to-[#38BDF8] text-white shadow-xl shadow-[#38BDF8]/30 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[#38BDF8]/50"
              >
                <Play className="h-4 w-4 mr-2 group-hover:scale-125 transition-transform" />
                Experience the Word
              </Button>
            </Link>
            <Link href="/about">
              <Button
                size="lg"
                variant="ghost"
                className="h-14 px-10 rounded-full text-base text-white/80 hover:text-white hover:bg-white/10 border border-white/10 backdrop-blur-sm transition-all duration-300"
              >
                Our Mission
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2"
          >
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className="w-5 h-8 rounded-full border-2 border-white/20 flex justify-center pt-1.5"
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
    <section className="py-0 bg-gradient-to-b from-[#020b18] to-background">
      <div className="container mx-auto px-4">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border border border-border rounded-2xl overflow-hidden shadow-xl bg-white"
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
          <motion.div
            variants={stagger}
            initial="hidden"
            animate={inView ? "show" : "hidden"}
          >
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
                <motion.div
                  key={i}
                  variants={fadeUp}
                  whileHover={{ y: -3 }}
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
              ))}
            </motion.div>

            <motion.div variants={fadeUp}>
              <Link href="/sermons">
                <Button className="group rounded-full px-8 h-12 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5">
                  Browse All 479 Sermons
                  <ChevronRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </motion.div>
          </motion.div>

          {/* Right: Video Card */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            className="relative"
          >
            {isLoading ? (
              <div className="aspect-video rounded-3xl bg-muted animate-pulse" />
            ) : sermon ? (
              <div className="relative group">
                {/* Glow */}
                <div className="absolute -inset-4 bg-gradient-to-r from-accent/20 to-primary/20 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

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

                        {/* Live badge */}
                        {(sermon as { isLive?: boolean }).isLive && (
                          <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                            </span>
                            LIVE NOW
                          </div>
                        )}

                        {/* Play button */}
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
                        <h3 className="text-xl font-serif font-bold mt-2 mb-1 leading-tight line-clamp-2">
                          {sermon.title}
                        </h3>
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
            ) : null}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// RECENT SERMONS CAROUSEL (horizontal scroll)
// ═══════════════════════════════════════════════════════════════════════════
function RecentSermonsCarousel() {
  const [sermons, setSermons] = useState<{
    id: number; videoId: string; title: string;
    thumbnailUrl: string; publishedAt: string;
    isFeatured?: boolean; isLive?: boolean;
  }[]>([]);

  useEffect(() => {
    fetch(`${BASE}/api/sermons?limit=12&offset=0`)
      .then(r => r.json())
      .then(setSermons)
      .catch(() => {});
  }, []);

  if (sermons.length === 0) return null;

  return (
    <section className="py-20 bg-secondary/30">
      <div className="container mx-auto px-4 mb-8">
        <div className="flex items-end justify-between">
          <div>
            <span className="text-accent text-xs font-bold uppercase tracking-widest flex items-center gap-2 mb-3">
              <span className="h-px w-6 bg-accent inline-block" /> Temple TV
            </span>
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-primary">
              Recent Messages
            </h2>
          </div>
          <Link href="/sermons">
            <Button variant="outline" className="rounded-full group hidden sm:flex">
              All Sermons <ChevronRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Horizontal scroll */}
      <div className="relative">
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
                    <span className="h-1.5 w-1.5 bg-white rounded-full animate-ping inline-block" />
                    LIVE
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
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MINISTRY PILLARS
// ═══════════════════════════════════════════════════════════════════════════
function MinistryPillars() {
  const pillars = [
    {
      icon: BookOpen,
      title: "The Bible Is Our Standard",
      desc: "Every doctrine, every practice, every correction is measured strictly against the Word of God. No tradition can override Scripture.",
      color: "from-blue-600 to-[#003366]",
      light: "bg-blue-50",
    },
    {
      icon: ShieldCheck,
      title: "Doctrinal Correction",
      desc: "Standing against false doctrines — prosperity gospel, prophetic manipulation, and spiritual abuse — restoring the apostolic standard.",
      color: "from-[#38BDF8] to-[#0284C7]",
      light: "bg-sky-50",
    },
    {
      icon: Flame,
      title: "Holiness & Purity",
      desc: "We preach genuine holiness of heart, mind, and conduct, as set forth in the New Testament and modelled by the early church.",
      color: "from-orange-500 to-red-600",
      light: "bg-orange-50",
    },
    {
      icon: Mic2,
      title: "Prophetic Ministry",
      desc: "Prophet Amos Evomobor operates under a verified prophetic anointing, bringing divine messages and confirmatory signs.",
      color: "from-purple-600 to-violet-800",
      light: "bg-purple-50",
    },
    {
      icon: Radio,
      title: "Temple TV Broadcasts",
      desc: "Live and recorded services streamed globally via Temple TV on YouTube — making the Correction Mandate accessible worldwide.",
      color: "from-red-500 to-rose-700",
      light: "bg-red-50",
    },
    {
      icon: Heart,
      title: "Community & Welfare",
      desc: "We care for our members and community — through prayer, fellowship, counselling, and practical support in Christ's name.",
      color: "from-emerald-500 to-teal-700",
      light: "bg-emerald-50",
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
          {pillars.map(({ icon: Icon, title, desc, color, light }, i) => (
            <motion.div
              key={i}
              variants={fadeUp}
              whileHover={{ y: -6, transition: { duration: 0.2 } }}
              className="group relative rounded-3xl border border-border bg-white p-8 overflow-hidden hover:shadow-2xl transition-all duration-300"
            >
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-gradient-to-br opacity-5 blur-2xl translate-x-8 -translate-y-8 group-hover:opacity-20 transition-opacity duration-500 pointer-events-none" />
              <div className={`inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br ${color} mb-6 shadow-lg`}>
                <Icon className="h-7 w-7 text-white" />
              </div>
              <h3 className="font-bold text-primary text-lg mb-3 leading-snug">{title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
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
  const { data: events } = useGetUpcomingEvents({ query: { queryKey: getGetUpcomingEventsQueryKey() } });

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

        {events && events.length > 0 ? (
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
                <motion.div
                  key={event.id}
                  variants={fadeUp}
                  whileHover={{ y: -6 }}
                  className="bg-white rounded-3xl p-8 shadow-sm hover:shadow-2xl transition-all duration-300 border border-border group relative overflow-hidden"
                >
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
// NEWCOMERS SECTION
// ═══════════════════════════════════════════════════════════════════════════
function NewcomerSection() {
  const steps = [
    { icon: BookOpen, title: "Our Beliefs", desc: "Discover what JCTM stands for and the doctrinal foundations of our faith.", href: "/about", cta: "Learn More" },
    { icon: MapPin, title: "Find a Branch", desc: "Our headquarters is in Warri. Connect with our services in person or online.", href: "/about", cta: "Get Directions" },
    { icon: Users, title: "Join a Unit", desc: "Become part of the worshipping community and get involved in ministry.", href: "/join", cta: "Get Involved" },
  ];

  return (
    <section className="py-28 bg-white">
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
            <motion.div
              key={i}
              variants={fadeUp}
              whileHover={{ y: -6 }}
              className="text-center p-8 rounded-3xl border border-border hover:border-accent/30 hover:shadow-2xl transition-all duration-300 bg-white group"
            >
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-accent to-[#0284C7] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-accent/20 group-hover:scale-110 transition-transform">
                <Icon className="h-7 w-7 text-white" />
              </div>
              <h4 className="font-bold text-primary text-lg mb-3">{title}</h4>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">{desc}</p>
              <Link href={href}>
                <Button variant="outline" className="rounded-full text-accent border-accent/30 hover:bg-accent hover:text-white hover:border-accent transition-all">
                  {cta}
                </Button>
              </Link>
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
    <section ref={ref} className="relative py-32 bg-[#020b18] text-white overflow-hidden">
      {/* Parallax BG */}
      <motion.div
        style={{ scale }}
        className="absolute inset-0 opacity-15"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#001830] to-[#020b18]" />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle at 20% 50%, rgba(56,189,248,0.15) 0%, transparent 60%), radial-gradient(circle at 80% 50%, rgba(0,51,102,0.3) 0%, transparent 60%)",
          }}
        />
        {/* Dot grid */}
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
          <motion.h2 variants={fadeUp} className="text-5xl md:text-6xl font-serif font-bold mb-6 leading-tight">
            History in the Making
          </motion.h2>
          <motion.p variants={fadeUp} className="text-lg text-white/60 mb-12 leading-relaxed">
            From the initial prophetic calling to the establishment of the Land of Good News, explore the milestones of our journey — a living testament to divine faithfulness.
          </motion.p>
          <motion.div variants={fadeUp}>
            <Link href="/correction-timeline">
              <Button
                size="lg"
                className="bg-gradient-to-r from-accent to-[#0284C7] hover:from-[#0284C7] hover:to-accent text-white h-16 px-14 rounded-full text-lg font-bold shadow-2xl shadow-accent/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-accent/50"
              >
                View Our Timeline
                <ArrowRight className="ml-3 h-5 w-5" />
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// GIVING CTA BAND
// ═══════════════════════════════════════════════════════════════════════════
function GivingBand() {
  return (
    <section className="py-20 bg-gradient-to-r from-primary via-[#003d80] to-primary relative overflow-hidden">
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
            <Link href="/give">
              <Button size="lg" className="h-14 px-10 rounded-full bg-accent hover:bg-accent/90 text-white font-bold text-base shadow-xl shadow-accent/30">
                <Heart className="mr-2 h-5 w-5 fill-white" /> Give Now
              </Button>
            </Link>
            <Link href="/testimonies">
              <Button size="lg" variant="ghost" className="h-14 px-10 rounded-full text-white border border-white/20 hover:bg-white/10">
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
// PAGE ASSEMBLY
// ═══════════════════════════════════════════════════════════════════════════
export default function Home() {
  return (
    <Layout>
      <HeroSection />
      <StatsBar />
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

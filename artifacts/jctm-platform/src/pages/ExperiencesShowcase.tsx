import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, X, MapPin, Calendar, Star, Sparkles, Video,
  Loader2, Heart, Users, Search, Filter, ChevronLeft,
  ChevronRight, Volume2, VolumeX, ArrowRight, Globe,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const PAGE_SIZE = 16;

// ── Types ──────────────────────────────────────────────────────────────────────
interface Experience {
  id: number;
  full_name: string;
  location: string;
  photo_path: string | null;
  video_path: string | null;
  video_filename: string | null;
  is_featured: boolean;
  createdAt: string;
}

type FilterTab = "all" | "featured" | "video";

// ── Helpers ────────────────────────────────────────────────────────────────────
function mediaUrl(path: string | null): string | null {
  if (!path) return null;
  return `${BASE}/api/storage/objects/${path.replace(/^\/objects\//, "")}`;
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// ── Avatar placeholder colours (consistent per name) ──────────────────────────
const GRAD_PAIRS = [
  ["from-violet-600 to-purple-500", "shadow-violet-500/30"],
  ["from-fuchsia-600 to-pink-500",  "shadow-fuchsia-500/30"],
  ["from-indigo-600 to-blue-500",   "shadow-indigo-500/30"],
  ["from-emerald-600 to-teal-500",  "shadow-emerald-500/30"],
  ["from-amber-500 to-orange-500",  "shadow-amber-500/30"],
  ["from-rose-600 to-red-500",      "shadow-rose-500/30"],
];
function avatarGrad(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return GRAD_PAIRS[Math.abs(h) % GRAD_PAIRS.length];
}

// ── Skeleton ───────────────────────────────────────────────────────────────────
function CardSkeleton({ tall = false }: { tall?: boolean }) {
  return (
    <div className={`rounded-3xl overflow-hidden dark:bg-white/[0.03] bg-gray-100 animate-pulse ${tall ? "row-span-2" : ""}`}>
      <div className={`${tall ? "aspect-[3/4]" : "aspect-video"} dark:bg-white/5 bg-gray-200`} />
      <div className="p-4 space-y-2.5">
        <div className="h-4 rounded-full dark:bg-white/8 bg-gray-200 w-3/4" />
        <div className="h-3 rounded-full dark:bg-white/5 bg-gray-200 w-1/2" />
      </div>
    </div>
  );
}

// ── Avatar ─────────────────────────────────────────────────────────────────────
function Avatar({ name, photoUrl, size = "md" }: { name: string; photoUrl: string | null; size?: "sm" | "md" | "lg" }) {
  const [err, setErr] = useState(false);
  const [grad, shadow] = avatarGrad(name);
  const sz = { sm: "w-8 h-8 text-xs", md: "w-11 h-11 text-sm", lg: "w-14 h-14 text-base" }[size];

  if (photoUrl && !err) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className={`${sz} rounded-full object-cover flex-shrink-0 ring-2 dark:ring-white/10 ring-white/70`}
        onError={() => setErr(true)}
      />
    );
  }
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br ${grad} shadow-lg ${shadow} flex items-center justify-center flex-shrink-0 text-white font-bold`}>
      {initials(name)}
    </div>
  );
}

// ── Video Modal ────────────────────────────────────────────────────────────────
function VideoModal({
  exp,
  all,
  onClose,
  onPrev,
  onNext,
}: {
  exp: Experience;
  all: Experience[];
  onClose: () => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
}) {
  const videoUrl = mediaUrl(exp.video_path);
  const photoUrl = mediaUrl(exp.photo_path);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && onPrev) onPrev();
      if (e.key === "ArrowRight" && onNext) onNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);

  const idx = all.findIndex((e) => e.id === exp.id);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/90 backdrop-blur-md"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.93, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.93, y: 20 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-3xl overflow-hidden dark:bg-[#0d0618] bg-white shadow-2xl border dark:border-white/10 border-gray-200"
      >
        {/* Video */}
        <div className="relative bg-black aspect-video group">
          {videoUrl ? (
            <video
              ref={videoRef}
              key={exp.id}
              src={videoUrl}
              controls
              autoPlay
              muted={muted}
              playsInline
              preload="metadata"
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 gap-3">
              <Avatar name={exp.full_name} photoUrl={photoUrl} size="lg" />
              <p className="text-sm text-white/40">No video uploaded</p>
            </div>
          )}

          {/* Top controls overlay */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-3 bg-gradient-to-b from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <button
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? "Unmute" : "Mute"}
              className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Prev / Next arrows */}
          {onPrev && (
            <button
              onClick={(e) => { e.stopPropagation(); onPrev(); }}
              aria-label="Previous"
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          {onNext && (
            <button
              onClick={(e) => { e.stopPropagation(); onNext(); }}
              aria-label="Next"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}

          {/* Position indicator */}
          {all.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/60 text-white text-[10px] font-semibold">
              {idx + 1} / {all.length}
            </div>
          )}
        </div>

        {/* Info row */}
        <div className="flex items-center gap-3 px-5 py-4 border-t dark:border-white/6 border-gray-100">
          <Avatar name={exp.full_name} photoUrl={photoUrl} size="md" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold dark:text-white text-gray-900 truncate">{exp.full_name}</p>
              {exp.is_featured && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/25">
                  <Star className="w-2.5 h-2.5" /> Featured
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs dark:text-white/40 text-gray-500 mt-0.5">
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{exp.location}</span>
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{fmtDate(exp.createdAt)}</span>
            </div>
          </div>
          <Link href="/share-experience">
            <Button size="sm" className="bg-gradient-to-r from-violet-600 to-purple-500 text-white text-xs h-8 px-3 rounded-xl flex-shrink-0 hover:opacity-90 transition-opacity">
              Share Yours <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </Button>
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Featured Spotlight Card (large hero-style) ─────────────────────────────────
function SpotlightCard({ exp, onClick }: { exp: Experience; onClick: () => void }) {
  const photoUrl = mediaUrl(exp.photo_path);

  return (
    <motion.article
      whileHover={{ scale: 1.012 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      onClick={onClick}
      className="relative rounded-3xl overflow-hidden cursor-pointer group shadow-2xl dark:shadow-violet-900/30 col-span-1 sm:col-span-2"
    >
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-950 to-purple-900">
        {photoUrl && (
          <img
            src={photoUrl}
            alt={exp.full_name}
            className="w-full h-full object-cover opacity-55 transition-all duration-700 group-hover:scale-105 group-hover:opacity-65"
          />
        )}
      </div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

      {/* Content */}
      <div className="relative aspect-[16/9] sm:aspect-[2/1] flex flex-col justify-between p-5 sm:p-6">
        {/* Top badges */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500 text-white text-xs font-bold shadow-lg">
              <Star className="w-3 h-3" /> Spotlight
            </span>
            {exp.video_path && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm text-white text-xs font-semibold">
                <Video className="w-3 h-3" /> Video
              </span>
            )}
          </div>
          <span className="text-white/60 text-xs flex items-center gap-1">
            <Calendar className="w-3 h-3" />{fmtDate(exp.createdAt)}
          </span>
        </div>

        {/* Play button centre */}
        <div className="flex-1 flex items-center justify-center">
          <motion.div
            whileHover={{ scale: 1.12 }}
            className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm border-2 border-white/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300"
          >
            <Play className="w-7 h-7 text-white ml-1" />
          </motion.div>
        </div>

        {/* Bottom info */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-black text-white text-xl sm:text-2xl leading-tight truncate">{exp.full_name}</p>
            <p className="text-white/65 text-sm flex items-center gap-1.5 mt-1">
              <MapPin className="w-3.5 h-3.5" /> {exp.location}
            </p>
          </div>
          <div className="flex-shrink-0 w-14 h-14 rounded-full ring-2 ring-white/30 overflow-hidden bg-gradient-to-br from-violet-600 to-purple-500">
            {photoUrl ? (
              <img src={photoUrl} alt={exp.full_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white font-bold text-lg">
                {initials(exp.full_name)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Always-visible play pulse */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-14 h-14 rounded-full bg-white/15 flex items-center justify-center opacity-80 group-hover:opacity-0 transition-opacity duration-300">
          <Play className="w-6 h-6 text-white ml-0.5" />
        </div>
      </div>
    </motion.article>
  );
}

// ── Regular Experience Card ────────────────────────────────────────────────────
function ExperienceCard({
  exp,
  onClick,
  index,
}: {
  exp: Experience;
  onClick: () => void;
  index: number;
}) {
  const photoUrl = mediaUrl(exp.photo_path);
  const [imgError, setImgError] = useState(false);
  const [grad, shadow] = avatarGrad(exp.full_name);

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ delay: (index % 4) * 0.06, duration: 0.4, ease: "easeOut" }}
      onClick={onClick}
      className="group relative rounded-3xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.025] hover:shadow-2xl dark:shadow-violet-900/20 shadow-gray-200/60 dark:bg-white/[0.03] bg-white border dark:border-white/[0.07] border-gray-100/70"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden">
        {photoUrl && !imgError ? (
          <img
            src={photoUrl}
            alt={exp.full_name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br from-violet-950 to-purple-900 flex items-center justify-center`}>
            <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${grad} shadow-xl ${shadow} flex items-center justify-center text-white font-black text-2xl`}>
              {initials(exp.full_name)}
            </div>
          </div>
        )}

        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/45 transition-all duration-300 flex items-center justify-center">
          <div className="w-13 h-13 w-[52px] h-[52px] rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-300">
            <Play className="w-5 h-5 text-violet-600 ml-0.5" />
          </div>
        </div>

        {/* Gradient overlay for bottom text readability */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/50 to-transparent" />

        {/* Badges row */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
          {exp.is_featured && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold shadow-md">
              <Star className="w-2.5 h-2.5" /> Featured
            </span>
          )}
        </div>
        {exp.video_path && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold">
            <Video className="w-2.5 h-2.5" /> Video
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3.5">
        <div className="flex items-center gap-2.5">
          <Avatar name={exp.full_name} photoUrl={photoUrl} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="font-bold dark:text-white text-gray-900 truncate text-sm leading-tight">{exp.full_name}</p>
            <p className="text-xs dark:text-white/35 text-gray-500 flex items-center gap-1 mt-0.5">
              <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
              <span className="truncate">{exp.location}</span>
            </p>
          </div>
          <span className="text-[10px] dark:text-white/20 text-gray-400 flex-shrink-0">{fmtDate(exp.createdAt)}</span>
        </div>
      </div>
    </motion.article>
  );
}

// ── Filter Pill ────────────────────────────────────────────────────────────────
function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`h-9 px-4 rounded-full text-sm font-semibold transition-all duration-200 border ${
        active
          ? "bg-gradient-to-r from-violet-600 to-purple-500 text-white border-transparent shadow-md shadow-violet-500/25"
          : "dark:bg-white/5 bg-white dark:border-white/10 border-gray-200 dark:text-white/50 text-gray-600 hover:dark:bg-white/8 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function ExperiencesShowcase() {
  const { isDark } = useTheme();
  const [activeExp, setActiveExp] = useState<Experience | null>(null);
  const [allLoaded, setAllLoaded] = useState<Experience[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);

  // ── Initial fetch ────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ["experiences-showcase"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/experiences?limit=${PAGE_SIZE}&offset=0`);
      if (!res.ok) throw new Error("Failed to load experiences");
      return res.json() as Promise<{ submissions: Experience[]; total: number }>;
    },
    staleTime: 60_000,
  });

  // Sync initial data into allLoaded
  useEffect(() => {
    if (data) {
      setAllLoaded(data.submissions);
      setHasMore(data.submissions.length < data.total);
    }
  }, [data]);

  const total = data?.total ?? 0;

  // ── Load more ────────────────────────────────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoadingMore(true);
    try {
      const res = await fetch(`${BASE}/api/experiences?limit=${PAGE_SIZE}&offset=${allLoaded.length}`);
      if (!res.ok) throw new Error("Failed");
      const d = (await res.json()) as { submissions: Experience[]; total: number };
      setAllLoaded((prev) => {
        const newList = [...prev, ...d.submissions];
        setHasMore(newList.length < d.total);
        return newList;
      });
    } finally {
      setLoadingMore(false);
      loadingRef.current = false;
    }
  }, [allLoaded.length, hasMore]);

  // ── Infinite scroll sentinel ──────────────────────────────────────────────────
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "200px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  // ── Filtered view ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let items = allLoaded;
    if (filterTab === "featured") items = items.filter((e) => e.is_featured);
    if (filterTab === "video")    items = items.filter((e) => !!e.video_path);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(
        (e) =>
          e.full_name.toLowerCase().includes(q) ||
          e.location.toLowerCase().includes(q)
      );
    }
    return items;
  }, [allLoaded, filterTab, search]);

  const featured = allLoaded.filter((e) => e.is_featured);

  // ── Modal navigation ─────────────────────────────────────────────────────────
  const idx = activeExp ? filtered.findIndex((e) => e.id === activeExp.id) : -1;
  const onPrev = idx > 0 ? () => setActiveExp(filtered[idx - 1]) : null;
  const onNext = idx !== -1 && idx < filtered.length - 1 ? () => setActiveExp(filtered[idx + 1]) : null;

  return (
    <Layout>
      <SEO
        title="Experiences | Jesus Christ Temple Ministry"
        description="Watch real video testimonies from members of Jesus Christ Temple Ministry. Hear how God has moved in their lives and be inspired in your faith."
      />

      {/* ── Hero ───────────────────────────────────────────────────────────────── */}
      <section className="relative pt-20 pb-16 px-4 overflow-hidden">
        {/* Background layers */}
        <div
          className={`absolute inset-0 transition-colors duration-500 ${
            isDark ? "bg-[#07021a]" : "bg-gradient-to-b from-violet-50/80 via-white to-white"
          }`}
        />

        {/* Ambient orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
          <motion.div
            animate={{ scale: [1, 1.12, 1], opacity: [0.35, 0.55, 0.35] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
            className={`absolute -top-32 left-1/2 -translate-x-1/3 w-[750px] h-[500px] rounded-full blur-[130px] ${
              isDark ? "bg-violet-800/35" : "bg-violet-200/70"
            }`}
          />
          <motion.div
            animate={{ scale: [1, 1.08, 1], opacity: [0.2, 0.35, 0.2] }}
            transition={{ duration: 13, repeat: Infinity, ease: "easeInOut", delay: 3 }}
            className={`absolute bottom-0 right-0 w-[500px] h-[400px] rounded-full blur-[100px] ${
              isDark ? "bg-fuchsia-800/20" : "bg-purple-200/50"
            }`}
          />
        </div>

        <div className="relative max-w-4xl mx-auto text-center z-10 space-y-6">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div
              className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold border ${
                isDark
                  ? "bg-violet-500/10 border-violet-500/20 text-violet-300"
                  : "bg-violet-100 border-violet-200 text-violet-700"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" /> Real Stories · Real Lives · Real God
            </div>
          </motion.div>

          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08 }}
          >
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black leading-[1.08] tracking-tight dark:text-white text-gray-900">
              Watch God Move in{" "}
              <span className="relative inline-block text-transparent bg-clip-text bg-gradient-to-r from-violet-600 via-purple-500 to-fuchsia-500">
                Real Lives
                <motion.span
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
                  className="absolute -bottom-1 left-0 right-0 h-0.5 origin-left rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 block"
                />
              </span>
            </h1>
            <p className="text-lg sm:text-xl dark:text-white/50 text-gray-600 mt-4 max-w-2xl mx-auto leading-relaxed">
              These are real testimonies from members and visitors of Jesus Christ Temple Ministry. Be encouraged, be inspired, and believe for your own miracle.
            </p>
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap items-center justify-center gap-3"
          >
            <Link href="/share-experience">
              <Button className="h-12 px-7 text-sm font-bold bg-gradient-to-r from-violet-600 to-purple-500 hover:opacity-90 text-white shadow-xl shadow-violet-500/25 rounded-2xl transition-all hover:scale-[1.03]">
                <Video className="w-4 h-4 mr-2" /> Share Your Experience
              </Button>
            </Link>
          </motion.div>

          {/* Stats chips */}
          {total > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="flex flex-wrap justify-center gap-3"
            >
              {[
                { icon: Users, label: `${total} Experience${total !== 1 ? "s" : ""}` },
                { icon: Star, label: `${featured.length} Featured` },
                { icon: Globe, label: "50+ Nations" },
                { icon: Heart, label: "All Reviewed" },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border ${
                    isDark
                      ? "bg-white/5 border-white/8 text-white/40"
                      : "bg-white border-gray-200 text-gray-500 shadow-sm"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 text-violet-500" /> {label}
                </div>
              ))}
            </motion.div>
          )}
        </div>
      </section>

      {/* ── Search & Filter Bar ─────────────────────────────────────────────────── */}
      {!isLoading && allLoaded.length > 0 && (
        <div className="sticky top-0 z-20 px-4 py-3 dark:bg-[#07021a]/90 bg-white/90 backdrop-blur-xl border-b dark:border-white/[0.06] border-gray-100 shadow-sm">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 dark:text-white/30 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by name or location…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-4 rounded-2xl text-sm dark:bg-white/6 bg-gray-100 dark:text-white text-gray-900 placeholder:dark:text-white/25 placeholder:text-gray-400 border dark:border-white/8 border-transparent focus:outline-none focus:ring-2 dark:focus:ring-violet-500/40 focus:ring-violet-500/30 transition-all"
              />
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5 sm:pb-0 scrollbar-hide">
              <Filter className="w-4 h-4 dark:text-white/25 text-gray-400 flex-shrink-0" />
              <FilterPill active={filterTab === "all"} onClick={() => setFilterTab("all")}>
                All
                {total > 0 && (
                  <span className="ml-1.5 text-[10px] opacity-70">{total}</span>
                )}
              </FilterPill>
              <FilterPill active={filterTab === "featured"} onClick={() => setFilterTab("featured")}>
                <Star className="w-3 h-3 mr-1.5 inline" />Featured
                {featured.length > 0 && (
                  <span className="ml-1.5 text-[10px] opacity-70">{featured.length}</span>
                )}
              </FilterPill>
              <FilterPill active={filterTab === "video"} onClick={() => setFilterTab("video")}>
                <Video className="w-3 h-3 mr-1.5 inline" />Video Only
              </FilterPill>
            </div>
          </div>
        </div>
      )}

      {/* ── Featured Spotlight ─────────────────────────────────────────────────── */}
      {!isLoading && featured.length > 0 && filterTab === "all" && !search && (
        <section className="px-4 pt-10 pb-4">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 mb-5"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shadow-amber-500/30">
                <Star className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-lg font-black dark:text-white text-gray-900">Featured Testimonies</h2>
            </motion.div>

            <div className={`grid gap-4 ${featured.length === 1 ? "max-w-2xl" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
              {featured.slice(0, 3).map((exp, i) =>
                i === 0 && featured.length > 1 ? (
                  <SpotlightCard key={exp.id} exp={exp} onClick={() => setActiveExp(exp)} />
                ) : (
                  <ExperienceCard key={exp.id} exp={exp} index={i} onClick={() => setActiveExp(exp)} />
                )
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── Main Gallery ───────────────────────────────────────────────────────── */}
      <section className="px-4 pt-8 pb-12">
        <div className="max-w-6xl mx-auto">
          {/* Section header */}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-purple-500 flex items-center justify-center shadow-md shadow-violet-500/30">
                  <Video className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-lg font-black dark:text-white text-gray-900">
                  {search || filterTab !== "all" ? "Results" : "All Experiences"}
                  <span className="ml-2 text-sm font-normal dark:text-white/30 text-gray-400">
                    ({filtered.length}{hasMore && !search ? "+" : ""})
                  </span>
                </h2>
              </div>
            </div>
          )}

          {/* Skeleton loaders */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
            </div>
          ) : filtered.length === 0 && !isLoading ? (
            /* Empty state */
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-24 space-y-6"
            >
              <div
                className={`w-24 h-24 rounded-3xl mx-auto flex items-center justify-center ${
                  isDark ? "bg-white/5" : "bg-gray-100"
                }`}
              >
                {search ? (
                  <Search className="w-10 h-10 dark:text-white/20 text-gray-300" />
                ) : (
                  <Video className="w-10 h-10 dark:text-white/20 text-gray-300" />
                )}
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold dark:text-white text-gray-900">
                  {search ? "No results found" : "No experiences yet"}
                </h3>
                <p className="dark:text-white/40 text-gray-500 max-w-sm mx-auto text-sm">
                  {search
                    ? `No experiences match "${search}". Try a different name or location.`
                    : "Be the first to share how God has moved in your life through this ministry."}
                </p>
              </div>
              {search ? (
                <button
                  onClick={() => setSearch("")}
                  className="text-sm font-semibold text-violet-500 hover:text-violet-400 underline underline-offset-2"
                >
                  Clear search
                </button>
              ) : (
                <Link href="/share-experience">
                  <Button className="bg-gradient-to-r from-violet-600 to-purple-500 text-white px-7 h-11 rounded-2xl font-bold shadow-lg shadow-violet-500/25">
                    <Video className="w-4 h-4 mr-2" /> Share Your Experience
                  </Button>
                </Link>
              )}
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((exp, i) => (
                <ExperienceCard key={exp.id} exp={exp} index={i} onClick={() => setActiveExp(exp)} />
              ))}
            </div>
          )}

          {/* Infinite scroll sentinel */}
          {hasMore && !search && filterTab === "all" && (
            <div ref={sentinelRef} className="flex justify-center mt-10 h-12">
              {loadingMore && (
                <div className="flex items-center gap-2 dark:text-white/30 text-gray-400 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading more…
                </div>
              )}
            </div>
          )}

          {/* Manual load more for filtered views */}
          {hasMore && (search || filterTab !== "all") && (
            <div className="flex justify-center mt-10">
              <Button
                onClick={loadMore}
                disabled={loadingMore}
                variant="outline"
                className="h-12 px-8 rounded-2xl dark:border-white/12 border-gray-200 dark:text-white/60 text-gray-700 dark:hover:bg-white/5 hover:bg-gray-50 font-semibold"
              >
                {loadingMore ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading…</>
                ) : (
                  <>Load more <ArrowRight className="w-4 h-4 ml-2" /></>
                )}
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* ── CTA Banner ─────────────────────────────────────────────────────────── */}
      {!isLoading && (
        <section className="px-4 pb-24">
          <div className="max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="relative rounded-3xl overflow-hidden p-8 sm:p-10 text-center"
              style={{
                background: isDark
                  ? "linear-gradient(135deg, #1e0a40 0%, #2d0f60 50%, #1a0835 100%)"
                  : "linear-gradient(135deg, #7c3aed 0%, #9333ea 50%, #6d28d9 100%)",
              }}
            >
              {/* Decorative orbs */}
              <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-56 h-56 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/2 pointer-events-none" />

              <div className="relative space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 border border-white/20 text-white text-sm font-semibold">
                  <Heart className="w-3.5 h-3.5" /> Your Story Could Be Next
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                  Has God moved in your life<br className="hidden sm:block" /> through JCTM?
                </h2>
                <p className="text-white/70 max-w-md mx-auto text-base">
                  Share your video testimony and inspire thousands of people around the world. Your experience matters.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-1">
                  <Link href="/share-experience">
                    <Button className="h-12 px-8 bg-white text-violet-700 hover:bg-white/90 font-bold rounded-2xl shadow-xl transition-all hover:scale-[1.03]">
                      <Video className="w-4 h-4 mr-2" /> Share Your Experience
                    </Button>
                  </Link>
                  <Link href="/testimonies">
                    <Button
                      variant="outline"
                      className="h-12 px-8 border-white/30 text-white hover:bg-white/10 rounded-2xl font-semibold"
                    >
                      Read Text Testimonies <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* ── Video Modal ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {activeExp && (
          <VideoModal
            key={activeExp.id}
            exp={activeExp}
            all={filtered}
            onClose={() => setActiveExp(null)}
            onPrev={onPrev}
            onNext={onNext}
          />
        )}
      </AnimatePresence>
    </Layout>
  );
}

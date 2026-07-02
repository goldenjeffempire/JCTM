import { useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, X, MapPin, Calendar, Star, Sparkles, Video,
  ChevronRight, Loader2, Heart, Users, Clock, ArrowRight,
  Volume2, VolumeX,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const PAGE_SIZE = 12;

// ── Types ─────────────────────────────────────────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function mediaUrl(path: string | null): string | null {
  if (!path) return null;
  return `${BASE}/api/storage/objects/${path.replace(/^\/objects\//, "")}`;
}

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", year: "numeric" }); }
  catch { return ""; }
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function CardSkeleton() {
  return (
    <div className="rounded-3xl overflow-hidden dark:bg-white/[0.03] bg-gray-100 animate-pulse">
      <div className="aspect-video dark:bg-white/5 bg-gray-200" />
      <div className="p-4 space-y-2.5">
        <div className="h-4 rounded-full dark:bg-white/8 bg-gray-200 w-3/4" />
        <div className="h-3 rounded-full dark:bg-white/5 bg-gray-200 w-1/2" />
      </div>
    </div>
  );
}

// ── Video Modal ───────────────────────────────────────────────────────────────
function VideoModal({ exp, onClose }: { exp: Experience; onClose: () => void }) {
  const videoUrl = mediaUrl(exp.video_path);
  const photoUrl = mediaUrl(exp.photo_path);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-3xl overflow-hidden dark:bg-[#0d0618] bg-white shadow-2xl border dark:border-white/10 border-gray-200"
      >
        {/* Video player */}
        <div className="relative bg-black aspect-video">
          {videoUrl ? (
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              autoPlay
              muted={muted}
              playsInline
              preload="metadata"
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500">
              <Video className="w-12 h-12 opacity-30" />
            </div>
          )}
          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Close video"
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info row */}
        <div className="flex items-center gap-3 px-5 py-4">
          {photoUrl ? (
            <img src={photoUrl} alt={exp.full_name} className="w-11 h-11 rounded-full object-cover flex-shrink-0 ring-2 dark:ring-white/10 ring-gray-200" />
          ) : (
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-violet-600 to-purple-500 flex items-center justify-center flex-shrink-0 text-white font-bold text-sm">
              {exp.full_name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold dark:text-white text-gray-900 truncate">{exp.full_name}</p>
              {exp.is_featured && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-500 border border-amber-500/30">
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
            <Button size="sm" className="bg-gradient-to-r from-violet-600 to-purple-500 text-white text-xs h-8 px-3 rounded-xl flex-shrink-0">
              Share Yours <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </Button>
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Experience Card ───────────────────────────────────────────────────────────
function ExperienceCard({ exp, onClick, index }: { exp: Experience; onClick: () => void; index: number }) {
  const photoUrl = mediaUrl(exp.photo_path);
  const [imgError, setImgError] = useState(false);

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ delay: (index % 4) * 0.07, duration: 0.4 }}
      onClick={onClick}
      className="group relative rounded-3xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl dark:shadow-violet-900/20 shadow-gray-200/80 dark:bg-white/[0.03] bg-white border dark:border-white/8 border-gray-100"
    >
      {/* Video thumbnail / avatar background */}
      <div className="relative aspect-video overflow-hidden dark:bg-[#0d0618] bg-gray-100">
        {photoUrl && !imgError ? (
          <img
            src={photoUrl}
            alt={exp.full_name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-950 to-purple-900">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-600 to-purple-500 flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-violet-500/30">
              {exp.full_name.charAt(0).toUpperCase()}
            </div>
          </div>
        )}

        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            whileHover={{ scale: 1 }}
            className="w-14 h-14 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0"
          >
            <Play className="w-6 h-6 text-violet-600 ml-0.5" />
          </motion.div>
        </div>

        {/* Featured badge */}
        {exp.is_featured && (
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500 text-white text-[11px] font-bold shadow-lg">
            <Star className="w-3 h-3" /> Featured
          </div>
        )}

        {/* Video indicator */}
        {exp.video_path && (
          <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold">
            <Video className="w-3 h-3" /> Video
          </div>
        )}
      </div>

      {/* Card footer */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold dark:text-white text-gray-900 truncate text-sm">{exp.full_name}</p>
            <p className="text-xs dark:text-white/40 text-gray-500 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{exp.location}</span>
            </p>
          </div>
          <span className="text-[11px] dark:text-white/25 text-gray-400 flex-shrink-0 mt-0.5">
            {fmtDate(exp.createdAt)}
          </span>
        </div>
      </div>
    </motion.article>
  );
}

// ── Featured Hero Card ────────────────────────────────────────────────────────
function FeaturedCard({ exp, onClick }: { exp: Experience; onClick: () => void }) {
  const photoUrl = mediaUrl(exp.photo_path);

  return (
    <motion.article
      whileHover={{ scale: 1.015 }}
      onClick={onClick}
      className="relative rounded-3xl overflow-hidden cursor-pointer aspect-[4/3] sm:aspect-[3/2] group shadow-2xl"
    >
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-900 to-purple-800">
        {photoUrl && (
          <img src={photoUrl} alt={exp.full_name} className="w-full h-full object-cover opacity-50 transition-transform duration-500 group-hover:scale-105 group-hover:opacity-60" />
        )}
      </div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* Play button */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          whileHover={{ scale: 1.1 }}
          className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm border-2 border-white/40 flex items-center justify-center opacity-80 group-hover:opacity-100 transition-all duration-300"
        >
          <Play className="w-7 h-7 text-white ml-0.5" />
        </motion.div>
      </div>

      {/* Badges */}
      <div className="absolute top-4 left-4 flex items-center gap-2">
        <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500 text-white text-xs font-bold shadow-lg">
          <Star className="w-3 h-3" /> Featured
        </span>
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 p-5">
        <p className="font-black text-white text-lg leading-tight truncate">{exp.full_name}</p>
        <p className="text-white/70 text-sm flex items-center gap-1.5 mt-0.5">
          <MapPin className="w-3.5 h-3.5" /> {exp.location}
        </p>
      </div>
    </motion.article>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ExperiencesShowcase() {
  const { isDark } = useTheme();
  const [activeExp, setActiveExp] = useState<Experience | null>(null);
  const [page, setPage] = useState(0);
  const [allLoaded, setAllLoaded] = useState<Experience[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["experiences-showcase"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/experiences?limit=${PAGE_SIZE}&offset=0`);
      if (!res.ok) throw new Error("Failed to load experiences");
      return res.json() as Promise<{ submissions: Experience[]; total: number }>;
    },
    staleTime: 60_000,
    onSuccess: (d) => {
      setAllLoaded(d.submissions);
      setHasMore(d.submissions.length < d.total);
    },
  });

  const loadMore = useCallback(async () => {
    const nextOffset = allLoaded.length;
    setLoadingMore(true);
    try {
      const res = await fetch(`${BASE}/api/experiences?limit=${PAGE_SIZE}&offset=${nextOffset}`);
      if (!res.ok) throw new Error("Failed");
      const d = await res.json() as { submissions: Experience[]; total: number };
      setAllLoaded((prev) => [...prev, ...d.submissions]);
      setHasMore(allLoaded.length + d.submissions.length < d.total);
    } finally { setLoadingMore(false); }
  }, [allLoaded.length]);

  const featured = allLoaded.filter((e) => e.is_featured);
  const all = allLoaded;
  const total = data?.total ?? 0;

  return (
    <Layout>
      <SEO
        title="Experiences | Jesus Christ Temple Ministry"
        description="Watch real video testimonies from members of Jesus Christ Temple Ministry. Hear how God has moved in their lives and be inspired in your faith."
      />

      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <section className="relative pt-20 pb-14 px-4 overflow-hidden">
        {/* Background */}
        <div className={`absolute inset-0 transition-colors duration-500 ${isDark ? "bg-[#07021a]" : "bg-gradient-to-b from-violet-50 to-white"}`} />
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className={`absolute -top-24 left-1/2 -translate-x-1/4 w-[700px] h-[500px] rounded-full blur-[120px] opacity-50 ${isDark ? "bg-violet-800/30" : "bg-violet-200/60"}`} />
          <div className={`absolute bottom-0 right-0 w-[400px] h-[300px] rounded-full blur-[80px] opacity-30 ${isDark ? "bg-purple-700/20" : "bg-purple-100/70"}`} />
        </div>

        <div className="relative max-w-4xl mx-auto text-center space-y-5 z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold mb-5 border ${isDark ? "bg-violet-500/10 border-violet-500/20 text-violet-300" : "bg-violet-100 border-violet-200 text-violet-700"}`}>
              <Sparkles className="w-3.5 h-3.5" /> Real Stories · Real Lives · Real God
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black leading-[1.1] tracking-tight dark:text-white text-gray-900">
              Watch God Move in{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-purple-400">
                Real Lives
              </span>
            </h1>
            <p className="text-lg sm:text-xl dark:text-white/50 text-gray-600 mt-4 max-w-2xl mx-auto leading-relaxed">
              These are real testimonies from members and visitors of Jesus Christ Temple Ministry. Be encouraged, be inspired, and believe for your own miracle.
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link href="/share-experience">
              <Button className="h-12 px-7 text-sm font-bold bg-gradient-to-r from-violet-600 to-purple-500 hover:from-violet-500 hover:to-purple-400 text-white shadow-xl shadow-violet-500/25 rounded-2xl hover:scale-[1.03] transition-all">
                <Video className="w-4 h-4 mr-2" /> Share Your Experience
              </Button>
            </Link>
          </motion.div>

          {/* Stats */}
          {total > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
              className="flex flex-wrap justify-center gap-6 pt-2">
              {[
                { icon: Users, label: `${total} Experience${total !== 1 ? "s" : ""}` },
                { icon: Star,  label: `${featured.length} Featured` },
                { icon: Heart, label: "All Reviewed" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border ${isDark ? "bg-white/5 border-white/8 text-white/40" : "bg-white border-gray-200 text-gray-500 shadow-sm"}`}>
                  <Icon className="w-3.5 h-3.5 text-violet-500" /> {label}
                </div>
              ))}
            </motion.div>
          )}
        </div>
      </section>

      {/* ── Featured Grid ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {featured.length > 0 && (
          <section className="px-4 pb-14">
            <div className="max-w-6xl mx-auto">
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shadow-amber-500/30">
                  <Star className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-xl font-black dark:text-white text-gray-900">Featured Testimonies</h2>
              </motion.div>
              <div className={`grid gap-4 ${featured.length === 1 ? "max-w-sm" : featured.length === 2 ? "sm:grid-cols-2 max-w-2xl" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
                {featured.slice(0, 3).map((exp) => (
                  <FeaturedCard key={exp.id} exp={exp} onClick={() => setActiveExp(exp)} />
                ))}
              </div>
            </div>
          </section>
        )}
      </AnimatePresence>

      {/* ── All Experiences Grid ──────────────────────────────────────────────── */}
      <section className="px-4 pb-24">
        <div className="max-w-6xl mx-auto">
          {all.length > 0 && (
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-purple-500 flex items-center justify-center shadow-md shadow-violet-500/30">
                <Video className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-xl font-black dark:text-white text-gray-900">
                All Experiences
                {total > 0 && <span className="ml-2 text-sm font-normal dark:text-white/30 text-gray-400">({total})</span>}
              </h2>
            </div>
          )}

          {/* Loading skeletons */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
            </div>
          ) : all.length === 0 ? (
            /* Empty state */
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-center py-24 space-y-6">
              <div className={`w-24 h-24 rounded-3xl mx-auto flex items-center justify-center ${isDark ? "bg-white/5" : "bg-gray-100"}`}>
                <Video className="w-10 h-10 dark:text-white/20 text-gray-300" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold dark:text-white text-gray-900">No experiences yet</h3>
                <p className="dark:text-white/40 text-gray-500 max-w-sm mx-auto text-sm">
                  Be the first to share how God has moved in your life through this ministry.
                </p>
              </div>
              <Link href="/share-experience">
                <Button className="bg-gradient-to-r from-violet-600 to-purple-500 text-white px-7 h-11 rounded-2xl font-bold shadow-lg shadow-violet-500/25">
                  <Video className="w-4 h-4 mr-2" /> Share Your Experience
                </Button>
              </Link>
            </motion.div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {all.map((exp, i) => (
                  <ExperienceCard key={exp.id} exp={exp} index={i} onClick={() => setActiveExp(exp)} />
                ))}
              </div>

              {/* Load more */}
              {hasMore && (
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
                      <>Load more experiences <ArrowRight className="w-4 h-4 ml-2" /></>
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* ── CTA Banner ────────────────────────────────────────────────────────── */}
      {!isLoading && (
        <section className="px-4 pb-20">
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
              {/* Decorative orb */}
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/2 pointer-events-none" />

              <div className="relative space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 border border-white/20 text-white text-sm font-semibold">
                  <Heart className="w-3.5 h-3.5" /> Your Story Could Be Next
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                  Has God moved in your life through JCTM?
                </h2>
                <p className="text-white/70 text-base max-w-md mx-auto">
                  Share your video testimony and inspire thousands of people around the world. Your experience matters.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-1">
                  <Link href="/share-experience">
                    <Button className="h-12 px-8 bg-white text-violet-700 hover:bg-white/90 font-bold rounded-2xl shadow-xl transition-all hover:scale-[1.03]">
                      <Video className="w-4 h-4 mr-2" /> Share Your Experience
                    </Button>
                  </Link>
                  <Link href="/testimonies">
                    <Button variant="outline" className="h-12 px-8 border-white/30 text-white hover:bg-white/10 rounded-2xl font-semibold">
                      Read Text Testimonies <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* ── Video Modal ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {activeExp && <VideoModal exp={activeExp} onClose={() => setActiveExp(null)} />}
      </AnimatePresence>
    </Layout>
  );
}

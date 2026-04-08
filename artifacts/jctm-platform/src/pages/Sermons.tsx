import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetSermonStats, getGetSermonStatsQueryKey, useSyncSermons } from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Volume2, Play, RefreshCw, ExternalLink, Zap, Star, Radio, Loader2, Bot, Link as LinkIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Link } from "wouter";
import { DualStreamToggle, useStreamQuality } from "@/components/DualStreamToggle";

const CATEGORIES = [
  { id: "all", label: "All Sermons", emoji: "📖" },
  { id: "correction", label: "Correction Mandate", emoji: "⚡" },
  { id: "holiness", label: "Holiness", emoji: "✨" },
  { id: "primitive", label: "Primitive Christianity", emoji: "🕊️" },
  { id: "prophecy", label: "Prophecy", emoji: "🔥" },
  { id: "baptism", label: "Water Baptism", emoji: "💧" },
  { id: "prayer", label: "Prayer", emoji: "🙏" },
  { id: "endtimes", label: "End Times", emoji: "⏳" },
  { id: "family", label: "Family & Marriage", emoji: "❤️" },
  { id: "healing", label: "Healing & Miracles", emoji: "🌟" },
];

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  correction: ["correction", "mandate", "error", "false", "prosperity", "apostle", "prophet"],
  holiness: ["holiness", "holy", "sanctif", "separated", "consecrat"],
  primitive: ["primitive", "original", "apostolic", "first century", "restoration"],
  prophecy: ["prophec", "prophetic", "revelation", "vision", "end time"],
  baptism: ["baptism", "baptize", "water", "immersion"],
  prayer: ["prayer", "pray", "intercession", "fasting"],
  endtimes: ["rapture", "end time", "second coming", "antichrist", "revelation"],
  family: ["family", "marriage", "husband", "wife", "children"],
  healing: ["healing", "miracle", "deliver", "sick", "restoration"],
};

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const PAGE_SIZE = 50;

interface SermonItem {
  id: number;
  videoId: string;
  title: string;
  thumbnailUrl: string;
  publishedAt: string;
  description?: string | null;
  isFeatured?: boolean;
  isLive?: boolean;
}

declare global {
  interface Window { _searchTimeout: number }
}

async function fetchSermonsPage(search: string, offset: number): Promise<SermonItem[]> {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
  if (search) params.set("search", search);
  const res = await fetch(`${BASE}/api/sermons?${params}`);
  if (!res.ok) throw new Error("Failed to fetch sermons");
  return res.json();
}

export default function Sermons() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sermons, setSermons] = useState<SermonItem[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isHarvesting, setIsHarvesting] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const loaderRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { quality, toggle: toggleQuality } = useStreamQuality();

  const { data: stats, refetch: refetchStats } = useGetSermonStats({
    query: { queryKey: getGetSermonStatsQueryKey() }
  });
  const syncMutation = useSyncSermons();

  // Load first page whenever search changes
  const loadFirstPage = useCallback(async (searchTerm: string) => {
    setIsLoading(true);
    setSermons([]);
    setOffset(0);
    setHasMore(true);
    try {
      const results = await fetchSermonsPage(searchTerm, 0);
      setSermons(results);
      setOffset(results.length);
      setHasMore(results.length === PAGE_SIZE);
    } catch {
      toast.error("Could not load sermons. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFirstPage(debouncedSearch);
  }, [debouncedSearch, loadFirstPage]);

  const loadNextPage = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const results = await fetchSermonsPage(debouncedSearch, offset);
      setSermons(prev => {
        // deduplicate by id
        const ids = new Set(prev.map(s => s.id));
        const fresh = results.filter(s => !ids.has(s.id));
        return [...prev, ...fresh];
      });
      setOffset(prev => prev + results.length);
      setHasMore(results.length === PAGE_SIZE);
    } catch {
      toast.error("Could not load more sermons.");
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, debouncedSearch, offset]);

  // Infinite scroll — observe the sentinel div at the bottom
  useEffect(() => {
    const sentinel = loaderRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isLoading) {
          loadNextPage();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, isLoading, loadNextPage]);

  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout(window._searchTimeout);
    window._searchTimeout = setTimeout(() => setDebouncedSearch(val), 400) as unknown as number;
  };

  const handleSync = () => {
    syncMutation.mutate(undefined, {
      onSuccess: (data) => {
        toast.success((data as { message?: string }).message ?? "Sync complete");
        loadFirstPage(debouncedSearch);
        refetchStats();
      },
      onError: () => toast.error("Sync failed — check YouTube API key"),
    });
  };

  const handleHarvest = async () => {
    const confirmed = confirm(
      "This will delete all sermons and re-fetch the full channel history (479+ videos). Continue?"
    );
    if (!confirmed) return;

    setIsHarvesting(true);
    const toastId = toast.loading("Harvesting full channel history…");
    try {
      const res = await fetch(`${BASE}/api/sermons?harvest=true`, { method: "POST" });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Harvest failed");
      toast.success(data.message ?? "Harvest complete", { id: toastId });
      await loadFirstPage(debouncedSearch);
      refetchStats();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Harvest failed";
      toast.error(msg, { id: toastId });
    } finally {
      setIsHarvesting(false);
    }
  };

  // SSE: real-time new sermon push
  const esRef = useRef<EventSource | null>(null);
  useEffect(() => {
    const es = new EventSource(`${BASE}/api/sermons/stream`);
    esRef.current = es;

    es.addEventListener("new_sermon", (e) => {
      try {
        const data = JSON.parse(e.data) as SermonItem & { isLive?: boolean; isFeatured?: boolean };
        const isLive = data.isLive;
        toast.success(
          isLive ? "🔴 Live Now — Prophet Amos is Live!" : "New Message from Prophet Amos",
          {
            description: data.title,
            duration: 8000,
            action: {
              label: "Watch",
              onClick: () => window.open(`https://www.youtube.com/watch?v=${data.videoId}`, "_blank"),
            },
          }
        );
        // Prepend the new sermon to the top of the list
        setSermons(prev => {
          if (prev.some(s => s.id === data.id)) return prev;
          return [data, ...prev];
        });
        refetchStats();
      } catch { /* ignore */ }
    });

    es.addEventListener("sync_complete", () => {
      loadFirstPage(debouncedSearch);
      refetchStats();
    });

    return () => { es.close(); };
  }, [debouncedSearch, loadFirstPage, refetchStats]);

  const liveSermons = sermons.filter(s => s.isLive);

  const filteredSermons = activeCategory === "all"
    ? sermons
    : sermons.filter(s => {
        const keywords = CATEGORY_KEYWORDS[activeCategory] ?? [];
        const text = `${s.title} ${s.description ?? ""}`.toLowerCase();
        return keywords.some(kw => text.includes(kw));
      });

  return (
    <Layout>
      {/* Netflix-style dark hero header */}
      <div className="bg-gradient-to-b from-primary via-primary/90 to-background pt-24 pb-8 px-4 mb-0">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6"
          >
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-1.5 h-8 bg-sky-400 rounded-full inline-block" />
                <span className="text-sky-300 text-xs font-bold uppercase tracking-widest">Temple TV Library</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-serif font-bold text-white mb-2">
                Sermon Hub
              </h1>
              <p className="text-white/60 text-sm max-w-xl">
                Teachings of Prophet Amos Evomobor — Primitive Christianity, Holiness &amp; the Correction Mandate
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <DualStreamToggle quality={quality} onToggle={toggleQuality} />
              <Link href="/sermon-assistant">
                <Button className="gap-2 bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-300 rounded-xl">
                  <Bot className="w-4 h-4" /> Ask AI
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">

          {/* Live banner */}
          {liveSermons.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-panel rounded-2xl p-4 border border-red-400/30 bg-red-50/30 mb-6 flex items-center gap-3"
            >
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>
              <Radio className="h-4 w-4 text-red-500" />
              <span className="text-sm font-semibold text-red-600">
                Live Now — {liveSermons[0].title}
              </span>
              <a
                href={`https://www.youtube.com/watch?v=${liveSermons[0].videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto"
              >
                <Button size="sm" className="bg-red-500 hover:bg-red-600 text-white rounded-full text-xs gap-1">
                  <Radio className="h-3 w-3" /> Join Live
                </Button>
              </a>
            </motion.div>
          )}

          {/* Stats row */}
          <div className="flex flex-wrap gap-3 mb-6">
            {stats && (
              <>
                <div className="glass-panel px-4 py-2.5 rounded-xl">
                  <span className="text-xl font-bold text-primary">{stats.total}</span>
                  <span className="text-xs text-muted-foreground ml-2">sermons</span>
                </div>
                {stats.totalViews && (
                  <div className="glass-panel px-4 py-2.5 rounded-xl">
                    <span className="text-xl font-bold text-primary">{stats.totalViews.toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground ml-2">views</span>
                  </div>
                )}
              </>
            )}
            {!isLoading && sermons.length > 0 && (
              <div className="glass-panel px-4 py-2.5 rounded-xl">
                <span className="text-xl font-bold text-accent">{filteredSermons.length}</span>
                <span className="text-xs text-muted-foreground ml-2">showing</span>
              </div>
            )}
          </div>

          {/* Netflix-style category tabs */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 mb-6">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  activeCategory === cat.id
                    ? "bg-primary text-white shadow-sm"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
                {activeCategory === cat.id && cat.id !== "all" && (
                  <span className="bg-white/20 text-white text-[10px] px-1.5 rounded-full ml-1">
                    {filteredSermons.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Controls */}
          <div className="flex gap-3 flex-wrap mb-8">
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search sermons…"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10 border-border bg-background"
              />
            </div>
            <Button
              variant="outline"
              onClick={handleSync}
              disabled={syncMutation.isPending || isHarvesting}
              className="flex items-center gap-2 text-primary"
            >
              <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
              Sync
            </Button>
            <Button
              variant="outline"
              onClick={handleHarvest}
              disabled={syncMutation.isPending || isHarvesting}
              className="flex items-center gap-2 text-primary"
            >
              {isHarvesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {isHarvesting ? "Harvesting…" : "Harvest All"}
            </Button>
          </div>

        {/* Skeleton on first load */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="glass-panel rounded-2xl overflow-hidden">
                <Skeleton className="aspect-video w-full" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-4 w-full rounded" />
                  <Skeleton className="h-3 w-2/3 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Sermon grid */}
        {!isLoading && (
          <>
            {/* Category section header */}
            {activeCategory !== "all" && (
              <motion.div
                key={activeCategory}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 mb-5"
              >
                <span className="text-2xl">{CATEGORIES.find(c => c.id === activeCategory)?.emoji}</span>
                <div>
                  <h2 className="text-xl font-serif font-bold text-primary">
                    {CATEGORIES.find(c => c.id === activeCategory)?.label}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {filteredSermons.length} sermons in this category
                  </p>
                </div>
              </motion.div>
            )}

            {filteredSermons.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-muted-foreground text-lg">
                  {debouncedSearch
                    ? `No sermons match "${debouncedSearch}"`
                    : activeCategory !== "all"
                    ? `No sermons found in this category yet. Try "All Sermons".`
                    : 'No sermons found. Click "Harvest All" to load the full Temple TV library.'}
                </p>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeCategory}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
                >
                  {filteredSermons.map((sermon, i) => (
                    <SermonCard key={sermon.id} sermon={sermon} index={i} />
                  ))}
                </motion.div>
              </AnimatePresence>
            )}

            {/* Infinite scroll sentinel */}
            <div ref={loaderRef} className="mt-10 flex justify-center">
              {isLoadingMore && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading more sermons…
                </div>
              )}
              {!hasMore && sermons.length > 0 && (
                <p className="text-muted-foreground text-sm">
                  All {sermons.length} sermons loaded · <span className="text-accent font-medium">Glory to God</span>
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

function SermonCard({ sermon, index }: { sermon: SermonItem; index: number }) {
  const [audioMode, setAudioMode] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.03, 0.6) }}
      className={`glass-panel rounded-2xl overflow-hidden group hover:shadow-lg transition-all duration-300 ${
        sermon.isLive
          ? "ring-2 ring-red-400/60 hover:shadow-red-200"
          : sermon.isFeatured
          ? "ring-1 ring-accent/40 hover:shadow-accent/10"
          : "hover:shadow-accent/10"
      }`}
    >
      <div className="relative aspect-video bg-muted overflow-hidden">
        {audioMode ? (
          <div className="absolute inset-0 bg-primary flex flex-col items-center justify-center gap-3">
            <Volume2 className="h-12 w-12 text-accent" />
            <p className="text-white text-sm font-medium px-4 text-center">{sermon.title}</p>
            <p className="text-white/60 text-xs">Audio Only Mode</p>
          </div>
        ) : (
          <img
            src={sermon.thumbnailUrl}
            alt={sermon.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${sermon.videoId}/hqdefault.jpg`;
            }}
            loading="lazy"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

        {/* Badges */}
        {sermon.isLive && (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>
            LIVE
          </div>
        )}
        {!sermon.isLive && sermon.isFeatured && (
          <div className="absolute top-2 left-2">
            <Badge className="bg-accent text-white text-[10px] px-2 py-0.5 gap-1 rounded-full">
              <Star className="h-2.5 w-2.5 fill-white" /> Featured
            </Badge>
          </div>
        )}

        <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
          <a
            href={`https://www.youtube.com/watch?v=${sermon.videoId}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button
              size="sm"
              className={`${
                sermon.isLive ? "bg-red-500 hover:bg-red-600" : "bg-accent hover:bg-accent/90"
              } text-white rounded-full text-xs gap-1`}
            >
              <Play className="h-3 w-3" />
              {sermon.isLive ? "Join Live" : "Watch"}
            </Button>
          </a>
          <button
            onClick={() => setAudioMode(!audioMode)}
            className={`text-xs px-3 py-1.5 rounded-full flex items-center gap-1 transition-colors ${
              audioMode ? "bg-accent text-white" : "bg-white/20 text-white hover:bg-white/30"
            }`}
          >
            <Volume2 className="h-3 w-3" />
            {audioMode ? "Audio On" : "Audio Only"}
          </button>
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-primary text-sm leading-snug mb-1 line-clamp-2">
          {sermon.title}
        </h3>
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(sermon.publishedAt), { addSuffix: true })}
          </p>
          <a
            href={`https://www.youtube.com/watch?v=${sermon.videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent hover:text-accent/80 flex items-center gap-1 transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            YouTube
          </a>
        </div>
      </div>
    </motion.div>
  );
}

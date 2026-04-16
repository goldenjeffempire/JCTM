import { Fragment, useState, useEffect, useRef, useCallback } from "react";
import {
  ChevronUp, ChevronDown,
  Sparkles, Radio, Clock, Share2, BookOpen,
  Volume2, VolumeX, Heart, MessageCircle, Eye,
  X, Send, Youtube, PlayCircle, RefreshCw,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { ADSENSE_SLOTS, AdSlot } from "@/components/ads/AdSense";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const PAGE_SIZE = 20;

function getVisitorId(): string {
  const key = "jctm_visitor_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

interface IntroItem {
  id: number;
  videoId: string;
  title: string;
  thumbnailUrl: string;
  description?: string | null;
  publishedAt: string;
  viewCount?: number | null;
  isLive?: boolean;
  duration?: string | null;
}

interface IntroPage {
  videos: IntroItem[];
  total: number;
  hasMore: boolean;
  offset: number;
  limit: number;
}

interface NativeLikes {
  count: number;
  liked: boolean;
  shareCount: number;
}

interface Comment {
  id: number;
  name: string;
  body: string;
  createdAt: string;
  ytMirrored?: boolean;
}

interface YTViews {
  viewCount: number;
}

const GRADIENT_THEMES = [
  "from-[#0d0800] via-[#2a1800] to-[#1a0d00]",
  "from-[#001a0a] via-[#003a1a] to-[#000d05]",
  "from-[#0a001a] via-[#200038] to-[#05000d]",
  "from-[#1a0a00] via-[#3a2200] to-[#0d0600]",
  "from-[#00001a] via-[#000038] to-[#00000d]",
  "from-[#1a0014] via-[#38002c] to-[#0d0008]",
];

function formatCount(n: number | null | undefined): string {
  if (n == null) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDuration(iso: string | null | undefined): string {
  if (!iso) return "";
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return "";
  const h = parseInt(match[1] ?? "0");
  const m = parseInt(match[2] ?? "0");
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return "";
}

function initials(name: string): string {
  return name.split(" ").slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("");
}

async function fetchIntroPage(offset: number, limit = PAGE_SIZE): Promise<IntroPage> {
  const res = await fetch(`${BASE}/api/sermons/intro?offset=${offset}&limit=${limit}`);
  if (!res.ok) throw new Error("Failed to fetch intro videos");
  return res.json();
}

async function fetchNativeLikes(videoId: string, visitorId: string): Promise<NativeLikes> {
  try {
    const res = await fetch(`${BASE}/api/moments/${videoId}/likes?visitorId=${encodeURIComponent(visitorId)}`);
    if (!res.ok) return { count: 0, liked: false, shareCount: 0 };
    return res.json();
  } catch {
    return { count: 0, liked: false, shareCount: 0 };
  }
}

async function toggleLike(videoId: string, visitorId: string): Promise<NativeLikes> {
  const res = await fetch(`${BASE}/api/moments/${videoId}/like`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visitorId }),
  });
  if (!res.ok) throw new Error("Failed to toggle like");
  return res.json();
}

async function postShare(videoId: string, visitorId: string): Promise<number> {
  try {
    const res = await fetch(`${BASE}/api/moments/${videoId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId }),
    });
    if (!res.ok) return 0;
    const data = (await res.json()) as { shareCount: number };
    return data.shareCount;
  } catch {
    return 0;
  }
}

async function fetchComments(videoId: string): Promise<Comment[]> {
  try {
    const res = await fetch(`${BASE}/api/moments/${videoId}/comments`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function postComment(videoId: string, visitorId: string, name: string, body: string): Promise<Comment> {
  const res = await fetch(`${BASE}/api/moments/${videoId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visitorId, name, body }),
  });
  if (!res.ok) throw new Error("Failed to post comment");
  return res.json();
}

async function fetchYTViews(videoId: string): Promise<YTViews | null> {
  try {
    const res = await fetch(`${BASE}/api/sermons/youtube-stats/${videoId}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function CardSkeleton({ gradient }: { gradient: string }) {
  return (
    <div className={`relative w-full h-full flex-shrink-0 bg-gradient-to-b ${gradient} overflow-hidden`}>
      <div className="absolute inset-0 flex flex-col">
        <div className="flex items-center gap-3 p-4">
          <div className="h-8 w-8 rounded-full bg-white/10 animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-2.5 w-24 rounded bg-white/10 animate-pulse" />
            <div className="h-2 w-16 rounded bg-white/8 animate-pulse" />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <PlayCircle className="h-16 w-16 text-white/10 animate-pulse" />
        </div>
        <div className="p-4 space-y-3">
          <div className="h-5 w-3/4 rounded bg-white/15 animate-pulse" />
          <div className="h-4 w-1/2 rounded bg-white/10 animate-pulse" />
          <div className="h-4 w-2/3 rounded bg-white/8 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function CommentPanel({
  videoId,
  visitorId,
  onClose,
}: {
  videoId: string;
  visitorId: string;
  onClose: () => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState(() => localStorage.getItem("jctm_commenter_name") ?? "");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchComments(videoId).then(data => {
      setComments(data);
      setLoading(false);
    });
  }, [videoId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimName = name.trim();
    const trimBody = body.trim();
    if (!trimName || !trimBody) return;
    setSubmitting(true);
    try {
      const comment = await postComment(videoId, visitorId, trimName, trimBody);
      localStorage.setItem("jctm_commenter_name", trimName);
      setComments(prev => [comment, ...prev]);
      setBody("");
      listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      if (comment.ytMirrored) {
        toast.success("Comment posted and reflected on YouTube!");
      } else {
        toast.success("Comment posted!");
      }
    } catch {
      toast.error("Could not post comment. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-40 flex flex-col"
      style={{
        height: "68%",
        background: "rgba(10,8,0,0.95)",
        backdropFilter: "blur(16px)",
        borderRadius: "20px 20px 0 0",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.7)",
      }}
      onClick={e => e.stopPropagation()}
    >
      <div className="flex-shrink-0 px-4 pt-3 pb-2">
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-3" />
        <div className="flex items-center justify-between">
          <span className="text-white font-bold text-sm">
            Comments {comments.length > 0 && <span className="text-white/50 font-normal ml-1">{comments.length}</span>}
          </span>
          <button onClick={onClose} className="h-7 w-7 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
            <X className="h-3.5 w-3.5 text-white/70" />
          </button>
        </div>
      </div>

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-4 space-y-3"
        style={{ scrollbarWidth: "none" }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Radio className="h-5 w-5 text-amber-400 animate-spin" />
          </div>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <MessageCircle className="h-8 w-8 text-white/20" />
            <p className="text-white/40 text-sm">Be the first to comment</p>
          </div>
        ) : (
          comments.map(c => (
            <div key={c.id} className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-amber-500/30 flex items-center justify-center flex-shrink-0 text-white text-[10px] font-bold">
                {initials(c.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-white text-xs font-semibold">{c.name}</span>
                  <span className="text-white/35 text-[10px]">
                    {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                  </span>
                  {c.ytMirrored && (
                    <span className="flex items-center gap-0.5 text-red-400 text-[9px] font-semibold">
                      <Youtube className="h-2.5 w-2.5" /> YouTube
                    </span>
                  )}
                </div>
                <p className="text-white/80 text-xs mt-0.5 leading-relaxed break-words">{c.body}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="h-px bg-white/10 flex-shrink-0 mx-4" />

      <form onSubmit={handleSubmit} className="flex-shrink-0 px-4 py-3 space-y-2">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Your name"
          maxLength={80}
          className="w-full border border-white/15 rounded-xl px-3 py-2 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-amber-500/60 transition-colors"
          style={{ background: "rgba(255,255,255,0.06)" }}
        />
        <div className="flex gap-2">
          <input
            type="text"
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Add a comment…"
            maxLength={1000}
            className="flex-1 border border-white/15 rounded-xl px-3 py-2 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-amber-500/60 transition-colors"
            style={{ background: "rgba(255,255,255,0.06)" }}
          />
          <button
            type="submit"
            disabled={submitting || !name.trim() || !body.trim()}
            className="h-9 w-9 rounded-xl bg-amber-500 flex items-center justify-center disabled:opacity-40 hover:bg-amber-400 transition-colors flex-shrink-0"
          >
            <Send className="h-3.5 w-3.5 text-white" />
          </button>
        </div>
      </form>
    </div>
  );
}

function IntroCard({
  video,
  index,
  muted,
  visitorId,
  onToggleMute,
  isActive,
  isPreload,
}: {
  video: IntroItem;
  index: number;
  muted: boolean;
  visitorId: string;
  onToggleMute: () => void;
  isActive: boolean;
  isPreload: boolean;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeReady, setIframeReady] = useState(false);
  const gradient = GRADIENT_THEMES[index % GRADIENT_THEMES.length]!;

  const buildSrc = (active: boolean, muted: boolean) =>
    `https://www.youtube.com/embed/${video.videoId}` +
    `?autoplay=${active ? 1 : 0}&mute=${muted ? 1 : 0}&loop=1&playlist=${video.videoId}` +
    `&rel=0&modestbranding=1&playsinline=1&enablejsapi=1` +
    `&origin=${encodeURIComponent(window.location.origin)}`;

  const embedSrc = (isActive || isPreload) ? buildSrc(isActive, isActive ? muted : false) : null;

  const [likes, setLikes] = useState<NativeLikes>({ count: 0, liked: false, shareCount: 0 });
  const [liking, setLiking] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [viewCount, setViewCount] = useState<number | null>(video.viewCount ?? null);
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState<number | null>(null);

  useEffect(() => {
    if (!isActive) return;
    fetchNativeLikes(video.videoId, visitorId).then(setLikes);
    fetchYTViews(video.videoId).then(data => {
      if (data) setViewCount(data.viewCount);
    });
    fetchComments(video.videoId).then(comments => setCommentCount(comments.length));
  }, [isActive, video.videoId, visitorId]);

  const handleLoad = () => {
    setIframeReady(true);
    if (!isActive) return;
    const pump = (n: number) => {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func: "setVolume", args: [100] }),
        "*",
      );
      if (n < 8) setTimeout(() => pump(n + 1), 600);
    };
    setTimeout(() => pump(0), 300);
  };

  const ytUrl = `https://www.youtube.com/watch?v=${video.videoId}`;
  const durationLabel = formatDuration(video.duration);

  const handleLike = async () => {
    if (liking) return;
    setLiking(true);
    const wasLiked = likes.liked;
    const optimistic: NativeLikes = {
      count: wasLiked ? likes.count - 1 : likes.count + 1,
      liked: !wasLiked,
      shareCount: likes.shareCount,
    };
    setLikes(optimistic);
    try {
      const result = await toggleLike(video.videoId, visitorId);
      setLikes(result);
    } catch {
      setLikes(likes);
      toast.error("Could not register like. Try again.");
    } finally {
      setLiking(false);
    }
  };

  const handleShare = async () => {
    if (sharing) return;
    const shareData = {
      title: video.title,
      text: `Watch "${video.title}" — Jesus Christ Temple Ministry`,
      url: ytUrl,
    };
    let shared = false;
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        shared = true;
      } catch {}
    } else {
      await navigator.clipboard.writeText(ytUrl);
      toast.success("YouTube link copied to clipboard!");
      shared = true;
    }
    if (shared) {
      setSharing(true);
      const newShareCount = await postShare(video.videoId, visitorId);
      setLikes(prev => ({ ...prev, shareCount: newShareCount || prev.shareCount + 1 }));
      setSharing(false);
    }
  };

  return (
    <div className={`relative w-full h-full flex-shrink-0 bg-gradient-to-b ${gradient} overflow-hidden`}>
      {embedSrc ? (
        <div className="absolute inset-0 bg-black">
          <iframe
            key={`${video.videoId}-${isActive}`}
            ref={iframeRef}
            src={embedSrc}
            title={video.title}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={handleLoad}
            style={{ opacity: isPreload && !isActive ? 0 : 1, pointerEvents: isActive ? "auto" : "none" }}
          />
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.1) 40%, transparent 65%)" }} />
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 25%)" }} />
        </div>
      ) : (
        <div className="absolute inset-0">
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="w-full h-full object-cover opacity-40 scale-105"
            loading="lazy"
            onError={e => {
              (e.target as HTMLImageElement).src =
                `https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg`;
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <PlayCircle className="h-16 w-16 text-white/25" />
          </div>
          <div className="absolute inset-0"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.25) 100%)" }} />
        </div>
      )}

      {/* Fade-in overlay when iframe is loading */}
      {isActive && embedSrc && !iframeReady && (
        <div className="absolute inset-0 z-5 flex items-center justify-center bg-black/50 pointer-events-none">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="h-12 w-12 rounded-full border-2 border-amber-400/30 border-t-amber-400 animate-spin" />
            </div>
            <p className="text-white/60 text-xs">Loading video…</p>
          </div>
        </div>
      )}

      <div className="absolute inset-0 z-10 flex flex-col pointer-events-none">

        {/* Top bar */}
        <div className="flex items-center justify-between p-4 pointer-events-auto">
          <div className="flex items-center gap-2">
            <img src="/jctm-logo-sm.jpeg" alt="JCTM"
              className="h-8 w-8 rounded-full object-cover border border-amber-400/40 shadow" />
            <div>
              <p className="text-white text-xs font-bold drop-shadow">Temple TV · JCTM</p>
              <p className="text-white/55 text-[10px]">@templetvjctm</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {durationLabel && (
              <Badge className="bg-amber-500/90 text-white text-[10px] gap-1 border-0 font-semibold">
                <Clock className="h-2.5 w-2.5" />
                {durationLabel}
              </Badge>
            )}
            {video.isLive && (
              <Badge className="bg-red-500 text-white text-[10px] gap-1 animate-pulse border-0">
                <span className="h-1.5 w-1.5 rounded-full bg-white inline-block" />LIVE
              </Badge>
            )}
          </div>
        </div>

        <div className="flex-1" />

        {/* Right-side action buttons */}
        <div className="absolute right-4 bottom-36 flex flex-col items-center gap-5 pointer-events-auto z-20">
          <button
            onClick={handleLike}
            disabled={liking}
            className="flex flex-col items-center gap-1 group"
            title="Like this teaching"
          >
            <div className={`h-11 w-11 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 ${
              likes.liked
                ? "bg-red-500/80 border border-red-400/50 scale-110"
                : "bg-black/40 backdrop-blur-md border border-white/20 group-hover:bg-red-500/40"
            }`}>
              <Heart className={`h-5 w-5 transition-colors ${likes.liked ? "text-white fill-white" : "text-white"}`} />
            </div>
            <span className="text-white text-[10px] font-semibold drop-shadow">
              {formatCount(likes.count)}
            </span>
          </button>

          <button
            onClick={() => setShowComments(true)}
            className="flex flex-col items-center gap-1 group"
            title="Comments"
          >
            <div className="h-11 w-11 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg transition-all duration-200 group-hover:bg-white/20">
              <MessageCircle className="h-5 w-5 text-white" />
            </div>
            <span className="text-white text-[10px] font-semibold drop-shadow">
              {commentCount !== null ? formatCount(commentCount) : "—"}
            </span>
          </button>

          <button
            onClick={handleShare}
            disabled={sharing}
            className="flex flex-col items-center gap-1 group"
            title="Share"
          >
            <div className={`h-11 w-11 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 ${
              sharing
                ? "bg-white/20 border border-white/20 scale-95"
                : "bg-black/40 backdrop-blur-md border border-white/20 group-hover:bg-amber-500/40"
            }`}>
              <Share2 className="h-5 w-5 text-white" />
            </div>
            <span className="text-white text-[10px] font-semibold drop-shadow">
              {likes.shareCount > 0 ? formatCount(likes.shareCount) : "Share"}
            </span>
          </button>
        </div>

        {/* Bottom info */}
        <div className="p-4 pb-5 space-y-2 pointer-events-auto pr-20">
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-amber-600/80 border-amber-500/40 text-white text-[10px] px-2 py-0.5 font-semibold gap-1">
              <BookOpen className="h-2.5 w-2.5" />
              Full Teaching
            </Badge>
          </div>

          <p className="text-white font-bold text-base leading-snug line-clamp-2 drop-shadow">
            {video.title}
          </p>

          {video.description && (
            <p className="text-white/60 text-xs leading-relaxed line-clamp-2">
              {video.description}
            </p>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Radio className="h-3 w-3 text-amber-400/60 animate-pulse" />
              <p className="text-white/55 text-xs">
                {formatDistanceToNow(new Date(video.publishedAt), { addSuffix: true })}
              </p>
            </div>
            {viewCount != null && viewCount > 0 && (
              <div className="flex items-center gap-1">
                <Eye className="h-3 w-3 text-white/40" />
                <span className="text-white/45 text-xs">{formatCount(viewCount)} views</span>
              </div>
            )}
          </div>

          <button
            onClick={onToggleMute}
            className={`h-9 px-4 rounded-xl backdrop-blur-md border flex items-center gap-2 text-white text-xs font-semibold transition-colors ${
              muted
                ? "bg-white/10 border-white/20 hover:bg-white/20"
                : "bg-amber-600/20 border-amber-500/30 hover:bg-amber-500/30"
            }`}
          >
            {muted
              ? <><VolumeX className="h-3.5 w-3.5" /> Tap to unmute</>
              : <><Volume2 className="h-3.5 w-3.5" /> Sound on</>}
          </button>

          <div className="flex items-center gap-1.5 text-white/20 text-[10px]">
            <Sparkles className="h-3 w-3 text-amber-400/40" />
            <span>Jesus Christ Temple Ministry · Warri, Nigeria</span>
          </div>
        </div>
      </div>

      {showComments && (
        <CommentPanel
          videoId={video.videoId}
          visitorId={visitorId}
          onClose={() => {
            setShowComments(false);
            fetchComments(video.videoId).then(c => setCommentCount(c.length));
          }}
        />
      )}
    </div>
  );
}

export default function IntroVideos() {
  const [videos, setVideos] = useState<IntroItem[]>([]);
  const [current, setCurrent] = useState(0);
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [visitorId] = useState(() => getVisitorId());

  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const loadInitial = useCallback(async () => {
    setError(false);
    setLoading(true);
    try {
      const data = await fetchIntroPage(0, PAGE_SIZE);
      setVideos(data.videos);
      setHasMore(data.hasMore);
      setCurrent(0);
    } catch {
      setError(true);
      toast.error("Could not load Intro Videos. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async (currentVideoCount: number) => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchIntroPage(currentVideoCount, PAGE_SIZE);
      setVideos(prev => {
        const existingIds = new Set(prev.map(v => v.videoId));
        const newVideos = data.videos.filter(v => !existingIds.has(v.videoId));
        return [...prev, ...newVideos];
      });
      setHasMore(data.hasMore);
    } catch {
      // silent fail — will try again on next scroll
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  // SSE: refresh when new sermons are synced from YouTube
  useEffect(() => {
    const es = new EventSource(`${BASE}/api/sermons/stream`);
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as { type?: string };
        if (msg.type === "sync_complete") loadInitial();
      } catch {}
    };
    es.onerror = () => {};
    return () => es.close();
  }, [loadInitial]);

  // IntersectionObserver: track active card and trigger load-more
  useEffect(() => {
    if (videos.length === 0) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const idx = cardRefs.current.findIndex(ref => ref === entry.target);
            if (idx !== -1) {
              setCurrent(idx);
              // Trigger load-more when within 5 cards of the end
              if (idx >= cardRefs.current.length - 5) {
                setVideos(prev => {
                  loadMore(prev.length);
                  return prev;
                });
              }
            }
          }
        });
      },
      { threshold: 0.6, root: container },
    );

    cardRefs.current.forEach(ref => { if (ref) observerRef.current!.observe(ref); });
    return () => observerRef.current?.disconnect();
  }, [videos, loadMore]);

  const scrollTo = useCallback((idx: number) => {
    const clamped = Math.max(0, Math.min(idx, videos.length - 1));
    cardRefs.current[clamped]?.scrollIntoView({ behavior: "smooth", block: "start" });
    setCurrent(clamped);
  }, [videos.length]);

  const goNext = useCallback(() => scrollTo(current + 1), [current, scrollTo]);
  const goPrev = useCallback(() => scrollTo(current - 1), [current, scrollTo]);
  const toggleMute = useCallback(() => setMuted(m => !m), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); goNext(); }
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
      if (e.key === "m" || e.key === "M") toggleMute();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, toggleMute]);

  const handleRetry = () => {
    setRetryCount(c => c + 1);
    loadInitial();
  };

  return (
    <Layout>
      <SEO
        title="Intro Videos — Full Teachings · JCTM"
        description="Watch full-length intro sermons from Jesus Christ Temple Ministry (JCTM) — powerful long-form teachings by Prophet Amos Evomobor. Immersive vertical video feed."
        path="/intro-videos"
        keywords="JCTM intro videos, full sermons JCTM, Prophet Amos Evomobor teachings, long form sermons Nigeria, Jesus Christ Temple Ministry videos, Temple TV full sermons, JCTM YouTube teachings"
        breadcrumbs={[
          { name: "Home", url: "https://jctm.org.ng/" },
          { name: "Intro Videos", url: "https://jctm.org.ng/intro-videos" },
        ]}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": "Intro Videos — Full Teachings · JCTM",
            "description": "A vertical feed of long-form introductory sermons from Jesus Christ Temple Ministry (JCTM) by Prophet Amos Evomobor. Each video is 50–70 minutes of deep biblical teaching.",
            "url": "https://jctm.org.ng/intro-videos",
            "inLanguage": "en-NG",
            "about": {
              "@type": "ReligiousOrganization",
              "name": "Jesus Christ Temple Ministry (JCTM)",
              "url": "https://jctm.org.ng"
            },
            "author": {
              "@type": "Person",
              "name": "Prophet Amos Evomobor",
              "url": "https://jctm.org.ng/leadership"
            }
          }
        ]}
      />
      <div className="flex h-[calc(100dvh-64px)] max-h-screen overflow-hidden">
        <div className="flex-1 relative flex flex-col min-w-0">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border/20 flex-shrink-0 bg-gradient-to-r from-amber-950/20 to-transparent">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-bold text-primary">Intro Teachings</span>
            </div>
            {videos.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {current + 1} / {videos.length}{hasMore ? "+" : ""}
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex-1 overflow-hidden">
              <div
                style={{
                  height: "100%",
                  scrollSnapType: "y mandatory",
                  overflow: "hidden",
                  scrollbarWidth: "none",
                }}
              >
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ height: "100%", scrollSnapAlign: "start", scrollSnapStop: "always" }}>
                    <CardSkeleton gradient={GRADIENT_THEMES[i % GRADIENT_THEMES.length]!} />
                  </div>
                ))}
              </div>
            </div>
          ) : error || videos.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center">
              <div className="relative">
                <BookOpen className="h-12 w-12 text-muted-foreground/40" />
              </div>
              <div>
                <p className="text-primary font-semibold mb-1">
                  {error ? "Could not load videos" : "No intro videos found"}
                </p>
                <p className="text-muted-foreground text-sm">
                  {error
                    ? "Check your connection and try again."
                    : "Videos will appear here once synced from YouTube."}
                </p>
              </div>
              <button
                onClick={handleRetry}
                className="mt-2 px-5 py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-semibold hover:bg-amber-500/30 transition-colors flex items-center gap-2"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </button>
            </div>
          ) : (
            <>
              <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-scroll"
                style={{
                  scrollSnapType: "y mandatory",
                  scrollbarWidth: "none",
                  WebkitOverflowScrolling: "touch",
                  overscrollBehavior: "contain",
                }}
              >
                {videos.map((video, i) => (
                  <Fragment key={video.videoId}>
                    <div
                      ref={el => { cardRefs.current[i] = el; }}
                      style={{
                        scrollSnapAlign: "start",
                        scrollSnapStop: "always",
                        height: "100%",
                      }}
                      className="w-full flex-shrink-0"
                    >
                      <IntroCard
                        video={video}
                        index={i}
                        muted={muted}
                        visitorId={visitorId}
                        onToggleMute={toggleMute}
                        isActive={i === current}
                        isPreload={i === current + 1}
                      />
                    </div>
                    {(i + 1) % 4 === 0 && i < videos.length - 1 && (
                      <div
                        style={{
                          scrollSnapAlign: "start",
                          scrollSnapStop: "always",
                          height: "100%",
                        }}
                        className="w-full flex-shrink-0 flex items-center justify-center bg-black px-4"
                      >
                        <div className="w-full max-w-3xl">
                          <AdSlot slot={ADSENSE_SLOTS.introFeed} minHeight={280} className="border-white/10 bg-white/5 text-white" />
                        </div>
                      </div>
                    )}
                  </Fragment>
                ))}

                {/* Load-more indicator at end */}
                {loadingMore && (
                  <div
                    style={{ height: "100%", scrollSnapAlign: "start", scrollSnapStop: "always" }}
                    className="w-full flex-shrink-0 flex items-center justify-center bg-black"
                  >
                    <div className="flex flex-col items-center gap-3 text-white/40">
                      <div className="h-10 w-10 rounded-full border-2 border-amber-400/30 border-t-amber-400 animate-spin" />
                      <p className="text-sm">Loading more teachings…</p>
                    </div>
                  </div>
                )}

                {!hasMore && videos.length > 0 && (
                  <div
                    style={{ height: "20%", scrollSnapAlign: "start" }}
                    className="w-full flex-shrink-0 flex items-center justify-center"
                  >
                    <div className="flex flex-col items-center gap-2 text-white/30">
                      <Sparkles className="h-5 w-5 text-amber-400/40" />
                      <p className="text-xs">You've seen all {videos.length} teachings</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Nav arrows */}
              <div className="absolute left-3 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2">
                <button
                  onClick={goPrev}
                  disabled={current === 0}
                  className="h-9 w-9 rounded-full bg-black/40 backdrop-blur-md border border-amber-400/20 flex items-center justify-center text-white disabled:opacity-20 hover:bg-black/60 transition-colors shadow-lg"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  onClick={goNext}
                  disabled={current >= videos.length - 1 && !hasMore}
                  className="h-9 w-9 rounded-full bg-black/40 backdrop-blur-md border border-amber-400/20 flex items-center justify-center text-white disabled:opacity-20 hover:bg-black/60 transition-colors shadow-lg"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}

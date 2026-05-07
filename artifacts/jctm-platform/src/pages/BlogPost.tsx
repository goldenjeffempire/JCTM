import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft, BookOpen, Clock, Tag, Share2, CheckCircle2, AlertCircle,
  ExternalLink, UserRound, Heart, Bookmark, Eye, Brain, Copy,
  Twitter, Facebook, TrendingUp,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import { ReactNode, useState, useEffect, useRef, useCallback } from "react";
import { ADSENSE_SLOTS, AdSlot } from "@/components/ads/AdSense";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface FullPost {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  topic: string;
  category: string | null;
  tags: string[] | null;
  author?: string | null;
  readTimeMinutes?: number | null;
  featured?: boolean | null;
  seoTitle: string | null;
  seoDescription: string | null;
  schemaJson: string | null;
  publishedAt: string | null;
  generatedAt: string | null;
  updatedAt?: string | null;
  viewCount?: number;
  likeCount?: number;
  bookmarkCount?: number;
}

interface RelatedPost {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  topic: string;
  category?: string | null;
  tags?: string[] | null;
  readTimeMinutes?: number | null;
  publishedAt: string | null;
  viewCount?: number;
  likeCount?: number;
}

interface Engagement {
  viewCount: number;
  likeCount: number;
  bookmarkCount: number;
  liked: boolean;
  bookmarked: boolean;
  progress: number;
  completed: boolean;
}

function InlineText({ text }: { text: string }) {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`|\*.*?\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
        if (part.startsWith("`")  && part.endsWith("`"))  return <code key={index}>{part.slice(1, -1)}</code>;
        if (part.startsWith("*")  && part.endsWith("*"))  return <em key={index}>{part.slice(1, -1)}</em>;
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

function ContentRenderer({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/);
  const renderItems = (items: string[]): ReactNode[] =>
    items.map((item, index) => (
      <li key={index}><InlineText text={item.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "")} /></li>
    ));

  return (
    <div className="prose prose-lg max-w-none dark:prose-invert prose-headings:font-serif prose-headings:text-primary prose-h2:text-2xl prose-h2:mt-10 prose-h3:text-xl prose-p:text-foreground/90 prose-p:leading-relaxed prose-a:text-accent prose-a:no-underline hover:prose-a:underline prose-strong:text-primary prose-strong:font-semibold prose-blockquote:border-accent prose-blockquote:bg-accent/5 prose-blockquote:rounded-r-xl prose-blockquote:py-2 prose-blockquote:text-muted-foreground prose-code:text-accent prose-code:bg-accent/10 prose-code:rounded prose-code:px-1 prose-li:text-foreground/90 prose-ul:my-4 prose-ol:my-4">
      {blocks.map((block, index) => {
        const trimmed = block.trim();
        if (!trimmed) return null;
        if (trimmed.startsWith("### ")) return <h3 key={index}>{trimmed.slice(4)}</h3>;
        if (trimmed.startsWith("## "))  return <h2 key={index}>{trimmed.slice(3)}</h2>;
        if (trimmed.startsWith("# "))   return <h1 key={index}>{trimmed.slice(2)}</h1>;
        if (trimmed.startsWith("> "))   return <blockquote key={index}><p><InlineText text={trimmed.slice(2)} /></p></blockquote>;
        if (trimmed.match(/^[-*]\s+/m)) return <ul key={index}>{renderItems(trimmed.split("\n").filter(l => l.match(/^[-*]\s+/)))}</ul>;
        if (trimmed.match(/^\d+\.\s+/m))return <ol key={index}>{renderItems(trimmed.split("\n").filter(l => l.match(/^\d+\.\s+/)))}</ol>;
        return <p key={index}><InlineText text={trimmed} /></p>;
      })}
    </div>
  );
}

function ReadingProgressBar({ progress }: { progress: number }) {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-transparent">
      <motion.div
        className="h-full bg-gradient-to-r from-accent to-blue-400"
        style={{ width: `${progress}%` }}
        transition={{ duration: 0.1 }}
      />
    </div>
  );
}

export default function BlogPost() {
  const [, params]    = useRoute("/blog/:slug");
  const slug          = params?.slug ?? "";
  const [copied, setCopied] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const articleRef    = useRef<HTMLDivElement>(null);
  const queryClient   = useQueryClient();

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data, isLoading, isError } = useQuery<{ post: FullPost; relatedPosts: RelatedPost[]; breadcrumbSchema: string }>({
    queryKey: ["blog-post", slug],
    queryFn: () => fetch(`${BASE}/api/blog/${slug}`).then(r => {
      if (!r.ok) throw new Error("Post not found");
      return r.json();
    }),
    enabled: !!slug,
    staleTime: 1000 * 60 * 30,
  });

  const { data: engagement, refetch: refetchEngagement } = useQuery<Engagement>({
    queryKey: ["blog-engagement", slug],
    queryFn: () => fetch(`${BASE}/api/blog/${slug}/engagement`).then(r => r.json()),
    enabled: !!slug,
    staleTime: 0,
  });

  const { data: recommended } = useQuery<{ posts: RelatedPost[] }>({
    queryKey: ["blog-recommended", slug, data?.post?.topic, data?.post?.tags],
    queryFn: () => {
      const params = new URLSearchParams({ slug, limit: "4" });
      if (data?.post?.topic) params.set("topic", data.post.topic);
      if (data?.post?.tags?.length) params.set("tags", data.post.tags.join(","));
      return fetch(`${BASE}/api/blog/recommended?${params}`).then(r => r.json());
    },
    enabled: !!slug && !!data?.post,
    staleTime: 1000 * 60 * 10,
  });

  const post    = data?.post;
  const related = data?.relatedPosts ?? [];
  const aiRecs  = recommended?.posts ?? [];

  // ── Track view on mount ────────────────────────────────────────────────────
  useEffect(() => {
    if (!slug) return;
    fetch(`${BASE}/api/blog/${slug}/view`, { method: "POST" })
      .then(() => refetchEngagement())
      .catch(() => {});
  }, [slug, refetchEngagement]);

  // ── Reading progress tracking ──────────────────────────────────────────────
  const handleScroll = useCallback(() => {
    if (!articleRef.current) return;
    const el   = articleRef.current;
    const rect = el.getBoundingClientRect();
    const total = el.offsetHeight;
    const scrolled = Math.max(0, -rect.top + window.innerHeight * 0.5);
    const pct = Math.min(100, Math.round((scrolled / total) * 100));
    setReadingProgress(pct);
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // ── Like mutation ──────────────────────────────────────────────────────────
  const likeMutation = useMutation({
    mutationFn: () =>
      fetch(`${BASE}/api/blog/${slug}/like`, { method: "POST" }).then(r => r.json()),
    onSuccess: (result: { liked: boolean; likeCount: number }) => {
      queryClient.setQueryData<Engagement>(["blog-engagement", slug], old =>
        old ? { ...old, liked: result.liked, likeCount: result.likeCount } : old,
      );
      toast.success(result.liked ? "Added to your liked articles" : "Like removed");
    },
  });

  // ── Bookmark mutation ──────────────────────────────────────────────────────
  const bookmarkMutation = useMutation({
    mutationFn: () =>
      fetch(`${BASE}/api/blog/${slug}/bookmark`, { method: "POST" }).then(r => r.json()),
    onSuccess: (result: { bookmarked: boolean; bookmarkCount: number }) => {
      queryClient.setQueryData<Engagement>(["blog-engagement", slug], old =>
        old ? { ...old, bookmarked: result.bookmarked, bookmarkCount: result.bookmarkCount } : old,
      );
      toast.success(result.bookmarked ? "Article bookmarked" : "Bookmark removed");
    },
  });

  // ── Share handlers ─────────────────────────────────────────────────────────
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  const handleShare = useCallback(async () => {
    if (navigator.share && post) {
      try {
        await navigator.share({ title: post.title, text: post.excerpt ?? post.title, url: window.location.href });
        return;
      } catch { /* fallback */ }
    }
    setShareOpen(v => !v);
  }, [post]);

  const shareToTwitter  = () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(post?.title ?? "")}&url=${encodeURIComponent(window.location.href)}`, "_blank");
  const shareToFacebook = () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, "_blank");
  const shareToWhatsApp = () => window.open(`https://wa.me/?text=${encodeURIComponent(`${post?.title ?? ""} ${window.location.href}`)}`, "_blank");

  // ── Error state ────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <h1 className="text-2xl font-serif font-bold text-primary mb-2">Article Not Found</h1>
          <p className="text-muted-foreground mb-6">This article may have been moved or removed.</p>
          <Link href="/blog">
            <Button variant="outline" className="rounded-full gap-2">
              <ArrowLeft className="h-4 w-4" /> Back to Blog
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const schemaJson = post?.schemaJson ? JSON.parse(post.schemaJson) : undefined;

  return (
    <Layout>
      <ReadingProgressBar progress={readingProgress} />

      {post && (
        <SEO
          title={post.seoTitle ?? post.title}
          description={post.seoDescription ?? post.excerpt ?? post.title}
          path={`/blog/${post.slug}`}
          type="article"
          publishedTime={post.publishedAt ?? undefined}
          modifiedTime={post.updatedAt ?? post.generatedAt ?? undefined}
          keywords={post.tags?.join(", ") ?? "JCTM blog, theology, holiness"}
          breadcrumbs={[
            { name: "Home", url: "https://jctm.org.ng/" },
            { name: "Blog", url: "https://jctm.org.ng/blog" },
            { name: post.title, url: `https://jctm.org.ng/blog/${post.slug}` },
          ]}
          jsonLd={schemaJson ? [schemaJson] : undefined}
        />
      )}

      <div className="container mx-auto px-4 py-10 max-w-4xl">
        {/* Back nav */}
        <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} className="mb-8">
          <Link href="/blog">
            <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-accent transition-colors">
              <ArrowLeft className="h-4 w-4" /> Back to Ministry Blog
            </button>
          </Link>
        </motion.div>

        {/* Loading skeleton */}
        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-8 w-1/3 rounded-full" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-5 w-3/4 rounded" />
            <div className="space-y-3 mt-8">
              {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-4 w-full rounded" />)}
            </div>
          </div>
        ) : post ? (
          <motion.article ref={articleRef} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            {/* ── Article header card ──────────────────────────────────────── */}
            <div className="glass-panel rounded-3xl border border-border/50 p-6 md:p-10 mb-10 bg-gradient-to-br from-accent/8 via-background to-primary/5">
              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <Badge variant="secondary" className="capitalize">
                  {post.category ?? post.topic.replace(/-/g, " ")}
                </Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {post.readTimeMinutes ?? 5} min read
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <UserRound className="h-3 w-3" /> {post.author ?? "Jesus Christ Temple Ministry"}
                </span>
                {(engagement?.viewCount ?? 0) > 0 && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Eye className="h-3 w-3" /> {engagement!.viewCount} views
                  </span>
                )}

                {/* Share button */}
                <div className="ml-auto relative">
                  <button onClick={handleShare}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-accent transition-colors">
                    {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Share2 className="h-3.5 w-3.5" />}
                    {copied ? "Copied" : "Share"}
                  </button>
                  {shareOpen && !copied && (
                    <motion.div initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                      className="absolute right-0 top-7 z-20 glass-panel rounded-2xl border border-border/50 p-2 min-w-[180px] shadow-xl">
                      <button onClick={shareToTwitter}  className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-xl hover:bg-accent/5 text-muted-foreground hover:text-accent transition-all"><Twitter className="h-3.5 w-3.5" /> X / Twitter</button>
                      <button onClick={shareToFacebook} className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-xl hover:bg-accent/5 text-muted-foreground hover:text-accent transition-all"><Facebook className="h-3.5 w-3.5" /> Facebook</button>
                      <button onClick={shareToWhatsApp} className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-xl hover:bg-accent/5 text-muted-foreground hover:text-accent transition-all">
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/></svg>
                        WhatsApp
                      </button>
                      <button onClick={handleCopy} className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-xl hover:bg-accent/5 text-muted-foreground hover:text-accent transition-all"><Copy className="h-3.5 w-3.5" /> Copy link</button>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Title */}
              <h1 className="font-serif font-bold text-primary text-3xl md:text-5xl leading-tight mb-5">{post.title}</h1>

              {/* Excerpt */}
              {post.excerpt && (
                <p className="text-lg md:text-xl text-muted-foreground leading-relaxed border-l-4 border-accent/40 pl-4 mb-6">
                  {post.excerpt}
                </p>
              )}

              {/* Bottom meta row */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  {post.publishedAt && <span>Published {format(new Date(post.publishedAt), "MMMM d, yyyy")}</span>}
                  {post.featured && <span className="text-accent font-semibold">Featured teaching</span>}
                </div>

                {/* Engagement actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => likeMutation.mutate()}
                    disabled={likeMutation.isPending}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${engagement?.liked ? "bg-pink-500/10 border-pink-500/30 text-pink-400" : "border-border/50 text-muted-foreground hover:border-pink-400/40 hover:text-pink-400"}`}>
                    <Heart className={`h-3.5 w-3.5 ${engagement?.liked ? "fill-pink-400" : ""}`} />
                    {engagement?.likeCount ?? post.likeCount ?? 0}
                  </button>
                  <button
                    onClick={() => bookmarkMutation.mutate()}
                    disabled={bookmarkMutation.isPending}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${engagement?.bookmarked ? "bg-accent/10 border-accent/30 text-accent" : "border-border/50 text-muted-foreground hover:border-accent/40 hover:text-accent"}`}>
                    <Bookmark className={`h-3.5 w-3.5 ${engagement?.bookmarked ? "fill-accent" : ""}`} />
                    {engagement?.bookmarked ? "Saved" : "Save"}
                  </button>
                </div>
              </div>
            </div>

            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-8">
                <Tag className="h-3.5 w-3.5 text-muted-foreground mt-1" />
                {post.tags.map(tag => (
                  <Link key={tag} href={`/blog?tag=${tag}`}>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent/8 text-accent/80 border border-accent/20 cursor-pointer hover:bg-accent/15 transition-all">
                      #{tag}
                    </span>
                  </Link>
                ))}
              </div>
            )}

            {/* Reading progress indicator */}
            {readingProgress > 0 && (
              <div className="flex items-center gap-3 mb-8 text-xs text-muted-foreground">
                <div className="flex-1 h-1.5 rounded-full bg-border/40 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-accent to-blue-400 rounded-full"
                    style={{ width: `${readingProgress}%` }}
                  />
                </div>
                <span className="shrink-0">{readingProgress}% read</span>
                {readingProgress >= 95 && (
                  <span className="text-green-500 font-semibold">✓ Completed</span>
                )}
              </div>
            )}

            <div className="border-t border-border/40 mb-10" />

            <AdSlot slot={ADSENSE_SLOTS.blogPost} minHeight={120} className="mb-10" lazy={false} />

            {/* Article content */}
            <ContentRenderer content={post.content} />

            <AdSlot slot={ADSENSE_SLOTS.blogFeed} minHeight={120} className="mt-12 mb-4" />

            {/* Bottom engagement row */}
            <div className="flex flex-wrap items-center justify-between gap-4 mt-8 p-4 glass-panel rounded-2xl border border-border/40">
              <p className="text-sm text-muted-foreground">Was this article helpful?</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => likeMutation.mutate()}
                  disabled={likeMutation.isPending}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-all ${engagement?.liked ? "bg-pink-500/10 border-pink-500/30 text-pink-400" : "border-border/50 text-muted-foreground hover:border-pink-400/40 hover:text-pink-400"}`}>
                  <Heart className={`h-4 w-4 ${engagement?.liked ? "fill-pink-400" : ""}`} />
                  {engagement?.liked ? "Liked" : "Like"} · {engagement?.likeCount ?? 0}
                </button>
                <button
                  onClick={() => bookmarkMutation.mutate()}
                  disabled={bookmarkMutation.isPending}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-all ${engagement?.bookmarked ? "bg-accent/10 border-accent/30 text-accent" : "border-border/50 text-muted-foreground hover:border-accent/40 hover:text-accent"}`}>
                  <Bookmark className={`h-4 w-4 ${engagement?.bookmarked ? "fill-accent" : ""}`} />
                  {engagement?.bookmarked ? "Bookmarked" : "Bookmark"}
                </button>
                <button onClick={handleShare}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border border-border/50 text-muted-foreground hover:border-accent/40 hover:text-accent transition-all">
                  <Share2 className="h-4 w-4" /> Share
                </button>
              </div>
            </div>

            {/* Continue reading CTA */}
            <div className="border-t border-border/40 mt-10 pt-8">
              <div className="glass-panel rounded-3xl p-6 border border-accent/20 text-center">
                <BookOpen className="h-8 w-8 text-accent mx-auto mb-3" />
                <h3 className="font-serif font-bold text-primary text-xl mb-2">Continue Growing in the Word</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-xl mx-auto">
                  Explore more articles, watch Temple TV sermons, or ask the AI assistant for deeper study on any topic.
                </p>
                <div className="flex flex-wrap gap-3 justify-center">
                  <Link href="/blog">
                    <Button variant="outline" size="sm" className="rounded-full gap-2">
                      <BookOpen className="h-3.5 w-3.5" /> More Articles
                    </Button>
                  </Link>
                  <Link href="/sermons">
                    <Button variant="outline" size="sm" className="rounded-full gap-2">Sermon Archive</Button>
                  </Link>
                  <Link href="/sermon-assistant">
                    <Button size="sm" className="rounded-full gap-2 bg-accent hover:bg-accent/90 text-white">
                      <Brain className="h-3.5 w-3.5" /> Ask AI <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </motion.article>
        ) : null}

        {/* ── AI-Recommended articles ────────────────────────────────────────── */}
        {aiRecs.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="mt-14">
            <div className="flex items-center gap-2 mb-5">
              <Brain className="h-5 w-5 text-accent" />
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Recommended for You</p>
                <h2 className="font-serif font-bold text-primary text-xl">Articles you might like</h2>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {aiRecs.map(r => (
                <Link key={r.slug} href={`/blog/${r.slug}`}>
                  <div className="group glass-panel rounded-2xl p-4 border border-border/50 hover:border-accent/40 transition-all cursor-pointer h-full">
                    <Badge variant="secondary" className="text-xs mb-2 capitalize">
                      {r.category ?? r.topic.replace(/-/g, " ")}
                    </Badge>
                    <h3 className="font-semibold text-primary text-sm leading-snug group-hover:text-accent transition-colors line-clamp-2 mb-2">
                      {r.title}
                    </h3>
                    {r.excerpt && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{r.excerpt}</p>
                    )}
                    <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span>{r.publishedAt ? format(new Date(r.publishedAt), "MMM d, yyyy") : "Article"}</span>
                      <div className="flex items-center gap-2">
                        {(r.viewCount ?? 0) > 0 && <span className="flex items-center gap-1"><Eye className="h-3 w-3"/>{r.viewCount}</span>}
                        <span>{r.readTimeMinutes ?? 5} min</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Related articles ───────────────────────────────────────────────── */}
        {related.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className="mt-14">
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <h2 className="font-serif font-bold text-primary text-xl">More in {post?.category ?? "this category"}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {related.map(r => (
                <Link key={r.slug} href={`/blog/${r.slug}`}>
                  <div className="group glass-panel rounded-2xl p-4 border border-border/50 hover:border-accent/40 transition-all cursor-pointer h-full">
                    <Badge variant="secondary" className="text-xs mb-2 capitalize">
                      {r.category ?? r.topic.replace(/-/g, " ")}
                    </Badge>
                    <h3 className="font-semibold text-primary text-sm leading-snug group-hover:text-accent transition-colors line-clamp-2 mb-2">
                      {r.title}
                    </h3>
                    <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground mt-auto">
                      <span>{r.publishedAt ? format(new Date(r.publishedAt), "MMM d, yyyy") : "Article"}</span>
                      <span>{r.readTimeMinutes ?? 5} min</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </Layout>
  );
}

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, BookOpen, Clock, FileText, Filter, Flame, Layers3,
  Loader2, Search, Sparkles, Tag, TrendingUp, Video, Heart, Bookmark,
  Eye, Brain,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ADSENSE_SLOTS, AdSlot, useAdPageTracker } from "@/components/ads/AdSense";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const PAGE_SIZE = 12;

interface BlogPost {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  topic: string;
  category: string | null;
  tags: string[] | null;
  author?: string | null;
  readTimeMinutes?: number | null;
  featured?: boolean | null;
  publishedAt: string | null;
  viewCount?: number;
  likeCount?: number;
  bookmarkCount?: number;
}

interface BlogCategory {
  slug: string;
  label: string;
  description?: string;
  count?: number;
}

interface BlogTag {
  tag: string;
  count: number;
}

interface SermonPreview {
  id: number;
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  publishedAt?: string | null;
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45 } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const CATEGORY_COLORS: Record<string, string> = {
  "Teachings":          "from-blue-500/10 to-blue-500/5   border-blue-500/20  text-blue-400",
  "Bible Studies":      "from-purple-500/10 to-purple-500/5 border-purple-500/20 text-purple-400",
  "Devotionals":        "from-amber-500/10 to-amber-500/5  border-amber-500/20  text-amber-400",
  "Prophetic Messages": "from-red-500/10 to-red-500/5      border-red-500/20    text-red-400",
  "Ministry Insights":  "from-green-500/10 to-green-500/5  border-green-500/20  text-green-400",
  "Testimonies":        "from-pink-500/10 to-pink-500/5    border-pink-500/20   text-pink-400",
  "Prayer & Fasting":   "from-indigo-500/10 to-indigo-500/5 border-indigo-500/20 text-indigo-400",
  "Youth & Family":     "from-teal-500/10 to-teal-500/5   border-teal-500/20   text-teal-400",
  "Christian Living":   "from-orange-500/10 to-orange-500/5 border-orange-500/20 text-orange-400",
  "Revival":            "from-rose-500/10 to-rose-500/5   border-rose-500/20   text-rose-400",
};

function getCategoryColor(cat: string | null | undefined) {
  return CATEGORY_COLORS[cat ?? ""] ?? "from-accent/10 to-accent/5 border-accent/20 text-accent";
}

function PostCard({ post, large = false, trending = false }: { post: BlogPost; large?: boolean; trending?: boolean }) {
  const category = post.category ?? post.topic.replace(/-/g, " ");
  const colors = getCategoryColor(post.category);

  return (
    <motion.div variants={fadeUp} className={large ? "lg:col-span-2" : undefined}>
      <Link href={`/blog/${post.slug}`}>
        <div className={`group glass-panel rounded-3xl border hover:shadow-xl hover:shadow-accent/5 transition-all duration-300 cursor-pointer h-full flex flex-col overflow-hidden bg-gradient-to-br ${colors} ${large ? "p-8" : "p-6"}`}>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-xs font-semibold capitalize">
                {category}
              </Badge>
              {post.featured && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
                  <Sparkles className="h-3 w-3" /> Featured
                </span>
              )}
              {trending && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.18em] text-orange-400">
                  <Flame className="h-3 w-3" /> Trending
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
              <Clock className="h-3 w-3" /> {post.readTimeMinutes ?? 5} min
            </span>
          </div>

          <h2 className={`font-serif font-bold text-primary leading-snug mb-3 group-hover:text-accent transition-colors ${large ? "text-2xl md:text-3xl" : "text-lg line-clamp-2"}`}>
            {post.title}
          </h2>

          {post.excerpt && (
            <p className={`text-muted-foreground leading-relaxed mb-5 ${large ? "text-base" : "text-sm line-clamp-3"}`}>{post.excerpt}</p>
          )}

          <div className="flex flex-wrap gap-1.5 mb-5">
            {(post.tags ?? []).slice(0, large ? 5 : 3).map(tag => (
              <span key={tag} className="text-[11px] px-2 py-0.5 rounded-full bg-accent/8 text-accent/80 border border-accent/20">
                #{tag}
              </span>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground mt-auto pt-2 border-t border-border/20">
            <div className="flex items-center gap-3">
              <span>{post.publishedAt ? format(new Date(post.publishedAt), "MMM d, yyyy") : "Published"}</span>
              {(post.viewCount ?? 0) > 0 && (
                <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {post.viewCount}</span>
              )}
              {(post.likeCount ?? 0) > 0 && (
                <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {post.likeCount}</span>
              )}
            </div>
            <span className="flex items-center gap-1 font-semibold text-accent group-hover:gap-2 transition-all">
              Read <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function TrendingCard({ post, rank }: { post: BlogPost; rank: number }) {
  return (
    <Link href={`/blog/${post.slug}`}>
      <div className="group flex items-start gap-3 p-3 rounded-2xl hover:bg-accent/5 transition-all cursor-pointer">
        <span className="text-2xl font-serif font-bold text-muted-foreground/30 w-8 shrink-0 mt-0.5">{rank}</span>
        <div className="flex-1 min-w-0">
          <Badge variant="secondary" className="text-[10px] mb-1.5 capitalize">
            {post.category ?? post.topic}
          </Badge>
          <h4 className="text-sm font-semibold text-primary leading-snug group-hover:text-accent transition-colors line-clamp-2">
            {post.title}
          </h4>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{post.viewCount ?? 0}</span>
            <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{post.likeCount ?? 0}</span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{post.readTimeMinutes ?? 5}m</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function PostCardSkeleton() {
  return (
    <div className="glass-panel rounded-3xl p-6 border border-border/30 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-4 w-16 rounded ml-auto" />
      </div>
      <Skeleton className="h-7 w-full rounded" />
      <Skeleton className="h-4 w-4/5 rounded" />
      <Skeleton className="h-4 w-3/5 rounded" />
      <div className="flex gap-1 pt-1">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-5 w-14 rounded-full" />)}
      </div>
      <Skeleton className="h-4 w-28 rounded mt-2" />
    </div>
  );
}

export default function Blog() {
  const [search, setSearch]               = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTag, setSelectedTag]     = useState<string | null>(null);
  const [offset, setOffset]               = useState(0);
  const [showAllTags, setShowAllTags]     = useState(false);
  useAdPageTracker("/blog", 1);

  const { data: categoryData } = useQuery<{ categories: BlogCategory[]; tags: BlogTag[] }>({
    queryKey: ["blog-categories"],
    queryFn: () => fetch(`${BASE}/api/blog/categories`).then(r => r.json()),
    staleTime: 1000 * 60 * 30,
  });

  const { data, isLoading, isFetching } = useQuery<{ posts: BlogPost[]; featuredPosts: BlogPost[]; total: number }>({
    queryKey: ["blog", selectedCategory, selectedTag, search.trim(), offset],
    queryFn: () => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
      if (selectedCategory) params.set("category", selectedCategory);
      if (selectedTag)       params.set("tag", selectedTag);
      if (search.trim())     params.set("q", search.trim());
      return fetch(`${BASE}/api/blog?${params}`).then(r => r.json());
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: trendingData } = useQuery<{ posts: BlogPost[] }>({
    queryKey: ["blog-trending"],
    queryFn: () => fetch(`${BASE}/api/blog/trending?limit=6`).then(r => r.json()),
    staleTime: 1000 * 60 * 5,
  });

  const { data: sermons } = useQuery<SermonPreview[]>({
    queryKey: ["blog-featured-sermons"],
    queryFn: () => fetch(`${BASE}/api/sermons?limit=3`).then(r => r.json()),
    staleTime: 1000 * 60 * 10,
  });

  const posts         = data?.posts         ?? [];
  const featuredPosts = data?.featuredPosts  ?? [];
  const total         = data?.total          ?? 0;
  const trendingPosts = trendingData?.posts  ?? [];
  const totalPages    = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage   = Math.floor(offset / PAGE_SIZE) + 1;

  const activeLabel = useMemo(() => {
    if (selectedTag)      return `#${selectedTag}`;
    if (selectedCategory) return selectedCategory;
    if (search.trim())    return `Search: ${search.trim()}`;
    return "All Articles";
  }, [selectedCategory, selectedTag, search]);

  const resetPagination = () => setOffset(0);

  const selectCategory = (category: string | null) => {
    setSelectedCategory(category);
    setSelectedTag(null);
    resetPagination();
  };

  const selectTag = (tag: string | null) => {
    setSelectedTag(tag);
    resetPagination();
  };

  const isFiltered = !!(search.trim() || selectedCategory || selectedTag);
  const displayedTags = showAllTags
    ? (categoryData?.tags ?? [])
    : (categoryData?.tags ?? []).slice(0, 24);

  return (
    <Layout>
      <SEO
        title="Ministry Blog — Teachings, Devotionals, Testimonies & More"
        description="A growing ministry publishing library with 80+ articles on holiness, prayer, salvation, family, revival, testimonies, Bible studies, and prophetic messages from Jesus Christ Temple Ministry."
        path="/blog"
        keywords="JCTM blog, ministry articles, sermon teachings, testimonies, prayer guides, holiness, devotionals, Bible studies, revival, youth faith, Prophet Amos Evomobor"
        breadcrumbs={[
          { name: "Home",          url: "https://jctm.org.ng/" },
          { name: "Ministry Blog", url: "https://jctm.org.ng/blog" },
        ]}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Blog",
            "@id": "https://jctm.org.ng/blog#blog",
            "name": "JCTM Ministry Blog",
            "description": "A growing ministry publishing library with 80+ articles on holiness, prayer, salvation, family, revival, testimonies, Bible studies, and prophetic messages from Jesus Christ Temple Ministry.",
            "url": "https://jctm.org.ng/blog",
            "inLanguage": "en-NG",
            "isAccessibleForFree": true,
            "author": {
              "@type": "Person",
              "@id": "https://jctm.org.ng/#prophet",
              "name": "Prophet Amos Evomobor",
              "url": "https://jctm.org.ng/leadership",
            },
            "publisher": {
              "@type": "ReligiousOrganization",
              "@id": "https://jctm.org.ng/#organization",
              "name": "Jesus Christ Temple Ministry (JCTM)",
              "url": "https://jctm.org.ng",
              "logo": { "@type": "ImageObject", "url": "https://jctm.org.ng/favicon.png", "width": 512, "height": 512 },
            },
            "about": [
              { "@type": "Thing", "name": "Holiness" },
              { "@type": "Thing", "name": "Correction Mandate" },
              { "@type": "Thing", "name": "Apostolic Christianity" },
              { "@type": "Thing", "name": "End Times" },
              { "@type": "Thing", "name": "Prayer" },
              { "@type": "Thing", "name": "Testimonies" },
            ],
          },
        ]}
      />

      <div className="container mx-auto px-4 py-14 max-w-7xl">
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold mb-4 border"
            style={{ background: "rgba(56,189,248,0.08)", color: "hsl(var(--accent))", borderColor: "rgba(56,189,248,0.25)" }}>
            <BookOpen className="h-3.5 w-3.5" /> JCTM Ministry Blog
          </div>
          <h1 className="text-4xl md:text-6xl font-serif font-bold text-primary mb-4">
            Teachings, Testimonies & Spiritual Growth
          </h1>
          <p className="text-muted-foreground text-lg max-w-3xl mx-auto leading-relaxed">
            Over 80 articles on holiness, prayer, salvation, revival, family, Bible study, testimonies, and end-time living — for believers across every season of faith.
          </p>
        </motion.div>

        {/* ── Stats ─────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10"
        >
          {[
            { icon: FileText, value: total || "80+",                          label: "Published articles" },
            { icon: Layers3,  value: categoryData?.categories?.length ?? 10,  label: "Categories" },
            { icon: Tag,      value: categoryData?.tags?.length ?? 40,        label: "Topics & tags" },
            { icon: Flame,    value: trendingPosts.length > 0 ? "Live" : "—", label: "Trending now" },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} className="glass-panel rounded-2xl p-5 border border-border/50">
              <div className="flex items-center gap-3">
                <Icon className="h-5 w-5 text-accent shrink-0" />
                <div>
                  <p className="text-xl font-serif font-bold text-primary">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </div>
            </div>
          ))}
        </motion.div>

        {/* ── Search + Filters ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}
          className="mb-10 glass-panel rounded-3xl border border-border/50 p-5 md:p-6 space-y-5"
        >
          <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => { setSearch(e.target.value); resetPagination(); }}
                placeholder="Search articles, scripture themes, topics…"
                className="pl-10 rounded-full h-11"
              />
            </div>
            <AnimatePresence>
              {isFiltered && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                  <Button variant="outline" className="rounded-full gap-2"
                    onClick={() => { setSearch(""); selectCategory(null); selectTag(null); }}>
                    <Filter className="h-4 w-4" /> Clear filters
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Categories */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">Categories</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => selectCategory(null)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${!selectedCategory && !selectedTag ? "bg-accent text-white border-accent" : "border-border/50 text-muted-foreground hover:border-accent/50 hover:text-accent"}`}>
                All
              </button>
              {(categoryData?.categories ?? []).map(cat => (
                <button key={cat.slug} onClick={() => selectCategory(cat.label)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${selectedCategory === cat.label ? "bg-accent text-white border-accent" : "border-border/50 text-muted-foreground hover:border-accent/50 hover:text-accent"}`}>
                  {cat.label}{typeof cat.count === "number" && cat.count > 0 ? ` (${cat.count})` : ""}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          {(categoryData?.tags?.length ?? 0) > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">Topics</p>
              <div className="flex flex-wrap gap-1.5">
                {displayedTags.map(tag => (
                  <button key={tag.tag} onClick={() => selectTag(selectedTag === tag.tag ? null : tag.tag)}
                    className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ${selectedTag === tag.tag ? "bg-primary text-primary-foreground border-primary" : "bg-background/50 border-border/50 text-muted-foreground hover:text-accent hover:border-accent/40"}`}>
                    #{tag.tag} <span className="opacity-60">{tag.count}</span>
                  </button>
                ))}
                {(categoryData?.tags?.length ?? 0) > 24 && (
                  <button onClick={() => setShowAllTags(v => !v)}
                    className="text-[11px] px-2.5 py-1 rounded-full border border-dashed border-accent/40 text-accent hover:bg-accent/5 transition-all">
                    {showAllTags ? "Show less" : `+${(categoryData?.tags?.length ?? 0) - 24} more`}
                  </button>
                )}
              </div>
            </div>
          )}
        </motion.div>

        {/* ── Featured Articles ─────────────────────────────────────────────── */}
        {featuredPosts.length > 0 && !isFiltered && offset === 0 && (
          <section className="mb-12">
            <div className="flex items-end justify-between gap-4 mb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent mb-2">Featured Articles</p>
                <h2 className="font-serif text-2xl md:text-3xl font-bold text-primary">Start with these ministry teachings</h2>
              </div>
            </div>
            <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {featuredPosts.slice(0, 3).map((post, index) => (
                <PostCard key={post.id} post={post} large={index === 0} />
              ))}
            </motion.div>
          </section>
        )}

        <AdSlot slot={ADSENSE_SLOTS.blogFeed} minHeight={120} className="mx-auto max-w-5xl mb-8" lazy={false} />

        {/* ── Two-column layout: Main feed + Trending sidebar ───────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* Main article feed */}
          <div className="xl:col-span-3">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent mb-1">{activeLabel}</p>
                <h2 className="font-serif text-2xl font-bold text-primary">Article Library</h2>
              </div>
              {isFetching && <Loader2 className="h-4 w-4 animate-spin text-accent" />}
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 9 }).map((_, i) => <PostCardSkeleton key={i} />)}
              </div>
            ) : posts.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-center py-20 glass-panel rounded-3xl border border-border/50">
                <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-primary mb-2">No articles found</h3>
                <p className="text-muted-foreground text-sm">Try another search term, category, or tag.</p>
                <Button variant="outline" className="mt-4 rounded-full" onClick={() => { setSearch(""); selectCategory(null); selectTag(null); }}>
                  View all articles
                </Button>
              </motion.div>
            ) : (
              <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {posts.map(post => <PostCard key={post.id} post={post} />)}
              </motion.div>
            )}

            {total > PAGE_SIZE && (
              <div className="flex items-center justify-center gap-3 mt-12">
                <Button variant="outline" size="sm" className="rounded-full"
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                  disabled={offset === 0 || isFetching}>
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
                <Button variant="outline" size="sm" className="rounded-full"
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                  disabled={offset + PAGE_SIZE >= total || isFetching}>
                  {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Next"}
                </Button>
              </div>
            )}
          </div>

          {/* Sidebar: Trending + AI Suggestions */}
          <aside className="xl:col-span-1 space-y-6">
            {/* Trending */}
            {trendingPosts.length > 0 && (
              <div className="glass-panel rounded-3xl border border-border/50 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-4 w-4 text-orange-400" />
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-400">Trending Now</p>
                </div>
                <div className="space-y-1">
                  {trendingPosts.slice(0, 6).map((post, i) => (
                    <TrendingCard key={post.slug} post={post} rank={i + 1} />
                  ))}
                </div>
              </div>
            )}

            {/* AI Suggestions */}
            <div className="glass-panel rounded-3xl border border-accent/20 p-5 bg-gradient-to-br from-accent/5 to-background">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="h-4 w-4 text-accent" />
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">AI Spiritual Guide</p>
              </div>
              <p className="text-sm text-muted-foreground mb-4">Ask the AI assistant about any teaching, scripture, or spiritual question.</p>
              <Link href="/sermon-assistant">
                <Button size="sm" className="w-full rounded-full bg-accent hover:bg-accent/90 text-white gap-2">
                  <Brain className="h-3.5 w-3.5" /> Open TempleBots
                </Button>
              </Link>
            </div>

            {/* Category browse */}
            <div className="glass-panel rounded-3xl border border-border/50 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Bookmark className="h-4 w-4 text-accent" />
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Browse by Category</p>
              </div>
              <div className="space-y-2">
                {(categoryData?.categories ?? []).filter(c => (c.count ?? 0) > 0).map(cat => (
                  <button key={cat.slug} onClick={() => selectCategory(cat.label)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all ${selectedCategory === cat.label ? "bg-accent/10 text-accent border border-accent/20" : "hover:bg-accent/5 text-muted-foreground hover:text-accent"}`}>
                    <span className="font-medium">{cat.label}</span>
                    <span className="text-xs opacity-60">{cat.count}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Sidebar ad */}
            <AdSlot
              slot={ADSENSE_SLOTS.sermonSidebar}
              format="rectangle"
              minHeight={280}
              lazy={true}
              label="Blog sidebar advertisement"
            />
          </aside>
        </div>

        {/* ── Featured Sermons ──────────────────────────────────────────────── */}
        {(sermons?.length ?? 0) > 0 && (
          <section className="mt-16 glass-panel rounded-3xl border border-border/50 p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <Video className="h-6 w-6 text-accent" />
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Temple TV</p>
                <h2 className="font-serif text-2xl font-bold text-primary">Continue with live sermon teachings</h2>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {sermons!.slice(0, 3).map(sermon => (
                <Link key={sermon.id} href={`/sermons/${sermon.id}`}>
                  <div className="group rounded-2xl border border-border/50 overflow-hidden bg-background/60 hover:border-accent/40 transition-all cursor-pointer h-full">
                    {sermon.thumbnailUrl && (
                      <img src={sermon.thumbnailUrl} alt={sermon.title} className="w-full aspect-video object-cover" loading="lazy" />
                    )}
                    <div className="p-4">
                      <h3 className="font-semibold text-primary line-clamp-2 group-hover:text-accent transition-colors">{sermon.title}</h3>
                      {sermon.publishedAt && (
                        <p className="text-xs text-muted-foreground mt-2">{format(new Date(sermon.publishedAt), "MMM d, yyyy")}</p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
}

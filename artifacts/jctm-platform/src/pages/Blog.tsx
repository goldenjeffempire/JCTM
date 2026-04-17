import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Clock, FileText, Filter, Layers3, Loader2, Search, Sparkles, Tag, Video } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ADSENSE_SLOTS, AdSlot } from "@/components/ads/AdSense";

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

function PostCard({ post, large = false }: { post: BlogPost; large?: boolean }) {
  const category = post.category ?? post.topic.replace(/-/g, " ");

  return (
    <motion.div variants={fadeUp} className={large ? "lg:col-span-2" : undefined}>
      <Link href={`/blog/${post.slug}`}>
        <div className={`group glass-panel rounded-3xl border border-border/50 hover:border-accent/50 hover:shadow-xl hover:shadow-accent/5 transition-all duration-300 cursor-pointer h-full flex flex-col overflow-hidden ${large ? "p-8 bg-gradient-to-br from-accent/10 via-background to-primary/5" : "p-6"}`}>
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

          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground mt-auto pt-2">
            <span>{post.publishedAt ? format(new Date(post.publishedAt), "MMM d, yyyy") : "Published teaching"}</span>
            <span className="flex items-center gap-1 font-semibold text-accent group-hover:gap-2 transition-all">
              Read article <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
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
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

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
      if (selectedTag) params.set("tag", selectedTag);
      if (search.trim()) params.set("q", search.trim());
      return fetch(`${BASE}/api/blog?${params}`).then(r => r.json());
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: sermons } = useQuery<SermonPreview[]>({
    queryKey: ["blog-featured-sermons"],
    queryFn: () => fetch(`${BASE}/api/sermons?limit=3`).then(r => r.json()),
    staleTime: 1000 * 60 * 10,
  });

  const posts = data?.posts ?? [];
  const featuredPosts = data?.featuredPosts ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const activeLabel = useMemo(() => {
    if (selectedTag) return `#${selectedTag}`;
    if (selectedCategory) return selectedCategory;
    if (search.trim()) return `Search: ${search.trim()}`;
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

  return (
    <Layout>
      <SEO
        title="Ministry Blog — Enterprise Sermon Articles"
        description="A structured ministry publishing hub with sermon-inspired teachings, prophetic messages, devotionals, Bible studies, and ministry insights from Jesus Christ Temple Ministry."
        path="/blog"
        keywords="JCTM blog, ministry articles, sermon-based teachings, Prophet Amos Evomobor, Bible studies, prophetic messages, holiness, repentance, spiritual warfare"
        breadcrumbs={[
          { name: "Home", url: "https://jctm.org.ng/" },
          { name: "Ministry Blog", url: "https://jctm.org.ng/blog" },
        ]}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "JCTM Ministry Blog",
          description: "Sermon-inspired articles and Bible teachings from Jesus Christ Temple Ministry.",
          url: "https://jctm.org.ng/blog",
          publisher: { "@type": "Organization", name: "Jesus Christ Temple Ministry" },
        }}
      />

      <div className="container mx-auto px-4 py-14 max-w-7xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold mb-4 border" style={{ background: "rgba(56,189,248,0.08)", color: "hsl(var(--accent))", borderColor: "rgba(56,189,248,0.25)" }}>
            <BookOpen className="h-3.5 w-3.5" /> Enterprise Ministry Blog
          </div>
          <h1 className="text-4xl md:text-6xl font-serif font-bold text-primary mb-4">
            Sermon-Inspired Articles for Spiritual Growth
          </h1>
          <p className="text-muted-foreground text-lg max-w-3xl mx-auto leading-relaxed">
            A complete teaching library organized for global readers, with structured articles on repentance, holiness, prayer, prophecy, Kingdom living, and ministry growth.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <div className="glass-panel rounded-2xl p-5 border border-border/50">
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-accent" />
              <div>
                <p className="text-2xl font-serif font-bold text-primary">{total || "24+"}</p>
                <p className="text-xs text-muted-foreground">Published teachings</p>
              </div>
            </div>
          </div>
          <div className="glass-panel rounded-2xl p-5 border border-border/50">
            <div className="flex items-center gap-3">
              <Layers3 className="h-6 w-6 text-accent" />
              <div>
                <p className="text-2xl font-serif font-bold text-primary">{categoryData?.categories?.length ?? 5}</p>
                <p className="text-xs text-muted-foreground">Content categories</p>
              </div>
            </div>
          </div>
          <div className="glass-panel rounded-2xl p-5 border border-border/50">
            <div className="flex items-center gap-3">
              <Tag className="h-6 w-6 text-accent" />
              <div>
                <p className="text-2xl font-serif font-bold text-primary">{categoryData?.tags?.length ?? 30}</p>
                <p className="text-xs text-muted-foreground">Searchable tags</p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }} className="mb-10 glass-panel rounded-3xl border border-border/50 p-5 md:p-6 space-y-5">
          <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => { setSearch(e.target.value); resetPagination(); }}
                placeholder="Full-text search articles, scripture themes, tags..."
                className="pl-10 rounded-full h-11"
              />
            </div>
            <Button
              variant="outline"
              className="rounded-full gap-2"
              onClick={() => { setSearch(""); selectCategory(null); selectTag(null); }}
            >
              <Filter className="h-4 w-4" /> Clear filters
            </Button>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <button onClick={() => selectCategory(null)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${!selectedCategory && !selectedTag ? "bg-accent text-white border-accent" : "border-border/50 text-muted-foreground hover:border-accent/50 hover:text-accent"}`}>
                All Categories
              </button>
              {(categoryData?.categories ?? []).map(category => (
                <button key={category.slug} onClick={() => selectCategory(category.label)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${selectedCategory === category.label ? "bg-accent text-white border-accent" : "border-border/50 text-muted-foreground hover:border-accent/50 hover:text-accent"}`}>
                  {category.label}{typeof category.count === "number" ? ` (${category.count})` : ""}
                </button>
              ))}
            </div>

            {(categoryData?.tags?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {categoryData!.tags.slice(0, 24).map(tag => (
                  <button key={tag.tag} onClick={() => selectTag(selectedTag === tag.tag ? null : tag.tag)} className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ${selectedTag === tag.tag ? "bg-primary text-primary-foreground border-primary" : "bg-background/50 border-border/50 text-muted-foreground hover:text-accent hover:border-accent/40"}`}>
                    #{tag.tag} <span className="opacity-70">{tag.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {featuredPosts.length > 0 && !search.trim() && !selectedCategory && !selectedTag && offset === 0 && (
          <section className="mb-12">
            <div className="flex items-end justify-between gap-4 mb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent mb-2">Featured Articles</p>
                <h2 className="font-serif text-2xl md:text-3xl font-bold text-primary">Start with these ministry teachings</h2>
              </div>
            </div>
            <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {featuredPosts.slice(0, 3).map((post, index) => <PostCard key={post.id} post={post} large={index === 0} />)}
            </motion.div>
          </section>
        )}

        <AdSlot slot={ADSENSE_SLOTS.blogFeed} minHeight={120} className="mx-auto max-w-5xl mb-8" lazy={false} />

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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20 glass-panel rounded-3xl border border-border/50">
            <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-primary mb-2">No articles found</h3>
            <p className="text-muted-foreground text-sm">Try another search term, category, or tag.</p>
          </motion.div>
        ) : (
          <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map(post => <PostCard key={post.id} post={post} />)}
          </motion.div>
        )}

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-center gap-3 mt-12">
            <Button variant="outline" size="sm" onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} disabled={offset === 0 || isFetching} className="rounded-full">
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setOffset(offset + PAGE_SIZE)} disabled={offset + PAGE_SIZE >= total || isFetching} className="rounded-full">
              {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Next"}
            </Button>
          </div>
        )}

        {(sermons?.length ?? 0) > 0 && (
          <section className="mt-16 glass-panel rounded-3xl border border-border/50 p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <Video className="h-6 w-6 text-accent" />
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Featured Sermons</p>
                <h2 className="font-serif text-2xl font-bold text-primary">Continue with Temple TV teachings</h2>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {sermons!.slice(0, 3).map(sermon => (
                <Link key={sermon.id} href={`/sermons/${sermon.id}`}>
                  <div className="group rounded-2xl border border-border/50 overflow-hidden bg-background/60 hover:border-accent/40 transition-all cursor-pointer h-full">
                    {sermon.thumbnailUrl && <img src={sermon.thumbnailUrl} alt={sermon.title} className="w-full aspect-video object-cover" loading="lazy" />}
                    <div className="p-4">
                      <h3 className="font-semibold text-primary line-clamp-2 group-hover:text-accent transition-colors">{sermon.title}</h3>
                      {sermon.publishedAt && <p className="text-xs text-muted-foreground mt-2">{format(new Date(sermon.publishedAt), "MMM d, yyyy")}</p>}
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

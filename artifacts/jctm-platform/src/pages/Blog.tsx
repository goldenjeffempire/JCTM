import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { BookOpen, Search, Tag, Clock, ChevronRight, Loader2, FileText, ArrowRight } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

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
  publishedAt: string | null;
}

interface BlogTopic {
  slug: string;
  label: string;
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45 } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

function PostCard({ post }: { post: BlogPost }) {
  return (
    <motion.div variants={fadeUp}>
      <Link href={`/blog/${post.slug}`}>
        <div className="group glass-panel rounded-2xl p-6 border border-border/50 hover:border-accent/40 transition-all duration-200 cursor-pointer h-full flex flex-col">
          <div className="flex items-start justify-between gap-3 mb-3">
            <Badge variant="secondary" className="text-xs font-medium capitalize shrink-0">
              {post.topic.replace(/-/g, " ")}
            </Badge>
            {post.publishedAt && (
              <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                <Clock className="h-3 w-3" />
                {format(new Date(post.publishedAt), "MMM d, yyyy")}
              </span>
            )}
          </div>

          <h2 className="font-serif font-bold text-primary text-lg leading-snug mb-2 group-hover:text-accent transition-colors line-clamp-2 flex-1">
            {post.title}
          </h2>

          {post.excerpt && (
            <p className="text-sm text-muted-foreground line-clamp-3 mb-4">{post.excerpt}</p>
          )}

          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-4">
              {post.tags.slice(0, 3).map(tag => (
                <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-accent/8 text-accent/80 border border-accent/20">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1 text-xs font-semibold text-accent group-hover:gap-2 transition-all mt-auto">
            Read article <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function PostCardSkeleton() {
  return (
    <div className="glass-panel rounded-2xl p-6 border border-border/30 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-4 w-24 rounded ml-auto" />
      </div>
      <Skeleton className="h-6 w-full rounded" />
      <Skeleton className="h-4 w-4/5 rounded" />
      <Skeleton className="h-4 w-3/5 rounded" />
      <div className="flex gap-1 pt-1">
        {[1, 2].map(i => <Skeleton key={i} className="h-4 w-12 rounded-full" />)}
      </div>
      <Skeleton className="h-4 w-24 rounded mt-2" />
    </div>
  );
}

export default function Blog() {
  const [search, setSearch] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  const { data: topicsData } = useQuery<{ topics: BlogTopic[] }>({
    queryKey: ["blog-topics"],
    queryFn: () => fetch(`${BASE}/api/blog/topics`).then(r => r.json()),
    staleTime: 1000 * 60 * 60,
  });

  const { data, isLoading, isFetching } = useQuery<{ posts: BlogPost[]; total: number }>({
    queryKey: ["blog", selectedTopic, offset],
    queryFn: () => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
      if (selectedTopic) params.set("topic", selectedTopic);
      return fetch(`${BASE}/api/blog?${params}`).then(r => r.json());
    },
    staleTime: 1000 * 60 * 5,
  });

  const allPosts = data?.posts ?? [];
  const total = data?.total ?? 0;

  const filtered = search.trim()
    ? allPosts.filter(p =>
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        (p.excerpt ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : allPosts;

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const handleTopicChange = (topic: string | null) => {
    setSelectedTopic(topic);
    setOffset(0);
    setSearch("");
  };

  return (
    <Layout>
      <SEO
        title="Ministry Blog — JCTM Digital Sanctuary"
        description="Theological insights, doctrinal teachings, and spiritual reflections from Jesus Christ Temple Ministry. Explore articles on holiness, Bible doctrine, and the Correction Mandate."
        path="/blog"
        keywords="JCTM blog, holiness theology, doctrinal correction, apostolic teaching, bible doctrine Nigeria, JCTM articles, Prophet Amos Evomobor teachings"
        breadcrumbs={[
          { name: "Home", url: "https://jctm.org.ng/" },
          { name: "Ministry Blog", url: "https://jctm.org.ng/blog" },
        ]}
      />

      <div className="container mx-auto px-4 py-14 max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold mb-4 border"
            style={{ background: "rgba(56,189,248,0.08)", color: "hsl(var(--accent))", borderColor: "rgba(56,189,248,0.25)" }}>
            <BookOpen className="h-3.5 w-3.5" /> Ministry Blog
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary mb-4">
            Theological Insights
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Deep biblical reflections, doctrinal clarity, and spiritual guidance rooted in the Correction Mandate.
          </p>
        </motion.div>

        {/* Search + Filter Bar */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="mb-8 space-y-4"
        >
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search articles..."
              className="pl-10 rounded-full"
            />
          </div>

          {topicsData?.topics && (
            <div className="flex flex-wrap justify-center gap-2">
              <button
                onClick={() => handleTopicChange(null)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${!selectedTopic ? "bg-accent text-white border-accent" : "border-border/50 text-muted-foreground hover:border-accent/50 hover:text-accent"}`}
              >
                All Topics
              </button>
              {topicsData.topics.map(t => (
                <button
                  key={t.slug}
                  onClick={() => handleTopicChange(t.slug)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${selectedTopic === t.slug ? "bg-accent text-white border-accent" : "border-border/50 text-muted-foreground hover:border-accent/50 hover:text-accent"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </motion.div>

        {/* Posts Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 9 }).map((_, i) => <PostCardSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-primary mb-2">No articles found</h3>
            <p className="text-muted-foreground text-sm">
              {search ? "Try a different search term" : "Check back soon — articles are being generated"}
            </p>
          </motion.div>
        ) : (
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filtered.map(post => <PostCard key={post.id} post={post} />)}
          </motion.div>
        )}

        {/* Pagination */}
        {!search && total > PAGE_SIZE && (
          <div className="flex items-center justify-center gap-3 mt-12">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0 || isFetching}
              className="rounded-full"
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={offset + PAGE_SIZE >= total || isFetching}
              className="rounded-full"
            >
              {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Next"}
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}

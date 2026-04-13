import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft, BookOpen, Clock, Tag, ChevronRight, Share2,
  Copy, CheckCircle2, AlertCircle, ExternalLink
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import { useState } from "react";

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
  seoTitle: string | null;
  seoDescription: string | null;
  schemaJson: string | null;
  publishedAt: string | null;
  generatedAt: string | null;
}

interface RelatedPost {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  topic: string;
  publishedAt: string | null;
}

function ContentRenderer({ content }: { content: string }) {
  const paragraphs = content.split(/\n{2,}/);
  return (
    <div className="prose prose-lg max-w-none dark:prose-invert
      prose-headings:font-serif prose-headings:text-primary
      prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl
      prose-p:text-foreground/90 prose-p:leading-relaxed
      prose-a:text-accent prose-a:no-underline hover:prose-a:underline
      prose-strong:text-primary prose-strong:font-semibold
      prose-blockquote:border-accent prose-blockquote:text-muted-foreground
      prose-code:text-accent prose-code:bg-accent/10 prose-code:rounded prose-code:px-1
      prose-li:text-foreground/90
    ">
      {paragraphs.map((para, i) => {
        const trimmed = para.trim();
        if (!trimmed) return null;

        if (trimmed.startsWith("## ")) {
          return <h2 key={i}>{trimmed.slice(3)}</h2>;
        }
        if (trimmed.startsWith("# ")) {
          return <h1 key={i}>{trimmed.slice(2)}</h1>;
        }
        if (trimmed.startsWith("### ")) {
          return <h3 key={i}>{trimmed.slice(4)}</h3>;
        }
        if (trimmed.startsWith("> ")) {
          return <blockquote key={i}><p>{trimmed.slice(2)}</p></blockquote>;
        }
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const items = trimmed.split("\n").filter(l => l.match(/^[-*] /));
          return (
            <ul key={i}>
              {items.map((item, j) => (
                <li key={j}>{item.replace(/^[-*] /, "")}</li>
              ))}
            </ul>
          );
        }
        if (trimmed.match(/^\d+\. /)) {
          const items = trimmed.split("\n").filter(l => l.match(/^\d+\. /));
          return (
            <ol key={i}>
              {items.map((item, j) => (
                <li key={j}>{item.replace(/^\d+\. /, "")}</li>
              ))}
            </ol>
          );
        }
        if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
          return <p key={i}><strong>{trimmed.slice(2, -2)}</strong></p>;
        }

        const formatted = trimmed
          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
          .replace(/\*(.*?)\*/g, "<em>$1</em>")
          .replace(/`(.*?)`/g, "<code>$1</code>");

        return <p key={i} dangerouslySetInnerHTML={{ __html: formatted }} />;
      })}
    </div>
  );
}

export default function BlogPost() {
  const [, params] = useRoute("/blog/:slug");
  const slug = params?.slug ?? "";
  const [copied, setCopied] = useState(false);

  const { data, isLoading, isError } = useQuery<{
    post: FullPost;
    relatedPosts: RelatedPost[];
    breadcrumbSchema: string;
  }>({
    queryKey: ["blog-post", slug],
    queryFn: () => fetch(`${BASE}/api/blog/${slug}`).then(r => {
      if (!r.ok) throw new Error("Post not found");
      return r.json();
    }),
    enabled: !!slug,
    staleTime: 1000 * 60 * 30,
  });

  const post = data?.post;
  const related = data?.relatedPosts ?? [];

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleShare = async () => {
    if (navigator.share && post) {
      try {
        await navigator.share({
          title: post.title,
          text: post.excerpt ?? post.title,
          url: window.location.href,
        });
      } catch {
        handleCopy();
      }
    } else {
      handleCopy();
    }
  };

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

  return (
    <Layout>
      {post && (
        <SEO
          title={post.seoTitle ?? post.title}
          description={post.seoDescription ?? post.excerpt ?? post.title}
          path={`/blog/${post.slug}`}
          keywords={post.tags?.join(", ") ?? "JCTM blog, theology, holiness"}
          breadcrumbs={[
            { name: "Home", url: "https://jctm.org.ng/" },
            { name: "Blog", url: "https://jctm.org.ng/blog" },
            { name: post.title, url: `https://jctm.org.ng/blog/${post.slug}` },
          ]}
          jsonLd={post.schemaJson ? [JSON.parse(post.schemaJson)] : undefined}
        />
      )}

      <div className="container mx-auto px-4 py-10 max-w-4xl">
        {/* Back link */}
        <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} className="mb-8">
          <Link href="/blog">
            <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-accent transition-colors">
              <ArrowLeft className="h-4 w-4" /> Back to Blog
            </button>
          </Link>
        </motion.div>

        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-8 w-1/3 rounded-full" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-5 w-3/4 rounded" />
            <div className="space-y-3 mt-8">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full rounded" />
              ))}
            </div>
          </div>
        ) : post ? (
          <motion.article
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Meta */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <Badge variant="secondary" className="capitalize">
                {post.topic.replace(/-/g, " ")}
              </Badge>
              {post.publishedAt && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(new Date(post.publishedAt), "MMMM d, yyyy")}
                </span>
              )}
              <button
                onClick={handleShare}
                className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-accent transition-colors"
              >
                {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Share2 className="h-3.5 w-3.5" />}
                {copied ? "Copied!" : "Share"}
              </button>
            </div>

            {/* Title */}
            <h1 className="font-serif font-bold text-primary text-3xl md:text-4xl leading-tight mb-4">
              {post.title}
            </h1>

            {post.excerpt && (
              <p className="text-lg text-muted-foreground leading-relaxed mb-8 border-l-4 border-accent/40 pl-4">
                {post.excerpt}
              </p>
            )}

            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-8">
                <Tag className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                {post.tags.map(tag => (
                  <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-accent/8 text-accent/80 border border-accent/20">
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-border/40 mb-10" />

            {/* Content */}
            <ContentRenderer content={post.content} />

            {/* Footer */}
            <div className="border-t border-border/40 mt-12 pt-8">
              <div className="glass-panel rounded-2xl p-6 border border-accent/20 text-center">
                <BookOpen className="h-8 w-8 text-accent mx-auto mb-3" />
                <h3 className="font-serif font-bold text-primary text-lg mb-2">
                  Deepen Your Understanding
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Explore more teachings through our sermon archive or ask our AI Sermon Assistant.
                </p>
                <div className="flex flex-wrap gap-3 justify-center">
                  <Link href="/sermons">
                    <Button variant="outline" size="sm" className="rounded-full gap-2">
                      <BookOpen className="h-3.5 w-3.5" /> Sermon Archive
                    </Button>
                  </Link>
                  <Link href="/sermon-assistant">
                    <Button size="sm" className="rounded-full gap-2 bg-accent hover:bg-accent/90 text-white">
                      Ask AI <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </motion.article>
        ) : null}

        {/* Related Posts */}
        {related.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-16"
          >
            <h2 className="font-serif font-bold text-primary text-2xl mb-6">Related Articles</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {related.map(r => (
                <Link key={r.slug} href={`/blog/${r.slug}`}>
                  <div className="group glass-panel rounded-xl p-4 border border-border/50 hover:border-accent/40 transition-all cursor-pointer">
                    <Badge variant="secondary" className="text-xs mb-2 capitalize">
                      {r.topic.replace(/-/g, " ")}
                    </Badge>
                    <h3 className="font-semibold text-primary text-sm leading-snug group-hover:text-accent transition-colors line-clamp-2 mb-1">
                      {r.title}
                    </h3>
                    {r.publishedAt && (
                      <span className="text-[11px] text-muted-foreground">
                        {format(new Date(r.publishedAt), "MMM d, yyyy")}
                      </span>
                    )}
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

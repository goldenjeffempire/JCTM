import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useGetSermon, getGetSermonQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import {
  Volume2, VideoIcon, ArrowLeft, Calendar, Eye, Sparkles, ChevronRight,
  Share2, Copy, Check, Bot, ExternalLink, Play, Clock,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { CrusadeAdBanner } from "@/pages/Crusade";
import { DualStreamToggle, useStreamQuality, buildYouTubeUrl } from "@/components/DualStreamToggle";
import { LiveChat } from "@/components/LiveChat";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface SermonSummary { summary: string; keyPoints: string[]; generatedAt: string; }

interface RelatedSermon {
  id: number;
  videoId: string;
  title: string;
  thumbnailUrl: string;
  publishedAt: string;
  viewCount?: number | null;
}

function SermonAISummary({ sermonId }: { sermonId: number }) {
  const [data, setData] = useState<SermonSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [requested, setRequested] = useState(false);

  const generate = () => {
    if (loading || data) return;
    setLoading(true);
    setRequested(true);
    fetch(`${BASE}/api/sermons/${sermonId}/summary`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((d: SermonSummary) => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  };

  if (!requested) {
    return (
      <div className="glass-panel rounded-2xl p-5 border border-accent/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent/10 rounded-xl">
              <Sparkles className="h-4 w-4 text-accent" />
            </div>
            <div>
              <h2 className="font-semibold text-primary text-sm">AI Sermon Summary</h2>
              <p className="text-xs text-muted-foreground">Key teaching points, extracted by AI</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={generate} className="rounded-full text-accent border-accent/30 hover:bg-accent/5 text-xs h-8">
            Generate <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="glass-panel rounded-2xl p-5 border border-accent/20 animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-accent/10 rounded-xl"><Sparkles className="h-4 w-4 text-accent animate-spin" /></div>
          <span className="text-xs text-muted-foreground">Generating sermon summary…</span>
        </div>
        <div className="space-y-2">
          {[100, 80, 90].map((w, i) => (
            <div key={i} className="h-3 bg-muted rounded" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="glass-panel rounded-2xl p-5 border border-accent/20"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-accent/10 rounded-xl"><Sparkles className="h-4 w-4 text-accent" /></div>
        <h2 className="font-semibold text-primary text-sm">AI Sermon Summary</h2>
      </div>
      <p className="text-muted-foreground text-sm leading-relaxed mb-4">{data.summary}</p>
      {data.keyPoints.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-accent mb-2">Key Teaching Points</h3>
          <ul className="space-y-1.5">
            {data.keyPoints.map((pt, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-accent/10 text-accent text-[10px] flex items-center justify-center font-bold">{i + 1}</span>
                {pt}
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
}


function RelatedSermons({ currentId, title }: { currentId: number; title: string }) {
  const [sermons, setSermons] = useState<RelatedSermon[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const keywords = title
      .split(/\s+/)
      .filter(w => w.length > 3)
      .slice(0, 2)
      .join(" ");

    const searchTerm = keywords || "holiness";

    fetch(`${BASE}/api/sermons?search=${encodeURIComponent(searchTerm)}&limit=7`)
      .then(r => r.ok ? r.json() : [])
      .then((data: RelatedSermon[]) => {
        setSermons(data.filter(s => s.id !== currentId).slice(0, 6));
      })
      .catch(() => setSermons([]))
      .finally(() => setLoading(false));
  }, [currentId, title]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-24 h-14 bg-muted rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-muted rounded w-full" />
              <div className="h-3 bg-muted rounded w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!sermons.length) return null;

  return (
    <div className="space-y-2">
      {sermons.map((s) => (
        <Link key={s.id} href={`/sermons/${s.id}`}>
          <motion.div
            whileHover={{ x: 2 }}
            className="flex gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer group"
          >
            <div className="relative w-24 h-[54px] flex-shrink-0 rounded-lg overflow-hidden bg-muted">
              <img
                src={s.thumbnailUrl}
                alt={s.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                <Play className="h-4 w-4 text-white fill-white" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-primary line-clamp-2 leading-tight group-hover:text-accent transition-colors">
                {s.title}
              </p>
              <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                <Clock className="h-2.5 w-2.5" />
                <span>{formatDistanceToNow(new Date(s.publishedAt), { addSuffix: true })}</span>
                {s.viewCount && (
                  <>
                    <Eye className="h-2.5 w-2.5" />
                    <span>{s.viewCount.toLocaleString()}</span>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </Link>
      ))}
    </div>
  );
}

export default function SermonDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0", 10);
  const [audioMode, setAudioMode] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { quality, toggle: toggleQuality } = useStreamQuality();

  const { data: sermon, isLoading } = useGetSermon(id, {
    query: { enabled: !!id && !isNaN(id), queryKey: getGetSermonQueryKey(id) }
  });

  const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}${BASE}/sermons/${id}`;
  const shareText = sermon ? `"${sermon.title}" — JCTM Temple TV` : "JCTM Temple TV";

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setCopied(false), 2500);
  };

  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText + "\n" + shareUrl)}`, "_blank", "noopener");
  };

  const shareTwitter = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, "_blank", "noopener");
  };

  const openYouTube = (videoId: string) => {
    window.open(`https://www.youtube.com/watch?v=${videoId}`, "_blank", "noopener");
  };

  const askAiUrl = sermon
    ? `${BASE}/sermon-assistant?q=${encodeURIComponent(`Tell me about: ${sermon.title}`)}`
    : `${BASE}/sermon-assistant`;

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16">
          <div className="animate-pulse max-w-6xl mx-auto">
            <div className="h-6 bg-muted rounded w-1/4 mb-6" />
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
              <div>
                <div className="aspect-video bg-muted rounded-2xl mb-4" />
                <div className="h-7 bg-muted rounded w-3/4 mb-3" />
                <div className="h-4 bg-muted rounded w-1/3" />
              </div>
              <div className="space-y-4">
                <div className="h-5 bg-muted rounded w-1/2 mb-3" />
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex gap-3">
                    <div className="w-24 h-14 bg-muted rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-muted rounded" />
                      <div className="h-3 bg-muted rounded w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!sermon) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-32 text-center">
          <h2 className="text-2xl font-bold text-primary mb-4">Sermon not found</h2>
          <Link href="/sermons">
            <Button variant="outline">Back to Sermons</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const seoTitle = `${sermon.title} — Temple TV Sermon`;
  const seoDesc = `Watch "${sermon.title}" — a Temple TV sermon from Jesus Christ Temple Ministry (JCTM). ${sermon.description ? sermon.description.slice(0, 100) + "…" : "Teachings on holiness, apostolic doctrine, and the Correction Mandate."}`;

  return (
    <Layout>
      <SEO
        title={seoTitle}
        description={seoDesc}
        path={`/sermons/${id}`}
        image={sermon.thumbnailUrl ?? undefined}
        type="article"
        keywords="Temple TV sermon, JCTM sermon, Jesus Christ Temple Ministry teaching, Prophet Amos Evomobor"
        breadcrumbs={[
          { name: "Home", url: "https://jctm.org.ng/" },
          { name: "Sermons", url: "https://jctm.org.ng/sermons" },
          { name: sermon.title, url: `https://jctm.org.ng/sermons/${id}` },
        ]}
        publishedTime={sermon.publishedAt}
        jsonLd={[{
          "@context": "https://schema.org",
          "@type": "VideoObject",
          "name": sermon.title,
          "description": sermon.description ?? seoDesc,
          "thumbnailUrl": sermon.thumbnailUrl,
          "uploadDate": sermon.publishedAt,
          "duration": "PT1H",
          "url": `https://www.youtube.com/watch?v=${sermon.videoId}`,
          "embedUrl": `https://www.youtube.com/embed/${sermon.videoId}`,
          "contentUrl": `https://www.youtube.com/watch?v=${sermon.videoId}`,
          "inLanguage": "en-NG",
          "publisher": {
            "@type": "ReligiousOrganization",
            "name": "Jesus Christ Temple Ministry (JCTM)",
            "url": "https://jctm.org.ng",
          },
          "author": {
            "@type": "Person",
            "name": "Prophet Amos Evomobor",
            "url": "https://jctm.org.ng/leadership",
          },
          "genre": "Religious Teaching",
          "keywords": "JCTM, Temple TV, Prophet Amos Evomobor, holiness, Correction Mandate, apostolic Christianity",
        }]}
      />

      <div className="container mx-auto px-4 py-10 max-w-6xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

          {/* Back nav */}
          <Link href="/sermons">
            <button className="flex items-center gap-2 text-muted-foreground hover:text-primary text-sm mb-6 transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Back to Temple TV
            </button>
          </Link>

          {/* Crusade banner */}
          <div className="mb-6 rounded-2xl overflow-hidden shadow-md">
            <CrusadeAdBanner />
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">

            {/* ── Main column ────────────────────────────────────────── */}
            <div className="space-y-5">

              {/* Player controls row */}
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <DualStreamToggle quality={quality} onToggle={toggleQuality} />
                  <Button
                    variant={audioMode ? "default" : "outline"}
                    onClick={() => setAudioMode(!audioMode)}
                    size="sm"
                    className={`flex items-center gap-2 rounded-full ${audioMode ? "bg-accent text-white border-accent" : "text-primary border-primary/30"}`}
                  >
                    {audioMode ? <Volume2 className="h-3.5 w-3.5" /> : <VideoIcon className="h-3.5 w-3.5" />}
                    {audioMode ? "Audio Mode" : "Audio Only"}
                  </Button>
                </div>

                {/* Share button */}
                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShareOpen(s => !s)}
                    className="flex items-center gap-2 rounded-full border-primary/20 text-primary hover:bg-primary/5"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    Share
                  </Button>
                  <AnimatePresence>
                    {shareOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        className="absolute right-0 top-10 z-50 glass-panel rounded-2xl p-3 border border-border/60 shadow-xl min-w-[200px] space-y-1"
                      >
                        <button
                          onClick={() => { shareWhatsApp(); setShareOpen(false); }}
                          className="flex items-center gap-3 w-full px-3 py-2 rounded-xl hover:bg-[#25D366]/10 text-sm font-medium transition-colors text-left"
                        >
                          <span className="text-base">💬</span>
                          <span>WhatsApp</span>
                        </button>
                        <button
                          onClick={() => { shareTwitter(); setShareOpen(false); }}
                          className="flex items-center gap-3 w-full px-3 py-2 rounded-xl hover:bg-sky-500/10 text-sm font-medium transition-colors text-left"
                        >
                          <span className="text-base">𝕏</span>
                          <span>Post on X</span>
                        </button>
                        <button
                          onClick={() => { openYouTube(sermon.videoId); setShareOpen(false); }}
                          className="flex items-center gap-3 w-full px-3 py-2 rounded-xl hover:bg-red-500/10 text-sm font-medium transition-colors text-left"
                        >
                          <ExternalLink className="h-3.5 w-3.5 text-red-500" />
                          <span>Open on YouTube</span>
                        </button>
                        <div className="border-t border-border/40 my-1" />
                        <button
                          onClick={() => { copyLink(); setShareOpen(false); }}
                          className="flex items-center gap-3 w-full px-3 py-2 rounded-xl hover:bg-muted text-sm font-medium transition-colors text-left"
                        >
                          {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                          <span>{copied ? "Copied!" : "Copy Link"}</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Video player */}
              <div className="rounded-2xl overflow-hidden shadow-xl relative">
                <div className="aspect-video relative bg-black">
                  <iframe
                    className="absolute inset-0 w-full h-full"
                    src={audioMode
                      ? `https://www.youtube.com/embed/${sermon.videoId}?autoplay=1&rel=0&origin=${encodeURIComponent(window.location.origin)}`
                      : buildYouTubeUrl(sermon.videoId, quality)}
                    title={sermon.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                  {audioMode && (
                    <div className="absolute inset-0 bg-primary z-10 pointer-events-none flex flex-col items-center justify-center gap-6">
                      <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center">
                        <Volume2 className="h-10 w-10 text-accent animate-pulse" />
                      </div>
                      <div className="text-center px-4">
                        <p className="text-white font-semibold text-base line-clamp-2">{sermon.title}</p>
                        <p className="text-white/60 text-xs mt-1">Temple TV — Audio Only Mode</p>
                      </div>
                      <div className="flex items-end gap-1 h-8">
                        {[4, 7, 5, 9, 6, 8, 4, 7, 5, 9, 6, 4].map((h, i) => (
                          <div
                            key={i}
                            className="w-1.5 bg-accent rounded-full"
                            style={{ height: `${h * 3}px`, animation: `audioBar 0.9s ease-in-out ${i * 0.08}s infinite alternate` }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Sermon title + meta */}
              <div>
                <h1 className="text-xl md:text-2xl font-serif font-bold text-primary leading-tight mb-2">
                  {sermon.title}
                </h1>
                <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {format(new Date(sermon.publishedAt), "MMMM d, yyyy")}
                  </span>
                  {sermon.viewCount != null && (
                    <span className="flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5" />
                      {sermon.viewCount.toLocaleString()} views
                    </span>
                  )}
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/8 text-primary/70 border border-primary/15">
                    Temple TV
                  </span>
                </div>
              </div>

              {/* AI Summary */}
              <SermonAISummary sermonId={id} />

              {/* Ask AI contextual card */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="rounded-2xl p-5 border border-accent/20 bg-gradient-to-br from-accent/5 to-primary/5"
              >
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-accent/15 rounded-xl">
                      <Bot className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-primary text-sm">Have questions about this sermon?</h3>
                      <p className="text-xs text-muted-foreground">Ask TempleBot — trained on 479+ JCTM sermons</p>
                    </div>
                  </div>
                  <Link href={askAiUrl}>
                    <Button
                      size="sm"
                      className="rounded-full text-xs font-semibold"
                      style={{ background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%)", color: "white", border: "none" }}
                    >
                      Ask AI <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  </Link>
                </div>
              </motion.div>

              {/* Description */}
              {sermon.description && (
                <div className="glass-panel rounded-2xl p-5">
                  <h2 className="font-semibold text-primary text-base mb-3">About this message</h2>
                  <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">{sermon.description}</p>
                </div>
              )}
            </div>

            {/* ── Sidebar column ──────────────────────────────────────── */}
            <div className="space-y-5">

              {/* Quick share row */}
              <div className="glass-panel rounded-2xl p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Share this sermon</p>
                <div className="flex gap-2">
                  <button
                    onClick={shareWhatsApp}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border border-[#25D366]/30 text-[#25D366] bg-[#25D366]/8 hover:bg-[#25D366]/15 transition-colors"
                  >
                    💬 WhatsApp
                  </button>
                  <button
                    onClick={shareTwitter}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border border-sky-400/30 text-sky-500 bg-sky-400/8 hover:bg-sky-400/15 transition-colors"
                  >
                    𝕏 Post
                  </button>
                  <button
                    onClick={copyLink}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-border/40 text-muted-foreground hover:bg-muted transition-colors"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Related sermons */}
              <div className="glass-panel rounded-2xl p-4">
                <h2 className="text-sm font-semibold text-primary mb-4">Related Sermons</h2>
                <RelatedSermons currentId={id} title={sermon.title} />
                <div className="mt-4 pt-3 border-t border-border/30">
                  <Link href="/sermons">
                    <button className="text-xs text-accent hover:underline flex items-center gap-1 transition-colors">
                      View all sermons <ChevronRight className="h-3 w-3" />
                    </button>
                  </Link>
                </div>
              </div>

              {/* YouTube CTA */}
              <a
                href={`https://www.youtube.com/watch?v=${sermon.videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block glass-panel rounded-2xl p-4 group hover:border-red-500/30 transition-colors border border-transparent"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-500/10 rounded-xl group-hover:bg-red-500/20 transition-colors">
                    <svg className="h-5 w-5 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-primary">Watch on YouTube</p>
                    <p className="text-xs text-muted-foreground">JCTM Temple TV channel</p>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground ml-auto group-hover:text-red-500 transition-colors" />
                </div>
              </a>
            </div>
          </div>
        </motion.div>
      </div>

      <LiveChat isLive={sermon.isLive ?? false} />
    </Layout>
  );
}

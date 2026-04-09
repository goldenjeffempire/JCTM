import { useState } from "react";
import { useParams } from "wouter";
import { useGetSermon, getGetSermonQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Volume2, VideoIcon, ArrowLeft, Calendar, Eye, Sparkles, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { CrusadeAdBanner } from "@/pages/Crusade";
import { DualStreamToggle, useStreamQuality, buildYouTubeUrl } from "@/components/DualStreamToggle";
import { LiveChat } from "@/components/LiveChat";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface SermonSummary { summary: string; keyPoints: string[]; generatedAt: string; }

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
      <div className="glass-panel rounded-2xl p-6 border border-accent/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent/10 rounded-xl">
              <Sparkles className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h2 className="font-semibold text-primary text-base">AI Sermon Summary</h2>
              <p className="text-xs text-muted-foreground">Key teaching points, extracted by AI</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={generate} className="rounded-full text-accent border-accent/30 hover:bg-accent/5">
            Generate <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="glass-panel rounded-2xl p-6 border border-accent/20 animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-accent/10 rounded-xl"><Sparkles className="h-5 w-5 text-accent animate-spin" /></div>
          <span className="text-sm text-muted-foreground">Generating sermon summary…</span>
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-muted rounded w-full" />
          <div className="h-4 bg-muted rounded w-4/5" />
          <div className="h-4 bg-muted rounded w-3/4" />
        </div>
      </div>
    );
  }

  if (error || !data) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="glass-panel rounded-2xl p-6 border border-accent/20"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-accent/10 rounded-xl"><Sparkles className="h-5 w-5 text-accent" /></div>
        <h2 className="font-semibold text-primary text-base">AI Sermon Summary</h2>
      </div>
      <p className="text-muted-foreground text-sm leading-relaxed mb-5">{data.summary}</p>
      {data.keyPoints.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-accent mb-3">Key Teaching Points</h3>
          <ul className="space-y-2">
            {data.keyPoints.map((pt, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-accent/10 text-accent text-xs flex items-center justify-center font-bold">{i + 1}</span>
                {pt}
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
}

export default function SermonDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0", 10);
  const [audioMode, setAudioMode] = useState(false);
  const { quality, toggle: toggleQuality } = useStreamQuality();

  const { data: sermon, isLoading } = useGetSermon(id, {
    query: { enabled: !!id && !isNaN(id), queryKey: getGetSermonQueryKey(id) }
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16">
          <div className="animate-pulse max-w-4xl mx-auto">
            <div className="h-8 bg-muted rounded w-1/3 mb-6" />
            <div className="aspect-video bg-muted rounded-2xl mb-6" />
            <div className="h-6 bg-muted rounded w-2/3 mb-4" />
            <div className="h-4 bg-muted rounded w-1/4" />
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

  const seoTitle = sermon ? `${sermon.title} — Temple TV Sermon` : "Sermon — Temple TV | JCTM";
  const seoDesc = sermon
    ? `Watch "${sermon.title}" — a Temple TV sermon from Jesus Christ Temple Ministry (JCTM). ${sermon.description ? sermon.description.slice(0, 100) + "…" : "Teachings on holiness, apostolic doctrine, and the Correction Mandate."}`
    : "Watch sermons from Jesus Christ Temple Ministry (JCTM) on Temple TV.";

  return (
    <Layout>
      <SEO
        title={seoTitle}
        description={seoDesc}
        path={`/sermons/${id}`}
        image={sermon?.thumbnailUrl ?? undefined}
        type="article"
        keywords="Temple TV sermon, JCTM sermon, Jesus Christ Temple Ministry teaching, Prophet Amos Evomobor"
        breadcrumbs={sermon ? [
          { name: "Home", url: "https://jctm.org.ng/" },
          { name: "Sermons", url: "https://jctm.org.ng/sermons" },
          { name: sermon.title, url: `https://jctm.org.ng/sermons/${id}` },
        ] : undefined}
        publishedTime={sermon?.publishedAt}
        jsonLd={sermon ? [
          {
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
              "logo": {
                "@type": "ImageObject",
                "url": "https://jctm.org.ng/favicon.png"
              }
            },
            "author": {
              "@type": "Person",
              "name": "Prophet Amos Evomobor",
              "url": "https://jctm.org.ng/leadership"
            },
            "genre": "Religious Teaching",
            "keywords": "JCTM, Temple TV, Prophet Amos Evomobor, holiness, Correction Mandate, apostolic Christianity"
          }
        ] : undefined}
      />
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Link href="/sermons">
            <button className="flex items-center gap-2 text-muted-foreground hover:text-primary text-sm mb-8 transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Back to Sermons
            </button>
          </Link>

          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h1 className="text-2xl md:text-3xl font-serif font-bold text-primary leading-tight flex-1">
              {sermon.title}
            </h1>
            <div className="flex items-center gap-3 flex-wrap">
              <DualStreamToggle quality={quality} onToggle={toggleQuality} />
              <Button
                variant={audioMode ? "default" : "outline"}
                onClick={() => setAudioMode(!audioMode)}
                className={`flex items-center gap-2 rounded-full ${audioMode ? "bg-accent text-white border-accent" : "text-primary border-primary/30"}`}
              >
                {audioMode ? <Volume2 className="h-4 w-4" /> : <VideoIcon className="h-4 w-4" />}
                {audioMode ? "Audio Mode" : "Audio Only"}
              </Button>
            </div>
          </div>

          <div className="flex gap-4 text-sm text-muted-foreground mb-6 flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {format(new Date(sermon.publishedAt), "MMMM d, yyyy")}
            </span>
            {sermon.viewCount && (
              <span className="flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" />
                {sermon.viewCount.toLocaleString()} views
              </span>
            )}
          </div>

          {/* Crusade Ad Banner */}
          <div className="mb-6 rounded-2xl overflow-hidden shadow-lg">
            <CrusadeAdBanner />
          </div>

          {/* Media Player */}
          <div className="rounded-2xl overflow-hidden mb-8 shadow-lg relative">
            {audioMode ? (
              <div className="aspect-video bg-primary flex flex-col items-center justify-center gap-6">
                <div className="w-24 h-24 rounded-full bg-accent/20 flex items-center justify-center">
                  <Volume2 className="h-12 w-12 text-accent" />
                </div>
                <div className="text-center">
                  <p className="text-white font-semibold text-lg">{sermon.title}</p>
                  <p className="text-white/60 text-sm mt-1">Temple TV — Audio Only Mode</p>
                </div>
                <iframe
                  className="opacity-0 h-0 w-0 absolute pointer-events-none"
                  src={`https://www.youtube.com/embed/${sermon.videoId}?autoplay=1`}
                  allow="autoplay"
                  title={`${sermon.title} audio`}
                />
                <div className="w-64 bg-white/20 rounded-full overflow-hidden h-2">
                  <div className="h-full bg-accent rounded-full" style={{ width: "40%" }} />
                </div>
              </div>
            ) : (
              <div className="aspect-video">
                <iframe
                  width="100%"
                  height="100%"
                  src={buildYouTubeUrl(sermon.videoId, quality)}
                  title={sermon.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
            )}
          </div>

          {/* AI Sermon Summary — indexable text content for Google */}
          <div className="mb-6">
            <SermonAISummary sermonId={id} />
          </div>

          {sermon.description && (
            <div className="glass-panel rounded-2xl p-6">
              <h2 className="font-semibold text-primary text-lg mb-3">About this message</h2>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{sermon.description}</p>
            </div>
          )}

          <div className="mt-8 flex justify-center">
            <a
              href={`https://www.youtube.com/watch?v=${sermon.videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent text-sm hover:underline"
            >
              Watch on YouTube / Temple TV Channel
            </a>
          </div>
        </motion.div>
      </div>
      <LiveChat isLive={sermon.isLive ?? false} />
    </Layout>
  );
}

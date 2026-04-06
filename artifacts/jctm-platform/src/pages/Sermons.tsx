import { useState } from "react";
import { useListSermons, getListSermonsQueryKey, useGetSermonStats, getGetSermonStatsQueryKey, useSyncSermons } from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { Search, Volume2, Play, RefreshCw, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function Sermons() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const { data: sermons, isLoading } = useListSermons(
    { search: debouncedSearch || undefined, limit: 20, offset: 0 },
    { query: { queryKey: getListSermonsQueryKey({ search: debouncedSearch || undefined }) } }
  );

  const { data: stats } = useGetSermonStats({ query: { queryKey: getGetSermonStatsQueryKey() } });

  const syncMutation = useSyncSermons();

  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout(window._searchTimeout);
    window._searchTimeout = setTimeout(() => setDebouncedSearch(val), 400) as unknown as number;
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary mb-4">
            Sermon Hub
          </h1>
          <p className="text-muted-foreground text-lg mb-8">
            All messages from Temple TV — teachings of Prophet Amos Evomobor on Primitive Christianity, Holiness, and Doctrinal Correction.
          </p>

          {stats && (
            <div className="flex flex-wrap gap-4 mb-8">
              <div className="glass-panel px-5 py-3 rounded-xl">
                <span className="text-2xl font-bold text-primary">{stats.total}</span>
                <span className="text-sm text-muted-foreground ml-2">sermons</span>
              </div>
              {stats.totalViews && (
                <div className="glass-panel px-5 py-3 rounded-xl">
                  <span className="text-2xl font-bold text-primary">{stats.totalViews.toLocaleString()}</span>
                  <span className="text-sm text-muted-foreground ml-2">total views</span>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search sermons..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10 border-border bg-white"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => syncMutation.mutate({ data: {} })}
              disabled={syncMutation.isPending}
              className="flex items-center gap-2 text-primary"
            >
              <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
              Sync from YouTube
            </Button>
          </div>

          {syncMutation.isSuccess && (
            <p className="text-sm text-accent mt-2">{(syncMutation.data as { message: string }).message}</p>
          )}
        </motion.div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="glass-panel rounded-2xl p-4 animate-pulse">
                <div className="aspect-video bg-muted rounded-xl mb-4" />
                <div className="h-4 bg-muted rounded mb-2" />
                <div className="h-3 bg-muted rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(sermons ?? []).map((sermon, i) => (
              <SermonCard key={sermon.id} sermon={sermon} index={i} />
            ))}
          </div>
        )}

        {!isLoading && (sermons ?? []).length === 0 && (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg">No sermons found. Click "Sync from YouTube" to load the latest Temple TV content.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}

function SermonCard({ sermon, index }: { sermon: { id: number; videoId: string; title: string; thumbnailUrl: string; publishedAt: string; description?: string | null }, index: number }) {
  const [audioMode, setAudioMode] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.05 }}
      className="glass-panel rounded-2xl overflow-hidden group hover:shadow-lg hover:shadow-accent/10 transition-all duration-300"
    >
      <div className="relative aspect-video bg-muted overflow-hidden">
        {audioMode ? (
          <div className="absolute inset-0 bg-primary flex flex-col items-center justify-center gap-3">
            <Volume2 className="h-12 w-12 text-accent" />
            <p className="text-white text-sm font-medium px-4 text-center">{sermon.title}</p>
            <p className="text-white/60 text-xs">Audio Only Mode</p>
            <div className="w-32 h-1 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full" style={{ width: "35%" }} />
            </div>
          </div>
        ) : (
          <img
            src={sermon.thumbnailUrl}
            alt={sermon.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${sermon.videoId}/hqdefault.jpg`;
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
          <a
            href={`https://www.youtube.com/watch?v=${sermon.videoId}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="sm" className="bg-accent text-white hover:bg-accent/90 rounded-full text-xs gap-1">
              <Play className="h-3 w-3" />
              Watch
            </Button>
          </a>
          <button
            onClick={() => setAudioMode(!audioMode)}
            className={`text-xs px-3 py-1.5 rounded-full flex items-center gap-1 transition-colors ${audioMode ? "bg-accent text-white" : "bg-white/20 text-white hover:bg-white/30"}`}
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

declare global {
  interface Window { _searchTimeout: number }
}

/**
 * VideoDownloadPanel — Dedicated inline MP4 video download component.
 *
 * Embeds directly inside a page (not a bottom sheet). Shows a quality selector
 * (360p → 1080p Full HD), starts conversion via the media API, tracks progress
 * with SSE + polling fallback, and delivers a tokenized download link.
 *
 * Always produces MP4 video — no format picker needed.
 * Emits to the global MediaJobsPanel floating queue automatically.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Film, Download, CheckCircle2, AlertCircle, Loader2,
  RefreshCw, Clock, Wifi, Monitor, Smartphone, Tv2,
  ArrowDownToLine, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { emitTrackJob } from "./MediaJobsPanel";

const BASE = import.meta.env.VITE_API_URL ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────

type Quality   = "low" | "medium" | "high" | "ultra";
type JobStatus = "queued" | "processing" | "ready" | "failed";

interface Job {
  jobId:             string;
  status:            JobStatus;
  progress:          number;
  title:             string | null;
  fileSizeFormatted: string | null;
  error:             string | null;
  downloadUrl:       string | null;
  thumbnailUrl:      string | null;
  expiresAt?:        string | null;
  cached?:           boolean;
  retryCount?:       number;
}

interface QualityConfig {
  value:       Quality;
  label:       string;
  sublabel:    string;
  resolution:  string;
  description: string;
  icon:        React.ReactNode;
  tag?:        string;
  tagColor?:   string;
}

// ─── Quality options ──────────────────────────────────────────────────────────

const QUALITY_OPTIONS: QualityConfig[] = [
  {
    value: "low", label: "360p", sublabel: "Mobile",
    resolution: "640×360",
    description: "Fast download, saves data",
    icon: <Smartphone className="h-4 w-4" />,
  },
  {
    value: "medium", label: "480p", sublabel: "Standard",
    resolution: "854×480",
    description: "Good quality, smaller file",
    icon: <Monitor className="h-4 w-4" />,
    tag: "Balanced", tagColor: "text-sky-400 bg-sky-400/15",
  },
  {
    value: "high", label: "720p HD", sublabel: "High Definition",
    resolution: "1280×720",
    description: "Clear and sharp",
    icon: <Monitor className="h-4 w-4" />,
    tag: "Recommended", tagColor: "text-emerald-400 bg-emerald-400/15",
  },
  {
    value: "ultra", label: "1080p", sublabel: "Full HD",
    resolution: "1920×1080",
    description: "Best quality, larger file",
    icon: <Tv2 className="h-4 w-4" />,
    tag: "Highest", tagColor: "text-violet-400 bg-violet-400/15",
  },
];

// ─── Props ────────────────────────────────────────────────────────────────────

export interface VideoDownloadPanelProps {
  videoId:      string;
  title?:       string;
  thumbnailUrl?: string;
  duration?:    number;
  className?:   string;
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
      <motion.div
        className="h-full bg-gradient-to-r from-primary to-violet-500 rounded-full"
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      />
    </div>
  );
}

// ─── Expiry helper ────────────────────────────────────────────────────────────

function expiryLabel(expiresAt: string | null | undefined): string {
  if (!expiresAt) return "";
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Link expired";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m remaining` : `${m}m remaining`;
}

// ─── Component ────────────────────────────────────────────────────────────────

type Step = "idle" | "processing" | "done" | "error";

export default function VideoDownloadPanel({
  videoId, title: propTitle, thumbnailUrl: propThumbnail, duration: _dur,
  className,
}: VideoDownloadPanelProps) {

  const [step,    setStep]    = useState<Step>("idle");
  const [quality, setQuality] = useState<Quality>("high");
  const [job,     setJob]     = useState<Job | null>(null);
  const [loading, setLoading] = useState(false);
  const [errMsg,  setErrMsg]  = useState<string | null>(null);

  const sseRef         = useRef<EventSource | null>(null);
  const downloadedRef  = useRef(false);
  const forceNew       = useRef(false);

  useEffect(() => () => { sseRef.current?.close(); }, []);

  const closeSSE = () => { sseRef.current?.close(); sseRef.current = null; };

  const openSSE = useCallback((jobId: string) => {
    closeSSE();
    const es = new EventSource(`${BASE}/api/media/progress/${jobId}`);
    sseRef.current = es;

    es.addEventListener("progress", (evt) => {
      try {
        const data: Job = JSON.parse((evt as MessageEvent).data);
        setJob(data);
        if (data.status === "ready")  { setStep("done");  closeSSE(); }
        if (data.status === "failed") {
          setStep("error");
          setErrMsg(data.error ?? "Conversion failed — please try again.");
          closeSSE();
        }
      } catch { /* ignore */ }
    });

    let poll: ReturnType<typeof setInterval> | null = null;
    es.onerror = () => {
      closeSSE();
      if (poll) return;
      poll = setInterval(async () => {
        try {
          const r = await fetch(`${BASE}/api/media/jobs/${jobId}`);
          if (!r.ok) return;
          const data: Job = await r.json();
          setJob(data);
          if (data.status === "ready")  { setStep("done");  clearInterval(poll!); }
          if (data.status === "failed") {
            setStep("error");
            setErrMsg(data.error ?? "Conversion failed.");
            clearInterval(poll!);
          }
        } catch { /* silent */ }
      }, 2500);
    };
  }, []);

  async function startDownload() {
    setLoading(true);
    setErrMsg(null);

    try {
      const res = await fetch(`${BASE}/api/media/request`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type:         "youtube_video",
          sourceId:     videoId,
          format:       "mp4",
          quality,
          title:        propTitle,
          thumbnailUrl: propThumbnail,
          deduplicate:  !forceNew.current,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setErrMsg(body.error ?? "Server error — please try again.");
        setStep("error");
        return;
      }

      const data: Job = await res.json();
      forceNew.current = false;
      setJob(data);
      emitTrackJob(data.jobId);

      if (data.status === "ready") {
        setStep("done");
        if (data.cached) toast.success("Already converted — instant download ready!", { duration: 3000 });
      } else {
        setStep("processing");
        openSSE(data.jobId);
      }
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "Failed to start conversion.");
      setStep("error");
    } finally {
      setLoading(false);
    }
  }

  async function triggerSave() {
    if (!job?.jobId || downloadedRef.current) return;
    downloadedRef.current = true;
    try {
      const tokenRes = await fetch(`${BASE}/api/media/token/${job.jobId}`, { method: "POST" });
      const dlUrl = tokenRes.ok
        ? `${BASE}${(await tokenRes.json() as { downloadUrl: string }).downloadUrl}`
        : `${BASE}${job.downloadUrl ?? `/api/media/download/${job.jobId}`}`;

      const a = document.createElement("a");
      a.href = dlUrl;
      a.download = job.title ?? propTitle ?? "jctm_sermon";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Download started! Check your Downloads folder.", { duration: 4000 });
    } catch {
      downloadedRef.current = false;
      toast.error("Could not start download. Please try again.");
    }
  }

  function retry() {
    closeSSE();
    setStep("idle");
    setJob(null);
    setErrMsg(null);
    downloadedRef.current = false;
    forceNew.current = true;
  }

  const selectedQ = QUALITY_OPTIONS.find(q => q.value === quality)!;

  return (
    <div className={cn(
      "rounded-2xl border border-white/8 bg-gradient-to-b from-zinc-900/80 to-zinc-900/60",
      "backdrop-blur-md overflow-hidden",
      className,
    )}>

      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/6">
        <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
          <Film className="h-4.5 w-4.5 text-primary" />
        </div>
        <div>
          <p className="text-white font-semibold text-sm leading-tight">Download Video</p>
          <p className="text-white/40 text-[11px] mt-0.5">Save this sermon for offline viewing — MP4</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-[10px] text-white/30">
          <Wifi className="h-3 w-3" />
          <span className="hidden sm:inline">Works offline</span>
        </div>
      </div>

      <div className="px-5 py-4">

        {/* ── Idle: quality picker ─────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {step === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Quality grid */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-white/35 mb-2.5">
                  Choose Quality
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {QUALITY_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setQuality(opt.value)}
                      className={cn(
                        "flex flex-col items-start p-3 rounded-xl border text-left transition-all duration-200",
                        "group relative overflow-hidden",
                        quality === opt.value
                          ? "border-primary/50 bg-primary/10 shadow-sm shadow-primary/10"
                          : "border-white/8 bg-white/3 hover:border-white/15 hover:bg-white/6",
                      )}
                    >
                      {opt.tag && (
                        <span className={cn(
                          "absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full",
                          opt.tagColor,
                        )}>
                          {opt.tag}
                        </span>
                      )}
                      <span className={cn(
                        "mb-1.5 rounded-lg p-1.5 transition-colors",
                        quality === opt.value ? "bg-primary/20 text-primary" : "bg-white/8 text-white/40 group-hover:text-white/60",
                      )}>
                        {opt.icon}
                      </span>
                      <span className="text-sm font-bold text-white leading-none">{opt.label}</span>
                      <span className="text-[10px] text-white/40 mt-0.5 leading-tight">{opt.sublabel}</span>
                      <span className="text-[10px] text-white/25 mt-1 font-mono">{opt.resolution}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <button
                onClick={startDownload}
                disabled={loading}
                className={cn(
                  "w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl",
                  "bg-primary text-white font-bold text-sm transition-all duration-200",
                  "hover:bg-primary/90 active:scale-[0.98] shadow-lg shadow-primary/20",
                  loading && "opacity-60 cursor-not-allowed",
                )}
              >
                {loading
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Checking…</>
                  : <><Zap className="h-4 w-4" /> Download {selectedQ.label} Video</>
                }
              </button>

              <p className="text-[10px] text-white/25 text-center leading-snug">
                For personal offline ministry use only · © JCTM Warri, Nigeria
              </p>
            </motion.div>
          )}

          {/* ── Processing ─────────────────────────────────────────────── */}
          {step === "processing" && job && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-4">
                {(job.thumbnailUrl ?? propThumbnail) && (
                  <img
                    src={job.thumbnailUrl ?? propThumbnail}
                    alt=""
                    className="w-14 h-10 rounded-xl object-cover flex-shrink-0 border border-white/10"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate leading-snug">
                    {job.title ?? propTitle ?? "JCTM Sermon"}
                  </p>
                  <p className="text-white/40 text-xs mt-0.5">
                    {job.status === "queued"
                      ? job.error ? job.error : "Queued — waiting for a free slot…"
                      : "Converting…"
                    }
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <span className="text-white font-bold text-lg leading-none block">
                    {job.progress}%
                  </span>
                  <span className="text-white/40 text-[10px]">
                    {selectedQ.label} MP4
                  </span>
                </div>
              </div>

              <ProgressBar pct={job.progress} />

              <p className="text-[11px] text-white/30 text-center">
                {job.status === "processing"
                  ? "Conversion running — you can close this page and check the Downloads panel later."
                  : "Your download will start processing shortly…"}
              </p>
            </motion.div>
          )}

          {/* ── Done ───────────────────────────────────────────────────── */}
          {step === "done" && job && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-2xl bg-emerald-500/15 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm">Ready to Download!</p>
                  <p className="text-emerald-400/80 text-xs mt-0.5">
                    {selectedQ.label} MP4
                    {job.fileSizeFormatted ? ` · ${job.fileSizeFormatted}` : ""}
                    {job.cached ? " · Instant (cached)" : ""}
                  </p>
                </div>
              </div>

              <button
                onClick={triggerSave}
                className={cn(
                  "w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl",
                  "bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm",
                  "transition-all duration-200 active:scale-[0.98] shadow-lg shadow-emerald-500/20",
                )}
              >
                <ArrowDownToLine className="h-4 w-4" />
                Save File
              </button>

              {job.expiresAt && (
                <div className="flex items-center justify-center gap-1.5 text-[10px] text-white/30">
                  <Clock className="h-3 w-3" />
                  <span>{expiryLabel(job.expiresAt)}</span>
                </div>
              )}

              <button
                onClick={retry}
                className="w-full text-[11px] text-white/30 hover:text-white/50 transition-colors flex items-center justify-center gap-1.5 py-1"
              >
                <RefreshCw className="h-3 w-3" />
                Download a different quality
              </button>
            </motion.div>
          )}

          {/* ── Error ──────────────────────────────────────────────────── */}
          {step === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-2xl bg-red-500/15 flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm">Download Failed</p>
                  <p className="text-red-400/80 text-xs mt-0.5 line-clamp-2">
                    {errMsg ?? "An unexpected error occurred."}
                  </p>
                </div>
              </div>

              {errMsg?.includes("live") && (
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-300/80 leading-relaxed">
                  Live streams cannot be downloaded while actively broadcasting. Please try again after the service ends.
                </div>
              )}

              <button
                onClick={retry}
                className={cn(
                  "w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl",
                  "bg-white/10 hover:bg-white/15 text-white font-bold text-sm",
                  "transition-all duration-200 active:scale-[0.98] border border-white/10",
                )}
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </button>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

// ─── Compact trigger button ────────────────────────────────────────────────────
// Use VideoDownloadButton with variant="button" for inline card footers.
// Use this panel for the full SermonDetail page download section.

export function VideoDownloadInlineButton({
  videoId, title, thumbnailUrl, className,
}: { videoId: string; title?: string; thumbnailUrl?: string; className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold",
          "border border-border text-muted-foreground",
          "hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all",
          open && "text-primary border-primary/40 bg-primary/5",
        )}
        title="Download video"
        aria-label="Download video"
        aria-expanded={open}
      >
        <Film className="h-3.5 w-3.5" />
        <span>Video</span>
        <Download className="h-3 w-3 opacity-60" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="absolute bottom-full right-0 mb-2 z-50 w-80 max-w-[calc(100vw-2rem)]"
          >
            <VideoDownloadPanel
              videoId={videoId}
              title={title}
              thumbnailUrl={thumbnailUrl}
              className="shadow-2xl border-white/12"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

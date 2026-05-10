/**
 * MediaDownloadSheet — JCTM media download and conversion UI
 *
 * Bottom sheet that lets users:
 *   • Pick format (MP3 / M4A / MP4 for YouTube; JPEG/PNG/WebP for gallery)
 *   • Pick quality
 *   • Track real-time conversion progress via SSE (with polling fallback)
 *   • Instantly download cached files
 *   • Retry after failure
 *
 * Works across desktop, Android Chrome, iOS Safari.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download, Music, Image as ImageIcon, X, CheckCircle2,
  AlertCircle, Loader2, RefreshCw, Clock, Headphones, Film,
  Zap, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const BASE = import.meta.env.VITE_API_URL ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────

type MediaType = "youtube_audio" | "youtube_video" | "gallery_image";
type Format    = "mp3" | "m4a" | "mp4" | "jpeg" | "png" | "webp";
type Quality   = "low" | "medium" | "high" | "ultra";
type JobStatus = "queued" | "processing" | "ready" | "failed";

interface Job {
  jobId:             string;
  status:            JobStatus;
  progress:          number;
  title:             string | null;
  duration:          number | null;
  fileSize:          number | null;
  fileSizeFormatted: string | null;
  error:             string | null;
  downloadUrl:       string | null;
  thumbnailUrl:      string | null;
  cached?:           boolean;
  retryCount?:       number;
  format?:           string;
  type?:             string;
}

interface FormatOption {
  value:       Format;
  label:       string;
  description: string;
  icon:        React.ReactNode;
  tag?:        string;
  types:       MediaType[];
}

interface QualityOption {
  value:        Quality;
  label:        string;
  description:  string;
  bitrate?:     string;
  resolution?:  string;
  tag?:         string;
}

// ─── Format / quality config ──────────────────────────────────────────────────

const FORMAT_OPTIONS: FormatOption[] = [
  {
    value: "mp3", label: "MP3 Audio",
    description: "Universal audio format, works on all devices",
    icon: <Music className="h-4.5 w-4.5" />, tag: "Most Compatible",
    types: ["youtube_audio", "youtube_video"],
  },
  {
    value: "m4a", label: "M4A Audio",
    description: "Higher quality audio, ideal for Apple devices",
    icon: <Headphones className="h-4.5 w-4.5" />,
    types: ["youtube_audio", "youtube_video"],
  },
  {
    value: "mp4", label: "MP4 Video",
    description: "Full video with audio, best for offline viewing",
    icon: <Film className="h-4.5 w-4.5" />, tag: "Larger file",
    types: ["youtube_audio", "youtube_video"],
  },
  {
    value: "jpeg", label: "JPEG Image",
    description: "Compressed photo, smaller file size",
    icon: <ImageIcon className="h-4.5 w-4.5" />, tag: "Most Compatible",
    types: ["gallery_image"],
  },
  {
    value: "png", label: "PNG Image",
    description: "Lossless quality, larger file",
    icon: <ImageIcon className="h-4.5 w-4.5" />,
    types: ["gallery_image"],
  },
  {
    value: "webp", label: "WebP Image",
    description: "Modern format — great quality, small file",
    icon: <ImageIcon className="h-4.5 w-4.5" />, tag: "Modern",
    types: ["gallery_image"],
  },
];

const AUDIO_QUALITY: QualityOption[] = [
  { value: "low",    label: "Standard",   description: "Good quality, smaller file",    bitrate: "128 kbps" },
  { value: "medium", label: "High",       description: "Balanced size and quality",     bitrate: "192 kbps", tag: "Recommended" },
  { value: "high",   label: "Very High",  description: "Excellent quality",             bitrate: "256 kbps" },
  { value: "ultra",  label: "Ultra",      description: "Maximum quality, largest file", bitrate: "320 kbps", tag: "Studio" },
];

const VIDEO_QUALITY: QualityOption[] = [
  { value: "low",    label: "360p",          description: "Mobile-friendly, low data",     resolution: "640×360" },
  { value: "medium", label: "480p",          description: "Standard definition",           resolution: "854×480",   tag: "Balanced" },
  { value: "high",   label: "720p HD",       description: "High definition",               resolution: "1280×720",  tag: "Recommended" },
  { value: "ultra",  label: "1080p Full HD", description: "Full high definition",          resolution: "1920×1080" },
];

const IMAGE_QUALITY: QualityOption[] = [
  { value: "low",    label: "Web Quality",  description: "Optimised for sharing online" },
  { value: "medium", label: "Standard",     description: "Good balance of size and quality", tag: "Recommended" },
  { value: "high",   label: "High Quality", description: "Large, detailed image" },
  { value: "ultra",  label: "Maximum",      description: "Full resolution, print quality" },
];

// ─── Props ────────────────────────────────────────────────────────────────────

export interface MediaDownloadSheetProps {
  open:           boolean;
  onClose:        () => void;
  type:           MediaType;
  sourceId:       string;
  title?:         string;
  thumbnailUrl?:  string;
  duration?:      number;
  onJobCreated?:  (jobId: string) => void;
  initialFormat?: Format;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function defaultFormat(type: MediaType): Format {
  if (type === "gallery_image") return "jpeg";
  if (type === "youtube_video") return "mp4";
  return "mp3";
}

function qualityOptions(format: Format): QualityOption[] {
  if (format === "mp4")                         return VIDEO_QUALITY;
  if (["jpeg", "png", "webp"].includes(format)) return IMAGE_QUALITY;
  return AUDIO_QUALITY;
}

function sheetLabel(type: MediaType, format?: Format): string {
  if (type === "gallery_image")  return "Gallery Image";
  if (format === "mp4")          return "Video";
  return "Audio";
}

// ─── Progress ring ────────────────────────────────────────────────────────────

function ProgressRing({ pct, size = 80 }: { pct: number; size?: number }) {
  const r    = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="rgba(255,255,255,0.08)" strokeWidth={5} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="#a78bfa" strokeWidth={5} strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ - (pct / 100) * circ}
        style={{ transition: "stroke-dashoffset 0.35s ease" }} />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MediaDownloadSheet({
  open, onClose, type, sourceId,
  title: propTitle, thumbnailUrl: propThumbnail, duration: propDuration,
  onJobCreated, initialFormat,
}: MediaDownloadSheetProps) {

  type Step = "pick" | "processing" | "done" | "error";

  const [step,            setStep]            = useState<Step>("pick");
  const [format,          setFormat]          = useState<Format>(defaultFormat(type));
  const [quality,         setQuality]         = useState<Quality>("high");
  const [job,             setJob]             = useState<Job | null>(null);
  const [loading,         setLoading]         = useState(false);
  const [isTriggering,    setIsTriggering]    = useState(false);
  const [errorMsg,        setErrorMsg]        = useState<string | null>(null);
  const [errorCode,       setErrorCode]       = useState<string | null>(null);
  const sseRef            = useRef<EventSource | null>(null);
  const forceNewJob       = useRef(false);

  const qOpts = qualityOptions(format);
  useEffect(() => { setQuality("high"); }, [format]);

  useEffect(() => {
    if (open) {
      setStep("pick");
      setFormat(initialFormat ?? defaultFormat(type));
      setQuality("high");
      setJob(null);
      setLoading(false);
      setIsTriggering(false);
      setErrorMsg(null);
      setErrorCode(null);
      forceNewJob.current = false;
    } else {
      closeSSE();
    }
  }, [open, type, initialFormat]);

  useEffect(() => () => closeSSE(), []);

  function closeSSE() {
    sseRef.current?.close();
    sseRef.current = null;
  }

  const openSSE = useCallback((jobId: string) => {
    closeSSE();
    const es = new EventSource(`${BASE}/api/media/progress/${jobId}`);
    sseRef.current = es;

    es.addEventListener("progress", (evt) => {
      try {
        const data: Job = JSON.parse((evt as MessageEvent).data);
        setJob(data);
        if (data.status === "ready")  { setStep("done");  closeSSE(); }
        if (data.status === "failed") { setStep("error"); closeSSE(); }
      } catch { /* malformed */ }
    });

    es.addEventListener("done", (evt) => {
      try {
        const { status } = JSON.parse((evt as MessageEvent).data) as { status: string };
        if (status === "ready")  setStep("done");
        if (status === "failed") setStep("error");
        closeSSE();
      } catch { /* ignore */ }
    });

    let pollTimer: ReturnType<typeof setInterval> | null = null;

    async function pollOnce(): Promise<boolean> {
      try {
        const r = await fetch(`${BASE}/api/media/jobs/${jobId}`);
        if (!r.ok) return false;
        const data: Job = await r.json();
        setJob(data);
        if (data.status === "ready")  { setStep("done");  return true; }
        if (data.status === "failed") { setStep("error"); return true; }
        return false;
      } catch { return false; }
    }

    es.onerror = () => {
      closeSSE();
      if (pollTimer) return;
      // Fetch immediately — the server may have returned JSON (job already complete)
      void pollOnce().then(done => {
        if (done) return;
        pollTimer = setInterval(async () => {
          const finished = await pollOnce();
          if (finished) { clearInterval(pollTimer!); pollTimer = null; }
        }, 2000);
      });
    };
  }, []);

  async function startConversion() {
    setLoading(true);
    setErrorMsg(null);
    setErrorCode(null);

    try {
      const effectiveType: MediaType =
        type === "gallery_image"
          ? "gallery_image"
          : format === "mp4"
          ? "youtube_video"
          : "youtube_audio";

      const res = await fetch(`${BASE}/api/media/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type:         effectiveType,
          sourceId,
          format,
          quality,
          title:        propTitle,
          thumbnailUrl: propThumbnail,
          duration:     propDuration,
          deduplicate:  !forceNewJob.current,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string; code?: string };
        setErrorCode(body.code ?? null);
        setErrorMsg(body.error ?? "Server error — please try again.");
        setStep("error");
        return;
      }

      const data = await res.json() as Job & { cached?: boolean };
      forceNewJob.current = false;
      setJob(data);
      if (data.jobId) onJobCreated?.(data.jobId);

      if (data.status === "ready" && (data.cached || data.downloadUrl)) {
        setStep("done");
        if (data.cached) toast.success("Instant download — file already converted!", { duration: 3000 });
      } else {
        setStep("processing");
        openSSE(data.jobId);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to start conversion. Please try again.");
      setStep("error");
    } finally {
      setLoading(false);
    }
  }

  async function triggerDownload() {
    if (!job?.jobId || isTriggering) return;
    setIsTriggering(true);
    try {
      const tokenRes = await fetch(`${BASE}/api/media/token/${job.jobId}`, { method: "POST" });
      const dlUrl = tokenRes.ok
        ? `${BASE}${(await tokenRes.json() as { downloadUrl: string }).downloadUrl}`
        : `${BASE}${job.downloadUrl ?? `/api/media/download/${job.jobId}`}`;

      const ext      = job.format ?? format;
      const rawName  = job.title
        ? job.title.replace(/[^\w\s\-()']/g, "").replace(/\s+/g, "_").trim().slice(0, 80)
        : `jctm_media_${job.jobId.slice(0, 8)}`;
      const filename = rawName.endsWith(`.${ext}`) ? rawName : `${rawName}.${ext}`;

      // iOS Safari ignores <a download> for server URLs — open in new tab instead
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) &&
                    !(window as unknown as { MSStream?: unknown }).MSStream;
      if (isIOS) {
        window.open(dlUrl, "_blank", "noopener,noreferrer");
        toast.success("File opened — use the Share menu (box with arrow) to save it to your device.", { duration: 6000 });
      } else {
        const a = document.createElement("a");
        a.href = dlUrl;
        a.download = filename;
        a.rel = "noopener noreferrer";
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        setTimeout(() => document.body.removeChild(a), 1000);
        toast.success("Download started! Check your Downloads folder.", { duration: 4000 });
      }
    } catch {
      toast.error("Failed to start download. Please try again.");
    } finally {
      // Allow re-download after a short delay (prevents accidental double-click)
      setTimeout(() => setIsTriggering(false), 3000);
    }
  }

  function retry() {
    closeSSE();
    setStep("pick");
    setJob(null);
    setErrorMsg(null);
    setErrorCode(null);
    setIsTriggering(false);
    forceNewJob.current = true;
  }

  const availableFormats = FORMAT_OPTIONS.filter(f =>
    type === "gallery_image"
      ? f.types.includes("gallery_image")
      : f.types.includes("youtube_audio") || f.value === "mp4"
  );

  const thumbnail    = job?.thumbnailUrl ?? propThumbnail;
  const displayTitle = job?.title ?? propTitle ?? sheetLabel(type, format);
  const duration     = job?.duration ?? propDuration;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            key="sheet"
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 350 }}
            className="fixed bottom-0 inset-x-0 z-50 max-w-lg mx-auto"
          >
            <div className="bg-zinc-900 border border-white/10 rounded-t-3xl shadow-2xl overflow-hidden">

              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>

              {/* Header */}
              <div className="flex items-start justify-between px-5 pt-2 pb-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {thumbnail && (
                    <img src={thumbnail} alt=""
                      className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-white/10" />
                  )}
                  {!thumbnail && (
                    <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <Download className="h-5 w-5 text-primary" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[11px] text-primary/80 font-semibold uppercase tracking-widest mb-0.5">
                      {sheetLabel(type, format)} Download
                    </p>
                    <p className="text-white font-semibold text-sm leading-snug truncate max-w-[200px]">
                      {displayTitle}
                    </p>
                    {duration && (
                      <p className="text-white/40 text-xs mt-0.5 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {fmtDuration(duration)}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="ml-2 flex-shrink-0 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20
                             flex items-center justify-center transition-colors"
                >
                  <X className="h-4 w-4 text-white/70" />
                </button>
              </div>

              {/* ── Step: Pick ───────────────────────────────────────────── */}
              {step === "pick" && (
                <div className="px-5 pb-6 space-y-5">
                  {/* Format */}
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2.5">
                      Format
                    </p>
                    <div className="space-y-2">
                      {availableFormats.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setFormat(opt.value)}
                          className={cn(
                            "w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all",
                            format === opt.value
                              ? "border-primary/60 bg-primary/10"
                              : "border-white/8 bg-white/4 hover:bg-white/8",
                          )}
                        >
                          <span className={cn(
                            "flex-shrink-0 rounded-lg w-9 h-9 flex items-center justify-center",
                            format === opt.value ? "bg-primary/20 text-primary" : "bg-white/10 text-white/50",
                          )}>
                            {opt.icon}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-white">{opt.label}</span>
                              {opt.tag && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full
                                                 bg-primary/20 text-primary/90">
                                  {opt.tag}
                                </span>
                              )}
                            </span>
                            <span className="text-xs text-white/40 block mt-0.5">{opt.description}</span>
                          </span>
                          {format === opt.value && (
                            <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quality */}
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2.5">
                      Quality
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {qOpts.map(q => (
                        <button
                          key={q.value}
                          onClick={() => setQuality(q.value)}
                          className={cn(
                            "flex flex-col items-start p-3 rounded-xl border text-left transition-all",
                            quality === q.value
                              ? "border-primary/60 bg-primary/10"
                              : "border-white/8 bg-white/4 hover:bg-white/8",
                          )}
                        >
                          <span className="flex items-center gap-1.5 w-full">
                            <span className="text-sm font-semibold text-white">{q.label}</span>
                            {q.tag && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full
                                               bg-emerald-500/20 text-emerald-400 ml-auto">
                                {q.tag}
                              </span>
                            )}
                          </span>
                          <span className="text-[11px] text-white/40 mt-0.5">
                            {q.bitrate ?? q.resolution ?? q.description}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {type !== "gallery_image" && (
                    <p className="text-[11px] text-white/30 text-center px-2">
                      Audio/video is extracted from YouTube for personal offline ministry use only.
                      © JCTM Warri, Nigeria.
                    </p>
                  )}

                  <button
                    onClick={startConversion}
                    disabled={loading}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl",
                      "bg-primary text-white font-bold text-base transition-all duration-200",
                      "hover:bg-primary/90 active:scale-[0.98] shadow-lg shadow-primary/25",
                      loading && "opacity-60 cursor-not-allowed",
                    )}
                  >
                    {loading
                      ? <><Loader2 className="h-5 w-5 animate-spin" /> Checking…</>
                      : <><Zap className="h-5 w-5" /> Start Conversion</>
                    }
                  </button>
                </div>
              )}

              {/* ── Step: Processing ─────────────────────────────────────── */}
              {step === "processing" && job && (
                <div className="px-5 pb-8 flex flex-col items-center text-center gap-5">
                  <div className="relative mt-2">
                    <ProgressRing pct={job.progress} size={88} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-white font-bold text-lg">{job.progress}%</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-white font-semibold text-sm">
                      {job.status === "queued"
                        ? job.error ? job.error : "Queued — waiting for a free slot…"
                        : "Converting your file…"}
                    </p>
                    <p className="text-white/40 text-xs">
                      {format.toUpperCase()} ·{" "}
                      {quality === "low" ? "Standard" : quality === "medium" ? "High" : quality === "high" ? "Very High" : "Ultra"} quality
                    </p>
                    {job.status === "processing" && (
                      <p className="text-white/30 text-xs">This may take 30–90 seconds</p>
                    )}
                  </div>

                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-primary to-violet-400 rounded-full"
                      animate={{ width: `${job.progress}%` }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                    />
                  </div>

                  <button
                    onClick={() => { closeSSE(); setStep("pick"); }}
                    className="text-xs text-white/30 hover:text-white/60 transition-colors mt-1"
                  >
                    Change format or quality
                  </button>
                </div>
              )}

              {/* ── Step: Done ───────────────────────────────────────────── */}
              {step === "done" && job && (
                <div className="px-5 pb-8 flex flex-col items-center text-center gap-5">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mt-2">
                    <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                  </div>

                  <div className="space-y-1">
                    <p className="text-white font-bold text-base">Ready to Download</p>
                    {job.fileSizeFormatted && (
                      <p className="text-emerald-400/80 text-sm">
                        {job.fileSizeFormatted} · {format.toUpperCase()}
                      </p>
                    )}
                    {job.cached && (
                      <p className="text-primary/70 text-xs flex items-center justify-center gap-1">
                        <Zap className="h-3 w-3" /> Instant — file was already converted
                      </p>
                    )}
                  </div>

                  <button
                    onClick={triggerDownload}
                    disabled={isTriggering}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl",
                      "bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-base",
                      "transition-all duration-200 active:scale-[0.98] shadow-lg shadow-emerald-500/25",
                      isTriggering && "opacity-70 cursor-not-allowed",
                    )}
                  >
                    {isTriggering
                      ? <><Loader2 className="h-5 w-5 animate-spin" /> Preparing…</>
                      : <><Download className="h-5 w-5" /> Save File <ArrowRight className="h-4 w-4" /></>
                    }
                  </button>

                  <button
                    onClick={() => { setStep("pick"); setJob(null); setIsTriggering(false); }}
                    className="text-xs text-white/30 hover:text-white/60 transition-colors"
                  >
                    Download in a different format
                  </button>
                </div>
              )}

              {/* ── Step: Error ──────────────────────────────────────────── */}
              {step === "error" && (
                <div className="px-5 pb-8 flex flex-col items-center text-center gap-5">
                  <div className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center mt-2",
                    errorCode === "LIVE_STREAM" ? "bg-red-500/15" :
                    errorCode === "NOT_IN_LIBRARY" ? "bg-amber-500/15" : "bg-red-500/15",
                  )}>
                    <AlertCircle className={cn(
                      "h-8 w-8",
                      errorCode === "NOT_IN_LIBRARY" ? "text-amber-400" : "text-red-400",
                    )} />
                  </div>

                  <div className="space-y-1.5 px-2">
                    <p className="text-white font-bold text-base">
                      {errorCode === "LIVE_STREAM"     ? "Sermon is Live" :
                       errorCode === "NOT_IN_LIBRARY"  ? "Not in Library" :
                       "Conversion Failed"}
                    </p>
                    <p className="text-white/50 text-sm leading-relaxed">
                      {errorCode === "LIVE_STREAM"
                        ? "Downloads are only available after the live stream ends."
                        : errorCode === "NOT_IN_LIBRARY"
                        ? "This video is not yet in the JCTM sermon library. Only JCTM-published teachings can be downloaded."
                        : errorMsg ?? job?.error ?? "Something went wrong. Please try again."}
                    </p>
                  </div>

                  {errorCode !== "LIVE_STREAM" && errorCode !== "NOT_IN_LIBRARY" && (
                    <button
                      onClick={retry}
                      className={cn(
                        "w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl",
                        "bg-white/10 hover:bg-white/15 text-white font-bold text-base",
                        "border border-white/10 transition-all duration-200 active:scale-[0.98]",
                      )}
                    >
                      <RefreshCw className="h-5 w-5" />
                      Try Again
                    </button>
                  )}

                  <button
                    onClick={onClose}
                    className="text-xs text-white/30 hover:text-white/60 transition-colors"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

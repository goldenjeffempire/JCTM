/**
 * MediaDownloadSheet — Full download and conversion UI for JCTM
 *
 * A bottom sheet / modal that lets users:
 *   • Choose format (audio MP3/M4A, video MP4, image JPEG/PNG/WebP)
 *   • Choose quality (Low / Medium / High / Ultra)
 *   • Track conversion progress in real-time via SSE (no polling)
 *   • Instant download if file already cached/converted
 *   • Retry on failure
 *   • View file size on completion
 *
 * Works across Desktop, Android Chrome, iOS Safari.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download, Music, Image as ImageIcon, X, CheckCircle2,
  AlertCircle, Loader2, RefreshCw, HardDrive, Clock,
  Headphones, Film, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const BASE = import.meta.env.VITE_API_URL ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────

type MediaType = "youtube_audio" | "youtube_video" | "gallery_image";
type Format = "mp3" | "m4a" | "mp4" | "jpeg" | "png" | "webp";
type Quality = "low" | "medium" | "high" | "ultra";
type JobStatus = "queued" | "processing" | "ready" | "failed";

interface Job {
  jobId: string;
  status: JobStatus;
  progress: number;
  title: string | null;
  duration: number | null;
  fileSize: number | null;
  fileSizeFormatted: string | null;
  error: string | null;
  downloadUrl: string | null;
  thumbnailUrl: string | null;
  cached?: boolean;
  retryCount?: number;
}

interface FormatOption {
  value: Format;
  label: string;
  description: string;
  icon: React.ReactNode;
  tag?: string;
  types: MediaType[];
}

interface QualityOption {
  value: Quality;
  label: string;
  description: string;
  bitrate?: string;
  resolution?: string;
  tag?: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const FORMAT_OPTIONS: FormatOption[] = [
  {
    value: "mp3",
    label: "MP3 Audio",
    description: "Universal audio format, works on all devices",
    icon: <Music className="h-5 w-5" />,
    tag: "Most Compatible",
    types: ["youtube_audio", "youtube_video"],
  },
  {
    value: "m4a",
    label: "M4A Audio",
    description: "Higher quality audio, ideal for Apple devices",
    icon: <Headphones className="h-5 w-5" />,
    types: ["youtube_audio", "youtube_video"],
  },
  {
    value: "mp4",
    label: "MP4 Video",
    description: "Full video with audio, best for offline viewing",
    icon: <Film className="h-5 w-5" />,
    tag: "Larger file",
    types: ["youtube_video"],
  },
  {
    value: "jpeg",
    label: "JPEG Image",
    description: "Compressed photo, smaller file size",
    icon: <ImageIcon className="h-5 w-5" />,
    tag: "Most Compatible",
    types: ["gallery_image"],
  },
  {
    value: "png",
    label: "PNG Image",
    description: "High-quality lossless image",
    icon: <ImageIcon className="h-5 w-5" />,
    types: ["gallery_image"],
  },
  {
    value: "webp",
    label: "WebP Image",
    description: "Modern format, smaller with great quality",
    icon: <ImageIcon className="h-5 w-5" />,
    tag: "Modern",
    types: ["gallery_image"],
  },
];

const AUDIO_QUALITY_OPTIONS: QualityOption[] = [
  { value: "low",    label: "Standard",   description: "Smaller file, good quality",           bitrate: "128 kbps" },
  { value: "medium", label: "High",        description: "Balanced size and quality",            bitrate: "192 kbps", tag: "Recommended" },
  { value: "high",   label: "Very High",   description: "Large file, excellent quality",        bitrate: "256 kbps" },
  { value: "ultra",  label: "Ultra",       description: "Maximum quality, largest file",        bitrate: "320 kbps", tag: "Studio" },
];

const VIDEO_QUALITY_OPTIONS: QualityOption[] = [
  { value: "low",    label: "360p",          description: "Low data usage, mobile-friendly",   resolution: "640×360" },
  { value: "medium", label: "480p",          description: "Standard definition",               resolution: "854×480", tag: "Balanced" },
  { value: "high",   label: "720p HD",       description: "High definition",                   resolution: "1280×720", tag: "Recommended" },
  { value: "ultra",  label: "1080p Full HD", description: "Full high definition",              resolution: "1920×1080" },
];

const IMAGE_QUALITY_OPTIONS: QualityOption[] = [
  { value: "low",    label: "Web Quality",  description: "Optimised for sharing online" },
  { value: "medium", label: "Standard",     description: "Good balance of size and quality", tag: "Recommended" },
  { value: "high",   label: "High Quality", description: "Large, detailed image" },
  { value: "ultra",  label: "Maximum",      description: "Full resolution, ministry print quality" },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface MediaDownloadSheetProps {
  open: boolean;
  onClose: () => void;
  type: MediaType;
  sourceId: string;
  title?: string;
  thumbnailUrl?: string;
  duration?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function defaultFormat(type: MediaType): Format {
  if (type === "gallery_image") return "jpeg";
  return "mp3";
}

function getQualityOptions(format: Format): QualityOption[] {
  if (format === "mp4") return VIDEO_QUALITY_OPTIONS;
  if (["jpeg", "png", "webp"].includes(format)) return IMAGE_QUALITY_OPTIONS;
  return AUDIO_QUALITY_OPTIONS;
}

function typeLabel(type: MediaType): string {
  if (type === "youtube_audio") return "Audio Extract";
  if (type === "youtube_video") return "Video";
  return "Gallery Image";
}

// ─── Progress Ring ────────────────────────────────────────────────────────────

function ProgressRing({ progress, size = 88 }: { progress: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (progress / 100) * circ;
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={5} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="#a78bfa" strokeWidth={5} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.35s ease" }}
      />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MediaDownloadSheet({
  open,
  onClose,
  type,
  sourceId,
  title: propTitle,
  thumbnailUrl: propThumbnail,
  duration: propDuration,
}: MediaDownloadSheetProps) {

  const [step, setStep] = useState<"pick" | "processing" | "done" | "error">("pick");
  const [selectedFormat, setSelectedFormat] = useState<Format>(defaultFormat(type));
  const [selectedQuality, setSelectedQuality] = useState<Quality>("high");
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(false);
  const sseRef = useRef<EventSource | null>(null);
  const downloadedRef = useRef(false);

  // Adjust quality options when format changes
  const qualityOptions = getQualityOptions(selectedFormat);
  useEffect(() => { setSelectedQuality("high"); }, [selectedFormat]);

  // Reset when sheet opens/closes
  useEffect(() => {
    if (open) {
      setStep("pick");
      setSelectedFormat(defaultFormat(type));
      setSelectedQuality("high");
      setJob(null);
      setLoading(false);
      downloadedRef.current = false;
    } else {
      closeSSE();
    }
  }, [open, type]);

  // Cleanup SSE on unmount
  useEffect(() => () => closeSSE(), []);

  function closeSSE() {
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
  }

  const openSSEForJob = useCallback((jobId: string) => {
    closeSSE();
    const es = new EventSource(`${BASE}/api/media/progress/${jobId}`);
    sseRef.current = es;

    es.addEventListener("progress", (evt) => {
      try {
        const data: Job = JSON.parse((evt as MessageEvent).data);
        setJob(data);
        if (data.status === "ready") {
          setStep("done");
          closeSSE();
        } else if (data.status === "failed") {
          setStep("error");
          closeSSE();
        }
      } catch { /* ignore malformed */ }
    });

    // Server sent "done" event as a final signal (belt-and-suspenders)
    es.addEventListener("done", (evt) => {
      try {
        const { status } = JSON.parse((evt as MessageEvent).data) as { status: string };
        if (status === "ready") setStep("done");
        if (status === "failed") setStep("error");
        closeSSE();
      } catch { /* ignore */ }
    });

    // Fallback: if SSE fails to connect, poll gracefully
    let pollFallback: ReturnType<typeof setInterval> | null = null;
    es.onerror = () => {
      closeSSE();
      if (pollFallback) return;
      pollFallback = setInterval(async () => {
        try {
          const r = await fetch(`${BASE}/api/media/jobs/${jobId}`);
          if (!r.ok) return;
          const data: Job = await r.json();
          setJob(data);
          if (data.status === "ready") { setStep("done"); clearInterval(pollFallback!); }
          else if (data.status === "failed") { setStep("error"); clearInterval(pollFallback!); }
        } catch { /* silent */ }
      }, 2000);
    };
  }, []);

  async function startConversion() {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/media/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          sourceId,
          format: selectedFormat,
          quality: selectedQuality,
          title: propTitle,
          thumbnailUrl: propThumbnail,
          duration: propDuration,
          deduplicate: true,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Server error");
      }
      const data = await res.json() as Job & { cached?: boolean; message?: string };

      setJob(data);

      // Instant download: file was already cached
      if (data.status === "ready" && (data.cached || data.downloadUrl)) {
        setStep("done");
        if (data.cached) toast.success("Instant download — file already converted!", { duration: 3000 });
      } else {
        setStep("processing");
        openSSEForJob(data.jobId);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start conversion. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function triggerDownload() {
    if (!job?.downloadUrl || downloadedRef.current) return;
    downloadedRef.current = true;
    const a = document.createElement("a");
    a.href = `${BASE}${job.downloadUrl}`;
    a.download = job.title ?? "jctm_media";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("Download started! Check your Downloads folder.", { duration: 4000 });
  }

  async function retryJob() {
    closeSSE();
    setStep("pick");
    setJob(null);
    downloadedRef.current = false;
  }

  const availableFormats = FORMAT_OPTIONS.filter(f => {
    if (type === "gallery_image") return f.types.includes("gallery_image");
    if (type === "youtube_audio") return f.types.includes("youtube_audio");
    return true;
  });

  const thumbnail = job?.thumbnailUrl ?? propThumbnail;
  const displayTitle = job?.title ?? propTitle ?? typeLabel(type);
  const duration = job?.duration ?? propDuration;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            key="sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 350 }}
            className="fixed bottom-0 inset-x-0 z-50 max-w-lg mx-auto"
          >
            <div className="bg-zinc-900 border border-white/10 rounded-t-3xl shadow-2xl overflow-hidden">
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>

              {/* Header */}
              <div className="flex items-start justify-between px-5 pt-2 pb-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {thumbnail && (
                    <img
                      src={thumbnail}
                      alt=""
                      className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-white/10"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-[11px] text-primary/80 font-semibold uppercase tracking-widest mb-0.5">
                      {typeLabel(type)} Download
                    </p>
                    <p className="text-white font-semibold text-sm leading-snug truncate max-w-[200px]">
                      {displayTitle}
                    </p>
                    {duration && (
                      <p className="text-white/40 text-xs mt-0.5 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(duration)}
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

              {/* ── Step: Pick format & quality ── */}
              {step === "pick" && (
                <div className="px-5 pb-6 space-y-5">
                  {/* Format selection */}
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2.5">
                      Format
                    </p>
                    <div className="space-y-2">
                      {availableFormats.map(fmt => (
                        <button
                          key={fmt.value}
                          onClick={() => setSelectedFormat(fmt.value)}
                          className={cn(
                            "w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all",
                            selectedFormat === fmt.value
                              ? "border-primary/60 bg-primary/10"
                              : "border-white/8 bg-white/4 hover:bg-white/8",
                          )}
                        >
                          <span className={cn(
                            "flex-shrink-0 rounded-lg w-9 h-9 flex items-center justify-center",
                            selectedFormat === fmt.value ? "bg-primary/20 text-primary" : "bg-white/10 text-white/60",
                          )}>
                            {fmt.icon}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-white">{fmt.label}</span>
                              {fmt.tag && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full
                                               bg-primary/20 text-primary/90">
                                  {fmt.tag}
                                </span>
                              )}
                            </span>
                            <span className="text-xs text-white/40 block mt-0.5">{fmt.description}</span>
                          </span>
                          {selectedFormat === fmt.value && (
                            <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quality selection */}
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2.5">
                      Quality
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {qualityOptions.map(q => (
                        <button
                          key={q.value}
                          onClick={() => setSelectedQuality(q.value)}
                          className={cn(
                            "flex flex-col items-start p-3 rounded-xl border text-left transition-all",
                            selectedQuality === q.value
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

                  {/* Note about YouTube content */}
                  {type !== "gallery_image" && (
                    <p className="text-[11px] text-white/30 text-center px-2">
                      Audio/video is extracted from YouTube. For personal offline
                      ministry use only. © JCTM Warri, Nigeria.
                    </p>
                  )}

                  {/* Convert button */}
                  <button
                    onClick={startConversion}
                    disabled={loading}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl",
                      "bg-primary text-white font-bold text-base",
                      "hover:bg-primary/90 transition-all duration-200 active:scale-[0.98]",
                      "shadow-lg shadow-primary/25",
                      loading && "opacity-60 cursor-not-allowed",
                    )}
                  >
                    {loading ? (
                      <><Loader2 className="h-5 w-5 animate-spin" /> Checking…</>
                    ) : (
                      <><Zap className="h-5 w-5" /> Start Conversion</>
                    )}
                  </button>
                </div>
              )}

              {/* ── Step: Processing (SSE live progress) ── */}
              {step === "processing" && job && (
                <div className="px-5 pb-8">
                  <div className="flex flex-col items-center text-center py-4">
                    <div className="relative mb-4">
                      <ProgressRing progress={job.progress} size={88} />
                      <span className="absolute inset-0 flex items-center justify-center
                                     text-white font-bold text-lg">
                        {job.progress}%
                      </span>
                    </div>

                    <p className="text-white font-semibold text-base mb-1">
                      {job.status === "queued" ? "In queue — starting soon…" : "Converting…"}
                    </p>
                    <p className="text-white/40 text-sm">
                      {selectedFormat === "mp4"
                        ? "Video download may take 1–2 minutes"
                        : selectedFormat === "mp3" || selectedFormat === "m4a"
                        ? "Audio extraction takes 30–60 seconds"
                        : "Processing your image…"}
                    </p>

                    {/* Live progress bar */}
                    <div className="w-full mt-5 bg-white/10 rounded-full h-2 overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-primary to-violet-500 rounded-full"
                        animate={{ width: `${job.progress}%` }}
                        transition={{ duration: 0.35, ease: "easeOut" }}
                      />
                    </div>

                    <div className="flex items-center gap-4 mt-4 text-xs text-white/30">
                      <span className="flex items-center gap-1">
                        <HardDrive className="h-3 w-3" />
                        {selectedFormat.toUpperCase()} · {selectedQuality.toUpperCase()}
                      </span>
                      {duration && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(duration)}
                        </span>
                      )}
                      {job.retryCount ? (
                        <span className="text-amber-400/70">Attempt {(job.retryCount ?? 0) + 1}/3</span>
                      ) : null}
                    </div>

                    <button
                      onClick={onClose}
                      className="mt-5 text-xs text-white/30 hover:text-white/60 transition-colors"
                    >
                      Close — conversion continues in background
                    </button>
                  </div>
                </div>
              )}

              {/* ── Step: Done ── */}
              {step === "done" && job && (
                <div className="px-5 pb-8">
                  <div className="flex flex-col items-center text-center py-4">
                    {job.cached ? (
                      <div className="w-20 h-20 rounded-full bg-amber-500/15 flex items-center
                                     justify-center mb-4 ring-2 ring-amber-500/30">
                        <Zap className="h-10 w-10 text-amber-400" />
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-emerald-500/15 flex items-center
                                     justify-center mb-4 ring-2 ring-emerald-500/30">
                        <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                      </div>
                    )}
                    <p className="text-white font-bold text-lg mb-1">
                      {job.cached ? "Instant Download Ready!" : "Ready to Download"}
                    </p>
                    {job.cached && (
                      <p className="text-amber-400/80 text-xs mb-1 font-medium">
                        Already converted — no waiting!
                      </p>
                    )}
                    <p className="text-white/40 text-sm mb-1 max-w-[260px] truncate">
                      {job.title ?? displayTitle}
                    </p>
                    {job.fileSizeFormatted && (
                      <span className="text-xs text-white/30 flex items-center gap-1">
                        <HardDrive className="h-3 w-3" />
                        {job.fileSizeFormatted} · {selectedFormat.toUpperCase()} · {selectedQuality.toUpperCase()}
                      </span>
                    )}

                    <button
                      onClick={triggerDownload}
                      className={cn(
                        "mt-6 w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl",
                        "text-white font-bold text-base",
                        "transition-all duration-200 active:scale-[0.98] shadow-lg",
                        job.cached
                          ? "bg-amber-500 hover:bg-amber-600 shadow-amber-500/25"
                          : "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/25",
                      )}
                    >
                      <Download className="h-5 w-5" />
                      Save to Device
                    </button>

                    <p className="mt-3 text-[11px] text-white/25">
                      File available for 24 hours. Re-convert anytime.
                    </p>

                    <button
                      onClick={retryJob}
                      className="mt-2 text-xs text-white/30 hover:text-white/60 transition-colors
                                 flex items-center gap-1"
                    >
                      <RefreshCw className="h-3 w-3" /> Convert in a different format
                    </button>
                  </div>
                </div>
              )}

              {/* ── Step: Error ── */}
              {step === "error" && (
                <div className="px-5 pb-8">
                  <div className="flex flex-col items-center text-center py-4">
                    <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center
                                   justify-center mb-4 ring-2 ring-red-500/20">
                      <AlertCircle className="h-10 w-10 text-red-400" />
                    </div>
                    <p className="text-white font-bold text-lg mb-1">Conversion Failed</p>
                    {job?.error && (
                      <p className="text-white/40 text-xs mb-4 max-w-[260px] break-words">
                        {job.error.slice(0, 140)}
                      </p>
                    )}
                    {job?.retryCount !== undefined && job.retryCount > 0 && (
                      <p className="text-amber-400/60 text-[11px] mb-3">
                        Failed after {job.retryCount + 1} attempt{job.retryCount > 0 ? "s" : ""}
                      </p>
                    )}
                    <button
                      onClick={retryJob}
                      className="mt-2 w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl
                                 bg-white/10 hover:bg-white/15 text-white font-bold text-base
                                 transition-all duration-200 active:scale-[0.98]"
                    >
                      <RefreshCw className="h-5 w-5" />
                      Try Again
                    </button>
                    <p className="mt-3 text-[11px] text-white/25">
                      YouTube content may be unavailable or geo-restricted.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Upload, User, MapPin, Mail, Video, CheckCircle2, AlertCircle,
  X, Play, Loader2, ChevronRight, ChevronLeft, Film, Camera,
  Shield, Heart, Clock, Sparkles, ArrowDown, Zap, FileVideo,
  RotateCcw, Check, Gauge, Star, Globe, Users, Trophy,
  Flame, BookOpen, ChevronDown,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const CHUNK_SIZE = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 5 * 1024 * 1024 * 1024;
const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
const ALLOWED_VIDEO_TYPES = ["video/mp4","video/quicktime","video/avi","video/webm","video/x-msvideo","video/x-matroska"];

// ── Utilities ──────────────────────────────────────────────────────────────────
function formatBytes(b: number): string {
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(1)} GB`;
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024).toFixed(0)} KB`;
}
function formatSpeed(bps: number): string {
  if (bps >= 1024 ** 2) return `${(bps / 1024 ** 2).toFixed(1)} MB/s`;
  return `${(bps / 1024).toFixed(0)} KB/s`;
}
function formatEta(sec: number): string {
  if (!isFinite(sec) || sec > 86400) return "";
  if (sec < 60) return `${Math.round(sec)}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface UploadState {
  progress: number;
  status: "idle" | "uploading" | "processing" | "done" | "error";
  message: string;
  objectPath: string | null;
  filename: string | null;
  fileSize: number | null;
  speed: number | null;
  eta: number | null;
}
const IDLE_UPLOAD: UploadState = {
  progress: 0, status: "idle", message: "", objectPath: null,
  filename: null, fileSize: null, speed: null, eta: null,
};

// ── Spring preset ──────────────────────────────────────────────────────────────
const SPRING = { type: "spring" as const, stiffness: 280, damping: 22 };

// ── Animated background orbs ──────────────────────────────────────────────────
function HeroOrbs({ isDark }: { isDark: boolean }) {
  const prefersReduced = useReducedMotion();
  if (prefersReduced) return null;
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <motion.div
        animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.7, 0.5] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className={`absolute -top-40 -right-32 w-[700px] h-[700px] rounded-full blur-[120px] ${isDark ? "bg-violet-700/20" : "bg-violet-300/40"}`}
      />
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.6, 0.4] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className={`absolute -bottom-20 -left-40 w-[600px] h-[600px] rounded-full blur-[100px] ${isDark ? "bg-purple-800/20" : "bg-purple-200/50"}`}
      />
      <motion.div
        animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 4 }}
        className={`absolute top-1/3 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full blur-[80px] ${isDark ? "bg-fuchsia-700/18" : "bg-fuchsia-100/55"}`}
      />
    </div>
  );
}

// ── Step data ──────────────────────────────────────────────────────────────────
const STEPS = [
  { label: "Your Info",  sub: "Tell us about yourself",    icon: User     },
  { label: "Video",      sub: "Upload your testimony",     icon: FileVideo },
  { label: "Consent",    sub: "Review & confirm",          icon: Shield   },
];

// ── Step Indicator ─────────────────────────────────────────────────────────────
function StepIndicator({ current }: { current: number }) {
  return (
    <nav aria-label="Form progress" className="mb-10">
      <ol className="flex items-center justify-center gap-0">
        {STEPS.map((s, i) => {
          const done   = current > i + 1;
          const active = current === i + 1;
          const Icon   = s.icon;
          return (
            <li key={s.label} className="flex items-center">
              <div className="flex flex-col items-center gap-2">
                <motion.div
                  animate={active ? { scale: 1.12, y: -2 } : { scale: 1, y: 0 }}
                  transition={SPRING}
                  className="relative"
                >
                  {/* Glow ring on active */}
                  {active && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="absolute inset-0 rounded-2xl bg-violet-500/25 blur-md -z-10 scale-125"
                    />
                  )}
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                      done
                        ? "bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30"
                        : active
                        ? "bg-gradient-to-br from-violet-600 via-purple-500 to-fuchsia-500 text-white shadow-xl shadow-violet-500/40"
                        : "dark:bg-white/[0.06] bg-gray-100 dark:text-white/25 text-gray-400 dark:border-white/8 border border-gray-200"
                    }`}
                  >
                    {done ? <Check className="w-4 h-4 stroke-[2.5]" /> : <Icon className="w-4 h-4" />}
                  </div>
                </motion.div>
                <div className="text-center hidden sm:block">
                  <p className={`text-[11px] font-semibold leading-tight transition-colors ${
                    active ? "text-violet-500 dark:text-violet-400" :
                    done   ? "text-emerald-600 dark:text-emerald-400" :
                             "text-gray-400 dark:text-white/20"
                  }`}>{s.label}</p>
                  <p className={`text-[9px] leading-tight mt-0.5 hidden sm:block transition-colors ${
                    active ? "dark:text-violet-400/70 text-violet-400" : "dark:text-white/15 text-gray-300"
                  }`}>{s.sub}</p>
                </div>
              </div>
              {i < STEPS.length - 1 && (
                <div className="w-10 sm:w-20 h-px mx-3 dark:bg-white/8 bg-gray-200 rounded-full overflow-hidden mb-7 sm:mb-9">
                  <motion.div
                    animate={{ width: current > i + 1 ? "100%" : "0%" }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-violet-500 to-emerald-400"
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ── Photo Upload ───────────────────────────────────────────────────────────────
function PhotoUpload({
  value, onChange,
}: {
  value: { objectPath: string | null; previewUrl: string | null };
  onChange: (v: { objectPath: string | null; previewUrl: string | null }) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file."); return; }
    if (file.size > MAX_PHOTO_BYTES) { toast.error("Photo must be under 20 MB."); return; }
    const previewUrl = URL.createObjectURL(file);
    onChange({ objectPath: null, previewUrl });
    setUploading(true);
    try {
      const res = await fetch(`${BASE}/api/experiences/upload/photo`, {
        method: "POST", headers: { "Content-Type": file.type }, body: file,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Upload failed"); }
      const { objectPath } = await res.json();
      onChange({ objectPath, previewUrl });
      toast.success("Photo uploaded!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Photo upload failed.");
      onChange({ objectPath: null, previewUrl: null });
    } finally { setUploading(false); }
  }, [onChange]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div className="flex flex-col items-center gap-4">
      <motion.div
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload profile photo — click or drag and drop"
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        className={`relative w-32 h-32 rounded-full cursor-pointer overflow-hidden flex items-center justify-center transition-all duration-300 ${
          isDragging
            ? "ring-4 ring-violet-500 ring-offset-4 dark:ring-offset-[#080520] ring-offset-white shadow-2xl shadow-violet-500/30"
            : value.previewUrl
            ? "ring-3 ring-violet-400/60 ring-offset-3 dark:ring-offset-[#080520] ring-offset-white shadow-xl shadow-violet-500/20"
            : "ring-2 dark:ring-white/12 ring-gray-200 hover:ring-violet-400/60 dark:hover:ring-violet-500/40 hover:shadow-lg hover:shadow-violet-500/10"
        }`}
      >
        {value.previewUrl ? (
          <img src={value.previewUrl} alt="Profile preview" className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full flex flex-col items-center justify-center gap-2 transition-colors ${isDragging ? "dark:bg-violet-900/50 bg-violet-50" : "dark:bg-white/[0.04] bg-gray-50"}`}>
            <Camera className={`w-9 h-9 transition-colors ${isDragging ? "text-violet-500" : "dark:text-white/25 text-gray-300"}`} />
            <span className="text-[9px] font-bold uppercase tracking-[0.15em] dark:text-white/20 text-gray-400 text-center px-2">Add Photo</span>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
            <Loader2 className="w-7 h-7 text-white animate-spin" />
          </div>
        )}
        {value.previewUrl && !uploading && (
          <div className="absolute inset-0 bg-black/0 hover:bg-black/50 transition-all duration-200 flex flex-col items-center justify-center gap-1 group">
            <Camera className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-white opacity-0 group-hover:opacity-100 transition-opacity">Change</span>
          </div>
        )}
      </motion.div>

      <input ref={inputRef} type="file" accept="image/*" className="sr-only" aria-hidden="true"
        onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />

      <div className="text-center space-y-0.5">
        {value.objectPath ? (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            className="text-xs text-emerald-500 font-semibold flex items-center gap-1.5 justify-center">
            <CheckCircle2 className="w-3.5 h-3.5" /> Photo ready
          </motion.p>
        ) : (
          <>
            <p className="text-xs font-medium dark:text-white/35 text-gray-500">
              {value.previewUrl ? "Uploading…" : "Profile photo (optional)"}
            </p>
            <p className="text-[10px] dark:text-white/20 text-gray-400">JPEG · PNG · WebP · Max 20 MB</p>
          </>
        )}
      </div>
    </div>
  );
}

// ── Video Upload ───────────────────────────────────────────────────────────────
function VideoUpload({ value, onChange }: { value: UploadState; onChange: (v: UploadState) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);
  const speedSamples = useRef<number[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    if (!ALLOWED_VIDEO_TYPES.includes(file.type) && !file.name.match(/\.(mp4|mov|avi|webm|mkv)$/i)) {
      toast.error("Only MP4, MOV, AVI, WebM, MKV videos are accepted."); return;
    }
    if (file.size > MAX_VIDEO_BYTES) { toast.error("Video exceeds the 5 GB limit."); return; }

    abortRef.current = false;
    speedSamples.current = [];
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    onChange({ ...IDLE_UPLOAD, status: "uploading", message: "Initialising upload…", filename: file.name, fileSize: file.size });

    let sessionId: string;
    try {
      const r = await fetch(`${BASE}/api/experiences/upload/init`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type || "video/mp4", filename: file.name, totalChunks, totalSize: file.size }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "Init failed"); }
      sessionId = (await r.json()).sessionId;
    } catch (err) {
      onChange({ ...IDLE_UPLOAD, status: "error", message: err instanceof Error ? err.message : "Upload failed", filename: file.name, fileSize: file.size });
      return;
    }

    for (let i = 0; i < totalChunks; i++) {
      if (abortRef.current) { onChange(IDLE_UPLOAD); return; }
      const start = i * CHUNK_SIZE;
      const chunk = file.slice(start, start + CHUNK_SIZE);
      const progress = Math.round((i / totalChunks) * 88);
      const chunkStart = performance.now();

      let retries = 3;
      while (retries > 0) {
        try {
          const r = await fetch(`${BASE}/api/experiences/upload/chunk`, {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream", "X-Session-Id": sessionId, "X-Chunk-Index": String(i) },
            body: chunk,
          });
          if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "Chunk failed"); }
          break;
        } catch (err) {
          retries--;
          if (retries === 0) {
            onChange({ ...IDLE_UPLOAD, status: "error", message: `Upload failed at chunk ${i + 1}. Please try again.`, filename: file.name, fileSize: file.size });
            return;
          }
          await new Promise((r) => setTimeout(r, 1500));
        }
      }

      const elapsed = (performance.now() - chunkStart) / 1000;
      const chunkSpeed = chunk.size / Math.max(elapsed, 0.01);
      speedSamples.current.push(chunkSpeed);
      if (speedSamples.current.length > 6) speedSamples.current.shift();
      const avgSpeed = speedSamples.current.reduce((a, b) => a + b, 0) / speedSamples.current.length;
      const bytesRemaining = Math.max(0, file.size - (i + 1) * CHUNK_SIZE);
      const eta = bytesRemaining / Math.max(avgSpeed, 1);

      onChange({ progress, status: "uploading", message: `Chunk ${i + 1} of ${totalChunks}`, filename: file.name, fileSize: file.size, objectPath: null, speed: avgSpeed, eta });
    }

    onChange({ progress: 95, status: "processing", message: "Processing video…", filename: file.name, fileSize: file.size, objectPath: null, speed: null, eta: null });
    try {
      const r = await fetch(`${BASE}/api/experiences/upload/finalize`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "Finalize failed"); }
      const { objectPath } = await r.json();
      onChange({ progress: 100, status: "done", message: "Upload complete!", objectPath, filename: file.name, fileSize: file.size, speed: null, eta: null });
      toast.success("Video uploaded successfully!");
    } catch (err) {
      onChange({ progress: 95, status: "error", message: err instanceof Error ? err.message : "Finalize failed", objectPath: null, filename: file.name, fileSize: file.size, speed: null, eta: null });
    }
  }, [onChange]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const isActive = value.status === "uploading" || value.status === "processing";
  const isIdle = value.status === "idle" || value.status === "error";

  return (
    <div>
      <input ref={inputRef} type="file" accept="video/*,.mp4,.mov,.avi,.webm,.mkv" className="sr-only"
        onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />

      <AnimatePresence mode="wait">
        {isIdle ? (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false); }}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            role="button" tabIndex={0} aria-label="Upload video — click or drag and drop"
            onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
            className={`relative border-2 rounded-3xl py-12 px-8 cursor-pointer transition-all duration-300 text-center outline-none group
              focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#080520] focus-visible:ring-offset-white ${
              isDragging
                ? "border-violet-500 dark:bg-violet-950/50 bg-violet-50 scale-[1.015] shadow-2xl shadow-violet-500/20"
                : value.status === "error"
                ? "border-red-500/50 dark:bg-red-950/10 bg-red-50/40 hover:border-red-400"
                : "border-dashed dark:border-white/12 border-gray-200 dark:hover:border-violet-500/40 hover:border-violet-400/60 dark:bg-white/[0.018] bg-gray-50/70 hover:dark:bg-violet-950/20 hover:bg-violet-50/40 hover:shadow-lg hover:shadow-violet-500/5"
            }`}
          >
            {/* Animated drag-over particles */}
            {isDragging && (
              <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none" aria-hidden="true">
                {[...Array(6)].map((_, i) => (
                  <motion.div key={i}
                    initial={{ opacity: 0, scale: 0, x: `${15 + i * 14}%`, y: "110%" }}
                    animate={{ opacity: [0, 0.6, 0], scale: [0.3, 1, 0.3], y: "-20%" }}
                    transition={{ duration: 1.5, delay: i * 0.1, repeat: Infinity }}
                    className="absolute w-2 h-2 rounded-full bg-violet-400"
                  />
                ))}
              </div>
            )}

            <motion.div
              animate={isDragging ? { scale: 1.2, y: -6, rotate: 5 } : { scale: 1, y: 0, rotate: 0 }}
              transition={{ duration: 0.25 }}
              className={`w-20 h-20 rounded-3xl mx-auto mb-5 flex items-center justify-center transition-all duration-300 ${
                isDragging
                  ? "bg-gradient-to-br from-violet-600 to-purple-500 shadow-2xl shadow-violet-500/50"
                  : "dark:bg-violet-900/25 bg-white shadow-sm group-hover:shadow-lg group-hover:dark:bg-violet-800/35 group-hover:bg-violet-50 dark:border dark:border-violet-700/20 transition-all"
              }`}
            >
              {isDragging
                ? <Upload className="w-9 h-9 text-white" />
                : <Film className={`w-9 h-9 transition-colors ${value.status === "error" ? "text-red-400" : "dark:text-white/30 text-gray-300 group-hover:text-violet-500 dark:group-hover:text-violet-400"}`} />
              }
            </motion.div>

            {isDragging ? (
              <div className="space-y-1">
                <p className="font-bold text-violet-500 text-xl">Release to upload</p>
                <p className="text-sm text-violet-400/70">Your video will begin uploading</p>
              </div>
            ) : (
              <>
                <p className="font-bold dark:text-white text-gray-900 text-lg group-hover:text-violet-600 dark:group-hover:text-violet-300 transition-colors">
                  Drag & drop your video here
                </p>
                <p className="text-sm dark:text-white/35 text-gray-500 mt-1.5">
                  or{" "}
                  <span className="text-violet-500 font-semibold underline underline-offset-2 decoration-violet-400/50">click to browse files</span>
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-5">
                  {["MP4", "MOV", "AVI", "WebM", "MKV"].map((fmt) => (
                    <span key={fmt} className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide dark:bg-white/[0.06] bg-white dark:text-white/35 text-gray-500 border dark:border-white/8 border-gray-200 shadow-sm">
                      {fmt}
                    </span>
                  ))}
                </div>
                <p className="text-xs dark:text-white/20 text-gray-400 mt-3 flex items-center justify-center gap-1.5">
                  <Shield className="w-3 h-3" /> Secure encrypted upload · Max 5 GB
                </p>
              </>
            )}

            {value.status === "error" && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                className="mt-4 flex items-center justify-center gap-2 text-sm text-red-400 font-medium bg-red-500/10 rounded-xl py-2 px-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {value.message}
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="progress"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className={`rounded-3xl border p-6 space-y-5 transition-all ${
              value.status === "done"
                ? "dark:border-emerald-500/30 border-emerald-200 dark:bg-emerald-950/20 bg-emerald-50/50 shadow-lg shadow-emerald-500/5"
                : "dark:border-white/10 border-gray-200 dark:bg-white/[0.03] bg-white shadow-md"
            }`}
          >
            {/* File info row */}
            <div className="flex items-center gap-3.5">
              <motion.div
                animate={value.status === "done" ? { scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 0.4 }}
                className={`w-13 h-13 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                  value.status === "done"    ? "bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/30" :
                  value.status === "error"   ? "bg-red-500/15 dark:bg-red-500/20" :
                  value.status === "processing" ? "bg-gradient-to-br from-violet-600 to-purple-500 shadow-lg shadow-violet-500/30" :
                  "dark:bg-violet-900/50 bg-violet-100"
                }`}
              >
                {value.status === "done"       ? <CheckCircle2 className="w-6 h-6 text-white" /> :
                 value.status === "error"      ? <AlertCircle className="w-6 h-6 text-red-400" /> :
                 value.status === "processing" ? <Zap className="w-6 h-6 text-white animate-pulse" /> :
                 <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />}
              </motion.div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold dark:text-white text-gray-900 truncate">{value.filename}</p>
                <p className="text-xs dark:text-white/35 text-gray-500 mt-0.5">
                  {value.fileSize ? formatBytes(value.fileSize) : ""}
                  {value.message ? ` · ${value.message}` : ""}
                </p>
              </div>
              {isActive && (
                <button
                  onClick={(e) => { e.stopPropagation(); abortRef.current = true; onChange(IDLE_UPLOAD); }}
                  aria-label="Cancel upload"
                  className="w-9 h-9 rounded-xl flex items-center justify-center dark:text-white/25 text-gray-400 dark:hover:bg-white/10 hover:bg-gray-100 hover:text-red-500 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex justify-between items-center mb-2.5">
                <span className="text-xs font-semibold dark:text-white/45 text-gray-500">
                  {value.status === "done" ? "Upload complete" :
                   value.status === "processing" ? "Finalising…" : "Uploading…"}
                </span>
                <motion.span
                  key={value.progress}
                  initial={{ scale: 1.1 }}
                  animate={{ scale: 1 }}
                  className={`text-sm font-black tabular-nums ${value.status === "done" ? "text-emerald-500" : "dark:text-violet-400 text-violet-600"}`}
                >
                  {value.progress}%
                </motion.span>
              </div>

              {/* Track */}
              <div className="h-2.5 rounded-full dark:bg-white/[0.06] bg-gray-100 overflow-hidden">
                <motion.div
                  animate={{ width: `${value.progress}%` }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className={`h-full rounded-full relative overflow-hidden ${
                    value.status === "done"
                      ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                      : value.status === "processing"
                      ? "bg-gradient-to-r from-violet-600 via-purple-500 to-fuchsia-500"
                      : "bg-gradient-to-r from-violet-600 to-purple-500"
                  }`}
                >
                  {/* Shimmer */}
                  {isActive && (
                    <motion.div
                      animate={{ x: ["-100%", "300%"] }}
                      transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"
                    />
                  )}
                </motion.div>
              </div>
            </div>

            {/* Speed & ETA */}
            {value.status === "uploading" && (value.speed !== null || value.eta !== null) && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-2 gap-2.5">
                {value.speed !== null && (
                  <div className="flex items-center gap-2.5 rounded-2xl dark:bg-white/[0.04] bg-gray-50 px-3.5 py-2.5 border dark:border-white/6 border-gray-100">
                    <div className="w-7 h-7 rounded-xl bg-fuchsia-500/15 flex items-center justify-center flex-shrink-0">
                      <Gauge className="w-3.5 h-3.5 text-fuchsia-500" />
                    </div>
                    <div>
                      <p className="text-[9px] dark:text-white/25 text-gray-400 uppercase tracking-[0.1em] font-bold">Speed</p>
                      <p className="text-xs font-black dark:text-white text-gray-800 tabular-nums">{formatSpeed(value.speed)}</p>
                    </div>
                  </div>
                )}
                {value.eta !== null && (
                  <div className="flex items-center gap-2.5 rounded-2xl dark:bg-white/[0.04] bg-gray-50 px-3.5 py-2.5 border dark:border-white/6 border-gray-100">
                    <div className="w-7 h-7 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-[9px] dark:text-white/25 text-gray-400 uppercase tracking-[0.1em] font-bold">ETA</p>
                      <p className="text-xs font-black dark:text-white text-gray-800 tabular-nums">{formatEta(value.eta)}</p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {value.status === "done" && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                whileHover={{ scale: 1.02 }}
                onClick={() => onChange(IDLE_UPLOAD)}
                className="flex items-center gap-1.5 text-xs dark:text-white/30 text-gray-400 dark:hover:text-white/60 hover:text-gray-700 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Replace video
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Field wrapper ──────────────────────────────────────────────────────────────
function Field({ id, label, required, error, icon: Icon, children }: {
  id: string; label: string; required?: boolean; error?: string;
  icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-semibold dark:text-white/75 text-gray-700 flex items-center gap-1">
        {label}
        {required && <span className="text-violet-400 ml-0.5 text-xs">*</span>}
      </Label>
      <div className={Icon ? "relative" : undefined}>
        {Icon && (
          <Icon className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-colors ${
            error ? "text-red-400" : "dark:text-violet-400/70 text-violet-500"
          }`} />
        )}
        {children}
      </div>
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -6, height: 0 }}
            className="text-xs text-red-400 font-medium flex items-center gap-1.5 overflow-hidden"
            role="alert"
            aria-live="polite"
          >
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function ThemedInput({ hasIcon, error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { hasIcon?: boolean; error?: boolean }) {
  return (
    <Input
      {...props}
      className={`h-12 rounded-xl border-[1.5px] transition-all duration-200
        dark:bg-white/[0.04] bg-white
        dark:text-white text-gray-900
        dark:placeholder:text-white/20 placeholder:text-gray-400
        focus:ring-0 focus:outline-none
        ${hasIcon ? "pl-10" : ""}
        ${error
          ? "dark:border-red-500/60 border-red-400 focus:dark:border-red-500 focus:border-red-500"
          : "dark:border-white/10 border-gray-200 hover:dark:border-white/20 hover:border-gray-300 focus:dark:border-violet-500 focus:border-violet-500 dark:focus:bg-violet-950/20 focus:bg-violet-50/50 focus:shadow-sm focus:shadow-violet-500/10"
        }
        ${props.className ?? ""}`}
    />
  );
}

// ── Success Screen ─────────────────────────────────────────────────────────────
function SuccessScreen({ onAgain }: { onAgain: () => void }) {
  return (
    <div className="relative min-h-[85vh] flex items-center justify-center px-4 py-20 overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1.5, opacity: 0.6 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-violet-500/10 blur-[100px]"
        />
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.4 }}
          transition={{ duration: 1.6, ease: "easeOut", delay: 0.3 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-emerald-500/15 blur-[60px]"
        />
      </div>

      <div className="relative max-w-lg w-full text-center z-10">
        {/* Expanding rings + icon */}
        <div className="relative flex items-center justify-center h-64 mb-2">
          {([
            [100, "border-violet-500"],
            [150, "border-fuchsia-500"],
            [200, "border-purple-400"],
            [260, "border-indigo-400"],
          ] as [number, string][]).map(([size, borderColor], i) => (
            <motion.div
              key={size}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: [0, 0.2, 0], scale: [0.5, 1.1, 1.7] }}
              transition={{ delay: 0.15 + i * 0.18, duration: 2.2, repeat: Infinity, repeatDelay: 1.8, ease: "easeOut" }}
              style={{ width: size, height: size }}
              className={`absolute rounded-full border-[1.5px] ${borderColor}`}
            />
          ))}
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, ...SPRING }}
            className="relative z-10"
          >
            {/* Glow */}
            <div className="absolute inset-0 rounded-[28px] bg-violet-500/40 blur-2xl scale-150" />
            <div className="relative w-28 h-28 rounded-[28px] bg-gradient-to-br from-violet-600 via-purple-500 to-fuchsia-500 flex items-center justify-center shadow-2xl shadow-violet-500/50">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, ...SPRING }}
              >
                <CheckCircle2 className="w-14 h-14 text-white drop-shadow-lg" />
              </motion.div>
            </div>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.5 }}
          className="space-y-4">
          <p className="text-5xl">🙌</p>
          <h1 className="text-4xl sm:text-5xl font-black dark:text-white text-gray-900 leading-tight">
            Praise the Lord!
          </h1>
          <p className="dark:text-white/60 text-gray-600 text-lg leading-relaxed max-w-md mx-auto">
            Your experience has been received and is now in queue for review. Our team will be in touch within <strong className="dark:text-white/85 text-gray-800">3–5 business days</strong>.
          </p>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.65 }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-violet-500/12 border border-violet-500/25 text-sm font-semibold dark:text-violet-300 text-violet-700"
          >
            <Flame className="w-4 h-4 text-orange-400" />
            Your story will inspire thousands around the world
          </motion.div>
        </motion.div>

        {/* What happens next */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mt-8 dark:bg-white/[0.03] bg-gray-50 rounded-3xl border dark:border-white/8 border-gray-100 p-5 text-left"
        >
          <p className="text-xs font-bold uppercase tracking-[0.15em] dark:text-white/35 text-gray-400 mb-3 text-center">What happens next</p>
          <div className="space-y-3">
            {[
              { icon: BookOpen,    step: "Review",    desc: "Our ministry team carefully reviews your submission",   iconBg: "bg-violet-500/15",  iconColor: "text-violet-500"  },
              { icon: CheckCircle2,step: "Approval",  desc: "You receive an email once your video is approved",      iconBg: "bg-amber-500/15",   iconColor: "text-amber-500"   },
              { icon: Globe,       step: "Published", desc: "Your story goes live on JCTM platforms worldwide",      iconBg: "bg-emerald-500/15", iconColor: "text-emerald-500" },
            ].map(({ icon: Icon, step, desc, iconBg, iconColor }, i) => (
              <div key={step} className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${iconBg}`}>
                  <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold dark:text-white text-gray-900">{step}</p>
                  <p className="text-xs dark:text-white/35 text-gray-500 leading-relaxed">{desc}</p>
                </div>
                {i < 2 && <div className="hidden" />}
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85 }}
          className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
          <Button
            onClick={() => { window.location.href = `${BASE}/`; }}
            className="h-12 px-7 font-bold text-sm bg-gradient-to-r from-violet-600 to-purple-500 hover:from-violet-500 hover:to-purple-400 text-white shadow-xl shadow-violet-500/25 hover:shadow-violet-500/40 rounded-2xl transition-all hover:scale-[1.02]"
          >
            <Heart className="w-4 h-4 mr-2 fill-white" /> Return to Home
          </Button>
          <Button variant="outline" onClick={onAgain}
            className="h-12 px-7 font-semibold text-sm dark:border-white/12 border-gray-200 dark:text-white/65 text-gray-700 dark:hover:bg-white/[0.06] hover:bg-gray-50 rounded-2xl">
            Share Another Experience
          </Button>
        </motion.div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function ShareExperience() {
  const { isDark } = useTheme();
  const formRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [fullName, setFullName]   = useState("");
  const [email, setEmail]         = useState("");
  const [location, setLocation]   = useState("");
  const [photo, setPhoto]         = useState<{ objectPath: string | null; previewUrl: string | null }>({ objectPath: null, previewUrl: null });
  const [video, setVideo]         = useState<UploadState>(IDLE_UPLOAD);
  const [consent, setConsent]     = useState(false);
  const [website, setWebsite]     = useState("");

  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (!fullName.trim() || fullName.trim().length < 2) e.fullName = "Please enter your full name (at least 2 characters).";
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Please enter a valid email address.";
    if (!location.trim()) e.location = "Please enter your city and country.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    if (video.status !== "done" || !video.objectPath) {
      setErrors({ video: "Please upload your video before continuing." }); return false;
    }
    setErrors({}); return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) { setStep(2); setTimeout(scrollToForm, 80); }
    else if (step === 2 && validateStep2()) { setStep(3); setTimeout(scrollToForm, 80); }
  };

  const handleBack = () => {
    setErrors({});
    setStep((s) => Math.max(1, s - 1));
    setTimeout(scrollToForm, 80);
  };

  const handleSubmit = async () => {
    if (!consent) { setErrors({ consent: "You must agree to the consent terms to submit." }); return; }
    setErrors({});
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE}/api/experiences`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(), email: email.trim(), location: location.trim(),
          photoPath: photo.objectPath, videoPath: video.objectPath, videoFilename: video.filename,
          consent: true, website,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Submission failed"); }
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed. Please try again.");
    } finally { setSubmitting(false); }
  };

  const resetForm = () => {
    setSubmitted(false); setStep(1); setFullName(""); setEmail(""); setLocation("");
    setPhoto({ objectPath: null, previewUrl: null }); setVideo(IDLE_UPLOAD); setConsent(false); setErrors({});
  };

  return (
    <Layout>
      <SEO
        title="Share Your Experience | Jesus Christ Temple Ministry"
        description="Share how God has moved in your life through JCTM. Submit your video testimony and inspire thousands around the world."
      />

      <AnimatePresence mode="wait">
        {submitted ? (
          <motion.div key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className={`min-h-screen transition-colors duration-500 ${isDark ? "bg-[#060415]" : "bg-white"}`}>
            <SuccessScreen onAgain={resetForm} />
          </motion.div>
        ) : (
          <motion.div key="form-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className={`transition-colors duration-500 ${isDark ? "bg-[#060415]" : "bg-white"}`}>

            {/* ── Hero ──────────────────────────────────────────────────────── */}
            <section className="relative min-h-[88vh] flex flex-col items-center justify-center px-4 pt-20 pb-24 overflow-hidden">
              <HeroOrbs isDark={isDark} />

              {/* Large decorative cross */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none" aria-hidden="true">
                <svg viewBox="0 0 200 200" className={`w-[700px] h-[700px] opacity-[0.022] ${isDark ? "text-white" : "text-violet-900"}`} fill="currentColor">
                  <rect x="85" y="18" width="30" height="164" rx="5" />
                  <rect x="18" y="73" width="164" height="30" rx="5" />
                </svg>
              </div>

              {/* Grain texture overlay */}
              <div className="absolute inset-0 opacity-[0.015] pointer-events-none"
                style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")" }}
              />

              <div className="relative max-w-4xl mx-auto text-center z-10 space-y-8">
                {/* Badge */}
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                  <span className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold border ${
                    isDark
                      ? "bg-violet-500/10 border-violet-500/25 text-violet-300"
                      : "bg-violet-100 border-violet-200 text-violet-700 shadow-sm"
                  }`}>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    Your Story Has the Power to Transform Lives
                  </span>
                </motion.div>

                {/* Headline */}
                <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
                  <h1 className="text-5xl sm:text-6xl md:text-7xl font-black leading-[1.05] tracking-tight dark:text-white text-gray-900">
                    Share Your{" "}
                    <span className="relative inline-block">
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 via-purple-500 to-fuchsia-500">
                        Experience
                      </span>
                      {/* Underline decoration */}
                      <motion.div
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ delay: 0.7, duration: 0.5, ease: "easeOut" }}
                        className="absolute -bottom-1 left-0 right-0 h-[3px] rounded-full bg-gradient-to-r from-violet-600 via-purple-500 to-fuchsia-500 origin-left"
                      />
                    </span>
                    {" "}with JCTM
                  </h1>
                </motion.div>

                {/* Subhead */}
                <motion.p
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.25 }}
                  className="text-lg sm:text-xl dark:text-white/50 text-gray-600 max-w-2xl mx-auto leading-relaxed"
                >
                  Has God moved in your life through this ministry? Your testimony has the power to ignite faith,
                  bring healing, and inspire thousands across the globe. Share it and let your story glorify Him.
                </motion.p>

                {/* Scripture verse */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.32 }}
                  className="flex items-center justify-center gap-3 py-1"
                >
                  <span className="h-px w-8 bg-gradient-to-r from-transparent to-violet-400/50 dark:to-violet-400/40 rounded-full" />
                  <p className="text-sm italic dark:text-white/40 text-gray-500 text-center">
                    "They triumphed over him by the blood of the Lamb{" "}
                    <span className="dark:text-white/60 text-gray-700 not-italic font-medium">
                      and by the word of their testimony.
                    </span>"
                    {" "}<span className="not-italic text-xs font-semibold dark:text-violet-400/80 text-violet-600 tracking-wide">— Rev 12:11</span>
                  </p>
                  <span className="h-px w-8 bg-gradient-to-l from-transparent to-violet-400/50 dark:to-violet-400/40 rounded-full" />
                </motion.div>

                {/* CTA buttons */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.42 }}
                  className="flex flex-col sm:flex-row items-center justify-center gap-4"
                >
                  <motion.button
                    whileHover={{ scale: 1.04, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={scrollToForm}
                    className="group relative h-14 px-9 text-base font-bold rounded-2xl text-white overflow-hidden shadow-2xl shadow-violet-500/30 hover:shadow-violet-500/50 transition-all"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-purple-500 to-fuchsia-500 transition-all" />
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-500 via-purple-400 to-fuchsia-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="relative flex items-center gap-2.5">
                      <Video className="w-5 h-5" />
                      Share Your Experience
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </motion.button>

                  <motion.button
                    whileHover={{ y: 2 }}
                    animate={{ y: [0, 4, 0] }}
                    transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                    onClick={scrollToForm}
                    className="flex items-center gap-2 text-sm dark:text-white/35 text-gray-500 dark:hover:text-white/65 hover:text-gray-700 transition-colors"
                  >
                    <ArrowDown className="w-4 h-4" /> Scroll to form
                  </motion.button>
                </motion.div>

              </div>
            </section>

            {/* ── Form ──────────────────────────────────────────────────────── */}
            <section
              ref={formRef}
              className="relative px-4 pb-32 scroll-mt-16"
              aria-label="Share your experience form"
            >
              {/* Section header */}
              <div className="max-w-xl mx-auto text-center mb-10">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                >
                  <p className="text-xs font-bold uppercase tracking-[0.2em] dark:text-amber-400/80 text-amber-600 mb-2">
                    Ready to share?
                  </p>
                  <h2 className="text-3xl font-black dark:text-white text-gray-900">
                    Submit Your Testimony
                  </h2>
                  <p className="text-sm dark:text-white/40 text-gray-500 mt-2">
                    Complete the 3-step form below. Your video is end-to-end encrypted during upload.
                  </p>
                </motion.div>
              </div>

              <div className="max-w-xl mx-auto">
                <StepIndicator current={step} />

                {/* ── Form Card ── */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 32, scale: 0.98 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -32, scale: 0.98 }}
                    transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                    className={`relative overflow-hidden rounded-3xl border p-8 sm:p-10 shadow-2xl transition-colors ${
                      isDark
                        ? "bg-white/[0.025] border-white/8 shadow-black/50 backdrop-blur-2xl"
                        : "bg-white border-gray-100 shadow-gray-200/60"
                    }`}
                  >
                    {/* Gradient accent top bar */}
                    <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-400 rounded-t-3xl" />
                    {/* ── Step 1: Your Info ── */}
                    {step === 1 && (
                      <div className="space-y-7">
                        <div className="text-center space-y-1.5">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-500 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-violet-500/30">
                            <User className="w-5 h-5 text-white" />
                          </div>
                          <h2 className="text-2xl font-black dark:text-white text-gray-900">Personal Information</h2>
                          <p className="text-sm dark:text-white/35 text-gray-500">Tell us a little about yourself</p>
                        </div>

                        <PhotoUpload value={photo} onChange={setPhoto} />

                        <div className="h-px dark:bg-white/[0.06] bg-gray-100" />

                        <div className="space-y-4">
                          <Field id="fullName" label="Full Name" required error={errors.fullName} icon={User}>
                            <ThemedInput
                              id="fullName" hasIcon
                              value={fullName} onChange={(e) => { setFullName(e.target.value); if (errors.fullName) setErrors((p) => ({ ...p, fullName: "" })); }}
                              placeholder="e.g. Chisom Okoye"
                              autoComplete="name"
                              aria-required="true"
                              aria-invalid={!!errors.fullName}
                              aria-describedby={errors.fullName ? "fullName-error" : undefined}
                              error={!!errors.fullName}
                            />
                          </Field>
                          <Field id="email" label="Email Address" required error={errors.email} icon={Mail}>
                            <ThemedInput
                              id="email" type="email" hasIcon
                              value={email} onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors((p) => ({ ...p, email: "" })); }}
                              placeholder="you@example.com"
                              autoComplete="email"
                              aria-required="true"
                              aria-invalid={!!errors.email}
                              error={!!errors.email}
                            />
                          </Field>
                          <Field id="location" label="Location (City, Country)" required error={errors.location} icon={MapPin}>
                            <ThemedInput
                              id="location" hasIcon
                              value={location} onChange={(e) => { setLocation(e.target.value); if (errors.location) setErrors((p) => ({ ...p, location: "" })); }}
                              placeholder="e.g. Warri, Nigeria"
                              autoComplete="address-level2"
                              aria-required="true"
                              aria-invalid={!!errors.location}
                              error={!!errors.location}
                            />
                          </Field>
                        </div>

                        {/* Honeypot */}
                        <input type="text" name="website" value={website} onChange={(e) => setWebsite(e.target.value)}
                          style={{ display: "none" }} tabIndex={-1} autoComplete="off" aria-hidden="true" />
                      </div>
                    )}

                    {/* ── Step 2: Video ── */}
                    {step === 2 && (
                      <div className="space-y-6">
                        <div className="text-center space-y-1.5">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-fuchsia-600 to-pink-500 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-fuchsia-500/30">
                            <FileVideo className="w-5 h-5 text-white" />
                          </div>
                          <h2 className="text-2xl font-black dark:text-white text-gray-900">Video Experience</h2>
                          <p className="text-sm dark:text-white/35 text-gray-500">
                            Upload your testimony — up to 5 GB with secure resumable upload
                          </p>
                        </div>

                        {/* Tips */}
                        <details className={`rounded-2xl border group transition-all ${isDark ? "bg-white/[0.02] border-white/8" : "bg-violet-50/60 border-violet-100"}`}>
                          <summary className={`flex items-center justify-between gap-2 px-4 py-3 cursor-pointer list-none font-semibold text-xs uppercase tracking-[0.12em] select-none ${isDark ? "text-white/40" : "text-violet-600"}`}>
                            <span className="flex items-center gap-2">
                              <Play className="w-3.5 h-3.5" /> Tips for a great testimony
                            </span>
                            <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                          </summary>
                          <div className="px-4 pb-4 grid sm:grid-cols-2 gap-2">
                            {[
                              "Record in a well-lit, quiet environment",
                              "Speak clearly and face the camera",
                              "Aim for 2–10 minutes for best engagement",
                              "Horizontal (landscape) video works best",
                            ].map((tip) => (
                              <p key={tip} className={`text-xs flex items-start gap-2 ${isDark ? "text-white/35" : "text-gray-500"}`}>
                                <Zap className="w-3 h-3 text-violet-400 flex-shrink-0 mt-0.5" /> {tip}
                              </p>
                            ))}
                          </div>
                        </details>

                        <VideoUpload value={video} onChange={setVideo} />

                        <AnimatePresence>
                          {errors.video && (
                            <motion.p
                              initial={{ opacity: 0, y: -6, height: 0 }}
                              animate={{ opacity: 1, y: 0, height: "auto" }}
                              exit={{ opacity: 0, y: -6, height: 0 }}
                              className="text-sm text-red-400 font-medium flex items-center gap-2 overflow-hidden"
                              role="alert" aria-live="polite"
                            >
                              <AlertCircle className="w-4 h-4 flex-shrink-0" />{errors.video}
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {/* ── Step 3: Consent & Review ── */}
                    {step === 3 && (
                      <div className="space-y-5">
                        <div className="text-center space-y-1.5">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-teal-500/30">
                            <Shield className="w-5 h-5 text-white" />
                          </div>
                          <h2 className="text-2xl font-black dark:text-white text-gray-900">Review & Consent</h2>
                          <p className="text-sm dark:text-white/35 text-gray-500">Confirm your details and agree to the terms</p>
                        </div>

                        {/* Summary card */}
                        <div className={`rounded-2xl border p-4 transition-colors ${isDark ? "bg-white/[0.03] border-white/8" : "bg-gray-50 border-gray-100"}`}>
                          <div className="flex items-start gap-3.5">
                            {photo.previewUrl ? (
                              <img src={photo.previewUrl} alt="Your profile photo"
                                className="w-14 h-14 rounded-2xl object-cover flex-shrink-0 ring-2 dark:ring-white/10 ring-violet-200 shadow-sm" />
                            ) : (
                              <div className="w-14 h-14 rounded-2xl flex-shrink-0 dark:bg-white/[0.06] bg-gray-200 flex items-center justify-center">
                                <User className="w-6 h-6 dark:text-white/20 text-gray-400" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0 space-y-1.5">
                              <p className="font-bold dark:text-white text-gray-900 text-base truncate">{fullName}</p>
                              <p className="text-xs dark:text-white/35 text-gray-500 flex items-center gap-1.5">
                                <Mail className="w-3 h-3 flex-shrink-0" />{email}
                              </p>
                              <p className="text-xs dark:text-white/35 text-gray-500 flex items-center gap-1.5">
                                <MapPin className="w-3 h-3 flex-shrink-0" />{location}
                              </p>
                            </div>
                            <div className={`text-right ${video.objectPath ? "text-emerald-500" : "dark:text-white/25 text-gray-400"}`}>
                              {video.objectPath ? (
                                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                </div>
                              ) : (
                                <div className="w-8 h-8 rounded-xl dark:bg-white/[0.04] bg-gray-100 flex items-center justify-center">
                                  <Film className="w-4 h-4" />
                                </div>
                              )}
                            </div>
                          </div>

                          {video.filename && (
                            <div className={`mt-3 pt-3 border-t dark:border-white/6 border-gray-200 flex items-center gap-2 text-xs font-medium ${
                              video.objectPath ? "text-emerald-500" : "dark:text-white/30 text-gray-400"
                            }`}>
                              <Film className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="truncate">{video.filename}</span>
                              {video.objectPath && <span className="flex items-center gap-1 text-emerald-500 ml-auto flex-shrink-0">Ready <CheckCircle2 className="w-3.5 h-3.5" /></span>}
                            </div>
                          )}
                        </div>

                        {/* Consent toggle card */}
                        <div>
                          <button
                            onClick={() => { setConsent((c) => !c); if (errors.consent) setErrors((p) => ({ ...p, consent: "" })); }}
                            aria-pressed={consent}
                            aria-label="I agree to the consent terms"
                            className={`w-full text-left rounded-2xl border p-5 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#060415] focus-visible:ring-offset-white ${
                              errors.consent
                                ? "dark:border-red-500/50 border-red-400 dark:bg-red-950/10 bg-red-50/40"
                                : consent
                                ? "dark:border-violet-500/50 border-violet-400 dark:bg-violet-950/30 bg-violet-50/80 shadow-md shadow-violet-500/8"
                                : "dark:border-white/8 border-gray-200 dark:bg-white/[0.02] bg-white dark:hover:border-white/15 hover:border-violet-300 hover:bg-violet-50/30"
                            }`}
                          >
                            <div className="flex items-start gap-4">
                              <motion.div
                                animate={consent ? { scale: [1, 1.15, 1] } : {}}
                                transition={{ duration: 0.25 }}
                                className={`flex-shrink-0 mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-200 ${
                                  consent ? "bg-gradient-to-br from-violet-600 to-purple-500 border-transparent shadow-lg shadow-violet-500/30" :
                                  errors.consent ? "border-red-400" :
                                  "dark:border-white/20 border-gray-300"
                                }`}
                              >
                                <AnimatePresence>
                                  {consent && (
                                    <motion.div
                                      initial={{ scale: 0, opacity: 0 }}
                                      animate={{ scale: 1, opacity: 1 }}
                                      exit={{ scale: 0, opacity: 0 }}
                                      transition={{ duration: 0.15 }}
                                    >
                                      <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </motion.div>

                              <div className="space-y-2.5 flex-1">
                                <p className="font-bold dark:text-white text-gray-900 text-sm leading-snug">
                                  I confirm and grant consent for the following:
                                </p>
                                <ul className="space-y-2">
                                  {[
                                    "This is my authentic, personal testimony.",
                                    "I grant Jesus Christ Temple Ministry permission to review, edit, publish, and broadcast my video and photo across the JCTM website, Temple TV, social media, livestreams, and official ministry channels.",
                                    "I understand my submission will be reviewed by the ministry team before publication.",
                                  ].map((item) => (
                                    <li key={item} className={`text-xs leading-relaxed flex items-start gap-2 ${isDark ? "text-white/45" : "text-gray-600"}`}>
                                      <span className={`flex-shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full ${consent ? "bg-violet-500" : "dark:bg-white/25 bg-gray-300"} transition-colors`} />
                                      {item}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </button>

                          <AnimatePresence>
                            {errors.consent && (
                              <motion.p
                                initial={{ opacity: 0, y: -6, height: 0 }}
                                animate={{ opacity: 1, y: 0, height: "auto" }}
                                exit={{ opacity: 0, y: -6, height: 0 }}
                                className="text-xs text-red-400 font-medium flex items-center gap-1.5 mt-2 overflow-hidden"
                                role="alert" aria-live="polite"
                              >
                                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{errors.consent}
                              </motion.p>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Review note */}
                        <div className={`rounded-2xl border p-4 flex items-start gap-3 transition-colors ${isDark ? "bg-amber-950/15 border-amber-700/20" : "bg-amber-50 border-amber-100"}`}>
                          <div className="w-7 h-7 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Clock className="w-3.5 h-3.5 text-amber-500" />
                          </div>
                          <p className={`text-xs leading-relaxed ${isDark ? "text-amber-300/80" : "text-amber-800"}`}>
                            Your submission will be reviewed within <strong>3–5 business days</strong>.
                            You'll receive an email notification at <strong>{email}</strong> once approved.
                            Please ensure this address is correct before submitting.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* ── Navigation buttons ── */}
                    <div className={`flex items-center gap-3 mt-8 ${step === 1 ? "justify-end" : "justify-between"}`}>
                      {step > 1 && (
                        <motion.button
                          whileHover={{ x: -2 }}
                          onClick={handleBack}
                          className="flex items-center gap-2 h-12 px-5 rounded-2xl dark:text-white/50 text-gray-500 dark:hover:bg-white/[0.06] hover:bg-gray-100 dark:hover:text-white hover:text-gray-900 font-semibold text-sm transition-all"
                        >
                          <ChevronLeft className="w-4 h-4" /> Back
                        </motion.button>
                      )}

                      {step < 3 ? (
                        <motion.button
                          whileHover={{ scale: 1.02, y: -1 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleNext}
                          className="group relative h-12 px-8 rounded-2xl font-bold text-sm text-white overflow-hidden shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all ml-auto"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-purple-500" />
                          <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <span className="relative flex items-center gap-2">
                            Continue
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                          </span>
                        </motion.button>
                      ) : (
                        <motion.button
                          whileHover={!submitting ? { scale: 1.02, y: -1 } : {}}
                          whileTap={!submitting ? { scale: 0.98 } : {}}
                          onClick={handleSubmit}
                          disabled={submitting}
                          aria-busy={submitting}
                          className="group relative h-12 px-8 rounded-2xl font-bold text-sm text-white overflow-hidden shadow-xl shadow-violet-500/30 hover:shadow-violet-500/45 transition-all disabled:opacity-70 disabled:cursor-not-allowed ml-auto"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-purple-500 to-fuchsia-500" />
                          {!submitting && <div className="absolute inset-0 bg-gradient-to-r from-violet-500 via-purple-400 to-fuchsia-400 opacity-0 group-hover:opacity-100 transition-opacity" />}
                          {/* Shimmer on submit */}
                          {submitting && (
                            <motion.div
                              animate={{ x: ["-100%", "300%"] }}
                              transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                              className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
                            />
                          )}
                          <span className="relative flex items-center gap-2">
                            {submitting ? (
                              <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
                            ) : (
                              <><Sparkles className="w-4 h-4" /> Submit Experience</>
                            )}
                          </span>
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* Progress hint */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-center text-xs dark:text-white/20 text-gray-400 mt-5"
                >
                  Step {step} of {STEPS.length} —{" "}
                  <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-500 to-fuchsia-500">
                    {Math.round((step / STEPS.length) * 100)}% complete
                  </span>
                </motion.p>
              </div>
            </section>

          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}

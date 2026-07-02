import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, User, MapPin, Mail, Video, CheckCircle2, AlertCircle,
  X, Play, Loader2, ChevronRight, ChevronLeft, Film, Camera,
  Shield, Heart, Clock, Sparkles, ArrowDown, Zap, FileVideo,
  RotateCcw, Check, Gauge,
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

// ── Utilities ─────────────────────────────────────────────────────────────────
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
  if (sec < 60) return `${Math.round(sec)}s left`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s left`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m left`;
}

// ── Types ─────────────────────────────────────────────────────────────────────
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

const IDLE_UPLOAD: UploadState = { progress: 0, status: "idle", message: "", objectPath: null, filename: null, fileSize: null, speed: null, eta: null };

// ── Step Indicator ────────────────────────────────────────────────────────────
const STEPS = [
  { label: "Your Info",   icon: User },
  { label: "Video",       icon: FileVideo },
  { label: "Consent",     icon: Shield },
];
function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8 sm:mb-10">
      {STEPS.map((s, i) => {
        const done = current > i + 1;
        const active = current === i + 1;
        const Icon = s.icon;
        return (
          <div key={s.label} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <motion.div
                animate={{ scale: active ? 1.1 : 1 }}
                transition={{ duration: 0.25 }}
                className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                  done
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                    : active
                    ? "bg-gradient-to-br from-violet-600 to-purple-500 text-white shadow-lg shadow-violet-500/40"
                    : "dark:bg-white/5 bg-gray-100 dark:text-white/30 text-gray-400 dark:border-white/10 border border-gray-200"
                }`}
              >
                {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </motion.div>
              <span className={`text-[11px] font-medium hidden sm:block transition-colors ${active ? "text-violet-500 dark:text-violet-400" : done ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400 dark:text-white/25"}`}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="w-12 sm:w-20 h-px mx-2 overflow-hidden dark:bg-white/10 bg-gray-200 rounded-full mb-3 sm:mb-5">
                <motion.div
                  animate={{ width: current > i + 1 ? "100%" : "0%" }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-violet-500 to-emerald-500"
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Photo Upload ──────────────────────────────────────────────────────────────
function PhotoUpload({ value, onChange }: {
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
    <div className="flex flex-col items-center gap-3">
      <motion.div
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload profile photo"
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        className={`relative w-28 h-28 rounded-full cursor-pointer overflow-hidden flex items-center justify-center transition-all duration-200 ${
          isDragging
            ? "ring-2 ring-violet-500 ring-offset-2 dark:ring-offset-[#0a0415] ring-offset-white"
            : "ring-2 dark:ring-white/10 ring-purple-200 hover:dark:ring-violet-500/50 hover:ring-violet-400"
        }`}
        style={{ background: isDragging ? "rgba(124,58,237,0.2)" : undefined }}
      >
        {value.previewUrl ? (
          <img src={value.previewUrl} alt="Profile preview" className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full flex flex-col items-center justify-center gap-1.5 transition-colors ${isDragging ? "dark:bg-violet-900/40 bg-violet-100" : "dark:bg-white/5 bg-gray-50"}`}>
            <Camera className="w-8 h-8 dark:text-white/30 text-gray-400" />
            <span className="text-[9px] font-semibold uppercase tracking-widest dark:text-white/25 text-gray-400 text-center px-2">Add Photo</span>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          </div>
        )}
        {value.previewUrl && !uploading && (
          <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-center justify-center group">
            <Camera className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        )}
      </motion.div>
      <input ref={inputRef} type="file" accept="image/*" className="sr-only" aria-hidden="true"
        onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
      <p className="text-xs dark:text-white/30 text-gray-400 text-center">
        {value.objectPath ? (
          <span className="flex items-center gap-1 text-emerald-500"><CheckCircle2 className="w-3.5 h-3.5" /> Photo ready</span>
        ) : "Optional · JPEG, PNG, WebP · Max 20 MB"}
      </p>
    </div>
  );
}

// ── Video Upload ──────────────────────────────────────────────────────────────
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

    // 1. Init session
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

    // 2. Upload chunks
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

      // Speed & ETA
      const elapsed = (performance.now() - chunkStart) / 1000;
      const chunkSpeed = chunk.size / Math.max(elapsed, 0.01);
      speedSamples.current.push(chunkSpeed);
      if (speedSamples.current.length > 6) speedSamples.current.shift();
      const avgSpeed = speedSamples.current.reduce((a, b) => a + b, 0) / speedSamples.current.length;
      const bytesRemaining = Math.max(0, file.size - (i + 1) * CHUNK_SIZE);
      const eta = bytesRemaining / Math.max(avgSpeed, 1);

      onChange({ progress, status: "uploading", message: `Chunk ${i + 1} of ${totalChunks}`, filename: file.name, fileSize: file.size, objectPath: null, speed: avgSpeed, eta });
    }

    // 3. Finalize
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
            className={`relative border-2 rounded-3xl p-10 cursor-pointer transition-all duration-200 text-center outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0a0415] focus-visible:ring-offset-white ${
              isDragging
                ? "border-violet-500 dark:bg-violet-950/40 bg-violet-50 scale-[1.01]"
                : value.status === "error"
                ? "border-red-500/60 dark:bg-red-950/10 bg-red-50/60 hover:border-red-400"
                : "border-dashed dark:border-white/15 border-gray-200 dark:hover:border-violet-500/50 hover:border-violet-400 dark:bg-white/[0.02] bg-gray-50/60 hover:dark:bg-violet-950/20 hover:bg-violet-50/50"
            }`}
          >
            {/* Icon */}
            <motion.div
              animate={isDragging ? { scale: 1.15, y: -4 } : { scale: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center transition-colors ${
                isDragging ? "bg-violet-600 shadow-lg shadow-violet-500/30" : "dark:bg-white/5 bg-white shadow-sm"
              }`}
            >
              {isDragging
                ? <Upload className="w-8 h-8 text-white" />
                : <Film className="w-8 h-8 dark:text-white/40 text-gray-400" />
              }
            </motion.div>

            {isDragging ? (
              <p className="font-bold text-violet-500 text-lg">Release to upload</p>
            ) : (
              <>
                <p className="font-semibold dark:text-white text-gray-900 text-base">
                  Drag & drop your video here
                </p>
                <p className="text-sm dark:text-white/40 text-gray-500 mt-1">
                  or <span className="text-violet-500 font-semibold underline underline-offset-2">click to browse</span>
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  {["MP4", "MOV", "AVI", "WebM", "MKV"].map((fmt) => (
                    <span key={fmt} className="px-2 py-0.5 rounded-md text-[11px] font-medium dark:bg-white/5 bg-white dark:text-white/40 text-gray-500 border dark:border-white/10 border-gray-200">{fmt}</span>
                  ))}
                </div>
                <p className="text-xs dark:text-white/25 text-gray-400 mt-3">Maximum file size: 5 GB</p>
              </>
            )}

            {value.status === "error" && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                className="mt-4 flex items-center justify-center gap-2 text-sm text-red-400 font-medium">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {value.message}
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="progress"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="rounded-3xl border dark:border-white/10 border-gray-200 dark:bg-white/[0.03] bg-white p-6 space-y-5 shadow-sm"
          >
            {/* File info row */}
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors ${
                value.status === "done" ? "bg-emerald-500 shadow-lg shadow-emerald-500/30" :
                value.status === "error" ? "bg-red-500/20" : "dark:bg-violet-900/60 bg-violet-100"
              }`}>
                {value.status === "done" ? <CheckCircle2 className="w-6 h-6 text-white" /> :
                 value.status === "error" ? <AlertCircle className="w-6 h-6 text-red-400" /> :
                 <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold dark:text-white text-gray-900 truncate">{value.filename}</p>
                <p className="text-xs dark:text-white/40 text-gray-500 mt-0.5">
                  {value.fileSize ? formatBytes(value.fileSize) : ""} · {value.message}
                </p>
              </div>
              {isActive && (
                <button
                  onClick={(e) => { e.stopPropagation(); abortRef.current = true; onChange(IDLE_UPLOAD); }}
                  aria-label="Cancel upload"
                  className="w-8 h-8 rounded-xl flex items-center justify-center dark:text-white/30 text-gray-400 dark:hover:bg-white/10 hover:bg-gray-100 hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold dark:text-white/50 text-gray-500">
                  {value.status === "done" ? "Upload complete" : value.status === "processing" ? "Finalising…" : "Uploading…"}
                </span>
                <span className={`text-xs font-bold tabular-nums ${value.status === "done" ? "text-emerald-500" : "text-violet-500"}`}>
                  {value.progress}%
                </span>
              </div>
              <div className="h-2 rounded-full dark:bg-white/5 bg-gray-100 overflow-hidden">
                <motion.div
                  animate={{ width: `${value.progress}%` }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className={`h-full rounded-full ${
                    value.status === "done" ? "bg-emerald-500" :
                    value.status === "processing" ? "bg-gradient-to-r from-violet-500 to-purple-400 animate-pulse" :
                    "bg-gradient-to-r from-violet-600 to-purple-500"
                  }`}
                />
              </div>
            </div>

            {/* Speed & ETA stats */}
            {(value.status === "uploading") && (value.speed !== null || value.eta !== null) && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="grid grid-cols-2 gap-2">
                {value.speed !== null && (
                  <div className="flex items-center gap-2 rounded-xl dark:bg-white/5 bg-gray-50 px-3 py-2">
                    <Gauge className="w-3.5 h-3.5 dark:text-violet-400 text-violet-500 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] dark:text-white/30 text-gray-500 uppercase tracking-wide font-semibold">Speed</p>
                      <p className="text-xs font-bold dark:text-white text-gray-800 tabular-nums">{formatSpeed(value.speed)}</p>
                    </div>
                  </div>
                )}
                {value.eta !== null && (
                  <div className="flex items-center gap-2 rounded-xl dark:bg-white/5 bg-gray-50 px-3 py-2">
                    <Clock className="w-3.5 h-3.5 dark:text-violet-400 text-violet-500 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] dark:text-white/30 text-gray-500 uppercase tracking-wide font-semibold">ETA</p>
                      <p className="text-xs font-bold dark:text-white text-gray-800 tabular-nums">{formatEta(value.eta)}</p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Done actions */}
            {value.status === "done" && (
              <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                onClick={() => onChange(IDLE_UPLOAD)}
                className="flex items-center gap-1.5 text-xs dark:text-white/30 text-gray-400 dark:hover:text-white/60 hover:text-gray-600 transition-colors">
                <RotateCcw className="w-3.5 h-3.5" /> Replace video
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Success Screen ────────────────────────────────────────────────────────────
function SuccessScreen({ onAgain }: { onAgain: () => void }) {
  const rings = [80, 120, 160, 210];
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-20">
      <div className="max-w-lg w-full text-center space-y-8">
        {/* Animated icon */}
        <div className="relative flex items-center justify-center h-56">
          {rings.map((size, i) => (
            <motion.div
              key={size}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: [0, 0.15, 0], scale: [0.6, 1.2, 1.8] }}
              transition={{ delay: 0.1 + i * 0.15, duration: 1.8, repeat: Infinity, repeatDelay: 2 }}
              style={{ width: size, height: size }}
              className="absolute rounded-full border-2 border-violet-500"
            />
          ))}
          <motion.div
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 220, damping: 14 }}
            className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-600 to-purple-500 flex items-center justify-center shadow-2xl shadow-violet-500/40"
          >
            <motion.div
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              <CheckCircle2 className="w-12 h-12 text-white" />
            </motion.div>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="space-y-3">
          <h1 className="text-4xl font-black dark:text-white text-gray-900">Praise the Lord! 🙌</h1>
          <p className="dark:text-white/60 text-gray-600 text-lg leading-relaxed">
            Your experience has been received. Our team will review it and be in touch within 3–5 business days.
          </p>
          <p className="text-sm dark:text-violet-400 text-violet-600 font-medium">
            Once approved, your story will inspire and encourage thousands around the world.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            className="bg-gradient-to-r from-violet-600 to-purple-500 hover:from-violet-500 hover:to-purple-400 text-white h-11 px-6 font-semibold shadow-lg shadow-violet-500/25"
            onClick={() => { window.location.href = `${BASE}/`; }}
          >
            <Heart className="w-4 h-4 mr-2" /> Back to Home
          </Button>
          <Button variant="outline" onClick={onAgain}
            className="h-11 px-6 dark:border-white/15 border-gray-200 dark:text-white/70 text-gray-700 dark:hover:bg-white/5 hover:bg-gray-50">
            Share Another Experience
          </Button>
        </motion.div>
      </div>
    </div>
  );
}

// ── Field component ───────────────────────────────────────────────────────────
function Field({ id, label, required, error, icon: Icon, children }: {
  id: string; label: string; required?: boolean; error?: string;
  icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-semibold dark:text-white/80 text-gray-700">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </Label>
      <div className={Icon ? "relative" : undefined}>
        {Icon && <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 dark:text-white/25 text-gray-400 pointer-events-none" />}
        {children}
      </div>
      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            className="text-xs text-red-400 font-medium flex items-center gap-1.5" role="alert">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function ThemedInput({ hasIcon, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { hasIcon?: boolean }) {
  return (
    <Input
      {...props}
      className={`h-11 rounded-xl border dark:bg-white/5 bg-white dark:border-white/10 border-gray-200 dark:text-white text-gray-900 dark:placeholder:text-white/25 placeholder:text-gray-400 focus:dark:border-violet-500 focus:border-violet-500 focus:ring-0 transition-colors ${hasIcon ? "pl-10" : ""} ${props.className ?? ""}`}
    />
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ShareExperience() {
  const { isDark } = useTheme();
  const formRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [photo, setPhoto] = useState<{ objectPath: string | null; previewUrl: string | null }>({ objectPath: null, previewUrl: null });
  const [video, setVideo] = useState<UploadState>(IDLE_UPLOAD);
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot

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
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
  };

  const handleSubmit = async () => {
    if (!consent) { setErrors({ consent: "Please agree to the consent terms to submit." }); return; }
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

      {submitted ? (
        <SuccessScreen onAgain={resetForm} />
      ) : (
        <>
          {/* ── Hero ──────────────────────────────────────────────────────────── */}
          <section className="relative min-h-[80vh] flex flex-col items-center justify-center px-4 pt-16 pb-20 overflow-hidden">
            {/* Background layers */}
            <div className={`absolute inset-0 transition-colors duration-500 ${isDark ? "bg-[#07021a]" : "bg-gradient-to-b from-violet-50 via-purple-50/60 to-white"}`} />
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className={`absolute -top-32 left-1/2 -translate-x-1/4 w-[600px] h-[500px] rounded-full blur-[100px] opacity-60 transition-colors ${isDark ? "bg-violet-800/25" : "bg-violet-200/60"}`} />
              <div className={`absolute bottom-0 left-1/4 w-[400px] h-[300px] rounded-full blur-[80px] opacity-40 ${isDark ? "bg-purple-700/20" : "bg-purple-200/40"}`} />
              <div className={`absolute top-1/2 right-0 w-[300px] h-[300px] rounded-full blur-[80px] opacity-30 ${isDark ? "bg-indigo-800/20" : "bg-indigo-100/60"}`} />
            </div>

            {/* Decorative cross */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none" aria-hidden="true">
              <svg viewBox="0 0 200 200" className={`w-[600px] h-[600px] opacity-[0.025] ${isDark ? "text-white" : "text-violet-900"}`} fill="currentColor">
                <rect x="85" y="20" width="30" height="160" rx="4" />
                <rect x="20" y="75" width="160" height="30" rx="4" />
              </svg>
            </div>

            <div className="relative max-w-3xl mx-auto text-center space-y-6 z-10">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                {/* Badge */}
                <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold mb-6 border ${isDark ? "bg-violet-500/10 border-violet-500/20 text-violet-300" : "bg-violet-100 border-violet-200 text-violet-700"}`}>
                  <Sparkles className="w-3.5 h-3.5" /> Your Story Matters
                </div>

                {/* Headline */}
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-black leading-[1.1] tracking-tight dark:text-white text-gray-900">
                  Share Your{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-purple-400">
                    Experience
                  </span>
                  {" "}with JCTM
                </h1>

                <p className="text-lg sm:text-xl dark:text-white/55 text-gray-600 mt-5 max-w-2xl mx-auto leading-relaxed">
                  Has God moved in your life through this ministry? Your testimony has the power to ignite faith, bring healing, and inspire thousands around the world. Share it — and let your story glorify Him.
                </p>
              </motion.div>

              {/* CTA */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}
                className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  onClick={scrollToForm} size="lg"
                  className="h-13 px-8 text-base font-bold bg-gradient-to-r from-violet-600 to-purple-500 hover:from-violet-500 hover:to-purple-400 text-white shadow-xl shadow-violet-500/30 hover:shadow-violet-500/40 transition-all hover:scale-[1.03] rounded-2xl"
                >
                  <Video className="w-5 h-5 mr-2" /> Share Your Experience
                </Button>
                <motion.button
                  onClick={scrollToForm}
                  animate={{ y: [0, 5, 0] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  className="flex items-center gap-2 text-sm dark:text-white/40 text-gray-500 dark:hover:text-white/70 hover:text-gray-700 transition-colors"
                >
                  <ArrowDown className="w-4 h-4" /> Scroll to form
                </motion.button>
              </motion.div>

              {/* Trust badges */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                className="flex flex-wrap justify-center gap-4 pt-4">
                {[
                  { icon: Shield, text: "Your data is secure" },
                  { icon: Clock,  text: "Reviewed within 5 days" },
                  { icon: Heart,  text: "Used to glorify God" },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${isDark ? "dark:bg-white/5 dark:border-white/10 dark:text-white/40" : "bg-white border-gray-200 text-gray-500 shadow-sm"}`}>
                    <Icon className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" /> {text}
                  </div>
                ))}
              </motion.div>
            </div>
          </section>

          {/* ── Form ──────────────────────────────────────────────────────────── */}
          <section ref={formRef} className="relative px-4 pb-28 scroll-mt-20">
            <div className="max-w-xl mx-auto">
              <StepIndicator current={step} />

              {/* Card */}
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className={`rounded-3xl border p-7 sm:p-9 shadow-2xl transition-colors ${isDark ? "bg-white/[0.03] border-white/10 shadow-black/40 backdrop-blur-xl" : "bg-white border-gray-100 shadow-gray-100/80"}`}
              >
                {/* ── Step 1: Your Info ── */}
                {step === 1 && (
                  <div className="space-y-6">
                    <div className="text-center space-y-1">
                      <h2 className="text-xl font-bold dark:text-white text-gray-900">Personal Information</h2>
                      <p className="text-sm dark:text-white/40 text-gray-500">Tell us a little about yourself</p>
                    </div>

                    <PhotoUpload value={photo} onChange={setPhoto} />

                    <div className="space-y-4">
                      <Field id="fullName" label="Full Name" required error={errors.fullName} icon={User}>
                        <ThemedInput id="fullName" hasIcon value={fullName} onChange={(e) => setFullName(e.target.value)}
                          placeholder="e.g. Chisom Okoye" autoComplete="name"
                          className={errors.fullName ? "!border-red-500 focus:!border-red-500" : ""} />
                      </Field>
                      <Field id="email" label="Email Address" required error={errors.email} icon={Mail}>
                        <ThemedInput id="email" type="email" hasIcon value={email} onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com" autoComplete="email"
                          className={errors.email ? "!border-red-500 focus:!border-red-500" : ""} />
                      </Field>
                      <Field id="location" label="Location (City, Country)" required error={errors.location} icon={MapPin}>
                        <ThemedInput id="location" hasIcon value={location} onChange={(e) => setLocation(e.target.value)}
                          placeholder="e.g. Warri, Nigeria" autoComplete="address-level2"
                          className={errors.location ? "!border-red-500 focus:!border-red-500" : ""} />
                      </Field>
                    </div>

                    {/* Honeypot */}
                    <input type="text" name="website" value={website} onChange={(e) => setWebsite(e.target.value)}
                      style={{ display: "none" }} tabIndex={-1} autoComplete="off" aria-hidden="true" />
                  </div>
                )}

                {/* ── Step 2: Video ── */}
                {step === 2 && (
                  <div className="space-y-5">
                    <div className="text-center space-y-1">
                      <h2 className="text-xl font-bold dark:text-white text-gray-900">Video Experience</h2>
                      <p className="text-sm dark:text-white/40 text-gray-500">Upload your testimony — up to 5 GB, secure chunked upload</p>
                    </div>

                    {/* Tips */}
                    <div className={`rounded-2xl p-4 border space-y-2.5 ${isDark ? "bg-white/[0.02] border-white/8" : "bg-violet-50/60 border-violet-100"}`}>
                      <p className={`text-xs font-semibold uppercase tracking-widest flex items-center gap-2 ${isDark ? "text-white/40" : "text-violet-600"}`}>
                        <Play className="w-3.5 h-3.5" /> Tips for a great testimony
                      </p>
                      <div className="grid sm:grid-cols-2 gap-1.5">
                        {[
                          "Record in a well-lit, quiet environment",
                          "Speak clearly — face the camera",
                          "Aim for 2–10 minutes for best engagement",
                          "Horizontal (landscape) video works best",
                        ].map((tip) => (
                          <p key={tip} className={`text-xs flex items-start gap-1.5 ${isDark ? "text-white/35" : "text-gray-500"}`}>
                            <Zap className="w-3 h-3 text-violet-400 flex-shrink-0 mt-0.5" /> {tip}
                          </p>
                        ))}
                      </div>
                    </div>

                    <VideoUpload value={video} onChange={setVideo} />

                    <AnimatePresence>
                      {errors.video && (
                        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                          className="text-sm text-red-400 font-medium flex items-center gap-1.5" role="alert">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />{errors.video}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* ── Step 3: Consent & Review ── */}
                {step === 3 && (
                  <div className="space-y-5">
                    <div className="text-center space-y-1">
                      <h2 className="text-xl font-bold dark:text-white text-gray-900">Review & Consent</h2>
                      <p className="text-sm dark:text-white/40 text-gray-500">Confirm your details and agree to the terms</p>
                    </div>

                    {/* Summary card */}
                    <div className={`rounded-2xl border p-4 ${isDark ? "bg-white/[0.025] border-white/8" : "bg-gray-50 border-gray-100"}`}>
                      <div className="flex items-start gap-3">
                        {photo.previewUrl ? (
                          <img src={photo.previewUrl} alt="" className="w-12 h-12 rounded-full object-cover flex-shrink-0 ring-2 dark:ring-white/10 ring-purple-200" />
                        ) : (
                          <div className="w-12 h-12 rounded-full flex-shrink-0 dark:bg-white/5 bg-gray-200 flex items-center justify-center">
                            <User className="w-5 h-5 dark:text-white/25 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="font-semibold dark:text-white text-gray-900 truncate">{fullName}</p>
                          <p className="text-xs dark:text-white/40 text-gray-500 flex items-center gap-1.5"><Mail className="w-3 h-3" />{email}</p>
                          <p className="text-xs dark:text-white/40 text-gray-500 flex items-center gap-1.5"><MapPin className="w-3 h-3" />{location}</p>
                        </div>
                      </div>
                      <div className={`mt-3 pt-3 border-t dark:border-white/8 border-gray-200 flex items-center gap-2 text-xs font-medium ${video.objectPath ? "text-emerald-500" : "dark:text-white/30 text-gray-400"}`}>
                        <Film className="w-3.5 h-3.5 flex-shrink-0" />
                        {video.objectPath ? <><CheckCircle2 className="w-3.5 h-3.5" /> {video.filename} ready</> : "No video attached"}
                      </div>
                    </div>

                    {/* Consent card */}
                    <button
                      onClick={() => setConsent((c) => !c)}
                      aria-pressed={consent}
                      className={`w-full text-left rounded-2xl border p-5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0a0415] focus-visible:ring-offset-white ${
                        errors.consent ? "border-red-500 dark:bg-red-950/10 bg-red-50/50" :
                        consent ? "border-violet-500 dark:bg-violet-950/40 bg-violet-50 shadow-sm shadow-violet-500/10" :
                        "dark:border-white/10 border-gray-200 dark:bg-white/[0.02] bg-white dark:hover:border-white/20 hover:border-violet-300"
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        {/* Toggle indicator */}
                        <div className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${consent ? "bg-violet-600 border-violet-600" : "dark:border-white/25 border-gray-300"}`}>
                          <motion.div animate={{ scale: consent ? 1 : 0 }} transition={{ duration: 0.15 }}>
                            <Check className="w-3 h-3 text-white" />
                          </motion.div>
                        </div>
                        <div className="space-y-2">
                          <p className="font-semibold dark:text-white text-gray-900">I confirm and agree to the following:</p>
                          <ul className="space-y-1.5">
                            {[
                              "This is my authentic, personal testimony.",
                              "I grant Jesus Christ Temple Ministry permission to review, edit, publish, and broadcast my video and photo across the JCTM website, Temple TV, social media, livestreams, and official ministry channels.",
                              "I understand my submission will be reviewed by the ministry team before publication.",
                            ].map((item) => (
                              <li key={item} className={`text-xs leading-relaxed flex items-start gap-1.5 ${isDark ? "text-white/50" : "text-gray-600"}`}>
                                <span className="text-violet-400 font-bold mt-0.5 flex-shrink-0">·</span> {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </button>

                    <AnimatePresence>
                      {errors.consent && (
                        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                          className="text-xs text-red-400 font-medium flex items-center gap-1.5" role="alert">
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{errors.consent}
                        </motion.p>
                      )}
                    </AnimatePresence>

                    {/* Processing note */}
                    <div className={`rounded-xl p-3 flex items-start gap-2.5 border ${isDark ? "bg-blue-950/20 border-blue-800/25" : "bg-blue-50 border-blue-100"}`}>
                      <Clock className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                      <p className={`text-xs leading-relaxed ${isDark ? "text-blue-300/80" : "text-blue-700"}`}>
                        Submissions are typically reviewed within <strong>3–5 business days</strong>. We'll contact you at the email address you provided if your experience is selected for publication.
                      </p>
                    </div>
                  </div>
                )}

                {/* ── Navigation ── */}
                <div className="flex justify-between items-center gap-3 mt-8 pt-6 border-t dark:border-white/8 border-gray-100">
                  {step > 1 ? (
                    <Button variant="outline" onClick={() => setStep(step - 1)} disabled={submitting}
                      className="h-11 px-5 dark:border-white/10 border-gray-200 dark:text-white/60 text-gray-700 dark:hover:bg-white/5 hover:bg-gray-50 rounded-xl font-medium">
                      <ChevronLeft className="w-4 h-4 mr-1" /> Back
                    </Button>
                  ) : <div />}

                  {step < 3 ? (
                    <Button onClick={handleNext}
                      disabled={step === 2 && (video.status === "uploading" || video.status === "processing")}
                      className="h-11 px-7 bg-gradient-to-r from-violet-600 to-purple-500 hover:from-violet-500 hover:to-purple-400 text-white font-bold rounded-xl shadow-lg shadow-violet-500/25 hover:shadow-violet-500/35 transition-all hover:scale-[1.02] ml-auto">
                      {step === 2 && (video.status === "uploading" || video.status === "processing")
                        ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading…</>
                        : <>Continue <ChevronRight className="w-4 h-4 ml-1" /></>
                      }
                    </Button>
                  ) : (
                    <Button onClick={handleSubmit} disabled={submitting || !consent}
                      className="h-11 px-7 bg-gradient-to-r from-violet-600 to-purple-500 hover:from-violet-500 hover:to-purple-400 text-white font-bold rounded-xl shadow-lg shadow-violet-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.02] ml-auto min-w-36">
                      {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting…</> : <><Heart className="w-4 h-4 mr-2" /> Submit Experience</>}
                    </Button>
                  )}
                </div>
              </motion.div>

              {/* Step hint */}
              <p className="text-center text-xs dark:text-white/20 text-gray-400 mt-4">
                Step {step} of 3 · All uploads are encrypted and stored securely
              </p>
            </div>
          </section>
        </>
      )}
    </Layout>
  );
}

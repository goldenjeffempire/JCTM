import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, User, MapPin, Mail, Video, CheckCircle2, AlertCircle,
  X, Play, Loader2, ChevronRight, ChevronLeft, Film, Camera,
  Shield, Heart, Clock, Sparkles,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB per chunk
const MAX_VIDEO_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB
const MAX_PHOTO_BYTES = 20 * 1024 * 1024; // 20 MB
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/avi", "video/webm", "video/x-msvideo", "video/x-matroska"];

// ── Types ─────────────────────────────────────────────────────────────────────
interface UploadState {
  progress: number;       // 0–100
  status: "idle" | "uploading" | "processing" | "done" | "error";
  message: string;
  objectPath: string | null;
  filename: string | null;
}

// ── Step Indicator ────────────────────────────────────────────────────────────
function StepDot({ step, current, label }: { step: number; current: number; label: string }) {
  const done = current > step;
  const active = current === step;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <motion.div
        animate={{
          background: done ? "#a855f7" : active ? "linear-gradient(135deg,#7c3aed,#a855f7)" : "#1e1035",
          borderColor: done || active ? "#a855f7" : "#4c1d95",
          scale: active ? 1.15 : 1,
        }}
        transition={{ duration: 0.3 }}
        className="w-9 h-9 rounded-full border-2 flex items-center justify-center font-bold text-sm text-white"
      >
        {done ? <CheckCircle2 className="w-5 h-5" /> : step}
      </motion.div>
      <span className={`text-xs font-medium hidden sm:block ${active ? "text-purple-300" : done ? "text-purple-500" : "text-purple-900"}`}>
        {label}
      </span>
    </div>
  );
}

function StepConnector({ done }: { done: boolean }) {
  return (
    <div className="flex-1 h-0.5 mt-4 mx-1 rounded-full overflow-hidden bg-purple-950">
      <motion.div
        animate={{ width: done ? "100%" : "0%" }}
        transition={{ duration: 0.4 }}
        className="h-full bg-purple-500"
      />
    </div>
  );
}

// ── Photo Upload ──────────────────────────────────────────────────────────────
function PhotoUpload({
  value, onChange,
}: {
  value: { objectPath: string | null; previewUrl: string | null };
  onChange: (v: { objectPath: string | null; previewUrl: string | null }) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file."); return; }
    if (file.size > MAX_PHOTO_BYTES) { toast.error("Photo must be 20 MB or smaller."); return; }

    const previewUrl = URL.createObjectURL(file);
    onChange({ objectPath: null, previewUrl });
    setUploading(true);

    try {
      const res = await fetch(`${BASE}/api/experiences/upload/photo`, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Upload failed"); }
      const { objectPath } = await res.json();
      onChange({ objectPath, previewUrl });
      toast.success("Photo uploaded!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Photo upload failed.");
      onChange({ objectPath: null, previewUrl: null });
    } finally {
      setUploading(false);
    }
  }, [onChange]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        onClick={() => inputRef.current?.click()}
        className="relative w-28 h-28 rounded-full border-2 border-dashed border-purple-600 hover:border-purple-400 transition-colors cursor-pointer overflow-hidden flex items-center justify-center bg-purple-950/40"
      >
        {value.previewUrl ? (
          <img src={value.previewUrl} alt="Profile preview" className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-purple-400">
            <Camera className="w-8 h-8" />
            <span className="text-[10px] font-medium text-center px-1">Tap to upload</span>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
      <p className="text-xs text-purple-400 text-center">Profile photo (optional) · JPEG, PNG, WebP · Max 20 MB</p>
    </div>
  );
}

// ── Video Chunked Upload ──────────────────────────────────────────────────────
function VideoUpload({ value, onChange }: { value: UploadState; onChange: (v: UploadState) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  const handleFile = useCallback(async (file: File) => {
    if (!ALLOWED_VIDEO_TYPES.includes(file.type) && !file.name.match(/\.(mp4|mov|avi|webm|mkv)$/i)) {
      toast.error("Only MP4, MOV, AVI, WebM, and MKV videos are accepted.");
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) { toast.error("Video exceeds the 5 GB limit."); return; }

    abortRef.current = false;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    onChange({ progress: 0, status: "uploading", message: "Initialising upload…", objectPath: null, filename: file.name });

    // 1. Init session
    let sessionId: string;
    try {
      const initRes = await fetch(`${BASE}/api/experiences/upload/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type || "video/mp4", filename: file.name, totalChunks, totalSize: file.size }),
      });
      if (!initRes.ok) { const e = await initRes.json(); throw new Error(e.error ?? "Init failed"); }
      sessionId = (await initRes.json()).sessionId;
    } catch (err) {
      onChange({ progress: 0, status: "error", message: err instanceof Error ? err.message : "Upload failed", objectPath: null, filename: file.name });
      return;
    }

    // 2. Upload chunks
    for (let i = 0; i < totalChunks; i++) {
      if (abortRef.current) { onChange({ progress: 0, status: "idle", message: "", objectPath: null, filename: null }); return; }

      const start = i * CHUNK_SIZE;
      const chunk = file.slice(start, start + CHUNK_SIZE);
      const progress = Math.round((i / totalChunks) * 90);
      onChange({ progress, status: "uploading", message: `Uploading… ${progress}% (chunk ${i + 1}/${totalChunks})`, objectPath: null, filename: file.name });

      let retries = 3;
      while (retries > 0) {
        try {
          const res = await fetch(`${BASE}/api/experiences/upload/chunk`, {
            method: "POST",
            headers: {
              "Content-Type": "application/octet-stream",
              "X-Session-Id": sessionId,
              "X-Chunk-Index": String(i),
            },
            body: chunk,
          });
          if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Chunk upload failed"); }
          break;
        } catch (err) {
          retries--;
          if (retries === 0) {
            onChange({ progress, status: "error", message: `Upload failed at chunk ${i + 1}. Please try again.`, objectPath: null, filename: file.name });
            return;
          }
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    }

    // 3. Finalize
    onChange({ progress: 95, status: "processing", message: "Processing video…", objectPath: null, filename: file.name });
    try {
      const finalRes = await fetch(`${BASE}/api/experiences/upload/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!finalRes.ok) { const e = await finalRes.json(); throw new Error(e.error ?? "Finalize failed"); }
      const { objectPath } = await finalRes.json();
      onChange({ progress: 100, status: "done", message: "Video uploaded successfully!", objectPath, filename: file.name });
      toast.success("Video uploaded!");
    } catch (err) {
      onChange({ progress: 95, status: "error", message: err instanceof Error ? err.message : "Finalize failed", objectPath: null, filename: file.name });
    }
  }, [onChange]);

  const cancel = () => {
    abortRef.current = true;
    onChange({ progress: 0, status: "idle", message: "", objectPath: null, filename: null });
  };

  const isActive = value.status === "uploading" || value.status === "processing";

  return (
    <div className="space-y-3">
      {value.status === "idle" || value.status === "error" ? (
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-purple-600 hover:border-purple-400 rounded-2xl p-8 cursor-pointer transition-colors flex flex-col items-center gap-3 bg-purple-950/30 text-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-purple-900/60 flex items-center justify-center">
            <Film className="w-8 h-8 text-purple-400" />
          </div>
          <div>
            <p className="font-semibold text-white">Upload your video experience</p>
            <p className="text-sm text-purple-400 mt-1">MP4, MOV, AVI, WebM · Up to 5 GB</p>
          </div>
          <Button variant="outline" size="sm" className="border-purple-600 text-purple-300 hover:bg-purple-900/50">
            <Upload className="w-4 h-4 mr-2" />
            Choose Video
          </Button>
          {value.status === "error" && (
            <p className="text-sm text-red-400 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" /> {value.message}
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-purple-700/50 bg-purple-950/40 p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-900 flex items-center justify-center flex-shrink-0">
              {value.status === "done" ? (
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              ) : (
                <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{value.filename}</p>
              <p className="text-xs text-purple-400">{value.message}</p>
            </div>
            {isActive && (
              <button onClick={cancel} className="text-purple-500 hover:text-red-400 transition-colors">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <div className="h-2 bg-purple-900 rounded-full overflow-hidden">
            <motion.div
              animate={{ width: `${value.progress}%` }}
              transition={{ duration: 0.3 }}
              className={`h-full rounded-full ${value.status === "done" ? "bg-green-500" : "bg-gradient-to-r from-violet-500 to-purple-400"}`}
            />
          </div>
          {value.status === "done" && (
            <button
              onClick={() => { onChange({ progress: 0, status: "idle", message: "", objectPath: null, filename: null }); }}
              className="text-xs text-purple-400 hover:text-purple-300 underline"
            >
              Replace video
            </button>
          )}
        </div>
      )}
      <input ref={inputRef} type="file" accept="video/*,.mp4,.mov,.avi,.webm,.mkv" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ShareExperience() {
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Step 1 fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [photo, setPhoto] = useState<{ objectPath: string | null; previewUrl: string | null }>({ objectPath: null, previewUrl: null });

  // Step 2 — video
  const [video, setVideo] = useState<UploadState>({ progress: 0, status: "idle", message: "", objectPath: null, filename: null });

  // Step 3 — consent
  const [consent, setConsent] = useState(false);

  // Honeypot
  const [website, setWebsite] = useState("");

  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (!fullName.trim() || fullName.trim().length < 2) e.fullName = "Please enter your full name.";
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Please enter a valid email address.";
    if (!location.trim()) e.location = "Please enter your city and country.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    if (video.status !== "done" || !video.objectPath) {
      setErrors({ video: "Please upload your video before continuing." });
      return false;
    }
    setErrors({});
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
  };

  const handleSubmit = async () => {
    if (!consent) { setErrors({ consent: "You must agree to the terms to submit." }); return; }
    setErrors({});
    setSubmitting(true);

    try {
      const res = await fetch(`${BASE}/api/experiences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          location: location.trim(),
          photoPath: photo.objectPath,
          videoPath: video.objectPath,
          videoFilename: video.filename,
          consent: true,
          website, // honeypot
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Submission failed"); }
      setSubmitted(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Success state
  if (submitted) {
    return (
      <Layout>
        <SEO title="Thank You — Share Your Experience | JCTM" />
        <div className="min-h-[70vh] flex items-center justify-center px-4 py-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-lg w-full text-center space-y-6"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-600 to-purple-500 flex items-center justify-center mx-auto shadow-2xl shadow-purple-900/60"
            >
              <CheckCircle2 className="w-12 h-12 text-white" />
            </motion.div>
            <h1 className="text-3xl sm:text-4xl font-black text-white">Praise the Lord!</h1>
            <p className="text-purple-300 text-lg">Your experience has been received. Our team will review it and get back to you soon.</p>
            <p className="text-sm text-purple-500">Once approved, your story will inspire and encourage others in the faith.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button
                className="bg-gradient-to-r from-violet-600 to-purple-500 hover:from-violet-500 hover:to-purple-400 text-white"
                onClick={() => { window.location.href = `${BASE}/`; }}
              >
                <Heart className="w-4 h-4 mr-2" /> Back to Home
              </Button>
              <Button variant="outline" className="border-purple-700 text-purple-300 hover:bg-purple-900/40"
                onClick={() => { setSubmitted(false); setStep(1); setFullName(""); setEmail(""); setLocation(""); setPhoto({ objectPath: null, previewUrl: null }); setVideo({ progress: 0, status: "idle", message: "", objectPath: null, filename: null }); setConsent(false); }}>
                Share Another Experience
              </Button>
            </div>
          </motion.div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <SEO
        title="Share Your Experience | Jesus Christ Temple Ministry"
        description="Share how God has moved in your life through Jesus Christ Temple Ministry. Your testimony can inspire and uplift thousands."
      />

      {/* Hero */}
      <section className="relative pt-24 pb-10 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-violet-950/80 via-purple-950/60 to-transparent pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-purple-600/15 blur-[80px] rounded-full pointer-events-none" />
        <div className="relative max-w-2xl mx-auto text-center space-y-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-900/60 border border-purple-700/50 text-purple-300 text-sm font-medium mb-4">
              <Sparkles className="w-4 h-4" /> Your Story Matters
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white leading-tight">
              Share Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-purple-300">Experience</span>
            </h1>
            <p className="text-purple-300 text-base sm:text-lg mt-3 max-w-xl mx-auto">
              How has God moved in your life through this ministry? Share your video testimony and inspire thousands around the world.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Form Card */}
      <section className="px-4 pb-20">
        <div className="max-w-2xl mx-auto">

          {/* Step Indicator */}
          <div className="flex items-start mb-8">
            <StepDot step={1} current={step} label="Your Info" />
            <StepConnector done={step > 1} />
            <StepDot step={2} current={step} label="Video" />
            <StepConnector done={step > 2} />
            <StepDot step={3} current={step} label="Consent" />
          </div>

          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="glass-panel rounded-3xl border border-purple-800/40 bg-purple-950/30 backdrop-blur-sm p-6 sm:p-8 shadow-2xl shadow-purple-900/30 space-y-6"
          >
            {/* ── Step 1: Personal Info ── */}
            {step === 1 && (
              <>
                <div className="text-center space-y-1">
                  <h2 className="text-xl font-bold text-white flex items-center justify-center gap-2">
                    <User className="w-5 h-5 text-purple-400" /> Personal Information
                  </h2>
                  <p className="text-sm text-purple-400">Tell us a little about yourself</p>
                </div>

                {/* Photo Upload */}
                <PhotoUpload value={photo} onChange={setPhoto} />

                {/* Fields */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName" className="text-purple-200 font-medium">Full Name <span className="text-purple-500">*</span></Label>
                    <Input
                      id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Chisom Okoye"
                      className={`bg-purple-950/60 border-purple-700 text-white placeholder:text-purple-600 focus:border-purple-400 ${errors.fullName ? "border-red-500" : ""}`}
                    />
                    {errors.fullName && <p className="text-xs text-red-400">{errors.fullName}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-purple-200 font-medium">Email Address <span className="text-purple-500">*</span></Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500" />
                      <Input
                        id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className={`pl-10 bg-purple-950/60 border-purple-700 text-white placeholder:text-purple-600 focus:border-purple-400 ${errors.email ? "border-red-500" : ""}`}
                      />
                    </div>
                    {errors.email && <p className="text-xs text-red-400">{errors.email}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="location" className="text-purple-200 font-medium">Location (City, Country) <span className="text-purple-500">*</span></Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500" />
                      <Input
                        id="location" value={location} onChange={(e) => setLocation(e.target.value)}
                        placeholder="e.g. Warri, Nigeria"
                        className={`pl-10 bg-purple-950/60 border-purple-700 text-white placeholder:text-purple-600 focus:border-purple-400 ${errors.location ? "border-red-500" : ""}`}
                      />
                    </div>
                    {errors.location && <p className="text-xs text-red-400">{errors.location}</p>}
                  </div>

                  {/* Honeypot */}
                  <input type="text" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} style={{ display: "none" }} tabIndex={-1} autoComplete="off" />
                </div>
              </>
            )}

            {/* ── Step 2: Video Upload ── */}
            {step === 2 && (
              <>
                <div className="text-center space-y-1">
                  <h2 className="text-xl font-bold text-white flex items-center justify-center gap-2">
                    <Video className="w-5 h-5 text-purple-400" /> Video Experience
                  </h2>
                  <p className="text-sm text-purple-400">Upload your testimony video — up to 5 GB</p>
                </div>

                <div className="rounded-2xl bg-purple-900/20 border border-purple-800/40 p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-purple-200 flex items-center gap-2">
                    <Play className="w-4 h-4" /> Tips for a great testimony video
                  </h3>
                  <ul className="text-xs text-purple-400 space-y-1 list-none">
                    <li>• Record in a well-lit, quiet environment</li>
                    <li>• Speak clearly and share your personal experience</li>
                    <li>• Keep it between 2–10 minutes for best engagement</li>
                    <li>• Ensure your face is clearly visible</li>
                  </ul>
                </div>

                <VideoUpload value={video} onChange={setVideo} />
                {errors.video && <p className="text-sm text-red-400 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{errors.video}</p>}
              </>
            )}

            {/* ── Step 3: Consent & Submit ── */}
            {step === 3 && (
              <>
                <div className="text-center space-y-1">
                  <h2 className="text-xl font-bold text-white flex items-center justify-center gap-2">
                    <Shield className="w-5 h-5 text-purple-400" /> Consent & Review
                  </h2>
                  <p className="text-sm text-purple-400">Review your details and agree to the terms</p>
                </div>

                {/* Summary */}
                <div className="rounded-2xl bg-purple-950/50 border border-purple-800/40 p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-purple-200">Submission Summary</h3>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex gap-2"><span className="text-purple-500 w-20">Name:</span><span className="text-white">{fullName}</span></div>
                    <div className="flex gap-2"><span className="text-purple-500 w-20">Email:</span><span className="text-white">{email}</span></div>
                    <div className="flex gap-2"><span className="text-purple-500 w-20">Location:</span><span className="text-white">{location}</span></div>
                    <div className="flex gap-2"><span className="text-purple-500 w-20">Photo:</span><span className={photo.objectPath ? "text-green-400" : "text-purple-600"}>{photo.objectPath ? "Uploaded ✓" : "Not provided"}</span></div>
                    <div className="flex gap-2"><span className="text-purple-500 w-20">Video:</span><span className="text-green-400">{video.filename} ✓</span></div>
                  </div>
                </div>

                {/* Consent Checkbox */}
                <div
                  className={`rounded-2xl border p-5 cursor-pointer transition-colors ${consent ? "border-purple-500 bg-purple-900/30" : "border-purple-800/50 bg-purple-950/30 hover:border-purple-700"} ${errors.consent ? "border-red-500" : ""}`}
                  onClick={() => setConsent((c) => !c)}
                >
                  <div className="flex gap-3">
                    <div className={`w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors ${consent ? "bg-purple-500 border-purple-500" : "border-purple-600"}`}>
                      {consent && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <div className="text-sm text-purple-300 leading-relaxed">
                      <span className="font-semibold text-white">I confirm and agree:</span>
                      <ul className="mt-2 space-y-1.5 text-purple-400">
                        <li>• The submitted experience is my authentic, personal testimony.</li>
                        <li>• I grant <strong className="text-purple-200">Jesus Christ Temple Ministry</strong> permission to review, edit, publish, and share my video and profile photo across the JCTM website, Temple TV, social media platforms, livestreams, promotional materials, and other official ministry channels.</li>
                        <li>• I understand my submission will be reviewed before being published.</li>
                      </ul>
                    </div>
                  </div>
                </div>
                {errors.consent && <p className="text-xs text-red-400 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{errors.consent}</p>}

                {/* Processing note */}
                <div className="rounded-xl bg-blue-950/30 border border-blue-800/30 p-3 flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-300">Submissions are typically reviewed within 3–5 business days. You will be contacted at the email you provided if your experience is selected for publication.</p>
                </div>
              </>
            )}

            {/* Navigation */}
            <div className="flex justify-between gap-3 pt-2">
              {step > 1 ? (
                <Button variant="outline" onClick={() => setStep(step - 1)} className="border-purple-700 text-purple-300 hover:bg-purple-900/40" disabled={submitting}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Back
                </Button>
              ) : <div />}

              {step < 3 ? (
                <Button
                  onClick={handleNext}
                  disabled={step === 2 && video.status === "uploading"}
                  className="bg-gradient-to-r from-violet-600 to-purple-500 hover:from-violet-500 hover:to-purple-400 text-white ml-auto"
                >
                  {step === 2 && (video.status === "uploading" || video.status === "processing")
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading…</>
                    : <>Next <ChevronRight className="w-4 h-4 ml-1" /></>
                  }
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !consent}
                  className="bg-gradient-to-r from-violet-600 to-purple-500 hover:from-violet-500 hover:to-purple-400 text-white ml-auto min-w-32"
                >
                  {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting…</> : <><Heart className="w-4 h-4 mr-2" /> Submit Experience</>}
                </Button>
              )}
            </div>
          </motion.div>

          {/* Trust indicators */}
          <div className="flex flex-wrap justify-center gap-6 mt-8 text-xs text-purple-600">
            <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Your data is secure</span>
            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Reviewed within 5 business days</span>
            <span className="flex items-center gap-1.5"><Heart className="w-3.5 h-3.5" /> Used to glorify God</span>
          </div>
        </div>
      </section>
    </Layout>
  );
}

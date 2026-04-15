import { useState, useEffect, useRef, useCallback } from "react";
import { useListGalleryImages, useCreateGalleryImage, useDeleteGalleryImage, useUpdateGalleryImage } from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { motion, AnimatePresence } from "framer-motion";
import {
  Images, X, ChevronLeft, ChevronRight, Upload, Trash2,
  ZoomIn, Grid3X3, LayoutGrid, Lock, Calendar, Star, Search,
  CheckCircle2, AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { AdminLoginGate, AdminBadge } from "@/components/admin/AdminLoginGate";

function useDebounce<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

const CATEGORIES = [
  { value: "", label: "All Photos" },
  { value: "service", label: "Sunday Service" },
  { value: "crusade", label: "Crusade" },
  { value: "conference", label: "Conference" },
  { value: "outreach", label: "Outreach" },
  { value: "prayer", label: "Prayer Night" },
  { value: "special", label: "Special Events" },
];

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function imageUrl(objectPath: string) {
  return `${BASE_URL}/api/storage${objectPath}`;
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

function categoryLabel(value: string) {
  return CATEGORIES.find(c => c.value === value)?.label
    ?? value.split(/[-_\s]+/).filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

type GalleryImg = {
  id: number;
  title: string;
  description?: string | null;
  objectPath: string;
  thumbnailPath?: string | null;
  category: string;
  serviceDate?: string | null;
  altText?: string | null;
  isPublished: boolean;
  isFeatured: boolean;
  sortOrder: number;
  createdAt: string;
};

function thumbnailUrl(image: GalleryImg) {
  return imageUrl(image.thumbnailPath ?? image.objectPath);
}

function Lightbox({
  images,
  index,
  onClose,
  onPrev,
  onNext,
}: {
  images: GalleryImg[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const img = images[index];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, onPrev, onNext]);

  if (!img) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
      >
        <X className="h-6 w-6" />
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); onPrev(); }}
        className="absolute left-4 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); onNext(); }}
        className="absolute right-4 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
      >
        <ChevronRight className="h-6 w-6" />
      </button>

      <motion.div
        key={img.id}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="max-w-5xl max-h-[90vh] mx-16 flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={imageUrl(img.objectPath)}
          alt={img.altText ?? img.title}
          className="max-h-[80vh] max-w-full object-contain rounded-xl shadow-2xl"
          loading="eager"
        />
        {(img.title || img.description) && (
          <div className="text-center text-white max-w-xl">
            {img.title && <p className="font-semibold text-base">{img.title}</p>}
            {img.description && <p className="text-white/60 text-sm mt-1">{img.description}</p>}
            {img.serviceDate && (
              <p className="text-white/40 text-xs mt-1 flex items-center justify-center gap-1">
                <Calendar className="h-3 w-3" />
                {img.serviceDate}
              </p>
            )}
          </div>
        )}
        <p className="text-white/30 text-xs">{index + 1} / {images.length}</p>
      </motion.div>
    </motion.div>
  );
}

function GalleryCard({
  image,
  index,
  onClick,
  isAdmin,
  onDelete,
  onToggleFeatured,
}: {
  image: GalleryImg;
  index: number;
  onClick: () => void;
  isAdmin: boolean;
  onDelete: (id: number) => void;
  onToggleFeatured: (id: number, current: boolean) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.4) }}
      className="relative group overflow-hidden rounded-xl bg-muted/30 cursor-pointer"
      onClick={onClick}
    >
      {!loaded && !error && (
        <div className="absolute inset-0 animate-pulse bg-muted/50 rounded-xl" />
      )}
      {error ? (
        <div className="aspect-square flex items-center justify-center bg-muted/30 rounded-xl text-muted-foreground text-sm">
          <Images className="h-8 w-8 opacity-30" />
        </div>
      ) : (
        <img
          src={thumbnailUrl(image)}
          alt={image.altText ?? image.title}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={`w-full h-full object-cover aspect-square transition-all duration-500 group-hover:scale-105 ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            {image.title && (
              <p className="text-white text-xs font-semibold truncate">{image.title}</p>
            )}
            {image.serviceDate && (
              <p className="text-white/60 text-[10px] truncate">{image.serviceDate}</p>
            )}
          </div>
          <ZoomIn className="h-4 w-4 text-white shrink-0 ml-2" />
        </div>
      </div>

      {image.isFeatured && (
        <div className="absolute top-2 left-2 z-10">
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/90 text-white text-[10px] font-bold uppercase tracking-wide">
            <Star className="h-2.5 w-2.5 fill-white" /> Featured
          </span>
        </div>
      )}

      {isAdmin && (
        <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFeatured(image.id, image.isFeatured); }}
            className={`p-1.5 rounded-full text-white transition-colors ${image.isFeatured ? "bg-amber-500/90 hover:bg-amber-500" : "bg-black/50 hover:bg-amber-500/80"}`}
            title={image.isFeatured ? "Remove from slideshow" : "Feature in slideshow"}
          >
            <Star className={`h-3.5 w-3.5 ${image.isFeatured ? "fill-white" : ""}`} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(image.id); }}
            className="p-1.5 rounded-full bg-red-600/80 hover:bg-red-600 text-white transition-colors"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </motion.div>
  );
}

const MAX_FILE_BYTES   = 25 * 1024 * 1024; // 25 MB — matches server hard cap
const MAX_BATCH_FILES = 50;
const UPLOAD_CONCURRENCY = 5;
const MAX_COMPRESS_DIMENSION = 1920; // px — longest edge before JPEG re-encode
const COMPRESS_QUALITY = 0.87;       // JPEG quality (0–1)

type FileEntry = {
  id: string;
  file: File;            // original file as-selected
  uploadFile?: File;     // compressed/converted file sent to server
  status: "pending" | "compressing" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
  objectPath?: string;
  originalSize: number;  // bytes before compression
  uploadSize?: number;   // bytes actually sent
};

// ─── Client-side image compression ────────────────────────────────────────────
// Compresses JPEG/PNG/WebP/GIF to a 1920px JPEG before upload.
// Returns the original file unchanged if:
//   – it's HEIC/HEIF (Canvas can't decode them in most browsers)
//   – compression produces a larger file than the original
//   – the file is already ≤ 1920px on its longest edge and ≤ 500 KB
//
async function compressImage(file: File): Promise<File> {
  // Skip formats the Canvas API can't reliably encode or decode
  if (file.type === "image/heic" || file.type === "image/heif" || file.type === "image/gif") {
    return file;
  }
  // Skip tiny files that don't need compression
  if (file.size <= 500 * 1024) return file;

  return new Promise<File>((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { naturalWidth: w, naturalHeight: h } = img;
      const longest = Math.max(w, h);

      // Only resize when the image is genuinely oversized
      if (longest > MAX_COMPRESS_DIMENSION) {
        const scale = MAX_COMPRESS_DIMENSION / longest;
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }

      const canvas = document.createElement("canvas");
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }

      // White background for any transparent PNGs
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob((blob) => {
        if (!blob || blob.size >= file.size) {
          // Compression made it no smaller — send original
          resolve(file);
          return;
        }
        // Rename .png / .webp → .jpg since we JPEG-encoded
        const newName = file.name.replace(/\.(png|webp|bmp|tiff?)$/i, ".jpg");
        resolve(new File([blob], newName, { type: "image/jpeg" }));
      }, "image/jpeg", COMPRESS_QUALITY);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file); // fall back to original if loading fails
    };

    img.src = objectUrl;
  });
}

// ─── XHR upload with progress and auto-retry ──────────────────────────────────
async function uploadFileWithProgress(
  file: File,
  adminToken: string,
  onProgress: (pct: number) => void,
  signal: AbortSignal,
  attempt = 0,
): Promise<string> {
  const MAX_RETRIES = 2;

  try {
    return await new Promise<string>((resolve, reject) => {
      if (signal.aborted) { reject(new Error("Upload cancelled")); return; }

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", e => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 95));
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText) as { objectPath: string };
            onProgress(100);
            resolve(data.objectPath);
          } catch {
            reject(new Error("Unexpected response from server — please try again"));
          }
        } else {
          try {
            const err = JSON.parse(xhr.responseText) as { error?: string };
            // 4xx = client error (bad file, too large, etc.) — don't retry
            reject(Object.assign(new Error(err.error ?? `Server error ${xhr.status}`), { noRetry: true }));
          } catch {
            reject(new Error(`Upload failed (status ${xhr.status})`));
          }
        }
      });

      xhr.addEventListener("error", () => reject(new Error("Network error — connection interrupted")));
      xhr.addEventListener("abort",  () => reject(Object.assign(new Error("Upload cancelled"), { noRetry: true })));

      signal.addEventListener("abort", () => xhr.abort(), { once: true });

      xhr.open("POST", `${BASE_URL}/api/storage/uploads`);
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      xhr.setRequestHeader("Authorization", `Bearer ${adminToken}`);
      xhr.send(file);
    });
  } catch (err: unknown) {
    const isNoRetry = typeof err === "object" && err !== null && "noRetry" in err && (err as { noRetry?: boolean }).noRetry;
    if (!isNoRetry && attempt < MAX_RETRIES && !signal.aborted) {
      // Exponential backoff: 2 s, then 4 s
      const delay = 2_000 * Math.pow(2, attempt);
      onProgress(0);
      await new Promise(r => setTimeout(r, delay));
      return uploadFileWithProgress(file, adminToken, onProgress, signal, attempt + 1);
    }
    throw err;
  }
}

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      try {
        results[i] = { status: "fulfilled", value: await tasks[i]() };
      } catch (err) {
        results[i] = { status: "rejected", reason: err };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return results;
}

function FileDropZone({
  adminToken,
  onComplete,
}: {
  adminToken: string;
  onComplete: (paths: string[]) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const updateEntry = useCallback((id: string, patch: Partial<FileEntry>) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
  }, []);

  const addFiles = useCallback((selected: FileList | null) => {
    if (!selected || selected.length === 0) return;
    const valid: FileEntry[] = [];
    const errors: string[] = [];
    const remainingSlots = Math.max(MAX_BATCH_FILES - files.length, 0);

    if (remainingSlots === 0) {
      toast.error(`You can upload up to ${MAX_BATCH_FILES} images in one batch. Upload or clear the current batch first.`);
      return;
    }

    Array.from(selected).slice(0, remainingSlots).forEach(f => {
      if (!f.type.startsWith("image/")) {
        errors.push(`${f.name}: not an image file`);
      } else if (f.size > MAX_FILE_BYTES) {
        errors.push(`${f.name}: exceeds 25 MB limit`);
      } else {
        valid.push({ id: crypto.randomUUID(), file: f, status: "pending", progress: 0, originalSize: f.size });
      }
    });

    if (selected.length > remainingSlots) {
      errors.push(`Only ${remainingSlots} more image${remainingSlots === 1 ? "" : "s"} can be added. Maximum batch size is ${MAX_BATCH_FILES}.`);
    }
    if (errors.length > 0) toast.error(errors.join("\n"));
    if (valid.length > 0) setFiles(prev => [...prev, ...valid]);
  }, [files.length]);

  const removeEntry = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  const pendingCount = files.filter(f => f.status === "pending").length;

  const handleUpload = useCallback(async () => {
    const pending = files.filter(f => f.status === "pending");
    if (pending.length === 0 || uploading) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setUploading(true);

    const tasks = pending.map(entry => async () => {
      // Step 1 — Compress (where applicable)
      updateEntry(entry.id, { status: "compressing", progress: 0 });
      const fileToUpload = await compressImage(entry.file);
      const didCompress = fileToUpload !== entry.file;
      updateEntry(entry.id, {
        uploadFile: didCompress ? fileToUpload : undefined,
        uploadSize: fileToUpload.size,
      });

      // Step 2 — Upload with progress
      updateEntry(entry.id, { status: "uploading", progress: 0 });
      const objectPath = await uploadFileWithProgress(
        fileToUpload,
        adminToken,
        pct => updateEntry(entry.id, { progress: pct }),
        controller.signal,
      );
      updateEntry(entry.id, { status: "done", progress: 100, objectPath });
      return objectPath;
    });

    const results = await runWithConcurrency(tasks, UPLOAD_CONCURRENCY);
    setUploading(false);
    abortRef.current = null;

    results.forEach((r, i) => {
      if (r.status === "rejected") {
        const msg = r.reason instanceof Error ? r.reason.message : "Upload failed";
        updateEntry(pending[i].id, { status: "error", error: msg });
      }
    });

    const collected = results
      .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
      .map(r => r.value);

    if (collected.length > 0) onComplete(collected);
    else if (!controller.signal.aborted) toast.error("All uploads failed. Check the errors and try again.");
  }, [files, uploading, adminToken, onComplete, updateEntry]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return (
    <div className="space-y-3">
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${uploading ? "opacity-60 cursor-not-allowed" : "cursor-pointer"} ${dragging ? "border-accent bg-accent/10" : "border-border hover:border-accent/50 hover:bg-muted/20"}`}
      >
        <input ref={inputRef} type="file" multiple accept="image/*" className="hidden" onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Drop images here or click to browse</p>
        <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WebP, AVIF · up to 25 MB each · up to 50 images at once · auto-compressed before upload</p>
      </div>

      {files.length > 0 && (
        <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
          {files.map(item => {
            const origMB   = (item.originalSize / 1024 / 1024).toFixed(1);
            const uploadMB = item.uploadSize ? (item.uploadSize / 1024 / 1024).toFixed(1) : null;
            const compressed = uploadMB && uploadMB !== origMB;
            return (
              <div key={item.id} className="space-y-0.5">
                <div className="flex items-center gap-2 text-sm">
                  {item.status === "done"        && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
                  {item.status === "error"       && <AlertCircle  className="h-4 w-4 text-red-500 shrink-0" />}
                  {(item.status === "uploading" || item.status === "compressing") &&
                    <div className="h-4 w-4 border-2 border-accent border-t-transparent rounded-full animate-spin shrink-0" />}
                  {item.status === "pending"     && <div className="h-4 w-4 border-2 border-border rounded-full shrink-0" />}
                  <span className="truncate text-foreground flex-1">{item.file.name}</span>
                  <span className="text-muted-foreground text-xs shrink-0 whitespace-nowrap">
                    {item.status === "compressing" ? (
                      <span className="text-accent/70 italic">compressing…</span>
                    ) : compressed ? (
                      <span title={`Compressed from ${origMB} MB`}>
                        <span className="line-through opacity-40">{origMB}</span>→{uploadMB} MB
                      </span>
                    ) : (
                      `${origMB} MB`
                    )}
                  </span>
                  {item.status === "pending" && !uploading && (
                    <button
                      onClick={e => { e.stopPropagation(); removeEntry(item.id); }}
                      className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      title="Remove"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {item.status === "uploading" && (
                  <div className="ml-6 h-1 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all duration-200"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
                {item.status === "error" && item.error && (
                  <p className="ml-6 text-[11px] text-red-500">{item.error}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-2">
        {uploading ? (
          <button
            onClick={handleCancel}
            className="flex-1 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-sm font-semibold hover:bg-red-500/20 transition-colors"
          >
            Cancel Uploads
          </button>
        ) : (
          <button
            onClick={handleUpload}
            disabled={pendingCount === 0}
            className="flex-1 py-2 rounded-lg bg-accent/10 border border-accent/30 text-accent text-sm font-semibold hover:bg-accent/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {`Upload ${pendingCount > 0 ? pendingCount + " " : ""}File${pendingCount !== 1 ? "s" : ""}`}
          </button>
        )}
        {files.length > 0 && !uploading && (
          <button
            onClick={() => setFiles([])}
            className="px-3 py-2 rounded-lg border border-border text-muted-foreground text-sm hover:text-foreground transition-colors"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

function UploadPanel({
  selectedCategory,
  categories,
  adminToken,
  onUploaded,
}: {
  selectedCategory: string;
  categories: string[];
  adminToken: string;
  onUploaded: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(selectedCategory || "service");
  const [customCategory, setCustomCategory] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const [pendingPaths, setPendingPaths] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const { mutateAsync: createImage } = useCreateGalleryImage({
    request: { headers: authHeaders(adminToken) },
  });

  // Keep local category in sync with the parent filter selection
  useEffect(() => {
    if (selectedCategory) setCategory(selectedCategory);
  }, [selectedCategory]);

  const handleComplete = useCallback((paths: string[]) => {
    if (paths.length === 0) return;
    setPendingPaths(prev => [...prev, ...paths]);
    toast.success(`${paths.length} image${paths.length > 1 ? "s" : ""} uploaded! Fill in the details and save.`);
  }, []);

  const handleSave = async () => {
    if (pendingPaths.length === 0) {
      toast.error("Please upload at least one image first.");
      return;
    }
    if (!title.trim()) {
      toast.error("Please enter a title or caption for these images.");
      return;
    }

    const normalizedCategory = category === "__custom__"
      ? customCategory.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      : category;

    if (!normalizedCategory) {
      toast.error("Please choose or enter a category.");
      return;
    }

    setSaving(true);
    try {
      await Promise.all(
        pendingPaths.map((objectPath, i) =>
          createImage({
            data: {
              objectPath,
              title: pendingPaths.length === 1 ? title.trim() : `${title.trim()} ${i + 1}`,
              description: description.trim() || null,
              category: normalizedCategory,
              serviceDate: serviceDate || null,
              altText: title.trim() || null,
              isPublished: true,
              isFeatured: false,
              sortOrder: 0,
            },
          })
        )
      );
      toast.success(`${pendingPaths.length} image${pendingPaths.length > 1 ? "s" : ""} saved to gallery!`);
      setPendingPaths([]);
      setTitle("");
      setDescription("");
      setCustomCategory("");
      setServiceDate("");
      onUploaded();
    } catch {
      toast.error("Failed to save images. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="glass-panel rounded-2xl p-6 border border-accent/20 mb-8"
    >
      <h3 className="font-serif font-bold text-primary text-lg mb-5 flex items-center gap-2">
        <Upload className="h-5 w-5 text-accent" />
        Upload Images
      </h3>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
              Title / Caption <span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Sunday Service — April 2026"
              className={`w-full px-3 py-2 rounded-lg border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 ${!title.trim() && pendingPaths.length > 0 ? "border-red-400" : "border-border"}`}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Description (optional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description of this photo..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
              >
                {categories.map(c => (
                  <option key={c} value={c}>{categoryLabel(c)}</option>
                ))}
                <option value="__custom__">Create new category…</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Service Date</label>
              <input
                type="date"
                value={serviceDate}
                onChange={e => setServiceDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
          </div>

          {category === "__custom__" && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">New Category</label>
              <input
                type="text"
                value={customCategory}
                onChange={e => setCustomCategory(e.target.value)}
                placeholder="e.g. Outreach, Youth Service"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
          )}

          {pendingPaths.length > 0 && (
            <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3">
              <p className="text-sm font-semibold text-green-700 dark:text-green-400">{pendingPaths.length} image{pendingPaths.length > 1 ? "s" : ""} ready to save</p>
              <p className="text-xs text-muted-foreground mt-0.5">Fill in the details above, then click Save to Gallery</p>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving || pendingPaths.length === 0}
            className="w-full py-2.5 rounded-xl bg-accent text-white font-semibold text-sm hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving…" : `Save ${pendingPaths.length > 0 ? pendingPaths.length + " " : ""}Image${pendingPaths.length !== 1 ? "s" : ""} to Gallery`}
          </button>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Select Images (bulk supported)</label>
          <FileDropZone adminToken={adminToken} onComplete={handleComplete} />
        </div>
      </div>
    </motion.div>
  );
}

export default function Gallery() {
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [gridCols, setGridCols] = useState<"3" | "4">("4");
  const [showUpload, setShowUpload] = useState(false);
  const [showAdminPrompt, setShowAdminPrompt] = useState(false);
  const [categories, setCategories] = useState(CATEGORIES.slice(1).map(c => c.value));
  const [page, setPage] = useState(0);
  const LIMIT = 48;

  const galleryAuth = useAdminAuth("gallery");
  const { isAdmin, adminToken } = galleryAuth;

  const { data: images = [], isLoading, refetch } = useListGalleryImages({
    limit: LIMIT,
    offset: page * LIMIT,
    ...(category ? { category } : {}),
    ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
  });

  const adminRequest = adminToken ? { headers: authHeaders(adminToken) } : undefined;
  const { mutateAsync: deleteImage } = useDeleteGalleryImage({ request: adminRequest });
  const { mutateAsync: updateImage } = useUpdateGalleryImage({ request: adminRequest });

  useEffect(() => { document.title = "Gallery | JCTM Digital Sanctuary"; }, []);

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/gallery/categories`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) {
        setCategories(data.filter((item): item is string => typeof item === "string" && item.length > 0));
      }
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => { setPage(0); }, [debouncedSearch]);
  useEffect(() => { setPage(0); }, [category]);

  const handleDelete = async (id: number) => {
    if (!confirm("Remove this image from the gallery?")) return;
    try {
      await deleteImage({ id });
      toast.success("Image removed.");
      refetch();
    } catch (error) {
      if (error instanceof Error && error.message.includes("401")) galleryAuth.logout();
      toast.error("Failed to remove image.");
    }
  };

  const handleToggleFeatured = async (id: number, current: boolean) => {
    try {
      await updateImage({ id, data: { isFeatured: !current } });
      toast.success(current ? "Removed from homepage slideshow." : "Added to homepage slideshow.");
      refetch();
    } catch (error) {
      if (error instanceof Error && error.message.includes("401")) galleryAuth.logout();
      toast.error("Failed to update slideshow status.");
    }
  };

  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);
  const prevImage = () => setLightboxIndex(i => (i != null ? (i - 1 + images.length) % images.length : null));
  const nextImage = () => setLightboxIndex(i => (i != null ? (i + 1) % images.length : null));

  const gridClass = gridCols === "4"
    ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
    : "grid-cols-2 sm:grid-cols-3";

  return (
    <Layout>
      <SEO
        title="Gallery — Jesus Christ Temple Ministry"
        description="Browse photos from JCTM services, crusades, conferences, and special events. A visual testimony of God's faithfulness at Jesus Christ Temple Ministry, Warri Nigeria."
        path="/gallery"
        keywords="JCTM gallery, Jesus Christ Temple Ministry photos, church service photos, JCTM Warri images"
        breadcrumbs={[
          { name: "Home", url: "https://jctm.org.ng/" },
          { name: "Gallery", url: "https://jctm.org.ng/gallery" },
        ]}
      />

      <div className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-10"
        >
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <span className="inline-block text-xs font-semibold text-accent uppercase tracking-widest mb-4 border border-accent/30 rounded-full px-4 py-1.5">Ministry in Pictures</span>
              <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary mb-3">Photo Gallery</h1>
              <p className="text-muted-foreground text-lg max-w-xl">A visual testimony of God's faithfulness — captured moments from our services, crusades, and outreach.</p>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => setGridCols("3")}
                className={`p-2 rounded-lg border transition-colors ${gridCols === "3" ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:text-primary"}`}
                title="3-column grid"
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setGridCols("4")}
                className={`p-2 rounded-lg border transition-colors ${gridCols === "4" ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:text-primary"}`}
                title="4-column grid"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>

              {isAdmin ? (
                <div className="flex items-center gap-2">
                  <AdminBadge role="gallery" auth={galleryAuth} />
                  <button
                    onClick={() => setShowUpload(v => !v)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90 transition-colors"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {showUpload ? "Hide Upload" : "Upload Photos"}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAdminPrompt(v => !v)}
                  className={`p-2 rounded-lg border transition-colors ${showAdminPrompt ? "border-accent/40 bg-accent/5 text-accent" : "border-border text-muted-foreground hover:text-primary"}`}
                  title="Admin access"
                >
                  <Lock className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </motion.div>

        <AnimatePresence>
          {showAdminPrompt && !isAdmin && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 overflow-hidden"
            >
              <div className="max-w-sm">
                <AdminLoginGate role="gallery" auth={galleryAuth} compact>
                  <span />
                </AdminLoginGate>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showUpload && isAdmin && adminToken && (
            <UploadPanel
              selectedCategory={category}
              categories={categories}
              adminToken={adminToken}
              onUploaded={() => { refetch(); loadCategories(); setShowUpload(false); }}
            />
          )}
        </AnimatePresence>

        {/* Search bar */}
        <div className="relative mb-6">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search photos by title, description, or date…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          {[{ value: "", label: "All Photos" }, ...categories.map(value => ({ value, label: categoryLabel(value) }))].map(cat => (
            <button
              key={cat.value}
              onClick={() => { setCategory(cat.value); setPage(0); }}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all duration-200 ${
                category === cat.value
                  ? "bg-accent text-white border-accent shadow-sm shadow-accent/20"
                  : "border-border text-muted-foreground hover:border-accent/40 hover:text-primary"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className={`grid ${gridClass} gap-3`}>
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : images.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-28 text-center"
          >
            <Images className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <p className="text-lg font-semibold text-muted-foreground">
              {debouncedSearch ? "No results found" : "No photos yet"}
            </p>
            <p className="text-sm text-muted-foreground/60 mt-1 max-w-xs">
              {debouncedSearch
                ? `No photos match "${debouncedSearch}". Try a different search term.`
                : isAdmin
                  ? 'Click \u201cUpload Photos\u201d above to add images to the gallery.'
                  : "Check back soon — new photos will appear here after each service."}
            </p>
          </motion.div>
        ) : (
          <>
            <div className={`grid ${gridClass} gap-3`}>
              {images.map((img, i) => (
                <GalleryCard
                  key={img.id}
                  image={img}
                  index={i}
                  onClick={() => openLightbox(i)}
                  isAdmin={isAdmin}
                  onDelete={handleDelete}
                  onToggleFeatured={handleToggleFeatured}
                />
              ))}
            </div>

            {images.length === LIMIT && (
              <div className="mt-10 flex justify-center">
                <button
                  onClick={() => setPage(p => p + 1)}
                  className="px-8 py-3 rounded-xl border border-accent/30 text-accent font-semibold hover:bg-accent/10 transition-colors"
                >
                  Load More
                </button>
              </div>
            )}

            <p className="text-center text-xs text-muted-foreground mt-6">
              Showing {images.length} photo{images.length !== 1 ? "s" : ""}
              {debouncedSearch ? ` for "${debouncedSearch}"` : ""}
              {category ? ` in "${categoryLabel(category)}"` : ""}
            </p>
          </>
        )}
      </div>

      <AnimatePresence>
        {lightboxIndex !== null && (
          <Lightbox
            images={images}
            index={lightboxIndex}
            onClose={closeLightbox}
            onPrev={prevImage}
            onNext={nextImage}
          />
        )}
      </AnimatePresence>
    </Layout>
  );
}

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useListGalleryImages, useDeleteGalleryImage, useUpdateGalleryImage } from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { motion, AnimatePresence } from "framer-motion";
import {
  Images, X, ChevronLeft, ChevronRight, Upload, Trash2,
  ZoomIn, Grid3X3, LayoutGrid, Lock, Calendar, Star, Search,
  CheckCircle2, AlertCircle, RefreshCw, CheckSquare,
  SquareCheck, ChevronDown, Loader2, ShieldCheck, Download,
} from "lucide-react";
import MediaDownloadSheet from "@/components/MediaDownloadSheet";
import { toast } from "sonner";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { AdminLoginGate, AdminBadge } from "@/components/admin/AdminLoginGate";

// ─── Utilities ─────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function useInView(rootMargin = "300px 0px") {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) { setVisible(true); return; }
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);
  return { ref, visible };
}

// ─── Constants ─────────────────────────────────────────────────────────────

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
const SITE_URL = "https://jctm.org.ng";
const GALLERY_PATH = "/gallery";
const GALLERY_URL = `${SITE_URL}${GALLERY_PATH}`;
const GALLERY_SEO_TITLE = "JCTM Photo Gallery — Services, Crusades & Ministry Moments";
const GALLERY_SEO_DESCRIPTION = "Browse the official Jesus Christ Temple Ministry photo gallery with Sunday services, crusades, conferences, prayer nights, outreach moments, and visual testimonies from JCTM Warri, Nigeria.";
const GALLERY_SEO_KEYWORDS = "JCTM photo gallery, Jesus Christ Temple Ministry gallery, JCTM photos, Temple TV pictures, JCTM Warri images, church photos Warri Nigeria, Sunday service photos, crusade photos Nigeria, Prophet Amos Evomobor ministry pictures, Correction Mandate gallery, ministry in pictures";

const MAX_FILE_BYTES     = 25 * 1024 * 1024; // 25 MB — matches server hard cap
const MAX_BATCH_FILES    = 100;               // Enterprise-grade: 100 images per batch
const UPLOAD_CONCURRENCY = 8;                 // Parallel upload workers
const MAX_COMPRESS_DIM   = 1920;             // Longest edge before JPEG re-encode (px)
const COMPRESS_QUALITY   = 0.87;             // JPEG quality (0–1)

// ─── SEO helpers ───────────────────────────────────────────────────────────

function imageUrl(objectPath: string) {
  return `${BASE_URL}/api/storage${objectPath}`;
}

function absoluteImageUrl(objectPath?: string | null) {
  if (!objectPath) return `${SITE_URL}/opengraph.jpg`;
  if (/^https?:\/\//i.test(objectPath)) return objectPath;
  return `${SITE_URL}/api/storage${objectPath}`;
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

function categoryLabel(value: string) {
  return CATEGORIES.find(c => c.value === value)?.label
    ?? value.split(/[-_\s]+/).filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function buildGalleryJsonLd(images: GalleryImg[], categories: string[]) {
  const featuredImage = images[0];
  const imageObjects = images.slice(0, 24).map((image, index) => {
    const name = image.title || `${categoryLabel(image.category)} photo from Jesus Christ Temple Ministry`;
    const description = image.description || image.altText || `A ${categoryLabel(image.category).toLowerCase()} moment from Jesus Christ Temple Ministry, Warri Nigeria.`;
    return {
      "@type": "ImageObject",
      "@id": `${GALLERY_URL}#image-${image.id}`,
      "contentUrl": absoluteImageUrl(image.objectPath),
      "thumbnailUrl": absoluteImageUrl(image.thumbnailPath ?? image.objectPath),
      "url": absoluteImageUrl(image.objectPath),
      "name": name,
      "caption": description,
      "description": description,
      "uploadDate": new Date(image.createdAt).toISOString(),
      "datePublished": image.serviceDate || new Date(image.createdAt).toISOString().split("T")[0],
      "inLanguage": "en-NG",
      "representativeOfPage": index === 0,
      "about": ["Jesus Christ Temple Ministry", "JCTM Warri", categoryLabel(image.category)],
      "creator": { "@type": "Organization", "name": "Jesus Christ Temple Ministry (JCTM)", "url": SITE_URL },
      "creditText": "Jesus Christ Temple Ministry (JCTM)",
      "copyrightHolder": { "@type": "Organization", "name": "Jesus Christ Temple Ministry (JCTM)" },
      "contentLocation": {
        "@type": "Place",
        "name": "Jesus Christ Temple Ministry, Warri",
        "address": { "@type": "PostalAddress", "addressLocality": "Warri", "addressRegion": "Delta State", "addressCountry": "NG" },
      },
    };
  });

  return [
    {
      "@context": "https://schema.org",
      "@type": ["CollectionPage", "ImageGallery"],
      "@id": `${GALLERY_URL}#webpage`,
      "url": GALLERY_URL,
      "name": GALLERY_SEO_TITLE,
      "headline": "JCTM Ministry in Pictures",
      "description": GALLERY_SEO_DESCRIPTION,
      "inLanguage": "en-NG",
      "isPartOf": { "@type": "WebSite", "@id": `${SITE_URL}#website`, "name": "JCTM Digital Sanctuary", "url": SITE_URL },
      "publisher": {
        "@type": "ReligiousOrganization",
        "name": "Jesus Christ Temple Ministry (JCTM)",
        "url": SITE_URL,
        "logo": { "@type": "ImageObject", "url": `${SITE_URL}/favicon.png` },
      },
      "primaryImageOfPage": featuredImage
        ? { "@type": "ImageObject", "url": absoluteImageUrl(featuredImage.thumbnailPath ?? featuredImage.objectPath), "caption": featuredImage.description || featuredImage.altText || featuredImage.title }
        : { "@type": "ImageObject", "url": `${SITE_URL}/opengraph.jpg`, "caption": "Jesus Christ Temple Ministry official gallery" },
      "about": ["Jesus Christ Temple Ministry", "Temple TV", "JCTM Warri", "Correction Mandate", ...categories.slice(0, 12).map(categoryLabel)],
      "breadcrumb": {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE_URL },
          { "@type": "ListItem", "position": 2, "name": "Gallery", "item": GALLERY_URL },
        ],
      },
      "mainEntity": {
        "@type": "ItemList",
        "name": "JCTM photo gallery images",
        "numberOfItems": imageObjects.length,
        "itemListElement": imageObjects.map((image, index) => ({ "@type": "ListItem", "position": index + 1, "item": image })),
      },
      "speakable": { "@type": "SpeakableSpecification", "cssSelector": ["h1", ".gallery-seo-summary"] },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "@id": `${GALLERY_URL}#faq`,
      "mainEntity": [
        { "@type": "Question", "name": "What can I find in the JCTM photo gallery?", "acceptedAnswer": { "@type": "Answer", "text": "The JCTM photo gallery features official ministry photos from Sunday services, crusades, conferences, prayer meetings, outreach events, and special moments at Jesus Christ Temple Ministry in Warri, Nigeria." } },
        { "@type": "Question", "name": "Are new JCTM ministry photos added regularly?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. Published gallery photos are updated by the ministry team and also feed the Ministry in Pictures slideshow on the JCTM Digital Sanctuary homepage." } },
        { "@type": "Question", "name": "Can I search the JCTM gallery?", "acceptedAnswer": { "@type": "Answer", "text": "Visitors can search photos by title, description, service date, and category, including Sunday Service, Crusade, Conference, Outreach, Prayer Night, and Special Events." } },
      ],
    },
  ];
}

// ─── Types ─────────────────────────────────────────────────────────────────

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

type FileEntryStatus = "pending" | "compressing" | "uploading" | "done" | "error";

type FileEntry = {
  id: string;
  file: File;
  uploadFile?: File;
  status: FileEntryStatus;
  progress: number;
  error?: string;
  objectPath?: string;
  originalSize: number;
  uploadSize?: number;
  fingerprint: string;   // dedup key: fast hash of name+size+lastModified
  attempt: number;       // current retry attempt count
};

function thumbnailUrl(image: GalleryImg) {
  return imageUrl(image.thumbnailPath ?? image.objectPath);
}

// ─── Duplicate detection ────────────────────────────────────────────────────
// Fast fingerprint using file metadata — no file reading required.
// Catches exact re-adds (same name + size + modification time).
function fileFingerprint(file: File): string {
  return `${file.name}::${file.size}::${file.lastModified}`;
}

// ─── Client-side image compression ─────────────────────────────────────────
async function compressImage(file: File): Promise<File> {
  if (file.type === "image/heic" || file.type === "image/heif" || file.type === "image/gif") {
    return file;
  }
  if (file.size <= 500 * 1024) return file;

  return new Promise<File>((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { naturalWidth: w, naturalHeight: h } = img;
      const longest = Math.max(w, h);
      if (longest > MAX_COMPRESS_DIM) {
        const scale = MAX_COMPRESS_DIM / longest;
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => {
        if (!blob || blob.size >= file.size) { resolve(file); return; }
        const newName = file.name.replace(/\.(png|webp|bmp|tiff?)$/i, ".jpg");
        resolve(new File([blob], newName, { type: "image/jpeg" }));
      }, "image/jpeg", COMPRESS_QUALITY);
    };

    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
    img.src = objectUrl;
  });
}

// ─── XHR upload with progress & auto-retry ─────────────────────────────────
async function uploadFileWithProgress(
  file: File,
  adminToken: string,
  onProgress: (pct: number) => void,
  signal: AbortSignal,
  attempt = 0,
): Promise<string> {
  const MAX_RETRIES = 3;

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
            reject(Object.assign(new Error(err.error ?? `Server error ${xhr.status}`), { noRetry: xhr.status >= 400 && xhr.status < 500 }));
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
      const delay = 1_500 * Math.pow(2, attempt);
      onProgress(0);
      await new Promise(r => setTimeout(r, delay));
      return uploadFileWithProgress(file, adminToken, onProgress, signal, attempt + 1);
    }
    throw err;
  }
}

// ─── Concurrency pool ───────────────────────────────────────────────────────
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let index = 0;
  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      try { results[i] = { status: "fulfilled", value: await tasks[i]() }; }
      catch (err) { results[i] = { status: "rejected", reason: err }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return results;
}

// ─── Lightbox ───────────────────────────────────────────────────────────────

function Lightbox({ images, index, onClose, onPrev, onNext }: {
  images: GalleryImg[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const img = images[index];
  const [downloadOpen, setDownloadOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (downloadOpen) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, onPrev, onNext, downloadOpen]);

  if (!img) return null;

  const srcUrl = /^https?:\/\//i.test(img.objectPath)
    ? img.objectPath
    : `${absoluteImageUrl(img.objectPath)}`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Top-right controls */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); setDownloadOpen(true); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors text-sm font-medium"
          title="Download this photo"
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Download</span>
        </button>
        <button onClick={onClose} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
          <X className="h-6 w-6" />
        </button>
      </div>

      <button onClick={(e) => { e.stopPropagation(); onPrev(); }} className="absolute left-4 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
        <ChevronLeft className="h-6 w-6" />
      </button>
      <button onClick={(e) => { e.stopPropagation(); onNext(); }} className="absolute right-4 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
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
                <Calendar className="h-3 w-3" />{img.serviceDate}
              </p>
            )}
          </div>
        )}
        <p className="text-white/30 text-xs">{index + 1} / {images.length}</p>
      </motion.div>

      {/* Download sheet */}
      <MediaDownloadSheet
        open={downloadOpen}
        onClose={() => setDownloadOpen(false)}
        type="gallery_image"
        sourceId={srcUrl}
        title={img.title || img.altText || "JCTM Ministry Photo"}
        thumbnailUrl={imageUrl(img.thumbnailPath ?? img.objectPath)}
      />
    </motion.div>
  );
}

// ─── Bulk delete confirmation modal ────────────────────────────────────────

function BulkDeleteModal({
  count,
  onConfirm,
  onCancel,
  isDeleting,
}: {
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.18 }}
        className="bg-card border border-border rounded-2xl shadow-2xl p-6 w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
            <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-base">Delete {count} Photo{count !== 1 ? "s" : ""}?</h3>
            <p className="text-muted-foreground text-sm">This action cannot be undone.</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
          You are about to permanently remove <strong className="text-foreground">{count} image{count !== 1 ? "s" : ""}</strong> from the gallery and delete them from storage. This cannot be reversed.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isDeleting ? <><Loader2 className="h-4 w-4 animate-spin" />Deleting…</> : `Delete ${count} Photo${count !== 1 ? "s" : ""}`}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Bulk actions toolbar ────────────────────────────────────────────────────

function BulkActionsBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onDelete,
  onExit,
}: {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onDelete: () => void;
  onExit: () => void;
}) {
  const allSelected = selectedCount === totalCount && totalCount > 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.22 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3 rounded-2xl bg-card border border-border shadow-2xl shadow-black/20 backdrop-blur-md"
    >
      {/* Selection indicator */}
      <div className="flex items-center gap-2 pr-3 border-r border-border">
        <div className="w-6 h-6 rounded bg-accent/15 border border-accent/30 flex items-center justify-center">
          <CheckSquare className="h-3.5 w-3.5 text-accent" />
        </div>
        <span className="text-sm font-semibold text-foreground whitespace-nowrap">
          {selectedCount} selected
        </span>
      </div>

      {/* Select all / deselect */}
      <button
        onClick={allSelected ? onDeselectAll : onSelectAll}
        className="text-xs font-semibold text-accent hover:text-accent/80 transition-colors whitespace-nowrap"
      >
        {allSelected ? "Deselect all" : `Select all ${totalCount}`}
      </button>

      {/* Delete selected */}
      <button
        onClick={onDelete}
        disabled={selectedCount === 0}
        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete {selectedCount > 0 ? selectedCount : ""} Photo{selectedCount !== 1 ? "s" : ""}
      </button>

      {/* Exit selection mode */}
      <button
        onClick={onExit}
        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        title="Exit selection mode"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
}

// ─── Gallery card ───────────────────────────────────────────────────────────

function GalleryCard({
  image,
  index,
  onClick,
  isAdmin,
  onDelete,
  onToggleFeatured,
  selectMode,
  isSelected,
  onSelect,
}: {
  image: GalleryImg;
  index: number;
  onClick: () => void;
  isAdmin: boolean;
  onDelete: (id: number) => void;
  onToggleFeatured: (id: number, current: boolean) => void;
  selectMode: boolean;
  isSelected: boolean;
  onSelect: (id: number) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const { ref: containerRef, visible } = useInView();

  const handleClick = useCallback(() => {
    if (selectMode) { onSelect(image.id); return; }
    onClick();
  }, [selectMode, onSelect, onClick, image.id]);

  return (
    <motion.figure
      ref={containerRef}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.4) }}
      className={`relative group overflow-hidden rounded-xl bg-muted/30 cursor-pointer aspect-square transition-all duration-200 ${isSelected ? "ring-2 ring-accent ring-offset-2 ring-offset-background" : ""} ${selectMode ? "cursor-pointer" : ""}`}
      onClick={handleClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); handleClick(); }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${selectMode ? (isSelected ? "Deselect" : "Select") : "Open"} ${image.title || categoryLabel(image.category)} photo`}
      aria-pressed={selectMode ? isSelected : undefined}
      itemScope
      itemType="https://schema.org/ImageObject"
    >
      <meta itemProp="contentUrl" content={imageUrl(image.objectPath)} />
      <meta itemProp="name" content={image.title || `${categoryLabel(image.category)} photo`} />

      {(!loaded || !visible) && !error && (
        <div className="absolute inset-0 animate-pulse bg-muted/50 rounded-xl" />
      )}
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/30 rounded-xl text-muted-foreground text-sm">
          <Images className="h-8 w-8 opacity-30" />
        </div>
      ) : visible ? (
        <img
          src={thumbnailUrl(image)}
          alt={image.altText ?? image.title}
          loading="lazy"
          decoding="async"
          width={640}
          height={640}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${loaded ? "opacity-100" : "opacity-0"} ${isSelected ? "brightness-75" : ""}`}
          itemProp="thumbnailUrl"
        />
      ) : null}

      {/* Hover overlay (non-select mode) */}
      {!selectMode && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              {image.title && <p className="text-white text-xs font-semibold truncate">{image.title}</p>}
              {image.serviceDate && <p className="text-white/60 text-[10px] truncate">{image.serviceDate}</p>}
            </div>
            <ZoomIn className="h-4 w-4 text-white shrink-0 ml-2" />
          </div>
        </div>
      )}

      {/* Selection overlay */}
      {selectMode && (
        <div className={`absolute inset-0 flex items-start justify-start p-2.5 transition-colors duration-150 ${isSelected ? "bg-accent/20" : "bg-transparent group-hover:bg-black/20"}`}>
          <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all duration-150 shadow-sm ${isSelected ? "bg-accent border-accent" : "bg-white/80 border-white/60 backdrop-blur-sm group-hover:border-accent/70"}`}>
            {isSelected && <CheckCircle2 className="h-4 w-4 text-white" strokeWidth={3} />}
          </div>
        </div>
      )}

      {/* Featured badge */}
      {image.isFeatured && (
        <div className="absolute top-2 left-2 z-10">
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/90 text-white text-[10px] font-bold uppercase tracking-wide">
            <Star className="h-2.5 w-2.5 fill-white" /> Featured
          </span>
        </div>
      )}

      {/* Admin controls (non-select mode) */}
      {isAdmin && !selectMode && (
        <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFeatured(image.id, image.isFeatured); }}
            className={`p-1.5 rounded-full text-white transition-colors ${image.isFeatured ? "bg-amber-500/90 hover:bg-amber-500" : "bg-black/50 hover:bg-amber-500/80"}`}
            title={image.isFeatured ? "Remove homepage highlight" : "Highlight in homepage slideshow"}
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

      <figcaption className="sr-only" itemProp="caption">
        {image.description || image.altText || `${image.title || "JCTM ministry photo"} from ${categoryLabel(image.category)}`}
      </figcaption>
    </motion.figure>
  );
}

// ─── Upload queue entry ─────────────────────────────────────────────────────

function UploadQueueEntry({
  item,
  uploading,
  onRemove,
  onRetry,
}: {
  item: FileEntry;
  uploading: boolean;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  const origMB   = (item.originalSize / 1024 / 1024).toFixed(1);
  const uploadMB = item.uploadSize ? (item.uploadSize / 1024 / 1024).toFixed(1) : null;
  const compressed = uploadMB && uploadMB !== origMB;

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2 text-sm">
        {item.status === "done"        && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
        {item.status === "error"       && <AlertCircle  className="h-4 w-4 text-red-500 shrink-0" />}
        {(item.status === "uploading" || item.status === "compressing") &&
          <Loader2 className="h-4 w-4 text-accent animate-spin shrink-0" />}
        {item.status === "pending"     && <div className="h-4 w-4 border-2 border-border rounded-full shrink-0" />}

        <span className="truncate text-foreground flex-1 text-xs">{item.file.name}</span>

        <span className="text-muted-foreground text-xs shrink-0 whitespace-nowrap">
          {item.status === "compressing" ? (
            <span className="text-accent/70 italic">compressing…</span>
          ) : compressed ? (
            <span title={`Compressed from ${origMB} MB`}>
              <span className="line-through opacity-40">{origMB}</span>→{uploadMB} MB
            </span>
          ) : `${origMB} MB`}
        </span>

        {/* Retry button for failed */}
        {item.status === "error" && !uploading && (
          <button
            onClick={() => onRetry(item.id)}
            className="p-0.5 rounded text-accent hover:text-accent/80 transition-colors shrink-0"
            title="Retry"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Remove button for pending */}
        {item.status === "pending" && !uploading && (
          <button
            onClick={() => onRemove(item.id)}
            className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
            title="Remove"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Progress bar */}
      {item.status === "uploading" && (
        <div className="ml-6 h-1 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-200"
            style={{ width: `${item.progress}%` }}
          />
        </div>
      )}

      {/* Error message */}
      {item.status === "error" && item.error && (
        <p className="ml-6 text-[11px] text-red-500">{item.error}</p>
      )}

      {/* Retry count indicator */}
      {item.attempt > 0 && item.status !== "done" && (
        <p className="ml-6 text-[10px] text-amber-500/70">Attempt {item.attempt + 1}</p>
      )}
    </div>
  );
}

// ─── File drop zone ─────────────────────────────────────────────────────────

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
  const [showAll, setShowAll] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const updateEntry = useCallback((id: string, patch: Partial<FileEntry>) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
  }, []);

  // Compute stats
  const stats = useMemo(() => ({
    pending:   files.filter(f => f.status === "pending").length,
    uploading: files.filter(f => f.status === "uploading" || f.status === "compressing").length,
    done:      files.filter(f => f.status === "done").length,
    error:     files.filter(f => f.status === "error").length,
    total:     files.length,
  }), [files]);

  const addFiles = useCallback((selected: FileList | null) => {
    if (!selected || selected.length === 0) return;
    const valid: FileEntry[] = [];
    const errors: string[] = [];
    const dupes: string[] = [];

    // Build a set of existing fingerprints to detect duplicates
    const existingPrints = new Set(files.map(f => f.fingerprint));
    const remainingSlots = Math.max(MAX_BATCH_FILES - files.length, 0);

    if (remainingSlots === 0) {
      toast.error(`Maximum batch size of ${MAX_BATCH_FILES} images reached. Upload or clear first.`);
      return;
    }

    Array.from(selected).slice(0, remainingSlots).forEach(f => {
      if (!f.type.startsWith("image/")) {
        errors.push(`${f.name}: not an image file`);
      } else if (f.size > MAX_FILE_BYTES) {
        errors.push(`${f.name}: exceeds 25 MB limit`);
      } else {
        const fp = fileFingerprint(f);
        if (existingPrints.has(fp)) {
          dupes.push(f.name);
        } else {
          existingPrints.add(fp);
          valid.push({ id: crypto.randomUUID(), file: f, status: "pending", progress: 0, originalSize: f.size, fingerprint: fp, attempt: 0 });
        }
      }
    });

    if (selected.length > remainingSlots) {
      errors.push(`Batch limit: only ${remainingSlots} more slot${remainingSlots === 1 ? "" : "s"} available (max ${MAX_BATCH_FILES}).`);
    }
    if (dupes.length > 0) toast.warning(`${dupes.length} duplicate${dupes.length > 1 ? "s" : ""} skipped: ${dupes.slice(0, 3).join(", ")}${dupes.length > 3 ? ` + ${dupes.length - 3} more` : ""}`);
    if (errors.length > 0) toast.error(errors.slice(0, 3).join("\n") + (errors.length > 3 ? `\n…and ${errors.length - 3} more` : ""));
    if (valid.length > 0) setFiles(prev => [...prev, ...valid]);
  }, [files]);

  const removeEntry = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  const retryEntry = useCallback((id: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: "pending", progress: 0, error: undefined } : f));
  }, []);

  const clearDone = useCallback(() => {
    setFiles(prev => prev.filter(f => f.status !== "done"));
  }, []);

  const clearAll = useCallback(() => {
    setFiles([]);
    setShowAll(false);
  }, []);

  const handleUpload = useCallback(async () => {
    const pending = files.filter(f => f.status === "pending");
    if (pending.length === 0 || uploading) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setUploading(true);

    const tasks = pending.map(entry => async () => {
      updateEntry(entry.id, { status: "compressing", progress: 0 });
      const fileToUpload = await compressImage(entry.file);
      const didCompress = fileToUpload !== entry.file;
      updateEntry(entry.id, { uploadFile: didCompress ? fileToUpload : undefined, uploadSize: fileToUpload.size });

      updateEntry(entry.id, { status: "uploading", progress: 0 });
      const objectPath = await uploadFileWithProgress(
        fileToUpload, adminToken,
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
        updateEntry(pending[i].id, { status: "error", error: msg, attempt: (pending[i].attempt ?? 0) + 1 });
      }
    });

    const collected = results
      .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
      .map(r => r.value);

    if (collected.length > 0) onComplete(collected);
    else if (!controller.signal.aborted) toast.error("All uploads failed. Check errors and try again.");
  }, [files, uploading, adminToken, onComplete, updateEntry]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // Decide which entries to show in the list
  const PREVIEW_COUNT = 8;
  const displayedFiles = showAll ? files : files.slice(-PREVIEW_COUNT);
  const hiddenCount = files.length - PREVIEW_COUNT;

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${uploading ? "opacity-60 cursor-not-allowed" : "cursor-pointer"} ${dragging ? "border-accent bg-accent/10" : "border-border hover:border-accent/50 hover:bg-muted/20"}`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={e => { addFiles(e.target.files); e.target.value = ""; }}
        />
        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Drop images here or click to browse</p>
        <p className="text-xs text-muted-foreground mt-1">
          PNG, JPG, WebP, AVIF · up to 25 MB each · up to {MAX_BATCH_FILES} images per batch
        </p>
        <p className="text-xs text-muted-foreground/70 mt-0.5">
          Auto-compressed · Duplicate-checked · {UPLOAD_CONCURRENCY} parallel uploads
        </p>
      </div>

      {/* Stats bar */}
      {files.length > 0 && (
        <div className="flex items-center gap-3 px-1 text-xs">
          <span className="text-muted-foreground font-medium">{files.length} file{files.length !== 1 ? "s" : ""}</span>
          {stats.done > 0   && <span className="text-green-600 dark:text-green-400 font-semibold">{stats.done} done</span>}
          {stats.uploading > 0 && <span className="text-accent font-semibold">{stats.uploading} uploading</span>}
          {stats.pending > 0 && <span className="text-muted-foreground">{stats.pending} queued</span>}
          {stats.error > 0  && <span className="text-red-500 font-semibold">{stats.error} failed</span>}
          <div className="flex-1" />
          {stats.done > 0 && !uploading && (
            <button onClick={clearDone} className="text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors">
              Clear done
            </button>
          )}
        </div>
      )}

      {/* File queue */}
      {files.length > 0 && (
        <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
          {!showAll && hiddenCount > 0 && (
            <button
              onClick={() => setShowAll(true)}
              className="w-full text-xs text-muted-foreground hover:text-foreground py-1 flex items-center justify-center gap-1 transition-colors"
            >
              <ChevronDown className="h-3.5 w-3.5" />
              Show {hiddenCount} earlier file{hiddenCount !== 1 ? "s" : ""}
            </button>
          )}
          {displayedFiles.map(item => (
            <UploadQueueEntry
              key={item.id}
              item={item}
              uploading={uploading}
              onRemove={removeEntry}
              onRetry={retryEntry}
            />
          ))}
        </div>
      )}

      {/* Action buttons */}
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
            disabled={stats.pending === 0}
            className="flex-1 py-2 rounded-lg bg-accent/10 border border-accent/30 text-accent text-sm font-semibold hover:bg-accent/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {stats.pending > 0
              ? `Upload ${stats.pending} File${stats.pending !== 1 ? "s" : ""}`
              : "Upload Files"}
          </button>
        )}
        {files.length > 0 && !uploading && (
          <button
            onClick={clearAll}
            className="px-3 py-2 rounded-lg border border-border text-muted-foreground text-sm hover:text-foreground transition-colors"
          >
            Clear All
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Upload panel ───────────────────────────────────────────────────────────

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

  useEffect(() => {
    if (selectedCategory) setCategory(selectedCategory);
  }, [selectedCategory]);

  const handleComplete = useCallback((paths: string[]) => {
    if (paths.length === 0) return;
    setPendingPaths(prev => [...prev, ...paths]);
    toast.success(`${paths.length} image${paths.length > 1 ? "s" : ""} uploaded! Fill in the details and save.`);
  }, []);

  const handleSave = async () => {
    if (pendingPaths.length === 0) { toast.error("Please upload at least one image first."); return; }
    if (!title.trim()) { toast.error("Please enter a title for these images."); return; }

    const normalizedCategory = category === "__custom__"
      ? customCategory.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      : category;

    if (!normalizedCategory) { toast.error("Please choose or enter a category."); return; }

    setSaving(true);
    try {
      // Use the bulk create endpoint for efficiency (single round-trip for up to 100 images)
      const payload = {
        images: pendingPaths.map((objectPath, i) => ({
          objectPath,
          title: pendingPaths.length === 1 ? title.trim() : `${title.trim()} ${i + 1}`,
          description: description.trim() || null,
          category: normalizedCategory,
          serviceDate: serviceDate || null,
          altText: title.trim() || null,
          isPublished: true,
          isFeatured: false,
          sortOrder: 0,
        })),
      };

      const res = await fetch(`${BASE_URL}/api/gallery/bulk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `Server error ${res.status}`);
      }

      toast.success(`${pendingPaths.length} image${pendingPaths.length > 1 ? "s" : ""} saved to gallery!`);
      setPendingPaths([]);
      setTitle("");
      setDescription("");
      setCustomCategory("");
      setServiceDate("");
      onUploaded();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save images. Please try again.");
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
        <span className="ml-auto text-xs font-normal text-muted-foreground bg-muted/40 rounded-full px-2.5 py-1 border border-border/50">
          Up to {MAX_BATCH_FILES} per batch
        </span>
      </h3>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Metadata form */}
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
              placeholder="Brief description of these photos…"
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
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">New Category Name</label>
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
              <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                {pendingPaths.length} image{pendingPaths.length > 1 ? "s" : ""} ready to save
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Fill in the details above, then click Save to Gallery</p>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving || pendingPaths.length === 0}
            className="w-full py-2.5 rounded-xl bg-accent text-white font-semibold text-sm hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {saving
              ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</>
              : `Save ${pendingPaths.length > 0 ? pendingPaths.length + " " : ""}Image${pendingPaths.length !== 1 ? "s" : ""} to Gallery`}
          </button>
        </div>

        {/* Drop zone */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
            Select Images
          </label>
          <FileDropZone adminToken={adminToken} onComplete={handleComplete} />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Gallery SSE hook ───────────────────────────────────────────────────────
// Subscribes to /api/gallery/stream and calls onUpdate when the gallery changes.

function useGallerySSE(onUpdate: (action: string, data: Record<string, unknown>) => void) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    let es: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    function connect() {
      try {
        es = new EventSource(`${BASE_URL}/api/gallery/stream`);

        es.addEventListener("message", (e) => {
          try {
            const msg = JSON.parse(e.data) as { type: string; data: Record<string, unknown> };
            if (msg.type === "gallery_updated") {
              onUpdateRef.current(msg.data.action as string, msg.data);
            }
          } catch {
            // ignore malformed messages
          }
        });

        es.addEventListener("open", () => { attempts = 0; });

        es.addEventListener("error", () => {
          es?.close();
          es = null;
          attempts++;
          const delay = Math.min(1000 * Math.pow(2, attempts - 1), 30_000);
          retryTimeout = setTimeout(connect, delay);
        });
      } catch {
        // SSE not available — silently skip
      }
    }

    connect();
    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
      es?.close();
    };
  }, []);
}

// ─── Main Gallery page ──────────────────────────────────────────────────────

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
  const gridTopRef = useRef<HTMLDivElement>(null);

  // Multi-select state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

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

  const galleryJsonLd = useMemo(() => buildGalleryJsonLd(images, categories), [images, categories]);
  const socialImage = images[0]
    ? absoluteImageUrl(images[0].thumbnailPath ?? images[0].objectPath)
    : `${SITE_URL}/opengraph.jpg`;

  // ─── SSE-based real-time updates ───────────────────────────────────────
  useGallerySSE(useCallback((action, data) => {
    if (action === "thumbnail_ready" || action === "created" || action === "bulk_deleted") {
      refetch();
    }
    if (action === "bulk_deleted" && data.deletedIds && Array.isArray(data.deletedIds)) {
      // Remove deleted IDs from selection if any
      setSelectedIds(prev => {
        const next = new Set(prev);
        (data.deletedIds as number[]).forEach(id => next.delete(id));
        return next;
      });
    }
  }, [refetch]));

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/gallery/categories`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) {
        setCategories(data.filter((item): item is string => typeof item === "string" && item.length > 0));
      }
    } catch { return; }
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);
  useEffect(() => { setPage(0); }, [debouncedSearch]);
  useEffect(() => { setPage(0); }, [category]);
  useEffect(() => {
    if (gridTopRef.current) gridTopRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [page]);

  // Exit select mode when not admin or when navigating
  useEffect(() => {
    if (!isAdmin) { setSelectMode(false); setSelectedIds(new Set()); }
  }, [isAdmin]);
  useEffect(() => {
    if (selectMode) { setSelectedIds(new Set()); }
  }, [category, debouncedSearch, page, selectMode]);

  // ─── Single delete ────────────────────────────────────────────────────
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

  // ─── Toggle featured ──────────────────────────────────────────────────
  const handleToggleFeatured = async (id: number, current: boolean) => {
    try {
      await updateImage({ id, data: { isFeatured: !current } });
      toast.success(current ? "Removed homepage highlight." : "Highlighted in homepage slideshow.");
      refetch();
    } catch (error) {
      if (error instanceof Error && error.message.includes("401")) galleryAuth.logout();
      toast.error("Failed to update slideshow status.");
    }
  };

  // ─── Selection handlers ───────────────────────────────────────────────
  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(images.map((img: { id: number }) => img.id)));
  }, [images]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const enterSelectMode = useCallback(() => {
    setSelectMode(true);
    setShowUpload(false);
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  // ─── Bulk delete ──────────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0 || !adminToken) return;
    setIsBulkDeleting(true);
    try {
      const res = await fetch(`${BASE_URL}/api/gallery/bulk`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `Server error ${res.status}`);
      }

      const result = await res.json() as { deleted: number };
      toast.success(`${result.deleted} photo${result.deleted !== 1 ? "s" : ""} deleted.`);
      setShowBulkDeleteModal(false);
      setSelectedIds(new Set());
      setSelectMode(false);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk delete failed. Please try again.");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // ─── Lightbox ─────────────────────────────────────────────────────────
  const openLightbox = (index: number) => { if (!selectMode) setLightboxIndex(index); };
  const closeLightbox = () => setLightboxIndex(null);
  const prevImage = () => setLightboxIndex(i => (i != null ? (i - 1 + images.length) % images.length : null));
  const nextImage = () => setLightboxIndex(i => (i != null ? (i + 1) % images.length : null));

  const gridClass = gridCols === "4"
    ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
    : "grid-cols-2 sm:grid-cols-3";

  return (
    <Layout>
      <SEO
        title={GALLERY_SEO_TITLE}
        description={GALLERY_SEO_DESCRIPTION}
        path={GALLERY_PATH}
        image={socialImage}
        keywords={GALLERY_SEO_KEYWORDS}
        jsonLd={galleryJsonLd}
        breadcrumbs={[
          { name: "Home", url: `${SITE_URL}/` },
          { name: "Gallery", url: GALLERY_URL },
        ]}
      />

      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-10"
        >
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="max-w-3xl">
              <span className="inline-block text-xs font-semibold text-accent uppercase tracking-widest mb-4 border border-accent/30 rounded-full px-4 py-1.5">Ministry in Pictures</span>
              <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary mb-3">Photo Gallery</h1>
              <p className="gallery-seo-summary text-muted-foreground text-lg max-w-2xl">
                Explore the official JCTM photo gallery: Sunday services, crusades, conferences, prayer nights, outreach, and special ministry moments from Jesus Christ Temple Ministry in Warri, Nigeria.
              </p>
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl" aria-label="Gallery highlights">
                {[
                  ["Official", "JCTM archive"],
                  [`${categories.length || CATEGORIES.length - 1}+`, "Photo categories"],
                  ["Warri", "Delta State"],
                  ["Temple TV", "Ministry media"],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-2xl border border-border/70 bg-card/60 px-4 py-3 shadow-sm">
                    <p className="text-lg font-bold text-primary">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {/* Grid toggles */}
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
                <div className="flex items-center gap-2 flex-wrap">
                  <AdminBadge role="gallery" auth={galleryAuth} />

                  {/* Multi-select toggle */}
                  {!selectMode ? (
                    <button
                      onClick={enterSelectMode}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-muted-foreground text-xs font-semibold hover:text-primary hover:border-accent/40 transition-colors"
                      title="Enter multi-select mode"
                    >
                      <SquareCheck className="h-3.5 w-3.5" />
                      Select
                    </button>
                  ) : (
                    <button
                      onClick={exitSelectMode}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-accent/40 bg-accent/5 text-accent text-xs font-semibold transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                      Exit Select
                    </button>
                  )}

                  {/* Upload toggle */}
                  {!selectMode && (
                    <button
                      onClick={() => setShowUpload(v => !v)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90 transition-colors"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {showUpload ? "Hide Upload" : "Upload Photos"}
                    </button>
                  )}
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

        {/* Admin login gate */}
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

        {/* Upload panel */}
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

        {/* Selection mode info bar */}
        <AnimatePresence>
          {selectMode && isAdmin && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 overflow-hidden"
            >
              <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-accent/5 border border-accent/20 text-sm">
                <ShieldCheck className="h-4 w-4 text-accent shrink-0" />
                <span className="text-muted-foreground">
                  <strong className="text-foreground">Selection mode.</strong>{" "}
                  Click images to select them, then delete the selection.
                  {selectedIds.size > 0 && <span className="text-accent font-semibold ml-2">{selectedIds.size} selected.</span>}
                </span>
                <div className="flex-1" />
                <button onClick={selectAll} className="text-xs text-accent hover:text-accent/80 font-semibold transition-colors">
                  Select all {images.length}
                </button>
                {selectedIds.size > 0 && (
                  <button
                    onClick={() => setShowBulkDeleteModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete {selectedIds.size}
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Grid scroll anchor */}
        <div ref={gridTopRef} className="scroll-mt-20" />

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search photos by title, description, or date…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors"
            aria-label="Search JCTM gallery photos"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors" aria-label="Clear search">
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
              aria-pressed={category === cat.value}
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

        {/* Grid */}
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
                  ? 'Click "Upload Photos" above to add images to the gallery.'
                  : "Check back soon — new photos will appear here after each service."}
            </p>
          </motion.div>
        ) : (
          <>
            <section className={`grid ${gridClass} gap-3`} aria-label="JCTM ministry photo gallery">
              {images.map((img: GalleryImg, i: number) => (
                <GalleryCard
                  key={img.id}
                  image={img}
                  index={i}
                  onClick={() => openLightbox(i)}
                  isAdmin={isAdmin}
                  onDelete={handleDelete}
                  onToggleFeatured={handleToggleFeatured}
                  selectMode={selectMode}
                  isSelected={selectedIds.has(img.id)}
                  onSelect={toggleSelect}
                />
              ))}
            </section>

            {/* Pagination */}
            {(page > 0 || images.length === LIMIT) && (
              <div className="mt-10 flex flex-col items-center gap-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setPage(p => p - 1)}
                    disabled={page === 0}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border text-sm font-semibold text-primary/80 hover:border-accent/50 hover:text-accent hover:bg-accent/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </button>
                  <span className="text-sm font-semibold text-muted-foreground border border-border/60 rounded-xl px-5 py-2.5 min-w-[100px] text-center select-none">
                    Page {page + 1}
                  </span>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={images.length < LIMIT}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border text-sm font-semibold text-primary/80 hover:border-accent/50 hover:text-accent hover:bg-accent/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Showing {page * LIMIT + 1}–{page * LIMIT + images.length} photo{images.length !== 1 ? "s" : ""}
                  {debouncedSearch ? ` for "${debouncedSearch}"` : ""}
                  {category ? ` in "${categoryLabel(category)}"` : ""}
                </p>
              </div>
            )}

            {page === 0 && images.length < LIMIT && (
              <p className="text-center text-xs text-muted-foreground mt-6">
                Showing {images.length} photo{images.length !== 1 ? "s" : ""}
                {debouncedSearch ? ` for "${debouncedSearch}"` : ""}
                {category ? ` in "${categoryLabel(category)}"` : ""}
              </p>
            )}
          </>
        )}
      </div>

      {/* Floating bulk actions toolbar */}
      <AnimatePresence>
        {selectMode && isAdmin && (
          <BulkActionsBar
            selectedCount={selectedIds.size}
            totalCount={images.length}
            onSelectAll={selectAll}
            onDeselectAll={deselectAll}
            onDelete={() => { if (selectedIds.size > 0) setShowBulkDeleteModal(true); }}
            onExit={exitSelectMode}
          />
        )}
      </AnimatePresence>

      {/* Bulk delete confirmation modal */}
      <AnimatePresence>
        {showBulkDeleteModal && (
          <BulkDeleteModal
            count={selectedIds.size}
            onConfirm={handleBulkDelete}
            onCancel={() => setShowBulkDeleteModal(false)}
            isDeleting={isBulkDeleting}
          />
        )}
      </AnimatePresence>

      {/* Lightbox */}
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

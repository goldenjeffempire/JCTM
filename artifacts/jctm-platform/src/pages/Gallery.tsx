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

function FileDropZone({
  adminToken,
  onComplete,
}: {
  adminToken: string;
  onComplete: (paths: string[]) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<Array<{ file: File; status: "pending" | "uploading" | "done" | "error" }>>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((selected: FileList | null) => {
    if (!selected || selected.length === 0) return;
    const imgs = Array.from(selected).filter(f => f.type.startsWith("image/"));
    if (imgs.length === 0) { toast.error("Please select image files only."); return; }
    setFiles(prev => [...prev, ...imgs.map(f => ({ file: f, status: "pending" as const }))]);
  }, []);

  const pendingCount = files.filter(f => f.status === "pending").length;

  const handleUpload = useCallback(async () => {
    const pending = files.filter(f => f.status === "pending");
    if (pending.length === 0 || uploading) return;
    setUploading(true);
    const collected: string[] = [];
    for (const item of pending) {
      setFiles(prev => prev.map(f => f.file === item.file ? { ...f, status: "uploading" } : f));
      try {
        const res = await fetch(`${BASE_URL}/api/storage/uploads`, {
          method: "POST",
          headers: { "Content-Type": item.file.type, "Authorization": `Bearer ${adminToken}` },
          body: item.file,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? "Upload failed");
        }
        const { objectPath } = await res.json();
        collected.push(objectPath);
        setFiles(prev => prev.map(f => f.file === item.file ? { ...f, status: "done" } : f));
      } catch {
        setFiles(prev => prev.map(f => f.file === item.file ? { ...f, status: "error" } : f));
      }
    }
    setUploading(false);
    if (collected.length > 0) onComplete(collected);
  }, [files, uploading, adminToken, onComplete]);

  return (
    <div className="space-y-3">
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${dragging ? "border-accent bg-accent/10" : "border-border hover:border-accent/50 hover:bg-muted/20"}`}
      >
        <input ref={inputRef} type="file" multiple accept="image/*" className="hidden" onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Drop images here or click to browse</p>
        <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WebP, AVIF · up to 20 MB each · bulk supported</p>
      </div>

      {files.length > 0 && (
        <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
          {files.map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              {item.status === "done" && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
              {item.status === "error" && <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />}
              {item.status === "uploading" && <div className="h-4 w-4 border-2 border-accent border-t-transparent rounded-full animate-spin shrink-0" />}
              {item.status === "pending" && <div className="h-4 w-4 border-2 border-border rounded-full shrink-0" />}
              <span className="truncate text-foreground">{item.file.name}</span>
              <span className="text-muted-foreground text-xs shrink-0 ml-auto">{(item.file.size / 1024).toFixed(0)} KB</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleUpload}
          disabled={uploading || pendingCount === 0}
          className="flex-1 py-2 rounded-lg bg-accent/10 border border-accent/30 text-accent text-sm font-semibold hover:bg-accent/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {uploading ? "Uploading…" : `Upload ${pendingCount > 0 ? pendingCount + " " : ""}File${pendingCount !== 1 ? "s" : ""}`}
        </button>
        {files.length > 0 && !uploading && (
          <button onClick={() => setFiles([])} className="px-3 py-2 rounded-lg border border-border text-muted-foreground text-sm hover:text-foreground transition-colors">
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
    setSaving(true);
    try {
      const normalizedCategory = category === "__custom__"
        ? customCategory.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
        : category;

      if (!normalizedCategory) {
        toast.error("Please choose or enter a category.");
        return;
      }

      await Promise.all(
        pendingPaths.map((objectPath, i) =>
          createImage({
            data: {
              objectPath,
              title: pendingPaths.length === 1 ? title : `${title} ${i + 1}`,
              description: description || null,
              category: normalizedCategory,
              serviceDate: serviceDate || null,
              altText: title || null,
              isPublished: true,
              isFeatured: true,
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
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Title / Caption</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Sunday Service — April 2026"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
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

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

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

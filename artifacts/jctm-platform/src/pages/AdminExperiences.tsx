import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, CheckCircle2, XCircle, Star, StarOff, Trash2,
  Clock, User, MapPin, Mail, Video,
  RefreshCw, FileDown, Play, X, Loader2,
} from "lucide-react";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminLoginGate } from "@/components/admin/AdminLoginGate";
import { useAdminAuth } from "@/hooks/useAdminAuth";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Types ─────────────────────────────────────────────────────────────────────
type ExperienceStatus = "pending" | "approved" | "rejected";

interface ExperienceSubmission {
  id: number;
  full_name: string;
  email: string;
  location: string;
  photo_path: string | null;
  video_path: string | null;
  video_filename: string | null;
  status: ExperienceStatus;
  is_featured: boolean;
  admin_notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: ExperienceStatus }) {
  const cfg = {
    pending:  { label: "Pending",  cls: "bg-amber-900/50 text-amber-300 border-amber-700/50" },
    approved: { label: "Approved", cls: "bg-green-900/50 text-green-300 border-green-700/50" },
    rejected: { label: "Rejected", cls: "bg-red-900/50 text-red-400 border-red-700/50" },
  }[status] ?? { label: status, cls: "bg-purple-900/50 text-purple-300 border-purple-700/50" };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ── Video Preview Modal ───────────────────────────────────────────────────────
function PreviewModal({
  submission, onClose,
}: {
  submission: ExperienceSubmission; onClose: () => void;
}) {
  const videoUrl = submission.video_path
    ? `${BASE}/api/storage/objects/${submission.video_path.replace(/^\/objects\//, "")}`
    : null;
  const photoUrl = submission.photo_path
    ? `${BASE}/api/storage/objects/${submission.photo_path.replace(/^\/objects\//, "")}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-[#0d0618] border border-purple-800/50 rounded-3xl overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-purple-900/50">
          <div className="flex items-center gap-3">
            {photoUrl ? (
              <img src={photoUrl} alt={submission.full_name} className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-purple-900 flex items-center justify-center">
                <User className="w-5 h-5 text-purple-400" />
              </div>
            )}
            <div>
              <p className="font-semibold text-white">{submission.full_name}</p>
              <p className="text-xs text-purple-400">{submission.location}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-purple-500 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Video */}
        <div className="p-5 space-y-4">
          {videoUrl ? (
            <video
              src={videoUrl}
              controls
              className="w-full rounded-xl max-h-80 bg-black"
              preload="metadata"
            />
          ) : (
            <div className="w-full h-40 rounded-xl bg-purple-950 flex items-center justify-center">
              <p className="text-purple-500 text-sm">No video available</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-purple-400"><Mail className="w-4 h-4" /><span className="truncate">{submission.email}</span></div>
            <div className="flex items-center gap-2 text-purple-400"><Clock className="w-4 h-4" /><span>{new Date(submission.createdAt).toLocaleDateString()}</span></div>
          </div>

          {videoUrl && (
            <a
              href={videoUrl}
              download={submission.video_filename ?? "experience-video.mp4"}
              className="inline-flex items-center gap-2 text-sm text-purple-400 hover:text-purple-200 transition-colors"
            >
              <Download className="w-4 h-4" /> Download Video
            </a>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────
function SubmissionRow({
  submission, adminToken, onRefresh,
}: {
  submission: ExperienceSubmission; adminToken: string; onRefresh: () => void;
}) {
  const queryClient = useQueryClient();
  const [showPreview, setShowPreview] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState(submission.admin_notes ?? "");

  const mutate = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch(`${BASE}/api/experiences/${submission.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${adminToken}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
    return res.json();
  }, [submission.id, adminToken]);

  const setStatus = async (status: ExperienceStatus) => {
    try {
      await mutate({ status });
      toast.success(`Submission ${status}.`);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  const toggleFeatured = async () => {
    try {
      await mutate({ isFeatured: !submission.is_featured });
      toast.success(submission.is_featured ? "Removed from featured." : "Marked as featured!");
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  const saveNotes = async () => {
    try {
      await mutate({ adminNotes: notes });
      toast.success("Notes saved.");
      setNotesOpen(false);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  const deleteSubmission = async () => {
    if (!confirm(`Delete submission from ${submission.full_name}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${BASE}/api/experiences/${submission.id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${adminToken}` },
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      toast.success("Submission deleted.");
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const photoUrl = submission.photo_path
    ? `${BASE}/api/storage/objects/${submission.photo_path.replace(/^\/objects\//, "")}`
    : null;

  return (
    <>
      <AnimatePresence>
        {showPreview && <PreviewModal submission={submission} onClose={() => setShowPreview(false)} />}
      </AnimatePresence>

      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="rounded-2xl border border-purple-900/40 bg-purple-950/20 p-4 space-y-3"
      >
        {/* Top row */}
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {photoUrl ? (
              <img src={photoUrl} alt={submission.full_name} className="w-12 h-12 rounded-full object-cover border border-purple-800" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-purple-900/60 flex items-center justify-center border border-purple-800">
                <User className="w-5 h-5 text-purple-400" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-white truncate">{submission.full_name}</span>
              <StatusBadge status={submission.status} />
              {submission.is_featured && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-yellow-900/50 text-yellow-300 border border-yellow-700/50">
                  <Star className="w-3 h-3" /> Featured
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-purple-400">
              <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{submission.email}</span>
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{submission.location}</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(submission.createdAt).toLocaleDateString()}</span>
            </div>
            {submission.video_filename && (
              <p className="text-xs text-purple-500 mt-0.5 flex items-center gap-1"><Video className="w-3 h-3" />{submission.video_filename}</p>
            )}
            {submission.admin_notes && (
              <p className="text-xs text-purple-400 italic mt-1">Note: {submission.admin_notes}</p>
            )}
          </div>
        </div>

        {/* Notes (expandable) */}
        <AnimatePresence>
          {notesOpen && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="flex gap-2 pt-1">
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add admin notes…"
                  className="bg-purple-950 border-purple-700 text-white text-sm"
                />
                <Button size="sm" onClick={saveNotes} className="bg-purple-700 hover:bg-purple-600 text-white">Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setNotesOpen(false)} className="text-purple-400">Cancel</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowPreview(true)}
            className="border-purple-700 text-purple-300 hover:bg-purple-900/50 h-8 text-xs">
            <Play className="w-3.5 h-3.5 mr-1" /> Preview
          </Button>

          {submission.status !== "approved" && (
            <Button size="sm" onClick={() => setStatus("approved")}
              className="bg-green-800/60 hover:bg-green-700/70 text-green-300 border border-green-700/50 h-8 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
            </Button>
          )}
          {submission.status !== "rejected" && (
            <Button size="sm" onClick={() => setStatus("rejected")}
              className="bg-red-900/40 hover:bg-red-800/60 text-red-400 border border-red-800/50 h-8 text-xs">
              <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
            </Button>
          )}
          {submission.status === "approved" && (
            <Button size="sm" onClick={toggleFeatured}
              className={`h-8 text-xs border ${submission.is_featured ? "bg-yellow-900/30 border-yellow-700/50 text-yellow-400 hover:bg-yellow-900/50" : "bg-purple-900/30 border-purple-700/50 text-purple-300 hover:bg-purple-900/50"}`}>
              {submission.is_featured ? <><StarOff className="w-3.5 h-3.5 mr-1" /> Unfeature</> : <><Star className="w-3.5 h-3.5 mr-1" /> Feature</>}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setNotesOpen((o) => !o)}
            className="text-purple-500 hover:text-purple-300 h-8 text-xs">
            Notes
          </Button>
          <Button size="sm" variant="ghost" onClick={deleteSubmission}
            className="text-red-500 hover:text-red-400 hover:bg-red-950/30 h-8 text-xs ml-auto">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </motion.div>
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
function ExperiencesAdminPanel({ adminToken }: { adminToken: string }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | ExperienceStatus>("");
  const [page, setPage] = useState(0);
  const limit = 20;

  const params = new URLSearchParams({
    all: "true",
    limit: String(limit),
    offset: String(page * limit),
    ...(search ? { search } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  });

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin-experiences", search, statusFilter, page],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/experiences?${params}`, {
        headers: { "Authorization": `Bearer ${adminToken}` },
      });
      if (!res.ok) throw new Error("Failed to load submissions");
      return res.json() as Promise<{ submissions: ExperienceSubmission[]; total: number; limit: number; offset: number }>;
    },
    refetchInterval: 30_000,
  });

  const submissions = data?.submissions ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  const exportCsv = () => {
    const link = document.createElement("a");
    link.href = `${BASE}/api/experiences/export.csv`;
    link.download = "experiences.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const counts = {
    pending: submissions.filter((s) => s.status === "pending").length,
    approved: submissions.filter((s) => s.status === "approved").length,
    rejected: submissions.filter((s) => s.status === "rejected").length,
    featured: submissions.filter((s) => s.is_featured).length,
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Pending", value: counts.pending, color: "text-amber-400", bg: "bg-amber-950/30 border-amber-900/40" },
          { label: "Approved", value: counts.approved, color: "text-green-400", bg: "bg-green-950/30 border-green-900/40" },
          { label: "Rejected", value: counts.rejected, color: "text-red-400", bg: "bg-red-950/30 border-red-900/40" },
          { label: "Featured", value: counts.featured, color: "text-yellow-400", bg: "bg-yellow-950/30 border-yellow-900/40" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`rounded-2xl border p-4 text-center ${bg}`}>
            <p className={`text-2xl font-black ${color}`}>{value}</p>
            <p className="text-xs text-purple-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500" />
          <Input
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search by name, email, location…"
            className="pl-10 bg-purple-950/60 border-purple-700 text-white placeholder:text-purple-600"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as "" | ExperienceStatus); setPage(0); }}
          className="bg-purple-950 border border-purple-700 text-purple-200 rounded-xl px-3 py-2 text-sm"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <Button size="sm" variant="outline" onClick={() => refetch()}
          className="border-purple-700 text-purple-300 hover:bg-purple-900/50">
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
        <Button size="sm" variant="outline" onClick={exportCsv}
          className="border-purple-700 text-purple-300 hover:bg-purple-900/50">
          <FileDown className="w-4 h-4 mr-1.5" /> Export CSV
        </Button>
      </div>

      {/* Total */}
      <p className="text-sm text-purple-500">{total} submission{total !== 1 ? "s" : ""}{statusFilter ? ` · ${statusFilter}` : ""}{search ? ` · matching "${search}"` : ""}</p>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
        </div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-16 text-purple-600">
          <Video className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No submissions found</p>
          <p className="text-sm mt-1">
            {statusFilter || search ? "Try adjusting your filters." : "Submissions will appear here once people share their experiences."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {submissions.map((s) => (
              <SubmissionRow
                key={s.id}
                submission={s}
                adminToken={adminToken}
                onRefresh={() => queryClient.invalidateQueries({ queryKey: ["admin-experiences"] })}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
            className="border-purple-700 text-purple-300 hover:bg-purple-900/50">
            Previous
          </Button>
          <span className="text-sm text-purple-400">Page {page + 1} of {totalPages}</span>
          <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            className="border-purple-700 text-purple-300 hover:bg-purple-900/50">
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

export default function AdminExperiences() {
  const auth = useAdminAuth("gallery");

  return (
    <>
      <Helmet>
        <title>Experience Submissions — Admin | JCTM</title>
      </Helmet>

      <AdminLoginGate role="gallery" auth={auth}>
        <div className="min-h-screen bg-gradient-to-b from-[#0a0415] to-[#060210] px-4 py-8">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-500 flex items-center justify-center shadow-lg shadow-purple-900/40">
                <Video className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white">Experience Submissions</h1>
                <p className="text-sm text-purple-400">Review, moderate and feature member testimonies</p>
              </div>
            </div>

            {auth.isAdmin && <ExperiencesAdminPanel adminToken={auth.adminToken} />}
          </div>
        </div>
      </AdminLoginGate>
    </>
  );
}

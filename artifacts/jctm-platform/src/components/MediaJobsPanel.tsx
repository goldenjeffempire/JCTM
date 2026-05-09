/**
 * MediaJobsPanel — Floating global download queue
 *
 * Shows all active and recently completed media conversion jobs.
 * Opens when there are active downloads; can be toggled manually.
 * Persists job IDs in session storage so it survives page navigation.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, CheckCircle2, AlertCircle, Loader2, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.VITE_API_URL ?? "";

type JobStatus = "queued" | "processing" | "ready" | "failed";

interface PanelJob {
  jobId: string;
  status: JobStatus;
  progress: number;
  title: string | null;
  fileSizeFormatted: string | null;
  format: string;
  downloadUrl: string | null;
  error: string | null;
  thumbnailUrl: string | null;
  type: string;
}

const SESSION_KEY = "jctm_active_jobs";

function loadStoredJobIds(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "[]") as string[];
  } catch { return []; }
}

function saveJobIds(ids: string[]): void {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(ids.slice(0, 20))); } catch { /* non-fatal */ }
}

export function useMediaJobsPanel() {
  const [trackedIds, setTrackedIds] = useState<string[]>(loadStoredJobIds);

  function trackJob(jobId: string) {
    setTrackedIds(prev => {
      const next = [jobId, ...prev.filter(id => id !== jobId)].slice(0, 20);
      saveJobIds(next);
      return next;
    });
  }

  function removeJob(jobId: string) {
    setTrackedIds(prev => {
      const next = prev.filter(id => id !== jobId);
      saveJobIds(next);
      return next;
    });
  }

  return { trackedIds, trackJob, removeJob };
}

// ─── Global singleton event bus ───────────────────────────────────────────────

type TrackCallback = (jobId: string) => void;
const listeners = new Set<TrackCallback>();

export function emitTrackJob(jobId: string) {
  for (const cb of listeners) cb(jobId);
}

// ─── Panel component ──────────────────────────────────────────────────────────

export function MediaJobsPanel() {
  const [jobs, setJobs] = useState<PanelJob[]>([]);
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const sseRefs = useRef<Map<string, EventSource>>(new Map());
  const jobIdsRef = useRef<Set<string>>(new Set());

  // Restore tracked jobs from session on mount
  useEffect(() => {
    const stored = loadStoredJobIds();
    if (stored.length) {
      Promise.all(
        stored.map(id =>
          fetch(`${BASE}/api/media/jobs/${id}`)
            .then(r => r.ok ? r.json() as Promise<PanelJob> : null)
            .catch(() => null)
        )
      ).then(results => {
        const valid = results.filter(Boolean) as PanelJob[];
        if (valid.length) {
          setJobs(valid);
          setOpen(true);
          // Resume SSE for in-progress jobs
          valid.forEach(j => {
            if (j.status === "queued" || j.status === "processing") {
              subscribeToJob(j.jobId);
            }
          });
        }
      });
    }

    // Listen for new jobs to track
    const cb: TrackCallback = (jobId: string) => {
      if (jobIdsRef.current.has(jobId)) return;
      jobIdsRef.current.add(jobId);

      // Fetch initial state
      fetch(`${BASE}/api/media/jobs/${jobId}`)
        .then(r => r.ok ? r.json() as Promise<PanelJob> : null)
        .catch(() => null)
        .then(j => {
          if (!j) return;
          setJobs(prev => [j, ...prev.filter(x => x.jobId !== jobId)].slice(0, 15));
          setOpen(true);
          setMinimized(false);
          saveJobIds([jobId, ...loadStoredJobIds()].slice(0, 20));
          if (j.status === "queued" || j.status === "processing") subscribeToJob(jobId);
        });
    };

    listeners.add(cb);
    return () => {
      listeners.delete(cb);
      sseRefs.current.forEach(es => es.close());
      sseRefs.current.clear();
    };
  }, []);

  const subscribeToJob = useCallback((jobId: string) => {
    if (sseRefs.current.has(jobId)) return;

    const es = new EventSource(`${BASE}/api/media/progress/${jobId}`);
    sseRefs.current.set(jobId, es);

    es.addEventListener("progress", (evt) => {
      try {
        const update = JSON.parse((evt as MessageEvent).data) as PanelJob;
        setJobs(prev =>
          prev.map(j => j.jobId === jobId ? { ...j, ...update } : j)
        );
        if (update.status === "ready" || update.status === "failed") {
          es.close();
          sseRefs.current.delete(jobId);
        }
      } catch { /* ignore */ }
    });

    es.onerror = () => {
      es.close();
      sseRefs.current.delete(jobId);
    };
  }, []);

  function removeJob(jobId: string) {
    sseRefs.current.get(jobId)?.close();
    sseRefs.current.delete(jobId);
    jobIdsRef.current.delete(jobId);
    setJobs(prev => {
      const next = prev.filter(j => j.jobId !== jobId);
      saveJobIds(next.map(j => j.jobId));
      return next;
    });
  }

  function clearAll() {
    sseRefs.current.forEach(es => es.close());
    sseRefs.current.clear();
    jobIdsRef.current.clear();
    setJobs([]);
    saveJobIds([]);
    setOpen(false);
  }

  function triggerDownload(job: PanelJob) {
    if (!job.downloadUrl) return;
    const a = document.createElement("a");
    a.href = `${BASE}${job.downloadUrl}`;
    a.download = job.title ?? "jctm_media";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  const activeCount = jobs.filter(j => j.status === "queued" || j.status === "processing").length;
  const readyCount = jobs.filter(j => j.status === "ready").length;

  if (!open || jobs.length === 0) return null;

  return (
    <div className="fixed bottom-20 right-4 z-[60] w-80 max-w-[calc(100vw-2rem)]">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/8">
            <div className="relative">
              <Download className="h-4 w-4 text-primary" />
              {activeCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-3 w-3 rounded-full bg-amber-400 flex items-center justify-center">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping absolute" />
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 relative" />
                </span>
              )}
            </div>
            <span className="text-white text-sm font-semibold flex-1">
              Downloads
              {activeCount > 0 && (
                <span className="ml-1.5 text-amber-400/80 text-xs font-normal">{activeCount} converting</span>
              )}
              {activeCount === 0 && readyCount > 0 && (
                <span className="ml-1.5 text-emerald-400/80 text-xs font-normal">{readyCount} ready</span>
              )}
            </span>
            <button
              onClick={() => setMinimized(m => !m)}
              className="p-1 rounded-lg hover:bg-white/10 transition-colors text-white/50 hover:text-white/80"
              title={minimized ? "Expand" : "Minimize"}
            >
              {minimized ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={clearAll}
              className="p-1 rounded-lg hover:bg-white/10 transition-colors text-white/50 hover:text-white/80"
              title="Clear all"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Job list */}
          <AnimatePresence>
            {!minimized && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: "auto" }}
                exit={{ height: 0 }}
                className="overflow-hidden"
              >
                <div className="max-h-72 overflow-y-auto divide-y divide-white/5 custom-scrollbar">
                  {jobs.map(job => (
                    <div key={job.jobId} className="flex items-center gap-3 px-4 py-3 group">
                      {/* Thumbnail or icon */}
                      <div className="flex-shrink-0 w-9 h-9 rounded-lg overflow-hidden bg-white/8 flex items-center justify-center">
                        {job.thumbnailUrl ? (
                          <img src={job.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Download className="h-4 w-4 text-white/40" />
                        )}
                      </div>

                      {/* Info + progress */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-medium truncate leading-tight">
                          {job.title ?? "JCTM Media"}
                        </p>
                        <div className="mt-1">
                          {(job.status === "queued" || job.status === "processing") && (
                            <>
                              <div className="flex items-center gap-1.5 text-[10px] text-white/40 mb-1">
                                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                <span>{job.status === "queued" ? "Queued…" : `Converting ${job.progress}%`}</span>
                              </div>
                              <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                                <motion.div
                                  className="h-full bg-gradient-to-r from-primary to-violet-500 rounded-full"
                                  animate={{ width: `${job.progress}%` }}
                                  transition={{ duration: 0.3, ease: "easeOut" }}
                                />
                              </div>
                            </>
                          )}
                          {job.status === "ready" && (
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                              <span className="text-[10px] text-emerald-400/80 truncate">
                                {job.fileSizeFormatted ?? "Ready"} · {job.format?.toUpperCase()}
                              </span>
                            </div>
                          )}
                          {job.status === "failed" && (
                            <div className="flex items-center gap-1.5">
                              <AlertCircle className="h-3 w-3 text-red-400 flex-shrink-0" />
                              <span className="text-[10px] text-red-400/80 truncate">Failed</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex-shrink-0 flex items-center gap-1">
                        {job.status === "ready" && job.downloadUrl && (
                          <button
                            onClick={() => triggerDownload(job)}
                            className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400 transition-colors"
                            title="Download"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => removeJob(job.jobId)}
                          className={cn(
                            "p-1.5 rounded-lg transition-colors text-white/30 hover:text-white/60",
                            "opacity-0 group-hover:opacity-100",
                          )}
                          title="Remove"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

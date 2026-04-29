/**
 * EventPromoPreviewToggle — admin-only floating control to preview the
 * full event-promotion UI (banners, sticky bar, popup, crusade section)
 * in any phase (Upcoming / Live / Ended) on demand, without changing the
 * database or waiting for the real start_at timestamp.
 *
 * Activation:
 *   - Visit any page with `?previewMode=on` to enable the floating toggle.
 *     The flag persists in localStorage so it appears on every page until
 *     disabled with `?previewMode=off`.
 *
 * Behavior:
 *   - Writes the chosen phase into `localStorage[jctm:event-phase-override]`.
 *   - Dispatches `jctm:event-preview-changed` so `useActiveEventPromotion`
 *     re-derives instantly across the whole app.
 *   - Shows a slim red top strip while an override is active so the operator
 *     never forgets they're in preview mode.
 *
 * The override is a pure client-side display layer — it does not touch the
 * database, the cron, the push notifications, or any other user's session.
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, X, ChevronDown, ChevronUp } from "lucide-react";
import {
  PHASE_OVERRIDE_STORAGE_KEY,
  PHASE_OVERRIDE_EVENT,
} from "@/hooks/useActiveEventPromotion";

const ENABLE_KEY = "jctm:event-preview-toggle-enabled";

type Phase = "live" | "upcoming" | "ended" | null;

function readPhase(): Phase {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(PHASE_OVERRIDE_STORAGE_KEY);
  return v === "live" || v === "upcoming" || v === "ended" ? v : null;
}

function writePhase(phase: Phase) {
  if (typeof window === "undefined") return;
  if (phase === null) {
    window.localStorage.removeItem(PHASE_OVERRIDE_STORAGE_KEY);
  } else {
    window.localStorage.setItem(PHASE_OVERRIDE_STORAGE_KEY, phase);
  }
  window.dispatchEvent(new CustomEvent(PHASE_OVERRIDE_EVENT));
}

function isToolEnabled(): boolean {
  if (typeof window === "undefined") return false;
  // URL param activation/deactivation, then read the persisted flag.
  try {
    const params = new URLSearchParams(window.location.search);
    const v = params.get("previewMode");
    if (v === "on") {
      window.localStorage.setItem(ENABLE_KEY, "1");
    } else if (v === "off") {
      window.localStorage.removeItem(ENABLE_KEY);
      window.localStorage.removeItem(PHASE_OVERRIDE_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent(PHASE_OVERRIDE_EVENT));
    }
  } catch {
    /* ignore */
  }
  return window.localStorage.getItem(ENABLE_KEY) === "1";
}

export function EventPromoPreviewToggle() {
  const [enabled, setEnabled] = useState<boolean>(() => isToolEnabled());
  const [phase, setPhase] = useState<Phase>(() => readPhase());
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("jctm:event-preview-collapsed") === "1";
  });

  // Re-evaluate URL params on every render path change
  useEffect(() => {
    setEnabled(isToolEnabled());
  }, []);

  // Stay in sync if another tab toggles the override
  useEffect(() => {
    const onChange = () => setPhase(readPhase());
    window.addEventListener(PHASE_OVERRIDE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(PHASE_OVERRIDE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const apply = (next: Phase) => {
    writePhase(next);
    setPhase(next);
  };

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      window.localStorage.setItem("jctm:event-preview-collapsed", next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  const disableTool = () => {
    try {
      window.localStorage.removeItem(ENABLE_KEY);
      window.localStorage.removeItem(PHASE_OVERRIDE_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent(PHASE_OVERRIDE_EVENT));
    } catch {
      /* ignore */
    }
    setEnabled(false);
    setPhase(null);
  };

  if (!enabled) return null;

  const phaseLabel =
    phase === "live" ? "LIVE" : phase === "upcoming" ? "UPCOMING" : phase === "ended" ? "ENDED" : "OFF";

  return (
    <>
      {/* Top warning strip — visible on every page when override is active */}
      <AnimatePresence>
        {phase && (
          <motion.div
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -30, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-[10000] bg-red-600 text-white text-xs font-bold tracking-wider py-1.5 px-3 flex items-center justify-center gap-2 shadow-lg"
            data-testid="event-preview-active-strip"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>EVENT PREVIEW MODE: {phaseLabel}</span>
            <span className="opacity-70">— UI is simulated for admin preview only</span>
            <button
              onClick={() => apply(null)}
              className="ml-3 underline hover:no-underline"
            >
              exit preview
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating control — bottom right */}
      <div
        className="fixed bottom-4 right-4 z-[10000] select-none"
        data-testid="event-preview-toggle"
      >
        <motion.div
          layout
          className="rounded-2xl border border-white/15 bg-slate-900/95 backdrop-blur shadow-2xl text-white text-sm overflow-hidden"
          style={{ minWidth: collapsed ? 0 : 230 }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-slate-950/60">
            <Eye className="h-4 w-4 text-yellow-300" />
            <span className="font-bold uppercase tracking-wider text-xs">Event Preview</span>
            <span
              className={
                "ml-auto text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full " +
                (phase === "live"
                  ? "bg-red-500/20 text-red-200 border border-red-400/40"
                  : phase === "upcoming"
                    ? "bg-yellow-400/20 text-yellow-200 border border-yellow-400/40"
                    : phase === "ended"
                      ? "bg-slate-500/20 text-slate-300 border border-slate-400/40"
                      : "bg-emerald-500/20 text-emerald-200 border border-emerald-400/40")
              }
            >
              {phaseLabel}
            </span>
            <button
              onClick={toggleCollapsed}
              className="text-white/60 hover:text-white"
              aria-label={collapsed ? "Expand" : "Collapse"}
            >
              {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            <button
              onClick={disableTool}
              className="text-white/60 hover:text-white"
              aria-label="Disable preview tool"
              title="Disable preview toggle (use ?previewMode=on to bring it back)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          {!collapsed && (
            <div className="p-3 space-y-2">
              <p className="text-[11px] text-white/60 leading-snug">
                Force every event-promo surface into a phase. Affects your tab only.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <PhaseButton current={phase} target={null} onClick={() => apply(null)} label="Real" tone="emerald" />
                <PhaseButton current={phase} target="upcoming" onClick={() => apply("upcoming")} label="Upcoming" tone="yellow" />
                <PhaseButton current={phase} target="live" onClick={() => apply("live")} label="🔴 Live" tone="red" />
                <PhaseButton current={phase} target="ended" onClick={() => apply("ended")} label="Ended" tone="slate" />
              </div>
              <p className="text-[10px] text-white/40 pt-1 border-t border-white/10">
                Override is client-side only — DB, cron, and other users are unaffected.
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </>
  );
}

function PhaseButton({
  current, target, onClick, label, tone,
}: {
  current: Phase;
  target: Phase;
  onClick: () => void;
  label: string;
  tone: "red" | "yellow" | "slate" | "emerald";
}) {
  const active = current === target;
  const tones: Record<typeof tone, { active: string; idle: string }> = {
    red:     { active: "bg-red-500/30 border-red-400/60 text-red-100",         idle: "bg-white/5 border-white/10 hover:bg-red-500/15 hover:border-red-400/40" },
    yellow:  { active: "bg-yellow-400/30 border-yellow-300/60 text-yellow-100", idle: "bg-white/5 border-white/10 hover:bg-yellow-400/15 hover:border-yellow-300/40" },
    slate:   { active: "bg-slate-500/30 border-slate-400/60 text-slate-100",   idle: "bg-white/5 border-white/10 hover:bg-slate-500/15 hover:border-slate-400/40" },
    emerald: { active: "bg-emerald-500/30 border-emerald-400/60 text-emerald-100", idle: "bg-white/5 border-white/10 hover:bg-emerald-500/15 hover:border-emerald-400/40" },
  };
  const cls = active ? tones[tone].active : tones[tone].idle;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs font-bold py-2 px-2 rounded-lg border transition-all ${cls}`}
      data-testid={`event-preview-${target ?? "real"}`}
    >
      {label}
    </button>
  );
}

/**
 * AdsBanner — site-wide floating promotional banner.
 *
 *  • Mounted once at the root Layout level so it appears on every page,
 *    every dynamic route, every navigation — without per-page wiring.
 *  • Fixed position at top-center of the viewport, non-blocking.
 *  • Smooth fade + slide-in on mount, slide-out on dismiss.
 *  • Dismiss with × button hides the banner for the current view ONLY.
 *      ▸ Reappears on every page refresh
 *      ▸ Reappears on every new tab / new session
 *    Achieved with plain in-memory state (no sessionStorage / localStorage),
 *    which by definition resets on refresh and never carries to a new tab.
 *  • Mobile-responsive: full-width with side margins on small screens,
 *    pill-shaped on larger screens.
 *  • z-index: 55 — sits above page content and the sticky navbar, but
 *    yields to the EventStickyBar (z-60) and any modals (z-200+) so it
 *    never traps users in critical flows.
 */

import { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowRight, X } from "lucide-react";

interface AdsBannerProps {
  /** Headline text. */
  title?: string;
  /** Sub-text shown beside (desktop) or below (mobile) the title. */
  subtitle?: string;
  /** Call-to-action label. */
  ctaText?: string;
  /** Where the CTA links to (internal route). */
  ctaUrl?: string;
}

export function AdsBanner({
  title = "Partner With JCTM",
  subtitle = "Help us reach more souls — every gift fuels the next service, broadcast and crusade.",
  ctaText = "Give now",
  ctaUrl = "/donate",
}: AdsBannerProps) {
  // In-memory only — refresh / new tab will resurrect the banner.
  const [visible, setVisible] = useState(true);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="ads-banner"
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: "spring", stiffness: 240, damping: 24 }}
          role="region"
          aria-label="Promotional banner"
          data-testid="ads-banner"
          className="fixed top-3 left-1/2 z-[55] w-[calc(100vw-1.5rem)] max-w-2xl -translate-x-1/2 sm:top-4 pointer-events-none"
        >
          <div
            className="relative pointer-events-auto flex items-center gap-3 rounded-2xl border px-3 py-2.5 shadow-2xl sm:px-4 sm:py-3"
            style={{
              background:
                "linear-gradient(135deg, rgba(124,58,237,0.97) 0%, rgba(79,70,229,0.97) 50%, rgba(14,165,233,0.97) 100%)",
              borderColor: "rgba(255,255,255,0.18)",
              backdropFilter: "blur(14px)",
            }}
          >
            <div
              className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 border border-white/25"
              aria-hidden
            >
              <Sparkles className="h-4 w-4 text-yellow-200" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[12px] sm:text-sm font-bold text-white leading-tight truncate">
                {title}
              </p>
              <p className="mt-0.5 text-[10px] sm:text-xs text-white/80 leading-snug line-clamp-2 sm:line-clamp-1">
                {subtitle}
              </p>
            </div>

            <Link href={ctaUrl}>
              <button
                type="button"
                className="shrink-0 inline-flex items-center gap-1 rounded-full bg-white text-[#3a1a8a] hover:bg-yellow-50 transition-colors px-3 py-1.5 text-[11px] sm:text-xs font-bold shadow-md cursor-pointer"
                data-testid="ads-banner-cta"
              >
                {ctaText}
                <ArrowRight className="h-3 w-3" />
              </button>
            </Link>

            <button
              type="button"
              onClick={() => setVisible(false)}
              aria-label="Dismiss promotional banner"
              data-testid="ads-banner-close"
              className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/15 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

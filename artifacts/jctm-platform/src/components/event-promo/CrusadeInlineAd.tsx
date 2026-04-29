/**
 * CrusadeInlineAd — full-width inline crusade promo block.
 *
 * Mounted globally in Layout right above <Footer/>, so it renders on every
 * page (covering the "before footer on all pages" requirement). Auto-hides
 * once the campaign window ends. Not dismissible — it's an inline ad slot,
 * not an overlay, so it never blocks navigation or interrupts UX.
 */

import { Link } from "wouter";
import { motion } from "framer-motion";
import { Flame, MapPin, Calendar, ChevronRight, MessageCircle, Mail } from "lucide-react";

const CAMPAIGN_END = new Date("2026-05-01T21:00:00+01:00");
const CAMPAIGN_START = new Date("2026-04-30T18:00:00+01:00");
const WHATSAPP_URL = "https://wa.me/2348081313111?text=" + encodeURIComponent(
  "I'd like to attend the Warri City Crusade 2026 — please send me details.",
);
const MAILTO_URL = "mailto:info@jctm.org.ng?subject=" + encodeURIComponent(
  "Warri City Crusade 2026 — Registration",
);

export function CrusadeInlineAd() {
  const now = Date.now();
  if (now >= CAMPAIGN_END.getTime()) return null;
  const isLive = now >= CAMPAIGN_START.getTime();

  return (
    <section
      aria-label="Warri Crusade 2026 inline campaign block"
      data-testid="crusade-inline-ad"
      className="relative w-full overflow-hidden"
      style={{
        background: "linear-gradient(135deg,#0a0a0a 0%,#3b0000 30%,#7f1d1d 55%,#3b0000 80%,#0a0a0a 100%)",
      }}
    >
      {/* gold top + bottom accents */}
      <div
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{ background: "linear-gradient(90deg, transparent, #FFD700, #D4A017, #FFD700, transparent)" }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-[2px]"
        style={{ background: "linear-gradient(90deg, transparent, #FFD700, #D4A017, #FFD700, transparent)" }}
      />

      {/* faint radial glow behind text */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background: "radial-gradient(ellipse at 30% 50%, rgba(220,38,38,0.45) 0%, transparent 60%)",
        }}
      />

      <div className="container mx-auto px-4 py-8 md:py-10 relative">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-6">
          {/* Left: title + meta */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5 }}
            className="flex-1 min-w-0"
          >
            <div className="flex items-center gap-2 mb-2">
              <span
                className={
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest " +
                  (isLive ? "bg-white text-red-700 animate-pulse" : "bg-yellow-400 text-[#1a0000]")
                }
              >
                <Flame className="h-3 w-3" /> {isLive ? "Happening Now" : "Featured Campaign"}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-widest text-yellow-300/90">
                Prophet Amos Global Crusade
              </span>
            </div>

            <h2 className="font-serif font-black text-2xl md:text-3xl lg:text-4xl text-white leading-tight">
              🔥 Warri Crusade 2026 —{" "}
              <span className="bg-gradient-to-r from-yellow-300 via-yellow-200 to-yellow-400 bg-clip-text text-transparent">
                Powerful Move of God
              </span>
            </h2>
            <p className="mt-2 text-sm md:text-base italic text-yellow-100/90 max-w-2xl">
              Be Ready For Rapture: Tribulation Is Coming! Run For Your Soul.
            </p>

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs md:text-sm text-white/85">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-yellow-300" />
                Apr 30 – May 1, 2026 · 6:00 PM (WAT)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-yellow-300" />
                Ighogbadu Primary School, Warri
              </span>
            </div>
          </motion.div>

          {/* Right: CTA stack */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex flex-col gap-2 shrink-0"
          >
            <Link href="/crusade">
              <button
                type="button"
                data-testid="crusade-inline-ad-primary-cta"
                className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm md:text-base font-extrabold uppercase tracking-wide text-[#1a0000] shadow-xl transition-transform hover:scale-[1.03]"
                style={{ background: "linear-gradient(135deg,#FFD700,#D4A017)" }}
              >
                {isLive ? "Join the Crusade Now" : "Register / Join"} <ChevronRight className="h-4 w-4" />
              </button>
            </Link>
            <div className="flex items-center gap-2">
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="crusade-inline-ad-whatsapp"
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-500/25 transition-colors"
              >
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </a>
              <a
                href={MAILTO_URL}
                data-testid="crusade-inline-ad-email"
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-yellow-400/40 bg-yellow-400/10 px-3 py-2 text-xs font-bold text-yellow-200 hover:bg-yellow-400/20 transition-colors"
              >
                <Mail className="h-3.5 w-3.5" /> Email
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

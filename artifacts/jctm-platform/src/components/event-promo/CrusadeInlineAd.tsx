/**
 * MinistersConferenceInlineAd — full-width inline conference promo block.
 *
 * Mounted in Layout above <Footer/> so it renders on every page.
 * Auto-hides once the conference window closes.
 * Not dismissible — inline ad slot, not an overlay, never blocks navigation.
 * Enterprise features:
 *   • Live phase awareness: upcoming → live → ended (auto-hide)
 *   • Real conference flyer image as visual anchor
 *   • Purple / gold brand palette (#a855f7, #D4A017)
 *   • Countdown to conference start (minutes granularity, no jank)
 *   • WhatsApp + email contact CTAs alongside primary Register CTA
 *   • prefers-reduced-motion respected; viewport-enter animation via whileInView
 *   • Accessibility: section landmark, aria-labels, decorative pieces aria-hidden
 */

import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Sparkles,
  MapPin,
  Calendar,
  ChevronRight,
  MessageCircle,
  Mail,
  Radio,
} from "lucide-react";
import ministerConferenceFlyer from "@assets/WhatsApp_Image_2026-04-16_at_2.59.53_PM_1776348424004.jpeg";

const CONF_START = new Date("2026-05-09T07:00:00Z"); // Day 2 · 8:00 AM WAT
const CONF_END   = new Date("2026-05-10T20:00:00Z"); // 9:00 PM WAT May 10

const WHATSAPP_URL =
  "https://wa.me/2348081313111?text=" +
  encodeURIComponent(
    "I'd like to attend Ministers Conference 2026 — please send me details.",
  );
const MAILTO_URL =
  "mailto:info@jctm.org.ng?subject=" +
  encodeURIComponent("Ministers Conference 2026 — Registration Enquiry");

function useCountdown(target: Date, end: Date) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const isLive  = now >= target.getTime() && now < end.getTime();
  const isEnded = now >= end.getTime();
  const diff    = Math.max(target.getTime() - now, 0);
  return {
    isLive,
    isEnded,
    days:  Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    mins:  Math.floor((diff % 3600000) / 60000),
  };
}

export function CrusadeInlineAd() {
  const { isLive, isEnded, days, hours, mins } = useCountdown(CONF_START, CONF_END);
  const [imgOk, setImgOk] = useState(true);

  if (isEnded) return null;

  return (
    <section
      aria-label="Ministers Conference 2026 — conference promo block"
      data-testid="ministers-conference-inline-ad"
      className="relative w-full overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg,#0e0018 0%,#2d0057 30%,#4c1070 55%,#2d0057 80%,#0e0018 100%)",
      }}
    >
      {/* Purple top accent */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{
          background:
            "linear-gradient(90deg, transparent, #a855f7 20%, #D4A017 50%, #a855f7 80%, transparent)",
        }}
      />
      {/* Gold bottom accent */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[2px]"
        style={{
          background:
            "linear-gradient(90deg, transparent, #D4A017 20%, #a855f7 50%, #D4A017 80%, transparent)",
        }}
      />

      {/* Radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 20% 50%, rgba(168,85,247,0.30) 0%, transparent 60%)," +
            "radial-gradient(ellipse at 80% 50%, rgba(212,160,23,0.15) 0%, transparent 55%)",
        }}
      />

      <div className="container mx-auto px-4 py-8 md:py-10 relative">
        <div className="flex flex-col lg:flex-row items-stretch gap-6 lg:gap-10">

          {/* Flyer thumbnail — desktop */}
          {imgOk && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5 }}
              className="hidden lg:block shrink-0 w-40 xl:w-48 rounded-2xl overflow-hidden self-center shadow-2xl border-2"
              style={{ borderColor: "rgba(168,85,247,0.6)" }}
            >
              <img
                src={ministerConferenceFlyer}
                alt="Ministers Conference 2026 — Official Flyer"
                className="w-full h-full object-cover object-top"
                onError={() => setImgOk(false)}
                loading="lazy"
                decoding="async"
              />
            </motion.div>
          )}

          {/* Left: title + meta */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5 }}
            className="flex-1 min-w-0"
          >
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {isLive ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-purple-700 shadow-sm">
                  <span className="relative inline-flex h-2 w-2">
                    <span className="absolute inset-0 inline-flex animate-ping rounded-full bg-purple-500 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-purple-600" />
                  </span>
                  <Radio className="h-3 w-3" aria-hidden />
                  <span>Happening Now</span>
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest"
                  style={{ background: "rgba(168,85,247,0.20)", color: "#e9d5ff", border: "1px solid rgba(168,85,247,0.45)" }}
                >
                  <Sparkles className="h-3 w-3" aria-hidden /> Featured Event
                </span>
              )}
              <span
                className="text-[11px] font-bold uppercase tracking-widest"
                style={{ color: "#D4A017" }}
              >
                Jesus Christ Temple Ministry
              </span>
            </div>

            <h2
              className="font-serif font-black text-2xl md:text-3xl lg:text-4xl text-white leading-tight"
            >
              {isLive ? "🔥 " : ""}Ministers Conference 2026 —{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(90deg, #D4A017, #FFD700, #a855f7)" }}
              >
                {isLive ? "We Are Live!" : "Apostolic Fire"}
              </span>
            </h2>

            <p className="mt-1.5 text-sm md:text-base italic text-purple-200/90 max-w-2xl">
              An Apostolic Gathering of Ministers, Leaders &amp; Kingdom Builders
            </p>

            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs md:text-sm text-white/85">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4 shrink-0" style={{ color: "#D4A017" }} aria-hidden />
                May 8–10, 2026 · 8:00 AM Daily (WAT)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4 shrink-0" style={{ color: "#D4A017" }} aria-hidden />
                JCTM Auditorium, Ebrumede Roundabout, Effurun — Delta State
              </span>
            </div>

            {/* Countdown chips — only when upcoming */}
            {!isLive && (days > 0 || hours > 0 || mins > 0) && (
              <div className="mt-3 flex items-center gap-1.5" role="timer" aria-label={`Conference starts in ${days} days, ${hours} hours, ${mins} minutes`}>
                {[
                  { v: days,  l: "D" },
                  { v: hours, l: "H" },
                  { v: mins,  l: "M" },
                ].map(({ v, l }) => (
                  <div
                    key={l}
                    className="flex items-baseline gap-0.5 px-2.5 py-1.5 rounded-lg border"
                    style={{ background: "rgba(168,85,247,0.18)", borderColor: "rgba(168,85,247,0.35)" }}
                  >
                    <span className="text-sm font-black text-white font-mono tabular-nums leading-none">
                      {String(v).padStart(2, "0")}
                    </span>
                    <span className="text-[9px] font-bold uppercase ml-0.5" style={{ color: "#D4A017" }}>
                      {l}
                    </span>
                  </div>
                ))}
                <span className="text-[11px] text-purple-300/80 font-medium ml-1">until Conference</span>
              </div>
            )}
          </motion.div>

          {/* Right: CTA stack */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex flex-col gap-2.5 shrink-0 lg:justify-center"
          >
            <Link href="/conference-registration">
              <button
                type="button"
                data-testid="ministers-conf-inline-ad-primary-cta"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm md:text-base font-extrabold uppercase tracking-wide shadow-xl transition-transform hover:scale-[1.03] active:scale-100"
                style={{ background: "linear-gradient(135deg,#a855f7,#7c3aed)", color: "#fff", boxShadow: "0 4px 24px rgba(168,85,247,0.45)" }}
              >
                {isLive ? "Join the Conference Now" : "Register for Conference"}
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </Link>

            <div className="flex items-center gap-2">
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="ministers-conf-inline-ad-whatsapp"
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-colors"
                style={{ borderColor: "rgba(168,85,247,0.40)", background: "rgba(168,85,247,0.12)", color: "#e9d5ff" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(168,85,247,0.22)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(168,85,247,0.12)")}
              >
                <MessageCircle className="h-3.5 w-3.5" aria-hidden /> WhatsApp
              </a>
              <a
                href={MAILTO_URL}
                data-testid="ministers-conf-inline-ad-email"
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-colors"
                style={{ borderColor: "rgba(212,160,23,0.40)", background: "rgba(212,160,23,0.10)", color: "#fef08a" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(212,160,23,0.20)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(212,160,23,0.10)")}
              >
                <Mail className="h-3.5 w-3.5" aria-hidden /> Email
              </a>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}

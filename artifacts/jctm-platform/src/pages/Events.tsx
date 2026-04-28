import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useListEvents } from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { AdSlot, ADSENSE_SLOTS } from "@/components/ads/AdSense";
import { SEO } from "@/components/SEO";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar, MapPin, Clock, Youtube, Radio, Phone,
  Share2, Copy, Check, ChevronDown, Instagram, Facebook, Megaphone, Download, CalendarPlus,
  Flame, CheckCircle2, ExternalLink,
} from "lucide-react";
import ministerConferenceFlyer from "@assets/WhatsApp_Image_2026-04-16_at_2.59.53_PM_1776348424004.jpeg";
import { format, isPast, differenceInDays, differenceInHours, differenceInMinutes, differenceInSeconds } from "date-fns";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function toICSDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function generateGoogleCalendarUrl(event: EventItem) {
  const start = new Date(event.startDate);
  const end = event.endDate ? new Date(event.endDate) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toICSDate(start)}/${toICSDate(end)}`,
    details: event.description?.replace(/\|/g, "\n") ?? "",
    location: event.location ?? "",
    sf: "true",
    output: "xml",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function downloadICS(event: EventItem) {
  const start = new Date(event.startDate);
  const end = event.endDate ? new Date(event.endDate) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const description = (event.description?.replace(/\|/g, "\\n") ?? "").replace(/,/g, "\\,");
  const location = (event.location ?? "").replace(/,/g, "\\,");
  const title = event.title.replace(/,/g, "\\,");
  const uid = `jctm-event-${event.id}@jctm.org.ng`;

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//JCTM Digital Sanctuary//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${toICSDate(start)}`,
    `DTEND:${toICSDate(end)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${event.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.ics`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("Calendar file downloaded! Open it to add to Apple Calendar or Outlook.");
}

function AddToCalendar({ event }: { event: EventItem }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-accent/30 text-accent hover:bg-accent/10 transition-colors"
      >
        <CalendarPlus className="h-3.5 w-3.5" />
        Add to Calendar
        <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 top-full mt-1.5 z-20 bg-background border border-border rounded-xl shadow-xl overflow-hidden min-w-[180px]"
            >
              <a
                href={generateGoogleCalendarUrl(event)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-accent/10 hover:text-accent transition-colors"
              >
                <span className="text-base">📅</span>
                Google Calendar
              </a>
              <button
                onClick={() => { setOpen(false); downloadICS(event); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-accent/10 hover:text-accent transition-colors border-t border-border/50"
              >
                <span className="text-base">🍎</span>
                Apple / Outlook (.ics)
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function Countdown({ target, dark = false }: { target: string; dark?: boolean }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const end = new Date(target);
  const now = new Date();
  if (isPast(end)) return <span className={`font-semibold text-sm ${dark ? "text-green-300" : "text-green-500"}`}>Rebroadcast Now / In Progress</span>;

  const days = differenceInDays(end, now);
  const hours = differenceInHours(end, now) % 24;
  const mins = differenceInMinutes(end, now) % 60;
  const secs = differenceInSeconds(end, now) % 60;

  return (
    <div className="flex gap-2 items-end flex-wrap">
      {[{ v: days, l: "Days" }, { v: hours, l: "Hrs" }, { v: mins, l: "Min" }, { v: secs, l: "Sec" }].map(({ v, l }) => (
        <div key={l} className="flex flex-col items-center bg-black/40 backdrop-blur-sm rounded-xl px-2.5 py-1.5 min-w-[46px]">
          <span className="text-xl font-bold text-white font-mono tabular-nums leading-none">{String(v).padStart(2, "0")}</span>
          <span className="text-[9px] text-white/60 uppercase tracking-wider mt-0.5">{l}</span>
        </div>
      ))}
    </div>
  );
}

function CountdownInline({ target }: { target: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const end = new Date(target);
  const now = new Date();
  if (isPast(end)) return null;

  const days = differenceInDays(end, now);
  const hours = differenceInHours(end, now) % 24;
  const mins = differenceInMinutes(end, now) % 60;
  const secs = differenceInSeconds(end, now) % 60;

  return (
    <div className="flex gap-2 items-end">
      {[{ v: days, l: "D" }, { v: hours, l: "H" }, { v: mins, l: "M" }, { v: secs, l: "S" }].map(({ v, l }) => (
        <div key={l} className="flex flex-col items-center bg-white/10 border border-white/20 rounded-lg px-2 py-1 min-w-[38px]">
          <span className="text-lg font-bold text-white font-mono tabular-nums leading-none">{String(v).padStart(2, "0")}</span>
          <span className="text-[8px] text-white/50 uppercase tracking-wider">{l}</span>
        </div>
      ))}
    </div>
  );
}


type EventItem = {
  id: number | string;
  title: string;
  description?: string | null;
  startDate: string;
  endDate?: string | null;
  location?: string | null;
  eventType: string;
  imageUrl?: string | null;
  youtubeUrl?: string | null;
  createdAt: string;
};

type StaticEvent = {
  id: string;
  title: string;
  subtitle?: string;
  description: string;
  startDate: string;
  endDate: string;
  location: string;
  eventType: string;
  imageUrl: string;
  youtubeVideoId?: string | null;
  registerUrl: string;
  accentHex: string;
  labelColor: string;
  highlights?: string[];
};

const STATIC_UPCOMING_EVENTS: StaticEvent[] = [
  {
    id: "warri-crusade-2026",
    title: "Warri City Crusade 2026",
    subtitle: "Prophet Amos Global Crusade",
    description: "Be Ready For Rapture: Tribulation Is Coming! Run For Your Soul!|A mighty outdoor crusade with healing, miracles, and mass salvation. Free entry for all — bring someone who needs a touch from God.",
    startDate: "2026-04-30T18:00:00+01:00",
    endDate: "2026-05-01T21:00:00+01:00",
    location: "Ighogbadu Primary School, Obodo, Okumagba Avenue, Warri South, Delta State",
    eventType: "Crusade",
    imageUrl: "/warri-crusade-flyer2.jpeg",
    youtubeVideoId: null,
    registerUrl: "/crusade",
    accentHex: "#EAB308",
    labelColor: "#0a1a4a",
    highlights: [
      "Miracle-working power of God",
      "Mass salvation & healing",
      "Free entry for everyone",
    ],
  },
];

function generateAdCopy(event: EventItem) {
  const dateStr = format(new Date(event.startDate), "MMMM d, yyyy");
  const endDateStr = event.endDate ? ` – ${format(new Date(event.endDate), "MMMM d, yyyy")}` : "";
  const timeStr = format(new Date(event.startDate), "h:mm a");
  const location = event.location ?? "Venue TBA";
  const title = event.title;

  const short = `🔥 ${title.toUpperCase()}

📅 ${dateStr}${endDateStr}
⏰ ${timeStr} Daily
📍 ${location}

Don't miss this! Free entry for all. Bring someone!

#JCTM #ProphetAmos #${event.eventType.replace(/\s+/g, "")}2026`;

  const medium = `🙏 ${title}

Join us for a life-changing gathering hosted by Jesus Christ Temple Ministry!

📅 Date: ${dateStr}${endDateStr}
⏰ Time: ${timeStr} WAT
📍 Venue: ${location}

${event.description ? event.description.replace(/\|/g, "\n").split("\n").slice(0, 3).join("\n") : ""}

This is a divine invitation — come expecting miracles, healing, and a fresh encounter with God!

📞 Enquiries: +234(0)8081313111
🌐 www.jctm.org.ng

Share this post and tag someone who needs to be there. Free entry for ALL!

#JCTM #JesusChristTempleMinistry #ProphetAmos #${event.eventType}2026 #Warri #DeltaState #Revival`;

  const long = `📢 ${title.toUpperCase()} — OFFICIAL ANNOUNCEMENT

Jesus Christ Temple Ministry (JCTM) is pleased to announce an anointed gathering that promises to be a turning point for many lives.

EVENT DETAILS:
• Event: ${title}
• Date: ${dateStr}${endDateStr}
• Time: ${timeStr} Daily (West Africa Time)
• Venue: ${location}

${event.description ? event.description.replace(/\|/g, "\n") : ""}

This gathering is for everyone — the saved, the backslidden, and the seeking. There will be powerful ministry, miracles, healings, and life-changing testimonies.

SPREAD THE WORD:
Share this post. Print it out. Tag your friends and family. Send it in your WhatsApp groups. This is not just an event — it is a divine appointment.

WATCH LIVE:
Follow us on YouTube: youtube.com/@JesusChristTempleMinistry
Facebook: facebook.com/TEMPLETV
Website: www.jctm.org.ng

📞 For enquiries: +234(0)8081313111

FREE ENTRY FOR ALL. Come as you are.

#JCTM #JesusChristTempleMinistry #ProphetAmos #${event.eventType}2026 #Warri #DeltaState #Nigeria #Revival #Christianity #Church`;

  return { short, medium, long };
}

function EventAdKit({ event }: { event: EventItem }) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"short" | "medium" | "long">("medium");
  const [copied, setCopied] = useState(false);
  const adCopy = generateAdCopy(event);
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

  const shareText = encodeURIComponent(adCopy.short);
  const shareUrl = encodeURIComponent(`${window.location.origin}${base}/events`);

  const platforms = [
    {
      label: "WhatsApp",
      emoji: "💬",
      bg: "#25D366",
      href: `https://wa.me/?text=${shareText}`,
    },
    {
      label: "Facebook",
      emoji: "👍",
      bg: "#1877F2",
      href: `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}&quote=${shareText}`,
    },
    {
      label: "X / Twitter",
      emoji: "𝕏",
      bg: "#000000",
      href: `https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`,
    },
    {
      label: "Telegram",
      emoji: "✈️",
      bg: "#0088CC",
      href: `https://t.me/share/url?url=${shareUrl}&text=${shareText}`,
    },
    {
      label: "YouTube Community",
      emoji: "▶",
      bg: "#FF0000",
      href: `https://studio.youtube.com/channel/UCPFFvkE-KGpR37qJgvYriJg/community`,
    },
    {
      label: "Instagram Bio",
      emoji: "📷",
      bg: "linear-gradient(135deg,#E1306C,#833AB4,#F77737)",
      href: `https://www.instagram.com/templetv.jctm/`,
    },
  ];

  const handleCopy = () => {
    navigator.clipboard.writeText(adCopy[activeTab]);
    setCopied(true);
    toast.success("Ad copy copied! Paste it to your platform.");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadFlyer = () => {
    if (!event.imageUrl) return;
    const link = document.createElement("a");
    link.href = event.imageUrl.startsWith("/") ? event.imageUrl : `/${event.imageUrl}`;
    link.download = `${event.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-flyer.jpeg`;
    link.click();
    toast.success("Flyer downloaded! Use it in your ads.");
  };

  return (
    <div className="border-t border-border/50">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-accent hover:bg-accent/5 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Megaphone className="h-4 w-4" />
          Share & Promote on Social Media
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-2">Share on Platforms</p>
                <div className="flex flex-wrap gap-2">
                  {platforms.map(p => (
                    <a
                      key={p.label}
                      href={p.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-bold transition-all hover:scale-105 hover:shadow-lg"
                      style={{ background: p.bg }}
                      title={p.label}
                    >
                      <span>{p.emoji}</span>
                      <span className="hidden sm:inline">{p.label}</span>
                    </a>
                  ))}
                  {event.imageUrl && (
                    <button
                      onClick={handleDownloadFlyer}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105 border border-border text-muted-foreground hover:text-primary hover:border-primary/40"
                    >
                      <Download className="h-3 w-3" />
                      <span className="hidden sm:inline">Download Flyer</span>
                    </button>
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-2">Auto-Generated Ad Copy</p>
                <div className="rounded-xl overflow-hidden border border-border/60">
                  <div className="flex border-b border-border/50 bg-muted/30">
                    {(["short", "medium", "long"] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                          activeTab === tab
                            ? "text-accent bg-accent/10 border-b-2 border-accent"
                            : "text-muted-foreground hover:text-primary"
                        }`}
                      >
                        {tab === "short" ? "Short (Stories)" : tab === "medium" ? "Medium (Feed)" : "Long (YouTube)"}
                      </button>
                    ))}
                  </div>
                  <div className="relative bg-background">
                    <pre className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed font-sans p-4 max-h-48 overflow-y-auto">
                      {adCopy[activeTab]}
                    </pre>
                    <button
                      onClick={handleCopy}
                      className="absolute top-3 right-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-accent bg-background border border-border/50 rounded-lg px-2 py-1 transition-colors"
                    >
                      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>

                <div className="mt-3 rounded-xl bg-red-50/60 border border-red-200/50 p-3 flex gap-2.5">
                  <Youtube className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-red-700 mb-0.5">Running YouTube Ads?</p>
                    <p className="text-xs text-muted-foreground">
                      Use the <strong>Long</strong> version above as your YouTube video description. Go to{" "}
                      <a href="https://ads.google.com" target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline">Google Ads</a>, select "Video campaign", choose your JCTM YouTube channel, and target Nigeria → Warri/Delta State.
                    </p>
                  </div>
                </div>

                <div className="mt-2 rounded-xl bg-blue-50/60 border border-blue-200/50 p-3 flex gap-2.5">
                  <Facebook className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-blue-700 mb-0.5">Running Facebook & Instagram Ads?</p>
                    <p className="text-xs text-muted-foreground">
                      Use the <strong>Medium</strong> copy for feed ads and <strong>Short</strong> for Stories/Reels. Go to{" "}
                      <a href="https://business.facebook.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Meta Business Suite</a>, create an event promotion campaign, upload the flyer image, target Nigeria → Delta State.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StaticEventCard({ event, index }: { event: StaticEvent; index: number }) {
  const start = new Date(event.startDate);
  const end = new Date(event.endDate);
  const past = isPast(start);
  const [showVideo, setShowVideo] = useState(false);

  const asEventItem: EventItem = {
    id: event.id,
    title: event.title,
    description: event.description,
    startDate: event.startDate,
    endDate: event.endDate,
    location: event.location,
    eventType: event.eventType,
    imageUrl: event.imageUrl,
    youtubeUrl: event.youtubeVideoId,
    createdAt: new Date().toISOString(),
  };

  const descLines = event.description.split("|");

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: index * 0.1 }}
      className="glass-panel rounded-2xl overflow-hidden border border-border/50 hover:shadow-2xl transition-all duration-300 group flex flex-col"
      style={{
        boxShadow: `0 4px 32px ${event.accentHex}18`,
        borderColor: `${event.accentHex}30`,
      }}
    >
      {/* Flyer banner */}
      <div className="relative overflow-hidden" style={{ aspectRatio: "16/9" }}>
        <img
          src={event.imageUrl}
          alt={`${event.title} official flyer`}
          className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-700"
          loading="lazy"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Event type badge */}
        <div className="absolute top-3 left-3">
          <span
            className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg"
            style={{ background: event.accentHex, color: event.labelColor }}
          >
            {event.eventType}
          </span>
        </div>

        {/* Countdown overlaid on flyer */}
        {!past && (
          <div className="absolute bottom-3 left-3 right-3">
            <p className="text-[9px] text-white/60 uppercase tracking-widest font-semibold mb-1.5">Starts In</p>
            <Countdown target={event.startDate} />
          </div>
        )}

        {past && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-black/70 text-white/70 text-xs font-semibold px-4 py-2 rounded-full backdrop-blur-sm">Past Event</span>
          </div>
        )}
      </div>

      {/* YouTube video embed (if available) */}
      {event.youtubeVideoId && (
        <div className="border-t border-border/40">
          <button
            onClick={() => setShowVideo(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50/50 dark:hover:bg-red-900/10 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Youtube className="h-3.5 w-3.5" />
              {showVideo ? "Hide Promo Video" : "Watch Promo Video on YouTube"}
            </span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${showVideo ? "rotate-180" : ""}`} />
          </button>
          <AnimatePresence>
            {showVideo && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="aspect-video">
                  <iframe
                    className="w-full h-full"
                    src={`https://www.youtube.com/embed/${event.youtubeVideoId}?autoplay=1&mute=0&rel=0&controls=1&origin=${encodeURIComponent(window.location.origin)}`}
                    title={`${event.title} — Promo Video`}
                    allow="autoplay; accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Card body */}
      <div className="p-5 flex flex-col flex-1 gap-4">
        {/* Title & subtitle */}
        <div>
          <h3 className="font-serif font-bold text-primary text-xl leading-tight mb-1 group-hover:text-accent transition-colors">
            {event.title}
          </h3>
          {event.subtitle && (
            <p className="text-xs text-muted-foreground italic">&ldquo;{event.subtitle}&rdquo;</p>
          )}
        </div>

        {/* Date / time / location */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 shrink-0" style={{ color: event.accentHex }} />
            <span>
              {format(start, "EEEE d MMMM")} – {format(end, "EEEE d MMMM, yyyy")}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" style={{ color: event.accentHex }} />
            <span>{format(start, "h:mm a")} Daily (West Africa Time)</span>
          </div>
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: event.accentHex }} />
            <span className="leading-snug">{event.location}</span>
          </div>
        </div>

        {/* Description / highlights */}
        <div className="border-t border-border/50 pt-3 space-y-1.5">
          <p className="text-sm text-muted-foreground leading-relaxed">{descLines[0]}</p>
          {event.highlights && (
            <div className="space-y-1 pt-1">
              {event.highlights.map(h => (
                <div key={h} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 shrink-0" style={{ color: event.accentHex }} />
                  <span>{h}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Register CTA */}
        {!past && (
          <div className="mt-auto pt-2 flex flex-col gap-2">
            <Link href={event.registerUrl}>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="w-full py-3.5 rounded-xl font-serif font-black text-base tracking-wide shadow-lg transition-shadow hover:shadow-xl"
                style={{
                  background: `linear-gradient(135deg, ${event.accentHex}, ${event.accentHex}cc)`,
                  color: event.labelColor,
                  boxShadow: `0 6px 20px ${event.accentHex}40`,
                }}
              >
                ✋ Register to Attend
              </motion.button>
            </Link>
            {/* Download Flyer + WhatsApp Share */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const link = document.createElement("a");
                  link.href = event.imageUrl;
                  link.download = `${event.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-flyer.jpeg`;
                  link.click();
                  toast.success("Flyer downloaded! Share it with friends and family.");
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm border transition-colors"
                style={{ borderColor: `${event.accentHex}50`, color: event.accentHex }}
              >
                <Download className="h-4 w-4" />
                Download Flyer
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `🔥 *${event.title}*\n\n` +
                  `📅 ${format(start, "EEEE, d MMMM")} – ${format(end, "d MMMM, yyyy")}\n` +
                  `⏰ ${format(start, "h:mm a")} Daily (WAT)\n` +
                  `📍 ${event.location}\n\n` +
                  `${event.description.split("|")[0]}\n\n` +
                  `✋ Register here:\n${window.location.origin}${event.registerUrl}\n\n` +
                  `📞 +234(0)8081313111\n🌐 www.jctm.org.ng\n\n#JCTM #${event.eventType.replace(/\s+/g, "")}2026`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm text-white transition-opacity hover:opacity-90"
                style={{ background: "#25D366" }}
              >
                <span className="text-base leading-none">💬</span>
                <span className="hidden sm:inline">WhatsApp</span>
                <span className="sm:hidden">Share</span>
              </a>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <AddToCalendar event={asEventItem} />
              </div>
              {event.youtubeVideoId && (
                <a
                  href={`https://www.youtube.com/watch?v=${event.youtubeVideoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Youtube className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">YouTube</span>
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Social Ad Kit */}
      {!past && <EventAdKit event={asEventItem} />}
    </motion.div>
  );
}

function EventCard({ event, index }: { event: EventItem; index: number }) {
  const start = new Date(event.startDate);
  const past = isPast(start);
  const isMinisterConference = event.title.toLowerCase().includes("minister") && event.title.toLowerCase().includes("conference");
  const imageUrl = isMinisterConference
    ? ministerConferenceFlyer
    : event.imageUrl?.startsWith("/")
    ? event.imageUrl
    : event.imageUrl
    ? `/${event.imageUrl}`
    : null;
  const registerUrl = isMinisterConference ? "/conference-registration" : "/crusade";

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      className={`glass-panel rounded-2xl overflow-hidden border border-border/50 hover:shadow-xl transition-all duration-300 group ${past ? "opacity-75 hover:opacity-100" : ""}`}
    >
      {!imageUrl && event.youtubeUrl && (
        <div className="relative">
          <div className="aspect-video">
            <iframe
              className="w-full h-full"
              src={
                !past
                  ? `https://www.youtube.com/embed/${event.youtubeUrl}?autoplay=1&mute=1&loop=1&playlist=${event.youtubeUrl}&controls=1&rel=0&origin=${encodeURIComponent(window.location.origin)}`
                  : `https://www.youtube.com/embed/${event.youtubeUrl}?rel=0&controls=1&origin=${encodeURIComponent(window.location.origin)}`
              }
              title={event.title}
              allow="autoplay; accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
          {!past && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
              <Countdown target={event.startDate} />
            </div>
          )}
          <div className="absolute top-3 right-3 z-10">
            <span className="bg-accent text-white text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full shadow-lg">
              {event.eventType}
            </span>
          </div>
        </div>
      )}

      {imageUrl && (
        <div className="relative overflow-hidden" style={{ aspectRatio: "16/9" }}>
          <img
            src={imageUrl}
            alt={event.title}
            className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          {!past && (
            <div className="absolute bottom-4 left-4">
              <Countdown target={event.startDate} />
            </div>
          )}
          <div className="absolute top-3 right-3">
            <span className="bg-accent text-white text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full shadow-lg">
              {event.eventType}
            </span>
          </div>
          {past && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <span className="bg-black/60 text-white/70 text-xs font-semibold px-3 py-1 rounded-full backdrop-blur-sm">Past Event</span>
            </div>
          )}
        </div>
      )}

      <div className={`${imageUrl ? "p-5" : "p-6"}`}>
        {!imageUrl && (
          <div className="flex items-start justify-between mb-4">
            <div className="bg-gradient-to-br from-accent to-[#0284C7] p-3 rounded-2xl text-center min-w-[60px] text-white shadow-lg shadow-accent/20">
              <span className="block text-white/80 font-bold text-[9px] uppercase">{format(start, "MMM")}</span>
              <span className="block font-serif font-bold text-3xl leading-none">{format(start, "dd")}</span>
              <span className="block text-white/80 font-bold text-[9px] uppercase">{format(start, "yyyy")}</span>
            </div>
            <span className="text-[10px] font-bold text-accent bg-accent/10 border border-accent/20 px-2.5 py-1 rounded-full uppercase tracking-widest">
              {event.eventType}
            </span>
          </div>
        )}

        <h3 className="font-serif font-bold text-primary text-lg leading-tight mb-3 group-hover:text-accent transition-colors">
          {event.title}
        </h3>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 text-accent shrink-0" />
            <span>
              {format(start, "EEEE, MMMM d")}
              {event.endDate ? ` – ${format(new Date(event.endDate), "EEEE, MMMM d, yyyy")}` : `, ${format(start, "yyyy")}`}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5 text-accent shrink-0" />
            <span>{format(start, "h:mm a")} Daily WAT</span>
          </div>
          {event.location && (
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
              <span className="leading-snug">{event.location}</span>
            </div>
          )}
        </div>

        {event.description && (
          <p className="text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-2 border-t border-border/50 pt-3">
            {event.description.replace(/\|/g, " · ")}
          </p>
        )}

        {!past && !imageUrl && (
          <div className="mb-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2 font-medium">Starts In</p>
            <Countdown target={event.startDate} />
          </div>
        )}

        {!past && (
          <div className="flex flex-col gap-2 pt-1 pb-1">
            <Button
              className="w-full rounded-xl font-bold text-sm"
              style={{ background: "linear-gradient(135deg,#0ea5e9,#0284c7)", color: "#fff" }}
              asChild
            >
              <a href={registerUrl}>✋ Register to Attend</a>
            </Button>
            {isMinisterConference && (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = ministerConferenceFlyer;
                    link.download = "minister-conference-2026-flyer.jpeg";
                    link.click();
                    toast.success("Flyer downloaded! Share it with friends and family.");
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm border border-sky-300 text-sky-600 hover:bg-sky-50 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Download Flyer
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `🙏 *${event.title}*\n\n` +
                    `📅 ${format(new Date(event.startDate), "EEEE, MMMM d, yyyy")}` +
                    (event.endDate ? ` – ${format(new Date(event.endDate), "MMMM d, yyyy")}` : "") + `\n` +
                    (event.location ? `📍 ${event.location}\n` : "") +
                    `\nYou are specially invited to this anointed Ministers' Conference hosted by Jesus Christ Temple Ministry!\n\n` +
                    `✋ Register & get your invite card here:\n${window.location.origin}/conference-registration\n\n` +
                    `📞 Enquiries: +234(0)8081313111\n🌐 www.jctm.org.ng`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm text-white transition-colors hover:opacity-90"
                  style={{ background: "#25D366" }}
                >
                  <span className="text-base leading-none">💬</span>
                  Share on WhatsApp
                </a>
              </div>
            )}
            <AddToCalendar event={event} />
          </div>
        )}
      </div>

      {!past && <EventAdKit event={event} />}
    </motion.div>
  );
}

const YOUTUBE_LIVE_ID = "UCPFFvkE-KGpR37qJgvYriJg";
const CRUSADE_VIDEO_ID = "oJUkSAZu0y0";
const MINISTER_CONF_VIDEO_ID = "hQFA1Y9NAcY";

export default function Events() {
  const [showLive, setShowLive] = useState(false);
  const { data: events, isLoading } = useListEvents({ limit: 20, offset: 0 });

  useEffect(() => { document.title = "Events | JCTM Digital Sanctuary"; }, []);

  const allEvents = ((events as EventItem[] | undefined) ?? []);
  const upcoming = allEvents.filter((e: EventItem) => !isPast(new Date(e.startDate)));
  const past = allEvents.filter((e: EventItem) => isPast(new Date(e.startDate)));

  return (
    <Layout>
      <SEO
        title="Events & Programmes — Jesus Christ Temple Ministry"
        description="Upcoming events, crusades, and church programmes at Jesus Christ Temple Ministry (JCTM), Warri Nigeria. Stay updated with JCTM's calendar of services, meetings, and outreach events."
        path="/events"
        keywords="JCTM events, Jesus Christ Temple Ministry programmes, church events Warri, JCTM crusade, Temple TV events"
        breadcrumbs={[
          { name: "Home", url: "https://jctm.org.ng/" },
          { name: "Events", url: "https://jctm.org.ng/events" },
        ]}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "EventSeries",
            "name": "JCTM Church Events & Programmes",
            "description": "Upcoming events, crusades, services, and ministry programmes of Jesus Christ Temple Ministry (JCTM), Warri, Nigeria — including live services, outreach events, and special gatherings.",
            "url": "https://jctm.org.ng/events",
            "location": {
              "@type": "Place",
              "name": "Ebrumede Temple, Warri, Delta State, Nigeria",
              "address": {
                "@type": "PostalAddress",
                "addressLocality": "Warri",
                "addressRegion": "Delta State",
                "addressCountry": "NG"
              }
            },
            "organizer": {
              "@type": "ReligiousOrganization",
              "name": "Jesus Christ Temple Ministry (JCTM)",
              "url": "https://jctm.org.ng"
            }
          }
        ]}
      />
      <div className="container mx-auto px-4 py-16">

        {/* Page header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="mb-12">
          <span className="inline-block text-xs font-semibold text-accent uppercase tracking-widest mb-4 border border-accent/30 rounded-full px-4 py-1.5">Ministry Calendar</span>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary mb-4">Upcoming Events</h1>
          <p className="text-muted-foreground text-lg max-w-xl">Join us in person or online. Each event card includes a built-in ad kit — copy, share, and promote on every platform with one click.</p>
        </motion.div>

        {/* Promo Videos */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-10">
          <h2 className="text-xl font-serif font-bold text-primary mb-5 flex items-center gap-2">
            <Youtube className="h-5 w-5 text-red-600" /> Event Promo Videos
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Warri Crusade 2026 */}
            <div className="rounded-2xl overflow-hidden border border-border shadow-lg flex flex-col">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60 bg-muted/30">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full text-white" style={{ background: "#D4A017" }}>
                  🔥 Crusade
                </span>
                <span className="text-sm font-semibold text-primary truncate">Warri City Crusade 2026</span>
                <a
                  href={`https://www.youtube.com/watch?v=${CRUSADE_VIDEO_ID}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto shrink-0 flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-semibold"
                >
                  <Youtube className="h-3.5 w-3.5" /> YouTube
                </a>
              </div>
              <div className="aspect-video">
                <iframe
                  className="w-full h-full"
                  src={`https://www.youtube.com/embed/${CRUSADE_VIDEO_ID}?autoplay=1&mute=1&loop=1&playlist=${CRUSADE_VIDEO_ID}&rel=0&controls=1&origin=${encodeURIComponent(window.location.origin)}`}
                  title="Warri City Crusade 2026 — Official Promo Video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            </div>

            {/* Ministers Conference 2026 */}
            <div className="rounded-2xl overflow-hidden border border-border shadow-lg flex flex-col">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60 bg-muted/30">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full text-white" style={{ background: "#7c3aed" }}>
                  🙏 Conference
                </span>
                <span className="text-sm font-semibold text-primary truncate">Ministers Conference 2026</span>
                <a
                  href={`https://www.youtube.com/watch?v=${MINISTER_CONF_VIDEO_ID}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto shrink-0 flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-semibold"
                >
                  <Youtube className="h-3.5 w-3.5" /> YouTube
                </a>
              </div>
              <div className="aspect-video">
                <iframe
                  className="w-full h-full"
                  src={`https://www.youtube.com/embed/${MINISTER_CONF_VIDEO_ID}?autoplay=1&mute=1&loop=1&playlist=${MINISTER_CONF_VIDEO_ID}&rel=0&controls=1&origin=${encodeURIComponent(window.location.origin)}`}
                  title="Ministers Conference 2026 — Official Promo Video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* YouTube Live */}
        <div className="glass-panel rounded-2xl p-6 mb-12 border border-red-200/50 bg-red-50/30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center shrink-0 shadow-lg shadow-red-200">
                <Radio className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-red-600 uppercase tracking-widest">YouTube Live</span>
                  <span className="inline-block w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                </div>
                <h3 className="font-serif font-bold text-primary">Holy Spirit Sunday Service — Live</h3>
                <p className="text-sm text-muted-foreground">Now Streaming Live directly on this website</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => setShowLive(!showLive)} variant="outline" className="border-red-300 text-red-600 hover:bg-red-50 rounded-full gap-2">
                <Youtube className="h-4 w-4" />
                {showLive ? "Hide" : "Live Now"}
              </Button>
              <a href="https://www.youtube.com/@JesusChristTempleMinistry" target="_blank" rel="noopener noreferrer">
                <Button className="bg-red-600 text-white hover:bg-red-700 rounded-full gap-2">
                  <Youtube className="h-4 w-4" /> Subscribe
                </Button>
              </a>
            </div>
          </div>
          {showLive && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-6 overflow-hidden">
              <div className="aspect-video rounded-xl overflow-hidden shadow-xl">
                <iframe
                  src={`https://www.youtube.com/embed?listType=playlist&list=${YOUTUBE_LIVE_ID}&index=0&autoplay=0&origin=${encodeURIComponent(window.location.origin)}`}
                  className="w-full h-full"
                  title="Holy Spirit Sunday Service — Live"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
            </motion.div>
          )}
        </div>

        <AdSlot slot={ADSENSE_SLOTS.eventsPage} minHeight={100} format="horizontal" className="mb-12" />

        {/* ─── Upcoming Events ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-serif font-bold text-primary flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
            Upcoming Events
          </h2>
          <span className="text-sm text-muted-foreground">
            {STATIC_UPCOMING_EVENTS.length + upcoming.length} event{STATIC_UPCOMING_EVENTS.length + upcoming.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-14">
          {/* Always-present static event cards */}
          {STATIC_UPCOMING_EVENTS.map((event, i) => (
            <StaticEventCard key={event.id} event={event} index={i} />
          ))}

          {/* API-driven upcoming events */}
          {!isLoading && upcoming.map((event: EventItem, i: number) => (
            <EventCard key={event.id} event={event} index={STATIC_UPCOMING_EVENTS.length + i} />
          ))}

          {/* Loading skeletons for API events */}
          {isLoading && Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="glass-panel rounded-2xl overflow-hidden animate-pulse">
              <div className="bg-muted" style={{ aspectRatio: "16/9" }} />
              <div className="p-6 space-y-3">
                <div className="h-5 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2" />
                <div className="h-4 bg-muted rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>

        {/* Past Events */}
        {past.length > 0 && (
          <>
            <h2 className="text-2xl font-serif font-bold text-primary mb-6 text-muted-foreground/70">Past Events</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {past.slice(0, 6).map((event: EventItem, i: number) => (
                <EventCard key={event.id} event={event} index={i} />
              ))}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

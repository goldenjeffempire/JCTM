import { useState, useEffect } from "react";
import { useListEvents, useGetFeaturedSermon, getGetFeaturedSermonQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar, MapPin, Clock, Youtube, Radio, Play, ExternalLink, Phone,
  Share2, Copy, Check, ChevronDown, Instagram, Facebook, Megaphone, Download
} from "lucide-react";
import { format, isPast, differenceInDays, differenceInHours, differenceInMinutes, differenceInSeconds, formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function Countdown({ target }: { target: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const end = new Date(target);
  const now = new Date();
  if (isPast(end)) return <span className="text-green-400 font-semibold text-sm">Live Now / In Progress</span>;

  const days = differenceInDays(end, now);
  const hours = differenceInHours(end, now) % 24;
  const mins = differenceInMinutes(end, now) % 60;
  const secs = differenceInSeconds(end, now) % 60;

  return (
    <div className="flex gap-3 items-end">
      {[{ v: days, l: "Days" }, { v: hours, l: "Hrs" }, { v: mins, l: "Min" }, { v: secs, l: "Sec" }].map(({ v, l }) => (
        <div key={l} className="flex flex-col items-center bg-white/10 rounded-xl px-3 py-2 min-w-[52px]">
          <span className="text-2xl font-bold text-white font-mono tabular-nums leading-none">{String(v).padStart(2, "0")}</span>
          <span className="text-[10px] text-white/60 uppercase tracking-wider mt-0.5">{l}</span>
        </div>
      ))}
    </div>
  );
}

type EventItem = {
  id: number;
  title: string;
  description?: string | null;
  startDate: string;
  endDate?: string | null;
  location?: string | null;
  eventType: string;
  imageUrl?: string | null;
  createdAt: string;
};

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
🌐 www.jctmng.org

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
Website: www.jctmng.org

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
  const shareTitle = encodeURIComponent(event.title);
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

              {/* Platform share buttons */}
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

              {/* Ad copy generator */}
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-2">Auto-Generated Ad Copy</p>
                <div className="rounded-xl overflow-hidden border border-border/60">
                  {/* Tabs */}
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

                  {/* Copy area */}
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

                {/* YouTube Ads note */}
                <div className="mt-3 rounded-xl bg-red-50/60 border border-red-200/50 p-3 flex gap-2.5">
                  <Youtube className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-red-700 mb-0.5">Running YouTube Ads?</p>
                    <p className="text-xs text-muted-foreground">
                      Use the <strong>Long</strong> version above as your YouTube video description. To run a paid YouTube ad campaign, go to{" "}
                      <a href="https://ads.google.com" target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline">Google Ads</a>, select "Video campaign", choose your JCTM YouTube channel, and target Nigeria → Warri/Delta State for best reach.
                    </p>
                  </div>
                </div>

                {/* Meta Ads note */}
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

function EventCard({ event, index }: { event: EventItem; index: number }) {
  const start = new Date(event.startDate);
  const past = isPast(start);
  const imageUrl = event.imageUrl?.startsWith("/")
    ? event.imageUrl
    : event.imageUrl
    ? `/${event.imageUrl}`
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      className={`glass-panel rounded-2xl overflow-hidden border border-border/50 hover:shadow-xl transition-all duration-300 group ${past ? "opacity-75 hover:opacity-100" : ""}`}
    >
      {/* Flyer image */}
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

      {/* Card body */}
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
              {format(start, "EEEE, MMMM d, yyyy")}
              {event.endDate ? ` – ${format(new Date(event.endDate), "MMMM d, yyyy")}` : ""}
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
      </div>

      {/* Social Ads Kit */}
      {!past && <EventAdKit event={event} />}
    </motion.div>
  );
}

const YOUTUBE_LIVE_ID = "UCPFFvkE-KGpR37qJgvYriJg";

export default function Events() {
  const [showLive, setShowLive] = useState(false);
  const [hovered, setHovered] = useState(false);
  const { data: events, isLoading } = useListEvents({ limit: 20, offset: 0 });
  const { data: latestSermon } = useGetFeaturedSermon({ query: { queryKey: getGetFeaturedSermonQueryKey() } });
  const latestYtId = (latestSermon as { videoId?: string })?.videoId;

  useEffect(() => { document.title = "Events | JCTM Digital Sanctuary"; }, []);

  const upcoming = (events ?? []).filter(e => !isPast(new Date(e.startDate)));
  const past = (events ?? []).filter(e => isPast(new Date(e.startDate)));

  return (
    <Layout>
      <div className="container mx-auto px-4 py-16">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="mb-12">
          <span className="inline-block text-xs font-semibold text-accent uppercase tracking-widest mb-4 border border-accent/30 rounded-full px-4 py-1.5">Ministry Calendar</span>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary mb-4">Upcoming Events</h1>
          <p className="text-muted-foreground text-lg max-w-xl">Join us in person or online. Each event card includes a built-in ad kit — copy, share, and promote on every platform with one click.</p>
        </motion.div>

        {/* Latest Sermon */}
        {latestSermon && latestYtId && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-10">
            <h2 className="text-xl font-serif font-bold text-primary mb-4 flex items-center gap-2">
              <Youtube className="h-5 w-5 text-red-600" /> Latest Upload
            </h2>
            <div
              className="rounded-2xl overflow-hidden border border-border shadow-lg bg-primary group cursor-pointer"
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
            >
              <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
                {hovered ? (
                  <iframe
                    className="w-full h-full absolute inset-0"
                    src={`https://www.youtube.com/embed/${latestYtId}?autoplay=1&mute=1&controls=1&rel=0`}
                    allow="autoplay; fullscreen"
                    allowFullScreen
                    title={(latestSermon as { title?: string })?.title ?? "Latest Sermon"}
                  />
                ) : (
                  <>
                    <img
                      src={(latestSermon as { thumbnailUrl?: string })?.thumbnailUrl}
                      alt={(latestSermon as { title?: string })?.title ?? "Latest Sermon"}
                      className="w-full h-full object-cover absolute inset-0 group-hover:scale-105 transition-transform duration-700"
                      onError={(e) => { (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${latestYtId}/maxresdefault.jpg`; }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/30 to-transparent" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-16 w-16 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center shadow-2xl">
                        <Play className="h-7 w-7 text-white fill-white ml-1" />
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-6">
                      <span className="text-red-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 mb-2">
                        <span className="h-1.5 w-1.5 bg-red-400 rounded-full animate-pulse" /> Just Uploaded
                      </span>
                      <h3 className="text-white font-serif font-bold text-xl leading-snug line-clamp-2">{(latestSermon as { title?: string })?.title}</h3>
                      <p className="text-white/50 text-xs mt-1.5">Hover to preview · <span className="text-accent">{formatDistanceToNow(new Date((latestSermon as { publishedAt?: string })?.publishedAt ?? new Date()), { addSuffix: true })}</span></p>
                    </div>
                  </>
                )}
              </div>
              <div className="p-4 flex items-center justify-between bg-primary border-t border-white/10">
                <span className="text-white/60 text-sm">{(latestSermon as { title?: string })?.title}</span>
                <a href={`https://www.youtube.com/watch?v=${latestYtId}`} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" className="rounded-full bg-red-600 hover:bg-red-700 text-white text-xs h-8 px-4 gap-1.5">
                    <ExternalLink className="h-3 w-3" /> Watch on YouTube
                  </Button>
                </a>
              </div>
            </div>
          </motion.div>
        )}

        {/* YouTube Live */}
        <div className="glass-panel rounded-2xl p-6 mb-10 border border-red-200/50 bg-red-50/30">
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
                <h3 className="font-serif font-bold text-primary">Join Live Service</h3>
                <p className="text-sm text-muted-foreground">Watch and participate in our live broadcasts on YouTube</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => setShowLive(!showLive)} variant="outline" className="border-red-300 text-red-600 hover:bg-red-50 rounded-full gap-2">
                <Youtube className="h-4 w-4" />
                {showLive ? "Hide" : "Watch Live"}
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
                  src={`https://www.youtube.com/embed?listType=playlist&list=${YOUTUBE_LIVE_ID}&index=0&autoplay=0`}
                  className="w-full h-full"
                  title="JCTM Live Stream"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
            </motion.div>
          )}
        </div>

        {/* Event lists */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
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
        ) : (
          <>
            {upcoming.length > 0 && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-serif font-bold text-primary flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                    Upcoming
                  </h2>
                  <span className="text-sm text-muted-foreground">{upcoming.length} event{upcoming.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-14">
                  {upcoming.map((event, i) => (
                    <EventCard key={event.id} event={event as EventItem} index={i} />
                  ))}
                </div>
              </>
            )}

            {upcoming.length === 0 && (
              <div className="text-center py-16">
                <Calendar className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">No upcoming events scheduled. Check back soon or subscribe on YouTube for live broadcasts.</p>
              </div>
            )}

            {past.length > 0 && (
              <>
                <h2 className="text-2xl font-serif font-bold text-primary mb-6 text-muted-foreground/70">Past Events</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {past.slice(0, 6).map((event, i) => (
                    <EventCard key={event.id} event={event as EventItem} index={i} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

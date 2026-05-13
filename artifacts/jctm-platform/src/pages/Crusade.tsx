import { useEffect } from "react";
import { SEO } from "@/components/SEO";
import { Layout } from "@/components/layout/Layout";
import { YouTubeEmbed } from "@/components/YouTubeEmbed";
import { VideoDownloadButton } from "@/components/VideoDownloadButton";
import { motion } from "framer-motion";
import {
  Calendar, MapPin, Clock, Phone, Share2, Download,
  Youtube, ExternalLink, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { VenueMap } from "@/components/VenueMap";
import { WARRI_CRUSADE_VENUE } from "@/constants/venues";
import { Link } from "wouter";

const LOCATION = "Ighogbadu Primary School, Obodo, Okumagba Avenue, Warri South L.G.A., Delta State";
const CONTACT = "+234(0)8081313111";
const EVENT_TITLE = "Warri City Crusade 2026 — Prophet Amos Global Crusade";
const EVENT_THEME = "Be Ready For Rapture: Tribulation Is Coming! Run For Your Soul!";
const CRUSADE_YT_VIDEO = "oJUkSAZu0y0";

export default function Crusade() {
  useEffect(() => {
    document.title = "Warri City Crusade 2026 — Past Events Archive | JCTM Digital Sanctuary";
    const meta = document.querySelector("meta[name='description']");
    if (meta) meta.setAttribute("content", `Archive of the ${EVENT_TITLE}. ${EVENT_THEME} — ${LOCATION}.`);
  }, []);

  const handleDownloadFlyer = () => {
    const link = document.createElement("a");
    link.href = "/warri-crusade-flyer2.jpeg";
    link.download = "warri-city-crusade-2026-flyer.jpeg";
    link.click();
    toast.success("Flyer downloaded!");
  };

  const shareText = encodeURIComponent(
    `🔥 WARRI CITY CRUSADE 2026!\n\n"${EVENT_THEME}"\n\nThursday 30th April & Friday 1st May, 2026\n6:00 PM Daily\n📍 Ighogbadu Primary School, Warri\n\n📞 ${CONTACT}\n🌐 jctm.org.ng`
  );

  return (
    <Layout>
      <SEO
        title="Warri City Crusade 2026 — Past Events Archive | JCTM"
        description="Archive of the Warri City Crusade 2026 — a major evangelistic outreach by Jesus Christ Temple Ministry (JCTM). April 30 – May 1, 2026 at Ighogbadu Primary School, Warri, Nigeria."
        path="/crusade"
        keywords="Warri City Crusade 2026, JCTM crusade, Jesus Christ Temple Ministry crusade, evangelism Warri Nigeria, Prophet Amos Evomobor crusade, Prophet Amos Global Crusade"
        breadcrumbs={[
          { name: "Home", url: "https://jctm.org.ng/" },
          { name: "Events", url: "https://jctm.org.ng/events" },
          { name: "Warri City Crusade 2026", url: "https://jctm.org.ng/crusade" },
        ]}
      />

      <div
        className="relative min-h-screen"
        style={{
          background: "linear-gradient(180deg, #020b2a 0%, #0a1a5a 40%, #0d2060 70%, #060f38 100%)",
        }}
      >
        <h1 className="sr-only">Warri City Crusade 2026 — Past Events Archive | JCTM</h1>

        {/* Starfield BG */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 60 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: `${(i % 3) * 0.8 + 0.6}px`,
                height: `${(i % 3) * 0.8 + 0.6}px`,
                top: `${(i * 37 + 11) % 100}%`,
                left: `${(i * 53 + 7) % 100}%`,
                background: `rgba(255,220,120,${(i % 5) * 0.06 + 0.06})`,
              }}
            />
          ))}
        </div>

        {/* Gold cross glow */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-1 opacity-20 pointer-events-none"
          style={{ height: "300px", background: "linear-gradient(to bottom, #FFD700, transparent)" }}
        />
        <div
          className="absolute top-[150px] left-1/2 -translate-x-1/2 h-1 opacity-20 pointer-events-none"
          style={{ width: "300px", background: "linear-gradient(to right, transparent, #FFD700, transparent)" }}
        />

        <div className="relative z-10 container mx-auto px-4 py-16 max-w-5xl">

          {/* EVENT CONCLUDED Banner */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-10 flex items-center justify-center"
          >
            <div
              className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl border"
              style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.2)" }}
            >
              <CheckCircle2 className="h-4 w-4 text-white/50" />
              <span className="text-white/60 text-sm font-bold uppercase tracking-widest">
                Past Event · April 30 – May 1, 2026 · Concluded
              </span>
            </div>
          </motion.div>

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-14"
          >
            <div
              className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold uppercase tracking-widest mb-6 border"
              style={{ borderColor: "rgba(212,160,23,0.4)", background: "rgba(212,160,23,0.1)", color: "#FFD700" }}
            >
              Jesus Christ Temple Ministry Presents
            </div>

            <h2 className="font-serif font-black text-5xl md:text-7xl text-white mb-4 leading-none tracking-tight">
              Warri City{" "}
              <span style={{ WebkitTextStroke: "2px #FFD700", color: "transparent" }}>
                Crusade
              </span>{" "}
              <span className="text-yellow-400">2026</span>
            </h2>

            <p className="text-lg md:text-xl font-serif italic text-yellow-300/90 mb-3 max-w-2xl mx-auto leading-relaxed">
              Prophet Amos Global Crusade
            </p>

            <div
              className="inline-block px-6 py-3 rounded-2xl mb-8 max-w-lg mx-auto"
              style={{ background: "rgba(212,160,23,0.12)", border: "1px solid rgba(212,160,23,0.3)" }}
            >
              <p className="text-yellow-200 font-bold text-base md:text-lg leading-snug">
                &ldquo;{EVENT_THEME}&rdquo;
              </p>
            </div>

            {/* Event meta */}
            <div className="flex flex-wrap justify-center gap-4 text-sm text-white/70">
              {[
                { icon: Calendar, text: "Thursday 30th April & Friday 1st May, 2026" },
                { icon: Clock, text: "6:00 PM Daily (WAT)" },
                { icon: MapPin, text: "Ighogbadu Primary School, Warri" },
                { icon: Phone, text: CONTACT },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 text-yellow-400" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Official Flyer */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mb-14 rounded-3xl overflow-hidden border-2 group relative"
            style={{ borderColor: "rgba(212,160,23,0.4)" }}
          >
            <img
              src="/warri-crusade-flyer2.jpeg"
              alt="Warri City Crusade 2026 — Official Event Flyer"
              className="w-full object-cover"
              style={{ maxHeight: "600px", objectPosition: "center top" }}
              loading="lazy"
              decoding="async"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#020b2a] via-[#020b2a]/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 flex flex-wrap gap-3">
              <button
                onClick={handleDownloadFlyer}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105 shadow-lg border-2"
                style={{ borderColor: "#D4A017", color: "#FFD700", background: "rgba(212,160,23,0.14)" }}
              >
                <Download className="h-3.5 w-3.5" />
                Download Flyer
              </button>
              <a
                href={`https://wa.me/?text=${shareText}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-sm font-bold transition-all hover:scale-105 shadow-lg"
                style={{ background: "#25D366" }}
              >
                <Share2 className="h-3.5 w-3.5" /> Share on WhatsApp
              </a>
            </div>
          </motion.div>

          {/* What the Crusade stood for */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="mb-12 rounded-3xl p-8 border border-yellow-400/20"
            style={{ background: "rgba(10,26,74,0.7)" }}
          >
            <h3 className="font-serif font-bold text-white text-2xl mb-6 text-center">What The Crusade Stood For</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                "Powerful prophetic ministry under the anointing",
                "Mass deliverance and healing miracles",
                "Deep revelatory teaching on end-time events",
                "Altar calls and mass soul-winning",
                "A divine encounter with the living God",
                "Free entry — open to every soul",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
                  <span className="text-white/75 text-sm leading-snug">{item}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Promo Video Recap */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="mb-12 rounded-3xl overflow-hidden border border-yellow-400/20"
            style={{ background: "rgba(10,26,74,0.7)" }}
          >
            <div className="p-6 border-b border-yellow-400/10">
              <div className="flex items-center gap-3 mb-1">
                <Youtube className="h-5 w-5 text-red-500" />
                <h3 className="font-serif font-bold text-white text-xl">Official Crusade Promo Video</h3>
              </div>
              <p className="text-white/60 text-sm">
                Watch the official promo and relive the vision behind the Warri City Crusade 2026.
              </p>
            </div>
            <div className="p-4">
              <YouTubeEmbed
                videoId={CRUSADE_YT_VIDEO}
                title="Warri City Crusade 2026 — Official Promo Video"
                mode="facade"
                emitSchema
                schema={{
                  description: "Official promo video for the Warri City Crusade 2026 hosted by Jesus Christ Temple Ministry.",
                  publisherName: "Jesus Christ Temple Ministry (JCTM)",
                  publisherUrl: "https://jctm.org.ng",
                }}
                className="rounded-2xl shadow-2xl"
                analyticsPage="/crusade"
              />
              <div className="flex justify-center mt-4">
                <VideoDownloadButton
                  videoId={CRUSADE_YT_VIDEO}
                  title="Warri City Crusade 2026 — Official Promo Video"
                  thumbnailUrl={`https://i.ytimg.com/vi/${CRUSADE_YT_VIDEO}/maxresdefault.jpg`}
                  variant="inline"
                  className="bg-yellow-400/10 hover:bg-yellow-400/20 border border-yellow-400/20 text-yellow-200"
                />
              </div>
            </div>
          </motion.div>

          {/* Venue Map */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="mb-12"
          >
            <VenueMap
              venue={WARRI_CRUSADE_VENUE}
              headerTitle="Event Venue"
              height={380}
              theme={{
                headerBg: "rgba(10,26,74,0.8)",
                headerBorder: "rgba(212,160,23,0.25)",
                accentText: "text-yellow-400",
                footerBg: "rgba(10,26,74,0.8)",
              }}
            />
          </motion.div>

          {/* Event Details */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.45 }}
            className="mb-12 rounded-3xl p-6 border border-yellow-400/20 space-y-4"
            style={{ background: "rgba(10,26,74,0.7)" }}
          >
            <h3 className="font-serif font-bold text-white text-xl mb-2">Event Details</h3>
            {[
              { icon: Calendar, label: "Dates", value: "Thursday 30th April & Friday 1st May, 2026" },
              { icon: Clock, label: "Time", value: "6:00 PM Daily (West Africa Time)" },
              { icon: MapPin, label: "Venue", value: LOCATION },
              { icon: Phone, label: "Contact", value: CONTACT },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-3">
                <Icon className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-yellow-400/60 font-bold uppercase tracking-wider">{label}</p>
                  <p className="text-white/80 text-sm">{value}</p>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Footer CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="text-center rounded-3xl p-8 border border-yellow-400/20"
            style={{ background: "rgba(10,26,74,0.6)" }}
          >
            <h3 className="font-serif font-bold text-white text-2xl mb-2">What's Next?</h3>
            <p className="text-white/60 text-sm mb-6 max-w-md mx-auto">
              The Warri City Crusade 2026 has concluded. See what's coming next or explore our sermon archive.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/events">
                <Button
                  className="rounded-xl font-bold px-6 py-3 h-auto"
                  style={{ background: "linear-gradient(135deg, #D4A017, #FFD700)", color: "#0a1a4a" }}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Upcoming Events
                </Button>
              </Link>
              <Link href="/sermons">
                <Button
                  variant="outline"
                  className="rounded-xl font-bold px-6 py-3 h-auto border-yellow-400/40 text-yellow-400 hover:bg-yellow-400/10"
                >
                  <Youtube className="h-4 w-4 mr-2" />
                  Watch on Temple TV
                </Button>
              </Link>
            </div>
            <div className="mt-6 flex items-center justify-center gap-2 text-white/50 text-sm">
              <Phone className="h-4 w-4 text-yellow-400" />
              Enquiries: <a href={`tel:${CONTACT.replace(/\s/g, "")}`} className="text-yellow-400 font-bold hover:underline ml-1">{CONTACT}</a>
            </div>
          </motion.div>

        </div>
      </div>
    </Layout>
  );
}

export function CrusadeAdBanner() {
  return null;
}

import { useState, useEffect, useRef, useCallback } from "react";
import { Layout } from "@/components/layout/Layout";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar, MapPin, Clock, Phone, Share2, Download, Copy, Check,
  Bell, BellOff, Users, ChevronDown, ExternalLink, Sparkles, Flame,
  Facebook, Instagram, Youtube, X, Camera, ImagePlus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const CRUSADE_START = new Date("2026-04-30T18:00:00+01:00");
const CRUSADE_END = new Date("2026-05-01T21:00:00+01:00");
const LOCATION = "Ighogbadu Primary School, Obodo, Okumagba Avenue, Warri South L.G.A., Delta State";
const CONTACT = "+234(0)8081313111";
const EVENT_TITLE = "Warri City Crusade 2026 — Prophet Amos Global Crusade";
const EVENT_THEME = "Be Ready For Rapture: Tribulation Is Coming! Run For Your Soul!";
const CRUSADE_YT_VIDEO = "oJUkSAZu0y0";

function useCountdown(target: Date) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, started: false });
  useEffect(() => {
    const calc = () => {
      const now = new Date();
      const diff = target.getTime() - now.getTime();
      if (diff <= 0) { setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, started: true }); return; }
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
        started: false,
      });
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [target]);
  return timeLeft;
}

function CountdownBlock({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <motion.div
        key={value}
        initial={{ rotateX: -90, opacity: 0 }}
        animate={{ rotateX: 0, opacity: 1 }}
        transition={{ duration: 0.35 }}
        className="w-20 h-20 md:w-28 md:h-28 rounded-2xl flex items-center justify-center font-mono font-black text-4xl md:text-5xl text-white shadow-2xl border border-yellow-400/30"
        style={{ background: "linear-gradient(135deg, #0a1a4a 0%, #1a3a8a 100%)" }}
      >
        {String(value).padStart(2, "0")}
      </motion.div>
      <span className="mt-2 text-[10px] md:text-xs text-yellow-400 uppercase tracking-[0.2em] font-bold">{label}</span>
    </div>
  );
}

const AD_COPIES = {
  short: {
    label: "Short (Stories / Reels)",
    platform: "Instagram & Facebook Stories",
    icon: Instagram,
    text: `🔥 THE RAPTURE IS NEAR. ARE YOU READY?

Join Prophet Amos at the Warri City Crusade 2026!

📅 April 30 – May 1, 2026
⏰ 6:00 PM Daily
📍 Ighogbadu Primary School, Warri

Run for your soul. Tribulation is coming.

#WarriCrusade2026 #Rapture #ProphetAmos`,
  },
  medium: {
    label: "Medium (Feed Posts)",
    platform: "Facebook & Instagram Feed",
    icon: Facebook,
    text: `⚡ BREAKING: TRIBULATION IS COMING — RUN FOR YOUR SOUL! ⚡

The Jesus Christ Temple Ministry invites you to the most powerful spiritual gathering of 2026 — The Warri City Crusade (Prophet Amos Global Crusade).

📖 Theme: "Be Ready For Rapture: Tribulation Is Coming! Run For Your Soul!"

This is not an ordinary church service. This is a divine emergency alert to the Body of Christ and every soul in Warri and Delta State.

📅 Date: Thursday 30th April & Friday 1st May, 2026
⏰ Time: 6:00 PM Daily (WAT)
📍 Venue: Ighogbadu Primary School, Obodo, Okumagba Avenue, Warri South L.G.A., Delta State

Come expecting miracles, healing, deliverance, and a direct encounter with the living God.

📞 Enquiries: +234(0)8081313111

Share this. Tag 5 souls who need to hear this message. The time is now.

#WarriCrusade2026 #ProphetAmos #BeReadyForRapture #TribulationIsComing #JCTMinistry #WarriForJesus`,
  },
  long: {
    label: "Long (YouTube / Blog)",
    platform: "YouTube Ads & Blog",
    icon: Youtube,
    text: `🌍 WARRI CITY CRUSADE 2026 — PROPHET AMOS GLOBAL CRUSADE

EVENT DETAILS:
• Event: Warri City Crusade 2026 / Prophet Amos Global Crusade
• Theme: "Be Ready For Rapture: Tribulation Is Coming! Run For Your Soul!"
• Date: Thursday 30th April & Friday 1st May, 2026
• Time: 6:00 PM Daily (West Africa Time)
• Venue: Ighogbadu Primary School, Obodo, Okumagba Avenue, Warri South L.G.A., Delta State, Nigeria
• Enquiries: +234(0)8081313111

THE MESSAGE IS URGENT:
We are living in the last of the last days. The signs of the times are unmistakably clear. Across the globe, the Holy Spirit is sounding an alarm — the Rapture of the Church is at hand. Tribulation, unlike anything the world has ever witnessed, is about to be unleashed upon the earth.

Prophet Amos, anointed and commissioned by the Lord Jesus Christ, will be ministering under a burning mandate: to warn souls, ignite faith, and prepare the body of Christ for what is coming.

WHAT TO EXPECT:
✅ Powerful prophetic ministry under the anointing
✅ Mass deliverance and healing miracles
✅ Deep revelatory teaching on end-time events
✅ Altar calls and soul-winning
✅ A life-changing encounter with the Living God

WHO SHOULD ATTEND:
This crusade is for every soul — whether you are saved, backslidden, or searching. If you are in Warri or within driving distance of Delta State, there is no excuse to miss this divine appointment.

INVITE OTHERS: Share this post. Print flyers. Call your unsaved friends and family. The King is coming, and not a soul should be left behind.

"Watch therefore, for you know neither the day nor the hour." — Matthew 25:13

Subscribe to JCTM Digital Sanctuary for live crusade updates, sermons, and testimonies.

#WarriCityCrusade2026 #ProphetAmosGlobalCrusade #BeReadyForRapture #TribulationIsComing #JesusChristTempleMinistry #EndTimes #Rapture2026 #WarriForJesus #DeltaStateRevival`,
  },
};

function FlyerShowcase() {
  const shareText = encodeURIComponent(`🔥 WARRI CITY CRUSADE 2026!\n\n"${EVENT_THEME}"\n\nThursday 30th April & Friday 1st May, 2026\n⏰ 6:00 PM Daily (WAT)\n📍 Ighogbadu Primary School, Obodo, Okumagba Avenue, Warri South, Delta State\n\n📞 ${CONTACT}\n🌐 www.jctm.org.ng\n\n#WarriCrusade2026 #ProphetAmos #BeReadyForRapture`);
  const shareUrl = encodeURIComponent("https://jctm.church/crusade");
  const platforms = [
    { label: "WhatsApp", emoji: "💬", bg: "#25D366", href: `https://wa.me/?text=${shareText}` },
    { label: "Facebook", emoji: "👍", bg: "#1877F2", href: `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}&quote=${shareText}` },
    { label: "X / Twitter", emoji: "𝕏", bg: "#000", href: `https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}` },
    { label: "Telegram", emoji: "✈️", bg: "#0088CC", href: `https://t.me/share/url?url=${shareUrl}&text=${shareText}` },
    { label: "Instagram", emoji: "📷", bg: "linear-gradient(135deg,#E1306C,#833AB4,#F77737)", href: "https://www.instagram.com/templetv.jctm/" },
  ];

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = "/warri-crusade-flyer2.jpeg";
    link.download = "warri-city-crusade-2026-flyer.jpeg";
    link.click();
    toast.success("Flyer downloaded! Share it everywhere — WhatsApp, Facebook, Instagram.");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.2 }}
      className="mb-14 rounded-3xl overflow-hidden border-2 group relative"
      style={{ borderColor: "rgba(212,160,23,0.6)" }}
    >
      <img
        src="/warri-crusade-flyer2.jpeg"
        alt="Warri City Crusade 2026 — Official Event Flyer"
        className="w-full object-cover group-hover:scale-105 transition-transform duration-700"
        style={{ maxHeight: "600px", objectPosition: "center top" }}
        loading="lazy"
        decoding="async"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#020b2a] via-[#020b2a]/30 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
        <p className="text-yellow-400 text-xs font-bold uppercase tracking-[0.25em] mb-4 flex items-center gap-2">
          <Share2 className="h-3.5 w-3.5" />
          Official Flyer — Share on All Platforms
        </p>
        <div className="flex flex-wrap gap-2.5">
          {platforms.map(p => (
            <a
              key={p.label}
              href={p.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-sm font-bold transition-all hover:scale-105 hover:shadow-2xl shadow-lg"
              style={{ background: p.bg }}
            >
              <span>{p.emoji}</span>
              <span className="hidden sm:inline">{p.label}</span>
            </a>
          ))}
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105 shadow-lg border-2"
            style={{ borderColor: "#D4A017", color: "#FFD700", background: "rgba(212,160,23,0.12)" }}
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Download Flyer</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function CrusadeVideoLoop() {
  const videoShareText = encodeURIComponent(`🔥 Watch the official Warri City Crusade 2026 promo!\n\n"${EVENT_THEME}"\n\nThursday 30th April & Friday 1st May, 2026 · 6PM Daily\n📍 Ighogbadu Primary School, Warri\n\nhttps://youtu.be/${CRUSADE_YT_VIDEO}\n\n#WarriCrusade2026 #ProphetAmos`);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.4 }}
      className="mb-10 rounded-3xl overflow-hidden border border-yellow-400/20"
      style={{ background: "rgba(10,26,74,0.7)" }}
    >
      <div className="p-6 border-b border-yellow-400/10">
        <div className="flex items-center gap-3 mb-1">
          <Youtube className="h-5 w-5 text-red-500" />
          <h3 className="font-serif font-bold text-white text-xl">Warri Crusade 2026 — YouTube Ad (Running Now)</h3>
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-red-400 font-bold uppercase tracking-widest">
            <span className="h-2 w-2 bg-red-400 rounded-full animate-pulse" /> Live Promo
          </span>
        </div>
        <p className="text-white/60 text-sm">The official crusade video uploaded to YouTube. Playing as a continuous ad — watch, share, and amplify the reach across all platforms.</p>
      </div>
      <div className="p-4">
        <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ aspectRatio: "16/9" }}>
          <iframe
            src={`https://www.youtube.com/embed/${CRUSADE_YT_VIDEO}?autoplay=1&mute=1&loop=1&playlist=${CRUSADE_YT_VIDEO}&controls=1&rel=0&modestbranding=1`}
            title="Warri City Crusade 2026 — Official Promo Video"
            allow="autoplay; fullscreen; accelerometer; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
        <div className="flex flex-wrap gap-3 mt-5 justify-center">
          <a
            href={`https://www.youtube.com/watch?v=${CRUSADE_YT_VIDEO}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold bg-red-600 hover:bg-red-700 transition-all hover:scale-105 shadow-lg"
          >
            <Youtube className="h-4 w-4" /> Watch Full Video
          </a>
          <a
            href={`https://wa.me/?text=${videoShareText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-all hover:scale-105 shadow-lg"
            style={{ background: "#25D366" }}
          >
            💬 Share on WhatsApp
          </a>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`https://youtu.be/${CRUSADE_YT_VIDEO}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-all hover:scale-105 shadow-lg"
            style={{ background: "#1877F2" }}
          >
            👍 Share on Facebook
          </a>
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`🔥 "${EVENT_THEME}" — Watch the Warri City Crusade 2026 promo! Apr 30–May 1, Warri. #WarriCrusade2026`)}&url=https://youtu.be/${CRUSADE_YT_VIDEO}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold bg-black hover:bg-gray-900 transition-all hover:scale-105 shadow-lg"
          >
            𝕏 Share on X
          </a>
        </div>
      </div>
    </motion.div>
  );
}

function AdCopySection() {
  const [active, setActive] = useState<keyof typeof AD_COPIES>("medium");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(AD_COPIES[active].text);
    setCopied(true);
    toast.success("Ad copy copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-3xl overflow-hidden border border-yellow-400/20" style={{ background: "rgba(10,26,74,0.7)" }}>
      <div className="p-6 border-b border-yellow-400/10">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="h-5 w-5 text-yellow-400" />
          <h3 className="font-serif font-bold text-white text-xl">Automated Ad Copy Generator</h3>
        </div>
        <p className="text-white/60 text-sm">3 professionally crafted ad versions for every platform. Copy and deploy instantly.</p>
      </div>
      <div className="flex border-b border-yellow-400/10">
        {(Object.entries(AD_COPIES) as [keyof typeof AD_COPIES, typeof AD_COPIES.short][]).map(([key, val]) => {
          const Icon = val.icon;
          return (
            <button
              key={key}
              onClick={() => setActive(key)}
              className={`flex-1 py-3 px-2 text-xs font-bold uppercase tracking-wider transition-all duration-200 flex flex-col items-center gap-1 ${
                active === key
                  ? "text-yellow-400 border-b-2 border-yellow-400 bg-yellow-400/5"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {val.label}
            </button>
          );
        })}
      </div>
      <div className="p-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-yellow-400/70 font-medium uppercase tracking-widest">
            {AD_COPIES[active].platform}
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-white/60 hover:text-yellow-400 transition-colors"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <pre className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed font-sans max-h-64 overflow-y-auto custom-scroll">
          {AD_COPIES[active].text}
        </pre>
      </div>
    </div>
  );
}

function InviteCardGenerator({ initialName = "", initialPhoto = null }: { initialName?: string; initialPhoto?: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialName);
  const [photo, setPhoto] = useState<string | null>(initialPhoto);
  const [generated, setGenerated] = useState(false);

  useEffect(() => { if (initialName) setName(initialName); }, [initialName]);
  useEffect(() => { if (initialPhoto) setPhoto(initialPhoto); }, [initialPhoto]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Photo must be under 10 MB."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { setPhoto(ev.target?.result as string); setGenerated(false); };
    reader.readAsDataURL(file);
  };

  const generate = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 1080, H = 1440;
    canvas.width = W;
    canvas.height = H;

    const royal = "#0a1a6b";
    const gold = "#D4A017";
    const goldLight = "#FFD700";

    // ── Full background ─────────────────────────────────────────────
    ctx.fillStyle = royal;
    ctx.fillRect(0, 0, W, H);

    const radial = ctx.createRadialGradient(W / 2, H * 0.5, 0, W / 2, H * 0.5, H * 0.7);
    radial.addColorStop(0, "rgba(30,80,180,0.5)");
    radial.addColorStop(1, "rgba(10,26,107,0)");
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, W, H);

    // Stars across full card
    for (let i = 0; i < 80; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * W, Math.random() * H, Math.random() * 1.5 + 0.4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,220,60,${Math.random() * 0.45 + 0.08})`;
      ctx.fill();
    }

    // Outer gold border
    ctx.strokeStyle = gold; ctx.lineWidth = 8;
    ctx.strokeRect(28, 28, W - 56, H - 56);
    ctx.strokeStyle = goldLight; ctx.lineWidth = 2;
    ctx.strokeRect(42, 42, W - 84, H - 84);
    // Corner dots
    [[50, 50], [W - 50, 50], [50, H - 50], [W - 50, H - 50]].forEach(([cx, cy]) => {
      ctx.fillStyle = goldLight;
      ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();
    });

    ctx.textAlign = "center";

    // ════════════════════════════════════════════════════════════════
    // SECTION 1 — TOP: "JCTM PRESENTS" (Y: 0–220)
    // ════════════════════════════════════════════════════════════════
    ctx.fillStyle = goldLight; ctx.font = `bold 20px sans-serif`;
    ctx.fillText("✦  ✦  ✦", W / 2, 82);

    ctx.fillStyle = "#ffffff"; ctx.font = `bold 44px serif`;
    ctx.fillText("JESUS CHRIST TEMPLE MINISTRY", W / 2, 142);

    ctx.fillStyle = gold; ctx.font = `bold 28px sans-serif`;
    ctx.fillText("P  R  E  S  E  N  T  S", W / 2, 186);

    // Divider
    ctx.strokeStyle = gold; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(120, 210); ctx.lineTo(W - 120, 210); ctx.stroke();

    // ════════════════════════════════════════════════════════════════
    // SECTION 2 — MIDDLE: Photo + Name (Y: 220–740)
    // ════════════════════════════════════════════════════════════════
    const hasName = name.trim().length > 0;
    const hasPhoto = !!photo;

    // Square photo dimensions — centred horizontally
    const photoSize = 500;           // side length of the square
    const photoX = (W - photoSize) / 2;
    const photoY = 220;              // top edge of the photo
    const photoBottom = photoY + photoSize;

    if (hasPhoto) {
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          const iw = img.naturalWidth  || img.width  || 1;
          const ih = img.naturalHeight || img.height || 1;

          // ── Gold glow halo behind the square ──────────────────────
          ctx.shadowColor = "rgba(212,160,23,0.6)";
          ctx.shadowBlur = 52;
          ctx.fillStyle = "rgba(212,160,23,0.15)";
          ctx.beginPath();
          ctx.roundRect(photoX - 12, photoY - 12, photoSize + 24, photoSize + 24, 30);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.shadowColor = "transparent";

          // ── Square clip (rounded corners) ─────────────────────────
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(photoX, photoY, photoSize, photoSize, 20);
          ctx.clip();

          // Contain-fit: scale so the longest side fits inside the square,
          // then centre — the full image is always visible, never cropped.
          const scale = Math.min(photoSize / iw, photoSize / ih);
          const dw = iw * scale;   // drawn width  (≤ photoSize)
          const dh = ih * scale;   // drawn height (≤ photoSize)
          const dx = photoX + (photoSize - dw) / 2;  // centred horizontally
          const dy = photoY + (photoSize - dh) / 2;  // centred vertically
          ctx.drawImage(img, dx, dy, dw, dh);

          ctx.restore();

          // ── Bold outer gold border ────────────────────────────────
          ctx.strokeStyle = goldLight;
          ctx.lineWidth = 12;
          ctx.beginPath();
          ctx.roundRect(photoX - 6, photoY - 6, photoSize + 12, photoSize + 12, 24);
          ctx.stroke();

          // ── Thin accent border further out ───────────────────────
          ctx.strokeStyle = gold;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.roundRect(photoX - 20, photoY - 20, photoSize + 40, photoSize + 40, 32);
          ctx.stroke();

          resolve();
        };
        img.onerror = () => resolve();
        img.src = photo!;
      });
    } else {
      // Placeholder square when no photo uploaded
      ctx.fillStyle = "rgba(30,60,160,0.45)";
      ctx.beginPath(); ctx.roundRect(photoX, photoY, photoSize, photoSize, 20); ctx.fill();
      ctx.strokeStyle = "rgba(212,160,23,0.45)"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.roundRect(photoX, photoY, photoSize, photoSize, 20); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.14)"; ctx.font = `110px sans-serif`;
      ctx.fillText("🙏", W / 2, photoY + photoSize / 2 + 40);
    }

    // ── Bold name block below photo ──────────────────────────────
    let nameBlockBottom = photoBottom;

    if (hasName) {
      nameBlockBottom = photoBottom + 14;

      // Bold dark backing panel for the name
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.beginPath();
      ctx.roundRect(photoX - 5, nameBlockBottom, photoSize + 10, 74, 0);
      ctx.fill();

      // Gold top stripe on the name panel
      ctx.fillStyle = gold;
      ctx.fillRect(photoX - 5, nameBlockBottom, photoSize + 10, 6);

      // Name text — large, bold, white
      ctx.fillStyle = "#ffffff";
      ctx.font = `900 54px serif`;
      ctx.fillText(name.toUpperCase(), W / 2, nameBlockBottom + 56);

      nameBlockBottom += 88;
    }

    // "I will be attending" badge
    const badgeY = nameBlockBottom + 18;
    ctx.fillStyle = "rgba(212,160,23,0.28)";
    ctx.beginPath(); ctx.roundRect(W / 2 - 300, badgeY, 600, 54, 27); ctx.fill();
    ctx.strokeStyle = gold; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(W / 2 - 300, badgeY, 600, 54, 27); ctx.stroke();
    ctx.fillStyle = goldLight; ctx.font = `bold 23px sans-serif`;
    ctx.fillText("🙋  I WILL BE ATTENDING — JOIN ME!", W / 2, badgeY + 36);

    // Divider into bottom section
    const midEnd = badgeY + 72;
    ctx.strokeStyle = gold; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(120, midEnd); ctx.lineTo(W - 120, midEnd); ctx.stroke();

    // ════════════════════════════════════════════════════════════════
    // SECTION 3 — BOTTOM: Crusade Info (Y: midEnd – H)
    // ════════════════════════════════════════════════════════════════
    let y = midEnd + 58;

    ctx.fillStyle = goldLight; ctx.font = `bold 66px serif`;
    ctx.fillText("WARRI CITY", W / 2, y);
    y += 72;

    ctx.fillStyle = "#ffffff"; ctx.font = `bold 58px serif`;
    ctx.fillText("CRUSADE 2026", W / 2, y);
    y += 50;

    ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.font = `italic 24px serif`;
    ctx.fillText("Prophet Amos Global Crusade", W / 2, y);
    y += 48;

    ctx.fillStyle = gold; ctx.font = `italic 22px serif`;
    ["\u201cBe Ready For Rapture:", "Tribulation Is Coming!", "Run For Your Soul!\u201d"].forEach((line) => {
      ctx.fillText(line, W / 2, y); y += 30;
    });
    y += 14;

    // Details panel
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.beginPath(); ctx.roundRect(80, y, W - 160, 168, 16); ctx.fill();
    ctx.strokeStyle = "rgba(212,160,23,0.25)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(80, y, W - 160, 168, 16); ctx.stroke();
    y += 36;

    ctx.fillStyle = "#ffffff"; ctx.font = `bold 28px sans-serif`;
    ctx.fillText("📅  THU 30 APR & FRI 1 MAY, 2026", W / 2, y); y += 38;

    ctx.fillStyle = gold; ctx.font = `24px sans-serif`;
    ctx.fillText("⏰  6:00 PM Daily  ·  WAT", W / 2, y); y += 34;

    ctx.fillStyle = "#ffffff"; ctx.font = `21px sans-serif`;
    ctx.fillText("📍 Ighogbadu Primary School, Okumagba Ave, Warri", W / 2, y); y += 34;

    ctx.fillStyle = gold; ctx.font = `bold 20px sans-serif`;
    ctx.fillText(`📞 ${CONTACT}  ·  jctm.church`, W / 2, y); y += 36;

    ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.font = `18px sans-serif`;
    ctx.fillText("#WarriCrusade2026  ·  #ProphetAmos  ·  Free Admission", W / 2, H - 50);

    setGenerated(true);
  }, [name, photo]);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "warri-crusade-2026-invite.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
    toast.success("Invite card downloaded! Share on WhatsApp & Instagram.");
  };

  const share = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        const file = new File([blob], "warri-crusade-2026-invite.png", { type: "image/png" });
        if (navigator.share && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: EVENT_TITLE, text: EVENT_THEME });
        } else {
          download();
        }
      } catch {
        download();
      }
    }, "image/png");
  };

  return (
    <div className="rounded-3xl overflow-hidden border border-yellow-400/20" style={{ background: "rgba(10,26,74,0.7)" }}>
      <div className="p-6 border-b border-yellow-400/10">
        <div className="flex items-center gap-3 mb-2">
          <Share2 className="h-5 w-5 text-yellow-400" />
          <h3 className="font-serif font-bold text-white text-xl">Generate Shareable Invite Card</h3>
        </div>
        <p className="text-white/60 text-sm">Add your name and photo to create a personalised digital invite to share on WhatsApp and Instagram.</p>
      </div>
      <div className="p-6 space-y-4">
        {/* Photo + Name row */}
        <div className="flex items-center gap-4">
          <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          <button
            type="button"
            onClick={() => photoRef.current?.click()}
            className="relative group shrink-0 transition-all duration-200"
            title="Upload your photo"
          >
            {photo ? (
              <div className="relative">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-yellow-400 shadow-lg group-hover:border-yellow-300 transition-all">
                  <img src={photo} alt="Your photo" className="w-full h-full object-cover" />
                </div>
                <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera className="h-4 w-4 text-white" />
                </div>
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-yellow-400/40 flex flex-col items-center justify-center gap-0.5 bg-white/5 group-hover:bg-white/10 group-hover:border-yellow-400 transition-all">
                <Camera className="h-5 w-5 text-yellow-400/60 group-hover:text-yellow-400" />
                <span className="text-[8px] text-yellow-400/50 group-hover:text-yellow-400 font-bold uppercase">Photo</span>
              </div>
            )}
          </button>
          <div className="flex-1 flex gap-2">
            <Input
              placeholder="Your full name (optional)"
              value={name}
              onChange={(e) => { setName(e.target.value); setGenerated(false); }}
              className="bg-white/10 border-yellow-400/30 text-white placeholder:text-white/40 rounded-xl"
            />
            <Button
              onClick={generate}
              className="rounded-xl shrink-0 font-bold"
              style={{ background: "linear-gradient(135deg, #D4A017, #FFD700)", color: "#0a1a4a" }}
            >
              Generate
            </Button>
          </div>
        </div>

        {photo && (
          <button
            type="button"
            onClick={() => { setPhoto(null); setGenerated(false); if (photoRef.current) photoRef.current.value = ""; }}
            className="text-xs text-white/40 hover:text-red-400 transition-colors block"
          >
            Remove photo
          </button>
        )}

        <canvas
          ref={canvasRef}
          className={`w-full rounded-2xl border border-yellow-400/20 transition-opacity duration-300 ${generated ? "opacity-100" : "opacity-0 h-0"}`}
          style={{ aspectRatio: "1/1", objectFit: "contain" }}
        />

        {generated && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
            <Button onClick={share} className="flex-1 gap-2 rounded-xl" style={{ background: "linear-gradient(135deg, #D4A017, #FFD700)", color: "#0a1a4a" }}>
              <Share2 className="h-4 w-4" /> Share
            </Button>
            <Button onClick={download} variant="outline" className="flex-1 gap-2 rounded-xl border-yellow-400/40 text-yellow-400 hover:bg-yellow-400/10">
              <Download className="h-4 w-4" /> Download
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function AddToCalendar() {
  const [open, setOpen] = useState(false);
  const title = encodeURIComponent(EVENT_TITLE);
  const details = encodeURIComponent(`Theme: ${EVENT_THEME}\n\nContact: ${CONTACT}`);
  const location = encodeURIComponent(LOCATION);
  const startUTC = "20260430T170000Z";
  const endUTC = "20260501T200000Z";

  const links = [
    {
      label: "Google Calendar",
      icon: "🗓️",
      href: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startUTC}/${endUTC}&details=${details}&location=${location}`,
    },
    {
      label: "Apple Calendar (.ics)",
      icon: "🍎",
      href: `data:text/calendar;charset=utf8,BEGIN:VCALENDAR%0AVERSION:2.0%0ABEGIN:VEVENT%0ADTSTART:20260430T170000Z%0ADTEND:20260501T200000Z%0ASUMMARY:${title}%0ADESCRIPTION:${details}%0ALOCATION:${location}%0AEND:VEVENT%0AEND:VCALENDAR`,
      download: "warri-crusade-2026.ics",
    },
    {
      label: "Outlook Calendar",
      icon: "📅",
      href: `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=2026-04-30T17:00:00Z&enddt=2026-05-01T20:00:00Z&body=${details}&location=${location}`,
    },
  ];

  return (
    <div className="relative">
      <Button
        onClick={() => setOpen((v) => !v)}
        variant="outline"
        className="gap-2 rounded-xl border-yellow-400/40 text-yellow-400 hover:bg-yellow-400/10 w-full"
      >
        <Calendar className="h-4 w-4" />
        Add to Calendar
        <ChevronDown className={`h-3.5 w-3.5 ml-auto transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-2 rounded-2xl overflow-hidden border border-yellow-400/20 z-30 shadow-2xl"
            style={{ background: "#0a1a4a" }}
          >
            {links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target={link.download ? undefined : "_blank"}
                rel="noopener noreferrer"
                download={link.download}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-5 py-3.5 text-white hover:bg-white/10 transition-colors text-sm font-medium border-b border-white/5 last:border-0"
              >
                <span className="text-base">{link.icon}</span>
                {link.label}
                <ExternalLink className="h-3 w-3 ml-auto text-white/30" />
              </a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NotificationManager() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
    setEnabled(localStorage.getItem("crusade_notif_enabled") === "true");
  }, []);

  const requestAndEnable = async () => {
    if (!("Notification" in window)) {
      toast.error("Your browser doesn't support notifications.");
      return;
    }
    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm === "granted") {
      localStorage.setItem("crusade_notif_enabled", "true");
      setEnabled(true);
      scheduleNotifications();
      toast.success("Notifications enabled! You'll be reminded 7 days, 24 hours, and 1 hour before the crusade.");
    } else {
      toast.error("Permission denied. Please enable notifications in your browser settings.");
    }
  };

  const disable = () => {
    localStorage.removeItem("crusade_notif_enabled");
    setEnabled(false);
    toast.info("Crusade notifications disabled.");
  };

  const scheduleNotifications = () => {
    const now = Date.now();
    const crusade = CRUSADE_START.getTime();
    const reminders = [
      { offset: 7 * 24 * 60 * 60 * 1000, label: "7 days", title: "⏰ 7 Days to Warri City Crusade 2026!", body: "The crusade begins in 7 days. Get ready — April 30th at 6PM, Ighogbadu Primary School, Warri." },
      { offset: 24 * 60 * 60 * 1000, label: "24 hours", title: "🔥 Tomorrow! Warri City Crusade 2026", body: "The crusade is TOMORROW at 6PM! Ighogbadu Primary School, Okumagba Avenue, Warri. Be there!" },
      { offset: 60 * 60 * 1000, label: "1 hour", title: "⚡ 1 Hour to Crusade! Run For Your Soul!", body: "The Warri City Crusade starts in 1 HOUR. Make your way to Ighogbadu Primary School now. See you there!" },
    ];
    reminders.forEach(({ offset, title, body }) => {
      const fireAt = crusade - offset;
      const delay = fireAt - now;
      if (delay > 0 && delay < 30 * 24 * 60 * 60 * 1000) {
        setTimeout(() => {
          if (Notification.permission === "granted" && localStorage.getItem("crusade_notif_enabled") === "true") {
            new Notification(title, { body, icon: "/favicon.ico", tag: `crusade-${offset}` });
          }
        }, delay);
      }
    });
  };

  return (
    <div className="rounded-2xl p-4 border border-yellow-400/20 flex items-center justify-between gap-4" style={{ background: "rgba(10,26,74,0.6)" }}>
      <div className="flex items-center gap-3">
        {enabled ? <Bell className="h-5 w-5 text-yellow-400" /> : <BellOff className="h-5 w-5 text-white/40" />}
        <div>
          <p className="text-white text-sm font-semibold">{enabled ? "Notifications Active" : "Get Reminders"}</p>
          <p className="text-white/50 text-xs">{enabled ? "7 days · 24 hours · 1 hour before" : "Be notified before the crusade starts"}</p>
        </div>
      </div>
      {enabled ? (
        <Button onClick={disable} size="sm" variant="outline" className="rounded-xl border-yellow-400/30 text-yellow-400/70 hover:bg-yellow-400/10 text-xs shrink-0">
          Disable
        </Button>
      ) : (
        <Button onClick={requestAndEnable} size="sm" className="rounded-xl shrink-0 text-xs font-bold" style={{ background: "#D4A017", color: "#0a1a4a" }}>
          Enable
        </Button>
      )}
    </div>
  );
}

function RSVPForm({ onSuccess }: { onSuccess: (name: string, photo: string | null) => void }) {
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", city: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Photo must be under 10 MB."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setPhoto(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim()) { toast.error("Please enter your name."); return; }
    setLoading(true);
    try {
      const res = await fetch(`${base}/api/crusade/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: form.fullName, email: form.email || null, phone: form.phone || null, city: form.city || null }),
      });
      if (!res.ok) throw new Error();
      setDone(true);
      onSuccess(form.fullName, photo);
      toast.success(`Thank you, ${form.fullName.split(" ")[0]}! Your attendance has been registered. See you at the crusade! 🔥`);
    } catch {
      toast.error("Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
        {photo ? (
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-yellow-400 shadow-xl">
              <img src={photo} alt="Your photo" className="w-full h-full object-cover" />
            </div>
          </div>
        ) : (
          <div className="text-5xl mb-4">🙌</div>
        )}
        <h4 className="font-serif font-bold text-white text-2xl mb-2">You&apos;re Registered!</h4>
        <p className="text-yellow-400 text-sm">See you at Ighogbadu Primary School on April 30th.</p>
        <p className="text-white/50 text-xs mt-2">Scroll down to generate your personalised invite card.</p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {/* Photo upload */}
      <div className="flex flex-col items-center gap-2">
        <input
          ref={photoRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePhotoChange}
        />
        <button
          type="button"
          onClick={() => photoRef.current?.click()}
          className="relative group transition-all duration-200"
        >
          {photo ? (
            <div className="relative">
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-yellow-400 shadow-xl group-hover:border-yellow-300 transition-all">
                <img src={photo} alt="Your photo" className="w-full h-full object-cover" />
              </div>
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Camera className="h-6 w-6 text-white" />
              </div>
            </div>
          ) : (
            <div className="w-24 h-24 rounded-full border-2 border-dashed border-yellow-400/50 flex flex-col items-center justify-center gap-1 bg-white/5 group-hover:bg-white/10 group-hover:border-yellow-400 transition-all">
              <ImagePlus className="h-6 w-6 text-yellow-400/70 group-hover:text-yellow-400" />
              <span className="text-[10px] text-yellow-400/60 group-hover:text-yellow-400 font-semibold uppercase tracking-wide">Add Photo</span>
            </div>
          )}
        </button>
        {photo && (
          <button
            type="button"
            onClick={() => { setPhoto(null); if (photoRef.current) photoRef.current.value = ""; }}
            className="text-xs text-white/40 hover:text-red-400 transition-colors"
          >
            Remove photo
          </button>
        )}
        <p className="text-xs text-white/40 text-center">Optional · Your photo appears on your invite card</p>
      </div>

      <Input
        required
        placeholder="Full Name *"
        value={form.fullName}
        onChange={(e) => setForm(f => ({ ...f, fullName: e.target.value }))}
        className="bg-white/10 border-yellow-400/20 text-white placeholder:text-white/40 rounded-xl"
      />
      <Input
        type="email"
        placeholder="Email Address (optional)"
        value={form.email}
        onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
        className="bg-white/10 border-yellow-400/20 text-white placeholder:text-white/40 rounded-xl"
      />
      <Input
        placeholder="Phone Number (optional)"
        value={form.phone}
        onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
        className="bg-white/10 border-yellow-400/20 text-white placeholder:text-white/40 rounded-xl"
      />
      <Input
        placeholder="Your City (optional)"
        value={form.city}
        onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))}
        className="bg-white/10 border-yellow-400/20 text-white placeholder:text-white/40 rounded-xl"
      />
      <motion.button
        type="submit"
        disabled={loading}
        whileHover={{ scale: 1.02, boxShadow: "0 0 30px rgba(212,160,23,0.5)" }}
        whileTap={{ scale: 0.98 }}
        className="w-full py-4 rounded-2xl font-serif font-black text-lg tracking-wide disabled:opacity-60 cursor-pointer transition-all duration-200"
        style={{ background: "linear-gradient(135deg, #D4A017 0%, #FFD700 50%, #D4A017 100%)", color: "#0a1a4a" }}
      >
        {loading ? "Registering…" : "✋ I Will Attend!"}
      </motion.button>
    </form>
  );
}

export default function Crusade() {
  const countdown = useCountdown(CRUSADE_START);
  const [attendCount, setAttendCount] = useState<number | null>(null);
  const [rsvpName, setRsvpName] = useState("");
  const [rsvpPhoto, setRsvpPhoto] = useState<string | null>(null);
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

  useEffect(() => {
    document.title = "Warri City Crusade 2026 | JCTM Digital Sanctuary";
    const meta = document.querySelector("meta[name='description']");
    if (meta) meta.setAttribute("content", `${EVENT_THEME} — ${LOCATION}. April 30 & May 1, 2026 at 6PM WAT. Join Prophet Amos at the Warri City Crusade 2026.`);
    const og = document.querySelector("meta[property='og:title']");
    if (og) og.setAttribute("content", EVENT_TITLE);

    fetch(`${base}/api/crusade/count`)
      .then(r => r.json())
      .then(d => setAttendCount(d.count))
      .catch(() => {});
  }, [base]);

  return (
    <Layout>
      <div
        className="relative min-h-screen"
        style={{
          background: "linear-gradient(180deg, #020b2a 0%, #0a1a5a 40%, #0d2060 70%, #060f38 100%)",
        }}
      >
        {/* SEO hidden content */}
        <h1 className="sr-only">Warri City Crusade 2026 — Prophet Amos Global Crusade | JCTM</h1>

        {/* Starfield BG */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 80 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: `${Math.random() * 2 + 1}px`,
                height: `${Math.random() * 2 + 1}px`,
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                background: `rgba(255,220,60,${Math.random() * 0.6 + 0.1})`,
                animation: `pulse ${2 + Math.random() * 3}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 3}s`,
              }}
            />
          ))}
        </div>

        {/* Gold cross glow */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-1 opacity-30 pointer-events-none"
          style={{ height: "300px", background: "linear-gradient(to bottom, #FFD700, transparent)" }}
        />
        <div
          className="absolute top-[150px] left-1/2 -translate-x-1/2 h-1 opacity-30 pointer-events-none"
          style={{ width: "300px", background: "linear-gradient(to right, transparent, #FFD700, transparent)" }}
        />

        <div className="relative z-10 container mx-auto px-4 py-16 max-w-5xl">

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold uppercase tracking-widest mb-6 border"
              style={{ borderColor: "rgba(212,160,23,0.4)", background: "rgba(212,160,23,0.1)", color: "#FFD700" }}
            >
              <Flame className="h-3.5 w-3.5" />
              Jesus Christ Temple Ministry Presents
            </motion.div>

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

          {/* Official Flyer with Social Sharing */}
          <FlyerShowcase />

          {/* Countdown */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="text-center mb-16"
          >
            <p className="text-xs text-yellow-400/60 uppercase tracking-[0.3em] font-bold mb-6">
              {countdown.started ? "The Crusade Has Begun!" : "Crusade Begins In"}
            </p>
            {!countdown.started ? (
              <div className="flex justify-center gap-4 md:gap-6">
                <CountdownBlock value={countdown.days} label="Days" />
                <CountdownBlock value={countdown.hours} label="Hours" />
                <CountdownBlock value={countdown.minutes} label="Minutes" />
                <CountdownBlock value={countdown.seconds} label="Seconds" />
              </div>
            ) : (
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="text-3xl font-serif font-black text-yellow-400"
              >
                🔥 The Crusade Is Happening NOW! 🔥
              </motion.div>
            )}
            {attendCount !== null && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="mt-6 inline-flex items-center gap-2 text-sm text-white/60"
              >
                <Users className="h-4 w-4 text-yellow-400" />
                <span className="text-yellow-400 font-bold">{attendCount.toLocaleString()}</span> people have registered to attend
              </motion.div>
            )}
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">

            {/* RSVP Card */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="rounded-3xl overflow-hidden"
              style={{ background: "rgba(10,26,74,0.8)", border: "1px solid rgba(212,160,23,0.25)" }}
            >
              <div className="p-6 border-b" style={{ borderColor: "rgba(212,160,23,0.15)", background: "rgba(212,160,23,0.08)" }}>
                <h3 className="font-serif font-bold text-white text-xl mb-1 flex items-center gap-2">
                  <span>✋</span> Register Your Attendance
                </h3>
                <p className="text-white/50 text-sm">Let the ministry know you&apos;re coming. Free entry for all.</p>
              </div>
              <div className="p-6 space-y-5">
                <RSVPForm onSuccess={(name, photo) => { setRsvpName(name); setRsvpPhoto(photo); }} />
                <NotificationManager />
                <AddToCalendar />
              </div>
            </motion.div>

            {/* Map */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="rounded-3xl overflow-hidden"
              style={{ border: "1px solid rgba(212,160,23,0.25)" }}
            >
              <div className="p-4 flex items-center gap-2" style={{ background: "rgba(10,26,74,0.8)", borderBottom: "1px solid rgba(212,160,23,0.15)" }}>
                <MapPin className="h-4 w-4 text-yellow-400" />
                <span className="text-white text-sm font-semibold">Live Location Map</span>
                <a
                  href="https://maps.google.com/?q=Ighogbadu+Primary+School+Okumagba+Avenue+Warri+Delta+State+Nigeria"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-xs text-yellow-400/70 hover:text-yellow-400 flex items-center gap-1"
                >
                  Open in Maps <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="relative" style={{ height: "400px" }}>
                <iframe
                  title="Warri City Crusade 2026 Venue Location"
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3975.7!2d5.737!3d5.517!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x1041efa0c6e75a3f%3A0x5de0c3b00c66e8a4!2sIghogbadu%20Primary%20School%2C%20Okumagba%20Ave%2C%20Warri%2C%20Delta%20State%2C%20Nigeria!5e0!3m2!1sen!2sng!4v1700000000000!5m2!1sen!2sng"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
              <div className="p-4" style={{ background: "rgba(10,26,74,0.8)" }}>
                <p className="text-white/70 text-xs flex items-start gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-yellow-400 shrink-0 mt-0.5" />
                  {LOCATION}
                </p>
              </div>
            </motion.div>
          </div>

          {/* YouTube Crusade Promo Loop */}
          <CrusadeVideoLoop />

          {/* Ad Copy Generator */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="mb-8"
          >
            <AdCopySection />
          </motion.div>

          {/* Invite Card Generator */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.6 }}
            className="mb-12"
          >
            <InviteCardGenerator initialName={rsvpName} initialPhoto={rsvpPhoto} />
          </motion.div>

          {/* YouTube Ad Banner Preview */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.7 }}
            className="rounded-3xl overflow-hidden border border-yellow-400/20 mb-12"
            style={{ background: "rgba(10,26,74,0.7)" }}
          >
            <div className="p-6 border-b border-yellow-400/10">
              <div className="flex items-center gap-3 mb-2">
                <Youtube className="h-5 w-5 text-red-500" />
                <h3 className="font-serif font-bold text-white text-xl">YouTube Live Ad Banner</h3>
              </div>
              <p className="text-white/60 text-sm">This banner appears at the bottom of all JCTM YouTube sermon pages, inviting viewers to the crusade.</p>
            </div>
            <div className="p-6">
              <div className="rounded-xl overflow-hidden">
                <div className="bg-black relative" style={{ aspectRatio: "16/9", maxHeight: "280px" }}>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-white/20 text-6xl">▶</div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0">
                    <CrusadeAdBanner compact />
                  </div>
                </div>
              </div>
              <p className="text-white/40 text-xs mt-3 text-center">Preview: banner overlay as shown on sermon videos</p>
            </div>
          </motion.div>

          {/* Contact & Share */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="text-center rounded-3xl p-8 border border-yellow-400/20"
            style={{ background: "rgba(10,26,74,0.6)" }}
          >
            <h3 className="font-serif font-bold text-white text-2xl mb-2">Spread The Word</h3>
            <p className="text-white/60 text-sm mb-6">The King is coming. Not a soul should be left behind. Share this crusade with everyone you know.</p>
            <div className="flex flex-wrap justify-center gap-3 mb-6">
              {[
                {
                  label: "Share on WhatsApp",
                  bg: "#25D366",
                  href: `https://wa.me/?text=${encodeURIComponent(`🔥 WARRI CITY CRUSADE 2026!\n\n"${EVENT_THEME}"\n\nThursday 30th April & Friday 1st May, 2026\n6:00 PM Daily\n📍 Ighogbadu Primary School, Obodo, Okumagba Avenue, Warri\n\n📞 ${CONTACT}\n\n#WarriCrusade2026 #ProphetAmos`)}`,
                  emoji: "💬",
                },
                {
                  label: "Share on Facebook",
                  bg: "#1877F2",
                  href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent("https://jctm.church/crusade")}`,
                  emoji: "👍",
                },
                {
                  label: "Share on X / Twitter",
                  bg: "#000000",
                  href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`🔥 Warri City Crusade 2026 — "Be Ready For Rapture: Tribulation Is Coming!"\n\n📅 April 30 – May 1, 2026\n⏰ 6PM Daily\n📍 Ighogbadu Primary School, Warri\n\n#WarriCrusade2026 #ProphetAmos #Rapture`)}`,
                  emoji: "𝕏",
                },
              ].map(({ label, bg, href, emoji }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-all hover:scale-105 hover:shadow-xl"
                  style={{ background: bg }}
                >
                  <span>{emoji}</span> {label}
                </a>
              ))}
            </div>
            <div className="flex items-center justify-center gap-2 text-white/50 text-sm">
              <Phone className="h-4 w-4 text-yellow-400" />
              Enquiries: <a href={`tel:${CONTACT.replace(/\s/g, "")}`} className="text-yellow-400 font-bold hover:underline">{CONTACT}</a>
            </div>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
}

export function CrusadeAdBanner({ compact = false }: { compact?: boolean }) {
  const countdown = useCountdown(CRUSADE_START);
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <motion.div
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 2 }}
      className={`relative w-full flex items-center justify-between gap-3 ${compact ? "px-4 py-3" : "px-5 py-4"}`}
      style={{
        background: "linear-gradient(90deg, #0a1a6b 0%, #1a3a8a 40%, #0a1a6b 100%)",
        borderTop: "2px solid #D4A017",
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-black"
          style={{ background: "#D4A017", color: "#0a1a6b" }}
        >
          🔥
        </div>
        <div className="min-w-0">
          <p className="text-yellow-400 font-bold text-xs uppercase tracking-widest truncate">Warri City Crusade 2026</p>
          <p className="text-white text-xs truncate opacity-80">Apr 30 – May 1 · Ighogbadu Primary School · 6PM Daily</p>
        </div>
      </div>

      {!countdown.started && (
        <div className="hidden md:flex items-center gap-2 shrink-0">
          {[
            { v: countdown.days, l: "D" },
            { v: countdown.hours, l: "H" },
            { v: countdown.minutes, l: "M" },
          ].map(({ v, l }) => (
            <div key={l} className="text-center">
              <div className="text-white font-mono font-black text-sm leading-none">{String(v).padStart(2, "0")}</div>
              <div className="text-yellow-400/60 text-[9px] uppercase">{l}</div>
            </div>
          ))}
        </div>
      )}

      <a
        href="/crusade"
        className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105"
        style={{ background: "#D4A017", color: "#0a1a6b" }}
      >
        Learn More
      </a>

      {!compact && (
        <button
          onClick={() => setVisible(false)}
          className="absolute top-1 right-1 text-white/30 hover:text-white/70 p-1"
          aria-label="Close"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </motion.div>
  );
}

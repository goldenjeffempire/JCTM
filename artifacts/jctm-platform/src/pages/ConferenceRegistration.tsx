import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone, MapPin,
  CheckCircle2,
  Flame, Calendar, Clock, Camera, ImagePlus, Copy, Check, Share2, Download,
  Sparkles, Instagram, Facebook, Youtube, Users, ExternalLink,
} from "lucide-react";
import Cropper from "react-easy-crop";
import type { Point, Area } from "react-easy-crop";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import ministerConferenceFlyer from "@assets/WhatsApp_Image_2026-04-16_at_2.59.53_PM_1776348424004.jpeg";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const CONF_START    = new Date("2026-05-08T07:00:00+01:00");
const CONF_LOCATION = "Church Auditorium, Km1 East West Rd., Ebrumede Roundabout, Effurun Uvwie L.G.A., Delta State";
const CONF_CONTACT  = "+234(0)8081313111";

function useCountdown(target: Date) {
  const [t, setT] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, started: false });
  useEffect(() => {
    const calc = () => {
      const diff = target.getTime() - Date.now();
      if (diff <= 0) { setT({ days: 0, hours: 0, minutes: 0, seconds: 0, started: true }); return; }
      setT({
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
  return t;
}

function CountdownBlock({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <motion.div
        key={value}
        initial={{ rotateX: -90, opacity: 0 }}
        animate={{ rotateX: 0, opacity: 1 }}
        transition={{ duration: 0.35 }}
        className="w-16 h-16 sm:w-20 sm:h-20 md:w-28 md:h-28 rounded-xl sm:rounded-2xl flex items-center justify-center font-mono font-black text-2xl sm:text-4xl md:text-5xl text-white shadow-2xl border border-purple-400/30"
        style={{ background: "linear-gradient(135deg, #1a0525 0%, #3b0764 100%)" }}
      >
        {String(value).padStart(2, "0")}
      </motion.div>
      <span className="mt-1.5 sm:mt-2 text-[9px] sm:text-[10px] md:text-xs text-purple-400 uppercase tracking-[0.15em] sm:tracking-[0.2em] font-bold">{label}</span>
    </div>
  );
}

function ConferenceFlyerShowcase() {
  const shareText = encodeURIComponent(
    `🙏 MINISTERS CONFERENCE 2026!\n\n"An Apostolic Gathering of Ministers, Leaders & Kingdom Builders"\n\nFriday 8th – Sunday 10th May, 2026\n⏰ 8:00 AM Daily (WAT)\n📍 Ebrumede Roundabout, Effurun Uvwie, Delta State\n\n📞 ${CONF_CONTACT}\n🌐 www.jctm.org.ng\n\n#MinistersConference2026 #JCTM #ProphetAmos`
  );
  const shareUrl = encodeURIComponent("https://jctm.org.ng/conference-registration");
  const platforms = [
    { label: "WhatsApp",   emoji: "💬",  bg: "#25D366",   href: `https://wa.me/?text=${shareText}` },
    { label: "Facebook",   emoji: "👍",  bg: "#1877F2",   href: `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}&quote=${shareText}` },
    { label: "X / Twitter",emoji: "𝕏",   bg: "#000",      href: `https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}` },
    { label: "Telegram",   emoji: "✈️",  bg: "#0088CC",   href: `https://t.me/share/url?url=${shareUrl}&text=${shareText}` },
    { label: "Instagram",  emoji: "📷",  bg: "linear-gradient(135deg,#E1306C,#833AB4,#F77737)", href: "https://www.instagram.com/templetv.jctm/" },
  ];

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = ministerConferenceFlyer;
    link.download = "ministers-conference-2026-flyer.jpeg";
    link.click();
    toast.success("Flyer downloaded! Share it everywhere — WhatsApp, Facebook, Instagram.");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.2 }}
      className="mb-14 rounded-3xl overflow-hidden border-2 group relative"
      style={{ borderColor: "rgba(168,85,247,0.6)" }}
    >
      <img
        src={ministerConferenceFlyer}
        alt="Ministers Conference 2026 — Official Event Flyer"
        className="w-full object-cover group-hover:scale-105 transition-transform duration-700"
        style={{ maxHeight: "600px", objectPosition: "center top" }}
        loading="lazy"
        decoding="async"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0d020f] via-[#0d020f]/30 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
        <p className="text-purple-300 text-xs font-bold uppercase tracking-[0.25em] mb-4 flex items-center gap-2">
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
            style={{ borderColor: "#a855f7", color: "#d8b4fe", background: "rgba(168,85,247,0.12)" }}
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Download Flyer</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function ConferenceInviteCardGenerator({ initialName = "", initialPhoto = null }: { initialName?: string; initialPhoto?: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardAreaRef = useRef<HTMLDivElement>(null);
  const photoRef2 = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialName);
  const [photo, setPhoto2] = useState<string | null>(initialPhoto);
  const [generated, setGenerated] = useState(false);
  const [cropSrc2, setCropSrc2] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => { if (initialName) setName(initialName); }, [initialName]);
  useEffect(() => { if (initialPhoto) setPhoto2(initialPhoto); }, [initialPhoto]);

  const handlePhotoChange2 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Photo must be under 10 MB."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { setCropSrc2(ev.target?.result as string); };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // overridePhoto: used immediately after cropping, before React state flushes
  const generate = useCallback(async (overridePhoto?: string | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setIsGenerating(true);
    try {
      const W = 1080, H = 1440;
      canvas.width = W;
      canvas.height = H;

      const currentPhoto = overridePhoto !== undefined ? overridePhoto : photo;

      const purple      = "#a855f7";
      const purpleDeep  = "#7c3aed";
      const purpleLight = "#d8b4fe";
      const gold        = "#D4A017";
      const goldLight   = "#FFD700";
      const white       = "#ffffff";
      const green       = "#00c853";

      // ── BACKGROUND ─────────────────────────────────────────────────
      const bg = ctx.createLinearGradient(0, 0, W * 0.6, H);
      bg.addColorStop(0,    "#0d020f");
      bg.addColorStop(0.35, "#1a0525");
      bg.addColorStop(0.7,  "#2d0f3d");
      bg.addColorStop(1,    "#0d020f");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      const topGlow = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, W);
      topGlow.addColorStop(0, "rgba(168,85,247,0.6)");
      topGlow.addColorStop(1, "rgba(13,2,15,0)");
      ctx.fillStyle = topGlow;
      ctx.fillRect(0, 0, W, H * 0.55);

      const btmGlow = ctx.createRadialGradient(W / 2, H, 0, W / 2, H, W * 0.6);
      btmGlow.addColorStop(0, "rgba(212,160,23,0.2)");
      btmGlow.addColorStop(1, "rgba(13,2,15,0)");
      ctx.fillStyle = btmGlow;
      ctx.fillRect(0, 0, W, H);

      // ── DOT GRID ───────────────────────────────────────────────────
      const gs = 54;
      ctx.fillStyle = "rgba(168,85,247,0.06)";
      for (let gx = 0; gx <= W; gx += gs)
        for (let gy = 0; gy <= H; gy += gs) {
          ctx.beginPath(); ctx.arc(gx, gy, 1.2, 0, Math.PI * 2); ctx.fill();
        }

      ctx.textAlign = "center";

      // ── "CONFIRMED" BADGE ──────────────────────────────────────────
      const cPillW = 220, cPillH = 50, cPillX = W - cPillW - 44, cPillY = 46;
      ctx.fillStyle = "rgba(0,200,83,0.18)";
      ctx.beginPath(); ctx.roundRect(cPillX, cPillY, cPillW, cPillH, 25); ctx.fill();
      ctx.strokeStyle = green; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(cPillX, cPillY, cPillW, cPillH, 25); ctx.stroke();
      ctx.fillStyle = green; ctx.font = "bold 20px sans-serif";
      ctx.fillText("✓  CONFIRMED", cPillX + cPillW / 2, cPillY + 34);

      // ── MINISTRY LABEL ─────────────────────────────────────────────
      ctx.fillStyle = "rgba(216,180,254,0.40)";
      ctx.font = "bold 17px sans-serif";
      ctx.fillText("J E S U S   C H R I S T   T E M P L E   M I N I S T R Y", W / 2, 82);

      // ── EVENT TITLE ────────────────────────────────────────────────
      ctx.shadowColor = "rgba(168,85,247,0.7)"; ctx.shadowBlur = 36;
      ctx.fillStyle = purpleLight; ctx.font = "bold 80px serif";
      ctx.fillText("MINISTERS", W / 2, 170);
      ctx.shadowBlur = 0; ctx.shadowColor = "transparent";

      ctx.strokeStyle = purple; ctx.lineWidth = 3;
      ctx.font = "bold 74px serif";
      ctx.strokeText("CONFERENCE", W / 2, 252);
      ctx.fillStyle = white; ctx.fillText("CONFERENCE", W / 2, 252);

      ctx.shadowColor = "rgba(255,215,0,0.5)"; ctx.shadowBlur = 24;
      ctx.fillStyle = goldLight; ctx.font = "bold 108px serif";
      ctx.fillText("2026", W / 2, 370);
      ctx.shadowBlur = 0; ctx.shadowColor = "transparent";

      ctx.fillStyle = "rgba(216,180,254,0.55)"; ctx.font = "italic 24px serif";
      ctx.fillText("\u201CAn Apostolic Gathering of Ministers,", W / 2, 415);
      ctx.fillText("Leaders & Kingdom Builders\u201D", W / 2, 447);

      // ── GOLD DIVIDER ───────────────────────────────────────────────
      const div = ctx.createLinearGradient(80, 0, W - 80, 0);
      div.addColorStop(0, "transparent");
      div.addColorStop(0.25, "rgba(212,160,23,0.6)");
      div.addColorStop(0.75, "rgba(212,160,23,0.6)");
      div.addColorStop(1, "transparent");
      ctx.strokeStyle = div; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(80, 475); ctx.lineTo(W - 80, 475); ctx.stroke();

      // ── PHOTO + NAME SECTION ───────────────────────────────────────
      const circleY = 620, circleR = 140;

      if (currentPhoto) {
        const img = new Image();
        img.src = currentPhoto;
        await new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res(); });
        ctx.save();
        ctx.beginPath();
        ctx.arc(W / 2, circleY, circleR, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, W / 2 - circleR, circleY - circleR, circleR * 2, circleR * 2);
        ctx.restore();
        ctx.strokeStyle = purple; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(W / 2, circleY, circleR + 4, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = gold; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(W / 2, circleY, circleR + 12, 0, Math.PI * 2); ctx.stroke();
      } else {
        const placeholderGrad = ctx.createRadialGradient(W / 2, circleY, 0, W / 2, circleY, circleR);
        placeholderGrad.addColorStop(0, "#3b0764");
        placeholderGrad.addColorStop(1, "#1a0525");
        ctx.fillStyle = placeholderGrad;
        ctx.beginPath(); ctx.arc(W / 2, circleY, circleR, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = purple; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(W / 2, circleY, circleR, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "rgba(168,85,247,0.5)";
        ctx.beginPath(); ctx.arc(W / 2, circleY - 40, 55, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(W / 2, circleY + 95, 100, 0, Math.PI, true); ctx.fill();
      }

      // Name — scale font down so long names never overflow
      const displayName = name.trim() || "Your Name Here";
      let nameFontSize = 52;
      ctx.font = `bold ${nameFontSize}px serif`;
      while (ctx.measureText(displayName).width > W - 140 && nameFontSize > 22) {
        nameFontSize -= 2;
        ctx.font = `bold ${nameFontSize}px serif`;
      }
      ctx.shadowColor = "rgba(168,85,247,0.5)"; ctx.shadowBlur = 20;
      ctx.fillStyle = white;
      ctx.fillText(displayName, W / 2, circleY + circleR + 70);
      ctx.shadowBlur = 0;

      ctx.fillStyle = "rgba(216,180,254,0.6)"; ctx.font = "italic 26px serif";
      ctx.fillText("is attending the Ministers Conference 2026", W / 2, circleY + circleR + 116);

      // ── EVENT INFO BOX ─────────────────────────────────────────────
      const boxY = circleY + circleR + 155, boxH = 200, boxX = 80;
      ctx.fillStyle = "rgba(45,15,61,0.85)";
      ctx.beginPath(); ctx.roundRect(boxX, boxY, W - boxX * 2, boxH, 24); ctx.fill();
      ctx.strokeStyle = "rgba(168,85,247,0.35)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(boxX, boxY, W - boxX * 2, boxH, 24); ctx.stroke();

      const infoItems = [
        { emoji: "📅", text: "Friday 8th – Sunday 10th May, 2026" },
        { emoji: "⏰", text: "8:00 AM Daily (West Africa Time)" },
        { emoji: "📍", text: "Ebrumede Roundabout, Effurun Uvwie, Delta State" },
      ];
      ctx.textAlign = "left";
      let iy = boxY + 46;
      for (const item of infoItems) {
        ctx.font = "bold 18px sans-serif"; ctx.fillStyle = purpleLight;
        ctx.fillText(item.emoji + "  " + item.text, boxX + 40, iy);
        iy += 54;
      }
      ctx.textAlign = "center";

      // ── BOTTOM CTA ─────────────────────────────────────────────────
      const ctaY = boxY + boxH + 70;
      ctx.fillStyle = purpleDeep;
      ctx.beginPath(); ctx.roundRect(boxX, ctaY, W - boxX * 2, 80, 40); ctx.fill();
      ctx.fillStyle = white; ctx.font = "bold 28px serif";
      ctx.fillText("Register Free at jctm.org.ng/conference-registration", W / 2, ctaY + 52);

      // ── FOOTER ─────────────────────────────────────────────────────
      ctx.fillStyle = "rgba(216,180,254,0.35)"; ctx.font = "bold 18px sans-serif";
      ctx.fillText("www.jctm.org.ng  ·  #MinistersConference2026  ·  #JCTM", W / 2, H - 52);

      setGenerated(true);
      setTimeout(() => cardAreaRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 80);
    } catch {
      toast.error("Could not generate your invite card. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }, [name, photo]);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `ministers-conference-2026-invite-${(name || "card").replace(/\s+/g, "-").toLowerCase()}.jpeg`;
    link.href = canvas.toDataURL("image/jpeg", 0.92);
    link.click();
    toast.success("Invite card downloaded! Share it on WhatsApp, Facebook & Instagram.");
  };

  const share = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      canvas.toBlob(async (blob) => {
        if (!blob) { download(); return; }
        if (navigator.share && navigator.canShare({ files: [new File([blob], "invite.jpg", { type: "image/jpeg" })] })) {
          await navigator.share({
            title: "Ministers Conference 2026 — I'm Attending!",
            text: "🙏 I'll be at the JCTM Ministers Conference 2026 (May 8–10, Effurun, Delta State). Register free at jctm.org.ng/conference-registration",
            files: [new File([blob], "ministers-conference-2026-invite.jpg", { type: "image/jpeg" })],
          });
        } else {
          download();
        }
      }, "image/jpeg", 0.92);
    } catch {
      download();
    }
  };

  return (
    <>
      {cropSrc2 && (
        <CropModal
          src={cropSrc2}
          onDone={(cropped) => {
            setPhoto2(cropped);
            setCropSrc2(null);
            setGenerated(false);
            generate(cropped);
          }}
          onCancel={() => setCropSrc2(null)}
        />
      )}
      <div className="rounded-3xl overflow-hidden border border-purple-400/20 mt-6"
        style={{ background: "rgba(45,15,61,0.7)" }}>

        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-purple-400/10">
          <div className="flex items-center gap-3 mb-1.5">
            <Share2 className="h-5 w-5 text-purple-400 shrink-0" />
            <h3 className="font-serif font-bold text-white text-lg sm:text-xl">Generate Your Invite Card</h3>
          </div>
          <p className="text-white/55 text-sm leading-relaxed">Add your name and photo to create a personalised digital invite card — ready to share on WhatsApp, Instagram, and Facebook.</p>
        </div>

        <div className="p-4 sm:p-6 space-y-3">

          {/* ── Photo + Name — always a row at every breakpoint ── */}
          <input ref={photoRef2} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange2} />
          <div className="flex items-center gap-3">
            {/* Photo button — fixed 64px circle, shrink-0 so it never squashes */}
            <button
              type="button"
              onClick={() => photoRef2.current?.click()}
              aria-label="Upload your photo"
              className="relative group shrink-0 touch-manipulation transition-all duration-200"
            >
              {photo ? (
                <div className="relative">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-purple-400 shadow-lg group-hover:border-purple-300 transition-all" style={{ minWidth: "64px", minHeight: "64px" }}>
                    <img src={photo} alt="Your photo" className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute inset-0 rounded-full bg-black/55 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Camera className="h-4 w-4 text-white" />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2"
                    style={{ background: "#a855f7", borderColor: "rgba(45,15,61,0.9)" }}>
                    <Camera className="h-2.5 w-2.5 text-white" />
                  </div>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full border-2 border-dashed flex flex-col items-center justify-center gap-0.5 transition-all group-hover:bg-white/10 group-hover:border-purple-400"
                  style={{ borderColor: "rgba(168,85,247,0.4)", background: "rgba(45,15,61,0.5)", minWidth: "64px", minHeight: "64px" }}>
                  <Camera className="h-4 w-4 text-purple-400/60 group-hover:text-purple-400 transition-colors" />
                  <span className="text-[8px] text-purple-400/50 group-hover:text-purple-400 font-bold uppercase tracking-wide transition-colors leading-none">Photo</span>
                </div>
              )}
            </button>

            {/* Name input — fills remaining width, min-w-0 prevents overflow */}
            <input
              placeholder="Your full name (optional)"
              value={name}
              enterKeyHint="go"
              onChange={(e) => { setName(e.target.value); setGenerated(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); generate(); } }}
              className="flex-1 min-w-0 px-3 sm:px-4 py-3 rounded-xl border text-white placeholder:text-white/30 text-sm font-medium outline-none focus:ring-2 focus:ring-purple-500/40 transition-all"
              style={{ background: "rgba(45,15,61,0.7)", borderColor: "rgba(168,85,247,0.3)", minHeight: "48px" }}
            />
          </div>

          {/* Remove photo — subtle, only shown when photo present */}
          {photo && !isGenerating && (
            <button
              type="button"
              onClick={() => { setPhoto2(null); setGenerated(false); if (photoRef2.current) photoRef2.current.value = ""; }}
              className="text-xs text-white/30 hover:text-red-400 transition-colors touch-manipulation pl-1"
            >
              ✕ Remove photo
            </button>
          )}

          {/* Generate button — always full width */}
          <Button
            onClick={() => generate()}
            disabled={isGenerating}
            className="w-full rounded-xl font-bold touch-manipulation transition-all duration-200 disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", color: "#fff", minHeight: "48px" }}
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin h-4 w-4 mr-2 shrink-0" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Generating…
              </>
            ) : (
              <><Sparkles className="h-4 w-4 mr-1.5 shrink-0" /> Generate My Invite Card</>
            )}
          </Button>

          {/* Canvas result area */}
          <div ref={cardAreaRef}>
            <AnimatePresence>
              {generated && (
                <motion.div
                  key="card-ready"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl mb-3 text-sm font-semibold"
                  style={{ background: "rgba(168,85,247,0.15)", borderColor: "rgba(168,85,247,0.3)", border: "1px solid rgba(168,85,247,0.3)", color: "#d8b4fe" }}
                >
                  <CheckCircle2 className="h-4 w-4 text-purple-400 shrink-0" />
                  Your invite card is ready — share it or download below!
                </motion.div>
              )}
            </AnimatePresence>

            <div className={`transition-all duration-300 ${generated ? "opacity-100" : "opacity-0 h-0 overflow-hidden pointer-events-none"}`}>
              <div className="max-w-sm mx-auto">
                <canvas
                  ref={canvasRef}
                  className="w-full rounded-2xl border border-purple-400/20 shadow-xl shadow-purple-900/30"
                  style={{ aspectRatio: "3/4", display: "block" }}
                />
              </div>
            </div>
          </div>

          {/* Share + Download */}
          {generated && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-2 gap-3 max-w-sm mx-auto"
            >
              <Button
                onClick={share}
                className="gap-2 rounded-xl font-bold touch-manipulation"
                style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", color: "#fff", minHeight: "48px" }}
              >
                <Share2 className="h-4 w-4 shrink-0" /> Share
              </Button>
              <Button
                onClick={download}
                variant="outline"
                className="gap-2 rounded-xl font-bold border-purple-400/40 text-purple-300 hover:bg-purple-400/10 touch-manipulation"
                style={{ minHeight: "48px" }}
              >
                <Download className="h-4 w-4 shrink-0" /> Download
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </>
  );
}

const ROLES = [
  "Pastor / Senior Pastor",
  "Bishop",
  "Apostle / Prophet",
  "Evangelist",
  "Elder / Deacon",
  "Minister / Preacher",
  "Worship Leader",
  "Church Worker",
  "Church Member",
  "Student / Youth",
  "Other",
];

interface FormState {
  fullName: string;
  email: string;
  phone: string;
  ministry: string;
  role: string;
  stateOrCountry: string;
  message: string;
}

const EMPTY_FORM: FormState = {
  fullName: "",
  email: "",
  phone: "",
  ministry: "",
  role: "",
  stateOrCountry: "",
  message: "",
};

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<string> {
  const image = new Image();
  image.src = imageSrc;
  await new Promise<void>((res) => { image.onload = () => res(); });
  const canvas = document.createElement("canvas");
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    image,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0, 0, pixelCrop.width, pixelCrop.height,
  );
  return canvas.toDataURL("image/jpeg", 0.92);
}

function CropModal({ src, onDone, onCancel }: { src: string; onDone: (cropped: string) => void; onCancel: () => void }) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isCropping, setIsCropping] = useState(false);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleDone = async () => {
    if (!croppedAreaPixels || isCropping) return;
    setIsCropping(true);
    try {
      const cropped = await getCroppedImg(src, croppedAreaPixels);
      onDone(cropped);
    } catch {
      toast.error("Could not process your photo. Please try a different image.");
      setIsCropping(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 p-4">
      <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl border" style={{ background: "#1a0525", borderColor: "rgba(168,85,247,0.4)" }}>
        <div className="px-4 pt-4 pb-2">
          <p className="text-white font-bold text-center text-sm">Crop Your Photo</p>
          <p className="text-white/50 text-xs text-center mt-0.5">Drag to reposition · Pinch or scroll to zoom</p>
        </div>
        <div className="relative w-full" style={{ height: "clamp(200px, 42vh, 320px)" }}>
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>
        <div className="px-5 py-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-white/40 text-[11px] font-medium uppercase tracking-wider">Zoom</span>
            <span className="text-purple-300/60 text-[11px] font-medium">{zoom.toFixed(1)}×</span>
          </div>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            aria-label="Zoom level"
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-purple-400 touch-manipulation"
            style={{ minHeight: "28px" }}
          />
        </div>
        <div className="flex gap-3 px-4 pb-4">
          <button
            onClick={onCancel}
            disabled={isCropping}
            className="flex-1 rounded-xl border border-white/20 text-white/70 text-sm font-medium hover:bg-white/10 transition-colors touch-manipulation disabled:opacity-40"
            style={{ minHeight: "48px" }}
          >
            Cancel
          </button>
          <button
            onClick={handleDone}
            disabled={isCropping}
            className="flex-1 rounded-xl text-white text-sm font-bold transition-all touch-manipulation disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background: "#a855f7", minHeight: "48px" }}
          >
            {isCropping ? (
              <>
                <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Processing…
              </>
            ) : "Use This Crop"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full px-4 py-3 rounded-xl border text-white placeholder:text-white/40 text-sm font-medium outline-none transition-all focus:ring-2 focus:ring-purple-500/40";
const inputStyle = {
  background: "rgba(255,255,255,0.08)",
  borderColor: "rgba(168,85,247,0.25)",
};

const CONF_AD_COPIES = {
  short: {
    label: "Short (Stories / Reels)",
    platform: "Instagram & Facebook Stories",
    icon: Instagram,
    text: `🙏 MINISTERS CONFERENCE 2026 — ARE YOU REGISTERED?

An Apostolic Gathering of Ministers, Leaders & Kingdom Builders

📅 May 8–10, 2026
⏰ 8:00 AM Daily (WAT)
📍 Church Auditorium, Ebrumede Roundabout, Effurun Uvwie, Delta State

Free registration. Limited seats. Don't miss this divine appointment.

#MinistersConference2026 #JCTM #ProphetAmos #ApostolicFire`,
  },
  medium: {
    label: "Medium (Feed Posts)",
    platform: "Facebook & Instagram Feed",
    icon: Facebook,
    text: `🔥 ATTENTION MINISTERS, PASTORS & CHURCH LEADERS! 🔥

Jesus Christ Temple Ministry presents the Ministers Conference 2026 — the most significant apostolic gathering for ministers and kingdom builders in 2026.

📖 Theme: "An Apostolic Gathering of Ministers, Leaders & Kingdom Builders"

This is not just another church conference. This is a divine summons to every minister who is hungry for the apostolic fire, the unadulterated Word, and a fresh encounter with the Holy Ghost.

📅 Date: Friday 8th – Sunday 10th May, 2026
⏰ Time: 8:00 AM Daily (West Africa Time)
📍 Venue: Church Auditorium, Km1 East West Rd., Ebrumede Roundabout, Effurun Uvwie L.G.A., Delta State

Hosted by Prophet Amos Evomobor — a voice of apostolic correction and reformation to the body of Christ.

🎟️ Registration is FREE. Secure your place today:
👉 jctm.org.ng/conference-registration

📞 Enquiries: +234(0)8081313111

Share this with every minister, pastor, and church leader you know. This is your moment.

#MinistersConference2026 #JCTM #ProphetAmosEvomobor #ApostolicFire #ChurchLeaders #NigeriaChurch #DeltaState #KingdomBuilders #ReformationNow`,
  },
  long: {
    label: "Long (YouTube / Blog)",
    platform: "YouTube Ads & Blog",
    icon: Youtube,
    text: `🌍 MINISTERS CONFERENCE 2026 — JESUS CHRIST TEMPLE MINISTRY

EVENT DETAILS:
• Event: Ministers Conference 2026
• Theme: "An Apostolic Gathering of Ministers, Leaders & Kingdom Builders"
• Host: Jesus Christ Temple Ministry (JCTM)
• Minister: Prophet Amos Evomobor
• Date: Friday 8th – Sunday 10th May, 2026
• Time: 8:00 AM Daily (West Africa Time)
• Venue: Church Auditorium, Km1 East West Rd., Ebrumede Roundabout, Effurun Uvwie L.G.A., Delta State, Nigeria
• Registration: FREE — jctm.org.ng/conference-registration
• Enquiries: +234(0)8081313111

THE MANDATE:
The body of Christ in Nigeria and across the world is in urgent need of apostolic recalibration. Countless churches have drifted from biblical foundations — embracing entertainment over encounter, popularity over purity, and prosperity over the cross. JCTM's Ministers Conference 2026 is a prophetic response to this crisis.

This conference is designed to equip, challenge, realign, and release ministers back into the fullness of their calling. Under the apostolic ministry of Prophet Amos Evomobor, attendees will receive:

WHAT TO EXPECT:
✅ Deep revelatory teaching on apostolic ministry and the true church
✅ Prophetic impartation for ministers and leaders
✅ Powerful corporate prayer and intercession
✅ Strategic sessions on church governance, discipleship, and the Correction Mandate
✅ Networking with like-minded ministers and kingdom builders
✅ A face-to-face encounter with the Living God

WHO SHOULD ATTEND:
Pastors, Bishops, Apostles, Prophets, Evangelists, Elders, Deacons, Worship Leaders, Church Workers, and every minister who desires to lead God's people with integrity, apostolic fire, and biblical authority. If you are in Nigeria or within reach of Delta State, this is a divine appointment you cannot afford to miss.

HOW TO REGISTER:
Registration is completely free. Visit jctm.org.ng/conference-registration to secure your place. Space is limited — register today.

INVITE A MINISTER: Forward this to every pastor, elder, and church leader in your network. The body of Christ needs this message.

"And He Himself gave some to be apostles, some prophets, some evangelists, and some pastors and teachers, for the equipping of the saints for the work of ministry." — Ephesians 4:11–12

Subscribe to JCTM Digital Sanctuary for conference updates, sermons, and live ministry.

#MinistersConference2026 #JCTM #JesusChristTempleMinistry #ProphetAmosEvomobor #ApostolicFire #ChurchLeadersNigeria #KingdomBuilders #DeltaStateChurch #ReformationNow #ApostolicMinistry #TrueChurch #CorrectionMandate`,
  },
};

function ConferenceAdCopySection() {
  const [active, setActive] = useState<keyof typeof CONF_AD_COPIES>("medium");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(CONF_AD_COPIES[active].text);
    setCopied(true);
    toast.success("Ad copy copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="mt-12 rounded-3xl overflow-hidden border"
      style={{ background: "rgba(45,15,61,0.7)", borderColor: "rgba(168,85,247,0.2)" }}
    >
      {/* Header */}
      <div className="p-4 sm:p-6 border-b" style={{ borderColor: "rgba(168,85,247,0.12)" }}>
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="h-5 w-5 text-purple-400 shrink-0" />
          <h3 className="font-serif font-bold text-white text-lg sm:text-xl">Social Ad Copy Generator</h3>
        </div>
        <p className="text-white/50 text-xs sm:text-sm">3 professionally crafted ad versions for every platform. Copy and share instantly — no writing needed.</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: "rgba(168,85,247,0.12)" }}>
        {(Object.entries(CONF_AD_COPIES) as [keyof typeof CONF_AD_COPIES, typeof CONF_AD_COPIES.short][]).map(([key, val]) => {
          const Icon = val.icon;
          return (
            <button
              key={key}
              onClick={() => setActive(key)}
              className={`flex-1 py-2.5 sm:py-3 px-1.5 sm:px-2 text-[9px] sm:text-xs font-bold uppercase tracking-wide sm:tracking-wider transition-all duration-200 flex flex-col items-center gap-1 touch-manipulation ${
                active === key
                  ? "border-b-2 border-purple-400 bg-purple-400/5"
                  : "text-white/35 hover:text-white/60"
              }`}
              style={{ color: active === key ? "#d8b4fe" : undefined }}
            >
              <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              <span className="leading-tight text-center">{val.label}</span>
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium uppercase tracking-widest" style={{ color: "rgba(216,180,254,0.55)" }}>
            {CONF_AD_COPIES[active].platform}
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs transition-colors"
            style={{ color: copied ? "#4ade80" : "rgba(255,255,255,0.45)" }}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied!" : "Copy all"}
          </button>
        </div>
        <pre className="text-sm text-white/75 whitespace-pre-wrap leading-relaxed font-sans max-h-72 overflow-y-auto"
          style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(168,85,247,0.3) transparent" }}>
          {CONF_AD_COPIES[active].text}
        </pre>

        {/* Quick share to WhatsApp */}
        <div className="mt-5 pt-4 border-t" style={{ borderColor: "rgba(168,85,247,0.12)" }}>
          <p className="text-xs text-white/30 mb-3 uppercase tracking-wider font-semibold">Quick Share</p>
          <div className="flex flex-wrap gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(CONF_AD_COPIES[active].text)}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-xs font-bold transition-all hover:scale-105 shadow-md"
              style={{ background: "#25D366" }}
            >
              💬 WhatsApp
            </a>
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent("https://jctm.org.ng/conference-registration")}&quote=${encodeURIComponent(CONF_AD_COPIES[active].text)}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-xs font-bold transition-all hover:scale-105 shadow-md"
              style={{ background: "#1877F2" }}
            >
              👍 Facebook
            </a>
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(CONF_AD_COPIES.short.text)}&url=${encodeURIComponent("https://jctm.org.ng/conference-registration")}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-xs font-bold transition-all hover:scale-105 shadow-md bg-black hover:bg-gray-900"
            >
              𝕏 X / Twitter
            </a>
            <a
              href={`https://t.me/share/url?url=${encodeURIComponent("https://jctm.org.ng/conference-registration")}&text=${encodeURIComponent(CONF_AD_COPIES[active].text)}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-xs font-bold transition-all hover:scale-105 shadow-md"
              style={{ background: "#0088CC" }}
            >
              ✈️ Telegram
            </a>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

const CONF_YT_VIDEO = "hQFA1Y9NAcY";

function ConferenceVideoLoop() {
  const videoShareText = encodeURIComponent(
    `🙏 Watch the official Ministers Conference 2026 promo!\n\n"An Apostolic Gathering of Ministers, Leaders & Kingdom Builders"\n\nFriday 8th – Sunday 10th May, 2026 · 8AM Daily\n📍 Ebrumede Roundabout, Effurun Uvwie, Delta State\n\nhttps://youtu.be/${CONF_YT_VIDEO}\n\n#MinistersConference2026 #JCTM #ProphetAmos`
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.4 }}
      className="mb-10 rounded-3xl overflow-hidden border border-purple-400/20"
      style={{ background: "rgba(15,5,30,0.7)" }}
    >
      <div className="p-6 border-b border-purple-400/10">
        <div className="flex items-center gap-3 mb-1">
          <Youtube className="h-5 w-5 text-red-500" />
          <h3 className="font-serif font-bold text-white text-xl">Ministers Conference 2026 — YouTube Ad (Running Now)</h3>
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-red-400 font-bold uppercase tracking-widest">
            <span className="h-2 w-2 bg-red-400 rounded-full animate-pulse" /> Live Promo
          </span>
        </div>
        <p className="text-white/60 text-sm">The official conference video uploaded to YouTube. Playing as a continuous ad — watch, share, and amplify the reach across all platforms.</p>
      </div>
      <div className="p-4">
        <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ aspectRatio: "16/9" }}>
          <iframe
            src={`https://www.youtube.com/embed/${CONF_YT_VIDEO}?autoplay=1&mute=1&loop=1&playlist=${CONF_YT_VIDEO}&controls=1&rel=0&modestbranding=1&origin=${encodeURIComponent(window.location.origin)}`}
            title="Ministers Conference 2026 — Official Promo Video"
            allow="autoplay; fullscreen; accelerometer; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="w-full h-full"
          />
        </div>
        <div className="flex flex-wrap gap-3 mt-5 justify-center">
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
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`https://youtu.be/${CONF_YT_VIDEO}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-all hover:scale-105 shadow-lg"
            style={{ background: "#1877F2" }}
          >
            👍 Share on Facebook
          </a>
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`🙏 "An Apostolic Gathering of Ministers" — Watch the Ministers Conference 2026 promo! May 8–10, Effurun. #MinistersConference2026`)}&url=https://youtu.be/${CONF_YT_VIDEO}`}
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

export default function ConferenceRegistration() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [regId, setRegId] = useState<number | null>(null);
  const [invitedBy, setInvitedBy] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [attendCount, setAttendCount] = useState<number | null>(null);
  const [rsvpName, setRsvpName] = useState("");
  const [rsvpPhoto, setRsvpPhoto] = useState<string | null>(null);

  const [photo, setPhoto] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const countdown = useCountdown(CONF_START);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const name = params.get("invited_by");
    if (name) setInvitedBy(decodeURIComponent(name));

    fetch(`${BASE}/api/conference/count`)
      .then(r => r.json())
      .then(d => setAttendCount(d.count))
      .catch(() => {});
  }, []);

  const set = (key: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm(prev => ({ ...prev, [key]: e.target.value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Photo must be under 10 MB."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { setCropSrc(ev.target?.result as string); };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const validate = (): boolean => {
    const e: Partial<FormState> = {};
    if (!form.fullName.trim()) e.fullName = "Full name is required.";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Enter a valid email address.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, string | undefined> = {
        fullName: form.fullName.trim(),
      };
      if (form.phone.trim()) payload.phone = form.phone.trim();
      if (form.email.trim()) payload.email = form.email.trim();
      if (form.ministry.trim()) payload.ministry = form.ministry.trim();
      if (form.role) payload.role = form.role;
      if (form.stateOrCountry.trim()) payload.stateOrCountry = form.stateOrCountry.trim();
      if (form.message.trim()) payload.message = form.message.trim();

      const res = await fetch(`${BASE}/api/conference/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Registration failed.");
      setRegId(data?.registration?.id ?? null);
      setSuccess(true);
      setRsvpName(form.fullName.trim());
      setRsvpPhoto(photo);
      toast.success(`Welcome, ${form.fullName.split(" ")[0]}! Your registration is confirmed. 🙏`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <Layout>
      <SEO
        title="Ministers Conference 2026 — Register to Attend | JCTM"
        description="Register your attendance for the JCTM Ministers Conference 2026. May 8–10, 2026. An apostolic gathering of ministers, leaders and kingdom builders. Ebrumede Roundabout, Effurun Uvwie, Delta State."
        path="/conference-registration"
        keywords="Ministers Conference 2026, JCTM conference, Jesus Christ Temple Ministry conference, Prophet Amos Evomobor, church conference Delta State 2026, apostolic gathering Nigeria"
        breadcrumbs={[
          { name: "Home", url: "https://jctm.org.ng/" },
          { name: "Ministers Conference 2026", url: "https://jctm.org.ng/conference-registration" },
        ]}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Event",
            "name": "Ministers Conference 2026 — JCTM",
            "description": "An apostolic gathering of ministers, leaders and kingdom builders hosted by Jesus Christ Temple Ministry (JCTM), featuring prophetic impartation, apostolic teaching, and corporate prayer.",
            "startDate": "2026-05-08T07:00:00+01:00",
            "endDate": "2026-05-10T20:00:00+01:00",
            "eventStatus": "https://schema.org/EventScheduled",
            "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
            "url": "https://jctm.org.ng/conference-registration",
            "image": "https://jctm.org.ng/opengraph.jpg",
            "location": {
              "@type": "Place",
              "name": "JCTM Church Auditorium",
              "address": {
                "@type": "PostalAddress",
                "streetAddress": "Km1 East West Rd., Ebrumede Roundabout",
                "addressLocality": "Effurun Uvwie",
                "addressRegion": "Delta State",
                "addressCountry": "NG"
              }
            },
            "organizer": {
              "@type": "ReligiousOrganization",
              "name": "Jesus Christ Temple Ministry (JCTM)",
              "url": "https://jctm.org.ng"
            },
            "performer": {
              "@type": "Person",
              "name": "Prophet Amos Evomobor",
              "url": "https://jctm.org.ng/leadership"
            },
            "offers": {
              "@type": "Offer",
              "price": "0",
              "priceCurrency": "NGN",
              "availability": "https://schema.org/InStock",
              "url": "https://jctm.org.ng/conference-registration",
              "validFrom": "2026-01-01"
            }
          }
        ]}
      />

      {cropSrc && (
        <CropModal
          src={cropSrc}
          onDone={(cropped) => { setPhoto(cropped); setCropSrc(null); }}
          onCancel={() => setCropSrc(null)}
        />
      )}

      <div
        className="relative min-h-screen"
        style={{ background: "linear-gradient(180deg, #0d020f 0%, #1a0525 40%, #2d0f3d 70%, #0d020f 100%)" }}
      >
        {/* Hidden SEO heading */}
        <h1 className="sr-only">Ministers Conference 2026 — Register to Attend | JCTM</h1>

        {/* Starfield */}
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
                background: `rgba(180,100,255,${Math.random() * 0.6 + 0.1})`,
                animation: `pulse ${2 + Math.random() * 3}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 3}s`,
              }}
            />
          ))}
        </div>

        {/* Purple radial glow */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-1 opacity-25 pointer-events-none"
          style={{ height: "300px", background: "linear-gradient(to bottom, #a855f7, transparent)" }}
        />
        <div
          className="absolute top-[150px] left-1/2 -translate-x-1/2 h-1 opacity-25 pointer-events-none"
          style={{ width: "300px", background: "linear-gradient(to right, transparent, #a855f7, transparent)" }}
        />

        <div className="relative z-10 container mx-auto px-4 sm:px-6 py-10 sm:py-14 md:py-16 max-w-5xl">

          {/* ── Header ────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-10 sm:mb-14 md:mb-16"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="inline-flex flex-wrap justify-center items-center gap-2 px-4 sm:px-5 py-2 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-5 sm:mb-6 border"
              style={{ borderColor: "rgba(168,85,247,0.4)", background: "rgba(168,85,247,0.1)", color: "#d8b4fe" }}
            >
              <Flame className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
              Jesus Christ Temple Ministry Presents
            </motion.div>

            <h2 className="font-serif font-black text-[2rem] xs:text-4xl sm:text-5xl md:text-6xl lg:text-7xl text-white mb-3 sm:mb-4 leading-tight sm:leading-none tracking-tight px-2 sm:px-0">
              Ministers{" "}
              <span style={{ WebkitTextStroke: "2px #a855f7", color: "transparent" }}>
                Conference
              </span>{" "}
              <span className="text-purple-300">2026</span>
            </h2>

            <p className="text-base sm:text-lg md:text-xl font-serif italic text-purple-300/90 mb-3 max-w-2xl mx-auto leading-relaxed px-4 sm:px-0">
              An Apostolic Gathering of Ministers, Leaders &amp; Kingdom Builders
            </p>

            <div
              className="block w-full max-w-lg mx-auto px-4 sm:px-6 py-3 rounded-2xl mb-6 sm:mb-8"
              style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.3)" }}
            >
              <p className="text-purple-200 font-bold text-sm sm:text-base md:text-lg leading-snug">
                &ldquo;The apostolic fire is being restored to the Church&rdquo;
              </p>
            </div>

            {/* Event meta — simple inline flex, no pill backgrounds */}
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs sm:text-sm text-white/70 px-2">
              {[
                { icon: Calendar, text: "Friday 8th – Sunday 10th May, 2026" },
                { icon: Clock, text: "8:00 AM Daily (WAT)" },
                { icon: MapPin, text: "Ebrumede Roundabout, Effurun Uvwie, Delta State" },
                { icon: Phone, text: CONF_CONTACT },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-1.5">
                  <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-purple-400 shrink-0" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ── Flyer Showcase ────────────────────────────────────── */}
          <ConferenceFlyerShowcase />

          {/* ── YouTube Ad ────────────────────────────────────────── */}
          <ConferenceVideoLoop />

          {/* ── Countdown ─────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="text-center mb-10 sm:mb-14 md:mb-16"
          >
            <p className="text-[10px] sm:text-xs text-purple-400/60 uppercase tracking-[0.25em] sm:tracking-[0.3em] font-bold mb-4 sm:mb-6">
              {countdown.started ? "The Conference Has Begun!" : "Conference Begins In"}
            </p>
            {!countdown.started ? (
              <div className="flex justify-center gap-2 sm:gap-4 md:gap-6">
                <CountdownBlock value={countdown.days} label="Days" />
                <CountdownBlock value={countdown.hours} label="Hours" />
                <CountdownBlock value={countdown.minutes} label="Minutes" />
                <CountdownBlock value={countdown.seconds} label="Seconds" />
              </div>
            ) : (
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="text-3xl font-serif font-black text-purple-300"
              >
                🙏 The Conference Is Happening NOW! 🙏
              </motion.div>
            )}
            {attendCount !== null && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="mt-6 inline-flex items-center gap-2 text-sm text-white/60"
              >
                <Users className="h-4 w-4 text-purple-400" />
                <span className="text-purple-300 font-bold">{attendCount.toLocaleString()}</span> ministers have registered
              </motion.div>
            )}
          </motion.div>

          {/* ── Two-column: Registration + Map ────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 mb-10 sm:mb-12">

            {/* Left — Registration Card */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="rounded-3xl overflow-hidden"
              style={{ background: "rgba(45,15,61,0.8)", border: "1px solid rgba(168,85,247,0.25)" }}
            >
              <div className="p-4 sm:p-6 border-b" style={{ borderColor: "rgba(168,85,247,0.15)", background: "rgba(168,85,247,0.08)" }}>
                <h3 className="font-serif font-bold text-white text-lg sm:text-xl mb-1 flex items-center gap-2">
                  <span>✋</span> Register Your Attendance
                </h3>
                <p className="text-white/50 text-xs sm:text-sm">Let the ministry know you're coming. Registration is free.</p>
              </div>

              <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
                {invitedBy && !success && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 rounded-2xl px-4 py-3 border border-purple-400/30"
                    style={{ background: "rgba(168,85,247,0.08)" }}
                  >
                    <span className="text-xl shrink-0">🙏</span>
                    <div>
                      <p className="text-purple-200 text-xs font-bold">You've been personally invited!</p>
                      <p className="text-white/50 text-xs mt-0.5">
                        <span className="text-yellow-300 font-semibold">{invitedBy}</span> invites you to the Ministers Conference 2026. Register below — free entry for all.
                      </p>
                    </div>
                  </motion.div>
                )}

                <AnimatePresence mode="wait">
                  {success ? (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-center py-4"
                    >
                      {rsvpPhoto ? (
                        <div className="flex justify-center mb-4">
                          <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-purple-400 shadow-xl">
                            <img src={rsvpPhoto} alt="Your photo" className="w-full h-full object-cover" />
                          </div>
                        </div>
                      ) : (
                        <div className="text-5xl mb-4">🙌</div>
                      )}
                      <h4 className="font-serif font-bold text-white text-2xl mb-2">You're Registered!</h4>
                      {regId && (
                        <p className="text-purple-300/60 text-xs mb-1">Reference #{regId}</p>
                      )}
                      <p className="text-purple-300 text-sm mb-1">See you at the Church Auditorium, Effurun on May 8th.</p>
                      <p className="text-white/50 text-xs mb-6">Scroll down to generate your personalised invite card.</p>

                      {/* Invite link */}
                      <div className="rounded-2xl p-4 text-left border border-purple-400/20"
                        style={{ background: "rgba(26,5,37,0.8)" }}>
                        <div className="flex items-center gap-2 mb-1">
                          <Share2 className="h-4 w-4 text-purple-400" />
                          <p className="text-purple-300 text-sm font-bold">Invite Others to Register</p>
                        </div>
                        <p className="text-white/50 text-xs mb-3 leading-relaxed">
                          Share this personal link — anyone who opens it will see your name and be inspired to register.
                        </p>
                        <div className="flex items-center gap-2 rounded-xl border px-3 py-2.5 mb-3"
                          style={{ background: "rgba(13,2,15,0.9)", borderColor: "rgba(168,85,247,0.25)" }}>
                          <span className="flex-1 text-xs text-purple-300/60 truncate font-mono">
                            {`${window.location.origin}/conference-registration?invited_by=${encodeURIComponent(rsvpName)}`}
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(
                                `${window.location.origin}/conference-registration?invited_by=${encodeURIComponent(rsvpName)}`
                              );
                              setLinkCopied(true);
                              toast.success("Invite link copied!");
                              setTimeout(() => setLinkCopied(false), 2500);
                            }}
                            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                            style={{
                              background: linkCopied ? "rgba(34,197,94,0.2)" : "rgba(168,85,247,0.15)",
                              color: linkCopied ? "#4ade80" : "#d8b4fe",
                              border: `1px solid ${linkCopied ? "rgba(34,197,94,0.4)" : "rgba(168,85,247,0.35)"}`,
                            }}
                          >
                            {linkCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            {linkCopied ? "Copied!" : "Copy"}
                          </button>
                        </div>
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(
                            `🙏 *Ministers Conference 2026 — Personal Invitation*\n\n` +
                            `I am ${rsvpName} and I personally invite you to join me at the JCTM Ministers Conference 2026!\n\n` +
                            `📅 May 8–10, 2026\n⏰ 8:00 AM Daily (WAT)\n📍 Ebrumede Roundabout, Effurun Uvwie, Delta State\n\n` +
                            `Click the link below to register and secure your place:\n` +
                            `${window.location.origin}/conference-registration?invited_by=${encodeURIComponent(rsvpName)}\n\n` +
                            `This is a divine appointment — don't miss it!\n🌐 www.jctm.org.ng`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white text-sm transition-opacity hover:opacity-90 touch-manipulation"
                          style={{ background: "#25D366" }}
                        >
                          <span className="text-base leading-none">💬</span>
                          Share Invite via WhatsApp
                        </a>
                      </div>
                      <button
                        onClick={() => { setSuccess(false); setForm(EMPTY_FORM); setRegId(null); setPhoto(null); setRsvpName(""); setRsvpPhoto(null); }}
                        className="mt-4 text-xs text-white/30 hover:text-purple-400 transition-colors touch-manipulation"
                      >
                        Register another person
                      </button>
                    </motion.div>
                  ) : (
                    <motion.form
                      key="form"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onSubmit={handleSubmit}
                      noValidate
                      className="space-y-3"
                    >
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
                          aria-label="Upload your photo"
                        >
                          {photo ? (
                            <div className="relative">
                              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-purple-400 shadow-xl group-hover:border-purple-300 transition-all">
                                <img src={photo} alt="Your photo" className="w-full h-full object-cover" />
                              </div>
                              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Camera className="h-6 w-6 text-white" />
                              </div>
                            </div>
                          ) : (
                            <div className="w-24 h-24 rounded-full border-2 border-dashed border-purple-400/50 flex flex-col items-center justify-center gap-1 bg-white/5 group-hover:bg-white/10 group-hover:border-purple-400 transition-all">
                              <ImagePlus className="h-6 w-6 text-purple-400/70 group-hover:text-purple-400" />
                              <span className="text-[10px] text-purple-400/60 group-hover:text-purple-400 font-semibold uppercase tracking-wide">Add Photo</span>
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
                        onChange={set("fullName")}
                        maxLength={120}
                        className={inputCls}
                        style={inputStyle}
                      />
                      {errors.fullName && (
                        <p className="text-red-400 text-xs -mt-1">{errors.fullName}</p>
                      )}

                      <Input
                        type="tel"
                        placeholder="Phone Number (optional)"
                        value={form.phone}
                        onChange={set("phone")}
                        maxLength={30}
                        className={inputCls}
                        style={inputStyle}
                      />

                      <Input
                        type="email"
                        placeholder="Email Address (optional)"
                        value={form.email}
                        onChange={set("email")}
                        maxLength={160}
                        className={inputCls}
                        style={inputStyle}
                      />
                      {errors.email && (
                        <p className="text-red-400 text-xs -mt-1">{errors.email}</p>
                      )}

                      <Input
                        placeholder="Ministry / Church Name (optional)"
                        value={form.ministry}
                        onChange={set("ministry")}
                        maxLength={160}
                        className={inputCls}
                        style={inputStyle}
                      />

                      <select
                        value={form.role}
                        onChange={set("role")}
                        className="w-full px-4 py-3 rounded-xl border text-sm font-medium outline-none transition-all focus:ring-2 focus:ring-purple-500/40 appearance-none"
                        style={{ ...inputStyle, color: form.role ? "#fff" : "rgba(255,255,255,0.4)" }}
                      >
                        <option value="" style={{ background: "#1a0525", color: "#9ca3af" }}>Role / Designation (optional)</option>
                        {ROLES.map(r => (
                          <option key={r} value={r} style={{ background: "#1a0525", color: "#fff" }}>{r}</option>
                        ))}
                      </select>

                      <Input
                        placeholder="State / Country (optional)"
                        value={form.stateOrCountry}
                        onChange={set("stateOrCountry")}
                        maxLength={100}
                        className={inputCls}
                        style={inputStyle}
                      />

                      <textarea
                        rows={3}
                        placeholder="Additional message or prayer points (optional)"
                        value={form.message}
                        onChange={set("message")}
                        maxLength={500}
                        className="w-full px-4 py-3 rounded-xl border text-white placeholder:text-white/40 text-sm font-medium outline-none transition-all focus:ring-2 focus:ring-purple-500/40 resize-none"
                        style={inputStyle}
                      />

                      <motion.button
                        type="submit"
                        disabled={submitting}
                        whileHover={{ scale: 1.02, boxShadow: "0 0 30px rgba(168,85,247,0.5)" }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full py-4 rounded-2xl font-serif font-black text-base sm:text-lg tracking-wide disabled:opacity-60 cursor-pointer transition-all duration-200 touch-manipulation"
                        style={{ background: "linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #7c3aed 100%)", color: "#fff", minHeight: "56px" }}
                      >
                        {submitting ? "Registering…" : "✋ I Will Attend!"}
                      </motion.button>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            {/* Right — Map */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="rounded-3xl overflow-hidden"
              style={{ border: "1px solid rgba(168,85,247,0.25)" }}
            >
              <div className="p-4 flex items-center gap-2" style={{ background: "rgba(45,15,61,0.8)", borderBottom: "1px solid rgba(168,85,247,0.15)" }}>
                <MapPin className="h-4 w-4 text-purple-400" />
                <span className="text-white text-sm font-semibold">Live Location Map</span>
                <a
                  href="https://maps.google.com/?q=Church+Auditorium+Ebrumede+Roundabout+Effurun+Uvwie+Delta+State+Nigeria"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-xs text-purple-400/70 hover:text-purple-400 flex items-center gap-1"
                >
                  Open in Maps <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="relative h-[260px] sm:h-[320px] lg:h-[400px]">
                <iframe
                  title="Ministers Conference 2026 Venue Location"
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3975.8!2d5.773!3d5.548!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x1041efa0b9d1c8e7%3A0xa3f1e0f0c0e0b0c0!2sEbrumede+Roundabout%2C+Effurun%2C+Delta+State%2C+Nigeria!5e0!3m2!1sen!2sng!4v1700000000001!5m2!1sen!2sng"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
              <div className="p-3 sm:p-4" style={{ background: "rgba(45,15,61,0.8)" }}>
                <p className="text-white/70 text-xs flex items-start gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-purple-400 shrink-0 mt-0.5" />
                  {CONF_LOCATION}
                </p>
              </div>
            </motion.div>
          </div>

          {/* ── Invite Card Generator ──────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.6 }}
            className="mb-12"
          >
            <ConferenceInviteCardGenerator initialName={rsvpName} initialPhoto={rsvpPhoto} />
          </motion.div>

          {/* ── Ad Copy Generator ──────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.7 }}
            className="mb-8"
          >
            <ConferenceAdCopySection />
          </motion.div>

          {/* ── Spread the Word ────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="text-center rounded-3xl p-5 sm:p-8 border border-purple-400/20"
            style={{ background: "rgba(45,15,61,0.6)" }}
          >
            <h3 className="font-serif font-bold text-white text-xl sm:text-2xl mb-2">Spread The Word</h3>
            <p className="text-white/60 text-xs sm:text-sm mb-5 sm:mb-6 max-w-md mx-auto">Every minister needs to hear this call. Share the conference with pastors, elders, and church leaders in your network.</p>
            <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-5 sm:mb-6">
              {[
                {
                  label: "WhatsApp",
                  bg: "#25D366",
                  href: `https://wa.me/?text=${encodeURIComponent(`🙏 MINISTERS CONFERENCE 2026!\n\n"An Apostolic Gathering of Ministers, Leaders & Kingdom Builders"\n\nFriday 8th – Sunday 10th May, 2026\n8:00 AM Daily\n📍 Church Auditorium, Ebrumede Roundabout, Effurun Uvwie, Delta State\n\n📞 ${CONF_CONTACT}\n\n#MinistersConference2026 #JCTM`)}`,
                  emoji: "💬",
                },
                {
                  label: "Facebook",
                  bg: "#1877F2",
                  href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent("https://jctm.org.ng/conference-registration")}`,
                  emoji: "👍",
                },
                {
                  label: "X / Twitter",
                  bg: "#000000",
                  href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`🙏 Ministers Conference 2026 — "An Apostolic Gathering of Ministers, Leaders & Kingdom Builders"\n\n📅 May 8–10, 2026\n⏰ 8AM Daily\n📍 Effurun Uvwie, Delta State\n\n#MinistersConference2026 #JCTM`)}&url=${encodeURIComponent("https://jctm.org.ng/conference-registration")}`,
                  emoji: "𝕏",
                },
              ].map(({ label, bg, href, emoji }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-all hover:scale-105 hover:shadow-xl touch-manipulation"
                  style={{ background: bg, minHeight: "44px" }}
                >
                  <span>{emoji}</span>
                  <span className="hidden xs:inline">Share on </span>{label}
                </a>
              ))}
            </div>
            <div className="flex items-center justify-center flex-wrap gap-1 text-white/50 text-sm">
              <Phone className="h-4 w-4 text-purple-400" />
              <span>Enquiries:</span>
              <a href={`tel:${CONF_CONTACT.replace(/\s/g, "")}`} className="text-purple-300 font-bold hover:underline">{CONF_CONTACT}</a>
            </div>
          </motion.div>

        </div>
      </div>
    </Layout>
  );
}


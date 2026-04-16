import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import {
  User, Mail, Phone, Building2, Award, MapPin,
  MessageSquare, ChevronRight, CheckCircle2, ArrowLeft,
  Flame, Calendar, Clock, Camera, ImagePlus, Copy, Check, Share2, Download,
  Sparkles, Instagram, Facebook, Youtube, Users,
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

function ConferenceInviteCardGenerator({ initialName = "", initialPhoto = null }: { initialName?: string; initialPhoto?: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const photoRef2 = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialName);
  const [photo, setPhoto2] = useState<string | null>(initialPhoto);
  const [generated, setGenerated] = useState(false);
  const [cropSrc2, setCropSrc2] = useState<string | null>(null);

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

  const generate = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 1080, H = 1440;
    canvas.width = W;
    canvas.height = H;

    const purple     = "#a855f7";
    const purpleDeep = "#7c3aed";
    const purpleLight = "#d8b4fe";
    const gold       = "#D4A017";
    const goldLight  = "#FFD700";
    const white      = "#ffffff";
    const green      = "#00c853";

    // ── BACKGROUND ──────────────────────────────────────────────────
    const bg = ctx.createLinearGradient(0, 0, W * 0.6, H);
    bg.addColorStop(0,    "#0d020f");
    bg.addColorStop(0.35, "#1a0525");
    bg.addColorStop(0.7,  "#2d0f3d");
    bg.addColorStop(1,    "#0d020f");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Top purple radial glow
    const topGlow = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, W);
    topGlow.addColorStop(0, "rgba(168,85,247,0.6)");
    topGlow.addColorStop(1, "rgba(13,2,15,0)");
    ctx.fillStyle = topGlow;
    ctx.fillRect(0, 0, W, H * 0.55);

    // Bottom gold accent glow
    const btmGlow = ctx.createRadialGradient(W / 2, H, 0, W / 2, H, W * 0.6);
    btmGlow.addColorStop(0, "rgba(212,160,23,0.2)");
    btmGlow.addColorStop(1, "rgba(13,2,15,0)");
    ctx.fillStyle = btmGlow;
    ctx.fillRect(0, 0, W, H);

    // ── DOT GRID ────────────────────────────────────────────────────
    const gs = 54;
    ctx.fillStyle = "rgba(168,85,247,0.06)";
    for (let gx = 0; gx <= W; gx += gs)
      for (let gy = 0; gy <= H; gy += gs) {
        ctx.beginPath(); ctx.arc(gx, gy, 1.2, 0, Math.PI * 2); ctx.fill();
      }

    ctx.textAlign = "center";

    // ── "CONFIRMED" BADGE ───────────────────────────────────────────
    const cPillW = 220, cPillH = 50, cPillX = W - cPillW - 44, cPillY = 46;
    ctx.fillStyle = "rgba(0,200,83,0.18)";
    ctx.beginPath(); ctx.roundRect(cPillX, cPillY, cPillW, cPillH, 25); ctx.fill();
    ctx.strokeStyle = green; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(cPillX, cPillY, cPillW, cPillH, 25); ctx.stroke();
    ctx.fillStyle = green; ctx.font = "bold 20px sans-serif";
    ctx.fillText("✓  CONFIRMED", cPillX + cPillW / 2, cPillY + 34);

    // ── MINISTRY LABEL ───────────────────────────────────────────────
    ctx.fillStyle = "rgba(216,180,254,0.40)";
    ctx.font = "bold 17px sans-serif";
    ctx.fillText("J E S U S   C H R I S T   T E M P L E   M I N I S T R Y", W / 2, 82);

    // ── EVENT TITLE ──────────────────────────────────────────────────
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

    // Subtitle
    ctx.fillStyle = "rgba(216,180,254,0.55)"; ctx.font = "italic 24px serif";
    ctx.fillText("\u201CAn Apostolic Gathering of Ministers,", W / 2, 415);
    ctx.fillText("Leaders & Kingdom Builders\u201D", W / 2, 447);

    // ── GOLD DIVIDER ────────────────────────────────────────────────
    const div = ctx.createLinearGradient(80, 0, W - 80, 0);
    div.addColorStop(0, "transparent");
    div.addColorStop(0.25, "rgba(212,160,23,0.6)");
    div.addColorStop(0.75, "rgba(212,160,23,0.6)");
    div.addColorStop(1, "transparent");
    ctx.strokeStyle = div; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(80, 475); ctx.lineTo(W - 80, 475); ctx.stroke();

    // ── PHOTO + NAME SECTION ─────────────────────────────────────────
    const circleY = 620, circleR = 140;

    if (photo) {
      const img = new Image();
      img.src = photo;
      await new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res(); });
      ctx.save();
      ctx.beginPath();
      ctx.arc(W / 2, circleY, circleR, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, W / 2 - circleR, circleY - circleR, circleR * 2, circleR * 2);
      ctx.restore();

      // Purple ring
      ctx.strokeStyle = purple; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(W / 2, circleY, circleR + 4, 0, Math.PI * 2); ctx.stroke();
      // Gold outer ring
      ctx.strokeStyle = gold; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(W / 2, circleY, circleR + 12, 0, Math.PI * 2); ctx.stroke();
    } else {
      // Placeholder circle
      const placeholderGrad = ctx.createRadialGradient(W / 2, circleY, 0, W / 2, circleY, circleR);
      placeholderGrad.addColorStop(0, "#3b0764");
      placeholderGrad.addColorStop(1, "#1a0525");
      ctx.fillStyle = placeholderGrad;
      ctx.beginPath(); ctx.arc(W / 2, circleY, circleR, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = purple; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(W / 2, circleY, circleR, 0, Math.PI * 2); ctx.stroke();
      // Silhouette
      ctx.fillStyle = "rgba(168,85,247,0.5)";
      ctx.beginPath(); ctx.arc(W / 2, circleY - 40, 55, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(W / 2, circleY + 95, 100, 0, Math.PI, true); ctx.fill();
    }

    // Name
    const displayName = name.trim() || "Your Name Here";
    ctx.shadowColor = "rgba(168,85,247,0.5)"; ctx.shadowBlur = 20;
    ctx.fillStyle = white; ctx.font = "bold 52px serif";
    ctx.fillText(displayName, W / 2, circleY + circleR + 70);
    ctx.shadowBlur = 0;

    ctx.fillStyle = "rgba(216,180,254,0.6)"; ctx.font = "italic 26px serif";
    ctx.fillText("is attending the Ministers Conference 2026", W / 2, circleY + circleR + 116);

    // ── EVENT INFO BOX ───────────────────────────────────────────────
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

    // ── BOTTOM CTA ───────────────────────────────────────────────────
    const ctaY = boxY + boxH + 70;
    ctx.fillStyle = purpleDeep;
    ctx.beginPath(); ctx.roundRect(boxX, ctaY, W - boxX * 2, 80, 40); ctx.fill();
    ctx.fillStyle = white; ctx.font = "bold 28px serif";
    ctx.fillText("Register Free at jctm.org.ng/conference-registration", W / 2, ctaY + 52);

    // ── FOOTER ───────────────────────────────────────────────────────
    ctx.fillStyle = "rgba(216,180,254,0.35)"; ctx.font = "bold 18px sans-serif";
    ctx.fillText("www.jctm.org.ng  ·  #MinistersConference2026  ·  #JCTM", W / 2, H - 52);

    setGenerated(true);
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
        if (!blob) return;
        if (navigator.share && navigator.canShare({ files: [new File([blob], "invite.jpg", { type: "image/jpeg" })] })) {
          await navigator.share({
            title: "Ministers Conference 2026 — I'm Attending!",
            text: `🙏 I'll be at the JCTM Ministers Conference 2026 (May 8–10, Effurun, Delta State). Register free at jctm.org.ng/conference-registration`,
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
          onDone={(cropped) => { setPhoto2(cropped); setCropSrc2(null); setGenerated(false); }}
          onCancel={() => setCropSrc2(null)}
        />
      )}
      <div className="rounded-3xl overflow-hidden border border-purple-400/20 mt-6"
        style={{ background: "rgba(45,15,61,0.7)" }}>
        <div className="p-6 border-b border-purple-400/10">
          <div className="flex items-center gap-3 mb-2">
            <Share2 className="h-5 w-5 text-purple-400" />
            <h3 className="font-serif font-bold text-white text-xl">Generate Your Invite Card</h3>
          </div>
          <p className="text-white/60 text-sm">Add your name and photo to create a personalised digital invite card to share on WhatsApp, Instagram, and Facebook.</p>
        </div>
        <div className="p-6 space-y-4">
          {/* Photo + Name row */}
          <div className="flex items-center gap-4">
            <input ref={photoRef2} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange2} />
            <button
              type="button"
              onClick={() => photoRef2.current?.click()}
              className="relative group shrink-0 transition-all duration-200"
              title="Upload your photo"
            >
              {photo ? (
                <div className="relative">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-purple-400 shadow-lg group-hover:border-purple-300 transition-all">
                    <img src={photo} alt="Your photo" className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Camera className="h-4 w-4 text-white" />
                  </div>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full border-2 border-dashed border-purple-400/40 flex flex-col items-center justify-center gap-0.5 bg-white/5 group-hover:bg-white/10 group-hover:border-purple-400 transition-all">
                  <Camera className="h-5 w-5 text-purple-400/60 group-hover:text-purple-400" />
                  <span className="text-[8px] text-purple-400/50 group-hover:text-purple-400 font-bold uppercase">Photo</span>
                </div>
              )}
            </button>
            <div className="flex-1 flex gap-2">
              <input
                placeholder="Your full name (optional)"
                value={name}
                onChange={(e) => { setName(e.target.value); setGenerated(false); }}
                className="flex-1 px-4 py-2.5 rounded-xl border text-white placeholder:text-white/30 text-sm font-medium outline-none focus:ring-2 focus:ring-purple-500/40"
                style={{ background: "rgba(45,15,61,0.7)", borderColor: "rgba(168,85,247,0.3)" }}
              />
              <Button
                onClick={generate}
                className="rounded-xl shrink-0 font-bold"
                style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", color: "#fff" }}
              >
                Generate
              </Button>
            </div>
          </div>

          {photo && (
            <button
              type="button"
              onClick={() => { setPhoto2(null); setGenerated(false); if (photoRef2.current) photoRef2.current.value = ""; }}
              className="text-xs text-white/40 hover:text-red-400 transition-colors block"
            >
              Remove photo
            </button>
          )}

          <canvas
            ref={canvasRef}
            className={`w-full rounded-2xl border border-purple-400/20 transition-opacity duration-300 ${generated ? "opacity-100" : "opacity-0 h-0"}`}
            style={{ aspectRatio: "3/4", objectFit: "contain" }}
          />

          {generated && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
              <Button
                onClick={share}
                className="flex-1 gap-2 rounded-xl font-bold"
                style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", color: "#fff" }}
              >
                <Share2 className="h-4 w-4" /> Share
              </Button>
              <Button
                onClick={download}
                variant="outline"
                className="flex-1 gap-2 rounded-xl border-purple-400/40 text-purple-300 hover:bg-purple-400/10"
              >
                <Download className="h-4 w-4" /> Download
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

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleDone = async () => {
    if (!croppedAreaPixels) return;
    const cropped = await getCroppedImg(src, croppedAreaPixels);
    onDone(cropped);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 p-4">
      <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl border" style={{ background: "#1a0525", borderColor: "rgba(168,85,247,0.4)" }}>
        <div className="px-4 pt-4 pb-2">
          <p className="text-white font-bold text-center text-sm">Crop Your Photo</p>
          <p className="text-white/50 text-xs text-center mt-0.5">Drag to reposition · Pinch or scroll to zoom</p>
        </div>
        <div className="relative w-full" style={{ height: 300 }}>
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
        <div className="px-5 py-3">
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-purple-400"
          />
        </div>
        <div className="flex gap-3 px-4 pb-4">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-xl border border-white/20 text-white/70 text-sm font-medium hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDone}
            className="flex-1 py-2 rounded-xl text-white text-sm font-bold transition-colors"
            style={{ background: "#a855f7" }}
          >
            Use This Crop
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-bold mb-2" style={{ color: "#d8b4fe" }}>
      {children}
      {required && <span className="text-yellow-400 ml-1">*</span>}
    </label>
  );
}

function FieldIcon({ icon: Icon }: { icon: React.ElementType }) {
  return (
    <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
      <Icon className="h-4 w-4" style={{ color: "#a855f7" }} />
    </span>
  );
}

const inputCls =
  "w-full pl-11 pr-4 py-3 rounded-xl border text-white placeholder:text-white/30 text-sm font-medium outline-none transition-all focus:ring-2 focus:ring-purple-500/40";
const inputStyle = {
  background: "rgba(45,15,61,0.7)",
  borderColor: "rgba(168,85,247,0.3)",
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
      <div className="p-6 border-b" style={{ borderColor: "rgba(168,85,247,0.12)" }}>
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="h-5 w-5 text-purple-400" />
          <h3 className="font-serif font-bold text-white text-xl">Social Ad Copy Generator</h3>
        </div>
        <p className="text-white/50 text-sm">3 professionally crafted ad versions for every platform. Copy and share instantly — no writing needed.</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: "rgba(168,85,247,0.12)" }}>
        {(Object.entries(CONF_AD_COPIES) as [keyof typeof CONF_AD_COPIES, typeof CONF_AD_COPIES.short][]).map(([key, val]) => {
          const Icon = val.icon;
          return (
            <button
              key={key}
              onClick={() => setActive(key)}
              className={`flex-1 py-3 px-2 text-xs font-bold uppercase tracking-wider transition-all duration-200 flex flex-col items-center gap-1 ${
                active === key
                  ? "border-b-2 border-purple-400 bg-purple-400/5"
                  : "text-white/35 hover:text-white/60"
              }`}
              style={{ color: active === key ? "#d8b4fe" : undefined }}
            >
              <Icon className="h-3.5 w-3.5" />
              {val.label}
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div className="p-6">
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

export default function ConferenceRegistration() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [regId, setRegId] = useState<number | null>(null);
  const [invitedBy, setInvitedBy] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [attendCount, setAttendCount] = useState<number | null>(null);

  const [photo, setPhoto] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);

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
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <SEO
        title="Register to Attend — Ministers Conference 2026 | JCTM"
        description="Register your attendance for the JCTM Ministers Conference 2026. May 8–10, 2026. An apostolic gathering of ministers, leaders and kingdom builders."
      />

      {cropSrc && (
        <CropModal
          src={cropSrc}
          onDone={(cropped) => { setPhoto(cropped); setCropSrc(null); }}
          onCancel={() => setCropSrc(null)}
        />
      )}

      {/* Hero */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(180deg,#0d020f 0%,#2a0a35 60%,#0d020f 100%)" }}
      >
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 40 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: `${(i % 3) * 0.8 + 0.5}px`,
                height: `${(i % 3) * 0.8 + 0.5}px`,
                top: `${(i * 41 + 13) % 100}%`,
                left: `${(i * 59 + 7) % 100}%`,
                background: `rgba(220,180,255,${(i % 5) * 0.07 + 0.06})`,
              }}
            />
          ))}
        </div>
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[250px] rounded-full blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(168,85,247,0.15) 0%, transparent 70%)" }}
        />

        <div className="relative z-10 container mx-auto px-4 pt-16 pb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-10"
          >
            <Link href="/">
              <span className="inline-flex items-center gap-1.5 text-purple-300/70 hover:text-purple-300 text-sm mb-6 transition-colors cursor-pointer">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Home
              </span>
            </Link>

            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold uppercase tracking-widest border mb-5"
              style={{ borderColor: "rgba(168,85,247,0.4)", background: "rgba(168,85,247,0.12)", color: "#d8b4fe" }}>
              <Flame className="h-3.5 w-3.5" /> Jesus Christ Temple Ministry Presents
            </div>

            <h1 className="font-serif font-black text-4xl md:text-5xl text-white mb-3 leading-tight">
              Ministers{" "}
              <span style={{ WebkitTextStroke: "2px #a855f7", color: "transparent" }}>Conference</span>{" "}
              <span className="text-purple-300">2026</span>
            </h1>
            <p className="text-purple-200/70 font-serif italic text-lg max-w-xl mx-auto mb-6">
              &ldquo;An Apostolic Gathering of Ministers, Leaders &amp; Kingdom Builders&rdquo;
            </p>

            <div className="flex flex-wrap justify-center gap-4 text-sm">
              {[
                { icon: Calendar, text: "May 8–10, 2026" },
                { icon: Clock, text: "8:00 AM Daily (WAT)" },
                { icon: MapPin, text: "Effurun Uvwie, Delta State" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 px-4 py-2 rounded-xl"
                  style={{ background: "rgba(45,15,61,0.7)", border: "1px solid rgba(168,85,247,0.25)" }}>
                  <Icon className="h-4 w-4 text-purple-400" />
                  <span className="text-white/80 font-medium">{text}</span>
                </div>
              ))}
            </div>

            {attendCount !== null && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="mt-5 inline-flex items-center gap-2 text-sm text-white/60"
              >
                <Users className="h-4 w-4 text-purple-400" />
                <span className="text-purple-300 font-bold">{attendCount.toLocaleString()}</span> ministers have registered
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <div
        className="min-h-screen py-12"
        style={{ background: "linear-gradient(180deg,#0d020f 0%,#160325 100%)" }}
      >
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">

            <AnimatePresence mode="wait">
              {success ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="flex flex-col items-center text-center py-12 px-4"
                >
                  {/* Photo avatar on success screen */}
                  {photo ? (
                    <div className="w-24 h-24 rounded-full overflow-hidden border-4 mb-6 shadow-2xl"
                      style={{ borderColor: "#a855f7", boxShadow: "0 0 40px rgba(168,85,247,0.4)" }}>
                      <img src={photo} alt="Your photo" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-2xl"
                      style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", boxShadow: "0 0 60px rgba(168,85,247,0.4)" }}>
                      <CheckCircle2 className="h-10 w-10 text-white" />
                    </div>
                  )}

                  <h2 className="font-serif font-black text-3xl md:text-4xl text-white mb-3">
                    Registration Confirmed!
                  </h2>
                  {regId && (
                    <p className="text-purple-300/70 text-sm mb-3">Reference #{regId}</p>
                  )}
                  <p className="text-purple-100/70 text-lg max-w-lg mb-8">
                    Welcome, {form.fullName.split(" ")[0]}. Your attendance has been registered for the{" "}
                    <span className="text-purple-300 font-bold">Ministers Conference 2026</span>. We look forward to seeing you!
                  </p>

                  <div className="rounded-3xl p-6 mb-8 max-w-md w-full text-left space-y-3"
                    style={{ background: "rgba(45,15,61,0.8)", border: "1px solid rgba(168,85,247,0.25)" }}>
                    <p className="text-purple-200/80 text-sm font-bold uppercase tracking-wider mb-2">Event Details</p>
                    {[
                      { icon: Calendar, text: "Friday 8th May — Sunday 10th May, 2026" },
                      { icon: Clock, text: "8:00 AM Daily (West Africa Time)" },
                      { icon: MapPin, text: "Church Auditorium, Km1 East West Rd., Ebrumede Roundabout, Effurun Uvwie L.G.A., Delta State" },
                    ].map(({ icon: Icon, text }) => (
                      <div key={text} className="flex items-start gap-3 text-sm text-white/80">
                        <Icon className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
                        <span>{text}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 mb-8">
                    <Link href="/">
                      <Button className="rounded-xl px-6 h-12 font-bold"
                        style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", color: "#fff" }}>
                        <ArrowLeft className="h-4 w-4 mr-2" /> Return to Home
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      onClick={() => { setSuccess(false); setForm(EMPTY_FORM); setRegId(null); setPhoto(null); }}
                      className="rounded-xl px-6 h-12 font-bold border-purple-400/40 text-purple-200 hover:bg-purple-500/10"
                    >
                      Register Another Person
                    </Button>
                  </div>

                  {/* Shareable Invite Link */}
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                    className="rounded-3xl p-6 max-w-md w-full text-left"
                    style={{ background: "rgba(45,15,61,0.9)", border: "1px solid rgba(168,85,247,0.3)" }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Share2 className="h-4 w-4 text-purple-400" />
                      <p className="text-purple-200 text-sm font-bold">Invite Others to Register</p>
                    </div>
                    <p className="text-purple-300/60 text-xs mb-4 leading-relaxed">
                      Share this personal invite link — anyone who opens it will see your name on the registration page and be encouraged to secure their place.
                    </p>

                    {/* Link box */}
                    <div className="flex items-center gap-2 rounded-xl border px-3 py-2.5 mb-4"
                      style={{ background: "rgba(26,5,37,0.8)", borderColor: "rgba(168,85,247,0.25)" }}>
                      <span className="flex-1 text-xs text-purple-300/70 truncate font-mono">
                        {`${window.location.origin}/conference-registration?invited_by=${encodeURIComponent(form.fullName)}`}
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(
                            `${window.location.origin}/conference-registration?invited_by=${encodeURIComponent(form.fullName)}`
                          );
                          setLinkCopied(true);
                          toast.success("Invite link copied!");
                          setTimeout(() => setLinkCopied(false), 2500);
                        }}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                        style={{
                          background: linkCopied ? "rgba(34,197,94,0.2)" : "rgba(168,85,247,0.2)",
                          color: linkCopied ? "#4ade80" : "#d8b4fe",
                          border: `1px solid ${linkCopied ? "rgba(34,197,94,0.4)" : "rgba(168,85,247,0.35)"}`,
                        }}
                      >
                        {linkCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {linkCopied ? "Copied!" : "Copy"}
                      </button>
                    </div>

                    {/* WhatsApp share */}
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(
                        `🙏 *Ministers Conference 2026 — Personal Invitation*\n\n` +
                        `I am ${form.fullName} and I personally invite you to join me at the JCTM Ministers Conference 2026!\n\n` +
                        `📅 May 8–10, 2026\n⏰ 8:00 AM Daily (WAT)\n📍 Ebrumede Roundabout, Effurun Uvwie, Delta State\n\n` +
                        `Click the link below to register and secure your place:\n` +
                        `${window.location.origin}/conference-registration?invited_by=${encodeURIComponent(form.fullName)}\n\n` +
                        `This is a divine appointment — don't miss it!\n🌐 www.jctm.org.ng`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white text-sm transition-opacity hover:opacity-90"
                      style={{ background: "#25D366" }}
                    >
                      <span className="text-base leading-none">💬</span>
                      Share Invite via WhatsApp
                    </a>
                  </motion.div>

                  {/* Invite Card Generator */}
                  <div className="w-full max-w-md">
                    <ConferenceInviteCardGenerator initialName={form.fullName} initialPhoto={photo} />
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  {invitedBy && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-8 flex items-center gap-4 rounded-2xl px-5 py-4 border"
                      style={{ background: "rgba(168,85,247,0.1)", borderColor: "rgba(168,85,247,0.35)" }}
                    >
                      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-lg"
                        style={{ background: "rgba(168,85,247,0.2)" }}>
                        🙏
                      </div>
                      <div>
                        <p className="text-purple-200 text-sm font-bold">You've been personally invited!</p>
                        <p className="text-purple-300/70 text-xs mt-0.5">
                          <span className="text-yellow-300 font-semibold">{invitedBy}</span> invites you to the Ministers Conference 2026. Register below to secure your place.
                        </p>
                      </div>
                    </motion.div>
                  )}
                  <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-10 items-start"
                >
                  {/* Left — Flyer + info */}
                  <div className="space-y-6">
                    <div className="rounded-3xl overflow-hidden border-2 shadow-2xl shadow-purple-500/20"
                      style={{ borderColor: "rgba(168,85,247,0.45)", background: "linear-gradient(145deg,#1a0525 0%,#2d0f3d 50%,#1a0525 100%)" }}>
                      <div className="h-1 w-full"
                        style={{ background: "linear-gradient(90deg,transparent,#a855f7 20%,#d8b4fe 50%,#a855f7 80%,transparent)" }} />
                      <img
                        src={ministerConferenceFlyer}
                        alt="Ministers Conference 2026 official flyer"
                        className="w-full h-auto object-contain"
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="h-0.5 w-full"
                        style={{ background: "linear-gradient(90deg,transparent,rgba(212,160,23,0.5),transparent)" }} />
                    </div>

                    <div className="rounded-3xl p-5 space-y-3"
                      style={{ background: "rgba(45,15,61,0.8)", border: "1px solid rgba(168,85,247,0.25)" }}>
                      <p className="text-purple-200/80 text-xs font-bold uppercase tracking-wider">Why Attend?</p>
                      {[
                        "Apostolic fire and prophetic impartation",
                        "Word-centred ministry from the front lines",
                        "Networking with ministers & kingdom builders",
                        "Encounter the presence of God corporately",
                      ].map(item => (
                        <div key={item} className="flex items-start gap-3 text-sm text-white/75">
                          <CheckCircle2 className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right — Registration Form */}
                  <div className="rounded-3xl overflow-hidden border shadow-2xl"
                    style={{ background: "linear-gradient(145deg,rgba(26,5,37,0.96),rgba(45,15,61,0.88))", borderColor: "rgba(168,85,247,0.3)", boxShadow: "0 24px 80px rgba(88,28,135,0.2)" }}>

                    {/* Form header */}
                    <div className="p-6 md:p-8 border-b" style={{ borderColor: "rgba(168,85,247,0.15)" }}>
                      <h2 className="font-serif font-black text-2xl text-white mb-1">
                        Register to Attend
                      </h2>
                      <p className="text-purple-100/60 text-sm">
                        Secure your place at the Ministers Conference 2026. Only your{" "}
                        <span className="text-yellow-400">name</span> is required — all other fields are optional.
                      </p>
                    </div>

                    <form onSubmit={handleSubmit} noValidate>
                      <div className="p-6 md:p-8 space-y-5">

                        {/* ── Photo Upload ──────────────────────────────── */}
                        <div>
                          <FieldLabel>Your Photo</FieldLabel>
                          <div className="flex flex-col items-center gap-3 py-2">
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
                                  <div
                                    className="w-28 h-28 rounded-full overflow-hidden border-4 shadow-2xl group-hover:border-purple-300 transition-all"
                                    style={{ borderColor: "#a855f7", boxShadow: "0 0 32px rgba(168,85,247,0.35)" }}
                                  >
                                    <img src={photo} alt="Your photo" className="w-full h-full object-cover" />
                                  </div>
                                  <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <Camera className="h-7 w-7 text-white" />
                                  </div>
                                  <div
                                    className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2"
                                    style={{ background: "#a855f7", borderColor: "#1a0525" }}
                                  >
                                    <Camera className="h-4 w-4 text-white" />
                                  </div>
                                </div>
                              ) : (
                                <div
                                  className="w-28 h-28 rounded-full border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition-all group-hover:bg-white/5"
                                  style={{ borderColor: "rgba(168,85,247,0.5)", background: "rgba(45,15,61,0.5)" }}
                                >
                                  <ImagePlus className="h-7 w-7 text-purple-400/70 group-hover:text-purple-400 transition-colors" />
                                  <span className="text-[10px] text-purple-400/60 group-hover:text-purple-400 font-bold uppercase tracking-wide transition-colors">
                                    Add Photo
                                  </span>
                                </div>
                              )}
                            </button>

                            {photo ? (
                              <div className="flex flex-col items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => photoRef.current?.click()}
                                  className="text-xs font-semibold transition-colors"
                                  style={{ color: "#a855f7" }}
                                >
                                  Change photo
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setPhoto(null); if (photoRef.current) photoRef.current.value = ""; }}
                                  className="text-xs text-white/30 hover:text-red-400 transition-colors"
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <p className="text-xs text-white/35 text-center leading-relaxed">
                                Optional · Tap to upload a photo<br />
                                <span className="text-white/20">JPG, PNG up to 10 MB</span>
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Divider */}
                        <div className="h-px" style={{ background: "rgba(168,85,247,0.15)" }} />

                        {/* Full Name */}
                        <div>
                          <FieldLabel required>Full Name</FieldLabel>
                          <div className="relative">
                            <FieldIcon icon={User} />
                            <Input
                              placeholder="e.g. Pastor John Adeyemi"
                              value={form.fullName}
                              onChange={set("fullName")}
                              maxLength={120}
                              className={inputCls}
                              style={inputStyle}
                            />
                          </div>
                          {errors.fullName && (
                            <p className="text-red-400 text-xs mt-1.5">{errors.fullName}</p>
                          )}
                        </div>

                        {/* Phone */}
                        <div>
                          <FieldLabel>Phone Number</FieldLabel>
                          <div className="relative">
                            <FieldIcon icon={Phone} />
                            <Input
                              type="tel"
                              placeholder="e.g. +234 801 234 5678"
                              value={form.phone}
                              onChange={set("phone")}
                              maxLength={30}
                              className={inputCls}
                              style={inputStyle}
                            />
                          </div>
                        </div>

                        {/* Email */}
                        <div>
                          <FieldLabel>Email Address</FieldLabel>
                          <div className="relative">
                            <FieldIcon icon={Mail} />
                            <Input
                              type="email"
                              placeholder="e.g. pastor@church.org"
                              value={form.email}
                              onChange={set("email")}
                              maxLength={160}
                              className={inputCls}
                              style={inputStyle}
                            />
                          </div>
                          {errors.email && (
                            <p className="text-red-400 text-xs mt-1.5">{errors.email}</p>
                          )}
                        </div>

                        {/* Ministry / Church */}
                        <div>
                          <FieldLabel>Ministry / Church Name</FieldLabel>
                          <div className="relative">
                            <FieldIcon icon={Building2} />
                            <Input
                              placeholder="e.g. Grace Apostolic Church, Lagos"
                              value={form.ministry}
                              onChange={set("ministry")}
                              maxLength={160}
                              className={inputCls}
                              style={inputStyle}
                            />
                          </div>
                        </div>

                        {/* Role */}
                        <div>
                          <FieldLabel>Role / Designation</FieldLabel>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                              <Award className="h-4 w-4" style={{ color: "#a855f7" }} />
                            </span>
                            <select
                              value={form.role}
                              onChange={set("role")}
                              className="w-full pl-11 pr-4 py-3 rounded-xl border text-white text-sm font-medium outline-none transition-all focus:ring-2 focus:ring-purple-500/40 appearance-none"
                              style={{ ...inputStyle, color: form.role ? "#fff" : "rgba(255,255,255,0.3)" }}
                            >
                              <option value="" style={{ background: "#1a0525", color: "#9ca3af" }}>Select your role…</option>
                              {ROLES.map(r => (
                                <option key={r} value={r} style={{ background: "#1a0525", color: "#fff" }}>{r}</option>
                              ))}
                            </select>
                            <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-purple-400/60 pointer-events-none rotate-90" />
                          </div>
                        </div>

                        {/* State / Country */}
                        <div>
                          <FieldLabel>State / Country of Origin</FieldLabel>
                          <div className="relative">
                            <FieldIcon icon={MapPin} />
                            <Input
                              placeholder="e.g. Lagos, Nigeria"
                              value={form.stateOrCountry}
                              onChange={set("stateOrCountry")}
                              maxLength={100}
                              className={inputCls}
                              style={inputStyle}
                            />
                          </div>
                        </div>

                        {/* Message */}
                        <div>
                          <FieldLabel>Additional Message</FieldLabel>
                          <div className="relative">
                            <span className="absolute left-4 top-3.5 pointer-events-none">
                              <MessageSquare className="h-4 w-4" style={{ color: "#a855f7" }} />
                            </span>
                            <textarea
                              rows={3}
                              placeholder="Any special requests, prayer points or notes…"
                              value={form.message}
                              onChange={set("message")}
                              maxLength={500}
                              className="w-full pl-11 pr-4 py-3 rounded-xl border text-white placeholder:text-white/30 text-sm font-medium outline-none transition-all focus:ring-2 focus:ring-purple-500/40 resize-none"
                              style={inputStyle}
                            />
                          </div>
                        </div>

                        {/* Submit */}
                        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} className="pt-2">
                          <Button
                            type="submit"
                            disabled={submitting}
                            className="w-full h-14 rounded-2xl font-black text-lg tracking-wide disabled:opacity-60"
                            style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", color: "#fff" }}
                          >
                            {submitting ? (
                              <span className="flex items-center gap-2">
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                </svg>
                                Submitting…
                              </span>
                            ) : (
                              <span className="flex items-center gap-2">
                                Complete Registration <ChevronRight className="h-5 w-5" />
                              </span>
                            )}
                          </Button>
                        </motion.div>

                        <p className="text-center text-purple-100/40 text-xs">
                          Your information is kept private and will only be used for conference logistics.
                        </p>
                      </div>
                    </form>
                  </div>
                  </div>

                  {/* Social Ad Copy Generator */}
                  <ConferenceAdCopySection />
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </div>
      </div>
    </Layout>
  );
}

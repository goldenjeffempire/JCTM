import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, RefreshCw, Flame, ChevronRight,
  Calendar, Mic2, Sparkles, Heart, Sun, Download, BookMarked, ImageDown,
} from "lucide-react";
import { toPng } from "html-to-image";
import { Layout } from "@/components/layout/Layout";
import { AdSlot, ADSENSE_SLOTS } from "@/components/ads/AdSense";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface DailyDevotion {
  date: string;
  title: string;
  scripture: string;
  reference: string;
  reflection: string;
  propheticWord: string;
  prayerFocus: string;
  declaration: string;
}

function skeleton(className: string) {
  return <div className={`animate-pulse rounded-lg bg-white/8 ${className}`} />;
}

function ReflectionBlock({ text }: { text: string }) {
  const paragraphs = text.split(/\n+/).filter(Boolean);
  return (
    <div className="space-y-4">
      {paragraphs.map((p, i) => (
        <p key={i} className="text-white/75 leading-relaxed text-[15px]">{p}</p>
      ))}
    </div>
  );
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

// Daily rotating card themes — 7 designs, one per day of week
const CARD_THEMES = [
  // 0 Sunday — Royal Gold (worship)
  {
    bg: "linear-gradient(155deg, #0a0710 0%, #130d1f 35%, #0d0a15 70%, #070509 100%)",
    accentPrimary: "#f59e0b",
    accentSecondary: "#fde68a",
    accentMuted: "rgba(251,191,36,0.12)",
    accentBorder: "rgba(251,191,36,0.22)",
    glow1: "radial-gradient(ellipse, rgba(245,158,11,0.18) 0%, transparent 65%)",
    glow2: "radial-gradient(ellipse, rgba(180,83,9,0.12) 0%, transparent 65%)",
    topBar: "linear-gradient(90deg, transparent, #d97706 20%, #fde68a 50%, #d97706 80%, transparent)",
    bottomBar: "linear-gradient(90deg, transparent, rgba(245,158,11,0.4) 50%, transparent)",
    scriptureCardBg: "rgba(251,191,36,0.08)",
    scriptureCardBorder: "rgba(251,191,36,0.2)",
    scriptureLeft: "#d97706",
    propheticBg: "rgba(124,58,237,0.08)",
    propheticBorder: "rgba(124,58,237,0.2)",
    propheticColor: "#c4b5fd",
    propheticLabel: "#a78bfa",
    declarationBg: "rgba(16,185,129,0.07)",
    declarationBorder: "rgba(16,185,129,0.18)",
    declarationColor: "#6ee7b7",
    declarationLabel: "#34d399",
    label: "✦ Sunday Word",
  },
  // 1 Monday — Deep Navy / Sapphire (new beginnings)
  {
    bg: "linear-gradient(155deg, #040d1a 0%, #071428 35%, #050f20 70%, #030810 100%)",
    accentPrimary: "#60a5fa",
    accentSecondary: "#bfdbfe",
    accentMuted: "rgba(96,165,250,0.1)",
    accentBorder: "rgba(96,165,250,0.2)",
    glow1: "radial-gradient(ellipse, rgba(59,130,246,0.16) 0%, transparent 65%)",
    glow2: "radial-gradient(ellipse, rgba(29,78,216,0.12) 0%, transparent 65%)",
    topBar: "linear-gradient(90deg, transparent, #2563eb 20%, #93c5fd 50%, #2563eb 80%, transparent)",
    bottomBar: "linear-gradient(90deg, transparent, rgba(96,165,250,0.4) 50%, transparent)",
    scriptureCardBg: "rgba(96,165,250,0.08)",
    scriptureCardBorder: "rgba(96,165,250,0.2)",
    scriptureLeft: "#3b82f6",
    propheticBg: "rgba(245,158,11,0.07)",
    propheticBorder: "rgba(245,158,11,0.18)",
    propheticColor: "#fde68a",
    propheticLabel: "#fbbf24",
    declarationBg: "rgba(16,185,129,0.07)",
    declarationBorder: "rgba(16,185,129,0.18)",
    declarationColor: "#6ee7b7",
    declarationLabel: "#34d399",
    label: "✦ Monday Word",
  },
  // 2 Tuesday — Emerald / Forest (renewal)
  {
    bg: "linear-gradient(155deg, #030f0a 0%, #051a0f 35%, #041209 70%, #020a05 100%)",
    accentPrimary: "#34d399",
    accentSecondary: "#a7f3d0",
    accentMuted: "rgba(52,211,153,0.1)",
    accentBorder: "rgba(52,211,153,0.2)",
    glow1: "radial-gradient(ellipse, rgba(16,185,129,0.16) 0%, transparent 65%)",
    glow2: "radial-gradient(ellipse, rgba(5,150,105,0.12) 0%, transparent 65%)",
    topBar: "linear-gradient(90deg, transparent, #059669 20%, #6ee7b7 50%, #059669 80%, transparent)",
    bottomBar: "linear-gradient(90deg, transparent, rgba(52,211,153,0.4) 50%, transparent)",
    scriptureCardBg: "rgba(52,211,153,0.07)",
    scriptureCardBorder: "rgba(52,211,153,0.2)",
    scriptureLeft: "#10b981",
    propheticBg: "rgba(245,158,11,0.07)",
    propheticBorder: "rgba(245,158,11,0.18)",
    propheticColor: "#fde68a",
    propheticLabel: "#fbbf24",
    declarationBg: "rgba(96,165,250,0.07)",
    declarationBorder: "rgba(96,165,250,0.18)",
    declarationColor: "#93c5fd",
    declarationLabel: "#60a5fa",
    label: "✦ Tuesday Word",
  },
  // 3 Wednesday — Deep Crimson / Rose (grace & sacrifice)
  {
    bg: "linear-gradient(155deg, #120408 0%, #1e0610 35%, #160408 70%, #0d0206 100%)",
    accentPrimary: "#fb7185",
    accentSecondary: "#fecdd3",
    accentMuted: "rgba(251,113,133,0.1)",
    accentBorder: "rgba(251,113,133,0.2)",
    glow1: "radial-gradient(ellipse, rgba(244,63,94,0.16) 0%, transparent 65%)",
    glow2: "radial-gradient(ellipse, rgba(159,18,57,0.12) 0%, transparent 65%)",
    topBar: "linear-gradient(90deg, transparent, #be123c 20%, #fda4af 50%, #be123c 80%, transparent)",
    bottomBar: "linear-gradient(90deg, transparent, rgba(251,113,133,0.4) 50%, transparent)",
    scriptureCardBg: "rgba(251,113,133,0.07)",
    scriptureCardBorder: "rgba(251,113,133,0.2)",
    scriptureLeft: "#f43f5e",
    propheticBg: "rgba(245,158,11,0.07)",
    propheticBorder: "rgba(245,158,11,0.18)",
    propheticColor: "#fde68a",
    propheticLabel: "#fbbf24",
    declarationBg: "rgba(124,58,237,0.07)",
    declarationBorder: "rgba(124,58,237,0.18)",
    declarationColor: "#c4b5fd",
    declarationLabel: "#a78bfa",
    label: "✦ Wednesday Word",
  },
  // 4 Thursday — Deep Amber / Harvest (provision)
  {
    bg: "linear-gradient(155deg, #0e0900 0%, #1a1000 35%, #120c00 70%, #0a0700 100%)",
    accentPrimary: "#fb923c",
    accentSecondary: "#fed7aa",
    accentMuted: "rgba(251,146,60,0.1)",
    accentBorder: "rgba(251,146,60,0.2)",
    glow1: "radial-gradient(ellipse, rgba(234,88,12,0.18) 0%, transparent 65%)",
    glow2: "radial-gradient(ellipse, rgba(154,52,18,0.12) 0%, transparent 65%)",
    topBar: "linear-gradient(90deg, transparent, #c2410c 20%, #fdba74 50%, #c2410c 80%, transparent)",
    bottomBar: "linear-gradient(90deg, transparent, rgba(251,146,60,0.4) 50%, transparent)",
    scriptureCardBg: "rgba(251,146,60,0.08)",
    scriptureCardBorder: "rgba(251,146,60,0.2)",
    scriptureLeft: "#ea580c",
    propheticBg: "rgba(245,158,11,0.07)",
    propheticBorder: "rgba(245,158,11,0.18)",
    propheticColor: "#fde68a",
    propheticLabel: "#fbbf24",
    declarationBg: "rgba(16,185,129,0.07)",
    declarationBorder: "rgba(16,185,129,0.18)",
    declarationColor: "#6ee7b7",
    declarationLabel: "#34d399",
    label: "✦ Thursday Word",
  },
  // 5 Friday — Indigo / Cyan (clarity & prayer)
  {
    bg: "linear-gradient(155deg, #04080f 0%, #060c16 35%, #050912 70%, #030609 100%)",
    accentPrimary: "#22d3ee",
    accentSecondary: "#a5f3fc",
    accentMuted: "rgba(34,211,238,0.1)",
    accentBorder: "rgba(34,211,238,0.2)",
    glow1: "radial-gradient(ellipse, rgba(6,182,212,0.16) 0%, transparent 65%)",
    glow2: "radial-gradient(ellipse, rgba(8,145,178,0.12) 0%, transparent 65%)",
    topBar: "linear-gradient(90deg, transparent, #0891b2 20%, #67e8f9 50%, #0891b2 80%, transparent)",
    bottomBar: "linear-gradient(90deg, transparent, rgba(34,211,238,0.4) 50%, transparent)",
    scriptureCardBg: "rgba(34,211,238,0.07)",
    scriptureCardBorder: "rgba(34,211,238,0.2)",
    scriptureLeft: "#06b6d4",
    propheticBg: "rgba(124,58,237,0.08)",
    propheticBorder: "rgba(124,58,237,0.2)",
    propheticColor: "#c4b5fd",
    propheticLabel: "#a78bfa",
    declarationBg: "rgba(245,158,11,0.07)",
    declarationBorder: "rgba(245,158,11,0.18)",
    declarationColor: "#fde68a",
    declarationLabel: "#fbbf24",
    label: "✦ Friday Word",
  },
  // 6 Saturday — Deep Violet / Sacred (consecration)
  {
    bg: "linear-gradient(155deg, #080512 0%, #0e0820 35%, #0a0618 70%, #060410 100%)",
    accentPrimary: "#a78bfa",
    accentSecondary: "#ddd6fe",
    accentMuted: "rgba(167,139,250,0.1)",
    accentBorder: "rgba(167,139,250,0.2)",
    glow1: "radial-gradient(ellipse, rgba(124,58,237,0.18) 0%, transparent 65%)",
    glow2: "radial-gradient(ellipse, rgba(91,33,182,0.12) 0%, transparent 65%)",
    topBar: "linear-gradient(90deg, transparent, #7c3aed 20%, #c4b5fd 50%, #7c3aed 80%, transparent)",
    bottomBar: "linear-gradient(90deg, transparent, rgba(167,139,250,0.4) 50%, transparent)",
    scriptureCardBg: "rgba(167,139,250,0.08)",
    scriptureCardBorder: "rgba(167,139,250,0.2)",
    scriptureLeft: "#8b5cf6",
    propheticBg: "rgba(245,158,11,0.07)",
    propheticBorder: "rgba(245,158,11,0.18)",
    propheticColor: "#fde68a",
    propheticLabel: "#fbbf24",
    declarationBg: "rgba(16,185,129,0.07)",
    declarationBorder: "rgba(16,185,129,0.18)",
    declarationColor: "#6ee7b7",
    declarationLabel: "#34d399",
    label: "✦ Saturday Word",
  },
];

function DevotionShareCard({
  devotion,
  dateLabel,
  cardRef,
}: {
  devotion: DailyDevotion;
  dateLabel: string;
  cardRef: React.RefObject<HTMLDivElement | null>;
}) {
  // Trim to fit without losing meaning — scripture is the hero so allow more
  const scriptureText = truncate(devotion.scripture, 280);
  const reflectionSnippet = truncate(devotion.reflection.replace(/\n+/g, " "), 200);
  const declarationText = truncate(devotion.declaration, 220);

  const dayOfWeek = new Date().getDay();
  const theme = CARD_THEMES[dayOfWeek]!;

  return (
    <div
      ref={cardRef}
      style={{
        position: "absolute",
        left: "-9999px",
        top: 0,
        width: "540px",
        height: "810px",
        background: theme.bg,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "Georgia, 'Times New Roman', serif",
      }}
    >
      {/* Large atmospheric glow — top-centre */}
      <div style={{
        position: "absolute",
        top: "-100px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "560px",
        height: "400px",
        background: theme.glow1,
        pointerEvents: "none",
      }} />
      {/* Secondary glow — bottom-left */}
      <div style={{
        position: "absolute",
        bottom: "-80px",
        left: "-60px",
        width: "360px",
        height: "360px",
        background: theme.glow2,
        pointerEvents: "none",
      }} />
      {/* Very subtle dot-grid texture */}
      <div style={{
        position: "absolute",
        inset: 0,
        backgroundImage: `radial-gradient(circle, ${theme.accentBorder} 1px, transparent 1px)`,
        backgroundSize: "28px 28px",
        opacity: 0.18,
        pointerEvents: "none",
      }} />

      {/* Top accent bar */}
      <div style={{ height: "4px", background: theme.topBar, flexShrink: 0 }} />

      {/* ── Content ── */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        padding: "24px 38px 20px",
      }}>

        {/* ── Header row: brand + day badge ── */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "20px",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "32px", height: "32px",
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${theme.accentPrimary}cc, ${theme.accentSecondary}33)`,
              border: `1.5px solid ${theme.accentBorder}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <span style={{ color: "white", fontSize: "14px", fontFamily: "sans-serif", lineHeight: 1 }}>✝</span>
            </div>
            <div>
              <div style={{
                color: theme.accentPrimary,
                fontSize: "10px",
                fontWeight: "700",
                letterSpacing: "0.14em",
                fontFamily: "sans-serif",
                textTransform: "uppercase",
              }}>
                JCTM Daily Devotion
              </div>
              <div style={{
                color: "rgba(255,255,255,0.3)",
                fontSize: "8.5px",
                fontFamily: "sans-serif",
                marginTop: "2px",
                letterSpacing: "0.04em",
              }}>
                Jesus Christ Temple Ministry · Warri, Nigeria
              </div>
            </div>
          </div>
          <div style={{
            background: theme.accentMuted,
            border: `1px solid ${theme.accentBorder}`,
            borderRadius: "20px",
            padding: "4px 11px",
            color: theme.accentSecondary,
            fontSize: "8.5px",
            fontFamily: "sans-serif",
            fontWeight: "600",
            letterSpacing: "0.08em",
            whiteSpace: "nowrap",
          }}>
            {theme.label}
          </div>
        </div>

        {/* ── Date line ── */}
        <div style={{
          color: "rgba(255,255,255,0.3)",
          fontSize: "9px",
          fontFamily: "sans-serif",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          marginBottom: "12px",
          flexShrink: 0,
        }}>
          {dateLabel}
        </div>

        {/* ── Title — the hero ── */}
        <h2 style={{
          color: "white",
          fontSize: "30px",
          fontWeight: "700",
          lineHeight: "1.2",
          margin: "0 0 14px 0",
          fontFamily: "Georgia, 'Times New Roman', serif",
          letterSpacing: "-0.02em",
          flexShrink: 0,
        }}>
          {devotion.title}
        </h2>

        {/* ── Accent rule ── */}
        <div style={{
          height: "2px",
          background: `linear-gradient(90deg, ${theme.accentPrimary} 0%, ${theme.accentPrimary}44 60%, transparent 100%)`,
          marginBottom: "18px",
          flexShrink: 0,
          borderRadius: "1px",
        }} />

        {/* ── Scripture — large, italic, prominent ── */}
        <div style={{
          borderLeft: `3px solid ${theme.scriptureLeft}`,
          paddingLeft: "16px",
          marginBottom: "16px",
          flexShrink: 0,
        }}>
          <div style={{
            color: theme.accentPrimary,
            fontSize: "8.5px",
            fontWeight: "700",
            letterSpacing: "0.14em",
            fontFamily: "sans-serif",
            textTransform: "uppercase",
            marginBottom: "8px",
          }}>
            📖 Scripture
          </div>
          <p style={{
            color: "rgba(255,255,255,0.92)",
            fontSize: "16px",
            lineHeight: "1.68",
            fontStyle: "italic",
            margin: "0 0 10px 0",
            fontFamily: "Georgia, 'Times New Roman', serif",
          }}>
            "{scriptureText}"
          </p>
          <p style={{
            color: theme.accentPrimary,
            fontSize: "11px",
            fontWeight: "700",
            margin: 0,
            fontFamily: "sans-serif",
            letterSpacing: "0.06em",
          }}>
            — {devotion.reference}
          </p>
        </div>

        {/* ── Thin separator ── */}
        <div style={{
          height: "1px",
          background: `linear-gradient(90deg, transparent, ${theme.accentBorder} 40%, ${theme.accentBorder} 60%, transparent)`,
          marginBottom: "16px",
          flexShrink: 0,
        }} />

        {/* ── Reflection snippet ── */}
        <div style={{
          flex: 1,
          marginBottom: "16px",
          minHeight: 0,
          overflow: "hidden",
        }}>
          <div style={{
            color: "rgba(255,255,255,0.38)",
            fontSize: "8.5px",
            fontWeight: "700",
            letterSpacing: "0.14em",
            fontFamily: "sans-serif",
            textTransform: "uppercase",
            marginBottom: "8px",
          }}>
            ✦ Reflection
          </div>
          <p style={{
            color: "rgba(255,255,255,0.72)",
            fontSize: "13.5px",
            lineHeight: "1.7",
            margin: 0,
            fontFamily: "Georgia, 'Times New Roman', serif",
          }}>
            {reflectionSnippet}
          </p>
        </div>

        {/* ── Declaration — bold call-to-action block ── */}
        <div style={{
          background: `linear-gradient(135deg, ${theme.declarationBg}, rgba(255,255,255,0.03))`,
          border: `1px solid ${theme.declarationBorder}`,
          borderRadius: "14px",
          padding: "16px 20px",
          marginBottom: "16px",
          flexShrink: 0,
        }}>
          <div style={{
            color: theme.declarationLabel,
            fontSize: "8.5px",
            fontWeight: "700",
            letterSpacing: "0.14em",
            fontFamily: "sans-serif",
            textTransform: "uppercase",
            marginBottom: "8px",
          }}>
            📣 Today's Declaration
          </div>
          <p style={{
            color: "rgba(255,255,255,0.95)",
            fontSize: "15px",
            lineHeight: "1.6",
            fontWeight: "600",
            margin: 0,
            fontFamily: "Georgia, 'Times New Roman', serif",
            letterSpacing: "0.01em",
          }}>
            "{declarationText}"
          </p>
        </div>

        {/* ── Footer ── */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          paddingTop: "12px",
          borderTop: `1px solid rgba(255,255,255,0.07)`,
        }}>
          <div style={{
            color: "rgba(255,255,255,0.22)",
            fontSize: "9px",
            fontFamily: "sans-serif",
            letterSpacing: "0.04em",
          }}>
            Temple TV · jctm.org.ng
          </div>
          <div style={{
            color: theme.accentPrimary,
            fontSize: "9px",
            fontFamily: "sans-serif",
            opacity: 0.6,
            letterSpacing: "0.04em",
          }}>
            jctm.org.ng/devotion
          </div>
        </div>
      </div>

      {/* Bottom accent bar */}
      <div style={{ height: "4px", background: theme.bottomBar, flexShrink: 0 }} />
    </div>
  );
}

export default function Devotion() {
  const [devotion, setDevotion] = useState<DailyDevotion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [sharingPlatform, setSharingPlatform] = useState<string | null>(null);
  const [declarationMode, setDeclarationMode] = useState(false);
  const [currentWord, setCurrentWord] = useState(0);
  const [declarationWords, setDeclarationWords] = useState<string[]>([]);
  const [history, setHistory] = useState<DailyDevotion[]>([]);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const today = new Date();
  const dateLabel = format(today, "EEEE, MMMM d, yyyy");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(`${BASE}/api/devotion/daily`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { devotion: DailyDevotion };
      setDevotion(data.devotion);
    } catch {
      setError("Could not load today's devotion. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch(`${BASE}/api/devotion/history?limit=8`)
      .then(r => r.ok ? r.json() : null)
      .then((data: { devotions?: DailyDevotion[] } | null) => {
        if (!data?.devotions) return;
        const todayStr = new Date().toISOString().split("T")[0]!;
        setHistory(data.devotions.filter(d => d.date !== todayStr).slice(0, 7));
      })
      .catch(() => {});
  }, []);

  const generateCard = async (): Promise<{ dataUrl: string; file: File } | null> => {
    if (!devotion || !cardRef.current) return null;
    const dataUrl = await toPng(cardRef.current, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: "#080512",
      width: 540,
      height: 810,
    });
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], `jctm-devotion-${devotion.date}.png`, { type: "image/png" });
    return { dataUrl, file };
  };

  const downloadCard = (dataUrl: string) => {
    if (!devotion) return;
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `jctm-devotion-${devotion.date}.png`;
    link.click();
  };

  const handlePlatformShare = async (platform: "native" | "whatsapp" | "instagram" | "facebook" | "download") => {
    if (!devotion) return;
    setSharingPlatform(platform);
    try {
      const result = await generateCard();
      if (!result) return;
      const { dataUrl, file } = result;

      const captionText = `📖 ${devotion.title}\n— ${devotion.reference}\n\n"${devotion.declaration}"\n\n#JCTM #DailyDevotion #TempleTV jctm.org.ng`;

      if (platform === "download") {
        downloadCard(dataUrl);
        toast.success("Devotion card saved to your downloads!");
        return;
      }

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: devotion.title,
          text: captionText,
          files: [file],
        });
        return;
      }

      downloadCard(dataUrl);

      const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
      switch (platform) {
        case "whatsapp":
          toast.success("Image saved! Tap to open WhatsApp and attach it.", { duration: 5000 });
          await delay(600);
          window.open(`https://wa.me/?text=${encodeURIComponent(captionText)}`, "_blank");
          break;
        case "instagram":
          toast.success("Image saved! Open Instagram → New post → select it from your gallery.", { duration: 5000 });
          await delay(600);
          window.open("https://www.instagram.com/", "_blank");
          break;
        case "facebook":
          toast.success("Image saved! Share it as a photo on Facebook.", { duration: 5000 });
          await delay(600);
          window.open("https://www.facebook.com/", "_blank");
          break;
        default:
          toast.success("Devotion card downloaded!");
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        toast.error("Could not generate the share card. Please try again.");
      }
    } finally {
      setSharingPlatform(null);
    }
  };

  const startDeclaration = () => {
    if (!devotion) return;
    const words = devotion.declaration.split(/\s+/);
    setDeclarationWords(words);
    setCurrentWord(0);
    setDeclarationMode(true);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setCurrentWord(i);
      if (i >= words.length - 1) clearInterval(interval);
    }, 350);
  };

  return (
    <Layout>
      <SEO
        title="Daily Devotion — JCTM Digital Sanctuary | Jesus Christ Temple Ministry"
        description="Start every day with a prophetically-grounded scripture devotion from Jesus Christ Temple Ministry (JCTM). Fresh AI-powered devotional content anchored in holiness, the Correction Mandate, and Primitive Christianity."
        path="/devotion"
        keywords="JCTM daily devotion, daily Bible devotion Nigeria, Christian devotional Nigeria, prophetic word today, scripture reflection, Jesus Christ Temple Ministry devotion, holiness devotion, morning devotion Nigeria, JCTM morning word"
        breadcrumbs={[
          { name: "Home", url: "https://jctm.org.ng/" },
          { name: "Daily Devotion", url: "https://jctm.org.ng/devotion" },
        ]}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Blog",
            "name": "JCTM Daily Devotion",
            "description": "Daily scripture devotions from Jesus Christ Temple Ministry (JCTM), grounded in holiness, the Correction Mandate, and Primitive Christianity. Fresh prophetic word and reflection each day.",
            "url": "https://jctm.org.ng/devotion",
            "inLanguage": "en-NG",
            "author": {
              "@type": "ReligiousOrganization",
              "name": "Jesus Christ Temple Ministry (JCTM)",
              "url": "https://jctm.org.ng"
            },
            "publisher": {
              "@type": "ReligiousOrganization",
              "name": "Jesus Christ Temple Ministry (JCTM)",
              "url": "https://jctm.org.ng",
              "logo": { "@type": "ImageObject", "url": "https://jctm.org.ng/favicon.png" }
            },
            "about": [
              { "@type": "Thing", "name": "Holiness" },
              { "@type": "Thing", "name": "Correction Mandate" },
              { "@type": "Thing", "name": "Primitive Christianity" },
              { "@type": "Thing", "name": "Daily Bible Reading" },
              { "@type": "Thing", "name": "Christian Devotional" }
            ]
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
              {
                "@type": "Question",
                "name": "What is the JCTM Daily Devotion?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "The JCTM Daily Devotion is a fresh, AI-powered scripture devotional from Jesus Christ Temple Ministry, published every day. Each devotion includes a Bible passage, a prophetic reflection, and a practical application — all grounded in JCTM's core doctrines of holiness, Primitive Christianity, and the Correction Mandate."
                }
              },
              {
                "@type": "Question",
                "name": "How often is the JCTM devotion updated?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "The JCTM Daily Devotion is refreshed every day at jctm.org.ng/devotion. Each day brings a new scripture passage, a prophetically-grounded reflection, and a word for believers to carry through the day."
                }
              }
            ]
          }
        ]}
      />

      {/* Hidden share card — rendered off-screen for image capture */}
      {devotion && (
        <DevotionShareCard devotion={devotion} dateLabel={format(today, "MMMM d, yyyy")} cardRef={cardRef} />
      )}

      <div className="min-h-screen" style={{ background: "linear-gradient(160deg, #06071a 0%, #0c0e26 40%, #0a0818 100%)" }}>

        {/* Hero */}
        <div className="relative overflow-hidden pt-28 pb-14 px-4">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full opacity-[0.07]"
              style={{ background: "radial-gradient(ellipse, #f59e0b 0%, transparent 70%)" }} />
            <div className="absolute bottom-0 left-0 right-0 h-32"
              style={{ background: "linear-gradient(to bottom, transparent, #0a0818)" }} />
          </div>

          <div className="relative max-w-2xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium mb-5"
                style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.2)", color: "#fde68a" }}
              >
                <Calendar className="h-3.5 w-3.5" />
                {dateLabel}
              </div>
              <h1 className="text-4xl md:text-5xl font-bold font-serif text-white mb-3 leading-tight">
                Daily Devotion
              </h1>
              <p className="text-amber-100/40 text-base leading-relaxed">
                Spirit-breathed reflection for today — prophetically grounded, scripturally anchored.
              </p>
            </motion.div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-2xl mx-auto px-4 pb-24 space-y-5">

          {/* Error */}
          {error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center space-y-4">
              <p className="text-red-300 text-sm">{error}</p>
              <Button onClick={load} variant="outline" size="sm" className="border-red-500/20 text-red-300">
                <RefreshCw className="h-3.5 w-3.5 mr-2" /> Try Again
              </Button>
            </div>
          )}

          {/* Loading */}
          {isLoading && !error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
              <div className="rounded-3xl border border-white/8 bg-white/3 p-8 space-y-4">
                {skeleton("h-6 w-3/4")}
                {skeleton("h-4 w-1/2")}
                {skeleton("h-24 w-full mt-6")}
              </div>
              <div className="rounded-3xl border border-white/8 bg-white/3 p-8 space-y-3">
                {skeleton("h-5 w-1/3")}
                {skeleton("h-4 w-full")}
                {skeleton("h-4 w-full")}
                {skeleton("h-4 w-5/6")}
              </div>
              <div className="rounded-3xl border border-amber-500/15 bg-amber-500/5 p-8 space-y-3">
                {skeleton("h-5 w-2/5")}
                {skeleton("h-4 w-full")}
                {skeleton("h-4 w-4/5")}
              </div>
            </motion.div>
          )}

          {devotion && !isLoading && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-5">

              {/* Scripture Card */}
              <div className="relative rounded-3xl overflow-hidden border"
                style={{ background: "linear-gradient(135deg, rgba(251,191,36,0.08) 0%, rgba(245,158,11,0.05) 100%)", borderColor: "rgba(251,191,36,0.2)" }}
              >
                <div className="p-7 md:p-8">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center">
                      <BookOpen className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="text-xs font-semibold text-amber-400/70 uppercase tracking-wider">Today's Scripture</span>
                  </div>

                  <h2 className="text-xl md:text-2xl font-bold font-serif text-white mb-4 leading-snug">
                    {devotion.title}
                  </h2>

                  <blockquote className="relative pl-4 border-l-2 border-amber-500/40">
                    <p className="text-amber-100/80 text-base leading-relaxed italic">
                      "{devotion.scripture}"
                    </p>
                    <footer className="mt-2 text-amber-400/60 text-xs font-semibold">
                      — {devotion.reference}
                    </footer>
                  </blockquote>
                </div>
              </div>

              {/* Reflection */}
              <div className="rounded-3xl border border-white/8 overflow-hidden"
                style={{ background: "rgba(255,255,255,0.03)" }}
              >
                <div className="px-7 py-5 border-b border-white/6 flex items-center gap-2">
                  <Sun className="h-4 w-4 text-sky-400/60" />
                  <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Reflection</span>
                </div>
                <div className="p-7 md:p-8">
                  <ReflectionBlock text={devotion.reflection} />
                </div>
              </div>

              {/* Prophetic Word */}
              <div className="relative rounded-3xl overflow-hidden border"
                style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.1) 0%, rgba(79,70,229,0.07) 100%)", borderColor: "rgba(124,58,237,0.25)" }}
              >
                <div className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-[0.06] blur-2xl"
                  style={{ background: "radial-gradient(circle, #7c3aed, transparent)" }} />
                <div className="relative p-7 md:p-8">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center">
                      <Sparkles className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="text-xs font-semibold text-violet-400/70 uppercase tracking-wider">Today's Prophetic Word</span>
                  </div>
                  <p className="text-violet-100/85 text-[15px] leading-relaxed italic font-medium">
                    "{devotion.propheticWord}"
                  </p>
                  <p className="mt-3 text-violet-400/40 text-xs">— Prophet Amos Evomobor, JCTM</p>
                </div>
              </div>

              {/* Prayer Focus */}
              <div className="rounded-3xl border border-white/8 overflow-hidden"
                style={{ background: "rgba(255,255,255,0.03)" }}
              >
                <div className="px-7 py-5 border-b border-white/6 flex items-center gap-2">
                  <Heart className="h-4 w-4 text-rose-400/60" />
                  <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Prayer Focus</span>
                </div>
                <div className="p-7">
                  <p className="text-white/70 leading-relaxed text-[15px]">{devotion.prayerFocus}</p>
                  <a
                    href="/prayer"
                    className="inline-flex items-center gap-1.5 mt-4 text-xs text-rose-400/70 hover:text-rose-400 transition-colors"
                  >
                    Generate a full prayer for this need <ChevronRight className="h-3 w-3" />
                  </a>
                </div>
              </div>

              {/* Declaration */}
              <div className="relative rounded-3xl overflow-hidden border"
                style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(5,150,105,0.05) 100%)", borderColor: "rgba(16,185,129,0.2)" }}
              >
                <div className="p-7 md:p-8">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                      <Mic2 className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="text-xs font-semibold text-emerald-400/70 uppercase tracking-wider">Speak This Declaration</span>
                  </div>

                  <AnimatePresence mode="wait">
                    {declarationMode ? (
                      <motion.div
                        key="karaoke"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-wrap gap-1.5 text-lg font-semibold leading-snug"
                      >
                        {declarationWords.map((word, i) => (
                          <motion.span
                            key={i}
                            initial={{ color: "rgba(255,255,255,0.25)" }}
                            animate={{ color: i <= currentWord ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.25)" }}
                            transition={{ duration: 0.2 }}
                            className="transition-colors"
                          >
                            {word}
                          </motion.span>
                        ))}
                      </motion.div>
                    ) : (
                      <motion.p key="static" className="text-emerald-100/85 text-base font-semibold leading-relaxed">
                        "{devotion.declaration}"
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <Button
                    onClick={declarationMode ? () => setDeclarationMode(false) : startDeclaration}
                    className="mt-5 text-xs h-9 px-4 rounded-xl border-0 text-white font-semibold transition-all"
                    style={{ background: "linear-gradient(135deg, #10b981, #059669)", boxShadow: "0 4px 16px rgba(16,185,129,0.25)" }}
                  >
                    <Flame className="h-3.5 w-3.5 mr-1.5" />
                    {declarationMode ? "Done" : "Speak it aloud"}
                  </Button>
                </div>
              </div>

              {/* Image Share System */}
              <div className="rounded-3xl border border-white/8 overflow-hidden pt-2" style={{ background: "rgba(255,255,255,0.02)" }}>
                {/* Section header */}
                <div className="px-6 pt-5 pb-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-gradient-to-br from-amber-500/80 to-yellow-600/80 flex items-center justify-center">
                        <ImageDown className="h-3 w-3 text-white" />
                      </div>
                      <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Share Devotion</span>
                    </div>
                    <button
                      onClick={load}
                      title="Reload"
                      className="h-7 w-7 rounded-lg flex items-center justify-center text-white/25 hover:text-white/50 hover:bg-white/5 transition-all"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="text-[11px] text-white/25 leading-relaxed">
                    Generates a branded 1080×1620 devotion image card — no plain text, only a beautiful visual.
                  </p>
                </div>

                <div className="px-6 pb-6 space-y-3">
                  {/* Primary share button */}
                  <button
                    onClick={() => handlePlatformShare("native")}
                    disabled={!!sharingPlatform}
                    className="w-full h-12 rounded-2xl flex items-center justify-center gap-2.5 text-sm font-semibold text-white transition-all disabled:opacity-60 active:scale-[0.98]"
                    style={{
                      background: "linear-gradient(135deg, rgba(251,191,36,0.22) 0%, rgba(245,158,11,0.14) 100%)",
                      border: "1px solid rgba(251,191,36,0.3)",
                      boxShadow: "0 4px 24px rgba(245,158,11,0.12)",
                    }}
                  >
                    {sharingPlatform === "native" ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImageDown className="h-4 w-4 text-amber-400" />
                    )}
                    {sharingPlatform === "native" ? "Generating card…" : "Share Devotion Image"}
                  </button>

                  {/* Platform row */}
                  <div className="grid grid-cols-3 gap-2.5">
                    {/* WhatsApp */}
                    <button
                      onClick={() => handlePlatformShare("whatsapp")}
                      disabled={!!sharingPlatform}
                      className="flex flex-col items-center gap-1.5 py-3.5 rounded-2xl transition-all disabled:opacity-50 active:scale-[0.96] hover:brightness-110"
                      style={{ background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.2)" }}
                    >
                      {sharingPlatform === "whatsapp" ? (
                        <RefreshCw className="h-5 w-5 text-green-400 animate-spin" />
                      ) : (
                        <span className="text-xl leading-none">💬</span>
                      )}
                      <span className="text-[10px] font-bold text-green-400 uppercase tracking-wide">WhatsApp</span>
                    </button>

                    {/* Instagram */}
                    <button
                      onClick={() => handlePlatformShare("instagram")}
                      disabled={!!sharingPlatform}
                      className="flex flex-col items-center gap-1.5 py-3.5 rounded-2xl transition-all disabled:opacity-50 active:scale-[0.96] hover:brightness-110"
                      style={{ background: "rgba(225,48,108,0.1)", border: "1px solid rgba(225,48,108,0.2)" }}
                    >
                      {sharingPlatform === "instagram" ? (
                        <RefreshCw className="h-5 w-5 text-pink-400 animate-spin" />
                      ) : (
                        <span className="text-xl leading-none">📷</span>
                      )}
                      <span className="text-[10px] font-bold text-pink-400 uppercase tracking-wide">Instagram</span>
                    </button>

                    {/* Facebook */}
                    <button
                      onClick={() => handlePlatformShare("facebook")}
                      disabled={!!sharingPlatform}
                      className="flex flex-col items-center gap-1.5 py-3.5 rounded-2xl transition-all disabled:opacity-50 active:scale-[0.96] hover:brightness-110"
                      style={{ background: "rgba(24,119,242,0.1)", border: "1px solid rgba(24,119,242,0.2)" }}
                    >
                      {sharingPlatform === "facebook" ? (
                        <RefreshCw className="h-5 w-5 text-blue-400 animate-spin" />
                      ) : (
                        <span className="text-xl leading-none">👍</span>
                      )}
                      <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wide">Facebook</span>
                    </button>
                  </div>

                  {/* Download only */}
                  <button
                    onClick={() => handlePlatformShare("download")}
                    disabled={!!sharingPlatform}
                    className="w-full h-10 rounded-2xl flex items-center justify-center gap-2 text-xs font-semibold text-white/40 hover:text-white/60 transition-all disabled:opacity-40 active:scale-[0.98]"
                    style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
                  >
                    {sharingPlatform === "download" ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    {sharingPlatform === "download" ? "Saving…" : "Download image only"}
                  </button>

                  <p className="text-center text-white/18 text-[10px] leading-relaxed pt-0.5">
                    On mobile, tap a platform button → image opens in native share sheet.{"\n"}On desktop, the image downloads to your folder — then upload it to the platform.
                  </p>
                </div>
              </div>

              {/* Related links */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                {[
                  { href: "/scripture-study", label: "📖 Study this scripture deeply", color: "from-sky-500/10 to-blue-600/5", border: "border-sky-500/15", text: "text-sky-300/70" },
                  { href: "/prayer", label: "🙏 Generate a prayer", color: "from-rose-500/10 to-pink-600/5", border: "border-rose-500/15", text: "text-rose-300/70" },
                ].map(link => (
                  <a
                    key={link.href}
                    href={link.href}
                    className={`rounded-2xl border ${link.border} bg-gradient-to-br ${link.color} p-4 flex items-center justify-between group hover:opacity-80 transition-opacity`}
                  >
                    <span className={`text-xs font-medium ${link.text}`}>{link.label}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-white/20 group-hover:text-white/40 transition-colors" />
                  </a>
                ))}
              </div>
            </motion.div>
          )}

          {/* Past Devotions Archive */}
          {history.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="mt-2"
              >
                <div className="flex items-center gap-2 mb-4">
                  <BookMarked className="h-4 w-4 text-white/30" />
                  <span className="text-xs font-semibold text-white/30 uppercase tracking-wider">Past Devotions</span>
                </div>
                <div className="space-y-3">
                  {history.map((past) => {
                    const isOpen = expandedHistory === past.date;
                    const pastDate = new Date(past.date + "T00:00:00Z");
                    const pastLabel = format(pastDate, "EEEE, MMMM d");
                    return (
                      <div
                        key={past.date}
                        className="rounded-2xl border border-white/6 overflow-hidden transition-all"
                        style={{ background: "rgba(255,255,255,0.02)" }}
                      >
                        <button
                          onClick={() => setExpandedHistory(isOpen ? null : past.date)}
                          className="w-full flex items-start justify-between gap-3 p-5 text-left hover:bg-white/3 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-semibold text-amber-400/40 uppercase tracking-wider mb-1">
                              {pastLabel}
                            </p>
                            <p className="text-white/70 text-sm font-medium leading-snug truncate">
                              {past.title}
                            </p>
                            <p className="text-white/30 text-xs mt-1">
                              {past.reference}
                            </p>
                          </div>
                          <ChevronRight
                            className={`h-4 w-4 text-white/20 shrink-0 mt-0.5 transition-transform ${isOpen ? "rotate-90" : ""}`}
                          />
                        </button>
                        <AnimatePresence>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25 }}
                              className="overflow-hidden"
                            >
                              <div className="px-5 pb-5 space-y-4 border-t border-white/5 pt-4">
                                <blockquote className="pl-3 border-l-2 border-amber-500/30">
                                  <p className="text-amber-100/60 text-sm italic leading-relaxed">
                                    "{past.scripture}"
                                  </p>
                                  <footer className="text-amber-400/40 text-xs mt-1 font-semibold">
                                    — {past.reference}
                                  </footer>
                                </blockquote>
                                <div className="space-y-2">
                                  {past.reflection.split(/\n+/).filter(Boolean).slice(0, 2).map((p, i) => (
                                    <p key={i} className="text-white/50 text-[13px] leading-relaxed">{p}</p>
                                  ))}
                                </div>
                                <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-4 py-3">
                                  <p className="text-[10px] font-semibold text-emerald-400/40 uppercase tracking-wider mb-1.5">Declaration</p>
                                  <p className="text-emerald-100/60 text-xs font-medium leading-relaxed italic">"{past.declaration}"</p>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

          <AdSlot slot={ADSENSE_SLOTS.devotionPage} minHeight={100} format="horizontal" className="mt-6" />
        </div>
      </div>
    </Layout>
  );
}

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, Share2, Copy, Check, RefreshCw, Flame, ChevronRight,
  Calendar, Mic2, Sparkles, Heart, Sun,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
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
  return (
    <div
      className={`animate-pulse rounded-lg bg-white/8 ${className}`}
    />
  );
}

function ReflectionBlock({ text }: { text: string }) {
  const paragraphs = text.split(/\n+/).filter(Boolean);
  return (
    <div className="space-y-4">
      {paragraphs.map((p, i) => (
        <p key={i} className="text-white/75 leading-relaxed text-[15px]">
          {p}
        </p>
      ))}
    </div>
  );
}

export default function Devotion() {
  const [devotion, setDevotion] = useState<DailyDevotion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [declarationMode, setDeclarationMode] = useState(false);
  const [currentWord, setCurrentWord] = useState(0);
  const [declarationWords, setDeclarationWords] = useState<string[]>([]);

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

  const handleCopy = async () => {
    if (!devotion) return;
    const text = `📖 ${devotion.title}\n\n${devotion.scripture} — ${devotion.reference}\n\n${devotion.reflection}\n\n✦ Prophetic Word:\n${devotion.propheticWord}\n\n🙏 Prayer: ${devotion.prayerFocus}\n\n📣 Declaration: ${devotion.declaration}\n\nFrom JCTM Daily Devotion`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Devotion copied to clipboard");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShare = async () => {
    if (!devotion) return;
    const text = `📖 *${devotion.title}* — ${devotion.reference}\n\n"${devotion.scripture}"\n\n${devotion.declaration}\n\n#JCTM #DailyDevotion`;
    if (navigator.share) {
      await navigator.share({ title: devotion.title, text }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(text);
      toast.success("Share text copied!");
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
        title="Daily Devotion | JCTM Digital Sanctuary"
        description="Start your day with prophetically-grounded scripture, reflection, and a prophetic word from JCTM Digital Sanctuary."
        keywords="JCTM daily devotion, Christian devotional, prophetic word today, scripture reflection"
      />

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

              {/* Action bar */}
              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={handleShare}
                  variant="outline"
                  className="flex-1 h-11 rounded-xl text-sm font-medium border-white/10 text-white/60 hover:text-white hover:border-white/20 bg-white/3 hover:bg-white/6 transition-all"
                >
                  <Share2 className="h-4 w-4 mr-2" /> Share
                </Button>
                <Button
                  onClick={handleCopy}
                  variant="outline"
                  className="flex-1 h-11 rounded-xl text-sm font-medium border-white/10 text-white/60 hover:text-white hover:border-white/20 bg-white/3 hover:bg-white/6 transition-all"
                >
                  {copied ? <Check className="h-4 w-4 mr-2 text-green-400" /> : <Copy className="h-4 w-4 mr-2" />}
                  {copied ? "Copied!" : "Copy All"}
                </Button>
                <Button
                  onClick={load}
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 rounded-xl border-white/10 text-white/40 hover:text-white hover:border-white/20 bg-white/3 hover:bg-white/6 transition-all shrink-0"
                  title="Reload"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
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
        </div>
      </div>
    </Layout>
  );
}

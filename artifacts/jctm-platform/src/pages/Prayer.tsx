import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SEO } from "@/components/SEO";
import {
  Heart, Sparkles, BookOpen, Copy, Check, RefreshCw,
  ChevronDown, Flame, Shield, Star, Sun, Users, Home as HomeIcon,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const CATEGORIES = [
  { value: "healing", label: "Healing & Health", icon: Heart, color: "rose" },
  { value: "deliverance", label: "Deliverance & Freedom", icon: Flame, color: "orange" },
  { value: "guidance", label: "Guidance & Direction", icon: Star, color: "amber" },
  { value: "peace", label: "Peace & Anxiety", icon: Sun, color: "sky" },
  { value: "provision", label: "Provision & Finance", icon: Sparkles, color: "emerald" },
  { value: "family", label: "Marriage & Family", icon: HomeIcon, color: "violet" },
  { value: "protection", label: "Protection & Safety", icon: Shield, color: "blue" },
  { value: "salvation", label: "Salvation & Intercession", icon: Users, color: "purple" },
  { value: "strength", label: "Strength & Perseverance", icon: BookOpen, color: "indigo" },
  { value: "general", label: "General Prayer", icon: Heart, color: "slate" },
];

const EXAMPLE_NEEDS = [
  "I am struggling with anxiety and fear about my future",
  "I need healing from a chronic illness that doctors say is incurable",
  "My marriage is going through a very difficult season",
  "I need God's direction for a major life decision",
  "I am interceding for my unsaved family members",
  "I need financial breakthrough and provision for my family",
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 80, damping: 18 } },
};

export default function Prayer() {
  const [need, setNeed] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("general");
  const [isGenerating, setIsGenerating] = useState(false);
  const [prayer, setPrayer] = useState("");
  const [isDone, setIsDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const prayerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prayer && prayerRef.current) {
      prayerRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [prayer]);

  const generate = useCallback(async () => {
    if (!need.trim()) {
      toast.error("Please describe your prayer need first.");
      return;
    }
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    setIsGenerating(true);
    setPrayer("");
    setIsDone(false);

    try {
      const res = await fetch(`${BASE}/api/prayer/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ need: need.trim(), category, name: name.trim() }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error("Failed to connect to prayer service.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") { setIsDone(true); break; }
          try {
            const parsed = JSON.parse(data);
            if (parsed.token) setPrayer(p => p + parsed.token);
            if (parsed.error) throw new Error(parsed.error);
          } catch {}
        }
      }
      setIsDone(true);
    } catch (err: unknown) {
      if ((err as Error).name !== "AbortError") {
        toast.error("The prayer service is temporarily unavailable. Please try again.");
      }
    } finally {
      setIsGenerating(false);
    }
  }, [need, category, name]);

  const copyPrayer = useCallback(async () => {
    if (!prayer) return;
    await navigator.clipboard.writeText(prayer);
    setCopied(true);
    toast.success("Prayer copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  }, [prayer]);

  const reset = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setPrayer("");
    setIsDone(false);
    setIsGenerating(false);
    setNeed("");
    setName("");
    setCategory("general");
  }, []);

  const selectedCat = CATEGORIES.find(c => c.value === category) ?? CATEGORIES[CATEGORIES.length - 1]!;

  return (
    <Layout>
      <SEO
        title="Prayer Room — JCTM Digital Sanctuary"
        description="Enter the JCTM Prayer Room — a space for intercession, prophetic prayers, and communion with God. Powered by TempleBots AI and the ministry of Jesus Christ Temple Ministry."
        path="/prayer"
        keywords="JCTM prayer, Jesus Christ Temple Ministry prayer, prayer requests Nigeria, intercession JCTM, TempleBots prayer, AI prayer generator Nigeria, healing prayer, deliverance prayer Nigeria, online prayer ministry"
        breadcrumbs={[
          { name: "Home", url: "https://jctm.org.ng/" },
          { name: "Prayer Room", url: "https://jctm.org.ng/prayer" },
        ]}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "name": "JCTM Prayer Room — TempleBots AI Prayer Generator",
            "description": "AI-powered prayer generator by Jesus Christ Temple Ministry. Generate personalized prayers for healing, deliverance, guidance, peace, provision, family, salvation, and more — grounded in scripture and JCTM doctrine.",
            "url": "https://jctm.org.ng/prayer",
            "applicationCategory": "ReligiousApplication",
            "operatingSystem": "Web",
            "browserRequirements": "Requires JavaScript",
            "author": {
              "@type": "ReligiousOrganization",
              "name": "Jesus Christ Temple Ministry (JCTM)",
              "url": "https://jctm.org.ng"
            },
            "featureList": [
              "Healing Prayer",
              "Deliverance Prayer",
              "Prayer for Guidance",
              "Prayer for Peace",
              "Prayer for Provision",
              "Prayer for Family",
              "Prayer for Protection",
              "Prayer for Salvation",
              "Prayer for Strength"
            ]
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
              {
                "@type": "Question",
                "name": "How do I generate a prayer on JCTM?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Visit jctm.org.ng/prayer and select a prayer category (healing, deliverance, guidance, peace, provision, family, protection, salvation, or strength). Click 'Generate Prayer' and TempleBots AI will stream a personalized, scripture-based prayer grounded in JCTM doctrine. You can copy the prayer to your clipboard when done."
                }
              }
            ]
          }
        ]}
      />
      <div className="min-h-screen bg-background">
        <div className="relative overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(56,189,248,0.12) 0%, transparent 70%)",
            }}
          />
          <div className="container mx-auto px-4 pt-16 pb-8 max-w-3xl relative">
            <motion.div
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
              initial="hidden"
              animate="show"
              className="text-center space-y-4 mb-12"
            >
              <motion.div variants={fadeUp} className="flex justify-center">
                <span
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide border"
                  style={{
                    background: "rgba(56,189,248,0.08)",
                    borderColor: "rgba(56,189,248,0.25)",
                    color: "hsl(var(--accent))",
                  }}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  AI Prayer Generator · JCTM Digital Sanctuary
                </span>
              </motion.div>

              <motion.h1
                variants={fadeUp}
                className="text-4xl sm:text-5xl font-serif font-bold text-primary leading-tight"
              >
                Bring Your Need{" "}
                <span
                  className="animate-gradient-text"
                  style={{
                    background: "linear-gradient(90deg, hsl(var(--accent)), hsl(var(--primary)), hsl(var(--accent)))",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  Before God
                </span>
              </motion.h1>

              <motion.p variants={fadeUp} className="text-muted-foreground text-lg max-w-xl mx-auto leading-relaxed">
                Receive a personalized, scriptural prayer rooted in the Word of God — crafted specifically for your situation.
              </motion.p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 70 }}
              className="glass-panel rounded-3xl p-6 sm:p-8 space-y-6 mb-8"
            >
              <div>
                <label className="text-sm font-semibold text-primary mb-3 block">
                  Prayer Category
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    const isSelected = category === cat.value;
                    return (
                      <motion.button
                        key={cat.value}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setCategory(cat.value)}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all cursor-pointer text-left"
                        style={{
                          background: isSelected ? "rgba(56,189,248,0.12)" : "transparent",
                          borderColor: isSelected ? "rgba(56,189,248,0.4)" : "rgba(0,51,102,0.12)",
                          color: isSelected ? "hsl(var(--accent))" : "hsl(var(--muted-foreground))",
                        }}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="text-xs leading-tight">{cat.label}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-primary mb-2 block" htmlFor="prayer-name">
                  Your Name <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <input
                  id="prayer-name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Emmanuel, Sister Grace…"
                  className="w-full px-4 py-3 rounded-xl border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all"
                  style={{ borderColor: "rgba(0,51,102,0.15)" }}
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-primary mb-2 block" htmlFor="prayer-need">
                  Describe Your Prayer Need <span className="text-destructive">*</span>
                </label>
                <textarea
                  id="prayer-need"
                  value={need}
                  onChange={e => setNeed(e.target.value)}
                  placeholder="Share what is on your heart. Be as specific as you wish — God hears every detail…"
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 resize-none transition-all"
                  style={{ borderColor: "rgba(0,51,102,0.15)" }}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {EXAMPLE_NEEDS.slice(0, 3).map((ex) => (
                    <button
                      key={ex}
                      onClick={() => setNeed(ex)}
                      className="text-xs px-2.5 py-1 rounded-full border text-muted-foreground hover:text-accent hover:border-accent/40 transition-colors cursor-pointer"
                      style={{ borderColor: "rgba(0,51,102,0.12)" }}
                    >
                      {ex.length > 40 ? ex.slice(0, 40) + "…" : ex}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <motion.div className="flex-1" whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                  <Button
                    onClick={generate}
                    disabled={isGenerating || !need.trim()}
                    className="w-full h-12 text-base font-bold rounded-xl relative overflow-hidden"
                    style={{
                      background: isGenerating
                        ? "rgba(56,189,248,0.3)"
                        : "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%)",
                      color: "white",
                      border: "none",
                    }}
                  >
                    <AnimatePresence mode="wait">
                      {isGenerating ? (
                        <motion.span
                          key="generating"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex items-center gap-2"
                        >
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                          >
                            <Sparkles className="h-4 w-4" />
                          </motion.div>
                          Generating Your Prayer…
                        </motion.span>
                      ) : (
                        <motion.span
                          key="generate"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex items-center gap-2"
                        >
                          <Heart className="h-4 w-4" />
                          Generate My Prayer
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </Button>
                </motion.div>

                {(prayer || isGenerating) && (
                  <Button
                    onClick={reset}
                    variant="outline"
                    className="h-12 px-4 rounded-xl"
                    title="Start over"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </motion.div>

            <AnimatePresence>
              {(prayer || isGenerating) && (
                <motion.div
                  ref={prayerRef}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ type: "spring", stiffness: 70 }}
                  className="relative"
                >
                  <div
                    className="rounded-3xl p-6 sm:p-10 relative overflow-hidden"
                    style={{
                      background: "linear-gradient(145deg, rgba(0,51,102,0.96) 0%, rgba(0,26,77,0.99) 100%)",
                      boxShadow: "0 20px 60px rgba(0,51,102,0.3), 0 0 80px rgba(56,189,248,0.06)",
                    }}
                  >
                    <div
                      className="absolute inset-0 pointer-events-none opacity-30"
                      style={{
                        background: "radial-gradient(ellipse 60% 40% at 80% 20%, rgba(56,189,248,0.15), transparent)",
                      }}
                    />

                    <div className="relative">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: "rgba(56,189,248,0.15)" }}>
                            <selectedCat.icon className="h-4 w-4 text-accent" />
                          </div>
                          <div>
                            <p className="text-xs text-accent/70 font-medium tracking-wide uppercase">Personalized Prayer</p>
                            <p className="text-xs text-white/50">{selectedCat.label}</p>
                          </div>
                        </div>
                        {isDone && prayer && (
                          <motion.button
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            onClick={copyPrayer}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                            style={{
                              background: copied ? "rgba(34,197,94,0.2)" : "rgba(56,189,248,0.15)",
                              color: copied ? "#86efac" : "hsl(var(--accent))",
                              border: `1px solid ${copied ? "rgba(34,197,94,0.3)" : "rgba(56,189,248,0.25)"}`,
                            }}
                          >
                            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            {copied ? "Copied!" : "Copy"}
                          </motion.button>
                        )}
                      </div>

                      {prayer ? (
                        <div className="text-white/90 text-[15px] leading-[1.9] font-light whitespace-pre-wrap">
                          {prayer}
                          {isGenerating && (
                            <span className="inline-block w-0.5 h-4 bg-accent ml-0.5 align-middle animate-[blink_1s_step-end_infinite]" />
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {[80, 95, 70, 85, 60].map((w, i) => (
                            <div
                              key={i}
                              className="h-4 rounded-full animate-pulse"
                              style={{ width: `${w}%`, background: "rgba(255,255,255,0.08)" }}
                            />
                          ))}
                        </div>
                      )}

                      {isDone && prayer && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.5 }}
                          className="mt-8 pt-6 border-t flex items-center justify-between"
                          style={{ borderColor: "rgba(56,189,248,0.15)" }}
                        >
                          <p className="text-xs text-white/40">
                            Generated by JCTM AI Prayer Ministry · rooted in Scripture
                          </p>
                          <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={generate}
                            className="text-xs text-accent/70 hover:text-accent flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <RefreshCw className="h-3 w-3" />
                            Regenerate
                          </motion.button>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center"
            >
              {[
                { icon: BookOpen, title: "Scripture-Rooted", desc: "Every prayer is grounded in KJV/NKJV Bible verses" },
                { icon: Shield, title: "Sound Doctrine", desc: "No prosperity formulas — genuine apostolic faith" },
                { icon: Heart, title: "Deeply Personal", desc: "Written for your exact situation and need" },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="glass-panel rounded-2xl p-5 space-y-2">
                  <div className="h-9 w-9 rounded-full mx-auto flex items-center justify-center" style={{ background: "rgba(56,189,248,0.1)" }}>
                    <Icon className="h-4 w-4 text-accent" />
                  </div>
                  <p className="font-semibold text-primary text-sm">{title}</p>
                  <p className="text-muted-foreground text-xs leading-relaxed">{desc}</p>
                </div>
              ))}
            </motion.div>

            <div className="mt-8 pb-16 text-center">
              <p className="text-xs text-muted-foreground/60 max-w-md mx-auto">
                "The effectual fervent prayer of a righteous man availeth much." — James 5:16 (KJV)
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

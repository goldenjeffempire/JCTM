import { useState, useRef, useCallback, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { T } from "@/components/T";
import { motion, AnimatePresence } from "framer-motion";
import { SEO } from "@/components/SEO";
import {
  Heart, Sparkles, BookOpen, Copy, Check, RefreshCw,
  Flame, Shield, Star, Sun, Users, Home as HomeIcon,
  Send, MessageSquarePlus, Clock, Share2,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { AdSlot, ADSENSE_SLOTS, useAdPageTracker } from "@/components/ads/AdSense";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { getOrCreateVisitorId } from "@/lib/visitorId";
import { safeLocalGet, safeLocalSet } from "@/lib/utils";

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

const CAT_LABEL: Record<string, string> = {
  healing: "Healing",
  deliverance: "Deliverance",
  guidance: "Guidance",
  peace: "Peace",
  provision: "Provision",
  family: "Family",
  protection: "Protection",
  salvation: "Salvation",
  strength: "Strength",
  general: "General",
};

interface PrayerRequest {
  id: number;
  name: string;
  category: string;
  request: string;
  pray_count: number;
  created_at: string;
}

function PrayerWall() {
  const { t } = useLanguage();
  const [requests, setRequests] = useState<PrayerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [prayedFor, setPrayedFor] = useState<Set<number>>(() => {
    try {
      const stored = safeLocalGet("jctm_prayed_for");
      return stored ? new Set(JSON.parse(stored)) : new Set<number>();
    } catch { return new Set<number>(); }
  });
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", category: "general", request: "" });

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/prayer/requests`);
      if (res.ok) setRequests(await res.json());
    } catch (err) {
      console.warn("Prayer wall: failed to load requests", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const pray = async (id: number) => {
    if (prayedFor.has(id)) return;
    const newSet = new Set([...prayedFor, id]);
    setPrayedFor(newSet);
    safeLocalSet("jctm_prayed_for", JSON.stringify([...newSet]));
    setRequests(prev => prev.map(r => r.id === id ? { ...r, pray_count: r.pray_count + 1 } : r));
    try {
      await fetch(`${BASE}/api/prayer/requests/${id}/pray`, { method: "POST" });
    } catch {}
    toast.success("🙏 You prayed for this need!");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.request.trim()) {
      toast.error("Please describe your prayer need.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE}/api/prayer/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, visitorId: getOrCreateVisitorId() }),
      });
      if (!res.ok) throw new Error();
      const newReq: PrayerRequest = await res.json();
      setRequests(prev => [newReq, ...prev]);
      setForm({ name: "", category: "general", request: "" });
      setShowForm(false);
      toast.success("Your prayer request has been shared with the community.");
    } catch {
      toast.error("Could not submit your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ type: "spring", stiffness: 70 }}
      >
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-serif font-bold text-primary"><T>Community Prayer Wall</T></h2>
            <p className="text-sm text-muted-foreground mt-1">Pray for your brothers and sisters in Christ</p>
          </div>
          <Button
            onClick={() => setShowForm(s => !s)}
            size="sm"
            className="rounded-full font-semibold flex items-center gap-2"
            style={{ background: showForm ? "hsl(var(--muted))" : "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%)", color: showForm ? "hsl(var(--foreground))" : "white", border: "none" }}
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            {showForm ? "Cancel" : "Add Prayer Request"}
          </Button>
        </div>

        {/* Submission form */}
        <AnimatePresence>
          {showForm && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={submit}
              className="glass-panel rounded-2xl p-5 mb-6 space-y-4 overflow-hidden"
            >
              <h3 className="font-semibold text-primary text-sm">Share Your Prayer Need</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="prayer-name" className="text-xs font-medium text-muted-foreground block mb-1">Your Name (optional)</label>
                  <input
                    id="prayer-name"
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Anonymous"
                    className="w-full px-3 py-2 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                    style={{ borderColor: "rgba(0,51,102,0.15)" }}
                  />
                </div>
                <div>
                  <label htmlFor="prayer-category" className="text-xs font-medium text-muted-foreground block mb-1">Category</label>
                  <select
                    id="prayer-category"
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                    style={{ borderColor: "rgba(0,51,102,0.15)" }}
                  >
                    {CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="prayer-request" className="text-xs font-medium text-muted-foreground block mb-1">Your Prayer Need *</label>
                <textarea
                  id="prayer-request"
                  value={form.request}
                  onChange={e => setForm(f => ({ ...f, request: e.target.value.slice(0, 500) }))}
                  placeholder="Share what is on your heart…"
                  rows={3}
                  aria-required="true"
                  className="w-full px-3 py-2 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 resize-none"
                  style={{ borderColor: "rgba(0,51,102,0.15)" }}
                />
                <p className="text-xs text-muted-foreground/60 mt-1 text-right">{form.request.length}/500</p>
              </div>
              <Button
                type="submit"
                disabled={submitting || !form.request.trim()}
                className="w-full h-10 rounded-xl font-semibold flex items-center gap-2"
                style={{ background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%)", color: "white", border: "none" }}
              >
                {submitting ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                    <Sparkles className="h-4 w-4" />
                  </motion.div>
                ) : <Send className="h-4 w-4" />}
                {submitting ? "Submitting…" : "Share to Prayer Wall"}
              </Button>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Prayer requests list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="glass-panel rounded-2xl p-5 animate-pulse">
                <div className="flex justify-between mb-3">
                  <div className="h-3.5 bg-muted rounded w-24" />
                  <div className="h-3.5 bg-muted rounded w-16" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded w-full" />
                  <div className="h-3 bg-muted rounded w-4/5" />
                </div>
              </div>
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-12 glass-panel rounded-2xl">
            <Heart className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground text-sm">No prayer requests yet.</p>
            <p className="text-muted-foreground/60 text-xs mt-1">Be the first to share your need with the community.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req, i) => (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04, type: "spring", stiffness: 80 }}
                className="glass-panel rounded-2xl p-5"
              >
                <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))" }}
                    >
                      {req.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-primary">{req.name}</span>
                      <span className="mx-1.5 text-muted-foreground/40">·</span>
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border"
                        style={{ background: "rgba(56,189,248,0.07)", borderColor: "rgba(56,189,248,0.2)", color: "hsl(var(--accent))" }}
                      >
                        {CAT_LABEL[req.category] ?? req.category}
                      </span>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                    <Clock className="h-2.5 w-2.5" />
                    {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
                  </span>
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed mb-3">{req.request}</p>

                <motion.button
                  whileTap={{ scale: 0.93 }}
                  onClick={() => pray(req.id)}
                  disabled={prayedFor.has(req.id)}
                  className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all"
                  style={{
                    background: prayedFor.has(req.id) ? "rgba(56,189,248,0.12)" : "transparent",
                    borderColor: prayedFor.has(req.id) ? "rgba(56,189,248,0.3)" : "rgba(0,51,102,0.15)",
                    color: prayedFor.has(req.id) ? "hsl(var(--accent))" : "hsl(var(--muted-foreground))",
                    cursor: prayedFor.has(req.id) ? "default" : "pointer",
                  }}
                >
                  🙏 {prayedFor.has(req.id) ? "Prayed" : "Pray"} · {req.pray_count}
                </motion.button>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default function Prayer() {
  useAdPageTracker("/prayer", 1);
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

  const shareOnWhatsApp = useCallback(() => {
    if (!prayer) return;
    const text = encodeURIComponent(
      "🙏 " + prayer + "\n\n— Powered by JCTM AI Prayer Ministry · jctm.org.ng/prayer",
    );
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener");
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
                          <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex items-center gap-2"
                          >
                            <button
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
                            </button>
                            <button
                              onClick={shareOnWhatsApp}
                              title="Share on WhatsApp"
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer hover:opacity-80"
                              style={{
                                background: "rgba(37,211,102,0.15)",
                                color: "#25d366",
                                border: "1px solid rgba(37,211,102,0.3)",
                              }}
                            >
                              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current flex-shrink-0" aria-hidden>
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                              </svg>
                              Share
                            </button>
                          </motion.div>
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

            <div className="mt-8 pb-8 text-center">
              <p className="text-xs text-muted-foreground/60 max-w-md mx-auto">
                "The effective, fervent prayer of a righteous man avails much." — James 5:16 (NKJV)
              </p>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border/30 mx-auto max-w-3xl" />

        <AdSlot slot={ADSENSE_SLOTS.prayerPage} minHeight={100} format="horizontal" className="mx-auto max-w-3xl my-8" />

        {/* Community Prayer Wall */}
        <PrayerWall />

        <div className="pb-16" />
      </div>
    </Layout>
  );
}

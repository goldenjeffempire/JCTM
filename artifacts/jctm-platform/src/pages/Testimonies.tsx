import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { MessageSquare, Plus, X, ChevronRight, ChevronLeft, CheckCircle, Flame, LayoutGrid, Layers, Heart, Share2, Quote, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useListTestimonies, getListTestimoniesQueryKey } from "@workspace/api-client-react";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const CATEGORIES = ["Healing", "Deliverance", "Financial Breakthrough", "Marriage Restoration", "Salvation", "Other"];
type Step = 1 | 2 | 3;
type ViewMode = "grid" | "reel";

interface FormData {
  name: string; email: string; title: string; category: string; content: string; videoUrl: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  Healing: "from-emerald-400 to-teal-600",
  Deliverance: "from-purple-400 to-violet-600",
  "Financial Breakthrough": "from-amber-400 to-orange-500",
  "Marriage Restoration": "from-pink-400 to-rose-500",
  Salvation: "from-accent to-[#0284C7]",
  Other: "from-primary to-[#0052a3]",
};

const CATEGORY_EMOJI: Record<string, string> = {
  Healing: "🙏",
  Deliverance: "⚡",
  "Financial Breakthrough": "🌟",
  "Marriage Restoration": "💑",
  Salvation: "✝️",
  Other: "🔥",
};

function ReelCard({ testimony, index, likedIds, localLikes, onAmen }: {
  testimony: { id: number; name: string; title?: string | null; content: string; category?: string | null; likeCount: number; createdAt: string };
  index: number;
  likedIds: Set<number>;
  localLikes: Record<number, number>;
  onAmen: (id: number, count: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.5 });
  const cat = testimony.category ?? "Other";
  const grad = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS["Other"];
  const emoji = CATEGORY_EMOJI[cat] ?? "🔥";

  return (
    <div
      ref={ref}
      className="relative snap-start shrink-0 w-full h-[calc(100svh-8rem)] max-h-[680px] flex items-center justify-center"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0.6, scale: 0.96 }}
        transition={{ duration: 0.4, type: "spring", stiffness: 200, damping: 24 }}
        className="relative w-full max-w-sm h-full mx-auto rounded-3xl overflow-hidden shadow-2xl"
        style={{
          background: "linear-gradient(160deg, #001030 0%, #002858 40%, #001830 100%)",
          border: "1px solid rgba(56,189,248,0.12)",
        }}
      >
        {/* Gradient background orb */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 80% 60% at 50% 30%, rgba(56,189,248,0.12) 0%, transparent 70%)`,
          }}
        />

        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(56,189,248,0.8) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />

        {/* Category top bar */}
        <div className="absolute top-0 left-0 right-0 h-1" style={{ background: `linear-gradient(to right, ${grad.replace("from-", "").split(" ")[0]}, ${grad.replace("to-", "").split(" ").at(-1)})` }} />

        {/* Number */}
        <div className="absolute top-5 left-5">
          <span className="text-white/20 font-serif font-bold text-5xl leading-none select-none">
            {String(index + 1).padStart(2, "0")}
          </span>
        </div>

        {/* Category badge */}
        <div className="absolute top-5 right-5">
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full bg-gradient-to-r ${grad} text-white shadow-lg`}>
            {emoji} {cat}
          </span>
        </div>

        {/* Main content */}
        <div className="absolute inset-0 flex flex-col justify-end p-6 pt-20">
          {/* Quote icon */}
          <div className="mb-4">
            <Quote className="h-8 w-8 text-accent/40" />
          </div>

          {/* Title */}
          {testimony.title && (
            <h3 className="text-white font-serif font-bold text-lg leading-tight mb-3">
              {testimony.title}
            </h3>
          )}

          {/* Content */}
          <p className="text-white/75 text-sm leading-relaxed mb-6 line-clamp-6">
            "{testimony.content}"
          </p>

          {/* Author + actions */}
          <div className="flex items-end justify-between">
            <div>
              <p className="text-white font-semibold text-sm">{testimony.name}</p>
              <p className="text-white/40 text-xs">
                {formatDistanceToNow(new Date(testimony.createdAt), { addSuffix: true })}
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-3 items-center">
              <motion.button
                onClick={() => onAmen(testimony.id, testimony.likeCount)}
                disabled={likedIds.has(testimony.id)}
                whileTap={{ scale: 0.85 }}
                className="flex flex-col items-center gap-0.5"
              >
                <div className={`h-11 w-11 rounded-full flex items-center justify-center shadow-lg transition-all ${likedIds.has(testimony.id) ? "bg-red-500 shadow-red-500/40" : "bg-white/10 border border-white/20 hover:bg-red-500/20"}`}>
                  <Flame className={`h-5 w-5 ${likedIds.has(testimony.id) ? "text-white fill-white" : "text-white/70"}`} />
                </div>
                <span className="text-white/60 text-[10px] font-medium">
                  {(localLikes[testimony.id] ?? testimony.likeCount)}
                </span>
              </motion.button>

              <motion.button whileTap={{ scale: 0.85 }} className="flex flex-col items-center gap-0.5">
                <div className="h-11 w-11 rounded-full bg-white/10 border border-white/20 flex items-center justify-center shadow-lg hover:bg-white/20 transition-all">
                  <Sparkles className="h-5 w-5 text-accent/80" />
                </div>
                <span className="text-white/60 text-[10px] font-medium">Amen</span>
              </motion.button>
            </div>
          </div>

          {/* Scroll hint */}
          {index === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
              className="absolute bottom-2 left-1/2 -translate-x-1/2 text-white/30 text-[10px] flex flex-col items-center gap-1"
            >
              <motion.div animate={{ y: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 1.2 }}>↕</motion.div>
              <span>Scroll for more miracles</span>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function Testimonies() {
  const [showForm, setShowForm] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormData>({ name: "", email: "", title: "", category: "", content: "", videoUrl: "" });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());
  const [localLikes, setLocalLikes] = useState<Record<number, number>>({});
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const queryClient = useQueryClient();
  const { data: testimonies, isLoading } = useListTestimonies({ limit: 30, offset: 0 }, { query: { queryKey: getListTestimoniesQueryKey() } });

  useEffect(() => { document.title = "Testimony Vault | JCTM Digital Sanctuary"; }, []);

  const filtered = activeCategory ? (testimonies ?? []).filter(t => t.category === activeCategory) : (testimonies ?? []);
  const updateForm = (field: keyof FormData, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const handleNext = () => {
    if (step === 1 && (!form.name || !form.category)) return;
    if (step === 2 && !form.content) return;
    setStep(prev => (prev < 3 ? (prev + 1) as Step : prev));
  };
  const handleBack = () => setStep(prev => (prev > 1 ? (prev - 1) as Step : prev));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.content) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE}/api/testimonies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email || undefined, title: form.title || undefined, category: form.category || undefined, content: form.content, videoUrl: form.videoUrl || undefined }),
      });
      if (res.ok) {
        setSubmitted(true);
        setShowForm(false);
        setStep(1);
        setForm({ name: "", email: "", title: "", category: "", content: "", videoUrl: "" });
        queryClient.invalidateQueries({ queryKey: getListTestimoniesQueryKey() });
        toast.success("Testimony Submitted Successfully", {
          description: "Your miracle story is pending review and will be published shortly.",
        });
      }
    } finally { setSubmitting(false); }
  };

  const handleAmen = async (id: number, currentCount: number) => {
    if (likedIds.has(id)) return;
    setLikedIds(prev => new Set([...prev, id]));
    setLocalLikes(prev => ({ ...prev, [id]: (prev[id] ?? currentCount) + 1 }));
    try { await fetch(`${BASE}/api/testimonies/${id}/like`, { method: "POST" }); }
    catch { setLikedIds(prev => { const n = new Set(prev); n.delete(id); return n; }); setLocalLikes(prev => ({ ...prev, [id]: currentCount })); }
  };

  return (
    <Layout>
      <SEO
        title="Testimonies — JCTM Digital Sanctuary"
        description="Read powerful testimonies of healing, transformation, and restoration through Jesus Christ Temple Ministry (JCTM). Share your own testimony and glorify God through the Correction Mandate."
        path="/testimonies"
        keywords="JCTM testimonies, Jesus Christ Temple Ministry miracles, healing testimonies Nigeria, church testimonies Warri, transformation stories, deliverance testimonies, Nigeria church miracles, Correction Mandate testimonies"
        breadcrumbs={[
          { name: "Home", url: "https://jctm.org.ng/" },
          { name: "Testimonies", url: "https://jctm.org.ng/testimonies" },
        ]}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": "JCTM Testimony Vault — Miracles & Transformations",
            "description": "A collection of testimonies of healing, restoration, deliverance, and transformation from members of Jesus Christ Temple Ministry (JCTM) and believers reached by the Correction Mandate.",
            "url": "https://jctm.org.ng/testimonies",
            "about": {
              "@type": "ReligiousOrganization",
              "name": "Jesus Christ Temple Ministry (JCTM)",
              "url": "https://jctm.org.ng"
            },
            "inLanguage": "en-NG"
          }
        ]}
      />
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary mb-3">Testimony Vault</h1>
            <p className="text-muted-foreground text-lg">What God is doing through the Correction Mandate — {(testimonies ?? []).length} miracles recorded.</p>
          </div>
          <div className="flex items-center gap-3">
            {/* View toggle */}
            <div className="flex items-center bg-secondary/60 rounded-full p-1 border border-border">
              <button
                onClick={() => setViewMode("grid")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${viewMode === "grid" ? "bg-white shadow text-primary" : "text-muted-foreground hover:text-primary"}`}
              >
                <LayoutGrid className="h-3 w-3" /> Grid
              </button>
              <button
                onClick={() => setViewMode("reel")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${viewMode === "reel" ? "bg-white shadow text-primary" : "text-muted-foreground hover:text-primary"}`}
              >
                <Layers className="h-3 w-3" /> Reel
              </button>
            </div>
            <Button onClick={() => { setShowForm(!showForm); setStep(1); }}
              className="bg-accent text-white hover:bg-accent/90 flex items-center gap-2 rounded-full px-6 shrink-0">
              {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {showForm ? "Close" : "Share Your Miracle"}
            </Button>
          </div>
        </motion.div>

        {submitted && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="glass-panel border border-accent/30 rounded-2xl p-6 mb-8 text-center max-w-md mx-auto">
            <CheckCircle className="h-10 w-10 text-accent mx-auto mb-3" />
            <h3 className="font-semibold text-primary text-lg mb-1">Testimony Received!</h3>
            <p className="text-muted-foreground text-sm">Your miracle story is pending review and will be published shortly.</p>
            <Button variant="ghost" size="sm" onClick={() => setSubmitted(false)} className="mt-3 text-muted-foreground">Dismiss</Button>
          </motion.div>
        )}

        {/* Submission Form */}
        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-10">
              <div className="glass-panel rounded-2xl p-8 border border-accent/20 max-w-2xl mx-auto">
                <div className="flex items-center gap-2 mb-6">
                  {([1, 2, 3] as Step[]).map(s => (
                    <div key={s} className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${step >= s ? "bg-accent text-white" : "bg-muted text-muted-foreground"}`}>
                        {step > s ? "✓" : s}
                      </div>
                      {s < 3 && <div className={`h-0.5 w-10 transition-colors ${step > s ? "bg-accent" : "bg-muted"}`} />}
                    </div>
                  ))}
                  <span className="ml-auto text-sm text-muted-foreground">{step === 1 ? "Identity" : step === 2 ? "Your Testimony" : "Review"}</span>
                </div>
                <form onSubmit={handleSubmit}>
                  {step === 1 && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                      <h2 className="text-lg font-semibold text-primary mb-2">Step 1: About You</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="text-sm font-medium text-primary mb-1.5 block">Full Name *</label><Input value={form.name} onChange={e => updateForm("name", e.target.value)} placeholder="Your full name" required className="bg-white" /></div>
                        <div><label className="text-sm font-medium text-primary mb-1.5 block">Email (optional)</label><Input type="email" value={form.email} onChange={e => updateForm("email", e.target.value)} placeholder="your@email.com" className="bg-white" /></div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-primary mb-2 block">Category *</label>
                        <div className="flex flex-wrap gap-2">
                          {CATEGORIES.map(cat => (
                            <button key={cat} type="button" onClick={() => updateForm("category", form.category === cat ? "" : cat)}
                              className={`text-xs px-4 py-2 rounded-full border transition-colors ${form.category === cat ? "bg-accent text-white border-accent" : "border-border text-muted-foreground hover:border-accent hover:text-accent"}`}>
                              {CATEGORY_EMOJI[cat] ?? ""} {cat}
                            </button>
                          ))}
                        </div>
                      </div>
                      <Button type="button" onClick={handleNext} disabled={!form.name || !form.category}
                        className="w-full bg-accent text-white hover:bg-accent/90 rounded-full h-11 flex items-center justify-center gap-2">
                        Continue <ChevronRight className="h-4 w-4" />
                      </Button>
                    </motion.div>
                  )}
                  {step === 2 && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                      <h2 className="text-lg font-semibold text-primary mb-2">Step 2: Your Miracle</h2>
                      <div><label className="text-sm font-medium text-primary mb-1.5 block">Testimony Title</label><Input value={form.title} onChange={e => updateForm("title", e.target.value)} placeholder="e.g. God healed my cancer in one night" className="bg-white" /></div>
                      <div>
                        <label className="text-sm font-medium text-primary mb-1.5 block">Share What God Did *</label>
                        <Textarea value={form.content} onChange={e => updateForm("content", e.target.value)} placeholder="Tell the body of Christ what God has done for you..." className="bg-white min-h-36 resize-none" required />
                        <p className="text-xs text-muted-foreground mt-1">{form.content.length} characters</p>
                      </div>
                      <div><label className="text-sm font-medium text-primary mb-1.5 block">Video URL (optional)</label><Input value={form.videoUrl} onChange={e => updateForm("videoUrl", e.target.value)} placeholder="YouTube link if you recorded your testimony" className="bg-white" /></div>
                      <div className="flex gap-3">
                        <Button type="button" variant="outline" onClick={handleBack} className="flex-1 rounded-full h-11 flex items-center justify-center gap-2"><ChevronLeft className="h-4 w-4" /> Back</Button>
                        <Button type="button" onClick={handleNext} disabled={!form.content} className="flex-1 bg-accent text-white hover:bg-accent/90 rounded-full h-11 flex items-center justify-center gap-2">Preview <ChevronRight className="h-4 w-4" /></Button>
                      </div>
                    </motion.div>
                  )}
                  {step === 3 && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                      <h2 className="text-lg font-semibold text-primary mb-2">Step 3: Review & Submit</h2>
                      <div className="glass-panel rounded-xl p-5 border border-border space-y-3">
                        {form.category && <span className="inline-block text-xs font-medium text-accent border border-accent/30 rounded-full px-3 py-0.5">{form.category}</span>}
                        {form.title && <p className="font-semibold text-primary">{form.title}</p>}
                        <p className="text-muted-foreground text-sm leading-relaxed">"{form.content}"</p>
                        <div className="border-t border-border pt-3">
                          <p className="font-medium text-primary text-sm">{form.name}</p>
                          {form.email && <p className="text-xs text-muted-foreground">{form.email}</p>}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground text-center">Your testimony will be reviewed before publication.</p>
                      <div className="flex gap-3">
                        <Button type="button" variant="outline" onClick={handleBack} className="flex-1 rounded-full h-11 flex items-center justify-center gap-2"><ChevronLeft className="h-4 w-4" /> Edit</Button>
                        <Button type="submit" disabled={submitting} className="flex-1 bg-accent text-white hover:bg-accent/90 rounded-full h-11 font-semibold shadow-lg shadow-accent/20">
                          {submitting ? "Submitting..." : "Submit Testimony"}
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* REEL VIEW */}
        <AnimatePresence mode="wait">
          {viewMode === "reel" ? (
            <motion.div
              key="reel"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-serif font-bold text-primary">Miracle Reel</h2>
                  <p className="text-muted-foreground text-sm">Scroll to experience each testimony</p>
                </div>
                <div className="flex items-center gap-1.5 bg-primary/5 border border-primary/10 rounded-full px-3 py-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                  <span className="text-xs text-muted-foreground font-medium">{filtered.length} Miracles</span>
                </div>
              </div>

              {isLoading ? (
                <div className="h-[600px] flex items-center justify-center">
                  <div className="text-center">
                    <div className="h-12 w-12 rounded-full border-4 border-accent/30 border-t-accent animate-spin mx-auto mb-4" />
                    <p className="text-muted-foreground text-sm">Loading miracles...</p>
                  </div>
                </div>
              ) : filtered.length === 0 ? (
                <div className="h-[600px] flex items-center justify-center">
                  <div className="text-center">
                    <MessageSquare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground">No testimonies yet. Be the first to share your miracle!</p>
                  </div>
                </div>
              ) : (
                <div
                  className="overflow-y-auto snap-y snap-mandatory"
                  style={{ height: "calc(100svh - 16rem)", maxHeight: 700 }}
                >
                  {filtered.map((testimony, i) => (
                    <ReelCard
                      key={testimony.id}
                      testimony={testimony}
                      index={i}
                      likedIds={likedIds}
                      localLikes={localLikes}
                      onAmen={handleAmen}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Category filter */}
              <div className="flex flex-wrap gap-2 mb-8">
                <button onClick={() => setActiveCategory(null)}
                  className={`text-xs px-4 py-2 rounded-full border transition-colors ${!activeCategory ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary hover:text-primary"}`}>
                  All ({(testimonies ?? []).length})
                </button>
                {CATEGORIES.map(cat => {
                  const catCount = (testimonies ?? []).filter(t => t.category === cat).length;
                  if (catCount === 0) return null;
                  return (
                    <button key={cat} onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                      className={`text-xs px-4 py-2 rounded-full border transition-colors ${activeCategory === cat ? "bg-accent text-white border-accent" : "border-border text-muted-foreground hover:border-accent hover:text-accent"}`}>
                      {CATEGORY_EMOJI[cat]} {cat} ({catCount})
                    </button>
                  );
                })}
              </div>

              {isLoading ? (
                <div className="columns-1 md:columns-2 lg:columns-3 gap-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="glass-panel rounded-2xl p-6 animate-pulse break-inside-avoid mb-6">
                      <div className="h-4 bg-muted rounded w-1/3 mb-3" /><div className="h-3 bg-muted rounded mb-2" /><div className="h-3 bg-muted rounded mb-2" /><div className="h-3 bg-muted rounded w-3/4" />
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-20">
                  <MessageSquare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground">No testimonies yet. Be the first to share your miracle!</p>
                </div>
              ) : (
                <div className="columns-1 md:columns-2 lg:columns-3 gap-6">
                  {filtered.map((testimony, i) => {
                    const cat = testimony.category ?? "Other";
                    const grad = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS["Other"];
                    return (
                      <motion.div key={testimony.id} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: i * 0.04 }}
                        className="group glass-panel rounded-2xl p-6 flex flex-col gap-3 hover:shadow-xl transition-all duration-300 break-inside-avoid mb-6 border border-border hover:border-accent/20 relative overflow-hidden">
                        <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${grad} opacity-0 group-hover:opacity-100 transition-opacity`} />
                        {cat && (
                          <span className={`inline-flex items-center gap-1 text-xs font-medium bg-gradient-to-r ${grad} text-white rounded-full px-3 py-0.5 w-fit shadow-sm`}>
                            {CATEGORY_EMOJI[cat]} {cat}
                          </span>
                        )}
                        {testimony.title && <h3 className="font-semibold text-primary text-sm leading-snug">{testimony.title}</h3>}
                        <p className="text-muted-foreground text-sm leading-relaxed">"{testimony.content}"</p>
                        <div className="mt-auto pt-3 border-t border-border flex items-center justify-between">
                          <div>
                            <p className="font-medium text-primary text-sm">{testimony.name}</p>
                            <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(testimony.createdAt), { addSuffix: true })}</p>
                          </div>
                          <button onClick={() => handleAmen(testimony.id, testimony.likeCount)} disabled={likedIds.has(testimony.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${likedIds.has(testimony.id) ? "bg-red-50 text-red-500 border border-red-200" : "border border-border text-muted-foreground hover:border-red-300 hover:text-red-500 hover:bg-red-50"}`}>
                            <Flame className={`h-3.5 w-3.5 ${likedIds.has(testimony.id) ? "fill-red-500 text-red-500" : ""}`} />
                            {(localLikes[testimony.id] ?? testimony.likeCount)} Amens
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}

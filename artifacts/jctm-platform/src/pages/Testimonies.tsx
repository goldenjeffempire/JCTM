import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Plus, X, ChevronRight, ChevronLeft, CheckCircle, Flame } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useListTestimonies, getListTestimoniesQueryKey } from "@workspace/api-client-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const CATEGORIES = ["Healing", "Deliverance", "Financial Breakthrough", "Marriage Restoration", "Salvation", "Other"];
type Step = 1 | 2 | 3;

interface FormData {
  name: string; email: string; title: string; category: string; content: string; videoUrl: string;
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
      <div className="container mx-auto px-4 py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary mb-3">Testimony Vault</h1>
            <p className="text-muted-foreground text-lg">What God is doing through the Correction Mandate — {(testimonies ?? []).length} miracles recorded.</p>
          </div>
          <Button onClick={() => { setShowForm(!showForm); setStep(1); }}
            className="bg-accent text-white hover:bg-accent/90 flex items-center gap-2 rounded-full px-6 shrink-0">
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? "Close" : "Share Your Miracle"}
          </Button>
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
                              {cat}
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
                {cat} ({catCount})
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
            {filtered.map((testimony, i) => (
              <motion.div key={testimony.id} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: i * 0.04 }}
                className="glass-panel rounded-2xl p-6 flex flex-col gap-3 hover:shadow-md transition-shadow break-inside-avoid mb-6">
                {testimony.category && <span className="inline-block text-xs font-medium text-accent border border-accent/30 rounded-full px-3 py-0.5 w-fit">{testimony.category}</span>}
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
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

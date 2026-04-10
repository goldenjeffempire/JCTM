import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Send, Copy, Check, RefreshCw, Heart, Shield, Sun, Cloud, Flame, Users, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SEO } from "@/components/SEO";
import { Layout } from "@/components/layout/Layout";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const CATEGORIES = [
  { value: "general", label: "General", icon: <Star className="h-4 w-4" />, color: "from-amber-500 to-yellow-500" },
  { value: "faith", label: "Faith & Doubt", icon: <Flame className="h-4 w-4" />, color: "from-orange-500 to-red-500" },
  { value: "purpose", label: "Purpose & Calling", icon: <Sparkles className="h-4 w-4" />, color: "from-sky-500 to-blue-600" },
  { value: "healing", label: "Healing & Health", icon: <Heart className="h-4 w-4" />, color: "from-rose-500 to-pink-600" },
  { value: "protection", label: "Protection & Fear", icon: <Shield className="h-4 w-4" />, color: "from-emerald-500 to-teal-600" },
  { value: "relationships", label: "Relationships", icon: <Users className="h-4 w-4" />, color: "from-violet-500 to-purple-600" },
  { value: "peace", label: "Peace & Anxiety", icon: <Cloud className="h-4 w-4" />, color: "from-cyan-500 to-sky-600" },
  { value: "breakthrough", label: "Breakthrough", icon: <Sun className="h-4 w-4" />, color: "from-yellow-400 to-orange-500" },
];

const PROMPTS = [
  "I have been struggling with doubt about my calling lately and need direction",
  "My business is failing and I don't know if God is with me",
  "I'm experiencing spiritual dryness — I feel far from God",
  "I'm facing opposition in ministry and need confirmation to press on",
  "I have a major life decision and need clarity on God's will",
  "I'm struggling with fear and anxiety about the future",
];

function renderMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(##\s[^\n]+|\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (/^##\s/.test(part)) {
      return (
        <h2 key={i} className="text-base font-bold text-white mt-5 mb-1.5 first:mt-0 flex items-center gap-2">
          {part.replace(/^##\s/, "")}
        </h2>
      );
    }
    if (/^\*\*/.test(part)) {
      return <strong key={i} className="font-semibold text-white">{part.replace(/\*\*/g, "")}</strong>;
    }
    return <span key={i} className="whitespace-pre-wrap">{part}</span>;
  });
}

export default function SpiritualInsight() {
  const [name, setName] = useState("");
  const [situation, setSituation] = useState("");
  const [category, setCategory] = useState("general");
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!situation.trim() || isLoading) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setResult("");
    setError("");
    setIsLoading(true);

    try {
      const resp = await fetch(`${BASE}/api/ai/spiritual-insight`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ situation: situation.trim(), name: name.trim() || undefined, category }),
        signal: controller.signal,
      });

      if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          try {
            const json = JSON.parse(line.slice(5).trim()) as { delta?: string; done?: boolean; error?: string };
            if (json.delta) setResult(prev => prev + json.delta);
            if (json.error) { setError(json.error); break; }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError("Service temporarily unavailable. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [situation, name, category, isLoading]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    abortRef.current?.abort();
    setResult("");
    setError("");
    setSituation("");
    setIsLoading(false);
  };

  return (
    <Layout>
      <SEO
        title="Spiritual Insight | JCTM Digital Sanctuary"
        description="Receive personalized, prophetically-grounded spiritual insight for your specific situation — scripture-anchored, JCTM doctrine-rooted, and pastorally compassionate."
        keywords="JCTM spiritual insight, Christian counseling AI, prophetic word, scripture guidance"
      />

      <div className="min-h-screen bg-gradient-to-br from-[#0d0821] via-[#120d28] to-[#0d0821]">
        {/* Hero */}
        <div className="relative overflow-hidden pt-28 pb-16 px-4">
          <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(ellipse at 60% 20%, rgba(124,58,237,0.12) 0%, transparent 60%)" }} />

          <div className="relative max-w-2xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium mb-6"
                style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.25)", color: "#c4b5fd" }}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Prophetically-Grounded · Scripture-Anchored
              </div>
              <h1 className="text-4xl md:text-5xl font-bold font-serif text-white mb-4 leading-tight">
                Spiritual Insight
              </h1>
              <p className="text-violet-200/60 text-lg leading-relaxed">
                Share your situation and receive personalized, scripture-based spiritual insight grounded in JCTM's Primitive Christianity tradition.
              </p>
            </motion.div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 pb-20">
          {!result ? (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="rounded-3xl border overflow-hidden"
              style={{ background: "rgba(124,58,237,0.05)", borderColor: "rgba(124,58,237,0.2)", backdropFilter: "blur(24px)" }}
            >
              <div className="p-6 md:p-8 space-y-6">
                {/* Name */}
                <div>
                  <label className="block text-xs font-semibold text-violet-300 uppercase tracking-wider mb-2">
                    Your Name <span className="text-white/30 normal-case font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Emmanuel"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/25 focus:outline-none focus:border-violet-500/40 transition-all"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-semibold text-violet-300 uppercase tracking-wider mb-3">
                    Category
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat.value}
                        onClick={() => setCategory(cat.value)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all ${
                          category === cat.value
                            ? "border-violet-500/40 bg-violet-500/10 text-white"
                            : "border-white/8 bg-white/3 text-white/40 hover:text-white/70 hover:border-white/15"
                        }`}
                      >
                        <div className={`h-7 w-7 rounded-lg bg-gradient-to-br ${cat.color} flex items-center justify-center`}>
                          <span className="text-white">{cat.icon}</span>
                        </div>
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Situation */}
                <div>
                  <label className="block text-xs font-semibold text-violet-300 uppercase tracking-wider mb-2">
                    Describe Your Situation *
                  </label>
                  <Textarea
                    value={situation}
                    onChange={e => setSituation(e.target.value)}
                    placeholder="Share honestly what you're facing. The more specific you are, the more precise the spiritual insight…"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-violet-500/40 resize-none min-h-[120px]"
                  />
                  {/* Quick prompts */}
                  <div className="flex flex-col gap-1.5 mt-3">
                    {PROMPTS.slice(0, 3).map(p => (
                      <button
                        key={p}
                        onClick={() => setSituation(p)}
                        className="text-left text-xs text-violet-300/50 hover:text-violet-300/80 transition-colors py-1 border-l border-violet-500/20 pl-3"
                      >
                        "{p}"
                      </button>
                    ))}
                  </div>
                </div>

                <motion.div whileTap={{ scale: 0.98 }}>
                  <Button
                    onClick={handleGenerate}
                    disabled={!situation.trim() || isLoading}
                    className="w-full h-12 text-base font-semibold rounded-xl text-white border-0 shadow-lg disabled:opacity-50 transition-all"
                    style={{
                      background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
                      boxShadow: "0 8px 32px rgba(124,58,237,0.35)",
                    }}
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <motion.span
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                        />
                        Receiving insight…
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Send className="h-4 w-4" />
                        Receive Spiritual Insight
                      </span>
                    )}
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border overflow-hidden"
              style={{ background: "rgba(124,58,237,0.05)", borderColor: "rgba(124,58,237,0.2)" }}
            >
              {/* Result header */}
              <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "rgba(124,58,237,0.15)" }}>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{name ? `Insight for ${name}` : "Your Spiritual Insight"}</p>
                    <p className="text-violet-300/50 text-[10px]">{CATEGORIES.find(c => c.value === category)?.label}</p>
                  </div>
                  {isLoading && (
                    <motion.span
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                      className="h-2 w-2 rounded-full bg-violet-400 ml-1"
                    />
                  )}
                </div>
                {!isLoading && (
                  <div className="flex gap-2">
                    <button onClick={handleCopy} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/50 hover:text-white text-xs transition-all">
                      {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                    </button>
                    <button onClick={handleReset} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/50 hover:text-white text-xs transition-all">
                      <RefreshCw className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Result body */}
              <div className="p-6 md:p-8 text-white/75 text-sm leading-relaxed space-y-1 max-h-[70vh] overflow-y-auto scrollbar-hide">
                {error ? (
                  <p className="text-red-400 text-sm">{error}</p>
                ) : (
                  <>
                    {renderMarkdown(result)}
                    {isLoading && (
                      <motion.span
                        animate={{ opacity: [1, 0] }}
                        transition={{ duration: 0.8, repeat: Infinity }}
                        className="inline-block h-4 w-0.5 bg-violet-400 ml-0.5 align-middle"
                      />
                    )}
                  </>
                )}
              </div>

              {!isLoading && (
                <div className="px-6 py-4 border-t" style={{ borderColor: "rgba(124,58,237,0.15)" }}>
                  <button
                    onClick={handleReset}
                    className="w-full py-2 rounded-xl text-violet-300/60 hover:text-violet-300 text-sm border border-violet-500/10 hover:border-violet-500/25 transition-all"
                  >
                    ← Seek another insight
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </Layout>
  );
}

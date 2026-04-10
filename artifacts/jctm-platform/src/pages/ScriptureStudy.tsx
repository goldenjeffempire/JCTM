import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Search, Zap, Layers, Download, Copy, Check, ChevronDown, Sparkles, BookMarked } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SEO } from "@/components/SEO";
import { Layout } from "@/components/layout/Layout";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type StudyDepth = "quick" | "standard" | "deep";

const DEPTH_OPTIONS: { value: StudyDepth; label: string; desc: string; icon: React.ReactNode; color: string }[] = [
  { value: "quick", label: "Quick Study", desc: "Focused overview · 300–400 words", icon: <Zap className="h-4 w-4" />, color: "from-amber-500 to-orange-500" },
  { value: "standard", label: "Standard Study", desc: "Comprehensive · 600–800 words", icon: <BookOpen className="h-4 w-4" />, color: "from-sky-500 to-blue-600" },
  { value: "deep", label: "Deep Dive", desc: "Exhaustive scholarly analysis · 1200+ words", icon: <Layers className="h-4 w-4" />, color: "from-purple-600 to-indigo-700" },
];

const EXAMPLE_PASSAGES = [
  "John 3:16", "Romans 8:28", "Hebrews 12:14", "Matthew 28:19-20",
  "Acts 2:38", "Jeremiah 6:16", "1 Corinthians 12:1-11", "Ephesians 4:11-13",
  "Revelation 3:15-16", "Malachi 3:10",
];

const CATEGORIES = [
  { value: "general", label: "General" },
  { value: "salvation", label: "Salvation" },
  { value: "holiness", label: "Holiness" },
  { value: "baptism", label: "Baptism" },
  { value: "prayer", label: "Prayer" },
  { value: "end-times", label: "End Times" },
  { value: "correction-mandate", label: "Correction Mandate" },
];

function formatMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(##\s[^\n]+|###\s[^\n]+|\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (/^##\s/.test(part)) {
      return (
        <h2 key={i} className="text-lg font-bold text-primary mt-6 mb-2 first:mt-0 flex items-center gap-2">
          {part.replace(/^##\s/, "")}
        </h2>
      );
    }
    if (/^###\s/.test(part)) {
      return <h3 key={i} className="text-base font-semibold text-primary/90 mt-4 mb-1">{part.replace(/^###\s/, "")}</h3>;
    }
    if (/^\*\*/.test(part)) {
      return <strong key={i} className="font-semibold text-primary">{part.replace(/\*\*/g, "")}</strong>;
    }
    return <span key={i} className="whitespace-pre-wrap">{part}</span>;
  });
}

export default function ScriptureStudy() {
  const [passage, setPassage] = useState("");
  const [question, setQuestion] = useState("");
  const [depth, setDepth] = useState<StudyDepth>("standard");
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const handleStudy = useCallback(async () => {
    if (!passage.trim() || isLoading) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setResult("");
    setError("");
    setIsLoading(true);

    try {
      const resp = await fetch(`${BASE}/api/ai/scripture-study`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passage: passage.trim(), depth, question: question.trim() || undefined }),
        signal: controller.signal,
      });

      if (!resp.ok || !resp.body) throw new Error(`Request failed (${resp.status})`);

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
            if (json.delta) {
              setResult(prev => prev + json.delta);
              resultRef.current?.scrollTo({ top: resultRef.current.scrollHeight, behavior: "smooth" });
            }
            if (json.error) { setError(json.error); break; }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError("Unable to complete the study. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [passage, depth, question, isLoading]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([`JCTM Scripture Study — ${passage}\n\n${result}`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Scripture-Study-${passage.replace(/\s+/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      <SEO
        title="AI Scripture Study | JCTM Digital Sanctuary"
        description="Dive deep into any Bible passage with AI-powered exegetical analysis, original language insights, historical context, and doctrinal application rooted in JCTM's Primitive Christianity teaching."
        keywords="JCTM scripture study, Bible AI analysis, biblical exegesis, Primitive Christianity, Correction Mandate"
      />

      <div className="min-h-screen bg-gradient-to-b from-[#020b18] via-[#001a33] to-[#020b18]">
        {/* Hero */}
        <div className="relative overflow-hidden pt-28 pb-16 px-4">
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(ellipse at 50% 0%, #003366 0%, transparent 70%)" }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-sky-500/5 blur-3xl pointer-events-none" />

          <div className="relative max-w-3xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-xs font-medium text-sky-300 mb-6">
                <Sparkles className="h-3.5 w-3.5" />
                Powered by GPT-5.2 · JCTM Doctrine
              </div>
              <h1 className="text-4xl md:text-5xl font-bold font-serif text-white mb-4 leading-tight">
                AI Scripture Study
              </h1>
              <p className="text-sky-200/70 text-lg leading-relaxed max-w-2xl mx-auto">
                Enter any Bible passage and receive a deep, exegetically-grounded analysis rooted in Primitive Christianity, original languages, and the Correction Mandate.
              </p>
            </motion.div>
          </div>
        </div>

        {/* Main panel */}
        <div className="max-w-4xl mx-auto px-4 pb-20">
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="rounded-3xl border border-white/10 overflow-hidden"
            style={{ background: "rgba(255,254,248,0.03)", backdropFilter: "blur(24px)" }}
          >
            <div className="p-6 md:p-8 space-y-6">
              {/* Passage input */}
              <div>
                <label className="block text-xs font-semibold text-sky-300 uppercase tracking-wider mb-2">
                  Bible Passage *
                </label>
                <div className="relative">
                  <BookMarked className="absolute left-3 top-3 h-4 w-4 text-sky-400/60" />
                  <input
                    type="text"
                    value={passage}
                    onChange={e => setPassage(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleStudy()}
                    placeholder='e.g. "John 3:16" or "Romans 8:28-39" or "Hebrews 12:14"'
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/10 transition-all"
                  />
                </div>

                {/* Example passages */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {EXAMPLE_PASSAGES.map(p => (
                    <button
                      key={p}
                      onClick={() => setPassage(p)}
                      className="px-3 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-sky-300/70 hover:text-sky-300 hover:border-sky-500/30 hover:bg-sky-500/5 transition-all"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional question */}
              <div>
                <label className="block text-xs font-semibold text-sky-300 uppercase tracking-wider mb-2">
                  Specific Question <span className="text-white/30 normal-case font-normal">(optional)</span>
                </label>
                <Textarea
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  placeholder="e.g. How does this verse apply to the Correction Mandate? What is the Greek word for…?"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-sky-500/50 resize-none min-h-[80px]"
                />
              </div>

              {/* Study depth */}
              <div>
                <label className="block text-xs font-semibold text-sky-300 uppercase tracking-wider mb-3">
                  Study Depth
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {DEPTH_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setDepth(opt.value)}
                      className={`relative rounded-xl p-4 text-left border transition-all ${depth === opt.value
                        ? "border-sky-500/40 bg-sky-500/10"
                        : "border-white/10 bg-white/3 hover:border-white/20 hover:bg-white/5"
                      }`}
                    >
                      {depth === opt.value && (
                        <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${opt.color} opacity-5`} />
                      )}
                      <div className={`inline-flex items-center justify-center h-8 w-8 rounded-lg bg-gradient-to-br ${opt.color} mb-2`}>
                        <span className="text-white">{opt.icon}</span>
                      </div>
                      <p className="font-semibold text-white text-sm">{opt.label}</p>
                      <p className="text-white/40 text-xs mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit */}
              <motion.div whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={handleStudy}
                  disabled={!passage.trim() || isLoading}
                  className="w-full h-12 text-base font-semibold rounded-xl bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 text-white border-0 shadow-lg shadow-sky-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                      />
                      Studying scripture…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Search className="h-4 w-4" />
                      Begin Scripture Study
                    </span>
                  )}
                </Button>
              </motion.div>
            </div>

            {/* Results */}
            <AnimatePresence>
              {(result || error) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <div className="border-t border-white/10 p-6 md:p-8">
                    {error ? (
                      <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-red-300 text-sm">
                        {error}
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center">
                              <BookOpen className="h-3 w-3 text-white" />
                            </div>
                            <span className="text-sky-300 text-sm font-semibold">
                              Study: {passage}
                            </span>
                            {isLoading && (
                              <motion.span
                                animate={{ opacity: [1, 0.3, 1] }}
                                transition={{ duration: 1.4, repeat: Infinity }}
                                className="h-2 w-2 rounded-full bg-sky-400 ml-1"
                              />
                            )}
                          </div>
                          {!isLoading && result && (
                            <div className="flex gap-2">
                              <button
                                onClick={handleCopy}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/60 hover:text-white text-xs transition-all"
                              >
                                {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                                {copied ? "Copied" : "Copy"}
                              </button>
                              <button
                                onClick={handleDownload}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/60 hover:text-white text-xs transition-all"
                              >
                                <Download className="h-3 w-3" />
                                Save
                              </button>
                            </div>
                          )}
                        </div>

                        <div
                          ref={resultRef}
                          className="prose prose-invert prose-sm max-w-none max-h-[600px] overflow-y-auto pr-2 text-white/80 leading-relaxed space-y-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10"
                        >
                          {formatMarkdown(result)}
                          {isLoading && (
                            <motion.span
                              animate={{ opacity: [1, 0] }}
                              transition={{ duration: 0.8, repeat: Infinity }}
                              className="inline-block h-4 w-0.5 bg-sky-400 ml-0.5 align-middle"
                            />
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Bottom info cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            {[
              { icon: "📖", title: "Original Languages", desc: "Greek & Hebrew word studies with transliteration" },
              { icon: "🏛️", title: "Historical Context", desc: "First-century culture and archaeological insights" },
              { icon: "✦", title: "JCTM Doctrine", desc: "Grounded in the Correction Mandate and Primitive Christianity" },
            ].map(card => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="rounded-2xl border border-white/8 p-5 text-center"
                style={{ background: "rgba(255,254,248,0.02)" }}
              >
                <div className="text-2xl mb-2">{card.icon}</div>
                <h3 className="text-white font-semibold text-sm mb-1">{card.title}</h3>
                <p className="text-white/40 text-xs leading-relaxed">{card.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}

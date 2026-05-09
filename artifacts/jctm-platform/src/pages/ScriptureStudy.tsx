import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, Search, Zap, Layers, Download, Copy, Check,
  Sparkles, BookMarked, Hash, ArrowLeft, Loader2, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SEO } from "@/components/SEO";
import { Layout } from "@/components/layout/Layout";
import { AdSlot, ADSENSE_SLOTS, useAdPageTracker } from "@/components/ads/AdSense";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Types ──────────────────────────────────────────────────────────────────────
type StudyDepth = "quick" | "standard" | "deep";
type MainTab = "ai" | "browse";
type BrowseTab = "lookup" | "search" | "topics" | "chapter";

interface Verse { book: string; abbrev?: string; chapter: number; verse: number; text: string; reference?: string; testament?: string }
interface BookMeta { name: string; abbrev: string; testament: string; chapters: number }
interface TopicResult { topic: string; verseCount: number; verses: Array<{ reference: string; text: string; book: string; chapter: number; verse: number }> }

// ── AI study helpers ───────────────────────────────────────────────────────────
const DEPTH_OPTIONS: { value: StudyDepth; label: string; desc: string; icon: React.ReactNode; color: string }[] = [
  { value: "quick",    label: "Quick Study",    desc: "Focused overview · 300–400 words",        icon: <Zap className="h-4 w-4" />,     color: "from-amber-500 to-orange-500" },
  { value: "standard", label: "Standard Study", desc: "Comprehensive · 600–800 words",           icon: <BookOpen className="h-4 w-4" />, color: "from-sky-500 to-blue-600" },
  { value: "deep",     label: "Deep Dive",      desc: "Exhaustive scholarly analysis · 1200+ words", icon: <Layers className="h-4 w-4" />,  color: "from-purple-600 to-indigo-700" },
];

const EXAMPLE_PASSAGES = [
  "John 3:16", "Romans 8:28", "Hebrews 12:14", "Matthew 28:19-20",
  "Acts 2:38", "Jeremiah 6:16", "1 Corinthians 12:1-11", "Ephesians 4:11-13",
  "Revelation 3:15-16", "Malachi 3:10",
];

function formatMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(##\s[^\n]+|###\s[^\n]+|\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (/^##\s/.test(part))  return <h2 key={i} className="text-lg font-bold text-primary mt-6 mb-2 first:mt-0">{part.replace(/^##\s/, "")}</h2>;
    if (/^###\s/.test(part)) return <h3 key={i} className="text-base font-semibold text-primary/90 mt-4 mb-1">{part.replace(/^###\s/, "")}</h3>;
    if (/^\*\*/.test(part))  return <strong key={i} className="font-semibold text-primary">{part.replace(/\*\*/g, "")}</strong>;
    return <span key={i} className="whitespace-pre-wrap">{part}</span>;
  });
}

// ── Bible browser helpers ──────────────────────────────────────────────────────
const TOPIC_META: Record<string, { emoji: string; color: string }> = {
  salvation:            { emoji: "✝️",  color: "from-sky-600 to-sky-900" },
  holiness:             { emoji: "🔥",  color: "from-indigo-600 to-indigo-900" },
  faith:                { emoji: "🌿",  color: "from-emerald-600 to-emerald-900" },
  prayer:               { emoji: "🙏",  color: "from-violet-600 to-violet-900" },
  baptism:              { emoji: "💧",  color: "from-cyan-600 to-cyan-900" },
  "holy spirit":        { emoji: "🕊️",  color: "from-blue-600 to-blue-900" },
  healing:              { emoji: "💚",  color: "from-green-600 to-green-900" },
  worship:              { emoji: "🎵",  color: "from-amber-600 to-amber-900" },
  fear:                 { emoji: "🛡️",  color: "from-slate-600 to-slate-900" },
  love:                 { emoji: "❤️",  color: "from-rose-600 to-rose-900" },
  forgiveness:          { emoji: "🌅",  color: "from-orange-600 to-orange-900" },
  persecution:          { emoji: "⚔️",  color: "from-red-700 to-red-950" },
  "end times":          { emoji: "⏳",  color: "from-purple-700 to-purple-950" },
  tithing:              { emoji: "🌾",  color: "from-yellow-600 to-yellow-900" },
  marriage:             { emoji: "💍",  color: "from-pink-600 to-pink-900" },
  prosperity:           { emoji: "🌳",  color: "from-teal-600 to-teal-900" },
  repentance:           { emoji: "🌊",  color: "from-blue-700 to-blue-950" },
  "correction mandate": { emoji: "📜",  color: "from-indigo-700 to-indigo-950" },
  "spiritual warfare":  { emoji: "🛡️",  color: "from-gray-700 to-gray-950" },
};

async function clipCopy(text: string) {
  try { await navigator.clipboard.writeText(text); toast.success("Copied"); }
  catch { toast.error("Copy failed"); }
}

// ── Shared verse card ──────────────────────────────────────────────────────────
function VerseCard({ v }: { v: Verse }) {
  const [copied, setCopied] = useState(false);
  const ref = v.reference ?? `${v.book} ${v.chapter}:${v.verse}`;
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="group relative bg-card border border-border rounded-2xl px-5 py-4 hover:border-accent/40 transition-all">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-accent mb-2">{ref}</p>
      <p className="font-serif text-base text-primary leading-relaxed">{v.text}</p>
      <button onClick={() => { clipCopy(`"${v.text}" — ${ref} (NKJV)`); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-accent/10 text-muted-foreground hover:text-accent" aria-label="Copy">
        {copied ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
      </button>
    </motion.div>
  );
}

// ── Browse: Reference Lookup ───────────────────────────────────────────────────
function LookupTab() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<{ ragText?: string; chapter?: Verse[]; error?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const EXAMPLES = ["John 3:16", "Psalm 23", "Romans 8:28", "Ephesians 6:10-18", "1 Corinthians 13"];

  const lookup = useCallback(async (raw: string) => {
    const ref = raw.trim();
    if (!ref) return;
    setLoading(true); setResult(null);
    try {
      const res = await fetch(`${BASE}/api/bible/reference`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference: ref }) });
      const data = await res.json() as { parsed?: { book: string; chapter: number; verseStart?: number }; ragText?: string; error?: string };
      if (!res.ok || data.error) { setResult({ error: data.error ?? "Reference not found. Try e.g. 'John 3:16' or 'Psalm 23'." }); return; }
      if (data.parsed?.verseStart) { setResult({ ragText: data.ragText ?? "" }); }
      else {
        const p = data.parsed!;
        const chRes = await fetch(`${BASE}/api/bible/chapter/${encodeURIComponent(p.book)}/${p.chapter}`);
        const ch = await chRes.json() as { verses: Verse[] };
        setResult({ chapter: ch.verses });
      }
    } catch { setResult({ error: "Network error. Please try again." }); }
    finally { setLoading(false); }
  }, []);

  return (
    <div className="space-y-5">
      <form onSubmit={e => { e.preventDefault(); lookup(query); }} className="flex gap-2">
        <Input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="e.g. John 3:16  ·  Romans 8  ·  Ephesians 6:10-18"
          className="flex-1 h-12 text-base rounded-xl font-serif placeholder:text-muted-foreground/60" />
        <Button type="submit" disabled={loading || !query.trim()} className="h-12 px-5 rounded-xl">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
        </Button>
      </form>
      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map(ex => (
          <button key={ex} onClick={() => { setQuery(ex); lookup(ex); }}
            className="text-xs font-mono px-3 py-1.5 rounded-lg bg-muted hover:bg-accent/10 text-muted-foreground hover:text-accent border border-border hover:border-accent/40 transition-all">
            {ex}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        {loading && <motion.div key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3 justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin text-accent" /><span className="text-sm">Looking up scripture…</span></motion.div>}
        {result?.error && <motion.div key="e" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive">{result.error}</motion.div>}
        {result?.ragText && (
          <motion.div key="r" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-card border border-border rounded-2xl px-6 py-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-accent mb-3">NKJV</p>
            <p className="font-serif text-base leading-relaxed text-primary whitespace-pre-wrap">{result.ragText}</p>
            <button onClick={() => clipCopy(result.ragText! + " (NKJV)")} className="mt-4 flex items-center gap-2 text-xs text-muted-foreground hover:text-accent transition-colors"><Copy className="h-3.5 w-3.5" /> Copy</button>
          </motion.div>
        )}
        {result?.chapter && (
          <motion.div key="ch" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            <p className="text-xs text-muted-foreground">{result.chapter.length} verses · NKJV</p>
            {result.chapter.map(v => <VerseCard key={v.verse} v={v} />)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Browse: Keyword Search ─────────────────────────────────────────────────────
function SearchTab() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Verse[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const SUGGESTIONS = ["trust in the Lord", "do not be afraid", "Holy Spirit", "repent", "love one another", "kingdom of God"];

  const search = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true); setSearched(true);
    try {
      const res = await fetch(`${BASE}/api/bible/search?q=${encodeURIComponent(q)}&limit=20`);
      const data = await res.json() as { results: Verse[] };
      setResults(data.results ?? []);
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, []);

  return (
    <div className="space-y-5">
      <form onSubmit={e => { e.preventDefault(); search(query); }} className="flex gap-2">
        <Input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search NKJV scripture…  e.g. 'love one another'"
          className="flex-1 h-12 text-base rounded-xl font-serif placeholder:text-muted-foreground/60" />
        <Button type="submit" disabled={loading || !query.trim()} className="h-12 px-5 rounded-xl">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </form>
      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map(s => (
          <button key={s} onClick={() => { setQuery(s); search(s); }}
            className="text-xs px-3 py-1.5 rounded-lg bg-muted hover:bg-accent/10 text-muted-foreground hover:text-accent border border-border hover:border-accent/40 transition-all">
            {s}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        {loading && <motion.div key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3 justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin text-accent" /><span className="text-sm">Searching the scriptures…</span></motion.div>}
        {!loading && searched && results.length === 0 && <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-12 text-muted-foreground text-sm">No verses found. Try different keywords.</motion.div>}
        {!loading && results.length > 0 && (
          <motion.div key="res" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            <p className="text-xs text-muted-foreground">{results.length} results · NKJV</p>
            {results.map((v, i) => <VerseCard key={i} v={v} />)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Browse: Topics ─────────────────────────────────────────────────────────────
function TopicsTab() {
  const [topics, setTopics] = useState<Array<{ topic: string; verseCount: number }>>([]);
  const [active, setActive] = useState<TopicResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [topicLoading, setTopicLoading] = useState(false);

  useEffect(() => {
    fetch(`${BASE}/api/bible/topics`)
      .then(r => r.json() as Promise<{ topics: Array<{ topic: string; verseCount: number }> }>)
      .then(data => setTopics(data.topics ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadTopic = async (slug: string) => {
    setTopicLoading(true);
    try {
      const res = await fetch(`${BASE}/api/bible/topic/${encodeURIComponent(slug)}`);
      setActive(await res.json() as TopicResult);
    } catch { toast.error("Failed to load topic"); }
    finally { setTopicLoading(false); }
  };

  if (active) {
    const meta = TOPIC_META[active.topic] ?? { emoji: "📖", color: "from-primary to-primary/60" };
    return (
      <div className="space-y-5">
        <button onClick={() => setActive(null)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"><ArrowLeft className="h-4 w-4" /> Back to topics</button>
        <div className={`rounded-2xl bg-gradient-to-br ${meta.color} px-6 py-5 text-white`}>
          <p className="text-3xl mb-2">{meta.emoji}</p>
          <h2 className="font-serif text-2xl font-bold capitalize">{active.topic}</h2>
          <p className="text-sm text-white/70 mt-1">{active.verseCount} key scriptures · NKJV</p>
        </div>
        <div className="space-y-3">{active.verses.map((v, i) => <VerseCard key={i} v={{ book: v.book, chapter: v.chapter, verse: v.verse, text: v.text, reference: v.reference }} />)}</div>
      </div>
    );
  }

  if (loading) return <div className="flex items-center justify-center py-16 text-muted-foreground gap-3"><Loader2 className="h-5 w-5 animate-spin text-accent" /><span className="text-sm">Loading topics…</span></div>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{topics.length} ministry topics — curated NKJV verse collections</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {topics.map(({ topic, verseCount }) => {
          const meta = TOPIC_META[topic] ?? { emoji: "📖", color: "from-primary to-primary/60" };
          return (
            <motion.button key={topic} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => loadTopic(topic)} disabled={topicLoading}
              className={`relative text-left rounded-2xl bg-gradient-to-br ${meta.color} p-4 text-white transition-all overflow-hidden group`}>
              <span className="text-2xl block mb-2">{meta.emoji}</span>
              <span className="font-serif font-semibold text-sm capitalize block leading-tight">{topic}</span>
              <span className="text-[11px] text-white/60 mt-1 block">{verseCount} verses</span>
              <ChevronRight className="absolute bottom-3 right-3 h-4 w-4 text-white/30 group-hover:text-white/70 transition-colors" />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ── Browse: Chapter Reader ─────────────────────────────────────────────────────
function ChapterTab() {
  const [books, setBooks] = useState<BookMeta[]>([]);
  const [selectedBook, setSelectedBook] = useState<BookMeta | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [loading, setLoading] = useState(false);
  const [booksLoading, setBooksLoading] = useState(true);
  const [testament, setTestament] = useState<"OT" | "NT" | "all">("all");

  useEffect(() => {
    fetch(`${BASE}/api/bible/books`)
      .then(r => r.json() as Promise<{ books: BookMeta[] }>)
      .then(data => setBooks(data.books ?? []))
      .catch(() => {})
      .finally(() => setBooksLoading(false));
  }, []);

  const loadChapter = async (book: BookMeta, ch: number) => {
    setLoading(true); setVerses([]);
    try {
      const res = await fetch(`${BASE}/api/bible/chapter/${encodeURIComponent(book.name)}/${ch}`);
      const data = await res.json() as { verses: Verse[] };
      setVerses(data.verses ?? []); setSelectedChapter(ch);
    } catch { toast.error("Failed to load chapter"); }
    finally { setLoading(false); }
  };

  const filtered = books.filter(b => testament === "all" || b.testament === testament);

  if (selectedBook && selectedChapter !== null) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <button onClick={() => { setSelectedChapter(null); setVerses([]); }} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"><ArrowLeft className="h-4 w-4" /> {selectedBook.name}</button>
          <Badge variant="outline" className="text-xs font-mono">{selectedBook.name} {selectedChapter} · NKJV</Badge>
        </div>
        {loading
          ? <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin text-accent" /><span className="text-sm">Loading chapter…</span></div>
          : <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-0.5">
              {verses.map(v => (
                <div key={v.verse} className="group flex gap-3 py-2 px-1 rounded-xl hover:bg-muted/50 transition-colors">
                  <span className="text-[11px] font-mono text-muted-foreground w-6 text-right mt-1 shrink-0 select-none">{v.verse}</span>
                  <p className="font-serif text-base text-primary leading-relaxed">{v.text}</p>
                </div>
              ))}
            </motion.div>
        }
      </div>
    );
  }

  if (selectedBook) {
    const chapters = Array.from({ length: selectedBook.chapters }, (_, i) => i + 1);
    return (
      <div className="space-y-5">
        <button onClick={() => setSelectedBook(null)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"><ArrowLeft className="h-4 w-4" /> All books</button>
        <div>
          <h2 className="font-serif text-2xl font-bold text-primary">{selectedBook.name}</h2>
          <p className="text-sm text-muted-foreground mt-1">{selectedBook.chapters} chapters · {selectedBook.testament === "OT" ? "Old Testament" : "New Testament"}</p>
        </div>
        <div className="grid grid-cols-6 sm:grid-cols-10 gap-2">
          {chapters.map(ch => (
            <button key={ch} onClick={() => loadChapter(selectedBook, ch)}
              className="h-10 rounded-xl bg-muted hover:bg-accent/10 hover:text-accent text-sm font-mono font-medium text-muted-foreground border border-border hover:border-accent/40 transition-all">
              {ch}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (booksLoading) return <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin text-accent" /><span className="text-sm">Loading books…</span></div>;

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        {(["all", "OT", "NT"] as const).map(t => (
          <button key={t} onClick={() => setTestament(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all border ${testament === t ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border hover:border-primary/40 hover:text-primary"}`}>
            {t === "all" ? "All 66 Books" : t === "OT" ? "Old Testament" : "New Testament"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {filtered.map(book => (
          <button key={book.abbrev} onClick={() => setSelectedBook(book)}
            className="group flex items-center justify-between text-left px-4 py-3 rounded-xl bg-muted/60 hover:bg-accent/10 border border-border hover:border-accent/40 transition-all">
            <div>
              <span className="text-sm font-medium text-primary group-hover:text-accent transition-colors">{book.name}</span>
              <span className="text-[11px] text-muted-foreground block">{book.chapters} ch</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-accent transition-colors shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── AI Deep Study panel (preserved from original) ──────────────────────────────
function AIStudyPanel() {
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
    setResult(""); setError(""); setIsLoading(true);
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
            if (json.delta) { setResult(prev => prev + json.delta); resultRef.current?.scrollTo({ top: resultRef.current.scrollHeight, behavior: "smooth" }); }
            if (json.error) { setError(json.error); break; }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") setError("Unable to complete the study. Please try again.");
    } finally { setIsLoading(false); }
  }, [passage, depth, question, isLoading]);

  const handleCopy = async () => { await navigator.clipboard.writeText(result); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const handleDownload = () => {
    const blob = new Blob([`JCTM Scripture Study — ${passage}\n\n${result}`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `Scripture-Study-${passage.replace(/\s+/g, "-")}.txt`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
      className="rounded-3xl border border-white/10 overflow-hidden" style={{ background: "rgba(255,254,248,0.03)", backdropFilter: "blur(24px)" }}>
      <div className="p-6 md:p-8 space-y-6">
        {/* Passage */}
        <div>
          <label className="block text-xs font-semibold text-sky-300 uppercase tracking-wider mb-2">Bible Passage *</label>
          <div className="relative">
            <BookMarked className="absolute left-3 top-3 h-4 w-4 text-sky-400/60" />
            <input type="text" value={passage} onChange={e => setPassage(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleStudy()}
              placeholder='e.g. "John 3:16" or "Romans 8:28-39" or "Hebrews 12:14"'
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/10 transition-all" />
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {EXAMPLE_PASSAGES.map(p => (
              <button key={p} onClick={() => setPassage(p)}
                className="px-3 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-sky-300/70 hover:text-sky-300 hover:border-sky-500/30 hover:bg-sky-500/5 transition-all">
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
          <Textarea value={question} onChange={e => setQuestion(e.target.value)}
            placeholder="e.g. How does this verse apply to the Correction Mandate? What is the Greek word for…?"
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-sky-500/50 resize-none min-h-[80px]" />
        </div>

        {/* Depth */}
        <div>
          <label className="block text-xs font-semibold text-sky-300 uppercase tracking-wider mb-3">Study Depth</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {DEPTH_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => setDepth(opt.value)}
                className={`relative rounded-xl p-4 text-left border transition-all ${depth === opt.value ? "border-sky-500/40 bg-sky-500/10" : "border-white/10 bg-white/3 hover:border-white/20 hover:bg-white/5"}`}>
                {depth === opt.value && <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${opt.color} opacity-5`} />}
                <div className={`inline-flex items-center justify-center h-8 w-8 rounded-lg bg-gradient-to-br ${opt.color} mb-2`}><span className="text-white">{opt.icon}</span></div>
                <p className="font-semibold text-white text-sm">{opt.label}</p>
                <p className="text-white/40 text-xs mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <motion.div whileTap={{ scale: 0.98 }}>
          <Button onClick={handleStudy} disabled={!passage.trim() || isLoading}
            className="w-full h-12 text-base font-semibold rounded-xl bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 text-white border-0 shadow-lg shadow-sky-900/40 disabled:opacity-50 transition-all">
            {isLoading
              ? <span className="flex items-center gap-2"><motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />Studying scripture…</span>
              : <span className="flex items-center gap-2"><Search className="h-4 w-4" />Begin Scripture Study</span>}
          </Button>
        </motion.div>
      </div>

      {/* Results */}
      <AnimatePresence>
        {(result || error) && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.4 }}>
            <div className="border-t border-white/10 p-6 md:p-8">
              {error
                ? <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-red-300 text-sm">{error}</div>
                : <>
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center"><BookOpen className="h-3 w-3 text-white" /></div>
                        <span className="text-sky-300 text-sm font-semibold">Study: {passage}</span>
                        {isLoading && <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.4, repeat: Infinity }} className="h-2 w-2 rounded-full bg-sky-400 ml-1" />}
                      </div>
                      {!isLoading && result && (
                        <div className="flex gap-2">
                          <button onClick={handleCopy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/60 hover:text-white text-xs transition-all">
                            {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}{copied ? "Copied" : "Copy"}
                          </button>
                          <button onClick={handleDownload} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/60 hover:text-white text-xs transition-all">
                            <Download className="h-3 w-3" />Save
                          </button>
                        </div>
                      )}
                    </div>
                    <div ref={resultRef} className="prose prose-invert prose-sm max-w-none max-h-[600px] overflow-y-auto pr-2 text-white/80 leading-relaxed space-y-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
                      {formatMarkdown(result)}
                      {isLoading && <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.8, repeat: Infinity }} className="inline-block h-4 w-0.5 bg-sky-400 ml-0.5 align-middle" />}
                    </div>
                  </>
              }
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Bible Browser panel ────────────────────────────────────────────────────────
const BROWSE_TABS: Array<{ id: BrowseTab; label: string; icon: React.ReactNode }> = [
  { id: "lookup",  label: "Reference", icon: <BookOpen className="h-4 w-4" /> },
  { id: "search",  label: "Search",    icon: <Search className="h-4 w-4" /> },
  { id: "topics",  label: "Topics",    icon: <Hash className="h-4 w-4" /> },
  { id: "chapter", label: "Read",      icon: <BookMarked className="h-4 w-4" /> },
];

function BibleBrowserPanel() {
  const [browseTab, setBrowseTab] = useState<BrowseTab>("lookup");
  return (
    <div className="space-y-6">
      {/* Browse tabs */}
      <div className="flex gap-1 bg-muted rounded-2xl p-1">
        {BROWSE_TABS.map(t => (
          <button key={t.id} onClick={() => setBrowseTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${browseTab === t.id ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-primary"}`}>
            {t.icon}<span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={browseTab} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.18 }}>
          {browseTab === "lookup"  && <LookupTab />}
          {browseTab === "search"  && <SearchTab />}
          {browseTab === "topics"  && <TopicsTab />}
          {browseTab === "chapter" && <ChapterTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function ScriptureStudy() {
  useAdPageTracker("/scripture-study", 1);
  const [mainTab, setMainTab] = useState<MainTab>("ai");

  return (
    <Layout>
      <SEO
        title="AI Scripture Study — Deep Bible Analysis | JCTM Digital Sanctuary"
        description="Study any Bible passage with AI-powered exegetical analysis from Jesus Christ Temple Ministry. Search the NKJV Bible, browse ministry topics, or read any chapter — all grounded in Primitive Christianity and the Correction Mandate."
        path="/scripture-study"
        keywords="JCTM scripture study, Bible AI analysis, biblical exegesis Nigeria, Primitive Christianity scripture, Correction Mandate Bible study, NKJV Bible online, Greek Hebrew Bible analysis"
        breadcrumbs={[
          { name: "Home", url: "https://jctm.org.ng/" },
          { name: "Scripture Study", url: "https://jctm.org.ng/scripture-study" },
        ]}
        jsonLd={[{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          "name": "JCTM AI Scripture Study Tool",
          "description": "An AI-powered Bible study and exegesis tool from Jesus Christ Temple Ministry (JCTM).",
          "url": "https://jctm.org.ng/scripture-study",
          "applicationCategory": "ReligiousApplication",
          "operatingSystem": "Web",
          "inLanguage": "en-NG",
          "author": { "@type": "ReligiousOrganization", "name": "Jesus Christ Temple Ministry (JCTM)", "url": "https://jctm.org.ng" },
        }]}
      />

      <div className="min-h-screen bg-gradient-to-b from-[#020b18] via-[#001a33] to-[#020b18]">
        {/* Hero */}
        <div className="relative overflow-hidden pt-28 pb-14 px-4">
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(ellipse at 50% 0%, #003366 0%, transparent 70%)" }} />
          <div className="relative max-w-3xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-xs font-medium text-sky-300 mb-6">
                <Sparkles className="h-3.5 w-3.5" />
                AI Deep Study · NKJV Bible Browser · 2,700+ Verses
              </div>
              <h1 className="text-4xl md:text-5xl font-bold font-serif text-white mb-4 leading-tight">Scripture Study</h1>
              <p className="text-sky-200/70 text-lg leading-relaxed max-w-2xl mx-auto">
                AI-powered exegetical analysis grounded in Primitive Christianity — or browse, search, and read the King James Bible directly.
              </p>
            </motion.div>
          </div>
        </div>

        {/* Main tab switcher */}
        <div className="max-w-4xl mx-auto px-4 pb-20 space-y-6">
          <div className="flex gap-1 bg-white/5 border border-white/10 rounded-2xl p-1">
            <button onClick={() => setMainTab("ai")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${mainTab === "ai" ? "bg-gradient-to-r from-sky-600 to-blue-700 text-white shadow-lg" : "text-sky-300/60 hover:text-sky-300"}`}>
              <Sparkles className="h-4 w-4" /> AI Deep Study
            </button>
            <button onClick={() => setMainTab("browse")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${mainTab === "browse" ? "bg-white/10 text-white shadow" : "text-sky-300/60 hover:text-sky-300"}`}>
              <BookOpen className="h-4 w-4" /> Bible Browser
            </button>
          </div>

          <AnimatePresence mode="wait">
            {mainTab === "ai" && (
              <motion.div key="ai" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }}>
                <AIStudyPanel />
                <AdSlot slot={ADSENSE_SLOTS.scriptureStudy} minHeight={100} className="mx-auto max-w-3xl mt-8" lazy />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  {[
                    { icon: "📖", title: "Original Languages", desc: "Greek & Hebrew word studies with transliteration" },
                    { icon: "🏛️", title: "Historical Context", desc: "First-century culture and archaeological insights" },
                    { icon: "✦",  title: "JCTM Doctrine",      desc: "Grounded in the Correction Mandate and Primitive Christianity" },
                  ].map(card => (
                    <div key={card.title} className="rounded-2xl border border-white/8 p-5 text-center" style={{ background: "rgba(255,254,248,0.02)" }}>
                      <div className="text-2xl mb-2">{card.icon}</div>
                      <h3 className="text-white font-semibold text-sm mb-1">{card.title}</h3>
                      <p className="text-white/40 text-xs leading-relaxed">{card.desc}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
            {mainTab === "browse" && (
              <motion.div key="browse" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }}
                className="rounded-3xl border border-white/10 p-6 md:p-8" style={{ background: "rgba(255,254,248,0.03)", backdropFilter: "blur(24px)" }}>
                <BibleBrowserPanel />
                <AdSlot slot={ADSENSE_SLOTS.IN_FEED} className="mt-8" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Layout>
  );
}

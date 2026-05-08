import { useState, useRef, useEffect, useCallback } from "react";
import {
  MessageCircle, X, Send, Facebook, Youtube, Mail, Phone,
  Bell, ChevronRight, Sparkles, Heart, ExternalLink,
} from "lucide-react";
import { SiZoom } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const STREAM_URL = `${BASE}/api/chat/stream`;
const SUGGEST_URL = `${BASE}/api/ai/suggested-questions`;

interface Message {
  id: string;
  role: "user" | "bot";
  content: string;
  sources?: string[];
  action?: string | null;
  isStreaming?: boolean;
  isError?: boolean;
}

const QUICK_LINKS = [
  "What is Primitive Christianity?",
  "What is the Correction Mandate?",
  "How to Sow a Seed?",
  "Who is Prophet Amos Evomobor?",
  "How do I join JCTM?",
  "What does JCTM believe about holiness?",
];

function getContextualGreeting(path: string): string {
  if (path.startsWith("/give"))
    return "Welcome to the Giving Portal. I can help you understand the spiritual significance of seed sowing and what the Word of God says about giving. What would you like to know?";
  if (path.startsWith("/correction-timeline") || path === "/our-mandate")
    return "You're exploring the Correction Mandate. Ask me about the specific corrections Prophet Amos is bringing to the church — on prosperity doctrine, prophetic manipulation, or the five mandated corrections.";
  if (path.startsWith("/sermons"))
    return "Welcome to the Sermon Hub. I can help you find teachings on specific topics — Holiness, Baptism, End Times, or Primitive Christianity. What are you studying today?";
  if (path === "/testimonies")
    return "You're in the Testimony Vault — a record of God's faithfulness. Ask me about the miracles God is doing through the Correction Mandate, or share what's on your heart.";
  if (path === "/about")
    return "Welcome. I can tell you more about Prophet Amos Evomobor, the Ebrumede Temple, and the divine mandate given to JCTM. What would you like to know?";
  if (path === "/join" || path === "/members")
    return "Glad you're joining the Digital Sanctuary family. I can answer questions about membership and what it means to be part of this reformation community.";
  if (path === "/events")
    return "Looking for upcoming gatherings? I can help you understand the significance of our events and services. What's on your mind?";
  return "Welcome to the Digital Sanctuary. I am TempleBots — ask me anything about JCTM, the Correction Mandate, or Christian doctrine.";
}

const SMART_NOTIFICATIONS: Record<string, string> = {
  giving: "💛 Ready to partner with the Mandate? I can guide you through giving options.",
  testimonies: "✨ Exploring testimonies? I can share more stories of God's faithfulness through JCTM.",
};

const HOVER_WHISPERS: Record<string, { message: string; cta: string }> = {
  giving: {
    message: "Would you like to see the spiritual benefits of seed-sowing according to scripture?",
    cta: "Show me the benefits",
  },
  sermons: {
    message: "I can help you find sermons on a specific topic — holiness, end times, or baptism.",
    cta: "Find a sermon",
  },
  testimony: {
    message: "Want to share your own miracle testimony or read how God is moving?",
    cta: "Share a testimony",
  },
  altar: {
    message: "Join thousands worshipping now globally. Would you like a prayer guide?",
    cta: "Get prayer guide",
  },
};

const REACH_US = [
  { label: "Zoom Meeting", href: "https://zoom.us/j/4092099631", icon: SiZoom, color: "#2D8CFF", bg: "hover:bg-[#2D8CFF]/10 hover:border-[#2D8CFF]/30", hint: "Meeting ID: 4092099631" },
  { label: "Facebook", href: "https://www.facebook.com/templetvjctm", icon: Facebook, color: "#1877F2", bg: "hover:bg-[#1877F2]/10 hover:border-[#1877F2]/30", hint: "templetvjctm" },
  { label: "Temple TV", href: "https://www.youtube.com/templetvjctm", icon: Youtube, color: "#FF0000", bg: "hover:bg-[#FF0000]/10 hover:border-[#FF0000]/30", hint: "youtube.com/templetvjctm" },
  { label: "Email", href: "mailto:info@jctm.org.ng", icon: Mail, color: "#003366", bg: "hover:bg-[#003366]/10 hover:border-[#003366]/30", hint: "info@jctm.org.ng" },
];

type HistoryEntry = { role: "user" | "assistant"; content: string };

export function TempleBots() {
  const [location] = useLocation();
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [isStreaming, setIsStreaming] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [scrolledPastHero, setScrolledPastHero] = useState(false);
  const [whisper, setWhisper] = useState<{ section: string; message: string; cta: string } | null>(null);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>(QUICK_LINKS.slice(0, 5));
  const [homepageChips, setHomepageChips] = useState<string[] | null>(null);
  const notificationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const whisperTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const historyRef = useRef<HistoryEntry[]>([]);

  // Track conversation history for context
  useEffect(() => {
    const entries: HistoryEntry[] = messages
      .filter((m) => !m.isStreaming && !m.isError)
      .map((m) => ({
        role: m.role === "bot" ? "assistant" : "user",
        content: m.content,
      }));
    historyRef.current = entries.slice(-20);
  }, [messages]);

  useEffect(() => {
    const onScroll = () => setScrolledPastHero(window.scrollY > window.innerHeight * 0.65);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);


  useEffect(() => {
    setMessages([{ id: "1", role: "bot", content: getContextualGreeting(location) }]);
    setSessionId(undefined);
    historyRef.current = [];
  }, [location]);

  useEffect(() => {
    const handler = (e: Event) => {
      const section = (e as CustomEvent<string>).detail;
      if (isOpen) return;
      const msg = SMART_NOTIFICATIONS[section];
      if (!msg) return;
      setNotification(msg);
      setShowToast(true);
      if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
      notificationTimerRef.current = setTimeout(() => setShowToast(false), 6000);
    };
    window.addEventListener("jctm:section-enter", handler);
    return () => {
      window.removeEventListener("jctm:section-enter", handler);
      if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
    };
  }, [isOpen]);

  useEffect(() => {
    const handler = (e: Event) => {
      const section = (e as CustomEvent<string>).detail;
      if (isOpen || showToast) return;
      const w = HOVER_WHISPERS[section];
      if (!w) return;
      if (whisperTimerRef.current) clearTimeout(whisperTimerRef.current);
      whisperTimerRef.current = setTimeout(() => {
        setWhisper({ section, ...w });
        setTimeout(() => setWhisper(null), 7000);
      }, 800);
    };
    const clearHandler = () => {
      if (whisperTimerRef.current) clearTimeout(whisperTimerRef.current);
    };
    window.addEventListener("jctm:hover-enter", handler);
    window.addEventListener("jctm:hover-leave", clearHandler);
    return () => {
      window.removeEventListener("jctm:hover-enter", handler);
      window.removeEventListener("jctm:hover-leave", clearHandler);
      if (whisperTimerRef.current) clearTimeout(whisperTimerRef.current);
    };
  }, [isOpen, showToast]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  const fetchSuggestedQuestions = useCallback(async (conversationSoFar: HistoryEntry[]) => {
    try {
      const res = await fetch(`${SUGGEST_URL}?ctx=1`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: conversationSoFar.slice(-6) }),
      });
      if (!res.ok) {
        // Fallback to GET endpoint
        const fallback = await fetch(SUGGEST_URL);
        if (!fallback.ok) return;
        const fb = await fallback.json() as { questions?: string[] };
        if (Array.isArray(fb.questions) && fb.questions.length > 0) {
          setSuggestedQuestions(fb.questions.slice(0, 5));
        }
        return;
      }
      const data = await res.json() as { questions?: string[] };
      if (Array.isArray(data.questions) && data.questions.length > 0) {
        setSuggestedQuestions(data.questions.slice(0, 5));
      }
    } catch {
      // Silent fallback — keep existing suggestions
    }
  }, []);

  // Fetch AI suggested questions after each bot reply finishes
  useEffect(() => {
    if (isStreaming) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "bot" || last.isStreaming || last.isError || !last.content) return;
    if (messages.length < 3) return; // Only after first real exchange
    const history: HistoryEntry[] = messages
      .filter(m => !m.isStreaming && !m.isError && m.content)
      .map(m => ({ role: m.role === "bot" ? "assistant" : "user", content: m.content }));
    void fetchSuggestedQuestions(history);
  }, [isStreaming, messages, fetchSuggestedQuestions]);

  const HOMEPAGE_CHIPS = [
    "Tell me about holiness",
    "Upcoming events",
    "How do I give?",
    "Who is Prophet Amos?",
    "How can I join JCTM?",
  ];

  const handleOpen = useCallback((initialMessage?: string) => {
    setIsOpen(true);
    setNotification(null);
    setShowToast(false);
    setWhisper(null);
    if (initialMessage) {
      setTimeout(() => setInput(initialMessage), 300);
      setHomepageChips(HOMEPAGE_CHIPS);
    }
  }, []);

  // Allow the chat to be opened from outside (e.g. the contact stack FAB).
  // Other components dispatch a `jctm:open-templebots` window event with an
  // optional `{ detail: { message: string } }` to seed the input.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ message?: string } | undefined>).detail;
      handleOpen(detail?.message);
    };
    window.addEventListener("jctm:open-templebots", onOpen);
    return () => window.removeEventListener("jctm:open-templebots", onOpen);
  }, [handleOpen]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;
    setInput("");
    setHomepageChips(null);

    const userMsgId = Date.now().toString();
    const botMsgId = `${userMsgId}-bot`;

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: text },
      { id: botMsgId, role: "bot", content: "", isStreaming: true },
    ]);
    setIsStreaming(true);

    // Abort any previous stream
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(STREAM_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          sessionId,
          history: historyRef.current,
          language,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalSessionId: string | undefined;
      let finalSources: string[] = [];
      let finalAction: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          let json: Record<string, unknown>;
          try {
            json = JSON.parse(line.slice(5).trim());
          } catch {
            continue;
          }

          if (typeof json.delta === "string") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === botMsgId
                  ? { ...m, content: m.content + json.delta }
                  : m,
              ),
            );
          }

          if (json.done) {
            finalSessionId = json.sessionId as string | undefined;
            finalSources = (json.sources as string[]) ?? [];
            finalAction = (json.action as string | null) ?? null;
          }

          if (typeof json.error === "string") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === botMsgId
                  ? { ...m, content: json.error as string, isStreaming: false, isError: true }
                  : m,
              ),
            );
            setIsStreaming(false);
            return;
          }
        }
      }

      if (finalSessionId) setSessionId(finalSessionId);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === botMsgId
            ? {
                ...m,
                isStreaming: false,
                sources: finalSources,
                action: finalAction,
              }
            : m,
        ),
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === botMsgId
            ? {
                ...m,
                content: "TempleBots is temporarily unavailable. Please contact the ministry directly.",
                isStreaming: false,
                isError: true,
              }
            : m,
        ),
      );
    } finally {
      setIsStreaming(false);
    }
  }, [isStreaming, sessionId, language]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleQuickLink = (q: string) => sendMessage(q);

  return (
    <>
      {/* Predictive hover whisper */}
      <AnimatePresence>
        {whisper && !isOpen && !showToast && (
          <motion.div
            initial={{ opacity: 0, x: 50, scale: 0.92 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.92 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="fixed bottom-[5.5rem] right-6 z-50 max-w-[260px] cursor-pointer"
            onClick={() => handleOpen(whisper.cta)}
          >
            <div
              className="rounded-2xl p-3.5 shadow-2xl border border-accent/20"
              style={{
                background: "rgba(255, 254, 248, 0.97)",
                backdropFilter: "blur(24px)",
                boxShadow: "0 8px 40px rgba(0,51,102,0.18), 0 0 0 1px rgba(56,189,248,0.12)",
              }}
            >
              <div className="flex items-start gap-2.5">
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-accent to-[#0284C7] flex items-center justify-center shrink-0 mt-0.5 shadow-md">
                  <Sparkles className="h-3.5 w-3.5 text-white" />
                </div>
                <div>
                  <p className="text-primary font-semibold text-[11px] mb-0.5">TempleBots whispers…</p>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">{whisper.message}</p>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleOpen(whisper.cta); }}
                    className="mt-2 text-accent text-[10px] font-bold hover:underline flex items-center gap-0.5"
                  >
                    {whisper.cta} <ChevronRight className="h-2.5 w-2.5" />
                  </button>
                </div>
              </div>
              <motion.div
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: 7, ease: "linear" }}
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-accent to-[#0284C7] origin-left rounded-b-2xl"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Smart notification toast */}
      <AnimatePresence>
        {showToast && notification && !isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 60, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 60, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className="fixed bottom-24 right-6 z-50 max-w-[270px] bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 p-4 cursor-pointer"
            style={{ boxShadow: "0 8px 32px rgba(0,51,102,0.15), 0 0 0 1px rgba(56,189,248,0.1)" }}
            onClick={() => handleOpen()}
          >
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-accent/15 flex items-center justify-center shrink-0 mt-0.5"><Bell className="h-4 w-4 text-accent" /></div>
              <div>
                <p className="text-primary font-semibold text-xs mb-1">TempleBots</p>
                <p className="text-muted-foreground text-xs leading-relaxed">{notification}</p>
              </div>
            </div>
            <motion.div initial={{ scaleX: 1 }} animate={{ scaleX: 0 }} transition={{ duration: 6, ease: "linear" }} className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent origin-left rounded-b-2xl" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating launcher removed — the contact stack FAB in
          VoiceTempleBots now opens this chat via a `jctm:open-templebots`
          window event. Smart notifications and predictive whispers above
          continue to surface as standalone toasts that open the chat on
          tap. */}

      {/* Full chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.94 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-3rem)] h-[580px] max-h-[calc(100vh-6rem)] rounded-3xl flex flex-col overflow-hidden"
            style={{
              background: "rgba(255, 254, 248, 0.92)",
              backdropFilter: "blur(28px)",
              WebkitBackdropFilter: "blur(28px)",
              border: "1px solid rgba(56,189,248,0.15)",
              boxShadow: "0 32px 80px rgba(0,51,102,0.2), 0 0 0 1px rgba(56,189,248,0.1), inset 0 1px 0 rgba(255,255,255,0.8)",
            }}
          >
            {/* Header */}
            <div className="relative bg-primary text-primary-foreground p-4 flex items-center justify-between shrink-0 overflow-hidden">
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 50%, rgba(56,189,248,0.5) 0%, transparent 60%)" }} />
              <div className="relative flex items-center gap-2.5">
                <div className="relative">
                  <img src="/jctm-logo-sm.jpeg" alt="JCTM" className="h-9 w-9 rounded-full object-cover ring-2 ring-white/20" decoding="async" />
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 bg-emerald-400 rounded-full border border-primary" />
                </div>
                <div className="leading-tight">
                  <span className="font-bold text-sm block">TempleBots</span>
                  <span className="text-[10px] text-white/60">JCTM Digital Sanctuary · Online now</span>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="relative h-8 w-8 hover:bg-white/10 text-white rounded-xl" onClick={() => setIsOpen(false)} aria-label="Close chat">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.2 }}
                    className={`max-w-[88%] rounded-2xl px-4 py-2.5 ${
                      msg.role === "user"
                        ? "bg-accent text-white rounded-tr-sm shadow-sm"
                        : msg.isError
                        ? "text-red-700 bg-red-50 border border-red-200 rounded-tl-sm"
                        : "text-primary rounded-tl-sm border border-border/60 shadow-sm"
                    }`}
                    style={msg.role === "bot" && !msg.isError ? { background: "rgba(255,255,255,0.85)", backdropFilter: "blur(8px)" } : {}}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                      {msg.isStreaming && (
                        <span className="inline-block w-0.5 h-3.5 bg-accent ml-0.5 align-middle animate-pulse rounded-full" />
                      )}
                    </p>
                  </motion.div>

                  {/* Source citations */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {msg.sources.map((s, i) => {
                        const label = s.match(/v=([\w-]+)/)?.[1] ?? `Source ${i + 1}`;
                        return (
                          <a
                            key={i}
                            href={s}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-accent bg-accent/10 hover:bg-accent/20 border border-accent/20 px-2 py-0.5 rounded-full transition-colors"
                          >
                            <Youtube className="h-2.5 w-2.5" />
                            {label}
                          </a>
                        );
                      })}
                    </div>
                  )}

                  {/* Contextual action: Sow a Seed */}
                  {msg.action === "sow-a-seed" && !msg.isStreaming && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                      className="mt-2"
                    >
                      <a
                        href={`${BASE}/give`}
                        className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-400 text-white text-xs font-bold px-4 py-2 rounded-full shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200"
                      >
                        <Heart className="h-3.5 w-3.5" />
                        Sow a Seed
                        <ExternalLink className="h-3 w-3 opacity-80" />
                      </a>
                    </motion.div>
                  )}

                  {/* Error fallback: Contact Ministry */}
                  {msg.isError && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                      className="mt-2 flex gap-2"
                    >
                      <a
                        href="mailto:info@jctm.org.ng"
                        className="inline-flex items-center gap-1.5 text-[10px] text-primary bg-white border border-border/50 px-3 py-1.5 rounded-full hover:bg-primary/5 transition-colors shadow-sm"
                      >
                        <Mail className="h-3 w-3" />
                        Contact Ministry
                      </a>
                      <a
                        href="https://www.youtube.com/templetvjctm"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[10px] text-red-600 bg-white border border-red-200 px-3 py-1.5 rounded-full hover:bg-red-50 transition-colors shadow-sm"
                      >
                        <Youtube className="h-3 w-3" />
                        Temple TV
                      </a>
                    </motion.div>
                  )}
                </div>
              ))}

              {/* Homepage quick-reply chips — shown only before first exchange */}
              <AnimatePresence>
                {homepageChips && messages.length <= 1 && !isStreaming && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ delay: 0.25, type: "spring", stiffness: 260, damping: 22 }}
                    className="flex flex-col gap-2"
                  >
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="h-2.5 w-2.5 text-accent" />
                      Quick starts
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {homepageChips.map((chip, i) => (
                        <motion.button
                          key={chip}
                          initial={{ opacity: 0, scale: 0.88 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.3 + i * 0.06, type: "spring", stiffness: 280, damping: 20 }}
                          onClick={() => { setHomepageChips(null); sendMessage(chip); }}
                          disabled={isStreaming}
                          className="text-[11px] font-medium text-accent bg-accent/8 hover:bg-accent/18 active:scale-95 border border-accent/25 px-3 py-1.5 rounded-full whitespace-nowrap transition-all disabled:opacity-50 shadow-sm"
                        >
                          {chip}
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Thinking indicator while waiting for first delta */}
              {isStreaming && messages[messages.length - 1]?.content === "" && (
                <div className="flex items-start">
                  <div className="bg-white/85 backdrop-blur-sm text-primary rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1 border border-border/60 shadow-sm">
                    <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:0.15s]" />
                    <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:0.3s]" />
                  </div>
                </div>
              )}

              {/* Reach Us */}
              <div className="mt-2 rounded-2xl border border-border/50 bg-white/60 backdrop-blur-sm p-3">
                <p className="text-[11px] font-bold text-primary uppercase tracking-wider mb-2.5 flex items-center gap-1.5"><Phone className="h-3 w-3" />Reach Us Directly</p>
                <div className="flex flex-col gap-1.5">
                  {REACH_US.map(({ label, href, icon: Icon, color, bg, hint }) => (
                    <a key={label} href={href} target={href.startsWith("mailto") ? undefined : "_blank"} rel="noopener noreferrer"
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border border-border/40 transition-all duration-200 ${bg} group bg-white/40`}
                    >
                      <Icon className="h-4 w-4 shrink-0" style={{ color }} />
                      <div className="leading-tight min-w-0">
                        <span className="text-xs font-semibold text-primary block">{label}</span>
                        <span className="text-[10px] text-muted-foreground truncate block">{hint}</span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
              <div ref={messagesEndRef} />
            </div>

            {/* Suggested questions — AI-updated after each reply */}
            <div className="px-3 pb-2 shrink-0">
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                <AnimatePresence mode="popLayout">
                  {suggestedQuestions.map((q, i) => (
                    <motion.button
                      key={q}
                      initial={{ opacity: 0, y: 8, scale: 0.92 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.88 }}
                      transition={{ delay: i * 0.04, type: "spring", stiffness: 280, damping: 22 }}
                      onClick={() => handleQuickLink(q)}
                      disabled={isStreaming}
                      className="shrink-0 text-[10px] font-medium text-accent bg-accent/8 hover:bg-accent/15 border border-accent/20 px-3 py-1.5 rounded-full whitespace-nowrap transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      {messages.length >= 3 && i === 0 && (
                        <Sparkles className="h-2.5 w-2.5 opacity-60 shrink-0" />
                      )}
                      {q}
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            {/* Input */}
            <div className="p-3 border-t border-border/40 shrink-0" style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)" }}>
              <form onSubmit={handleSend} className="flex gap-2 items-center">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                  placeholder="Ask about doctrine, giving, JCTM..."
                  disabled={isStreaming}
                  autoComplete="off"
                  enterKeyHint="send"
                  className={[
                    "flex-1 min-h-[44px] rounded-xl px-4 py-2.5",
                    "bg-white border border-gray-200",
                    // Explicit text + placeholder colours — never inherits invisibly
                    "text-gray-900 text-base sm:text-sm leading-normal",
                    "placeholder:text-gray-400",
                    // Focus ring
                    "outline-none focus:border-accent focus:ring-2 focus:ring-accent/20",
                    // Disabled state
                    "disabled:cursor-not-allowed disabled:opacity-60",
                    "transition-colors duration-150",
                    // Prevent iOS Safari from zooming on focus (requires font-size ≥ 16px)
                    // text-base above is 1rem = 16px which satisfies this requirement
                  ].join(" ")}
                  aria-label="Type your message"
                />
                <Button type="submit" size="icon" disabled={!input.trim() || isStreaming}
                  className="bg-accent hover:bg-accent/90 active:bg-accent/80 text-white shrink-0 min-h-[44px] min-w-[44px] rounded-xl shadow-md shadow-accent/25 transition-colors"
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

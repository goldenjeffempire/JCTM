import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Bot, Facebook, Youtube, Mail, Phone, Bell, Search, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChatWithTempleBots } from "@workspace/api-client-react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { useLocation } from "wouter";

interface Message {
  id: string;
  role: "user" | "bot";
  content: string;
  sources?: string[];
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

// Hover-triggered predictive whispers per section
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
  { label: "Facebook", href: "https://www.facebook.com/templetvjctm", icon: Facebook, color: "#1877F2", bg: "hover:bg-[#1877F2]/10 hover:border-[#1877F2]/30", hint: "templetvjctm" },
  { label: "Temple TV", href: "https://www.youtube.com/templetvjctm", icon: Youtube, color: "#FF0000", bg: "hover:bg-[#FF0000]/10 hover:border-[#FF0000]/30", hint: "youtube.com/templetvjctm" },
  { label: "Email", href: "mailto:info@jctm.org.ng", icon: Mail, color: "#003366", bg: "hover:bg-[#003366]/10 hover:border-[#003366]/30", hint: "info@jctm.org.ng" },
];

export function TempleBots() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string>();
  const [notification, setNotification] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [scrolledPastHero, setScrolledPastHero] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [searchVal, setSearchVal] = useState("");
  const [whisper, setWhisper] = useState<{ section: string; message: string; cta: string } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const notificationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const whisperTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatMutation = useChatWithTempleBots();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Detect scroll past hero
  useEffect(() => {
    const onScroll = () => setScrolledPastHero(window.scrollY > window.innerHeight * 0.65);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Focus search input when expanded
  useEffect(() => {
    if (searchExpanded && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 150);
    }
  }, [searchExpanded]);

  useEffect(() => {
    setMessages([{ id: "1", role: "bot", content: getContextualGreeting(location) }]);
    setSessionId(undefined);
  }, [location]);

  // Smart scroll-based notifications
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

  // Predictive hover whispers
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

  const handleOpen = useCallback((initialMessage?: string) => {
    setIsOpen(true);
    setNotification(null);
    setShowToast(false);
    setWhisper(null);
    setSearchExpanded(false);
    setSearchVal("");
    if (initialMessage) {
      setTimeout(() => {
        setInput(initialMessage);
      }, 300);
    }
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchVal.trim()) return;
    const q = searchVal.trim();
    setSearchVal("");
    handleOpen(q);
    setTimeout(() => {
      if (!q) return;
      sendMessage(q);
    }, 500);
  };

  const sendMessage = useCallback((text: string) => {
    if (!text.trim() || chatMutation.isPending) return;
    setInput("");
    setMessages(prev => [...prev, { id: Date.now().toString(), role: "user", content: text }]);
    chatMutation.mutate(
      { data: { message: text, sessionId } },
      {
        onSuccess: (data: { sessionId?: string; reply: string; sources?: string[] }) => {
          if (data.sessionId) setSessionId(data.sessionId);
          setMessages(prev => [...prev, { id: Date.now().toString(), role: "bot", content: data.reply, sources: data.sources }]);
        },
        onError: () => {
          setMessages(prev => [...prev, { id: Date.now().toString(), role: "bot", content: "Sorry, I am having trouble connecting right now. Please try again." }]);
        },
      }
    );
  }, [chatMutation, sessionId]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleQuickLink = (q: string) => {
    sendMessage(q);
  };

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
              {/* Auto-dismiss timer bar */}
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

      {/* Floating widget */}
      <AnimatePresence>
        {!isOpen && (
          <LayoutGroup>
            <div className="fixed bottom-6 right-6 z-50 flex items-center justify-end">
              {/* Search pill */}
              <AnimatePresence>
                {scrolledPastHero && searchExpanded && (
                  <motion.form
                    layout key="search-form"
                    initial={{ opacity: 0, width: 0, x: 20 }} animate={{ opacity: 1, width: "auto", x: 0 }} exit={{ opacity: 0, width: 0, x: 20 }}
                    transition={{ type: "spring", stiffness: 300, damping: 28 }}
                    onSubmit={handleSearchSubmit}
                    className="flex items-center mr-3 overflow-hidden"
                  >
                    <div className="flex items-center bg-white/95 backdrop-blur-xl border border-border/50 rounded-full shadow-2xl pl-4 pr-2 py-2 gap-2"
                      style={{ boxShadow: "0 8px 32px rgba(0,51,102,0.15), 0 0 0 1px rgba(56,189,248,0.15)" }}
                    >
                      <Search className="h-4 w-4 text-accent shrink-0" />
                      <input
                        ref={searchInputRef}
                        value={searchVal}
                        onChange={e => setSearchVal(e.target.value)}
                        placeholder="Ask the Digital Sanctuary..."
                        className="text-sm text-primary placeholder:text-muted-foreground/60 bg-transparent outline-none w-52"
                      />
                      <button type="submit" className="h-8 w-8 rounded-full bg-accent hover:bg-accent/90 flex items-center justify-center shrink-0 transition-colors" aria-label="Ask">
                        <ChevronRight className="h-4 w-4 text-white" />
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* Ask pill */}
              <AnimatePresence>
                {scrolledPastHero && !searchExpanded && (
                  <motion.button
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                    onClick={() => setSearchExpanded(true)}
                    className="mr-3 flex items-center gap-2 bg-white/90 backdrop-blur-xl border border-border/50 rounded-full px-4 py-2.5 shadow-lg text-sm text-primary/70 hover:text-primary hover:border-accent/30 transition-all duration-200"
                    style={{ boxShadow: "0 4px 20px rgba(0,51,102,0.1)" }}
                  >
                    <Search className="h-3.5 w-3.5 text-accent" />
                    Ask TempleBots...
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Circle button */}
              <motion.div layout className="relative">
                {notification && (
                  <>
                    <motion.div animate={{ scale: [1, 1.6, 1], opacity: [0.5, 0, 0.5] }} transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }} className="absolute inset-0 rounded-full bg-accent" />
                    <motion.div animate={{ scale: [1, 1.35, 1], opacity: [0.4, 0, 0.4] }} transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 0.3 }} className="absolute inset-0 rounded-full bg-accent" />
                  </>
                )}
                {whisper && !notification && (
                  <motion.div
                    animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut" }}
                    className="absolute inset-0 rounded-full"
                    style={{ background: "rgba(56,189,248,0.4)" }}
                  />
                )}
                <Button
                  onClick={() => {
                    if (searchExpanded) { setSearchExpanded(false); return; }
                    handleOpen();
                  }}
                  size="icon"
                  className="relative h-14 w-14 rounded-full bg-accent hover:bg-accent/90 shadow-xl shadow-accent/30 p-0 overflow-hidden transition-all hover:scale-105"
                  aria-label="Open TempleBots chat"
                >
                  <img src="/jctm-logo.jpeg" alt="TempleBots" className="h-14 w-14 rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  <Bot className="h-6 w-6 text-white hidden absolute" />
                </Button>
                {(notification || whisper) && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
                    <span className="text-white text-[8px] font-bold">1</span>
                  </motion.div>
                )}
              </motion.div>
            </div>
          </LayoutGroup>
        )}
      </AnimatePresence>

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
                  <img src="/jctm-logo.jpeg" alt="JCTM" className="h-9 w-9 rounded-full object-cover ring-2 ring-white/20" />
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
                    className={`max-w-[88%] rounded-2xl px-4 py-2.5 ${msg.role === "user" ? "bg-accent text-white rounded-tr-sm shadow-sm" : "text-primary rounded-tl-sm border border-border/60 shadow-sm"}`}
                    style={msg.role === "bot" ? { background: "rgba(255,255,255,0.85)", backdropFilter: "blur(8px)" } : {}}
                  >
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                  </motion.div>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {msg.sources.map((s, i) => (<span key={i} className="text-[10px] text-muted-foreground bg-secondary/80 px-2 py-0.5 rounded-full">{s}</span>))}
                    </div>
                  )}
                </div>
              ))}

              {chatMutation.isPending && (
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

            {/* Quick-link theological bubbles */}
            <div className="px-3 pb-2 shrink-0">
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {QUICK_LINKS.map((q, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    onClick={() => handleQuickLink(q)}
                    disabled={chatMutation.isPending}
                    className="shrink-0 text-[10px] font-medium text-accent bg-accent/8 hover:bg-accent/15 border border-accent/20 px-3 py-1.5 rounded-full whitespace-nowrap transition-colors disabled:opacity-50"
                  >
                    {q}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Input */}
            <div className="p-3 border-t border-border/40 shrink-0" style={{ background: "rgba(255,255,255,0.7)", backdropFilter: "blur(12px)" }}>
              <form onSubmit={handleSend} className="flex gap-2">
                <Input
                  value={input} onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about doctrine, giving, JCTM..."
                  className="flex-1 bg-white/80 border-border/40 focus-visible:ring-1 focus-visible:ring-accent min-h-[44px] rounded-xl text-sm placeholder:text-muted-foreground/60"
                  disabled={chatMutation.isPending}
                />
                <Button type="submit" size="icon" disabled={!input.trim() || chatMutation.isPending}
                  className="bg-accent hover:bg-accent/90 text-white shrink-0 min-h-[44px] min-w-[44px] rounded-xl shadow-md shadow-accent/25"
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

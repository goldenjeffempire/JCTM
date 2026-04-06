import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, Facebook, Youtube, Mail, Phone, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChatWithTempleBots } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";

interface Message {
  id: string;
  role: "user" | "bot";
  content: string;
  sources?: string[];
}

function getContextualGreeting(path: string): string {
  if (path === "/give" || path.startsWith("/give")) {
    return "Welcome to the Giving Portal. I can help you understand the spiritual significance of seed sowing and what the Word of God says about giving. What would you like to know?";
  }
  if (path === "/our-mandate" || path === "/correction-timeline" || path.startsWith("/correction-timeline")) {
    return "You're exploring the Correction Mandate. Ask me about the specific corrections Prophet Amos is bringing to the church — on prosperity doctrine, prophetic manipulation, or any of the five mandated corrections.";
  }
  if (path === "/sermons" || path.startsWith("/sermons")) {
    return "Welcome to the Sermon Hub. I can help you find teachings on specific topics — Holiness, Baptism, End Times, or Primitive Christianity. What are you studying today?";
  }
  if (path === "/testimonies") {
    return "You're in the Testimony Vault — a record of God's faithfulness. Ask me about the miracles God is doing through the Correction Mandate, or share what's on your heart.";
  }
  if (path === "/about") {
    return "Welcome. I can tell you more about Prophet Amos Evomobor, the Ebrumede Temple, and the divine mandate given to JCTM. What would you like to know?";
  }
  if (path === "/join" || path === "/members") {
    return "Glad you're joining the Digital Sanctuary family. I can answer questions about membership and what it means to be part of this reformation community.";
  }
  if (path === "/events") {
    return "Looking for upcoming gatherings? I can help you understand the significance of our events and services. What's on your mind?";
  }
  return "Welcome to the Digital Sanctuary. I am TempleBots. Ask me anything about JCTM teachings or the Correction Mandate.";
}

const SMART_NOTIFICATIONS: Record<string, string> = {
  giving: "💛 Ready to partner with the Mandate? I can guide you through giving options.",
  testimonies: "✨ Exploring testimonies? I can share more stories of God's faithfulness through JCTM.",
};

const REACH_US = [
  {
    label: "Facebook",
    href: "https://www.facebook.com/templetvjctm",
    icon: Facebook,
    color: "#1877F2",
    bg: "hover:bg-[#1877F2]/10 hover:border-[#1877F2]/30",
    hint: "templetvjctm",
  },
  {
    label: "Temple TV",
    href: "https://www.youtube.com/templetvjctm",
    icon: Youtube,
    color: "#FF0000",
    bg: "hover:bg-[#FF0000]/10 hover:border-[#FF0000]/30",
    hint: "youtube.com/templetvjctm",
  },
  {
    label: "Email",
    href: "mailto:jesuschristtempleministryng@gmail.com",
    icon: Mail,
    color: "#003366",
    bg: "hover:bg-[#003366]/10 hover:border-[#003366]/30",
    hint: "Write to us",
  },
];

export function TempleBots() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string>();
  const [notification, setNotification] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const notificationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chatMutation = useChatWithTempleBots();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([
      { id: "1", role: "bot", content: getContextualGreeting(location) }
    ]);
    setSessionId(undefined);
  }, [location]);

  // Listen for section enter events from Home page
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleOpen = () => {
    setIsOpen(true);
    setNotification(null);
    setShowToast(false);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatMutation.isPending) return;

    const userMessage = input.trim();
    setInput("");

    setMessages(prev => [...prev, { id: Date.now().toString(), role: "user", content: userMessage }]);

    chatMutation.mutate(
      { data: { message: userMessage, sessionId } },
      {
        onSuccess: (data) => {
          if (data.sessionId) setSessionId(data.sessionId);
          setMessages(prev => [
            ...prev,
            {
              id: Date.now().toString(),
              role: "bot",
              content: data.reply,
              sources: data.sources
            }
          ]);
        },
        onError: () => {
          setMessages(prev => [
            ...prev,
            { id: Date.now().toString(), role: "bot", content: "Sorry, I am having trouble connecting right now. Please try again." }
          ]);
        }
      }
    );
  };

  return (
    <>
      {/* Smart notification toast */}
      <AnimatePresence>
        {showToast && notification && !isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 60, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className="fixed bottom-24 right-6 z-50 max-w-[260px] bg-white rounded-2xl shadow-xl border border-border p-4 cursor-pointer"
            onClick={handleOpen}
          >
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-accent/15 flex items-center justify-center shrink-0 mt-0.5">
                <Bell className="h-4 w-4 text-accent" />
              </div>
              <div>
                <p className="text-primary font-semibold text-xs mb-1">TempleBots</p>
                <p className="text-muted-foreground text-xs leading-relaxed">{notification}</p>
              </div>
            </div>
            {/* Auto-dismiss progress bar */}
            <motion.div
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: 6, ease: "linear" }}
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent origin-left rounded-b-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <div className="relative">
              {/* Pulse ring when notification is active */}
              {notification && (
                <>
                  <motion.div
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                    className="absolute inset-0 rounded-full bg-accent"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.35, 1], opacity: [0.4, 0, 0.4] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 0.3 }}
                    className="absolute inset-0 rounded-full bg-accent"
                  />
                </>
              )}

              <Button
                onClick={handleOpen}
                size="icon"
                className="relative h-14 w-14 rounded-full bg-accent hover:bg-accent/90 shadow-xl shadow-accent/30 p-0 overflow-hidden transition-all hover:scale-105"
                aria-label="Open TempleBots chat"
              >
                <img
                  src="/jctm-logo.jpeg"
                  alt="TempleBots"
                  className="h-14 w-14 rounded-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                    const next = (e.target as HTMLImageElement).nextElementSibling;
                    if (next) (next as HTMLElement).classList.remove("hidden");
                  }}
                />
                <MessageCircle className="h-6 w-6 text-accent-foreground hidden" />
              </Button>

              {/* Notification dot */}
              {notification && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full border-2 border-white flex items-center justify-center"
                >
                  <span className="text-white text-[8px] font-bold">1</span>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-3rem)] h-[540px] max-h-[calc(100vh-6rem)] glass-panel rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            style={{
              background: "rgba(255, 254, 248, 0.95)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(0,51,102,0.1)",
            }}
          >
            {/* Header */}
            <div className="bg-primary text-primary-foreground p-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <img
                    src="/jctm-logo.jpeg"
                    alt="JCTM"
                    className="h-8 w-8 rounded-full object-cover ring-2 ring-white/30"
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 bg-emerald-400 rounded-full border border-primary" />
                </div>
                <div className="leading-tight">
                  <span className="font-semibold text-sm block">TempleBots</span>
                  <span className="text-[10px] text-white/60">JCTM Digital Sanctuary · Online</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-primary/80 text-primary-foreground"
                onClick={() => setIsOpen(false)}
                aria-label="Close chat"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.2 }}
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                      msg.role === "user"
                        ? "bg-accent text-accent-foreground rounded-tr-sm shadow-sm"
                        : "bg-white text-primary rounded-tl-sm border border-border shadow-sm"
                    }`}
                  >
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                  </motion.div>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {msg.sources.map((s, i) => (
                        <span key={i} className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                          Source: {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {chatMutation.isPending && (
                <div className="flex items-start">
                  <div className="bg-white text-primary rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1 border border-border shadow-sm">
                    <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              )}

              {/* Reach Us Card */}
              <div className="mt-2 rounded-xl border border-border bg-white/80 p-3">
                <p className="text-[11px] font-bold text-primary uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Phone className="h-3 w-3" /> Reach Us Directly
                </p>
                <div className="flex flex-col gap-2">
                  {REACH_US.map(({ label, href, icon: Icon, color, bg, hint }) => (
                    <a
                      key={label}
                      href={href}
                      target={href.startsWith("mailto") ? undefined : "_blank"}
                      rel="noopener noreferrer"
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border/50 transition-all duration-200 ${bg} group`}
                    >
                      <Icon className="h-4 w-4 shrink-0 transition-colors" style={{ color }} />
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

            {/* Input */}
            <div className="p-3 bg-white/80 border-t border-border shrink-0">
              <form onSubmit={handleSend} className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about JCTM..."
                  className="flex-1 bg-secondary border-none focus-visible:ring-1 focus-visible:ring-accent min-h-[44px]"
                  disabled={chatMutation.isPending}
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!input.trim() || chatMutation.isPending}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground shrink-0 min-h-[44px] min-w-[44px]"
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

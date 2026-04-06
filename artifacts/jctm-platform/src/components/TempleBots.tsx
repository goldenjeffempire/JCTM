import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, Facebook, Youtube, Mail, Phone } from "lucide-react";
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

  const chatMutation = useChatWithTempleBots();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([
      { id: "1", role: "bot", content: getContextualGreeting(location) }
    ]);
    setSessionId(undefined);
  }, [location]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

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
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <Button
              onClick={() => setIsOpen(true)}
              size="icon"
              className="h-14 w-14 rounded-full bg-accent hover:bg-accent/90 shadow-lg p-0 overflow-hidden"
              aria-label="Open TempleBots chat"
            >
              <img
                src="/jctm-logo.jpeg"
                alt="TempleBots"
                className="h-14 w-14 rounded-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                  (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                }}
              />
              <MessageCircle className="h-6 w-6 text-accent-foreground hidden" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-3rem)] h-[540px] max-h-[calc(100vh-6rem)] glass-panel rounded-xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-primary text-primary-foreground p-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <img
                  src="/jctm-logo.jpeg"
                  alt="JCTM"
                  className="h-8 w-8 rounded-full object-cover ring-2 ring-white/30"
                />
                <div className="leading-tight">
                  <span className="font-semibold text-sm block">TempleBots</span>
                  <span className="text-[10px] text-white/60">JCTM Digital Sanctuary</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-primary/80 text-primary-foreground"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                    msg.role === "user"
                      ? "bg-accent text-accent-foreground rounded-tr-sm"
                      : "glass-panel bg-white text-primary rounded-tl-sm border border-border"
                  }`}>
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                  </div>
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
                  <div className="glass-panel bg-white text-primary rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1">
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
            <div className="p-3 bg-white border-t border-border shrink-0">
              <form onSubmit={handleSend} className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about JCTM..."
                  className="flex-1 bg-secondary border-none focus-visible:ring-1 focus-visible:ring-accent"
                  disabled={chatMutation.isPending}
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!input.trim() || chatMutation.isPending}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground shrink-0"
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

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Send, X, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ChatMessage {
  id: string;
  username: string;
  message: string;
  timestamp: number;
  isModerated?: boolean;
}

interface PrayerRequest {
  id: string;
  name: string;
  prayer: string;
  timestamp: number;
  prayCount: number;
}

interface SSEData {
  type: "history" | "message" | "count" | "reaction" | "prayer_history" | "prayer_new" | "pray_count";
  messages?: ChatMessage[];
  message?: ChatMessage;
  count?: number;
  messageId?: string;
  reaction?: string;
  prayers?: PrayerRequest[];
  prayer?: PrayerRequest;
  prayerId?: string;
  prayCount?: number;
}

const REACTIONS = ["🙏", "🔥", "❤️", "🕊️", "💯", "⚡", "👏"];

function getStoredUsername(): string {
  return localStorage.getItem("jctm-chat-username") ?? "";
}

interface LiveChatProps {
  isLive?: boolean;
  embedded?: boolean;
}

export function LiveChat({ isLive = false, embedded = false }: LiveChatProps) {
  const [isOpen, setIsOpen] = useState(embedded);
  const [sidebarTab, setSidebarTab] = useState<"chat" | "prayer">("chat");

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [viewerCount, setViewerCount] = useState(0);
  const [input, setInput] = useState("");
  const [username, setUsername] = useState(getStoredUsername);
  const [usernameSet, setUsernameSet] = useState(() => !!getStoredUsername());
  const [pendingUsername, setPendingUsername] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [reactions, setReactions] = useState<Record<string, { emoji: string; count: number }>>({});
  const [floatingReactions, setFloatingReactions] = useState<Array<{ id: string; emoji: string }>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Prayer state
  const [prayers, setPrayers] = useState<PrayerRequest[]>([]);
  const [prayedFor, setPrayedFor] = useState<Set<string>>(new Set());
  const [prayerName, setPrayerName] = useState("");
  const [prayerText, setPrayerText] = useState("");
  const [prayerSubmitting, setPrayerSubmitting] = useState(false);
  const [prayerSubmitted, setPrayerSubmitted] = useState(false);
  const [prayerError, setPrayerError] = useState("");
  const prayersEndRef = useRef<HTMLDivElement>(null);

  const esRef = useRef<EventSource | null>(null);

  const connectSSE = useCallback(() => {
    if (esRef.current) esRef.current.close();
    const es = new EventSource(`${BASE}/api/livechat/stream`);
    esRef.current = es;
    es.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as SSEData;
        if (data.type === "history" && data.messages) {
          setMessages(data.messages);
        } else if (data.type === "message" && data.message) {
          setMessages(prev => [...prev.slice(-99), data.message!]);
        } else if (data.type === "count" && data.count !== undefined) {
          setViewerCount(data.count);
        } else if (data.type === "reaction" && data.messageId && data.reaction) {
          setReactions(prev => ({
            ...prev,
            [data.messageId!]: { emoji: data.reaction!, count: (prev[data.messageId!]?.count ?? 0) + 1 },
          }));
          const rid = `${Date.now()}-${Math.random()}`;
          setFloatingReactions(prev => [...prev, { id: rid, emoji: data.reaction! }]);
          setTimeout(() => setFloatingReactions(prev => prev.filter(r => r.id !== rid)), 2500);
        } else if (data.type === "prayer_history" && data.prayers) {
          setPrayers(data.prayers);
        } else if (data.type === "prayer_new" && data.prayer) {
          setPrayers(prev => [...prev, data.prayer!]);
        } else if (data.type === "pray_count" && data.prayerId && data.prayCount !== undefined) {
          setPrayers(prev =>
            prev.map(p => p.id === data.prayerId ? { ...p, prayCount: data.prayCount! } : p)
          );
        }
      } catch { /* ignore */ }
    };
    es.onerror = () => {
      es.close();
      setTimeout(() => connectSSE(), 3000);
    };
    return () => es.close();
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const cleanup = connectSSE();
    return cleanup;
  }, [isOpen, connectSSE]);

  useEffect(() => {
    if (embedded) setIsOpen(true);
  }, [embedded]);

  useEffect(() => {
    if (sidebarTab === "chat" && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, sidebarTab]);

  useEffect(() => {
    if (sidebarTab === "prayer" && prayersEndRef.current) {
      prayersEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [prayers, sidebarTab]);

  // Populate prayer name from username when switching to prayer tab
  useEffect(() => {
    if (sidebarTab === "prayer" && username && !prayerName) {
      setPrayerName(username);
    }
  }, [sidebarTab, username, prayerName]);

  const sendMessage = async () => {
    const msg = input.trim();
    if (!msg || !username || isSending) return;
    setIsSending(true);
    setInput("");
    try {
      await fetch(`${BASE}/api/livechat/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, message: msg }),
      });
    } catch { /* ignore */ }
    finally { setIsSending(false); }
  };

  const reactToMessage = async (messageId: string, reaction: string) => {
    await fetch(`${BASE}/api/livechat/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, reaction }),
    });
  };

  const submitPrayer = async () => {
    const name = prayerName.trim();
    const prayer = prayerText.trim();
    if (!name || !prayer || prayerSubmitting) return;
    setPrayerSubmitting(true);
    setPrayerError("");
    try {
      const res = await fetch(`${BASE}/api/livechat/prayer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, prayer }),
      });
      if (res.ok) {
        setPrayerText("");
        setPrayerSubmitted(true);
        setTimeout(() => setPrayerSubmitted(false), 4000);
      } else {
        const err = await res.json() as { error?: string };
        setPrayerError(err.error ?? "Failed to submit. Please try again.");
      }
    } catch {
      setPrayerError("Connection error. Please try again.");
    } finally {
      setPrayerSubmitting(false);
    }
  };

  const prayForRequest = async (prayerId: string) => {
    if (prayedFor.has(prayerId)) return;
    setPrayedFor(prev => new Set([...prev, prayerId]));
    await fetch(`${BASE}/api/livechat/pray`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prayerId }),
    });
  };

  const handleSetUsername = () => {
    const u = pendingUsername.trim().slice(0, 30);
    if (!u) return;
    setUsername(u);
    setUsernameSet(true);
    localStorage.setItem("jctm-chat-username", u);
    setPrayerName(u);
  };

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (!isLive) return null;

  // ─────────────────────────────────────────────
  // Shared: Tab switcher used in both modes
  // ─────────────────────────────────────────────
  const TabSwitcher = ({ dark }: { dark: boolean }) => (
    <div className={`flex shrink-0 border-b ${dark ? "border-white/10 bg-white/5" : "border-border bg-muted/30"}`}>
      <button
        onClick={() => setSidebarTab("chat")}
        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${
          sidebarTab === "chat"
            ? dark
              ? "text-white border-b-2 border-sky-400"
              : "text-primary border-b-2 border-primary"
            : dark
              ? "text-white/40 hover:text-white/70"
              : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <MessageSquare className="w-3.5 h-3.5" />
        Live Chat
      </button>
      <button
        onClick={() => setSidebarTab("prayer")}
        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors relative ${
          sidebarTab === "prayer"
            ? dark
              ? "text-amber-400 border-b-2 border-amber-400"
              : "text-amber-600 border-b-2 border-amber-500"
            : dark
              ? "text-white/40 hover:text-white/70"
              : "text-muted-foreground hover:text-foreground"
        }`}
      >
        🙏 Prayer
        {prayers.length > 0 && sidebarTab !== "prayer" && (
          <span className={`absolute top-1.5 right-5 text-[9px] font-bold rounded-full px-1 ${dark ? "bg-amber-400 text-black" : "bg-amber-500 text-white"}`}>
            {prayers.length}
          </span>
        )}
      </button>
    </div>
  );

  // ─────────────────────────────────────────────
  // Shared: Prayer tab content
  // ─────────────────────────────────────────────
  const PrayerPanel = ({ dark }: { dark: boolean }) => (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Prayer feed */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-hide">
        {prayers.length === 0 && (
          <div className={`text-center text-xs py-10 ${dark ? "text-white/40" : "text-muted-foreground"}`}>
            <div className="text-3xl mb-2">🙏</div>
            No prayer requests yet — be the first to share yours.
          </div>
        )}
        <AnimatePresence initial={false}>
          {[...prayers].reverse().map(p => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
              className={`rounded-2xl p-3 border ${dark ? "bg-white/5 border-white/10" : "bg-muted/50 border-border"}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-xs font-semibold ${dark ? "text-amber-400" : "text-amber-600"}`}>{p.name}</span>
                <span className={`text-[10px] ${dark ? "text-white/30" : "text-muted-foreground"}`}>{formatTime(p.timestamp)}</span>
              </div>
              <p className={`text-xs leading-relaxed mb-2.5 ${dark ? "text-white/80" : "text-foreground/80"}`}>{p.prayer}</p>
              <button
                onClick={() => prayForRequest(p.id)}
                disabled={prayedFor.has(p.id)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                  prayedFor.has(p.id)
                    ? dark
                      ? "bg-amber-400/20 text-amber-400 cursor-default"
                      : "bg-amber-100 text-amber-600 cursor-default"
                    : dark
                      ? "bg-white/10 text-white/70 hover:bg-amber-400/20 hover:text-amber-400"
                      : "bg-muted text-muted-foreground hover:bg-amber-100 hover:text-amber-600"
                }`}
              >
                🙏 {prayedFor.has(p.id) ? "Praying" : "Pray for this"}
                {p.prayCount > 0 && (
                  <span className={`ml-1 font-bold ${dark ? "text-amber-300" : "text-amber-600"}`}>· {p.prayCount}</span>
                )}
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={prayersEndRef} />
      </div>

      {/* Submit prayer */}
      <div className={`px-4 py-3 border-t shrink-0 ${dark ? "border-white/10 bg-white/5" : "border-border"}`}>
        {prayerSubmitted ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`text-center py-3 rounded-xl text-sm font-medium ${dark ? "bg-amber-400/15 text-amber-300" : "bg-amber-100 text-amber-700"}`}
          >
            🙏 Your prayer request has been shared
          </motion.div>
        ) : (
          <div className="space-y-2">
            <input
              className={`w-full text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 ${
                dark
                  ? "bg-white/10 border border-white/20 text-white placeholder:text-white/30 focus:ring-amber-400/30"
                  : "bg-background border border-border placeholder:text-muted-foreground focus:ring-amber-500/30"
              }`}
              placeholder="Your name"
              value={prayerName}
              onChange={e => setPrayerName(e.target.value)}
              maxLength={40}
            />
            <textarea
              className={`w-full text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 resize-none ${
                dark
                  ? "bg-white/10 border border-white/20 text-white placeholder:text-white/30 focus:ring-amber-400/30"
                  : "bg-background border border-border placeholder:text-muted-foreground focus:ring-amber-500/30"
              }`}
              placeholder="Share your prayer point... (max 500 characters)"
              value={prayerText}
              onChange={e => setPrayerText(e.target.value)}
              maxLength={500}
              rows={3}
            />
            {prayerError && (
              <p className={`text-[10px] ${dark ? "text-red-400" : "text-red-500"}`}>{prayerError}</p>
            )}
            <button
              onClick={submitPrayer}
              disabled={!prayerName.trim() || !prayerText.trim() || prayerSubmitting}
              className={`w-full py-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                dark
                  ? "bg-amber-500 hover:bg-amber-400 text-black"
                  : "bg-amber-500 hover:bg-amber-600 text-white"
              }`}
            >
              {prayerSubmitting ? "Submitting…" : "🙏 Submit Prayer Request"}
            </button>
            <p className={`text-[10px] text-center ${dark ? "text-white/25" : "text-muted-foreground"}`}>
              All prayer requests are visible to other viewers
            </p>
          </div>
        )}
      </div>
    </div>
  );

  // ─────────────────────────────────────────────
  // Chat tab content (shared)
  // ─────────────────────────────────────────────
  const ChatPanel = ({ dark }: { dark: boolean }) => (
    <>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-hide">
        {messages.length === 0 && (
          <div className={`text-center text-xs py-8 ${dark ? "text-white/40" : "text-muted-foreground"}`}>
            Be the first to send a message!
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="group"
            >
              <div className={`text-xs ${msg.username === username ? "text-right" : ""}`}>
                <span className={`font-semibold ${dark ? "text-sky-400" : "text-primary"}`}>{msg.username}</span>
                <span className={`ml-1 ${dark ? "text-white/40" : "text-muted-foreground"}`}>{formatTime(msg.timestamp)}</span>
              </div>
              <div className={`mt-0.5 flex items-end gap-1 ${msg.username === username ? "justify-end" : ""}`}>
                <div className={`max-w-[85%] text-sm px-3 py-2 rounded-2xl ${
                  msg.username === username
                    ? dark ? "bg-sky-600 text-white rounded-br-sm" : "bg-primary text-white rounded-br-sm"
                    : dark ? "bg-white/10 text-white rounded-bl-sm" : "bg-muted rounded-bl-sm"
                }`}>
                  {msg.message}
                </div>
                {msg.username !== username && (
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {REACTIONS.slice(0, 3).map(r => (
                      <button
                        key={r}
                        onClick={() => reactToMessage(msg.id, r)}
                        className="text-xs hover:scale-125 transition-transform"
                        title={r}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {reactions[msg.id] && (
                <div className={`text-xs mt-1 ${msg.username === username ? "text-right" : ""}`}>
                  <span className={`rounded-full px-2 py-0.5 ${dark ? "bg-white/10 text-white/70" : "bg-muted"}`}>
                    {reactions[msg.id].emoji} {reactions[msg.id].count}
                  </span>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className={`px-4 py-3 border-t shrink-0 ${dark ? "border-white/10 bg-white/5" : "border-border"}`}>
        <div className="flex gap-2">
          <input
            className={`flex-1 text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 ${
              dark
                ? "bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:ring-sky-400/40"
                : "bg-background border border-border focus:ring-sky-400/30"
            }`}
            placeholder="Say something..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()}
            maxLength={300}
            disabled={isSending}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isSending}
            className={`px-3 py-2 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
              dark ? "bg-sky-500 hover:bg-sky-400 text-white" : "bg-primary hover:bg-primary/90 text-white"
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {REACTIONS.map(r => (
            <button
              key={r}
              className="text-base hover:scale-125 transition-transform"
              onClick={() => setInput(i => i + r)}
              title={r}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
    </>
  );

  // ─────────────────────────────────────────────
  // Username setup (shared)
  // ─────────────────────────────────────────────
  const UsernameSetup = ({ dark }: { dark: boolean }) => (
    <div className="flex-1 flex flex-col items-center justify-center px-5 gap-4">
      <MessageSquare className={`w-10 h-10 opacity-60 ${dark ? "text-sky-400" : "text-sky-500"}`} />
      <div className="text-center">
        <div className={`font-semibold mb-1 ${dark ? "text-white" : "text-primary"}`}>Join the Conversation</div>
        <div className={`text-xs ${dark ? "text-white/50" : "text-muted-foreground"}`}>
          Choose a display name to chat and submit prayer requests
        </div>
      </div>
      <input
        className={`w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 ${
          dark
            ? "border border-white/20 bg-white/10 text-white placeholder:text-white/40 focus:ring-sky-400/40"
            : "border border-border bg-background focus:ring-sky-400/30"
        }`}
        placeholder="Your name (e.g. Bro Emmanuel)"
        value={pendingUsername}
        onChange={e => setPendingUsername(e.target.value)}
        onKeyDown={e => e.key === "Enter" && handleSetUsername()}
        maxLength={30}
      />
      <Button
        onClick={handleSetUsername}
        disabled={!pendingUsername.trim()}
        className={`w-full ${dark ? "bg-sky-500 hover:bg-sky-400 text-white border-0" : ""}`}
      >
        Join Chat
      </Button>
    </div>
  );

  // ─────────────────────────────────────────────
  // EMBEDDED MODE
  // ─────────────────────────────────────────────
  if (embedded) {
    return (
      <div className="flex flex-col h-full relative overflow-hidden">
        {/* Floating reaction animations */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden z-20">
          <AnimatePresence>
            {floatingReactions.map(r => (
              <motion.div
                key={r.id}
                initial={{ opacity: 1, y: 0, x: `${20 + Math.random() * 60}%` }}
                animate={{ opacity: 0, y: -120 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2.2, ease: "easeOut" }}
                className="absolute bottom-16 text-2xl"
              >
                {r.emoji}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-white/5 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="font-semibold text-sm text-white">Live</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-white/60">
            <Users className="w-3.5 h-3.5" />
            <span>{viewerCount} watching</span>
          </div>
        </div>

        {/* Tab switcher */}
        <TabSwitcher dark />

        {!usernameSet ? (
          <UsernameSetup dark />
        ) : (
          <div className="flex flex-col flex-1 min-h-0">
            {sidebarTab === "chat" && <ChatPanel dark />}
            {sidebarTab === "prayer" && <PrayerPanel dark />}
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // FLOATING MODE (SermonDetail / other pages)
  // ─────────────────────────────────────────────
  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-24 right-6 z-50 bg-primary hover:bg-primary/90 text-white rounded-full shadow-lg p-4 flex items-center gap-2 transition-colors"
          >
            <MessageSquare className="w-5 h-5" />
            <span className="text-sm font-medium pr-1">Live Chat</span>
            {viewerCount > 0 && (
              <Badge className="bg-red-500 text-white text-xs h-5 px-1.5 ml-1">
                {viewerCount}
              </Badge>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="fixed bottom-6 right-6 z-50 w-80 md:w-96 glass-panel border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            style={{ height: "560px" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary/5 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="font-semibold text-sm text-primary">Live</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="w-3.5 h-3.5" />
                  {viewerCount}
                </div>
                <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tab switcher */}
            <TabSwitcher dark={false} />

            {!usernameSet ? (
              <UsernameSetup dark={false} />
            ) : (
              <div className="flex flex-col flex-1 min-h-0">
                {sidebarTab === "chat" && <ChatPanel dark={false} />}
                {sidebarTab === "prayer" && <PrayerPanel dark={false} />}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

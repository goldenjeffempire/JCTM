/**
 * LiveChat — production-ready real-time live chat + prayer panel.
 *
 * Key reliability features:
 *  • Stable session-id (sessionStorage) → server deduplicates viewer count
 *  • Exponential-backoff SSE reconnect (1 s → 2 → 4 → 8 → 16 → 30 s max)
 *  • Connection status indicator (connected / reconnecting / disconnected)
 *  • Message deduplication on reconnect — no duplicates when SSE restarts
 *  • Optimistic message sending with client-id (cid) reconciliation
 *  • Input is restored if the POST request fails
 *  • Smart auto-scroll — only scrolls down when already near the bottom;
 *    shows a "New messages" badge when the user has scrolled up
 *  • Character counter on the chat input
 *  • Render helpers instead of JSX component definitions inside the
 *    component body — avoids React unmounting/remounting UI on every re-render
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Send, X, Users, ChevronDown, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const MSG_MAX = 300;
const NEAR_BOTTOM_PX = 120; // px from bottom to consider "at bottom"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  username: string;
  message: string;
  timestamp: number;
  isModerated?: boolean;
  cid?: string;       // client-generated temp id for optimistic UI
  pending?: boolean;  // optimistic only — not from server
}

interface PrayerRequest {
  id: string;
  name: string;
  prayer: string;
  timestamp: number;
  prayCount: number;
}

type SSEEvent =
  | { type: "history";       messages: ChatMessage[] }
  | { type: "message";       message: ChatMessage }
  | { type: "count";         count: number }
  | { type: "reaction";      messageId: string; reaction: string }
  | { type: "prayer_history"; prayers: PrayerRequest[] }
  | { type: "prayer_new";    prayer: PrayerRequest }
  | { type: "pray_count";    prayerId: string; prayCount: number };

type ConnStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

const REACTIONS = ["🙏", "🔥", "❤️", "🕊️", "💯", "⚡", "👏"];

// ─── Session ID ───────────────────────────────────────────────────────────────
// Stable per-browser-session so the server can deduplicate viewer count
// across page refreshes and SSE reconnections.

function getSessionId(): string {
  const key = "jctm-chat-sid";
  const stored = sessionStorage.getItem(key);
  if (stored) return stored;
  const id = crypto.randomUUID();
  sessionStorage.setItem(key, id);
  return id;
}

function getStoredUsername(): string {
  return localStorage.getItem("jctm-chat-username") ?? "";
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─── Component ────────────────────────────────────────────────────────────────

interface LiveChatProps {
  isLive?: boolean;
  embedded?: boolean;
}

export function LiveChat({ isLive = false, embedded = false }: LiveChatProps) {
  // ── Connection state ──────────────────────────────────────────────────────
  const [isOpen, setIsOpen] = useState(embedded);
  const [connStatus, setConnStatus] = useState<ConnStatus>("connecting");
  const [viewerCount, setViewerCount] = useState(0);

  // ── Chat state ────────────────────────────────────────────────────────────
  const [sidebarTab, setSidebarTab] = useState<"chat" | "prayer">("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [username, setUsername] = useState(getStoredUsername);
  const [usernameSet, setUsernameSet] = useState(() => !!getStoredUsername());
  const [pendingUsername, setPendingUsername] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [reactions, setReactions] = useState<Record<string, { emoji: string; count: number }>>({});
  const [floatingReactions, setFloatingReactions] = useState<Array<{ id: string; emoji: string }>>([]);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [newMsgCount, setNewMsgCount] = useState(0);

  // ── Prayer state ──────────────────────────────────────────────────────────
  const [prayers, setPrayers] = useState<PrayerRequest[]>([]);
  const [prayedFor, setPrayedFor] = useState<Set<string>>(new Set());
  const [prayerName, setPrayerName] = useState("");
  const [prayerText, setPrayerText] = useState("");
  const [prayerSubmitting, setPrayerSubmitting] = useState(false);
  const [prayerSubmitted, setPrayerSubmitted] = useState(false);
  const [prayerError, setPrayerError] = useState("");

  // ── Refs ──────────────────────────────────────────────────────────────────
  const esRef = useRef<EventSource | null>(null);
  const reconnectDelayRef = useRef(1_000);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectFnRef = useRef<() => void>(() => { /* assigned below */ });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const prayersEndRef = useRef<HTMLDivElement>(null);
  const sessionId = useRef(getSessionId()).current;

  // ── SSE connection with exponential-backoff reconnect ─────────────────────

  const connectSSE = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    setConnStatus("connecting");
    const url = `${BASE}/api/livechat/stream?sid=${encodeURIComponent(sessionId)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      reconnectDelayRef.current = 1_000; // reset backoff on success
      setConnStatus("connected");
    };

    es.onmessage = (event: MessageEvent) => {
      let data: SSEEvent;
      try { data = JSON.parse(event.data as string) as SSEEvent; }
      catch { return; }

      if (data.type === "history") {
        setMessages(prev => {
          if (prev.length === 0) return data.messages;
          // Reconnect: append only messages we haven't seen yet
          const seen = new Set(prev.map(m => m.id));
          const fresh = data.messages.filter(m => !seen.has(m.id));
          return fresh.length ? [...prev, ...fresh].slice(-100) : prev;
        });
      } else if (data.type === "message") {
        setMessages(prev => {
          // If this echoes an optimistic message, replace it
          if (data.message.cid) {
            const idx = prev.findIndex(m => m.pending && m.cid === data.message.cid);
            if (idx !== -1) {
              const next = [...prev];
              next[idx] = { ...data.message, pending: false };
              return next;
            }
          }
          // Deduplicate by id (can arrive again via history on reconnect)
          if (prev.some(m => m.id === data.message.id)) return prev;
          const next = [...prev.slice(-99), data.message];
          // If user has scrolled up, increment badge instead of forcing scroll
          const el = chatScrollRef.current;
          if (el && el.scrollHeight - el.scrollTop - el.clientHeight > NEAR_BOTTOM_PX) {
            setNewMsgCount(c => c + 1);
          }
          return next;
        });
      } else if (data.type === "count") {
        setViewerCount(data.count);
      } else if (data.type === "reaction") {
        setReactions(prev => ({
          ...prev,
          [data.messageId]: {
            emoji: data.reaction,
            count: (prev[data.messageId]?.count ?? 0) + 1,
          },
        }));
        const rid = `${Date.now()}-${Math.random()}`;
        setFloatingReactions(prev => [...prev, { id: rid, emoji: data.reaction }]);
        setTimeout(() => setFloatingReactions(prev => prev.filter(r => r.id !== rid)), 2_500);
      } else if (data.type === "prayer_history") {
        setPrayers(data.prayers);
      } else if (data.type === "prayer_new") {
        setPrayers(prev => [...prev, data.prayer]);
      } else if (data.type === "pray_count") {
        setPrayers(prev =>
          prev.map(p => p.id === data.prayerId ? { ...p, prayCount: data.prayCount } : p)
        );
      }
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
      setConnStatus("reconnecting");
      const delay = reconnectDelayRef.current;
      reconnectDelayRef.current = Math.min(delay * 2, 30_000);
      reconnectTimerRef.current = setTimeout(() => connectFnRef.current(), delay);
    };
  }, [sessionId]);

  // Keep ref in sync so the onerror closure always calls the latest version
  connectFnRef.current = connectSSE;

  // Open SSE when chat panel is opened
  useEffect(() => {
    if (!isOpen) return;
    connectSSE();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      esRef.current?.close();
      esRef.current = null;
    };
  }, [isOpen, connectSSE]);

  // Embedded mode: open immediately on mount
  useEffect(() => {
    if (embedded) setIsOpen(true);
  }, [embedded]);

  // Pre-fill prayer name when switching to prayer tab
  useEffect(() => {
    if (sidebarTab === "prayer" && username && !prayerName) {
      setPrayerName(username);
    }
  }, [sidebarTab, username, prayerName]);

  // Auto-scroll to bottom only when already near bottom
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX;
    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setNewMsgCount(0);
    }
  }, [messages]);

  // ── Scroll tracking ───────────────────────────────────────────────────────

  const handleScroll = () => {
    const el = chatScrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX;
    setShowScrollBtn(!atBottom);
    if (atBottom) setNewMsgCount(0);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setNewMsgCount(0);
    setShowScrollBtn(false);
  };

  // ── Send message ──────────────────────────────────────────────────────────

  const sendMessage = async () => {
    const msg = input.trim();
    if (!msg || !username || isSending) return;

    const cid = crypto.randomUUID();
    const optimistic: ChatMessage = {
      id: `pending-${cid}`,
      username,
      message: msg,
      timestamp: Date.now(),
      isModerated: false,
      cid,
      pending: true,
    };

    setMessages(prev => [...prev, optimistic]);
    setIsSending(true);
    setInput("");

    // Scroll to show the optimistic message
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    try {
      const res = await fetch(`${BASE}/api/livechat/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, message: msg, cid }),
      });
      if (!res.ok) {
        // Remove optimistic message and restore input
        setMessages(prev => prev.filter(m => m.cid !== cid));
        setInput(msg);
      }
    } catch {
      setMessages(prev => prev.filter(m => m.cid !== cid));
      setInput(msg);
    } finally {
      setIsSending(false);
    }
  };

  const reactToMessage = async (messageId: string, reaction: string) => {
    await fetch(`${BASE}/api/livechat/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, reaction }),
    });
  };

  // ── Username setup ────────────────────────────────────────────────────────

  const handleSetUsername = () => {
    const u = pendingUsername.trim().slice(0, 30);
    if (!u) return;
    setUsername(u);
    setUsernameSet(true);
    setPrayerName(u);
    localStorage.setItem("jctm-chat-username", u);
  };

  // ── Prayer submission ─────────────────────────────────────────────────────

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
        setTimeout(() => setPrayerSubmitted(false), 4_000);
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
    try {
      await fetch(`${BASE}/api/livechat/pray`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prayerId }),
      });
    } catch {
      // Roll back if request failed
      setPrayedFor(prev => { const s = new Set(prev); s.delete(prayerId); return s; });
    }
  };

  if (!isLive) return null;

  // ─── Render helpers ───────────────────────────────────────────────────────
  // Defined as plain functions (not React components) so React never
  // unmounts/remounts the DOM when the parent re-renders.

  const renderConnectionDot = (dark: boolean) => {
    if (connStatus === "connected") return null; // silent when healthy
    const label = connStatus === "reconnecting" ? "Reconnecting…" : "Disconnected";
    const icon = connStatus === "reconnecting"
      ? <Wifi className="w-3 h-3 animate-pulse" />
      : <WifiOff className="w-3 h-3" />;
    return (
      <div className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${
        connStatus === "reconnecting"
          ? dark ? "bg-amber-400/20 text-amber-300" : "bg-amber-100 text-amber-700"
          : dark ? "bg-red-500/20 text-red-400" : "bg-red-100 text-red-600"
      }`}>
        {icon}
        {label}
      </div>
    );
  };

  const renderTabSwitcher = (dark: boolean) => (
    <div className={`flex shrink-0 border-b ${dark ? "border-white/10 bg-white/5" : "border-border bg-muted/30"}`}>
      <button
        onClick={() => setSidebarTab("chat")}
        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${
          sidebarTab === "chat"
            ? dark ? "text-white border-b-2 border-sky-400" : "text-primary border-b-2 border-primary"
            : dark ? "text-white/40 hover:text-white/70" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <MessageSquare className="w-3.5 h-3.5" />
        Live Chat
      </button>
      <button
        onClick={() => setSidebarTab("prayer")}
        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors relative ${
          sidebarTab === "prayer"
            ? dark ? "text-amber-400 border-b-2 border-amber-400" : "text-amber-600 border-b-2 border-amber-500"
            : dark ? "text-white/40 hover:text-white/70" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        🙏 Prayer
        {prayers.length > 0 && sidebarTab !== "prayer" && (
          <span className={`absolute top-1.5 right-5 text-[9px] font-bold rounded-full px-1 ${
            dark ? "bg-amber-400 text-black" : "bg-amber-500 text-white"
          }`}>
            {prayers.length}
          </span>
        )}
      </button>
    </div>
  );

  const renderUsernameSetup = (dark: boolean) => (
    <div className="flex-1 flex flex-col items-center justify-center px-5 gap-4">
      <MessageSquare className={`w-10 h-10 opacity-60 ${dark ? "text-sky-400" : "text-sky-500"}`} />
      <div className="text-center">
        <p className={`font-semibold mb-1 ${dark ? "text-white" : "text-primary"}`}>Join the Conversation</p>
        <p className={`text-xs ${dark ? "text-white/50" : "text-muted-foreground"}`}>
          Choose a display name to chat and submit prayer requests
        </p>
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
        autoFocus
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

  const renderChatPanel = (dark: boolean) => (
    <div className="flex flex-col flex-1 min-h-0 relative">
      {/* Floating reaction animations */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-20">
        <AnimatePresence>
          {floatingReactions.map(r => (
            <motion.span
              key={r.id}
              initial={{ opacity: 1, y: 0, x: `${15 + Math.random() * 70}%` }}
              animate={{ opacity: 0, y: -140 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.2, ease: "easeOut" }}
              className="absolute bottom-20 text-2xl select-none"
            >
              {r.emoji}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>

      {/* Messages */}
      <div
        ref={chatScrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-hide"
      >
        {messages.length === 0 && (
          <p className={`text-center text-xs py-8 ${dark ? "text-white/40" : "text-muted-foreground"}`}>
            Be the first to say something!
          </p>
        )}
        <AnimatePresence initial={false}>
          {messages.map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: msg.pending ? 0.6 : 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="group"
            >
              <div className={`text-xs ${msg.username === username ? "text-right" : ""}`}>
                <span className={`font-semibold ${dark ? "text-sky-400" : "text-primary"}`}>
                  {msg.username}
                </span>
                <span className={`ml-1 ${dark ? "text-white/40" : "text-muted-foreground"}`}>
                  {formatTime(msg.timestamp)}
                </span>
                {msg.pending && (
                  <span className={`ml-1 text-[10px] italic ${dark ? "text-white/30" : "text-muted-foreground"}`}>
                    sending…
                  </span>
                )}
              </div>
              <div className={`mt-0.5 flex items-end gap-1 ${msg.username === username ? "justify-end" : ""}`}>
                <div className={`max-w-[85%] text-sm px-3 py-2 rounded-2xl break-words ${
                  msg.username === username
                    ? dark ? "bg-sky-600 text-white rounded-br-sm" : "bg-primary text-white rounded-br-sm"
                    : dark ? "bg-white/10 text-white rounded-bl-sm" : "bg-muted rounded-bl-sm"
                }`}>
                  {msg.message}
                </div>
                {msg.username !== username && !msg.pending && (
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {REACTIONS.slice(0, 3).map(r => (
                      <button
                        key={r}
                        onClick={() => reactToMessage(msg.id, r)}
                        className="text-sm hover:scale-125 transition-transform"
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

      {/* Scroll-to-bottom button */}
      <AnimatePresence>
        {showScrollBtn && (
          <motion.button
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            onClick={scrollToBottom}
            className={`absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg transition-colors ${
              dark
                ? "bg-sky-500 hover:bg-sky-400 text-white"
                : "bg-primary hover:bg-primary/90 text-white"
            }`}
          >
            <ChevronDown className="w-3.5 h-3.5" />
            {newMsgCount > 0 ? `${newMsgCount} new message${newMsgCount > 1 ? "s" : ""}` : "Scroll down"}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className={`px-4 py-3 border-t shrink-0 ${dark ? "border-white/10 bg-white/5" : "border-border"}`}>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              className={`w-full text-sm rounded-xl px-3 py-2 pr-10 focus:outline-none focus:ring-2 ${
                dark
                  ? "bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:ring-sky-400/40"
                  : "bg-background border border-border focus:ring-sky-400/30"
              }`}
              placeholder="Say something…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
              maxLength={MSG_MAX}
              disabled={isSending}
            />
            {input.length > MSG_MAX * 0.75 && (
              <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] tabular-nums ${
                input.length >= MSG_MAX
                  ? "text-red-400"
                  : dark ? "text-white/40" : "text-muted-foreground"
              }`}>
                {MSG_MAX - input.length}
              </span>
            )}
          </div>
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isSending}
            className={`px-3 py-2 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0 ${
              dark ? "bg-sky-500 hover:bg-sky-400 text-white" : "bg-primary hover:bg-primary/90 text-white"
            }`}
            aria-label="Send message"
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
    </div>
  );

  const renderPrayerPanel = (dark: boolean) => (
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
              className={`rounded-2xl p-3 border ${
                dark ? "bg-white/5 border-white/10" : "bg-muted/50 border-border"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-xs font-semibold ${dark ? "text-amber-400" : "text-amber-600"}`}>
                  {p.name}
                </span>
                <span className={`text-[10px] ${dark ? "text-white/30" : "text-muted-foreground"}`}>
                  {formatTime(p.timestamp)}
                </span>
              </div>
              <p className={`text-xs leading-relaxed mb-2.5 ${dark ? "text-white/80" : "text-foreground/80"}`}>
                {p.prayer}
              </p>
              <button
                onClick={() => prayForRequest(p.id)}
                disabled={prayedFor.has(p.id)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                  prayedFor.has(p.id)
                    ? dark ? "bg-amber-400/20 text-amber-400 cursor-default" : "bg-amber-100 text-amber-600 cursor-default"
                    : dark ? "bg-white/10 text-white/70 hover:bg-amber-400/20 hover:text-amber-400"
                            : "bg-muted text-muted-foreground hover:bg-amber-100 hover:text-amber-600"
                }`}
              >
                🙏 {prayedFor.has(p.id) ? "Praying" : "Pray for this"}
                {p.prayCount > 0 && (
                  <span className={`ml-1 font-bold ${dark ? "text-amber-300" : "text-amber-600"}`}>
                    · {p.prayCount}
                  </span>
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
            className={`text-center py-3 rounded-xl text-sm font-medium ${
              dark ? "bg-amber-400/15 text-amber-300" : "bg-amber-100 text-amber-700"
            }`}
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
            <div className="relative">
              <textarea
                className={`w-full text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 resize-none ${
                  dark
                    ? "bg-white/10 border border-white/20 text-white placeholder:text-white/30 focus:ring-amber-400/30"
                    : "bg-background border border-border placeholder:text-muted-foreground focus:ring-amber-500/30"
                }`}
                placeholder="Share your prayer point… (max 500 characters)"
                value={prayerText}
                onChange={e => setPrayerText(e.target.value)}
                maxLength={500}
                rows={3}
              />
              {prayerText.length > 400 && (
                <span className={`absolute bottom-2 right-2 text-[10px] tabular-nums ${
                  prayerText.length >= 500 ? "text-red-400" : dark ? "text-white/40" : "text-muted-foreground"
                }`}>
                  {500 - prayerText.length}
                </span>
              )}
            </div>
            {prayerError && (
              <p className={`text-[10px] ${dark ? "text-red-400" : "text-red-500"}`}>{prayerError}</p>
            )}
            <button
              onClick={submitPrayer}
              disabled={!prayerName.trim() || !prayerText.trim() || prayerSubmitting}
              className={`w-full py-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                dark ? "bg-amber-500 hover:bg-amber-400 text-black" : "bg-amber-500 hover:bg-amber-600 text-white"
              }`}
            >
              {prayerSubmitting ? "Submitting…" : "🙏 Submit Prayer Request"}
            </button>
            <p className={`text-[10px] text-center ${dark ? "text-white/25" : "text-muted-foreground"}`}>
              Visible to all viewers in the live chat
            </p>
          </div>
        )}
      </div>
    </div>
  );

  // ─── EMBEDDED MODE ────────────────────────────────────────────────────────

  if (embedded) {
    return (
      <div className="flex flex-col h-full relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-white/5 shrink-0 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse shrink-0" />
            <span className="font-semibold text-sm text-white">Live</span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {renderConnectionDot(true)}
            <div className="flex items-center gap-1 text-xs text-white/60">
              <Users className="w-3.5 h-3.5" />
              <span>{viewerCount}</span>
            </div>
          </div>
        </div>

        {/* Tab switcher */}
        {renderTabSwitcher(true)}

        {!usernameSet
          ? renderUsernameSetup(true)
          : sidebarTab === "chat"
            ? renderChatPanel(true)
            : renderPrayerPanel(true)
        }
      </div>
    );
  }

  // ─── FLOATING MODE ────────────────────────────────────────────────────────

  return (
    <>
      {/* Toggle button */}
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

      {/* Chat panel */}
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
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary/5 shrink-0 gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="font-semibold text-sm text-primary">Live</span>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                {renderConnectionDot(false)}
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="w-3.5 h-3.5" />
                  {viewerCount}
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Close chat"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tab switcher */}
            {renderTabSwitcher(false)}

            {!usernameSet
              ? renderUsernameSetup(false)
              : sidebarTab === "chat"
                ? renderChatPanel(false)
                : renderPrayerPanel(false)
            }
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

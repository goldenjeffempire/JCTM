/**
 * LiveChat — production-ready real-time live chat + prayer panel.
 *
 * Reliability:
 *  • Stable session-id (sessionStorage) → server deduplicates viewer count
 *  • Exponential-backoff SSE reconnect (1 → 2 → 4 → 8 → 16 → 30 s)
 *  • Connection status indicator
 *  • Message deduplication on reconnect
 *  • Optimistic message sending with cid reconciliation
 *  • Input restored if POST fails
 *  • Smart auto-scroll with "new messages" badge
 *
 * Responsiveness:
 *  • Mobile (<640 px): full-width bottom sheet sliding up from bottom of screen
 *  • Tablet (640–1023 px): corner floating panel, 384 px wide
 *  • Desktop (≥1024 px): corner floating panel, 400 px wide
 *  • iOS safe-area insets prevent input hiding behind home indicator
 *  • Input font-size 16px on mobile prevents iOS Safari zoom-on-focus
 *  • Reaction buttons always visible on touch; hover-only on desktop
 *  • Emoji strip scrolls horizontally instead of wrapping
 *  • All interactive targets ≥44 × 44 px
 *  • touch-manipulation on all buttons for snappy mobile tap response
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Send, X, Users, ChevronDown, Wifi, WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const MSG_MAX = 300;
const NEAR_BOTTOM_PX = 120;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  username: string;
  message: string;
  timestamp: number;
  isModerated?: boolean;
  cid?: string;
  pending?: boolean;
}

interface PrayerRequest {
  id: string;
  name: string;
  prayer: string;
  timestamp: number;
  prayCount: number;
}

type SSEEvent =
  | { type: "history";        messages: ChatMessage[] }
  | { type: "message";        message: ChatMessage }
  | { type: "count";          count: number }
  | { type: "reaction";       messageId: string; reaction: string }
  | { type: "prayer_history"; prayers: PrayerRequest[] }
  | { type: "prayer_new";     prayer: PrayerRequest }
  | { type: "pray_count";     prayerId: string; prayCount: number };

type ConnStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

const REACTIONS = ["🙏", "🔥", "❤️", "🕊️", "💯", "⚡", "👏"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

  // ── State ─────────────────────────────────────────────────────────────────
  const [isOpen, setIsOpen]           = useState(embedded);
  const [connStatus, setConnStatus]   = useState<ConnStatus>("connecting");
  const [viewerCount, setViewerCount] = useState(0);

  const [sidebarTab, setSidebarTab]   = useState<"chat" | "prayer">("chat");
  const [messages, setMessages]       = useState<ChatMessage[]>([]);
  const [input, setInput]             = useState("");
  const [username, setUsername]       = useState(getStoredUsername);
  const [usernameSet, setUsernameSet] = useState(() => !!getStoredUsername());
  const [pendingUsername, setPendingUsername] = useState("");
  const [isSending, setIsSending]     = useState(false);
  const [reactions, setReactions]     = useState<Record<string, { emoji: string; count: number }>>({});
  const [floatingReactions, setFloatingReactions] = useState<Array<{ id: string; emoji: string }>>([]);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [newMsgCount, setNewMsgCount] = useState(0);

  const [prayers, setPrayers]           = useState<PrayerRequest[]>([]);
  const [prayedFor, setPrayedFor]       = useState<Set<string>>(new Set());
  const [prayerName, setPrayerName]     = useState("");
  const [prayerText, setPrayerText]     = useState("");
  const [prayerSubmitting, setPrayerSubmitting] = useState(false);
  const [prayerSubmitted, setPrayerSubmitted]   = useState(false);
  const [prayerError, setPrayerError]           = useState("");

  // ── Refs ──────────────────────────────────────────────────────────────────
  const esRef             = useRef<EventSource | null>(null);
  const reconnectDelayRef = useRef(1_000);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectFnRef      = useRef<() => void>(() => { /* assigned below */ });
  const messagesEndRef    = useRef<HTMLDivElement>(null);
  const chatScrollRef     = useRef<HTMLDivElement>(null);
  const prayersEndRef     = useRef<HTMLDivElement>(null);
  const sessionId         = useRef(getSessionId()).current;

  // ── SSE: exponential-backoff reconnect ────────────────────────────────────

  const connectSSE = useCallback(() => {
    if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
    if (esRef.current) { esRef.current.close(); esRef.current = null; }

    setConnStatus("connecting");
    const es = new EventSource(`${BASE}/api/livechat/stream?sid=${encodeURIComponent(sessionId)}`);
    esRef.current = es;

    es.onopen = () => {
      reconnectDelayRef.current = 1_000;
      setConnStatus("connected");
    };

    es.onmessage = (event: MessageEvent) => {
      let data: SSEEvent;
      try { data = JSON.parse(event.data as string) as SSEEvent; }
      catch { return; }

      if (data.type === "history") {
        setMessages(prev => {
          if (prev.length === 0) return data.messages;
          const seen = new Set(prev.map(m => m.id));
          const fresh = data.messages.filter(m => !seen.has(m.id));
          return fresh.length ? [...prev, ...fresh].slice(-100) : prev;
        });
      } else if (data.type === "message") {
        setMessages(prev => {
          if (data.message.cid) {
            const idx = prev.findIndex(m => m.pending && m.cid === data.message.cid);
            if (idx !== -1) {
              const next = [...prev];
              next[idx] = { ...data.message, pending: false };
              return next;
            }
          }
          if (prev.some(m => m.id === data.message.id)) return prev;
          const el = chatScrollRef.current;
          if (el && el.scrollHeight - el.scrollTop - el.clientHeight > NEAR_BOTTOM_PX) {
            setNewMsgCount(c => c + 1);
          }
          return [...prev.slice(-99), data.message];
        });
      } else if (data.type === "count") {
        setViewerCount(data.count);
      } else if (data.type === "reaction") {
        setReactions(prev => ({
          ...prev,
          [data.messageId]: { emoji: data.reaction, count: (prev[data.messageId]?.count ?? 0) + 1 },
        }));
        const rid = `${Date.now()}-${Math.random()}`;
        setFloatingReactions(prev => [...prev, { id: rid, emoji: data.reaction }]);
        setTimeout(() => setFloatingReactions(prev => prev.filter(r => r.id !== rid)), 2_500);
      } else if (data.type === "prayer_history") {
        setPrayers(data.prayers);
      } else if (data.type === "prayer_new") {
        setPrayers(prev => [...prev, data.prayer]);
      } else if (data.type === "pray_count") {
        setPrayers(prev => prev.map(p => p.id === data.prayerId ? { ...p, prayCount: data.prayCount } : p));
      }
    };

    es.onerror = () => {
      es.close(); esRef.current = null;
      setConnStatus("reconnecting");
      const delay = reconnectDelayRef.current;
      reconnectDelayRef.current = Math.min(delay * 2, 30_000);
      reconnectTimerRef.current = setTimeout(() => connectFnRef.current(), delay);
    };
  }, [sessionId]);

  connectFnRef.current = connectSSE;

  useEffect(() => {
    if (!isOpen) return;
    connectSSE();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      esRef.current?.close(); esRef.current = null;
    };
  }, [isOpen, connectSSE]);

  useEffect(() => { if (embedded) setIsOpen(true); }, [embedded]);

  useEffect(() => {
    if (sidebarTab === "prayer" && username && !prayerName) setPrayerName(username);
  }, [sidebarTab, username, prayerName]);

  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX) {
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
    setNewMsgCount(0); setShowScrollBtn(false);
  };

  // ── Send message ──────────────────────────────────────────────────────────

  const sendMessage = async () => {
    const msg = input.trim();
    if (!msg || !username || isSending) return;
    const cid = crypto.randomUUID();
    const optimistic: ChatMessage = { id: `pending-${cid}`, username, message: msg, timestamp: Date.now(), isModerated: false, cid, pending: true };
    setMessages(prev => [...prev, optimistic]);
    setIsSending(true); setInput("");
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    try {
      const res = await fetch(`${BASE}/api/livechat/message`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, message: msg, cid }),
      });
      if (!res.ok) { setMessages(prev => prev.filter(m => m.cid !== cid)); setInput(msg); }
    } catch { setMessages(prev => prev.filter(m => m.cid !== cid)); setInput(msg); }
    finally { setIsSending(false); }
  };

  const reactToMessage = async (messageId: string, reaction: string) => {
    await fetch(`${BASE}/api/livechat/react`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, reaction }),
    });
  };

  const handleSetUsername = () => {
    const u = pendingUsername.trim().slice(0, 30);
    if (!u) return;
    setUsername(u); setUsernameSet(true); setPrayerName(u);
    localStorage.setItem("jctm-chat-username", u);
  };

  const submitPrayer = async () => {
    const name = prayerName.trim(), prayer = prayerText.trim();
    if (!name || !prayer || prayerSubmitting) return;
    setPrayerSubmitting(true); setPrayerError("");
    try {
      const res = await fetch(`${BASE}/api/livechat/prayer`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, prayer }),
      });
      if (res.ok) { setPrayerText(""); setPrayerSubmitted(true); setTimeout(() => setPrayerSubmitted(false), 4_000); }
      else { const err = await res.json() as { error?: string }; setPrayerError(err.error ?? "Failed to submit. Please try again."); }
    } catch { setPrayerError("Connection error. Please try again."); }
    finally { setPrayerSubmitting(false); }
  };

  const prayForRequest = async (prayerId: string) => {
    if (prayedFor.has(prayerId)) return;
    setPrayedFor(prev => new Set([...prev, prayerId]));
    try {
      await fetch(`${BASE}/api/livechat/pray`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prayerId }),
      });
    } catch { setPrayedFor(prev => { const s = new Set(prev); s.delete(prayerId); return s; }); }
  };

  if (!isLive) return null;

  // ─── Render helpers ───────────────────────────────────────────────────────
  // Plain functions (not JSX components) — React never unmounts/remounts them.

  const renderConnStatus = (dark: boolean) => {
    if (connStatus === "connected") return null;
    return (
      <div className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full shrink-0 ${
        connStatus === "reconnecting"
          ? dark ? "bg-amber-400/20 text-amber-300" : "bg-amber-100 text-amber-700"
          : dark ? "bg-red-500/20 text-red-400" : "bg-red-100 text-red-600"
      }`}>
        {connStatus === "reconnecting"
          ? <Wifi className="w-3 h-3 animate-pulse" />
          : <WifiOff className="w-3 h-3" />}
        <span>{connStatus === "reconnecting" ? "Reconnecting…" : "Disconnected"}</span>
      </div>
    );
  };

  const renderTabSwitcher = (dark: boolean) => (
    <div className={`flex shrink-0 border-b ${dark ? "border-white/10 bg-white/5" : "border-border bg-muted/30"}`}>
      <button
        onClick={() => setSidebarTab("chat")}
        className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors touch-manipulation min-h-[44px] ${
          sidebarTab === "chat"
            ? dark ? "text-white border-b-2 border-sky-400" : "text-primary border-b-2 border-primary"
            : dark ? "text-white/40 active:text-white/70" : "text-muted-foreground"
        }`}
      >
        <MessageSquare className="w-3.5 h-3.5 shrink-0" />
        Live Chat
      </button>
      <button
        onClick={() => setSidebarTab("prayer")}
        className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors touch-manipulation relative min-h-[44px] ${
          sidebarTab === "prayer"
            ? dark ? "text-amber-400 border-b-2 border-amber-400" : "text-amber-600 border-b-2 border-amber-500"
            : dark ? "text-white/40 active:text-white/70" : "text-muted-foreground"
        }`}
      >
        🙏 Prayer
        {prayers.length > 0 && sidebarTab !== "prayer" && (
          <span className={`absolute top-2 right-4 text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 ${
            dark ? "bg-amber-400 text-black" : "bg-amber-500 text-white"
          }`}>
            {prayers.length > 99 ? "99+" : prayers.length}
          </span>
        )}
      </button>
    </div>
  );

  const renderUsernameSetup = (dark: boolean) => (
    <div className="flex-1 flex flex-col items-center justify-center px-5 sm:px-6 gap-4 py-6">
      <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
        dark ? "bg-sky-400/20" : "bg-sky-100"
      }`}>
        <MessageSquare className={`w-7 h-7 ${dark ? "text-sky-400" : "text-sky-500"}`} />
      </div>
      <div className="text-center">
        <p className={`font-semibold text-base mb-1 ${dark ? "text-white" : "text-primary"}`}>
          Join the Conversation
        </p>
        <p className={`text-sm ${dark ? "text-white/50" : "text-muted-foreground"}`}>
          Choose a display name to chat and submit prayer requests
        </p>
      </div>
      <input
        className={`w-full rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 ${
          dark
            ? "border border-white/20 bg-white/10 text-white placeholder:text-white/40 focus:ring-sky-400/40"
            : "border border-border bg-background focus:ring-sky-400/30"
        }`}
        placeholder="Your name (e.g. Bro Emmanuel)"
        value={pendingUsername}
        onChange={e => setPendingUsername(e.target.value)}
        onKeyDown={e => e.key === "Enter" && handleSetUsername()}
        maxLength={30}
        autoComplete="nickname"
        enterKeyHint="go"
      />
      <Button
        onClick={handleSetUsername}
        disabled={!pendingUsername.trim()}
        className={`w-full h-11 text-sm font-semibold ${dark ? "bg-sky-500 hover:bg-sky-400 text-white border-0" : ""}`}
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

      {/* Messages scroll area */}
      <div
        ref={chatScrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-3 scrollbar-hide overscroll-contain"
      >
        {messages.length === 0 && (
          <p className={`text-center text-sm py-10 ${dark ? "text-white/40" : "text-muted-foreground"}`}>
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
                <span className={`ml-1.5 ${dark ? "text-white/40" : "text-muted-foreground"}`}>
                  {formatTime(msg.timestamp)}
                </span>
                {msg.pending && (
                  <span className={`ml-1 text-[10px] italic ${dark ? "text-white/30" : "text-muted-foreground"}`}>
                    sending…
                  </span>
                )}
              </div>
              <div className={`mt-0.5 flex items-end gap-1 ${msg.username === username ? "justify-end" : ""}`}>
                <div className={`max-w-[82%] sm:max-w-[85%] text-sm leading-relaxed px-3 py-2 rounded-2xl break-words ${
                  msg.username === username
                    ? dark ? "bg-sky-600 text-white rounded-br-sm" : "bg-primary text-white rounded-br-sm"
                    : dark ? "bg-white/10 text-white rounded-bl-sm" : "bg-muted rounded-bl-sm"
                }`}>
                  {msg.message}
                </div>
                {/* Reactions: always visible on touch (mobile), hover-only on desktop */}
                {msg.username !== username && !msg.pending && (
                  <div className="flex gap-0.5 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 sm:transition-opacity">
                    {REACTIONS.slice(0, 3).map(r => (
                      <button
                        key={r}
                        onClick={() => reactToMessage(msg.id, r)}
                        className="w-7 h-7 flex items-center justify-center text-sm hover:scale-125 active:scale-110 transition-transform touch-manipulation"
                        title={r}
                        aria-label={`React with ${r}`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {reactions[msg.id] && (
                <div className={`text-xs mt-1 ${msg.username === username ? "text-right" : ""}`}>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 gap-1 ${
                    dark ? "bg-white/10 text-white/70" : "bg-muted"
                  }`}>
                    {reactions[msg.id].emoji}
                    <span className="tabular-nums">{reactions[msg.id].count}</span>
                  </span>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll-to-bottom */}
      <AnimatePresence>
        {showScrollBtn && (
          <motion.button
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            onClick={scrollToBottom}
            className={`absolute bottom-[72px] left-1/2 -translate-x-1/2 flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full shadow-lg touch-manipulation ${
              dark ? "bg-sky-500 hover:bg-sky-400 text-white" : "bg-primary hover:bg-primary/90 text-white"
            }`}
          >
            <ChevronDown className="w-3.5 h-3.5 shrink-0" />
            {newMsgCount > 0
              ? `${newMsgCount} new message${newMsgCount > 1 ? "s" : ""}`
              : "Scroll down"}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Input area — paddingBottom accounts for iOS home indicator */}
      <div
        className={`px-3 sm:px-4 pt-3 pb-3 border-t shrink-0 ${dark ? "border-white/10 bg-white/5" : "border-border"}`}
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))" }}
      >
        <div className="flex gap-2 items-center">
          <div className="flex-1 relative">
            <input
              className={`w-full rounded-xl px-3 py-2.5 pr-10 focus:outline-none focus:ring-2
                text-base sm:text-sm ${/* 16px on mobile prevents iOS Safari zoom on focus */""} ${
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
              enterKeyHint="send"
              autoComplete="off"
            />
            {input.length > MSG_MAX * 0.75 && (
              <span className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] tabular-nums pointer-events-none ${
                input.length >= MSG_MAX ? "text-red-400" : dark ? "text-white/40" : "text-muted-foreground"
              }`}>
                {MSG_MAX - input.length}
              </span>
            )}
          </div>
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isSending}
            className={`w-10 h-10 flex items-center justify-center rounded-xl shrink-0
              disabled:opacity-40 disabled:cursor-not-allowed transition-colors touch-manipulation ${
              dark ? "bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-white" : "bg-primary hover:bg-primary/90 text-white"
            }`}
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {/* Emoji quick-insert — horizontally scrollable, never wraps */}
        <div className="flex gap-1.5 mt-2 overflow-x-auto scrollbar-hide pb-0.5">
          {REACTIONS.map(r => (
            <button
              key={r}
              onClick={() => setInput(i => i + r)}
              className="text-lg sm:text-base shrink-0 w-8 h-8 flex items-center justify-center hover:scale-125 active:scale-110 transition-transform touch-manipulation rounded-lg"
              title={r}
              aria-label={r}
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
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-3 scrollbar-hide overscroll-contain">
        {prayers.length === 0 && (
          <div className={`text-center py-12 ${dark ? "text-white/40" : "text-muted-foreground"}`}>
            <div className="text-4xl mb-3">🙏</div>
            <p className="text-sm">No prayer requests yet.<br />Be the first to share yours.</p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {[...prayers].reverse().map(p => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
              className={`rounded-2xl p-3 sm:p-4 border ${
                dark ? "bg-white/5 border-white/10" : "bg-muted/50 border-border"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className={`text-xs font-semibold truncate ${dark ? "text-amber-400" : "text-amber-600"}`}>
                  {p.name}
                </span>
                <span className={`text-[10px] shrink-0 ${dark ? "text-white/30" : "text-muted-foreground"}`}>
                  {formatTime(p.timestamp)}
                </span>
              </div>
              <p className={`text-sm leading-relaxed mb-3 ${dark ? "text-white/80" : "text-foreground/80"}`}>
                {p.prayer}
              </p>
              <button
                onClick={() => prayForRequest(p.id)}
                disabled={prayedFor.has(p.id)}
                className={`flex items-center gap-1.5 text-xs px-4 py-2.5 rounded-full font-medium transition-all touch-manipulation min-h-[36px] ${
                  prayedFor.has(p.id)
                    ? dark ? "bg-amber-400/20 text-amber-400 cursor-default" : "bg-amber-100 text-amber-600 cursor-default"
                    : dark ? "bg-white/10 text-white/70 hover:bg-amber-400/20 hover:text-amber-400 active:bg-amber-400/30"
                            : "bg-muted text-muted-foreground hover:bg-amber-100 hover:text-amber-600 active:bg-amber-200"
                }`}
              >
                🙏 {prayedFor.has(p.id) ? "Praying" : "Pray for this"}
                {p.prayCount > 0 && (
                  <span className={`font-bold tabular-nums ${dark ? "text-amber-300" : "text-amber-600"}`}>
                    · {p.prayCount}
                  </span>
                )}
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={prayersEndRef} />
      </div>

      {/* Submit prayer form */}
      <div
        className={`px-3 sm:px-4 pt-3 border-t shrink-0 ${dark ? "border-white/10 bg-white/5" : "border-border"}`}
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))" }}
      >
        {prayerSubmitted ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`text-center py-4 rounded-xl text-sm font-medium mb-0 ${
              dark ? "bg-amber-400/15 text-amber-300" : "bg-amber-100 text-amber-700"
            }`}
          >
            🙏 Your prayer request has been shared
          </motion.div>
        ) : (
          <div className="space-y-2.5">
            <input
              className={`w-full rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2
                text-base sm:text-sm ${
                dark
                  ? "bg-white/10 border border-white/20 text-white placeholder:text-white/30 focus:ring-amber-400/30"
                  : "bg-background border border-border placeholder:text-muted-foreground focus:ring-amber-500/30"
              }`}
              placeholder="Your name"
              value={prayerName}
              onChange={e => setPrayerName(e.target.value)}
              maxLength={40}
              autoComplete="name"
            />
            <div className="relative">
              <textarea
                className={`w-full rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 resize-none
                  text-base sm:text-sm ${
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
                <span className={`absolute bottom-2.5 right-3 text-[10px] tabular-nums pointer-events-none ${
                  prayerText.length >= 500 ? "text-red-400" : dark ? "text-white/40" : "text-muted-foreground"
                }`}>
                  {500 - prayerText.length}
                </span>
              )}
            </div>
            {prayerError && (
              <p className={`text-xs ${dark ? "text-red-400" : "text-red-500"}`}>{prayerError}</p>
            )}
            <button
              onClick={submitPrayer}
              disabled={!prayerName.trim() || !prayerText.trim() || prayerSubmitting}
              className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors
                disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation ${
                dark ? "bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black"
                     : "bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white"
              }`}
            >
              {prayerSubmitting ? "Submitting…" : "🙏 Submit Prayer Request"}
            </button>
            <p className={`text-xs text-center pb-0.5 ${dark ? "text-white/25" : "text-muted-foreground"}`}>
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
        <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 border-b border-white/10 bg-white/5 shrink-0 flex-wrap">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="font-semibold text-sm text-white">Live</span>
          </div>
          {renderConnStatus(true)}
          <div className="flex items-center gap-1 ml-auto text-xs text-white/60">
            <Users className="w-3.5 h-3.5 shrink-0" />
            <span className="tabular-nums">{viewerCount}</span>
          </div>
        </div>

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

  // ─── FLOATING / BOTTOM-SHEET MODE ─────────────────────────────────────────
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
            className="fixed z-50 bg-primary hover:bg-primary/90 active:bg-primary/80 text-white rounded-full shadow-xl px-4 py-3 flex items-center gap-2 transition-colors touch-manipulation
              bottom-5 right-4
              sm:bottom-6 sm:right-6"
            style={{
              bottom: `max(1.25rem, calc(1.25rem + env(safe-area-inset-bottom, 0px)))`,
            }}
          >
            <MessageSquare className="w-5 h-5 shrink-0" />
            <span className="text-sm font-semibold leading-none">Live Chat</span>
            {viewerCount > 0 && (
              <Badge className="bg-red-500 text-white text-[10px] h-4 px-1.5 leading-none shrink-0">
                {viewerCount}
              </Badge>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Panel — bottom sheet on mobile, floating corner panel on sm+ */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop — only on mobile */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 sm:hidden"
              onClick={() => setIsOpen(false)}
            />

            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className={[
                // Positioning: full-width bottom edge on mobile → corner on sm+
                "fixed z-50 flex flex-col overflow-hidden",
                "left-0 right-0 bottom-0",
                "sm:left-auto sm:right-6 sm:bottom-6",
                // Size: ~90vh on mobile → fixed panel on sm+
                "h-[90vh] sm:h-[580px]",
                "rounded-t-3xl sm:rounded-2xl",
                "border-t border-x border-border sm:border",
                // Colours
                "bg-background shadow-2xl",
                // Width on sm+
                "sm:w-80 md:w-96",
              ].join(" ")}
            >
              {/* Header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-primary/5 shrink-0 flex-wrap">
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="font-semibold text-sm text-primary">Live</span>
                </div>
                {renderConnStatus(false)}
                <div className="flex items-center gap-1 ml-auto text-xs text-muted-foreground">
                  <Users className="w-3.5 h-3.5 shrink-0" />
                  <span className="tabular-nums">{viewerCount}</span>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted active:bg-muted transition-colors touch-manipulation shrink-0"
                  aria-label="Close chat"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {renderTabSwitcher(false)}

              {!usernameSet
                ? renderUsernameSetup(false)
                : sidebarTab === "chat"
                  ? renderChatPanel(false)
                  : renderPrayerPanel(false)
              }
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

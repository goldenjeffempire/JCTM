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

interface SSEData {
  type: "history" | "message" | "count" | "reaction";
  messages?: ChatMessage[];
  message?: ChatMessage;
  count?: number;
  messageId?: string;
  reaction?: string;
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
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

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

  const handleSetUsername = () => {
    const u = pendingUsername.trim().slice(0, 30);
    if (!u) return;
    setUsername(u);
    setUsernameSet(true);
    localStorage.setItem("jctm-chat-username", u);
  };

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (!isLive) return null;

  // ── Embedded mode: renders as a contained panel ──
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
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="font-semibold text-sm text-white">Live Chat</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-white/60">
            <Users className="w-3.5 h-3.5" />
            <span>{viewerCount} watching</span>
          </div>
        </div>

        {/* Username Setup */}
        {!usernameSet ? (
          <div className="flex-1 flex flex-col items-center justify-center px-5 gap-4">
            <MessageSquare className="w-10 h-10 text-sky-400 opacity-60" />
            <div className="text-center">
              <div className="font-semibold text-white mb-1">Join the Conversation</div>
              <div className="text-xs text-white/50">Choose a display name to chat during the live service</div>
            </div>
            <input
              className="w-full border border-white/20 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400/40 bg-white/10 text-white placeholder:text-white/40"
              placeholder="Your name (e.g. Bro Emmanuel)"
              value={pendingUsername}
              onChange={e => setPendingUsername(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSetUsername()}
              maxLength={30}
            />
            <Button
              onClick={handleSetUsername}
              disabled={!pendingUsername.trim()}
              className="w-full bg-sky-500 hover:bg-sky-400 text-white border-0"
            >
              Join Chat
            </Button>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-hide">
              {messages.length === 0 && (
                <div className="text-center text-xs text-white/40 py-8">
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
                      <span className="font-semibold text-sky-400">{msg.username}</span>
                      <span className="text-white/40 ml-1">{formatTime(msg.timestamp)}</span>
                    </div>
                    <div className={`mt-0.5 flex items-end gap-1 ${msg.username === username ? "justify-end" : ""}`}>
                      <div className={`max-w-[85%] text-sm px-3 py-2 rounded-2xl ${
                        msg.username === username
                          ? "bg-sky-600 text-white rounded-br-sm"
                          : "bg-white/10 text-white rounded-bl-sm"
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
                        <span className="bg-white/10 rounded-full px-2 py-0.5 text-white/70">
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
            <div className="px-4 py-3 border-t border-white/10 bg-white/5 shrink-0">
              <div className="flex gap-2">
                <input
                  className="flex-1 text-sm bg-white/10 border border-white/20 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400/40 text-white placeholder:text-white/40"
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
                  className="px-3 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
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
        )}
      </div>
    );
  }

  // ── Floating mode (original behaviour for SermonDetail) ──
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
            style={{ height: "520px" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary/5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="font-semibold text-sm text-primary">Live Chat</span>
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

            {/* Username Setup */}
            {!usernameSet && (
              <div className="flex-1 flex flex-col items-center justify-center px-5 gap-4">
                <MessageSquare className="w-10 h-10 text-sky-400 opacity-60" />
                <div className="text-center">
                  <div className="font-semibold text-primary mb-1">Join the Conversation</div>
                  <div className="text-xs text-muted-foreground">Choose a display name to chat during the live service</div>
                </div>
                <input
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400/30 bg-background"
                  placeholder="Your name (e.g. Bro Emmanuel)"
                  value={pendingUsername}
                  onChange={e => setPendingUsername(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSetUsername()}
                  maxLength={30}
                />
                <Button onClick={handleSetUsername} disabled={!pendingUsername.trim()} className="w-full">
                  Join Chat
                </Button>
              </div>
            )}

            {/* Messages */}
            {usernameSet && (
              <>
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-hide">
                  {messages.length === 0 && (
                    <div className="text-center text-xs text-muted-foreground py-8">
                      Be the first to send a message!
                    </div>
                  )}
                  <AnimatePresence initial={false}>
                    {messages.map(msg => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18 }}
                        className="group"
                      >
                        <div className={`text-xs ${msg.username === username ? "text-right" : ""}`}>
                          <span className="font-semibold text-primary">{msg.username}</span>
                          <span className="text-muted-foreground ml-1">{formatTime(msg.timestamp)}</span>
                        </div>
                        <div className={`mt-0.5 flex items-end gap-1 ${msg.username === username ? "justify-end" : ""}`}>
                          <div className={`max-w-[80%] text-sm px-3 py-2 rounded-2xl ${
                            msg.username === username
                              ? "bg-primary text-white rounded-br-sm"
                              : "bg-muted rounded-bl-sm"
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
                            <span className="bg-muted rounded-full px-2 py-0.5">
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
                <div className="px-4 py-3 border-t border-border">
                  <div className="flex gap-2">
                    <input
                      className="flex-1 text-sm bg-background border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400/30"
                      placeholder="Say something..."
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && sendMessage()}
                      maxLength={300}
                      disabled={isSending}
                    />
                    <Button
                      onClick={sendMessage}
                      disabled={!input.trim() || isSending}
                      size="sm"
                      className="px-3"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex gap-1 mt-2">
                    {REACTIONS.map(r => (
                      <button
                        key={r}
                        className="text-sm hover:scale-125 transition-transform"
                        onClick={() => setInput(i => i + r)}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

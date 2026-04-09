import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, Bot, User, Sparkles, BookOpen, Mic2, ChevronRight, RotateCcw } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

const SUGGESTED_QUESTIONS = [
  "What is the Correction Mandate?",
  "How does Prophet Amos define Primitive Christianity?",
  "What are the five major errors in modern Christianity?",
  "What does JCTM teach about holiness?",
  "How should Christians respond to the prosperity gospel?",
  "What is the biblical mode of water baptism?",
  "How can I receive the Holy Spirit baptism?",
  "What are the five-fold ministry offices?",
];

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 px-4 py-3">
      <div className="w-2 h-2 bg-sky-400 rounded-full animate-bounce [animation-delay:0ms]" />
      <div className="w-2 h-2 bg-sky-400 rounded-full animate-bounce [animation-delay:150ms]" />
      <div className="w-2 h-2 bg-sky-400 rounded-full animate-bounce [animation-delay:300ms]" />
    </div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"} mb-4`}
    >
      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
        isUser ? "bg-primary/10 border border-primary/20" : "bg-sky-500/15 border border-sky-400/30"
      }`}>
        {isUser ? <User className="w-4 h-4 text-primary" /> : <Bot className="w-4 h-4 text-sky-400" />}
      </div>
      <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
        isUser
          ? "bg-primary text-white rounded-tr-sm"
          : "glass-panel border border-border rounded-tl-sm text-foreground"
      }`}>
        {msg.content.split("\n").map((line, i) => (
          <span key={i}>
            {line}
            {i < msg.content.split("\n").length - 1 && <br />}
          </span>
        ))}
        <div className={`text-[10px] mt-2 ${isUser ? "text-white/60" : "text-muted-foreground"}`}>
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </motion.div>
  );
}

export default function SermonAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Peace be with you! I am the JCTM Sermon Assistant, trained on the sermons and teachings of Prophet Amos Evomobor.\n\nAsk me anything about JCTM doctrine, the Correction Mandate, Primitive Christianity, holiness, or specific sermon topics — and I will answer directly from the Word as taught through this ministry.",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const sendMessage = async (question?: string) => {
    const q = (question ?? input).trim();
    if (!q || isStreaming) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: q,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);
    setStreamingContent("");

    try {
      const conversationHistory = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await fetch(`${BASE}/api/sermon-assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, conversationHistory }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") break;
              try {
                const parsed = JSON.parse(data) as { token?: string; error?: string };
                if (parsed.token) {
                  fullContent += parsed.token;
                  setStreamingContent(fullContent);
                }
              } catch { /* skip */ }
            }
          }
        }
      }

      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: fullContent || "I apologize — I was unable to generate a response. Please try again.",
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: "The sermon assistant is temporarily unavailable. Please try again in a moment.",
        timestamp: Date.now(),
      }]);
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const reset = () => {
    setMessages([{
      id: "welcome",
      role: "assistant",
      content: "Peace be with you! I am the JCTM Sermon Assistant, trained on the sermons and teachings of Prophet Amos Evomobor.\n\nAsk me anything about JCTM doctrine, the Correction Mandate, Primitive Christianity, holiness, or specific sermon topics — and I will answer directly from the Word as taught through this ministry.",
      timestamp: Date.now(),
    }]);
    setInput("");
  };

  return (
    <Layout>
      <SEO
        title="TempleBots AI — JCTM Sermon Assistant"
        description="Ask TempleBots — the AI-powered sermon assistant of Jesus Christ Temple Ministry (JCTM). Get answers grounded in apostolic doctrine, the Correction Mandate, and JCTM teachings."
        path="/sermon-assistant"
        keywords="TempleBots, JCTM AI assistant, Jesus Christ Temple Ministry chatbot, apostolic doctrine AI, sermon Q&A JCTM"
      />
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-sky-50/20 dark:to-sky-950/10 pt-24 pb-8 px-4">
        <div className="max-w-4xl mx-auto">

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center gap-2 bg-sky-500/10 border border-sky-400/30 rounded-full px-4 py-1.5 mb-4">
              <Sparkles className="w-4 h-4 text-sky-400" />
              <span className="text-sky-600 dark:text-sky-400 text-sm font-medium">RAG-Powered Sermon Intelligence</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary mb-3">
              Sermon Assistant
            </h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Ask any question about JCTM doctrine and receive answers drawn directly from Prophet Amos Evomobor's sermons and teachings.
            </p>
            <div className="flex items-center justify-center gap-4 mt-4">
              <Badge variant="secondary" className="gap-1">
                <BookOpen className="w-3 h-3" /> 479+ Sermons
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <Mic2 className="w-3 h-3" /> Prophet Amos Doctrine
              </Badge>
            </div>
          </motion.div>

          <div className="grid lg:grid-cols-[1fr_280px] gap-6">
            {/* Chat Interface */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-panel border border-border rounded-3xl overflow-hidden flex flex-col"
              style={{ minHeight: "600px", maxHeight: "72vh" }}
            >
              {/* Chat header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">JCTM Sermon Assistant</div>
                    <div className="text-xs text-emerald-500 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block" />
                      Trained on JCTM Sermons
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={reset} className="gap-2 text-muted-foreground">
                  <RotateCcw className="w-4 h-4" /> Clear
                </Button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-hide">
                <AnimatePresence>
                  {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
                  {isStreaming && streamingContent && (
                    <motion.div
                      key="streaming"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex gap-3 mb-4"
                    >
                      <div className="w-9 h-9 rounded-full flex items-center justify-center bg-sky-500/15 border border-sky-400/30 flex-shrink-0">
                        <Bot className="w-4 h-4 text-sky-400" />
                      </div>
                      <div className="max-w-[75%] glass-panel border border-border rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed">
                        {streamingContent}
                        <span className="inline-block w-0.5 h-4 bg-sky-400 ml-1 animate-pulse align-middle" />
                      </div>
                    </motion.div>
                  )}
                  {isStreaming && !streamingContent && (
                    <motion.div key="typing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3 mb-4">
                      <div className="w-9 h-9 rounded-full bg-sky-500/15 border border-sky-400/30 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-sky-400" />
                      </div>
                      <div className="glass-panel border border-border rounded-2xl rounded-tl-sm">
                        <TypingIndicator />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="px-5 py-4 border-t border-border">
                <div className="flex gap-3">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about any JCTM sermon or doctrine…"
                    rows={2}
                    disabled={isStreaming}
                    className="flex-1 resize-none bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400/40 disabled:opacity-50 placeholder:text-muted-foreground"
                  />
                  <Button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || isStreaming}
                    className="bg-primary hover:bg-primary/90 rounded-xl px-4 self-end h-11"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2 text-center">
                  Press Enter to send · Shift+Enter for new line
                </p>
              </div>
            </motion.div>

            {/* Suggested Questions Sidebar */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-4"
            >
              <div className="glass-panel border border-border rounded-2xl p-4">
                <h3 className="font-semibold text-sm text-primary mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-sky-400" />
                  Suggested Questions
                </h3>
                <div className="space-y-2">
                  {SUGGESTED_QUESTIONS.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(q)}
                      disabled={isStreaming}
                      className="w-full text-left text-xs px-3 py-2.5 rounded-xl hover:bg-sky-50 dark:hover:bg-sky-950/30 border border-transparent hover:border-sky-200/50 dark:hover:border-sky-800/50 transition-colors disabled:opacity-40 flex items-start gap-2 group"
                    >
                      <ChevronRight className="w-3 h-3 text-sky-400 flex-shrink-0 mt-0.5 group-hover:translate-x-0.5 transition-transform" />
                      <span className="text-muted-foreground group-hover:text-foreground transition-colors">{q}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="glass-panel border border-border rounded-2xl p-4">
                <h3 className="font-semibold text-sm text-primary mb-2">About This Tool</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  This AI is trained exclusively on Prophet Amos Evomobor's sermons from the JCTM Temple TV library. All answers are grounded in JCTM doctrine and scripture.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

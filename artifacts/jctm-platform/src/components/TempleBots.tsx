import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChatWithTempleBots } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  id: string;
  role: "user" | "bot";
  content: string;
  sources?: string[];
}

export function TempleBots() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: "1", role: "bot", content: "Welcome to the Digital Sanctuary. I am TempleBots. Ask me anything about JCTM teachings or the Correction Mandate." }
  ]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string>();
  
  const chatMutation = useChatWithTempleBots();
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
              className="h-14 w-14 rounded-full bg-accent hover:bg-accent/90 shadow-lg"
            >
              <MessageCircle className="h-6 w-6 text-accent-foreground" />
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
            className="fixed bottom-6 right-6 z-50 w-[350px] max-w-[calc(100vw-3rem)] h-[500px] max-h-[calc(100vh-6rem)] glass-panel rounded-xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-primary text-primary-foreground p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-accent" />
                <span className="font-semibold">TempleBots</span>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/80 text-primary-foreground" onClick={() => setIsOpen(false)}>
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
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 bg-white border-t border-border">
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

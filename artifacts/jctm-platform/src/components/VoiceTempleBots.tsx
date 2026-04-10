import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX, X } from "lucide-react";
import { useVoiceStream } from "@workspace/integrations-openai-ai-react";
import { useVoiceRecorder } from "@workspace/integrations-openai-ai-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const WORKLET_PATH = `${BASE}/audio-playback-worklet.js`;

interface Transcript {
  role: "user" | "assistant";
  text: string;
}

export function VoiceTempleBots() {
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState<number | undefined>();
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [statusMsg, setStatusMsg] = useState("Tap the mic to speak with TempleBots Voice");
  const [error, setError] = useState<string | null>(null);

  const voiceStream = useVoiceStream({
    workletPath: WORKLET_PATH,
    onUserTranscript: useCallback((text: string) => {
      setTranscripts(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "user") {
          return [...prev.slice(0, -1), { role: "user", text: last.text + text }];
        }
        return [...prev, { role: "user", text }];
      });
      setStatusMsg("TempleBots is responding…");
    }, []),
    onTranscript: useCallback((chunk: string) => {
      setTranscripts(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return [...prev.slice(0, -1), { role: "assistant", text: last.text + chunk }];
        }
        return [...prev, { role: "assistant", text: chunk }];
      });
    }, []),
    onComplete: useCallback(() => {
      setIsListening(false);
      setStatusMsg("Tap the mic to speak again");
    }, []),
    onError: useCallback((err: Error) => {
      setIsListening(false);
      setError(err.message);
      setStatusMsg("An error occurred. Please try again.");
    }, []),
  });

  const recorder = useVoiceRecorder();

  const handleMicPress = useCallback(async () => {
    if (isListening) {
      setIsListening(false);
      setStatusMsg("Processing your message…");
      try {
        const blob = await recorder.stopRecording();
        if (!blob || blob.size === 0) {
          setStatusMsg("Tap the mic to speak again");
          return;
        }
        const url = `${BASE}/api/ai/voice-chat`;
        await voiceStream.streamVoiceResponse(url, blob);
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          setError("Voice processing failed. Please try again.");
          setStatusMsg("Tap the mic to try again");
        }
      }
      return;
    }

    setError(null);
    setStatusMsg("Listening… tap again when done");
    setIsListening(true);
    try {
      await recorder.startRecording();
    } catch {
      setIsListening(false);
      setError("Microphone access denied. Please allow microphone permissions.");
      setStatusMsg("Microphone access needed");
    }
  }, [isListening, recorder, voiceStream]);

  const handleClose = useCallback(() => {
    recorder.stopRecording().catch(() => {});
    setIsOpen(false);
    setIsListening(false);
    setError(null);
    setStatusMsg("Tap the mic to speak with TempleBots Voice");
  }, [recorder]);

  const isPlaying = voiceStream.playbackState === "playing";

  return (
    <>
      {/* Floating trigger button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-24 right-6 z-50 h-12 w-12 rounded-full shadow-2xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
              boxShadow: "0 8px 32px rgba(124,58,237,0.45), 0 0 0 3px rgba(124,58,237,0.12)",
            }}
            aria-label="Open Voice TempleBots"
            title="TempleBots Voice"
          >
            <Phone className="h-5 w-5 text-white" />
            {isPlaying && (
              <motion.span
                animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="absolute inset-0 rounded-full bg-violet-500"
              />
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Voice chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="fixed bottom-6 right-6 z-50 w-80 rounded-3xl overflow-hidden shadow-2xl"
            style={{
              background: "linear-gradient(145deg, #0f0a1f 0%, #1a103a 100%)",
              border: "1px solid rgba(124,58,237,0.3)",
              boxShadow: "0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(124,58,237,0.2)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-violet-500/15">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center shadow-lg">
                  <Phone className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm leading-tight">TempleBots Voice</p>
                  <p className="text-violet-300/60 text-[10px]">AI Spiritual Companion</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsMuted(p => !p)}
                  className="h-7 w-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <VolumeX className="h-3.5 w-3.5 text-white/50" /> : <Volume2 className="h-3.5 w-3.5 text-violet-300" />}
                </button>
                <button
                  onClick={handleClose}
                  className="h-7 w-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <X className="h-3.5 w-3.5 text-white/50" />
                </button>
              </div>
            </div>

            {/* Transcript area */}
            <div className="h-48 overflow-y-auto px-4 py-3 space-y-3 scrollbar-hide">
              {transcripts.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-violet-300/40 text-xs text-center leading-relaxed">
                    Your conversation with TempleBots Voice will appear here.
                  </p>
                </div>
              ) : (
                transcripts.map((t, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: t.role === "user" ? 12 : -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                        t.role === "user"
                          ? "bg-violet-600/40 text-white ml-auto"
                          : "bg-white/8 text-violet-100"
                      }`}
                    >
                      {t.text}
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {/* Visualizer orb area */}
            <div className="flex flex-col items-center py-5 gap-4">
              {/* Orb */}
              <div className="relative">
                <motion.div
                  animate={
                    isListening
                      ? { scale: [1, 1.12, 1], opacity: [0.4, 0.7, 0.4] }
                      : isPlaying
                      ? { scale: [1, 1.08, 1], opacity: [0.3, 0.5, 0.3] }
                      : {}
                  }
                  transition={{ duration: isListening ? 0.8 : 1.2, repeat: Infinity }}
                  className="absolute inset-0 rounded-full bg-violet-500 blur-xl"
                />
                <motion.button
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={handleMicPress}
                  className="relative h-16 w-16 rounded-full flex items-center justify-center shadow-xl"
                  style={{
                    background: isListening
                      ? "linear-gradient(135deg, #dc2626, #b91c1c)"
                      : "linear-gradient(135deg, #7c3aed, #4f46e5)",
                    boxShadow: isListening
                      ? "0 8px 32px rgba(220,38,38,0.5)"
                      : "0 8px 32px rgba(124,58,237,0.5)",
                  }}
                >
                  {isListening ? (
                    <MicOff className="h-6 w-6 text-white" />
                  ) : (
                    <Mic className="h-6 w-6 text-white" />
                  )}

                  {/* Ripple rings when listening */}
                  {isListening && [0, 0.3, 0.6].map((delay) => (
                    <motion.span
                      key={delay}
                      animate={{ scale: [1, 1.8], opacity: [0.5, 0] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay, ease: "easeOut" }}
                      className="absolute inset-0 rounded-full border-2 border-red-400"
                    />
                  ))}
                </motion.button>
              </div>

              {/* Status text */}
              <p className="text-violet-300/70 text-[11px] text-center px-4">
                {statusMsg}
              </p>

              {/* Error */}
              {error && (
                <p className="text-red-400/80 text-[10px] text-center px-4 bg-red-500/5 rounded-lg py-1.5 border border-red-500/15 mx-4">
                  {error}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-violet-500/10 px-4 py-2.5 flex items-center justify-between">
              <p className="text-violet-300/30 text-[9px]">JCTM · Powered by GPT-5.2</p>
              <div className="flex items-center gap-1">
                {isPlaying && (
                  <motion.span
                    animate={{ scaleY: [1, 1.8, 1] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                    className="h-3 w-0.5 bg-violet-400 rounded-full"
                  />
                )}
                <span className={`text-[9px] font-medium ${isPlaying ? "text-violet-400" : isListening ? "text-red-400" : "text-violet-300/30"}`}>
                  {isPlaying ? "Speaking" : isListening ? "Listening" : "Ready"}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

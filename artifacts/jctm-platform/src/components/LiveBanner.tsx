import { useState } from "react";
import { useGetLivestreamStatus, getGetLivestreamStatusQueryKey } from "@workspace/api-client-react";
import { Radio, X, MessageSquare, Tv2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { LiveChat } from "@/components/LiveChat";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function LiveBanner() {
  const { data: status } = useGetLivestreamStatus({
    query: { queryKey: getGetLivestreamStatusQueryKey(), refetchInterval: 30000 }
  });
  const [showPlayer, setShowPlayer] = useState(false);
  const [mobileTab, setMobileTab] = useState<"video" | "chat">("video");

  if (!status?.isLive) return null;

  const videoIdMatch = status.streamUrl?.match(/[?&]v=([^&]+)/);
  const videoId = videoIdMatch?.[1] ?? "f7TOxaM2Mq4";
  const embedSrc = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&rel=0&modestbranding=1&origin=${encodeURIComponent(typeof window !== "undefined" ? window.location.origin : "")}`;

  return (
    <>
      {/* ── Sticky Live Bar ── */}
      <div className="bg-destructive text-destructive-foreground w-full py-2 px-4 flex justify-center items-center gap-3 shadow-md z-[60] relative">
        <div className="flex items-center gap-2 animate-pulse">
          <Radio className="h-4 w-4" />
          <span className="font-bold text-sm tracking-wide">LIVE NOW</span>
        </div>
        <div className="h-4 w-[1px] bg-destructive-foreground/30 hidden sm:block" />
        <span className="text-sm font-medium hidden sm:inline-block truncate max-w-md">
          {status.title || "JCTM Sunday Service"}
        </span>
        <button
          onClick={() => setShowPlayer(true)}
          className="ml-2 bg-white text-destructive text-xs font-bold px-3 py-1 rounded-full hover:bg-white/90 transition-colors"
        >
          🔴 Join Service
        </button>
      </div>

      {/* ── Live Player + Chat Modal ── */}
      <AnimatePresence>
        {showPlayer && (
          <motion.div
            key="live-banner-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 backdrop-blur-sm p-3 md:p-6"
            onClick={() => setShowPlayer(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
              className="relative w-full max-w-6xl rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col"
              style={{ height: "88vh", maxHeight: "88vh" }}
              onClick={e => e.stopPropagation()}
            >
              {/* ── Header bar ── */}
              <div className="bg-[#0a0a0a] flex items-center justify-between px-5 py-3 shrink-0">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-full w-full bg-red-500" />
                  </span>
                  <span className="text-white font-bold text-sm">{status.title || "Live Service — Jesus Christ Temple Ministry"}</span>
                </div>
                <button
                  onClick={() => setShowPlayer(false)}
                  className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                >
                  <X className="h-4 w-4 text-white/70" />
                </button>
              </div>

              {/* ── Mobile tab switcher ── */}
              <div className="flex md:hidden bg-[#111] border-b border-white/10 shrink-0">
                <button
                  onClick={() => setMobileTab("video")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${
                    mobileTab === "video" ? "text-white border-b-2 border-red-500" : "text-white/40"
                  }`}
                >
                  <Tv2 className="w-4 h-4" />
                  Watch
                </button>
                <button
                  onClick={() => setMobileTab("chat")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${
                    mobileTab === "chat" ? "text-white border-b-2 border-sky-500" : "text-white/40"
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  Live Chat
                </button>
              </div>

              {/* ── Content: side-by-side on desktop, tabbed on mobile ── */}
              <div className="flex flex-1 min-h-0 overflow-hidden bg-[#0d0d0d]">

                {/* Video panel — flex-1 so it fills remaining width beside chat */}
                <div
                  className={`${
                    mobileTab === "video" ? "flex" : "hidden"
                  } md:flex flex-col flex-1 bg-black min-w-0`}
                >
                  <iframe
                    key={videoId}
                    src={embedSrc}
                    title="JCTM Live Service"
                    allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                    className="w-full h-full"
                    style={{ minHeight: "260px" }}
                  />
                </div>

                {/* Chat panel — fixed 320px sidebar on desktop, full-width on mobile */}
                <div
                  className={`${
                    mobileTab === "chat" ? "flex" : "hidden"
                  } md:flex flex-col border-l border-white/10 bg-[#111] w-full md:w-80 md:flex-shrink-0`}
                >
                  <LiveChat isLive={true} embedded={true} />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

import { useState } from "react";
import { useGetLivestreamStatus, getGetLivestreamStatusQueryKey } from "@workspace/api-client-react";
import { Radio, X, MessageSquare, Tv2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { LiveChat } from "@/components/LiveChat";

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
      <div className="bg-destructive text-destructive-foreground w-full py-2 px-3 sm:px-4 flex items-center justify-center gap-2 sm:gap-3 shadow-md z-[60] relative">
        <div className="flex items-center gap-1.5 sm:gap-2 animate-pulse shrink-0">
          <Radio className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span className="font-bold text-xs sm:text-sm tracking-wide">LIVE NOW</span>
        </div>
        <div className="h-4 w-px bg-destructive-foreground/30 hidden sm:block shrink-0" />
        <span className="text-xs sm:text-sm font-medium hidden sm:block truncate max-w-xs md:max-w-sm lg:max-w-md">
          {status.title || "JCTM Sunday Service"}
        </span>
        <button
          onClick={() => setShowPlayer(true)}
          className="ml-auto sm:ml-2 bg-white text-destructive text-xs font-bold px-2.5 py-1 sm:px-3 rounded-full hover:bg-white/90 active:scale-95 transition-all touch-manipulation shrink-0"
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
            className="fixed inset-0 z-[300] flex flex-col sm:items-center sm:justify-center bg-black/90 backdrop-blur-sm sm:p-3 md:p-5 lg:p-6"
            onClick={() => setShowPlayer(false)}
          >
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 30 }}
              className={[
                "relative w-full flex flex-col overflow-hidden shadow-2xl",
                // Mobile: full-screen sheet sliding up from bottom
                "h-full rounded-t-2xl border-t border-white/10",
                // sm+: centered modal with rounded corners and border
                "sm:h-[88vh] sm:max-h-[88vh] sm:max-w-5xl lg:max-w-6xl",
                "sm:rounded-3xl sm:border sm:border-white/10",
                "bg-[#0a0a0a]",
              ].join(" ")}
              onClick={e => e.stopPropagation()}
            >
              {/* ── Header bar ── */}
              <div className="bg-[#0a0a0a] flex items-center justify-between px-4 py-3 shrink-0 border-b border-white/10">
                <div className="flex items-center gap-2 min-w-0 flex-1 mr-3">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-full w-full bg-red-500" />
                  </span>
                  <span className="text-white font-bold text-sm truncate">
                    {status.title || "Live Service — Jesus Christ Temple Ministry"}
                  </span>
                </div>
                <button
                  onClick={() => setShowPlayer(false)}
                  className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 flex items-center justify-center transition-colors touch-manipulation shrink-0"
                  aria-label="Close player"
                >
                  <X className="h-4 w-4 text-white/70" />
                </button>
              </div>

              {/* ── Mobile tab switcher (< md) ── */}
              <div className="flex md:hidden bg-[#111] border-b border-white/10 shrink-0">
                <button
                  onClick={() => setMobileTab("video")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors touch-manipulation ${
                    mobileTab === "video"
                      ? "text-white border-b-2 border-red-500"
                      : "text-white/40 active:text-white/70"
                  }`}
                >
                  <Tv2 className="w-4 h-4" />
                  Watch
                </button>
                <button
                  onClick={() => setMobileTab("chat")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors touch-manipulation ${
                    mobileTab === "chat"
                      ? "text-white border-b-2 border-sky-500"
                      : "text-white/40 active:text-white/70"
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  Live Chat
                </button>
              </div>

              {/* ── Content area ── */}
              <div className="flex flex-1 min-h-0 overflow-hidden bg-[#0d0d0d]">

                {/* Video panel */}
                <div
                  className={[
                    "flex-col flex-1 bg-black min-w-0 min-h-0",
                    mobileTab === "video" ? "flex" : "hidden",
                    "md:flex",
                  ].join(" ")}
                >
                  <iframe
                    key={videoId}
                    src={embedSrc}
                    title="JCTM Live Service"
                    allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                    className="w-full h-full"
                    style={{ minHeight: 0 }}
                  />
                </div>

                {/* Chat panel — responsive width: 288px on md, 320px on lg, 368px on xl */}
                <div
                  className={[
                    "flex-col border-l border-white/10 bg-[#111]",
                    // Mobile: full width when chat tab is active
                    mobileTab === "chat" ? "flex w-full" : "hidden",
                    // md+: fixed sidebar, never hidden
                    "md:flex md:w-72 lg:w-80 xl:w-96 md:flex-shrink-0",
                  ].join(" ")}
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

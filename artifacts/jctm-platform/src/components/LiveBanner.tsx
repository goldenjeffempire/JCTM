import { useState } from "react";
import { useGetLivestreamStatus, getGetLivestreamStatusQueryKey } from "@workspace/api-client-react";
import { Radio, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function LiveBanner() {
  const { data: status } = useGetLivestreamStatus({
    query: { queryKey: getGetLivestreamStatusQueryKey(), refetchInterval: 30000 }
  });
  const [showPlayer, setShowPlayer] = useState(false);

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

      {/* ── Embedded Player Modal ── */}
      <AnimatePresence>
        {showPlayer && (
          <motion.div
            key="live-banner-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
            onClick={() => setShowPlayer(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
              className="relative w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl border border-white/10"
              onClick={e => e.stopPropagation()}
            >
              <div className="bg-[#0a0a0a] flex items-center justify-between px-5 py-3">
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
              <div className="relative bg-black" style={{ paddingBottom: "56.25%" }}>
                <iframe
                  key={videoId}
                  src={embedSrc}
                  title="JCTM Live Service"
                  allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  className="absolute inset-0 w-full h-full"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

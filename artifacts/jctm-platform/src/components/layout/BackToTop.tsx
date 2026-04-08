import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp } from "lucide-react";

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 320);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          key="back-to-top"
          initial={{ opacity: 0, scale: 0.7, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.7, y: 16 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          onClick={scrollToTop}
          aria-label="Back to top"
          className="fixed bottom-6 left-6 z-50 h-11 w-11 rounded-2xl flex items-center justify-center shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent group"
          style={{
            background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))",
            boxShadow: "0 4px 24px rgba(56,189,248,0.25), 0 2px 8px rgba(0,0,0,0.18)",
          }}
          whileHover={{ scale: 1.1, boxShadow: "0 6px 32px rgba(56,189,248,0.38), 0 2px 12px rgba(0,0,0,0.22)" }}
          whileTap={{ scale: 0.95 }}
        >
          <ChevronUp className="h-5 w-5 text-white" strokeWidth={2.5} />
        </motion.button>
      )}
    </AnimatePresence>
  );
}

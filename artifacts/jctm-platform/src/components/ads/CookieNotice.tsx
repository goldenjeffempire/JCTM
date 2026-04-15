import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Cookie } from "lucide-react";
import { Link } from "wouter";

const STORAGE_KEY = "jctm_cookie_notice_dismissed";

export function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        const t = setTimeout(() => setVisible(true), 1500);
        return () => clearTimeout(t);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
          className="fixed bottom-4 left-4 right-4 z-[9999] md:left-auto md:right-5 md:max-w-sm"
        >
          <div className="glass-panel rounded-2xl border border-border/60 shadow-xl p-4 flex gap-3 items-start bg-background/95 backdrop-blur-md">
            <div className="shrink-0 mt-0.5 w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <Cookie className="h-4 w-4 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground font-semibold mb-1">Cookies & Advertising</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                We use cookies and Google AdSense to serve relevant ads and improve your experience.{" "}
                <Link href="/privacy" className="text-accent hover:underline" onClick={dismiss}>
                  Learn more
                </Link>
              </p>
              <button
                onClick={dismiss}
                className="mt-2.5 w-full text-xs font-semibold py-1.5 rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors"
              >
                Got it
              </button>
            </div>
            <button
              onClick={dismiss}
              className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-muted/40 transition-colors"
              aria-label="Dismiss cookie notice"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

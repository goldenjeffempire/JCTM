import { useEffect, useState, useCallback } from "react";
import { X, Heart, ShieldOff } from "lucide-react";
import { ADSENSE_ENABLED } from "./AdSense";

const STORAGE_KEY = "jctm_adblock_dismissed";
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    return Date.now() - ts < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {}
}

async function detectAdBlock(): Promise<boolean> {
  if (!ADSENSE_ENABLED) return false;

  return new Promise(resolve => {
    const probe = document.createElement("div");
    probe.setAttribute("class", "adsbygoogle");
    probe.style.cssText =
      "position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;";
    document.body.appendChild(probe);

    const img = document.createElement("img");
    img.style.cssText = "display:block;width:1px;height:1px;";
    img.onload = () => {
      document.body.removeChild(probe);
      const blocked =
        window.getComputedStyle(probe).display === "none" ||
        probe.offsetParent === null ||
        probe.offsetHeight === 0;
      resolve(blocked);
    };
    img.onerror = () => {
      try { document.body.removeChild(probe); } catch {}
      resolve(true);
    };
    img.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6817509745706083&test=1";
    probe.appendChild(img);

    setTimeout(() => {
      try { document.body.removeChild(probe); } catch {}
      resolve(true);
    }, 2000);
  });
}

export function AdBlockDetector() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isDismissed()) return;

    const timer = setTimeout(async () => {
      const blocked = await detectAdBlock();
      if (blocked) setVisible(true);
    }, 3500);

    return () => clearTimeout(timer);
  }, []);

  const dismiss = useCallback(() => {
    markDismissed();
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="complementary"
      aria-label="Ad blocker notice"
      className="fixed bottom-0 left-0 right-0 z-[9999] pointer-events-none flex items-end justify-center px-4 pb-4"
    >
      <div
        className="pointer-events-auto w-full max-w-xl rounded-2xl border border-amber-400/40 bg-slate-900/95 backdrop-blur-md shadow-2xl p-5 animate-in slide-in-from-bottom-4 duration-500"
      >
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute right-3 top-3 rounded-full p-1 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex gap-4 items-start">
          <span className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center mt-0.5">
            <ShieldOff className="h-5 w-5 text-amber-400" />
          </span>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white leading-snug">
              We noticed an ad blocker
            </p>
            <p className="mt-1 text-xs text-slate-300 leading-relaxed">
              Ads help fund our free ministry content — sermons, devotionals,
              and AI tools — at no cost to you. Please consider whitelisting
              <span className="text-amber-400 font-medium"> jctm.org.ng</span>{" "}
              in your ad blocker.
            </p>

            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={dismiss}
                className="flex items-center gap-1.5 rounded-full bg-amber-500 hover:bg-amber-400 px-4 py-1.5 text-xs font-semibold text-slate-900 transition-colors"
              >
                <Heart className="h-3.5 w-3.5" />
                I'll whitelist the site
              </button>
              <button
                onClick={dismiss}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors underline underline-offset-2"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

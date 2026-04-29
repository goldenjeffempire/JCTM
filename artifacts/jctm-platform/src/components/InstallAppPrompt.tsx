import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Smartphone, X, Share, Plus } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

const SHEET_KEY = "jctm_install_prompt_collapsed";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  return Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
}

function detectPlatform(): "ios" | "android" | "desktop" | "other" {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
  if (isIos) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Win|Mac|Linux|CrOS/i.test(ua)) return "desktop";
  return "other";
}

export function InstallAppPrompt() {
  const [installed, setInstalled] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [showIosSheet, setShowIosSheet] = useState(false);
  const [platform, setPlatform] = useState<ReturnType<typeof detectPlatform>>("other");

  useEffect(() => {
    if (typeof window === "undefined") return;

    setPlatform(detectPlatform());
    setInstalled(isStandalone());

    // Per the user's request, the prompt re-appears on every refresh.
    // sessionStorage is used only to remember a *current-tab* collapsed state
    // so it doesn't keep popping back open as the user navigates within one
    // session. Refreshing the tab clears it.
    try {
      if (sessionStorage.getItem(SHEET_KEY) === "1") setCollapsed(true);
    } catch {
      /* storage may be unavailable */
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("appinstalled", onInstalled);

    const mql = window.matchMedia?.("(display-mode: standalone)");
    const onDisplayChange = () => setInstalled(isStandalone());
    mql?.addEventListener?.("change", onDisplayChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", onInstalled);
      mql?.removeEventListener?.("change", onDisplayChange);
    };
  }, []);

  if (installed) return null;
  if (platform === "other") return null; // unrecognized environment, don't pester

  const triggerInstall = async () => {
    if (deferred) {
      try {
        await deferred.prompt();
        const choice = await deferred.userChoice;
        if (choice.outcome === "accepted") {
          setInstalled(true);
        }
      } catch {
        /* user gesture errors are non-fatal */
      } finally {
        setDeferred(null);
      }
      return;
    }
    if (platform === "ios") {
      setShowIosSheet(true);
      return;
    }
    // Chromium without a deferred prompt yet (engagement heuristics not met):
    // open a brief instructions sheet so the user can install manually.
    setShowIosSheet(true);
  };

  const collapseForSession = () => {
    setCollapsed(true);
    try {
      sessionStorage.setItem(SHEET_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const reopen = () => {
    setCollapsed(false);
    try {
      sessionStorage.removeItem(SHEET_KEY);
    } catch {
      /* ignore */
    }
  };

  const platformCopy =
    platform === "ios"
      ? "Install Temple TV on your iPhone — full screen, instant access, push alerts when we go live."
      : platform === "android"
        ? "Install Temple TV on your Android — full screen, instant access, push alerts when we go live."
        : "Install Temple TV on your computer — full screen, instant access, push alerts when we go live.";

  return (
    <>
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            className="fixed bottom-3 left-1/2 z-[60] w-[calc(100vw-1.5rem)] max-w-md -translate-x-1/2 sm:bottom-5"
            role="dialog"
            aria-label="Install Temple TV app"
            data-testid="install-app-prompt"
          >
            <div
              className="relative flex items-start gap-3 rounded-2xl border p-3.5 shadow-2xl sm:p-4"
              style={{
                background: "rgba(0, 10, 26, 0.96)",
                backdropFilter: "blur(20px)",
                borderColor: "rgba(56, 189, 248, 0.3)",
              }}
            >
              <div className="relative shrink-0">
                <button
                  onClick={collapseForSession}
                  aria-label="Dismiss install prompt"
                  className="absolute -top-1.5 -left-1.5 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-[#001225] text-white/70 hover:text-white hover:border-white/40 transition-colors cursor-pointer shadow-md"
                  data-testid="install-app-collapse"
                >
                  <X className="h-3 w-3" />
                </button>
                <div
                  className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{
                    background: "rgba(56, 189, 248, 0.18)",
                    border: "1px solid rgba(56,189,248,0.4)",
                  }}
                >
                  <Smartphone className="h-5 w-5 text-sky-400" />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white leading-snug">
                  Install the JCTM App
                </p>
                <p className="mt-0.5 text-[11px] text-white/60 leading-snug sm:text-xs">
                  {platformCopy}
                </p>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={triggerInstall}
                    className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer"
                    style={{
                      background: "linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)",
                      color: "#001225",
                      border: "1px solid rgba(56,189,248,0.6)",
                    }}
                    data-testid="install-app-button"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Install app
                  </button>
                  <button
                    onClick={collapseForSession}
                    className="text-xs text-white/40 hover:text-white/70 transition-colors cursor-pointer"
                    data-testid="install-app-dismiss"
                  >
                    Maybe later
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Re-open mini-pill when collapsed — keeps the option always visible */}
      <AnimatePresence>
        {collapsed && !installed && (
          <motion.button
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            onClick={reopen}
            className="fixed bottom-3 right-3 z-[60] inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold shadow-2xl cursor-pointer sm:bottom-5 sm:right-5"
            style={{
              background: "rgba(0, 10, 26, 0.96)",
              border: "1px solid rgba(56,189,248,0.4)",
              color: "#7dd3fc",
              backdropFilter: "blur(20px)",
            }}
            aria-label="Install Temple TV app"
            data-testid="install-app-reopen"
          >
            <Download className="h-3.5 w-3.5" />
            Install app
          </motion.button>
        )}
      </AnimatePresence>

      {/* Manual install instructions sheet */}
      <AnimatePresence>
        {showIosSheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-4 sm:items-center"
            onClick={() => setShowIosSheet(false)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border p-5 shadow-2xl"
              style={{
                background: "rgba(0, 10, 26, 0.98)",
                borderColor: "rgba(56, 189, 248, 0.3)",
                backdropFilter: "blur(24px)",
              }}
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold text-white">How to install Temple TV</h3>
                <button
                  onClick={() => setShowIosSheet(false)}
                  aria-label="Close"
                  className="text-white/40 hover:text-white/80"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {platform === "ios" ? (
                <ol className="space-y-3 text-sm text-white/80">
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-xs font-bold text-sky-300">1</span>
                    <span className="leading-snug">
                      Tap the <Share className="inline h-3.5 w-3.5 -translate-y-px text-sky-300" /> <span className="font-semibold text-white">Share</span> button at the bottom of Safari.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-xs font-bold text-sky-300">2</span>
                    <span className="leading-snug">
                      Scroll down and tap <Plus className="inline h-3.5 w-3.5 -translate-y-px text-sky-300" /> <span className="font-semibold text-white">Add to Home Screen</span>.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-xs font-bold text-sky-300">3</span>
                    <span className="leading-snug">
                      Tap <span className="font-semibold text-white">Add</span>. Open Temple TV from your Home Screen for full-screen mode and live alerts.
                    </span>
                  </li>
                </ol>
              ) : (
                <ol className="space-y-3 text-sm text-white/80">
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-xs font-bold text-sky-300">1</span>
                    <span className="leading-snug">
                      Open the browser menu (the <span className="font-semibold text-white">⋮</span> icon in the top-right).
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-xs font-bold text-sky-300">2</span>
                    <span className="leading-snug">
                      Choose <span className="font-semibold text-white">Install app</span> or <span className="font-semibold text-white">Add to Home Screen</span>.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-xs font-bold text-sky-300">3</span>
                    <span className="leading-snug">
                      Confirm to install. Temple TV will open in its own window with push alerts enabled.
                    </span>
                  </li>
                </ol>
              )}

              <button
                onClick={() => setShowIosSheet(false)}
                className="mt-5 w-full rounded-full px-4 py-2 text-sm font-semibold transition-colors"
                style={{
                  background: "linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)",
                  color: "#001225",
                }}
              >
                Got it
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

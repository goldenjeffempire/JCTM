import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie, Shield, BarChart3, Megaphone, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Link } from "wouter";

export type ConsentState = {
  essential: true;
  analytics: boolean;
  advertising: boolean;
};

const STORAGE_KEY = "jctm_cookie_consent_v2";
const LEGACY_KEY = "jctm_cookie_notice_dismissed";

export function getConsentState(): ConsentState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ConsentState;
    if (localStorage.getItem(LEGACY_KEY)) {
      return { essential: true, analytics: true, advertising: true };
    }
  } catch { /* ignore */ }
  return null;
}

function saveConsent(state: ConsentState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    localStorage.setItem(LEGACY_KEY, "1");
  } catch { /* ignore */ }
}

export function useCookieConsent() {
  const [consent, setConsent] = useState<ConsentState | null>(() => getConsentState());
  useEffect(() => {
    const handler = () => setConsent(getConsentState());
    window.addEventListener("jctm:consent-updated", handler);
    return () => window.removeEventListener("jctm:consent-updated", handler);
  }, []);
  return consent;
}

function dispatchConsentUpdate() {
  window.dispatchEvent(new Event("jctm:consent-updated"));
}

type ToggleProps = { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean };
function Toggle({ checked, onChange, disabled }: ToggleProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent/50 ${
        checked ? "bg-accent" : "bg-muted-foreground/30"
      } ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [advertising, setAdvertising] = useState(true);

  useEffect(() => {
    try {
      if (!getConsentState()) {
        const t = setTimeout(() => setVisible(true), 800);
        return () => clearTimeout(t);
      }
    } catch {
      setVisible(true);
    }
    return undefined;
  }, []);

  const accept = useCallback((state: ConsentState) => {
    saveConsent(state);
    dispatchConsentUpdate();
    setVisible(false);
  }, []);

  const acceptAll = () => accept({ essential: true, analytics: true, advertising: true });
  const acceptEssential = () => accept({ essential: true, analytics: false, advertising: false });
  const acceptCustom = () => accept({ essential: true, analytics, advertising });

  return (
    <AnimatePresence>
      {visible && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[9990]"
            onClick={acceptEssential}
          />

          <motion.div
            initial={{ opacity: 0, y: 80 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 80 }}
            transition={{ type: "spring", stiffness: 280, damping: 32 }}
            className="fixed bottom-0 left-0 right-0 z-[9999] max-h-[90vh] overflow-y-auto"
          >
            <div className="bg-background border-t-2 border-accent/30 shadow-2xl shadow-black/30">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

                <div className="flex items-start gap-4 mb-5">
                  <div className="shrink-0 w-12 h-12 rounded-xl bg-accent/15 border border-accent/20 flex items-center justify-center">
                    <Cookie className="h-6 w-6 text-accent" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg sm:text-xl font-serif font-bold text-primary mb-1">
                      Your Privacy &amp; Cookie Preferences
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
                      We use cookies and similar technologies to operate this website, serve personalised ads through{" "}
                      <strong className="text-foreground">Google AdSense</strong>, and understand how visitors engage with
                      our content. You choose what you allow — your selection is saved and can be changed at any time.{" "}
                      <Link
                        href="/privacy"
                        className="text-accent hover:text-accent/80 underline underline-offset-2 inline-flex items-center gap-0.5"
                        onClick={acceptEssential}
                      >
                        Privacy Policy <ExternalLink className="h-3 w-3" />
                      </Link>
                    </p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-3 gap-3 mb-5">
                  <div className="flex items-start gap-3 p-3.5 rounded-xl border border-border/60 bg-muted/20">
                    <Shield className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Essential</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Login sessions, security, basic site functions. Always active.</p>
                    </div>
                    <span className="ml-auto shrink-0 text-xs font-bold text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">Always on</span>
                  </div>

                  <div className="flex items-start gap-3 p-3.5 rounded-xl border border-border/60 bg-muted/20">
                    <BarChart3 className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Analytics</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Understand how people use the site so we can improve it.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3.5 rounded-xl border border-border/60 bg-muted/20">
                    <Megaphone className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Advertising</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Google AdSense personalised ads that help fund this ministry.</p>
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {expanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden mb-5"
                    >
                      <div className="rounded-xl border border-border/60 bg-muted/10 divide-y divide-border/40">
                        <div className="flex items-center justify-between px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <Shield className="h-4 w-4 text-green-500" />
                            <div>
                              <p className="text-sm font-semibold text-foreground">Essential Cookies</p>
                              <p className="text-xs text-muted-foreground">Required for the website to function. Cannot be disabled.</p>
                            </div>
                          </div>
                          <Toggle checked={true} onChange={() => {}} disabled />
                        </div>

                        <div className="flex items-center justify-between px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <BarChart3 className="h-4 w-4 text-blue-500" />
                            <div>
                              <p className="text-sm font-semibold text-foreground">Analytics Cookies</p>
                              <p className="text-xs text-muted-foreground">Help us understand sermon views, page visits, and usage patterns.</p>
                            </div>
                          </div>
                          <Toggle checked={analytics} onChange={setAnalytics} />
                        </div>

                        <div className="flex items-center justify-between px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <Megaphone className="h-4 w-4 text-amber-500" />
                            <div>
                              <p className="text-sm font-semibold text-foreground">Advertising Cookies</p>
                              <p className="text-xs text-muted-foreground">Google AdSense uses these to serve ads relevant to you. Revenue supports this ministry.</p>
                            </div>
                          </div>
                          <Toggle checked={advertising} onChange={setAdvertising} />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <button
                    onClick={acceptAll}
                    className="order-1 sm:order-3 flex-1 sm:flex-none sm:min-w-[160px] py-3 px-6 rounded-xl bg-accent text-white font-bold text-sm hover:bg-accent/90 active:scale-[0.98] transition-all shadow-lg shadow-accent/20"
                  >
                    Accept All Cookies
                  </button>

                  <button
                    onClick={acceptEssential}
                    className="order-2 sm:order-2 flex-1 sm:flex-none sm:min-w-[140px] py-3 px-6 rounded-xl border-2 border-border text-foreground font-semibold text-sm hover:border-accent/40 hover:bg-muted/30 active:scale-[0.98] transition-all"
                  >
                    Essential Only
                  </button>

                  {expanded ? (
                    <button
                      onClick={acceptCustom}
                      className="order-3 sm:order-2 flex-1 sm:flex-none sm:min-w-[140px] py-3 px-6 rounded-xl border-2 border-accent/40 text-accent font-semibold text-sm hover:bg-accent/5 active:scale-[0.98] transition-all"
                    >
                      Save My Choices
                    </button>
                  ) : null}

                  <button
                    onClick={() => setExpanded(v => !v)}
                    className="order-4 sm:order-1 flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl text-muted-foreground text-sm font-medium hover:text-foreground hover:bg-muted/30 transition-colors"
                  >
                    {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    {expanded ? "Hide options" : "Manage preferences"}
                  </button>
                </div>

                <p className="text-[11px] text-muted-foreground/70 mt-4 text-center">
                  Jesus Christ Temple Ministry · Warri, Nigeria · By continuing you agree to our{" "}
                  <Link href="/privacy" className="hover:text-muted-foreground underline" onClick={acceptEssential}>
                    Privacy Policy
                  </Link>
                </p>

              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

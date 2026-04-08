import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, X, Check } from "lucide-react";
import { useLanguage, LANGUAGES } from "@/contexts/LanguageContext";
import { useGeo } from "@/contexts/GeoContext";

const GEO_LANGUAGE_HINTS: Record<string, string> = {
  NG: "yo",
  FR: "fr",
  ES: "es",
  PT: "pt",
  BR: "pt",
  DE: "de",
  IT: "it",
  RU: "ru",
  CN: "zh",
  TW: "zh",
  JP: "ja",
  KR: "ko",
  SA: "ar",
  AE: "ar",
  EG: "ar",
  IN: "hi",
  KE: "sw",
  TZ: "sw",
  UG: "sw",
  ID: "id",
  MY: "ms",
  PH: "tl",
  TH: "th",
  VN: "vi",
  ET: "am",
  SO: "so",
  ZA: "zu",
  ZW: "sn",
  RW: "rw",
  MW: "ny",
  MG: "mg",
  LS: "st",
  IR: "fa",
  IL: "he",
  UA: "uk",
  PL: "pl",
  RO: "ro",
  TR: "tr",
  NL: "nl",
  SE: "sv",
  DK: "da",
  FI: "fi",
  NO: "no",
  GR: "el",
  BG: "bg",
  RS: "sr",
  GE: "ka",
  AM: "hy",
  AZ: "az",
  KZ: "kk",
  UZ: "uz",
  BD: "bn",
  PK: "ur",
  KH: "km",
  LA: "lo",
  MM: "my",
};

function getBrowserLangSuggestion(): string | null {
  const nav = navigator.languages ?? [navigator.language];
  for (const lang of nav) {
    const code = lang.split("-")[0].toLowerCase();
    if (code && code !== "en" && LANGUAGES[code]) return code;
  }
  return null;
}

const DISMISSED_KEY = "jctm-lang-banner-dismissed";

export function LanguageSuggestionBanner() {
  const { language, setLanguage, t } = useLanguage();
  const { geo, isLoading } = useGeo();
  const [visible, setVisible] = useState(false);
  const [suggestedCode, setSuggestedCode] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading || language !== "en" || sessionStorage.getItem(DISMISSED_KEY)) {
      return undefined;
    }

    const browserSuggestion = getBrowserLangSuggestion();
    const geoSuggestion = geo?.countryCode ? GEO_LANGUAGE_HINTS[geo.countryCode] ?? null : null;
    const suggestion = browserSuggestion ?? geoSuggestion;

    if (!suggestion || !LANGUAGES[suggestion] || suggestion === language) return undefined;

    setSuggestedCode(suggestion);
    const timer = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(timer);
  }, [geo, isLoading, language]);

  const dismiss = () => {
    setVisible(false);
    sessionStorage.setItem(DISMISSED_KEY, "1");
  };

  const accept = () => {
    if (suggestedCode) setLanguage(suggestedCode);
    dismiss();
  };

  const lang = suggestedCode ? LANGUAGES[suggestedCode] : null;
  if (!lang) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 60, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
        >
          <div className="glass-panel rounded-2xl p-4 border border-border shadow-2xl flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
              <Globe className="h-4 w-4 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-primary">
                {lang.flag} Switch to {lang.nativeName}?
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                We detected {lang.name} may be your preferred language. Switch now for the best experience.
              </p>
              <div className="flex items-center gap-2 mt-2.5">
                <button
                  onClick={accept}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent text-white text-xs font-semibold hover:bg-accent/90 transition-colors"
                >
                  <Check className="h-3 w-3" />
                  Switch to {lang.nativeName}
                </button>
                <button
                  onClick={dismiss}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1.5"
                >
                  Keep English
                </button>
              </div>
            </div>
            <button onClick={dismiss} className="text-muted-foreground hover:text-primary transition-colors shrink-0 mt-0.5">
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

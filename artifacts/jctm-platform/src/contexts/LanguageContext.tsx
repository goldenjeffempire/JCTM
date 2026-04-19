import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { uiString } from "@/i18n/ui";
import { safeLocalGet, safeLocalSet } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export const LANGUAGES: Record<string, { name: string; nativeName: string; flag: string }> = {
  // ── Major global languages ─────────────────────────────
  en: { name: "English",       nativeName: "English",           flag: "🇬🇧" },
  fr: { name: "French",        nativeName: "Français",          flag: "🇫🇷" },
  es: { name: "Spanish",       nativeName: "Español",           flag: "🇪🇸" },
  pt: { name: "Portuguese",    nativeName: "Português",         flag: "🇵🇹" },
  de: { name: "German",        nativeName: "Deutsch",           flag: "🇩🇪" },
  it: { name: "Italian",       nativeName: "Italiano",          flag: "🇮🇹" },
  ru: { name: "Russian",       nativeName: "Русский",           flag: "🇷🇺" },
  zh: { name: "Chinese",       nativeName: "中文",               flag: "🇨🇳" },
  ja: { name: "Japanese",      nativeName: "日本語",             flag: "🇯🇵" },
  ko: { name: "Korean",        nativeName: "한국어",             flag: "🇰🇷" },
  ar: { name: "Arabic",        nativeName: "العربية",           flag: "🇸🇦" },
  hi: { name: "Hindi",         nativeName: "हिन्दी",            flag: "🇮🇳" },
  // ── Nigerian languages ─────────────────────────────────
  yo: { name: "Yoruba",        nativeName: "Yorùbá",            flag: "🇳🇬" },
  ig: { name: "Igbo",          nativeName: "Igbo",              flag: "🇳🇬" },
  ha: { name: "Hausa",         flag: "🇳🇬",                     nativeName: "Hausa" },
  // ── African languages ──────────────────────────────────
  sw: { name: "Swahili",       nativeName: "Kiswahili",         flag: "🇰🇪" },
  am: { name: "Amharic",       nativeName: "አማርኛ",             flag: "🇪🇹" },
  so: { name: "Somali",        nativeName: "Soomaali",          flag: "🇸🇴" },
  zu: { name: "Zulu",          nativeName: "isiZulu",           flag: "🇿🇦" },
  xh: { name: "Xhosa",        nativeName: "isiXhosa",          flag: "🇿🇦" },
  sn: { name: "Shona",        nativeName: "Shona",             flag: "🇿🇼" },
  rw: { name: "Kinyarwanda",  nativeName: "Kinyarwanda",       flag: "🇷🇼" },
  lg: { name: "Luganda",      nativeName: "Luganda",           flag: "🇺🇬" },
  ny: { name: "Chichewa",     nativeName: "Chichewa",          flag: "🇲🇼" },
  st: { name: "Sesotho",      nativeName: "Sesotho",           flag: "🇱🇸" },
  mg: { name: "Malagasy",     nativeName: "Malagasy",          flag: "🇲🇬" },
  // ── South & Southeast Asia ────────────────────────────
  id: { name: "Indonesian",   nativeName: "Bahasa Indonesia",  flag: "🇮🇩" },
  ms: { name: "Malay",        nativeName: "Bahasa Melayu",     flag: "🇲🇾" },
  tl: { name: "Filipino",     nativeName: "Filipino",          flag: "🇵🇭" },
  bn: { name: "Bengali",      nativeName: "বাংলা",             flag: "🇧🇩" },
  ur: { name: "Urdu",         nativeName: "اردو",              flag: "🇵🇰" },
  ta: { name: "Tamil",        nativeName: "தமிழ்",             flag: "🇮🇳" },
  te: { name: "Telugu",       nativeName: "తెలుగు",            flag: "🇮🇳" },
  mr: { name: "Marathi",      nativeName: "मराठी",             flag: "🇮🇳" },
  vi: { name: "Vietnamese",   nativeName: "Tiếng Việt",        flag: "🇻🇳" },
  th: { name: "Thai",         nativeName: "ภาษาไทย",           flag: "🇹🇭" },
  km: { name: "Khmer",        nativeName: "ភាសាខ្មែរ",          flag: "🇰🇭" },
  lo: { name: "Lao",          nativeName: "ລາວ",               flag: "🇱🇦" },
  my: { name: "Burmese",      nativeName: "မြန်မာဘာသာ",        flag: "🇲🇲" },
  // ── European languages ────────────────────────────────
  nl: { name: "Dutch",        nativeName: "Nederlands",        flag: "🇳🇱" },
  tr: { name: "Turkish",      nativeName: "Türkçe",            flag: "🇹🇷" },
  pl: { name: "Polish",       nativeName: "Polski",            flag: "🇵🇱" },
  ro: { name: "Romanian",     nativeName: "Română",            flag: "🇷🇴" },
  hu: { name: "Hungarian",    nativeName: "Magyar",            flag: "🇭🇺" },
  cs: { name: "Czech",        nativeName: "Čeština",           flag: "🇨🇿" },
  sv: { name: "Swedish",      nativeName: "Svenska",           flag: "🇸🇪" },
  da: { name: "Danish",       nativeName: "Dansk",             flag: "🇩🇰" },
  fi: { name: "Finnish",      nativeName: "Suomi",             flag: "🇫🇮" },
  no: { name: "Norwegian",    nativeName: "Norsk",             flag: "🇳🇴" },
  uk: { name: "Ukrainian",    nativeName: "Українська",        flag: "🇺🇦" },
  el: { name: "Greek",        nativeName: "Ελληνικά",          flag: "🇬🇷" },
  bg: { name: "Bulgarian",    nativeName: "Български",         flag: "🇧🇬" },
  sr: { name: "Serbian",      nativeName: "Српски",            flag: "🇷🇸" },
  // ── Middle East & Central Asia ───────────────────────
  fa: { name: "Persian",      nativeName: "فارسی",             flag: "🇮🇷" },
  he: { name: "Hebrew",       nativeName: "עברית",             flag: "🇮🇱" },
  ka: { name: "Georgian",     nativeName: "ქართული",           flag: "🇬🇪" },
  hy: { name: "Armenian",     nativeName: "Հայերեն",           flag: "🇦🇲" },
  az: { name: "Azerbaijani",  nativeName: "Azərbaycan",        flag: "🇦🇿" },
  kk: { name: "Kazakh",       nativeName: "Қазақша",           flag: "🇰🇿" },
  uz: { name: "Uzbek",        nativeName: "O'zbek",            flag: "🇺🇿" },
};

// Languages that use right-to-left script
export const RTL_LANGUAGES = new Set(["ar", "ur", "fa", "he"]);

interface LanguageContextValue {
  language: string;
  setLanguage: (lang: string) => void;
  /** Instant lookup from pre-built translation table */
  t: (key: string) => string;
  /** Async AI translation for arbitrary dynamic text */
  translate: (text: string) => Promise<string>;
  translateBatch: (texts: string[]) => Promise<string[]>;
  isTranslating: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const translationCache = new Map<string, string>();

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState(() => {
    return safeLocalGet("jctm-language") ?? "en";
  });
  const [isTranslating, setIsTranslating] = useState(false);

  const handleSetLanguage = useCallback((lang: string) => {
    setLanguage(lang);
    safeLocalSet("jctm-language", lang);
    document.documentElement.setAttribute("dir", RTL_LANGUAGES.has(lang) ? "rtl" : "ltr");
    document.documentElement.setAttribute("lang", lang);
  }, []);

  // Apply dir/lang on mount
  useEffect(() => {
    document.documentElement.setAttribute("dir", RTL_LANGUAGES.has(language) ? "rtl" : "ltr");
    document.documentElement.setAttribute("lang", language);
  }, [language]);

  /** Instant lookup — uses pre-built translation table */
  const t = useCallback((key: string): string => {
    return uiString(key, language);
  }, [language]);

  /** Async AI translation for arbitrary text */
  const translate = useCallback(async (text: string): Promise<string> => {
    if (language === "en" || !text.trim()) return text;
    const cacheKey = `${language}:${text}`;
    if (translationCache.has(cacheKey)) return translationCache.get(cacheKey)!;

    setIsTranslating(true);
    try {
      const res = await fetch(`${BASE}/api/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, targetLanguage: language }),
      });
      if (!res.ok) return text;
      const data = (await res.json()) as { translated: string };
      translationCache.set(cacheKey, data.translated);
      return data.translated;
    } catch {
      return text;
    } finally {
      setIsTranslating(false);
    }
  }, [language]);

  const translateBatch = useCallback(async (texts: string[]): Promise<string[]> => {
    if (language === "en") return texts;
    setIsTranslating(true);
    try {
      const res = await fetch(`${BASE}/api/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: texts, targetLanguage: language }),
      });
      if (!res.ok) return texts;
      const data = (await res.json()) as { translated: string[] };
      return Array.isArray(data.translated) ? data.translated : texts;
    } catch {
      return texts;
    } finally {
      setIsTranslating(false);
    }
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t, translate, translateBatch, isTranslating }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}

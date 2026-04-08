import { createContext, useContext, useState, useCallback, ReactNode } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export const LANGUAGES: Record<string, { name: string; nativeName: string; flag: string }> = {
  en: { name: "English", nativeName: "English", flag: "🇬🇧" },
  yo: { name: "Yoruba", nativeName: "Yorùbá", flag: "🇳🇬" },
  ig: { name: "Igbo", nativeName: "Igbo", flag: "🇳🇬" },
  ha: { name: "Hausa", nativeName: "Hausa", flag: "🇳🇬" },
  fr: { name: "French", nativeName: "Français", flag: "🇫🇷" },
  es: { name: "Spanish", nativeName: "Español", flag: "🇪🇸" },
  pt: { name: "Portuguese", nativeName: "Português", flag: "🇵🇹" },
  de: { name: "German", nativeName: "Deutsch", flag: "🇩🇪" },
  ar: { name: "Arabic", nativeName: "العربية", flag: "🇸🇦" },
  zh: { name: "Chinese", nativeName: "中文", flag: "🇨🇳" },
  hi: { name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳" },
  sw: { name: "Swahili", nativeName: "Kiswahili", flag: "🇰🇪" },
  ru: { name: "Russian", nativeName: "Русский", flag: "🇷🇺" },
  it: { name: "Italian", nativeName: "Italiano", flag: "🇮🇹" },
  ko: { name: "Korean", nativeName: "한국어", flag: "🇰🇷" },
  ja: { name: "Japanese", nativeName: "日本語", flag: "🇯🇵" },
  id: { name: "Indonesian", nativeName: "Bahasa Indonesia", flag: "🇮🇩" },
};

interface LanguageContextValue {
  language: string;
  setLanguage: (lang: string) => void;
  translate: (text: string) => Promise<string>;
  translateBatch: (texts: string[]) => Promise<string[]>;
  isTranslating: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const translationCache = new Map<string, string>();

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem("jctm-language") ?? "en";
  });
  const [isTranslating, setIsTranslating] = useState(false);

  const handleSetLanguage = useCallback((lang: string) => {
    setLanguage(lang);
    localStorage.setItem("jctm-language", lang);
  }, []);

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
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, translate, translateBatch, isTranslating }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}

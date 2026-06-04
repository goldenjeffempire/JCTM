/**
 * usePageStrings — Batch-translate a map of English UI strings for a page.
 *
 * Usage:
 *   const s = usePageStrings({
 *     hero: "The Land of Good News",
 *     watchNow: "Watch Now",
 *     subtitle: "Join us every Sunday at 8 AM WAT",
 *   });
 *   // s.hero = translated string (or English while loading)
 *   <h1>{s.hero}</h1>
 *
 * Strings update reactively whenever the user switches language.
 * Results are cached by language code so switching back is instant.
 */
import { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

type StringMap = Record<string, string>;

// Module-level cache: lang → (key:value pairs as JSON) → translated map
const pageStringCache = new Map<string, Map<string, string>>();

export function usePageStrings<T extends StringMap>(englishStrings: T): T {
  const { language, translateBatch } = useLanguage();
  const [translated, setTranslated] = useState<T>(englishStrings);
  const englishRef = useRef(englishStrings);
  const pendingRef = useRef(false);

  useEffect(() => {
    if (language === "en") {
      setTranslated(englishRef.current);
      return;
    }

    const keys = Object.keys(englishRef.current) as (keyof T & string)[];
    const values = keys.map(k => englishRef.current[k]);
    const cacheMapKey = JSON.stringify(values);

    // Check module-level cache
    const langCache = pageStringCache.get(language);
    if (langCache?.has(cacheMapKey)) {
      const cached = JSON.parse(langCache.get(cacheMapKey)!);
      const newMap = { ...englishRef.current };
      keys.forEach((k, i) => { newMap[k] = cached[i] ?? englishRef.current[k]; });
      setTranslated(newMap as T);
      return;
    }

    if (pendingRef.current) return;
    pendingRef.current = true;

    translateBatch(values).then(results => {
      pendingRef.current = false;
      const newMap = { ...englishRef.current };
      keys.forEach((k, i) => { newMap[k] = results[i] ?? englishRef.current[k]; });
      setTranslated(newMap as T);

      // Store in module-level cache
      if (!pageStringCache.has(language)) pageStringCache.set(language, new Map());
      pageStringCache.get(language)!.set(cacheMapKey, JSON.stringify(results));
    }).catch(() => {
      pendingRef.current = false;
    });
  }, [language, translateBatch]);

  return translated;
}

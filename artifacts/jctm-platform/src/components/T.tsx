/**
 * <T> — Translates arbitrary dynamic text via the AI translation API.
 * Uses the translation cache so repeated renders are instant.
 *
 * Usage:
 *   <T>Sermon title or any dynamic English text here</T>
 *
 * For static UI strings, use the t() function from useLanguage() instead —
 * it's instant and doesn't require a network call.
 */
import { useState, useEffect, createElement, type JSX } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

interface TProps {
  children: string;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

export function T({ children, className, as: Tag = "span" }: TProps) {
  const { language, translate } = useLanguage();
  const [text, setText] = useState(children);

  useEffect(() => {
    let cancelled = false;
    if (language === "en") {
      setText(children);
      return;
    }
    translate(children).then(result => {
      if (!cancelled) setText(result);
    });
    return () => { cancelled = true; };
  }, [children, language, translate]);

  return createElement(Tag, { className }, text);
}

/**
 * useT — Hook version for imperative use.
 * Returns translated text for a given string, updating reactively on language change.
 */
export function useT(text: string): string {
  const { language, translate } = useLanguage();
  const [translated, setTranslated] = useState(text);

  useEffect(() => {
    let cancelled = false;
    if (language === "en") { setTranslated(text); return; }
    translate(text).then(r => { if (!cancelled) setTranslated(r); });
    return () => { cancelled = true; };
  }, [text, language, translate]);

  return translated;
}

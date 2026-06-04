/**
 * Translation Route — OpenAI-powered with graceful fallback
 *
 * Uses gpt-4o-mini for cost-effective batch translation.
 * Server-side in-memory cache avoids re-translating the same strings.
 * Falls back to local phrase matching when OPENAI_API_KEY is not set.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import OpenAI from "openai";

const router: IRouter = Router();

const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export const SUPPORTED_LANGUAGES: Record<string, string> = {
  en: "English", yo: "Yoruba", ig: "Igbo", ha: "Hausa", fr: "French",
  es: "Spanish", pt: "Portuguese", de: "German", ar: "Arabic", zh: "Chinese (Simplified)",
  hi: "Hindi", sw: "Swahili", ru: "Russian", it: "Italian", nl: "Dutch",
  ko: "Korean", ja: "Japanese", tr: "Turkish", pl: "Polish", vi: "Vietnamese",
  id: "Indonesian", th: "Thai", ro: "Romanian", hu: "Hungarian", cs: "Czech",
  sv: "Swedish", da: "Danish", fi: "Finnish", no: "Norwegian", uk: "Ukrainian",
  ur: "Urdu", bn: "Bengali", ta: "Tamil", te: "Telugu", mr: "Marathi",
  am: "Amharic", so: "Somali", zu: "Zulu", xh: "Xhosa", sn: "Shona",
  rw: "Kinyarwanda", lg: "Luganda", ny: "Chichewa", st: "Sesotho", mg: "Malagasy",
  ms: "Malay", tl: "Filipino", km: "Khmer", lo: "Lao", my: "Burmese",
  fa: "Persian", he: "Hebrew", ka: "Georgian", hy: "Armenian",
  az: "Azerbaijani", kk: "Kazakh", uz: "Uzbek",
  el: "Greek", bg: "Bulgarian", sr: "Serbian",
};

// Terms that should NEVER be translated
const PRESERVE_TERMS = [
  "JCTM", "Temple TV", "TempleBots", "Temple TV JCTM",
  "Prophet Amos", "Prophet Amos Evomobor",
  "Correction Mandate", "Global Altar",
];

// Simple local phrase map for when OpenAI is unavailable
const MINISTRY_PHRASES: Record<string, Record<string, string>> = {
  yo: {
    "Watch on Temple TV": "Wo lori Temple TV",
    "Jesus Christ Temple Ministry": "Ijọ Jesu Kristi Temili",
    "Subscribe": "Forukọsilẹ",
    "Live Service": "Isin Taara",
    "Prayer Request": "Ibeere Adura",
  },
  ig: {
    "Watch on Temple TV": "Lee na Temple TV",
    "Jesus Christ Temple Ministry": "Ụlọ Ọchịchọ Jizọs Kraịst",
    "Subscribe": "Denye aha gị",
    "Live Service": "Ọrụ Ndụ",
    "Prayer Request": "Arịọ Ekpere",
  },
  ha: {
    "Watch on Temple TV": "Kalla ta Temple TV",
    "Jesus Christ Temple Ministry": "Ministocin Haikali na Yesu Almasihu",
    "Subscribe": "Yi biyan kuɗi",
    "Live Service": "Hidimar Rai",
    "Prayer Request": "Buƙatar Addu'a",
  },
  fr: {
    "Watch on Temple TV": "Regarder sur Temple TV",
    "Jesus Christ Temple Ministry": "Ministère du Temple de Jésus-Christ",
    "Subscribe": "S'abonner",
    "Live Service": "Service en direct",
    "Prayer Request": "Demande de prière",
  },
  es: {
    "Watch on Temple TV": "Ver en Temple TV",
    "Jesus Christ Temple Ministry": "Ministerio del Templo de Jesucristo",
    "Subscribe": "Suscribirse",
    "Live Service": "Servicio en vivo",
    "Prayer Request": "Petición de oración",
  },
};

// Server-side translation cache (cleared on restart)
const translationCache = new Map<string, string>();
const MAX_CACHE_SIZE = 5000;

function pruneCache() {
  if (translationCache.size > MAX_CACHE_SIZE) {
    const toDelete = [...translationCache.keys()].slice(0, 500);
    toDelete.forEach(k => translationCache.delete(k));
  }
}

router.get("/translate/languages", (_req: Request, res: Response): void => {
  res.json({ languages: SUPPORTED_LANGUAGES });
});

router.post("/translate", async (req: Request, res: Response): Promise<void> => {
  const { text, targetLanguage, sourceLanguage = "en" } = req.body as {
    text: string | string[];
    targetLanguage: string;
    sourceLanguage?: string;
  };

  if (!text || !targetLanguage) {
    res.status(400).json({ error: "text and targetLanguage are required" });
    return;
  }

  const langName = SUPPORTED_LANGUAGES[targetLanguage];
  if (!langName) {
    res.status(400).json({ error: "Unsupported language code" });
    return;
  }

  // Passthrough for English or same-language
  if (targetLanguage === "en" || targetLanguage === sourceLanguage) {
    res.json({ translated: text, language: langName, method: "passthrough" });
    return;
  }

  const texts = Array.isArray(text) ? text : [text];

  // Empty / whitespace-only — return as-is
  if (texts.every(t => !t.trim())) {
    res.json({ translated: text, language: langName, method: "passthrough" });
    return;
  }

  // Check server-side cache
  const cacheKey = `${targetLanguage}:${JSON.stringify(texts)}`;
  if (translationCache.has(cacheKey)) {
    const cached = JSON.parse(translationCache.get(cacheKey)!);
    res.json({ translated: Array.isArray(text) ? cached : cached[0], language: langName, method: "cache" });
    return;
  }

  // ── OpenAI path ──────────────────────────────────────────────────────────
  if (openaiClient) {
    try {
      const preserveList = PRESERVE_TERMS.join(", ");
      const estimatedTokens = Math.max(500, texts.join(" ").length * 4);

      const completion = await openaiClient.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a professional translator for a Christian ministry website. Translate the given JSON array of strings to ${langName}.

Rules:
- Return ONLY a valid JSON array with exactly ${texts.length} translated string(s), in the same order.
- Do NOT add explanations or extra text — only the JSON array.
- Preserve HTML entities, emojis, and markdown formatting exactly.
- Do NOT translate these proper nouns: ${preserveList}
- Keep scripture references (e.g. John 17:17, Jeremiah 6:16) unchanged.
- Use reverent, natural language appropriate for a Christian ministry context.`,
          },
          {
            role: "user",
            content: JSON.stringify(texts),
          },
        ],
        temperature: 0.1,
        max_tokens: Math.min(4096, estimatedTokens),
      });

      const raw = (completion.choices[0]?.message?.content ?? "[]").trim();

      let translated: string[];
      try {
        // Strip markdown code fences if model wrapped the JSON
        const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
        translated = JSON.parse(cleaned);
        if (!Array.isArray(translated) || translated.length !== texts.length) {
          throw new Error("Length mismatch");
        }
        // Ensure all elements are strings
        translated = translated.map((t, i) => (typeof t === "string" ? t : texts[i]));
      } catch {
        // Parse failure → return originals
        translated = texts;
      }

      pruneCache();
      translationCache.set(cacheKey, JSON.stringify(translated));
      res.json({
        translated: Array.isArray(text) ? translated : translated[0],
        language: langName,
        method: "openai",
      });
      return;
    } catch (err) {
      // OpenAI error → fall through to local phrase matching
    }
  }

  // ── Local phrase matching fallback ───────────────────────────────────────
  const phrasesForLang = MINISTRY_PHRASES[targetLanguage] ?? {};
  const translated = texts.map(t => {
    let result = t;
    for (const [en, local] of Object.entries(phrasesForLang)) {
      result = result.replace(new RegExp(en, "gi"), local);
    }
    return result;
  });

  res.json({
    translated: Array.isArray(text) ? translated : translated[0],
    language: langName,
    method: openaiClient ? "openai-error-fallback" : "local-phrases",
  });
});

export default router;

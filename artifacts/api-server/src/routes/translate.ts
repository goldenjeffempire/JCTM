import { Router, type IRouter, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

// Translation cache to avoid repeat calls
const translationCache = new Map<string, string>();

const SUPPORTED_LANGUAGES: Record<string, string> = {
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
};

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

  if (targetLanguage === sourceLanguage) {
    res.json({ translated: text, language: langName });
    return;
  }

  const texts = Array.isArray(text) ? text : [text];
  const cacheKey = `${targetLanguage}:${texts.join("|||")}`;

  if (translationCache.has(cacheKey)) {
    const cached = translationCache.get(cacheKey)!;
    const result = Array.isArray(text) ? JSON.parse(cached) : cached;
    res.json({ translated: result, language: langName, cached: true });
    return;
  }

  try {
    const prompt = texts.length === 1
      ? `Translate the following text to ${langName}. Return ONLY the translation, no explanation:\n\n${texts[0]}`
      : `Translate each of the following texts to ${langName}. Return a JSON array of translations in the same order:\n\n${JSON.stringify(texts)}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a professional translator specializing in Christian/ministry content. Translate accurately while preserving spiritual terminology and tone. For African languages, use formal/literary register appropriate for church settings.`,
        },
        { role: "user", content: prompt },
      ],
      max_completion_tokens: 8192,
    });

    const result = completion.choices[0]?.message?.content?.trim() ?? "";

    if (texts.length === 1) {
      translationCache.set(cacheKey, result);
      res.json({ translated: result, language: langName });
    } else {
      try {
        const parsed = JSON.parse(result);
        translationCache.set(cacheKey, JSON.stringify(parsed));
        res.json({ translated: parsed, language: langName });
      } catch {
        res.json({ translated: texts, language: langName, error: "Parse failed" });
      }
    }
  } catch {
    res.status(500).json({ error: "Translation service temporarily unavailable" });
  }
});

export default router;

/**
 * Translation Route — Local Graceful Fallback
 *
 * Full machine translation requires an external service.
 * Since we are Zero External API, this route:
 *  - Returns the original text for English requests
 *  - Returns a ministry-safe fallback message for other languages
 *  - Notifies the client that translation is best-effort
 *
 * The TempleBots multilingual system handles language instructions
 * natively in the chat routes (language passed as param → local engine
 * generates response in context with language note).
 */

import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

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

// Simple phrase translations for common ministry strings
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
  pt: {
    "Watch on Temple TV": "Assistir na Temple TV",
    "Jesus Christ Temple Ministry": "Ministério do Templo de Jesus Cristo",
    "Subscribe": "Subscrever",
    "Live Service": "Culto ao vivo",
    "Prayer Request": "Pedido de oração",
  },
  sw: {
    "Watch on Temple TV": "Tazama kwenye Temple TV",
    "Jesus Christ Temple Ministry": "Wizara ya Hekalu la Yesu Kristo",
    "Subscribe": "Jiandikishe",
    "Live Service": "Huduma ya Moja kwa Moja",
    "Prayer Request": "Ombi la Sala",
  },
};

const translationCache = new Map<string, string>();

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

  if (targetLanguage === sourceLanguage || targetLanguage === "en") {
    res.json({ translated: text, language: langName, method: "passthrough" });
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

  // Local phrase matching for known ministry phrases
  const phrasesForLang = MINISTRY_PHRASES[targetLanguage] ?? {};
  const translated = texts.map(t => {
    let result = t;
    for (const [en, local] of Object.entries(phrasesForLang)) {
      result = result.replace(new RegExp(en, "gi"), local);
    }
    return result;
  });

  const isSame = translated.every((t, i) => t === texts[i]);

  if (isSame) {
    // No phrase matches — return original with advisory note
    const result = Array.isArray(text) ? texts : texts[0];
    res.json({
      translated: result,
      language: langName,
      method: "passthrough",
      note: "Full translation requires an external translation service. TempleBots answers in your language when you chat directly.",
    });
    return;
  }

  const result = Array.isArray(text) ? translated : translated[0];
  translationCache.set(cacheKey, Array.isArray(text) ? JSON.stringify(result) : (result as string));
  res.json({ translated: result, language: langName, method: "local-phrases" });
});

export default router;

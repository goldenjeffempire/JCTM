/**
 * JCTM Bible API — /api/bible/*
 *
 * Endpoints:
 *   GET  /api/bible/books              — list all 66 books with metadata
 *   GET  /api/bible/verse/:book/:ch/:v — fetch a single verse by reference
 *   GET  /api/bible/chapter/:book/:ch  — fetch a full chapter
 *   GET  /api/bible/search             — full-text search (?q=...)
 *   POST /api/bible/lookup             — batch verse lookup
 *   GET  /api/bible/topic/:topic       — topic-based verse collection
 *   POST /api/bible/reference          — parse and resolve a scripture reference string
 */

import { Router, type IRouter, type Request, type Response } from "express";
import {
  BIBLE_BOOKS,
  lookupVerse,
  lookupChapter,
  lookupVerseRange,
  fullTextSearchBible,
  parseScriptureRef,
  fetchScriptureForRAG,
  resolveBookAbbrev,
} from "../lib/bible-seed.js";

const router: IRouter = Router();

// ─── GET /api/bible/books ─────────────────────────────────────────────────────

router.get("/bible/books", (_req: Request, res: Response): void => {
  res.json({
    books: BIBLE_BOOKS,
    total: BIBLE_BOOKS.length,
    oldTestament: BIBLE_BOOKS.filter(b => b.testament === "OT").length,
    newTestament: BIBLE_BOOKS.filter(b => b.testament === "NT").length,
  });
});

// ─── GET /api/bible/verse/:book/:chapter/:verse ───────────────────────────────

router.get("/bible/verse/:book/:chapter/:verse", async (req: Request, res: Response): Promise<void> => {
  const { book, chapter, verse } = req.params as { book: string; chapter: string; verse: string };

  const abbrev = resolveBookAbbrev(book);
  if (!abbrev) {
    res.status(400).json({ error: `Unknown book: "${book}". Use a standard book name or abbreviation.` });
    return;
  }

  const ch = parseInt(chapter, 10);
  const v = parseInt(verse, 10);

  if (isNaN(ch) || isNaN(v) || ch < 1 || v < 1) {
    res.status(400).json({ error: "Chapter and verse must be positive integers." });
    return;
  }

  const result = await lookupVerse(abbrev, ch, v);
  if (!result) {
    res.status(404).json({
      error: `${book} ${ch}:${v} not found in the database. Note: only key verses are indexed — use /search for topic-based lookup.`,
      reference: `${book} ${ch}:${v}`,
    });
    return;
  }

  res.json({
    reference: `${result.book} ${result.chapter}:${result.verse}`,
    book: result.book,
    abbrev: result.abbrev,
    testament: result.testament,
    chapter: result.chapter,
    verse: result.verse,
    text: result.text,
    translation: "KJV",
  });
});

// ─── GET /api/bible/chapter/:book/:chapter ────────────────────────────────────

router.get("/bible/chapter/:book/:chapter", async (req: Request, res: Response): Promise<void> => {
  const { book, chapter } = req.params as { book: string; chapter: string };

  const abbrev = resolveBookAbbrev(book);
  if (!abbrev) {
    res.status(400).json({ error: `Unknown book: "${book}".` });
    return;
  }

  const ch = parseInt(chapter, 10);
  if (isNaN(ch) || ch < 1) {
    res.status(400).json({ error: "Chapter must be a positive integer." });
    return;
  }

  const verses = await lookupChapter(abbrev, ch);

  const bookMeta = BIBLE_BOOKS.find(b => b.abbrev === abbrev);
  const bookName = bookMeta?.name ?? book;

  res.json({
    reference: `${bookName} ${ch}`,
    book: bookName,
    abbrev,
    testament: bookMeta?.testament ?? "OT",
    chapter: ch,
    verseCount: verses.length,
    verses,
    translation: "KJV",
    note: verses.length === 0
      ? "No verses indexed for this chapter. Key chapters are indexed; use /search for topic-based results."
      : undefined,
  });
});

// ─── GET /api/bible/search?q=...&limit=10 ────────────────────────────────────

router.get("/bible/search", async (req: Request, res: Response): Promise<void> => {
  const q = String(req.query["q"] ?? "").trim();
  const limit = Math.min(Math.max(1, parseInt(String(req.query["limit"] ?? "10"), 10)), 30);

  if (!q) {
    res.status(400).json({ error: "Query parameter 'q' is required." });
    return;
  }

  // First: try to parse as a scripture reference (e.g. "John 3:16")
  const parsed = parseScriptureRef(q);
  if (parsed) {
    if (parsed.verseStart && parsed.verseEnd) {
      const verses = await lookupVerseRange(parsed.abbrev, parsed.chapter, parsed.verseStart, parsed.verseEnd);
      if (verses.length > 0) {
        res.json({
          query: q,
          type: "reference",
          reference: `${parsed.book} ${parsed.chapter}:${parsed.verseStart}-${parsed.verseEnd}`,
          count: verses.length,
          results: verses,
          translation: "KJV",
        });
        return;
      }
    } else if (parsed.verseStart) {
      const v = await lookupVerse(parsed.abbrev, parsed.chapter, parsed.verseStart);
      if (v) {
        res.json({
          query: q,
          type: "reference",
          reference: `${v.book} ${v.chapter}:${v.verse}`,
          count: 1,
          results: [v],
          translation: "KJV",
        });
        return;
      }
    } else {
      const verses = await lookupChapter(parsed.abbrev, parsed.chapter);
      if (verses.length > 0) {
        res.json({
          query: q,
          type: "chapter",
          reference: `${parsed.book} ${parsed.chapter}`,
          count: verses.length,
          results: verses,
          translation: "KJV",
        });
        return;
      }
    }
  }

  // Full-text search
  const results = await fullTextSearchBible(q, limit);
  res.json({
    query: q,
    type: "search",
    count: results.length,
    results,
    translation: "KJV",
  });
});

// ─── POST /api/bible/lookup — batch verse lookup ──────────────────────────────

router.post("/bible/lookup", async (req: Request, res: Response): Promise<void> => {
  const references: string[] = Array.isArray(req.body?.references)
    ? (req.body.references as unknown[]).slice(0, 20).map(r => String(r))
    : [];

  if (references.length === 0) {
    res.status(400).json({ error: "Provide an array of references (max 20)." });
    return;
  }

  const results: Array<{
    input: string;
    found: boolean;
    text?: string;
    reference?: string;
    book?: string;
    chapter?: number;
    verse?: number;
  }> = [];

  for (const ref of references) {
    const parsed = parseScriptureRef(ref);
    if (!parsed || !parsed.verseStart) {
      results.push({ input: ref, found: false });
      continue;
    }
    const v = await lookupVerse(parsed.abbrev, parsed.chapter, parsed.verseStart);
    if (!v) {
      results.push({ input: ref, found: false });
    } else {
      results.push({
        input: ref,
        found: true,
        reference: `${v.book} ${v.chapter}:${v.verse}`,
        book: v.book,
        chapter: v.chapter,
        verse: v.verse,
        text: v.text,
      });
    }
  }

  res.json({ results, translation: "KJV" });
});

// ─── GET /api/bible/topic/:topic ──────────────────────────────────────────────
// Returns curated verse collections for major JCTM ministry topics.

const TOPIC_VERSES: Record<string, string[]> = {
  salvation: ["Rom 3:23", "Rom 6:23", "Eph 2:8", "Eph 2:9", "Jhn 3:16", "Rom 10:9", "Rom 10:13", "Act 4:12", "Act 16:31"],
  holiness: ["Heb 12:14", "1Pe 1:15", "1Pe 1:16", "Lev 11:44", "Rom 12:1", "2Co 6:14", "1Th 5:23"],
  faith: ["Heb 11:1", "Heb 11:6", "Mar 9:23", "Rom 5:1", "Gal 2:20", "2Ti 1:7", "Mar 11:24"],
  prayer: ["Php 4:6", "Php 4:7", "1Th 5:17", "Jer 33:3", "Mat 7:7", "Jas 5:16", "Mar 11:24"],
  baptism: ["Mat 28:19", "Act 2:38", "Rom 6:23", "Mar 16:16", "Jhn 3:5", "Mat 3:16"],
  "holy spirit": ["Act 1:8", "Act 2:4", "Jhn 14:16", "Jhn 14:17", "Jhn 14:26", "Gal 5:22", "Gal 5:23", "Eph 6:18"],
  healing: ["Exo 15:26", "Isa 53:5", "Mar 16:18", "Jas 5:14", "Jas 5:15", "Psa 103:3", "Heb 13:8"],
  worship: ["Jhn 4:24", "Psa 100:1", "Psa 100:2", "Psa 150:6", "Psa 95:6", "Psa 149:6"],
  fear: ["Isa 41:10", "Psa 23:4", "2Ti 1:7", "Psa 34:4", "Php 4:6", "Php 4:7", "1Jo 4:18"],
  love: ["Jhn 3:16", "1Co 13:4", "1Co 13:13", "Jhn 15:13", "1Jo 4:8", "Rom 8:39"],
  forgiveness: ["1Jo 1:9", "Psa 51:1", "Col 2:13", "Isa 43:25", "Mic 7:18", "Act 2:38"],
  persecution: ["Mat 5:10", "Mat 5:11", "Rom 8:35", "Rom 8:37", "2Ti 3:12", "Jhn 15:20"],
  "end times": ["Mat 24:42", "1Th 4:16", "1Th 4:17", "Rev 22:20", "2Th 2:3", "2Ti 3:1", "Luk 21:36"],
  tithing: ["Mal 3:10", "2Co 9:7", "Pro 3:9", "Pro 11:24", "Luk 6:38"],
  marriage: ["Gen 2:24", "Eph 5:22", "Eph 5:25", "1Co 7:3", "Heb 13:4", "Pro 18:22"],
  prosperity: ["Jer 29:11", "Jos 1:8", "3Jo 1:2", "Php 4:19", "Psa 1:3", "Isa 48:17"],
  repentance: ["Act 2:38", "1Jo 1:9", "Psa 51:10", "Psa 51:17", "Jer 3:14", "Luk 15:20"],
  "correction mandate": ["Jer 6:16", "2Ti 3:16", "2Ti 4:2", "Jud 1:3", "Gal 1:8", "1Ti 4:1"],
  "spiritual warfare": ["Eph 6:12", "Eph 6:13", "Eph 6:17", "Col 2:15", "Jas 4:7", "1Pe 5:8"],
};

router.get("/bible/topic/:topic", async (req: Request, res: Response): Promise<void> => {
  const topicRaw = String(req.params["topic"] ?? "").toLowerCase().trim();

  // Find exact or partial match
  const topicKey = Object.keys(TOPIC_VERSES).find(k =>
    k === topicRaw || k.replace(/\s+/g, "-") === topicRaw,
  );

  if (!topicKey) {
    res.json({
      topic: topicRaw,
      availableTopics: Object.keys(TOPIC_VERSES),
      error: `Topic "${topicRaw}" not found. Try one of the available topics.`,
    });
    return;
  }

  const refs = TOPIC_VERSES[topicKey]!;
  const verses: Array<{ reference: string; text: string; book: string; chapter: number; verse: number }> = [];

  for (const ref of refs) {
    const parsed = parseScriptureRef(ref);
    if (!parsed || !parsed.verseStart) continue;
    const v = await lookupVerse(parsed.abbrev, parsed.chapter, parsed.verseStart);
    if (v) {
      verses.push({
        reference: `${v.book} ${v.chapter}:${v.verse}`,
        text: v.text,
        book: v.book,
        chapter: v.chapter,
        verse: v.verse,
      });
    }
  }

  res.json({
    topic: topicKey,
    verseCount: verses.length,
    verses,
    translation: "KJV",
  });
});

// ─── POST /api/bible/reference — parse and resolve a reference string ─────────

router.post("/bible/reference", async (req: Request, res: Response): Promise<void> => {
  const raw = String(req.body?.reference ?? "").trim();

  if (!raw) {
    res.status(400).json({ error: "Provide a 'reference' string." });
    return;
  }

  const parsed = parseScriptureRef(raw);
  if (!parsed) {
    res.status(400).json({ error: `Could not parse scripture reference: "${raw}"`, hint: 'Examples: "John 3:16", "Romans 8", "Ephesians 6:10-18"' });
    return;
  }

  const ragText = await fetchScriptureForRAG(raw);

  res.json({
    input: raw,
    parsed: {
      book: parsed.book,
      abbrev: parsed.abbrev,
      chapter: parsed.chapter,
      verseStart: parsed.verseStart,
      verseEnd: parsed.verseEnd,
    },
    ragText,
    translation: "KJV",
  });
});

// ─── GET /api/bible/topics — list available topics ───────────────────────────

router.get("/bible/topics", (_req: Request, res: Response): void => {
  res.json({
    topics: Object.keys(TOPIC_VERSES).map(t => ({
      topic: t,
      verseCount: TOPIC_VERSES[t]!.length,
    })),
  });
});

export default router;

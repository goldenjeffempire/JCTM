import { createHash } from "node:crypto";

export const DEVOTION_CATEGORIES = [
  "Faith", "Prayer", "Love", "Forgiveness", "Salvation", "Holiness",
  "Obedience", "Spiritual Growth", "Patience", "Gratitude", "Perseverance",
  "Divine Direction", "Holy Spirit", "Christian Living", "Community", "Stewardship",
] as const;

export interface DevotionContent {
  topic: string;
  category: string;
  title: string;
  reference: string;
  scripture: string;
  scriptureVersion: string;
  introduction: string;
  message: string;
  application: string;
  closingPrayer: string;
  declaration?: string;
  sources?: { kind: "sermon-description" | "ministry-note"; id: string; title: string; url?: string }[];
  seriesId?: string;
  seriesDay?: number;
}

export interface ComparableDevotion {
  title: string;
  topic?: string | null;
  reference?: string;
  introduction?: string | null;
  message?: string;
  reflection?: string;
  application?: string | null;
  closingPrayer?: string;
  prayerFocus?: string;
}

export function normalizeIdentity(value: string): string {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/['’]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function contentHash(value: ComparableDevotion): string {
  return createHash("sha256").update(normalizeIdentity(
    [value.introduction, value.message ?? value.reflection, value.application,
      value.closingPrayer ?? value.prayerFocus].filter(Boolean).join(" "),
  )).digest("hex");
}

export function uniqueComparables(entries: ComparableDevotion[]): ComparableDevotion[] {
  const seen = new Set<string>();
  return entries.filter(value => {
    const key = [normalizeIdentity(value.title), normalizeIdentity(value.topic ?? value.title),
      referenceKey(value.reference ?? ""), contentHash(value)].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const STOP = new Set("a an the and or to of in on for with by from is are be as that this it your our their his her its at not but through into today god lord jesus christ father amen help will can".split(" "));
const ALIASES: Record<string, string> = {
  forgiving: "forgive", forgiveness: "forgive", forgiven: "forgive",
  grateful: "gratitude", thankful: "gratitude", thanksgiving: "gratitude", thanks: "gratitude",
  obeying: "obey", obedience: "obey", obedient: "obey",
  patient: "patience", waiting: "wait", waited: "wait",
  generous: "generosity", giving: "give", gave: "give",
  reconciliation: "reconcile", reconciling: "reconcile",
  honest: "honesty", truthful: "honesty", truthfulness: "honesty",
  anxious: "anxiety", worrying: "anxiety", worry: "anxiety",
  humble: "humility", pride: "pride", prideful: "pride",
};

function tokens(value: string): Set<string> {
  return new Set(normalizeIdentity(value).split(" ").filter(w => w.length > 2 && !STOP.has(w))
    .map(w => ALIASES[w] ?? w));
}

function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const word of a) if (b.has(word)) n++;
  return n;
}

function shingles(value: string): Set<string> {
  const words = normalizeIdentity(value).split(" ");
  return new Set(words.slice(0, -4).map((_, i) => words.slice(i, i + 5).join(" ")));
}

export function referenceKey(reference: string): string {
  return normalizeIdentity(reference).replace(/^psalms? /, "psalm ");
}

export function duplicateReason(candidate: ComparableDevotion, existing: ComparableDevotion): string | null {
  if (normalizeIdentity(candidate.title) === normalizeIdentity(existing.title)) return "Title already exists";
  if (candidate.topic && normalizeIdentity(candidate.topic) === normalizeIdentity(existing.topic ?? existing.title)) return "Topic already exists";
  if (candidate.reference && existing.reference && referenceKey(candidate.reference) === referenceKey(existing.reference)) return "Scripture passage already used";
  if (contentHash(candidate) === contentHash(existing)) return "Content fingerprint already exists";
  for (const [a, b, label] of [
    [candidate.topic ?? candidate.title, existing.topic ?? existing.title, "Topic"],
    [candidate.title, existing.title, "Title"],
  ]) {
    const left = tokens(a!), right = tokens(b!);
    const common = overlap(left, right);
    if (common >= 3 && common / Math.max(1, left.size + right.size - common) >= 0.72) return `${label} is substantially similar`;
  }
  const leftBody = [candidate.introduction, candidate.message ?? candidate.reflection, candidate.application].filter(Boolean).join(" ");
  const rightBody = [existing.introduction, existing.message ?? existing.reflection, existing.application].filter(Boolean).join(" ");
  const left = shingles(leftBody), right = shingles(rightBody);
  if (Math.min(left.size, right.size) >= 20 && overlap(left, right) / Math.min(left.size, right.size) >= 0.42) return "Message substantially repeats existing content";
  const leftWords = tokens(leftBody), rightWords = tokens(rightBody);
  const common = overlap(leftWords, rightWords);
  if (common >= 20 && common / Math.max(1, leftWords.size + rightWords.size - common) >= 0.72) return "Message is a near duplicate";
  for (const [a, b] of [
    [candidate.introduction, existing.introduction],
    [candidate.application, existing.application],
    [candidate.closingPrayer ?? candidate.prayerFocus, existing.closingPrayer ?? existing.prayerFocus],
  ]) {
    if (a && b && normalizeIdentity(a).split(" ").length >= 12) {
      const x = shingles(a), y = shingles(b);
      if (overlap(x, y) / Math.max(1, Math.min(x.size, y.size)) >= 0.8) return "A devotion section substantially repeats existing content";
    }
  }
  return null;
}

export function validateContent(input: unknown): DevotionContent {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Devotion must be an object");
  const value = input as Record<string, unknown>;
  const minimum = {
    topic: 3, category: 1, title: 3, reference: 2, scripture: 3, scriptureVersion: 1,
    introduction: 10, message: 55, application: 12, closingPrayer: 12,
  };
  for (const [field, words] of Object.entries(minimum)) {
    const text = value[field];
    if (typeof text !== "string" || text.length > 15000 || text.trim().split(/\s+/).length < words) {
      throw new Error(`A complete, original ${field} is required (at least ${words} words)`);
    }
  }
  if (!(DEVOTION_CATEGORIES as readonly string[]).includes(value.category as string)) throw new Error("Choose a supported devotion category");
  if (!/^[1-3]?\s*[A-Za-z ]+\s+\d+:\d+(?:[-–]\d+)?$/.test(value.reference as string)) throw new Error("A Bible book, chapter and verse are required");
  if (value.scriptureVersion !== "KJV") throw new Error("New devotions must use verified public-domain KJV scripture");
  const result = Object.fromEntries(Object.keys(minimum).map(k => [k, (value[k] as string).trim()])) as unknown as DevotionContent;
  if (value.declaration !== undefined) {
    if (typeof value.declaration !== "string" || value.declaration.trim().split(/\s+/).length < 6 || value.declaration.length > 1500) throw new Error("A Scripture-grounded declaration of at least six words is required");
    result.declaration = value.declaration.trim();
  }
  if (value.seriesId !== undefined) {
    if (typeof value.seriesId !== "string" || !/^[a-z0-9-]{1,100}$/.test(value.seriesId) ||
        !Number.isInteger(value.seriesDay) || Number(value.seriesDay) < 1 || Number(value.seriesDay) > 1000) throw new Error("Invalid series identity");
    result.seriesId = value.seriesId; result.seriesDay = Number(value.seriesDay);
  }
  if (value.sources !== undefined) {
    if (!Array.isArray(value.sources) || value.sources.length > 8) throw new Error("Invalid source notes");
    result.sources = value.sources.map((s: unknown) => {
      const v = s as Record<string, unknown>;
      if (!v || !["sermon-description", "ministry-note"].includes(String(v.kind)) ||
          typeof v.id !== "string" || v.id.length > 150 || typeof v.title !== "string" || v.title.length > 400) throw new Error("Invalid source note");
      if (v.url !== undefined && (typeof v.url !== "string" || !/^https:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=[\w-]+|jctm\.org\.ng\/[\w/?=&.-]*)$/.test(v.url))) throw new Error("Source links must refer to JCTM or YouTube");
      return { kind: v.kind, id: v.id, title: v.title, ...(v.url ? { url: v.url } : {}) } as NonNullable<DevotionContent["sources"]>[number];
    });
  }
  return result;
}

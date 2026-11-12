import type { DevotionContent } from "../devotion-quality.js";
import scripture from "./scripture.json" with { type: "json" };

export const SERIES_ID = "jctm-ninety-day-formation";
// These are inspiration sources actually present in JCTM's archive, not
// purported transcripts or quotations from a minister.
export const SOURCES = {
  correction: { kind: "ministry-note", id: "correction-mandate", title: "JCTM Correction Mandate teaching note" },
  primitive: { kind: "ministry-note", id: "primitive-christianity", title: "JCTM Primitive Christianity teaching note" },
  holiness: { kind: "sermon-description", id: "7pj9gIpj56A", title: "Your Salvation Must Lead You to Perfection Before You Can See God", url: "https://www.youtube.com/watch?v=7pj9gIpj56A" },
  authority: { kind: "sermon-description", id: "QgDCzFUlB8Y", title: "The Bible Warns Police and Soldiers Against Intimidation and False Accusations", url: "https://www.youtube.com/watch?v=QgDCzFUlB8Y" },
  love: { kind: "sermon-description", id: "NJpokngOcwQ", title: "The Love of Christ Is the First Spirit Sent to a Man", url: "https://www.youtube.com/watch?v=NJpokngOcwQ" },
  spirit: { kind: "sermon-description", id: "Wz6faj-B2C4", title: "Church Is Stage by Stage. Let the Holy Spirit Lead You", url: "https://www.youtube.com/watch?v=Wz6faj-B2C4" },
  giving: { kind: "ministry-note", id: "giving-seed-sowing", title: "JCTM biblical stewardship teaching note" },
  baptism: { kind: "ministry-note", id: "baptism-doctrine", title: "JCTM water baptism teaching note" },
  salvation: { kind: "ministry-note", id: "salvation-gospel", title: "JCTM salvation and gospel teaching note" },
  endtimes: { kind: "ministry-note", id: "end-times-teaching", title: "JCTM watchfulness and Christ's return teaching note" },
  fasting: { kind: "ministry-note", id: "fasting-prayer-teaching", title: "JCTM fasting and prayer teaching note" },
  ministry: { kind: "ministry-note", id: "five-fold-ministry", title: "JCTM five-fold ministry teaching note" },
} as const;

export function reading(
  day: number, source: keyof typeof SOURCES, category: string, title: string, topic: string,
  reference: string, introduction: string, message: string, application: string,
  closingPrayer: string, declaration: string,
): DevotionContent {
  const quote = (scripture as Record<string, string>)[reference];
  // Content cannot be admitted without its independently fetched KJV text.
  if (!quote) throw new Error(`Missing verified quotation: ${reference}`);
  return { topic, category, title, reference, scripture: quote, scriptureVersion: "KJV",
    introduction, message, application, closingPrayer, declaration,
    sources: [SOURCES[source]], seriesId: SERIES_ID, seriesDay: day };
}

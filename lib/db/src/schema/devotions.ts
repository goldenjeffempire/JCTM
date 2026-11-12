import { pgTable, text, date, boolean, timestamp, integer, jsonb } from "drizzle-orm/pg-core";

export const devotionsTable = pgTable("daily_devotions", {
  date: date("date").primaryKey(),
  title: text("title").notNull(),
  scripture: text("scripture").notNull(),
  reference: text("reference").notNull(),
  reflection: text("reflection").notNull(),
  propheticWord: text("prophetic_word").notNull(),
  prayerFocus: text("prayer_focus").notNull(),
  declaration: text("declaration").notNull(),
  topic: text("topic"),
  category: text("category"),
  introduction: text("introduction"),
  application: text("application"),
  scriptureVersion: text("scripture_version"),
  topicKey: text("topic_key"),
  titleKey: text("title_key"),
  contentHash: text("content_hash"),
  reviewRequired: boolean("review_required").notNull().default(false),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  isHidden: boolean("is_hidden").notNull().default(false),
  revision: integer("revision").notNull().default(0),
  sourceNotes: jsonb("source_notes"),
  seriesId: text("series_id"),
  seriesDay: integer("series_day"),
});

export type DailyDevotion = typeof devotionsTable.$inferSelect;
export type InsertDailyDevotion = typeof devotionsTable.$inferInsert;

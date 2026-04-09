import { pgTable, text, date } from "drizzle-orm/pg-core";

export const devotionsTable = pgTable("daily_devotions", {
  date: date("date").primaryKey(),
  title: text("title").notNull(),
  scripture: text("scripture").notNull(),
  reference: text("reference").notNull(),
  reflection: text("reflection").notNull(),
  propheticWord: text("prophetic_word").notNull(),
  prayerFocus: text("prayer_focus").notNull(),
  declaration: text("declaration").notNull(),
});

export type DailyDevotion = typeof devotionsTable.$inferSelect;
export type InsertDailyDevotion = typeof devotionsTable.$inferInsert;

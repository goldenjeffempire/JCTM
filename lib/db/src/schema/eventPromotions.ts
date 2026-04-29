import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const eventPromotionsTable = pgTable("event_promotions", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  artworkUrl: text("artwork_url"),
  location: text("location"),
  ctaText: text("cta_text").notNull().default("Join Us"),
  ctaUrl: text("cta_url").notNull().default("/"),
  startAt: timestamp("start_at", { withTimezone: true }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("active"),
  showBanner: boolean("show_banner").notNull().default(true),
  showPopup: boolean("show_popup").notNull().default(true),
  showStickyBar: boolean("show_sticky_bar").notNull().default(true),
  pushSentAt: timestamp("push_sent_at", { withTimezone: true }),
  endPushSentAt: timestamp("end_push_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEventPromotionSchema = createInsertSchema(eventPromotionsTable).omit({
  id: true,
  pushSentAt: true,
  endPushSentAt: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertEventPromotion = z.infer<typeof insertEventPromotionSchema>;
export type EventPromotion = typeof eventPromotionsTable.$inferSelect;

import { pgTable, text, serial, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";
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
  // ── Generic recurring broadcast (campaign promotion mode) ───────────────────
  // When `broadcastEnabled = true`, the per-minute scheduler tick fires a push
  // notification + in-app SSE toast on every cadence slot until `endAt`.
  // Cadence: 'half_hourly' | 'hourly' | 'daily' | 'custom' (uses
  // broadcastIntervalMinutes). Bodies rotate deterministically through
  // broadcastMessages by slot index. Idempotency is enforced via the
  // broadcast_events unique-by-(type,title,message) index. Optional title and
  // image overrides let admins distinguish campaign pushes from event pushes.
  broadcastEnabled: boolean("broadcast_enabled").notNull().default(false),
  broadcastCadence: text("broadcast_cadence").notNull().default("half_hourly"),
  broadcastIntervalMinutes: integer("broadcast_interval_minutes"),
  broadcastMessages: jsonb("broadcast_messages").$type<string[]>().notNull().default([]),
  broadcastTitleOverride: text("broadcast_title_override"),
  broadcastImageUrl: text("broadcast_image_url"),
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

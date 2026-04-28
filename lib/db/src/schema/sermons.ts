import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sermonsTable = pgTable("sermon_data", {
  id: serial("id").primaryKey(),
  videoId: text("video_id").notNull().unique(),
  title: text("title").notNull(),
  thumbnailUrl: text("thumbnail_url").notNull(),
  description: text("description"),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
  viewCount: integer("view_count"),
  duration: text("duration"),
  isFeatured: boolean("is_featured").notNull().default(false),
  isLive: boolean("is_live").notNull().default(false),
  broadcastEndedAt: timestamp("broadcast_ended_at", { withTimezone: true }),
  /**
   * When set, this video is manually pinned as the featured / Latest Broadcast.
   * Manual pins survive the daily YouTube auto-sync — `refreshFeaturedSermon`
   * skips its auto-promotion logic if any video has `pinned_at` within the
   * last 30 days. Set to NOW() to pin, NULL to unpin.
   */
  pinnedAt: timestamp("pinned_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSermonSchema = createInsertSchema(sermonsTable).omit({ id: true, createdAt: true });
export type InsertSermon = z.infer<typeof insertSermonSchema>;
export type Sermon = typeof sermonsTable.$inferSelect;

import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const momentLikesTable = pgTable("moment_likes", {
  id: serial("id").primaryKey(),
  videoId: text("video_id").notNull(),
  visitorId: text("visitor_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const momentCommentsTable = pgTable("moment_comments", {
  id: serial("id").primaryKey(),
  videoId: text("video_id").notNull(),
  visitorId: text("visitor_id").notNull(),
  name: text("name").notNull(),
  body: text("body").notNull(),
  ytCommentId: text("yt_comment_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type MomentLike = typeof momentLikesTable.$inferSelect;
export type MomentComment = typeof momentCommentsTable.$inferSelect;

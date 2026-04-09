import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";

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

export const momentEngagementsTable = pgTable("moment_engagements", {
  id: serial("id").primaryKey(),
  videoId: text("video_id").notNull().unique(),
  ytEngagementCommentId: text("yt_engagement_comment_id"),
  shareCount: integer("share_count").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type MomentLike = typeof momentLikesTable.$inferSelect;
export type MomentComment = typeof momentCommentsTable.$inferSelect;
export type MomentEngagement = typeof momentEngagementsTable.$inferSelect;

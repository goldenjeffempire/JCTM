import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const testimoniesTable = pgTable("testimonies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  title: text("title"),
  content: text("content").notNull(),
  videoUrl: text("video_url"),
  category: text("category"),
  approved: boolean("approved").notNull().default(false),
  likeCount: integer("like_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTestimonySchema = createInsertSchema(testimoniesTable).omit({ id: true, createdAt: true, approved: true, likeCount: true });
export type InsertTestimony = z.infer<typeof insertTestimonySchema>;
export type Testimony = typeof testimoniesTable.$inferSelect;

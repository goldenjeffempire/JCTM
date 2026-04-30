import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const eventsTable = pgTable("event_calendar", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }),
  location: text("location"),
  eventType: text("event_type").notNull().default("service"),
  imageUrl: text("image_url"),
  youtubeUrl: text("youtube_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  /**
   * Per-event notification configuration. All nullable — when a column is null
   * the scheduler falls back to the global defaults defined in
   * `event-notification-scheduler.ts` (MILESTONES, no pulse).
   */
  notificationEnabled: boolean("notification_enabled").notNull().default(true),
  notificationMilestones: integer("notification_milestones").array(),
  notificationPulseMinutes: integer("notification_pulse_minutes"),
  notificationPulseWindowHours: integer("notification_pulse_window_hours"),
  notificationPausedUntil: timestamp("notification_paused_until", { withTimezone: true }),
});

export const insertEventSchema = createInsertSchema(eventsTable).omit({ id: true, createdAt: true });
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof eventsTable.$inferSelect;

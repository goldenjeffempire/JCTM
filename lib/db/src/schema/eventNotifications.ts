import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Public opt-in mailing list for upcoming-event reminders.
 * Distinct from `devotion_subscribers` so users can opt into one without the other.
 */
export const eventNotificationSubscribersTable = pgTable(
  "event_notification_subscribers",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull().unique(),
    unsubscribeToken: text("unsubscribe_token").notNull().unique(),
    isActive: boolean("is_active").notNull().default(true),
    subscribedAt: timestamp("subscribed_at", { withTimezone: true }).notNull().defaultNow(),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
    lastNotifiedAt: timestamp("last_notified_at", { withTimezone: true }),
    sourcePage: text("source_page"),
    /** IANA tz string (e.g. "Africa/Lagos", "Europe/London"). */
    timezone: text("timezone").notNull().default("Africa/Lagos"),
  },
  (t) => ({
    activeIdx: index("event_notif_subscribers_active_idx").on(t.isActive),
  }),
);

export type EventNotificationSubscriber = typeof eventNotificationSubscribersTable.$inferSelect;
export type InsertEventNotificationSubscriber =
  typeof eventNotificationSubscribersTable.$inferInsert;

/**
 * Per-(event × milestone × channel) idempotency + retry tracker for the
 * scheduled event notification system. The 30-min cron checks this table to
 * avoid duplicate sends and to retry failed channels.
 *
 * Status lifecycle: pending → sent | failed (retried back to pending if attempts<MAX)
 *
 * `event_id` is intentionally NOT a foreign key — events can be deleted while
 * we still want to keep historical dispatch logs for the admin audit view.
 */
export const eventNotificationDispatchLogTable = pgTable(
  "event_notification_dispatch_log",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id").notNull(),
    eventTitle: text("event_title").notNull(),
    /**
     * Informational — for milestone rows this is the milestone hours (24/12/6/1).
     * For pulse rows this is 0. The unique key is `bucket_key`, not this column.
     */
    milestoneHours: integer("milestone_hours").notNull(),
    /**
     * Idempotency key. `milestone_<N>h` for milestone fires, or
     * `pulse_<UTC ISO slot>` for pulse fires. Replaces milestone_hours in the
     * unique index so pulses can coexist with milestones for the same event.
     */
    bucketKey: text("bucket_key").notNull().default(""),
    channel: text("channel").notNull(), // 'push' | 'email' | 'sse'
    status: text("status").notNull().default("pending"), // 'pending' | 'sent' | 'failed' | 'skipped'
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    recipientCount: integer("recipient_count").notNull().default(0),
    successCount: integer("success_count").notNull().default(0),
    failureCount: integer("failure_count").notNull().default(0),
    firstAttemptAt: timestamp("first_attempt_at", { withTimezone: true }),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqBucketChannel: uniqueIndex(
      "event_notif_dispatch_event_bucket_channel_uniq",
    ).on(t.eventId, t.bucketKey, t.channel),
    statusIdx: index("event_notif_dispatch_status_idx").on(t.status),
    eventIdx: index("event_notif_dispatch_event_idx").on(t.eventId),
    createdIdx: index("event_notif_dispatch_created_idx").on(t.createdAt),
  }),
);

export type EventNotificationDispatchLog =
  typeof eventNotificationDispatchLogTable.$inferSelect;
export type InsertEventNotificationDispatchLog =
  typeof eventNotificationDispatchLogTable.$inferInsert;

export type EventNotificationChannel = "push" | "email" | "sse";
export type EventNotificationStatus = "pending" | "sent" | "failed" | "skipped";

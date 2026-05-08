import { pgTable, serial, text, boolean, timestamp, index } from "drizzle-orm/pg-core";

export const devotionSubscribersTable = pgTable(
  "devotion_subscribers",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull().unique(),
    name: text("name"),
    unsubscribeToken: text("unsubscribe_token").notNull().unique(),
    isActive: boolean("is_active").notNull().default(true),
    subscribedAt: timestamp("subscribed_at", { withTimezone: true }).notNull().defaultNow(),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
    lastSentDate: text("last_sent_date"),
    sourcePage: text("source_page"),
  },
  (t) => ({
    activeIdx: index("devotion_subscribers_active_idx").on(t.isActive),
  }),
);

export type DevotionSubscriber = typeof devotionSubscribersTable.$inferSelect;
export type InsertDevotionSubscriber = typeof devotionSubscribersTable.$inferInsert;

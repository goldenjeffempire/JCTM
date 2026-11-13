import { pgTable, serial, text, boolean, timestamp, index } from "drizzle-orm/pg-core";

/** Newsletter-only opt-ins collected through the crusade invitation form. */
export const crusadeNewsletterSubscribersTable = pgTable(
  "crusade_newsletter_subscribers",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull().unique(),
    unsubscribeToken: text("unsubscribe_token").notNull().unique(),
    sourcePage: text("source_page").notNull().default("crusade_invitation"),
    isActive: boolean("is_active").notNull().default(true),
    subscribedAt: timestamp("subscribed_at", { withTimezone: true }).notNull().defaultNow(),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
  },
  (t) => ({ activeIdx: index("crusade_newsletter_active_idx").on(t.isActive) }),
);

export type CrusadeNewsletterSubscriber = typeof crusadeNewsletterSubscribersTable.$inferSelect;

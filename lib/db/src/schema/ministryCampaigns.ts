import { pgTable, text, jsonb, integer, timestamp, bigserial } from "drizzle-orm/pg-core";

export const ministryCampaignsTable = pgTable("ministry_campaigns", {
  slug: text("slug").primaryKey(),
  content: jsonb("content").notNull(),
  revision: integer("revision").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const ministryCampaignRevisionsTable = pgTable("ministry_campaign_revisions", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  slug: text("slug").notNull(),
  content: jsonb("content").notNull(),
  revision: integer("revision").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

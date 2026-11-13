import { bigint, pgTable, smallint, timestamp } from "drizzle-orm/pg-core";

/** Site-wide aggregate only; no visitor or card data is retained. */
export const crusadeInvitationStatsTable = pgTable("crusade_invitation_stats", {
  id: smallint("id").primaryKey(),
  generatedCards: bigint("generated_cards", { mode: "number" }).notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

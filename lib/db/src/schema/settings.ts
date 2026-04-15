import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const settingsTable = pgTable("app_settings", {
  key: text("key").primaryKey(),
  intValue: integer("int_value"),
  textValue: text("text_value"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export type Setting = typeof settingsTable.$inferSelect;

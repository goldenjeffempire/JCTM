import { pgTable, text, serial, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const givingLogsTable = pgTable("giving_logs", {
  id: serial("id").primaryKey(),
  donorName: text("donor_name"),
  donorEmail: text("donor_email"),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("NGN"),
  purpose: text("purpose"),
  reference: text("reference").notNull().unique(),
  status: text("status").notNull().default("pending"),
  paymentMethod: text("payment_method"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGivingLogSchema = createInsertSchema(givingLogsTable).omit({ id: true, createdAt: true });
export type InsertGivingLog = z.infer<typeof insertGivingLogSchema>;
export type GivingLog = typeof givingLogsTable.$inferSelect;

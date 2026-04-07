import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const crusadeRegistrationsTable = pgTable("crusade_registrations", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  city: text("city"),
  willAttend: boolean("will_attend").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCrusadeRegistrationSchema = createInsertSchema(crusadeRegistrationsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertCrusadeRegistration = z.infer<typeof insertCrusadeRegistrationSchema>;
export type CrusadeRegistration = typeof crusadeRegistrationsTable.$inferSelect;

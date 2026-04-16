import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const conferenceRegistrationsTable = pgTable("conference_registrations", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  ministry: text("ministry"),
  role: text("role"),
  stateOrCountry: text("state_or_country"),
  message: text("message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertConferenceRegistrationSchema = createInsertSchema(conferenceRegistrationsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertConferenceRegistration = z.infer<typeof insertConferenceRegistrationSchema>;
export type ConferenceRegistration = typeof conferenceRegistrationsTable.$inferSelect;

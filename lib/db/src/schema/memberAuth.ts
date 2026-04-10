import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const memberAuthTable = pgTable("member_auth", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  token: text("token").unique(),
  phone: text("phone"),
  role: text("role").notNull().default("member"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMemberAuthSchema = createInsertSchema(memberAuthTable).omit({ id: true, createdAt: true, token: true, role: true });
export type InsertMemberAuth = z.infer<typeof insertMemberAuthSchema>;
export type MemberAuth = typeof memberAuthTable.$inferSelect;

import { pgTable, text, serial, timestamp, integer, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const aiFeedbackTable = pgTable("ai_feedback", {
  id: serial("id").primaryKey(),
  conversationId: text("conversation_id"),
  messageId: integer("message_id"),
  sessionId: text("session_id"),
  rating: integer("rating"),
  helpful: boolean("helpful"),
  comment: text("comment"),
  query: text("query"),
  responseSnippet: text("response_snippet"),
  tier: text("tier"),
  userQuery: text("user_query"),
  aiResponse: text("ai_response"),
  feedbackText: text("feedback_text"),
  modelTier: text("model_tier").default("openai"),
  latencyMs: integer("latency_ms"),
  confidenceScore: real("confidence_score"),
  wasHelpful: integer("was_helpful"),
  category: text("category"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAiFeedbackSchema = createInsertSchema(aiFeedbackTable).omit({ id: true, createdAt: true });
export type InsertAiFeedback = z.infer<typeof insertAiFeedbackSchema>;
export type AiFeedback = typeof aiFeedbackTable.$inferSelect;

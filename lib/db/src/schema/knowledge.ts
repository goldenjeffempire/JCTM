import { customType, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

const embeddingVector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(384)";
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    return value.slice(1, -1).split(",").map(Number);
  },
});

export const knowledgeChunks = pgTable("knowledge_chunks", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  source: text("source").notNull(),
  chunkIndex: integer("chunk_index").notNull().default(0),
  embedding: embeddingVector("embedding"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type KnowledgeChunk = typeof knowledgeChunks.$inferSelect;

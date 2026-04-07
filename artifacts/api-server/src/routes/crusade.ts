import { Router } from "express";
import { db } from "@workspace/db";
import { crusadeRegistrationsTable, insertCrusadeRegistrationSchema } from "@workspace/db";
import { count } from "drizzle-orm";

const router = Router();

router.post("/crusade/register", async (req, res) => {
  try {
    const body = insertCrusadeRegistrationSchema.parse(req.body);
    const [registration] = await db
      .insert(crusadeRegistrationsTable)
      .values(body)
      .returning();
    res.json({ success: true, registration });
  } catch (err: unknown) {
    const e = err as { issues?: unknown; name?: string };
    if (e?.issues || e?.name === "ZodError") {
      res.status(400).json({ error: "Invalid data", details: e.issues });
      return;
    }
    res.status(500).json({ error: "Registration failed" });
  }
});

router.get("/crusade/count", async (_req, res) => {
  try {
    const [result] = await db
      .select({ value: count() })
      .from(crusadeRegistrationsTable);
    res.json({ count: result?.value ?? 0 });
  } catch {
    res.status(500).json({ error: "Failed to fetch count" });
  }
});

export default router;

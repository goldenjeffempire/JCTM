import { Router } from "express";
import { db } from "@workspace/db";
import { conferenceRegistrationsTable, insertConferenceRegistrationSchema } from "@workspace/db";
import { count } from "drizzle-orm";

const router = Router();

router.post("/conference/register", async (req, res) => {
  try {
    const body = insertConferenceRegistrationSchema.parse(req.body);
    const [registration] = await db
      .insert(conferenceRegistrationsTable)
      .values(body)
      .returning();
    res.json({
      success: true,
      registration: {
        ...registration,
        createdAt: registration.createdAt instanceof Date
          ? registration.createdAt.toISOString()
          : registration.createdAt,
      },
    });
  } catch (err: unknown) {
    const e = err as { issues?: unknown; name?: string };
    if (e?.issues || e?.name === "ZodError") {
      res.status(400).json({ error: "Invalid data", details: e.issues });
      return;
    }
    res.status(500).json({ error: "Registration failed" });
  }
});

router.get("/conference/count", async (_req, res) => {
  try {
    const [result] = await db
      .select({ value: count() })
      .from(conferenceRegistrationsTable);
    res.json({ count: result?.value ?? 0 });
  } catch {
    res.status(500).json({ error: "Failed to fetch count" });
  }
});

export default router;

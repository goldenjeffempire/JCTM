import { Router, type IRouter } from "express";
import { or, ilike, desc } from "drizzle-orm";
import { db, membersTable } from "@workspace/db";
import {
  ListMembersQueryParams,
  ListMembersResponse,
  CreateMemberBody,
} from "@workspace/api-zod";
import { requireAdminRole } from "../lib/adminAuth.js";

const router: IRouter = Router();

const MEMBERS_MAX_LIMIT = 100;

router.get("/members", async (req, res): Promise<void> => {
  const parsed = ListMembersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const rawLimit  = parsed.data.limit  ?? 20;
  const rawOffset = parsed.data.offset ?? 0;
  const search    = parsed.data.search;

  // Enforce safe bounds
  const limit  = Math.min(Math.max(rawLimit, 1), MEMBERS_MAX_LIMIT);
  const offset = Math.max(rawOffset, 0);

  const conditions = search
    ? [
        ilike(membersTable.firstName, `%${search}%`),
        ilike(membersTable.lastName, `%${search}%`),
        ilike(membersTable.department, `%${search}%`),
      ]
    : [];

  try {
    const members = await db
      .select()
      .from(membersTable)
      .where(conditions.length > 0 ? or(...conditions) : undefined)
      .orderBy(desc(membersTable.joinedAt))
      .limit(limit)
      .offset(offset);

    const serialized = members.map(m => ({
      ...m,
      joinedAt: m.joinedAt instanceof Date ? m.joinedAt.toISOString() : m.joinedAt,
    }));
    if (!search) {
      res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    }
    res.json(ListMembersResponse.parse(serialized));
  } catch {
    res.status(500).json({ error: "Failed to load members" });
  }
});

router.post("/members", requireAdminRole(["gallery", "sermon", "livestream"]), async (req, res): Promise<void> => {
  const parsed = CreateMemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [member] = await db
    .insert(membersTable)
    .values(parsed.data)
    .returning();

  res.status(201).json({
    ...member,
    joinedAt: member.joinedAt instanceof Date ? member.joinedAt.toISOString() : member.joinedAt,
  });
});

export default router;

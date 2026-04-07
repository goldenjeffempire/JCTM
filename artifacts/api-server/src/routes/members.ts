import { Router, type IRouter } from "express";
import { or, ilike, desc } from "drizzle-orm";
import { db, membersTable } from "@workspace/db";
import {
  ListMembersQueryParams,
  ListMembersResponse,
  CreateMemberBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/members", async (req, res): Promise<void> => {
  const parsed = ListMembersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { limit = 20, offset = 0, search } = parsed.data;

  const conditions = search
    ? [
        ilike(membersTable.firstName, `%${search}%`),
        ilike(membersTable.lastName, `%${search}%`),
        ilike(membersTable.department, `%${search}%`),
      ]
    : [];

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
  res.json(ListMembersResponse.parse(serialized));
});

router.post("/members", async (req, res): Promise<void> => {
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

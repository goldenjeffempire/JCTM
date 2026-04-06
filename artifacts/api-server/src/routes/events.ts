import { Router, type IRouter } from "express";
import { gte, desc, asc } from "drizzle-orm";
import { db, eventsTable } from "@workspace/db";
import {
  ListEventsQueryParams,
  ListEventsResponse,
  CreateEventBody,
  GetUpcomingEventsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/events", async (req, res): Promise<void> => {
  const parsed = ListEventsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { limit = 20, offset = 0 } = parsed.data;

  const events = await db
    .select()
    .from(eventsTable)
    .orderBy(asc(eventsTable.startDate))
    .limit(limit)
    .offset(offset);

  const serializeEvent = (e: typeof events[0]) => ({
    ...e,
    startDate: e.startDate instanceof Date ? e.startDate.toISOString() : e.startDate,
    endDate: e.endDate instanceof Date ? e.endDate.toISOString() : e.endDate,
    createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : e.createdAt,
  });
  res.json(ListEventsResponse.parse(events.map(serializeEvent)));
});

router.get("/events/upcoming", async (req, res): Promise<void> => {
  const now = new Date();

  const events = await db
    .select()
    .from(eventsTable)
    .where(gte(eventsTable.startDate, now))
    .orderBy(asc(eventsTable.startDate))
    .limit(3);

  const serialized = events.map(e => ({
    ...e,
    startDate: e.startDate instanceof Date ? e.startDate.toISOString() : e.startDate,
    endDate: e.endDate instanceof Date ? e.endDate.toISOString() : e.endDate,
    createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : e.createdAt,
  }));
  res.json(GetUpcomingEventsResponse.parse(serialized));
});

router.post("/events", async (req, res): Promise<void> => {
  const parsed = CreateEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [event] = await db
    .insert(eventsTable)
    .values({
      ...parsed.data,
      startDate: new Date(parsed.data.startDate),
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
    })
    .returning();

  res.status(201).json(event);
});

export default router;

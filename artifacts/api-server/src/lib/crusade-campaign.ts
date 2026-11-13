import { pool } from "@workspace/db";
import type { Pool } from "pg";
import { DEFAULT_CRUSADE, type CrusadeCampaign } from "@workspace/content";
import { z } from "zod";

const instant = z.string().datetime({ offset: true }).refine(
  value => new Date(value).getUTCFullYear() >= 2026 && new Date(value).getUTCFullYear() <= 2100,
  "Schedule dates must be between 2026 and 2100",
);
export const crusadeCampaignInput = z.object({
  title: z.string().trim().min(3).max(120),
  minister: z.string().trim().min(3).max(160),
  venue: z.string().trim().min(10).max(400),
  contactPhone: z.string().trim().max(60).default(DEFAULT_CRUSADE.contactPhone),
  contactEmail: z.union([z.string().trim().email().max(160), z.literal("")]).default(DEFAULT_CRUSADE.contactEmail),
  flyerUrl: z.string().max(500).regex(
    /^\/(?:images\/[a-zA-Z0-9_-]+\.(?:webp|png|jpg|jpeg)|api\/storage\/objects\/uploads\/[a-zA-Z0-9_.-]+)$/,
    "Use the uploaded flyer or a local image asset",
  ),
  published: z.boolean(),
  revision: z.number().int().nonnegative(),
  programs: z.array(z.object({
    id: z.string().regex(/^[a-z0-9-]{1,60}$/),
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().max(500),
    startsAt: z.array(instant).min(1).max(20)
      .refine(values => new Set(values.map(Date.parse)).size === values.length, "Duplicate occurrence times"),
    published: z.boolean(),
  })).length(4).refine(programs => new Set(programs.map(p => p.id)).size === programs.length, "Program IDs must be unique"),
}).strict();

export const CRUSADE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS ministry_campaigns (
  slug text PRIMARY KEY,
  content jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ministry_campaign_revisions (
  id bigserial PRIMARY KEY,
  slug text NOT NULL,
  content jsonb NOT NULL,
  revision integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);`;
const SLUG = "end-of-year-crusade-2026";
/** Separate repositories allow isolated-schema tests without touching ministry data. */
export function createCrusadeRepository(database: Pool = pool) {
let initialization: Promise<void> | undefined;
function ensureCrusadeCampaign(): Promise<void> {
  return initialization ??= (async () => {
    await database.query(CRUSADE_SCHEMA_SQL);
    await database.query(
      "INSERT INTO ministry_campaigns(slug,content) VALUES ($1,$2::jsonb) ON CONFLICT(slug) DO NOTHING",
      [SLUG, JSON.stringify(DEFAULT_CRUSADE)],
    );
    // Add official ministry contact metadata without replacing schedules or admin edits.
    await database.query(
      `UPDATE ministry_campaigns
       SET content=$2::jsonb || content
       WHERE slug=$1 AND (NOT content ? 'contactPhone' OR NOT content ? 'contactEmail')`,
      [SLUG, JSON.stringify({ contactPhone: DEFAULT_CRUSADE.contactPhone, contactEmail: DEFAULT_CRUSADE.contactEmail })],
    );
  })().catch(error => { initialization = undefined; throw error; });
}

async function readCrusadeCampaign(): Promise<CrusadeCampaign> {
  await ensureCrusadeCampaign();
  const { rows } = await database.query("SELECT content, revision FROM ministry_campaigns WHERE slug=$1", [SLUG]);
  if (!rows[0]) throw new Error("Crusade campaign missing");
  return { ...rows[0].content, revision: rows[0].revision };
}

async function updateCrusadeCampaign(input: CrusadeCampaign): Promise<CrusadeCampaign | null> {
  await ensureCrusadeCampaign();
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      "SELECT content,revision FROM ministry_campaigns WHERE slug=$1 FOR UPDATE", [SLUG],
    );
    if (!rows[0] || rows[0].revision !== input.revision) {
      await client.query("ROLLBACK");
      return null;
    }
    await client.query(
      "INSERT INTO ministry_campaign_revisions(slug,content,revision) VALUES($1,$2,$3)",
      [SLUG, rows[0].content, rows[0].revision],
    );
    const content = {
      ...input, revision: input.revision + 1,
      programs: input.programs.map(p => ({ ...p, startsAt: [...p.startsAt].sort((a,b) => Date.parse(a)-Date.parse(b)) })),
    };
    await client.query(
      "UPDATE ministry_campaigns SET content=$2::jsonb,revision=$3,updated_at=now() WHERE slug=$1",
      [SLUG, JSON.stringify(content), content.revision],
    );
    await client.query("COMMIT");
    return content;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { client.release(); }
}
return { ensureCrusadeCampaign, readCrusadeCampaign, updateCrusadeCampaign };
}
export const { ensureCrusadeCampaign, readCrusadeCampaign, updateCrusadeCampaign } = createCrusadeRepository();

export function publicCrusade(campaign: CrusadeCampaign): CrusadeCampaign | null {
  if (!campaign.published) return null;
  return { ...campaign, programs: campaign.programs.filter(program => program.published) };
}

// Additive migration for the existing, externally hosted Render database.
// Historical content is never deleted or rewritten by this migration.
export const DEVOTION_SCHEMA_SQL = `
ALTER TABLE daily_devotions
  ADD COLUMN IF NOT EXISTS topic text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS introduction text,
  ADD COLUMN IF NOT EXISTS application text,
  ADD COLUMN IF NOT EXISTS scripture_version text,
  ADD COLUMN IF NOT EXISTS topic_key text,
  ADD COLUMN IF NOT EXISTS title_key text,
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS review_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS devotion_unique_topic ON daily_devotions(topic_key) WHERE topic_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS devotion_unique_title ON daily_devotions(title_key) WHERE title_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS devotion_unique_content ON daily_devotions(content_hash) WHERE content_hash IS NOT NULL;
CREATE TABLE IF NOT EXISTS devotion_library (
  topic_key text PRIMARY KEY,
  title_key text NOT NULL UNIQUE,
  content_hash text NOT NULL,
  content jsonb NOT NULL,
  category text NOT NULL,
  status text NOT NULL DEFAULT 'ready' CHECK (status IN ('ready','used','review')),
  source text NOT NULL DEFAULT 'editor',
  assigned_date date UNIQUE,
  review_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS devotion_library_ready ON devotion_library(status, category);
CREATE TABLE IF NOT EXISTS devotion_expansion_state (
  id integer PRIMARY KEY CHECK (id=1),
  attempted_at timestamptz,
  succeeded_at timestamptz,
  added integer NOT NULL DEFAULT 0,
  error_code text,
  error_message text
);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM devotion_expansion_state WHERE id=1) THEN
    UPDATE daily_devotions SET published_at=now()
      WHERE date <= (now() AT TIME ZONE 'Africa/Lagos')::date AND review_required=false;
    INSERT INTO devotion_expansion_state(id) VALUES(1);
  END IF;
END $$;
`;

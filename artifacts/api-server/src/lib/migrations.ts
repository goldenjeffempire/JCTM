import { pool } from "@workspace/db";
import { logger } from "./logger.js";

/**
 * Runs all idempotent schema migrations.
 *
 * Every statement uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS so the
 * function is safe to call on every deploy and on every server startup.
 *
 * Throws on hard database errors; the caller decides whether to abort or
 * continue (preDeployCommand should abort; server startup should continue).
 */
export async function runMigrations(): Promise<void> {
  // ── Core tables ─────────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_devotions (
      date date PRIMARY KEY,
      title text NOT NULL,
      scripture text NOT NULL,
      reference text NOT NULL,
      reflection text NOT NULL,
      prophetic_word text NOT NULL,
      prayer_focus text NOT NULL,
      declaration text NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS moment_likes (
      id serial PRIMARY KEY,
      video_id text NOT NULL,
      visitor_id text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS moment_comments (
      id serial PRIMARY KEY,
      video_id text NOT NULL,
      visitor_id text NOT NULL,
      name text NOT NULL,
      body text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`ALTER TABLE moment_comments ADD COLUMN IF NOT EXISTS yt_comment_id text`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS moment_engagements (
      id serial PRIMARY KEY,
      video_id text NOT NULL UNIQUE,
      yt_engagement_comment_id text,
      share_count integer NOT NULL DEFAULT 0,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  // ── pgvector extension + similarity index ──────────────────────────────────
  try {
    await pool.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx
      ON knowledge_chunks
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 50)
      WHERE embedding IS NOT NULL
    `);
    logger.info("pgvector extension and similarity index ready");
  } catch (vecErr) {
    logger.warn({ err: vecErr }, "pgvector extension not available — semantic search disabled");
  }

  // ── Admin RBAC: role column on member_auth ──────────────────────────────────
  await pool.query(`
    ALTER TABLE member_auth ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member'
  `);

  // ── Knowledge chunks unique constraint for sermon UPSERT support ────────────
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'knowledge_chunks_source_chunk_idx'
      ) THEN
        ALTER TABLE knowledge_chunks
          ADD CONSTRAINT knowledge_chunks_source_chunk_idx
          UNIQUE (source, chunk_index);
      END IF;
    END $$
  `);

  // ── AI Feedback Loop table ──────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_feedback (
      id serial PRIMARY KEY,
      session_id text,
      message_id text,
      user_query text NOT NULL,
      ai_response text NOT NULL,
      rating integer,
      feedback_text text,
      model_tier text NOT NULL DEFAULT 'local',
      latency_ms integer,
      confidence_score real,
      was_helpful integer,
      category text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  // ── SEO Blog Posts table ────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS blog_posts (
      id serial PRIMARY KEY,
      slug text NOT NULL UNIQUE,
      title text NOT NULL,
      excerpt text NOT NULL,
      content text NOT NULL,
      category text NOT NULL DEFAULT 'faith',
      tags text[] NOT NULL DEFAULT '{}',
      meta_title text,
      meta_description text,
      canonical_url text,
      schema_json text,
      is_published boolean NOT NULL DEFAULT false,
      published_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS topic text NOT NULL DEFAULT 'faith'`);
  await pool.query(`ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS author text NOT NULL DEFAULT 'Jesus Christ Temple Ministry'`);
  await pool.query(`ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS read_time_minutes integer NOT NULL DEFAULT 5`);
  await pool.query(`ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false`);
  await pool.query(`ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS seo_title text`);
  await pool.query(`ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS seo_description text`);
  await pool.query(`ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS meta_title text`);
  await pool.query(`ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS meta_description text`);
  await pool.query(`ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS schema_json text`);
  await pool.query(`ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT false`);
  await pool.query(`ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false`);
  await pool.query(`ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS generated_at timestamptz NOT NULL DEFAULT now()`);
  await pool.query(`ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()`);
  await pool.query(`CREATE INDEX IF NOT EXISTS blog_posts_published_at_idx ON blog_posts (published, published_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS blog_posts_category_idx ON blog_posts (category) WHERE published = true`);
  await pool.query(`CREATE INDEX IF NOT EXISTS blog_posts_topic_idx ON blog_posts (topic) WHERE published = true`);
  await pool.query(`CREATE INDEX IF NOT EXISTS blog_posts_featured_idx ON blog_posts (featured, published_at DESC) WHERE published = true`);
  await pool.query(`CREATE INDEX IF NOT EXISTS blog_posts_search_idx ON blog_posts USING gin (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(excerpt,'') || ' ' || coalesce(content,'')))`);

  // ── Push dispatch log ───────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS push_dispatch_log (
      id serial PRIMARY KEY,
      notification_title text NOT NULL,
      notification_type text NOT NULL DEFAULT 'custom',
      sent integer NOT NULL DEFAULT 0,
      failed integer NOT NULL DEFAULT 0,
      deactivated integer NOT NULL DEFAULT 0,
      total_attempted integer NOT NULL DEFAULT 0,
      delivery_rate real NOT NULL DEFAULT 0,
      dispatched_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  // ── Sermon transcript indexing ──────────────────────────────────────────────
  await pool.query(`ALTER TABLE sermon_data ADD COLUMN IF NOT EXISTS transcript_summary text`);
  await pool.query(`ALTER TABLE sermon_data ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now()`);

  // ── Rebroadcast: track when a live stream ends ──────────────────────────────
  await pool.query(`ALTER TABLE sermon_data ADD COLUMN IF NOT EXISTS broadcast_ended_at timestamptz`);

  // ── Community Prayer Wall ───────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS prayer_requests (
      id serial PRIMARY KEY,
      name text NOT NULL DEFAULT 'Anonymous',
      category text NOT NULL DEFAULT 'general',
      request text NOT NULL,
      pray_count integer NOT NULL DEFAULT 0,
      is_public boolean NOT NULL DEFAULT true,
      visitor_id text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  // ── pgvector cosine similarity search function ──────────────────────────────
  try {
    await pool.query(`
      CREATE OR REPLACE FUNCTION search_knowledge_chunks(
        query_embedding vector(1536),
        match_count integer DEFAULT 5
      )
      RETURNS TABLE (
        id integer,
        content text,
        source text,
        similarity float
      )
      LANGUAGE sql STABLE
      AS $$
        SELECT id, content, source,
               1 - (embedding <=> query_embedding) AS similarity
        FROM knowledge_chunks
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> query_embedding
        LIMIT match_count;
      $$
    `);
    logger.info("pgvector similarity search function created");
  } catch (fnErr) {
    logger.warn({ err: fnErr }, "Could not create similarity search function — pgvector may not be available");
  }

  // ── Sermon AI metadata enrichment columns ──────────────────────────────────
  await pool.query(`ALTER TABLE sermon_data ADD COLUMN IF NOT EXISTS ai_summary text`);
  await pool.query(`ALTER TABLE sermon_data ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'`);
  await pool.query(`ALTER TABLE sermon_data ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'sermon'`);
  await pool.query(`ALTER TABLE sermon_data ADD COLUMN IF NOT EXISTS metadata_generated_at timestamptz`);

  // ── Admin credentials (DB-backed passphrases, survive deployments) ──────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_credentials (
      role TEXT PRIMARY KEY,
      passphrase_hash TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // ── Gallery thumbnail_path column ───────────────────────────────────────────
  await pool.query(`ALTER TABLE gallery_images ADD COLUMN IF NOT EXISTS thumbnail_path text`);

  // ── Local object store (fallback for GCS) ──────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS local_objects (
      object_path text PRIMARY KEY,
      object_name text NOT NULL,
      content_type text NOT NULL,
      byte_size integer NOT NULL,
      data bytea NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS local_objects_created_at_idx
    ON local_objects (created_at DESC)
  `);

  // ── Push Notification Subscriptions ────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id serial PRIMARY KEY,
      endpoint text NOT NULL UNIQUE,
      p256dh text NOT NULL,
      auth text NOT NULL,
      device_type text NOT NULL DEFAULT 'web',
      visitor_id text,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS push_subscriptions_active_idx
    ON push_subscriptions (is_active) WHERE is_active = true
  `);

  // ── Broadcast Event History ─────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS broadcast_events (
      id serial PRIMARY KEY,
      type text NOT NULL,
      title text,
      video_id text,
      message text NOT NULL,
      url text NOT NULL DEFAULT '/sermons',
      push_sent integer NOT NULL DEFAULT 0,
      fired_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS broadcast_events_fired_at_idx
    ON broadcast_events (fired_at DESC)
  `);

  // ── Livestream override state ───────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS livestream_override_state (
      id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      is_live boolean NOT NULL DEFAULT false,
      title text,
      stream_url text,
      video_id text,
      started_at text,
      manual_live boolean NOT NULL DEFAULT false,
      manual_rebroadcast boolean NOT NULL DEFAULT false,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  // ── Ministers Conference Registrations ─────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS conference_registrations (
      id serial PRIMARY KEY,
      full_name text NOT NULL,
      email text,
      phone text,
      ministry text,
      role text,
      state_or_country text,
      message text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  // ── Performance indexes ─────────────────────────────────────────────────────
  await pool.query(`
    CREATE INDEX IF NOT EXISTS member_directory_first_name_idx
    ON member_directory (lower(first_name) text_pattern_ops)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS member_directory_last_name_idx
    ON member_directory (lower(last_name) text_pattern_ops)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS sermon_data_published_at_idx
    ON sermon_data (published_at DESC)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS sermon_data_video_id_idx
    ON sermon_data (video_id)
    WHERE video_id IS NOT NULL
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS sermon_data_is_live_idx
    ON sermon_data (is_live)
    WHERE is_live = true
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS prayer_requests_public_idx
    ON prayer_requests (created_at DESC)
    WHERE is_public = true
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS testimonies_approved_idx
    ON testimonies (created_at DESC)
    WHERE approved = true
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS giving_logs_reference_idx
    ON giving_logs (reference)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS giving_logs_status_idx
    ON giving_logs (status, created_at DESC)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS push_subscriptions_visitor_idx
    ON push_subscriptions (visitor_id)
    WHERE is_active = true
  `);

  // ── Daily Devotion Email Subscribers ────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS devotion_subscribers (
      id serial PRIMARY KEY,
      email text NOT NULL UNIQUE,
      unsubscribe_token text NOT NULL UNIQUE,
      is_active boolean NOT NULL DEFAULT true,
      subscribed_at timestamptz NOT NULL DEFAULT now(),
      unsubscribed_at timestamptz,
      last_sent_date text,
      source_page text
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS devotion_subscribers_active_idx
    ON devotion_subscribers (is_active) WHERE is_active = true
  `);

  // ── Event Promotions (Time-driven event lifecycle engine) ───────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS event_promotions (
      id serial PRIMARY KEY,
      slug text NOT NULL UNIQUE,
      title text NOT NULL,
      subtitle text,
      artwork_url text,
      location text,
      cta_text text NOT NULL DEFAULT 'Join Us',
      cta_url text NOT NULL DEFAULT '/',
      start_at timestamptz NOT NULL,
      end_at timestamptz NOT NULL,
      status text NOT NULL DEFAULT 'active',
      show_banner boolean NOT NULL DEFAULT true,
      show_popup boolean NOT NULL DEFAULT true,
      show_sticky_bar boolean NOT NULL DEFAULT true,
      push_sent_at timestamptz,
      end_push_sent_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS event_promotions_active_window_idx
    ON event_promotions (status, start_at, end_at)
    WHERE status = 'active'
  `);

  logger.info("All migrations complete");
}

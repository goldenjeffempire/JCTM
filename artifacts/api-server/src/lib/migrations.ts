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

  // ── pgvector extension ──────────────────────────────────────────────────────
  try {
    await pool.query(`CREATE EXTENSION IF NOT EXISTS vector`);
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
  await pool.query(`CREATE INDEX IF NOT EXISTS push_dispatch_log_type_idx ON push_dispatch_log (notification_type, dispatched_at DESC)`);

  // ── Notification click tracking ─────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notification_clicks (
      id serial PRIMARY KEY,
      broadcast_type text NOT NULL,
      target_url text NOT NULL,
      visitor_id text,
      clicked_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS notification_clicks_type_idx ON notification_clicks (broadcast_type, clicked_at DESC)`);

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

  // ── Migrate embedding column from vector(1536) to vector(384) ──────────────
  // Previous builds used OpenAI text-embedding-3-small (1536-dim). The local
  // AI engine uses 384-dim vectors. Migrate idempotently by checking current
  // dimension before dropping/re-adding the column.
  try {
    const dimCheck = await pool.query<{ atttypmod: number }>(`
      SELECT a.atttypmod
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      WHERE c.relname = 'knowledge_chunks' AND a.attname = 'embedding'
    `);
    const currentDim = dimCheck.rows[0] ? dimCheck.rows[0].atttypmod - 4 : null;
    if (currentDim !== null && currentDim !== 384) {
      logger.info({ currentDim }, "Migrating knowledge_chunks.embedding from vector(1536) to vector(384)");
      await pool.query(`DROP INDEX IF EXISTS knowledge_chunks_embedding_idx`);
      await pool.query(`ALTER TABLE knowledge_chunks DROP COLUMN IF EXISTS embedding`);
      await pool.query(`ALTER TABLE knowledge_chunks ADD COLUMN embedding vector(384)`);
      await pool.query(`TRUNCATE knowledge_chunks`);
      logger.info("Embedding column migrated to vector(384) — knowledge base will be re-ingested");
    }
  } catch (dimErr) {
    logger.warn({ err: dimErr }, "Could not check/migrate embedding dimension (non-fatal)");
  }

  // ── pgvector similarity index ────────────────────────────────────────────────
  try {
    await pool.query(`
      CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx
      ON knowledge_chunks
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 50)
      WHERE embedding IS NOT NULL
    `);
  } catch (idxErr) {
    logger.warn({ err: idxErr }, "Could not create ivfflat index (non-fatal)");
  }

  // ── pgvector cosine similarity search function ──────────────────────────────
  try {
    await pool.query(`
      CREATE OR REPLACE FUNCTION search_knowledge_chunks(
        query_embedding vector(384),
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
  // Per-subscription delivery health tracking. These columns let the dispatch
  // loop auto-retire endpoints that fail repeatedly (e.g. VAPID mismatch
  // returning 403 forever, or browsers that silently lose their push channel).
  await pool.query(`
    ALTER TABLE push_subscriptions
      ADD COLUMN IF NOT EXISTS consecutive_failures integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_failure_at      timestamptz,
      ADD COLUMN IF NOT EXISTS last_failure_status  integer,
      ADD COLUMN IF NOT EXISTS last_success_at      timestamptz,
      ADD COLUMN IF NOT EXISTS deactivated_reason   text
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS push_subscriptions_health_idx
    ON push_subscriptions (consecutive_failures)
    WHERE is_active = true
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

  // ── Generic recurring broadcast columns (campaign promotion mode) ───────────
  // Adds the columns needed for the per-promotion configurable broadcast
  // cadence engine. All NOT NULL columns get safe defaults so existing rows
  // (including the Warri Crusade row) are unaffected and remain disabled by
  // default — admins must explicitly opt-in via the admin panel.
  await pool.query(`
    ALTER TABLE event_promotions
      ADD COLUMN IF NOT EXISTS broadcast_enabled boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS broadcast_cadence text NOT NULL DEFAULT 'half_hourly',
      ADD COLUMN IF NOT EXISTS broadcast_interval_minutes integer,
      ADD COLUMN IF NOT EXISTS broadcast_messages jsonb NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS broadcast_title_override text,
      ADD COLUMN IF NOT EXISTS broadcast_image_url text
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS event_promotions_broadcast_enabled_idx
    ON event_promotions (broadcast_enabled, end_at)
    WHERE broadcast_enabled = true
  `);

  // ── Scheduled Broadcasts (delayed admin push notifications) ─────────────────
  // Admin can compose a notification and schedule it for a future time. The
  // per-minute cron tick polls this table for due rows (status='pending' AND
  // scheduled_for <= now), claims them via UPDATE...RETURNING, dispatches via
  // dispatchPushNotification, and marks them sent/failed. The claim step
  // guarantees at-most-once delivery even if a second tick races.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS scheduled_broadcasts (
      id serial PRIMARY KEY,
      title text NOT NULL,
      body text NOT NULL,
      url text NOT NULL DEFAULT '/',
      require_interaction boolean NOT NULL DEFAULT false,
      scheduled_for timestamptz NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      sent_at timestamptz,
      sent_count integer,
      failed_count integer,
      deactivated_count integer,
      error text,
      created_by text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS scheduled_broadcasts_due_idx
    ON scheduled_broadcasts (scheduled_for)
    WHERE status = 'pending'
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS scheduled_broadcasts_recent_idx
    ON scheduled_broadcasts (created_at DESC)
  `);

  // ── Broadcast Snippets (admin-saved reusable templates) ────────────────────
  // Admins can save commonly-used broadcast compositions by name and reuse
  // them from the composer. Names are case-insensitively unique. Snippets
  // store the full payload (title, body, url, requireInteraction) so they
  // round-trip identically.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS broadcast_snippets (
      id serial PRIMARY KEY,
      name text NOT NULL,
      title text NOT NULL,
      body text NOT NULL,
      url text NOT NULL DEFAULT '/',
      require_interaction boolean NOT NULL DEFAULT false,
      created_by text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS broadcast_snippets_name_unique_idx
    ON broadcast_snippets (LOWER(name))
  `);

  // ── Video Event Counts (YouTube embed analytics) ───────────────────────────
  // Aggregates per (video_id, page) of impressions / plays / quartile reach /
  // completes coming from the canonical <YouTubeEmbed/> component on the
  // frontend. Used to surface top-performing embeds in the admin dashboard.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS video_event_counts (
      video_id text NOT NULL,
      page text NOT NULL DEFAULT '/',
      impressions bigint NOT NULL DEFAULT 0,
      plays bigint NOT NULL DEFAULT 0,
      pauses bigint NOT NULL DEFAULT 0,
      q25 bigint NOT NULL DEFAULT 0,
      q50 bigint NOT NULL DEFAULT 0,
      q75 bigint NOT NULL DEFAULT 0,
      completes bigint NOT NULL DEFAULT 0,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (video_id, page)
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS video_event_counts_plays_idx
    ON video_event_counts (plays DESC)
  `);

  // Monthly bucket of the same data so we can produce per-month CSV exports
  // without touching the rolling totals above. Month is stored as 'YYYY-MM'
  // in UTC for stable, timezone-independent grouping.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS video_event_counts_monthly (
      month text NOT NULL,
      video_id text NOT NULL,
      page text NOT NULL DEFAULT '/',
      impressions bigint NOT NULL DEFAULT 0,
      plays bigint NOT NULL DEFAULT 0,
      pauses bigint NOT NULL DEFAULT 0,
      q25 bigint NOT NULL DEFAULT 0,
      q50 bigint NOT NULL DEFAULT 0,
      q75 bigint NOT NULL DEFAULT 0,
      completes bigint NOT NULL DEFAULT 0,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (month, video_id, page)
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS video_event_counts_monthly_month_idx
    ON video_event_counts_monthly (month DESC)
  `);

  // Audit trail of every manual pin / unpin of a sermon as homepage hero.
  // Surfaced in the admin "Recent Hero Changes" feed so admins can see who
  // promoted what and when.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sermon_pin_audit (
      id           bigserial PRIMARY KEY,
      video_id     text NOT NULL,
      action       text NOT NULL CHECK (action IN ('pin','unpin')),
      title        text,
      actor_role   text NOT NULL,
      actor_ip     text,
      created_at   timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS sermon_pin_audit_created_idx
    ON sermon_pin_audit (created_at DESC)
  `);

  // ── Expo Mobile Push Tokens ─────────────────────────────────────────────────
  // Separate from push_subscriptions (WebPush/VAPID) because Expo tokens use
  // the Expo Push API, not the Web Push Protocol.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS expo_push_tokens (
      id          bigserial   PRIMARY KEY,
      token       text        NOT NULL UNIQUE,
      platform    text        NOT NULL DEFAULT 'unknown',
      device_id   text,
      is_active   boolean     NOT NULL DEFAULT true,
      created_at  timestamptz NOT NULL DEFAULT now(),
      updated_at  timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS expo_push_tokens_active_idx
    ON expo_push_tokens (is_active) WHERE is_active = true
  `);

  // ── Expo Push Receipts ───────────────────────────────────────────────────────
  // Stores ticket IDs returned by the Expo Push API so we can poll
  // https://exp.host/--/api/v2/push/getReceipts 15+ minutes later and confirm
  // delivery. DeviceNotRegistered errors trigger token deactivation.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS expo_push_receipts (
      id          bigserial   PRIMARY KEY,
      ticket_id   text        NOT NULL UNIQUE,
      token       text        NOT NULL,
      title       text,
      sent_at     timestamptz NOT NULL DEFAULT now(),
      checked_at  timestamptz,
      status      text        NOT NULL DEFAULT 'pending',
      error_code  text
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS expo_push_receipts_pending_idx
    ON expo_push_receipts (sent_at) WHERE status = 'pending'
  `);

  // ── Event Notification Queue ────────────────────────────────────────────────
  // FIFO work queue for the event-notification worker. The 30-min scheduler
  // ENQUEUES one row per (event × bucket × channel); the worker drains the
  // queue, performs the actual dispatch, and either marks the row completed,
  // schedules an exponential-backoff retry, or moves it to the dead-letter
  // queue once max_attempts is reached.
  //
  // The unique (event_id, bucket_key, channel) constraint is the dedup lock —
  // calling enqueue() repeatedly for the same slot is safe.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS event_notification_queue (
      id               bigserial   PRIMARY KEY,
      event_id         integer     NOT NULL,
      event_title      text        NOT NULL,
      bucket_key       text        NOT NULL,
      milestone_hours  integer     NOT NULL DEFAULT 0,
      channel          text        NOT NULL,
      kind             text        NOT NULL DEFAULT 'milestone',
      lead_label       text        NOT NULL DEFAULT '',
      status           text        NOT NULL DEFAULT 'pending',
      attempts         integer     NOT NULL DEFAULT 0,
      max_attempts     integer     NOT NULL DEFAULT 5,
      scheduled_at     timestamptz NOT NULL DEFAULT now(),
      claimed_at       timestamptz,
      completed_at     timestamptz,
      last_error       text,
      recipient_count  integer     NOT NULL DEFAULT 0,
      success_count    integer     NOT NULL DEFAULT 0,
      failure_count    integer     NOT NULL DEFAULT 0,
      created_at       timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT event_notif_queue_uniq UNIQUE (event_id, bucket_key, channel)
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS event_notif_queue_pending_idx
    ON event_notification_queue (scheduled_at) WHERE status = 'pending'
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS event_notif_queue_event_idx
    ON event_notification_queue (event_id)
  `);

  // ── Event Notification Dead-Letter Queue ────────────────────────────────────
  // Terminal failures land here after exhausting max_attempts. Admins can
  // requeue a row (resets attempts and re-inserts into the live queue) or
  // discard it (audit trail only).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS event_notification_dead_letter (
      id               bigserial   PRIMARY KEY,
      queue_id         bigint,
      event_id         integer     NOT NULL,
      event_title      text        NOT NULL,
      bucket_key       text        NOT NULL,
      milestone_hours  integer     NOT NULL DEFAULT 0,
      channel          text        NOT NULL,
      kind             text        NOT NULL DEFAULT 'milestone',
      lead_label       text        NOT NULL DEFAULT '',
      attempts         integer     NOT NULL DEFAULT 0,
      last_error       text,
      first_failed_at  timestamptz,
      moved_at         timestamptz NOT NULL DEFAULT now(),
      resolved_at      timestamptz,
      resolution       text
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS event_notif_dlq_unresolved_idx
    ON event_notification_dead_letter (moved_at DESC) WHERE resolved_at IS NULL
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS event_notif_dlq_event_idx
    ON event_notification_dead_letter (event_id)
  `);

  // ── Password reset tokens ────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id          serial PRIMARY KEY,
      member_id   integer NOT NULL REFERENCES member_auth(id) ON DELETE CASCADE,
      token       text    NOT NULL UNIQUE,
      expires_at  timestamptz NOT NULL,
      used_at     timestamptz,
      created_at  timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS password_reset_tokens_token_idx
    ON password_reset_tokens (token) WHERE used_at IS NULL
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS password_reset_tokens_member_idx
    ON password_reset_tokens (member_id, created_at DESC)
  `);

  // ── Uptime monitoring ─────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS server_heartbeats (
      id bigserial PRIMARY KEY,
      beat_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS server_heartbeats_beat_at_idx
    ON server_heartbeats (beat_at DESC)
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS server_downtime_events (
      id serial PRIMARY KEY,
      started_at  timestamptz NOT NULL,
      recovered_at timestamptz NOT NULL,
      downtime_ms bigint NOT NULL,
      alert_sent  boolean NOT NULL DEFAULT false
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS server_downtime_events_started_at_idx
    ON server_downtime_events (started_at DESC)
  `);

  // ── Auto-sync env-var passphrases to DB ─────────────────────────────────────
  // If ADMIN_PASSPHRASE_{ROLE} is set in the environment, hash it and persist
  // it to admin_credentials so the credential is durably stored after a reset.
  // This runs every startup but is idempotent: if the env var is absent the
  // row is left unchanged. Removing the env var after a successful login is
  // optional — the DB copy will be used from then on.
  {
    const { hashPassphrase } = await import("./adminAuth.js");
    const syncRoles = ["gallery", "sermon", "livestream"] as const;
    const envKeys: Record<typeof syncRoles[number], string> = {
      gallery:    "ADMIN_PASSPHRASE_GALLERY",
      sermon:     "ADMIN_PASSPHRASE_SERMON",
      livestream: "ADMIN_PASSPHRASE_LIVESTREAM",
    };
    for (const role of syncRoles) {
      const plain = process.env[envKeys[role]]?.trim();
      if (plain && plain.length >= 8) {
        const hash = hashPassphrase(plain);
        await pool.query(
          `INSERT INTO admin_credentials (role, passphrase_hash, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (role) DO UPDATE SET passphrase_hash = $2, updated_at = NOW()`,
          [role, hash],
        );
        logger.warn(
          { role },
          `Admin passphrase for "${role}" synced from env var ADMIN_PASSPHRASE_${role.toUpperCase()} → DB. ` +
          `Remove the env var once you have logged in and changed the passphrase via the UI.`,
        );
      }
    }
  }

  // ── Blog engagement columns ──────────────────────────────────────────────────
  await pool.query(`ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS bookmark_count integer NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS share_count integer NOT NULL DEFAULT 0`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS blog_bookmarks (
      id serial PRIMARY KEY,
      slug text NOT NULL,
      visitor_id text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (slug, visitor_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS blog_likes (
      id serial PRIMARY KEY,
      slug text NOT NULL,
      visitor_id text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (slug, visitor_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS blog_reading_progress (
      id serial PRIMARY KEY,
      slug text NOT NULL,
      visitor_id text NOT NULL,
      progress_pct integer NOT NULL DEFAULT 0,
      completed boolean NOT NULL DEFAULT false,
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (slug, visitor_id)
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS blog_posts_view_count_idx ON blog_posts (view_count DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS blog_posts_like_count_idx ON blog_posts (like_count DESC)`);

  logger.info("All migrations complete");
}

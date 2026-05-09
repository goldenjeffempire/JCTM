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
  // ── Drizzle-managed base tables (must exist before ALTER TABLE statements) ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sermon_data (
      id serial PRIMARY KEY,
      video_id text NOT NULL UNIQUE,
      title text NOT NULL,
      thumbnail_url text NOT NULL,
      description text,
      published_at timestamptz NOT NULL,
      view_count integer,
      duration text,
      is_featured boolean NOT NULL DEFAULT false,
      is_live boolean NOT NULL DEFAULT false,
      broadcast_ended_at timestamptz,
      pinned_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS member_auth (
      id serial PRIMARY KEY,
      email text NOT NULL UNIQUE,
      first_name text NOT NULL,
      last_name text NOT NULL,
      password_hash text NOT NULL,
      token text UNIQUE,
      phone text,
      role text NOT NULL DEFAULT 'member',
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS member_directory (
      id serial PRIMARY KEY,
      first_name text NOT NULL,
      last_name text NOT NULL,
      email text,
      phone text,
      role text NOT NULL DEFAULT 'member',
      department text,
      avatar_url text,
      bio text,
      joined_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS testimonies (
      id serial PRIMARY KEY,
      name text NOT NULL,
      email text,
      title text,
      content text NOT NULL,
      video_url text,
      category text,
      approved boolean NOT NULL DEFAULT false,
      like_count integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS giving_logs (
      id serial PRIMARY KEY,
      donor_name text,
      donor_email text,
      amount real NOT NULL,
      currency text NOT NULL DEFAULT 'NGN',
      purpose text,
      reference text NOT NULL UNIQUE,
      status text NOT NULL DEFAULT 'pending',
      payment_method text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS event_calendar (
      id serial PRIMARY KEY,
      title text NOT NULL,
      description text,
      start_date timestamptz NOT NULL,
      end_date timestamptz,
      location text,
      event_type text NOT NULL DEFAULT 'service',
      image_url text,
      youtube_url text,
      created_at timestamptz NOT NULL DEFAULT now(),
      notification_enabled boolean NOT NULL DEFAULT true,
      notification_milestones integer[],
      notification_pulse_minutes integer,
      notification_pulse_window_hours integer,
      notification_paused_until timestamptz
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id serial PRIMARY KEY,
      title text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id serial PRIMARY KEY,
      conversation_id integer NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role text NOT NULL,
      content text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS knowledge_chunks (
      id serial PRIMARY KEY,
      content text NOT NULL,
      source text NOT NULL,
      chunk_index integer NOT NULL DEFAULT 0,
      embedding vector(384),
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gallery_images (
      id serial PRIMARY KEY,
      title text NOT NULL DEFAULT '',
      description text,
      object_path text NOT NULL,
      thumbnail_path text,
      category text NOT NULL DEFAULT 'service',
      service_date text,
      alt_text text,
      is_published boolean NOT NULL DEFAULT true,
      is_featured boolean NOT NULL DEFAULT false,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);

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

  // NOTE: search_knowledge_chunks is created/upgraded below with the full
  // return type (including chunk_type). No earlier CREATE OR REPLACE here
  // to avoid "cannot change return type of existing function" errors.

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
  await pool.query(`ALTER TABLE devotion_subscribers ADD COLUMN IF NOT EXISTS name text`);

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

  // ── Ad page-view tracking ────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ad_page_views (
      id          serial      PRIMARY KEY,
      page        text        NOT NULL DEFAULT '/',
      referrer    text        NOT NULL DEFAULT '',
      visitor_id  text        NOT NULL DEFAULT '',
      session_id  text        NOT NULL DEFAULT '',
      ad_slots_in_view integer NOT NULL DEFAULT 0,
      consent_level text      NOT NULL DEFAULT 'pending',
      recorded_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS ad_page_views_recorded_at_idx ON ad_page_views (recorded_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ad_page_views_page_idx ON ad_page_views (page, recorded_at DESC)`);

  // ── Partnership / sponsorship inquiries ──────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sponsorship_inquiries (
      id           serial      PRIMARY KEY,
      name         text        NOT NULL,
      email        text        NOT NULL,
      organization text        NOT NULL DEFAULT '',
      tier         text        NOT NULL,
      message      text        NOT NULL DEFAULT '',
      status       text        NOT NULL DEFAULT 'new',
      created_at   timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS sponsorship_inquiries_status_idx ON sponsorship_inquiries (status, created_at DESC)`);

  // ── Conference Email Campaigns ────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS conference_campaigns (
      id               serial      PRIMARY KEY,
      campaign_key     text        NOT NULL UNIQUE,
      conference_title text        NOT NULL,
      status           text        NOT NULL DEFAULT 'pending',
      total_recipients integer     NOT NULL DEFAULT 0,
      sent             integer     NOT NULL DEFAULT 0,
      failed           integer     NOT NULL DEFAULT 0,
      skipped          integer     NOT NULL DEFAULT 0,
      started_at       timestamptz,
      completed_at     timestamptz,
      error            text,
      created_at       timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS conference_campaigns_status_idx ON conference_campaigns (status, created_at DESC)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS conference_campaign_recipients (
      id             serial      PRIMARY KEY,
      campaign_id    integer     NOT NULL REFERENCES conference_campaigns(id) ON DELETE CASCADE,
      email          text        NOT NULL,
      recipient_name text,
      source         text        NOT NULL DEFAULT 'unknown',
      status         text        NOT NULL DEFAULT 'pending',
      attempts       integer     NOT NULL DEFAULT 0,
      sent_at        timestamptz,
      error          text,
      created_at     timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS ccr_campaign_status_idx ON conference_campaign_recipients (campaign_id, status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ccr_pending_idx ON conference_campaign_recipients (campaign_id, id ASC) WHERE status = 'pending'`);

  // ── Email send log — tracks every outbound email for delivery analytics ──────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_send_log (
      id             serial      PRIMARY KEY,
      email_type     text        NOT NULL,
      recipient_email text       NOT NULL,
      campaign_key   text,
      status         text        NOT NULL DEFAULT 'sent',
      error          text,
      sent_at        timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS email_send_log_type_idx     ON email_send_log (email_type, sent_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS email_send_log_campaign_idx ON email_send_log (campaign_key, sent_at DESC) WHERE campaign_key IS NOT NULL`);

  // ── Global email opt-out list — checked by all campaign workers ───────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_unsubscribes (
      id               serial      PRIMARY KEY,
      email            text        NOT NULL UNIQUE,
      source           text        NOT NULL DEFAULT 'campaign',
      unsubscribed_at  timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS email_unsubscribes_email_idx ON email_unsubscribes (email)`);

  // ── AI Interaction Log — telemetry for every TempleBots query ────────────────
  // Tracks query, tier, latency, intent, source chunk count, and cache hits
  // for performance monitoring and quality improvement.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_interactions (
      id               serial      PRIMARY KEY,
      session_id       text,
      query            text        NOT NULL,
      query_length     integer     NOT NULL DEFAULT 0,
      intent           text,
      tier             text        NOT NULL DEFAULT 'local',
      latency_ms       integer,
      source_chunks    integer     NOT NULL DEFAULT 0,
      cache_hit        boolean     NOT NULL DEFAULT false,
      openai_used      boolean     NOT NULL DEFAULT false,
      sentiment        text,
      language         text        NOT NULL DEFAULT 'en',
      action_triggered text,
      error            boolean     NOT NULL DEFAULT false,
      created_at       timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS ai_interactions_created_idx ON ai_interactions (created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ai_interactions_tier_idx    ON ai_interactions (tier, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ai_interactions_intent_idx  ON ai_interactions (intent, created_at DESC) WHERE intent IS NOT NULL`);

  // ── Knowledge Sync Log — tracks when each content type was last synced ────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS knowledge_sync_log (
      id           serial      PRIMARY KEY,
      content_type text        NOT NULL,
      chunks_added integer     NOT NULL DEFAULT 0,
      duration_ms  integer,
      success      boolean     NOT NULL DEFAULT true,
      error        text,
      synced_at    timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS ksl_content_type_idx ON knowledge_sync_log (content_type, synced_at DESC)`);

  // ── knowledge_chunks: metadata columns for RAG quality & observability ─────
  await pool.query(`ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS chunk_type text NOT NULL DEFAULT 'general'`);
  await pool.query(`ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS metadata jsonb`);
  await pool.query(`ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now()`);
  await pool.query(`CREATE INDEX IF NOT EXISTS knowledge_chunks_chunk_type_idx ON knowledge_chunks (chunk_type)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS knowledge_chunks_source_idx    ON knowledge_chunks (source)`);

  // ── sermon_data: transcript pipeline columns ─────────────────────────────
  await pool.query(`ALTER TABLE sermon_data ADD COLUMN IF NOT EXISTS transcript text`);
  await pool.query(`ALTER TABLE sermon_data ADD COLUMN IF NOT EXISTS transcript_status text NOT NULL DEFAULT 'none'`);
  await pool.query(`ALTER TABLE sermon_data ADD COLUMN IF NOT EXISTS transcript_source text`);
  await pool.query(`CREATE INDEX IF NOT EXISTS sermon_data_transcript_idx ON sermon_data (transcript_status, published_at DESC)`);

  // ── Upgraded pgvector similarity search function (returns chunk_type) ─────
  // DROP IF EXISTS first because we changed the return type (added chunk_type);
  // CREATE OR REPLACE fails when the return row type changes.
  try {
    await pool.query(`DROP FUNCTION IF EXISTS search_knowledge_chunks(vector, integer) CASCADE`);
    await pool.query(`
      CREATE FUNCTION search_knowledge_chunks(
        query_embedding vector(384),
        match_count integer DEFAULT 15
      )
      RETURNS TABLE (
        id integer,
        content text,
        source text,
        chunk_type text,
        similarity float
      )
      LANGUAGE sql STABLE
      AS $$
        SELECT id, content, source, chunk_type,
               1 - (embedding <=> query_embedding) AS similarity
        FROM knowledge_chunks
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> query_embedding
        LIMIT match_count;
      $$
    `);
    logger.info("Upgraded pgvector similarity search function (with chunk_type)");
  } catch (fnErr) {
    logger.warn({ err: fnErr }, "Could not upgrade pgvector search function (non-fatal)");
  }

  // ── Unified subscriber registry (single source of truth for all email sends) ─
  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscribers (
      id               serial      PRIMARY KEY,
      email            text        NOT NULL UNIQUE,
      name             text,
      is_active        boolean     NOT NULL DEFAULT true,
      unsubscribe_token text       NOT NULL UNIQUE,
      source           text        NOT NULL DEFAULT 'manual',
      subscribed_at    timestamptz NOT NULL DEFAULT now(),
      unsubscribed_at  timestamptz,
      last_sent_at     timestamptz,
      last_email_type  text,
      total_sent       integer     NOT NULL DEFAULT 0,
      total_failed     integer     NOT NULL DEFAULT 0,
      updated_at       timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS subscribers_active_idx        ON subscribers (is_active) WHERE is_active = true`);
  await pool.query(`CREATE INDEX IF NOT EXISTS subscribers_email_idx         ON subscribers (lower(trim(email)))`);
  await pool.query(`CREATE INDEX IF NOT EXISTS subscribers_source_idx        ON subscribers (source, subscribed_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS subscribers_last_sent_idx     ON subscribers (last_sent_at DESC) WHERE last_sent_at IS NOT NULL`);
  await pool.query(`CREATE INDEX IF NOT EXISTS subscribers_subscribed_at_idx ON subscribers (subscribed_at DESC)`);

  // ── Per-recipient delivery tracking for every outbound email ─────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_delivery_log (
      id            bigserial   PRIMARY KEY,
      subscriber_id integer     REFERENCES subscribers(id) ON DELETE SET NULL,
      email         text        NOT NULL,
      email_type    text        NOT NULL,
      campaign_key  text,
      status        text        NOT NULL DEFAULT 'sent',
      message_id    text,
      error         text,
      attempts      integer     NOT NULL DEFAULT 1,
      sent_at       timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS edl_email_type_idx    ON email_delivery_log (email_type, sent_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS edl_subscriber_idx    ON email_delivery_log (subscriber_id, sent_at DESC) WHERE subscriber_id IS NOT NULL`);
  await pool.query(`CREATE INDEX IF NOT EXISTS edl_campaign_key_idx  ON email_delivery_log (campaign_key, sent_at DESC) WHERE campaign_key IS NOT NULL`);
  await pool.query(`CREATE INDEX IF NOT EXISTS edl_status_idx        ON email_delivery_log (status, sent_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS edl_email_date_idx    ON email_delivery_log (lower(email), email_type, sent_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS edl_dedup_idx         ON email_delivery_log (subscriber_id, email_type, sent_at) WHERE status = 'sent'`);

  // ── Persistent AI User Memory ─────────────────────────────────────────────────
  // Cross-session memory store for TempleBots — persists name, prayer needs,
  // spiritual maturity, topics of interest, and key personal insights across
  // multiple conversations. Keyed by session_fingerprint (anonymous) or member_id.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_ai_memory (
      id                  serial       PRIMARY KEY,
      session_fingerprint text         NOT NULL UNIQUE,
      member_id           integer      REFERENCES member_auth(id) ON DELETE SET NULL,
      detected_name       text,
      prayer_needs        text[]       NOT NULL DEFAULT '{}',
      topics_of_interest  text[]       NOT NULL DEFAULT '{}',
      spiritual_maturity  text         NOT NULL DEFAULT 'seeker',
      key_insights        text[]       NOT NULL DEFAULT '{}',
      message_count       integer      NOT NULL DEFAULT 0,
      conversation_count  integer      NOT NULL DEFAULT 0,
      last_active_at      timestamptz  NOT NULL DEFAULT now(),
      created_at          timestamptz  NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS uam_member_id_idx      ON user_ai_memory (member_id) WHERE member_id IS NOT NULL`);
  await pool.query(`CREATE INDEX IF NOT EXISTS uam_last_active_idx    ON user_ai_memory (last_active_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS uam_maturity_idx       ON user_ai_memory (spiritual_maturity)`);

  // ── Bible verses database (NKJV — public domain) ────────────────────────────
  // Stores key Bible verses with full-text search index for the TempleBots
  // Bible-aware RAG pipeline and the /api/bible/* endpoints.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bible_verses (
      id          serial      PRIMARY KEY,
      book        text        NOT NULL,
      book_abbrev text        NOT NULL,
      testament   text        NOT NULL DEFAULT 'OT',
      chapter     integer     NOT NULL,
      verse       integer     NOT NULL,
      text        text        NOT NULL,
      UNIQUE(book_abbrev, chapter, verse)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS bible_verses_book_chapter_idx ON bible_verses(book_abbrev, chapter)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS bible_verses_ref_idx          ON bible_verses(book_abbrev, chapter, verse)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS bible_verses_testament_idx    ON bible_verses(testament)`);
  try {
    await pool.query(`CREATE INDEX IF NOT EXISTS bible_verses_fts_idx ON bible_verses USING gin(to_tsvector('english', text))`);
  } catch {
    // GIN index may fail if pg_trgm unavailable — non-fatal, ILIKE fallback active
  }

  // ── Ministers Conference Day 2 — upsert event_promotions for Day 2 window ────
  // INSERT if no row exists yet (fresh DB); UPDATE to Day 2 if Day 1 row found.
  // Idempotent: WHERE clause prevents re-updating a row already on Day 2+.
  // Resets push_sent_at = NULL so the 8 AM live-transition push fires today.
  await pool.query(`
    INSERT INTO event_promotions (
      slug, title, subtitle, location,
      cta_text, cta_url,
      start_at, end_at, status,
      show_banner, show_popup, show_sticky_bar,
      broadcast_enabled, broadcast_cadence, broadcast_messages,
      created_at, updated_at
    ) VALUES (
      'ministers-conference-2026',
      'Ministers Conference Day 2 — Apostolic Fire',
      'Starting at 8:00 AM WAT — JCTM Auditorium, Ebrumede Roundabout',
      'JCTM Auditorium, Ebrumede Roundabout',
      'Join Day 2',
      '/livestream',
      '2026-05-09T07:00:00Z',
      '2026-05-10T20:00:00Z',
      'active',
      true, true, true,
      true, 'hourly', '[]'::jsonb,
      now(), now()
    )
    ON CONFLICT (slug) DO UPDATE SET
      title             = EXCLUDED.title,
      subtitle          = EXCLUDED.subtitle,
      cta_text          = EXCLUDED.cta_text,
      cta_url           = EXCLUDED.cta_url,
      start_at          = EXCLUDED.start_at,
      push_sent_at      = NULL,
      broadcast_enabled = true,
      broadcast_cadence = 'hourly',
      updated_at        = now()
    WHERE event_promotions.start_at < EXCLUDED.start_at
  `);

  // ── Media download jobs ───────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS media_download_jobs (
      id            TEXT PRIMARY KEY,
      type          TEXT NOT NULL,
      source_id     TEXT NOT NULL,
      format        TEXT NOT NULL DEFAULT 'mp3',
      quality       TEXT NOT NULL DEFAULT 'high',
      status        TEXT NOT NULL DEFAULT 'queued',
      progress      INTEGER NOT NULL DEFAULT 0,
      error         TEXT,
      output_path   TEXT,
      title         TEXT,
      duration      INTEGER,
      file_size     BIGINT,
      thumbnail_url TEXT,
      created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      expires_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '24 hours')
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_media_jobs_expires ON media_download_jobs (expires_at)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_media_jobs_status ON media_download_jobs (status, created_at DESC)
  `);

  // ── Seed sample approved testimonies (only if table is empty) ────────────────
  await pool.query(`
    INSERT INTO testimonies (name, title, content, category, approved, like_count, created_at)
    SELECT * FROM (VALUES
      (
        'Blessing O.',
        'Healed from a Chronic Condition',
        'I had been suffering from a severe back condition for three years. The doctors said I needed surgery. But after a prayer session during the JCTM Sunday service, I felt the pain leave my body completely. I went back for a scan and the doctors were amazed — there was no trace of the condition. Jesus Christ is truly the Healer. Glory to God through this ministry.',
        'healing',
        true,
        12,
        now() - interval '14 days'
      ),
      (
        'Emeka F.',
        'Restored from Financial Ruin',
        'I lost my business and was in serious debt. I came across JCTM teachings on YouTube and began applying the word to my life. Within six months, God restored everything and opened a door for a contract that cleared all my debts. I am living proof that God is a provider. Thank you Prophet Amos for teaching us to trust God completely.',
        'provision',
        true,
        9,
        now() - interval '21 days'
      ),
      (
        'Sister Grace A.',
        'Saved and Delivered from a Broken Life',
        'I was living a life far from God — addiction, broken relationships, and deep depression. A friend shared a JCTM sermon with me. That message broke me. I gave my life to Christ, and over the following months, every chain fell off. My family was restored. My mind was healed. I am a new creation.',
        'salvation',
        true,
        18,
        now() - interval '7 days'
      ),
      (
        'Brother Daniel K.',
        'Marriage Restored Against All Odds',
        'My wife and I were on the verge of divorce. We had tried counselling with no result. We began watching JCTM services online and praying together. The word of God rebuilt the foundation of our marriage. Today we are stronger than ever. Do not give up on your family — God restores what the enemy tries to steal.',
        'family',
        true,
        14,
        now() - interval '30 days'
      ),
      (
        'Ngozi M.',
        'Child Delivered from a Life-Threatening Illness',
        'My three-year-old daughter was admitted to the hospital with a diagnosis that terrified us. The doctors gave us very little hope. Our JCTM prayer group interceded for 72 hours. On the third day, the fever broke and the test results came back clear. The medical team called it unexplainable. We call it a miracle. God is faithful.',
        'healing',
        true,
        21,
        now() - interval '45 days'
      )
    ) AS v(name, title, content, category, approved, like_count, created_at)
    WHERE NOT EXISTS (SELECT 1 FROM testimonies WHERE approved = true LIMIT 1)
  `);

  logger.info("All migrations complete");
}

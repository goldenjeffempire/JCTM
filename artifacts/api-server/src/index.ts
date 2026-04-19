import app from "./app";
import { logger } from "./lib/logger";
import { startCron, setWebSubCallbackUrl, stopCron } from "./lib/cron.js";
import { altarSimInterval } from "./routes/altar.js";
import { subscribeToWebSub } from "./lib/youtube-sync.js";
import { ingestKnowledgeIfEmpty } from "./lib/knowledge-ingestion.js";
import { initSentry } from "./lib/sentry.js";
import { initVapidKeys } from "./lib/push-manager.js";
import { isRoleConfigured, type AdminRole } from "./lib/adminAuth.js";
import { seedMinistryBlogLibrary } from "./lib/ministry-blog-seed.js";
import { pool } from "@workspace/db";
import OpenAI from "openai";

async function runStartupMigrations() {
  try {
    // ── Core tables ──────────────────────────────────────────────────────────
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
    await pool.query(`
      ALTER TABLE moment_comments ADD COLUMN IF NOT EXISTS yt_comment_id text
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS moment_engagements (
        id serial PRIMARY KEY,
        video_id text NOT NULL UNIQUE,
        yt_engagement_comment_id text,
        share_count integer NOT NULL DEFAULT 0,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    // ── pgvector extension + similarity index ────────────────────────────────
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

    // ── Admin RBAC: role column on member_auth ───────────────────────────────
    await pool.query(`
      ALTER TABLE member_auth ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member'
    `);

    // ── Knowledge chunks unique constraint for sermon UPSERT support ─────────
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

    // ── AI Feedback Loop table ───────────────────────────────────────────────
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

    // ── SEO Blog Posts table ─────────────────────────────────────────────────
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
    await pool.query(`ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS category text`);
    await pool.query(`ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS tags text[]`);
    await pool.query(`ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS author text NOT NULL DEFAULT 'Jesus Christ Temple Ministry'`);
    await pool.query(`ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS read_time_minutes integer NOT NULL DEFAULT 5`);
    await pool.query(`ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false`);
    await pool.query(`ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS seo_title text`);
    await pool.query(`ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS seo_description text`);

    // ── Push dispatch log ────────────────────────────────────────────────────
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

    // ── Sermon transcript indexing ───────────────────────────────────────────
    await pool.query(`
      ALTER TABLE sermon_data ADD COLUMN IF NOT EXISTS transcript_summary text
    `);
    await pool.query(`
      ALTER TABLE sermon_data ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now()
    `);

    // ── Rebroadcast: track when a live stream ends ────────────────────────────
    await pool.query(`
      ALTER TABLE sermon_data ADD COLUMN IF NOT EXISTS broadcast_ended_at timestamptz
    `);

    // ── Community Prayer Wall ────────────────────────────────────────────────
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

    // ── pgvector cosine similarity search function ───────────────────────────
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

    // ── Sermon AI metadata enrichment columns ────────────────────────────────
    await pool.query(`
      ALTER TABLE sermon_data ADD COLUMN IF NOT EXISTS ai_summary text
    `);
    await pool.query(`
      ALTER TABLE sermon_data ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'
    `);
    await pool.query(`
      ALTER TABLE sermon_data ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'sermon'
    `);
    await pool.query(`
      ALTER TABLE sermon_data ADD COLUMN IF NOT EXISTS metadata_generated_at timestamptz
    `);

    // ── Admin credentials (DB-backed passphrases, survive deployments) ──────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_credentials (
        role TEXT PRIMARY KEY,
        passphrase_hash TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // ── Gallery thumbnail_path column ────────────────────────────────────────
    await pool.query(`
      ALTER TABLE gallery_images ADD COLUMN IF NOT EXISTS thumbnail_path text
    `);

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

    // ── Push Notification Subscriptions ──────────────────────────────────────
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

    // ── Broadcast Event History ───────────────────────────────────────────────
    // One row per broadcast sent (live start, rebroadcast start) — used for
    // re-engagement: visitors who missed a live event see a notification on revisit.
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

    // ── Ministers Conference Registrations ───────────────────────────────────
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

    // ── Performance indexes ──────────────────────────────────────────────────
    // Members — search by name/department
    await pool.query(`
      CREATE INDEX IF NOT EXISTS member_directory_first_name_idx
      ON member_directory (lower(first_name) text_pattern_ops)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS member_directory_last_name_idx
      ON member_directory (lower(last_name) text_pattern_ops)
    `);
    // Sermon — common sort/filter
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
    // Prayer requests — public wall query
    await pool.query(`
      CREATE INDEX IF NOT EXISTS prayer_requests_public_idx
      ON prayer_requests (created_at DESC)
      WHERE is_public = true
    `);
    // Testimonies — approved feed
    await pool.query(`
      CREATE INDEX IF NOT EXISTS testimonies_approved_idx
      ON testimonies (created_at DESC)
      WHERE approved = true
    `);
    // Giving logs — reference lookups and admin reports
    await pool.query(`
      CREATE INDEX IF NOT EXISTS giving_logs_reference_idx
      ON giving_logs (reference)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS giving_logs_status_idx
      ON giving_logs (status, created_at DESC)
    `);
    // Push subscriptions — active subscriber lookups
    await pool.query(`
      CREATE INDEX IF NOT EXISTS push_subscriptions_visitor_idx
      ON push_subscriptions (visitor_id)
      WHERE is_active = true
    `);

    logger.info("Startup migrations complete");
  } catch (err) {
    logger.error({ err }, "Startup migration failed — continuing anyway");
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

await initSentry();
await runStartupMigrations();
await seedMinistryBlogLibrary();

const server = app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  // Keep connections alive longer than the 60 s timeout used by most
  // load balancers / reverse proxies (Render, Replit, Cloudflare).
  server.keepAliveTimeout = 65_000;
  server.headersTimeout   = 66_000;

  logger.info({ port }, "Server listening");

  // ── Admin passphrase config check ────────────────────────────────────────
  const adminRoles: AdminRole[] = ["gallery", "sermon", "livestream"];
  const configuredFlags = await Promise.all(adminRoles.map((r) => isRoleConfigured(r)));
  const configured   = adminRoles.filter((_, i) => configuredFlags[i]);
  const unconfigured = adminRoles.filter((_, i) => !configuredFlags[i]);
  if (unconfigured.length > 0) {
    logger.warn(
      { unconfiguredRoles: unconfigured, configuredRoles: configured },
      "Some admin roles have no passphrase configured — " +
      "use the Setup Admin Access form on the site to create credentials, " +
      "or set ADMIN_PASSPHRASE_* env vars in the Render dashboard.",
    );
  } else {
    logger.info({ configured }, "All admin roles configured");
  }

  // Initialize VAPID keys for push notifications
  initVapidKeys(logger);

  // Start the 30-minute YouTube sync cron
  startCron(logger);

  // Resolve public base URL for WebSub callback
  const replitDomain = process.env.REPLIT_DEV_DOMAIN;
  const renderUrl = process.env.RENDER_EXTERNAL_URL;
  const publicUrl = process.env.PUBLIC_URL;

  let callbackBase: string;
  if (replitDomain) {
    callbackBase = `https://${replitDomain}`;
  } else if (renderUrl) {
    callbackBase = renderUrl.replace(/\/$/, "");
  } else if (publicUrl) {
    callbackBase = publicUrl.replace(/\/$/, "");
  } else {
    callbackBase = "https://jctm.org.ng";
  }

  const websubCallback = `${callbackBase}/api/sermons/websub`;
  setWebSubCallbackUrl(websubCallback);
  subscribeToWebSub(websubCallback, logger);

  // ── Populate JCTM knowledge base into pgvector store (non-blocking) ──────────
  // Uses the direct OPENAI_API_KEY (not the Replit proxy) because the embeddings
  // API is not available through the Replit AI Integrations proxy.
  const openAiApiKey = process.env.OPENAI_API_KEY;
  if (openAiApiKey) {
    const embeddingsClient = new OpenAI({
      apiKey: openAiApiKey,
      baseURL: "https://api.openai.com/v1",
    });
    ingestKnowledgeIfEmpty(embeddingsClient, logger).catch((err) => {
      logger.warn({ err }, "Knowledge ingestion failed at startup — TempleBots will fall back to inline knowledge base");
    });
  } else {
    logger.warn("OPENAI_API_KEY not set — skipping knowledge base ingestion. TempleBots will use inline knowledge base only.");
  }
});

// ── Graceful shutdown ─────────────────────────────────────────────────────
let isShuttingDown = false;

function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info({ signal }, "Graceful shutdown initiated");
  stopCron();
  clearInterval(altarSimInterval);

  server.close(async () => {
    try {
      await pool.end();
      logger.info("All connections closed — exiting cleanly");
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "Failed to close database pool during shutdown");
      process.exit(1);
    }
  });

  setTimeout(() => {
    logger.warn("Shutdown timeout reached — forcing exit");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
process.on("unhandledRejection", (err) => {
  logger.error({ err }, "Unhandled promise rejection");
});
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception");
  shutdown("uncaughtException");
});

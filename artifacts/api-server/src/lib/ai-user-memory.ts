/**
 * AI User Memory — JCTM TempleBots v4
 *
 * Persists cross-session user context in PostgreSQL so TempleBots remembers
 * each user's name, prayer needs, spiritual journey, and topics of interest
 * across conversations — not just within a single browser session.
 *
 * Memory is keyed by session_fingerprint (anonymous users) or member_id
 * (authenticated users). All writes are fire-and-forget (non-blocking).
 * Zero PII beyond what the user explicitly shares in chat.
 */

import pg from "pg";
const { Pool } = pg;

function normalizeDbUrl(url: string): string {
  return url.replace(
    /([?&])sslmode=(prefer|require|verify-ca)(&|$)/g,
    (_m, prefix, _mode, suffix) => `${prefix}sslmode=verify-full${suffix}`,
  );
}

const pool = new Pool({ connectionString: normalizeDbUrl(process.env.DATABASE_URL ?? "") });

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserMemory {
  id: number;
  sessionFingerprint: string;
  memberId: number | null;
  detectedName: string | null;
  prayerNeeds: string[];            // Last 5 prayer needs extracted from conversation
  topicsOfInterest: string[];       // Recurring topics (from personalization engine)
  spiritualMaturity: string;        // "seeker" | "new_believer" | "growing" | "mature"
  keyInsights: string[];            // Things user revealed about themselves
  messageCount: number;             // Total messages across all sessions
  conversationCount: number;        // Number of distinct sessions
  lastActiveAt: Date;
  createdAt: Date;
}

export interface MemoryContext {
  hasMemory: boolean;
  greeting: string | null;         // Personalized greeting if returning user
  contextBlock: string;            // Formatted text block for system prompt injection
  memory: UserMemory | null;
}

// ─── Load Memory ──────────────────────────────────────────────────────────────

export async function loadUserMemory(
  sessionFingerprint: string,
  memberId?: number | null,
): Promise<UserMemory | null> {
  try {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (memberId) {
      conditions.push(`member_id = $${params.length + 1}`);
      params.push(memberId);
    } else {
      conditions.push(`session_fingerprint = $${params.length + 1}`);
      params.push(sessionFingerprint);
    }

    const result = await pool.query<{
      id: number;
      session_fingerprint: string;
      member_id: number | null;
      detected_name: string | null;
      prayer_needs: string[];
      topics_of_interest: string[];
      spiritual_maturity: string;
      key_insights: string[];
      message_count: number;
      conversation_count: number;
      last_active_at: Date;
      created_at: Date;
    }>(
      `SELECT * FROM user_ai_memory WHERE ${conditions.join(" OR ")} LIMIT 1`,
      params,
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      id: row.id,
      sessionFingerprint: row.session_fingerprint,
      memberId: row.member_id,
      detectedName: row.detected_name,
      prayerNeeds: Array.isArray(row.prayer_needs) ? row.prayer_needs : [],
      topicsOfInterest: Array.isArray(row.topics_of_interest) ? row.topics_of_interest : [],
      spiritualMaturity: row.spiritual_maturity ?? "seeker",
      keyInsights: Array.isArray(row.key_insights) ? row.key_insights : [],
      messageCount: row.message_count ?? 0,
      conversationCount: row.conversation_count ?? 0,
      lastActiveAt: row.last_active_at,
      createdAt: row.created_at,
    };
  } catch {
    return null;
  }
}

// ─── Update Memory ────────────────────────────────────────────────────────────
// Upserts memory from the current session's personalization profile.

export interface MemoryUpdatePayload {
  sessionFingerprint: string;
  memberId?: number | null;
  detectedName?: string | null;
  newPrayerNeed?: string | null;
  topicsOfInterest?: string[];
  spiritualMaturity?: string;
  newKeyInsight?: string | null;
  incrementMessages?: boolean;
  newConversation?: boolean;
}

export async function updateUserMemory(payload: MemoryUpdatePayload): Promise<void> {
  try {
    const existing = await loadUserMemory(payload.sessionFingerprint, payload.memberId ?? null);

    if (!existing) {
      // First-time upsert
      const prayerNeeds = payload.newPrayerNeed ? [payload.newPrayerNeed] : [];
      const keyInsights = payload.newKeyInsight ? [payload.newKeyInsight] : [];
      await pool.query(
        `INSERT INTO user_ai_memory
           (session_fingerprint, member_id, detected_name, prayer_needs, topics_of_interest,
            spiritual_maturity, key_insights, message_count, conversation_count, last_active_at)
         VALUES ($1,$2,$3,$4::text[],$5::text[],$6,$7::text[],$8,$9,now())
         ON CONFLICT (session_fingerprint) DO NOTHING`,
        [
          payload.sessionFingerprint,
          payload.memberId ?? null,
          payload.detectedName ?? null,
          prayerNeeds,
          payload.topicsOfInterest ?? [],
          payload.spiritualMaturity ?? "seeker",
          keyInsights,
          payload.incrementMessages ? 1 : 0,
          payload.newConversation ? 1 : 0,
        ],
      );
      return;
    }

    // Merge updates
    const updates: string[] = ["last_active_at = now()"];
    const params: unknown[] = [];
    let pIdx = 1;

    if (payload.detectedName && !existing.detectedName) {
      updates.push(`detected_name = $${pIdx++}`);
      params.push(payload.detectedName);
    }

    if (payload.spiritualMaturity && payload.spiritualMaturity !== existing.spiritualMaturity) {
      updates.push(`spiritual_maturity = $${pIdx++}`);
      params.push(payload.spiritualMaturity);
    }

    if (payload.topicsOfInterest && payload.topicsOfInterest.length > 0) {
      const merged = Array.from(new Set([
        ...existing.topicsOfInterest,
        ...payload.topicsOfInterest,
      ])).slice(0, 10);
      updates.push(`topics_of_interest = $${pIdx++}::text[]`);
      params.push(merged);
    }

    if (payload.newPrayerNeed) {
      const merged = [payload.newPrayerNeed, ...existing.prayerNeeds].slice(0, 5);
      updates.push(`prayer_needs = $${pIdx++}::text[]`);
      params.push(merged);
    }

    if (payload.newKeyInsight && !existing.keyInsights.includes(payload.newKeyInsight)) {
      const merged = [payload.newKeyInsight, ...existing.keyInsights].slice(0, 8);
      updates.push(`key_insights = $${pIdx++}::text[]`);
      params.push(merged);
    }

    if (payload.incrementMessages) {
      updates.push(`message_count = message_count + 1`);
    }

    if (payload.newConversation) {
      updates.push(`conversation_count = conversation_count + 1`);
    }

    if (payload.memberId && !existing.memberId) {
      updates.push(`member_id = $${pIdx++}`);
      params.push(payload.memberId);
    }

    params.push(existing.id);
    await pool.query(
      `UPDATE user_ai_memory SET ${updates.join(", ")} WHERE id = $${pIdx}`,
      params,
    );
  } catch {
    // Non-critical — never block a response for memory writes
  }
}

// ─── Build Memory Context for System Prompt ───────────────────────────────────

export function buildMemoryContext(memory: UserMemory | null): MemoryContext {
  if (!memory) return { hasMemory: false, greeting: null, contextBlock: "", memory: null };

  const parts: string[] = [];

  const name = memory.detectedName;
  const isReturning = memory.conversationCount > 1;

  let greeting: string | null = null;
  if (isReturning && name) {
    greeting = `Welcome back, ${name}! It's wonderful to have you here again.`;
  } else if (name) {
    greeting = null; // Don't greet on first conversation — feels unnatural
  }

  if (name) parts.push(`USER'S NAME: ${name} — address them by name naturally`);
  if (memory.spiritualMaturity && memory.spiritualMaturity !== "seeker") {
    parts.push(`SPIRITUAL MATURITY: ${memory.spiritualMaturity} — calibrate response depth accordingly`);
  }
  if (memory.topicsOfInterest.length > 0) {
    parts.push(`KNOWN INTERESTS: ${memory.topicsOfInterest.slice(0, 5).join(", ")}`);
  }
  if (memory.prayerNeeds.length > 0) {
    parts.push(`KNOWN PRAYER NEEDS (from previous sessions): ${memory.prayerNeeds.slice(0, 3).join("; ")}`);
  }
  if (memory.keyInsights.length > 0) {
    parts.push(`PERSONAL CONTEXT: ${memory.keyInsights.slice(0, 3).join("; ")}`);
  }
  if (isReturning) {
    parts.push(`RETURNING USER: This user has had ${memory.conversationCount} conversation(s) with TempleBots — treat them as a familiar face`);
  }

  const contextBlock = parts.length > 0
    ? `\n\n## REMEMBERED USER CONTEXT (from previous sessions — use naturally):\n${parts.join("\n")}`
    : "";

  return { hasMemory: parts.length > 0, greeting, contextBlock, memory };
}

// ─── Extract Prayer Need from Message ─────────────────────────────────────────

export function extractPrayerNeed(message: string): string | null {
  const patterns = [
    /pray (?:for me (?:about|regarding|concerning)|about)\s+(.{10,120})/i,
    /i need prayer (?:for|about|regarding)\s+(.{10,120})/i,
    /please pray (?:for me (?:about)?|about)\s+(.{10,120})/i,
    /prayer request:?\s*(.{10,120})/i,
    /standing in need of prayer (?:for|about)\s+(.{10,120})/i,
  ];
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) return match[1].trim().slice(0, 120);
  }
  return null;
}

// ─── Get Memory Stats (for admin observability) ───────────────────────────────

export async function getMemoryStats(): Promise<{
  totalProfiles: number;
  namedUsers: number;
  returningUsers: number;
  avgMessageCount: number;
  spiritualMaturityBreakdown: Record<string, number>;
}> {
  try {
    const [totalRes, namedRes, returningRes, avgRes, maturityRes] = await Promise.all([
      pool.query<{ count: string }>(`SELECT COUNT(*) as count FROM user_ai_memory`),
      pool.query<{ count: string }>(`SELECT COUNT(*) as count FROM user_ai_memory WHERE detected_name IS NOT NULL`),
      pool.query<{ count: string }>(`SELECT COUNT(*) as count FROM user_ai_memory WHERE conversation_count > 1`),
      pool.query<{ avg: string }>(`SELECT ROUND(AVG(message_count), 1) as avg FROM user_ai_memory`),
      pool.query<{ spiritual_maturity: string; count: string }>(
        `SELECT spiritual_maturity, COUNT(*) as count FROM user_ai_memory GROUP BY spiritual_maturity`,
      ),
    ]);

    const breakdown: Record<string, number> = {};
    for (const row of maturityRes.rows) {
      breakdown[row.spiritual_maturity] = parseInt(row.count, 10);
    }

    return {
      totalProfiles: parseInt(totalRes.rows[0]?.count ?? "0", 10),
      namedUsers: parseInt(namedRes.rows[0]?.count ?? "0", 10),
      returningUsers: parseInt(returningRes.rows[0]?.count ?? "0", 10),
      avgMessageCount: parseFloat(avgRes.rows[0]?.avg ?? "0"),
      spiritualMaturityBreakdown: breakdown,
    };
  } catch {
    return {
      totalProfiles: 0,
      namedUsers: 0,
      returningUsers: 0,
      avgMessageCount: 0,
      spiritualMaturityBreakdown: {},
    };
  }
}

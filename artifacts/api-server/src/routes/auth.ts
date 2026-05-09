import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, memberAuthTable } from "@workspace/db";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { pool } from "@workspace/db";
import {
  isEmailConfigured,
  sendMemberWelcomeEmail,
  sendPasswordResetEmail,
  getPublicBaseUrl,
} from "../lib/email-engine.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LEN = 64;

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, KEY_LEN, SCRYPT_PARAMS);
  return `${salt}:${derived.toString("hex")}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hashed] = stored.split(":");
  if (!salt || !hashed) return false;
  try {
    const derived = scryptSync(password, salt, KEY_LEN, SCRYPT_PARAMS);
    return timingSafeEqual(Buffer.from(hashed, "hex"), derived);
  } catch {
    return false;
  }
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function serializeMember(member: typeof memberAuthTable.$inferSelect) {
  return {
    id: member.id,
    firstName: member.firstName,
    lastName: member.lastName,
    email: member.email,
    phone: member.phone,
    role: member.role,
    createdAt: member.createdAt instanceof Date ? member.createdAt.toISOString() : member.createdAt,
  };
}

// ─── Shared input sanitisers ───────────────────────────────────────────────────

function sanitizeString(v: unknown, maxLen = 200): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, maxLen);
  return s.length > 0 ? s : null;
}

// RFC-5322 simplified — must have local@domain.tld with no spaces
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function sanitizeEmail(v: unknown): string | null {
  const s = sanitizeString(v, 254);
  if (!s) return null;
  const lower = s.toLowerCase();
  return EMAIL_RE.test(lower) ? lower : null;
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const firstName = sanitizeString(req.body?.firstName, 100);
  const lastName  = sanitizeString(req.body?.lastName, 100);
  const email     = sanitizeEmail(req.body?.email);
  const password  = sanitizeString(req.body?.password, 128);
  const phone     = sanitizeString(req.body?.phone, 30);

  if (!firstName || !lastName || !email || !password) {
    res.status(400).json({ error: "First name, last name, a valid email, and password are required." });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }

  try {
    const existing = await db
      .select()
      .from(memberAuthTable)
      .where(eq(memberAuthTable.email, email))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: "An account with this email already exists." });
      return;
    }

    const passwordHash = hashPassword(password);
    const token = generateToken();

    const [member] = await db
      .insert(memberAuthTable)
      .values({
        email,         // already lowercased + trimmed by sanitizeEmail
        firstName,     // already trimmed by sanitizeString
        lastName,
        passwordHash,
        token,
        phone: phone ?? null,
      })
      .returning();

    // Welcome email — best-effort, never blocks registration response
    sendMemberWelcomeEmail(email, firstName, req.log).catch((err) => {
      req.log.warn({ err, to: email }, "Member welcome email dispatch failed (non-fatal)");
    });

    res.status(201).json({
      token,
      member: serializeMember(member),
      message: "Welcome to the JCTM Digital Sanctuary!",
      emailDeliveryEnabled: isEmailConfigured(),
    });
  } catch (err) {
    req.log.error({ err }, "Registration failed");
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const email    = sanitizeEmail(req.body?.email);
  const password = sanitizeString(req.body?.password, 128);

  if (!email || !password) {
    res.status(400).json({ error: "A valid email and password are required." });
    return;
  }

  try {
    const [member] = await db
      .select()
      .from(memberAuthTable)
      .where(eq(memberAuthTable.email, email))
      .limit(1);

    if (!member || !verifyPassword(password, member.passwordHash)) {
      // Always return the same error to prevent user-enumeration attacks
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const token = generateToken();
    await db.update(memberAuthTable).set({ token }).where(eq(memberAuthTable.id, member.id));

    res.json({
      token,
      member: serializeMember({ ...member, token }),
      message: "Welcome back to the Digital Sanctuary.",
    });
  } catch (err) {
    req.log.error({ err }, "Login failed");
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authorization required." });
    return;
  }

  const token = auth.slice(7);

  try {
    const [member] = await db
      .select()
      .from(memberAuthTable)
      .where(eq(memberAuthTable.token, token))
      .limit(1);

    if (!member) {
      res.status(401).json({ error: "Invalid or expired token." });
      return;
    }

    res.json(serializeMember(member));
  } catch (err) {
    req.log.error({ err }, "Auth check failed");
    res.status(500).json({ error: "Authentication check failed. Please try again." });
  }
});

// ── POST /auth/logout — invalidate the current session token ─────────────────
router.post("/auth/logout", async (req, res): Promise<void> => {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    try {
      await db
        .update(memberAuthTable)
        .set({ token: null })
        .where(eq(memberAuthTable.token, token));
    } catch (err) {
      req.log.warn({ err }, "Logout token invalidation failed (non-fatal)");
    }
  }
  res.json({ ok: true, message: "Signed out successfully." });
});

// ── PUT /auth/profile — update member profile ─────────────────────────────────
router.put("/auth/profile", async (req, res): Promise<void> => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authorization required." });
    return;
  }

  const token = auth.slice(7);
  const { firstName, lastName, phone, currentPassword, newPassword } = req.body as {
    firstName?: string;
    lastName?: string;
    phone?: string;
    currentPassword?: string;
    newPassword?: string;
  };

  try {
    const [member] = await db
      .select()
      .from(memberAuthTable)
      .where(eq(memberAuthTable.token, token))
      .limit(1);

    if (!member) {
      res.status(401).json({ error: "Invalid or expired token." });
      return;
    }

    const updates: Partial<typeof memberAuthTable.$inferInsert> = {};

    if (firstName?.trim()) updates.firstName = firstName.trim();
    if (lastName?.trim()) updates.lastName = lastName.trim();
    if (phone !== undefined) updates.phone = phone || null;

    if (newPassword) {
      if (!currentPassword) {
        res.status(400).json({ error: "Current password is required to set a new password." });
        return;
      }
      if (!verifyPassword(currentPassword, member.passwordHash)) {
        res.status(401).json({ error: "Current password is incorrect." });
        return;
      }
      if (newPassword.length < 8) {
        res.status(400).json({ error: "New password must be at least 8 characters." });
        return;
      }
      updates.passwordHash = hashPassword(newPassword);
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No valid fields to update." });
      return;
    }

    const [updated] = await db
      .update(memberAuthTable)
      .set(updates)
      .where(eq(memberAuthTable.id, member.id))
      .returning();

    res.json({
      member: serializeMember(updated),
      message: "Profile updated successfully.",
    });
  } catch (err) {
    req.log.error({ err }, "Profile update failed");
    res.status(500).json({ error: "Profile update failed. Please try again." });
  }
});

// ── POST /auth/forgot-password — request a password reset link ───────────────
router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const email = sanitizeEmail(req.body?.email);

  // Always respond identically regardless of whether email exists —
  // prevents user-enumeration attacks.
  const genericOk = {
    ok: true,
    message: "If an account with that email exists, a reset link has been sent.",
    emailDeliveryEnabled: isEmailConfigured(),
  };

  if (!email) {
    res.status(400).json({ error: "A valid email address is required." });
    return;
  }

  try {
    const [member] = await db
      .select()
      .from(memberAuthTable)
      .where(eq(memberAuthTable.email, email))
      .limit(1);

    if (!member) {
      // Leak no information — return generic OK
      res.json(genericOk);
      return;
    }

    // Expire any existing unused tokens for this member first
    await pool.query(
      `UPDATE password_reset_tokens SET used_at = now() WHERE member_id = $1 AND used_at IS NULL`,
      [member.id],
    );

    // Generate a short-lived (1 hour) cryptographically random token
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await pool.query(
      `INSERT INTO password_reset_tokens (member_id, token, expires_at) VALUES ($1, $2, $3)`,
      [member.id, token, expiresAt],
    );

    const resetUrl = `${getPublicBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;

    // Best-effort — failure does not block the response
    sendPasswordResetEmail(member.email, member.firstName, resetUrl, req.log).catch((err) => {
      req.log.warn({ err, to: member.email }, "Password reset email dispatch failed (non-fatal)");
    });

    req.log.info({ memberId: member.id }, "Password reset token issued");
    res.json(genericOk);
  } catch (err) {
    req.log.error({ err }, "Forgot-password request failed");
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// ── POST /auth/reset-password — consume a token and set a new password ───────
router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const token      = sanitizeString(req.body?.token, 128);
  const newPassword = sanitizeString(req.body?.password, 128);

  if (!token) {
    res.status(400).json({ error: "Reset token is required." });
    return;
  }
  if (!newPassword || newPassword.length < 8) {
    res.status(400).json({ error: "New password must be at least 8 characters." });
    return;
  }

  try {
    const { rows } = await pool.query<{
      id: number;
      member_id: number;
      expires_at: Date;
      used_at: Date | null;
    }>(
      `SELECT id, member_id, expires_at, used_at FROM password_reset_tokens WHERE token = $1 LIMIT 1`,
      [token],
    );

    const row = rows[0];

    if (!row) {
      res.status(400).json({ error: "Invalid or expired reset link." });
      return;
    }
    if (row.used_at) {
      res.status(400).json({ error: "This reset link has already been used." });
      return;
    }
    if (new Date() > new Date(row.expires_at)) {
      res.status(400).json({ error: "This reset link has expired. Please request a new one." });
      return;
    }

    const newHash = hashPassword(newPassword);
    const newSessionToken = generateToken();

    // Update password and rotate session token atomically
    await pool.query(
      `UPDATE member_auth SET password_hash = $1, token = $2 WHERE id = $3`,
      [newHash, newSessionToken, row.member_id],
    );

    // Mark the reset token as consumed
    await pool.query(
      `UPDATE password_reset_tokens SET used_at = now() WHERE id = $1`,
      [row.id],
    );

    req.log.info({ memberId: row.member_id }, "Password reset successful");
    res.json({
      ok: true,
      token: newSessionToken,
      message: "Password updated successfully. You are now logged in.",
    });
  } catch (err) {
    req.log.error({ err }, "Password reset failed");
    res.status(500).json({ error: "Password reset failed. Please try again." });
  }
});

export default router;

/**
 * Unified Role-Based Admin Authentication
 *
 * Three distinct admin roles with separate passphrases:
 *   gallery    — gallery image upload / management
 *   sermon     — sermon management (YouTube sync, transcript indexing)
 *   livestream — livestream controls (manual status, rebroadcast trigger)
 *
 * Credential resolution order (first match wins):
 *   1. admin_credentials DB table  — set via /api/admin/auth/setup or change-passphrase
 *   2. ADMIN_PASSPHRASE_HASH_{ROLE} — scrypt hash env var
 *   3. ADMIN_PASSPHRASE_{ROLE}      — plaintext env var
 *   4. Legacy gallery env vars      — GALLERY_ADMIN_PASSPHRASE_HASH / GALLERY_ADMIN_PASSPHRASE
 *   5. Dev defaults (NODE_ENV !== "production" only)
 *
 * This means credentials set through the UI persist across all deployments
 * automatically — no manual env var management required.
 */

import type { NextFunction, Request, Response } from "express";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { pool } from "@workspace/db";

export type AdminRole = "gallery" | "sermon" | "livestream";

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LEN = 64;
const TOKEN_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

type AdminTokenPayload = {
  scope: "jctm-admin";
  role: AdminRole;
  exp: number;
  nonce: string;
};

// ─── Scrypt helpers ────────────────────────────────────────────────────────────

export function hashPassphrase(passphrase: string): string {
  const salt = randomBytes(32).toString("hex");
  const hash = scryptSync(passphrase, salt, KEY_LEN, SCRYPT_PARAMS).toString("hex");
  return `${salt}:${hash}`;
}

function verifyScrypt(passphrase: string, stored: string): boolean {
  const [salt, hashed] = stored.split(":");
  if (!salt || !hashed) return false;
  try {
    const expected = Buffer.from(hashed, "hex");
    const derived  = scryptSync(passphrase, salt, KEY_LEN, SCRYPT_PARAMS);
    return expected.length === derived.length && timingSafeEqual(expected, derived);
  } catch {
    return false;
  }
}

function safeEqual(a: string, b: string): boolean {
  const la = Buffer.from(a);
  const lb = Buffer.from(b);
  if (la.length !== lb.length) return false;
  return timingSafeEqual(la, lb);
}

// ─── Database credential storage ──────────────────────────────────────────────

async function getDbHash(role: AdminRole): Promise<string | null> {
  try {
    const result = await pool.query<{ passphrase_hash: string }>(
      `SELECT passphrase_hash FROM admin_credentials WHERE role = $1`,
      [role],
    );
    return result.rows[0]?.passphrase_hash ?? null;
  } catch {
    return null;
  }
}

export async function setRolePassphrase(role: AdminRole, passphrase: string): Promise<void> {
  const hash = hashPassphrase(passphrase);
  await pool.query(
    `INSERT INTO admin_credentials (role, passphrase_hash, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (role) DO UPDATE SET passphrase_hash = $2, updated_at = NOW()`,
    [role, hash],
  );
}

// ─── Env-var fallback resolution ──────────────────────────────────────────────

const ROLE_ENV: Record<AdminRole, { hashKey: string; plainKey: string; devDefault: string }> = {
  gallery: {
    hashKey:    "ADMIN_PASSPHRASE_HASH_GALLERY",
    plainKey:   "ADMIN_PASSPHRASE_GALLERY",
    devDefault: "jctm-gallery-2026",
  },
  sermon: {
    hashKey:    "ADMIN_PASSPHRASE_HASH_SERMON",
    plainKey:   "ADMIN_PASSPHRASE_SERMON",
    devDefault: "jctm-sermon-2026",
  },
  livestream: {
    hashKey:    "ADMIN_PASSPHRASE_HASH_LIVESTREAM",
    plainKey:   "ADMIN_PASSPHRASE_LIVESTREAM",
    devDefault: "jctm-stream-2026",
  },
};

function getEnvHash(role: AdminRole): string | null {
  const cfg = ROLE_ENV[role];
  const primary = process.env[cfg.hashKey]?.trim() || null;
  if (primary) return primary;
  if (role === "gallery") {
    return process.env.GALLERY_ADMIN_PASSPHRASE_HASH?.trim() || null;
  }
  return null;
}

function getEnvPlain(role: AdminRole): string | null {
  const cfg = ROLE_ENV[role];
  const primary = process.env[cfg.plainKey]?.trim() || null;
  if (primary) return primary;
  if (role === "gallery") {
    const legacy = process.env.GALLERY_ADMIN_PASSPHRASE?.trim() || null;
    if (legacy) return legacy;
  }
  if (process.env.NODE_ENV !== "production") return cfg.devDefault;
  return null;
}

// ─── Public API ────────────────────────────────────────────────────────────────

/** Returns true if the role has any credential configured (DB, env var, or dev default). */
export async function isRoleConfigured(role: AdminRole): Promise<boolean> {
  const dbHash = await getDbHash(role);
  if (dbHash) return true;
  return Boolean(getEnvHash(role) || getEnvPlain(role));
}

/**
 * Verifies a passphrase against stored credentials.
 *
 * Resolution order (env vars are checked FIRST so they always act as a
 * break-glass override / reset mechanism — useful when DB credentials are
 * unknown or corrupted):
 *   1. ADMIN_PASSPHRASE_HASH_{ROLE}  — scrypt hash env var   (overrides DB)
 *   2. ADMIN_PASSPHRASE_{ROLE}       — plaintext env var      (overrides DB)
 *   3. Legacy gallery env vars       — GALLERY_ADMIN_PASSPHRASE_HASH / …PASSPHRASE
 *   4. admin_credentials DB table    — credentials set via the UI
 *   5. Dev defaults (NODE_ENV !== "production" only)
 */
export async function verifyRolePassphrase(role: AdminRole, passphrase: string): Promise<boolean> {
  if (typeof passphrase !== "string" || passphrase.length < 8) return false;

  // ── Env vars take priority (break-glass reset) ──────────────────────────────
  const envHash = getEnvHash(role);
  if (envHash) return verifyScrypt(passphrase, envHash);

  const plain = getEnvPlain(role);
  if (plain) return safeEqual(passphrase, plain);

  // ── Fall back to DB-stored credential ───────────────────────────────────────
  const dbHash = await getDbHash(role);
  if (dbHash) return verifyScrypt(passphrase, dbHash);

  return false;
}

// ─── Token lifecycle ───────────────────────────────────────────────────────────

function getTokenSecret(): string {
  return (
    process.env.ADMIN_TOKEN_SECRET?.trim() ||
    process.env.SESSION_SECRET?.trim() ||
    "jctm-admin-dev-token-secret-change-in-production"
  );
}

function sign(encoded: string): string {
  return createHmac("sha256", getTokenSecret()).update(encoded).digest("base64url");
}

export function createAdminToken(role: AdminRole): { token: string; role: AdminRole; expiresAt: string } {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload: AdminTokenPayload = {
    scope: "jctm-admin",
    role,
    exp,
    nonce: randomBytes(16).toString("base64url"),
  };
  const encoded   = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(encoded);
  return {
    token: `${encoded}.${signature}`,
    role,
    expiresAt: new Date(exp).toISOString(),
  };
}

export function verifyAdminToken(token: string | undefined): AdminTokenPayload | null {
  if (!token) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  if (!safeEqual(signature, sign(encoded))) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as AdminTokenPayload;
    if (payload.scope !== "jctm-admin") return null;
    if (!["gallery", "sermon", "livestream"].includes(payload.role)) return null;
    if (!Number.isFinite(payload.exp) || payload.exp <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getAdminTokenFromRequest(req: Request): string | undefined {
  const header = req.header("x-admin-token");
  if (header) return header;
  const auth = req.header("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const queryToken = req.query.adminToken ?? req.query.token;
  if (typeof queryToken === "string" && queryToken.trim()) return queryToken.trim();
  return undefined;
}

// ─── Middleware factory ────────────────────────────────────────────────────────

export function requireAdminRole(
  allowedRoles: AdminRole | AdminRole[],
): (req: Request, res: Response, next: NextFunction) => void {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return (req: Request, res: Response, next: NextFunction): void => {
    const token = verifyAdminToken(getAdminTokenFromRequest(req));
    if (!token || !roles.includes(token.role)) {
      res.status(401).json({
        error: "Admin authorization required.",
        requiredRole: roles.join(" | "),
      });
      return;
    }
    next();
  };
}

// ─── Legacy compatibility re-exports ──────────────────────────────────────────

/** @deprecated — use requireAdminRole('gallery') instead */
export function requireGalleryAdmin(req: Request, res: Response, next: NextFunction): void {
  return requireAdminRole("gallery")(req, res, next);
}

export async function isGalleryAdminConfigured(): Promise<boolean> {
  return isRoleConfigured("gallery");
}

export { isRoleConfigured as isRoleConfiguredAsync };

/** @deprecated — use createAdminToken('gallery') instead */
export function createGalleryAdminToken(): { token: string; expiresAt: string } {
  const result = createAdminToken("gallery");
  return { token: result.token, expiresAt: result.expiresAt };
}

/** @deprecated — use verifyAdminToken instead */
export function verifyGalleryAdminToken(token: string | undefined): boolean {
  const payload = verifyAdminToken(token);
  return payload?.role === "gallery";
}

/** @deprecated — use getAdminTokenFromRequest instead */
export { getAdminTokenFromRequest as getGalleryAdminTokenFromRequest };

/** @deprecated — use verifyRolePassphrase('gallery', ...) instead */
export async function verifyGalleryAdminPassphrase(passphrase: string): Promise<boolean> {
  return verifyRolePassphrase("gallery", passphrase);
}

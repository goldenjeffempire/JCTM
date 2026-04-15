/**
 * Unified Role-Based Admin Authentication
 *
 * Three distinct admin roles with separate passphrases:
 *   gallery   — gallery image upload / management
 *   sermon    — sermon management (YouTube sync, transcript indexing)
 *   livestream — livestream controls (manual status, rebroadcast trigger)
 *
 * Each role resolves its passphrase from environment variables:
 *   ADMIN_PASSPHRASE_HASH_{ROLE}   — scrypt hash (preferred, more secure)
 *   ADMIN_PASSPHRASE_{ROLE}        — plaintext fallback
 *   Legacy gallery: GALLERY_ADMIN_PASSPHRASE_HASH / GALLERY_ADMIN_PASSPHRASE
 *
 * Dev-only defaults (NODE_ENV !== "production"):
 *   gallery:    jctm-gallery-2026
 *   sermon:     jctm-sermon-2026
 *   livestream: jctm-stream-2026
 */

import type { NextFunction, Request, Response } from "express";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";

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

// ─── Passphrase resolution ─────────────────────────────────────────────────────

const ROLE_ENV: Record<AdminRole, { hashKey: string; plainKey: string; devDefault: string }> = {
  gallery: {
    hashKey:  "ADMIN_PASSPHRASE_HASH_GALLERY",
    plainKey: "ADMIN_PASSPHRASE_GALLERY",
    devDefault: "jctm-gallery-2026",
  },
  sermon: {
    hashKey:  "ADMIN_PASSPHRASE_HASH_SERMON",
    plainKey: "ADMIN_PASSPHRASE_SERMON",
    devDefault: "jctm-sermon-2026",
  },
  livestream: {
    hashKey:  "ADMIN_PASSPHRASE_HASH_LIVESTREAM",
    plainKey: "ADMIN_PASSPHRASE_LIVESTREAM",
    devDefault: "jctm-stream-2026",
  },
};

function getRoleHash(role: AdminRole): string | null {
  const cfg = ROLE_ENV[role];
  const primary = process.env[cfg.hashKey]?.trim() || null;
  if (primary) return primary;

  // Backward compatibility for gallery
  if (role === "gallery") {
    const legacy = process.env.GALLERY_ADMIN_PASSPHRASE_HASH?.trim() || null;
    if (legacy) return legacy;
  }
  return null;
}

function getRolePlain(role: AdminRole): string | null {
  const cfg = ROLE_ENV[role];
  const primary = process.env[cfg.plainKey]?.trim() || null;
  if (primary) return primary;

  // Backward compatibility for gallery
  if (role === "gallery") {
    const legacy = process.env.GALLERY_ADMIN_PASSPHRASE?.trim() || null;
    if (legacy) return legacy;
  }

  // Dev default
  if (process.env.NODE_ENV !== "production") return cfg.devDefault;
  return null;
}

function isRoleConfigured(role: AdminRole): boolean {
  return Boolean(getRoleHash(role) || getRolePlain(role));
}

// ─── Passphrase verification ───────────────────────────────────────────────────

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

export function verifyRolePassphrase(role: AdminRole, passphrase: string): boolean {
  if (typeof passphrase !== "string" || passphrase.length < 8) return false;
  const hash = getRoleHash(role);
  if (hash) return verifyScrypt(passphrase, hash);
  const plain = getRolePlain(role);
  if (!plain) return false;
  return safeEqual(passphrase, plain);
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
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
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
  return undefined;
}

// ─── Middleware factory ────────────────────────────────────────────────────────

/**
 * requireAdminRole(role) — Express middleware that requires a valid admin token
 * with the specified role (or any of the specified roles).
 */
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

// ─── Legacy compatibility re-exports (used by gallery.ts currently) ────────────

/** @deprecated — use requireAdminRole('gallery') instead */
export function requireGalleryAdmin(req: Request, res: Response, next: NextFunction): void {
  return requireAdminRole("gallery")(req, res, next);
}

export function isGalleryAdminConfigured(): boolean {
  return isRoleConfigured("gallery");
}

export { isRoleConfigured };

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
export function verifyGalleryAdminPassphrase(passphrase: string): boolean {
  return verifyRolePassphrase("gallery", passphrase);
}

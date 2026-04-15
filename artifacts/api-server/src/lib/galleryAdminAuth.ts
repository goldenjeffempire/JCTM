import type { NextFunction, Request, Response } from "express";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LEN = 64;
const TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

type GalleryAdminTokenPayload = {
  scope: "gallery-admin";
  exp: number;
  nonce: string;
};

function verifyScryptPassphrase(passphrase: string, stored: string): boolean {
  const [salt, hashed] = stored.split(":");
  if (!salt || !hashed) return false;

  try {
    const expected = Buffer.from(hashed, "hex");
    const derived = scryptSync(passphrase, salt, KEY_LEN, SCRYPT_PARAMS);
    return expected.length === derived.length && timingSafeEqual(expected, derived);
  } catch {
    return false;
  }
}

function safeEqualText(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function getConfiguredPassphraseHash(): string | null {
  return process.env.GALLERY_ADMIN_PASSPHRASE_HASH?.trim() || null;
}

function getConfiguredPlainPassphrase(): string | null {
  const configured = process.env.GALLERY_ADMIN_PASSPHRASE?.trim();
  if (configured) return configured;
  return process.env.NODE_ENV === "production" ? null : "jctm-admin-gallery";
}

function getTokenSecret(): string {
  return (
    process.env.GALLERY_ADMIN_TOKEN_SECRET?.trim() ||
    process.env.SESSION_SECRET?.trim() ||
    getConfiguredPassphraseHash() ||
    "jctm-gallery-admin-development-token-secret"
  );
}

function signPayload(encodedPayload: string): string {
  return createHmac("sha256", getTokenSecret())
    .update(encodedPayload)
    .digest("base64url");
}

export function verifyGalleryAdminPassphrase(passphrase: string): boolean {
  if (typeof passphrase !== "string" || passphrase.length < 8) return false;

  const hash = getConfiguredPassphraseHash();
  if (hash) return verifyScryptPassphrase(passphrase, hash);

  const plain = getConfiguredPlainPassphrase();
  if (!plain) return false;

  return safeEqualText(passphrase, plain);
}

export function isGalleryAdminConfigured(): boolean {
  return Boolean(getConfiguredPassphraseHash() || getConfiguredPlainPassphrase());
}

export function createGalleryAdminToken(): { token: string; expiresAt: string } {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload: GalleryAdminTokenPayload = {
    scope: "gallery-admin",
    exp,
    nonce: randomBytes(16).toString("base64url"),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signPayload(encodedPayload);
  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt: new Date(exp).toISOString(),
  };
}

export function verifyGalleryAdminToken(token: string | undefined): boolean {
  if (!token) return false;
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return false;

  const expected = signPayload(encodedPayload);
  if (!safeEqualText(signature, expected)) return false;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as GalleryAdminTokenPayload;
    return payload.scope === "gallery-admin" && Number.isFinite(payload.exp) && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export function getGalleryAdminTokenFromRequest(req: Request): string | undefined {
  const headerToken = req.header("x-gallery-admin-token");
  if (headerToken) return headerToken;

  const auth = req.header("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }

  return undefined;
}

export function requireGalleryAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!verifyGalleryAdminToken(getGalleryAdminTokenFromRequest(req))) {
    res.status(401).json({ error: "Gallery admin authorization is required." });
    return;
  }

  next();
}
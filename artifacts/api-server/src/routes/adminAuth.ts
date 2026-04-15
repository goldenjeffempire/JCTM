/**
 * Admin Auth Routes
 *
 * POST /api/admin/auth/login             — exchange a role passphrase for a signed token
 * GET  /api/admin/auth/session           — validate an existing token and return its role
 * GET  /api/admin/auth/roles             — list which roles are configured on this server
 * POST /api/admin/auth/setup             — first-time passphrase setup (only when unconfigured)
 * POST /api/admin/auth/change-passphrase — change passphrase (requires valid token + current passphrase)
 */

import { Router, type IRouter } from "express";
import {
  type AdminRole,
  createAdminToken,
  getAdminTokenFromRequest,
  isRoleConfigured,
  setRolePassphrase,
  verifyAdminToken,
  verifyRolePassphrase,
} from "../lib/adminAuth.js";

const router: IRouter = Router();

const ALL_ROLES: AdminRole[] = ["gallery", "sermon", "livestream"];

// ─── POST /api/admin/auth/login ───────────────────────────────────────────────

router.post("/admin/auth/login", async (req, res): Promise<void> => {
  const { passphrase, role } = req.body as { passphrase?: unknown; role?: unknown };

  if (typeof role !== "string" || !ALL_ROLES.includes(role as AdminRole)) {
    res.status(400).json({ error: `Invalid role. Must be one of: ${ALL_ROLES.join(", ")}` });
    return;
  }

  const typedRole = role as AdminRole;

  if (!(await isRoleConfigured(typedRole))) {
    res.status(503).json({
      error: `Admin role "${typedRole}" is not configured yet.`,
      needsSetup: true,
    });
    return;
  }

  if (typeof passphrase !== "string" || !(await verifyRolePassphrase(typedRole, passphrase))) {
    req.log.warn({ ip: req.ip, role: typedRole }, "Admin login failed — wrong passphrase");
    res.status(401).json({ error: "Invalid passphrase for this admin role." });
    return;
  }

  req.log.info({ role: typedRole }, "Admin login successful");
  res.json(createAdminToken(typedRole));
});

// ─── POST /api/admin/auth/setup ───────────────────────────────────────────────
// First-time setup — only works when the role has NO credentials configured at all.

router.post("/admin/auth/setup", async (req, res): Promise<void> => {
  const { role, passphrase, confirmPassphrase } = req.body as {
    role?: unknown;
    passphrase?: unknown;
    confirmPassphrase?: unknown;
  };

  if (typeof role !== "string" || !ALL_ROLES.includes(role as AdminRole)) {
    res.status(400).json({ error: `Invalid role. Must be one of: ${ALL_ROLES.join(", ")}` });
    return;
  }

  const typedRole = role as AdminRole;

  if (await isRoleConfigured(typedRole)) {
    res.status(409).json({
      error: "This admin role already has a passphrase configured. Use change-passphrase to update it.",
    });
    return;
  }

  if (typeof passphrase !== "string" || passphrase.length < 8) {
    res.status(400).json({ error: "Passphrase must be at least 8 characters." });
    return;
  }

  if (passphrase !== confirmPassphrase) {
    res.status(400).json({ error: "Passphrases do not match." });
    return;
  }

  await setRolePassphrase(typedRole, passphrase);
  req.log.info({ role: typedRole }, "Admin passphrase created for the first time");
  res.json({ ...createAdminToken(typedRole), message: "Admin passphrase set. You are now logged in." });
});

// ─── POST /api/admin/auth/change-passphrase ───────────────────────────────────
// Requires a valid admin token for the role + the current passphrase.

router.post("/admin/auth/change-passphrase", async (req, res): Promise<void> => {
  const tokenPayload = verifyAdminToken(getAdminTokenFromRequest(req));
  if (!tokenPayload) {
    res.status(401).json({ error: "Admin authorization required." });
    return;
  }

  const { currentPassphrase, newPassphrase, confirmPassphrase } = req.body as {
    currentPassphrase?: unknown;
    newPassphrase?: unknown;
    confirmPassphrase?: unknown;
  };

  if (
    typeof currentPassphrase !== "string" ||
    !(await verifyRolePassphrase(tokenPayload.role, currentPassphrase))
  ) {
    req.log.warn({ role: tokenPayload.role }, "Change passphrase failed — wrong current passphrase");
    res.status(401).json({ error: "Current passphrase is incorrect." });
    return;
  }

  if (typeof newPassphrase !== "string" || newPassphrase.length < 8) {
    res.status(400).json({ error: "New passphrase must be at least 8 characters." });
    return;
  }

  if (newPassphrase !== confirmPassphrase) {
    res.status(400).json({ error: "New passphrases do not match." });
    return;
  }

  await setRolePassphrase(tokenPayload.role, newPassphrase);
  req.log.info({ role: tokenPayload.role }, "Admin passphrase changed successfully");
  res.json({ success: true, message: "Passphrase updated. Please log in again." });
});

// ─── GET /api/admin/auth/session ─────────────────────────────────────────────

router.get("/admin/auth/session", (req, res): void => {
  const payload = verifyAdminToken(getAdminTokenFromRequest(req));
  if (!payload) {
    res.json({ authenticated: false, role: null });
    return;
  }
  res.json({
    authenticated: true,
    role: payload.role,
    expiresAt: new Date(payload.exp).toISOString(),
  });
});

// ─── GET /api/admin/auth/roles ────────────────────────────────────────────────

router.get("/admin/auth/roles", async (_req, res): Promise<void> => {
  const roles = await Promise.all(
    ALL_ROLES.map(async (role) => ({
      role,
      configured: await isRoleConfigured(role),
    })),
  );
  res.json({ roles });
});

export default router;

/**
 * Admin Auth Routes
 *
 * POST /api/admin/auth/login   — exchange a role passphrase for a signed token
 * GET  /api/admin/auth/session — validate an existing token and return its role
 * GET  /api/admin/auth/roles   — list which roles are configured on this server
 */

import { Router, type IRouter } from "express";
import {
  AdminRole,
  createAdminToken,
  getAdminTokenFromRequest,
  isRoleConfigured,
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

  if (!isRoleConfigured(typedRole)) {
    res.status(503).json({ error: `Admin role "${typedRole}" is not configured on this server.` });
    return;
  }

  if (typeof passphrase !== "string" || !verifyRolePassphrase(typedRole, passphrase)) {
    req.log.warn({ ip: req.ip, role: typedRole }, "Admin login failed — wrong passphrase");
    res.status(401).json({ error: "Invalid passphrase for this admin role." });
    return;
  }

  req.log.info({ role: typedRole }, "Admin login successful");
  res.json(createAdminToken(typedRole));
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

router.get("/admin/auth/roles", (_req, res): void => {
  const roles = ALL_ROLES.map((role) => ({
    role,
    configured: isRoleConfigured(role),
  }));
  res.json({ roles });
});

export default router;

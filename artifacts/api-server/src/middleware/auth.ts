import type { Request, Response, NextFunction } from "express";
import { pool } from "@workspace/db";

export interface AuthenticatedRequest extends Request {
  member?: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const result = await pool.query<{
      id: number;
      email: string;
      first_name: string;
      last_name: string;
      role: string;
    }>(
      `SELECT id, email, first_name, last_name, role
       FROM member_auth
       WHERE token = $1
       LIMIT 1`,
      [token],
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    const row = result.rows[0];
    req.member = {
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      role: row.role ?? "member",
    };
    next();
  } catch (err) {
    res.status(500).json({ error: "Authentication check failed" });
  }
}

export async function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  await requireAuth(req, res, async () => {
    if (req.member?.role !== "admin") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    next();
  });
}

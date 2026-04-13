import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, memberAuthTable } from "@workspace/db";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

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

router.post("/auth/register", async (req, res): Promise<void> => {
  const { firstName, lastName, email, password, phone } = req.body;

  if (!firstName || !lastName || !email || !password) {
    res.status(400).json({ error: "First name, last name, email, and password are required." });
    return;
  }

  if (typeof password !== "string" || password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters." });
    return;
  }

  if (typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "A valid email address is required." });
    return;
  }

  try {
    const existing = await db
      .select()
      .from(memberAuthTable)
      .where(eq(memberAuthTable.email, email.toLowerCase()))
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
        email: email.toLowerCase(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        passwordHash,
        token,
        phone: phone ?? null,
      })
      .returning();

    res.status(201).json({
      token,
      member: serializeMember(member),
      message: "Welcome to the JCTM Digital Sanctuary!",
    });
  } catch (err) {
    req.log.error({ err }, "Registration failed");
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }

  try {
    const [member] = await db
      .select()
      .from(memberAuthTable)
      .where(eq(memberAuthTable.email, email.toLowerCase()))
      .limit(1);

    if (!member || !verifyPassword(password, member.passwordHash)) {
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
      if (newPassword.length < 6) {
        res.status(400).json({ error: "New password must be at least 6 characters." });
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

export default router;

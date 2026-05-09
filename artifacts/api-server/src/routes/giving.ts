import { Router, type IRouter } from "express";
import { eq, sum, count, desc } from "drizzle-orm";
import { db, givingLogsTable } from "@workspace/db";
import {
  ListGivingLogsResponse,
  InitiateDonationBody,
  InitiateDonationResponse,
  GetGivingStatsResponse,
  VerifyDonationParams,
  VerifyDonationResponse,
} from "@workspace/api-zod";
import { verifyAdminToken, getAdminTokenFromRequest } from "../lib/adminAuth.js";
import { randomUUID } from "crypto";

const router: IRouter = Router();

function generateReference(): string {
  const uid = randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
  return `JCTM-${Date.now()}-${uid}`;
}

// Full donor log — admin-only to protect PII (names, emails, amounts).
router.get("/giving", async (req, res): Promise<void> => {
  if (!verifyAdminToken(getAdminTokenFromRequest(req))) {
    res.status(401).json({ error: "Admin authentication required to view giving logs." });
    return;
  }

  const limit  = Math.min(Math.max(Number(req.query.limit  ?? 50), 1), 200);
  const offset = Math.max(Number(req.query.offset ?? 0), 0);

  try {
    const logs = await db
      .select()
      .from(givingLogsTable)
      .orderBy(desc(givingLogsTable.createdAt))
      .limit(limit)
      .offset(offset);

    res.setHeader("Cache-Control", "no-store");
    res.json(ListGivingLogsResponse.parse(logs));
  } catch {
    res.status(500).json({ error: "Failed to load giving logs" });
  }
});

router.get("/giving/stats", async (_req, res): Promise<void> => {
  try {
    const [stats] = await db
      .select({
        totalAmount: sum(givingLogsTable.amount),
        totalDonations: count(givingLogsTable.id),
      })
      .from(givingLogsTable)
      .where(eq(givingLogsTable.status, "success"));

    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    res.json(GetGivingStatsResponse.parse({
      totalAmount: parseFloat(String(stats?.totalAmount ?? 0)),
      totalDonations: stats?.totalDonations ?? 0,
      recentCount: stats?.totalDonations ?? 0,
    }));
  } catch {
    res.status(500).json({ error: "Failed to load giving stats" });
  }
});

async function processDonation(
  req: import("express").Request,
  res: import("express").Response,
  donorName: string | null | undefined,
  donorEmail: string,
  amount: number,
  currency: string,
  purpose: string | null | undefined,
): Promise<void> {
  const reference = generateReference();
  const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
  let authorizationUrl: string | null = null;

  if (PAYSTACK_SECRET) {
    try {
      const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: donorEmail,
          amount: Math.round(amount * 100),
          reference,
          currency,
          metadata: { donorName, purpose },
        }),
      });
      const paystackData = await paystackRes.json() as { status: boolean; data?: { authorization_url: string } };
      if (paystackData.status && paystackData.data) {
        authorizationUrl = paystackData.data.authorization_url;
      }
    } catch (err) {
      req.log.warn({ err }, "Paystack initialization failed, proceeding with manual reference");
    }
  }

  await db.insert(givingLogsTable).values({
    donorName: donorName ?? null,
    donorEmail,
    amount,
    currency,
    purpose: purpose ?? null,
    reference,
    status: "pending",
    paymentMethod: PAYSTACK_SECRET ? "paystack" : "manual",
  });

  const message = authorizationUrl
    ? "Donation initiated. Proceed to payment gateway."
    : `Donation recorded. Reference: ${reference}. Please transfer to JCTM account.`;

  res.json({
    reference,
    authorizationUrl,
    paymentUrl: authorizationUrl,
    message,
  });
}

// POST /giving — legacy route (kept for backward compatibility)
router.post("/giving", async (req, res): Promise<void> => {
  const parsed = InitiateDonationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { donorName, donorEmail, amount, currency = "NGN", purpose } = parsed.data;
  await processDonation(req, res, donorName, donorEmail, amount, currency, purpose);
});

// POST /giving/initiate — primary route used by Give.tsx
// Accepts givingType (tithe/offering/etc.) mapped to purpose field.
router.post("/giving/initiate", async (req, res): Promise<void> => {
  const body = req.body as {
    amount?: unknown;
    currency?: unknown;
    givingType?: unknown;
    donorName?: unknown;
    donorEmail?: unknown;
  };

  const amount = typeof body.amount === "number" ? body.amount : parseFloat(String(body.amount ?? "0"));
  const donorEmail = typeof body.donorEmail === "string" ? body.donorEmail.trim() : "";
  const currency = typeof body.currency === "string" ? body.currency.toUpperCase() : "NGN";
  const donorName = typeof body.donorName === "string" ? body.donorName.trim() : null;
  const purpose = typeof body.givingType === "string" ? body.givingType : null;

  if (!donorEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(donorEmail)) {
    res.status(400).json({ error: "A valid email address is required." });
    return;
  }
  if (!amount || amount < 1) {
    res.status(400).json({ error: "Amount must be at least 1." });
    return;
  }

  await processDonation(req, res, donorName || null, donorEmail, amount, currency, purpose);
});

router.get("/giving/verify/:reference", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.reference) ? req.params.reference[0] : req.params.reference;
  const params = VerifyDonationParams.safeParse({ reference: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

  if (PAYSTACK_SECRET) {
    try {
      const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${params.data.reference}`, {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
      });
      const data = await verifyRes.json() as {
        status: boolean;
        data?: { status: string; amount: number; customer?: { first_name?: string; last_name?: string } };
      };

      if (data.status && data.data) {
        const txn = data.data;
        const verified = txn.status === "success";

        if (verified) {
          await db
            .update(givingLogsTable)
            .set({ status: "success" })
            .where(eq(givingLogsTable.reference, params.data.reference));
        }

        res.json(VerifyDonationResponse.parse({
          status: txn.status,
          amount: txn.amount / 100,
          donorName: txn.customer ? `${txn.customer.first_name ?? ""} ${txn.customer.last_name ?? ""}`.trim() : null,
          message: verified ? "Payment confirmed. Thank you for giving!" : "Payment not yet confirmed.",
        }));
        return;
      }
    } catch (err) {
      req.log.warn({ err }, "Paystack verification failed");
    }
  }

  const [log] = await db
    .select()
    .from(givingLogsTable)
    .where(eq(givingLogsTable.reference, params.data.reference));

  if (!log) {
    res.status(404).json({ error: "Donation reference not found" });
    return;
  }

  res.json(VerifyDonationResponse.parse({
    status: log.status,
    amount: log.amount,
    donorName: log.donorName ?? null,
    message: log.status === "success" ? "Payment confirmed." : "Payment pending verification.",
  }));
});

export default router;

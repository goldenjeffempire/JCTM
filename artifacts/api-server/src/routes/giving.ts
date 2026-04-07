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

const router: IRouter = Router();

function generateReference(): string {
  return `JCTM-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

router.get("/giving", async (_req, res): Promise<void> => {
  const logs = await db
    .select()
    .from(givingLogsTable)
    .orderBy(desc(givingLogsTable.createdAt))
    .limit(100);

  res.json(ListGivingLogsResponse.parse(logs));
});

router.get("/giving/stats", async (_req, res): Promise<void> => {
  const [stats] = await db
    .select({
      totalAmount: sum(givingLogsTable.amount),
      totalDonations: count(givingLogsTable.id),
    })
    .from(givingLogsTable)
    .where(eq(givingLogsTable.status, "success"));

  res.json(GetGivingStatsResponse.parse({
    totalAmount: parseFloat(String(stats?.totalAmount ?? 0)),
    totalDonations: stats?.totalDonations ?? 0,
    recentCount: stats?.totalDonations ?? 0,
  }));
});

router.post("/giving", async (req, res): Promise<void> => {
  const parsed = InitiateDonationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { donorName, donorEmail, amount, currency = "NGN", purpose } = parsed.data;
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
    donorName,
    donorEmail,
    amount,
    currency,
    purpose: purpose ?? null,
    reference,
    status: "pending",
    paymentMethod: PAYSTACK_SECRET ? "paystack" : "manual",
  });

  res.json(InitiateDonationResponse.parse({
    reference,
    authorizationUrl,
    message: authorizationUrl
      ? "Donation initiated. Proceed to payment gateway."
      : `Donation recorded. Reference: ${reference}. Please transfer to JCTM account.`,
  }));
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

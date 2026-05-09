import { Router, type Response } from "express";
import { pool } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";

const router = Router();

function computeMaturity(daysMember: number, testimonyCount: number, givingCount: number): {
  level: "Seeker" | "Believer" | "Faithful" | "Rooted";
  score: number;
  nextLevel: string;
  progressPct: number;
} {
  const activityBonus = (testimonyCount * 15) + (givingCount * 20);
  const effectiveDays = daysMember + activityBonus;

  if (effectiveDays < 45) {
    return { level: "Seeker", score: effectiveDays, nextLevel: "Believer", progressPct: Math.round((effectiveDays / 45) * 100) };
  } else if (effectiveDays < 120) {
    return { level: "Believer", score: effectiveDays, nextLevel: "Faithful", progressPct: Math.round(((effectiveDays - 45) / 75) * 100) };
  } else if (effectiveDays < 250) {
    return { level: "Faithful", score: effectiveDays, nextLevel: "Rooted", progressPct: Math.round(((effectiveDays - 120) / 130) * 100) };
  } else {
    return { level: "Rooted", score: effectiveDays, nextLevel: "Rooted", progressPct: 100 };
  }
}

function computeBadges(params: {
  daysMember: number;
  testimonyCount: number;
  givingCount: number;
  givingTotal: number;
  maturityLevel: string;
}) {
  const badges: Array<{ id: string; label: string; icon: string; earned: boolean; desc: string }> = [
    {
      id: "new_heart",
      label: "New Heart",
      icon: "🕊️",
      earned: params.daysMember >= 1,
      desc: "Joined the JCTM Digital Sanctuary",
    },
    {
      id: "first_week",
      label: "First 7 Days",
      icon: "🌱",
      earned: params.daysMember >= 7,
      desc: "7 days walking with the ministry",
    },
    {
      id: "faithful_month",
      label: "Faithful Month",
      icon: "📅",
      earned: params.daysMember >= 30,
      desc: "30 days of consistent fellowship",
    },
    {
      id: "quarter_year",
      label: "90-Day Pilgrim",
      icon: "🏕️",
      earned: params.daysMember >= 90,
      desc: "90 days growing in the Correction",
    },
    {
      id: "half_year",
      label: "6-Month Covenant",
      icon: "📜",
      earned: params.daysMember >= 180,
      desc: "6 months in the Sanctuary family",
    },
    {
      id: "testimony_shared",
      label: "Testimony Bearer",
      icon: "🔥",
      earned: params.testimonyCount >= 1,
      desc: "Shared your first testimony",
    },
    {
      id: "multiple_testimonies",
      label: "Living Witness",
      icon: "⚡",
      earned: params.testimonyCount >= 3,
      desc: "Shared 3 or more testimonies",
    },
    {
      id: "first_giving",
      label: "Kingdom Partner",
      icon: "💎",
      earned: params.givingCount >= 1,
      desc: "Made your first kingdom investment",
    },
    {
      id: "consistent_giving",
      label: "Cheerful Giver",
      icon: "🌟",
      earned: params.givingCount >= 3,
      desc: "Sown into the kingdom 3 or more times",
    },
    {
      id: "rooted",
      label: "Deeply Rooted",
      icon: "🌳",
      earned: params.maturityLevel === "Rooted",
      desc: "Reached the highest spiritual maturity level",
    },
  ];
  return badges;
}

function computeNextSteps(params: {
  testimonyCount: number;
  givingCount: number;
  daysMember: number;
  maturityLevel: string;
}) {
  const steps: Array<{ label: string; href: string; desc: string; icon: string }> = [];

  if (params.testimonyCount === 0) {
    steps.push({ label: "Share a Testimony", href: "/testimonies", desc: "Let your story encourage someone today", icon: "🔥" });
  }
  if (params.givingCount === 0) {
    steps.push({ label: "Give to the Kingdom", href: "/give", desc: "Sow a seed into the ministry's work", icon: "💎" });
  }
  if (params.daysMember < 30) {
    steps.push({ label: "Explore Sermons", href: "/sermons", desc: "Dive into the archive of teachings", icon: "📖" });
  }
  if (params.maturityLevel === "Seeker" || params.maturityLevel === "Believer") {
    steps.push({ label: "Read the Correction Timeline", href: "/correction-timeline", desc: "Understand the 5 corrections of God", icon: "🕊️" });
  }
  if (steps.length < 3) {
    steps.push({ label: "Join the Prayer Wall", href: "/prayer", desc: "Submit a request or pray for others", icon: "🙏" });
  }
  if (steps.length < 3) {
    steps.push({ label: "Explore the Blog", href: "/blog", desc: "Read ministry insights and devotionals", icon: "📝" });
  }

  return steps.slice(0, 3);
}

router.get("/journey/summary", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const member = req.member!;
  const email = member.email;

  try {
    const [memberRow, testimoniesRow, givingRow] = await Promise.all([
      pool.query<{ created_at: Date }>(
        `SELECT created_at FROM member_auth WHERE id = $1 LIMIT 1`,
        [member.id],
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM testimonies WHERE email = $1`,
        [email],
      ),
      pool.query<{ count: string; total: string }>(
        `SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total
         FROM giving_logs
         WHERE donor_email = $1 AND status = 'success'`,
        [email],
      ),
    ]);

    const joinedAt = memberRow.rows[0]?.created_at ?? new Date();
    const daysMember = Math.max(0, Math.floor((Date.now() - new Date(joinedAt).getTime()) / (1000 * 60 * 60 * 24)));
    const testimonyCount = parseInt(testimoniesRow.rows[0]?.count ?? "0", 10);
    const givingCount = parseInt(givingRow.rows[0]?.count ?? "0", 10);
    const givingTotal = parseFloat(givingRow.rows[0]?.total ?? "0");

    const maturity = computeMaturity(daysMember, testimonyCount, givingCount);
    const badges = computeBadges({ daysMember, testimonyCount, givingCount, givingTotal, maturityLevel: maturity.level });
    const nextSteps = computeNextSteps({ testimonyCount, givingCount, daysMember, maturityLevel: maturity.level });

    const earnedCount = badges.filter(b => b.earned).length;

    res.json({
      ok: true,
      member: {
        firstName: member.firstName,
        lastName: member.lastName,
        email,
        daysMember,
        joinedAt: joinedAt instanceof Date ? joinedAt.toISOString() : joinedAt,
      },
      activity: {
        testimonies: testimonyCount,
        givingCount,
        givingTotal: Math.round(givingTotal),
      },
      maturity,
      badges,
      earnedBadges: earnedCount,
      totalBadges: badges.length,
      nextSteps,
    });
  } catch (err) {
    req.log.error({ err }, "journey/summary failed");
    res.status(500).json({ ok: false, error: "Failed to load journey data" });
  }
});

export default router;

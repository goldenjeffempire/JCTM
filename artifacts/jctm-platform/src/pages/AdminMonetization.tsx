import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import {
  DollarSign,
  TrendingUp,
  Users,
  BarChart3,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Lock,
  Eye,
  Heart,
  Megaphone,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface GivingStats {
  totalAmount: number;
  totalDonations: number;
  recentCount: number;
}

interface GivingLog {
  id: number;
  donorName: string | null;
  donorEmail: string | null;
  amount: number;
  currency: string;
  purpose: string | null;
  status: string;
  reference: string;
  paymentMethod: string | null;
  createdAt: string;
}

interface AdsenseDiagnostics {
  publisherId: string;
  publisherValid: boolean;
  enableFlag: boolean;
  configuredSlots: number;
  totalSlots: number;
  slots: { name: string; envKey: string; slotId: string | null; configured: boolean }[];
  adsTxt: { status: "ok" | "missing" | "wrong" | "error"; content: string | null };
  checkedAt: string;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "text-blue-400",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm p-5 flex items-start gap-4">
      <span className={`flex-shrink-0 w-10 h-10 rounded-xl bg-muted/60 flex items-center justify-center ${color}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-2xl font-bold text-primary tabular-nums">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function AdsTxtBadge({ status }: { status: string }) {
  const cfg = {
    ok:      { icon: CheckCircle2, color: "text-green-400", label: "ads.txt OK" },
    missing: { icon: XCircle,      color: "text-red-400",   label: "ads.txt Missing" },
    wrong:   { icon: AlertCircle,  color: "text-amber-400", label: "ads.txt Wrong publisher" },
    error:   { icon: AlertCircle,  color: "text-red-400",   label: "ads.txt Error reading" },
  }[status] ?? { icon: AlertCircle, color: "text-muted-foreground", label: "Unknown" };

  const { icon: Icon, color, label } = cfg;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${color}`}>
      <Icon className="h-4 w-4" /> {label}
    </span>
  );
}

export default function AdminMonetization() {
  const [token, setToken] = useState<string>(() => localStorage.getItem("adminToken") ?? "");
  const [tokenInput, setTokenInput] = useState("");
  const [givingStats, setGivingStats] = useState<GivingStats | null>(null);
  const [recentLogs, setRecentLogs] = useState<GivingLog[]>([]);
  const [adsense, setAdsense] = useState<AdsenseDiagnostics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (tok: string) => {
    if (!tok) return;
    setLoading(true);
    setError("");
    try {
      const headers = { Authorization: `Bearer ${tok}` };
      const [statsRes, logsRes, adsRes] = await Promise.all([
        fetch(`${BASE}/api/giving/stats`),
        fetch(`${BASE}/api/giving?limit=10`, { headers }),
        fetch(`${BASE}/api/admin/adsense-diagnostics`, { headers }),
      ]);

      if (!logsRes.ok && logsRes.status === 401) {
        setError("Invalid admin token. Please check and try again.");
        setLoading(false);
        return;
      }

      const stats = await statsRes.json();
      const logs = logsRes.ok ? await logsRes.json() : [];
      const ads = adsRes.ok ? await adsRes.json() : null;

      setGivingStats(stats);
      setRecentLogs(Array.isArray(logs) ? logs : logs.logs ?? []);
      setAdsense(ads);
    } catch {
      setError("Failed to load monetization data. Check server status.");
    }
    setLoading(false);
  }, []);

  function authenticate() {
    const tok = tokenInput.trim();
    if (!tok) return;
    localStorage.setItem("adminToken", tok);
    setToken(tok);
    load(tok);
  }

  useEffect(() => {
    if (token) load(token);
  }, [token, load]);

  const ngnTotal = recentLogs
    .filter(l => l.currency === "NGN" && l.status === "success")
    .reduce((acc, l) => acc + l.amount, 0);
  const usdTotal = recentLogs
    .filter(l => l.currency !== "NGN" && l.status === "success")
    .reduce((acc, l) => acc + l.amount, 0);

  if (!token) {
    return (
      <Layout>
        <SEO title="Monetization Dashboard — Admin | JCTM" noIndex />
        <div className="min-h-[80vh] flex items-center justify-center px-4">
          <div className="w-full max-w-sm rounded-2xl border border-border/50 bg-card/80 p-8 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <Lock className="h-6 w-6 text-primary" />
              <h1 className="text-lg font-bold text-primary">Admin Access</h1>
            </div>
            <input
              type="password"
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && authenticate()}
              placeholder="Enter admin token"
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              onClick={authenticate}
              className="mt-3 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Sign in
            </button>
            {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <SEO title="Monetization Dashboard — Admin | JCTM" noIndex />
      <div className="container mx-auto px-4 py-10 max-w-6xl space-y-10">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary">Monetization Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Revenue, giving, and ad performance — JCTM Digital Sanctuary
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => load(token)}
              disabled={loading}
              className="flex items-center gap-2 rounded-full border border-border/60 bg-card px-4 py-2 text-xs font-semibold hover:bg-muted/60 transition-colors disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <a
              href="https://www.google.com/adsense/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              AdSense Console
            </a>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Giving Stats */}
        <section>
          <h2 className="text-base font-semibold text-primary mb-4 flex items-center gap-2">
            <Heart className="h-4 w-4 text-rose-400" /> Giving & Donations
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={DollarSign}
              label="Total Confirmed"
              value={givingStats ? `₦${(givingStats.totalAmount).toLocaleString()}` : "—"}
              sub={`${givingStats?.totalDonations ?? 0} total transactions`}
              color="text-green-400"
            />
            <StatCard
              icon={TrendingUp}
              label="NGN (Recent 10)"
              value={`₦${ngnTotal.toLocaleString()}`}
              sub="Last 10 completed"
              color="text-emerald-400"
            />
            <StatCard
              icon={TrendingUp}
              label="USD/Other (Recent 10)"
              value={`$${usdTotal.toLocaleString()}`}
              sub="Last 10 completed"
              color="text-cyan-400"
            />
            <StatCard
              icon={Users}
              label="Total Donors"
              value={givingStats?.totalDonations ?? "—"}
              sub="Confirmed payments only"
              color="text-violet-400"
            />
          </div>
        </section>

        {/* Recent Giving Log */}
        {recentLogs.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-primary mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-400" /> Recent Transactions
            </h2>
            <div className="rounded-2xl border border-border/50 bg-card/60 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-muted-foreground text-xs uppercase tracking-widest">
                    <th className="text-left px-5 py-3 font-semibold">Donor</th>
                    <th className="text-left px-5 py-3 font-semibold">Amount</th>
                    <th className="text-left px-5 py-3 font-semibold">Purpose</th>
                    <th className="text-left px-5 py-3 font-semibold">Method</th>
                    <th className="text-left px-5 py-3 font-semibold">Status</th>
                    <th className="text-left px-5 py-3 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {recentLogs.map(log => (
                    <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3 font-medium text-primary">
                        {log.donorName ?? <span className="text-muted-foreground italic">Anonymous</span>}
                      </td>
                      <td className="px-5 py-3 font-mono text-sm">
                        {log.currency === "NGN" ? "₦" : "$"}
                        {log.amount.toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground capitalize">{log.purpose ?? "—"}</td>
                      <td className="px-5 py-3 text-muted-foreground capitalize">{log.paymentMethod ?? "—"}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold
                          ${log.status === "success"
                            ? "bg-green-500/15 text-green-400"
                            : log.status === "pending"
                            ? "bg-amber-500/15 text-amber-400"
                            : "bg-red-500/15 text-red-400"
                          }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground text-xs">
                        {new Date(log.createdAt).toLocaleDateString("en-GB", {
                          day: "2-digit", month: "short", year: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* AdSense Diagnostics */}
        {adsense && (
          <section>
            <h2 className="text-base font-semibold text-primary mb-4 flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-amber-400" /> AdSense Configuration
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              <div className="rounded-2xl border border-border/50 bg-card/60 p-5 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Publisher</p>
                <p className="font-mono text-sm text-primary">{adsense.publisherId}</p>
                <div className="flex flex-wrap gap-3 items-center">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${adsense.publisherValid ? "text-green-400" : "text-red-400"}`}>
                    {adsense.publisherValid ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    {adsense.publisherValid ? "Publisher ID valid" : "Publisher ID invalid"}
                  </span>
                  <AdsTxtBadge status={adsense.adsTxt.status} />
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>
                    Slots configured:{" "}
                    <strong className={adsense.configuredSlots === adsense.totalSlots ? "text-green-400" : "text-amber-400"}>
                      {adsense.configuredSlots}/{adsense.totalSlots}
                    </strong>
                  </span>
                  <span>
                    Auto-ads flag:{" "}
                    <strong className={adsense.enableFlag ? "text-green-400" : "text-muted-foreground"}>
                      {adsense.enableFlag ? "on" : "prod-only"}
                    </strong>
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-border/50 bg-card/60 p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Quick Links</p>
                <div className="space-y-2">
                  {[
                    { label: "AdSense Dashboard", href: "https://www.google.com/adsense/new/u/0/pub-6817509745606083/home" },
                    { label: "Ad Units", href: "https://www.google.com/adsense/new/u/0/pub-6817509745606083/myads/units" },
                    { label: "Performance Reports", href: "https://www.google.com/adsense/new/u/0/pub-6817509745606083/report" },
                    { label: "Policy Center", href: "https://www.google.com/adsense/new/u/0/pub-6817509745606083/policy" },
                    { label: "Google Search Console", href: "https://search.google.com/search-console" },
                    { label: "PageSpeed Insights", href: "https://pagespeed.web.dev/report?url=https://jctm.org.ng" },
                  ].map(link => (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors group"
                    >
                      <ExternalLink className="h-3.5 w-3.5 group-hover:text-primary" />
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* Slot table */}
            <div className="rounded-2xl border border-border/50 bg-card/60 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-muted-foreground text-xs uppercase tracking-widest">
                    <th className="text-left px-5 py-3 font-semibold">Ad Slot</th>
                    <th className="text-left px-5 py-3 font-semibold">Slot ID</th>
                    <th className="text-left px-5 py-3 font-semibold">Source</th>
                    <th className="text-left px-5 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {adsense.slots.map(slot => (
                    <tr key={slot.name} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3 font-medium text-primary capitalize">{slot.name}</td>
                      <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                        {slot.slotId ?? <span className="italic">using fallback</span>}
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground font-mono">{slot.envKey}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${slot.configured ? "bg-green-500/15 text-green-400" : "bg-muted/60 text-muted-foreground"}`}>
                          {slot.configured ? <CheckCircle2 className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          {slot.configured ? "env var set" : "fallback"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Revenue Estimation Panel */}
        <section>
          <h2 className="text-base font-semibold text-primary mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-400" /> Revenue Channels
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                label: "Display Ads (AdSense)",
                desc: "Google-served banner and in-feed ads. Revenue improves with higher page views, better Core Web Vitals, and more content pages.",
                tips: ["Enable auto ads in AdSense Console", "Add more blog content for CPC", "Check PageSpeed Insights"],
                color: "border-amber-500/30 bg-amber-500/5",
                badge: "Active",
                badgeColor: "text-amber-400 bg-amber-500/15",
              },
              {
                label: "Online Giving",
                desc: "Tithes, offerings, and mission support via Paystack (NGN) and Stripe (USD). Also accepts bank transfer.",
                tips: ["Promote giving on sermon pages", "Add giving link to emails", "Add giving to YouTube description"],
                color: "border-green-500/30 bg-green-500/5",
                badge: "Active",
                badgeColor: "text-green-400 bg-green-500/15",
              },
              {
                label: "Ministry Partnerships",
                desc: "Sponsorship tiers for businesses and organizations that want visibility on the JCTM platform.",
                tips: ["Launch Partner page at /partner", "Offer logo placement in videos", "Promote to local Warri businesses"],
                color: "border-blue-500/30 bg-blue-500/5",
                badge: "Available",
                badgeColor: "text-blue-400 bg-blue-500/15",
              },
            ].map(ch => (
              <div key={ch.label} className={`rounded-2xl border p-5 space-y-3 ${ch.color}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-primary text-sm">{ch.label}</p>
                  <span className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${ch.badgeColor}`}>
                    {ch.badge}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{ch.desc}</p>
                <ul className="space-y-1">
                  {ch.tips.map(tip => (
                    <li key={tip} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <span className="text-primary mt-0.5">›</span> {tip}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <p className="text-xs text-muted-foreground text-center">
          Last refreshed {adsense ? new Date(adsense.checkedAt).toLocaleTimeString() : "—"} ·
          Ad impression data available in the{" "}
          <a href="https://www.google.com/adsense/" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
            AdSense Console
          </a>
        </p>
      </div>
    </Layout>
  );
}

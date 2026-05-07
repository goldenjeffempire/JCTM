import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import {
  DollarSign, TrendingUp, Users, BarChart3, ExternalLink, RefreshCw,
  CheckCircle2, XCircle, AlertCircle, Lock, Eye, Heart, Megaphone,
  FileText, Globe, Handshake, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface MonetizationAnalytics {
  period: string;
  pageViews: {
    total: number;
    byDay: { day: string; views: number; adSlots: number }[];
    byPage: { page: string; views: number; avgSlots: number }[];
  };
  adInventory: { totalSlotImpressions: number; estimatedEcpm: string; estimatedRevenue: string };
  consent: Record<string, number>;
  partnerships: { new: number; contacted: number; active: number; declined: number; total: number };
  giving30d: { total: number; donors: number; ngn: number; usd: number };
  generatedAt: string;
}

interface PartnerInquiry {
  id: number;
  name: string;
  email: string;
  organization: string;
  tier: string;
  message: string;
  status: string;
  created_at: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, sub, color = "text-blue-400",
}: { icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string }) {
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
    ok:      { icon: CheckCircle2, color: "text-green-400",        label: "ads.txt OK" },
    missing: { icon: XCircle,      color: "text-red-400",          label: "ads.txt Missing" },
    wrong:   { icon: AlertCircle,  color: "text-amber-400",        label: "ads.txt Wrong publisher" },
    error:   { icon: AlertCircle,  color: "text-red-400",          label: "ads.txt Error reading" },
  }[status] ?? { icon: AlertCircle, color: "text-muted-foreground", label: "Unknown" };
  const { icon: Icon, color, label } = cfg;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${color}`}>
      <Icon className="h-4 w-4" /> {label}
    </span>
  );
}

const STATUS_COLORS: Record<string, string> = {
  new:       "bg-blue-500/15 text-blue-400",
  contacted: "bg-amber-500/15 text-amber-400",
  active:    "bg-green-500/15 text-green-400",
  declined:  "bg-red-500/15 text-red-400",
};

function PartnerRow({
  inquiry, token, onUpdate,
}: { inquiry: PartnerInquiry; token: string; onUpdate: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [updating, setUpdating] = useState(false);

  async function setStatus(status: string) {
    setUpdating(true);
    try {
      await fetch(`${BASE}/api/monetization/partners/${inquiry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      onUpdate();
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="border-b border-border/30 last:border-0">
      <div
        className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/20 cursor-pointer transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-primary text-sm truncate">{inquiry.name}</p>
          <p className="text-xs text-muted-foreground truncate">{inquiry.email} · {inquiry.tier}</p>
        </div>
        <span className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[inquiry.status] ?? "bg-muted/60 text-muted-foreground"}`}>
          {inquiry.status}
        </span>
        <span className="text-xs text-muted-foreground hidden sm:block flex-shrink-0">
          {new Date(inquiry.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
        </span>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
      </div>

      {expanded && (
        <div className="px-5 pb-4 space-y-3">
          {inquiry.organization && (
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Organization:</span> {inquiry.organization}
            </p>
          )}
          {inquiry.message && (
            <p className="text-sm text-muted-foreground bg-muted/20 rounded-xl p-3 leading-relaxed">
              {inquiry.message}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {(["new", "contacted", "active", "declined"] as const).map(s => (
              <button
                key={s}
                disabled={updating || inquiry.status === s}
                onClick={() => setStatus(s)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors disabled:opacity-50
                  ${inquiry.status === s
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border hover:border-primary/40 hover:bg-muted/40 text-muted-foreground"}`}
              >
                {s}
              </button>
            ))}
            <a
              href={`mailto:${inquiry.email}?subject=Partnership Inquiry — ${inquiry.tier}&body=Dear ${inquiry.name},%0D%0A%0D%0AThank you for your interest in partnering with Jesus Christ Temple Ministry.`}
              className="text-xs font-semibold px-3 py-1.5 rounded-full border border-accent/40 text-accent hover:bg-accent/10 transition-colors"
            >
              Reply by Email
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

const PIE_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#6366f1"];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminMonetization() {
  const [token, setToken]               = useState<string>(() => localStorage.getItem("adminToken") ?? "");
  const [tokenInput, setTokenInput]     = useState("");
  const [givingStats, setGivingStats]   = useState<GivingStats | null>(null);
  const [recentLogs, setRecentLogs]     = useState<GivingLog[]>([]);
  const [adsense, setAdsense]           = useState<AdsenseDiagnostics | null>(null);
  const [analytics, setAnalytics]       = useState<MonetizationAnalytics | null>(null);
  const [partners, setPartners]         = useState<PartnerInquiry[]>([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");
  const [activeTab, setActiveTab]       = useState<"overview" | "ads" | "partners" | "giving">("overview");

  const load = useCallback(async (tok: string) => {
    if (!tok) return;
    setLoading(true);
    setError("");
    try {
      const headers = { Authorization: `Bearer ${tok}` };
      const [statsRes, logsRes, adsRes, analyticsRes, partnersRes] = await Promise.all([
        fetch(`${BASE}/api/giving/stats`),
        fetch(`${BASE}/api/giving?limit=20`, { headers }),
        fetch(`${BASE}/api/admin/adsense-diagnostics`, { headers }),
        fetch(`${BASE}/api/monetization/analytics`, { headers }),
        fetch(`${BASE}/api/monetization/partners?limit=50`, { headers }),
      ]);

      if (!logsRes.ok && logsRes.status === 401) {
        setError("Invalid admin token. Please check and try again.");
        setLoading(false);
        return;
      }

      const [stats, logs, ads, analyticsData, partnersData] = await Promise.all([
        statsRes.json(),
        logsRes.ok ? logsRes.json() : [],
        adsRes.ok  ? adsRes.json()  : null,
        analyticsRes.ok ? analyticsRes.json() : null,
        partnersRes.ok  ? partnersRes.json()  : null,
      ]);

      setGivingStats(stats);
      setRecentLogs(Array.isArray(logs) ? logs : (logs.logs ?? []));
      setAdsense(ads);
      setAnalytics(analyticsData);
      setPartners(partnersData?.inquiries ?? []);
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

  useEffect(() => { if (token) load(token); }, [token, load]);

  const ngnTotal = recentLogs.filter(l => l.currency === "NGN" && l.status === "success").reduce((a, l) => a + l.amount, 0);
  const usdTotal = recentLogs.filter(l => l.currency !== "NGN" && l.status === "success").reduce((a, l) => a + l.amount, 0);

  // Consent pie data
  const consentData = analytics
    ? Object.entries(analytics.consent).map(([name, value]) => ({ name, value }))
    : [];

  // Login gate
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

  const TABS = [
    { id: "overview" as const, label: "Overview",    icon: BarChart3 },
    { id: "ads"      as const, label: "Ad Config",   icon: Megaphone },
    { id: "partners" as const, label: "Partners",    icon: Handshake },
    { id: "giving"   as const, label: "Giving",      icon: Heart },
  ];

  return (
    <Layout>
      <SEO title="Monetization Dashboard — Admin | JCTM" noIndex />
      <div className="container mx-auto px-4 py-10 max-w-6xl space-y-8">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary">Monetization Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Revenue, giving, ad analytics &amp; partner inquiries — JCTM Digital Sanctuary
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
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              AdSense Console
            </a>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-muted/30 border border-border/40 w-fit">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === tab.id
                  ? "bg-background border border-border/60 text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
              {tab.id === "partners" && analytics?.partnerships.new ? (
                <span className="ml-0.5 rounded-full bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 leading-none">
                  {analytics.partnerships.new}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* ── Overview Tab ──────────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div className="space-y-8">
            {/* KPI row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={Globe}
                label="Page Views (30d)"
                value={analytics?.pageViews.total.toLocaleString() ?? "—"}
                sub="Internal ad-inventory tracking"
                color="text-blue-400"
              />
              <StatCard
                icon={Eye}
                label="Ad Slot Impressions (30d)"
                value={analytics?.adInventory.totalSlotImpressions.toLocaleString() ?? "—"}
                sub={`~$${analytics?.adInventory.estimatedRevenue ?? "0"} est. at $0.40 eCPM`}
                color="text-amber-400"
              />
              <StatCard
                icon={DollarSign}
                label="Giving (30d)"
                value={analytics ? `₦${analytics.giving30d.ngn.toLocaleString()}` : "—"}
                sub={`+ $${analytics?.giving30d.usd.toLocaleString() ?? 0} USD · ${analytics?.giving30d.donors ?? 0} donors`}
                color="text-green-400"
              />
              <StatCard
                icon={Handshake}
                label="Partner Inquiries"
                value={analytics?.partnerships.total ?? "—"}
                sub={`${analytics?.partnerships.new ?? 0} new · ${analytics?.partnerships.active ?? 0} active`}
                color="text-violet-400"
              />
            </div>

            {/* Page views area chart */}
            {analytics && analytics.pageViews.byDay.length > 0 && (
              <section className="rounded-2xl border border-border/50 bg-card/60 p-6">
                <h2 className="text-sm font-semibold text-primary mb-4 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-blue-400" /> Page Views &amp; Ad Impressions — Last 30 Days
                </h2>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={analytics.pageViews.byDay} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="gViews" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gSlots" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                      labelStyle={{ color: "hsl(var(--primary))", fontWeight: 600 }}
                    />
                    <Area type="monotone" dataKey="views" name="Page Views" stroke="#3b82f6" fill="url(#gViews)" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="adSlots" name="Ad Impressions" stroke="#f59e0b" fill="url(#gSlots)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </section>
            )}

            {/* Bottom row: top pages + consent breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top pages bar chart */}
              {analytics && analytics.pageViews.byPage.length > 0 && (
                <section className="rounded-2xl border border-border/50 bg-card/60 p-6">
                  <h2 className="text-sm font-semibold text-primary mb-4 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-400" /> Top Pages by Views
                  </h2>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={analytics.pageViews.byPage.slice(0, 8)} layout="vertical" margin={{ left: 8, right: 16, top: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis type="category" dataKey="page" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} width={80} />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                      />
                      <Bar dataKey="views" name="Views" fill="#3b82f6" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </section>
              )}

              {/* Consent pie */}
              {consentData.length > 0 && (
                <section className="rounded-2xl border border-border/50 bg-card/60 p-6">
                  <h2 className="text-sm font-semibold text-primary mb-4 flex items-center gap-2">
                    <Users className="h-4 w-4 text-violet-400" /> Visitor Consent Breakdown
                  </h2>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={consentData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                        {consentData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    "full" = advertising accepted · "essential" = denied · "pending" = no decision yet
                  </p>
                </section>
              )}
            </div>

            {/* Revenue channels */}
            <section>
              <h2 className="text-sm font-semibold text-primary mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-400" /> Revenue Channels
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  {
                    label: "Display Ads (AdSense)",
                    desc: "Google-served banner and in-feed ads. Revenue improves with higher page views, better Core Web Vitals, and more content pages.",
                    tips: ["Enable auto ads in AdSense Console", "Add more blog content for CPC", "Check PageSpeed Insights"],
                    color: "border-amber-500/30 bg-amber-500/5",
                    badge: "Active", badgeColor: "text-amber-400 bg-amber-500/15",
                  },
                  {
                    label: "Online Giving",
                    desc: "Tithes, offerings, and mission support via Paystack (NGN) and Stripe (USD). Also accepts bank transfer.",
                    tips: ["Promote giving on sermon pages", "Add giving link to emails", "Add giving to YouTube description"],
                    color: "border-green-500/30 bg-green-500/5",
                    badge: "Active", badgeColor: "text-green-400 bg-green-500/15",
                  },
                  {
                    label: "Ministry Partnerships",
                    desc: "Sponsorship tiers for businesses and organizations that want visibility on the JCTM platform.",
                    tips: ["Launch Partner page at /partner", "Offer logo placement in videos", "Promote to local Warri businesses"],
                    color: "border-blue-500/30 bg-blue-500/5",
                    badge: analytics && analytics.partnerships.active > 0 ? "Active" : "Available",
                    badgeColor: analytics && analytics.partnerships.active > 0 ? "text-green-400 bg-green-500/15" : "text-blue-400 bg-blue-500/15",
                  },
                ].map(ch => (
                  <div key={ch.label} className={`rounded-2xl border p-5 space-y-3 ${ch.color}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-primary text-sm">{ch.label}</p>
                      <span className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${ch.badgeColor}`}>{ch.badge}</span>
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
          </div>
        )}

        {/* ── Ad Config Tab ─────────────────────────────────────────────────── */}
        {activeTab === "ads" && adsense && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                  <span>Slots: <strong className={adsense.configuredSlots === adsense.totalSlots ? "text-green-400" : "text-amber-400"}>{adsense.configuredSlots}/{adsense.totalSlots}</strong></span>
                  <span>Auto-ads: <strong className={adsense.enableFlag ? "text-green-400" : "text-muted-foreground"}>{adsense.enableFlag ? "on" : "prod-only"}</strong></span>
                </div>
              </div>

              <div className="rounded-2xl border border-border/50 bg-card/60 p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Quick Links</p>
                <div className="space-y-2">
                  {[
                    { label: "AdSense Dashboard",     href: "https://www.google.com/adsense/new/u/0/pub-6817509745706083/home" },
                    { label: "Ad Units",              href: "https://www.google.com/adsense/new/u/0/pub-6817509745706083/myads/units" },
                    { label: "Performance Reports",   href: "https://www.google.com/adsense/new/u/0/pub-6817509745706083/report" },
                    { label: "Policy Center",         href: "https://www.google.com/adsense/new/u/0/pub-6817509745706083/policy" },
                    { label: "Google Search Console", href: "https://search.google.com/search-console" },
                    { label: "PageSpeed Insights",    href: "https://pagespeed.web.dev/report?url=https://jctm.org.ng" },
                  ].map(link => (
                    <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors group">
                      <ExternalLink className="h-3.5 w-3.5 group-hover:text-primary" />
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/50 bg-card/60 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-muted-foreground text-xs uppercase tracking-widest">
                    <th className="text-left px-5 py-3 font-semibold">Ad Slot</th>
                    <th className="text-left px-5 py-3 font-semibold">Slot ID</th>
                    <th className="text-left px-5 py-3 font-semibold">Env Var</th>
                    <th className="text-left px-5 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {adsense.slots.map(slot => (
                    <tr key={slot.name} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3 font-medium text-primary capitalize">{slot.name}</td>
                      <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{slot.slotId ?? <span className="italic">using fallback</span>}</td>
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
          </div>
        )}

        {/* ── Partners Tab ──────────────────────────────────────────────────── */}
        {activeTab === "partners" && (
          <div className="space-y-6">
            {analytics && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "New",       value: analytics.partnerships.new,       color: "text-blue-400" },
                  { label: "Contacted", value: analytics.partnerships.contacted,  color: "text-amber-400" },
                  { label: "Active",    value: analytics.partnerships.active,     color: "text-green-400" },
                  { label: "Declined",  value: analytics.partnerships.declined,   color: "text-red-400" },
                ].map(s => (
                  <div key={s.label} className="rounded-2xl border border-border/50 bg-card/60 p-4 text-center">
                    <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {partners.length === 0 ? (
              <div className="rounded-2xl border border-border/50 bg-card/60 p-10 text-center text-muted-foreground text-sm">
                No partnership inquiries yet. Share the{" "}
                <a href="/partner" className="text-primary underline">/partner</a> page to attract sponsors.
              </div>
            ) : (
              <div className="rounded-2xl border border-border/50 bg-card/60 overflow-hidden">
                {partners.map(inquiry => (
                  <PartnerRow key={inquiry.id} inquiry={inquiry} token={token} onUpdate={() => load(token)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Giving Tab ────────────────────────────────────────────────────── */}
        {activeTab === "giving" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={DollarSign} label="Total Confirmed" value={givingStats ? `₦${givingStats.totalAmount.toLocaleString()}` : "—"} sub={`${givingStats?.totalDonations ?? 0} total transactions`} color="text-green-400" />
              <StatCard icon={TrendingUp} label="NGN (Recent 20)" value={`₦${ngnTotal.toLocaleString()}`} sub="Last 20 completed" color="text-emerald-400" />
              <StatCard icon={TrendingUp} label="USD/Other (Recent 20)" value={`$${usdTotal.toLocaleString()}`} sub="Last 20 completed" color="text-cyan-400" />
              <StatCard icon={Users} label="Total Donors" value={givingStats?.totalDonations ?? "—"} sub="Confirmed payments only" color="text-violet-400" />
            </div>

            {recentLogs.length > 0 && (
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
                        <td className="px-5 py-3 font-medium text-primary">{log.donorName ?? <span className="text-muted-foreground italic">Anonymous</span>}</td>
                        <td className="px-5 py-3 font-mono text-sm">{log.currency === "NGN" ? "₦" : "$"}{log.amount.toLocaleString()}</td>
                        <td className="px-5 py-3 text-muted-foreground capitalize">{log.purpose ?? "—"}</td>
                        <td className="px-5 py-3 text-muted-foreground capitalize">{log.paymentMethod ?? "—"}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${log.status === "success" ? "bg-green-500/15 text-green-400" : log.status === "pending" ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400"}`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-muted-foreground text-xs">
                          {new Date(log.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Last refreshed {analytics ? new Date(analytics.generatedAt).toLocaleTimeString() : adsense ? new Date(adsense.checkedAt).toLocaleTimeString() : "—"} ·
          Ad impression data also available in the{" "}
          <a href="https://www.google.com/adsense/" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">AdSense Console</a>
        </p>
      </div>
    </Layout>
  );
}

import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { motion } from "framer-motion";
import {
  Star,
  CheckCircle2,
  Mail,
  Globe,
  Megaphone,
  Users,
  Heart,
  ArrowRight,
  Building2,
} from "lucide-react";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const TIERS = [
  {
    id: "bronze",
    name: "Covenant Partner",
    naira: "₦25,000",
    usd: "$25",
    freq: "per month",
    color: "border-amber-700/40 bg-amber-900/10",
    badge: "text-amber-600 bg-amber-500/15",
    icon: "🤝",
    benefits: [
      "Name listed in our monthly prayer bulletin",
      "Partner certificate of appreciation",
      "Access to premium devotional emails",
      "Prayer covering by JCTM prayer team",
    ],
  },
  {
    id: "silver",
    name: "Ministry Sponsor",
    naira: "₦100,000",
    usd: "$100",
    freq: "per month",
    color: "border-slate-400/50 bg-slate-400/5",
    badge: "text-slate-300 bg-slate-400/15",
    icon: "🌟",
    benefits: [
      "Everything in Covenant Partner",
      "Logo on JCTM website footer",
      "Business listed in monthly newsletter (1,000+ subscribers)",
      "Monthly acknowledgment in Temple TV broadcasts",
      "Social media mention (1× per month)",
    ],
    popular: true,
  },
  {
    id: "gold",
    name: "Platform Partner",
    naira: "₦500,000",
    usd: "$500",
    freq: "per month",
    color: "border-yellow-500/40 bg-yellow-500/5",
    badge: "text-yellow-400 bg-yellow-500/15",
    icon: "👑",
    benefits: [
      "Everything in Ministry Sponsor",
      "Featured logo on sermon & events pages",
      "Dedicated spotlight article on JCTM blog",
      "Branded segment in 1 Temple TV broadcast/month",
      "Weekly social media post",
      "Direct line to JCTM leadership team",
    ],
  },
  {
    id: "platinum",
    name: "Apostolic Alliance",
    naira: "Custom",
    usd: "Custom",
    freq: "tailored package",
    color: "border-purple-500/40 bg-purple-500/5",
    badge: "text-purple-400 bg-purple-500/15",
    icon: "⚡",
    benefits: [
      "Everything in Platform Partner",
      "Premier branding across all JCTM platforms",
      "Co-branded crusade or conference sponsorship",
      "Exclusive naming rights for a ministry initiative",
      "Executive meeting with Prophet Amos Evomobor",
      "Custom partnership agreement",
    ],
  },
];

const STATS = [
  { label: "Monthly Website Visitors", value: "20,000+", icon: Globe },
  { label: "YouTube Subscribers", value: "Temple TV", icon: Megaphone },
  { label: "Newsletter Subscribers", value: "1,000+", icon: Mail },
  { label: "Nations Reached", value: "40+", icon: Users },
];

export default function Partner() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    organization: "",
    tier: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.email || !form.tier) {
      toast.error("Please fill in your name, email, and partnership tier.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE}/api/partner/inquiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          organization: form.organization,
          tier: form.tier,
          message: form.message,
        }),
      });
      if (!res.ok) {
        throw new Error("Server error");
      }
      setSubmitted(true);
      toast.success("Partnership inquiry sent! We'll reach out within 48 hours.");
    } catch {
      toast.error("Failed to send inquiry. Please email info@jctm.org.ng directly.");
    }
    setSubmitting(false);
  }

  return (
    <Layout>
      <SEO
        title="Partner With JCTM | Ministry Partnership & Sponsorship"
        description="Partner with Jesus Christ Temple Ministry to reach over 40 nations with the Correction Mandate. Sponsorship tiers for individuals, businesses, and organizations."
        canonicalPath="/partner"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "JCTM Ministry Partnership",
          description: "Sponsorship and partnership opportunities with Jesus Christ Temple Ministry",
          url: "https://jctm.org.ng/partner",
        }}
      />

      {/* Hero */}
      <section className="relative py-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background pointer-events-none" />
        <div className="relative container mx-auto max-w-3xl text-center space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary mb-4">
              <Star className="h-3.5 w-3.5" /> Ministry Partnership
            </span>
            <h1 className="text-4xl md:text-5xl font-bold text-primary leading-tight">
              Partner With the<br />Correction Mandate
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Join Jesus Christ Temple Ministry in spreading Primitive Apostolic Christianity
              to over 40 nations. Your partnership funds free sermons, AI ministry tools,
              crusades, and content that reaches thousands daily.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Reach Stats */}
      <section className="pb-12 px-4">
        <div className="container mx-auto max-w-4xl grid grid-cols-2 md:grid-cols-4 gap-4">
          {STATS.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-2xl border border-border/50 bg-card/60 p-5 text-center space-y-2">
              <Icon className="h-5 w-5 mx-auto text-primary opacity-70" />
              <p className="text-xl font-bold text-primary">{value}</p>
              <p className="text-xs text-muted-foreground leading-tight">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tiers */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-10 space-y-2">
            <h2 className="text-2xl font-bold text-primary">Partnership Tiers</h2>
            <p className="text-sm text-muted-foreground">
              Choose the tier that aligns with your capacity and calling.
              All funds support free ministry content and outreach.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {TIERS.map((tier, i) => (
              <motion.div
                key={tier.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className={`relative rounded-2xl border p-6 flex flex-col space-y-4 ${tier.color} ${"popular" in tier && tier.popular ? "ring-2 ring-primary/40" : ""}`}
              >
                {"popular" in tier && tier.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-bold text-primary-foreground">
                    Most Popular
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{tier.icon}</span>
                  <div>
                    <p className="font-bold text-primary text-sm">{tier.name}</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tier.badge}`}>
                      {tier.id.charAt(0).toUpperCase() + tier.id.slice(1)}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-2xl font-bold text-primary">{tier.naira}</p>
                  <p className="text-xs text-muted-foreground">{tier.usd} · {tier.freq}</p>
                </div>

                <ul className="flex-1 space-y-2">
                  {tier.benefits.map(b => (
                    <li key={b} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-400 flex-shrink-0 mt-0.5" />
                      {b}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => {
                    setForm(f => ({ ...f, tier: tier.name }));
                    document.getElementById("partner-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="w-full rounded-xl border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary text-sm font-semibold py-2.5 transition-colors flex items-center justify-center gap-2"
                >
                  Enquire <ArrowRight className="h-4 w-4" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Partner */}
      <section className="py-12 px-4 bg-muted/10">
        <div className="container mx-auto max-w-3xl text-center space-y-6">
          <h2 className="text-2xl font-bold text-primary">Why Partner With JCTM?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {[
              {
                icon: Heart,
                title: "Kingdom Impact",
                desc: "Every naira and dollar funds free sermon streaming, AI ministry tools, crusades, and gospel content reaching believers in 40+ nations.",
              },
              {
                icon: Globe,
                title: "Digital Reach",
                desc: "Your brand or name is associated with JCTM's growing digital platform — website, YouTube, newsletters, and social media.",
              },
              {
                icon: Building2,
                title: "Community Trust",
                desc: "JCTM is a trusted Warri institution since 2013. Partnership gives local and international businesses access to a faith-committed audience.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-2xl border border-border/50 bg-card/60 p-5 space-y-2">
                <Icon className="h-5 w-5 text-primary opacity-80" />
                <p className="font-semibold text-primary text-sm">{title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Inquiry Form */}
      <section id="partner-form" className="py-16 px-4">
        <div className="container mx-auto max-w-xl">
          <div className="text-center mb-8 space-y-2">
            <h2 className="text-2xl font-bold text-primary">Express Your Interest</h2>
            <p className="text-sm text-muted-foreground">
              Fill in the form below and our team will reach out within 48 hours to discuss your partnership.
            </p>
          </div>

          {submitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border border-green-500/30 bg-green-500/10 p-8 text-center space-y-3"
            >
              <CheckCircle2 className="h-10 w-10 text-green-400 mx-auto" />
              <p className="font-bold text-primary text-lg">Inquiry Received!</p>
              <p className="text-sm text-muted-foreground">
                Thank you for your interest in partnering with JCTM.
                Our leadership team will contact you within 48 hours at your provided email.
              </p>
              <p className="text-sm text-muted-foreground">
                You may also email us directly at{" "}
                <a href="mailto:info@jctm.org.ng" className="text-primary underline">info@jctm.org.ng</a>
              </p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Full Name *</label>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    required
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Email Address *</label>
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    required
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Organization / Business Name</label>
                <input
                  name="organization"
                  value={form.organization}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="Optional — leave blank for individual partnership"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Partnership Tier *</label>
                <select
                  name="tier"
                  value={form.tier}
                  onChange={handleChange}
                  required
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">Select a tier…</option>
                  {TIERS.map(t => (
                    <option key={t.id} value={t.name}>{t.name} ({t.naira}/{t.usd} {t.freq})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Additional Message</label>
                <textarea
                  name="message"
                  value={form.message}
                  onChange={handleChange}
                  rows={4}
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                  placeholder="Tell us about your organization and what you hope to achieve through this partnership…"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting ? "Sending…" : (
                  <>Send Partnership Inquiry <ArrowRight className="h-4 w-4" /></>
                )}
              </button>

              <p className="text-center text-xs text-muted-foreground">
                Prefer to give directly?{" "}
                <a href="/give" className="text-primary underline">Visit the Giving page</a>
              </p>
            </form>
          )}
        </div>
      </section>
    </Layout>
  );
}

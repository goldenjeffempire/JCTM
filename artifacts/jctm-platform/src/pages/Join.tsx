import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  User, LogIn, LogOut, BookOpen, Heart, ChevronRight,
  CheckCircle, Eye, EyeOff, Church, Edit3, Save, X,
  Key, Phone, Shield, Star, Flame, ArrowRight, Gift,
  TrendingUp, Award, Compass, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { safeLocalGet, safeLocalRemove, safeLocalSet } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Member {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  role?: string;
  createdAt: string;
}

interface JourneySummary {
  ok: boolean;
  member: { firstName: string; lastName: string; email: string; daysMember: number; joinedAt: string };
  activity: { testimonies: number; givingCount: number; givingTotal: number };
  maturity: { level: string; score: number; nextLevel: string; progressPct: number };
  badges: Array<{ id: string; label: string; icon: string; earned: boolean; desc: string }>;
  earnedBadges: number;
  totalBadges: number;
  nextSteps: Array<{ label: string; href: string; desc: string; icon: string }>;
}

type View = "register" | "login" | "dashboard" | "edit-profile" | "forgot" | "forgot-sent";
type DashTab = "overview" | "journey";

const MATURITY_COLORS: Record<string, string> = {
  Seeker: "from-amber-400 to-orange-500",
  Believer: "from-blue-400 to-cyan-500",
  Faithful: "from-violet-500 to-purple-600",
  Rooted: "from-emerald-400 to-teal-600",
};
const MATURITY_BG: Record<string, string> = {
  Seeker: "bg-amber-50 border-amber-200 text-amber-700",
  Believer: "bg-blue-50 border-blue-200 text-blue-700",
  Faithful: "bg-violet-50 border-violet-200 text-violet-700",
  Rooted: "bg-emerald-50 border-emerald-200 text-emerald-700",
};

export default function Join() {
  const [view, setView] = useState<View>("register");
  const [dashTab, setDashTab] = useState<DashTab>("overview");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [member, setMember] = useState<Member | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  const [regForm, setRegForm] = useState({ firstName: "", lastName: "", email: "", password: "", phone: "" });
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", phone: "", currentPassword: "", newPassword: "" });
  const [forgotEmail, setForgotEmail] = useState("");

  useEffect(() => {
    document.title = "Join | JCTM Digital Sanctuary";
    const t = safeLocalGet("jctm_token");
    if (t) {
      setToken(t);
      fetch(`${BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${t}` } })
        .then(r => r.json())
        .then(data => {
          if (data.id) {
            setMember(data);
            setView("dashboard");
          }
        })
        .catch(() => { safeLocalRemove("jctm_token"); });
    }
  }, []);

  const { data: journey, isLoading: journeyLoading } = useQuery<JourneySummary>({
    queryKey: ["/api/journey/summary", token],
    queryFn: () =>
      fetch(`${BASE}/api/journey/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()),
    enabled: !!token && view === "dashboard" && dashTab === "journey",
    staleTime: 5 * 60 * 1000,
  });

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch(`${BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      if (res.ok) {
        setView("forgot-sent");
      } else {
        const data = await res.json();
        setError(data.error ?? "Something went wrong. Please try again.");
      }
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regForm.password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`${BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: regForm.firstName,
          lastName: regForm.lastName,
          email: regForm.email,
          password: regForm.password,
          phone: regForm.phone || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        safeLocalSet("jctm_token", data.token);
        setToken(data.token);
        setMember(data.member);
        setView("dashboard");
        toast.success("Welcome to the JCTM Digital Sanctuary!");
      } else {
        setError(data.error ?? "Registration failed. Please try again.");
      }
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginForm.email, password: loginForm.password }),
      });
      const data = await res.json();
      if (res.ok) {
        safeLocalSet("jctm_token", data.token);
        setToken(data.token);
        setMember(data.member);
        setView("dashboard");
        toast.success("Welcome back to the Sanctuary!");
      } else {
        setError(data.error ?? "Login failed. Please check your credentials.");
      }
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  };

  const handleLogout = async () => {
    const t = safeLocalGet("jctm_token");
    if (t) {
      try {
        await fetch(`${BASE}/api/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${t}` },
        });
      } catch { /* best-effort */ }
    }
    safeLocalRemove("jctm_token");
    setMember(null);
    setToken(null);
    setView("login");
    setLoginForm({ email: "", password: "" });
    toast.info("Signed out successfully.");
  };

  const openEditProfile = () => {
    if (!member) return;
    setEditForm({
      firstName: member.firstName,
      lastName: member.lastName,
      phone: member.phone ?? "",
      currentPassword: "",
      newPassword: "",
    });
    setError("");
    setView("edit-profile");
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = safeLocalGet("jctm_token");
    if (!t) return;
    if (editForm.newPassword && editForm.newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (editForm.newPassword && !editForm.currentPassword) {
      setError("Current password required to change password.");
      return;
    }
    setLoading(true); setError("");
    try {
      const payload: Record<string, string> = {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        phone: editForm.phone,
      };
      if (editForm.newPassword) {
        payload.currentPassword = editForm.currentPassword;
        payload.newPassword = editForm.newPassword;
      }
      const res = await fetch(`${BASE}/api/auth/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setMember(data.member);
        setView("dashboard");
        toast.success("Profile updated successfully!");
      } else {
        setError(data.error ?? "Update failed. Please try again.");
      }
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  };

  return (
    <Layout>
      <SEO
        title="Join the Digital Sanctuary — JCTM Member Portal"
        description="Register as a member of Jesus Christ Temple Ministry (JCTM) Digital Sanctuary. Access exclusive teachings, connect with believers, and grow in the Correction Mandate."
        path="/join"
        keywords="join JCTM, register Jesus Christ Temple Ministry, JCTM member, digital sanctuary membership"
        breadcrumbs={[
          { name: "Home", url: "https://jctm.org.ng/" },
          { name: "Join JCTM", url: "https://jctm.org.ng/join" },
        ]}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            "@id": "https://jctm.org.ng/join#webpage",
            "name": "Join the JCTM Digital Sanctuary",
            "description": "Register as a member of Jesus Christ Temple Ministry (JCTM) Digital Sanctuary. Access exclusive teachings, connect with believers worldwide, and grow in the Correction Mandate.",
            "url": "https://jctm.org.ng/join",
            "inLanguage": "en-NG",
            "isPartOf": { "@id": "https://jctm.org.ng/#website" },
            "publisher": { "@id": "https://jctm.org.ng/#organization" },
            "potentialAction": {
              "@type": "RegisterAction",
              "name": "Register for JCTM Digital Sanctuary",
              "target": {
                "@type": "EntryPoint",
                "urlTemplate": "https://jctm.org.ng/join",
                "actionPlatform": ["https://schema.org/DesktopWebPlatform", "https://schema.org/MobileWebPlatform"]
              },
              "object": {
                "@type": "ReligiousOrganization",
                "name": "Jesus Christ Temple Ministry (JCTM)",
                "url": "https://jctm.org.ng"
              }
            }
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
              {
                "@type": "Question",
                "name": "Who can join the JCTM Digital Sanctuary?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Anyone who believes in the Lord Jesus Christ and desires to walk in holiness, apostolic doctrine, and the Correction Mandate is welcome to register as a member of the JCTM Digital Sanctuary. Membership is free and open to believers worldwide."
                }
              },
              {
                "@type": "Question",
                "name": "What do I get as a JCTM Digital Sanctuary member?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "As a member you can access your personal spiritual journey dashboard, track your faith growth badges, share testimonies, participate in the community, and connect with JCTM ministries in Warri, Nigeria and across the world."
                }
              }
            ]
          }
        ]}
      />
      <div className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <Church className="h-12 w-12 text-accent mx-auto mb-4" />
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary mb-4">Digital Sanctuary</h1>
          <p className="text-muted-foreground text-lg max-w-lg mx-auto">
            Join the JCTM family online. Access member resources, track your spiritual journey, and connect with the ministry.
          </p>
        </motion.div>

        <div className="max-w-lg mx-auto">
          <AnimatePresence mode="wait">

            {/* ─── DASHBOARD ─── */}
            {view === "dashboard" && member ? (
              <motion.div key="dashboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">

                {/* Profile card */}
                <div className="glass-panel rounded-2xl p-7 border border-accent/20 text-center">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center mx-auto mb-4 shadow-lg shadow-accent/20">
                    <span className="text-white font-bold text-2xl">{member.firstName[0]}{member.lastName[0]}</span>
                  </div>
                  <h2 className="text-2xl font-serif font-bold text-primary mb-1">Welcome, {member.firstName}!</h2>
                  <p className="text-muted-foreground text-sm mb-1">{member.email}</p>
                  {member.phone && <p className="text-xs text-muted-foreground mb-1">{member.phone}</p>}
                  <p className="text-xs text-muted-foreground">
                    Member since {new Date(member.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </p>
                  <div className="mt-3 inline-flex items-center gap-2 text-xs text-accent font-medium">
                    <CheckCircle className="h-3.5 w-3.5" />
                    {member.role === "admin" ? "Administrator" : "Verified Digital Member"}
                  </div>
                  <button
                    onClick={openEditProfile}
                    className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-accent transition-colors mx-auto"
                  >
                    <Edit3 className="h-3.5 w-3.5" /> Edit Profile
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 p-1 bg-muted rounded-xl">
                  {(["overview", "journey"] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setDashTab(tab)}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                        dashTab === tab
                          ? "bg-white shadow text-primary"
                          : "text-muted-foreground hover:text-primary"
                      }`}
                    >
                      {tab === "overview" ? <><BookOpen className="h-3.5 w-3.5" /> Resources</> : <><Star className="h-3.5 w-3.5" /> My Journey</>}
                    </button>
                  ))}
                </div>

                <AnimatePresence mode="wait">

                  {/* ── OVERVIEW TAB ── */}
                  {dashTab === "overview" && (
                    <motion.div key="overview" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                      <div className="glass-panel rounded-2xl p-6 border border-border/50">
                        <h3 className="font-semibold text-primary mb-4">Member Resources</h3>
                        <div className="space-y-3">
                          {[
                            { icon: <BookOpen className="h-4 w-4" />, label: "Sermon Archive", desc: "Access all past sermons", href: "/sermons" },
                            { icon: <Heart className="h-4 w-4" />, label: "Testimony Vault", desc: "Read & share testimonies", href: "/testimonies" },
                            { icon: <ChevronRight className="h-4 w-4" />, label: "Correction Timeline", desc: "Study the 5 corrections", href: "/correction-timeline" },
                          ].map(item => (
                            <a key={item.label} href={item.href} className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/50 transition-colors group">
                              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-white transition-colors">
                                {item.icon}
                              </div>
                              <div className="flex-1">
                                <p className="font-medium text-primary text-sm">{item.label}</p>
                                <p className="text-xs text-muted-foreground">{item.desc}</p>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-accent transition-colors" />
                            </a>
                          ))}
                          {member.role === "admin" && (
                            <a href="/admin/broadcast" className="flex items-center gap-4 p-3 rounded-xl hover:bg-accent/10 transition-colors group border border-accent/20">
                              <div className="w-9 h-9 rounded-lg bg-accent/20 flex items-center justify-center text-accent">
                                <Shield className="h-4 w-4" />
                              </div>
                              <div className="flex-1">
                                <p className="font-medium text-accent text-sm">Admin Panel</p>
                                <p className="text-xs text-muted-foreground">Manage platform content</p>
                              </div>
                              <ChevronRight className="h-4 w-4 text-accent" />
                            </a>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* ── JOURNEY TAB ── */}
                  {dashTab === "journey" && (
                    <motion.div key="journey" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">

                      {journeyLoading ? (
                        <div className="glass-panel rounded-2xl p-10 border border-border/50 text-center">
                          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                          <p className="text-sm text-muted-foreground">Loading your journey…</p>
                        </div>
                      ) : journey?.ok ? (
                        <>
                          {/* Spiritual Maturity Card */}
                          <div className="glass-panel rounded-2xl p-6 border border-border/50 overflow-hidden relative">
                            <div className={`absolute inset-0 bg-gradient-to-br ${MATURITY_COLORS[journey.maturity.level] ?? "from-accent to-primary"} opacity-5`} />
                            <div className="relative">
                              <div className="flex items-center justify-between mb-4">
                                <div>
                                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Spiritual Maturity</p>
                                  <h3 className="text-2xl font-serif font-bold text-primary">{journey.maturity.level}</h3>
                                </div>
                                <span className={`text-3xl`}>
                                  {journey.maturity.level === "Seeker" ? "🌱" : journey.maturity.level === "Believer" ? "🕊️" : journey.maturity.level === "Faithful" ? "⚡" : "🌳"}
                                </span>
                              </div>

                              {/* Maturity progress bar */}
                              <div className="mb-3">
                                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                                  <span>{journey.maturity.level}</span>
                                  {journey.maturity.level !== "Rooted" && <span>{journey.maturity.nextLevel}</span>}
                                </div>
                                <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                                  <motion.div
                                    className={`h-full rounded-full bg-gradient-to-r ${MATURITY_COLORS[journey.maturity.level] ?? "from-accent to-primary"}`}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min(100, journey.maturity.progressPct)}%` }}
                                    transition={{ duration: 1.2, ease: "easeOut" }}
                                  />
                                </div>
                                {journey.maturity.level !== "Rooted" && (
                                  <p className="text-xs text-muted-foreground mt-1.5">
                                    {journey.maturity.progressPct}% toward {journey.maturity.nextLevel}
                                  </p>
                                )}
                              </div>

                              {/* Maturity levels row */}
                              <div className="flex gap-1.5 mt-3">
                                {["Seeker", "Believer", "Faithful", "Rooted"].map((lvl, i) => {
                                  const levels = ["Seeker", "Believer", "Faithful", "Rooted"];
                                  const currentIdx = levels.indexOf(journey.maturity.level);
                                  const isPast = i <= currentIdx;
                                  return (
                                    <div key={lvl} className={`flex-1 text-center py-1.5 rounded-lg text-[10px] font-medium border transition-all ${isPast ? `${MATURITY_BG[lvl]} border-current` : "bg-muted/50 border-border/30 text-muted-foreground/50"}`}>
                                      {lvl}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          {/* Activity Stats */}
                          <div className="grid grid-cols-3 gap-3">
                            {[
                              { label: "Days in Faith", value: journey.member.daysMember, icon: <Flame className="h-4 w-4" />, color: "text-orange-500" },
                              { label: "Testimonies", value: journey.activity.testimonies, icon: <Star className="h-4 w-4" />, color: "text-amber-500" },
                              { label: "Kingdom Gifts", value: journey.activity.givingCount, icon: <Gift className="h-4 w-4" />, color: "text-emerald-500" },
                            ].map(stat => (
                              <div key={stat.label} className="glass-panel rounded-xl p-4 border border-border/40 text-center">
                                <div className={`${stat.color} flex justify-center mb-2`}>{stat.icon}</div>
                                <div className="text-2xl font-bold text-primary font-mono">{stat.value}</div>
                                <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{stat.label}</div>
                              </div>
                            ))}
                          </div>

                          {/* Achievement Badges */}
                          <div className="glass-panel rounded-2xl p-5 border border-border/50">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="font-semibold text-primary flex items-center gap-2">
                                <Award className="h-4 w-4 text-accent" /> Achievement Badges
                              </h4>
                              <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                                {journey.earnedBadges}/{journey.totalBadges} earned
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2.5">
                              {journey.badges.map(badge => (
                                <motion.div
                                  key={badge.id}
                                  initial={{ scale: 0.95, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                                    badge.earned
                                      ? "bg-gradient-to-br from-accent/5 to-primary/5 border-accent/25"
                                      : "bg-muted/30 border-border/30 opacity-40 grayscale"
                                  }`}
                                >
                                  <span className="text-xl leading-none">{badge.icon}</span>
                                  <div className="min-w-0">
                                    <p className={`text-xs font-semibold truncate ${badge.earned ? "text-primary" : "text-muted-foreground"}`}>{badge.label}</p>
                                    <p className="text-[10px] text-muted-foreground leading-tight">{badge.desc}</p>
                                  </div>
                                  {badge.earned && <CheckCircle className="h-3.5 w-3.5 text-accent flex-shrink-0 ml-auto" />}
                                </motion.div>
                              ))}
                            </div>
                          </div>

                          {/* Next Steps */}
                          <div className="glass-panel rounded-2xl p-5 border border-border/50">
                            <h4 className="font-semibold text-primary flex items-center gap-2 mb-4">
                              <Compass className="h-4 w-4 text-accent" /> Recommended Next Steps
                            </h4>
                            <div className="space-y-2.5">
                              {journey.nextSteps.map((step, i) => (
                                <motion.a
                                  key={step.label}
                                  href={step.href}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: i * 0.1 }}
                                  className="flex items-center gap-3 p-3.5 rounded-xl bg-muted/40 hover:bg-accent/5 border border-border/30 hover:border-accent/30 transition-all group"
                                >
                                  <span className="text-xl leading-none">{step.icon}</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-primary">{step.label}</p>
                                    <p className="text-xs text-muted-foreground">{step.desc}</p>
                                  </div>
                                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-accent transition-colors flex-shrink-0" />
                                </motion.a>
                              ))}
                            </div>
                          </div>

                          {/* AI Growth Insight */}
                          <div className="rounded-2xl p-5 bg-gradient-to-br from-accent/10 to-primary/10 border border-accent/20">
                            <div className="flex items-start gap-3">
                              <Sparkles className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-sm font-semibold text-primary mb-1">AI Spiritual Insight</p>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                  {journey.maturity.level === "Seeker"
                                    ? "You are just beginning your journey in the Digital Sanctuary. The Word of God says 'draw near to God and He will draw near to you.' Explore the sermon archive and let the teaching of the Correction Mandate take root."
                                    : journey.maturity.level === "Believer"
                                    ? "Your faith is taking shape. As you continue to walk in the light of the Correction, consider sharing a testimony — your story strengthens the body of Christ and honours what God has done."
                                    : journey.maturity.level === "Faithful"
                                    ? "You are walking faithfully in the Sanctuary. The Scriptures say 'the path of the righteous is like the morning sun.' Keep sowing into the kingdom and standing on the prophetic word over your life."
                                    : "You are deeply rooted — a pillar in this digital expression of the ministry. Continue to disciple others, intercede for the harvest, and live as a living testimony of the Correction Mandate."}
                                </p>
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="glass-panel rounded-2xl p-8 border border-border/50 text-center">
                          <TrendingUp className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                          <p className="text-sm font-medium text-primary mb-1">Journey data unavailable</p>
                          <p className="text-xs text-muted-foreground">Please try again in a moment.</p>
                        </div>
                      )}
                    </motion.div>
                  )}

                </AnimatePresence>

                <Button
                  onClick={handleLogout}
                  variant="outline"
                  className="w-full rounded-full h-11 border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" /> Sign Out
                </Button>
              </motion.div>

            ) : view === "edit-profile" ? (
              <motion.div key="edit-profile" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="glass-panel rounded-2xl p-8 border border-border/50">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="font-serif font-bold text-primary text-xl flex items-center gap-2">
                      <Edit3 className="h-5 w-5 text-accent" /> Edit Profile
                    </h2>
                    <button onClick={() => { setView("dashboard"); setError(""); }} className="text-muted-foreground hover:text-primary">
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <form onSubmit={handleSaveProfile} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-primary mb-1 block">First Name *</label>
                        <Input
                          value={editForm.firstName}
                          onChange={e => setEditForm(p => ({ ...p, firstName: e.target.value }))}
                          placeholder="First"
                          required
                          className="bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-primary mb-1 block">Last Name *</label>
                        <Input
                          value={editForm.lastName}
                          onChange={e => setEditForm(p => ({ ...p, lastName: e.target.value }))}
                          placeholder="Last"
                          required
                          className="bg-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-primary mb-1 block">
                        <Phone className="h-3 w-3 inline mr-1" /> Phone (optional)
                      </label>
                      <Input
                        type="tel"
                        value={editForm.phone}
                        onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))}
                        placeholder="+234..."
                        className="bg-white"
                      />
                    </div>

                    <div className="border-t border-border/40 pt-4">
                      <p className="text-xs text-muted-foreground font-medium mb-3 flex items-center gap-1.5">
                        <Key className="h-3.5 w-3.5" /> Change Password (optional)
                      </p>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-medium text-primary mb-1 block">Current Password</label>
                          <div className="relative">
                            <Input
                              type={showPass ? "text" : "password"}
                              value={editForm.currentPassword}
                              onChange={e => setEditForm(p => ({ ...p, currentPassword: e.target.value }))}
                              placeholder="Your current password"
                              className="bg-white pr-10"
                              autoComplete="current-password"
                            />
                            <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary">
                              {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-primary mb-1 block">New Password</label>
                          <div className="relative">
                            <Input
                              type={showNewPass ? "text" : "password"}
                              value={editForm.newPassword}
                              onChange={e => setEditForm(p => ({ ...p, newPassword: e.target.value }))}
                              placeholder="Min. 8 characters"
                              className="bg-white pr-10"
                              autoComplete="new-password"
                            />
                            <button type="button" onClick={() => setShowNewPass(!showNewPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary">
                              {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {error && (
                      <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-3">{error}</div>
                    )}

                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 rounded-full h-11"
                        onClick={() => { setView("dashboard"); setError(""); }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={loading}
                        className="flex-1 bg-accent text-white hover:bg-accent/90 rounded-full h-11 font-semibold"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {loading ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  </form>
                </div>
              </motion.div>

            ) : view === "register" ? (
              <motion.div key="register" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="glass-panel rounded-2xl p-8 border border-border/50">
                  <div className="flex gap-2 mb-6 p-1 bg-muted rounded-full">
                    <button
                      onClick={() => { setView("register"); setError(""); }}
                      className="flex-1 py-2 rounded-full text-sm font-medium bg-white shadow text-primary"
                    >
                      Join Now
                    </button>
                    <button
                      onClick={() => { setView("login"); setError(""); }}
                      className="flex-1 py-2 rounded-full text-sm font-medium text-muted-foreground hover:text-primary"
                    >
                      Sign In
                    </button>
                  </div>
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="reg-firstname" className="text-xs font-medium text-primary mb-1 block">First Name *</label>
                        <Input id="reg-firstname" value={regForm.firstName} onChange={e => setRegForm(p => ({ ...p, firstName: e.target.value }))} placeholder="First" required className="bg-white" />
                      </div>
                      <div>
                        <label htmlFor="reg-lastname" className="text-xs font-medium text-primary mb-1 block">Last Name *</label>
                        <Input id="reg-lastname" value={regForm.lastName} onChange={e => setRegForm(p => ({ ...p, lastName: e.target.value }))} placeholder="Last" required className="bg-white" />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="reg-email" className="text-xs font-medium text-primary mb-1 block">Email Address *</label>
                      <Input id="reg-email" type="email" value={regForm.email} onChange={e => setRegForm(p => ({ ...p, email: e.target.value }))} placeholder="your@email.com" required className="bg-white" autoComplete="email" />
                    </div>
                    <div>
                      <label htmlFor="reg-password" className="text-xs font-medium text-primary mb-1 block">Password *</label>
                      <div className="relative">
                        <Input id="reg-password" type={showPass ? "text" : "password"} value={regForm.password} onChange={e => setRegForm(p => ({ ...p, password: e.target.value }))} placeholder="Min. 8 characters" required className="bg-white pr-10" autoComplete="new-password" aria-describedby="reg-password-hint" />
                        <button type="button" onClick={() => setShowPass(!showPass)} aria-label={showPass ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary">
                          {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p id="reg-password-hint" className="text-[11px] text-muted-foreground mt-1">Minimum 8 characters</p>
                    </div>
                    <div>
                      <label htmlFor="reg-phone" className="text-xs font-medium text-primary mb-1 block">Phone (optional)</label>
                      <Input id="reg-phone" type="tel" value={regForm.phone} onChange={e => setRegForm(p => ({ ...p, phone: e.target.value }))} placeholder="+234..." className="bg-white" />
                    </div>
                    {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-3">{error}</div>}
                    <Button type="submit" disabled={loading} className="w-full bg-accent text-white hover:bg-accent/90 rounded-full h-11 font-semibold shadow-lg shadow-accent/20">
                      <User className="h-4 w-4 mr-2" /> {loading ? "Creating account..." : "Join the Sanctuary"}
                    </Button>
                  </form>
                </div>
              </motion.div>

            ) : view === "forgot" ? (
              <motion.div key="forgot" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="glass-panel rounded-2xl p-8 border border-border/50">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="font-serif font-bold text-primary text-xl flex items-center gap-2">
                      <Key className="h-5 w-5 text-accent" /> Reset Password
                    </h2>
                    <button onClick={() => { setView("login"); setError(""); }} className="text-muted-foreground hover:text-primary">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <p className="text-sm text-muted-foreground mb-5">
                    Enter the email address linked to your account. We'll send a secure reset link if one exists.
                  </p>
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div>
                      <label htmlFor="forgot-email" className="text-xs font-medium text-primary mb-1 block">Email Address *</label>
                      <Input
                        id="forgot-email"
                        type="email"
                        value={forgotEmail}
                        onChange={e => setForgotEmail(e.target.value)}
                        placeholder="your@email.com"
                        required
                        autoComplete="email"
                        className="bg-white"
                      />
                    </div>
                    {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-3">{error}</div>}
                    <Button type="submit" disabled={loading || !forgotEmail} className="w-full bg-accent text-white hover:bg-accent/90 rounded-full h-11 font-semibold shadow-lg shadow-accent/20">
                      {loading ? "Sending..." : "Send Reset Link"}
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">
                      Remembered it?{" "}
                      <button type="button" onClick={() => { setView("login"); setError(""); }} className="text-accent hover:underline font-medium">
                        Back to sign in →
                      </button>
                    </p>
                  </form>
                </div>
              </motion.div>

            ) : view === "forgot-sent" ? (
              <motion.div key="forgot-sent" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                <div className="glass-panel rounded-2xl p-8 border border-accent/20 text-center">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center mx-auto mb-4 shadow-lg shadow-accent/20">
                    <CheckCircle className="h-7 w-7 text-white" />
                  </div>
                  <h2 className="font-serif font-bold text-primary text-xl mb-2">Check Your Email</h2>
                  <p className="text-sm text-muted-foreground mb-2">
                    If an account with <strong className="text-primary">{forgotEmail}</strong> exists, a reset link has been sent.
                  </p>
                  <p className="text-xs text-muted-foreground mb-6">
                    Check your inbox and spam folder. The link expires in 1 hour.
                  </p>
                  <Button
                    onClick={() => { setView("login"); setError(""); setForgotEmail(""); }}
                    variant="outline"
                    className="rounded-full border-accent/30 text-accent hover:bg-accent/5"
                  >
                    Back to Sign In
                  </Button>
                </div>
              </motion.div>

            ) : (
              <motion.div key="login" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="glass-panel rounded-2xl p-8 border border-border/50">
                  <div className="flex gap-2 mb-6 p-1 bg-muted rounded-full">
                    <button
                      onClick={() => { setView("register"); setError(""); }}
                      className="flex-1 py-2 rounded-full text-sm font-medium text-muted-foreground hover:text-primary"
                    >
                      Join Now
                    </button>
                    <button
                      onClick={() => { setView("login"); setError(""); }}
                      className="flex-1 py-2 rounded-full text-sm font-medium bg-white shadow text-primary"
                    >
                      Sign In
                    </button>
                  </div>
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <label htmlFor="login-email" className="text-xs font-medium text-primary mb-1 block">Email Address *</label>
                      <Input id="login-email" type="email" value={loginForm.email} onChange={e => setLoginForm(p => ({ ...p, email: e.target.value }))} placeholder="your@email.com" required className="bg-white" autoComplete="username" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label htmlFor="login-password" className="text-xs font-medium text-primary">Password *</label>
                        <button
                          type="button"
                          onClick={() => { setView("forgot"); setError(""); setForgotEmail(loginForm.email); }}
                          className="text-xs text-accent hover:underline font-medium"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        <Input id="login-password" type={showPass ? "text" : "password"} value={loginForm.password} onChange={e => setLoginForm(p => ({ ...p, password: e.target.value }))} placeholder="Your password" required className="bg-white pr-10" autoComplete="current-password" />
                        <button type="button" onClick={() => setShowPass(!showPass)} aria-label={showPass ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary">
                          {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-3">{error}</div>}
                    <Button type="submit" disabled={loading} className="w-full bg-accent text-white hover:bg-accent/90 rounded-full h-11 font-semibold shadow-lg shadow-accent/20">
                      <LogIn className="h-4 w-4 mr-2" /> {loading ? "Signing in..." : "Sign In"}
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">
                      Not a member?{" "}
                      <button type="button" onClick={() => { setView("register"); setError(""); }} className="text-accent hover:underline font-medium">
                        Join now →
                      </button>
                    </p>
                  </form>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </Layout>
  );
}

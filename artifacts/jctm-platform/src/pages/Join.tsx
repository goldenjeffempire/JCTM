import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, LogIn, LogOut, BookOpen, Heart, ChevronRight,
  CheckCircle, Eye, EyeOff, Church, Edit3, Save, X,
  Key, Phone, Shield,
} from "lucide-react";
import { toast } from "sonner";

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

type View = "register" | "login" | "dashboard" | "edit-profile";

export default function Join() {
  const [view, setView] = useState<View>("register");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [member, setMember] = useState<Member | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  const [regForm, setRegForm] = useState({ firstName: "", lastName: "", email: "", password: "", phone: "" });
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", phone: "", currentPassword: "", newPassword: "" });

  useEffect(() => {
    document.title = "Join | JCTM Digital Sanctuary";
    const token = localStorage.getItem("jctm_token");
    if (token) {
      fetch(`${BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => {
          if (data.id) {
            setMember(data);
            setView("dashboard");
          }
        })
        .catch(() => { localStorage.removeItem("jctm_token"); });
    }
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regForm.password.length < 6) { setError("Password must be at least 6 characters."); return; }
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
        localStorage.setItem("jctm_token", data.token);
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
        localStorage.setItem("jctm_token", data.token);
        setMember(data.member);
        setView("dashboard");
        toast.success("Welcome back to the Sanctuary!");
      } else {
        setError(data.error ?? "Login failed. Please check your credentials.");
      }
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  };

  const handleLogout = () => {
    localStorage.removeItem("jctm_token");
    setMember(null);
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
    const token = localStorage.getItem("jctm_token");
    if (!token) return;

    if (editForm.newPassword && editForm.newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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

        <div className="max-w-md mx-auto">
          <AnimatePresence mode="wait">
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

                  {/* Edit profile button */}
                  <button
                    onClick={openEditProfile}
                    className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-accent transition-colors mx-auto"
                  >
                    <Edit3 className="h-3.5 w-3.5" /> Edit Profile
                  </button>
                </div>

                {/* Member resources */}
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
                              placeholder="Min. 6 characters"
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
                        <label className="text-xs font-medium text-primary mb-1 block">First Name *</label>
                        <Input value={regForm.firstName} onChange={e => setRegForm(p => ({ ...p, firstName: e.target.value }))} placeholder="First" required className="bg-white" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-primary mb-1 block">Last Name *</label>
                        <Input value={regForm.lastName} onChange={e => setRegForm(p => ({ ...p, lastName: e.target.value }))} placeholder="Last" required className="bg-white" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-primary mb-1 block">Email Address *</label>
                      <Input type="email" value={regForm.email} onChange={e => setRegForm(p => ({ ...p, email: e.target.value }))} placeholder="your@email.com" required className="bg-white" autoComplete="email" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-primary mb-1 block">Password *</label>
                      <div className="relative">
                        <Input type={showPass ? "text" : "password"} value={regForm.password} onChange={e => setRegForm(p => ({ ...p, password: e.target.value }))} placeholder="Min. 6 characters" required className="bg-white pr-10" autoComplete="new-password" />
                        <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary">
                          {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-primary mb-1 block">Phone (optional)</label>
                      <Input type="tel" value={regForm.phone} onChange={e => setRegForm(p => ({ ...p, phone: e.target.value }))} placeholder="+234..." className="bg-white" />
                    </div>
                    {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-3">{error}</div>}
                    <Button type="submit" disabled={loading} className="w-full bg-accent text-white hover:bg-accent/90 rounded-full h-11 font-semibold shadow-lg shadow-accent/20">
                      <User className="h-4 w-4 mr-2" /> {loading ? "Creating account..." : "Join the Sanctuary"}
                    </Button>
                  </form>
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
                      <label className="text-xs font-medium text-primary mb-1 block">Email Address *</label>
                      <Input type="email" value={loginForm.email} onChange={e => setLoginForm(p => ({ ...p, email: e.target.value }))} placeholder="your@email.com" required className="bg-white" autoComplete="username" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-primary mb-1 block">Password *</label>
                      <div className="relative">
                        <Input type={showPass ? "text" : "password"} value={loginForm.password} onChange={e => setLoginForm(p => ({ ...p, password: e.target.value }))} placeholder="Your password" required className="bg-white pr-10" autoComplete="current-password" />
                        <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary">
                          {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-3">{error}</div>}
                    <Button type="submit" disabled={loading} className="w-full bg-accent text-white hover:bg-accent/90 rounded-full h-11 font-semibold shadow-lg shadow-accent/20">
                      <LogIn className="h-4 w-4 mr-2" /> {loading ? "Signing in..." : "Sign In"}
                    </Button>
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

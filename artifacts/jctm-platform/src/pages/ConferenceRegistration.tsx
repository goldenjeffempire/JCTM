import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import {
  User, Mail, Phone, Building2, Award, MapPin,
  MessageSquare, ChevronRight, CheckCircle2, ArrowLeft,
  Flame, Calendar, Clock,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import ministerConferenceFlyer from "@assets/WhatsApp_Image_2026-04-16_at_2.59.53_PM_1776348424004.jpeg";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const ROLES = [
  "Pastor / Senior Pastor",
  "Bishop",
  "Apostle / Prophet",
  "Evangelist",
  "Elder / Deacon",
  "Minister / Preacher",
  "Worship Leader",
  "Church Worker",
  "Church Member",
  "Student / Youth",
  "Other",
];

interface FormState {
  fullName: string;
  email: string;
  phone: string;
  ministry: string;
  role: string;
  stateOrCountry: string;
  message: string;
}

const EMPTY_FORM: FormState = {
  fullName: "",
  email: "",
  phone: "",
  ministry: "",
  role: "",
  stateOrCountry: "",
  message: "",
};

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-bold mb-2" style={{ color: "#d8b4fe" }}>
      {children}
      {required && <span className="text-yellow-400 ml-1">*</span>}
    </label>
  );
}

function FieldIcon({ icon: Icon }: { icon: React.ElementType }) {
  return (
    <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
      <Icon className="h-4 w-4" style={{ color: "#a855f7" }} />
    </span>
  );
}

const inputCls =
  "w-full pl-11 pr-4 py-3 rounded-xl border text-white placeholder:text-white/30 text-sm font-medium outline-none transition-all focus:ring-2 focus:ring-purple-500/40";
const inputStyle = {
  background: "rgba(45,15,61,0.7)",
  borderColor: "rgba(168,85,247,0.3)",
};

export default function ConferenceRegistration() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [regId, setRegId] = useState<number | null>(null);

  const set = (key: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm(prev => ({ ...prev, [key]: e.target.value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  };

  const validate = (): boolean => {
    const e: Partial<FormState> = {};
    if (!form.fullName.trim()) e.fullName = "Full name is required.";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Enter a valid email address.";
    if (!form.phone.trim()) e.phone = "Phone number is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, string | undefined> = {
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
      };
      if (form.email.trim()) payload.email = form.email.trim();
      if (form.ministry.trim()) payload.ministry = form.ministry.trim();
      if (form.role) payload.role = form.role;
      if (form.stateOrCountry.trim()) payload.stateOrCountry = form.stateOrCountry.trim();
      if (form.message.trim()) payload.message = form.message.trim();

      const res = await fetch(`${BASE}/api/conference/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Registration failed.");
      setRegId(data?.registration?.id ?? null);
      setSuccess(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <SEO
        title="Register to Attend — Ministers Conference 2026 | JCTM"
        description="Register your attendance for the JCTM Ministers Conference 2026. May 8–10, 2026. An apostolic gathering of ministers, leaders and kingdom builders."
      />

      {/* Hero */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(180deg,#0d020f 0%,#2a0a35 60%,#0d020f 100%)" }}
      >
        {/* Starfield */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 40 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: `${(i % 3) * 0.8 + 0.5}px`,
                height: `${(i % 3) * 0.8 + 0.5}px`,
                top: `${(i * 41 + 13) % 100}%`,
                left: `${(i * 59 + 7) % 100}%`,
                background: `rgba(220,180,255,${(i % 5) * 0.07 + 0.06})`,
              }}
            />
          ))}
        </div>
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[250px] rounded-full blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(168,85,247,0.15) 0%, transparent 70%)" }}
        />

        <div className="relative z-10 container mx-auto px-4 pt-16 pb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-10"
          >
            <Link href="/">
              <span className="inline-flex items-center gap-1.5 text-purple-300/70 hover:text-purple-300 text-sm mb-6 transition-colors cursor-pointer">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Home
              </span>
            </Link>

            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold uppercase tracking-widest border mb-5"
              style={{ borderColor: "rgba(168,85,247,0.4)", background: "rgba(168,85,247,0.12)", color: "#d8b4fe" }}>
              <Flame className="h-3.5 w-3.5" /> Jesus Christ Temple Ministry Presents
            </div>

            <h1 className="font-serif font-black text-4xl md:text-5xl text-white mb-3 leading-tight">
              Ministers{" "}
              <span style={{ WebkitTextStroke: "2px #a855f7", color: "transparent" }}>Conference</span>{" "}
              <span className="text-purple-300">2026</span>
            </h1>
            <p className="text-purple-200/70 font-serif italic text-lg max-w-xl mx-auto mb-6">
              &ldquo;An Apostolic Gathering of Ministers, Leaders &amp; Kingdom Builders&rdquo;
            </p>

            <div className="flex flex-wrap justify-center gap-4 text-sm">
              {[
                { icon: Calendar, text: "May 8–10, 2026" },
                { icon: Clock, text: "8:00 AM Daily (WAT)" },
                { icon: MapPin, text: "Effurun Uvwie, Delta State" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 px-4 py-2 rounded-xl"
                  style={{ background: "rgba(45,15,61,0.7)", border: "1px solid rgba(168,85,247,0.25)" }}>
                  <Icon className="h-4 w-4 text-purple-400" />
                  <span className="text-white/80 font-medium">{text}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <div
        className="min-h-screen py-12"
        style={{ background: "linear-gradient(180deg,#0d020f 0%,#160325 100%)" }}
      >
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">

            <AnimatePresence mode="wait">
              {success ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="flex flex-col items-center text-center py-16 px-4"
                >
                  <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-2xl"
                    style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", boxShadow: "0 0 60px rgba(168,85,247,0.4)" }}>
                    <CheckCircle2 className="h-10 w-10 text-white" />
                  </div>
                  <h2 className="font-serif font-black text-3xl md:text-4xl text-white mb-3">
                    Registration Confirmed!
                  </h2>
                  {regId && (
                    <p className="text-purple-300/70 text-sm mb-3">Reference #{regId}</p>
                  )}
                  <p className="text-purple-100/70 text-lg max-w-lg mb-8">
                    Welcome, {form.fullName.split(" ")[0]}. Your attendance has been registered for the{" "}
                    <span className="text-purple-300 font-bold">Ministers Conference 2026</span>. We look forward to seeing you!
                  </p>

                  <div className="rounded-3xl p-6 mb-8 max-w-md w-full text-left space-y-3"
                    style={{ background: "rgba(45,15,61,0.8)", border: "1px solid rgba(168,85,247,0.25)" }}>
                    <p className="text-purple-200/80 text-sm font-bold uppercase tracking-wider mb-2">Event Details</p>
                    {[
                      { icon: Calendar, text: "Friday 8th May — Sunday 10th May, 2026" },
                      { icon: Clock, text: "8:00 AM Daily (West Africa Time)" },
                      { icon: MapPin, text: "Church Auditorium, Km1 East West Rd., Ebrumede Roundabout, Effurun Uvwie L.G.A., Delta State" },
                    ].map(({ icon: Icon, text }) => (
                      <div key={text} className="flex items-start gap-3 text-sm text-white/80">
                        <Icon className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
                        <span>{text}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Link href="/">
                      <Button className="rounded-xl px-6 h-12 font-bold"
                        style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", color: "#fff" }}>
                        <ArrowLeft className="h-4 w-4 mr-2" /> Return to Home
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      onClick={() => { setSuccess(false); setForm(EMPTY_FORM); setRegId(null); }}
                      className="rounded-xl px-6 h-12 font-bold border-purple-400/40 text-purple-200 hover:bg-purple-500/10"
                    >
                      Register Another Person
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-10 items-start"
                >
                  {/* Left — Flyer + info */}
                  <div className="space-y-6">
                    <div className="rounded-3xl overflow-hidden border-2 shadow-2xl shadow-purple-500/20"
                      style={{ borderColor: "rgba(168,85,247,0.45)", background: "linear-gradient(145deg,#1a0525 0%,#2d0f3d 50%,#1a0525 100%)" }}>
                      <div className="h-1 w-full"
                        style={{ background: "linear-gradient(90deg,transparent,#a855f7 20%,#d8b4fe 50%,#a855f7 80%,transparent)" }} />
                      <img
                        src={ministerConferenceFlyer}
                        alt="Ministers Conference 2026 official flyer"
                        className="w-full h-auto object-contain"
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="h-0.5 w-full"
                        style={{ background: "linear-gradient(90deg,transparent,rgba(212,160,23,0.5),transparent)" }} />
                    </div>

                    <div className="rounded-3xl p-5 space-y-3"
                      style={{ background: "rgba(45,15,61,0.8)", border: "1px solid rgba(168,85,247,0.25)" }}>
                      <p className="text-purple-200/80 text-xs font-bold uppercase tracking-wider">Why Attend?</p>
                      {[
                        "Apostolic fire and prophetic impartation",
                        "Word-centred ministry from the front lines",
                        "Networking with ministers & kingdom builders",
                        "Encounter the presence of God corporately",
                      ].map(item => (
                        <div key={item} className="flex items-start gap-3 text-sm text-white/75">
                          <CheckCircle2 className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right — Registration Form */}
                  <div className="rounded-3xl overflow-hidden border shadow-2xl"
                    style={{ background: "linear-gradient(145deg,rgba(26,5,37,0.96),rgba(45,15,61,0.88))", borderColor: "rgba(168,85,247,0.3)", boxShadow: "0 24px 80px rgba(88,28,135,0.2)" }}>

                    {/* Form header */}
                    <div className="p-6 md:p-8 border-b" style={{ borderColor: "rgba(168,85,247,0.15)" }}>
                      <h2 className="font-serif font-black text-2xl text-white mb-1">
                        Register to Attend
                      </h2>
                      <p className="text-purple-100/60 text-sm">
                        Secure your place at the Ministers Conference 2026. All fields marked{" "}
                        <span className="text-yellow-400">*</span> are required.
                      </p>
                    </div>

                    <form onSubmit={handleSubmit} noValidate>
                      <div className="p-6 md:p-8 space-y-5">

                        {/* Full Name */}
                        <div>
                          <FieldLabel required>Full Name</FieldLabel>
                          <div className="relative">
                            <FieldIcon icon={User} />
                            <Input
                              placeholder="e.g. Pastor John Adeyemi"
                              value={form.fullName}
                              onChange={set("fullName")}
                              maxLength={120}
                              className={inputCls}
                              style={inputStyle}
                            />
                          </div>
                          {errors.fullName && (
                            <p className="text-red-400 text-xs mt-1.5">{errors.fullName}</p>
                          )}
                        </div>

                        {/* Phone */}
                        <div>
                          <FieldLabel required>Phone Number</FieldLabel>
                          <div className="relative">
                            <FieldIcon icon={Phone} />
                            <Input
                              type="tel"
                              placeholder="e.g. +234 801 234 5678"
                              value={form.phone}
                              onChange={set("phone")}
                              maxLength={30}
                              className={inputCls}
                              style={inputStyle}
                            />
                          </div>
                          {errors.phone && (
                            <p className="text-red-400 text-xs mt-1.5">{errors.phone}</p>
                          )}
                        </div>

                        {/* Email */}
                        <div>
                          <FieldLabel>Email Address</FieldLabel>
                          <div className="relative">
                            <FieldIcon icon={Mail} />
                            <Input
                              type="email"
                              placeholder="e.g. pastor@church.org"
                              value={form.email}
                              onChange={set("email")}
                              maxLength={160}
                              className={inputCls}
                              style={inputStyle}
                            />
                          </div>
                          {errors.email && (
                            <p className="text-red-400 text-xs mt-1.5">{errors.email}</p>
                          )}
                        </div>

                        {/* Ministry / Church */}
                        <div>
                          <FieldLabel>Ministry / Church Name</FieldLabel>
                          <div className="relative">
                            <FieldIcon icon={Building2} />
                            <Input
                              placeholder="e.g. Grace Apostolic Church, Lagos"
                              value={form.ministry}
                              onChange={set("ministry")}
                              maxLength={160}
                              className={inputCls}
                              style={inputStyle}
                            />
                          </div>
                        </div>

                        {/* Role */}
                        <div>
                          <FieldLabel>Role / Designation</FieldLabel>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                              <Award className="h-4 w-4" style={{ color: "#a855f7" }} />
                            </span>
                            <select
                              value={form.role}
                              onChange={set("role")}
                              className="w-full pl-11 pr-4 py-3 rounded-xl border text-white text-sm font-medium outline-none transition-all focus:ring-2 focus:ring-purple-500/40 appearance-none"
                              style={{ ...inputStyle, color: form.role ? "#fff" : "rgba(255,255,255,0.3)" }}
                            >
                              <option value="" style={{ background: "#1a0525", color: "#9ca3af" }}>Select your role…</option>
                              {ROLES.map(r => (
                                <option key={r} value={r} style={{ background: "#1a0525", color: "#fff" }}>{r}</option>
                              ))}
                            </select>
                            <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-purple-400/60 pointer-events-none rotate-90" />
                          </div>
                        </div>

                        {/* State / Country */}
                        <div>
                          <FieldLabel>State / Country of Origin</FieldLabel>
                          <div className="relative">
                            <FieldIcon icon={MapPin} />
                            <Input
                              placeholder="e.g. Lagos, Nigeria"
                              value={form.stateOrCountry}
                              onChange={set("stateOrCountry")}
                              maxLength={100}
                              className={inputCls}
                              style={inputStyle}
                            />
                          </div>
                        </div>

                        {/* Message */}
                        <div>
                          <FieldLabel>Additional Message</FieldLabel>
                          <div className="relative">
                            <span className="absolute left-4 top-3.5 pointer-events-none">
                              <MessageSquare className="h-4 w-4" style={{ color: "#a855f7" }} />
                            </span>
                            <textarea
                              rows={3}
                              placeholder="Any special requests, prayer points or notes…"
                              value={form.message}
                              onChange={set("message")}
                              maxLength={500}
                              className="w-full pl-11 pr-4 py-3 rounded-xl border text-white placeholder:text-white/30 text-sm font-medium outline-none transition-all focus:ring-2 focus:ring-purple-500/40 resize-none"
                              style={inputStyle}
                            />
                          </div>
                        </div>

                        {/* Submit */}
                        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} className="pt-2">
                          <Button
                            type="submit"
                            disabled={submitting}
                            className="w-full h-14 rounded-2xl font-black text-lg tracking-wide disabled:opacity-60"
                            style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", color: "#fff" }}
                          >
                            {submitting ? (
                              <span className="flex items-center gap-2">
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                </svg>
                                Submitting…
                              </span>
                            ) : (
                              <span className="flex items-center gap-2">
                                Complete Registration <ChevronRight className="h-5 w-5" />
                              </span>
                            )}
                          </Button>
                        </motion.div>

                        <p className="text-center text-purple-100/40 text-xs">
                          Your information is kept private and will only be used for conference logistics.
                        </p>
                      </div>
                    </form>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </div>
      </div>
    </Layout>
  );
}

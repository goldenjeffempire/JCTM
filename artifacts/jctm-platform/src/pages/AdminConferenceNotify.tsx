import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, Mail, Users, Send, CheckCircle, AlertCircle,
  Megaphone, Smartphone, RefreshCw, Clock, ChevronRight,
  Eye, Zap, Globe, MessageSquare, Shield,
} from "lucide-react";
import { toast } from "sonner";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { AdminLoginGate } from "@/components/admin/AdminLoginGate";
import { Layout } from "@/components/layout/Layout";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface PreviewData {
  ok: boolean;
  push: { subscribers: number; ready: boolean };
  email: {
    devotionSubscribers: number;
    conferenceRegistrants: number;
    members: number;
    uniqueRecipients: number;
    smtpConfigured: boolean;
  };
  event: {
    id: number | null;
    title: string;
    dateStr: string;
    location: string;
    hasYouTube: boolean;
  };
}

interface BroadcastResult {
  ok: boolean;
  result: {
    push: { sent: number; failed: number; deactivated: number; skipped: boolean };
    email: { sent: number; failed: number; total: number; skipped: boolean };
  };
  conference: { conferenceTitle: string; dateStr: string; location: string };
  broadcastAt: string;
}

interface HistoryEntry {
  id: number;
  notification_title: string;
  sent: number;
  failed: number;
  total_attempted: number;
  delivery_rate: number;
  dispatchedAt: string;
}

function StatCard({
  icon,
  label,
  value,
  sub,
  color = "blue",
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  color?: "blue" | "green" | "amber" | "violet" | "red";
  badge?: React.ReactNode;
}) {
  const colors = {
    blue: "from-blue-500/10 to-blue-600/5 border-blue-200/60 text-blue-600",
    green: "from-emerald-500/10 to-emerald-600/5 border-emerald-200/60 text-emerald-600",
    amber: "from-amber-500/10 to-amber-600/5 border-amber-200/60 text-amber-600",
    violet: "from-violet-500/10 to-violet-600/5 border-violet-200/60 text-violet-600",
    red: "from-red-500/10 to-red-600/5 border-red-200/60 text-red-600",
  };
  return (
    <div className={`rounded-2xl p-5 border bg-gradient-to-br ${colors[color]} relative overflow-hidden`}>
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 rounded-xl bg-white/60">{icon}</div>
        {badge}
      </div>
      <div className="text-3xl font-bold text-slate-900 font-mono">{value}</div>
      <div className="text-sm font-semibold text-slate-700 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function ConferenceNotifyInner({ adminToken }: { adminToken: string }) {
  const [confirmed, setConfirmed] = useState(false);
  const [channels, setChannels] = useState({ push: true, email: true });
  const [lastResult, setLastResult] = useState<BroadcastResult | null>(null);

  const authHeaders = { Authorization: `Bearer ${adminToken}` };

  const { data: preview, isLoading: previewLoading, refetch: refetchPreview } = useQuery<PreviewData>({
    queryKey: ["/api/conference/notify/preview"],
    queryFn: () =>
      fetch(`${BASE}/api/conference/notify/preview`, { headers: authHeaders }).then(r => r.json()),
    staleTime: 2 * 60 * 1000,
  });

  const { data: history, refetch: refetchHistory } = useQuery<{ ok: boolean; history: HistoryEntry[] }>({
    queryKey: ["/api/conference/notify/history"],
    queryFn: () =>
      fetch(`${BASE}/api/conference/notify/history`, { headers: authHeaders }).then(r => r.json()),
    staleTime: 60 * 1000,
  });

  const broadcastMutation = useMutation({
    mutationFn: () =>
      fetch(`${BASE}/api/conference/notify/broadcast`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          channels: Object.entries(channels)
            .filter(([, v]) => v)
            .map(([k]) => k),
        }),
      }).then(r => r.json()),
    onSuccess: (data: BroadcastResult) => {
      if (data.ok) {
        setLastResult(data);
        setConfirmed(false);
        toast.success("Broadcast sent successfully!");
        refetchHistory();
        refetchPreview();
      } else {
        toast.error("Broadcast failed — check server logs.");
      }
    },
    onError: () => {
      toast.error("Network error during broadcast.");
    },
  });

  const evt = preview?.event;
  const emailEnabled = preview?.email.smtpConfigured ?? false;
  const totalPushRecipients = preview?.push.subscribers ?? 0;
  const totalEmailRecipients = preview?.email.uniqueRecipients ?? 0;
  const totalReach = (channels.push ? totalPushRecipients : 0) + (channels.email && emailEnabled ? totalEmailRecipients : 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
      <div className="max-w-4xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-blue-600 rounded-xl">
              <Megaphone className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Conference Notifications</h1>
              <p className="text-sm text-slate-500">Broadcast push + email to all visitors and subscribers</p>
            </div>
          </div>
          {evt && (
            <div className="mt-4 p-4 rounded-xl bg-blue-900 text-white">
              <p className="text-xs font-bold uppercase tracking-widest text-blue-300 mb-1">Broadcasting For</p>
              <p className="text-lg font-bold">{evt.title}</p>
              <p className="text-sm text-blue-200 mt-0.5">{evt.dateStr} · {evt.location}</p>
            </div>
          )}
        </div>

        {/* Audience Preview */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <Eye className="h-4 w-4 text-slate-500" /> Audience Preview
            </h2>
            <button
              onClick={() => refetchPreview()}
              className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>

          {previewLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-32 rounded-2xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : preview ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                icon={<Smartphone className="h-4 w-4 text-blue-600" />}
                label="Push Subscribers"
                value={preview.push.subscribers}
                sub="Active browser subscribers"
                color="blue"
                badge={
                  preview.push.ready
                    ? <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">READY</span>
                    : <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">EMPTY</span>
                }
              />
              <StatCard
                icon={<Mail className="h-4 w-4 text-violet-600" />}
                label="Email Subscribers"
                value={preview.email.devotionSubscribers}
                sub="Devotion newsletter list"
                color="violet"
              />
              <StatCard
                icon={<Users className="h-4 w-4 text-amber-600" />}
                label="Conference Registrants"
                value={preview.email.conferenceRegistrants}
                sub="With email address"
                color="amber"
              />
              <StatCard
                icon={<Globe className="h-4 w-4 text-emerald-600" />}
                label="Total Email Reach"
                value={preview.email.uniqueRecipients}
                sub="Deduplicated across all lists"
                color="green"
              />
            </div>
          ) : null}
        </div>

        {/* SMTP warning */}
        {preview && !preview.email.smtpConfigured && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Email not configured</p>
              <p className="text-xs text-amber-700 mt-1">
                SMTP credentials (SMTP_HOST, SMTP_USER, SMTP_PASS) are not set. Email notifications will be skipped.
                Push notifications will still be sent. Configure SMTP in Environment Secrets to enable email.
              </p>
            </div>
          </div>
        )}

        {/* Notification channels */}
        <div className="mb-6 bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Zap className="h-4 w-4 text-slate-500" /> Notification Channels
          </h2>
          <div className="space-y-3">
            {[
              {
                key: "push" as const,
                icon: <Bell className="h-5 w-5 text-blue-600" />,
                label: "Web Push Notifications",
                desc: `Instant browser alerts to all ${totalPushRecipients} active push subscribers`,
                badge: preview?.push.ready ? "Ready" : "No subscribers",
                badgeColor: preview?.push.ready ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-amber-700 bg-amber-50 border-amber-200",
                available: true,
              },
              {
                key: "email" as const,
                icon: <Mail className="h-5 w-5 text-violet-600" />,
                label: "Email Announcement",
                desc: `Rich HTML email to ${totalEmailRecipients} unique recipients across all subscription lists`,
                badge: emailEnabled ? "SMTP Ready" : "SMTP Not Set",
                badgeColor: emailEnabled ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-red-700 bg-red-50 border-red-200",
                available: emailEnabled,
              },
            ].map(ch => (
              <label key={ch.key} className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${channels[ch.key] && ch.available ? "border-blue-200 bg-blue-50/50" : "border-slate-200 bg-slate-50/50"} ${!ch.available ? "opacity-60 cursor-not-allowed" : ""}`}>
                <input
                  type="checkbox"
                  checked={channels[ch.key] && ch.available}
                  onChange={e => ch.available && setChannels(p => ({ ...p, [ch.key]: e.target.checked }))}
                  disabled={!ch.available}
                  className="w-4 h-4 rounded accent-blue-600"
                />
                <div className="p-2 rounded-xl bg-white border border-slate-200">{ch.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-900 text-sm">{ch.label}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ch.badgeColor}`}>{ch.badge}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{ch.desc}</p>
                </div>
              </label>
            ))}
          </div>

          {/* Total reach */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="text-sm text-slate-600">
              Total estimated reach:
              <span className="font-bold text-slate-900 ml-1.5">{totalReach.toLocaleString()} people</span>
            </div>
            <div className="text-xs text-slate-400">
              {channels.push && <span className="mr-2">📱 {totalPushRecipients} push</span>}
              {channels.email && emailEnabled && <span>📧 {totalEmailRecipients} email</span>}
            </div>
          </div>
        </div>

        {/* Notification preview */}
        <div className="mb-6 grid md:grid-cols-2 gap-4">
          {/* Push preview */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-900 text-sm mb-3 flex items-center gap-2">
              <Bell className="h-4 w-4 text-blue-600" /> Push Notification Preview
            </h3>
            <div className="rounded-xl bg-slate-800 p-4 text-white">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-700 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">⛪</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm leading-tight">
                    📣 {evt?.title ?? "Ministers Conference 2026 — Apostolic Fire"}
                  </p>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {evt?.dateStr ?? "8–10 May 2026"} · {evt?.location ?? "JCTM Auditorium, Effurun"}. Register now — seats are limited!
                  </p>
                  <div className="mt-2.5 flex gap-2">
                    <button className="text-[11px] font-semibold bg-blue-600 px-3 py-1 rounded-full">Register Now</button>
                    <button className="text-[11px] text-slate-400 px-2 py-1">Dismiss</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Email preview */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-900 text-sm mb-3 flex items-center gap-2">
              <Mail className="h-4 w-4 text-violet-600" /> Email Preview
            </h3>
            <div className="rounded-xl border border-slate-200 overflow-hidden text-sm">
              <div className="bg-slate-900 px-4 py-3 text-white">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest">Jesus Christ Temple Ministry</p>
                <p className="font-bold text-sm mt-0.5">{evt?.title ?? "Ministers Conference 2026"}</p>
              </div>
              <div className="p-4 bg-blue-50 border-b border-blue-100 text-center">
                <span className="inline-block bg-blue-700 text-white text-[11px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full">🎺 You Are Invited</span>
              </div>
              <div className="p-4 space-y-2">
                <p className="text-slate-700 text-xs leading-relaxed">Dear Beloved, you are invited to the <strong>{evt?.title ?? "Ministers Conference 2026"}</strong> — a powerful gathering under the prophetic mandate of God.</p>
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs">
                  <p className="text-slate-500 uppercase text-[10px] font-bold tracking-widest mb-1">📅 Date</p>
                  <p className="font-bold text-slate-900">{evt?.dateStr ?? "8–10 May 2026"}</p>
                  <p className="text-slate-500 uppercase text-[10px] font-bold tracking-widest mb-1 mt-2">📍 Venue</p>
                  <p className="font-bold text-slate-900">{evt?.location ?? "JCTM Auditorium, Effurun"}</p>
                </div>
                <div className="text-center pt-1">
                  <span className="inline-block bg-slate-900 text-white text-[11px] font-bold px-4 py-2 rounded-full">Register for the Conference →</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Broadcast action */}
        <div className="mb-6 bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
            <Send className="h-4 w-4 text-slate-500" /> Send to All
          </h2>
          <p className="text-xs text-slate-500 mb-5">
            This will immediately broadcast to all selected channels. This action cannot be undone.
          </p>

          <AnimatePresence mode="wait">
            {lastResult ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-emerald-800 text-sm">Broadcast sent successfully!</p>
                    <p className="text-xs text-emerald-600 mt-0.5">
                      Sent at {new Date(lastResult.broadcastAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                    <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2">📱 Push</p>
                    {lastResult.result.push.skipped ? (
                      <p className="text-sm text-slate-500">Skipped</p>
                    ) : (
                      <>
                        <p className="text-2xl font-bold text-slate-900">{lastResult.result.push.sent}</p>
                        <p className="text-xs text-slate-500">sent · {lastResult.result.push.failed} failed · {lastResult.result.push.deactivated} deactivated</p>
                      </>
                    )}
                  </div>
                  <div className="p-4 rounded-xl bg-violet-50 border border-violet-200">
                    <p className="text-xs font-bold text-violet-700 uppercase tracking-wide mb-2">📧 Email</p>
                    {lastResult.result.email.skipped ? (
                      <p className="text-sm text-slate-500">Skipped (SMTP not configured)</p>
                    ) : (
                      <>
                        <p className="text-2xl font-bold text-slate-900">{lastResult.result.email.sent}</p>
                        <p className="text-xs text-slate-500">sent of {lastResult.result.email.total} · {lastResult.result.email.failed} failed</p>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => { setLastResult(null); setConfirmed(false); }}
                  className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Send Another Broadcast
                </button>
              </motion.div>
            ) : !confirmed ? (
              <motion.div key="confirm-prompt" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 mb-4">
                  <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-800">Confirmation Required</p>
                      <p className="text-xs text-amber-700 mt-1">
                        You are about to send notifications to approximately <strong>{totalReach.toLocaleString()}</strong> people.
                        Channels: {[channels.push && "Push", channels.email && emailEnabled && "Email"].filter(Boolean).join(" + ") || "None selected"}.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmed(true)}
                    disabled={!channels.push && (!channels.email || !emailEnabled)}
                    className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <Send className="h-4 w-4" /> Confirm & Send Broadcast
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="send" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 mb-4">
                  <p className="text-sm font-bold text-red-800">⚠️ Final confirmation — this cannot be undone</p>
                  <p className="text-xs text-red-700 mt-1">
                    Pressing "Send Now" will immediately dispatch to all {totalReach.toLocaleString()} recipients.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmed(false)}
                    className="px-5 py-3 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => broadcastMutation.mutate()}
                    disabled={broadcastMutation.isPending}
                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    {broadcastMutation.isPending ? (
                      <><RefreshCw className="h-4 w-4 animate-spin" /> Sending…</>
                    ) : (
                      <><Megaphone className="h-4 w-4" /> Send Now to {totalReach.toLocaleString()} people</>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Broadcast history */}
        {history?.history && history.history.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-500" /> Push Broadcast History
            </h2>
            <div className="space-y-2">
              {history.history.map(entry => (
                <div key={entry.id} className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{entry.notification_title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {new Date(entry.dispatchedAt).toLocaleString()} · {entry.sent} sent · {entry.failed} failed
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-slate-900">{Math.round(entry.delivery_rate * 100)}%</p>
                    <p className="text-xs text-slate-400">delivery</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Back link */}
        <div className="mt-6 text-center">
          <a href="/admin" className="text-sm text-slate-500 hover:text-slate-700 flex items-center justify-center gap-1.5 transition-colors">
            <ChevronRight className="h-3.5 w-3.5 rotate-180" /> Back to Admin Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}

export default function AdminConferenceNotify() {
  const auth = useAdminAuth("livestream");

  return (
    <Layout>
      <AdminLoginGate role="livestream" auth={auth} title="Ministers Conference 2026 — Broadcast Notifications">
        <ConferenceNotifyInner adminToken={auth.token ?? ""} />
      </AdminLoginGate>
    </Layout>
  );
}

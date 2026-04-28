import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X } from "lucide-react";
import { toast } from "sonner";
import { getOrCreateVisitorId } from "@/lib/visitorId";
import { safeSessionGet, safeSessionSet } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const STORAGE_KEY = "jctm_push_prompt_dismissed";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function PushNotificationPrompt() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission !== "default") return;
    if (safeSessionGet(STORAGE_KEY)) return;

    let timerId: ReturnType<typeof setTimeout> | null = null;

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (!sub) {
          timerId = setTimeout(() => setVisible(true), 4000);
        }
      })
      .catch(() => {});

    return () => {
      if (timerId !== null) clearTimeout(timerId);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    safeSessionSet(STORAGE_KEY, "1");
  };

  const subscribe = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Notification permission denied");
        dismiss();
        return;
      }

      const keyRes = await fetch(`${BASE}/api/push/vapid-key`);
      const { publicKey } = await keyRes.json();
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const subJson = sub.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };

      const visitorId = getOrCreateVisitorId();

      await fetch(`${BASE}/api/push/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subJson, deviceType: "web", visitorId }),
      });

      toast.success("You'll be notified when JCTM goes live!");
      setVisible(false);
    } catch {
      toast.error("Could not enable notifications. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="fixed bottom-5 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2"
          role="dialog"
          aria-live="polite"
        >
          <div
            className="relative flex items-start gap-3 rounded-2xl border p-4 shadow-2xl"
            style={{
              background: "rgba(0, 10, 26, 0.96)",
              backdropFilter: "blur(20px)",
              borderColor: "rgba(56, 189, 248, 0.25)",
            }}
          >
            <div
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{ background: "rgba(239, 68, 68, 0.18)", border: "1px solid rgba(239,68,68,0.4)" }}
            >
              <Bell className="h-4 w-4 text-red-400" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white leading-snug">
                Get notified when we go live
              </p>
              <p className="mt-0.5 text-xs text-white/60 leading-snug">
                Receive instant alerts for Sunday services, rebroadcasts, and new messages.
              </p>

              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={subscribe}
                  disabled={loading}
                  className="rounded-full px-4 py-1.5 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
                  style={{
                    background: "rgba(239,68,68,0.85)",
                    color: "#fff",
                    border: "1px solid rgba(239,68,68,0.5)",
                  }}
                >
                  {loading ? "Enabling…" : "Enable alerts"}
                </button>
                <button
                  onClick={dismiss}
                  className="text-xs text-white/40 hover:text-white/70 transition-colors cursor-pointer"
                >
                  Not now
                </button>
              </div>
            </div>

            <button
              onClick={dismiss}
              aria-label="Dismiss"
              className="absolute top-3 right-3 text-white/30 hover:text-white/70 transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

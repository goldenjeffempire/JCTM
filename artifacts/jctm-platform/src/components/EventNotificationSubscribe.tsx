/**
 * EventNotificationSubscribe — opt-in email widget for upcoming-event reminders.
 *
 * POSTs to /api/event-notifications/subscribe (defined in
 * artifacts/api-server/src/routes/eventNotifications.ts). Subscribers receive
 * milestone reminders at 24h / 12h / 6h / 1h before each event, dispatched by
 * the 30-min scheduler in lib/event-notification-scheduler.ts.
 */

import { useState, type FormEvent } from "react";
import { Bell, CheckCircle2, Loader2 } from "lucide-react";

const BASE = import.meta.env.VITE_API_URL || "";

interface Props {
  source?: string;
  className?: string;
  variant?: "page" | "compact";
}

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; alreadySubscribed: boolean; deliveryEnabled: boolean }
  | { kind: "error"; message: string };

export default function EventNotificationSubscribe({
  source = "events",
  className = "",
  variant = "page",
}: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setStatus({ kind: "submitting" });
    try {
      let timezone: string | undefined;
      try {
        timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
      } catch {
        timezone = undefined;
      }
      const res = await fetch(`${BASE}/api/event-notifications/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, source, timezone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ kind: "error", message: data?.error || "Subscription failed." });
        return;
      }
      setStatus({
        kind: "success",
        alreadySubscribed: Boolean(data?.alreadySubscribed),
        deliveryEnabled: Boolean(data?.emailDeliveryEnabled),
      });
      setEmail("");
    } catch {
      setStatus({ kind: "error", message: "Network error. Please try again." });
    }
  }

  if (status.kind === "success") {
    return (
      <div className={`text-sm ${className}`}>
        <p className="text-foreground inline-flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          {status.alreadySubscribed
            ? "You're already on the reminder list — thank you."
            : status.deliveryEnabled
              ? "Subscribed. We'll email you 24h, 12h, 6h, and 1h before each event."
              : "You're on the list. Email delivery is being configured — reminders will start as soon as it's enabled."}
        </p>
        <button
          type="button"
          onClick={() => setStatus({ kind: "idle" })}
          className="mt-2 text-muted-foreground underline text-xs"
        >
          Subscribe another email
        </button>
      </div>
    );
  }

  const isCompact = variant === "compact";

  return (
    <form onSubmit={handleSubmit} className={className} noValidate>
      {variant === "page" && (
        <>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 inline-flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5" />
            Get reminded about upcoming events
          </p>
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
            We'll send a friendly reminder 24h, 12h, 6h, and 1h before each event so you can plan and prepare your heart.
          </p>
        </>
      )}

      <div className={isCompact ? "flex flex-col sm:flex-row gap-2" : "flex flex-col sm:flex-row gap-2"}>
        <label className="sr-only" htmlFor={`event-notif-email-${source}`}>Email address</label>
        <input
          id={`event-notif-email-${source}`}
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={status.kind === "submitting"}
          className="flex-1 min-w-0 px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={status.kind === "submitting" || !email.trim()}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {status.kind === "submitting" ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Subscribing…
            </>
          ) : (
            <>
              <Bell className="w-3.5 h-3.5" />
              Notify me
            </>
          )}
        </button>
      </div>

      {status.kind === "error" && (
        <p className="mt-2 text-xs text-destructive">{status.message}</p>
      )}

      <p className="mt-2 text-xs text-muted-foreground">
        Free. Unsubscribe anytime via the link in every email.
      </p>
    </form>
  );
}

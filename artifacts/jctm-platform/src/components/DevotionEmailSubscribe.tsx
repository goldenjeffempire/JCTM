import { useState, type FormEvent } from "react";

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

export default function DevotionEmailSubscribe({
  source = "devotion",
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
      const res = await fetch(`${BASE}/api/devotion/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, source }),
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
        <p className="text-foreground">
          {status.alreadySubscribed
            ? "You're already on the list — thank you."
            : status.deliveryEnabled
              ? "Subscribed. Check your inbox for a confirmation, then look for tomorrow's devotion at 6:00 AM WAT."
              : "You're on the list. Email delivery is being configured — you'll start receiving daily devotions as soon as it's enabled."}
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
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Receive the Daily Devotion by Email
          </p>
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
            Each morning at 6:00 AM WAT we'll send today's scripture, reflection,
            prophetic word, prayer focus, and declaration straight to your inbox.
          </p>
        </>
      )}

      <div className={isCompact ? "flex flex-col sm:flex-row gap-2" : "flex flex-col sm:flex-row gap-2"}>
        <label className="sr-only" htmlFor={`devotion-email-${source}`}>Email address</label>
        <input
          id={`devotion-email-${source}`}
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
          className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {status.kind === "submitting" ? "Subscribing..." : "Subscribe"}
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

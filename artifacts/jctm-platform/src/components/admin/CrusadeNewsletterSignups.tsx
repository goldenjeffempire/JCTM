import { useCallback, useEffect, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { AdminLoginGate } from "@/components/admin/AdminLoginGate";
import type { AdminAuthState } from "@/hooks/useAdminAuth";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Subscriber {
  email: string;
  subscribedAt: string;
}

interface SubscriberPage {
  total: number;
  limit: number;
  offset: number;
  subscribers: Subscriber[];
}

export function CrusadeNewsletterSignups({ auth }: { auth: AdminAuthState }) {
  return (
    <AdminLoginGate role="livestream" auth={auth} title="Crusade newsletter signups">
      <SubscriberPanel token={auth.adminToken} />
    </AdminLoginGate>
  );
}

function SubscriberPanel({ token }: { token: string }) {
  const [page, setPage] = useState<SubscriberPage | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadSubscribers = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${BASE}/api/crusade-2026/admin/newsletter-subscribers?limit=25&offset=${offset}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Could not load newsletter signups.");
      setPage(data);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Could not load newsletter signups.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [offset, token]);

  useEffect(() => {
    const controller = new AbortController();
    void loadSubscribers(controller.signal);
    return () => controller.abort();
  }, [loadSubscribers]);

  const exportSubscribers = async () => {
    setExporting(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${BASE}/api/crusade-2026/admin/newsletter-export`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not export newsletter signups.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "jctm-crusade-newsletter.csv";
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setNotice("Newsletter addresses and their unsubscribe links were exported.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not export newsletter signups.");
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil((page?.total ?? 0) / 25));
  const currentPage = Math.min(Math.floor(offset / 25) + 1, totalPages);

  return (
    <section className="rounded-2xl border border-border bg-card p-5" data-testid="panel-crusade-newsletter-signups">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-primary">Crusade invitation newsletter</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Only addresses with recorded newsletter consent appear here. Names and photos from invitation cards are not collected.
          </p>
          <p className="mt-2 text-sm font-semibold" data-testid="text-crusade-newsletter-count">
            {loading && !page ? "Loading signups…" : `${page?.total ?? 0} active newsletter signups`}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void loadSubscribers()} disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50"
            data-testid="button-refresh-crusade-newsletter">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button type="button" onClick={() => void exportSubscribers()} disabled={exporting || !page?.total}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            data-testid="button-export-crusade-newsletter">
            <Download className="h-4 w-4" /> {exporting ? "Preparing…" : "Export CSV"}
          </button>
        </div>
      </div>

      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="mt-4 text-sm text-emerald-600">{notice}</p>}

      {!loading && !error && page && (
        <>
          {page.subscribers.length > 0 ? (
            <div className="mt-5 overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/60 text-muted-foreground">
                  <tr><th className="px-4 py-3 font-semibold">Email address</th><th className="px-4 py-3 font-semibold">Subscribed</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {page.subscribers.map(subscriber => (
                    <tr key={subscriber.email}>
                      <td className="px-4 py-3" data-testid="text-newsletter-email">{subscriber.email}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(subscriber.subscribedAt).toLocaleDateString("en-NG")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="mt-5 rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">No active invitation newsletter signups yet.</p>}

          {page.total > 25 && (
            <div className="mt-4 flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Page {currentPage} of {totalPages}</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setOffset(Math.max(0, offset - 25))} disabled={loading || offset === 0}
                  className="rounded-full border border-border px-4 py-2 font-medium disabled:opacity-50">Previous</button>
                <button type="button" onClick={() => setOffset(offset + 25)} disabled={loading || offset + 25 >= page.total}
                  className="rounded-full border border-border px-4 py-2 font-medium disabled:opacity-50">Next</button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

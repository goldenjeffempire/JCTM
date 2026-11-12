import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type Content = { title: string; reference: string; scripture: string; introduction?: string; message?: string; reflection?: string; application?: string; closingPrayer?: string; prayerFocus?: string };
type Status = {
  counts: { status: string; count: number }[];
  categories: { category: string; count: number }[];
  scheduled: { date: string; title: string; category: string; content?: Content }[];
  review: { topic_key: string; title: string; review_reason: string; content: Content }[];
  expansion: { error_code?: string; error_message?: string; succeeded_at?: string } | null;
  aiConfigured: boolean; lowStock: boolean;
};

export function DevotionLibraryPanel({ token, onLogin }: { token: string; onLogin: (passphrase: string) => Promise<boolean> }) {
  const [json, setJson] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const cache = useQueryClient();
  const base = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/devotion/admin/library`;
  const status = useQuery<Status>({
    queryKey: ["devotion-library", Boolean(token)],
    enabled: Boolean(token),
    queryFn: async () => {
      const response = await fetch(base, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("Could not load the devotion library. Sign in with livestream administrator access.");
      return response.json();
    },
    refetchInterval: 30000,
  });
  const action = async (kind: "expand" | "import") => {
    setBusy(true); setNotice("");
    try {
      const body = kind === "import" ? { devotions: JSON.parse(json), confirmReviewed: reviewed } : {};
      const response = await fetch(`${base}/${kind}`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? result.rejected?.map((r: { title: string; reason: string }) => `${r.title}: ${r.reason}`).join("; ") ?? "Request failed");
      setNotice(result.message ?? `${result.added} new devotions admitted to the library.`);
      if (kind === "import") { setJson(""); setReviewed(false); }
      await cache.invalidateQueries({ queryKey: ["devotion-library"] });
    } catch (error) { setNotice((error as Error).message); }
    finally { setBusy(false); }
  };
  if (!token) return (
    <form className="rounded-xl border p-6 space-y-4 max-w-lg" onSubmit={async event => {
      event.preventDefault(); setBusy(true);
      try { if (await onLogin(passphrase)) setPassphrase(""); }
      finally { setBusy(false); }
    }}>
      <h2 className="text-xl font-bold">Daily Devotion Library</h2>
      <p className="text-sm text-muted-foreground">Sign in using your existing livestream administrator access.</p>
      <label className="block text-sm font-medium">Admin passphrase
        <input required type="password" autoComplete="current-password" value={passphrase} onChange={e => setPassphrase(e.target.value)} className="block w-full rounded-lg border px-3 py-2 mt-2" />
      </label>
      <button disabled={busy} className="rounded-lg bg-primary text-white px-4 py-2 disabled:opacity-50">{busy ? "Signing in…" : "Sign in"}</button>
    </form>
  );
  const data = status.data;
  const preview = (content: Content) => (
    <div className="space-y-3 mt-4 text-sm leading-7 whitespace-pre-line">
      <p className="italic">{content.scripture} — {content.reference}</p>
      {content.introduction && <p>{content.introduction}</p>}
      <p>{content.message ?? content.reflection}</p>
      {content.application && <p><strong>Practical application: </strong>{content.application}</p>}
      <p><strong>Closing prayer: </strong>{content.closingPrayer ?? content.prayerFocus}</p>
    </div>
  );
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold">Daily Devotion Library</h2>
        <p className="text-sm text-muted-foreground mt-2">Specific lessons and titles are reserved permanently. Broad categories may recur. Published history is preserved.</p>
      </header>
      {status.isLoading && <p>Loading library…</p>}
      {status.error && <p role="alert" className="text-red-700">{status.error.message}</p>}
      {data && <>
        <div className="grid grid-cols-3 gap-3">
          {["ready", "used", "review"].map(s => <div key={s} className="rounded-xl border bg-white p-4"><p className="capitalize text-sm text-muted-foreground">{s === "used" ? "Reserved / published" : s}</p><p className="font-bold text-2xl">{data.counts.find(c => c.status === s)?.count ?? 0}</p></div>)}
        </div>
        {(data.expansion?.error_message || !data.aiConfigured || data.lowStock) && <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
          <p>{data.expansion?.error_message ?? (!data.aiConfigured ? "Configure the AI provider to enable ongoing expansion." : "The unused reserve is below 30 days. Add new material before it runs out.")}</p>
          <p className="text-sm mt-2">The system will not recycle old topics to conceal an expansion problem.</p>
        </div>}
        <div className="flex flex-wrap gap-2">{data.categories.map(c => <span key={c.category} className="rounded-full border px-3 py-1 text-xs">{c.category}: {c.count}</span>)}</div>
        <div className="flex gap-3">
          <button disabled={busy} onClick={() => void action("expand")} className="rounded-lg bg-primary text-white px-4 py-2 disabled:opacity-50">Request fresh AI drafts</button>
          <button onClick={() => void status.refetch()} className="rounded-lg border px-4 py-2">Refresh status</button>
        </div>
        <section className="rounded-xl border p-5">
          <h3 className="font-bold mb-3">Upcoming devotions</h3>
          <p className="text-sm text-muted-foreground mb-3">Automatic checks run every six hours and reserve seven days ahead. Open a reading for pastoral review.</p>
          {!data.scheduled.length && <p>No future dates reserved yet.</p>}
          {data.scheduled.map(d => <details key={d.date} className="border-t py-3"><summary className="cursor-pointer"><strong>{d.date}</strong> · {d.title} <span className="text-xs text-muted-foreground">{d.category}</span></summary>{d.content ? preview(d.content) : <p className="mt-3">Existing legacy reading; original content retained.</p>}</details>)}
        </section>
        {data.review.length > 0 && <section className="rounded-xl border p-5">
          <h3 className="font-bold mb-3">Preserved material requiring review</h3>
          {data.review.map(d => <details key={d.topic_key} className="border-t py-3"><summary className="cursor-pointer">{d.title} · {d.review_reason}</summary>{preview(d.content)}<p className="text-xs mt-3">This original is retained, not republished. Import a genuinely new lesson rather than rename a duplicate.</p></details>)}
        </section>}
      </>}
      <section className="rounded-xl border p-5 space-y-3">
        <h3 className="font-bold">Import pastorally reviewed readings</h3>
        <p className="text-sm text-muted-foreground">Paste a JSON array of 1–12 readings. Each needs topic, category, title, reference, scripture, scriptureVersion (&quot;KJV&quot;), introduction, message, application, and closingPrayer. Scripture quotations and duplicates are checked before an atomic import.</p>
        <textarea aria-label="Devotion JSON" value={json} onChange={e => setJson(e.target.value)} rows={9} className="w-full rounded-lg border p-3 font-mono text-xs" placeholder='[{"topic":"A specific new lesson", "category":"Faith", ...}]' />
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />I have reviewed the theology, originality, Scripture context, and practical advice.</label>
        <button disabled={busy || !reviewed || !json.trim()} onClick={() => void action("import")} className="rounded-lg border px-4 py-2 disabled:opacity-40">Check and import</button>
      </section>
      {notice && <p role="status" className="rounded-lg border p-4 text-sm">{notice}</p>}
    </div>
  );
}

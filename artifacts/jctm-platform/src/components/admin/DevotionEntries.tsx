import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { CalendarDays, ChevronLeft, ChevronRight, Eye, EyeOff, Loader2, Lock, Pencil, Plus, RefreshCw, Search, Send, X } from "lucide-react";

export const DEVOTION_CATEGORIES = [
  "Faith", "Prayer", "Love", "Forgiveness", "Salvation", "Holiness",
  "Obedience", "Spiritual Growth", "Patience", "Gratitude", "Perseverance",
  "Divine Direction", "Holy Spirit", "Christian Living", "Community", "Stewardship",
] as const;

export type EntryState = "scheduled" | "published" | "draft" | "unpublished" | "review";
export type EntryContent = {
  topic: string; category: string; title: string; reference: string; scripture: string; scriptureVersion: string;
  introduction: string; message: string; application: string; closingPrayer: string; declaration: string;
  sources?: { kind: string; id: string; title: string; url?: string }[];
  seriesId?: string; seriesDay?: number;
};
export type Entry = { id: string; date: string | null; state: EntryState; content: EntryContent; revision: number; editable: boolean };
type EntriesResponse = { entries: Entry[]; total: number; page: number; pageSize: number; series: { id: string; count: number; firstDate: string | null; lastDate: string | null }[] };

const PAGE_SIZE = 30;
const apiBase = () => `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/devotion/admin/entries`;

async function call(token: string, path: string, method: string, body?: unknown) {
  const res = await fetch(`${apiBase()}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data?.error === "string" ? data.error : "Request failed";
    if (res.status === 409) throw new Error(`Conflict: ${msg}. Refresh the list to see the latest version.`);
    if (res.status === 422) throw new Error(`Scripture check failed: ${msg}`);
    if (res.status === 401) throw new Error("Your admin session has expired. Sign in again.");
    throw new Error(msg);
  }
  return data;
}

const STATE_STYLE: Record<EntryState, string> = {
  published: "bg-emerald-50 text-emerald-800 border-emerald-200",
  scheduled: "bg-sky-50 text-sky-800 border-sky-200",
  draft: "bg-amber-50 text-amber-900 border-amber-200",
  unpublished: "bg-slate-100 text-slate-700 border-slate-300",
  review: "bg-rose-50 text-rose-800 border-rose-200",
};
const STATE_LABEL: Record<EntryState, string> = { published: "Published", scheduled: "Scheduled", draft: "Draft", unpublished: "Hidden", review: "Needs review" };

export function StateBadge({ state }: { state: EntryState }) {
  return <span data-testid={`status-entry-${state}`} className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATE_STYLE[state]}`}>{STATE_LABEL[state]}</span>;
}

export function ReadingPreview({ c }: { c: EntryContent }) {
  const block = (label: string, text?: string) => text ? (
    <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground mb-1">{label}</p><p className="whitespace-pre-line">{text}</p></div>
  ) : null;
  return (
    <article className="space-y-4 text-sm leading-7 rounded-xl bg-background border p-4 sm:p-5">
      <div>
        <p className="text-xs text-muted-foreground">{c.category}{c.topic ? ` · ${c.topic}` : ""}{c.seriesId ? ` · Series ${c.seriesId}${c.seriesDay ? `, month ${Math.ceil(c.seriesDay / 30)}, day ${c.seriesDay}` : ""}` : ""}</p>
        <h4 className="text-lg mt-1">{c.title}</h4>
      </div>
      <blockquote className="border-l-4 border-accent pl-4 italic font-serif">{c.scripture}<span className="not-italic block text-xs font-sans font-semibold mt-1">{c.reference} ({c.scriptureVersion || "KJV"})</span></blockquote>
      {block("Introduction", c.introduction)}
      {block("Message", c.message)}
      {block("Practical application", c.application)}
      {block("Closing prayer", c.closingPrayer)}
      {c.declaration && <div className="rounded-lg bg-primary/5 border border-primary/15 p-3"><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary mb-1">Declaration</p><p className="font-semibold">{c.declaration}</p></div>}
      {!!c.sources?.length && <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground mb-1">Sources</p>
        <ul className="flex flex-wrap gap-2">{c.sources.map(s => <li key={`${s.kind}-${s.id}`} className="rounded-full border px-3 py-0.5 text-xs">
          <span className="text-muted-foreground">{s.kind}: </span>{s.url ? <a href={s.url} target="_blank" rel="noreferrer" className="underline">{s.title}</a> : s.title}
        </li>)}</ul></div>}
    </article>
  );
}

const EMPTY: EntryContent = { topic: "", category: "Faith", title: "", reference: "", scripture: "", scriptureVersion: "KJV", introduction: "", message: "", application: "", closingPrayer: "", declaration: "" };

function DevotionEditor({ token, entry, onClose, onSaved }: { token: string; entry: Entry | null; onClose: () => void; onSaved: (msg: string) => void }) {
  const form = useForm<EntryContent>({ defaultValues: entry ? { ...EMPTY, ...entry.content } : EMPTY, mode: "onBlur" });
  const [reviewed, setReviewed] = useState(false);
  const [preview, setPreview] = useState(false);
  const save = useMutation({
    mutationFn: (values: EntryContent) => {
      // Keep sources/series metadata intact; the form only edits text fields.
      const content: EntryContent = entry ? { ...entry.content, ...values, sources: entry.content.sources, seriesId: entry.content.seriesId, seriesDay: entry.content.seriesDay } : values;
      return entry
        ? call(token, `/${encodeURIComponent(entry.id)}`, "PUT", { content, revision: entry.revision, confirmReviewed: true })
        : call(token, "", "POST", { content, confirmReviewed: true });
    },
    onSuccess: (_d, v) => onSaved(entry ? `Saved changes to "${v.title}".` : `Draft "${v.title}" created. Schedule it when ready.`),
  });
  const title = form.watch("title");
  const field = "mt-1.5 block w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-accent";
  const required = (label: string) => ({ validate: (v: unknown) => String(v ?? "").trim().length > 0 || `${label} is required` });
  const text = (k: keyof EntryContent, label: string, opts: { rows?: number; hint?: string; placeholder?: string; className?: string } = {}) => (
    <FormField control={form.control} name={k} rules={required(label)} render={({ field: f }) => (
      <FormItem className={opts.className}>
        <FormLabel className="text-sm font-medium">{label}{opts.hint && <span className="font-normal text-muted-foreground"> · {opts.hint}</span>}</FormLabel>
        <FormControl>
          {opts.rows
            ? <textarea data-testid={`input-${k}`} rows={opts.rows} {...f} value={String(f.value ?? "")} className={`${field} leading-6`} />
            : <input data-testid={`input-${k}`} placeholder={opts.placeholder} {...f} value={String(f.value ?? "")} className={field} />}
        </FormControl>
        <FormMessage />
      </FormItem>
    )} />
  );
  return (
    <section className="rounded-2xl border-2 border-primary/20 bg-card p-4 sm:p-6 space-y-5" aria-label="Devotion editor">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{entry ? "Edit unpublished reading" : "New draft"}</p>
          <h3 className="text-xl mt-1">{title || "Untitled reading"}</h3>
          {entry && <p className="text-xs text-muted-foreground mt-1">Revision {entry.revision} · {entry.id}</p>}
        </div>
        <div className="flex gap-2">
          <button type="button" data-testid="button-toggle-preview" onClick={() => setPreview(p => !p)} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm"><Eye className="w-4 h-4" />{preview ? "Back to form" : "Preview"}</button>
          <button type="button" data-testid="button-close-editor" onClick={onClose} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm"><X className="w-4 h-4" />Close</button>
        </div>
      </div>
      {preview && <ReadingPreview c={{ ...(entry?.content ?? {}), ...form.getValues() } as EntryContent} />}
      <Form {...form}>
        <form id="devotion-form" className={preview ? "hidden" : "space-y-4"} onSubmit={form.handleSubmit(v => save.mutate(v))}>
          <div className="grid gap-4 sm:grid-cols-2">
            {text("title", "Title", { className: "sm:col-span-2" })}
            {text("topic", "Specific lesson (topic)")}
            <FormField control={form.control} name="category" rules={required("Category")} render={({ field: f }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">Category</FormLabel>
                <FormControl><select data-testid="select-category" {...f} value={String(f.value)} className={field}>{DEVOTION_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            {text("reference", "Reference", { placeholder: "John 20:29" })}
            {text("scriptureVersion", "Version")}
          </div>
          {text("scripture", "Scripture text", { rows: 3, hint: "quoted exactly; checked on save" })}
          {text("introduction", "Introduction", { rows: 3 })}
          {text("message", "Message", { rows: 8 })}
          {text("application", "Practical application", { rows: 4 })}
          {text("closingPrayer", "Closing prayer", { rows: 3 })}
          {text("declaration", "Declaration", { rows: 2 })}
          {!!entry?.content.sources?.length && <p className="text-xs text-muted-foreground">{entry.content.sources.length} source label(s) are kept unchanged on save.</p>}
        </form>
      </Form>
      <div className="border-t pt-4 space-y-3">
        <label className="flex items-start gap-2 text-sm"><input data-testid="checkbox-reviewed" type="checkbox" className="mt-1" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />I have reviewed the theology, originality, Scripture context, and practical advice.</label>
        {save.error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{save.error.message}</p>}
        <div className="flex flex-wrap gap-2">
          <button form="devotion-form" type="submit" onClick={() => setPreview(false)} data-testid="button-save-entry" disabled={!reviewed || save.isPending} className="inline-flex items-center gap-2 rounded-lg bg-primary text-white px-4 py-2 text-sm font-semibold disabled:opacity-40">
            {save.isPending && <Loader2 className="w-4 h-4 animate-spin" />}{save.isPending ? "Checking and saving" : entry ? "Save changes" : "Create draft"}
          </button>
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
        </div>
      </div>
    </section>
  );
}

function EntryRow({ token, entry, onEdit, onDone }: { token: string; entry: Entry; onEdit: () => void; onDone: (msg: string, error?: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(entry.date ?? "");
  const [confirmHide, setConfirmHide] = useState(false);
  const act = useMutation({
    mutationFn: ({ path, body }: { path: string; body: unknown; label: string }) => call(token, `/${encodeURIComponent(entry.id)}/${path}`, "POST", body),
    onSuccess: (_d, v) => { setConfirmHide(false); onDone(v.label); },
    onError: e => onDone((e as Error).message, true),
  });
  const pending = act.isPending;
  const isLive = entry.state === "published";
  const canPublish = entry.state === "unpublished" || entry.state === "draft";
  const canHide = entry.state === "published" || entry.state === "scheduled";
  const canSchedule = entry.editable && entry.state !== "published";
  const btn = "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40";
  return (
    <li data-testid={`row-entry-${entry.id}`} className="border-t first:border-t-0">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full text-left py-3 px-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-xs w-24 shrink-0 text-muted-foreground">{entry.date ?? "No date"}</span>
        <span className="font-semibold flex-1 min-w-[12rem]">{entry.content.title}</span>
        <span className="text-xs text-muted-foreground">{entry.content.category}</span>
        <StateBadge state={entry.state} />
        {!entry.editable && <Lock aria-label="Read-only" className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>
      {open && <div className="pb-5 space-y-4">
        <div className="flex flex-wrap items-end gap-2 rounded-xl bg-secondary/60 p-3">
          {entry.editable && !isLive && <button data-testid={`button-edit-${entry.id}`} onClick={onEdit} className={btn}><Pencil className="w-3.5 h-3.5" />Edit</button>}
          {canSchedule && <form className="flex items-end gap-2" onSubmit={e => { e.preventDefault(); act.mutate({ path: "schedule", body: { date, revision: entry.revision }, label: `"${entry.content.title}" set for ${date}.` }); }}>
            <label className="text-xs font-medium">{entry.date ? "Change date" : "Schedule for"}<input required type="date" data-testid={`input-date-${entry.id}`} value={date} onChange={e => setDate(e.target.value)} className="block mt-1 rounded-lg border bg-background px-2 py-1.5 text-xs" /></label>
            <button disabled={pending || !date || date === entry.date} className={btn}><CalendarDays className="w-3.5 h-3.5" />{entry.date ? "Move" : "Schedule"}</button>
          </form>}
          {canPublish && <button data-testid={`button-publish-${entry.id}`} disabled={pending} onClick={() => act.mutate({ path: "publish", body: { revision: entry.revision }, label: entry.state === "draft" ? `"${entry.content.title}" queued for publication.` : `"${entry.content.title}" is visible again.` })} className={`${btn} bg-primary text-white border-primary`}><Send className="w-3.5 h-3.5" />{entry.state === "draft" ? "Publish / queue" : "Restore visibility"}</button>}
          {canHide && !confirmHide && <button data-testid={`button-unpublish-${entry.id}`} disabled={pending} onClick={() => setConfirmHide(true)} className={btn}><EyeOff className="w-3.5 h-3.5" />{isLive ? "Unpublish" : "Pause"}</button>}
          {pending && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
        {confirmHide && <div role="alertdialog" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 space-y-3">
          <p>{isLive ? "Readers will no longer see this devotion on the website or app. The reading and its history are kept and can be restored." : "This scheduled reading will not go live on its date until restored. Nothing is deleted."}</p>
          <div className="flex gap-2">
            <button data-testid={`button-confirm-unpublish-${entry.id}`} disabled={pending} onClick={() => act.mutate({ path: "unpublish", body: { revision: entry.revision }, label: `"${entry.content.title}" hidden from readers.` })} className="rounded-lg bg-amber-900 text-white px-3 py-2 text-xs font-semibold">Yes, hide from readers</button>
            <button onClick={() => setConfirmHide(false)} className="rounded-lg border border-amber-300 px-3 py-2 text-xs">Keep visible</button>
          </div>
        </div>}
        {isLive && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Lock className="w-3 h-3" />Published content is preserved as history and cannot be edited.</p>}
        <ReadingPreview c={entry.content} />
      </div>}
    </li>
  );
}

export function DevotionEntries({ token }: { token: string }) {
  const cache = useQueryClient();
  const [state, setState] = useState("all");
  const [series, setSeries] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Entry | "new" | null>(null);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [authEpoch, setAuthEpoch] = useState(0);

  useEffect(() => {
    setEditing(null); setNotice(null); setPage(1); setState("all"); setSeries(""); setSearchInput(""); setSearch(""); setAuthEpoch(n => n + 1);
    cache.removeQueries({ queryKey: ["devotion-entries"] });
  }, [token, cache]);
  useEffect(() => { const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350); return () => clearTimeout(t); }, [searchInput]);

  const q = useQuery<EntriesResponse>({
    queryKey: ["devotion-entries", Boolean(token), authEpoch, page, state, search, series],
    enabled: Boolean(token),
    // Only carry previous pages within the same sign-in session.
    placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[2] === authEpoch ? prev : undefined),
    refetchOnMount: "always",
    refetchInterval: 30000,
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), state });
      if (search) p.set("search", search);
      if (series) p.set("series", series);
      return call(token, `?${p}`, "GET");
    },
  });
  const done = async (text: string, error?: boolean) => {
    setNotice({ text, error });
    if (!error) await Promise.all([cache.invalidateQueries({ queryKey: ["devotion-entries"] }), cache.invalidateQueries({ queryKey: ["devotion-library"] })]);
  };
  const data = q.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const tabs: [string, string][] = [["all", "All"], ["scheduled", "Scheduled"], ["draft", "Drafts"], ["published", "Published archive"], ["unpublished", "Hidden"]];

  return (
    <section className="rounded-2xl border bg-card p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Editorial workspace</p>
          <h3 className="text-xl mt-1">Daily readings</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-prose">Prepare drafts, assign dates, and control what readers see. Published readings stay on record.</p>
        </div>
        <div className="flex gap-2">
          <button data-testid="button-refresh-entries" onClick={() => void q.refetch()} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm"><RefreshCw className={`w-4 h-4 ${q.isFetching ? "animate-spin" : ""}`} />Refresh</button>
          <button data-testid="button-new-entry" onClick={() => { setEditing("new"); setNotice(null); }} className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-white px-4 py-2 text-sm font-semibold"><Plus className="w-4 h-4" />New reading</button>
        </div>
      </div>

      {editing && <DevotionEditor key={editing === "new" ? "new" : `${editing.id}-${editing.revision}`} token={token} entry={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={msg => { setEditing(null); void done(msg); }} />}
      {notice && <p role="status" data-testid="status-entries-notice" className={`rounded-lg border p-3 text-sm flex justify-between gap-3 ${notice.error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>{notice.text}<button aria-label="Dismiss" onClick={() => setNotice(null)} className="h-5"><X className="w-4 h-4" /></button></p>}

      <div className="space-y-3">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide -mx-1 px-1" role="tablist">
          {tabs.map(([v, l]) => <button key={v} role="tab" aria-selected={state === v} data-testid={`tab-state-${v}`} onClick={() => { setState(v); setPage(1); }} className={`whitespace-nowrap rounded-full px-3.5 py-1.5 h-9 text-sm border ${state === v ? "bg-primary text-white border-primary" : "bg-background"}`}>{l}</button>)}
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_14rem]">
          <label className="relative"><span className="sr-only">Search</span><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input data-testid="input-search-entries" value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search title, topic, or reference" className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm" /></label>
          <select data-testid="select-series" aria-label="Series" value={series} onChange={e => { setSeries(e.target.value); setPage(1); }} className="rounded-lg border bg-background px-3 py-2 text-sm">
            <option value="">All series</option>
            {data?.series.map(s => <option key={s.id} value={s.id}>{s.id} ({s.count})</option>)}
          </select>
        </div>
      </div>

      {q.isLoading && <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-11 rounded-lg bg-muted animate-pulse" />)}</div>}
      {q.error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex flex-wrap items-center justify-between gap-2">{q.error.message}<button onClick={() => void q.refetch()} className="rounded-lg border border-red-300 px-3 py-1.5 text-xs h-8">Try again</button></div>}
      {data && !data.entries.length && <div className="rounded-xl border border-dashed p-8 text-center">
        <p className="font-semibold">No readings match</p>
        <p className="text-sm text-muted-foreground mt-1">Adjust the filters or start a new draft.</p>
      </div>}
      {data && data.entries.length > 0 && <ul className={`transition-opacity ${q.isPlaceholderData ? "opacity-60" : ""}`}>
        {data.entries.map(e => <EntryRow key={`${e.id}-${e.revision}`} token={token} entry={e} onEdit={() => { setEditing(e); window.scrollTo({ top: 0, behavior: "smooth" }); }} onDone={done} />)}
      </ul>}
      {data && data.total > 0 && <div className="flex items-center justify-between gap-3 border-t pt-3 text-sm">
        <span className="text-muted-foreground" data-testid="text-entries-total">{data.total} readings · page {data.page} of {pages}</span>
        <div className="flex gap-2">
          <button data-testid="button-prev-page" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="inline-flex items-center rounded-lg border px-3 py-1.5 h-9 disabled:opacity-40"><ChevronLeft className="w-4 h-4" />Previous</button>
          <button data-testid="button-next-page" disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="inline-flex items-center rounded-lg border px-3 py-1.5 h-9 disabled:opacity-40">Next<ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>}
    </section>
  );
}

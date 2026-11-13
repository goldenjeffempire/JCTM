import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { CrusadeCampaign, CrusadeProgram } from "@workspace/content";
import { toast } from "sonner";
import { Flame, Plus, Trash2, Upload, Save, RotateCcw, AlertTriangle, Lock, ExternalLink } from "lucide-react";
import { crusadeKey } from "@/lib/crusade-api";
import { CRUSADE_PATH, isoToWatLocal, watLocalToIso, campaignSignature } from "@/lib/crusade-format";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const adminRoot = [...crusadeKey, "admin"] as const;
const FLYER_RE = /^(\/images\/[\w.-]+\.(webp|png|jpe?g)|\/api\/storage\/objects\/uploads\/[\w-]+\.webp)$/i;

type HttpError = Error & { status?: number };
async function adminFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api/crusade-2026${path}`, {
    ...init, cache: "no-store", headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(typeof body?.error === "string" ? body.error : `Request failed (${res.status})`) as HttpError;
    err.status = res.status;
    throw err;
  }
  return body as T;
}

function validate(c: CrusadeCampaign): string[] {
  const e: string[] = [];
  if (!c.title.trim()) e.push("Campaign title is required.");
  if (!c.minister.trim()) e.push("Minister is required.");
  if (!c.venue.trim()) e.push("Venue is required.");
  if (!FLYER_RE.test(c.flyerUrl.trim())) e.push("Flyer path must be /images/<file>.webp|png|jpg or an uploaded /api/storage/objects/uploads/<id>.webp file.");
  c.programs.forEach((p, i) => {
    if (!p.title.trim()) e.push(`Programme ${i + 1}: title is required.`);
    if (p.startsAt.length === 0) e.push(`Programme ${i + 1}: add at least one date/time.`);
    if (p.startsAt.some(s => Number.isNaN(Date.parse(s)))) e.push(`Programme ${i + 1}: a date/time is invalid.`);
  });
  return e;
}

export function Crusade2026Admin({ token }: { token: string }) {
  const qc = useQueryClient();
  const [auth, setAuth] = useState({ token, epoch: 0 });
  const [draft, setDraft] = useState<CrusadeCampaign | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [conflict, setConflict] = useState(false);
  const loadedRevision = useRef<number | null>(null);
  if (auth.token !== token) {
    // Auth changed: drop every trace of the previous session before rendering
    setAuth({ token, epoch: auth.epoch + 1 });
    setDraft(null); setErrors([]); setConflict(false);
    loadedRevision.current = null;
  }
  useEffect(() => {
    qc.removeQueries({ queryKey: adminRoot, predicate: q => q.queryKey[2] !== auth.epoch });
  }, [auth.epoch, qc]);
  const adminKey = [...adminRoot, auth.epoch] as const;
  const query = useQuery({
    queryKey: adminKey, gcTime: 0, enabled: !!token, retry: 1,
    queryFn: () => adminFetch<CrusadeCampaign>(token, "/admin"),
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const server = query.data;
  const dirty = !!draft && !!server && campaignSignature(draft) !== campaignSignature(server);

  useEffect(() => {
    if (server && loadedRevision.current === null) {
      loadedRevision.current = server.revision;
      setDraft(structuredClone(server));
    }
  }, [server]);

  if (!token) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 flex gap-3 items-start" data-testid="status-crusade-admin-signin">
        <Lock className="h-5 w-5 text-muted-foreground mt-0.5" />
        <div><p className="font-semibold text-primary">End of Year Crusade 2026</p>
          <p className="text-sm text-muted-foreground">Sign in with the livestream admin credentials to manage the crusade campaign.</p></div>
      </div>
    );
  }
  if (query.isLoading || (!draft && !query.isError)) return <div className="h-64 rounded-2xl bg-muted animate-pulse" aria-label="Loading crusade settings" />;
  if (query.isError || !draft) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6" role="alert">
        <p className="font-semibold text-destructive">Could not load the crusade campaign</p>
        <p className="text-sm text-muted-foreground mt-1">{query.error instanceof Error ? query.error.message : "Unknown error"}</p>
        <button onClick={() => query.refetch()} className="mt-3 text-sm font-semibold underline">Retry</button>
      </div>
    );
  }

  const set = (patch: Partial<CrusadeCampaign>) => setDraft(d => (d ? { ...d, ...patch } : d));
  const setProgram = (idx: number, patch: Partial<CrusadeProgram>) =>
    setDraft(d => (d ? { ...d, programs: d.programs.map((p, i) => (i === idx ? { ...p, ...patch } : p)) } : d));

  const reloadLatest = async () => {
    const r = await query.refetch();
    if (r.data) { loadedRevision.current = r.data.revision; setDraft(structuredClone(r.data)); setConflict(false); setErrors([]); toast.success("Loaded latest version"); }
  };

  const save = async () => {
    const payload: CrusadeCampaign = {
      ...draft, flyerUrl: draft.flyerUrl.trim(),
      programs: draft.programs.map(p => ({ ...p, startsAt: [...p.startsAt].sort((a, b) => Date.parse(a) - Date.parse(b)) })),
    };
    const errs = validate(payload);
    setErrors(errs);
    if (errs.length) return;
    setSaving(true);
    try {
      const updated = await adminFetch<CrusadeCampaign>(token, "/admin", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      qc.setQueryData(adminKey, updated);
      loadedRevision.current = updated.revision;
      setDraft(structuredClone(updated));
      await qc.invalidateQueries({ queryKey: crusadeKey });
      toast.success("Crusade campaign saved");
    } catch (e) {
      if ((e as HttpError).status === 409) setConflict(true);
      else toast.error(e instanceof Error ? e.message : "Save failed");
    } finally { setSaving(false); }
  };

  const upload = async (file: File) => {
    if (!/^image\/(webp|png|jpe?g)$/.test(file.type)) { toast.error("Choose a WEBP, PNG or JPG image."); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("flyer", file);
      const res = await fetch(`${BASE}/api/crusade-2026/admin/flyer`, { method: "POST", body: fd, headers: { Authorization: `Bearer ${token}` } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || typeof body.flyerUrl !== "string") throw new Error(body.error ?? "Upload failed");
      set({ flyerUrl: body.flyerUrl });
      toast.success("Flyer uploaded — click Save to publish it");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Upload failed"); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const input = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
  const flyerChanged = server && draft.flyerUrl !== server.flyerUrl;

  return (
    <section className="rounded-2xl border border-[#ff7a18]/30 bg-card overflow-hidden" data-testid="section-crusade-admin">
      <header className="flex flex-wrap items-center gap-3 justify-between px-6 py-4 bg-gradient-to-r from-[#071130] to-[#2a0b1e] text-white">
        <div className="flex items-center gap-3">
          <Flame className="h-5 w-5 text-[#ffc93c]" />
          <div><h3 className="!text-white font-bold">End of Year Crusade 2026</h3>
            <p className="text-xs text-white/60">Revision {draft.revision} · times entered in Nigeria time (WAT, UTC+1)</p></div>
        </div>
        <a href={`${BASE}${CRUSADE_PATH}`} target="_blank" rel="noopener noreferrer" className="text-xs inline-flex items-center gap-1 text-white/80 hover:text-white">View page <ExternalLink className="h-3 w-3" /></a>
      </header>

      <div className="p-6 space-y-6">
        {conflict && (
          <div className="rounded-xl border border-amber-400/50 bg-amber-50 p-4 flex flex-wrap gap-3 items-center" role="alert">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <p className="text-sm text-amber-900 flex-1">Someone else saved changes since you loaded this. Reload the latest version (your unsaved edits will be discarded) and apply them again.</p>
            <button onClick={reloadLatest} className="h-9 px-4 rounded-lg bg-amber-600 text-white text-sm font-semibold" data-testid="button-crusade-reload">Reload latest</button>
          </div>
        )}
        {errors.length > 0 && (
          <ul className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive list-disc pl-8" role="alert">
            {errors.map(e => <li key={e}>{e}</li>)}
          </ul>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <label className="block text-sm font-medium">Campaign title
            <input className={`${input} mt-1`} value={draft.title} onChange={e => set({ title: e.target.value })} data-testid="input-crusade-title" /></label>
          <label className="block text-sm font-medium">Minister
            <input className={`${input} mt-1`} value={draft.minister} onChange={e => set({ minister: e.target.value })} data-testid="input-crusade-minister" /></label>
          <label className="block text-sm font-medium md:col-span-2">Venue
            <textarea rows={2} className={`${input} mt-1 resize-none`} value={draft.venue} onChange={e => set({ venue: e.target.value })} data-testid="input-crusade-venue" /></label>
        </div>

        <label className="flex items-center gap-3 rounded-xl border border-border p-4 cursor-pointer">
          <input type="checkbox" className="h-4 w-4 accent-[#b3122e]" checked={draft.published} onChange={e => set({ published: e.target.checked })} data-testid="checkbox-crusade-published" />
          <span className="text-sm"><b>Published</b> — when off, the crusade disappears from the homepage, events and its page.</span>
        </label>

        <div className="rounded-xl border border-border p-4 grid sm:grid-cols-[160px_1fr] gap-4">
          <img src={draft.flyerUrl} alt="Flyer preview" className="w-full rounded-lg border border-border bg-muted" />
          <div className="space-y-2">
            <label className="block text-sm font-medium">Flyer path (same-origin)
              <input className={`${input} mt-1 font-mono`} value={draft.flyerUrl} onChange={e => set({ flyerUrl: e.target.value })} data-testid="input-crusade-flyer" /></label>
            <input ref={fileRef} type="file" accept="image/webp,image/png,image/jpeg" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="h-9 px-4 rounded-lg border border-border text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50" data-testid="button-crusade-upload">
              <Upload className="h-4 w-4" /> {uploading ? "Uploading…" : "Upload new flyer"}
            </button>
            {flyerChanged && <p className="text-xs font-semibold text-amber-700" role="status">Flyer changed but not live yet — click Save campaign to apply it.</p>}
          </div>
        </div>

        <div className="space-y-4">
          {draft.programs.map((p, idx) => (
            <fieldset key={p.id} className="rounded-xl border border-border p-4 space-y-3" data-testid={`fieldset-program-${p.id}`}>
              <legend className="px-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Programme {idx + 1} · {p.id}</legend>
              <div className="grid md:grid-cols-2 gap-3">
                <label className="block text-sm font-medium">Title
                  <input className={`${input} mt-1`} value={p.title} onChange={e => setProgram(idx, { title: e.target.value })} /></label>
                <label className="block text-sm font-medium">Description <span className="text-muted-foreground font-normal">(dates shown publicly come from the times below)</span>
                  <input className={`${input} mt-1`} value={p.description} onChange={e => setProgram(idx, { description: e.target.value })} /></label>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-[#b3122e]" checked={p.published} onChange={e => setProgram(idx, { published: e.target.checked })} /> Published
              </label>
              <div className="space-y-2">
                <p className="text-sm font-medium">Start times (WAT)</p>
                {p.startsAt.map((s, j) => (
                  <div key={j} className="flex gap-2 items-center">
                    <input type="datetime-local" aria-label={`${p.title} start ${j + 1} in WAT`} className={`${input} max-w-xs`} value={isoToWatLocal(s)}
                      onChange={e => { const iso = watLocalToIso(e.target.value); if (iso) setProgram(idx, { startsAt: p.startsAt.map((x, k) => (k === j ? iso : x)) }); }} />
                    <span className="text-xs text-muted-foreground">WAT</span>
                    <button type="button" aria-label="Remove time" onClick={() => setProgram(idx, { startsAt: p.startsAt.filter((_, k) => k !== j) })} className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
                <button type="button" onClick={() => {
                  const last = p.startsAt[p.startsAt.length - 1];
                  const next = last ? new Date(Date.parse(last) + 86_400_000) : null;
                  setProgram(idx, { startsAt: [...p.startsAt, next ? watLocalToIso(isoToWatLocal(next.toISOString()))! : "2026-12-31T20:00:00+01:00"] });
                }} className="h-9 px-3 rounded-lg border border-dashed border-border text-sm inline-flex items-center gap-1.5 hover:bg-muted"><Plus className="h-4 w-4" /> Add time</button>
              </div>
            </fieldset>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 justify-end sticky bottom-0 bg-card/95 backdrop-blur py-3 border-t border-border">
          {dirty && <span className="mr-auto text-sm text-amber-700 self-center">Unsaved changes</span>}
          <button type="button" disabled={!dirty || saving} onClick={() => { if (server) { setDraft(structuredClone(server)); setErrors([]); } }} className="h-10 px-4 rounded-lg border border-border text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-40" data-testid="button-crusade-discard">
            <RotateCcw className="h-4 w-4" /> Discard
          </button>
          <button type="button" disabled={!dirty || saving || conflict} onClick={save} className="h-10 px-5 rounded-lg bg-[#b3122e] text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-40" data-testid="button-crusade-save">
            <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save campaign"}
          </button>
        </div>
      </div>
    </section>
  );
}

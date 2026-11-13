import { useEffect, useMemo, useRef, useState } from "react";
import type { CrusadeCampaign } from "@workspace/content";
import { toast } from "sonner";
import { Download, Share2, Copy, Facebook, MessageCircle, RefreshCw, ImageOff, Check } from "lucide-react";
import { renderInvitation, loadFlyer, canvasToBlob, INVITE_SIZE, type InviteFormat } from "./invitation-canvas";
import { CRUSADE_CANONICAL, invitationText, publishedPrograms } from "@/lib/crusade-format";

const NAME_MAX = 80;
const MSG_MAX = 350;

async function copyText(text: string) {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* fall through */ }
  const ta = document.createElement("textarea");
  ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta); ta.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch { ok = false; }
  document.body.removeChild(ta);
  return ok;
}

export function InvitationGenerator({ campaign }: { campaign: CrusadeCampaign }) {
  const programs = useMemo(() => publishedPrograms(campaign), [campaign]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [programId, setProgramId] = useState(programs[0]?.id ?? "");
  const [format, setFormat] = useState<InviteFormat>("square");
  const [flyer, setFlyer] = useState<{ status: "loading" | "ready" | "error"; img?: HTMLImageElement }>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState<null | "download" | "share">(null);
  const [status, setStatus] = useState("");
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const program = programs.find(p => p.id === programId) ?? programs[0];
  useEffect(() => { if (program && program.id !== programId) setProgramId(program.id); }, [program, programId]);

  useEffect(() => {
    let alive = true;
    setFlyer({ status: "loading" });
    loadFlyer(campaign.flyerUrl).then(img => alive && setFlyer({ status: "ready", img }))
      .catch(() => alive && setFlyer({ status: "error" }));
    return () => { alive = false; };
  }, [campaign.flyerUrl, reloadKey]);

  useEffect(() => {
    if (flyer.status !== "ready" || !flyer.img || !program || !canvasRef.current) return;
    const id = requestAnimationFrame(() => {
      if (canvasRef.current && flyer.img) {
        renderInvitation(canvasRef.current, { format, flyer: flyer.img, campaign, program, name: name.slice(0, NAME_MAX), message: message.slice(0, MSG_MAX) });
      }
    });
    return () => cancelAnimationFrame(id);
  }, [flyer, format, campaign, program, name, message]);

  if (!program) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-white/75" data-testid="status-invite-unavailable">
        Invitations will be available once a programme is published.
      </div>
    );
  }

  const text = invitationText(campaign, program, name, message);
  const fileName = `jctm-crusade-2026-${program.id}-${format}.png`;
  const ready = flyer.status === "ready";
  const canShareFiles = typeof navigator !== "undefined" && typeof navigator.canShare === "function";

  const getFile = async () => {
    if (!canvasRef.current) throw new Error("Preview not ready");
    const blob = await canvasToBlob(canvasRef.current);
    return new File([blob], fileName, { type: "image/png" });
  };

  const onDownload = async () => {
    setBusy("download");
    try {
      const file = await getFile();
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url; a.download = fileName; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setStatus("Invitation image downloaded.");
      toast.success("Invitation downloaded");
    } catch (e) {
      setStatus("Download failed. Please try again.");
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally { setBusy(null); }
  };

  const onShare = async () => {
    setBusy("share");
    try {
      const file = await getFile();
      if (!navigator.canShare?.({ files: [file] })) throw new Error("Image sharing is not supported on this device. Download it instead.");
      await navigator.share({ files: [file], title: campaign.title, text });
      setStatus("Shared.");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setStatus(e instanceof Error ? e.message : "Sharing failed.");
      toast.error(e instanceof Error ? e.message : "Sharing failed");
    } finally { setBusy(null); }
  };

  const onCopy = async () => {
    const ok = await copyText(text);
    setStatus(ok ? "Invitation text copied." : "Could not copy. Select the text below and copy manually.");
    if (ok) { toast.success("Invitation text copied"); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    else toast.error("Copy failed");
  };

  const field = "w-full rounded-xl bg-[#060d26]/60 border border-white/15 px-4 py-3 text-white placeholder:text-white/35 focus:border-[#ffc93c] focus:outline-none transition-colors";
  const { w, h } = INVITE_SIZE[format];

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-8 lg:gap-12 items-start">
      <form className="space-y-5" onSubmit={e => { e.preventDefault(); void onDownload(); }} aria-describedby="invite-help">
        <p id="invite-help" className="text-white/70 text-sm leading-relaxed">No sign-in needed. Your details stay on this device — the image is drawn right here in your browser.</p>
        <div>
          <div className="flex justify-between mb-1.5">
            <label htmlFor="invite-name" className="text-sm font-semibold text-white">Your name <span className="text-white/45 font-normal">(optional)</span></label>
            <span className="text-xs text-white/45 tabular-nums">{name.length}/{NAME_MAX}</span>
          </div>
          <input id="invite-name" data-testid="input-invite-name" className={field} value={name} maxLength={NAME_MAX}
            onChange={e => setName(e.target.value.slice(0, NAME_MAX))} placeholder="e.g. Sister Ese Okoro" autoComplete="name" />
        </div>
        <div>
          <div className="flex justify-between mb-1.5">
            <label htmlFor="invite-message" className="text-sm font-semibold text-white">Personal message <span className="text-white/45 font-normal">(optional)</span></label>
            <span className={`text-xs tabular-nums ${message.length >= MSG_MAX ? "text-[#ff8a5c]" : "text-white/45"}`}>{message.length}/{MSG_MAX}</span>
          </div>
          <textarea id="invite-message" data-testid="input-invite-message" rows={4} className={`${field} resize-none`} value={message} maxLength={MSG_MAX}
            onChange={e => setMessage(e.target.value.slice(0, MSG_MAX))} placeholder="Come and let us cross into the new year in God's presence." />
          {message.length >= MSG_MAX && <p className="text-xs text-[#ff8a5c] mt-1" role="status">Maximum length reached.</p>}
        </div>
        <div>
          <label htmlFor="invite-program" className="text-sm font-semibold text-white block mb-1.5">Programme</label>
          <select id="invite-program" data-testid="select-invite-program" className={field} value={program.id} onChange={e => setProgramId(e.target.value)}>
            {programs.map(p => <option key={p.id} value={p.id} className="text-black">{p.title}</option>)}
          </select>
        </div>
        <fieldset>
          <legend className="text-sm font-semibold text-white mb-1.5">Format</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["square", "portrait"] as const).map(f => (
              <button type="button" key={f} onClick={() => setFormat(f)} aria-pressed={format === f} data-testid={`button-format-${f}`}
                className={`rounded-xl border px-4 py-3 text-left transition-all ${format === f ? "border-[#ffc93c] bg-[#ffc93c]/10 text-white" : "border-white/15 text-white/65 hover:border-white/35"}`}>
                <span className="block font-bold capitalize">{f}</span>
                <span className="text-xs opacity-70">{INVITE_SIZE[f].w} × {INVITE_SIZE[f].h}px</span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-2 pt-2">
          <button type="submit" disabled={!ready || busy !== null} data-testid="button-download-invite"
            className="col-span-2 h-12 rounded-full bg-gradient-to-r from-[#ffc93c] to-[#ff7a18] text-[#2a0b1e] font-black tracking-wide inline-flex items-center justify-center gap-2 disabled:opacity-50 hover:-translate-y-0.5 transition-transform">
            <Download className="h-4 w-4" /> {busy === "download" ? "Preparing…" : "Download PNG"}
          </button>
          {canShareFiles && (
            <button type="button" onClick={onShare} disabled={!ready || busy !== null} data-testid="button-share-invite"
              className="col-span-2 h-11 rounded-full border border-white/25 text-white font-semibold inline-flex items-center justify-center gap-2 hover:bg-white/10 disabled:opacity-50">
              <Share2 className="h-4 w-4" /> {busy === "share" ? "Opening…" : "Share image"}
            </button>
          )}
          <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" data-testid="link-share-whatsapp"
            className="h-11 rounded-full bg-[#1fa855] text-white font-semibold inline-flex items-center justify-center gap-2 hover:opacity-90">
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
          <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(CRUSADE_CANONICAL)}`} target="_blank" rel="noopener noreferrer" data-testid="link-share-facebook"
            className="h-11 rounded-full bg-[#1b5fd1] text-white font-semibold inline-flex items-center justify-center gap-2 hover:opacity-90">
            <Facebook className="h-4 w-4" /> Facebook link
          </a>
          <button type="button" onClick={onCopy} data-testid="button-copy-invite"
            className="col-span-2 h-11 rounded-full border border-white/25 text-white font-semibold inline-flex items-center justify-center gap-2 hover:bg-white/10">
            {copied ? <Check className="h-4 w-4 text-[#ffc93c]" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy invitation text"}
          </button>
        </div>
        <p className="text-xs text-white/50">WhatsApp and Facebook share the text and page link. To post the image, download it or use Share image.</p>
        <p role="status" aria-live="polite" className="text-sm text-[#ffc93c] min-h-[1.25rem]" data-testid="status-invite">{status}</p>
        <details className="text-xs text-white/60">
          <summary className="cursor-pointer">Preview invitation text</summary>
          <pre className="whitespace-pre-wrap font-sans mt-2 p-3 rounded-xl bg-black/20 text-white/80">{text}</pre>
        </details>
      </form>

      <div className="lg:sticky lg:top-24">
        <div className="relative rounded-2xl overflow-hidden bg-[#060d26] border border-white/10 shadow-2xl mx-auto transition-all duration-300"
          style={{ aspectRatio: `${w} / ${h}`, maxWidth: format === "portrait" ? 480 : 560 }}>
          <canvas ref={canvasRef} width={w} height={h} className={`w-full h-full block transition-opacity duration-300 ${ready ? "opacity-100" : "opacity-0"}`}
            role="img" aria-label={`Invitation preview for ${program.title}`} data-testid="canvas-invite-preview" />
          {flyer.status === "loading" && <div className="absolute inset-0 animate-pulse bg-gradient-to-b from-[#0c1d52] to-[#2a0b1e]" aria-label="Loading preview" />}
          {flyer.status === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center p-6 text-white" role="alert">
              <ImageOff className="h-8 w-8 text-[#ffc93c]" />
              <p className="text-sm">The official flyer could not be loaded, so the invitation cannot be drawn.</p>
              <button type="button" onClick={() => setReloadKey(k => k + 1)} className="h-10 px-5 rounded-full border border-white/30 inline-flex items-center gap-2 hover:bg-white/10">
                <RefreshCw className="h-4 w-4" /> Retry
              </button>
            </div>
          )}
        </div>
        <p className="text-center text-xs text-white/45 mt-3">Exact preview of the {w} × {h} PNG you will download.</p>
      </div>
    </div>
  );
}

export default InvitationGenerator;

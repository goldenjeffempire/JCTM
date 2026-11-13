import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CrusadeCampaign } from "@workspace/content";
import { toast } from "sonner";
import { Download, Share2, Copy, Facebook, MessageCircle, RefreshCw, ImageOff, Check, Camera, Trash2, Crop, ShieldCheck } from "lucide-react";
import { renderInvitation, loadFlyer, loadBackground, loadLogo, canvasToBlob, INVITE_SIZE, type InviteFormat } from "./invitation-canvas";
import { PhotoCropper } from "./PhotoCropper";
import { readPhotoFile, inviteFileName, PHOTO_ACCEPT, type CropArea, type LoadedPhoto } from "./photo-utils";
import { CRUSADE_CANONICAL, campaignInvitationText, publishedPrograms } from "@/lib/crusade-format";

const NAME_MAX = 80;

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
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterConsent, setNewsletterConsent] = useState(false);
  const [newsletterStatus, setNewsletterStatus] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [newsletterBusy, setNewsletterBusy] = useState(false);
  const [format, setFormat] = useState<InviteFormat>("portrait");
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const [photo, setPhoto] = useState<(LoadedPhoto & { crop: CropArea }) | null>(null);
  const [editing, setEditing] = useState<LoadedPhoto | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const liveUrls = useRef(new Set<string>());
  const photoRequest = useRef(0);
  const release = (url?: string) => { if (url && liveUrls.current.has(url)) { URL.revokeObjectURL(url); liveUrls.current.delete(url); } };
  useEffect(() => {
    const urls = liveUrls.current;
    return () => { photoRequest.current++; urls.forEach(u => URL.revokeObjectURL(u)); urls.clear(); };
  }, []);
  useEffect(() => {
    let alive = true;
    loadLogo().then(img => alive && setLogo(img)).catch(() => { /* monogram fallback */ });
    return () => { alive = false; };
  }, []);

  const onPickFile = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = ""; // allow re-selecting the same file
    if (!file) return;
    const request = ++photoRequest.current;
    setPhotoError(""); setPhotoBusy(true);
    try {
      const loaded = await readPhotoFile(file);
      if (request !== photoRequest.current) { URL.revokeObjectURL(loaded.url); return; }
      liveUrls.current.add(loaded.url);
      if (editing && editing.url !== photo?.url) release(editing.url);
      setEditing(loaded);
    } catch (e) {
      if (request === photoRequest.current) setPhotoError(e instanceof Error ? e.message : "That photo could not be used.");
    } finally { if (request === photoRequest.current) setPhotoBusy(false); }
  };
  const applyCrop = (crop: CropArea) => {
    if (!editing) return;
    if (photo && photo.url !== editing.url) release(photo.url);
    setPhoto({ ...editing, crop });
    setEditing(null);
    setStatus("Photo added to your card.");
  };
  const cancelCrop = () => {
    if (editing && editing.url !== photo?.url) release(editing.url);
    setEditing(null);
  };
  const removePhoto = () => {
    photoRequest.current++;
    setPhotoBusy(false);
    if (editing && editing.url !== photo?.url) release(editing.url);
    release(photo?.url);
    setPhoto(null); setEditing(null); setPhotoError("");
    setStatus("Photo cleared from this page.");
  };
  const [flyer, setFlyer] = useState<{ status: "loading" | "ready" | "error"; img?: HTMLImageElement; bg?: HTMLImageElement }>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState<null | "download" | "share">(null);
  const [status, setStatus] = useState("");
  const [copied, setCopied] = useState(false);
  const [generatedCount, setGeneratedCount] = useState<number | null>(null);
  const [countError, setCountError] = useState(false);
  const [countNotice, setCountNotice] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const loadGeneratedCount = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/crusade-2026/invitation-count`, {
        cache: "no-store",
        signal,
      });
      if (!response.ok) throw new Error("Count request failed");
      const data = await response.json() as { generatedCount?: unknown };
      const count = Number(data.generatedCount);
      if (!Number.isSafeInteger(count) || count < 0) throw new Error("Invalid count response");
      if (signal?.aborted) return;
      setGeneratedCount(current => current === null ? count : Math.max(current, count));
      setCountError(false);
    } catch {
      if (signal?.aborted) return;
      setCountError(true);
    }
  }, []);

  const recordGeneratedCard = useCallback(async () => {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/crusade-2026/invitation-count`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok) throw new Error("Count update failed");
      const data = await response.json() as { generatedCount?: unknown };
      const count = Number(data.generatedCount);
      if (!Number.isSafeInteger(count) || count < 0) throw new Error("Invalid count response");
      setGeneratedCount(current => current === null ? count : Math.max(current, count));
      setCountError(false);
      setCountNotice("");
    } catch {
      setCountNotice("Your card was created, but the shared total could not be updated.");
      void loadGeneratedCount();
    }
  }, [loadGeneratedCount]);

  useEffect(() => {
    const controller = new AbortController();
    void loadGeneratedCount(controller.signal);
    const interval = window.setInterval(() => void loadGeneratedCount(), 60_000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [loadGeneratedCount]);


  useEffect(() => {
    let alive = true;
    setFlyer({ status: "loading" });
    // Both the official flyer and the flyer-derived background must load before preview/export.
    Promise.all([loadFlyer(campaign.flyerUrl), loadBackground()])
      .then(([img, bg]) => alive && setFlyer({ status: "ready", img, bg }))
      .catch(() => alive && setFlyer({ status: "error" }));
    return () => { alive = false; };
  }, [campaign.flyerUrl, reloadKey]);

  useEffect(() => {
    if (flyer.status !== "ready" || !flyer.img || !flyer.bg || programs.length === 0 || !canvasRef.current) return;
    const id = requestAnimationFrame(() => {
      if (canvasRef.current && flyer.img && flyer.bg) {
        renderInvitation(canvasRef.current, {
          format, flyer: flyer.img, background: flyer.bg, campaign, name: name.slice(0, NAME_MAX),
          logo, photo: photo ? { image: photo.image, crop: photo.crop } : null,
        });
      }
    });
    return () => cancelAnimationFrame(id);
  }, [flyer, format, campaign, programs.length, name, logo, photo]);

  if (programs.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-white/75" data-testid="status-invite-unavailable">
        Invitations will be available once a programme is published.
      </div>
    );
  }

  const text = campaignInvitationText(campaign, name);
  const fileName = inviteFileName("end-of-year-crusade-2026", format);
  const ready = flyer.status === "ready" && !!flyer.bg;
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
      void recordGeneratedCard();
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
      if (!canShareFiles || !navigator.canShare({ files: [file] })) {
        const url = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = url; a.download = fileName; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        void recordGeneratedCard();
        const note = "This browser cannot share images directly, so your card was downloaded. In WhatsApp, open a chat, tap the attach (paperclip or plus) icon and choose the downloaded PNG.";
        setStatus(note); toast.info("Card downloaded — attach it in WhatsApp");
        return;
      }
      await navigator.share({ files: [file], title: campaign.title, text });
      void recordGeneratedCard();
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

  const onNewsletterSubscribe = async () => {
    const email = newsletterEmail.trim().toLowerCase();
    if (!newsletterConsent) {
      setNewsletterStatus({ kind: "error", message: "Please agree to receive JCTM newsletters before subscribing." });
      return;
    }
    setNewsletterBusy(true);
    setNewsletterStatus(null);
    try {
      const response = await fetch(`${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/crusade-2026/newsletter-subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, consent: true }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Newsletter signup failed. Please try again.");
      setNewsletterStatus({ kind: "success", message: "You’re subscribed to JCTM newsletters. Your email is not shown on the card." });
      setNewsletterEmail("");
      setNewsletterConsent(false);
    } catch (error) {
      setNewsletterStatus({ kind: "error", message: error instanceof Error ? error.message : "Newsletter signup failed. Please try again." });
    } finally {
      setNewsletterBusy(false);
    }
  };

  const field = "w-full rounded-xl bg-[#060d26]/60 border border-white/15 px-4 py-3 text-white placeholder:text-white/35 focus:border-[#ffc93c] focus:outline-none transition-colors";
  const { w, h } = INVITE_SIZE[format];

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-8 lg:gap-12 items-start">
      <form className="space-y-5" onSubmit={e => { e.preventDefault(); void onDownload(); }} aria-describedby="invite-help">
        <p id="invite-help" className="text-white/70 text-sm leading-relaxed">No sign-in or registration. Your card is drawn right here in your browser.</p>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[#ffc93c]/25 bg-white/[0.04] px-4 py-3"
          aria-live="polite" data-testid="invite-generation-count">
          <div>
            <span className="text-sm text-white/75">Cards generated</span>
            <p className="mt-0.5 text-xs text-white/45">PNG downloads and image shares</p>
          </div>
          <strong className="text-lg font-bold text-[#ffc93c]" data-testid="text-generated-card-count">
            {generatedCount === null ? (countError ? "Unavailable" : "Loading…") : generatedCount.toLocaleString("en-NG")}
          </strong>
          {countError && <button type="button" onClick={() => void loadGeneratedCount()}
            className="text-xs font-semibold text-white underline underline-offset-2" data-testid="button-retry-generated-count">Retry</button>}
        </div>
        {countNotice && <p role="status" className="text-xs text-[#ffc93c]" data-testid="status-generated-count">{countNotice}</p>}

        <section aria-labelledby="photo-heading" className="rounded-2xl border border-white/12 bg-white/[0.04] p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 id="photo-heading" className="!text-white text-sm font-bold flex items-center gap-2"><Camera className="h-4 w-4 text-[#ffc93c]" /> Your photo</h3>
            {photo && <span className="text-[11px] font-bold uppercase tracking-widest text-[#ffc93c]" data-testid="status-photo-added">Added</span>}
          </div>
          <p className="text-xs text-white/65 flex gap-2 leading-relaxed" data-testid="text-photo-privacy">
            <ShieldCheck className="h-4 w-4 text-[#ffc93c] shrink-0 mt-0.5" />
            Your photo is processed in this page’s memory, not uploaded to or retained by JCTM. Clear it or leave the page to remove it. Downloading or sharing creates a copy you control.
          </p>
          <input ref={fileRef} id="invite-photo" type="file" accept={PHOTO_ACCEPT} className="sr-only" aria-describedby="photo-rules"
            onChange={e => void onPickFile(e.target.files?.[0])} data-testid="input-invite-photo" />
          {editing ? (
            <PhotoCropper key={editing.url} src={editing.url} imageWidth={editing.width} imageHeight={editing.height}
              initialCrop={editing.url === photo?.url ? photo.crop : undefined} onApply={applyCrop} onCancel={cancelCrop} />
          ) : (
            <div className="flex items-center gap-4">
              <div className="relative h-20 w-20 shrink-0 rounded-xl ring-[3px] ring-[#38bdf8] shadow-[0_0_24px_rgba(56,189,248,0.45)] bg-[#0a1640] overflow-hidden flex items-center justify-center">
                {photo ? <svg role="img" aria-label="Your cropped photo" className="h-full w-full"
                  viewBox={`${photo.crop.x} ${photo.crop.y} ${photo.crop.width} ${photo.crop.height}`}>
                  <image href={photo.url} x="0" y="0" width={photo.width} height={photo.height} />
                </svg> : <Camera className="h-6 w-6 text-[#ffc93c]/60" />}
              </div>
              <div className="flex flex-wrap gap-2">
                <label htmlFor="invite-photo" role="button" tabIndex={0} aria-disabled={photoBusy}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileRef.current?.click(); } }}
                  className="h-10 px-4 rounded-full bg-[#ffc93c] text-[#071130] text-sm font-black inline-flex items-center gap-2 cursor-pointer hover:-translate-y-0.5 transition-transform" data-testid="button-choose-photo">
                  <Camera className="h-4 w-4" /> {photoBusy ? "Checking…" : photo ? "Replace photo" : "Add your photo"}
                </label>
                {photo && (
                  <>
                    <button type="button" onClick={() => setEditing(photo)} className="h-10 px-4 rounded-full border border-white/25 text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-white/10" data-testid="button-recrop-photo">
                      <Crop className="h-4 w-4" /> Adjust
                    </button>
                    <button type="button" onClick={removePhoto} className="h-10 px-4 rounded-full border border-white/25 text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-white/10" data-testid="button-clear-photo">
                      <Trash2 className="h-4 w-4" /> Clear photo
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
          <p id="photo-rules" className="text-[11px] text-white/45">JPG, PNG or WEBP, up to 10 MB. Optional — without a photo, the card shows a framed placeholder.</p>
          {photoError && <p role="alert" className="text-sm text-[#ff8a5c]" data-testid="error-photo">{photoError}</p>}
        </section>
        <div>
          <div className="flex justify-between mb-1.5">
            <label htmlFor="invite-name" className="text-sm font-semibold text-white">Full name <span className="text-white/45 font-normal">(shown on the card)</span></label>
            <span className="text-xs text-white/45 tabular-nums">{name.length}/{NAME_MAX}</span>
          </div>
          <input id="invite-name" data-testid="input-invite-name" className={field} value={name} maxLength={NAME_MAX}
            onChange={e => setName(e.target.value.slice(0, NAME_MAX))} placeholder="Your full name as it should appear" autoComplete="name" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white mb-1.5" id="invite-event-label">Event</p>
          <div aria-labelledby="invite-event-label" className="rounded-xl border border-[#ffc93c]/30 bg-[#060d26]/60 px-4 py-3" data-testid="text-invite-event">
            <p className="text-white font-bold">{campaign.title}</p>
            <p className="text-xs text-white/55 mt-0.5">An invitation to the full crusade.</p>
          </div>
        </div>
        <section aria-label="Optional newsletter signup" className="rounded-2xl border border-white/12 bg-white/[0.04] p-4 space-y-3">
          <label htmlFor="invite-newsletter-email" className="block text-sm font-semibold text-white">Email address <span className="text-white/45 font-normal">(optional)</span></label>
          <input id="invite-newsletter-email" data-testid="input-invite-newsletter-email" type="email" maxLength={254}
            autoComplete="email" className={field} value={newsletterEmail}
            onKeyDown={event => { if (event.key === "Enter") event.preventDefault(); }}
            onChange={event => {
              setNewsletterEmail(event.target.value);
              setNewsletterConsent(false);
              setNewsletterStatus(null);
            }}
            placeholder="you@example.com" />
          {newsletterEmail.trim().length > 0 && (
            <div className="space-y-3">
              <label htmlFor="invite-newsletter-consent" className="flex items-start gap-2.5 text-xs leading-relaxed text-white/75">
                <input id="invite-newsletter-consent" data-testid="checkbox-invite-newsletter-consent" type="checkbox"
                  checked={newsletterConsent} onChange={event => setNewsletterConsent(event.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#ffc93c]" />
                <span>I agree to receive JCTM newsletters by email. I can unsubscribe at any time.</span>
              </label>
              <button type="button" onClick={() => void onNewsletterSubscribe()}
                disabled={newsletterBusy || !newsletterConsent || !newsletterEmail.trim()}
                className="min-h-10 rounded-full border border-[#ffc93c]/60 px-4 text-sm font-semibold text-white hover:bg-[#ffc93c]/10 disabled:cursor-not-allowed disabled:opacity-50"
                data-testid="button-newsletter-subscribe">
                {newsletterBusy ? "Saving…" : "Subscribe to newsletter"}
              </button>
            </div>
          )}
          {newsletterStatus && <p role={newsletterStatus.kind === "error" ? "alert" : "status"}
            className={`text-xs leading-relaxed ${newsletterStatus.kind === "error" ? "text-[#ff8a5c]" : "text-emerald-300"}`}
            data-testid={`status-newsletter-${newsletterStatus.kind}`}>{newsletterStatus.message}</p>}
        </section>
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
          {(
            <button type="button" onClick={onShare} disabled={!ready || busy !== null} data-testid="button-share-invite"
              className="col-span-2 h-11 rounded-full border border-white/25 text-white font-semibold inline-flex items-center justify-center gap-2 hover:bg-white/10 disabled:opacity-50">
              <Share2 className="h-4 w-4" /> {busy === "share" ? "Preparing…" : canShareFiles ? "Share card image" : "Share card image (downloads)"}
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
        <p className="text-xs text-white/55 leading-relaxed">The WhatsApp and Facebook buttons share the invitation text and page link only — they cannot attach your card. To send the card itself, use Share card image on your phone, or download it and attach the PNG in your chat.</p>
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
            role="img" aria-label={`Invitation preview for ${campaign.title}`} data-testid="canvas-invite-preview" />
          {flyer.status === "loading" && <div className="absolute inset-0 animate-pulse bg-gradient-to-b from-[#0c1d52] to-[#2a0b1e]" aria-label="Loading preview" />}
          {flyer.status === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center p-6 text-white" role="alert">
              <ImageOff className="h-8 w-8 text-[#ffc93c]" />
              <p className="text-sm">The official crusade artwork could not be loaded, so the invitation cannot be drawn.</p>
              <button type="button" onClick={() => setReloadKey(k => k + 1)} className="h-10 px-5 rounded-full border border-white/30 inline-flex items-center gap-2 hover:bg-white/10">
                <RefreshCw className="h-4 w-4" /> Retry
              </button>
            </div>
          )}
        </div>
        <p className="text-center text-xs text-white/45 mt-3">Exact preview of the {w} × {h} PNG you will download.</p>
        <p className="text-center text-[11px] text-white/50 mt-1.5 max-w-md mx-auto" data-testid="text-badge-clarifier">
          "Confirmed &amp; Attending" is your own statement of intent. Making this card does not register you, save an RSVP or act as an admission ticket.
        </p>
      </div>
    </div>
  );
}

export default InvitationGenerator;

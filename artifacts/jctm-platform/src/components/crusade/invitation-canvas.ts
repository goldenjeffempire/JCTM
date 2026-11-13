import type { CrusadeCampaign } from "@workspace/content";
import { scheduleSummary, publishedPrograms } from "@/lib/crusade-format";
import { clampCrop, type CropArea } from "./photo-utils";

export type InviteFormat = "square" | "portrait";
export const INVITE_SIZE: Record<InviteFormat, { w: number; h: number }> = {
  square: { w: 1080, h: 1080 },
  portrait: { w: 1080, h: 1350 },
};

function loadSameOrigin(src: string, err: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(err));
    img.src = src;
  });
}
export const loadFlyer = (src: string) => loadSameOrigin(src, "The official flyer could not be loaded.");
/** Official JCTM logo (same-origin asset, keeps the canvas untainted). */
export const JCTM_LOGO_SRC = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/jctm-logo-sm.jpeg`;
/** Flyer-derived mountain/fire-streak texture (no people, no printed text). */
export const INVITE_BACKGROUND_SRC = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/images/end-of-year-crusade-background.webp`;
export const loadBackground = (src = INVITE_BACKGROUND_SRC) => loadFlyer(src);
export const loadLogo = (src = JCTM_LOGO_SRC) => loadSameOrigin(src, "The JCTM logo could not be loaded.");

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n/)) {
    let line = "";
    for (const raw of para.split(/\s+/).filter(Boolean)) {
      let word = raw;
      while (ctx.measureText(word).width > maxW) {
        let i = word.length;
        while (i > 1 && ctx.measureText(word.slice(0, i)).width > maxW) i--;
        if (line) { out.push(line); line = ""; }
        out.push(word.slice(0, i));
        word = word.slice(i);
      }
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) { out.push(line); line = word; } else line = test;
    }
    out.push(line);
  }
  while (out.length && out[out.length - 1] === "") out.pop();
  return out;
}

function fit(ctx: CanvasRenderingContext2D, text: string, font: (s: number) => string, maxW: number, maxH: number, start: number, min: number, lh = 1.3) {
  for (let size = start; size >= min; size -= 1) {
    ctx.font = font(size);
    const lines = wrap(ctx, text, maxW);
    if (lines.length * size * lh <= maxH) return { lines, size };
  }
  ctx.font = font(min);
  return { lines: wrap(ctx, text, maxW), size: min };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const GOLD = "#ffc93c";
const NAVY = "#071130";

export interface InvitePhoto {
  /** Decoded attendee photo (in-memory object URL source). */
  image: HTMLImageElement;
  /** Source-pixel crop chosen by the visitor (clamped before drawing). */
  crop: CropArea;
}

export interface InviteInput {
  format: InviteFormat;
  flyer: HTMLImageElement;
  /** Official flyer-derived background texture; the UI always supplies it. */
  background?: HTMLImageElement | null;
  campaign: CrusadeCampaign;
  name: string;
  /** Optional attendee portrait — when absent a framed placeholder is drawn. */
  photo?: InvitePhoto | null;
  /** Optional official JCTM logo (same-origin). Falls back to a drawn monogram. */
  logo?: HTMLImageElement | null;
}

/** Fit a w×h image inside a box, centred, without cropping. Exported for tests. */
export function containRect(w: number, h: number, bx: number, by: number, bw: number, bh: number) {
  const scale = Math.min(bw / Math.max(1, w), bh / Math.max(1, h));
  const dw = Math.max(1, Math.round(w * scale)), dh = Math.max(1, Math.round(h * scale));
  return { x: Math.round(bx + (bw - dw) / 2), y: Math.round(by + (bh - dh) / 2), w: dw, h: dh };
}

const CYAN = "#38bdf8";
const GREEN = "#22c55e";

/** Split a title into a gold lead and a white tail at the first "Crusade" or 4-digit year word. */
export function splitTitle(title: string): { gold: string; white: string } {
  const words = title.trim().toUpperCase().split(/\s+/).filter(Boolean);
  const i = words.findIndex((w, idx) => idx > 0 && (/^CRUSADE\b/.test(w) || /^\d{4}$/.test(w)));
  if (i <= 0) return { gold: words.join(" "), white: "" };
  return { gold: words.slice(0, i).join(" "), white: words.slice(i).join(" ") };
}

/** Source rect that cover-fits a sw×sh image into a W×H target (centre crop). Exported for tests. */
export function coverSource(sw: number, sh: number, W: number, H: number) {
  const scale = Math.max(W / Math.max(1, sw), H / Math.max(1, sh));
  const w = Math.min(sw, W / scale), h = Math.min(sh, H / scale);
  return { x: (sw - w) / 2, y: (sh - h) / 2, w, h };
}

export function renderInvitation(canvas: HTMLCanvasElement, input: InviteInput) {
  const { w: W, h: H } = INVITE_SIZE[input.format];
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported on this device.");
  ctx.textBaseline = "alphabetic";
  const portrait = input.format === "portrait";
  const PAD = 56, CW = W - PAD * 2;

  const draw = (lines: string[], size: number, lh: number, top: number, font: string, fill: string | CanvasGradient, x = W / 2, align: CanvasTextAlign = "center") => {
    ctx.font = font; ctx.fillStyle = fill; ctx.textAlign = align;
    lines.forEach((l, i) => ctx.fillText(l, x, top + size * lh * i + size * 0.88));
    return top + lines.length * size * lh;
  };
  const sans = (w: number) => (s: number) => `${w} ${s}px ${SANS}`;
  const serif = (w: number) => (s: number) => `${w} ${s}px ${SERIF}`;
  const serifI = (s: number) => `italic 400 ${s}px ${SERIF}`;
  const check = (x: number, y: number, size: number, color: string, width: number) => {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x + size * 0.38, y + size * 0.38); ctx.lineTo(x + size, y - size * 0.45); ctx.stroke();
  };

  // ── Official flyer mountains + fire streaks, under a navy legibility veil ──
  const bgImg = input.background;
  if (bgImg && bgImg.naturalWidth) {
    const c = coverSource(bgImg.naturalWidth, bgImg.naturalHeight, W, H);
    ctx.drawImage(bgImg, c.x, c.y, c.w, c.h, 0, 0, W, H);
  } else {
    ctx.fillStyle = "#0f1a5c"; ctx.fillRect(0, 0, W, H);
  }
  const veil = ctx.createLinearGradient(0, 0, 0, H);
  veil.addColorStop(0, "rgba(6,16,60,0.62)"); veil.addColorStop(0.3, "rgba(8,22,78,0.42)");
  veil.addColorStop(0.62, "rgba(6,16,60,0.58)"); veil.addColorStop(1, "rgba(4,10,40,0.9)");
  ctx.fillStyle = veil; ctx.fillRect(0, 0, W, H);
  const ember = ctx.createRadialGradient(W * 0.9, H * 0.35, 10, W * 0.9, H * 0.35, W * 0.55);
  ember.addColorStop(0, "rgba(255,140,40,0.18)"); ember.addColorStop(1, "rgba(255,140,40,0)");
  ctx.fillStyle = ember; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(255,201,60,0.45)"; ctx.lineWidth = 2;
  roundRect(ctx, 14, 14, W - 28, H - 28, 26); ctx.stroke();

  // ── Header: logo, ministry line, confirmed chip ──
  const LR = 30, lcx = PAD + LR, lcy = 34 + LR;
  ctx.save(); ctx.beginPath(); ctx.arc(lcx, lcy, LR, 0, Math.PI * 2); ctx.closePath();
  ctx.fillStyle = "#ffffff"; ctx.fill(); ctx.clip();
  if (input.logo && input.logo.naturalWidth) {
    const r = containRect(input.logo.naturalWidth, input.logo.naturalHeight, lcx - LR, lcy - LR, LR * 2, LR * 2);
    ctx.drawImage(input.logo, r.x, r.y, r.w, r.h);
  } else {
    ctx.fillStyle = NAVY; ctx.font = `900 17px ${SANS}`; ctx.textAlign = "center"; ctx.fillText("JCTM", lcx, lcy + 6);
  }
  ctx.restore();
  ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(lcx, lcy, LR, 0, Math.PI * 2); ctx.stroke();

  ctx.font = `800 20px ${SANS}`;
  const chipW = ctx.measureText("CONFIRMED").width + 64, chipH = 44, chipX = W - PAD - chipW, chipY = lcy - chipH / 2;
  roundRect(ctx, chipX, chipY, chipW, chipH, chipH / 2);
  ctx.fillStyle = "rgba(34,197,94,0.14)"; ctx.fill(); ctx.strokeStyle = GREEN; ctx.lineWidth = 2; ctx.stroke();
  check(chipX + 18, chipY + chipH / 2, 14, GREEN, 3);
  ctx.fillStyle = GREEN; ctx.textAlign = "left"; ctx.fillText("CONFIRMED", chipX + 42, chipY + chipH / 2 + 7);

  const midW = chipX - (lcx + LR) - 40;
  const org = fit(ctx, "JESUS CHRIST TEMPLE MINISTRY", sans(700), midW, 24, 17, 11, 1.1);
  draw(org.lines.slice(0, 1), org.size, 1.1, lcy - org.size * 0.55, sans(700)(org.size), "rgba(200,208,240,0.7)");

  // ── Event heading: gold lead, white tail (generic, driven by live title) ──
  let y = lcy + LR + 22;
  const t = splitTitle(input.campaign.title);
  const big = portrait ? 78 : 62;
  ctx.save(); ctx.shadowColor = "rgba(255,201,60,0.55)"; ctx.shadowBlur = 22;
  const gf = fit(ctx, t.gold, serif(900), CW - 20, t.white ? (portrait ? 170 : 130) : (portrait ? 220 : 170), big, 22, 1.04);
  y = draw(gf.lines, gf.size, 1.04, y, serif(900)(gf.size), GOLD);
  ctx.restore();
  if (t.white) {
    const wf = fit(ctx, t.white, serif(800), CW - 20, portrait ? 110 : 84, Math.round(big * 0.82), 20, 1.06);
    y = draw(wf.lines, wf.size, 1.06, y + 2, serif(800)(wf.size), "#ffffff");
  }
  const mf = fit(ctx, input.campaign.minister, serifI, CW - 40, portrait ? 62 : 50, portrait ? 28 : 24, 12, 1.2);
  y = draw(mf.lines, mf.size, 1.2, y + 6, serifI(mf.size), "rgba(196,204,240,0.85)") + 14;
  const rule = ctx.createLinearGradient(PAD, 0, W - PAD, 0);
  rule.addColorStop(0, "rgba(255,201,60,0)"); rule.addColorStop(0.5, "rgba(255,201,60,0.55)"); rule.addColorStop(1, "rgba(255,201,60,0)");
  ctx.fillStyle = rule; ctx.fillRect(PAD, y, CW, 1.5);
  y += 20;

  // ── Bottom-up: footer, then details panel (with official flyer accent) ──
  let fy = H - 34;
  draw(["Attendee invitation, self-declared by the visitor. Not a registration, RSVP or admission ticket."], 13, 1, fy - 13, `500 13px ${SANS}`, "rgba(200,208,240,0.5)");
  fy -= 26;
  draw(["jctm.org.ng/events/end-of-year-crusade-2026"], 16, 1, fy - 16, `700 16px ${SANS}`, "rgba(255,201,60,0.85)");
  fy -= 24;

  const thumbW = portrait ? 170 : 150;
  const textX = PAD + 22 + thumbW + 22, textW = W - PAD - 20 - textX;
  const progs = publishedPrograms(input.campaign);
  const n = Math.max(1, progs.length);
  const rows = progs.map(p => {
    const tf = fit(ctx, p.title.toUpperCase(), sans(800), textW, portrait ? 40 : 30, portrait ? 19 : 16, 10, 1.15);
    const sf = fit(ctx, scheduleSummary(p), sans(500), textW, portrait ? 44 : 34, portrait ? 17 : 14, 9, 1.2);
    return { tf, sf, h: tf.lines.length * tf.size * 1.15 + 2 + sf.lines.length * sf.size * 1.2 };
  });
  const rowGap = portrait ? 10 : 6;
  const vf = fit(ctx, input.campaign.venue, sans(500), textW, portrait ? 66 : 44, 16, 9, 1.22);
  const contact = [input.campaign.contactPhone, input.campaign.contactEmail].filter(v => v && v.trim()).join("  ·  ");
  const cf = contact ? fit(ctx, contact, sans(700), textW, 36, 16, 9, 1.2) : { lines: [] as string[], size: 0 };
  const listH = rows.reduce((t, r) => t + r.h, 0) + rowGap * (n - 1);
  const innerH = listH + 12 + vf.lines.length * vf.size * 1.22 + (cf.lines.length ? 6 + cf.lines.length * cf.size * 1.2 : 0);
  const panelH = Math.max(innerH + 32, portrait ? 170 : 140);
  const panelY = fy - panelH;
  roundRect(ctx, PAD, panelY, CW, panelH, 22);
  ctx.fillStyle = "rgba(6,14,52,0.8)"; ctx.fill(); ctx.strokeStyle = "rgba(56,189,248,0.3)"; ctx.lineWidth = 1.5; ctx.stroke();
  const tb = containRect(input.flyer.naturalWidth || 16, input.flyer.naturalHeight || 9, PAD + 20, panelY + 16, thumbW, panelH - 32);
  ctx.save(); roundRect(ctx, tb.x, tb.y, tb.w, tb.h, 8); ctx.clip();
  ctx.drawImage(input.flyer, tb.x, tb.y, tb.w, tb.h); ctx.restore();
  ctx.strokeStyle = "rgba(255,201,60,0.6)"; ctx.lineWidth = 1.5; roundRect(ctx, tb.x, tb.y, tb.w, tb.h, 8); ctx.stroke();
  let py = panelY + (panelH - innerH) / 2;
  rows.forEach((r, i) => {
    ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(textX - 10, py + r.tf.size * 0.55, 3, 0, Math.PI * 2); ctx.fill();
    py = draw(r.tf.lines, r.tf.size, 1.15, py, sans(800)(r.tf.size), GOLD, textX, "left") + 2;
    py = draw(r.sf.lines, r.sf.size, 1.2, py, sans(500)(r.sf.size), "#ffffff", textX, "left") + (i < n - 1 ? rowGap : 0);
  });
  ctx.fillStyle = "rgba(255,255,255,0.15)"; ctx.fillRect(textX, py + 5, textW, 1);
  py = draw(vf.lines, vf.size, 1.22, py + 12, sans(500)(vf.size), "rgba(214,222,250,0.88)", textX, "left");
  if (cf.lines.length) draw(cf.lines, cf.size, 1.2, py + 6, sans(700)(cf.size), CYAN, textX, "left");

  // ── Middle: portrait, name, pill, programme, message ──
  const bottomLimit = panelY - 18;
  const name = input.name.trim() || "Your Name";
  const nf = fit(ctx, name, sans(900), CW, portrait ? 120 : 90, portrait ? 56 : 46, 18, 1.08);
  const nameH = nf.lines.length * nf.size * 1.08;
  const pillH = portrait ? 54 : 46;
  const fixed = 22 + nameH + 14 + pillH + 12 + 22;
  const S = Math.max(150, Math.min(portrait ? 500 : 360, bottomLimit - y - fixed - 10));
  const fx = Math.round((W - S) / 2), fyy = Math.round(y + 6);

  // glowing cyan frame + corner brackets
  ctx.save(); ctx.shadowColor = "rgba(56,189,248,0.95)"; ctx.shadowBlur = 34;
  roundRect(ctx, fx - 10, fyy - 10, S + 20, S + 20, 22); ctx.strokeStyle = CYAN; ctx.lineWidth = 4; ctx.stroke(); ctx.restore();
  roundRect(ctx, fx - 10, fyy - 10, S + 20, S + 20, 22); ctx.fillStyle = "#0b1550"; ctx.fill();
  ctx.strokeStyle = CYAN; ctx.lineWidth = 3;
  const k = 30, o = 22;
  ([[fx - o, fyy - o, 1, 1], [fx + S + o, fyy - o, -1, 1], [fx - o, fyy + S + o, 1, -1], [fx + S + o, fyy + S + o, -1, -1]] as const).forEach(([cx, cy, dx, dy]) => {
    ctx.beginPath(); ctx.moveTo(cx, cy + dy * k); ctx.lineTo(cx, cy); ctx.lineTo(cx + dx * k, cy); ctx.stroke();
  });
  ctx.save(); roundRect(ctx, fx, fyy, S, S, 14); ctx.clip();
  const ph = input.photo;
  if (ph && ph.image.naturalWidth) {
    const c = clampCrop(ph.crop, ph.image.naturalWidth, ph.image.naturalHeight);
    ctx.drawImage(ph.image, c.x, c.y, c.width, c.height, fx, fyy, S, S);
  } else {
    const pg = ctx.createLinearGradient(0, fyy, 0, fyy + S);
    pg.addColorStop(0, "#e9eefb"); pg.addColorStop(1, "#c9d3ee");
    ctx.fillStyle = pg; ctx.fillRect(fx, fyy, S, S);
    ctx.fillStyle = "rgba(15,26,92,0.28)";
    ctx.beginPath(); ctx.arc(fx + S / 2, fyy + S * 0.42, S * 0.17, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(fx + S / 2, fyy + S * 1.02, S * 0.36, Math.PI, Math.PI * 2); ctx.fill();
    ctx.font = `800 ${Math.round(S * 0.06)}px ${SANS}`; ctx.textAlign = "center"; ctx.fillStyle = "rgba(15,26,92,0.6)";
    ctx.fillText("YOUR PHOTO", fx + S / 2, fyy + S * 0.16);
  }
  ctx.restore();

  // gold "attending" seal overlapping lower-right
  const R = Math.round(S * 0.19);
  const scx = Math.min(W - PAD - R, fx + S - R * 0.15), scy = fyy + S - R * 0.2;
  ctx.save(); ctx.shadowColor = "rgba(255,201,60,0.8)"; ctx.shadowBlur = 22;
  ctx.fillStyle = "#0c1452"; ctx.beginPath(); ctx.arc(scx, scy, R, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.strokeStyle = GOLD; ctx.lineWidth = Math.max(4, R * 0.09); ctx.beginPath(); ctx.arc(scx, scy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "rgba(255,201,60,0.7)";
  for (let i = 0; i < 28; i++) { const a2 = (i / 28) * Math.PI * 2; ctx.beginPath(); ctx.arc(scx + Math.cos(a2) * R * 0.8, scy + Math.sin(a2) * R * 0.8, Math.max(1.2, R * 0.025), 0, Math.PI * 2); ctx.fill(); }
  check(scx - R * 0.26, scy - R * 0.12, R * 0.5, GREEN, Math.max(3, R * 0.1));
  ctx.font = `800 ${Math.max(9, Math.round(R * 0.2))}px ${SANS}`; ctx.fillStyle = GOLD; ctx.textAlign = "center";
  ctx.fillText("ATTENDING", scx, scy + R * 0.48);

  // name, pill, programme, message
  let my = fyy + S + 22 + 8;
  my = draw(nf.lines, nf.size, 1.08, my, sans(900)(nf.size), "#ffffff") + 14;
  ctx.font = `800 ${portrait ? 22 : 19}px ${SANS}`;
  const pillW = Math.min(CW, ctx.measureText("CONFIRMED & ATTENDING").width + 110);
  const pillX = (W - pillW) / 2;
  roundRect(ctx, pillX, my, pillW, pillH, pillH / 2);
  ctx.fillStyle = "rgba(34,197,94,0.14)"; ctx.fill(); ctx.strokeStyle = GREEN; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.fillStyle = GREEN; ctx.beginPath(); ctx.arc(pillX + 34, my + pillH / 2, 6, 0, Math.PI * 2); ctx.fill();
  ctx.textAlign = "center"; ctx.fillText("CONFIRMED & ATTENDING", W / 2 + 12, my + pillH / 2 + (portrait ? 8 : 7));
  my += pillH + 14;
  draw(["ATTENDEE INVITATION"], 20, 1.1, my, `800 20px ${SANS}`, GOLD);
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error("Could not create the image."))), "image/png"),
  );
}

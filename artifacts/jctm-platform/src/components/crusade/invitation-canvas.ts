import type { CrusadeCampaign, CrusadeProgram } from "@workspace/content";
import { scheduleSummary } from "@/lib/crusade-format";

export type InviteFormat = "square" | "portrait";
export const INVITE_SIZE: Record<InviteFormat, { w: number; h: number }> = {
  square: { w: 1080, h: 1080 },
  portrait: { w: 1080, h: 1350 },
};

export function loadFlyer(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("The official flyer could not be loaded."));
    img.src = src;
  });
}

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

export interface InviteInput {
  format: InviteFormat;
  flyer: HTMLImageElement;
  campaign: CrusadeCampaign;
  program: CrusadeProgram;
  name: string;
  message: string;
}

export function renderInvitation(canvas: HTMLCanvasElement, input: InviteInput) {
  const { w: W, h: H } = INVITE_SIZE[input.format];
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported on this device.");
  ctx.textBaseline = "alphabetic";

  // Night-sky backdrop echoing the flyer
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#071130");
  bg.addColorStop(0.55, "#0c1d52");
  bg.addColorStop(1, "#2a0b1e");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const ember = ctx.createRadialGradient(W * 0.85, H, 20, W * 0.85, H, W * 0.75);
  ember.addColorStop(0, "rgba(255,122,24,0.38)");
  ember.addColorStop(1, "rgba(255,122,24,0)");
  ctx.fillStyle = ember;
  ctx.fillRect(0, 0, W, H);
  // ember specks (deterministic)
  for (let i = 0; i < 40; i++) {
    const x = (i * 263) % W, y = H * 0.55 + ((i * 131) % (H * 0.45));
    ctx.fillStyle = `rgba(255,${150 + (i % 5) * 18},60,${0.15 + (i % 4) * 0.08})`;
    ctx.beginPath(); ctx.arc(x, y, 1.5 + (i % 3), 0, Math.PI * 2); ctx.fill();
  }

  ctx.strokeStyle = "rgba(255,201,60,0.5)";
  ctx.lineWidth = 2;
  roundRect(ctx, 18, 18, W - 36, H - 36, 26);
  ctx.stroke();

  const PAD = 44, CW = W - PAD * 2;
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffc93c";
  ctx.font = `700 22px ${SANS}`;
  ctx.fillText("A  PERSONAL  INVITATION", W / 2, 58);

  // Official flyer — whole image, aspect-contained in a capped box, never cropped or overlaid
  const cap = input.format === "square" ? 340 : 500;
  const fw = input.flyer.naturalWidth || 1, fhN = input.flyer.naturalHeight || 1;
  const scale = Math.min(CW / fw, cap / fhN);
  const dw = Math.round(fw * scale), dh = Math.round(fhN * scale);
  const dx = Math.round((W - dw) / 2), dy = 80;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
  roundRect(ctx, dx, dy, dw, dh, 14); ctx.fillStyle = "#0a1438"; ctx.fill();
  ctx.restore();
  ctx.save(); roundRect(ctx, dx, dy, dw, dh, 14); ctx.clip();
  ctx.drawImage(input.flyer, dx, dy, dw, dh);
  ctx.restore();
  ctx.strokeStyle = "rgba(255,201,60,0.7)"; ctx.lineWidth = 3;
  roundRect(ctx, dx, dy, dw, dh, 14); ctx.stroke();

  const draw = (lines: string[], size: number, lh: number, top: number, font: string, fill: string | CanvasGradient) => {
    ctx.font = font; ctx.fillStyle = fill;
    lines.forEach((l, i) => ctx.fillText(l, W / 2, top + size * lh * i + size * 0.9));
    return top + lines.length * size * lh;
  };
  const sans = (w: number) => (s: number) => `${w} ${s}px ${SANS}`;
  const serifI = (s: number) => `italic 400 ${s}px ${SERIF}`;

  let y = dy + dh + 26;
  const name = input.name.trim();
  const lead = fit(ctx, name ? `${name} invites you to` : "You are invited to", serifI, CW, 64, 28, 18, 1.15);
  y = draw(lead.lines, lead.size, 1.15, y, serifI(lead.size), "#e7ecfb") + 6;

  const camp = fit(ctx, input.campaign.title.toUpperCase(), sans(900), CW, 84, 40, 22, 1.05);
  const grad = ctx.createLinearGradient(0, y, 0, y + camp.lines.length * camp.size * 1.05);
  grad.addColorStop(0, "#ffe27a"); grad.addColorStop(1, "#ff8a1f");
  y = draw(camp.lines, camp.size, 1.05, y, sans(900)(camp.size), grad) + 4;

  const min = fit(ctx, `with ${input.campaign.minister}`, sans(600), CW, 52, 22, 15, 1.2);
  y = draw(min.lines, min.size, 1.2, y, sans(600)(min.size), "rgba(231,236,251,0.85)") + 12;

  // Programme + schedule pill
  const sched = scheduleSummary(input.program);
  const pt = fit(ctx, input.program.title.toUpperCase(), sans(800), CW - 60, 56, 26, 16, 1.15);
  const sf = fit(ctx, sched, sans(600), CW - 60, 72, 21, 13, 1.25);
  const pillH = pt.lines.length * pt.size * 1.15 + sf.lines.length * sf.size * 1.25 + 28;
  roundRect(ctx, PAD + 20, y, CW - 40, pillH, 20);
  ctx.fillStyle = "#b3122e"; ctx.fill(); ctx.strokeStyle = "#ffc93c"; ctx.lineWidth = 2; ctx.stroke();
  let py = draw(pt.lines, pt.size, 1.15, y + 12, sans(800)(pt.size), "#ffe27a") + 4;
  py = draw(sf.lines, sf.size, 1.25, py, sans(600)(sf.size), "#ffffff");
  y += pillH + 16;

  // Footer from the bottom up
  const bottom = H - 46;
  ctx.font = `700 20px ${SANS}`; ctx.fillStyle = "#ffc93c";
  ctx.fillText("jctm.org.ng/events/end-of-year-crusade-2026", W / 2, bottom);
  const vf = fit(ctx, input.campaign.venue, sans(500), CW - 40, 50, 18, 13, 1.25);
  const vTop = bottom - 30 - vf.lines.length * vf.size * 1.25;
  draw(vf.lines, vf.size, 1.25, vTop, sans(500)(vf.size), "rgba(220,228,250,0.85)");

  // Message: all characters kept; shrinks to fit the remaining room
  const msg = input.message.trim();
  const room = vTop - 12 - y;
  if (msg && room > 10) {
    const mf = fit(ctx, `“${msg}”`, serifI, CW - 40, room, 28, 10, 1.28);
    const blockH = mf.lines.length * mf.size * 1.28;
    draw(mf.lines, mf.size, 1.28, y + Math.max(0, (room - blockH) / 2), serifI(mf.size), "#f4f6ff");
  }
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error("Could not create the image."))), "image/png"),
  );
}

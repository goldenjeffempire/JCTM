import { CRUSADE_TIMEZONE, type CrusadeCampaign, type CrusadeProgram } from "@workspace/content";

export const CRUSADE_PATH = "/events/end-of-year-crusade-2026";
export const CRUSADE_CANONICAL = "https://jctm.org.ng/events/end-of-year-crusade-2026";
/** Compare values, not JSONB/TanStack object property insertion order. */
export function campaignSignature(c: CrusadeCampaign) {
  return JSON.stringify([
    c.title, c.minister, c.venue, c.flyerUrl, c.contactPhone, c.contactEmail, c.published, c.revision,
    c.programs.map(p => [p.id, p.title, p.description, p.published, p.startsAt]),
  ]);
}
const WAT_OFFSET_MS = 60 * 60 * 1000; // Africa/Lagos is UTC+1 all year (no DST)

/** ISO instant -> "YYYY-MM-DDTHH:mm" wall-clock in WAT, independent of device zone. */
export function isoToWatLocal(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t + WAT_OFFSET_MS).toISOString().slice(0, 16);
}

/** "YYYY-MM-DDTHH:mm" interpreted as WAT wall-clock -> ISO with +01:00 offset. */
export function watLocalToIso(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const iso = `${local}:00+01:00`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

const dayFmt = new Intl.DateTimeFormat("en-NG", { timeZone: CRUSADE_TIMEZONE, weekday: "short", day: "numeric", month: "short", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("en-NG", { timeZone: CRUSADE_TIMEZONE, hour: "numeric", minute: "2-digit", hour12: true });
const partsFmt = new Intl.DateTimeFormat("en-GB", { timeZone: CRUSADE_TIMEZONE, weekday: "short", day: "numeric", month: "short", year: "numeric" });

export const watDay = (iso: string) => dayFmt.format(new Date(iso));
export const watTime = (iso: string) => timeFmt.format(new Date(iso)).toUpperCase().replace(/\s+/g, " ");

export function watParts(iso: string) {
  const p = Object.fromEntries(partsFmt.formatToParts(new Date(iso)).map(x => [x.type, x.value]));
  return { weekday: p.weekday ?? "", day: p.day ?? "", month: p.month ?? "", year: p.year ?? "" };
}

export function sortedStarts(program: CrusadeProgram) {
  return [...program.startsAt].filter(s => !Number.isNaN(Date.parse(s))).sort((a, b) => Date.parse(a) - Date.parse(b));
}

/** Human schedule summary built purely from absolute instants. */
export function scheduleSummary(program: CrusadeProgram): string {
  const starts = sortedStarts(program);
  if (starts.length === 0) return "Schedule to be announced";
  if (starts.length === 1) return `${watDay(starts[0])} · ${watTime(starts[0])} WAT`;
  const contiguous = starts.every((s, i) => i === 0 || Date.parse(s) - Date.parse(starts[i - 1]) === 86_400_000);
  if (contiguous) {
    const first = watParts(starts[0]);
    const last = watParts(starts[starts.length - 1]);
    const sameMonth = first.month === last.month && first.year === last.year;
    const range = sameMonth
      ? `${first.weekday} ${first.day} – ${last.weekday} ${last.day} ${last.month} ${last.year}`
      : `${watDay(starts[0])} – ${watDay(starts[starts.length - 1])}`;
    return `${range} · ${watTime(starts[0])} daily WAT`;
  }
  const shown = starts.slice(0, 20).map(s => `${watDay(s)} ${watTime(s)}`).join("; ");
  return `${shown}${starts.length > 20 ? `; +${starts.length - 20} more` : ""} WAT`;
}

export function publishedPrograms(c: CrusadeCampaign) {
  return c.programs.filter(p => p.published);
}

export function directionsUrl(venue: string) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(venue)}`;
}

export function invitationText(c: CrusadeCampaign, program: CrusadeProgram, name: string, message: string) {
  const lines = [
    `You are invited to the ${program.title} — ${c.title}.`,
    `Ministering: ${c.minister}`,
    `When: ${scheduleSummary(program)}`,
    `Venue: ${c.venue}`,
    ...([c.contactPhone, c.contactEmail].filter(Boolean).length ? [`Enquiries: ${[c.contactPhone, c.contactEmail].filter(Boolean).join(" · ")}`] : []),
  ];
  if (message.trim()) lines.push("", message.trim());
  if (name.trim()) lines.push("", `— ${name.trim()}`);
  lines.push("", `Details: ${CRUSADE_CANONICAL}`);
  return lines.join("\n");
}

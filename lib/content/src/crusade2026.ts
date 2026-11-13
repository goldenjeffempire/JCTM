export interface CrusadeProgram {
  id: string;
  title: string;
  description: string;
  startsAt: string[];
  published: boolean;
}

export interface CrusadeCampaign {
  title: string;
  minister: string;
  venue: string;
  flyerUrl: string;
  published: boolean;
  revision: number;
  programs: CrusadeProgram[];
}

export const CRUSADE_TIMEZONE = "Africa/Lagos";
export const DEFAULT_CRUSADE: CrusadeCampaign = {
  title: "End of Year Crusade 2026",
  minister: "Prophet Amos – Child of God",
  venue: "Church Auditorium, KM 1 East West Road, By Ebrumede Roundabout, Effurun, Uvwie L.G.A., Delta State, Nigeria",
  flyerUrl: "/images/end-of-year-crusade-2026.webp",
  published: true,
  revision: 0,
  programs: [
    { id: "baptism", title: "Baptism Program", description: "December 28–30, 2026 · 8:00 AM daily (WAT)",
      startsAt: ["2026-12-28T08:00:00+01:00", "2026-12-29T08:00:00+01:00", "2026-12-30T08:00:00+01:00"], published: true },
    { id: "last-crusade", title: "Last Crusade of the Year", description: "December 31, 2026 · 8:00 PM (WAT)",
      startsAt: ["2026-12-31T20:00:00+01:00"], published: true },
    { id: "first-all-night", title: "First All Night of the Year", description: "January 1, 2027 · 8:00 PM (WAT)",
      startsAt: ["2027-01-01T20:00:00+01:00"], published: true },
    { id: "holy-spirit", title: "Holy Spirit Impartation", description: "January 3, 2027 · 8:00 AM (WAT)",
      startsAt: ["2027-01-03T08:00:00+01:00"], published: true },
  ],
};

/** Compare absolute instants: visitors' device time zones never change the schedule. */
export function nextCrusadeOccurrence(campaign: CrusadeCampaign, now = Date.now()) {
  if (!campaign.published) return null;
  return campaign.programs.filter(p => p.published)
    .flatMap(program => program.startsAt.map(startsAt => ({ program, startsAt })))
    .filter(item => Date.parse(item.startsAt) > now)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0] ?? null;
}

export function formatCrusadeDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: CRUSADE_TIMEZONE, day: "numeric", month: "short", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  }).format(new Date(value)) + " WAT";
}

import { useState, useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Clock, Globe, MapPin, Radio, ChevronRight, Flame, AlertCircle } from "lucide-react";
import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const SERVICES = [
  { day: "Sunday",    label: "Sunday Service",       timeWAT: { h: 8, m: 0 }, timeWATEnd: { h: 11, m: 0 }, type: "main",    pending: false },
  { day: "Wednesday", label: "Deliverance Service",  timeWAT: { h: 0, m: 0 }, timeWATEnd: { h: 0,  m: 0 }, type: "midweek", pending: true  },
];

const WAT_OFFSET = 1; // UTC+1

interface GeoInfo {
  country: string;
  countryCode: string;
  city: string;
  region: string;
  timezone: string;
  isNigeria: boolean;
  isWarriRegion: boolean;
}

function watToLocal(h: number, m: number): string {
  const nowUtc = new Date();
  const watDate = new Date(Date.UTC(
    nowUtc.getUTCFullYear(),
    nowUtc.getUTCMonth(),
    nowUtc.getUTCDate(),
    h - WAT_OFFSET,
    m,
  ));
  return watDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
}

function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

function getLocalOffset(): string {
  const offset = -(new Date().getTimezoneOffset());
  const absOff = Math.abs(offset);
  const sign = offset >= 0 ? "+" : "-";
  const h = Math.floor(absOff / 60);
  const m = absOff % 60;
  return `UTC${sign}${h}${m ? `:${String(m).padStart(2, "0")}` : ""}`;
}

function isNearbyService(): { isNear: boolean; service: typeof SERVICES[0] | null } {
  const now = new Date();
  const localDow = now.getDay();
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  for (const svc of SERVICES) {
    if (svc.pending) continue;
    const svcDayIdx = days.indexOf(svc.day);
    if (svcDayIdx === localDow) {
      const watDate = new Date(Date.UTC(
        now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
        svc.timeWAT.h - WAT_OFFSET, svc.timeWAT.m,
      ));
      const diff = watDate.getTime() - now.getTime();
      if (diff > 0 && diff < 3 * 60 * 60 * 1000) {
        return { isNear: true, service: svc };
      }
    }
  }
  return { isNear: false, service: null };
}

// Warri City Crusade: April 30 – May 1, 2026
const CRUSADE_START = new Date("2026-04-30T17:00:00+01:00"); // 6PM WAT
const CRUSADE_END   = new Date("2026-05-01T22:00:00+01:00");

function getCrusadeCountdown(): { days: number; hours: number; isLive: boolean; isPast: boolean } {
  const now = new Date();
  if (now >= CRUSADE_START && now <= CRUSADE_END) {
    return { days: 0, hours: 0, isLive: true, isPast: false };
  }
  if (now > CRUSADE_END) {
    return { days: 0, hours: 0, isLive: false, isPast: true };
  }
  const diff = CRUSADE_START.getTime() - now.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  return { days, hours, isLive: false, isPast: false };
}

export function GeoServiceTimes() {
  const [tz, setTz] = useState("");
  const [localOffset, setLocalOffset] = useState("");
  const [nearService, setNearService] = useState<{ isNear: boolean; service: typeof SERVICES[0] | null }>({ isNear: false, service: null });
  const [geo, setGeo] = useState<GeoInfo | null>(null);
  const [crusade, setCrusade] = useState(getCrusadeCountdown());
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  useEffect(() => {
    setTz(getBrowserTimezone());
    setLocalOffset(getLocalOffset());
    setNearService(isNearbyService());
    setCrusade(getCrusadeCountdown());

    const interval = setInterval(() => {
      setNearService(isNearbyService());
      setCrusade(getCrusadeCountdown());
    }, 60000);

    // IP-based geolocation
    fetch(`${BASE}/api/geo`)
      .then(r => r.ok ? r.json() : null)
      .then((data: GeoInfo | null) => {
        if (data && data.country !== "Unknown") {
          setGeo(data);
          // If we got a timezone from the API, prefer it
          if (data.timezone && data.timezone !== "UTC") {
            setTz(data.timezone);
          }
        }
      })
      .catch(() => null);

    return () => clearInterval(interval);
  }, []);

  const typeColors: Record<string, string> = {
    main:    "bg-accent/10 text-accent border-accent/20",
    midweek: "bg-primary/8 text-primary border-primary/15",
    special: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-400/25",
  };

  const locationLabel = geo
    ? `${geo.city !== "Unknown" ? `${geo.city}, ` : ""}${geo.country}`
    : tz || "";

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="glass-panel rounded-3xl p-6 sm:p-8 space-y-5"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-accent/20 to-primary/10 flex items-center justify-center border border-accent/20">
            <Clock className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-primary text-xl leading-tight">Service Times</h3>
            <p className="text-xs text-muted-foreground">Warri, Nigeria (WAT · UTC+1)</p>
          </div>
        </div>
        {locationLabel && (
          <div className="sm:ml-auto flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/10 text-xs text-muted-foreground">
            <Globe className="h-3 w-3 text-accent" />
            <span className="font-medium truncate max-w-[200px]">{locationLabel}</span>
            {localOffset && (
              <>
                <span className="text-primary/40">·</span>
                <span>{localOffset}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Warri Crusade Banner — shown to everyone, emphasised for Nigerian users */}
      {!crusade.isPast && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ delay: 0.15 }}
          className={`rounded-2xl p-4 border ${
            geo?.isNigeria
              ? "bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-red-500/10 border-amber-400/40"
              : "bg-amber-50/60 dark:bg-amber-950/20 border-amber-300/40 dark:border-amber-800/30"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-amber-500/15 shrink-0">
              <Flame className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-amber-700 dark:text-amber-400">
                  🔥 Warri City Crusade 2026
                </span>
                {geo?.isNigeria && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-400/30">
                    {geo.isWarriRegion ? "In Your State!" : "In Nigeria!"}
                  </span>
                )}
              </div>
              <p className="text-xs text-amber-600/80 dark:text-amber-500/80 mt-0.5">
                April 30 – May 1, 2026 · Ighogbadu Primary School, Okumagba Ave, Warri
              </p>
              {crusade.isLive ? (
                <p className="mt-1.5 text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                  <span className="inline-flex h-2 w-2 rounded-full bg-red-500 animate-ping" />
                  HAPPENING NOW — Tune in on Temple TV
                </p>
              ) : (
                <p className="mt-1.5 text-xs text-amber-700/70 dark:text-amber-400/70">
                  Starts in <strong>{crusade.days}d {crusade.hours}h</strong>
                  {geo?.isNigeria ? " — Don't miss this in your country!" : " — Mark your calendar"}
                </p>
              )}
              <Link href="/crusade">
                <button className="mt-2 text-xs font-bold text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1">
                  Learn More & RSVP <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </Link>
            </div>
          </div>
        </motion.div>
      )}

      {/* Nearby service alert */}
      {nearService.isNear && nearService.service && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200/60 dark:border-red-800/40"
        >
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
          </span>
          <Radio className="h-4 w-4 text-red-500" />
          <span className="text-sm font-semibold text-red-600 dark:text-red-400">
            {nearService.service.label} is starting soon — join in Warri or tune in on Temple TV!
          </span>
        </motion.div>
      )}

      {/* Nigeria-specific alert for non-Warri region users */}
      {geo?.isNigeria && !geo.isWarriRegion && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={inView ? { opacity: 1, x: 0 } : {}}
          transition={{ delay: 0.2 }}
          className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-sky-50 dark:bg-sky-950/20 border border-sky-200/50 dark:border-sky-800/30"
        >
          <AlertCircle className="h-4 w-4 text-sky-500 mt-0.5 shrink-0" />
          <p className="text-xs text-sky-700 dark:text-sky-400">
            <span className="font-semibold">You're in Nigeria 🇳🇬</span> — Join us in Warri or stream live services on Temple TV. All Nigerians are especially welcome to the Warri City Crusade 2026!
          </p>
        </motion.div>
      )}

      {/* Service list */}
      <div className="space-y-3">
        {SERVICES.map((svc, i) => {
          const localStart = !svc.pending ? watToLocal(svc.timeWAT.h, svc.timeWAT.m) : null;
          const watStartStr = !svc.pending
            ? `${String(svc.timeWAT.h).padStart(2, "0")}:${String(svc.timeWAT.m).padStart(2, "0")} WAT (Warri)`
            : "Time to be announced";

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: i * 0.08 + 0.25 }}
              className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-4 rounded-2xl border transition-colors ${
                svc.pending
                  ? "bg-muted/40 border-border/50 opacity-75"
                  : "bg-primary/3 hover:bg-primary/5 border-primary/8"
              }`}
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground min-w-[70px]">{svc.day}</div>
                <div>
                  <p className="font-semibold text-primary text-sm">{svc.label}</p>
                  <p className="text-xs text-muted-foreground">{watStartStr}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {svc.pending ? (
                  <div className="px-3 py-1 rounded-full text-xs font-semibold border bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-300/50 dark:border-amber-700/40">
                    🕓 Pending
                  </div>
                ) : (
                  <>
                    <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${typeColors[svc.type] ?? ""}`}>
                      {svc.type === "main" ? "Main Service" : "Deliverance"}
                    </div>
                    {tz && localStart && (
                      <div className="px-3 py-1 rounded-full text-xs font-bold bg-accent/8 text-accent border border-accent/15">
                        🕐 {localStart} your time
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-primary/8">
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-1">
          <MapPin className="h-3.5 w-3.5 text-accent flex-shrink-0" />
          <span>Ebrumede, Warri, Delta State, Nigeria · All are welcome</span>
        </div>
        <Link href="/events">
          <button className="flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent/80 transition-colors whitespace-nowrap">
            View All Events <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </Link>
      </div>
    </motion.div>
  );
}

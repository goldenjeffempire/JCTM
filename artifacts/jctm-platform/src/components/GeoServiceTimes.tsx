import { useState, useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Clock, Globe, MapPin, Radio, ChevronRight } from "lucide-react";
import { Link } from "wouter";

// JCTM service schedule in West Africa Time (UTC+1)
const SERVICES = [
  { day: "Sunday", label: "Sunday Service", timeWAT: { h: 9, m: 0 }, timeWATEnd: { h: 12, m: 0 }, type: "main" },
  { day: "Sunday", label: "Evening Service", timeWAT: { h: 17, m: 0 }, timeWATEnd: { h: 19, m: 0 }, type: "main" },
  { day: "Wednesday", label: "Mid-Week Teaching", timeWAT: { h: 17, m: 30 }, timeWATEnd: { h: 19, m: 30 }, type: "midweek" },
  { day: "Friday", label: "Night Vigil (Monthly)", timeWAT: { h: 22, m: 0 }, timeWATEnd: { h: 2, m: 0 }, type: "special" },
];

const WAT_OFFSET = 1; // UTC+1

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

function getTimezone(): string {
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
  const localDow = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  for (const svc of SERVICES) {
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

export function GeoServiceTimes() {
  const [tz, setTz] = useState("");
  const [localOffset, setLocalOffset] = useState("");
  const [nearService, setNearService] = useState<{ isNear: boolean; service: typeof SERVICES[0] | null }>({ isNear: false, service: null });
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  useEffect(() => {
    setTz(getTimezone());
    setLocalOffset(getLocalOffset());
    setNearService(isNearbyService());
    const interval = setInterval(() => setNearService(isNearbyService()), 60000);
    return () => clearInterval(interval);
  }, []);

  const typeColors: Record<string, string> = {
    main: "bg-accent/10 text-accent border-accent/20",
    midweek: "bg-primary/8 text-primary border-primary/15",
    special: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-400/25",
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="glass-panel rounded-3xl p-6 sm:p-8"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-accent/20 to-primary/10 flex items-center justify-center border border-accent/20">
            <Clock className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-primary text-xl leading-tight">Service Times</h3>
            <p className="text-xs text-muted-foreground">Warri, Nigeria (WAT · UTC+1)</p>
          </div>
        </div>
        {tz && (
          <div className="sm:ml-auto flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/10 text-xs text-muted-foreground">
            <Globe className="h-3 w-3 text-accent" />
            <span className="font-medium truncate max-w-[160px]">{tz}</span>
            <span className="text-primary/40">·</span>
            <span>{localOffset}</span>
          </div>
        )}
      </div>

      {/* Nearby service alert */}
      {nearService.isNear && nearService.service && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-5 flex items-center gap-3 px-4 py-3 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200/60 dark:border-red-800/40"
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

      {/* Service list */}
      <div className="space-y-3">
        {SERVICES.map((svc, i) => {
          const localStart = watToLocal(svc.timeWAT.h, svc.timeWAT.m);
          const watStartStr = `${String(svc.timeWAT.h).padStart(2, "0")}:${String(svc.timeWAT.m).padStart(2, "0")}`;

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: i * 0.08 + 0.2 }}
              className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-4 rounded-2xl bg-primary/3 hover:bg-primary/5 border border-primary/8 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground min-w-[70px]">{svc.day}</div>
                <div>
                  <p className="font-semibold text-primary text-sm">{svc.label}</p>
                  <p className="text-xs text-muted-foreground">{watStartStr} WAT (Warri)</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${typeColors[svc.type] ?? ""}`}>
                  {svc.type === "main" ? "Main Service" : svc.type === "midweek" ? "Teaching" : "Night Vigil"}
                </div>
                {tz && (
                  <div className="px-3 py-1 rounded-full text-xs font-bold bg-accent/8 text-accent border border-accent/15">
                    🕐 {localStart} local
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex flex-col sm:flex-row gap-3 mt-5 pt-5 border-t border-primary/8">
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

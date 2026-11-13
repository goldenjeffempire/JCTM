import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, MapPin, Calendar, RefreshCw, Navigation } from "lucide-react";
import { useCrusade } from "@/lib/crusade-api";
import { CrusadeCountdown } from "./CrusadeCountdown";
import { CRUSADE_PATH, directionsUrl, publishedPrograms, sortedStarts, watParts, scheduleSummary } from "@/lib/crusade-format";

/** Large homepage / events-page feature. Renders nothing when unavailable (unless fallback given). */
export function CrusadeFeature({ fallback = null }: { fallback?: React.ReactNode }) {
  const { data, isLoading, isError } = useCrusade();

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-10" aria-busy="true" aria-label="Loading crusade">
        <div className="rounded-[2rem] h-[420px] animate-pulse bg-gradient-to-br from-[#0c1d52] to-[#2a0b1e]" />
      </div>
    );
  }
  if (isError || !data || !data.published) return <>{fallback}</>;
  const programs = publishedPrograms(data);

  return (
    <section className="container mx-auto px-4 py-10" aria-labelledby="crusade-feature-title" data-testid="section-crusade-feature">
      <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.6 }}
        className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#071130] via-[#0c1d52] to-[#2a0b1e] text-white shadow-[0_30px_80px_-20px_rgba(42,11,30,0.55)]">
        <div className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-[#ff7a18]/25 blur-3xl" />
        <div className="relative grid lg:grid-cols-[1.15fr_1fr] gap-8 p-5 sm:p-8 lg:p-10">
          <Link href={CRUSADE_PATH} className="block group rounded-2xl overflow-hidden ring-2 ring-[#ffc93c]/50 self-start" data-testid="link-crusade-flyer">
            <img src={data.flyerUrl} alt={`${data.title} official flyer — ${data.minister}`} className="w-full h-auto block group-hover:scale-[1.015] transition-transform duration-700" loading="lazy" decoding="async" />
          </Link>
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-[#ffc93c] text-xs font-bold uppercase tracking-[0.25em]">Prophet Amos · Temple TV</p>
              <h2 id="crusade-feature-title" className="!text-white text-3xl sm:text-4xl font-black tracking-tight mt-2">{data.title}</h2>
              <p className="text-white/70 mt-1">With {data.minister}</p>
            </div>
            <CrusadeCountdown campaign={data} compact />
            {programs.length > 0 && (
              <ul className="grid sm:grid-cols-2 gap-2.5">
                {programs.map(p => {
                  return (
                    <li key={p.id} className="rounded-xl bg-white/[0.06] border border-white/10 px-3.5 py-3" data-testid={`card-crusade-program-${p.id}`}>
                      <p className="font-bold text-sm leading-tight">{p.title}</p>
                      <p className="text-xs text-white/65 mt-1 flex items-center gap-1.5">
                        <Calendar className="h-3 w-3 text-[#ffc93c] shrink-0" />
                        {scheduleSummary(p)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="text-sm text-white/70 flex gap-2"><MapPin className="h-4 w-4 text-[#ffc93c] shrink-0 mt-0.5" />{data.venue}</p>
            <div className="flex flex-wrap gap-3 mt-auto">
              <Link href={CRUSADE_PATH} className="h-11 px-6 rounded-full bg-gradient-to-r from-[#ffc93c] to-[#ff7a18] text-[#2a0b1e] font-black inline-flex items-center gap-2 hover:-translate-y-0.5 transition-transform" data-testid="link-crusade-details">
                GENERATE INVITATION CARD <ArrowRight className="h-4 w-4" />
              </Link>
              <a href={directionsUrl(data.venue)} target="_blank" rel="noopener noreferrer" className="h-11 px-5 rounded-full border border-white/25 inline-flex items-center gap-2 hover:bg-white/10" data-testid="link-crusade-directions">
                <Navigation className="h-4 w-4" /> Directions
              </a>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

/** Compact listing card for the homepage Gatherings section. */
export function CrusadeListing() {
  const { data, isLoading, isError, refetch, isFetching } = useCrusade();
  if (isLoading) return <div className="h-28 rounded-2xl bg-muted animate-pulse" aria-label="Loading events" />;
  if (isError || !data || !data.published || publishedPrograms(data).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 rounded-3xl border border-border/50 bg-white/60 text-center" data-testid="status-no-upcoming">
        <Calendar className="h-7 w-7 text-accent/50 mb-4" />
        <h3 className="text-xl font-serif font-bold text-primary mb-2">No upcoming events right now</h3>
        <p className="text-muted-foreground text-sm max-w-sm mb-6">Check back soon, or explore past gatherings.</p>
        <div className="flex gap-3">
          {isError && <button onClick={() => refetch()} disabled={isFetching} className="cta-ghost"><RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Retry</button>}
          <Link href="/events" className="cta-primary">View events</Link>
        </div>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border/60 rounded-3xl border border-border/60 bg-white/70 overflow-hidden">
      {publishedPrograms(data).map(p => {
        const s = sortedStarts(p);
        const f = s[0] ? watParts(s[0]) : null;
        return (
          <li key={p.id}>
            <Link href={CRUSADE_PATH} className="flex items-center gap-5 px-5 py-4 hover:bg-accent/5 transition-colors group" data-testid={`link-upcoming-${p.id}`}>
              <div className="w-14 text-center shrink-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#b3122e]">{f?.month ?? "TBA"}</p>
                <p className="text-2xl font-serif font-bold text-primary leading-none">{f?.day ?? "—"}</p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-primary">{p.title}</p>
                <p className="text-xs text-muted-foreground">{scheduleSummary(p)}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

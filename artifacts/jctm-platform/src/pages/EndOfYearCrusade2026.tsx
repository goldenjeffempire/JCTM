import { lazy, Suspense } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { MapPin, Navigation, RefreshCw, ArrowLeft, Clock, Phone, Mail } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { useCrusade } from "@/lib/crusade-api";
import { crusadeFlyerImage } from "@/lib/crusade-flyer";
import { CrusadeCountdown, useNow } from "@/components/crusade/CrusadeCountdown";
import { CRUSADE_CANONICAL, CRUSADE_PATH, directionsUrl, publishedPrograms, scheduleSummary, sortedStarts, watParts, watTime } from "@/lib/crusade-format";

const InvitationGenerator = lazy(() => import("@/components/crusade/InvitationGenerator"));

export default function EndOfYearCrusade2026() {
  const { data, isLoading, isError, error, refetch, isFetching } = useCrusade();
  const now = useNow(30_000);

  if (isLoading) {
    return (
      <Layout>
        <div className="bg-[#071130] min-h-[100dvh] px-4 py-16" aria-busy="true">
          <div className="container mx-auto max-w-6xl space-y-6 animate-pulse">
            <div className="h-6 w-48 rounded bg-white/10" />
            <div className="h-14 w-2/3 rounded bg-white/10" />
            <div className="aspect-[16/9] rounded-3xl bg-white/10" />
          </div>
        </div>
      </Layout>
    );
  }

  if (isError || !data) {
    const notFound = /not|unpublish|found/i.test(error instanceof Error ? error.message : "");
    return (
      <Layout>
        <SEO title="End of Year Crusade 2026 — JCTM" description="End of Year Crusade 2026 with Prophet Amos." path={CRUSADE_PATH} noIndex />
        <div className="min-h-[70dvh] flex items-center justify-center px-4 bg-gradient-to-b from-[#071130] to-[#2a0b1e] text-white">
          <div className="max-w-md text-center" role="alert">
            <p className="text-[#ffc93c] text-xs font-bold uppercase tracking-[0.25em]">End of Year Crusade 2026</p>
            <h1 className="!text-white text-3xl font-black mt-3">{notFound ? "Not available right now" : "We couldn't load the crusade"}</h1>
            <p className="text-white/70 mt-3">{notFound ? "Details for this crusade are not currently published. Please check back soon." : "Please check your connection and try again."}</p>
            <div className="flex justify-center gap-3 mt-6">
              <button onClick={() => refetch()} disabled={isFetching} className="h-11 px-5 rounded-full border border-white/30 inline-flex items-center gap-2 hover:bg-white/10" data-testid="button-retry-crusade">
                <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Retry
              </button>
              <Link href="/events" className="h-11 px-5 rounded-full bg-white text-[#071130] font-semibold inline-flex items-center">All events</Link>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  const programs = publishedPrograms(data);
  const absFlyer = data.flyerUrl.startsWith("http") ? data.flyerUrl : `https://jctm.org.ng${data.flyerUrl}`;
  const jsonLd = programs.flatMap(p => sortedStarts(p).map(startDate => ({
    "@context": "https://schema.org", "@type": "Event",
    name: `${p.title} — ${data.title}`, startDate, eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode", image: [absFlyer], url: CRUSADE_CANONICAL,
    location: { "@type": "Place", name: "JCTM Church Auditorium", address: { "@type": "PostalAddress", streetAddress: data.venue, addressLocality: "Effurun", addressRegion: "Delta State", addressCountry: "NG" } },
    performer: { "@type": "Person", name: data.minister },
    organizer: { "@type": "ReligiousOrganization", name: "Jesus Christ Temple Ministry (JCTM)", url: "https://jctm.org.ng" },
    isAccessibleForFree: true,
  })));

  return (
    <Layout>
      <SEO title={`${data.title} — ${data.minister} | JCTM`} description={`${data.title} at ${data.venue}. ${programs.map(p => p.title).join(", ")}. Create a personal invitation and share it.`}
        path={CRUSADE_PATH} image={absFlyer} type="event" jsonLd={jsonLd}
        breadcrumbs={[{ name: "Home", url: "https://jctm.org.ng/" }, { name: "Events", url: "https://jctm.org.ng/events" }, { name: data.title, url: CRUSADE_CANONICAL }]} />

      <div className="bg-[#071130] text-white">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_100%,rgba(255,122,24,0.28),transparent_60%),radial-gradient(ellipse_at_10%_0%,rgba(56,189,248,0.18),transparent_55%)]" />
          <div className="relative container mx-auto max-w-6xl px-4 pt-10 pb-16">
            <Link href="/events" className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white mb-8" data-testid="link-back-events"><ArrowLeft className="h-4 w-4" /> All events</Link>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <p className="text-[#ffc93c] text-xs font-bold uppercase tracking-[0.3em]">Jesus Christ Temple Ministry presents</p>
              <h1 className="!text-white font-black tracking-tight mt-3 text-[clamp(2.5rem,6vw,5rem)] leading-[0.95]">
                {data.title}
              </h1>
              <p className="text-white/75 mt-3 text-lg">With {data.minister}</p>
            </motion.div>
            <div className="grid lg:grid-cols-[1.5fr_1fr] gap-8 mt-10 items-start">
              <motion.figure initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.1 }}
                className="rounded-3xl overflow-hidden ring-2 ring-[#ffc93c]/60 shadow-[0_40px_100px_-30px_rgba(255,122,24,0.5)]">
                <img {...crusadeFlyerImage(data.flyerUrl)} sizes="(min-width: 1024px) 50vw, 100vw"
                  alt={`${data.title} official flyer`} className="w-full h-auto block" loading="eager"
                  decoding="async" fetchPriority="high" data-testid="img-crusade-flyer" />
              </motion.figure>
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.25 }} className="space-y-6">
                <div className="rounded-3xl bg-white/[0.05] border border-white/10 p-6"><CrusadeCountdown campaign={data} /></div>
                <div className="rounded-3xl bg-white/[0.05] border border-white/10 p-6">
                  <p className="text-[#ffc93c] text-xs font-bold uppercase tracking-[0.2em] flex items-center gap-2"><MapPin className="h-4 w-4" /> Venue</p>
                  <p className="mt-2 text-white/85 leading-relaxed" data-testid="text-crusade-venue">{data.venue}</p>
                  {(data.contactPhone || data.contactEmail) && (
                    <div className="mt-3 text-sm text-white/75 space-y-1" data-testid="text-crusade-contact">
                      {data.contactPhone && <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-[#ffc93c]" /><a className="hover:text-white underline-offset-4 hover:underline" href={`tel:${data.contactPhone.replace(/[^+\d]/g, "")}`}>{data.contactPhone}</a></p>}
                      {data.contactEmail && <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-[#ffc93c]" /><a className="hover:text-white underline-offset-4 hover:underline" href={`mailto:${data.contactEmail}`}>{data.contactEmail}</a></p>}
                    </div>
                  )}
                  <a href={directionsUrl(data.venue)} target="_blank" rel="noopener noreferrer" data-testid="link-directions"
                    className="mt-4 h-11 px-5 rounded-full bg-white text-[#071130] font-bold inline-flex items-center gap-2 hover:-translate-y-0.5 transition-transform">
                    <Navigation className="h-4 w-4" /> Get directions
                  </a>
                </div>
                <a href="#invite" className="flex items-center justify-center text-center min-h-12 py-3 px-4 rounded-full bg-gradient-to-r from-[#ffc93c] to-[#ff7a18] text-[#2a0b1e] text-sm font-black" data-testid="link-jump-invite">GENERATE INVITATION CARD</a>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Programme timeline */}
        <section className="container mx-auto max-w-6xl px-4 py-16" aria-labelledby="programme-heading">
          <h2 id="programme-heading" className="!text-white text-3xl sm:text-4xl font-black">The programme</h2>
          <p className="text-white/60 mt-2">All times are West Africa Time (Nigeria, UTC+1).</p>
          {programs.length === 0 ? (
            <p className="mt-8 text-white/70">Programme details will be published soon.</p>
          ) : (
            <ol className="mt-10 relative border-l-2 border-[#ffc93c]/30 ml-3 space-y-8">
              {programs.map((p, i) => {
                const starts = sortedStarts(p);
                const done = starts.length > 0 && starts.every(s => Date.parse(s) <= now);
                const f = starts[0] ? watParts(starts[0]) : null;
                return (
                  <motion.li key={p.id} initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                    className="pl-8 relative" data-testid={`item-program-${p.id}`}>
                    <span className={`absolute -left-[11px] top-2 h-5 w-5 rounded-full border-2 ${done ? "bg-white/20 border-white/30" : "bg-[#b3122e] border-[#ffc93c]"}`} />
                    <div className={`rounded-2xl border p-5 sm:p-6 grid sm:grid-cols-[100px_1fr] gap-4 ${done ? "border-white/10 bg-white/[0.02] opacity-70" : "border-white/15 bg-gradient-to-r from-[#b3122e]/25 to-transparent"}`}>
                      <div className="text-[#ffc93c]">
                        <p className="text-xs font-bold uppercase tracking-widest">{f ? `${f.month} ${f.year}` : "TBA"}</p>
                        <p className="text-4xl font-black text-white leading-none mt-1">{f?.day ?? "—"}{starts.length > 1 ? `–${watParts(starts[starts.length - 1]).day}` : ""}</p>
                      </div>
                      <div>
                        <h3 className="!text-white text-xl font-black">{p.title}</h3>
                        <p className="text-white/75 mt-1 flex items-center gap-2"><Clock className="h-4 w-4 text-[#ffc93c] shrink-0" />{scheduleSummary(p)}</p>
                        {starts.length > 1 && (
                          <ul className="flex flex-wrap gap-2 mt-3">
                            {starts.map(s => <li key={s} className={`text-xs rounded-full px-3 py-1 border ${Date.parse(s) <= now ? "border-white/10 text-white/40 line-through" : "border-[#ffc93c]/40 text-white/85"}`}>{watParts(s).weekday} {watParts(s).day} {watParts(s).month} · {watTime(s)}</li>)}
                          </ul>
                        )}
                        {done && <p className="text-xs text-white/50 mt-2 uppercase tracking-widest">Concluded</p>}
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </ol>
          )}
        </section>

        {/* Invitation generator */}
        <section id="invite" className="bg-gradient-to-b from-[#0c1d52] to-[#2a0b1e] py-16" aria-labelledby="invite-heading">
          <div className="container mx-auto max-w-6xl px-4">
            <p className="text-[#ffc93c] text-xs font-bold uppercase tracking-[0.3em]">Bring someone</p>
            <h2 id="invite-heading" className="!text-white text-3xl sm:text-4xl font-black mt-2 mb-8">Make your attendee card</h2>
            <Suspense fallback={<div className="h-[520px] rounded-3xl bg-white/5 animate-pulse" aria-label="Loading invitation generator" />}>
              <InvitationGenerator campaign={data} />
            </Suspense>
          </div>
        </section>
      </div>
    </Layout>
  );
}

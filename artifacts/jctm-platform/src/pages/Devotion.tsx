import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/layout/Layout";
import { AdSlot, ADSENSE_SLOTS, useAdPageTracker } from "@/components/ads/AdSense";
import { SEO } from "@/components/SEO";
import DevotionEmailSubscribe from "@/components/DevotionEmailSubscribe";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface DailyDevotion {
  date: string;
  title: string;
  scripture: string;
  reference: string;
  reflection: string;
  propheticWord: string;
  prayerFocus: string;
  declaration: string;
}

export default function Devotion() {
  useAdPageTracker("/devotion", 1);
  const [devotion, setDevotion] = useState<DailyDevotion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<DailyDevotion[]>([]);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);

  const today = new Date();
  const dateLabel = format(today, "EEEE, MMMM d, yyyy");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(`${BASE}/api/devotion/daily`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { devotion: DailyDevotion };
      setDevotion(data.devotion);
    } catch {
      setError("Could not load today's devotion. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch(`${BASE}/api/devotion/history?limit=14`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { devotions?: DailyDevotion[] } | null) => {
        if (!data?.devotions) return;
        const todayStr = new Date().toISOString().split("T")[0]!;
        setHistory(data.devotions.filter((d) => d.date !== todayStr).slice(0, 13));
      })
      .catch(() => {});
  }, []);

  return (
    <Layout>
      <SEO
        title="Daily Devotion | JCTM Digital Sanctuary"
        description="JCTM Daily Devotion — fresh scripture, prophetic reflection, prayer focus, and declaration for every day."
        path="/devotion"
      />

      <article className="max-w-2xl mx-auto px-5 sm:px-6 pt-24 sm:pt-28 pb-20 text-foreground">
        <header className="mb-12 sm:mb-14">
          <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.18em] text-accent mb-3">
            {dateLabel}
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl font-bold text-primary leading-tight tracking-tight">
            Daily Devotion
          </h1>
          <p className="mt-3 text-sm sm:text-[15px] text-primary/60">
            Jesus Christ Temple Ministry · Warri, Nigeria
          </p>
          <div className="mt-6 h-px w-16 bg-accent/60" aria-hidden />
        </header>

        {error && (
          <div className="mb-10 rounded-lg border border-red-200 bg-red-50/60 px-4 py-3">
            <p className="text-[15px] text-red-800 font-medium">{error}</p>
            <button
              onClick={load}
              className="mt-2 text-sm font-semibold text-primary underline underline-offset-2 hover:text-accent transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {isLoading && !error && (
          <div className="space-y-12 sm:space-y-14 animate-pulse" aria-label="Loading devotion…">
            <div className="space-y-3">
              <div className="h-8 w-3/4 rounded-lg bg-primary/8" />
              <div className="h-8 w-1/2 rounded-lg bg-primary/5" />
            </div>
            <div className="pl-6 border-l-2 border-accent/20 space-y-3">
              <div className="h-6 w-full rounded bg-primary/6" />
              <div className="h-6 w-5/6 rounded bg-primary/6" />
              <div className="h-6 w-4/6 rounded bg-primary/5" />
              <div className="h-3 w-24 rounded mt-2 bg-accent/15" />
            </div>
            <div className="space-y-3">
              <div className="h-3 w-20 rounded-full bg-accent/15" />
              <div className="h-5 w-full rounded bg-primary/6" />
              <div className="h-5 w-full rounded bg-primary/6" />
              <div className="h-5 w-4/5 rounded bg-primary/5" />
            </div>
            <div className="space-y-3">
              <div className="h-3 w-28 rounded-full bg-accent/15" />
              <div className="h-5 w-full rounded bg-primary/6" />
              <div className="h-5 w-3/4 rounded bg-primary/5" />
            </div>
            <div className="rounded-xl border border-accent/20 bg-accent/[0.04] px-6 py-6 space-y-3">
              <div className="h-3 w-32 rounded-full bg-accent/20" />
              <div className="h-6 w-full rounded bg-primary/6" />
              <div className="h-6 w-2/3 rounded bg-primary/5" />
            </div>
          </div>
        )}

        {devotion && !isLoading && (
          <div className="space-y-12 sm:space-y-14">
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-primary leading-[1.15] tracking-tight text-balance">
              {devotion.title}
            </h2>

            <section>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent mb-4">
                Scripture
              </p>
              <figure className="relative pl-6 sm:pl-7 border-l-2 border-accent/50">
                <span
                  aria-hidden
                  className="absolute -left-2 -top-3 text-accent/25 font-serif text-5xl leading-none select-none"
                >
                  &ldquo;
                </span>
                <blockquote className="font-serif italic text-xl sm:text-2xl leading-[1.55] text-primary/90 text-balance">
                  {devotion.scripture}
                </blockquote>
                <figcaption className="mt-4 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                  {devotion.reference}
                </figcaption>
              </figure>
            </section>

            <section>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent mb-4">
                Reflection
              </p>
              <div className="space-y-5 text-[17px] sm:text-[18px] leading-[1.8] text-primary/85 font-medium devotion-prose">
                {devotion.reflection
                  .split(/\n+/)
                  .filter(Boolean)
                  .map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
              </div>
            </section>

            <section>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent mb-4">
                Prophetic Word
              </p>
              <p className="text-[17px] sm:text-[18px] leading-[1.75] text-primary/90 font-medium">
                {devotion.propheticWord}
              </p>
              <p className="mt-3 text-xs sm:text-sm font-semibold uppercase tracking-[0.16em] text-primary/55">
                — Through Prophet Amos Evomobor · JCTM
              </p>
            </section>

            <section>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent mb-4">
                Prayer Focus
              </p>
              <p className="text-[17px] sm:text-[18px] leading-[1.8] text-primary/85 font-medium">
                {devotion.prayerFocus}
              </p>
            </section>

            <section>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent mb-4">
                Declaration
              </p>
              <div className="rounded-xl border border-accent/25 bg-accent/[0.06] px-6 sm:px-7 py-6 sm:py-7">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent mb-3">
                  Speak this aloud
                </p>
                <blockquote className="font-serif text-xl sm:text-2xl leading-[1.5] font-semibold text-primary text-balance">
                  &ldquo;{devotion.declaration}&rdquo;
                </blockquote>
              </div>
            </section>

            <div className="pt-6 border-t border-border/70 flex flex-wrap gap-x-6 gap-y-3 text-[15px] font-semibold">
              <a
                href="/scripture-study"
                className="text-primary underline underline-offset-4 decoration-accent/50 hover:decoration-accent transition-colors"
              >
                Study this scripture
              </a>
              <a
                href="/prayer"
                className="text-primary underline underline-offset-4 decoration-accent/50 hover:decoration-accent transition-colors"
              >
                Generate a prayer
              </a>
              <button
                onClick={load}
                className="text-primary/60 underline underline-offset-4 decoration-primary/30 hover:text-primary hover:decoration-primary/60 transition-colors"
              >
                Reload
              </button>
            </div>

            <section className="mt-10 pt-8 border-t border-border/70">
              <DevotionEmailSubscribe source="devotion-page" />
            </section>
          </div>
        )}

        {history.length > 0 && (
          <section className="mt-20 pt-10 border-t border-border/70">
            <h2 className="font-serif text-2xl font-bold text-primary mb-6 tracking-tight">
              Past Devotions
            </h2>
            <ul className="space-y-5">
              {history.map((past) => {
                const isOpen = expandedHistory === past.date;
                const pastLabel = format(new Date(past.date + "T00:00:00Z"), "EEEE, MMMM d");
                return (
                  <li key={past.date} className="border-b border-border/60 pb-5">
                    <button
                      onClick={() => setExpandedHistory(isOpen ? null : past.date)}
                      className="w-full text-left group"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                        {pastLabel}
                      </p>
                      <p className="font-serif font-bold text-lg text-primary mt-1.5 group-hover:text-accent transition-colors">
                        {past.title}
                      </p>
                      <p className="text-sm text-primary/55 mt-1 font-medium">{past.reference}</p>
                    </button>
                    {isOpen && (
                      <div className="mt-4 pl-4 border-l-2 border-accent/30 space-y-3 text-[15px] leading-[1.7] text-primary/80">
                        <p className="font-serif italic text-primary/90">&ldquo;{past.scripture}&rdquo;</p>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
                          {past.reference}
                        </p>
                        {past.reflection
                          .split(/\n+/)
                          .filter(Boolean)
                          .map((p, i) => (
                            <p key={i}>{p}</p>
                          ))}
                        <p>
                          <span className="font-bold text-primary">Prophetic Word: </span>
                          {past.propheticWord}
                        </p>
                        <p>
                          <span className="font-bold text-primary">Prayer Focus: </span>
                          {past.prayerFocus}
                        </p>
                        <p className="font-serif italic font-semibold text-primary">
                          Declaration: &ldquo;{past.declaration}&rdquo;
                        </p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <AdSlot
          slot={ADSENSE_SLOTS.devotionPage}
          minHeight={100}
          format="horizontal"
          className="mt-12"
        />
      </article>
    </Layout>
  );
}

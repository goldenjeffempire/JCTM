import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/layout/Layout";
import { AdSlot, ADSENSE_SLOTS } from "@/components/ads/AdSense";
import { SEO } from "@/components/SEO";
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

      <article className="max-w-2xl mx-auto px-4 pt-28 pb-20 text-foreground">
        <header className="mb-10">
          <p className="text-sm text-muted-foreground mb-2">{dateLabel}</p>
          <h1 className="text-3xl md:text-4xl font-bold text-primary">Daily Devotion</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Jesus Christ Temple Ministry · Warri, Nigeria
          </p>
        </header>

        {error && (
          <div className="mb-8 text-sm">
            <p className="text-red-700">{error}</p>
            <button onClick={load} className="mt-2 underline text-primary">
              Try again
            </button>
          </div>
        )}

        {isLoading && !error && (
          <p className="text-muted-foreground text-sm">Loading today's devotion…</p>
        )}

        {devotion && !isLoading && (
          <div className="space-y-8">
            <h2 className="text-2xl md:text-3xl font-bold text-primary leading-snug">
              {devotion.title}
            </h2>

            <section>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Scripture
              </p>
              <p className="leading-relaxed text-[15px]">"{devotion.scripture}"</p>
              <p className="mt-2 text-sm text-muted-foreground">— {devotion.reference}</p>
            </section>

            <section>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Reflection
              </p>
              <div className="space-y-3">
                {devotion.reflection
                  .split(/\n+/)
                  .filter(Boolean)
                  .map((p, i) => (
                    <p key={i} className="leading-relaxed text-[15px]">
                      {p}
                    </p>
                  ))}
              </div>
            </section>

            <section>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Prophetic Word
              </p>
              <p className="leading-relaxed text-[15px]">{devotion.propheticWord}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                — Through Prophet Amos Evomobor, JCTM
              </p>
            </section>

            <section>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Prayer Focus
              </p>
              <p className="leading-relaxed text-[15px]">{devotion.prayerFocus}</p>
            </section>

            <section>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Declaration
              </p>
              <p className="leading-relaxed text-[15px] font-medium">"{devotion.declaration}"</p>
            </section>

            <div className="pt-4 border-t border-border flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <a href="/scripture-study" className="text-primary underline">
                Study this scripture
              </a>
              <a href="/prayer" className="text-primary underline">
                Generate a prayer
              </a>
              <button onClick={load} className="text-muted-foreground underline">
                Reload
              </button>
            </div>
          </div>
        )}

        {history.length > 0 && (
          <section className="mt-16 pt-8 border-t border-border">
            <h2 className="text-lg font-semibold text-primary mb-4">Past Devotions</h2>
            <ul className="space-y-4">
              {history.map((past) => {
                const isOpen = expandedHistory === past.date;
                const pastLabel = format(new Date(past.date + "T00:00:00Z"), "EEEE, MMMM d");
                return (
                  <li key={past.date} className="border-b border-border pb-4">
                    <button
                      onClick={() => setExpandedHistory(isOpen ? null : past.date)}
                      className="w-full text-left"
                    >
                      <p className="text-xs text-muted-foreground">{pastLabel}</p>
                      <p className="font-medium text-primary mt-1">{past.title}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{past.reference}</p>
                    </button>
                    {isOpen && (
                      <div className="mt-3 pl-3 border-l border-border space-y-3 text-sm">
                        <p>"{past.scripture}"</p>
                        <p className="text-muted-foreground">— {past.reference}</p>
                        {past.reflection
                          .split(/\n+/)
                          .filter(Boolean)
                          .map((p, i) => (
                            <p key={i} className="leading-relaxed">
                              {p}
                            </p>
                          ))}
                        <p>
                          <span className="font-semibold">Prophetic Word: </span>
                          {past.propheticWord}
                        </p>
                        <p>
                          <span className="font-semibold">Prayer Focus: </span>
                          {past.prayerFocus}
                        </p>
                        <p className="font-medium">
                          Declaration: "{past.declaration}"
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

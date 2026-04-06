import { useState, useEffect } from "react";
import { useListEvents } from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { motion } from "framer-motion";
import { Calendar, MapPin, Clock, Youtube, Radio } from "lucide-react";
import { format, isPast, differenceInDays, differenceInHours, differenceInMinutes, differenceInSeconds } from "date-fns";
import { Button } from "@/components/ui/button";

function Countdown({ target }: { target: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const end = new Date(target);
  const now = new Date();
  if (isPast(end)) return <span className="text-green-600 font-semibold text-sm">Live Now / In Progress</span>;

  const days = differenceInDays(end, now);
  const hours = differenceInHours(end, now) % 24;
  const mins = differenceInMinutes(end, now) % 60;
  const secs = differenceInSeconds(end, now) % 60;

  return (
    <div className="flex gap-2 items-center">
      {[{ v: days, l: "d" }, { v: hours, l: "h" }, { v: mins, l: "m" }, { v: secs, l: "s" }].map(({ v, l }) => (
        <div key={l} className="flex flex-col items-center">
          <span className="text-xl font-bold text-primary font-mono tabular-nums w-10 text-center">{String(v).padStart(2, "0")}</span>
          <span className="text-xs text-muted-foreground uppercase">{l}</span>
        </div>
      ))}
    </div>
  );
}

const YOUTUBE_LIVE_ID = "UCPFFvkE-KGpR37qJgvYriJg";

export default function Events() {
  const [showLive, setShowLive] = useState(false);
  const { data: events, isLoading } = useListEvents({ limit: 20, offset: 0 });

  useEffect(() => { document.title = "Events | JCTM Digital Sanctuary"; }, []);

  const upcoming = (events ?? []).filter(e => !isPast(new Date(e.date)));
  const past = (events ?? []).filter(e => isPast(new Date(e.date)));

  return (
    <Layout>
      <div className="container mx-auto px-4 py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="mb-12">
          <span className="inline-block text-xs font-semibold text-accent uppercase tracking-widest mb-4 border border-accent/30 rounded-full px-4 py-1.5">Ministry Calendar</span>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary mb-4">Upcoming Events</h1>
          <p className="text-muted-foreground text-lg max-w-xl">Join us in person or online for these anointed gatherings of the Jesus Christ Temple Ministry.</p>
        </motion.div>

        <div className="glass-panel rounded-2xl p-6 mb-10 border border-red-200/50 bg-red-50/30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center shrink-0 shadow-lg shadow-red-200">
                <Radio className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-red-600 uppercase tracking-widest">YouTube Live</span>
                  <span className="inline-block w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                </div>
                <h3 className="font-serif font-bold text-primary">Join Live Service</h3>
                <p className="text-sm text-muted-foreground">Watch and participate in our live broadcasts on YouTube</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => setShowLive(!showLive)} variant="outline" className="border-red-300 text-red-600 hover:bg-red-50 rounded-full gap-2">
                <Youtube className="h-4 w-4" />
                {showLive ? "Hide" : "Watch Live"}
              </Button>
              <a href={`https://www.youtube.com/@JesusChristTempleMinistry`} target="_blank" rel="noopener noreferrer">
                <Button className="bg-red-600 text-white hover:bg-red-700 rounded-full gap-2">
                  <Youtube className="h-4 w-4" /> Subscribe
                </Button>
              </a>
            </div>
          </div>

          {showLive && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-6 overflow-hidden">
              <div className="aspect-video rounded-xl overflow-hidden shadow-xl">
                <iframe
                  src={`https://www.youtube.com/embed?listType=playlist&list=${YOUTUBE_LIVE_ID}&index=0&autoplay=0`}
                  className="w-full h-full"
                  title="JCTM Live Stream"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
            </motion.div>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="glass-panel rounded-2xl p-6 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/2 mb-3" /><div className="h-6 bg-muted rounded mb-4" /><div className="h-3 bg-muted rounded mb-2" /><div className="h-3 bg-muted rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <>
                <h2 className="text-2xl font-serif font-bold text-primary mb-6">Upcoming</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                  {upcoming.map((event, i) => (
                    <motion.div key={event.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: i * 0.08 }}
                      className="glass-panel rounded-2xl overflow-hidden hover:shadow-xl transition-shadow border border-border/50">
                      <div className="bg-gradient-to-br from-primary to-blue-700 p-6 text-white">
                        <p className="text-xs font-semibold uppercase tracking-widest text-blue-200 mb-2">{event.type ?? "Service"}</p>
                        <h3 className="text-xl font-serif font-bold mb-3">{event.title}</h3>
                        <Countdown target={event.date} />
                      </div>
                      <div className="p-6 space-y-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4 text-accent" />
                          {format(new Date(event.date), "EEEE, MMMM d, yyyy")}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4 text-accent" />
                          {format(new Date(event.date), "h:mm a")}
                        </div>
                        {event.location && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-4 w-4 text-accent" />
                            {event.location}
                          </div>
                        )}
                        {event.description && <p className="text-sm text-muted-foreground leading-relaxed mt-3">{event.description}</p>}
                        {event.liveUrl && (
                          <a href={event.liveUrl} target="_blank" rel="noopener noreferrer">
                            <Button className="w-full mt-2 bg-red-600 hover:bg-red-700 text-white rounded-full gap-2"><Youtube className="h-4 w-4" /> Watch Online</Button>
                          </a>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </>
            )}

            {upcoming.length === 0 && (
              <div className="text-center py-16">
                <Calendar className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">No upcoming events scheduled. Check back soon or subscribe on YouTube for live broadcasts.</p>
              </div>
            )}

            {past.length > 0 && (
              <>
                <h2 className="text-2xl font-serif font-bold text-primary mb-6">Past Events</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {past.slice(0, 6).map((event, i) => (
                    <motion.div key={event.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.05 }}
                      className="glass-panel rounded-xl p-5 flex gap-5 border border-border/50 opacity-80 hover:opacity-100 transition-opacity">
                      <div className="shrink-0 text-center bg-muted rounded-lg p-3 h-fit w-14">
                        <p className="text-xs text-muted-foreground uppercase">{format(new Date(event.date), "MMM")}</p>
                        <p className="text-2xl font-bold text-primary font-mono">{format(new Date(event.date), "d")}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">{event.type ?? "Service"}</span>
                        <h4 className="font-semibold text-primary mb-1">{event.title}</h4>
                        {event.location && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{event.location}</p>}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

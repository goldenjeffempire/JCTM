import { useListEvents, getListEventsQueryKey, useGetUpcomingEvents, getGetUpcomingEventsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { motion } from "framer-motion";
import { Calendar, MapPin, Clock } from "lucide-react";
import { format, isPast } from "date-fns";

const EVENT_TYPE_COLORS: Record<string, string> = {
  convention: "bg-accent/10 text-accent border-accent/30",
  service: "bg-primary/10 text-primary border-primary/30",
  vigil: "bg-purple-100 text-purple-700 border-purple-200",
  teaching: "bg-green-100 text-green-700 border-green-200",
};

export default function Events() {
  const { data: events, isLoading } = useListEvents(
    { limit: 20, offset: 0 },
    { query: { queryKey: getListEventsQueryKey() } }
  );

  const { data: upcomingEvents } = useGetUpcomingEvents({
    query: { queryKey: getGetUpcomingEventsQueryKey() }
  });

  return (
    <Layout>
      <div className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary mb-4">
            Events Calendar
          </h1>
          <p className="text-muted-foreground text-lg">
            Upcoming meetings, conventions, and services at JCTM.
          </p>
        </motion.div>

        {upcomingEvents && upcomingEvents.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-semibold text-primary mb-5">Next Up</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {upcomingEvents.map((event, i) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="glass-panel rounded-2xl p-5 border border-accent/20"
                >
                  <div className="text-3xl font-bold text-accent mb-1">
                    {format(new Date(event.startDate), "dd")}
                  </div>
                  <div className="text-sm text-muted-foreground mb-3">
                    {format(new Date(event.startDate), "MMMM yyyy")}
                  </div>
                  <h3 className="font-semibold text-primary text-sm leading-snug mb-2">{event.title}</h3>
                  {event.location && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {event.location}
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="glass-panel rounded-2xl p-6 animate-pulse flex gap-6">
                <div className="w-16 h-16 bg-muted rounded-xl" />
                <div className="flex-1">
                  <div className="h-5 bg-muted rounded w-1/2 mb-2" />
                  <div className="h-3 bg-muted rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {(events ?? []).map((event, i) => {
              const past = isPast(new Date(event.startDate));
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className={`glass-panel rounded-2xl p-6 flex gap-5 items-start hover:shadow-md transition-shadow ${past ? "opacity-60" : ""}`}
                >
                  <div className="flex-shrink-0 w-16 text-center">
                    <div className="text-2xl font-bold text-accent leading-none">
                      {format(new Date(event.startDate), "dd")}
                    </div>
                    <div className="text-xs text-muted-foreground font-medium uppercase">
                      {format(new Date(event.startDate), "MMM")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(event.startDate), "yyyy")}
                    </div>
                  </div>
                  <div className="h-12 w-px bg-border" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-primary text-base">{event.title}</h3>
                      <span className={`text-xs font-medium border rounded-full px-3 py-0.5 ${EVENT_TYPE_COLORS[event.eventType] ?? "bg-muted text-muted-foreground border-border"}`}>
                        {event.eventType.charAt(0).toUpperCase() + event.eventType.slice(1)}
                      </span>
                    </div>
                    {event.description && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{event.description}</p>
                    )}
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(event.startDate), "h:mm a")}
                        {event.endDate && ` – ${format(new Date(event.endDate), "h:mm a")}`}
                      </span>
                      {event.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {event.location}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}

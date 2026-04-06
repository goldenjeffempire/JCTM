import { useGetFeaturedSermon, getGetFeaturedSermonQueryKey, useGetUpcomingEvents, getGetUpcomingEventsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { PlayCircle, Calendar, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

export default function Home() {
  const { data: featuredSermon } = useGetFeaturedSermon({
    query: { queryKey: getGetFeaturedSermonQueryKey() }
  });

  const { data: events } = useGetUpcomingEvents({
    query: { queryKey: getGetUpcomingEventsQueryKey() }
  });

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative w-full overflow-hidden bg-background">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50 via-background to-background" />
        <div className="container mx-auto px-4 pt-24 pb-32 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-5xl md:text-7xl font-serif font-bold text-primary mb-6 leading-tight">
                The Correction <br className="hidden md:block" />
                <span className="text-accent relative inline-block">
                  Mandate
                  <div className="absolute -bottom-2 left-0 right-0 h-1 bg-accent/30 rounded-full" />
                </span>
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
                Welcome to Jesus Christ Temple Ministry. 
                        The Land Of GoodNews.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Link href="/sermons">
                  <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 w-full sm:w-auto text-lg h-14 px-8 rounded-full shadow-lg shadow-accent/20">
                    Watch Latest Sermon
                  </Button>
                </Link>
                <Link href="/about">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg h-14 px-8 rounded-full border-primary/20 hover:bg-primary/5 text-primary">
                    Our History
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Featured Sermon */}
      {featuredSermon && (
        <section className="py-20 bg-secondary/30 border-y border-border">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row gap-12 items-center">
              <div className="w-full md:w-1/2">
                <div className="relative aspect-video rounded-2xl overflow-hidden shadow-2xl glass-panel group cursor-pointer">
                  {featuredSermon.thumbnailUrl ? (
                    <img 
                      src={featuredSermon.thumbnailUrl} 
                      alt={featuredSermon.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                      <PlayCircle className="h-16 w-16 text-primary/40" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="bg-accent text-white p-4 rounded-full">
                      <PlayCircle className="h-8 w-8" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="w-full md:w-1/2">
                <div className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-accent font-medium text-sm mb-6 border border-accent/20">
                  Featured Message
                </div>
                <h2 className="text-3xl md:text-4xl font-serif font-bold text-primary mb-4 leading-tight">
                  {featuredSermon.title}
                </h2>
                <p className="text-muted-foreground mb-8 text-lg line-clamp-3">
                  {featuredSermon.description || "Join us as we explore the depths of primitive Christianity and the correction mandate given to Prophet Amos Evomobor."}
                </p>
                <Link href={`/sermons/${featuredSermon.id}`}>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-6 rounded-xl group">
                    Watch Full Sermon 
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Upcoming Events */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="text-3xl font-serif font-bold text-primary mb-2">Upcoming Events</h2>
              <p className="text-muted-foreground text-lg">Gather with us in fellowship and worship.</p>
            </div>
            <Link href="/events">
              <Button variant="ghost" className="text-accent hover:text-accent hover:bg-accent/10 hidden sm:flex">
                View all <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events && events.length > 0 ? (
              events.slice(0, 3).map((event, i) => (
                <motion.div 
                  key={event.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="glass-panel rounded-2xl p-6 hover:shadow-lg transition-shadow duration-300 border-t-4 border-t-accent"
                >
                  <div className="flex items-start gap-4">
                    <div className="bg-primary/5 p-4 rounded-xl text-center min-w-[80px]">
                      <div className="text-accent font-bold text-sm uppercase">
                        {format(new Date(event.startDate), "MMM")}
                      </div>
                      <div className="text-primary font-serif font-bold text-2xl">
                        {format(new Date(event.startDate), "dd")}
                      </div>
                    </div>
                    <div>
                      <h3 className="font-bold text-primary text-xl mb-2 leading-tight">{event.title}</h3>
                      <div className="flex items-center text-sm text-muted-foreground mb-4">
                        <Calendar className="h-4 w-4 mr-2" />
                        {event.eventType} • {event.location || "Warri Headquarters"}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="col-span-full text-center py-12 glass-panel rounded-2xl">
                <p className="text-muted-foreground">No upcoming events at the moment.</p>
              </div>
            )}
          </div>
          
          <div className="mt-8 text-center sm:hidden">
            <Link href="/events">
              <Button variant="outline" className="w-full text-accent border-accent/20">
                View all events
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Timeline Teaser */}
      <section className="py-24 bg-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[url('https://images.unsplash.com/photo-1548625361-ec853c829f04?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80')] bg-cover bg-center mix-blend-overlay" />
        <div className="container mx-auto px-4 relative z-10 text-center max-w-3xl">
          <h2 className="text-3xl md:text-5xl font-serif font-bold mb-6">A Journey of Correction</h2>
          <p className="text-lg md:text-xl text-primary-foreground/80 mb-10 leading-relaxed">
            Trace the prophetic history and divine mandate that birthed Jesus Christ Temple Ministry. Witness the unfolding of primitive Christianity.
          </p>
          <Link href="/correction-timeline">
            <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 h-14 px-8 rounded-full shadow-lg border-none text-lg">
              Explore the Timeline
            </Button>
          </Link>
        </div>
      </section>
    </Layout>
  );
}

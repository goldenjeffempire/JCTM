import React from "react";
import { motion, Variants } from "framer-motion";
import { format } from "date-fns";
import { Link } from "wouter";
import { 
  PlayCircle, Calendar, ArrowRight, 
  MapPin, ShieldCheck, Flame, Users, 
  Radio, BookOpen 
} from "lucide-react";

import { 
  useGetFeaturedSermon, 
  getGetFeaturedSermonQueryKey, 
  useGetUpcomingEvents, 
  getGetUpcomingEventsQueryKey 
} from "@workspace/api-client-react";

import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * ANIMATION VARIANTS
 */
const fadeInUp: Variants = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
};

const staggerContainer: Variants = {
  animate: { transition: { staggerChildren: 0.1 } }
};

export default function Home() {
  const { data: featuredSermon, isLoading: loadingSermon } = useGetFeaturedSermon({
    query: { queryKey: getGetFeaturedSermonQueryKey() }
  });

  const { data: events, isLoading: loadingEvents } = useGetUpcomingEvents({
    query: { queryKey: getGetUpcomingEventsQueryKey() }
  });

  return (
    <Layout>
      <HeroSection />

      {/* Trust Bar / Stats */}
      <section className="py-8 bg-primary/5 border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-8 md:gap-16 text-primary/70 font-medium">
            <div className="flex items-center gap-2"><MapPin className="h-5 w-5" /> Global Headquarters: Warri</div>
            <div className="flex items-center gap-2"><Flame className="h-5 w-5" /> Primitive Christianity</div>
            <div className="flex items-center gap-2"><Radio className="h-5 w-5" /> Live Broadcasts Weekly</div>
          </div>
        </div>
      </section>

      {/* Featured Content & Mandatory Correction Section */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div variants={fadeInUp} initial="initial" whileInView="animate" viewport={{ once: true }}>
              <Badge className="bg-accent/10 text-accent hover:bg-accent/10 border-accent/20 mb-4 px-4 py-1">
                The Mandate
              </Badge>
              <h2 className="text-4xl md:text-5xl font-serif font-bold text-primary mb-6">
                Restoring the Path of <br />
                <span className="italic text-accent">True Worship</span>
              </h2>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                The Correction Mandate is a divine instruction given to Prophet Amos Evomobor to lead a return to primitive Christianity. We are committed to undiluted truth, spiritual discipline, and the manifestation of God's power.
              </p>
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="flex gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold text-primary">Scriptural Purity</h4>
                    <p className="text-sm text-muted-foreground">Adhering strictly to the apostolic foundation.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold text-primary">Community</h4>
                    <p className="text-sm text-muted-foreground">A family bound by the love of Christ.</p>
                  </div>
                </div>
              </div>
            </motion.div>

            <div className="relative">
              {loadingSermon ? (
                <div className="aspect-video bg-muted animate-pulse rounded-2xl" />
              ) : (
                <FeaturedSermonCard sermon={featuredSermon} />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Upcoming Events Grid */}
      <section className="py-24 bg-secondary/20">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
            <div className="max-w-xl">
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-primary mb-4">Gather With Us</h2>
              <p className="text-muted-foreground text-lg">Experience transformation through our weekly services and special prophetic encounters.</p>
            </div>
            <Link href="/events">
              <Button variant="outline" className="rounded-full px-6 group">
                Browse Calendar <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>

          <motion.div 
            variants={staggerContainer} 
            initial="initial" 
            whileInView="animate" 
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {events?.slice(0, 3).map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </motion.div>
        </div>
      </section>

      {/* Expand: Newcomer Section */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-primary mb-6">New to the Temple?</h2>
            <p className="text-lg text-muted-foreground mb-10">
              Whether you are visiting online or in person at our headquarters, we want to help you take your next step in the Correction Mandate.
            </p>
            <div className="grid sm:grid-cols-3 gap-8">
              <div className="p-6">
                <BookOpen className="h-8 w-8 text-accent mx-auto mb-4" />
                <h4 className="font-bold mb-2">Our Beliefs</h4>
                <Link href="/about" className="text-accent hover:underline text-sm font-medium">Learn More</Link>
              </div>
              <div className="p-6 border-x border-border">
                <MapPin className="h-8 w-8 text-accent mx-auto mb-4" />
                <h4 className="font-bold mb-2">Find a Branch</h4>
                <Link href="/contact" className="text-accent hover:underline text-sm font-medium">Get Directions</Link>
              </div>
              <div className="p-6">
                <Users className="h-8 w-8 text-accent mx-auto mb-4" />
                <h4 className="font-bold mb-2">Join a Unit</h4>
                <Link href="/contact" className="text-accent hover:underline text-sm font-medium">Get Involved</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Timeline Teaser */}
      <TimelineTeaser />
    </Layout>
  );
}

// --- Enhanced Sub-Components ---

function HeroSection() {
  return (
    <section className="relative min-h-[85vh] flex items-center overflow-hidden bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100/40 via-background to-background" />

      {/* Abstract decorative elements */}
      <div className="absolute top-1/4 -right-20 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -left-20 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
          >
            <Badge variant="outline" className="mb-6 border-primary/20 text-primary px-4 py-1.5 rounded-full uppercase tracking-widest text-xs font-bold">
              Jesus Christ Temple Ministry
            </Badge>
            <h1 className="text-6xl md:text-8xl font-serif font-bold text-primary mb-8 leading-[1.1]">
              The Correction <br />
              <span className="text-accent italic">Mandate</span>
            </h1>
            <p className="text-xl md:text-3xl text-muted-foreground/80 mb-12 font-light tracking-tight max-w-3xl mx-auto">
              Equipping the saints, restoring the primitive church, and proclaiming the <span className="text-primary font-medium">Good News.</span>
            </p>
            <div className="flex flex-col sm:flex-row gap-5 justify-center items-center">
              <Link href="/sermons">
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-white w-full sm:w-auto h-16 px-10 rounded-full text-lg shadow-xl shadow-primary/20 transition-all hover:-translate-y-1">
                  Experience the Word
                </Button>
              </Link>
              <Link href="/about">
                <Button size="lg" variant="ghost" className="w-full sm:w-auto h-16 px-10 rounded-full text-lg hover:bg-primary/5">
                  Our Mission
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function FeaturedSermonCard({ sermon }: { sermon: any }) {
  if (!sermon) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      whileInView={{ opacity: 1, x: 0 }}
      className="group relative rounded-3xl overflow-hidden shadow-2xl bg-primary shadow-primary/20"
    >
      <div className="aspect-video relative overflow-hidden">
        <img 
          src={sermon.thumbnailUrl || "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=1200"} 
          alt={sermon.title}
          className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary via-transparent to-transparent" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-20 w-20 bg-accent text-white rounded-full flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform duration-300">
            <PlayCircle className="h-10 w-10 fill-current" />
          </div>
        </div>
      </div>
      <div className="p-8 text-white">
        <span className="text-accent text-sm font-bold uppercase tracking-wider">Latest Broadcast</span>
        <h3 className="text-2xl font-serif font-bold mt-2 mb-4 group-hover:text-accent transition-colors">{sermon.title}</h3>
        <Link href={`/sermons/${sermon.id}`}>
          <Button variant="link" className="text-white p-0 h-auto hover:text-accent">
            Watch Now <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>
    </motion.div>
  );
}

function EventCard({ event }: { event: any }) {
  const date = new Date(event.startDate);

  return (
    <motion.div 
      variants={fadeInUp}
      className="bg-white rounded-3xl p-8 shadow-sm hover:shadow-xl transition-all border border-border group"
    >
      <div className="flex justify-between items-start mb-6">
        <div className="bg-secondary p-4 rounded-2xl text-center min-w-[70px]">
          <span className="block text-accent font-bold text-xs uppercase">{format(date, "MMM")}</span>
          <span className="block text-primary font-serif font-bold text-3xl">{format(date, "dd")}</span>
        </div>
        <Badge variant="secondary" className="rounded-full">{event.eventType}</Badge>
      </div>
      <h3 className="text-xl font-bold text-primary mb-3 leading-tight group-hover:text-accent transition-colors">
        {event.title}
      </h3>
      <div className="space-y-2 mb-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-accent" />
          {format(date, "EEEE, hh:mm a")}
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-accent" />
          {event.location || "Main Sanctuary"}
        </div>
      </div>
      <Button className="w-full rounded-xl bg-primary/5 text-primary hover:bg-primary hover:text-white border-none shadow-none">
        Event Details
      </Button>
    </motion.div>
  );
}

function TimelineTeaser() {
  return (
    <section className="py-24 bg-[#0a0a0a] text-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=2000')] bg-cover bg-center" />
      <div className="container mx-auto px-4 relative z-10 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-serif font-bold mb-8">History in the Making</h2>
          <p className="text-lg text-white/70 mb-12 leading-relaxed">
            From the initial prophetic calling to the establishment of the Land of Good News, explore the milestones of our journey.
          </p>
          <Link href="/correction-timeline">
            <Button size="lg" className="bg-accent hover:bg-accent/90 text-white h-16 px-12 rounded-full text-lg font-bold">
              View Our Timeline
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Link } from "wouter";
import {
  MapPin, Tv, Globe, ChevronRight, Users, Radio,
  Wifi, Church, Plane,
} from "lucide-react";
import { useGeo } from "@/contexts/GeoContext";

export function GeoContentBanner() {
  const { geo, isLoading, isNigeria, isWarriRegion } = useGeo();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  if (isLoading || !geo || geo.country === "Unknown") return null;

  if (isNigeria) {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 30 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.55, ease: "easeOut" }}
        className="rounded-3xl overflow-hidden border border-emerald-400/30 bg-gradient-to-br from-emerald-500/10 via-green-500/5 to-transparent"
      >
        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-2xl bg-emerald-500/15 border border-emerald-400/25 flex items-center justify-center">
              <span className="text-xl">🇳🇬</span>
            </div>
            <div>
              <h3 className="font-serif font-bold text-primary text-lg leading-tight">
                Welcome from {isWarriRegion ? `${geo.city}, Delta State` : geo.country}!
              </h3>
              <p className="text-xs text-muted-foreground">
                {isWarriRegion
                  ? "You're in our home region — you can join us physically!"
                  : "You're in Nigeria — the heartland of this ministry."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {isWarriRegion ? (
              <>
                <GeoCard
                  icon={<Church className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                  colorClass="bg-emerald-500/10 border-emerald-400/20"
                  title="Join Us in Person"
                  body="We meet every Sunday at 8AM WAT in Warri, Delta State. All are welcome."
                  action={{ label: "Get Directions", href: "/about" }}
                />
                <GeoCard
                  icon={<Radio className="h-4 w-4 text-purple-600 dark:text-purple-400" />}
                  colorClass="bg-purple-500/10 border-purple-400/20"
                  title="🙏 Ministers Conference 2026"
                  body="May 8–10 at the Church Auditorium, Effurun. Happening near you!"
                  action={{ label: "Register Now", href: "/conference-registration" }}
                />
              </>
            ) : (
              <>
                <GeoCard
                  icon={<Tv className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                  colorClass="bg-emerald-500/10 border-emerald-400/20"
                  title="Stream Temple TV"
                  body="Watch all services live and on-demand from anywhere in Nigeria."
                  action={{ label: "Watch Sermons", href: "/sermons" }}
                />
                <GeoCard
                  icon={<MapPin className="h-4 w-4 text-sky-600 dark:text-sky-400" />}
                  colorClass="bg-sky-500/10 border-sky-400/20"
                  title="Viewing Centres Near You"
                  body="Find a JCTM viewing centre close to you across Nigeria."
                  action={{ label: "Find Centres", href: "/viewing-centres" }}
                />
              </>
            )}
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400">
            <Wifi className="h-3.5 w-3.5" />
            <span>
              {isWarriRegion
                ? "Low-data streaming available — optimised for Nigerian networks"
                : "Data-saver mode available for lower bandwidth connections"}
            </span>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, ease: "easeOut" }}
      className="rounded-3xl overflow-hidden border border-sky-400/25 bg-gradient-to-br from-sky-500/8 via-indigo-500/5 to-transparent"
    >
      <div className="p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-2xl bg-sky-500/12 border border-sky-400/20 flex items-center justify-center">
            <Globe className="h-5 w-5 text-sky-500" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-primary text-lg leading-tight">
              Greetings from {geo.city !== "Unknown" ? `${geo.city}, ` : ""}{geo.country}!
            </h3>
            <p className="text-xs text-muted-foreground">
              The Correction Mandate is reaching the nations — including yours.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <GeoCard
            icon={<Tv className="h-4 w-4 text-sky-600 dark:text-sky-400" />}
            colorClass="bg-sky-500/10 border-sky-400/20"
            title="Temple TV — Watch Anywhere"
            body="Stream all sermons live and on-demand from your location, any time."
            action={{ label: "Browse Sermons", href: "/sermons" }}
          />
          <GeoCard
            icon={<Plane className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />}
            colorClass="bg-indigo-500/10 border-indigo-400/20"
            title="Join the Global Altar"
            body="Believers across 30+ nations pray together. Add your voice to the altar."
            action={{ label: "Join Prayer", href: "/prayer" }}
          />
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-sky-700 dark:text-sky-400">
          <Users className="h-3.5 w-3.5" />
          <span>
            Diaspora believers in {geo.continent} can give in USD — we support international transfers.
          </span>
          <Link href="/give">
            <span className="font-semibold underline underline-offset-2 cursor-pointer hover:text-sky-600 transition-colors flex items-center gap-0.5">
              Give <ChevronRight className="h-3 w-3" />
            </span>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

interface GeoCardProps {
  icon: React.ReactNode;
  colorClass: string;
  title: string;
  body: string;
  action: { label: string; href: string };
}

function GeoCard({ icon, colorClass, title, body, action }: GeoCardProps) {
  return (
    <div className={`rounded-2xl p-4 border ${colorClass} flex flex-col gap-2`}>
      <div className="flex items-center gap-2">
        <div className={`h-7 w-7 rounded-lg ${colorClass} flex items-center justify-center`}>
          {icon}
        </div>
        <p className="font-semibold text-primary text-sm leading-tight">{title}</p>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
      <Link href={action.href}>
        <button className="flex items-center gap-1 text-xs font-bold text-accent hover:text-accent/80 transition-colors mt-auto pt-1">
          {action.label} <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </Link>
    </div>
  );
}

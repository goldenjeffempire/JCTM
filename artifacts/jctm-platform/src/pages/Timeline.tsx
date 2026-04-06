import { useRef } from "react";
import { Layout } from "@/components/layout/Layout";
import { motion, useScroll, useTransform } from "framer-motion";

const TIMELINE_EVENTS = [
  {
    year: "1990s",
    title: "The Divine Calling",
    description: "Prophet Amos Evomobor receives the divine mandate to restore Primitive Christianity and correct doctrinal error in the Body of Christ. The vision is clear: bring the church back to its apostolic roots.",
    color: "from-blue-600 to-blue-400",
  },
  {
    year: "2000",
    title: "JCTM Founded",
    description: "Jesus Christ Temple Ministry is formally established in Warri, Delta State, Nigeria. The ministry begins with a small gathering of believers hungry for undiluted truth and genuine holiness.",
    color: "from-accent to-sky-400",
  },
  {
    year: "2005",
    title: "The Holiness Revival",
    description: "JCTM experiences a powerful outpouring of the Spirit during the inaugural Correction Convention. Hundreds are delivered, healed, and baptized in the Holy Ghost as the message of holiness spreads.",
    color: "from-purple-600 to-purple-400",
  },
  {
    year: "2010",
    title: "Doctrinal Schools Begin",
    description: "Prophet Evomobor launches intensive doctrinal teaching schools, equipping ministers and believers in Primitive Christianity. The curriculum becomes a reference for sound doctrine across the Niger Delta.",
    color: "from-green-600 to-green-400",
  },
  {
    year: "2015",
    title: "Regional Expansion",
    description: "The Correction Mandate spreads beyond Warri. JCTM conventions draw thousands from across Nigeria and beyond. The ministry's influence in doctrinal correction becomes nationally recognized.",
    color: "from-orange-600 to-orange-400",
  },
  {
    year: "2018",
    title: "Temple TV Launches",
    description: "JCTM launches Temple TV on YouTube, taking the Correction Mandate digital. Sermons, live services, and teachings by Prophet Evomobor reach a global audience for the first time.",
    color: "from-red-600 to-red-400",
  },
  {
    year: "2022",
    title: "Digital Sanctuary Era",
    description: "JCTM embraces the digital age fully — live streaming services, online giving, global webinars. The Correction Mandate now reaches believers in over 20 countries through digital platforms.",
    color: "from-teal-600 to-teal-400",
  },
  {
    year: "2026",
    title: "The Platform Generation",
    description: "Launch of the JCTM Digital Sanctuary — a comprehensive online home for the ministry. AI-powered TempleBots makes the teachings of Prophet Evomobor accessible 24/7 worldwide.",
    color: "from-accent to-primary",
  },
];

export default function Timeline() {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <Layout>
      <div className="py-16 overflow-x-hidden">
        <div className="container mx-auto px-4 mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary mb-4">
              The Correction Timeline
            </h1>
            <p className="text-muted-foreground text-lg">
              The prophetic journey of Jesus Christ Temple Ministry — from divine calling to global digital sanctuary.
            </p>
          </motion.div>
        </div>

        {/* Horizontal scroll timeline */}
        <div
          ref={containerRef}
          className="flex gap-6 px-8 overflow-x-auto pb-8 scrollbar-thin scrollbar-thumb-accent/30 scrollbar-track-transparent"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {TIMELINE_EVENTS.map((event, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              style={{ scrollSnapAlign: "start" }}
              className="flex-shrink-0 w-72 md:w-80"
            >
              {/* Connector line */}
              <div className="flex items-center mb-4">
                <div className={`w-4 h-4 rounded-full bg-gradient-to-br ${event.color} shadow-lg ring-4 ring-white`} />
                {i < TIMELINE_EVENTS.length - 1 && (
                  <div className="flex-1 h-0.5 bg-gradient-to-r from-border to-transparent" />
                )}
              </div>

              <div className="glass-panel rounded-2xl p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-default">
                <div className={`text-3xl font-bold bg-gradient-to-br ${event.color} bg-clip-text text-transparent mb-2`}>
                  {event.year}
                </div>
                <h3 className="font-serif font-bold text-primary text-lg mb-3 leading-tight">
                  {event.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {event.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Vertical timeline for mobile */}
        <div className="container mx-auto px-4 mt-16 md:hidden">
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-accent/50 to-transparent" />
            {TIMELINE_EVENTS.map((event, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className="pl-12 pb-8 relative"
              >
                <div className={`absolute left-2.5 top-1 w-3 h-3 rounded-full bg-gradient-to-br ${event.color} ring-4 ring-white`} />
                <div className={`text-xl font-bold bg-gradient-to-r ${event.color} bg-clip-text text-transparent mb-1`}>{event.year}</div>
                <h3 className="font-semibold text-primary mb-2">{event.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{event.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}

import { useRef } from "react";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { motion, useScroll, useTransform } from "framer-motion";
import { BookOpen, Shield, Target, Globe, Tv, Laptop } from "lucide-react";

const MILESTONES = [
  {
    year: "2013",
    label: "Divine Establishment",
    icon: BookOpen,
    color: "#003366",
    title: "JCTM is Founded",
    body: "Jesus Christ Temple Ministry came into existence on the 3rd of January, 2013 — not by human ambition or personal desire, but by divine establishment through the Lord Jesus Christ Himself. The ministry was birthed under the spiritual guidance and care of Prophet Amos Evomobor, who was entrusted with the responsibility of nurturing, leading, and preserving the vision according to God's divine purpose.",
    scripture: "Isaiah 43:10 — \"You are My witnesses,\" says the Lord, \"and My servant whom I have chosen.\"",
  },
  {
    year: "Foundation",
    label: "Doctrinal Mandate",
    icon: Shield,
    color: "#1d4ed8",
    title: "The Correction Mandate",
    body: "From its very beginning, the foundation of JCTM has been deeply rooted in the eternal principles of holiness and righteousness. The ministry stands as a spiritual platform designed to call men and women back to the original truth of God's Word — emphasizing a life that reflects purity, obedience, and total submission to the will of God. It is not built on worldly systems or human philosophies, but on the unshakable truth that without holiness, no man shall see the Lord.",
    scripture: "Hebrews 12:14 — Pursue peace with all people, and holiness, without which no one will see the Lord.",
  },
  {
    year: "Warri",
    label: "Ebrumede Temple",
    icon: Target,
    color: "#7c3aed",
    title: "Headquarters Established",
    body: "The Ebrumede Temple is established as the physical headquarters of JCTM — located at Km 1 East West Road, Patani Expressway, Ebrumede Roundabout, Effurun, Delta State, Nigeria. It became a house of prayer, doctrine, and reformation, drawing seekers of truth from across the nation and serving as the central base for Prophet Amos Evomobor's ministry operations.",
    scripture: "Isaiah 2:3 — Many peoples will come and say, \"Come, let us go up to the mountain of the Lord, to the temple of the God of Jacob.\"",
  },
  {
    year: "Media",
    label: "Temple TV",
    icon: Tv,
    color: "#0891b2",
    title: "Temple TV is Launched",
    body: "Temple TV is launched, extending the reach of the Correction Mandate to believers across Nigeria and beyond through digital broadcast. His teachings on Temple TV brought doctrinal clarity to thousands of ministers and believers, establishing Prophet Amos Evomobor as a prophetic voice of correction in the Nigerian church landscape. Services are live-streamed every Sunday at 8:00 AM WAT via the YouTube channel @TEMPLETVJCTM.",
    scripture: "Mark 16:15 — Go into all the world and preach the gospel to every creature.",
  },
  {
    year: "Growth",
    label: "Nationwide Network",
    icon: Globe,
    color: "#059669",
    title: "Viewing Centres Across Nigeria",
    body: "The ministry's reach expands through a growing network of viewing centres and coordinators across Nigeria — from Delta and Rivers to Lagos, Abuja, Akwa Ibom, Anambra, Enugu, Adamawa, Benue, Abia, Bayelsa, and beyond. Each state coordinator connects local believers to the central teaching and fellowship of JCTM, ensuring the message reaches every corner of the nation.",
    scripture: "Acts 1:8 — You shall be witnesses to Me in Jerusalem, and in all Judea and Samaria, and to the end of the earth.",
  },
  {
    year: "Digital",
    label: "Digital Sanctuary",
    icon: Laptop,
    color: "#b45309",
    title: "JCTM Digital Sanctuary Launched",
    body: "The JCTM Digital Sanctuary is launched — a global-scale platform for sermons, giving, testimonies, and AI-assisted doctrinal guidance. The platform brings together the entire ministry experience online: live sermon archives, crusade updates, testimony submissions, and the TempleBot AI assistant, all designed to extend the Correction Mandate to the nations of the world.",
    scripture: "Habakkuk 2:2 — Write the vision and make it plain on tablets, that he may run who reads it.",
  },
];

export default function Timeline() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start start", "end end"] });
  const lineHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <Layout>
      <SEO
        title="The Correction Mandate Timeline — JCTM"
        description="Explore the timeline of the Correction Mandate — JCTM's divine assignment to restore apostolic Christianity and doctrinal truth to the global church. Led by Prophet Amos Evomobor."
        path="/correction-timeline"
        keywords="Correction Mandate, JCTM timeline, apostolic restoration, doctrinal correction, Prophet Amos Evomobor timeline"
      />
      <div className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-block text-xs font-semibold text-accent uppercase tracking-widest mb-4 border border-accent/30 rounded-full px-4 py-1.5">
            Ministry History
          </span>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary mb-4">
            Our Journey
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            From a divine establishment in Warri in 2013 to a nationwide network of believers — the story of Jesus Christ Temple Ministry and the Correction Mandate God entrusted to Prophet Amos Evomobor.
          </p>
        </motion.div>

        <div ref={containerRef} className="relative max-w-4xl mx-auto">
          <div className="absolute left-1/2 -translate-x-1/2 top-0 w-0.5 bg-border/50 h-full hidden md:block" />
          <motion.div
            style={{ height: lineHeight }}
            className="absolute left-1/2 -translate-x-1/2 top-0 w-0.5 bg-accent hidden md:block origin-top"
          />

          {MILESTONES.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className={`relative flex flex-col md:flex-row items-center gap-8 mb-16 ${i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"}`}
            >
              <div
                className="hidden md:flex absolute left-1/2 -translate-x-1/2 w-12 h-12 rounded-full items-center justify-center z-10 border-4 border-white shadow-lg text-white"
                style={{ backgroundColor: item.color }}
              >
                <item.icon className="h-5 w-5" />
              </div>

              <div className={`flex-1 ${i % 2 === 0 ? "md:pr-16" : "md:pl-16"}`}>
                <div className="glass-panel rounded-2xl p-7 hover:shadow-xl transition-shadow border border-border/50 relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ backgroundColor: item.color }} />

                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-2xl font-serif font-bold" style={{ color: item.color }}>{item.year}</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{item.label}</p>

                  <h3 className="text-xl font-serif font-bold text-primary mb-3">{item.title}</h3>

                  <div className="space-y-3">
                    <p className="text-muted-foreground text-sm leading-relaxed">{item.body}</p>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground italic leading-relaxed">{item.scripture}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="hidden md:block flex-1" />
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mt-8 glass-panel rounded-2xl p-10 max-w-2xl mx-auto border border-accent/20"
        >
          <h3 className="text-2xl font-serif font-bold text-primary mb-3">The Mandate Continues</h3>
          <p className="text-muted-foreground leading-relaxed">
            Jesus Christ Temple Ministry continues to grow — not merely in numbers, but in spiritual depth and impact. Every message, every gathering, and every outreach effort is directed toward one central goal: to ensure that as many souls as possible are saved and ready for the coming of the Lord.
          </p>
          <p className="text-accent font-semibold mt-4 italic">"Buy the truth and do not sell it." — Proverbs 23:23</p>
        </motion.div>
      </div>
    </Layout>
  );
}

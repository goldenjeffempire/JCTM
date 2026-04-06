import { Layout } from "@/components/layout/Layout";
import { motion } from "framer-motion";
import { BookOpen, Target, Globe, Shield, Eye, Compass } from "lucide-react";

const DOCTRINES = [
  {
    icon: BookOpen,
    title: "Primitive Christianity",
    description: "We preach and practice the original, unadulterated Christianity of the first-century church — apostolic in doctrine, holy in practice, powerful in manifestation.",
  },
  {
    icon: Shield,
    title: "Holiness",
    description: "We uphold the biblical standard of holiness as the foundation of authentic Christianity. 'Without holiness, no man shall see the Lord.' (Hebrews 12:14)",
  },
  {
    icon: Target,
    title: "Doctrinal Correction",
    description: "Our mandate includes identifying and correcting false doctrines that have infiltrated the Body of Christ. We preach correction with love and clarity.",
  },
  {
    icon: Globe,
    title: "The Correction Mandate",
    description: "JCTM operates under a specific divine assignment: to bring doctrinal correction and restoration to the global church in this generation.",
  },
];

const TIMELINE_MILESTONES = [
  { year: "Foundation", label: "Divine Call", text: "Prophet Amos Evomobor receives the Correction Mandate — a direct commission to restore apostolic doctrine to the Nigerian church." },
  { year: "Growth", label: "Ebrumede Temple", text: "The Ebrumede Temple is established as the physical headquarters of JCTM in Warri, Delta State — a house of prayer, doctrine, and reformation." },
  { year: "Media", label: "Temple TV Launch", text: "Temple TV is launched, extending the reach of the Correction Mandate to believers across Nigeria and beyond through digital broadcast." },
  { year: "Digital Era", label: "Digital Sanctuary", text: "The JCTM Digital Sanctuary is launched — a global-scale platform for sermons, giving, testimonies, and AI-assisted doctrinal guidance." },
];

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.1 } },
};

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function About() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto"
        >
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary mb-6">
            About JCTM
          </h1>

          <div className="glass-panel rounded-2xl p-8 mb-10">
            <h2 className="text-2xl font-serif font-bold text-primary mb-4">Our Story</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Jesus Christ Temple Ministry (JCTM) is a Spirit-led church based in Warri, Delta State, Nigeria, founded and led by Prophet Amos Evomobor. The ministry was established under a divine mandate — the "Correction Mandate" — to restore the principles of Primitive Christianity and bring doctrinal correction to the Body of Christ in this generation.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Rooted in the conviction that the contemporary church has drifted from its apostolic foundations, JCTM stands as a voice of correction, calling believers back to holiness, genuine Spirit-baptism, and sound doctrine as practiced in the early church.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Through decades of faithful ministry, prayer, and teaching, JCTM has become a reference ministry for doctrinal clarity and holiness revival in Nigeria and beyond — now reaching a global audience through Temple TV and this Digital Sanctuary.
            </p>
          </div>

          <div className="glass-panel rounded-2xl p-8 mb-10">
            <h2 className="text-2xl font-serif font-bold text-primary mb-6">Prophet Amos Evomobor</h2>
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-shrink-0 w-32 h-32 rounded-2xl bg-primary/10 flex items-center justify-center">
                <span className="text-4xl font-serif font-bold text-primary">AE</span>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-primary mb-1">Prophet Amos Evomobor</h3>
                <p className="text-accent text-sm font-medium mb-3">General Overseer, Jesus Christ Temple Ministry</p>
                <p className="text-muted-foreground leading-relaxed">
                  Prophet Amos Evomobor is a man raised by God specifically for this generation's doctrinal reformation. Operating under the grace of correction, he has consistently delivered uncompromising biblical teaching on Primitive Christianity, the Baptism of the Holy Spirit, Water Baptism, Holiness, and the End Times.
                </p>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  His teachings on Temple TV have brought doctrinal clarity to thousands of ministers and believers, establishing him as a prophetic voice of correction in the Nigerian church landscape. The Ebrumede Temple — his base of operations in Warri — has become a centre of reformation, drawing seekers of truth from across the nation.
                </p>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  The mandate entrusted to Prophet Amos is not merely institutional — it is eschatological. He carries a burden for the global Body of Christ to return to the simplicity, purity, and power of the apostolic church before the return of the Lord.
                </p>
              </div>
            </div>
          </div>

          <div className="mb-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <Eye className="h-4 w-4 text-accent" />
              </div>
              <span className="text-sm font-medium text-accent uppercase tracking-widest">Vision & Mission</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-primary mb-8">
              A Mandate for This Generation
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-panel rounded-2xl p-7 border border-accent/20 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full -translate-y-12 translate-x-12" />
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                  <Eye className="h-5 w-5 text-accent" />
                </div>
                <h3 className="text-xl font-serif font-bold text-primary mb-3">Our Vision</h3>
                <p className="text-muted-foreground leading-relaxed text-sm">
                  To see the global Body of Christ restored to its apostolic foundation — a church that walks in holiness, operates in genuine power, preaches uncompromised truth, and is fully prepared for the return of the Lord Jesus Christ.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-panel rounded-2xl p-7 border border-primary/10 relative overflow-hidden"
              >
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/5 rounded-full translate-y-12 -translate-x-12" />
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Compass className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-xl font-serif font-bold text-primary mb-3">Our Mission</h3>
                <p className="text-muted-foreground leading-relaxed text-sm">
                  To proclaim and demonstrate the Correction Mandate of Prophet Amos Evomobor — correcting false doctrines, restoring primitive Christian practice, raising a generation of believers grounded in holiness and the authentic baptism of the Holy Spirit.
                </p>
              </motion.div>
            </div>

            <motion.div
              variants={staggerContainer}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              className="relative"
            >
              <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-accent/40 via-accent/20 to-transparent hidden md:block" />
              <div className="space-y-6">
                {TIMELINE_MILESTONES.map((milestone, i) => (
                  <motion.div
                    key={i}
                    variants={fadeUp}
                    className="flex gap-6 md:pl-14 relative"
                  >
                    <div className="hidden md:flex absolute left-0 top-1 w-12 h-12 rounded-full bg-accent/10 border border-accent/30 items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-bold text-accent text-center leading-tight px-1">{milestone.year}</span>
                    </div>
                    <div className="glass-panel rounded-xl p-5 flex-1">
                      <p className="text-xs font-medium text-accent mb-1 uppercase tracking-widest">{milestone.label}</p>
                      <p className="text-muted-foreground text-sm leading-relaxed">{milestone.text}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

          <div className="mb-10">
            <h2 className="text-2xl font-serif font-bold text-primary mb-6">Our Core Beliefs</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {DOCTRINES.map((doctrine, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="glass-panel rounded-2xl p-6"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                      <doctrine.icon className="h-5 w-5 text-accent" />
                    </div>
                    <h3 className="font-semibold text-primary">{doctrine.title}</h3>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed">{doctrine.description}</p>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-8">
            <h2 className="text-2xl font-serif font-bold text-primary mb-4">Contact & Location</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-muted-foreground">
              <div>
                <p className="font-semibold text-primary mb-1">Church Address</p>
                <p>Jesus Christ Temple Ministry</p>
                <p>Ebrumede Temple</p>
                <p>Warri, Delta State</p>
                <p>Nigeria</p>
              </div>
              <div>
                <p className="font-semibold text-primary mb-1">Temple TV</p>
                <a
                  href="https://www.youtube.com/@TEMPLETVJCTM"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  youtube.com/@TEMPLETVJCTM
                </a>
                <p className="mt-2 font-semibold text-primary">Sunday Service</p>
                <p>Live-streamed via Temple TV</p>
                <p className="mt-2 font-semibold text-primary">App ID</p>
                <p className="font-mono text-xs">com.onomelabs.jctm</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}

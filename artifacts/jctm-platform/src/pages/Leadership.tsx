import { motion } from "framer-motion";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { ChurchAddressBlock } from "@/components/ChurchAddressBlock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, BookOpen, Globe, Award, Star, Mic2, ChevronRight, CheckCircle2, Youtube, ExternalLink } from "lucide-react";
import { VenueMap } from "@/components/VenueMap";
import { CHURCH_HQ_VENUE } from "@/constants/venues";
import { Link } from "wouter";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 60, damping: 16 } },
};
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const CREDENTIALS = [
  { label: "Founded JCTM", value: "1994" },
  { label: "Nations Reached", value: "40+" },
  { label: "Sermons Preached", value: "479+" },
  { label: "Years of Ministry", value: "30+" },
  { label: "YouTube Channel", value: "Temple TV" },
  { label: "Mandate Pillars", value: "5 Corrections" },
];

const CORRECTIONS = [
  {
    number: "01",
    title: "Prosperity Gospel Error",
    description: "Exposing the false doctrine that financial wealth is always God's will — a manipulation of scripture that preys on faith.",
    scripture: "1 Timothy 6:5-10",
  },
  {
    number: "02",
    title: "Prophetic Manipulation",
    description: "Addressing false prophets who exploit the prophetic gifts for financial gain, control, and personal enrichment.",
    scripture: "Jeremiah 23:16-17",
  },
  {
    number: "03",
    title: "Apostolic Abuse",
    description: "Correcting self-appointed 'apostles' who claim divine authority without evidence of a genuine calling or fruit.",
    scripture: "2 Corinthians 11:13-15",
  },
  {
    number: "04",
    title: "Sacramental Corruption",
    description: "Restoring the original meaning and mode of water baptism and Holy Communion as taught in the New Testament.",
    scripture: "Romans 6:3-4",
  },
  {
    number: "05",
    title: "Dangerous Ecumenism",
    description: "Warning against the blending of Christianity with error under the guise of unity, at the cost of doctrinal truth.",
    scripture: "2 Corinthians 6:14-17",
  },
];

const MINISTRY_VALUES = [
  { icon: BookOpen, title: "Sola Scriptura", desc: "The Bible is the supreme and final authority on all matters of faith and practice." },
  { icon: Shield, title: "Holiness", desc: "Without holiness, no one will see the Lord. Separation from the world is non-negotiable." },
  { icon: Globe, title: "Global Mandate", desc: "The Correction Mandate has a global reach — bringing reformation to the Body of Christ worldwide." },
  { icon: Star, title: "Primitive Christianity", desc: "Return to first-century apostolic Christianity as modeled in the Book of Acts." },
];

export default function Leadership() {
  return (
    <Layout>
      <SEO
        title="Leadership — Prophet Amos Evomobor & JCTM"
        description="Meet the leadership of Jesus Christ Temple Ministry (JCTM). Prophet Amos Evomobor leads JCTM with the Correction Mandate — restoring apostolic Christianity in Nigeria and beyond."
        path="/leadership"
        keywords="Prophet Amos Evomobor, JCTM leadership, Jesus Christ Temple Ministry pastor, apostolic prophet Nigeria, JCTM founder, holiness preacher Nigeria, Correction Mandate prophet"
        breadcrumbs={[
          { name: "Home", url: "https://jctm.org.ng/" },
          { name: "Leadership", url: "https://jctm.org.ng/leadership" },
        ]}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Person",
            "name": "Prophet Amos Evomobor",
            "givenName": "Amos",
            "familyName": "Evomobor",
            "honorificPrefix": "Prophet",
            "jobTitle": "Prophet, Founder and Senior Pastor",
            "description": "Prophet Amos Evomobor is the founder and senior pastor of Jesus Christ Temple Ministry (JCTM), Warri, Nigeria. He carries the divine Correction Mandate — a prophetic assignment to restore apostolic, holiness-based Christianity to the global church. With over 30 years of ministry, his teachings on Temple TV have reached believers in 40+ nations.",
            "image": "https://jctm.org.ng/founder/prophet-portrait.jpg",
            "url": "https://jctm.org.ng/leadership",
            "sameAs": [
              "https://www.youtube.com/@TEMPLETVJCTM",
              "https://jctm.org.ng/leadership"
            ],
            "knowsAbout": [
              "Correction Mandate",
              "Primitive Christianity",
              "Holiness Doctrine",
              "Apostolic Christianity",
              "Prosperity Gospel Refutation",
              "End Times Prophecy",
              "Water Baptism",
              "Doctrinal Correction"
            ],
            "worksFor": {
              "@type": "ReligiousOrganization",
              "name": "Jesus Christ Temple Ministry (JCTM)",
              "url": "https://jctm.org.ng",
              "address": {
                "@type": "PostalAddress",
                "addressLocality": "Warri",
                "addressRegion": "Delta State",
                "addressCountry": "NG"
              }
            },
            "affiliation": {
              "@type": "ReligiousOrganization",
              "name": "Jesus Christ Temple Ministry (JCTM)",
              "url": "https://jctm.org.ng"
            }
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
              {
                "@type": "Question",
                "name": "Who is the founder of Jesus Christ Temple Ministry (JCTM)?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Jesus Christ Temple Ministry (JCTM) was founded by Prophet Amos Evomobor on January 3, 2013, in Ebrumede, Warri, Delta State, Nigeria. He is the senior pastor and carrier of the Correction Mandate — a divine calling to restore primitive, apostolic Christianity worldwide."
                }
              },
              {
                "@type": "Question",
                "name": "What is the Correction Mandate of Prophet Amos Evomobor?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "The Correction Mandate is a divine assignment given to Prophet Amos Evomobor to identify and correct five major doctrinal errors in the church: (1) Prosperity Gospel Error, (2) Prophetic Manipulation, (3) Apostolic Abuse, (4) Sacramental Corruption, and (5) Dangerous Ecumenism. This mandate is grounded in Jeremiah 6:16 and 1 Timothy 6:5-10."
                }
              },
              {
                "@type": "Question",
                "name": "How can I watch Prophet Amos Evomobor sermons?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "You can watch Prophet Amos Evomobor's sermons free on the JCTM Digital Sanctuary at jctm.org.ng/sermons or on Temple TV's official YouTube channel at youtube.com/@TEMPLETVJCTM. Over 479 sermons are available on topics including holiness, the Correction Mandate, end times, and apostolic Christianity."
                }
              }
            ]
          }
        ]}
      />
      <div className="min-h-screen bg-background pt-24 pb-16">

        {/* Hero */}
        <section className="bg-gradient-to-b from-primary via-primary/90 to-background py-24 px-4">
          <div className="max-w-5xl mx-auto text-center text-white">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
              <Badge className="bg-sky-400/20 text-sky-300 border-sky-400/30 mb-4">Leadership & Transparency</Badge>
              <h1 className="text-5xl md:text-6xl font-serif font-bold mb-6">
                Prophet Amos <br />
                <span className="text-sky-300">Evomobor</span>
              </h1>
              <p className="text-white/80 max-w-2xl mx-auto text-lg leading-relaxed mb-8">
                Founder & Senior Pastor of Jesus Christ Temple Ministry (JCTM), Ebrumede, Warri, Delta State, Nigeria — carrier of the God-given Correction Mandate to restore Primitive Christianity to the global Body of Christ.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <a
                  href="https://www.youtube.com/@TEMPLETVJCTM"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button className="bg-red-600 hover:bg-red-700 gap-2">
                    <Youtube className="w-4 h-4" /> Temple TV
                  </Button>
                </a>
                <Link href="/sermons">
                  <Button variant="outline" className="border-white/30 text-white hover:bg-white/10 gap-2">
                    <Mic2 className="w-4 h-4" /> View Sermons
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        <div className="max-w-5xl mx-auto px-4">

          {/* Credentials Grid */}
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid grid-cols-2 md:grid-cols-3 gap-4 my-16"
          >
            {CREDENTIALS.map((c) => (
              <motion.div key={c.label} variants={fadeUp} className="glass-panel border border-border rounded-2xl p-6 text-center">
                <div className="text-3xl font-bold text-primary">{c.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{c.label}</div>
              </motion.div>
            ))}
          </motion.div>

          {/* Bio */}
          <motion.section
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="mb-20"
          >
            <motion.div variants={fadeUp}>
              <Badge variant="outline" className="mb-4">Ministry Biography</Badge>
              <h2 className="text-3xl font-serif font-bold text-primary mb-6">The Man Behind the Mandate</h2>
            </motion.div>
            <div className="grid md:grid-cols-2 gap-8">
              <motion.div variants={fadeUp} className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  Prophet Amos Evomobor received a divine commission from God — a prophetic assignment to stand against the tide of doctrinal compromise sweeping through modern Christianity. This commission, known as the <strong className="text-foreground">Correction Mandate</strong>, has been the driving force of JCTM since its founding in 1994.
                </p>
                <p>
                  Trained in deep biblical scholarship with a particular emphasis on original Greek and Hebrew texts, Prophet Amos teaches with apostolic authority and theological precision. He holds the <strong className="text-foreground">prophetic office</strong> in the five-fold ministry as described in Ephesians 4:11 — a calling confirmed by prophetic accuracy and evident fruit over three decades.
                </p>
                <p>
                  He is known for his bold, uncompromising stance on holiness and doctrinal purity — refusing to water down the gospel for social acceptance or financial gain. His ministry has reached 40+ nations through Temple TV (@TEMPLETVJCTM) on YouTube, broadcasting weekly sermons, live services, and prophetic teachings to a global congregation.
                </p>
              </motion.div>
              <motion.div variants={fadeUp} className="space-y-3">
                {[
                  "Received the Correction Mandate directly from God",
                  "Founded JCTM in Ebrumede, Warri (1994)",
                  "30+ years of consistent, uncompromising ministry",
                  "Teaches from original Greek and Hebrew scriptures",
                  "Holds the prophetic office in the five-fold ministry",
                  "Temple TV reaches 40+ nations via YouTube",
                  "Conducted major open-air crusades across Nigeria",
                  "Authored comprehensive doctrinal teachings on holiness",
                  "Led thousands to true apostolic Christianity",
                ].map((point, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-sky-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-muted-foreground">{point}</span>
                  </div>
                ))}
              </motion.div>
            </div>
          </motion.section>

          {/* Correction Mandate */}
          <motion.section
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="mb-20"
          >
            <motion.div variants={fadeUp} className="mb-8">
              <Badge variant="outline" className="mb-4">The Five Corrections</Badge>
              <h2 className="text-3xl font-serif font-bold text-primary mb-2">The Correction Mandate</h2>
              <p className="text-muted-foreground max-w-2xl">
                A God-given assignment to expose and correct five major doctrinal errors that have corrupted the global Body of Christ — not an attack on individuals, but a prophetic call for reformation.
              </p>
            </motion.div>
            <div className="space-y-4">
              {CORRECTIONS.map((c) => (
                <motion.div
                  key={c.number}
                  variants={fadeUp}
                  className="glass-panel border border-border rounded-2xl p-6 flex gap-5 hover:border-sky-300/30 transition-colors group"
                >
                  <div className="text-5xl font-bold text-sky-200/40 dark:text-sky-800/40 font-serif flex-shrink-0 w-12 group-hover:text-sky-300/60 transition-colors">
                    {c.number}
                  </div>
                  <div>
                    <h3 className="font-bold text-primary mb-1">{c.title}</h3>
                    <p className="text-sm text-muted-foreground mb-2 leading-relaxed">{c.description}</p>
                    <Badge variant="secondary" className="text-xs font-mono">{c.scripture}</Badge>
                  </div>
                </motion.div>
              ))}
            </div>
            <motion.div variants={fadeUp} className="mt-6 text-center">
              <Link href="/correction-timeline">
                <Button variant="outline" className="gap-2">
                  Full Correction Timeline <ChevronRight className="w-4 h-4" />
                </Button>
              </Link>
            </motion.div>
          </motion.section>

          {/* Ministry Values */}
          <motion.section
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="mb-20"
          >
            <motion.div variants={fadeUp} className="mb-8">
              <Badge variant="outline" className="mb-4">What We Stand For</Badge>
              <h2 className="text-3xl font-serif font-bold text-primary">Core Ministry Values</h2>
            </motion.div>
            <div className="grid sm:grid-cols-2 gap-4">
              {MINISTRY_VALUES.map((v) => (
                <motion.div
                  key={v.title}
                  variants={fadeUp}
                  className="glass-panel border border-border rounded-2xl p-6 flex gap-4"
                >
                  <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-400/20 flex items-center justify-center flex-shrink-0">
                    <v.icon className="w-5 h-5 text-sky-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-primary mb-1">{v.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{v.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* Transparency Statement */}
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-r from-primary/5 to-sky-50/30 dark:from-primary/10 dark:to-sky-950/20 border border-border rounded-3xl p-10 text-center mb-16"
          >
            <Shield className="w-10 h-10 text-sky-500 mx-auto mb-4" />
            <h2 className="text-2xl font-serif font-bold text-primary mb-4">Our Commitment to Transparency</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-6">
              JCTM operates with full financial accountability and doctrinal transparency. We do not use manipulation, false prophecies, or financial coercion. Every giving record is handled with integrity, and our doctrine is openly published and verifiable against scripture.
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-muted-foreground">No Manipulation</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-muted-foreground">Scripture-Verified Doctrine</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-muted-foreground">Financial Integrity</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-muted-foreground">Open Doctrine</span>
              </div>
            </div>
            <div className="mt-6">
              <a
                href="https://www.youtube.com/@TEMPLETVJCTM"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button className="gap-2">
                  <ExternalLink className="w-4 h-4" /> Verify Our Teachings on Temple TV
                </Button>
              </a>
            </div>
          </motion.section>

          {/* Ebrumede Temple */}
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <Badge variant="outline" className="mb-4">Our Home</Badge>
            <h2 className="text-3xl font-serif font-bold text-primary mb-4">Ebrumede Temple, Warri</h2>
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  The Ebrumede Temple in Warri, Delta State, Nigeria serves as the headquarters and spiritual home of JCTM. Built on the foundations of apostolic faith and doctrinal purity, the temple has been a place of genuine encounter with God for thousands of believers since 1994.
                </p>
                <p>
                  Weekly services, prophetic meetings, and special crusades are held at this location. The temple also serves as the base for Temple TV broadcasting operations, reaching a global audience every Sunday.
                </p>
                <div className="pt-2">
                  <div className="text-sm font-medium text-foreground mb-1">📍 Physical Address</div>
                  <ChurchAddressBlock variant="full" className="text-sm text-muted-foreground" showIcon />
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground mb-1">📧 Contact</div>
                  <div className="text-sm">info@jctm.org.ng</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground mb-1">📺 Temple TV</div>
                  <div className="text-sm">
                    <a href="https://youtube.com/@TEMPLETVJCTM" target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:underline">
                      youtube.com/@TEMPLETVJCTM
                    </a>
                  </div>
                </div>
              </div>
              <VenueMap
                venue={CHURCH_HQ_VENUE}
                headerTitle="Ebrumede Temple Location"
                height={280}
                theme={{
                  headerBg: "rgba(2,6,23,0.85)",
                  headerBorder: "rgba(56,189,248,0.25)",
                  accentText: "text-sky-400",
                  footerBg: "rgba(2,6,23,0.85)",
                }}
              />
            </div>
          </motion.section>

        </div>
      </div>
    </Layout>
  );
}

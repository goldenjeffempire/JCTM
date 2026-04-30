import { Link } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import {
  Shield, BookOpen, Globe, Heart, Clock, Droplets,
  Mic2, Home, ArrowRight, Star,
} from "lucide-react";

export const TOPICS = [
  {
    slug: "holiness",
    title: "Holiness",
    subtitle: "Without holiness, no man shall see the Lord",
    icon: Shield,
    color: "from-blue-600 to-blue-900",
    accent: "#38BDF8",
    scripture: "Hebrews 12:14",
    description: "JCTM's foundational teaching — what holiness means, why it is non-negotiable, and how to live a sanctified life in the modern world.",
    keywords: ["holiness", "sanctification", "separation", "righteousness", "purity"],
  },
  {
    slug: "correction-mandate",
    title: "The Correction Mandate",
    subtitle: "Ask for the old paths, where the good way is",
    icon: Globe,
    color: "from-indigo-700 to-indigo-950",
    accent: "#6366F1",
    scripture: "Jeremiah 6:16",
    description: "The divine assignment of Jesus Christ Temple Ministry to identify and correct five major doctrinal errors that have infiltrated the global church.",
    keywords: ["correction", "mandate", "false doctrine", "prosperity gospel", "reformation"],
  },
  {
    slug: "primitive-christianity",
    title: "Primitive Christianity",
    subtitle: "Return to the faith once delivered to the saints",
    icon: BookOpen,
    color: "from-emerald-700 to-emerald-950",
    accent: "#10B981",
    scripture: "Jude 1:3",
    description: "A return to the original, unadulterated first-century apostolic faith — holy in practice, sound in doctrine, and powerful in manifestation.",
    keywords: ["primitive christianity", "apostolic", "first century", "original faith", "restoration"],
  },
  {
    slug: "healing-miracles",
    title: "Healing & Miracles",
    subtitle: "By His stripes we are healed",
    icon: Heart,
    color: "from-rose-600 to-rose-900",
    accent: "#F43F5E",
    scripture: "Isaiah 53:5",
    description: "God's healing power at work through prayer and faith. JCTM's biblical approach to divine healing, miracles, and deliverance from affliction.",
    keywords: ["healing", "miracles", "deliverance", "divine healing", "prayer for healing"],
  },
  {
    slug: "end-times",
    title: "End Times & Rapture",
    subtitle: "Watch therefore, for you know not the hour",
    icon: Clock,
    color: "from-amber-600 to-amber-950",
    accent: "#F59E0B",
    scripture: "Matthew 24:42",
    description: "JCTM's end-time message — the signs of the last days, the imminent return of Christ, and how to be ready for His coming.",
    keywords: ["end times", "rapture", "second coming", "last days", "eschatology"],
  },
  {
    slug: "water-baptism",
    title: "Water Baptism",
    subtitle: "Buried with Him in baptism, raised with Him in faith",
    icon: Droplets,
    color: "from-cyan-600 to-cyan-900",
    accent: "#06B6D4",
    scripture: "Romans 6:3-4",
    description: "The New Testament doctrine of water baptism — its true meaning, mode of administration, and what JCTM teaches about this foundational sacrament.",
    keywords: ["water baptism", "baptism", "immersion", "sacrament", "New Testament baptism"],
  },
  {
    slug: "prayer-intercession",
    title: "Prayer & Intercession",
    subtitle: "The effectual fervent prayer of a righteous man avails much",
    icon: Mic2,
    color: "from-purple-600 to-purple-950",
    accent: "#A855F7",
    scripture: "James 5:16",
    description: "Biblical principles of prayer, intercession, and fasting — how JCTM approaches communion with God and standing in the gap for souls.",
    keywords: ["prayer", "intercession", "fasting", "spiritual warfare", "prayer ministry"],
  },
  {
    slug: "family-marriage",
    title: "Family & Marriage",
    subtitle: "Honour marriage and keep the marriage bed pure",
    icon: Home,
    color: "from-orange-600 to-orange-950",
    accent: "#F97316",
    scripture: "Hebrews 13:4",
    description: "God's design for the family — marriage, parenting, and building a home that honours Christ according to JCTM's biblical teaching.",
    keywords: ["family", "marriage", "husband wife", "parenting", "Christian home"],
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 60, damping: 16 } },
};
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

export default function Topics() {
  return (
    <Layout>
      <SEO
        title="Bible Topics & Teachings — JCTM Sermon Library"
        description="Explore JCTM's in-depth teachings on holiness, the Correction Mandate, primitive Christianity, healing, end times, water baptism, prayer, and family. Sermons by Prophet Amos Evomobor."
        path="/topics"
        keywords="JCTM topics, Temple TV teachings, holiness sermons Nigeria, Correction Mandate teaching, primitive Christianity, healing miracles JCTM, end times rapture, water baptism, prayer intercession, family marriage Bible"
        breadcrumbs={[
          { name: "Home", url: "https://jctm.org.ng/" },
          { name: "Bible Topics", url: "https://jctm.org.ng/topics" },
        ]}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": "JCTM Bible Topics & Teachings",
            "description": "In-depth teachings on 8 core Bible topics from Jesus Christ Temple Ministry (JCTM) — holiness, the Correction Mandate, primitive Christianity, healing, end times, water baptism, prayer, and family.",
            "url": "https://jctm.org.ng/topics",
            "about": {
              "@type": "ReligiousOrganization",
              "name": "Jesus Christ Temple Ministry (JCTM)",
              "url": "https://jctm.org.ng"
            },
            "hasPart": TOPICS.map(t => ({
              "@type": "WebPage",
              "name": `${t.title} — JCTM Teachings`,
              "url": `https://jctm.org.ng/topics/${t.slug}`,
              "description": t.description,
            }))
          },
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            "name": "JCTM Bible Topic Pages",
            "itemListElement": TOPICS.map((t, i) => ({
              "@type": "ListItem",
              "position": i + 1,
              "name": `${t.title} — JCTM`,
              "url": `https://jctm.org.ng/topics/${t.slug}`,
            }))
          }
        ]}
      />

      <div className="min-h-screen bg-white pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-5xl">

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <Badge className="mb-4 bg-accent/10 text-accent border-accent/20">Scripture Topics</Badge>
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary mb-4">
              Bible Topics & Teachings
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
              Deep, scripture-grounded teachings from Jesus Christ Temple Ministry (JCTM) — covering
              the core doctrines that define true, apostolic Christianity.
            </p>
          </motion.div>

          {/* Topic Grid */}
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            {TOPICS.map(topic => {
              const Icon = topic.icon;
              return (
                <motion.div key={topic.slug} variants={fadeUp}>
                  <Link href={`/topics/${topic.slug}`}>
                    <div className="group glass-panel rounded-2xl p-6 border border-border/50 hover:border-accent/30 transition-all duration-300 hover:shadow-lg cursor-pointer">
                      <div className="flex items-start gap-4">
                        <div
                          className="p-3 rounded-xl flex-shrink-0"
                          style={{ background: `linear-gradient(135deg, ${topic.accent}20, ${topic.accent}10)` }}
                        >
                          <Icon className="h-6 w-6" style={{ color: topic.accent }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h2 className="font-serif font-bold text-lg text-primary group-hover:text-accent transition-colors">
                              {topic.title}
                            </h2>
                            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-accent group-hover:translate-x-1 transition-all" />
                          </div>
                          <p className="text-xs text-accent font-medium mb-2 italic">"{topic.subtitle}" — {topic.scripture}</p>
                          <p className="text-sm text-muted-foreground leading-relaxed">{topic.description}</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Bottom CTA */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
            className="text-center mt-16 p-8 glass-panel rounded-2xl border border-border/50"
          >
            <Star className="h-8 w-8 text-accent mx-auto mb-3" />
            <h3 className="font-serif font-bold text-2xl text-primary mb-2">Explore All 479+ Sermons</h3>
            <p className="text-muted-foreground mb-4">Search the full Temple TV library for any topic, scripture, or teaching.</p>
            <Link href="/sermons">
              <button className="bg-primary text-white px-6 py-3 rounded-full font-semibold hover:bg-primary/90 transition-colors">
                Browse Sermon Library →
              </button>
            </Link>
          </motion.div>

        </div>
      </div>
    </Layout>
  );
}

import { useRef } from "react";
import { Layout } from "@/components/layout/Layout";
import { motion, useScroll, useTransform } from "framer-motion";

const CORRECTIONS = [
  {
    year: "1994",
    title: "The Prosperity Gospel Error",
    prophet: "The church had reduced the Gospel to material gain — preachers promising wealth as proof of divine favor.",
    correction: "Prophet Amos was shown that the true Gospel is about righteousness, holiness, and eternal life — not earthly riches. God's blessing is the transformation of character, not the multiplication of possessions.",
    scripture: "Matthew 6:33 — Seek first the Kingdom of God and His righteousness, and all these things shall be added.",
    color: "#003366",
  },
  {
    year: "1998",
    title: "Prophetic Manipulation",
    prophet: "False prophets were using prophetic gifts to control, extort, and manipulate the body of Christ for personal gain.",
    correction: "Prophecy is a servant of the church, not a tool of power. Every prophetic word must be tested by Scripture, and any prophet who uses revelation for personal enrichment is operating in witchcraft, not the Spirit.",
    scripture: "1 John 4:1 — Beloved, do not believe every spirit, but test the spirits to see whether they are from God.",
    color: "#1d4ed8",
  },
  {
    year: "2003",
    title: "Spiritual Fatherhood Corruption",
    prophet: "The concept of spiritual fatherhood had become a mechanism for spiritual slavery — where 'sons' were bound in submission to human leaders rather than God.",
    correction: "There is one Father — God. Human fathers in ministry are stewards of relationship, not lords over God's heritage. Any fatherhood that replaces Christ's lordship is a counterfeit.",
    scripture: "Matthew 23:9 — Call no man your father on earth, for you have one Father, who is in heaven.",
    color: "#7c3aed",
  },
  {
    year: "2009",
    title: "The Grace Abuse Doctrine",
    prophet: "Hyper-grace teaching had emerged as a license for sin — believers were told they could live however they wished because Christ had paid for all sin.",
    correction: "Grace is not permission to sin but power to overcome sin. The same grace that forgives also sanctifies. A life unchanged by grace has not truly received it.",
    scripture: "Romans 6:1-2 — Shall we continue in sin that grace may abound? Certainly not! How shall we who died to sin live any longer in it?",
    color: "#0891b2",
  },
  {
    year: "2016",
    title: "Entertainment-Driven Worship",
    prophet: "The church had become indistinguishable from the entertainment industry — worship replaced with performance, sermons replaced with motivational speeches.",
    correction: "God seeks worshippers who worship in spirit and truth. The house of God is a house of prayer, not a theater. When the glory of God departs, all that remains is spectacle.",
    scripture: "John 4:23-24 — The true worshippers will worship the Father in spirit and truth, for the Father is seeking such people to worship him.",
    color: "#059669",
  },
];

export default function Timeline() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start start", "end end"] });
  const lineHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center mb-16">
          <span className="inline-block text-xs font-semibold text-accent uppercase tracking-widest mb-4 border border-accent/30 rounded-full px-4 py-1.5">The Correction Mandate</span>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary mb-4">Doctrinal Corrections</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Through Prophet Amos Evomobor, God has been correcting the body of Christ from the errors that have crept in. These are the five core corrections given to Jesus Christ Temple Ministry.
          </p>
        </motion.div>

        <div ref={containerRef} className="relative max-w-4xl mx-auto">
          <div className="absolute left-1/2 -translate-x-1/2 top-0 w-0.5 bg-border/50 h-full hidden md:block" />
          <motion.div style={{ height: lineHeight }} className="absolute left-1/2 -translate-x-1/2 top-0 w-0.5 bg-accent hidden md:block origin-top" />

          {CORRECTIONS.map((item, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.7, delay: 0.1 }}
              className={`relative flex flex-col md:flex-row items-center gap-8 mb-16 ${i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"}`}>
              
              <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 w-12 h-12 rounded-full items-center justify-center z-10 border-4 border-white shadow-lg text-white text-sm font-bold"
                style={{ backgroundColor: item.color }}>
                {item.year.slice(2)}
              </div>

              <div className={`flex-1 ${i % 2 === 0 ? "md:pr-16" : "md:pl-16"}`}>
                <div className="glass-panel rounded-2xl p-7 hover:shadow-xl transition-shadow border border-border/50 relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ backgroundColor: item.color }} />
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-2xl font-serif font-bold" style={{ color: item.color }}>{item.year}</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <h3 className="text-xl font-serif font-bold text-primary mb-3">{item.title}</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">The Error</p>
                      <p className="text-muted-foreground text-sm leading-relaxed">{item.prophet}</p>
                    </div>
                    <div className="border-l-2 pl-4" style={{ borderColor: item.color }}>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: item.color }}>The Correction</p>
                      <p className="text-foreground text-sm leading-relaxed">{item.correction}</p>
                    </div>
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

        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mt-8 glass-panel rounded-2xl p-10 max-w-2xl mx-auto border border-accent/20">
          <h3 className="text-2xl font-serif font-bold text-primary mb-3">The Mandate Continues</h3>
          <p className="text-muted-foreground leading-relaxed">
            These corrections are not condemnations of people but of doctrines. Prophet Amos Evomobor and Jesus Christ Temple Ministry stand as a voice calling the church back to the original Gospel of Jesus Christ.
          </p>
          <p className="text-accent font-semibold mt-4 italic">"Buy the truth and do not sell it." — Proverbs 23:23</p>
        </motion.div>
      </div>
    </Layout>
  );
}

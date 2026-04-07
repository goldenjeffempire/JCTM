import { Layout } from "@/components/layout/Layout";
import { motion } from "framer-motion";
import { BookOpen, Target, Globe, Shield, Eye, Mail, Phone, MapPin } from "lucide-react";
import prophetAmosImg from "@/assets/prophet-amos-evomobor.png";

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
  { year: "2013", label: "Divine Establishment", text: "Jesus Christ Temple Ministry came into existence on the 3rd of January, 2013 — not by human ambition or personal desire, but by divine establishment through the Lord Jesus Christ Himself." },
  { year: "Growth", label: "Ebrumede Temple", text: "The Ebrumede Temple is established as the physical headquarters of JCTM in Warri, Delta State — a house of prayer, doctrine, and reformation." },
  { year: "Media", label: "Temple TV Launch", text: "Temple TV is launched, extending the reach of the Correction Mandate to believers across Nigeria and beyond through digital broadcast." },
  { year: "Digital", label: "Digital Sanctuary", text: "The JCTM Digital Sanctuary is launched — a global-scale platform for sermons, giving, testimonies, and AI-assisted doctrinal guidance." },
];

const STORY_PARAGRAPHS = [
  "Jesus Christ Temple Ministry came into existence on the 3rd of January, 2013, not by human ambition or personal desire, but by divine establishment through the Lord Jesus Christ Himself. The ministry was birthed under the spiritual guidance and care of Prophet Amos Evomobor, who was entrusted with the responsibility of nurturing, leading, and preserving the vision according to God's divine purpose. From its very beginning, the foundation of this ministry has been deeply rooted in the eternal principles of holiness and righteousness — values that are not subject to change, compromise, or modern reinterpretation, but remain the standard of God for all who seek to walk with Him.",
  "This ministry stands as a spiritual platform designed to call men and women back to the original truth of God's Word, emphasizing a life that reflects purity, obedience, and total submission to the will of God. It is not built on worldly systems, human philosophies, or material pursuits, but on the unshakable truth that without holiness, no man shall see the Lord. As such, Jesus Christ Temple Ministry continually upholds the call to live a sanctified life, encouraging believers to separate themselves from sin, worldly distractions, and anything that opposes the nature and character of Christ.",
  "At the heart of the ministry is a clear and unwavering vision: to prepare souls for the kingdom of heaven, especially in these last days. There is a strong awareness within the ministry that time is short and that the return of the Lord draws nearer. Because of this, every message, teaching, and activity is centered on eternity rather than temporary gain. The focus is not on earthly success or recognition, but on the ultimate goal of making heaven. This eternal perspective shapes the doctrine, the lifestyle, and the mission of the church, constantly reminding believers that their stay on earth is temporary and that their true home is with God.",
  "In fulfilling its divine mandate, Jesus Christ Temple Ministry is committed to spreading the undiluted end-time message of God across the nations of the world. This message is not altered to suit human desires or cultural trends, but is preserved in its original form as revealed by the Spirit of God. It is a message of repentance, holiness, righteousness, and readiness for the coming of Christ. The ministry serves as a voice in the wilderness of this generation, calling people out of darkness into the marvelous light of God, and urging them to return to the path of truth before it is too late.",
  "Under the leadership of Prophet Amos Evomobor, the ministry continues to grow and expand, not merely in numbers, but in spiritual depth and impact. His role is not just administrative, but deeply prophetic and pastoral, ensuring that the church remains aligned with God's will at all times. Through his leadership, the ministry maintains its focus on raising a people who are not only hearers of the Word but doers also — believers who live out the message they receive and become examples of Christ in their daily lives.",
  "Jesus Christ Temple Ministry is therefore more than just a place of worship; it is a movement of divine purpose, a gathering of believers who are committed to living for God in truth and in spirit. It is a place where lives are transformed, destinies are redirected, and hearts are prepared for eternity. Every teaching, every gathering, and every outreach effort is directed toward one central goal: to ensure that as many souls as possible are saved and ready for the coming of the Lord.",
  "In a world where many have drifted away from the truth, this ministry stands as a beacon of light, pointing people back to God's original standard. It is a call to awakening, a reminder that God is still speaking, and an invitation for all who are willing to walk the narrow path that leads to life. Through its unwavering commitment to holiness and its passion for soul-winning, Jesus Christ Temple Ministry continues to fulfill its divine assignment, reaching out to the world with the life-transforming message of the gospel and preparing a people for the glorious kingdom of God.",
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
          {/* Page header */}
          <div className="mb-12">
            <span className="inline-block text-xs font-semibold text-accent uppercase tracking-widest mb-4 border border-accent/30 rounded-full px-4 py-1.5">
              Who We Are
            </span>
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary mb-4">
              About JCTM
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl leading-relaxed">
              A ministry established by divine mandate, rooted in holiness, and committed to preparing souls for the kingdom of God.
            </p>
          </div>

          {/* Our Story */}
          <div className="glass-panel rounded-2xl p-8 mb-10">
            <h2 className="text-2xl font-serif font-bold text-primary mb-6">Our Story</h2>
            <div className="space-y-5">
              {STORY_PARAGRAPHS.map((para, i) => (
                <p key={i} className="text-muted-foreground leading-relaxed text-[15px]">
                  {para}
                </p>
              ))}
            </div>
          </div>

          {/* Founder section */}
          <div className="glass-panel rounded-2xl overflow-hidden mb-10">
            <div className="flex flex-col md:flex-row">
              {/* Photo */}
              <div className="md:w-72 shrink-0 bg-gradient-to-br from-primary/5 to-accent/5 flex items-center justify-center p-8 md:p-0">
                <div className="relative">
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-accent/20 to-primary/20 blur-xl scale-110" />
                  <img
                    src={prophetAmosImg}
                    alt="Prophet Amos Evomobor — General Overseer, JCTM"
                    className="relative w-56 md:w-full md:h-full object-cover object-top rounded-2xl md:rounded-none shadow-2xl"
                    style={{ maxHeight: "420px" }}
                  />
                </div>
              </div>

              {/* Bio */}
              <div className="flex-1 p-8">
                <span className="inline-block text-xs font-semibold text-accent uppercase tracking-widest mb-3 border border-accent/30 rounded-full px-3 py-1">
                  Founder & General Overseer
                </span>
                <h2 className="text-2xl md:text-3xl font-serif font-bold text-primary mb-1">
                  Prophet Amos Evomobor
                </h2>
                <p className="text-accent text-sm font-medium mb-5">
                  Jesus Christ Temple Ministry · Warri, Nigeria
                </p>

                <div className="space-y-4 text-[15px] text-muted-foreground leading-relaxed">
                  <p>
                    Prophet Amos Evomobor is a man raised by God specifically for this generation's doctrinal reformation. Operating under the grace of correction, he has consistently delivered uncompromising biblical teaching on Primitive Christianity, the Baptism of the Holy Spirit, Water Baptism, Holiness, and the End Times.
                  </p>
                  <p>
                    His teachings on Temple TV have brought doctrinal clarity to thousands of ministers and believers, establishing him as a prophetic voice of correction in the Nigerian church landscape. The Ebrumede Temple — his base of operations in Warri — has become a centre of reformation, drawing seekers of truth from across the nation.
                  </p>
                  <p>
                    The mandate entrusted to Prophet Amos is not merely institutional — it is eschatological. He carries a burden for the global Body of Christ to return to the simplicity, purity, and power of the apostolic church before the return of the Lord.
                  </p>
                </div>

                <div className="mt-6 pt-6 border-t border-border/50 flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <a href="mailto:prophetamos@jctm.org.ng" className="flex items-center gap-1.5 hover:text-accent transition-colors">
                    <Mail className="h-3.5 w-3.5" /> prophetamos@jctm.org.ng
                  </a>
                  <a href="tel:+2348081313111" className="flex items-center gap-1.5 hover:text-accent transition-colors">
                    <Phone className="h-3.5 w-3.5" /> +234 (0) 808 131 3111
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Vision & Mission */}
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

            <div className="glass-panel rounded-2xl p-8 mb-8 space-y-5">
              <p className="text-muted-foreground leading-relaxed text-[15px]">
                The mission and vision of Jesus Christ Temple Ministry are centered on bringing men and women back into a right relationship with the Lord Jesus Christ through the pathway of genuine repentance and a life of holiness. The ministry emphasizes that true reconciliation with God is not achieved through outward appearance or religious activities alone, but through a sincere turning away from sin and a complete surrender to the will and nature of Christ. Repentance is taught as a deep, heartfelt transformation that leads to a renewed life, while holiness is upheld as the daily lifestyle that reflects God's character in every believer.
              </p>
              <p className="text-muted-foreground leading-relaxed text-[15px]">
                This divine assignment is rooted in the understanding that the presence of the Holy Spirit can only dwell in a vessel that is purified and set apart unto God. Therefore, the ministry continually calls believers to live in purity, righteousness, and obedience so they can become worthy carriers of the Spirit of God. It stresses that the indwelling of the Holy Spirit is not just for spiritual experience, but for transformation, guidance, and preparation for eternal life.
              </p>
              <p className="text-muted-foreground leading-relaxed text-[15px]">
                Ultimately, the vision looks forward to the rapture — the glorious moment when the Lord will gather His people to Himself. Jesus Christ Temple Ministry seeks to prepare hearts and lives for that day, ensuring that those who follow this path are ready, watchful, and spiritually equipped to meet the Lord when He appears.
              </p>
            </div>

            {/* Ministry Timeline */}
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

          {/* Core Beliefs */}
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

          {/* Contact & Location */}
          <div className="glass-panel rounded-2xl p-8">
            <h2 className="text-2xl font-serif font-bold text-primary mb-6">Contact & Location</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-sm text-muted-foreground">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="h-4 w-4 text-accent shrink-0" />
                  <p className="font-semibold text-primary">Church Address</p>
                </div>
                <address className="not-italic space-y-0.5 leading-relaxed">
                  <p>Jesus Christ Temple Ministry</p>
                  <p>Km 1 East West Road,</p>
                  <p>Patani Expressway,</p>
                  <p>Ebrumede Roundabout, Effurun,</p>
                  <p>Delta State, Nigeria</p>
                </address>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Mail className="h-4 w-4 text-accent shrink-0" />
                  <p className="font-semibold text-primary">Email Us</p>
                </div>
                <ul className="space-y-2">
                  {[
                    { label: "General", address: "info@jctm.org.ng" },
                    { label: "Ministry", address: "jesuschristtempleministry@jctm.org.ng" },
                    { label: "New Members", address: "joinus@jctm.org.ng" },
                    { label: "Support", address: "support@jctm.org.ng" },
                    { label: "Prophet Amos", address: "prophetamos@jctm.org.ng" },
                  ].map(({ label, address }) => (
                    <li key={address}>
                      <a href={`mailto:${address}`} className="hover:text-accent transition-colors flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60">{label}</span>
                        <span className="break-all">{address}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Phone className="h-4 w-4 text-accent shrink-0" />
                  <p className="font-semibold text-primary">Phone & Media</p>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60 mb-0.5">Enquiries</p>
                    <a href="tel:+2348081313111" className="hover:text-accent transition-colors">+234 (0) 808 131 3111</a>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60 mb-0.5">Temple TV</p>
                    <a href="https://www.youtube.com/@TEMPLETVJCTM" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline break-all">
                      youtube.com/@TEMPLETVJCTM
                    </a>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60 mb-0.5">Website</p>
                    <a href="https://www.jctmng.org" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                      www.jctmng.org
                    </a>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60 mb-0.5">Sunday Service</p>
                    <p>Live-streamed via Temple TV · 8:00 AM WAT</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </motion.div>
      </div>
    </Layout>
  );
}

import { SEO } from "@/components/SEO";
import { Mail, Phone, MapPin, Clock, MessageSquare, Globe, Video } from "lucide-react";

const CONTACT_CHANNELS = [
  {
    icon: Mail,
    label: "General Enquiries",
    value: "info@jctm.org.ng",
    href: "mailto:info@jctm.org.ng",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/40",
  },
  {
    icon: Mail,
    label: "Ministry Office",
    value: "jesuschristtempleministry@jctm.org.ng",
    href: "mailto:jesuschristtempleministry@jctm.org.ng",
    color: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-50 dark:bg-indigo-950/40",
  },
  {
    icon: Mail,
    label: "New Members",
    value: "joinus@jctm.org.ng",
    href: "mailto:joinus@jctm.org.ng",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
  },
  {
    icon: Mail,
    label: "Technical Support",
    value: "support@jctm.org.ng",
    href: "mailto:support@jctm.org.ng",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/40",
  },
  {
    icon: Mail,
    label: "Prophet Amos Evomobor",
    value: "prophetamos@jctm.org.ng",
    href: "mailto:prophetamos@jctm.org.ng",
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-950/40",
  },
  {
    icon: Phone,
    label: "Ministry Phone",
    value: "+234 808 131 3111",
    href: "tel:+2348081313111",
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-950/40",
  },
];

const SERVICE_TIMES = [
  { day: "Sunday", time: "8:00 AM – 12:00 PM WAT", type: "Main Service" },
  { day: "Wednesday", time: "5:00 PM – 8:00 PM WAT", type: "Midweek Service" },
  { day: "Friday", time: "5:00 PM – 8:00 PM WAT", type: "Prayer & Bible Study" },
];

const ONLINE_CHANNELS = [
  {
    icon: Globe,
    label: "Temple TV (YouTube)",
    href: "https://www.youtube.com/@TEMPLETVJCTM",
    description: "Live services and sermon archive",
  },
  {
    icon: MessageSquare,
    label: "Facebook",
    href: "https://www.facebook.com/templetvjctm",
    description: "Ministry updates and community",
  },
  {
    icon: Video,
    label: "Zoom Online Service",
    href: "https://zoom.us/j/4092099631",
    description: "Join live services remotely — Meeting ID: 4092099631",
  },
];

export default function Contact() {
  return (
    <>
      <SEO
        title="Contact Us — Jesus Christ Temple Ministry (JCTM)"
        description="Get in touch with Jesus Christ Temple Ministry (JCTM), Warri, Nigeria. Reach us by email, phone, or visit our church at Ebrumede, Warri. Service times, location, and online channels."
        path="/contact"
        keywords="JCTM contact, Jesus Christ Temple Ministry contact, JCTM Warri address, Temple TV contact, church Warri Nigeria, JCTM phone email"
        type="website"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "ContactPage",
          "@id": "https://jctm.org.ng/contact#webpage",
          "name": "Contact Jesus Christ Temple Ministry (JCTM)",
          "description": "Contact page for Jesus Christ Temple Ministry — email, phone, address, and service times.",
          "url": "https://jctm.org.ng/contact",
          "inLanguage": "en-NG",
          "isPartOf": { "@id": "https://jctm.org.ng/#website" },
          "publisher": { "@id": "https://jctm.org.ng/#organization" },
          "breadcrumb": {
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://jctm.org.ng/" },
              { "@type": "ListItem", "position": 2, "name": "Contact", "item": "https://jctm.org.ng/contact" }
            ]
          }
        }}
      />

      <main className="min-h-screen bg-background">
        {/* Hero */}
        <section className="relative py-20 md:py-28 overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background border-b border-border/50">
          <div className="absolute inset-0 pointer-events-none" aria-hidden>
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
          </div>
          <div className="container mx-auto px-4 text-center relative">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-accent/30 bg-accent/5 text-accent text-xs font-semibold uppercase tracking-widest mb-6">
              <MessageSquare className="h-3.5 w-3.5" />
              Get In Touch
            </div>
            <h1 className="text-4xl md:text-5xl font-bold font-serif text-primary mb-5 leading-tight">
              Contact Jesus Christ Temple Ministry
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
              We would love to hear from you. Reach out for prayer requests, ministry enquiries,
              membership, or any questions about JCTM and Temple TV.
            </p>
          </div>
        </section>

        <div className="container mx-auto px-4 py-16 max-w-6xl space-y-16">

          {/* Contact Channels */}
          <section>
            <h2 className="text-2xl font-bold font-serif text-primary mb-2">Direct Contact</h2>
            <p className="text-muted-foreground mb-8">
              Choose the most appropriate channel for your enquiry. All emails are monitored by ministry staff.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {CONTACT_CHANNELS.map(({ icon: Icon, label, value, href, color, bg }) => (
                <a
                  key={href}
                  href={href}
                  className={`group flex flex-col gap-3 p-5 rounded-2xl border border-border/60 hover:border-primary/30 bg-card hover:shadow-md transition-all duration-200`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg}`}>
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-0.5">
                      {label}
                    </p>
                    <p className="text-sm font-medium text-primary group-hover:text-accent transition-colors break-all">
                      {value}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </section>

          {/* Physical Location */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div>
              <h2 className="text-2xl font-bold font-serif text-primary mb-2">Visit Our Church</h2>
              <p className="text-muted-foreground mb-6">
                We warmly welcome all visitors to Jesus Christ Temple Ministry in Warri, Nigeria.
                Our doors are open for worship, prayer, and fellowship.
              </p>

              <div className="space-y-5">
                <div className="flex gap-4 p-5 rounded-2xl bg-card border border-border/60">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-1">Physical Address</p>
                    <address className="not-italic text-sm text-primary leading-relaxed font-medium">
                      Ebrumede Temple<br />
                      Off Sapele Road, Ebrumede Roundabout<br />
                      Warri, Delta State<br />
                      Nigeria — 330222
                    </address>
                    <a
                      href="https://www.google.com/maps/search/Ebrumede+Temple+Warri+Nigeria"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-3 text-xs text-accent hover:text-accent/80 font-semibold transition-colors"
                    >
                      <MapPin className="h-3 w-3" />
                      View on Google Maps
                    </a>
                  </div>
                </div>

                <div className="flex gap-4 p-5 rounded-2xl bg-card border border-border/60">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                    <Clock className="h-5 w-5 text-accent" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-3">Service Times (WAT — UTC+1)</p>
                    <div className="space-y-2.5">
                      {SERVICE_TIMES.map(({ day, time, type }) => (
                        <div key={day} className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-primary">{day}</p>
                            <p className="text-xs text-muted-foreground">{type}</p>
                          </div>
                          <p className="text-xs text-right text-muted-foreground font-mono whitespace-nowrap">
                            {time}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Online Channels */}
            <div>
              <h2 className="text-2xl font-bold font-serif text-primary mb-2">Connect Online</h2>
              <p className="text-muted-foreground mb-6">
                Join Temple TV services live from anywhere in the world. We reach believers in over 40 nations.
              </p>

              <div className="space-y-4">
                {ONLINE_CHANNELS.map(({ icon: Icon, label, href, description }) => (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-4 p-5 rounded-2xl border border-border/60 bg-card hover:border-primary/30 hover:shadow-md transition-all duration-200 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-primary group-hover:text-accent transition-colors">{label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                    </div>
                  </a>
                ))}
              </div>

              {/* Prayer Request CTA */}
              <div className="mt-6 p-6 rounded-2xl bg-gradient-to-br from-primary/10 via-accent/5 to-transparent border border-primary/20">
                <h3 className="font-semibold text-primary mb-2">Submit a Prayer Request</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Our intercession team prays over every request submitted through the platform.
                  Your prayer request is private and treated with care.
                </p>
                <a
                  href="/prayer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
                >
                  <MessageSquare className="h-4 w-4" />
                  Submit Prayer Request
                </a>
              </div>
            </div>
          </section>

          {/* Ministry Departments */}
          <section>
            <h2 className="text-2xl font-bold font-serif text-primary mb-2">Ministry Departments</h2>
            <p className="text-muted-foreground mb-8">
              JCTM operates through several active departments. Each department has dedicated leadership
              and can be reached through the ministry email contacts above.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { name: "Evangelism & Outreach", desc: "Crusades, street evangelism, and missions" },
                { name: "Prayer & Intercession", desc: "Intercession team, prayer chains, and altar ministry" },
                { name: "Media & Temple TV", desc: "Live streaming, recording, and digital distribution" },
                { name: "Youth Ministry", desc: "Faith development for young believers and teenagers" },
                { name: "Women's Ministry", desc: "Women's fellowships, mentorship, and support" },
                { name: "Ushering & Protocol", desc: "Service coordination and visitor welcoming team" },
              ].map(({ name, desc }) => (
                <div
                  key={name}
                  className="p-5 rounded-2xl border border-border/60 bg-card"
                >
                  <h3 className="font-semibold text-primary text-sm mb-1">{name}</h3>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Structured data */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "ContactPage",
                "@id": "https://jctm.org.ng/contact",
                "name": "Contact Jesus Christ Temple Ministry",
                "url": "https://jctm.org.ng/contact",
                "description": "Contact information for Jesus Christ Temple Ministry (JCTM), Warri, Nigeria",
                "mainEntity": {
                  "@type": "Church",
                  "@id": "https://jctm.org.ng/#organization",
                  "name": "Jesus Christ Temple Ministry",
                  "telephone": "+2348081313111",
                  "email": "info@jctm.org.ng",
                  "address": {
                    "@type": "PostalAddress",
                    "streetAddress": "Ebrumede Temple, Off Sapele Road",
                    "addressLocality": "Warri",
                    "addressRegion": "Delta State",
                    "postalCode": "330222",
                    "addressCountry": "NG",
                  },
                },
              }),
            }}
          />
        </div>
      </main>
    </>
  );
}

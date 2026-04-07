import { Layout } from "@/components/layout/Layout";
import { motion } from "framer-motion";
import { Tv, MapPin, Phone, Mail } from "lucide-react";

const VIEWING_CENTRES = [
  { name: "Bro Adeniyi David",                      location: "Lagos",            phone: "08051366325" },
  { name: "Pst Basibe Evans",                        location: "Lagos",            phone: "0803266645" },
  { name: "Joseph Dominic Dan",                      location: "Akwa Ibom",        phone: "07065380637" },
  { name: "Bro Amos Isaac Tsaku",                    location: "Nasarawa",         phone: "08036366515" },
  { name: "Bro Silas Danladi",                       location: "Adamawa",          phone: "07046322470" },
  { name: "Bro Bitrus Hassan",                       location: "Adamawa",          phone: "07080002054" },
  { name: "Pst Chibuwa James",                       location: "Rivers",           phone: "08162062703" },
  { name: "Bro Eke Samson",                          location: "Rivers",           phone: "09022759069" },
  { name: "Bro Akaku Emeka",                         location: "Rivers",           phone: "08039386734" },
  { name: "Bro Ipanya Odonemero",                    location: "Delta – Oleh",     phone: "09138513281" },
  { name: "Bro Odiete Onoriode",                     location: "Delta – Abraka",   phone: "08034430378" },
  { name: "Bro Victor Udekwe",                       location: "Delta – Kwale",    phone: "07087707817" },
  { name: "Bro Chikwado Martins / Bro Osita Emeka", location: "Edo",              phone: "08129409312" },
  { name: "Bro Joseph Ulankhoba",                    location: "Edo",              phone: "07032226903" },
  { name: "Bro Ifeadi Henry",                        location: "Anambra",          phone: "07036312885" },
  { name: "Bro Ntui Cyril",                          location: "Anambra",          phone: "07031296721" },
  { name: "Bro Ugwudinso Christian",                 location: "Enugu",            phone: "08138975516" },
  { name: "Bro Ogbonna Nwaokoro",                    location: "Abia",             phone: null },
  { name: "Bro Lumi Istifanus",                      location: "Lagos",            phone: "07040689542" },
  { name: "Bro Stephen Bassey",                      location: "Akwa Ibom",        phone: "08123451718" },
  { name: "Evang. Joel Uchechukwu John",             location: "Abia – Umuahia",   phone: "08038501555" },
  { name: "Evang. Josiah Anfofun",                   location: "Benue – Makurdi",  phone: "07032818130" },
];

export default function ViewingCentres() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto"
        >
          {/* Header */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
                <Tv className="h-5 w-5 text-accent" />
              </div>
              <span className="text-xs font-semibold text-accent uppercase tracking-widest border border-accent/30 rounded-full px-4 py-1.5">
                Nationwide Network
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary mb-4">
              Viewing Centres
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl leading-relaxed">
              Connect with a JCTM viewing centre near you across Nigeria. Contact the coordinator in your state to join a local gathering.
            </p>
          </div>

          {/* Headquarters card */}
          <div className="glass-panel rounded-2xl p-6 mb-8 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-primary mb-0.5">Headquarters — Ebrumede Temple</p>
              <p className="text-sm text-muted-foreground">
                Km 1 East West Road, Patani Expressway, Ebrumede Roundabout, Effurun, Delta State, Nigeria
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Sunday Services · <span className="font-medium text-primary">8:00 AM WAT</span>
              </p>
            </div>
            <a
              href="https://maps.google.com/?q=Ebrumede+Roundabout,+Effurun,+Delta+State,+Nigeria"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-primary/20 text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
            >
              <MapPin className="h-4 w-4" /> Get Directions
            </a>
          </div>

          {/* Directory table */}
          <div className="glass-panel rounded-2xl overflow-hidden mb-8">
            {/* Table header */}
            <div className="grid grid-cols-12 gap-2 px-5 py-3 bg-primary/5 border-b border-border text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              <div className="col-span-1">#</div>
              <div className="col-span-5">Coordinator</div>
              <div className="col-span-3">State / City</div>
              <div className="col-span-3">Contact</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-border/60">
              {VIEWING_CENTRES.map((centre, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.03 }}
                  className="grid grid-cols-12 gap-2 px-5 py-3.5 items-center hover:bg-accent/5 transition-colors"
                >
                  <div className="col-span-1 text-xs text-muted-foreground font-mono">{i + 1}</div>
                  <div className="col-span-5 text-sm font-semibold text-primary leading-tight">{centre.name}</div>
                  <div className="col-span-3">
                    <span className="inline-block text-xs bg-primary/8 text-primary rounded-full px-2.5 py-0.5 font-medium">
                      {centre.location}
                    </span>
                  </div>
                  <div className="col-span-3">
                    {centre.phone
                      ? <a href={`tel:${centre.phone}`} className="hover:text-accent transition-colors font-mono text-xs flex items-center gap-1"><Phone className="h-3 w-3 shrink-0" />{centre.phone}</a>
                      : <span className="text-xs text-muted-foreground/40 italic">—</span>
                    }
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="px-5 py-3 border-t border-border bg-primary/3 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
              <span>{VIEWING_CENTRES.length} viewing centres across Nigeria</span>
              <a href="mailto:info@jctm.org.ng" className="flex items-center gap-1.5 text-accent hover:underline">
                <Mail className="h-3 w-3" /> Register a new centre
              </a>
            </div>
          </div>

          {/* CTA */}
          <div className="glass-panel rounded-2xl p-6 text-center">
            <p className="text-muted-foreground text-sm mb-1">Don't see your state listed?</p>
            <p className="text-primary font-semibold mb-4">Reach out to us and we'll connect you with the nearest gathering.</p>
            <div className="flex flex-wrap justify-center gap-3">
              <a
                href="tel:+2348081313111"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                <Phone className="h-4 w-4" /> +234 (0) 808 131 3111
              </a>
              <a
                href="mailto:info@jctm.org.ng"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-primary/20 text-primary text-sm font-semibold hover:bg-primary/5 transition-colors"
              >
                <Mail className="h-4 w-4" /> info@jctm.org.ng
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}

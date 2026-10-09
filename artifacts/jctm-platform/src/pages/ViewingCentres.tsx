import { Layout } from "@/components/layout/Layout";
import { motion } from "framer-motion";
import { Tv, MapPin, Phone, Mail } from "lucide-react";
import { SEO } from "@/components/SEO";
import { ChurchAddressBlock } from "@/components/ChurchAddressBlock";

const VIEWING_CENTRES: { name: string; location: string; phone: string | null; phone2?: string }[] = [
  { name: "Bro Ogbonna Nwaokoro",                    location: "Abia",             phone: null },
  { name: "Evang. Joel Uchechukwu John",             location: "Abia – Umuahia",   phone: "08038501555" },
  { name: "Pst. Emmanuel",                           location: "Abuja – Jikwoyi",  phone: "08069041250" },
  { name: "Bro Silas Danladi",                       location: "Adamawa",          phone: "07046322470" },
  { name: "Bro Bitrus Hassan",                       location: "Adamawa",          phone: "07080002054" },
  { name: "Joseph Dominic Dan",                      location: "Akwa Ibom",        phone: "07065380637" },
  { name: "Bro Stephen Bassey",                      location: "Akwa Ibom",        phone: "08123451718" },
  { name: "Bro Ifeadi Henry",                        location: "Anambra",          phone: "07036312885" },
  { name: "Bro Ntui Cyril",                          location: "Anambra",          phone: "07031296721" },
  { name: "Bro Julius",                              location: "Bayelsa",          phone: "08138559370" },
  { name: "Bro Monday",                              location: "Benue – Gboko",    phone: "07062291532" },
  { name: "Josiah Anfofun",                         location: "Benue – Makurdi",  phone: "07032818130" },
  { name: "Amechi Odiete",                          location: "Delta – Abraka",   phone: "08034730378", phone2: "09078759138" },
  { name: "Bro Chikwado Martins",                    location: "Delta – Asaba",    phone: "08063261415" },
  { name: "Okrodono Friday",                         location: "Delta – Enwhe",    phone: "08146904779" },
  { name: "Bro Victor Udekwe",                       location: "Delta – Kwale",    phone: "07087707817" },
  { name: "Bro Ipanya Odonemero",                    location: "Delta – Oleh",     phone: "09138513281" },
  { name: "Bro Chikwado Martins / Bro Osita Emeka", location: "Edo",              phone: "08129409312" },
  { name: "Bro Joseph Ulankhoba",                    location: "Edo",              phone: "07032226903" },
  { name: "Bro Ugwudinso Christian",                 location: "Enugu",            phone: "08138975516" },
  { name: "Evang. Azubuogu Christopher Ejike",       location: "Imo – Okigwe",     phone: "07068681100", phone2: "09064237006" },
  { name: "Bro Adeniyi David",                       location: "Lagos",            phone: "08051366325" },
  { name: "Pst Basibe Evans",                        location: "Lagos",            phone: "0803266645" },
  { name: "Bro Lumi Istifanus",                      location: "Lagos",            phone: "07040689542" },
  { name: "Evang. Paul",                             location: "Lagos",            phone: "08147497719" },
  { name: "Evang. Micheal",                          location: "Lagos",            phone: "08024029773" },
  { name: "Pastor Vitus",                            location: "Lagos",            phone: "07051153129" },
  { name: "Mr Kingsley",                             location: "Lagos",            phone: "08033604350" },
  { name: "Mr David",                                location: "Lagos",            phone: "08051366325" },
  { name: "Bro Amos Isaac Tsaku",                    location: "Nasarawa",         phone: "08036366515" },
  { name: "Prince Solomon Akpotu",                   location: "Niger State",      phone: "08034524755" },
  { name: "Pst Chibuwa James",                       location: "Rivers",           phone: "08162062703" },
  { name: "Bro Eke Samson",                          location: "Rivers",           phone: "09022759069" },
  { name: "Bro Akaku Emeka",                         location: "Rivers",           phone: "08039386734" },
  { name: "Sunday Chinweume", location: "Uduenu LGA – Enugu", phone: "08030703762", phone2: "07068118355" },
  { name: "Omoni Dakodu", location: "Lagos – Iba", phone: "07080985556" },
  { name: "Omeke Simon", location: "Nsukka – Enugu", phone: "08064551249" },
  { name: "Victor Otunu", location: "Bayelsa – Yenagoa", phone: "07036988634" },
  { name: "Inokon Item Mark", location: "Delta – Ogwashi-Uku", phone: "07062672667" },
  { name: "Samson David", location: "Delta – Bomadi", phone: "08071332134", phone2: "09013752610" },
  { name: "Otibo Mark", location: "Delta – Ozoro", phone: "08053747524" },
  { name: "Sunny Amasi", location: "Delta – Agbor", phone: "08105791520" },
  { name: "Barry Ogbogbonibo", location: "Delta – Sapele", phone: "08034181047" },
  { name: "Jeremiah Godluck", location: "Lagos – Ikotun", phone: "08128329853", phone2: "090068900296" },
  { name: "David Ibuluku", location: "Lagos – Badagry", phone: "08037364884" },
  { name: "Bright Adogah", location: "Lagos – Iyana Edigbo", phone: "08062093965", phone2: "08147497719" },
  { name: "Iseh Kingsley", location: "Lagos – Iju/Ado", phone: "08023604350" },
  { name: "Lawrence Israel", location: "Anambra – Awka South (Nise)", phone: "09030057040", phone2: "09015619854" },
  { name: "Okardi Inagboriyefie", location: "Bayelsa – Brass LGA", phone: "0800265779414" },
  { name: "Henry James", location: "Nasarawa – Bukan Sidi", phone: "08062200702", phone2: "08113217627" },
  { name: "Peter Ukoro", location: "Nasarawa – Maraba", phone: "08063498085" },
  { name: "John Jeremiah", location: "Ogun – Agbado", phone: "08035980727" },
  { name: "John Inabakpe", location: "Niger – Suleja", phone: "08038868319" },
  { name: "Matthew Aboko", location: "Cameroon – Bamenda", phone: "+237 675176633" },
  { name: "Samgha’a Derick", location: "Cameroon – Yaoundé", phone: "+237 658171538" },
  { name: "Victor Etongkie", location: "Cameroon – Kribi", phone: "+237 679612047" },
  { name: "Ezike Desmond", location: "Cameroon – Douala", phone: "+237 652379533" },
  { name: "Ikechukwu Nwodo", location: "Kaduna – Gonigora", phone: "08036862206", phone2: "09076998902" },
  { name: "Aghilorly Kelechi / Meletus Ighurubide", location: "Kubwa", phone: "08034738233", phone2: "08063312158" },
  { name: "Patrick Onwuasoanya", location: "Abia – Aba", phone: "08127528615" },
  { name: "Samson Iyekekpolor", location: "Edo – Benin", phone: "07031336924", phone2: "07081336924" },
  { name: "Osayomore Wisdom", location: "Ogun – Mowe – Ibafo", phone: "07035383089" },
  { name: "Francis Sajo", location: "Gombe – Akko LGA", phone: "08036789805", phone2: "08021461715" },
  { name: "Ibekwe Peter", location: "Abuja – Abaji", phone: "07039619402" },
  { name: "Emmanuel Ibhazebo", location: "Edo – Ehanlen Ewu", phone: "07064965556" },
  { name: "Charles Odes", location: "Port Harcourt – Rumuokoro", phone: "09110083033", phone2: "08036714296" },
];

export default function ViewingCentres() {
  return (
    <Layout>
      <SEO
        title="Temple TV Viewing Centres — JCTM Nigeria"
        description="Find official Temple TV viewing centres of Jesus Christ Temple Ministry (JCTM) across Nigeria and beyond. Watch rebroadcast services and Temple TV broadcasts near you."
        path="/viewing-centres"
        keywords="Temple TV viewing centres, JCTM viewing centres, watch Temple TV Nigeria, JCTM centres Nigeria, JCTM Lagos, JCTM Abuja, JCTM Rivers, JCTM Edo, JCTM Anambra, Jesus Christ Temple Ministry branches"
        breadcrumbs={[
          { name: "Home", url: "https://jctm.org.ng/" },
          { name: "Viewing Centres", url: "https://jctm.org.ng/viewing-centres" },
        ]}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            "name": "Official Temple TV Viewing Centres — JCTM Nigeria",
            "description": "Official Temple TV viewing centres of Jesus Christ Temple Ministry (JCTM) across Nigeria and Cameroon. These centres host believers who gather to watch live Temple TV services and broadcasts.",
            "url": "https://jctm.org.ng/viewing-centres",
            "numberOfItems": VIEWING_CENTRES.length,
            "itemListElement": VIEWING_CENTRES.map((centre, index) => ({
              "@type": "ListItem",
              "position": index + 1,
              "name": `JCTM Viewing Centre — ${centre.location}`,
            }))
          },
          {
            "@context": "https://schema.org",
            "@type": "ReligiousOrganization",
            "name": "Jesus Christ Temple Ministry (JCTM) — Headquarters",
            "url": "https://jctm.org.ng",
            "address": {
              "@type": "PostalAddress",
              "streetAddress": "Ebrumede Temple, Off Sapele Road",
              "addressLocality": "Warri",
              "addressRegion": "Delta State",
              "addressCountry": "NG"
            },
            "geo": {
              "@type": "GeoCoordinates",
              "latitude": "5.5167",
              "longitude": "5.7500"
            },
            "hasMap": "https://maps.google.com/?q=Ebrumede+Warri+Delta+State+Nigeria",
            "areaServed": {
              "@type": "Country",
              "name": "Nigeria"
            }
          }
        ]}
      />
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
                Nigeria &amp; Cameroon
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary mb-4">
              Viewing Centres
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl leading-relaxed">
              Connect with a JCTM viewing centre near you across Nigeria and Cameroon. Contact the leader in your location to join a local gathering.
            </p>
          </div>

          {/* Headquarters card */}
          <div className="glass-panel rounded-2xl p-6 mb-8 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-primary mb-0.5">Headquarters — Ebrumede Temple</p>
              <ChurchAddressBlock variant="short" className="text-sm text-muted-foreground" showIcon />
              <p className="text-sm text-muted-foreground mt-1">
                Sunday Services · <span className="font-medium text-primary">8:00 AM WAT</span>
              </p>
            </div>
            <ChurchAddressBlock
              variant="inline"
              showIcon
              label="Get Directions"
              className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-primary/20 text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
            />
          </div>

          {/* Directory table */}
          <div className="glass-panel rounded-2xl overflow-hidden mb-8">
            {/* Table header */}
            <div className="hidden sm:grid grid-cols-12 gap-2 px-5 py-3 bg-primary/5 border-b border-border text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              <div className="col-span-1">#</div>
              <div className="col-span-5">Leader</div>
              <div className="col-span-3">Location</div>
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
                  transition={{ delay: Math.min(i * 0.03, 0.15) }}
                  className="grid grid-cols-12 gap-2 px-5 py-3.5 items-center hover:bg-accent/5 transition-colors"
                >
                  <div className="col-span-1 text-xs text-muted-foreground font-mono">{i + 1}</div>
                  <div className="col-span-11 sm:col-span-5 text-sm font-semibold text-primary leading-tight">{centre.name}</div>
                  <div className="col-start-2 col-span-11 sm:col-start-auto sm:col-span-3">
                    <span className="inline-block text-xs bg-primary/8 text-primary rounded-full px-2.5 py-0.5 font-medium">
                      {centre.location}
                    </span>
                  </div>
                  <div className="col-start-2 col-span-11 sm:col-start-auto sm:col-span-3 flex flex-col gap-0.5">
                    {centre.phone
                      ? <a href={`tel:${centre.phone.replace(/\s/g, "")}`} className="hover:text-accent transition-colors font-mono text-xs flex items-center gap-1"><Phone className="h-3 w-3 shrink-0" />{centre.phone}</a>
                      : <span className="text-xs text-muted-foreground/40 italic">—</span>
                    }
                    {centre.phone2 && (
                      <a href={`tel:${centre.phone2.replace(/\s/g, "")}`} className="hover:text-accent transition-colors font-mono text-xs flex items-center gap-1"><Phone className="h-3 w-3 shrink-0" />{centre.phone2}</a>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="px-5 py-3 border-t border-border bg-primary/3 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
              <span>{VIEWING_CENTRES.length} viewing centres across Nigeria and Cameroon</span>
              <a href="mailto:info@jctm.org.ng" className="flex items-center gap-1.5 text-accent hover:underline">
                <Mail className="h-3 w-3" /> Register a new centre
              </a>
            </div>
          </div>

          {/* CTA */}
          <div className="glass-panel rounded-2xl p-6 text-center">
            <p className="text-muted-foreground text-sm mb-1">Don't see your location listed?</p>
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

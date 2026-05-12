import { Layout } from "@/components/layout/Layout";
import { motion } from "framer-motion";
import { Cookie } from "lucide-react";
import { SEO } from "@/components/SEO";

const SECTIONS = [
  {
    title: "1. What Are Cookies?",
    content: `Cookies are small text files that are placed on your device (computer, smartphone, or tablet) when you visit a website. They help websites remember your preferences, keep you logged in, and understand how you use the site. Cookies cannot harm your device or execute programs.`,
  },
  {
    title: "2. How We Use Cookies",
    content: `The JCTM Digital Sanctuary uses cookies and similar technologies (such as localStorage and sessionStorage) for the following purposes:

• **Essential Cookies:** Required for the platform to function correctly. These include session tokens for member login, security tokens, and form submission state. You cannot opt out of essential cookies without disabling core platform functionality.

• **Analytics Cookies:** Used to understand how visitors interact with our platform — which pages are visited most, how long sessions last, and where traffic originates. This helps us improve the platform. These cookies do not identify you personally.

• **Advertising Cookies:** Served through Google AdSense (Publisher ID: ca-pub-9869546801865196). These cookies allow Google to serve ads that may be relevant to your interests based on your browsing history. Revenue from these ads supports JCTM's Temple TV broadcasts and digital ministry operations.

• **Preference Cookies:** Store your preferences such as language selection, cookie consent choices, and notification settings between sessions.`,
  },
  {
    title: "3. Third-Party Cookies",
    content: `Some features of the JCTM Digital Sanctuary involve third-party services that may set their own cookies:

• **Google AdSense & DoubleClick:** Advertising cookies from Google used to serve personalised ads. Learn more at https://policies.google.com/technologies/ads.
• **YouTube:** When you view embedded YouTube videos (Temple TV content), YouTube may set cookies to measure playback, engagement, and preferences.
• **Paystack & Stripe:** Payment processing cookies that help facilitate secure online giving transactions.
• **Google Fonts:** Cookies may be set when loading web fonts from Google's servers.

JCTM does not control or accept responsibility for cookies set by third-party services. Please review the privacy policies of each third-party service for details.`,
  },
  {
    title: "4. Google Consent Mode v2",
    content: `This platform implements Google Consent Mode v2. By default, all advertising and analytics consent signals are set to "denied" until you make an explicit choice through our Cookie Consent banner. This ensures full compliance with GDPR, CCPA, and Google's EU user consent policy.

When you accept advertising cookies, consent signals are updated to "granted" and Google AdSense may serve personalised ads. If you decline, non-personalised ads (based on page content rather than browsing history) may still be shown.`,
  },
  {
    title: "5. Your Cookie Choices",
    content: `You can manage your cookie preferences in the following ways:

• **Cookie Consent Banner:** Use the "Manage preferences" option in our cookie consent banner (shown on your first visit) to control which categories of cookies you accept.
• **Browser Settings:** You can configure your browser to block or delete cookies. Note that disabling essential cookies will affect platform functionality. Common browser cookie settings:
  – Chrome: Settings → Privacy and Security → Cookies
  – Firefox: Preferences → Privacy & Security → Cookies
  – Safari: Preferences → Privacy → Cookies
  – Edge: Settings → Privacy, search, and services → Cookies

• **Google Ad Settings:** Opt out of personalised advertising from Google at https://www.google.com/settings/ads.
• **Your Online Choices:** Opt out of interest-based advertising from multiple providers at https://www.youronlinechoices.eu (EU) or https://optout.aboutads.info (US).
• **Global Privacy Control (GPC):** We respect the GPC browser signal. If your browser sends a GPC header, advertising consent will automatically default to denied.`,
  },
  {
    title: "6. Cookie Retention Periods",
    content: `Different cookies have different lifespans:

• **Session cookies:** Expire when you close your browser.
• **Consent preference cookies:** Stored for 12 months so you don't need to re-confirm your choice on every visit.
• **Member authentication tokens:** Valid for your session; refreshed upon login.
• **Google AdSense cookies:** Vary by cookie type; typically 13 months. See Google's cookie policy for details.
• **Visitor analytics cookies:** Stored for up to 30 days.`,
  },
  {
    title: "7. Do Not Track (DNT)",
    content: `Some browsers offer a "Do Not Track" (DNT) signal. Currently, no universal standard exists for how websites should respond to DNT signals. We do not currently alter our data collection practices in response to DNT signals, but we do honour the Global Privacy Control (GPC) header as described in Section 5.`,
  },
  {
    title: "8. Changes to This Cookie Policy",
    content: `We may update this Cookie Policy from time to time as our use of cookies or applicable regulations change. Any significant updates will be communicated through an updated notice on this page and, where appropriate, through our Cookie Consent banner. Continued use of the JCTM Digital Sanctuary following any changes constitutes your acceptance of the updated policy.`,
  },
  {
    title: "9. Contact Us",
    content: `If you have any questions about how JCTM uses cookies or about your privacy rights, please contact us at info@jctm.org.ng or through the contact details available at jctm.org.ng/about.`,
  },
];

export default function Cookies() {
  return (
    <Layout>
      <SEO
        title="Cookie Policy — JCTM Digital Sanctuary"
        description="Cookie policy for the JCTM Digital Sanctuary — how Jesus Christ Temple Ministry uses cookies, Google AdSense, and third-party tracking technologies."
        path="/cookies"
        keywords="JCTM cookie policy, Jesus Christ Temple Ministry cookies, JCTM AdSense cookies"
      />
      <div className="container mx-auto px-4 py-16 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3 mb-3">
            <span className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 text-primary">
              <Cookie className="h-5 w-5" />
            </span>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Legal</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold font-serif text-primary mb-3">Cookie Policy</h1>
          <p className="text-muted-foreground mb-2 text-sm">Jesus Christ Temple Ministry (JCTM) · jctm.org.ng</p>
          <p className="text-muted-foreground text-sm mb-10">Last updated: May 2025</p>

          <div className="space-y-8">
            {SECTIONS.map((section, i) => (
              <motion.div
                key={section.title}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="rounded-2xl border border-border/60 bg-card/50 p-6"
              >
                <h2 className="font-semibold text-primary mb-3 text-base">{section.title}</h2>
                <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">
                  {section.content}
                </p>
              </motion.div>
            ))}
          </div>

          <p className="mt-10 text-xs text-muted-foreground text-center">
            For cookie-related enquiries, contact us at{" "}
            <a href="mailto:info@jctm.org.ng" className="underline hover:text-primary transition-colors">
              info@jctm.org.ng
            </a>
          </p>
        </motion.div>
      </div>
    </Layout>
  );
}

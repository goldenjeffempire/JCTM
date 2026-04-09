import { Layout } from "@/components/layout/Layout";
import { motion } from "framer-motion";
import { Shield } from "lucide-react";
import { SEO } from "@/components/SEO";

const SECTIONS = [
  {
    title: "1. Who We Are",
    content: `Jesus Christ Temple Ministry (JCTM), registered in Nigeria and operating under the domain of the JCTM Digital Sanctuary, is the data controller responsible for the information you provide through this platform. Our registered address is Warri, Delta State, Nigeria. For data-related enquiries, please contact us via our website.`,
  },
  {
    title: "2. What Information We Collect",
    content: `We collect information you provide directly to us, including:

• **Member Registration:** Full name, email address, phone number, and location when you join the Digital Sanctuary.
• **Giving Records:** Donor name, email address, currency, amount, giving category, and transaction reference when you make a financial contribution.
• **Testimony Submissions:** Name, email address (optional), testimony content, category, and any video URL you choose to share.
• **Communications:** Messages you send through TempleBots or our contact channels.
• **Technical Data:** IP address, browser type, device identifiers, and usage logs collected automatically for security and analytics purposes.`,
  },
  {
    title: "3. How We Use Your Information",
    content: `Your data is used solely for the following purposes:

• To process your financial gifts and issue confirmation receipts.
• To manage your Digital Sanctuary membership account.
• To review, moderate, and publish approved testimonies.
• To notify you of upcoming services, events, and ministry updates (with your consent).
• To maintain the security and integrity of the platform.
• To comply with applicable Nigerian and international legal obligations.

We do not sell, rent, or share your personal information with third parties for marketing purposes.`,
  },
  {
    title: "4. Security of Member Data",
    content: `We take the security of your data seriously. All data in transit is encrypted using industry-standard TLS/HTTPS protocols. Giving records and member profiles are stored in a secured, access-controlled PostgreSQL database. Financial transactions are processed through PCI-DSS compliant payment providers (Paystack for NGN, Stripe for USD) — JCTM does not store your card details at any time. Access to member data is restricted to authorised ministry administrators only.`,
  },
  {
    title: "5. Your Rights Under GDPR & NDPR",
    content: `Under the General Data Protection Regulation (GDPR) and Nigeria Data Protection Regulation (NDPR), you have the following rights:

• **Right of Access:** Request a copy of the personal data we hold about you.
• **Right to Rectification:** Request correction of inaccurate or incomplete data.
• **Right to Erasure:** Request deletion of your data where it is no longer necessary.
• **Right to Restriction:** Request that we limit how we use your data.
• **Right to Data Portability:** Receive your data in a structured, machine-readable format.
• **Right to Object:** Object to processing of your data for direct marketing.

To exercise any of these rights, please contact us. We will respond within 30 days in accordance with NDPR requirements.`,
  },
  {
    title: "6. Data Retention",
    content: `Giving records are retained for seven (7) years in compliance with Nigerian financial and tax regulations. Member profiles are retained for as long as your account is active. Testimonies are retained indefinitely for ministry archive purposes unless you request deletion. You may request account deletion at any time.`,
  },
  {
    title: "7. Cookies & Analytics",
    content: `This platform uses minimal session cookies required for authentication and form submissions. We do not use third-party advertising cookies. Basic usage analytics (page views, error logs) are collected server-side and are not shared with analytics providers.`,
  },
  {
    title: "8. Children's Privacy",
    content: `The JCTM Digital Sanctuary is not directed at children under the age of 13. We do not knowingly collect personal information from children. If you believe a child has provided us with personal information, please contact us immediately.`,
  },
  {
    title: "9. Changes to This Policy",
    content: `We may update this Privacy Policy from time to time to reflect changes in our practices or legal requirements. Any significant updates will be announced on the platform. Continued use of the Digital Sanctuary following any changes constitutes acceptance of the updated policy.`,
  },
  {
    title: "10. Contact Us",
    content: `For any privacy-related concerns, requests, or complaints, please reach out to the JCTM Digital Sanctuary administration team through our official website. You also have the right to lodge a complaint with the Nigeria Data Protection Commission (NDPC) if you believe your data rights have been violated.`,
  },
];

export default function Privacy() {
  return (
    <Layout>
      <SEO
        title="Privacy Policy — JCTM Digital Sanctuary"
        description="Read the privacy policy of Jesus Christ Temple Ministry (JCTM). Learn how we collect, use, and protect your data on the JCTM Digital Sanctuary platform."
        path="/privacy"
        keywords="JCTM privacy policy, Jesus Christ Temple Ministry data policy"
      />
      <div className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-accent" />
            </div>
            <span className="text-sm font-medium text-accent uppercase tracking-widest">Legal Document</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary mb-4">
            Privacy Policy
          </h1>
          <p className="text-muted-foreground mb-2">
            <strong>Jesus Christ Temple Ministry (JCTM)</strong> — JCTM Digital Sanctuary
          </p>
          <p className="text-sm text-muted-foreground mb-10">
            Last updated: January 1, 2025 &nbsp;|&nbsp; Effective date: January 1, 2025
          </p>

          <div className="glass-panel rounded-2xl p-6 mb-10 border border-accent/20">
            <p className="text-muted-foreground leading-relaxed">
              At JCTM, we are committed to protecting your privacy and handling your personal data with transparency, integrity, and care. This Privacy Policy explains what information we collect, how we use it, how we protect it, and your rights under applicable law — including the <strong>General Data Protection Regulation (GDPR)</strong> and the <strong>Nigeria Data Protection Regulation (NDPR)</strong>.
            </p>
          </div>

          <div className="space-y-8">
            {SECTIONS.map((section, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass-panel rounded-2xl p-6"
              >
                <h2 className="text-lg font-serif font-bold text-primary mb-3">{section.title}</h2>
                <div className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">
                  {section.content.split("\n").map((line, j) => {
                    if (line.startsWith("•")) {
                      const boldMatch = line.match(/^• \*\*(.+?):\*\* (.+)$/);
                      if (boldMatch) {
                        return (
                          <p key={j} className="pl-4 mb-1">
                            • <strong className="text-primary">{boldMatch[1]}:</strong> {boldMatch[2]}
                          </p>
                        );
                      }
                      return <p key={j} className="pl-4 mb-1">{line}</p>;
                    }
                    return line ? <p key={j} className="mb-2">{line}</p> : <br key={j} />;
                  })}
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} Jesus Christ Temple Ministry. All rights reserved.
            </p>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}

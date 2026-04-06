import { Layout } from "@/components/layout/Layout";
import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";

const SECTIONS = [
  {
    title: "1. Acceptance of Terms",
    content: `By accessing or using the JCTM Digital Sanctuary ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Platform. These terms apply to all visitors, members, givers, and any other users of the Digital Sanctuary.`,
  },
  {
    title: "2. Purpose of the Platform",
    content: `The JCTM Digital Sanctuary is a ministry-operated digital extension of Jesus Christ Temple Ministry, headquartered in Warri, Delta State, Nigeria. It serves as a space for spiritual edification, doctrinal instruction, testimony sharing, event announcements, and financial giving in support of the ministry's work. This Platform is not a social network, entertainment service, or commercial marketplace.`,
  },
  {
    title: "3. Membership & Registration",
    content: `To access certain features (testimony submission, giving history, member profile), you must register with accurate and truthful information. You are responsible for maintaining the confidentiality of your login credentials. You must notify us immediately of any unauthorised use of your account. You must be at least 18 years of age to register an account or make a financial contribution.`,
  },
  {
    title: "4. Rules of Engagement for Testimony Submissions",
    content: `The Testimony Vault is a sacred space for recording what God has done. All submissions are subject to the following rules:

• **Truth & Accuracy:** Only submit testimonies of genuine, first-hand experiences. False or fabricated testimonies are a serious offence before God and will be permanently removed.
• **Respectful Language:** All submissions must be written in a spirit of honour. Content containing profanity, disrespect toward Prophet Amos Evomobor, the ministry, or fellow believers will be rejected.
• **No Promotional Content:** Do not use testimony submissions to advertise products, services, other ministries, or personal businesses.
• **No Harmful Content:** Content that is defamatory, politically charged, sexually explicit, or promotes false doctrine will be refused and may result in account suspension.
• **Ministry Review:** All testimonies are reviewed by the JCTM editorial team before publication. We reserve the right to edit for clarity, publish in part, or decline any submission without explanation.
• **Copyright:** By submitting a testimony, you grant JCTM a non-exclusive, royalty-free licence to use, publish, and broadcast your testimony across all ministry platforms.`,
  },
  {
    title: "5. Giving & Financial Transactions",
    content: `All financial gifts made through the JCTM Digital Sanctuary are voluntary offerings in support of the ministry's work. By making a gift, you acknowledge the following:

• Gifts are non-refundable except where required by applicable law.
• JCTM does not guarantee specific outcomes or blessings in exchange for financial gifts.
• Transaction processing is handled by third-party providers (Paystack/Stripe); their terms and privacy policies also apply.
• JCTM will issue confirmation of all transactions to the email address provided.
• Funds are used exclusively for ministry operations, outreach, media production, and facility development.`,
  },
  {
    title: "6. TempleBots AI Assistant",
    content: `TempleBots is an AI-assisted ministry tool designed to answer questions about JCTM teachings, the Correction Mandate, and biblical doctrine. By using TempleBots, you acknowledge that:

• Responses are AI-generated and may not represent the definitive position of Prophet Amos Evomobor or JCTM leadership.
• TempleBots is not a substitute for pastoral counselling, prayer, or personal Bible study.
• Do not input personal financial or medical details into TempleBots.
• Abuse of TempleBots for inappropriate, offensive, or malicious purposes will result in account suspension.`,
  },
  {
    title: "7. Intellectual Property",
    content: `All sermon content, teachings, videos, written materials, and branding on the JCTM Digital Sanctuary are the intellectual property of Jesus Christ Temple Ministry and Prophet Amos Evomobor. You may not reproduce, redistribute, or sell any content from this Platform without express written permission from JCTM. Personal use and non-commercial sharing of ministry content for edification is encouraged.`,
  },
  {
    title: "8. Disclaimer of Warranties",
    content: `The JCTM Digital Sanctuary is provided "as is" without any warranties, express or implied. While we strive for maximum uptime and accuracy, JCTM does not guarantee that the Platform will be error-free, uninterrupted, or free from viruses. Use the Platform at your own discretion.`,
  },
  {
    title: "9. Limitation of Liability",
    content: `To the fullest extent permitted by law, JCTM shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Platform, including but not limited to loss of data, failed transactions, or reliance on AI-generated content.`,
  },
  {
    title: "10. Governing Law",
    content: `These Terms of Service are governed by and construed in accordance with the laws of the Federal Republic of Nigeria. Any disputes arising from these terms shall be subject to the exclusive jurisdiction of the courts of Delta State, Nigeria.`,
  },
  {
    title: "11. Changes to These Terms",
    content: `JCTM reserves the right to update these Terms of Service at any time. Continued use of the Platform following any changes constitutes acceptance of the revised terms. We will notify active members of material changes via email or an in-platform announcement.`,
  },
];

export default function Terms() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-accent" />
            </div>
            <span className="text-sm font-medium text-accent uppercase tracking-widest">Legal Document</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary mb-4">
            Terms of Service
          </h1>
          <p className="text-muted-foreground mb-2">
            <strong>Jesus Christ Temple Ministry (JCTM)</strong> — JCTM Digital Sanctuary
          </p>
          <p className="text-sm text-muted-foreground mb-10">
            Last updated: January 1, 2025 &nbsp;|&nbsp; Effective date: January 1, 2025
          </p>

          <div className="glass-panel rounded-2xl p-6 mb-10 border border-accent/20">
            <p className="text-muted-foreground leading-relaxed">
              Welcome to the <strong>JCTM Digital Sanctuary</strong> — a sacred digital extension of Jesus Christ Temple Ministry. These Terms of Service define the rules of engagement for this platform. Please read them carefully. Our commitment is to provide a holy, safe, and edifying digital space that honours the Lord Jesus Christ and upholds the standards of the Correction Mandate.
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
                <div className="text-muted-foreground text-sm leading-relaxed">
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

          <div className="mt-10 glass-panel rounded-2xl p-6 border border-accent/20 text-center">
            <p className="text-sm text-muted-foreground italic">
              "Let all things be done decently and in order." — 1 Corinthians 14:40
            </p>
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} Jesus Christ Temple Ministry. All rights reserved.
            </p>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}

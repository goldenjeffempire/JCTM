import { Link } from "wouter";
import { Facebook, Youtube, Mail, Video } from "lucide-react";
import { ChurchAddressBlock } from "@/components/ChurchAddressBlock";

const SOCIAL = [
  {
    label: "Facebook",
    href: "https://www.facebook.com/templetvjctm",
    icon: Facebook,
    color: "hover:text-[#1877F2]",
    bg: "hover:bg-[#1877F2]/10",
  },
  {
    label: "YouTube (Temple TV)",
    href: "https://www.youtube.com/templetvjctm",
    icon: Youtube,
    color: "hover:text-[#FF0000]",
    bg: "hover:bg-[#FF0000]/10",
  },
  {
    label: "Email",
    href: "mailto:info@jctm.org.ng",
    icon: Mail,
    color: "hover:text-[#003366]",
    bg: "hover:bg-[#003366]/10",
  },
];

const EMAILS = [
  { label: "General Enquiries", address: "info@jctm.org.ng" },
  { label: "Ministry Office", address: "jesuschristtempleministry@jctm.org.ng" },
  { label: "New Members", address: "joinus@jctm.org.ng" },
  { label: "Support", address: "support@jctm.org.ng" },
  { label: "Prophet Amos", address: "prophetamos@jctm.org.ng" },
];

export function SocialChips({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap gap-2.5 ${className}`}>
      {SOCIAL.map(({ label, href, icon: Icon, color, bg }) => (
        <a
          key={label}
          href={href}
          target={href.startsWith("mailto") ? undefined : "_blank"}
          rel="noopener noreferrer"
          aria-label={label}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-full border border-border/80 bg-background/60 text-sm font-medium text-muted-foreground hover:border-current ${color} ${bg} transition-all duration-200 elev-1 hover:elev-2`}
        >
          <Icon className="h-4 w-4" />
          <span className="hidden sm:inline">{label}</span>
        </a>
      ))}
    </div>
  );
}

function ColumnHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary/70 mb-4">
      {children}
    </h4>
  );
}

export function Footer() {
  return (
    <footer className="relative bg-gradient-to-b from-background to-secondary/40 border-t border-border/70 mt-auto">
      {/* Subtle top accent line */}
      <div
        aria-hidden
        className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent"
      />

      <div className="container mx-auto px-4 pt-16 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-12 text-primary">

          {/* Brand + Logo */}
          <div className="md:col-span-5">
            <div className="flex items-start gap-4 mb-6">
              <div className="relative shrink-0">
                <div
                  aria-hidden
                  className="absolute -inset-1 rounded-full bg-gradient-to-br from-accent/40 via-primary/20 to-transparent blur-sm"
                />
                <img
                  src="/jctm-logo-sm.jpeg"
                  alt="JCTM Official Logo"
                  className="relative h-16 w-16 rounded-full object-cover ring-1 ring-primary/15 elev-3"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="min-w-0">
                <h3 className="font-serif font-bold text-lg leading-tight tracking-tight">
                  Jesus Christ Temple Ministry
                </h3>
                <p className="text-xs text-muted-foreground mt-1 italic">
                  "The Land Of Good News"
                </p>
                <p className="text-[11px] text-accent font-semibold mt-1 tracking-wide">
                  The Bible Is Our Standard
                </p>
              </div>
            </div>
            <p className="text-muted-foreground leading-relaxed max-w-md text-sm">
              A digital sanctuary for the Correction Mandate. Led by Prophet Amos Evomobor,
              preaching primitive Christianity and total restoration from Warri, Nigeria.
            </p>

            {/* Social chips */}
            <div className="mt-7">
              <ColumnHeading>Connect</ColumnHeading>
              <SocialChips />
            </div>
          </div>

          {/* Location + Contact */}
          <div className="md:col-span-4">
            <ColumnHeading>Location</ColumnHeading>
            <ChurchAddressBlock
              className="text-muted-foreground text-sm leading-relaxed"
              showIcon
            />

            <div className="mt-7">
              <ColumnHeading>Contact</ColumnHeading>
              <ul className="space-y-2.5">
                {EMAILS.map(({ label, address }) => (
                  <li key={address}>
                    <a
                      href={`mailto:${address}`}
                      className="group flex flex-col text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60 group-hover:text-primary/60">
                        {label}
                      </span>
                      <span className="flex items-center gap-1.5 break-all">
                        <Mail className="h-3 w-3 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />
                        {address}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
                  Zoom Meeting ID
                </span>
                <a
                  href="https://zoom.us/j/4092099631"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <Video className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  4092099631
                </a>
              </div>
            </div>
          </div>

          {/* Quick Links + Legal */}
          <div className="md:col-span-3">
            <ColumnHeading>Explore</ColumnHeading>
            <div className="flex flex-col gap-2.5 text-sm text-muted-foreground">
              <Link href="/sermons" className="hover:text-primary transition-colors">Sermon Hub</Link>
              <Link href="/testimonies" className="hover:text-primary transition-colors">Testimony Vault</Link>
              <Link href="/events" className="hover:text-primary transition-colors">Events Calendar</Link>
              <Link href="/correction-timeline" className="hover:text-primary transition-colors">Correction Timeline</Link>
              <Link href="/give" className="hover:text-primary transition-colors">Give / Tithe</Link>
              <Link href="/join" className="hover:text-primary transition-colors">Join Members</Link>
              <Link href="/about" className="hover:text-primary transition-colors">About JCTM</Link>
            </div>

            <div className="mt-7">
              <ColumnHeading>Legal</ColumnHeading>
              <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                <Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
                <Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
                <Link href="/disclaimer" className="hover:text-primary transition-colors">Disclaimer</Link>
                <Link href="/cookies" className="hover:text-primary transition-colors">Cookie Policy</Link>
                <Link href="/contact" className="hover:text-primary transition-colors">Contact Us</Link>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-14 pt-6 border-t border-border/60 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p className="text-center md:text-left">
            &copy; {new Date().getFullYear()} Jesus Christ Temple Ministry. All rights reserved.
          </p>
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <a
              href="https://www.facebook.com/templetvjctm"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-[#1877F2] transition-colors"
            >
              <Facebook className="h-3.5 w-3.5" />
              facebook.com/templetvjctm
            </a>
            <span aria-hidden className="opacity-30">·</span>
            <a
              href="https://www.youtube.com/templetvjctm"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-[#FF0000] transition-colors"
            >
              <Youtube className="h-3.5 w-3.5" />
              youtube.com/templetvjctm
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

import { Link } from "wouter";
import { Facebook, Youtube, Mail, Video, Lock } from "lucide-react";
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
    <div className={`flex flex-wrap gap-3 ${className}`}>
      {SOCIAL.map(({ label, href, icon: Icon, color, bg }) => (
        <a
          key={label}
          href={href}
          target={href.startsWith("mailto") ? undefined : "_blank"}
          rel="noopener noreferrer"
          aria-label={label}
          className={`flex items-center gap-2 px-4 py-2 rounded-full border border-border text-sm font-medium text-muted-foreground ${color} ${bg} transition-all duration-200`}
        >
          <Icon className="h-4 w-4" />
          <span className="hidden sm:inline">{label}</span>
        </a>
      ))}
    </div>
  );
}

export function Footer() {
  return (
    <footer className="bg-background border-t border-border mt-auto pt-14 pb-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 text-primary">

          {/* Brand + Logo */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-4 mb-5">
              <img
                src="/jctm-logo-sm.jpeg"
                alt="JCTM Official Logo"
                className="h-20 w-20 rounded-full object-cover shadow-lg ring-4 ring-red-500/20"
                loading="lazy"
                decoding="async"
              />
              <div>
                <h3 className="font-serif font-bold text-xl leading-tight">Jesus Christ Temple Ministry</h3>
                <p className="text-xs text-muted-foreground mt-1 italic">"The Land Of Good News"</p>
                <p className="text-xs text-red-600 font-medium mt-0.5">The Bible Is Our Standard</p>
              </div>
            </div>
            <p className="text-muted-foreground leading-relaxed max-w-sm text-sm">
              A digital sanctuary for the Correction Mandate. Led by Prophet Amos Evomobor, preaching primitive Christianity and total restoration from Warri, Nigeria.
            </p>

            {/* Social chips */}
            <div className="mt-6">
              <h4 className="font-semibold text-sm mb-3 text-primary">Connect With Us</h4>
              <SocialChips />
            </div>
          </div>

          {/* Location */}
          <div>
            <h4 className="font-bold mb-4">Location</h4>
            <ChurchAddressBlock
              className="text-muted-foreground text-sm"
              showIcon
            />

            <div className="mt-6">
              <h4 className="font-bold mb-3">Contact</h4>
              <ul className="space-y-2">
                {EMAILS.map(({ label, address }) => (
                  <li key={address}>
                    <a
                      href={`mailto:${address}`}
                      className="group flex flex-col text-sm text-muted-foreground hover:text-[#003366] transition-colors"
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 group-hover:text-[#003366]/60">{label}</span>
                      <span className="flex items-center gap-1.5 break-all">
                        <Mail className="h-3 w-3 shrink-0" />
                        {address}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Zoom Meeting ID</span>
                <a
                  href="https://zoom.us/j/4092099631"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-[#003366] transition-colors"
                >
                  <Video className="h-3.5 w-3.5 shrink-0" />
                  4092099631
                </a>
              </div>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-bold mb-4">Quick Links</h4>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <Link href="/sermons" className="hover:text-accent transition-colors">Sermon Hub</Link>
              <Link href="/testimonies" className="hover:text-accent transition-colors">Testimony Vault</Link>
              <Link href="/events" className="hover:text-accent transition-colors">Events Calendar</Link>
              <Link href="/correction-timeline" className="hover:text-accent transition-colors">Correction Timeline</Link>
              <Link href="/give" className="hover:text-accent transition-colors">Give / Tithe</Link>
              <Link href="/join" className="hover:text-accent transition-colors">Join Members</Link>
              <Link href="/about" className="hover:text-accent transition-colors">About JCTM</Link>
            </div>

            <h4 className="font-bold mt-6 mb-3">Legal</h4>
            <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
              <Link href="/privacy" className="hover:text-accent transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-accent transition-colors">Terms of Service</Link>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-6 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Jesus Christ Temple Ministry. All rights reserved.</p>
          <div className="flex items-center gap-3 text-xs flex-wrap justify-center">
            <div className="flex items-center gap-2">
              <Facebook className="h-3.5 w-3.5" />
              <a href="https://www.facebook.com/templetvjctm" target="_blank" rel="noopener noreferrer" className="hover:text-[#1877F2] transition-colors">
                facebook.com/templetvjctm
              </a>
            </div>
            <span className="opacity-30">·</span>
            <div className="flex items-center gap-2">
              <Youtube className="h-3.5 w-3.5" />
              <a href="https://www.youtube.com/templetvjctm" target="_blank" rel="noopener noreferrer" className="hover:text-[#FF0000] transition-colors">
                youtube.com/templetvjctm
              </a>
            </div>
            <span className="opacity-30">·</span>
            <Link
              href="/admin/broadcast"
              className="flex items-center gap-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors select-none"
              title="Admin dashboard"
            >
              <Lock className="h-3 w-3" />
              <span>Admin</span>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

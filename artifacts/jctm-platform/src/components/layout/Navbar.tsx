import { Link, useLocation } from "wouter";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/sermons", label: "Sermons" },
  { href: "/testimonies", label: "Testimonies" },
  { href: "/correction-timeline", label: "Timeline" },
  { href: "/events", label: "Events" },
  { href: "/give", label: "Give" },
  { href: "/join", label: "Join" },
  { href: "/about", label: "About" },
];

export function Navbar() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 w-full glass-panel border-b">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/">
          <div className="flex items-center gap-3 cursor-pointer group">
            <img
              src="/jctm-logo.jpeg"
              alt="JCTM — Jesus Christ Temple Ministry"
              className="h-10 w-10 rounded-full object-cover shadow ring-2 ring-red-500/30 group-hover:ring-red-500/60 transition-all duration-200"
            />
            <div className="hidden sm:flex flex-col leading-tight">
              <span className="font-serif font-bold text-primary text-sm leading-tight">Jesus Christ Temple Ministry</span>
              <span className="text-[10px] font-medium text-muted-foreground tracking-wide">The Land Of Good News</span>
            </div>
            <span className="sm:hidden font-serif font-bold text-primary text-lg">JCTM</span>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-6">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <div className={`text-sm font-medium transition-colors hover:text-accent cursor-pointer ${location === item.href ? "text-accent" : "text-primary"}`}>
                {item.label}
              </div>
            </Link>
          ))}
        </div>

        <div className="md:hidden">
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? <X className="h-6 w-6 text-primary" /> : <Menu className="h-6 w-6 text-primary" />}
          </Button>
        </div>
      </div>

      {isOpen && (
        <div className="md:hidden glass-panel border-b">
          <div className="flex flex-col px-4 py-4 space-y-4">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <div
                  className={`text-sm font-medium transition-colors hover:text-accent cursor-pointer ${location === item.href ? "text-accent" : "text-primary"}`}
                  onClick={() => setIsOpen(false)}
                >
                  {item.label}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}

import { Link, useLocation } from "wouter";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/sermons", label: "Sermons" },
  { href: "/testimonies", label: "Testimonies" },
  { href: "/give", label: "Give" },
  { href: "/events", label: "Events" },
  { href: "/members", label: "Members" },
  { href: "/correction-timeline", label: "Timeline" },
  { href: "/about", label: "About" },
];

export function Navbar() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 w-full glass-panel border-b">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/">
          <div className="font-serif font-bold text-xl text-primary cursor-pointer flex items-center gap-2">
            JCTM <span className="text-sm font-sans font-medium text-muted-foreground hidden sm:inline-block">| Digital Sanctuary</span>
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

      {/* Mobile Nav */}
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

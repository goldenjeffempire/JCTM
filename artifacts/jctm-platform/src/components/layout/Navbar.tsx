import { Link, useLocation } from "wouter";
import { Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
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
  const [scrolled, setScrolled] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      setScrollY(y);
      setScrolled(y > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navHeight = scrolled ? "h-12" : "h-16";
  const bgOpacity = Math.min(scrollY / 100, 1);

  return (
    <motion.nav
      animate={{ y: 0 }}
      className={`sticky top-0 z-50 w-full border-b transition-all duration-500 ${navHeight}`}
      style={{
        background: `rgba(255, 254, 248, ${0.7 + bgOpacity * 0.25})`,
        backdropFilter: `blur(${12 + bgOpacity * 8}px)`,
        WebkitBackdropFilter: `blur(${12 + bgOpacity * 8}px)`,
        borderColor: `rgba(0, 51, 102, ${0.06 + bgOpacity * 0.06})`,
        boxShadow: scrolled ? `0 1px 20px rgba(0, 51, 102, ${0.06 + bgOpacity * 0.06})` : "none",
      }}
    >
      <div className={`container mx-auto px-4 ${navHeight} flex items-center justify-between transition-all duration-500`}>
        <Link href="/">
          <div className="flex items-center gap-3 cursor-pointer group">
            <motion.img
              src="/jctm-logo.jpeg"
              alt="JCTM — Jesus Christ Temple Ministry"
              animate={{ height: scrolled ? 32 : 40, width: scrolled ? 32 : 40 }}
              transition={{ duration: 0.3 }}
              className="rounded-full object-cover shadow ring-2 ring-primary/20 group-hover:ring-primary/50 transition-all duration-200"
            />
            <div className="hidden sm:flex flex-col leading-tight">
              <motion.span
                animate={{ fontSize: scrolled ? "0.75rem" : "0.875rem" }}
                className="font-serif font-bold text-primary leading-tight transition-all"
              >
                Jesus Christ Temple Ministry
              </motion.span>
              <span className="text-[10px] font-medium text-muted-foreground tracking-wide">The Land Of Good News</span>
            </div>
            <span className="sm:hidden font-serif font-bold text-primary text-lg">JCTM</span>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-6">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <div className={`relative text-sm font-medium transition-colors hover:text-accent cursor-pointer py-1 ${location === item.href ? "text-accent" : "text-primary/80"}`}>
                {item.label}
                {location === item.href && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-accent rounded-full"
                  />
                )}
              </div>
            </Link>
          ))}
        </div>

        <div className="md:hidden">
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(!isOpen)} className="text-primary">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={isOpen ? "close" : "open"}
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </motion.div>
            </AnimatePresence>
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden overflow-hidden"
            style={{
              background: "rgba(255, 254, 248, 0.97)",
              backdropFilter: "blur(20px)",
              borderBottom: "1px solid rgba(0, 51, 102, 0.08)",
            }}
          >
            <div className="flex flex-col px-4 py-4 space-y-1">
              {navItems.map((item, i) => (
                <motion.div
                  key={item.href}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Link href={item.href}>
                    <div
                      className={`text-sm font-medium transition-colors hover:text-accent cursor-pointer py-3 px-3 rounded-lg ${
                        location === item.href
                          ? "text-accent bg-accent/5"
                          : "text-primary hover:bg-primary/5"
                      }`}
                      onClick={() => setIsOpen(false)}
                    >
                      {item.label}
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}

import { Link, useLocation } from "wouter";
import { Menu, X, Moon, Sun } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/sermons", label: "Sermons" },
  { href: "/testimonies", label: "Testimonies" },
  { href: "/correction-timeline", label: "Timeline" },
  { href: "/events", label: "Events" },
  { href: "/crusade", label: "🔥 Crusade", highlight: true },
  { href: "/give", label: "Give" },
  { href: "/prayer", label: "✦ Prayer", prayerHighlight: true },
  { href: "/join", label: "Join" },
  { href: "/about", label: "About" },
];

export function Navbar() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const { theme, toggle, isDark } = useTheme();

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

  const navBg = isDark
    ? `rgba(0, 10, 26, ${0.75 + bgOpacity * 0.2})`
    : `rgba(255, 254, 248, ${0.7 + bgOpacity * 0.25})`;
  const navBorderColor = isDark
    ? `rgba(56, 189, 248, ${0.08 + bgOpacity * 0.06})`
    : `rgba(0, 51, 102, ${0.06 + bgOpacity * 0.06})`;

  return (
    <motion.nav
      animate={{ y: 0 }}
      className={`sticky top-0 z-50 w-full border-b transition-all duration-500 ${navHeight}`}
      style={{
        background: navBg,
        backdropFilter: `blur(${12 + bgOpacity * 8}px)`,
        WebkitBackdropFilter: `blur(${12 + bgOpacity * 8}px)`,
        borderColor: navBorderColor,
        boxShadow: scrolled
          ? isDark
            ? `0 1px 20px rgba(0, 0, 0, ${0.2 + bgOpacity * 0.1})`
            : `0 1px 20px rgba(0, 51, 102, ${0.06 + bgOpacity * 0.06})`
          : "none",
      }}
    >
      <div className={`container mx-auto px-4 ${navHeight} flex items-center justify-between transition-all duration-500`}>
        <Link href="/">
          <div className="flex items-center gap-3 cursor-pointer group">
            <motion.img
              src="/jctm-logo-sm.jpeg"
              alt="JCTM — Jesus Christ Temple Ministry"
              animate={{ height: scrolled ? 32 : 40, width: scrolled ? 32 : 40 }}
              transition={{ duration: 0.3 }}
              className="rounded-full object-cover shadow ring-2 ring-primary/20 group-hover:ring-primary/50 transition-all duration-200"
              decoding="async"
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

        <div className="hidden md:flex items-center gap-5">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.highlight ? (
                <div
                  className="relative text-sm font-bold cursor-pointer px-3 py-1 rounded-full transition-all"
                  style={{
                    background: location === item.href ? "#D4A017" : "rgba(212,160,23,0.12)",
                    color: location === item.href ? "#0a1a4a" : "#D4A017",
                    border: "1px solid rgba(212,160,23,0.4)",
                  }}
                >
                  {item.label}
                </div>
              ) : item.prayerHighlight ? (
                <div
                  className="relative text-sm font-semibold cursor-pointer px-3 py-1 rounded-full transition-all"
                  style={{
                    background: location === item.href
                      ? "rgba(56,189,248,0.25)"
                      : "rgba(56,189,248,0.08)",
                    color: location === item.href ? "hsl(var(--accent))" : "hsl(var(--accent))",
                    border: "1px solid rgba(56,189,248,0.3)",
                  }}
                >
                  {item.label}
                </div>
              ) : (
                <div className={`relative text-sm font-medium transition-colors hover:text-accent cursor-pointer py-1 ${location === item.href ? "text-accent" : "text-primary/80"}`}>
                  {item.label}
                  {location === item.href && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-accent rounded-full"
                    />
                  )}
                </div>
              )}
            </Link>
          ))}

          <motion.button
            onClick={toggle}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label={isDark ? "Switch to Ivory Sanctuary (light)" : "Switch to Midnight Mandate (dark)"}
            className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all duration-300 cursor-pointer"
            style={{
              background: isDark
                ? "rgba(56,189,248,0.12)"
                : "rgba(0,51,102,0.06)",
              borderColor: isDark
                ? "rgba(56,189,248,0.3)"
                : "rgba(0,51,102,0.15)",
              color: isDark ? "hsl(var(--accent))" : "hsl(var(--primary))",
            }}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={theme}
                initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.2 }}
                className="flex items-center"
              >
                {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              </motion.span>
            </AnimatePresence>
            <span className="hidden lg:inline">{isDark ? "Ivory" : "Midnight"}</span>
          </motion.button>
        </div>

        <div className="md:hidden flex items-center gap-2">
          <motion.button
            onClick={toggle}
            whileTap={{ scale: 0.9 }}
            aria-label="Toggle theme"
            className="p-2 rounded-full border transition-all cursor-pointer"
            style={{
              background: isDark ? "rgba(56,189,248,0.1)" : "rgba(0,51,102,0.05)",
              borderColor: isDark ? "rgba(56,189,248,0.25)" : "rgba(0,51,102,0.12)",
            }}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={theme}
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex"
              >
                {isDark
                  ? <Sun className="h-4 w-4 text-accent" />
                  : <Moon className="h-4 w-4 text-primary" />
                }
              </motion.span>
            </AnimatePresence>
          </motion.button>

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
              background: isDark ? "rgba(0, 10, 26, 0.97)" : "rgba(255, 254, 248, 0.97)",
              backdropFilter: "blur(20px)",
              borderBottom: isDark ? "1px solid rgba(56,189,248,0.1)" : "1px solid rgba(0, 51, 102, 0.08)",
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
                      className={`text-sm font-medium transition-colors cursor-pointer py-3 px-3 rounded-lg ${
                        item.highlight
                          ? "font-bold"
                          : item.prayerHighlight
                          ? "font-semibold"
                          : location === item.href
                          ? "text-accent bg-accent/5"
                          : "text-primary hover:text-accent hover:bg-primary/5"
                      }`}
                      style={
                        item.highlight
                          ? { color: "#D4A017", background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.3)" }
                          : item.prayerHighlight
                          ? { color: "hsl(var(--accent))", background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.25)" }
                          : undefined
                      }
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

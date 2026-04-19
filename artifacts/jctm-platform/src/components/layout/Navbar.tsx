import { Link, useLocation } from "wouter";
import { Menu, X, Moon, Sun, ChevronDown, Bell, BellOff } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSelector } from "@/components/LanguageSelector";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function usePushNotifications() {
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      setSupported(true);
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          setSubscribed(!!sub);
        }).catch(() => {});
      }).catch(() => {});
    }
  }, []);

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = "=".repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  };

  const subscribe = async () => {
    if (!supported || loading) return;
    setLoading(true);
    try {
      const keyRes = await fetch(`${BASE}/api/push/vapid-key`);
      const { publicKey } = await keyRes.json();
      const reg = await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Notification permission denied");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const subJson = sub.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };
      await fetch(`${BASE}/api/push/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subJson, deviceType: "web" }),
      });
      setSubscribed(true);
      toast.success("Holy Spirit Sunday Service — Live alerts enabled!");
    } catch (err) {
      toast.error("Failed to enable notifications");
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch(`${BASE}/api/push/unsubscribe`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast.success("Notifications disabled");
    } catch {
      toast.error("Failed to unsubscribe");
    } finally {
      setLoading(false);
    }
  };

  return { subscribed, loading, supported, subscribe, unsubscribe };
}

export function Navbar() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const { subscribed, loading: pushLoading, supported: pushSupported, subscribe, unsubscribe } = usePushNotifications();
  const [scrolled, setScrolled] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [openDropdown, setOpenDropdown] = useState<"resources" | "about" | null>(null);
  const { theme, toggle, isDark } = useTheme();
  const { t } = useLanguage();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      setScrollY(y);
      setScrolled(y > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navHeight = scrolled ? "h-12" : "h-16";
  const bgOpacity = Math.min(scrollY / 100, 1);

  const navBg = isDark
    ? `rgba(0, 10, 26, ${0.75 + bgOpacity * 0.2})`
    : `rgba(255, 254, 248, ${0.7 + bgOpacity * 0.25})`;
  const navBorderColor = isDark
    ? `rgba(56, 189, 248, ${0.08 + bgOpacity * 0.06})`
    : `rgba(0, 51, 102, ${0.06 + bgOpacity * 0.06})`;

  const toggle_dropdown = (name: "resources" | "about") => {
    setOpenDropdown(prev => prev === name ? null : name);
  };

  // Derived: does current path belong to a dropdown?
  const resourcesHrefs = ["/testimonies", "/events", "/give", "/scripture-study", "/spiritual-insight", "/gallery"];
  const aboutHrefs = ["/about", "/leadership", "/sermon-assistant"];
  const resourcesActive = resourcesHrefs.includes(location);
  const aboutActive = aboutHrefs.includes(location);

  // ── Nav data (re-evaluated every render so t() picks up language changes) ─
  const flatNavItems = [
    { href: "/", label: t("Home") },
    { href: "/sermons", label: t("Sermons") },
    { href: "/moments", label: `🎬 ${t("Moments")}`, momentsHighlight: true },
    { href: "/intro-videos", label: `📖 ${t("Intro")}`, momentsHighlight: true },
    { href: "/crusade", label: `🔥 ${t("Crusade")}`, highlight: true },
    { href: "/prayer", label: `✦ ${t("Prayer")}`, prayerHighlight: true },
  ];

  const resourcesItems = [
    { href: "/topics", label: t("Bible Topics"), description: t("8 in-depth teaching topic clusters") },
    { href: "/blog", label: `📝 ${t("Ministry Blog")}`, description: t("Theological insights & reflections") },
    { href: "/gallery", label: `📷 ${t("Gallery")}`, description: t("Ministry photos & service memories") },
    { href: "/scripture-study", label: `📖 ${t("Scripture Study")}`, description: t("Deep AI exegetical Bible analysis"), aiHighlight: true },
    { href: "/spiritual-insight", label: `✦ ${t("Spiritual Insight")}`, description: t("Personalized prophetic guidance"), aiHighlight: true },
    { href: "/testimonies", label: t("Testimonies"), description: t("Stories of God's faithfulness") },
    { href: "/events", label: t("Events"), description: t("Upcoming services & programmes") },
    { href: "/give", label: t("Give"), description: t("Support the Correction Mandate") },
  ];

  const aboutItems = [
    { href: "/about", label: t("About JCTM"), description: t("Our mission and history") },
    { href: "/leadership", label: t("Leadership"), description: t("Prophet Amos & ministry team") },
    { href: "/sermon-assistant", label: `🤖 ${t("Ask AI")}`, description: t("Chat with our sermon AI"), aiHighlight: true },
    { href: "https://whatsapp.com/channel/0029Vb8HxkvEQIaf1Z86gX0x", label: `💬 ${t("WhatsApp Channel")}`, description: t("Follow us on WhatsApp"), isExternal: true, whatsappHighlight: true },
  ];

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
      <div ref={dropdownRef} className={`container mx-auto px-4 ${navHeight} flex items-center justify-between transition-all duration-500`}>
        {/* Logo */}
        <Link href="/">
          <div className="flex items-center gap-3 cursor-pointer group">
            <motion.img
              src="/jctm-logo-sm.jpeg"
              alt="JCTM"
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

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-5">
          {flatNavItems.map((item) => (
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
                    background: location === item.href ? "rgba(56,189,248,0.25)" : "rgba(56,189,248,0.08)",
                    color: "hsl(var(--accent))",
                    border: "1px solid rgba(56,189,248,0.3)",
                  }}
                >
                  {item.label}
                </div>
              ) : item.momentsHighlight ? (
                <div
                  className="relative text-sm font-semibold cursor-pointer px-3 py-1 rounded-full transition-all"
                  style={{
                    background: location === item.href ? "rgba(239,68,68,0.2)" : "rgba(239,68,68,0.08)",
                    color: "#ef4444",
                    border: "1px solid rgba(239,68,68,0.3)",
                  }}
                >
                  {item.label}
                </div>
              ) : (
                <div className={`relative text-sm font-medium transition-colors hover:text-accent cursor-pointer py-1 ${location === item.href ? "text-accent" : "text-primary/80"}`}>
                  {item.label}
                  {location === item.href && (
                    <motion.div layoutId="nav-indicator" className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-accent rounded-full" />
                  )}
                </div>
              )}
            </Link>
          ))}

          {/* Resources dropdown */}
          <div className="relative">
            <button
              onClick={() => toggle_dropdown("resources")}
              className={`flex items-center gap-1 text-sm font-medium transition-colors hover:text-accent cursor-pointer py-1 relative ${resourcesActive || openDropdown === "resources" ? "text-accent" : "text-primary/80"}`}
            >
              {t("Resources")}
              <motion.span animate={{ rotate: openDropdown === "resources" ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown className="w-3.5 h-3.5" />
              </motion.span>
              {resourcesActive && <motion.div layoutId="nav-indicator" className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-accent rounded-full" />}
            </button>
            <DropdownPanel items={resourcesItems} isActive={openDropdown === "resources"} isDark={isDark} onClose={() => setOpenDropdown(null)} location={location} />
          </div>

          {/* About dropdown */}
          <div className="relative">
            <button
              onClick={() => toggle_dropdown("about")}
              className={`flex items-center gap-1 text-sm font-medium transition-colors hover:text-accent cursor-pointer py-1 relative ${aboutActive || openDropdown === "about" ? "text-accent" : "text-primary/80"}`}
            >
              {t("About")}
              <motion.span animate={{ rotate: openDropdown === "about" ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown className="w-3.5 h-3.5" />
              </motion.span>
              {aboutActive && <motion.div layoutId="nav-indicator" className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-accent rounded-full" />}
            </button>
            <DropdownPanel items={aboutItems} isActive={openDropdown === "about"} isDark={isDark} onClose={() => setOpenDropdown(null)} location={location} />
          </div>

          <LanguageSelector />

          {/* Push notification bell */}
          {pushSupported && (
            <motion.button
              onClick={subscribed ? unsubscribe : subscribe}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              disabled={pushLoading}
              aria-label={subscribed ? "Unsubscribe from Holy Spirit Sunday Service — Live alerts" : "Subscribe to Holy Spirit Sunday Service — Live alerts"}
              title={subscribed ? "Click to disable live alerts" : "Get notified when the Holy Spirit Sunday Service is live"}
              className="flex items-center justify-center w-8 h-8 rounded-full border transition-all duration-300 cursor-pointer disabled:opacity-50"
              style={{
                background: subscribed
                  ? "rgba(56,189,248,0.18)"
                  : isDark ? "rgba(56,189,248,0.08)" : "rgba(0,51,102,0.06)",
                borderColor: subscribed
                  ? "rgba(56,189,248,0.5)"
                  : isDark ? "rgba(56,189,248,0.2)" : "rgba(0,51,102,0.12)",
                color: subscribed ? "hsl(var(--accent))" : isDark ? "hsl(var(--muted-foreground))" : "hsl(var(--primary))",
              }}
            >
              {subscribed ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
            </motion.button>
          )}

          {/* Theme toggle — icon only */}
          <motion.button
            onClick={toggle}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className="flex items-center justify-center w-8 h-8 rounded-full border transition-all duration-300 cursor-pointer"
            style={{
              background: isDark ? "rgba(56,189,248,0.12)" : "rgba(0,51,102,0.06)",
              borderColor: isDark ? "rgba(56,189,248,0.3)" : "rgba(0,51,102,0.15)",
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
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </div>

        {/* Mobile controls */}
        <div className="md:hidden flex items-center gap-2">
          <motion.button
            onClick={toggle}
            whileTap={{ scale: 0.9 }}
            aria-label="Toggle theme"
            className="w-8 h-8 flex items-center justify-center rounded-full border transition-all cursor-pointer"
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
                {isDark ? <Sun className="h-4 w-4 text-accent" /> : <Moon className="h-4 w-4 text-primary" />}
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

      {/* Mobile menu */}
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
              {flatNavItems.map((item, i) => (
                <motion.div key={item.href} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                  <Link href={item.href}>
                    <div
                      className="text-sm font-medium transition-colors cursor-pointer py-3 px-3 rounded-lg"
                      style={
                        item.highlight
                          ? { color: "#D4A017", background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.3)", fontWeight: 700 }
                          : item.prayerHighlight
                          ? { color: "hsl(var(--accent))", background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.25)" }
                          : item.momentsHighlight
                          ? { color: "#ef4444", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }
                          : location === item.href
                          ? { color: "hsl(var(--accent))", background: "rgba(56,189,248,0.05)" }
                          : { color: "hsl(var(--primary))" }
                      }
                      onClick={() => setIsOpen(false)}
                    >
                      {item.label}
                    </div>
                  </Link>
                </motion.div>
              ))}

              {/* Mobile Resources */}
              <div className="pt-2 border-t border-border/40">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold px-3 pb-1">{t("Resources")}</p>
                {resourcesItems.map((item, i) => (
                  <motion.div key={item.href} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: (flatNavItems.length + i) * 0.04 }}>
                    <Link href={item.href}>
                      <div
                        className="text-sm font-medium cursor-pointer py-2.5 px-3 rounded-lg transition-colors"
                        style={location === item.href ? { color: "hsl(var(--accent))", background: "rgba(56,189,248,0.05)" } : { color: "hsl(var(--primary))" }}
                        onClick={() => setIsOpen(false)}
                      >
                        {item.label}
                        <span className="block text-[11px] text-muted-foreground">{item.description}</span>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>

              {/* Mobile About */}
              <div className="pt-2 border-t border-border/40">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold px-3 pb-1">{t("About")}</p>
                {aboutItems.map((item, i) => (
                  <motion.div key={item.href} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: (flatNavItems.length + resourcesItems.length + i) * 0.04 }}>
                    {item.isExternal ? (
                      <a href={item.href} target="_blank" rel="noopener noreferrer">
                        <div
                          className="text-sm font-medium cursor-pointer py-2.5 px-3 rounded-lg transition-colors"
                          style={{ color: "#25D366" }}
                          onClick={() => setIsOpen(false)}
                        >
                          {item.label}
                          <span className="block text-[11px] text-muted-foreground">{item.description}</span>
                        </div>
                      </a>
                    ) : (
                      <Link href={item.href}>
                        <div
                          className="text-sm font-medium cursor-pointer py-2.5 px-3 rounded-lg transition-colors"
                          style={
                            item.aiHighlight
                              ? { color: "#8b5cf6" }
                              : location === item.href
                              ? { color: "hsl(var(--accent))", background: "rgba(56,189,248,0.05)" }
                              : { color: "hsl(var(--primary))" }
                          }
                          onClick={() => setIsOpen(false)}
                        >
                          {item.label}
                          <span className="block text-[11px] text-muted-foreground">{item.description}</span>
                        </div>
                      </Link>
                    )}
                  </motion.div>
                ))}
              </div>

              <div className="pt-2">
                <LanguageSelector />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}

// ── Dropdown panel ────────────────────────────────────────────────────────────
interface DropdownPanelProps {
  items: { href: string; label: string; description: string; aiHighlight?: boolean; isExternal?: boolean; whatsappHighlight?: boolean }[];
  isActive: boolean;
  isDark: boolean;
  onClose: () => void;
  location: string;
}

function DropdownPanel({ items, isActive, isDark, onClose, location }: DropdownPanelProps) {
  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0, y: -6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.97 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-56 rounded-2xl border shadow-xl overflow-hidden z-50"
          style={{
            background: isDark ? "rgba(0,10,26,0.97)" : "rgba(255,254,248,0.98)",
            backdropFilter: "blur(20px)",
            borderColor: isDark ? "rgba(56,189,248,0.15)" : "rgba(0,51,102,0.1)",
          }}
        >
          <div className="py-2">
            {items.map((item) =>
              item.isExternal ? (
                <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer">
                  <div
                    onClick={onClose}
                    className="flex flex-col px-4 py-2.5 cursor-pointer transition-colors hover:bg-accent/5"
                  >
                    <span className={`text-sm font-semibold ${item.whatsappHighlight ? "text-[#25D366]" : "text-primary"}`}>
                      {item.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground mt-0.5">{item.description}</span>
                  </div>
                </a>
              ) : (
                <Link key={item.href} href={item.href}>
                  <div
                    onClick={onClose}
                    className={`flex flex-col px-4 py-2.5 cursor-pointer transition-colors hover:bg-accent/5 ${location === item.href ? "bg-accent/10" : ""}`}
                  >
                    <span className={`text-sm font-semibold ${item.aiHighlight ? "text-purple-500" : location === item.href ? "text-accent" : "text-primary"}`}>
                      {item.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground mt-0.5">{item.description}</span>
                  </div>
                </Link>
              )
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

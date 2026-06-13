import { Link, useLocation } from "wouter";
import {
  Menu, X, Moon, Sun, ChevronDown, Bell, BellOff,
} from "lucide-react";
import {
  useState, useEffect, useRef, useCallback, KeyboardEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSelector } from "@/components/LanguageSelector";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Types ─────────────────────────────────────────────────────────────────────
interface FlatNavItem {
  href: string;
  label: string;
  highlight?: boolean;
  featurePill?: boolean;
}

interface DropdownItem {
  href: string;
  label: string;
  description: string;
  aiHighlight?: boolean;
  isExternal?: boolean;
  whatsappHighlight?: boolean;
}

// ── Push-notification hook ─────────────────────────────────────────────────────
function usePushNotifications() {
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      setSupported(true);
      navigator.serviceWorker.ready
        .then(reg => reg.pushManager.getSubscription().then(sub => setSubscribed(!!sub)).catch(() => {}))
        .catch(() => {});
    }
  }, []);

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
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
      if (permission !== "granted") { toast.error("Notification permission denied"); return; }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const subJson = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await fetch(`${BASE}/api/push/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subJson, deviceType: "web" }),
      });
      setSubscribed(true);
      toast.success("Temple TV live alerts enabled!");
    } catch {
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

// ── Main Navbar ───────────────────────────────────────────────────────────────
export function Navbar() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<"resources" | "about" | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  const { subscribed, loading: pushLoading, supported: pushSupported, subscribe, unsubscribe } = usePushNotifications();
  const { theme, toggle, isDark } = useTheme();
  const { t } = useLanguage();

  const navRef = useRef<HTMLElement>(null);
  const resourcesBtnRef = useRef<HTMLButtonElement>(null);
  const aboutBtnRef = useRef<HTMLButtonElement>(null);

  // ── Scroll state ──────────────────────────────────────────────────────────
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrollY(y);
      setScrolled(y > 20);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── Close mobile menu on route change ────────────────────────────────────
  useEffect(() => {
    setMobileOpen(false);
    setOpenDropdown(null);
  }, [location]);

  // ── Lock body scroll when mobile drawer is open ───────────────────────────
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  // ── Click-outside / touch-outside closes dropdowns ───────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, []);

  // ── Escape key closes dropdowns / mobile menu ─────────────────────────────
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        if (openDropdown) {
          setOpenDropdown(null);
          (openDropdown === "resources" ? resourcesBtnRef : aboutBtnRef).current?.focus();
        } else if (mobileOpen) {
          setMobileOpen(false);
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openDropdown, mobileOpen]);

  // ── Visual tokens ─────────────────────────────────────────────────────────
  const bgOpacity = Math.min(scrollY / 100, 1);
  const navBg = isDark
    ? `rgba(0,10,26,${0.75 + bgOpacity * 0.2})`
    : `rgba(255,254,248,${0.7 + bgOpacity * 0.25})`;
  const navBorderColor = isDark
    ? `rgba(56,189,248,${0.08 + bgOpacity * 0.06})`
    : `rgba(0,51,102,${0.06 + bgOpacity * 0.06})`;
  const navBlur = `blur(${12 + bgOpacity * 8}px)`;

  const toggleDropdown = useCallback((name: "resources" | "about") => {
    setOpenDropdown(prev => prev === name ? null : name);
  }, []);

  // ── Nav data ──────────────────────────────────────────────────────────────
  const resourcesHrefs = ["/testimonies", "/events", "/give", "/scripture-study", "/spiritual-insight", "/gallery", "/crusade", "/topics", "/blog"];
  const aboutHrefs = ["/about", "/leadership", "/sermon-assistant"];
  const resourcesActive = resourcesHrefs.includes(location);
  const aboutActive = aboutHrefs.includes(location);

  const flatNavItems: FlatNavItem[] = [
    { href: "/", label: t("Home") },
    { href: "/sermons", label: t("Sermons") },
    { href: "/moments", label: t("Moments"), featurePill: true },
    { href: "/intro-videos", label: t("Intro"), featurePill: true },
    { href: "/viewing-centres", label: t("Viewing Center") },
    { href: "/prayer", label: t("Prayer"), featurePill: true },
  ];

  const resourcesItems: DropdownItem[] = [
    { href: "/topics", label: t("Bible Topics"), description: t("8 in-depth teaching topic clusters") },
    { href: "/blog", label: `📝 ${t("Ministry Blog")}`, description: t("Theological insights & reflections") },
    { href: "/gallery", label: `📷 ${t("Gallery")}`, description: t("Ministry photos & service memories") },
    { href: "/scripture-study", label: `📖 ${t("Scripture Study")}`, description: t("Deep AI exegetical Bible analysis"), aiHighlight: true },
    { href: "/spiritual-insight", label: `✦ ${t("Spiritual Insight")}`, description: t("Personalized prophetic guidance"), aiHighlight: true },
    { href: "/testimonies", label: t("Testimonies"), description: t("Stories of God's faithfulness") },
    { href: "/events", label: t("Events"), description: t("Upcoming services & programmes") },
    { href: "/crusade", label: t("Crusade"), description: t("Warri crusade & outreach events") },
    { href: "/give", label: t("Give"), description: t("Support the Correction Mandate") },
  ];

  const aboutItems: DropdownItem[] = [
    { href: "/about", label: t("About JCTM"), description: t("Our mission and history") },
    { href: "/leadership", label: t("Leadership"), description: t("Prophet Amos & ministry team") },
    { href: "/sermon-assistant", label: `🤖 ${t("Ask AI")}`, description: t("Chat with our sermon AI"), aiHighlight: true },
    { href: "https://whatsapp.com/channel/0029Vb8HxkvEQIaf1Z86gX0x", label: `💬 ${t("WhatsApp Channel")}`, description: t("Follow us on WhatsApp"), isExternal: true, whatsappHighlight: true },
  ];

  return (
    <>
      {/* ── Nav bar ─────────────────────────────────────────────────────────── */}
      <motion.nav
        ref={navRef}
        aria-label="Main navigation"
        animate={{ y: 0 }}
        className="sticky top-0 z-50 w-full border-b transition-all duration-500"
        style={{
          background: navBg,
          backdropFilter: navBlur,
          WebkitBackdropFilter: navBlur,
          borderColor: navBorderColor,
          height: scrolled ? "3.25rem" : "4rem",
          boxShadow: scrolled
            ? isDark
              ? `0 1px 24px rgba(0,0,0,${0.2 + bgOpacity * 0.1})`
              : `0 1px 24px rgba(0,51,102,${0.06 + bgOpacity * 0.06})`
            : "none",
        }}
      >
        {/* Max-width container — constrained on ultra-wide displays */}
        <div className="mx-auto max-w-screen-2xl h-full flex items-center justify-between px-4 sm:px-6 lg:px-8">

          {/* ── Logo ──────────────────────────────────────────────────────── */}
          <Link href="/">
            <div
              className="flex items-center gap-2.5 cursor-pointer group shrink-0 min-w-0"
              aria-label="Jesus Christ Temple Ministry — Home"
            >
              <motion.img
                src="/jctm-logo-sm.jpeg"
                alt=""
                aria-hidden="true"
                animate={{ height: scrolled ? 30 : 38, width: scrolled ? 30 : 38 }}
                transition={{ duration: 0.3 }}
                className="rounded-full object-cover shadow ring-2 ring-primary/20 group-hover:ring-primary/50 transition-all duration-200 shrink-0"
                decoding="async"
              />
              {/* Full name — sm+ */}
              <div className="hidden sm:flex flex-col leading-tight min-w-0">
                <motion.span
                  animate={{ fontSize: scrolled ? "0.7rem" : "0.8125rem" }}
                  className="font-serif font-bold text-primary leading-tight truncate"
                >
                  Jesus Christ Temple Ministry
                </motion.span>
                <span className="text-[10px] font-medium text-muted-foreground tracking-wide truncate">
                  The Land Of Good News
                </span>
              </div>
              {/* Short name — xs only */}
              <span className="sm:hidden font-serif font-bold text-primary text-base leading-tight">
                JCTM
              </span>
            </div>
          </Link>

          {/* ── Desktop navigation — lg and above ─────────────────────────── */}
          <div
            className="hidden lg:flex items-center gap-1 xl:gap-1.5 2xl:gap-2"
            role="menubar"
            aria-label="Site navigation"
          >
            {flatNavItems.map((item) => {
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  {item.highlight ? (
                    <div
                      role="menuitem"
                      tabIndex={0}
                      className="relative text-[12px] xl:text-[13px] font-bold cursor-pointer px-2.5 xl:px-3.5 py-1.5 rounded-full transition-all duration-200 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-1"
                      style={{
                        background: isActive
                          ? "linear-gradient(135deg,#D4A017 0%,#B88913 100%)"
                          : "rgba(212,160,23,0.10)",
                        color: isActive ? "#0a1a4a" : "#A8780F",
                        border: "1px solid rgba(212,160,23,0.32)",
                        boxShadow: isActive ? "0 4px 14px rgba(212,160,23,0.32)" : "none",
                      }}
                    >
                      {item.label}
                    </div>
                  ) : item.featurePill ? (
                    <div
                      role="menuitem"
                      tabIndex={0}
                      className={`relative text-[12px] xl:text-[13px] font-semibold cursor-pointer px-2.5 xl:px-3 py-1.5 rounded-full transition-all duration-200 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-1 ${
                        isActive
                          ? "text-primary bg-accent/15 border border-accent/35"
                          : "text-primary/75 bg-transparent border border-transparent hover:text-primary hover:bg-accent/8 hover:border-accent/20"
                      }`}
                    >
                      {item.label}
                    </div>
                  ) : (
                    <div
                      role="menuitem"
                      tabIndex={0}
                      className={`relative text-[12px] xl:text-sm font-medium transition-colors cursor-pointer py-1 px-0.5 focus-visible:outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-1 ${
                        isActive ? "text-accent" : "text-primary/75 hover:text-accent"
                      }`}
                    >
                      {item.label}
                      {isActive && (
                        <motion.div
                          layoutId="nav-underline"
                          className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-accent rounded-full"
                        />
                      )}
                    </div>
                  )}
                </Link>
              );
            })}

            {/* Resources dropdown */}
            <div className="relative">
              <button
                ref={resourcesBtnRef}
                onClick={() => toggleDropdown("resources")}
                onKeyDown={(e: KeyboardEvent<HTMLButtonElement>) => {
                  if (e.key === "ArrowDown") { e.preventDefault(); toggleDropdown("resources"); }
                }}
                aria-haspopup="menu"
                aria-expanded={openDropdown === "resources"}
                aria-controls="resources-menu"
                className={`flex items-center gap-1 text-[12px] xl:text-sm font-medium transition-colors hover:text-accent cursor-pointer py-1 px-0.5 rounded relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-1 ${
                  resourcesActive || openDropdown === "resources" ? "text-accent" : "text-primary/80"
                }`}
              >
                {t("Resources")}
                <motion.span
                  animate={{ rotate: openDropdown === "resources" ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  aria-hidden="true"
                >
                  <ChevronDown className="w-3 h-3 xl:w-3.5 xl:h-3.5" />
                </motion.span>
                {resourcesActive && (
                  <motion.div
                    layoutId="nav-underline"
                    className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-accent rounded-full"
                  />
                )}
              </button>
              <DropdownPanel
                id="resources-menu"
                items={resourcesItems}
                isActive={openDropdown === "resources"}
                isDark={isDark}
                onClose={() => { setOpenDropdown(null); resourcesBtnRef.current?.focus(); }}
                location={location}
                align="left"
              />
            </div>

            {/* About dropdown */}
            <div className="relative">
              <button
                ref={aboutBtnRef}
                onClick={() => toggleDropdown("about")}
                onKeyDown={(e: KeyboardEvent<HTMLButtonElement>) => {
                  if (e.key === "ArrowDown") { e.preventDefault(); toggleDropdown("about"); }
                }}
                aria-haspopup="menu"
                aria-expanded={openDropdown === "about"}
                aria-controls="about-menu"
                className={`flex items-center gap-1 text-[12px] xl:text-sm font-medium transition-colors hover:text-accent cursor-pointer py-1 px-0.5 rounded relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-1 ${
                  aboutActive || openDropdown === "about" ? "text-accent" : "text-primary/80"
                }`}
              >
                {t("About")}
                <motion.span
                  animate={{ rotate: openDropdown === "about" ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  aria-hidden="true"
                >
                  <ChevronDown className="w-3 h-3 xl:w-3.5 xl:h-3.5" />
                </motion.span>
                {aboutActive && (
                  <motion.div
                    layoutId="nav-underline"
                    className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-accent rounded-full"
                  />
                )}
              </button>
              <DropdownPanel
                id="about-menu"
                items={aboutItems}
                isActive={openDropdown === "about"}
                isDark={isDark}
                onClose={() => { setOpenDropdown(null); aboutBtnRef.current?.focus(); }}
                location={location}
                align="right"
              />
            </div>

            {/* Language selector */}
            <LanguageSelector />

            {/* Push notification bell */}
            {pushSupported && (
              <IconButton
                onClick={subscribed ? unsubscribe : subscribe}
                disabled={pushLoading}
                aria-label={subscribed ? "Disable Temple TV live alerts" : "Enable Temple TV live alerts"}
                title={subscribed ? "Click to disable live alerts" : "Get notified when Temple TV goes live"}
                active={subscribed}
                isDark={isDark}
              >
                {subscribed
                  ? <Bell className="h-3.5 w-3.5" aria-hidden="true" />
                  : <BellOff className="h-3.5 w-3.5" aria-hidden="true" />}
              </IconButton>
            )}

            {/* Theme toggle */}
            <IconButton
              onClick={toggle}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              isDark={isDark}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={theme}
                  initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
                  animate={{ rotate: 0, opacity: 1, scale: 1 }}
                  exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center"
                  aria-hidden="true"
                >
                  {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </motion.span>
              </AnimatePresence>
            </IconButton>
          </div>

          {/* ── Mobile / tablet controls — below lg ───────────────────────── */}
          <div className="lg:hidden flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Language selector (compact) */}
            <div className="hidden sm:block">
              <LanguageSelector />
            </div>

            {/* Theme toggle */}
            <motion.button
              onClick={toggle}
              whileTap={{ scale: 0.88 }}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-1"
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
                  aria-hidden="true"
                >
                  {isDark
                    ? <Sun className="h-4 w-4 text-accent" />
                    : <Moon className="h-4 w-4 text-primary" />}
                </motion.span>
              </AnimatePresence>
            </motion.button>

            {/* Hamburger */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(v => !v)}
              className="w-10 h-10 sm:w-11 sm:h-11 text-primary focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-1"
              aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileOpen}
              aria-controls="mobile-drawer"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={mobileOpen ? "close" : "open"}
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  aria-hidden="true"
                >
                  {mobileOpen ? <X className="h-5 w-5 sm:h-6 sm:w-6" /> : <Menu className="h-5 w-5 sm:h-6 sm:w-6" />}
                </motion.div>
              </AnimatePresence>
            </Button>
          </div>
        </div>
      </motion.nav>

      {/* ── Mobile drawer ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="mobile-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              aria-hidden="true"
              onClick={() => setMobileOpen(false)}
            />

            {/* Drawer panel — slides in from the right */}
            <motion.div
              key="mobile-drawer"
              id="mobile-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="lg:hidden fixed top-0 right-0 bottom-0 z-50 w-[min(88vw,360px)] flex flex-col overflow-hidden"
              style={{
                background: isDark ? "rgba(0,10,26,0.98)" : "rgba(255,254,248,0.98)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                borderLeft: isDark ? "1px solid rgba(56,189,248,0.12)" : "1px solid rgba(0,51,102,0.08)",
              }}
            >
              {/* Drawer header */}
              <div
                className="flex items-center justify-between px-5 py-4 shrink-0 border-b"
                style={{ borderColor: isDark ? "rgba(56,189,248,0.1)" : "rgba(0,51,102,0.07)" }}
              >
                <Link href="/" onClick={() => setMobileOpen(false)}>
                  <div className="flex items-center gap-2.5 cursor-pointer">
                    <img
                      src="/jctm-logo-sm.jpeg"
                      alt="JCTM"
                      className="w-8 h-8 rounded-full object-cover ring-2 ring-primary/20"
                      decoding="async"
                    />
                    <div className="flex flex-col leading-tight">
                      <span className="text-[13px] font-serif font-bold text-primary leading-tight">
                        Jesus Christ Temple Ministry
                      </span>
                      <span className="text-[10px] text-muted-foreground tracking-wide">
                        The Land Of Good News
                      </span>
                    </div>
                  </div>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close navigation menu"
                  className="w-9 h-9 text-primary shrink-0 focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-1"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </Button>
              </div>

              {/* Scrollable nav list */}
              <nav
                aria-label="Mobile navigation"
                className="flex-1 overflow-y-auto overscroll-contain py-3 px-3"
              >
                {/* Main links */}
                <div className="space-y-0.5">
                  {flatNavItems.map((item, i) => (
                    <motion.div
                      key={item.href}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.035, duration: 0.2 }}
                    >
                      <Link href={item.href}>
                        <MobileNavItem
                          label={item.label}
                          isActive={location === item.href}
                          highlight={item.highlight}
                          featurePill={item.featurePill}
                          onClick={() => setMobileOpen(false)}
                        />
                      </Link>
                    </motion.div>
                  ))}
                </div>

                {/* Resources section */}
                <MobileSectionDivider label={t("Resources")} delay={flatNavItems.length * 0.035} />
                <div className="space-y-0.5">
                  {resourcesItems.map((item, i) => (
                    <motion.div
                      key={item.href}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: (flatNavItems.length + 1 + i) * 0.035, duration: 0.2 }}
                    >
                      <Link href={item.href}>
                        <MobileDropdownItem
                          item={item}
                          isActive={location === item.href}
                          onClick={() => setMobileOpen(false)}
                        />
                      </Link>
                    </motion.div>
                  ))}
                </div>

                {/* About section */}
                <MobileSectionDivider label={t("About")} delay={(flatNavItems.length + resourcesItems.length + 1) * 0.035} />
                <div className="space-y-0.5">
                  {aboutItems.map((item, i) => {
                    const baseDelay = (flatNavItems.length + resourcesItems.length + 2 + i) * 0.035;
                    return (
                      <motion.div
                        key={item.href}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: baseDelay, duration: 0.2 }}
                      >
                        {item.isExternal ? (
                          <a href={item.href} target="_blank" rel="noopener noreferrer">
                            <MobileDropdownItem
                              item={item}
                              isActive={false}
                              onClick={() => setMobileOpen(false)}
                            />
                          </a>
                        ) : (
                          <Link href={item.href}>
                            <MobileDropdownItem
                              item={item}
                              isActive={location === item.href}
                              onClick={() => setMobileOpen(false)}
                            />
                          </Link>
                        )}
                      </motion.div>
                    );
                  })}
                </div>

                {/* Bottom padding so last items aren't hidden by footer */}
                <div className="h-4" />
              </nav>

              {/* Drawer footer — utility row */}
              <div
                className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-t"
                style={{ borderColor: isDark ? "rgba(56,189,248,0.1)" : "rgba(0,51,102,0.07)" }}
              >
                {/* Language selector */}
                <LanguageSelector />

                <div className="flex items-center gap-2">
                  {/* Push bell */}
                  {pushSupported && (
                    <IconButton
                      onClick={subscribed ? unsubscribe : subscribe}
                      disabled={pushLoading}
                      aria-label={subscribed ? "Disable live alerts" : "Enable live alerts"}
                      title={subscribed ? "Click to disable live alerts" : "Get notified when Temple TV goes live"}
                      active={subscribed}
                      isDark={isDark}
                    >
                      {subscribed
                        ? <Bell className="h-4 w-4" aria-hidden="true" />
                        : <BellOff className="h-4 w-4" aria-hidden="true" />}
                    </IconButton>
                  )}

                  {/* Theme toggle */}
                  <IconButton onClick={toggle} aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"} isDark={isDark}>
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={theme}
                        initial={{ rotate: -90, opacity: 0 }}
                        animate={{ rotate: 0, opacity: 1 }}
                        exit={{ rotate: 90, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="flex"
                        aria-hidden="true"
                      >
                        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                      </motion.span>
                    </AnimatePresence>
                  </IconButton>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Small reusable sub-components ─────────────────────────────────────────────

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isDark: boolean;
  active?: boolean;
  children: React.ReactNode;
}

function IconButton({ isDark, active = false, children, className = "", ...props }: IconButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.88 }}
      className={`flex items-center justify-center w-8 h-8 rounded-full border transition-all duration-300 cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-1 ${className}`}
      style={{
        background: active
          ? "rgba(56,189,248,0.18)"
          : isDark ? "rgba(56,189,248,0.08)" : "rgba(0,51,102,0.06)",
        borderColor: active
          ? "rgba(56,189,248,0.5)"
          : isDark ? "rgba(56,189,248,0.2)" : "rgba(0,51,102,0.12)",
        color: active
          ? "hsl(var(--accent))"
          : isDark ? "hsl(var(--muted-foreground))" : "hsl(var(--primary))",
      }}
      {...(props as React.ComponentPropsWithoutRef<typeof motion.button>)}
    >
      {children}
    </motion.button>
  );
}

interface MobileNavItemProps {
  label: string;
  isActive: boolean;
  highlight?: boolean;
  featurePill?: boolean;
  onClick: () => void;
}

function MobileNavItem({ label, isActive, highlight, featurePill, onClick }: MobileNavItemProps) {
  const base = "text-[14px] font-medium cursor-pointer py-3 px-4 rounded-xl transition-colors min-h-[48px] flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60";

  if (highlight) {
    return (
      <div
        className={`${base} font-bold`}
        style={{ color: "#A8780F", background: "rgba(212,160,23,0.10)", border: "1px solid rgba(212,160,23,0.32)" }}
        onClick={onClick}
        tabIndex={0}
        role="menuitem"
        onKeyDown={e => e.key === "Enter" && onClick()}
      >
        {label}
      </div>
    );
  }
  if (featurePill) {
    return (
      <div
        className={`${base} ${isActive ? "text-primary bg-accent/12 border border-accent/30" : "text-primary/85 border border-transparent"}`}
        onClick={onClick}
        tabIndex={0}
        role="menuitem"
        onKeyDown={e => e.key === "Enter" && onClick()}
      >
        {label}
      </div>
    );
  }
  return (
    <div
      className={`${base} ${isActive ? "text-accent bg-accent/8" : "text-primary hover:bg-muted/50"}`}
      onClick={onClick}
      tabIndex={0}
      role="menuitem"
      onKeyDown={e => e.key === "Enter" && onClick()}
    >
      {label}
    </div>
  );
}

function MobileSectionDivider({ label, delay }: { label: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay, duration: 0.2 }}
      className="pt-4 pb-1.5 px-4"
    >
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{label}</span>
        <div className="flex-1 h-px bg-border/50" />
      </div>
    </motion.div>
  );
}

interface MobileDropdownItemProps {
  item: DropdownItem;
  isActive: boolean;
  onClick: () => void;
}

function MobileDropdownItem({ item, isActive, onClick }: MobileDropdownItemProps) {
  const color = item.whatsappHighlight
    ? "#25D366"
    : item.aiHighlight
    ? "#8b5cf6"
    : isActive
    ? "hsl(var(--accent))"
    : "hsl(var(--primary))";

  return (
    <div
      className="text-[13px] font-medium cursor-pointer py-2.5 px-4 rounded-xl transition-colors min-h-[48px] flex flex-col justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 hover:bg-muted/40"
      style={{ color, background: isActive ? "rgba(56,189,248,0.06)" : "transparent" }}
      onClick={onClick}
      tabIndex={0}
      role="menuitem"
      onKeyDown={e => e.key === "Enter" && onClick()}
    >
      <span className="leading-snug">{item.label}</span>
      <span className="block text-[11px] text-muted-foreground leading-snug mt-0.5">{item.description}</span>
    </div>
  );
}

// ── Desktop dropdown panel ─────────────────────────────────────────────────────
interface DropdownPanelProps {
  id: string;
  items: DropdownItem[];
  isActive: boolean;
  isDark: boolean;
  onClose: () => void;
  location: string;
  align: "left" | "right";
}

function DropdownPanel({ id, items, isActive, isDark, onClose, location, align }: DropdownPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Keep focus inside dropdown; Tab on last item wraps or closes
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!panelRef.current) return;
    const focusable = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>("a[href],button,[tabindex='0']")
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const idx = focusable.indexOf(document.activeElement as HTMLElement);
      (focusable[idx + 1] ?? first)?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const idx = focusable.indexOf(document.activeElement as HTMLElement);
      (focusable[idx - 1] ?? last)?.focus();
    } else if (e.key === "Tab" && !e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      onClose();
    } else if (e.key === "Tab" && e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      onClose();
    }
  };

  // Auto-focus first item when opened
  useEffect(() => {
    if (isActive && panelRef.current) {
      const first = panelRef.current.querySelector<HTMLElement>("a[href],button,[tabindex='0']");
      setTimeout(() => first?.focus(), 60);
    }
  }, [isActive]);

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          ref={panelRef}
          id={id}
          role="menu"
          aria-label="Submenu"
          onKeyDown={handleKeyDown}
          initial={{ opacity: 0, y: -6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.97 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className={`absolute top-full mt-2 w-60 rounded-2xl border shadow-xl overflow-hidden z-50 ${
            align === "right" ? "right-0" : "left-0"
          }`}
          style={{
            background: isDark ? "rgba(0,10,26,0.97)" : "rgba(255,254,248,0.98)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            borderColor: isDark ? "rgba(56,189,248,0.15)" : "rgba(0,51,102,0.1)",
          }}
        >
          <div className="py-2 max-h-[70vh] overflow-y-auto overscroll-contain">
            {items.map((item) =>
              item.isExternal ? (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  role="menuitem"
                  tabIndex={0}
                  onClick={onClose}
                  className="flex flex-col px-4 py-2.5 cursor-pointer transition-colors hover:bg-accent/5 focus-visible:bg-accent/5 focus-visible:outline-none"
                >
                  <span className={`text-sm font-semibold ${item.whatsappHighlight ? "text-[#25D366]" : "text-primary"}`}>
                    {item.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground mt-0.5">{item.description}</span>
                </a>
              ) : (
                <Link key={item.href} href={item.href}>
                  <div
                    role="menuitem"
                    tabIndex={0}
                    onClick={onClose}
                    onKeyDown={e => e.key === "Enter" && onClose()}
                    className={`flex flex-col px-4 py-2.5 cursor-pointer transition-colors hover:bg-accent/5 focus-visible:bg-accent/5 focus-visible:outline-none ${
                      location === item.href ? "bg-accent/10" : ""
                    }`}
                  >
                    <span
                      className={`text-sm font-semibold ${
                        item.aiHighlight
                          ? "text-purple-500"
                          : location === item.href
                          ? "text-accent"
                          : "text-primary"
                      }`}
                    >
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

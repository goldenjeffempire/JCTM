import { motion } from "framer-motion";
import appPromoLandscape from "@assets/image_1782999582249.png";
import googlePlayIcon from "@assets/vecteezy_google-play-store-icon-logo-symbol_22484501_1783000016861.png";

const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.templetv.jctm";

interface TempleAppCTAStripProps {
  className?: string;
  variant?: "light" | "dark";
  message?: string;
}

export function TempleAppCTAStrip({
  className = "",
  variant = "light",
  message = "Take JCTM sermons, live broadcasts and devotionals everywhere you go.",
}: TempleAppCTAStripProps) {
  const isDark = variant === "dark";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className={`relative overflow-hidden rounded-2xl border ${
        isDark
          ? "bg-white/5 border-white/10"
          : "bg-gradient-to-r from-[#003366]/5 via-[#01875f]/5 to-[#0284C7]/5 border-[#003366]/15"
      } ${className}`}
    >
      {/* Background accent */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07] rounded-2xl"
        style={{
          background:
            "linear-gradient(135deg, #003366 0%, #01875f 50%, #0284C7 100%)",
        }}
      />

      <div className="relative flex flex-col sm:flex-row items-center gap-4 p-5 sm:p-6">
        {/* Promo image */}
        <img
          src={appPromoLandscape}
          alt="Temple TV App — Stay Updated, Stay Connected"
          className="shrink-0 w-full sm:w-48 md:w-56 rounded-xl object-cover shadow-md"
          loading="lazy"
          aria-hidden
        />

        {/* Text */}
        <div className="flex-1 min-w-0 text-center sm:text-left">
          <p
            className={`font-bold text-base leading-snug mb-0.5 ${
              isDark ? "text-white" : "text-primary"
            }`}
          >
            Download Temple TV App — Free on Google Play
          </p>
          <p
            className={`text-sm leading-relaxed ${
              isDark ? "text-white/60" : "text-muted-foreground"
            }`}
          >
            {message}
          </p>
        </div>

        {/* CTA button */}
        <a
          href={PLAY_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Download Temple TV App on Google Play"
          className="shrink-0 inline-flex items-center gap-2.5 px-5 py-3 rounded-xl text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
          style={{ background: "linear-gradient(135deg, #01875f, #00704f)" }}
        >
          <img src={googlePlayIcon} className="h-4 w-4" alt="" aria-hidden="true" />
          <span className="flex flex-col items-start leading-tight">
            <span className="text-[9px] font-medium opacity-75 uppercase tracking-wider">Download on</span>
            <span className="text-sm font-bold leading-none">Google Play</span>
          </span>
        </a>
      </div>
    </motion.div>
  );
}

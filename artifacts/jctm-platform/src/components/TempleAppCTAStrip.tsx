import { motion } from "framer-motion";

const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.templetv.jctm";

function PlayStoreLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M3.18 23.76c.3.17.64.24.99.2l12.24-11.24L12.9 9.2 3.18 23.76zm17.27-10.98-3.35-1.93-3.41 3.13 3.41 3.13 3.38-1.95c.96-.56.96-1.83-.03-2.38zM3 1.07C2.58 1.34 2.3 1.8 2.3 2.4v19.2c0 .6.28 1.06.7 1.33l.1.06 10.76-10.76v-.25L3 1.07zm9.9 9.85L3.18.36c-.35-.04-.69.03-.99.2L12.9 14.8l.41-.38L12.9 10.92z" />
    </svg>
  );
}

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
        {/* Icon badge */}
        <div
          className="shrink-0 h-14 w-14 rounded-2xl flex items-center justify-center shadow-lg"
          style={{ background: "linear-gradient(135deg, #003366, #01875f)" }}
          aria-hidden
        >
          <PlayStoreLogo className="h-7 w-7 text-white" />
        </div>

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
          <PlayStoreLogo className="h-4 w-4 text-white" />
          <span className="flex flex-col items-start leading-tight">
            <span className="text-[9px] font-medium opacity-75 uppercase tracking-wider">Download on</span>
            <span className="text-sm font-bold leading-none">Google Play</span>
          </span>
        </a>
      </div>
    </motion.div>
  );
}

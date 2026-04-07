import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, Radio } from "lucide-react";

interface GlowPoint {
  id: string;
  label: string;
  sublabel: string;
  flag: string;
  x: number;
  y: number;
  isHub?: boolean;
  viewers: string;
}

const GLOW_POINTS: GlowPoint[] = [
  { id: "warri", label: "Warri, Nigeria", sublabel: "Global Headquarters", flag: "🇳🇬", x: 51.6, y: 56.0, isHub: true, viewers: "HQ" },
  { id: "lagos", label: "Lagos, Nigeria", sublabel: "West Africa Hub", flag: "🇳🇬", x: 51.0, y: 55.2, isHub: false, viewers: "8.2K" },
  { id: "london", label: "London, UK", sublabel: "Europe Broadcast", flag: "🇬🇧", x: 50.0, y: 28.2, isHub: false, viewers: "4.1K" },
  { id: "houston", label: "Houston, USA", sublabel: "Americas Hub", flag: "🇺🇸", x: 23.5, y: 40.5, isHub: false, viewers: "6.3K" },
  { id: "newyork", label: "New York, USA", sublabel: "East Coast", flag: "🇺🇸", x: 29.4, y: 33.2, isHub: false, viewers: "5.9K" },
  { id: "toronto", label: "Toronto, Canada", sublabel: "North America", flag: "🇨🇦", x: 27.9, y: 30.0, isHub: false, viewers: "2.8K" },
  { id: "nairobi", label: "Nairobi, Kenya", sublabel: "East Africa", flag: "🇰🇪", x: 54.7, y: 57.8, isHub: false, viewers: "3.5K" },
  { id: "joburg", label: "Johannesburg, SA", sublabel: "Southern Africa", flag: "🇿🇦", x: 53.0, y: 69.8, isHub: false, viewers: "2.1K" },
  { id: "accra", label: "Accra, Ghana", sublabel: "West Africa", flag: "🇬🇭", x: 49.9, y: 55.8, isHub: false, viewers: "1.9K" },
  { id: "dubai", label: "Dubai, UAE", sublabel: "Middle East", flag: "🇦🇪", x: 65.4, y: 43.2, isHub: false, viewers: "1.2K" },
  { id: "sydney", label: "Sydney, Australia", sublabel: "Pacific Region", flag: "🇦🇺", x: 91.4, y: 73.2, isHub: false, viewers: "0.9K" },
];

export function MandateMap() {
  const [hovered, setHovered] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const hoveredPoint = GLOW_POINTS.find((p) => p.id === hovered);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-3xl border border-white/10"
      style={{ paddingTop: "52%", background: "linear-gradient(135deg, #010f20 0%, #001830 50%, #020b18 100%)" }}
      onMouseMove={handleMouseMove}
    >
      {/* Grid lines overlay */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(56,189,248,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.6) 1px, transparent 1px)",
          backgroundSize: "8% 12%",
        }}
      />

      {/* Graticule circles */}
      {[30, 50, 70].map((r, i) => (
        <div
          key={i}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/5"
          style={{ width: `${r}%`, height: `${r * 1.85}%` }}
        />
      ))}

      {/* Continent blobs — simplified shapes */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.12]"
        viewBox="0 0 1000 520"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Africa */}
        <ellipse cx="510" cy="360" rx="80" ry="120" fill="#38BDF8" />
        {/* Europe */}
        <ellipse cx="510" cy="160" rx="60" ry="50" fill="#38BDF8" />
        {/* North America */}
        <ellipse cx="210" cy="200" rx="110" ry="120" fill="#38BDF8" />
        {/* South America */}
        <ellipse cx="270" cy="400" rx="60" ry="90" fill="#38BDF8" />
        {/* Asia */}
        <ellipse cx="680" cy="210" rx="160" ry="110" fill="#38BDF8" />
        {/* Australia */}
        <ellipse cx="840" cy="420" rx="60" ry="45" fill="#38BDF8" />
        {/* UK/island */}
        <ellipse cx="490" cy="148" rx="12" ry="16" fill="#38BDF8" opacity="1.5" />
      </svg>

      {/* Atmospheric glow at center (Nigeria) */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          left: "51.6%",
          top: "56%",
          transform: "translate(-50%, -50%)",
          width: "180px",
          height: "180px",
          background: "radial-gradient(circle, rgba(56,189,248,0.18) 0%, transparent 70%)",
          filter: "blur(20px)",
        }}
      />

      {/* Connection lines from Warri to all points */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {GLOW_POINTS.filter((p) => !p.isHub).map((p) => (
          <motion.line
            key={p.id}
            x1="51.6"
            y1="56"
            x2={p.x}
            y2={p.y}
            stroke="rgba(56,189,248,0.15)"
            strokeWidth="0.2"
            strokeDasharray="0.8 1.2"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: hovered === p.id ? 0.7 : 0.25 }}
            transition={{ duration: 1.5, delay: 0.3 }}
          />
        ))}
      </svg>

      {/* Travelling pulses along lines */}
      {GLOW_POINTS.filter((p) => !p.isHub).slice(0, 5).map((p, i) => (
        <motion.div
          key={p.id}
          className="absolute w-1.5 h-1.5 rounded-full bg-accent/80 pointer-events-none"
          style={{ left: "51.6%", top: "56%" }}
          animate={{
            left: [`51.6%`, `${p.x}%`, `51.6%`],
            top: [`56%`, `${p.y}%`, `56%`],
            opacity: [0, 0.9, 0],
            scale: [0, 1, 0],
          }}
          transition={{
            duration: 4 + i * 0.8,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 1.1,
            repeatDelay: 2,
          }}
        />
      ))}

      {/* Glow points */}
      {GLOW_POINTS.map((point) => (
        <motion.button
          key={point.id}
          className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer focus:outline-none"
          style={{ left: `${point.x}%`, top: `${point.y}%` }}
          onMouseEnter={() => setHovered(point.id)}
          onMouseLeave={() => setHovered(null)}
          aria-label={point.label}
        >
          {/* Outer pulse ring */}
          <motion.div
            className={`absolute -inset-3 rounded-full ${point.isHub ? "bg-accent/25" : "bg-accent/12"}`}
            animate={{ scale: [1, 1.8, 1], opacity: [0.7, 0, 0.7] }}
            transition={{ duration: point.isHub ? 1.8 : 2.8, repeat: Infinity, ease: "easeOut", delay: Math.random() * 1.5 }}
          />
          {/* Second pulse */}
          {point.isHub && (
            <motion.div
              className="absolute -inset-5 rounded-full bg-accent/15"
              animate={{ scale: [1, 2.2, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut", delay: 0.6 }}
            />
          )}
          {/* Core dot */}
          <motion.div
            className={`relative z-10 rounded-full transition-transform duration-200 shadow-lg ${
              point.isHub
                ? "h-4 w-4 bg-accent shadow-accent/60 ring-2 ring-white/30"
                : "h-2.5 w-2.5 bg-accent/80 shadow-accent/40"
            }`}
            whileHover={{ scale: 1.6 }}
            style={{ boxShadow: point.isHub ? "0 0 20px rgba(56,189,248,0.7), 0 0 40px rgba(56,189,248,0.3)" : "0 0 10px rgba(56,189,248,0.5)" }}
          />
          {/* Hub label always visible */}
          {point.isHub && (
            <motion.div
              className="absolute left-5 top-1/2 -translate-y-1/2 whitespace-nowrap"
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
            >
              <div className="bg-accent/90 backdrop-blur-sm text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                ★ HQ · Warri
              </div>
            </motion.div>
          )}
        </motion.button>
      ))}

      {/* Tooltip */}
      <AnimatePresence>
        {hovered && hoveredPoint && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 6 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="absolute z-20 pointer-events-none"
            style={{
              left: mousePos.x + 14,
              top: mousePos.y - 50,
            }}
          >
            <div
              className="rounded-2xl p-3 border border-white/15 min-w-[160px] shadow-2xl"
              style={{ background: "rgba(1, 24, 48, 0.95)", backdropFilter: "blur(16px)" }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-base">{hoveredPoint.flag}</span>
                <div>
                  <p className="text-white font-bold text-xs leading-tight">{hoveredPoint.label}</p>
                  <p className="text-white/50 text-[10px]">{hoveredPoint.sublabel}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Radio className="h-2.5 w-2.5 text-accent" />
                <span className="text-accent text-[10px] font-semibold">
                  {hoveredPoint.isHub ? "Global HQ · Live" : `${hoveredPoint.viewers} reach`}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Corner legend */}
      <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5">
        <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
        <span className="text-white/50 text-[10px] font-medium">Hover to explore</span>
      </div>

      {/* Nation count badge */}
      <div className="absolute top-4 left-4 flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-xl px-3 py-1.5">
        <Globe className="h-3 w-3 text-accent" />
        <span className="text-accent text-[10px] font-bold">40+ Nations Reached</span>
      </div>
    </div>
  );
}

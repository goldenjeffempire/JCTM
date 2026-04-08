import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Navigation, MapPin, ExternalLink, Loader2 } from "lucide-react";
import {
  CHURCH_NAME,
  CHURCH_ADDRESS_LINES,
  GOOGLE_MAPS_URL,
  APPLE_MAPS_URL,
  WAZE_URL,
  GOOGLE_MAPS_PLACE_URL,
} from "../constants/church";

interface Props {
  open: boolean;
  onClose: () => void;
}

type GeoState = "idle" | "requesting" | "granted" | "denied";

function AnimatedRoute({ hasOrigin }: { hasOrigin: boolean }) {
  return (
    <div className="relative w-full flex flex-col items-center py-4 select-none">
      {/* Origin pin */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 20 }}
        className="flex items-center gap-2 z-10"
      >
        <div className="h-9 w-9 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/40 border-2 border-white">
          <Navigation className="h-4 w-4 text-white" />
        </div>
        <span className="text-sm font-semibold text-emerald-400">
          {hasOrigin ? "Your Location" : "Your Starting Point"}
        </span>
      </motion.div>

      {/* Animated dashed route line */}
      <div className="relative flex flex-col items-center my-1 w-16">
        <svg width="24" height="100" viewBox="0 0 24 100" fill="none" className="overflow-visible">
          <motion.path
            d="M12 0 C12 20, 4 30, 12 50 C20 70, 4 80, 12 100"
            stroke="url(#routeGrad)"
            strokeWidth="2.5"
            strokeDasharray="6 4"
            strokeLinecap="round"
            fill="none"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.4, delay: 0.5, ease: "easeInOut" }}
          />
          <defs>
            <linearGradient id="routeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#0284C7" />
            </linearGradient>
          </defs>
        </svg>

        {/* Distance label */}
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.0 }}
          className="absolute right-[-60px] top-[38px] bg-white/10 border border-white/20 rounded-full px-2 py-0.5 text-[10px] text-white/70 font-medium whitespace-nowrap"
        >
          By road
        </motion.div>
      </div>

      {/* Destination pin */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1.2, type: "spring", stiffness: 300, damping: 20 }}
        className="flex flex-col items-center z-10"
      >
        {/* Pulsing rings around destination */}
        <div className="relative flex items-center justify-center mb-2">
          {[1, 2].map((r) => (
            <motion.div
              key={r}
              className="absolute rounded-full border border-accent/50"
              animate={{ scale: [1, 1 + r * 0.6], opacity: [0.6, 0] }}
              transition={{ duration: 2, repeat: Infinity, delay: r * 0.5, ease: "easeOut" }}
              style={{ width: 36, height: 36 }}
            />
          ))}
          <div className="h-9 w-9 rounded-full bg-[#003366] flex items-center justify-center shadow-lg border-2 border-accent z-10">
            <MapPin className="h-4 w-4 text-accent" />
          </div>
        </div>
        <span className="text-sm font-bold text-white">{CHURCH_NAME}</span>
        <span className="text-xs text-white/50 mt-0.5 text-center max-w-[200px] leading-snug">
          {CHURCH_ADDRESS_LINES[2]} {CHURCH_ADDRESS_LINES[3]}
        </span>
      </motion.div>
    </div>
  );
}

export function DirectionsModal({ open, onClose }: Props) {
  const [geoState, setGeoState] = useState<GeoState>("idle");
  const [directionsUrl, setDirectionsUrl] = useState(GOOGLE_MAPS_URL);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoState("denied");
      return;
    }
    setGeoState("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const origin = encodeURIComponent(`${lat},${lng}`);
        const dest = encodeURIComponent(
          "Km 1 East West Road Patani Expressway Ebrumede Roundabout Effurun Delta State Nigeria",
        );
        setDirectionsUrl(
          `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=driving`,
        );
        setGeoState("granted");
      },
      () => {
        setGeoState("denied");
      },
      { timeout: 8000 },
    );
  }, []);

  // Auto-request on open
  useEffect(() => {
    if (open && geoState === "idle") {
      requestLocation();
    }
    if (!open) {
      setGeoState("idle");
    }
  }, [open, geoState, requestLocation]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
          />

          {/* Sheet */}
          <motion.div
            key="sheet"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 z-50 md:max-w-md md:mx-auto md:bottom-6 md:left-1/2 md:-translate-x-1/2"
          >
            <div className="relative rounded-t-3xl md:rounded-3xl bg-gradient-to-b from-[#001a3d] to-[#000d24] border border-white/10 shadow-2xl overflow-hidden">
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1 md:hidden">
                <div className="h-1 w-10 rounded-full bg-white/20" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-4 pb-2">
                <div className="flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-accent" />
                  <h2 className="text-base font-bold text-white">Get Directions</h2>
                </div>
                <button
                  onClick={onClose}
                  className="h-7 w-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                >
                  <X className="h-3.5 w-3.5 text-white" />
                </button>
              </div>

              {/* Geo status */}
              <div className="px-6 pb-2">
                <AnimatePresence mode="wait">
                  {geoState === "requesting" && (
                    <motion.div
                      key="req"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2 text-[11px] text-white/40"
                    >
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Detecting your location…
                    </motion.div>
                  )}
                  {geoState === "granted" && (
                    <motion.div
                      key="granted"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-1.5 text-[11px] text-emerald-400"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
                      Location detected — route ready
                    </motion.div>
                  )}
                  {geoState === "denied" && (
                    <motion.div
                      key="denied"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-1.5 text-[11px] text-amber-400"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400 inline-block" />
                      Location unavailable — maps will open search
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Animated route */}
              <div className="px-6">
                <AnimatedRoute hasOrigin={geoState === "granted"} />
              </div>

              {/* Full address */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.4 }}
                className="mx-6 mb-4 rounded-xl bg-white/5 border border-white/10 p-3"
              >
                <p className="text-[11px] text-white/40 uppercase tracking-wider mb-1.5 font-medium">
                  Full Address
                </p>
                <address className="not-italic text-sm text-white/80 leading-relaxed space-y-0.5">
                  <p className="font-semibold text-white">{CHURCH_NAME}</p>
                  {CHURCH_ADDRESS_LINES.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </address>
              </motion.div>

              {/* Action buttons */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.5 }}
                className="px-6 pb-8 md:pb-6 space-y-2"
              >
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-accent text-white font-semibold text-sm hover:bg-accent/90 transition-colors shadow-lg shadow-accent/30"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open in Google Maps
                </a>
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={APPLE_MAPS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white/80 text-sm font-medium hover:bg-white/15 transition-colors"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    Apple Maps
                  </a>
                  <a
                    href={WAZE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white/80 text-sm font-medium hover:bg-white/15 transition-colors"
                  >
                    <Navigation className="h-3.5 w-3.5" />
                    Waze
                  </a>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence, useSpring, useMotionValue } from "framer-motion";
import { Users, Flame } from "lucide-react";
import { getOrCreateVisitorId } from "@/lib/visitorId";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function AnimatedNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionVal = useMotionValue(value);
  const spring = useSpring(motionVal, { stiffness: 60, damping: 16 });

  useEffect(() => {
    motionVal.set(value);
  }, [value, motionVal]);

  useEffect(() => {
    return spring.on("change", (v) => {
      if (ref.current) ref.current.textContent = Math.round(v).toLocaleString();
    });
  }, [spring]);

  return <span ref={ref}>{value.toLocaleString()}</span>;
}

export function GlobalAltar() {
  const [total, setTotal] = useState(0);
  const [trend, setTrend] = useState<"up" | null>(null);
  const prevRef = useRef(0);
  const trackedRef = useRef(false);

  // Register this visitor once on mount
  useEffect(() => {
    if (trackedRef.current) return;
    trackedRef.current = true;

    const visitorId = getOrCreateVisitorId();

    fetch(`${BASE}/api/visitors/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId }),
    })
      .then(r => r.ok ? r.json() : null)
      .then((data: { total: number } | null) => {
        if (data?.total) {
          const prev = prevRef.current;
          if (data.total > prev) setTrend("up");
          prevRef.current = data.total;
          setTotal(data.total);
          setTimeout(() => setTrend(null), 2200);
        }
      })
      .catch(() => null);
  }, []);

  // Subscribe to live updates via SSE
  useEffect(() => {
    let es: EventSource;
    let retryTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      es = new EventSource(`${BASE}/api/visitors/stream`);

      es.onmessage = (e) => {
        try {
          const { total: t } = JSON.parse(e.data) as { total: number };
          const prev = prevRef.current;
          if (t > prev) {
            setTrend("up");
            setTimeout(() => setTrend(null), 2200);
          }
          prevRef.current = t;
          setTotal(t);
        } catch {}
      };

      es.onerror = () => {
        es.close();
        retryTimer = setTimeout(connect, 5000);
      };
    };

    connect();
    return () => {
      es?.close();
      clearTimeout(retryTimer);
    };
  }, []);

  const rings = [1, 2, 3];

  return (
    <div className="relative flex flex-col items-center">
      {/* Pulsing rings */}
      <div className="relative flex items-center justify-center mb-5">
        {rings.map((r) => (
          <motion.div
            key={r}
            className="absolute rounded-full border border-accent/30"
            animate={{ scale: [1, 1 + r * 0.4], opacity: [0.5, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut", delay: r * 0.6 }}
            style={{ width: 56, height: 56 }}
          />
        ))}
        <div className="relative z-10 h-14 w-14 rounded-full bg-gradient-to-br from-accent to-[#0284C7] flex items-center justify-center shadow-xl shadow-accent/40">
          <Users className="h-6 w-6 text-white" />
        </div>
      </div>

      {/* Live badge */}
      <div className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-400/30 rounded-full px-3 py-1 mb-3">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest">Live Count</span>
      </div>

      {/* Counter */}
      <div className="text-center">
        <div className="flex items-end justify-center gap-2">
          <motion.div
            key={total}
            className="text-5xl md:text-6xl font-serif font-bold text-white leading-none"
          >
            <AnimatedNumber value={total} />
          </motion.div>
          <AnimatePresence>
            {trend && (
              <motion.span
                key="up"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-xl font-bold mb-1 text-emerald-400"
              >
                ↑
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <p className="text-white/50 text-xs uppercase tracking-[0.2em] mt-2 font-medium">
          Total Visitors · Worldwide
        </p>
      </div>

      {/* Flag row */}
      <div className="flex items-center justify-center mt-4 gap-1">
        {["🇳🇬", "🇬🇧", "🇺🇸", "🇨🇦", "🇰🇪", "🇬🇭", "🌍"].map((flag, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: i * 0.08, type: "spring", stiffness: 300, damping: 20 }}
            className="h-7 w-7 rounded-full border-2 border-white/20 flex items-center justify-center text-[10px] font-bold text-white shadow-lg"
            style={{
              background: [
                "linear-gradient(135deg, #38BDF8, #0284C7)",
                "linear-gradient(135deg, #003366, #0052a3)",
                "linear-gradient(135deg, #7DD3FC, #38BDF8)",
                "linear-gradient(135deg, #0284C7, #003366)",
                "linear-gradient(135deg, #38BDF8, #7DD3FC)",
                "linear-gradient(135deg, #003366, #38BDF8)",
                "linear-gradient(135deg, #7DD3FC, #0284C7)",
              ][i],
              marginLeft: i > 0 ? -8 : 0,
              zIndex: 7 - i,
            }}
          >
            {flag}
          </motion.div>
        ))}
        {total > 7 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.6, type: "spring" }}
            className="h-7 px-2 rounded-full border-2 border-white/20 bg-white/10 flex items-center justify-center text-white/70 text-[10px] font-bold ml-[-8px] z-0"
          >
            +{(total - 7).toLocaleString()}
          </motion.div>
        )}
      </div>

      {/* Region chips */}
      <div className="flex flex-wrap justify-center gap-2 mt-5 max-w-xs">
        {[
          { flag: "🇳🇬", label: "Nigeria" },
          { flag: "🇬🇧", label: "UK" },
          { flag: "🇺🇸", label: "USA" },
          { flag: "🇨🇦", label: "Canada" },
        ].map(({ flag, label }) => (
          <div
            key={label}
            className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-full px-3 py-1"
          >
            <span className="text-xs">{flag}</span>
            <span className="text-white/50 text-[10px] font-medium">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

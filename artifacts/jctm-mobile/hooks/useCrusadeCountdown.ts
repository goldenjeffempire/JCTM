import { useEffect, useState } from "react";

// Warri City Crusade 2026 — April 30, 18:00 WAT (UTC+1) → May 1, 21:00 WAT
const START_MS = Date.UTC(2026, 3, 30, 17, 0, 0);   // 2026-04-30T17:00Z = 18:00 WAT
const END_MS   = Date.UTC(2026, 4,  1, 20, 0, 0);   // 2026-05-01T20:00Z = 21:00 WAT

export type CrusadePhase = "before" | "live" | "ended";

export interface CrusadeCountdown {
  phase: CrusadePhase;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Raw ms remaining until the next milestone (start if before, end if live) */
  msRemaining: number;
}

function computeCountdown(now: number): CrusadeCountdown {
  if (now >= END_MS) {
    return { phase: "ended", days: 0, hours: 0, minutes: 0, seconds: 0, msRemaining: 0 };
  }

  if (now >= START_MS) {
    const ms = END_MS - now;
    return { phase: "live", ...breakMs(ms), msRemaining: ms };
  }

  const ms = START_MS - now;
  return { phase: "before", ...breakMs(ms), msRemaining: ms };
}

function breakMs(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const days    = Math.floor(totalSeconds / 86400);
  const hours   = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

export function useCrusadeCountdown(): CrusadeCountdown {
  const [state, setState] = useState<CrusadeCountdown>(() => computeCountdown(Date.now()));

  useEffect(() => {
    if (state.phase === "ended") return;
    const id = setInterval(() => setState(computeCountdown(Date.now())), 1000);
    return () => clearInterval(id);
  }, [state.phase]);

  return state;
}

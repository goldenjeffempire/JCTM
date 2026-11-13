import { useEffect, useState } from "react";
import { nextCrusadeOccurrence, type CrusadeCampaign } from "@workspace/content";
import { watDay, watTime } from "@/lib/crusade-format";

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function CrusadeCountdown({ campaign, compact = false }: { campaign: CrusadeCampaign; compact?: boolean }) {
  const now = useNow();
  const next = nextCrusadeOccurrence(campaign, now);

  if (!campaign.programs.some(p => p.published && p.startsAt.length > 0)) {
    return <p className="text-white/80 text-sm">No program is currently published. Please check back for schedule updates.</p>;
  }
  if (!next) {
    return (
      <div className="rounded-2xl border border-[#ffc93c]/30 bg-white/5 px-5 py-4" data-testid="status-crusade-concluded">
        <p className="text-[#ffc93c] text-xs font-bold uppercase tracking-[0.2em]">Concluded</p>
        <p className="text-white/80 text-sm mt-1">The End of Year Crusade 2026 has concluded. Thank you for gathering with us.</p>
      </div>
    );
  }

  const diff = Math.max(0, Date.parse(next.startsAt) - now);
  const s = Math.floor(diff / 1000);
  const units = [
    { v: Math.floor(s / 86400), l: "Days" },
    { v: Math.floor((s % 86400) / 3600), l: "Hours" },
    { v: Math.floor((s % 3600) / 60), l: "Mins" },
    { v: s % 60, l: "Secs" },
  ];

  return (
    <div data-testid="crusade-countdown">
      <p className="text-white/60 text-[11px] font-bold uppercase tracking-[0.22em] mb-2">
        Next: <span className="text-[#ffc93c]">{next.program.title}</span>
        <span className="block sm:inline sm:ml-2 normal-case tracking-normal font-medium text-white/70">
          {watDay(next.startsAt)} · {watTime(next.startsAt)} WAT
        </span>
      </p>
      <div className="flex gap-2" role="timer" aria-label={`Starts ${watDay(next.startsAt)} at ${watTime(next.startsAt)} West Africa Time`}>
        {units.map(u => (
          <div key={u.l} className={`flex flex-col items-center rounded-xl bg-[#060d26]/70 border border-white/10 ${compact ? "min-w-[52px] px-2 py-1.5" : "min-w-[64px] px-3 py-2.5"}`}>
            <span className={`font-mono font-bold tabular-nums text-white leading-none ${compact ? "text-xl" : "text-3xl"}`} aria-hidden="true">
              {String(u.v).padStart(2, "0")}
            </span>
            <span className="text-[9px] uppercase tracking-widest text-[#ffc93c]/80 mt-1" aria-hidden="true">{u.l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

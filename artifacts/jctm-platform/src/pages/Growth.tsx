import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { Link } from "wouter";
import {
  Flame, BookOpen, Mic2, Heart, Star, Trophy, Zap, Target,
  TrendingUp, Award, CheckCircle2, Lock, ChevronRight, Play,
  Calendar, Sparkles, Shield, Crown,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Types ─────────────────────────────────────────────────────────────────
interface GrowthData {
  sermons: number;
  devotions: number;
  prayers: number;
  daysActive: string[];
  lastActive: string;
  xp: number;
  level: number;
}

const DAILY_GOALS = { sermons: 2, devotions: 1, prayers: 2 };

const ACHIEVEMENTS = [
  { id: "first_sermon", icon: Play, label: "First Word", desc: "Watched your first sermon", xpReq: 10, color: "from-sky-400 to-blue-600" },
  { id: "sermon_5", icon: Mic2, label: "Word Seeker", desc: "Watched 5 sermons", xpReq: 50, color: "from-indigo-400 to-purple-600" },
  { id: "sermon_20", icon: BookOpen, label: "Bible Student", desc: "Watched 20 sermons", xpReq: 200, color: "from-violet-400 to-purple-700" },
  { id: "sermon_50", icon: Star, label: "Truth Hunter", desc: "Watched 50 sermons", xpReq: 500, color: "from-amber-400 to-orange-500" },
  { id: "sermon_100", icon: Trophy, label: "Temple Scholar", desc: "Watched 100 sermons", xpReq: 1000, color: "from-yellow-400 to-amber-600" },
  { id: "first_prayer", icon: Heart, label: "Prayer Warrior", desc: "Generated your first prayer", xpReq: 10, color: "from-rose-400 to-pink-600" },
  { id: "prayer_10", icon: Shield, label: "Intercessor", desc: "Generated 10 prayers", xpReq: 100, color: "from-red-400 to-rose-600" },
  { id: "first_devotion", icon: Sparkles, label: "Devoted", desc: "Read first daily devotion", xpReq: 10, color: "from-emerald-400 to-green-600" },
  { id: "devotion_7", icon: Calendar, label: "Faithful Seven", desc: "7-day devotion streak", xpReq: 70, color: "from-teal-400 to-emerald-600" },
  { id: "devotion_30", icon: Crown, label: "Month of Grace", desc: "30-day devotion streak", xpReq: 300, color: "from-gold-400 to-amber-500" },
  { id: "streak_3", icon: Flame, label: "On Fire", desc: "3-day active streak", xpReq: 30, color: "from-orange-400 to-red-500" },
  { id: "streak_7", icon: Zap, label: "Anointed", desc: "7-day active streak", xpReq: 70, color: "from-yellow-300 to-orange-500" },
  { id: "streak_30", icon: Award, label: "Covenant Walker", desc: "30-day active streak", xpReq: 300, color: "from-purple-400 to-indigo-600" },
];

const LEVELS = [
  { level: 1, name: "New Believer", minXp: 0, icon: "✦", color: "#64748b" },
  { level: 2, name: "Seeker", minXp: 50, icon: "⭐", color: "#3b82f6" },
  { level: 3, name: "Disciple", minXp: 150, icon: "🌟", color: "#8b5cf6" },
  { level: 4, name: "Intercessor", minXp: 350, icon: "🔥", color: "#f59e0b" },
  { level: 5, name: "Word Warrior", minXp: 700, icon: "⚡", color: "#ef4444" },
  { level: 6, name: "Temple Elder", minXp: 1200, icon: "👑", color: "#f97316" },
  { level: 7, name: "Mandate Bearer", minXp: 2000, icon: "✨", color: "#06b6d4" },
];

// ── Helpers ───────────────────────────────────────────────────────────────
function loadGrowth(): GrowthData {
  try {
    const s = localStorage.getItem("jctm-growth");
    if (s) return JSON.parse(s) as GrowthData;
  } catch {}
  return { sermons: 0, devotions: 0, prayers: 0, daysActive: [], lastActive: "", xp: 0, level: 1 };
}

function saveGrowth(d: GrowthData) {
  try {
    localStorage.setItem("jctm-growth", JSON.stringify(d));
  } catch {}
}

function computeStreak(daysActive: string[]): number {
  if (!daysActive.length) return 0;
  const unique = [...new Set(daysActive)].sort().reverse();
  let streak = 0;
  const today = new Date().toISOString().slice(0, 10);
  let check = today;
  for (const day of unique) {
    if (day === check) { streak++; const d = new Date(check); d.setDate(d.getDate() - 1); check = d.toISOString().slice(0, 10); }
    else break;
  }
  return streak;
}

function computeLevel(xp: number): { level: typeof LEVELS[0]; next: typeof LEVELS[0] | null; pct: number } {
  let current = LEVELS[0]!;
  for (const l of LEVELS) { if (xp >= l.minXp) current = l; }
  const idx = LEVELS.indexOf(current);
  const next = LEVELS[idx + 1] ?? null;
  const pct = next ? Math.min(((xp - current.minXp) / (next.minXp - current.minXp)) * 100, 100) : 100;
  return { level: current, next, pct };
}

function unlockedAchievements(g: GrowthData): string[] {
  const streak = computeStreak(g.daysActive);
  const unlocked: string[] = [];
  if (g.sermons >= 1) unlocked.push("first_sermon");
  if (g.sermons >= 5) unlocked.push("sermon_5");
  if (g.sermons >= 20) unlocked.push("sermon_20");
  if (g.sermons >= 50) unlocked.push("sermon_50");
  if (g.sermons >= 100) unlocked.push("sermon_100");
  if (g.prayers >= 1) unlocked.push("first_prayer");
  if (g.prayers >= 10) unlocked.push("prayer_10");
  if (g.devotions >= 1) unlocked.push("first_devotion");
  if (g.devotions >= 7) unlocked.push("devotion_7");
  if (g.devotions >= 30) unlocked.push("devotion_30");
  if (streak >= 3) unlocked.push("streak_3");
  if (streak >= 7) unlocked.push("streak_7");
  if (streak >= 30) unlocked.push("streak_30");
  return unlocked;
}

// ── Animated XP Bar ────────────────────────────────────────────────────────
function XpBar({ pct, color }: { pct: number; color: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  return (
    <div ref={ref} className="w-full h-3 rounded-full bg-primary/10 overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{ background: `linear-gradient(90deg, ${color}, ${color}aa)` }}
        initial={{ width: 0 }}
        animate={{ width: inView ? `${pct}%` : 0 }}
        transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
      />
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, goal, color, action, actionLabel }: {
  icon: React.ElementType; label: string; value: number; goal: number;
  color: string; action?: string; actionLabel?: string;
}) {
  const pct = Math.min((value / goal) * 100, 100);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5 }}
      className="glass-panel rounded-3xl p-6 flex flex-col gap-4 group hover:shadow-lg transition-all duration-300"
    >
      <div className="flex items-start justify-between">
        <div
          className="h-12 w-12 rounded-2xl flex items-center justify-center shadow-md"
          style={{ background: `linear-gradient(135deg, ${color}33, ${color}15)`, border: `1px solid ${color}40` }}
        >
          <Icon className="h-6 w-6" style={{ color }} />
        </div>
        <span className="text-4xl font-serif font-bold text-primary">{value.toLocaleString()}</span>
      </div>
      <div>
        <p className="text-sm font-semibold text-primary mb-1">{label}</p>
        <div className="w-full h-2 rounded-full bg-primary/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: color }}
            initial={{ width: 0 }}
            animate={{ width: inView ? `${pct}%` : 0 }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">{value} of {goal} today</p>
      </div>
      {action && actionLabel && (
        <Link href={action}>
          <Button size="sm" variant="outline" className="w-full text-xs gap-1 rounded-xl border-primary/20 hover:border-primary/50">
            {actionLabel} <ChevronRight className="h-3 w-3" />
          </Button>
        </Link>
      )}
    </motion.div>
  );
}

// ── Achievement Badge ──────────────────────────────────────────────────────
function AchievementBadge({ achievement, unlocked }: { achievement: typeof ACHIEVEMENTS[0]; unlocked: boolean }) {
  const Icon = achievement.icon;
  return (
    <motion.div
      whileHover={{ scale: 1.06, y: -4 }}
      className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all duration-300 cursor-default ${
        unlocked
          ? "bg-white dark:bg-white/5 border-primary/10 shadow-md"
          : "bg-primary/3 border-primary/5 opacity-50"
      }`}
      title={achievement.desc}
    >
      <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shadow-inner ${unlocked ? `bg-gradient-to-br ${achievement.color}` : "bg-muted"}`}>
        {unlocked ? (
          <Icon className="h-6 w-6 text-white" />
        ) : (
          <Lock className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
      <div className="text-center">
        <p className={`text-[11px] font-bold leading-tight ${unlocked ? "text-primary" : "text-muted-foreground"}`}>{achievement.label}</p>
        <p className="text-[9px] text-muted-foreground leading-tight mt-0.5 max-w-[80px]">{achievement.desc}</p>
      </div>
      {unlocked && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center shadow"
        >
          <CheckCircle2 className="h-3 w-3 text-white fill-white" />
        </motion.div>
      )}
    </motion.div>
  );
}

// ── Log Action Dialog ──────────────────────────────────────────────────────
function LogAction({ type, onLog }: { type: "sermon" | "devotion" | "prayer"; onLog: (t: "sermon" | "devotion" | "prayer") => void }) {
  const labels = { sermon: "Log Sermon Watched", devotion: "Log Devotion Read", prayer: "Log Prayer Done" };
  const icons = { sermon: Play, devotion: BookOpen, prayer: Heart };
  const Icon = icons[type];
  return (
    <motion.button
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      onClick={() => onLog(type)}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/5 hover:bg-primary/10 border border-primary/10 text-sm font-semibold text-primary transition-all duration-200"
    >
      <Icon className="h-4 w-4 text-accent" />
      {labels[type]}
    </motion.button>
  );
}

// ── Week Heatmap ───────────────────────────────────────────────────────────
function WeekHeatmap({ daysActive }: { daysActive: string[] }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
  const activeSet = new Set(daysActive);
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="flex gap-2 items-end">
      {days.map((day, i) => {
        const active = activeSet.has(day);
        const label = dayLabels[new Date(day).getDay()];
        return (
          <div key={day} className="flex flex-col items-center gap-1">
            <motion.div
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: i * 0.06, duration: 0.4 }}
              style={{ originY: 1 }}
              className={`w-8 rounded-lg transition-all ${
                active
                  ? "h-10 bg-gradient-to-t from-accent to-sky-300 shadow-md shadow-accent/30"
                  : "h-4 bg-primary/10"
              }`}
            />
            <span className="text-[9px] text-muted-foreground font-medium">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function Growth() {
  const [data, setData] = useState<GrowthData>(loadGrowth);
  const [toast, setToast] = useState<string | null>(null);
  const [newAchievements, setNewAchievements] = useState<string[]>([]);

  const streak = computeStreak(data.daysActive);
  const { level: currentLevel, next: nextLevel, pct: levelPct } = computeLevel(data.xp);
  const unlocked = unlockedAchievements(data);

  const markToday = () => {
    const today = new Date().toISOString().slice(0, 10);
    return today;
  };

  const log = (type: "sermon" | "devotion" | "prayer") => {
    const today = markToday();
    setData(prev => {
      const updated: GrowthData = {
        ...prev,
        sermons: type === "sermon" ? prev.sermons + 1 : prev.sermons,
        devotions: type === "devotion" ? prev.devotions + 1 : prev.devotions,
        prayers: type === "prayer" ? prev.prayers + 1 : prev.prayers,
        daysActive: prev.daysActive.includes(today) ? prev.daysActive : [...prev.daysActive, today],
        lastActive: today,
        xp: prev.xp + (type === "sermon" ? 10 : type === "devotion" ? 10 : 5),
        level: 1,
      };
      // Recalculate level
      let lvl = 1;
      for (const l of LEVELS) { if (updated.xp >= l.minXp) lvl = l.level; }
      updated.level = lvl;

      // Check new achievements
      const prevUnlocked = new Set(unlockedAchievements(prev));
      const newUnlocked = unlockedAchievements(updated).filter(a => !prevUnlocked.has(a));
      if (newUnlocked.length) setNewAchievements(newUnlocked);

      saveGrowth(updated);
      return updated;
    });
    const msgs = { sermon: "+10 XP — Word received!", devotion: "+10 XP — Faithful to the Word!", prayer: "+5 XP — Prayer logged!" };
    setToast(msgs[type]);
    setTimeout(() => setToast(null), 3000);
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const todaySermons = 0;
  const todayDevotions = 0;
  const todayPrayers = 0;

  return (
    <Layout>
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 glass-panel px-6 py-3 rounded-2xl border border-accent/30 shadow-xl flex items-center gap-2"
          >
            <Sparkles className="h-4 w-4 text-accent" />
            <span className="font-semibold text-primary text-sm">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Achievement Unlock */}
      <AnimatePresence>
        {newAchievements.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 20 }}
            className="fixed bottom-8 right-6 z-50 glass-panel px-6 py-5 rounded-3xl border border-amber-400/40 shadow-2xl max-w-xs"
          >
            <div className="flex items-center gap-3 mb-2">
              <Trophy className="h-6 w-6 text-amber-500" />
              <span className="font-bold text-primary">Achievement Unlocked!</span>
            </div>
            {newAchievements.map(id => {
              const a = ACHIEVEMENTS.find(x => x.id === id);
              return a ? (
                <div key={id} className="text-sm text-muted-foreground">{a.label} — {a.desc}</div>
              ) : null;
            })}
            <button onClick={() => setNewAchievements([])} className="absolute top-3 right-3 text-muted-foreground hover:text-primary">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="container mx-auto px-4 py-16 max-w-5xl">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-accent to-blue-600 flex items-center justify-center shadow-lg">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <Badge className="bg-accent/10 text-accent border-accent/20 text-xs font-bold">VISION 2030</Badge>
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary mb-3">
            Spiritual Growth Tracker
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Track your journey in the Word. Every sermon watched, devotion read, and prayer offered builds your spiritual walk — and your XP.
          </p>
        </motion.div>

        {/* Level Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6 }}
          className="glass-panel rounded-3xl p-7 mb-8 relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${currentLevel.color}12, transparent)`, border: `1px solid ${currentLevel.color}30` }}
        >
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-5" style={{ background: `radial-gradient(circle, ${currentLevel.color}, transparent)`, transform: "translate(30%, -30%)" }} />
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 relative">
            <div className="flex items-center gap-4">
              <div className="text-5xl">{currentLevel.icon}</div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Level {currentLevel.level}</p>
                <h2 className="text-2xl font-serif font-bold text-primary">{currentLevel.name}</h2>
                <p className="text-sm text-muted-foreground">{data.xp.toLocaleString()} XP total</p>
              </div>
            </div>
            <div className="flex-1 w-full sm:w-auto">
              {nextLevel ? (
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-2">
                    <span>{currentLevel.name}</span>
                    <span>{nextLevel.name} at {nextLevel.minXp} XP</span>
                  </div>
                  <XpBar pct={levelPct} color={currentLevel.color} />
                  <p className="text-xs text-muted-foreground mt-1">{Math.round(levelPct)}% to {nextLevel.icon} {nextLevel.name}</p>
                </div>
              ) : (
                <div className="text-sm font-semibold text-primary">🏆 Max Level Achieved!</div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Streak + Heatmap */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-panel rounded-3xl p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Flame className="h-5 w-5 text-orange-500" />
              <h3 className="font-bold text-primary">Active Streak</h3>
            </div>
            <div className="text-6xl font-serif font-bold text-orange-500 mb-1">{streak}</div>
            <p className="text-muted-foreground text-sm mb-4">{streak === 1 ? "day" : "days"} in a row — {streak >= 7 ? "🔥 Anointed!" : streak >= 3 ? "Keep it up!" : "Keep going!"}</p>
            <div className="text-xs text-muted-foreground">Total active: <strong className="text-primary">{new Set(data.daysActive).size} days</strong></div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="glass-panel rounded-3xl p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="h-5 w-5 text-accent" />
              <h3 className="font-bold text-primary">This Week</h3>
            </div>
            <WeekHeatmap daysActive={data.daysActive} />
          </motion.div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <StatCard
            icon={Mic2}
            label="Sermons Watched"
            value={data.sermons}
            goal={Math.max(DAILY_GOALS.sermons, data.sermons + 1)}
            color="#003366"
            action="/sermons"
            actionLabel="Go to Sermon Hub"
          />
          <StatCard
            icon={BookOpen}
            label="Devotions Completed"
            value={data.devotions}
            goal={Math.max(DAILY_GOALS.devotions, data.devotions + 1)}
            color="#38BDF8"
            action="/"
            actionLabel="Today's Devotion"
          />
          <StatCard
            icon={Heart}
            label="Prayers Generated"
            value={data.prayers}
            goal={Math.max(DAILY_GOALS.prayers, data.prayers + 1)}
            color="#ec4899"
            action="/prayer"
            actionLabel="Generate Prayer"
          />
        </div>

        {/* Log Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-panel rounded-3xl p-6 mb-8"
        >
          <h3 className="font-bold text-primary mb-1 flex items-center gap-2">
            <Target className="h-4 w-4 text-accent" />
            Log Today's Activity
          </h3>
          <p className="text-sm text-muted-foreground mb-4">Tap to record what you've done today and earn XP.</p>
          <div className="flex flex-wrap gap-3">
            <LogAction type="sermon" onLog={log} />
            <LogAction type="devotion" onLog={log} />
            <LogAction type="prayer" onLog={log} />
          </div>
        </motion.div>

        {/* Achievements */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex items-center gap-2 mb-5">
            <Trophy className="h-5 w-5 text-amber-500" />
            <h3 className="font-bold text-primary text-xl">Achievements</h3>
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs ml-auto">
              {unlocked.length}/{ACHIEVEMENTS.length} unlocked
            </Badge>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-3">
            {ACHIEVEMENTS.map(a => (
              <AchievementBadge key={a.id} achievement={a} unlocked={unlocked.includes(a.id)} />
            ))}
          </div>
        </motion.div>

        {/* Reset */}
        <div className="mt-12 text-center">
          <button
            onClick={() => {
              if (confirm("Reset all your progress? This cannot be undone.")) {
                const reset: GrowthData = { sermons: 0, devotions: 0, prayers: 0, daysActive: [], lastActive: "", xp: 0, level: 1 };
                setData(reset);
                saveGrowth(reset);
              }
            }}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors underline-offset-4 hover:underline"
          >
            Reset Progress
          </button>
        </div>
      </div>
    </Layout>
  );
}

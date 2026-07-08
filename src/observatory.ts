import { Block, Checkin, Goal } from "./db/index.js";
import { GOD_IDS } from "./pantheon.js";
import type { GodId } from "./types.js";

function localDay(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export interface Observatory {
  radar: Array<{ godId: GodId; title: string; baseline: number | null; current: number | null }>;
  bars: Array<{ godId: GodId; planned: number; done: number; pct: number | null }>;
  stars: Array<{ date: string; executionPct: number; count: number }>;
  candor: { streak: number; totalAnswers: number };
  /** Concrete "this week you actually did X" tallies from done blocks. */
  metrics: Array<{ godId: GodId; label: string; count: number; hours: number }>;
}

const METRIC_DEFS: Array<{ godId: GodId; label: string }> = [
  { godId: "athena", label: "Deep focus" },
  { godId: "asclepius", label: "Trained" },
  { godId: "hestia", label: "Saw people" },
  { godId: "hermes", label: "Tasks cleared" },
  { godId: "apollo", label: "Craft & growth" },
];

const PLANNED = new Set(["scheduled", "done", "moved", "skipped"]);

/** Datasets for the Observatory (visualizer skill) — all computed in code. */
export async function buildObservatory(userId: string): Promise<Observatory> {
  const now = new Date();
  const from = startOfDay(now);
  from.setDate(from.getDate() - 28);

  const [goals, blocks, totalAnswers] = await Promise.all([
    Goal.find({ userId, status: "active" }).lean(),
    Block.find({ userId, start: { $gte: from } }).sort({ start: 1 }).lean(),
    Checkin.countDocuments({ userId }),
  ]);

  const radar = goals.map((g) => ({
    godId: g.godId,
    title: g.title,
    baseline: g.wheelBaseline ?? null,
    current: g.wheelCurrent ?? g.wheelBaseline ?? null,
  }));

  const byGod: Record<string, { planned: number; done: number }> = {};
  const byDay: Record<string, { planned: number; done: number }> = {};
  for (const b of blocks) {
    if (!PLANNED.has(b.status)) continue;
    (byGod[b.godId] ??= { planned: 0, done: 0 }).planned++;
    const key = new Date(b.start).toISOString().slice(0, 10);
    (byDay[key] ??= { planned: 0, done: 0 }).planned++;
    if (b.status === "done") {
      byGod[b.godId].done++;
      byDay[key].done++;
    }
  }

  const bars = (GOD_IDS.filter((g) => g !== "zeus")).map((g) => {
    const s = byGod[g] ?? { planned: 0, done: 0 };
    return { godId: g, planned: s.planned, done: s.done, pct: s.planned ? Math.round((s.done / s.planned) * 100) : null };
  });

  const stars = Object.entries(byDay)
    .map(([date, s]) => ({ date, executionPct: s.planned ? Math.round((s.done / s.planned) * 100) : 0, count: s.planned }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Candor streak: consecutive days (up to today) on which he gave any honest answer.
  const answerDays = new Set(
    blocks.filter((b) => ["done", "moved", "skipped"].includes(b.status)).map((b) => localDay(new Date(b.start))),
  );
  let streak = 0;
  const cur = startOfDay(now);
  if (!answerDays.has(localDay(cur))) cur.setDate(cur.getDate() - 1);
  while (answerDays.has(localDay(cur))) {
    streak++;
    cur.setDate(cur.getDate() - 1);
  }

  // Concrete tallies from the last 7 days of DONE blocks.
  const weekAgo = startOfDay(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const doneThisWeek = blocks.filter((b) => b.status === "done" && new Date(b.start) >= weekAgo);
  const metrics = METRIC_DEFS.map((d) => {
    const bs = doneThisWeek.filter((b) => b.godId === d.godId);
    const minutes = bs.reduce((s, b) => s + (new Date(b.end).getTime() - new Date(b.start).getTime()) / 60000, 0);
    return { godId: d.godId, label: d.label, count: bs.length, hours: Math.round((minutes / 60) * 10) / 10 };
  });

  return { radar, bars, stars, candor: { streak, totalAnswers }, metrics };
}

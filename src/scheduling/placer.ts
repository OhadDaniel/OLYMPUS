import type { TimePreference } from "../domain.js";
import type { GodId } from "../types.js";
import type {
  BusyInterval,
  Placement,
  PlacerConstraints,
  PlacerInput,
  PlacerResult,
  Unplaced,
} from "./types.js";

/**
 * Pure schedule placer (owned by the week-planner skill). Priority-ordered
 * greedy fit of intents into free time, honoring the busy grid, 15-min buffers,
 * quiet hours, no-work windows, day/time preferences, and allowed days. Never
 * drops silently — anything that won't fit comes back in `unplaced`.
 *
 * Operates in the host's local wall-clock (getHours/getDate), which is what the
 * product wants ("place my morning at 8am") and keeps it TZ-cancelling for tests.
 */

const STEP_MIN = 15;
const WORK_GODS: ReadonlySet<GodId> = new Set<GodId>(["athena", "hermes"]);

const PREFERENCE_WINDOWS: Record<TimePreference, [number, number]> = {
  early_morning: [5 * 60, 8 * 60],
  morning: [8 * 60, 12 * 60],
  lunch: [12 * 60, 13 * 60 + 30],
  afternoon: [14 * 60, 18 * 60],
  evening: [18 * 60, 22 * 60],
};

function parseHM(hm: string): number {
  const [h, m] = hm.split(":").map((n) => parseInt(n, 10));
  return (h ?? 0) * 60 + (m ?? 0);
}
function minutesOf(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}
function atMinutes(day: Date, minutes: number): Date {
  const d = new Date(day);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(minutes);
  return d;
}
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function eachDay(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  while (cur < end) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function overlapsBusy(
  startMs: number,
  endMs: number,
  occupied: BusyInterval[],
  bufferMs: number,
): boolean {
  for (const o of occupied) {
    if (startMs < o.end.getTime() + bufferMs && endMs + bufferMs > o.start.getTime()) return true;
  }
  return false;
}

function overlapsQuiet(candStart: number, candEnd: number, quiet: { start: string; end: string }): boolean {
  const qs = parseHM(quiet.start);
  const qe = parseHM(quiet.end);
  const segments: Array<[number, number]> = qs < qe ? [[qs, qe]] : [[qs, 1440], [0, qe]];
  return segments.some(([s, e]) => candStart < e && candEnd > s);
}

export function placeIntents(input: PlacerInput): PlacerResult {
  const c: Required<Omit<PlacerConstraints, "quietHours" | "noWorkAfter">> &
    Pick<PlacerConstraints, "quietHours" | "noWorkAfter"> = {
    dayStart: input.constraints?.dayStart ?? "07:00",
    dayEnd: input.constraints?.dayEnd ?? "22:00",
    bufferMin: input.constraints?.bufferMin ?? 15,
    ...(input.constraints?.quietHours ? { quietHours: input.constraints.quietHours } : {}),
    ...(input.constraints?.noWorkAfter ? { noWorkAfter: input.constraints.noWorkAfter } : {}),
  };

  const dayStartMin = parseHM(c.dayStart);
  const dayEndMin = parseHM(c.dayEnd);
  const bufferMs = c.bufferMin * 60_000;
  const noWorkAfterMin = c.noWorkAfter ? parseHM(c.noWorkAfter) : null;

  const occupied: BusyInterval[] = input.busy.map((b) => ({ start: b.start, end: b.end }));
  const notBefore = input.notBefore ? input.notBefore.getTime() : null;
  const days = eachDay(input.windowStart, input.windowEnd);

  const sorted = [...input.intents].sort(
    (a, b) =>
      Number(b.isAnchor) - Number(a.isAnchor) ||
      b.priority - a.priority ||
      b.durationMin - a.durationMin ||
      a.id.localeCompare(b.id),
  );

  const placements: Placement[] = [];
  const unplaced: Unplaced[] = [];

  for (const intent of sorted) {
    const freq = Math.max(0, Math.floor(intent.frequencyPerWeek));
    const prefs: (TimePreference | "__day__")[] =
      intent.timePreferences.length > 0 ? intent.timePreferences : ["__day__"];
    const usedDays = new Set<string>();
    let count = 0;

    for (const day of days) {
      if (count >= freq) break;
      if (intent.daysAllowed && !intent.daysAllowed.includes(day.getDay())) continue;
      if (usedDays.has(dayKey(day))) continue;

      for (const pref of prefs) {
        const win = pref === "__day__" ? [dayStartMin, dayEndMin] : PREFERENCE_WINDOWS[pref];
        let ps = Math.max(win[0], dayStartMin);
        let pe = Math.min(win[1], dayEndMin);
        if (noWorkAfterMin !== null && WORK_GODS.has(intent.godId)) pe = Math.min(pe, noWorkAfterMin);
        if (pe - ps < intent.durationMin) continue;

        let placed = false;
        for (let t = ps; t + intent.durationMin <= pe; t += STEP_MIN) {
          if (c.quietHours && overlapsQuiet(t, t + intent.durationMin, c.quietHours)) continue;
          const start = atMinutes(day, t);
          const end = atMinutes(day, t + intent.durationMin);
          if (notBefore !== null && start.getTime() < notBefore) continue;
          if (overlapsBusy(start.getTime(), end.getTime(), occupied, bufferMs)) continue;

          placements.push({
            intentId: intent.id,
            godId: intent.godId,
            title: intent.title,
            start,
            end,
            isAnchor: intent.isAnchor,
          });
          occupied.push({ start, end });
          usedDays.add(dayKey(day));
          count += 1;
          placed = true;
          break;
        }
        if (placed) break;
      }
    }

    if (count < freq) {
      unplaced.push({
        intentId: intent.id,
        title: intent.title,
        remaining: freq - count,
        reason:
          count === 0
            ? "no free slot matched its time/day constraints"
            : `only ${count} of ${freq} sessions fit`,
      });
    }
  }

  placements.sort((a, b) => a.start.getTime() - b.start.getTime());
  return { placements, unplaced };
}

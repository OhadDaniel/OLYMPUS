import { describe, expect, it } from "vitest";
import { placeIntents } from "./placer.js";
import type { Intent } from "./types.js";

// Fixed local week: 2026-07-06 (Mon) .. 2026-07-13.
const d = (day: number, h: number, m = 0) => new Date(2026, 6, day, h, m, 0, 0);
const WINDOW = { windowStart: d(6, 0), windowEnd: d(13, 0) };
const minsOf = (x: Date) => x.getHours() * 60 + x.getMinutes();

function intent(over: Partial<Intent>): Intent {
  return {
    id: "i1",
    godId: "apollo",
    title: "Read",
    durationMin: 60,
    frequencyPerWeek: 1,
    priority: 3,
    timePreferences: ["morning"],
    isAnchor: false,
    rationale: "",
    ...over,
  };
}

describe("placeIntents", () => {
  it("places a morning intent at the start of the morning window", () => {
    const { placements, unplaced } = placeIntents({ ...WINDOW, intents: [intent({})], busy: [] });
    expect(placements).toHaveLength(1);
    expect(minsOf(placements[0]!.start)).toBe(8 * 60);
    expect(unplaced).toHaveLength(0);
  });

  it("avoids busy intervals with a 15-min buffer", () => {
    const { placements } = placeIntents({
      ...WINDOW,
      intents: [intent({})],
      busy: [{ start: d(6, 8), end: d(6, 9) }],
    });
    expect(placements).toHaveLength(1);
    // 08:00–09:00 busy, +15 buffer → earliest is 09:15
    expect(minsOf(placements[0]!.start)).toBe(9 * 60 + 15);
  });

  it("spreads frequency across distinct days", () => {
    const { placements } = placeIntents({
      ...WINDOW,
      intents: [intent({ frequencyPerWeek: 3 })],
      busy: [],
    });
    expect(placements).toHaveLength(3);
    const days = new Set(placements.map((p) => p.start.getDate()));
    expect(days.size).toBe(3);
  });

  it("returns unplaced when there is no room", () => {
    const busy = [6, 7, 8, 9, 10, 11, 12].map((day) => ({ start: d(day, 7), end: d(day, 22) }));
    const { placements, unplaced } = placeIntents({
      ...WINDOW,
      intents: [intent({ timePreferences: [] })],
      busy,
    });
    expect(placements).toHaveLength(0);
    expect(unplaced).toHaveLength(1);
    expect(unplaced[0]!.remaining).toBe(1);
  });

  it("respects daysAllowed", () => {
    const only = WINDOW.windowStart.getDay();
    const { placements, unplaced } = placeIntents({
      ...WINDOW,
      intents: [intent({ frequencyPerWeek: 2, daysAllowed: [only], timePreferences: [] })],
      busy: [],
    });
    expect(placements).toHaveLength(1); // one matching weekday in a 7-day window
    expect(unplaced[0]!.remaining).toBe(1);
  });

  it("respects quiet hours", () => {
    const { placements } = placeIntents({
      ...WINDOW,
      intents: [intent({ timePreferences: [] })],
      busy: [],
      constraints: { quietHours: { start: "00:00", end: "09:00" } },
    });
    expect(minsOf(placements[0]!.start)).toBe(9 * 60);
  });

  it("keeps work-domain gods out of no-work windows", () => {
    const { placements, unplaced } = placeIntents({
      ...WINDOW,
      intents: [intent({ godId: "athena", title: "Strategy", timePreferences: ["evening"] })],
      busy: [],
      constraints: { noWorkAfter: "17:00" },
    });
    expect(placements).toHaveLength(0);
    expect(unplaced).toHaveLength(1);
  });
});

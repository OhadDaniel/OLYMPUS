import { USER_ID } from "../src/config.js";
import {
  AgentAction,
  Block,
  ChatSession,
  Checkin,
  Cycle,
  EmailInsight,
  Episode,
  Goal,
  ImportedEvent,
  Job,
  Memory,
  Message,
  Proposal,
  Scroll,
  connectDb,
  disconnectDb,
} from "../src/db/index.js";
import { computeFollowThrough } from "../src/workflows/consolidation.js";
import type { GodId } from "../src/types.js";

// Deterministic RNG (mulberry32) so seeds are reproducible.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(1337);
const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)]!;

async function wipe(): Promise<void> {
  const f = { userId: USER_ID };
  await Promise.all([
    Scroll.deleteMany(f),
    Goal.deleteMany(f),
    Cycle.deleteMany(f),
    Block.deleteMany(f),
    Checkin.deleteMany(f),
    ImportedEvent.deleteMany(f),
    EmailInsight.deleteMany(f),
    Episode.deleteMany(f),
    Memory.deleteMany(f),
    Proposal.deleteMany(f),
    ChatSession.deleteMany(f),
    Message.deleteMany(f),
    AgentAction.deleteMany(f),
    Job.deleteMany(f),
  ]);
  // GoogleToken + TelegramLink + EvalRun are preserved (real connections / history).
}

const TITLES: Record<GodId, string[]> = {
  zeus: ["Weekly review"],
  athena: ["Deep work", "Job applications", "Strategy block"],
  asclepius: ["Morning run", "Gym", "Wind down"],
  hermes: ["Inbox zero", "Errands", "Admin & bills"],
  hestia: ["Dinner with family", "Call a friend", "Family time"],
  apollo: ["Read", "Journal", "Practice guitar"],
};
// [startHour, durationMin] per god
const SLOT: Record<GodId, [number, number]> = {
  zeus: [9, 30],
  athena: [8, 90],
  asclepius: [7, 45],
  hermes: [16, 45],
  hestia: [19, 90],
  apollo: [21, 30],
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

async function seed(): Promise<void> {
  await wipe();
  const today = startOfDay(new Date());

  // ── Cycles: 3 past weekly + 1 current (council-anchored, Sat 18:00) ──
  const cycles: Array<{ id: string; start: Date; end: Date }> = [];
  for (let w = -3; w <= 0; w++) {
    const start = new Date(today);
    start.setDate(start.getDate() + w * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const councilAt = new Date(end);
    councilAt.setHours(18, 0, 0, 0);
    const doc = await Cycle.create({
      userId: USER_ID,
      startsOn: start,
      endsOn: end,
      councilAt,
      kind: w === -3 ? "bridge" : "full",
      executionScore: 70 + Math.floor(rng() * 18),
    });
    cycles.push({ id: String(doc._id), start, end });
  }
  const cycleFor = (d: Date) => cycles.find((c) => d >= c.start && d < c.end)?.id;

  const gods = Object.keys(TITLES) as GodId[];
  let candorDays = 0;

  // ── Blocks + check-ins across 21 past days + current week ──
  for (let offset = -21; offset <= 6; offset++) {
    const day = new Date(today);
    day.setDate(day.getDate() + offset);
    const dip = rng() < 0.18; // occasional low-adherence day
    // 2–3 domains per day
    const dayGods = gods.filter((g) => g !== "zeus" && rng() < 0.45).slice(0, 3);
    if (offset % 7 === 6) dayGods.unshift("zeus"); // weekly review on Saturdays
    let didCheckin = false;

    for (const godId of dayGods) {
      const [h, dur] = SLOT[godId];
      const start = new Date(day);
      start.setHours(h, 0, 0, 0);
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + dur);

      let status: string;
      if (offset >= 0) status = "scheduled";
      else {
        // ~78% done on normal days, dips lower it; the rest split moved/skipped.
        const r = rng() * (dip ? 0.68 : 1);
        status = r < 0.8 ? "done" : r < 0.91 ? "moved" : "skipped";
      }
      const block = await Block.create({
        userId: USER_ID,
        godId,
        title: pick(TITLES[godId]),
        start,
        end,
        status,
        isAnchor: godId === "asclepius" && rng() < 0.4,
        ...(cycleFor(day) ? { cycleId: cycleFor(day) } : {}),
      });

      if (offset < 0 && ["done", "moved", "skipped"].includes(status)) {
        await Checkin.create({
          userId: USER_ID,
          blockId: String(block._id),
          response: status as "done" | "moved" | "skipped",
          via: rng() < 0.5 ? "telegram" : "web",
        });
        didCheckin = true;
      }
    }
    if (didCheckin && offset >= -13) candorDays += 1;
  }

  // ── Imported outer-world events ──
  for (let offset = -5; offset <= 6; offset++) {
    const day = new Date(today);
    day.setDate(day.getDate() + offset);
    if (day.getDay() === 0 || day.getDay() === 6) continue; // weekdays
    const start = new Date(day);
    start.setHours(11, 0, 0, 0);
    const end = new Date(start);
    end.setHours(11, 30, 0, 0);
    await ImportedEvent.create({
      userId: USER_ID,
      gcalId: `seed-standup-${offset}`,
      title: "Team standup",
      start,
      end,
      lastSyncedAt: new Date(),
    });
  }
  const dentist = new Date(today);
  dentist.setDate(dentist.getDate() + 3);
  dentist.setHours(15, 0, 0, 0);
  await ImportedEvent.create({
    userId: USER_ID,
    gcalId: "seed-dentist",
    title: "Dentist",
    start: dentist,
    end: new Date(dentist.getTime() + 45 * 60000),
    lastSyncedAt: new Date(),
  });

  // ── Email insights (the "Maxwell noticed…" wow) ──
  await EmailInsight.create({
    userId: USER_ID,
    sourceMsgId: "seed-msg-1",
    summary: "Dentist appointment Thursday 15:00 (confirmation email)",
    when: dentist,
    godId: "asclepius",
    handled: false,
  });
  await EmailInsight.create({
    userId: USER_ID,
    sourceMsgId: "seed-msg-2",
    summary: "Reply to recruiter about the interview by Friday",
    godId: "athena",
    handled: false,
  });

  // ── Goals: wheel baseline vs improved + named goals ──
  const wheel: Array<[GodId, number, number, string]> = [
    ["athena", 6, 7, "Land a better role"],
    ["asclepius", 4, 6, "Sleep 7h, train 3×/week"],
    ["hermes", 5, 6, "Zero open loops by Friday"],
    ["hestia", 7, 8, "Weekly dinner with family"],
    ["apollo", 3, 5, "Finish the book I keep starting"],
  ];
  for (const [godId, base, now, title] of wheel) {
    await Goal.create({ userId: USER_ID, godId, title, status: "active", wheelBaseline: base, wheelCurrent: now });
  }

  // ── Episodes (incl. one prior council) ──
  await Episode.create({ userId: USER_ID, kind: "first_meeting", summary: "First Meeting completed for Ohad.", tags: ["onboarding"], consolidated: true });
  await Episode.create({ userId: USER_ID, kind: "council", summary: "Prior weekly council: 5 gods reported; execution 78%.", tags: ["council"], consolidated: true });
  await Episode.create({ userId: USER_ID, kind: "checkin", summary: "Held mornings well; evenings slipped twice.", tags: ["adherence"], consolidated: true });

  // ── Scroll v-seed ──
  await Scroll.create({
    userId: USER_ID,
    version: 5,
    profile: {
      identity: { name: "Ohad", timezone: "Asia/Jerusalem" },
      preferences: { tone: "balanced", quietHours: { start: "22:00", end: "07:00" } },
      constraints: ["no work after 21:00"],
      energyMap: { chronotype: "morning", bestFocus: ["morning"] },
      people: [{ name: "family", relation: "family", notes: "weekly dinner matters" }],
      learned: [
        { week: new Date(today).toISOString().slice(0, 10), insight: "Mornings are his reliable focus window." },
        { week: new Date(today).toISOString().slice(0, 10), insight: "Evening blocks after 21:00 rarely hold." },
      ],
    },
  });

  await computeFollowThrough(USER_ID); // fills profile.followThrough from the seeded blocks

  const [blocks, checkins] = await Promise.all([
    Block.countDocuments({ userId: USER_ID }),
    Checkin.countDocuments({ userId: USER_ID }),
  ]);
  console.log(`seeded: ${blocks} blocks, ${checkins} checkins, ~${candorDays}-day candor streak, 4 cycles, 5 goals, 2 email insights.`);
}

async function main(): Promise<void> {
  await connectDb();
  if (process.argv.includes("--wipe")) {
    await wipe();
    console.log("wiped all seed data for", USER_ID);
  } else {
    await seed();
  }
  await disconnectDb();
}

main().catch((e) => {
  console.error("seed failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});

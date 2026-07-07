import { Block, Checkin, Goal, ImportedEvent, type IBlock } from "../db/models/index.js";
import { GOD_IDS } from "../pantheon.js";
import type { GodId } from "../types.js";

/** All week arithmetic lives here (observer skill) — the model never computes stats. */
export function aggregateWeek(blocks: Array<Pick<IBlock, "godId" | "status">>) {
  const byGod = Object.fromEntries(GOD_IDS.map((g) => [g, 0])) as Record<GodId, number>;
  const byStatus: Record<string, number> = {};
  const perGod = Object.fromEntries(GOD_IDS.map((g) => [g, { planned: 0, done: 0 }])) as Record<
    GodId,
    { planned: number; done: number }
  >;
  const PLANNED = new Set(["scheduled", "done", "moved", "skipped"]);
  let planned = 0;
  let done = 0;

  for (const b of blocks) {
    byGod[b.godId] = (byGod[b.godId] ?? 0) + 1;
    byStatus[b.status] = (byStatus[b.status] ?? 0) + 1;
    if (PLANNED.has(b.status)) {
      planned += 1;
      perGod[b.godId].planned += 1;
      if (b.status === "done") {
        done += 1;
        perGod[b.godId].done += 1;
      }
    }
  }

  const pct = (dn: number, pl: number) => (pl > 0 ? Math.round((dn / pl) * 100) : null);
  const perGodAdherence = Object.fromEntries(
    GOD_IDS.map((g) => [g, { ...perGod[g], pct: pct(perGod[g].done, perGod[g].planned) }]),
  );

  return { totalBlocks: blocks.length, byGod, byStatus, planned, done, adherencePct: pct(done, planned), perGod: perGodAdherence };
}

export interface WeekView {
  range: { from: string; to: string };
  stats: ReturnType<typeof aggregateWeek>;
  blocks: Array<{
    id: string;
    godId: GodId;
    title: string;
    start: string;
    end: string;
    status: string;
    isAnchor: boolean;
  }>;
  outerWorld: Array<{ id: string; title: string; start: string; end: string }>;
  goals: Array<{ godId: GodId; title: string; status: string; wheelBaseline: number | null; wheelCurrent: number | null }>;
  checkins: Array<{ blockId: string; response: string; via: string }>;
}

/** Read a range of the Loom: designed blocks + the outer world + checkins + goals + stats. */
export async function readWeek(userId: string, from: Date, to: Date): Promise<WeekView> {
  const inRange = { start: { $lt: to }, end: { $gt: from } };
  const [blocks, imported, goals] = await Promise.all([
    Block.find({ userId, ...inRange }).sort({ start: 1 }).lean(),
    ImportedEvent.find({ userId, ...inRange }).sort({ start: 1 }).lean(),
    Goal.find({ userId, status: "active" }).lean(),
  ]);
  const blockIds = blocks.map((b) => String(b._id));
  const checkins = await Checkin.find({ userId, blockId: { $in: blockIds } }).lean();

  return {
    range: { from: from.toISOString(), to: to.toISOString() },
    stats: aggregateWeek(blocks),
    blocks: blocks.map((b) => ({
      id: String(b._id),
      godId: b.godId,
      title: b.title,
      start: b.start.toISOString(),
      end: b.end.toISOString(),
      status: b.status,
      isAnchor: b.isAnchor,
    })),
    outerWorld: imported.map((e) => ({
      id: String(e._id),
      title: e.title,
      start: e.start.toISOString(),
      end: e.end.toISOString(),
    })),
    goals: goals.map((g) => ({
      godId: g.godId,
      title: g.title,
      status: g.status,
      wheelBaseline: g.wheelBaseline ?? null,
      wheelCurrent: g.wheelCurrent ?? null,
    })),
    checkins: checkins.map((c) => ({ blockId: c.blockId, response: c.response, via: c.via })),
  };
}

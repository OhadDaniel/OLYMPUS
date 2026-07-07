import { z } from "zod";
import { Block, Checkin, Goal, ImportedEvent, type IBlock } from "../db/models/index.js";
import { GOD_IDS } from "../pantheon.js";
import { defineTool, type GodId } from "../types.js";

const schema = z.object({
  from: z.string().nullish(),
  to: z.string().nullish(),
  days: z.number().int().min(1).max(28).nullish(),
});

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** All arithmetic lives here, in code — the model never computes stats. */
function aggregate(blocks: Array<Pick<IBlock, "godId" | "status">>) {
  const byGod = Object.fromEntries(GOD_IDS.map((g) => [g, 0])) as Record<GodId, number>;
  const byStatus: Record<string, number> = {};
  const perGod = Object.fromEntries(
    GOD_IDS.map((g) => [g, { planned: 0, done: 0 }]),
  ) as Record<GodId, { planned: number; done: number }>;

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

  const pct = (d: number, p: number) => (p > 0 ? Math.round((d / p) * 100) : null);
  const perGodAdherence = Object.fromEntries(
    GOD_IDS.map((g) => [g, { ...perGod[g], pct: pct(perGod[g].done, perGod[g].planned) }]),
  );

  return {
    totalBlocks: blocks.length,
    byGod,
    byStatus,
    planned,
    done,
    adherencePct: pct(done, planned),
    perGod: perGodAdherence,
  };
}

export const getWeekTool = defineTool({
  name: "get_week",
  description:
    "Read the Loom — the designed schedule of record — for a date range: Maxwell's god-colored blocks, the imported outer-world (Google) events they sit over, check-ins, active goals, and pre-computed adherence stats. Defaults to the next 7 days. Use this before discussing his week.",
  risk: "read_only",
  source: "native",
  scope: "all",
  schema,
  parameters: {
    type: "object",
    properties: {
      from: { type: ["string", "null"], description: "ISO start datetime. null → start of today." },
      to: { type: ["string", "null"], description: "ISO end datetime. null → from + days." },
      days: { type: ["integer", "null"], description: "Window length in days (default 7). null → 7." },
    },
    required: ["from", "to", "days"],
    additionalProperties: false,
  },
  execute: async (args, ctx) => {
    ctx.emit({ type: "status", text: "Reading the Loom…" });
    const now = ctx.now();
    const from = args.from ? new Date(args.from) : startOfDay(now);
    const to = args.to ? new Date(args.to) : addDays(from, args.days ?? 7);

    const inRange = { start: { $lt: to }, end: { $gt: from } };
    const [blocks, imported, goals] = await Promise.all([
      Block.find({ userId: ctx.userId, ...inRange }).sort({ start: 1 }).lean(),
      ImportedEvent.find({ userId: ctx.userId, ...inRange }).sort({ start: 1 }).lean(),
      Goal.find({ userId: ctx.userId, status: "active" }).lean(),
    ]);
    const blockIds = blocks.map((b) => String(b._id));
    const checkins = await Checkin.find({ userId: ctx.userId, blockId: { $in: blockIds } }).lean();

    return JSON.stringify({
      ok: true,
      range: { from: from.toISOString(), to: to.toISOString() },
      stats: aggregate(blocks),
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
    });
  },
});

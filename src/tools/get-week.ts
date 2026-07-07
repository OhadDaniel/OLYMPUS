import { z } from "zod";
import { readWeek } from "../scheduling/week.js";
import { defineTool } from "../types.js";

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

export const getWeekTool = defineTool({
  name: "get_week",
  description:
    "Read the Loom — the designed schedule of record — for a date range: Maxwell's god-colored blocks, the imported outer-world (Google) events they sit over, check-ins, active goals, and pre-computed adherence stats. Defaults to the next 7 days. Use this before discussing his week.",
  risk: "read_only",
  source: "native",
  scope: "all",
  skill: "observer",
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
    const week = await readWeek(ctx.userId, from, to);
    return JSON.stringify({ ok: true, ...week });
  },
});

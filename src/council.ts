import { z } from "zod";
import { config } from "./config.js";
import { Goal, Memory } from "./db/index.js";
import { GODS, GOD_IDS } from "./pantheon.js";
import { INTENT_JSON, intentSchema, type WeekIntentsInput } from "./scheduling/intents.js";
import { readWeek, type WeekView } from "./scheduling/week.js";
import { completeStructured } from "./structured.js";
import type { GodId } from "./types.js";

/** The five domain gods (Zeus orchestrates; he doesn't file a report). */
export const COUNCIL_GODS: GodId[] = GOD_IDS.filter((g) => g !== "zeus");

const GOD_ENUM = GOD_IDS as [GodId, ...GodId[]];

export const godReportSchema = z.object({
  godId: z.enum(GOD_ENUM),
  headline: z.string(),
  wins: z.array(z.string()),
  concerns: z.array(z.string()),
  tip: z.string(),
  proposedIntents: z.array(intentSchema),
  oneQuestion: z.string(),
});
export type GodReport = z.infer<typeof godReportSchema>;

const GOD_REPORT_JSON: Record<string, unknown> = {
  type: "object",
  properties: {
    godId: { type: "string", enum: GOD_IDS },
    headline: { type: "string" },
    wins: { type: "array", items: { type: "string" } },
    concerns: { type: "array", items: { type: "string" } },
    tip: { type: "string" },
    proposedIntents: { type: "array", items: INTENT_JSON },
    oneQuestion: { type: "string" },
  },
  required: ["godId", "headline", "wins", "concerns", "tip", "proposedIntents", "oneQuestion"],
  additionalProperties: false,
};

export interface CouncilPrep {
  week: WeekView;
  goalsByGod: Record<string, Array<{ title: string; wheelBaseline: number | null; wheelCurrent: number | null }>>;
  memoriesByArea: Record<string, string[]>;
}

/** Prepare (code): the cycle's real numbers + goals + memories — no LLM arithmetic. */
export async function prepareCouncil(userId: string, from: Date, to: Date): Promise<CouncilPrep> {
  const [week, goals, memories] = await Promise.all([
    readWeek(userId, from, to),
    Goal.find({ userId, status: "active" }).lean(),
    Memory.find({ userId }).sort({ createdAt: -1 }).limit(60).lean(),
  ]);

  const goalsByGod: CouncilPrep["goalsByGod"] = {};
  for (const g of goals) {
    (goalsByGod[g.godId] ??= []).push({
      title: g.title,
      wheelBaseline: g.wheelBaseline ?? null,
      wheelCurrent: g.wheelCurrent ?? null,
    });
  }
  const memoriesByArea: CouncilPrep["memoriesByArea"] = {};
  for (const m of memories) (memoriesByArea[m.area ?? "other"] ??= []).push(m.text);

  return { week, goalsByGod, memoriesByArea };
}

/** One god's structured report on its domain. Returns null if the god "goes silent". */
export async function runGod(godId: GodId, prep: CouncilPrep): Promise<GodReport | null> {
  const g = GODS[godId];
  const perGod = prep.week.stats.perGod[godId];
  const context = {
    domain: g.domain,
    adherence: perGod,
    goals: prep.goalsByGod[godId] ?? [],
    relevantMemories: prep.memoriesByArea,
    weekStats: { adherencePct: prep.week.stats.adherencePct, byGod: prep.week.stats.byGod },
  };

  try {
    return await completeStructured({
      model: config.model,
      messages: [
        {
          role: "system",
          content:
            `You are ${g.name}, god of ${g.domain}. Voice: ${g.voice}. This is the Weekly Council. ` +
            "Review ONLY your domain for the cycle just past. Data before judgment — use the real numbers given, " +
            "never invent figures. Be honest and specific; never shame. Propose 1–3 intents for next cycle that " +
            "move the user forward (each with a rationale tracing to a goal). Ask one sharp question.",
        },
        { role: "user", content: `Cycle data for your domain (JSON):\n${JSON.stringify(context)}` },
      ],
      tool: { name: "emit_god_report", description: "Emit your council report.", parameters: GOD_REPORT_JSON },
      schema: godReportSchema,
    });
  } catch {
    return null; // silent this week — the council never aborts on one god
  }
}

/** Merge every god's proposed intents into one WeekIntents for the next cycle. */
export function mergeIntents(reports: GodReport[]): WeekIntentsInput {
  return { intents: reports.flatMap((r) => r.proposedIntents), drops: [] };
}

import { z } from "zod";
import { config, USER_ID } from "../config.js";
import { Block, Episode, Scroll } from "../db/index.js";
import { GOD_IDS } from "../pantheon.js";
import { completeStructured } from "../structured.js";

/**
 * followThrough {[godId]:{scheduled,done}} — computed by CODE from Blocks,
 * never LLM-written (SPEC §10). Persisted onto the Scroll for the planner.
 */
export async function computeFollowThrough(
  userId = USER_ID,
): Promise<Record<string, { scheduled: number; done: number }>> {
  const rows = await Block.aggregate<{ _id: string; scheduled: number; done: number }>([
    { $match: { userId, status: { $in: ["scheduled", "done", "moved", "skipped"] } } },
    {
      $group: {
        _id: "$godId",
        scheduled: { $sum: 1 },
        done: { $sum: { $cond: [{ $eq: ["$status", "done"] }, 1, 0] } },
      },
    },
  ]);
  const ft = Object.fromEntries(GOD_IDS.map((g) => [g, { scheduled: 0, done: 0 }]));
  for (const r of rows) if (r._id in ft) ft[r._id] = { scheduled: r.scheduled, done: r.done };
  await Scroll.updateOne({ userId }, { $set: { "profile.followThrough": ft } }, { upsert: true });
  return ft;
}

const scrollPatchSchema = z.object({ learnedThisWeek: z.array(z.string()) });
const SCROLL_PATCH_JSON: Record<string, unknown> = {
  type: "object",
  properties: { learnedThisWeek: { type: "array", items: { type: "string" } } },
  required: ["learnedThisWeek"],
  additionalProperties: false,
};

/**
 * 02:00 consolidation: recompute followThrough, then distill unconsolidated
 * episodes into durable learnings appended to Scroll.learned (version++).
 * "Maxwell learned N things about you."
 */
export async function runConsolidation(userId = USER_ID): Promise<{ learned: number }> {
  await computeFollowThrough(userId);

  const episodes = await Episode.find({ userId, consolidated: false }).sort({ createdAt: 1 }).limit(50).lean();
  if (episodes.length === 0) return { learned: 0 };

  let learned: string[] = [];
  try {
    const patch = await completeStructured({
      model: config.model,
      messages: [
        {
          role: "system",
          content:
            "Consolidate these episodes into durable, specific things learned about the user this week. " +
            "Keep only insights worth remembering long-term; drop transient chatter. Return learnedThisWeek.",
        },
        { role: "user", content: episodes.map((e) => `(${e.kind}) ${e.summary}`).join("\n") },
      ],
      tool: { name: "emit_scroll_patch", description: "Emit consolidated learnings.", parameters: SCROLL_PATCH_JSON },
      schema: scrollPatchSchema,
    });
    learned = patch.learnedThisWeek;
  } catch {
    learned = [];
  }

  const scroll = (await Scroll.findOne({ userId })) ?? new Scroll({ userId, profile: {}, version: 0 });
  const week = new Date().toISOString().slice(0, 10);
  const existing = (scroll.profile?.learned ?? []) as Array<{ week: string; insight: string }>;
  const additions = learned.map((insight) => ({ week, insight }));
  scroll.profile = { ...(scroll.profile ?? {}), learned: [...existing, ...additions] };
  scroll.markModified("profile");
  scroll.version = (scroll.version ?? 0) + 1;
  await scroll.save();

  await Episode.updateMany(
    { userId, _id: { $in: episodes.map((e) => e._id) } },
    { $set: { consolidated: true } },
  );
  return { learned: additions.length };
}

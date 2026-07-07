import { Block, Proposal } from "../db/models/index.js";

export interface ApplyResult {
  applied: boolean;
  alreadyApplied?: boolean;
  added: number;
  moved: number;
  cancelled: number;
}

/**
 * Apply an approved proposal's diff to the blocks collection. This is the ONLY
 * write path to the schedule of record; it runs OUTSIDE the agent loop (the
 * human Approve endpoint calls it). Idempotent: applying twice is a no-op.
 */
export async function applyProposal(userId: string, proposalId: string): Promise<ApplyResult> {
  const proposal = await Proposal.findOne({ _id: proposalId, userId });
  if (!proposal) throw new Error(`proposal ${proposalId} not found`);
  if (proposal.status === "applied") {
    return { applied: false, alreadyApplied: true, added: 0, moved: 0, cancelled: 0 };
  }

  const diff = proposal.diff ?? { adds: [], moves: [], deletes: [] };

  const addDocs = (diff.adds ?? []).map((a) => ({
    userId,
    godId: a.godId,
    title: a.title,
    start: new Date(a.start),
    end: new Date(a.end),
    status: "scheduled" as const,
    isAnchor: Boolean(a.isAnchor),
    ...(a.ifThen ? { ifThen: a.ifThen } : {}),
    ...(proposal.cycleId ? { cycleId: proposal.cycleId } : {}),
  }));
  if (addDocs.length > 0) await Block.insertMany(addDocs);

  for (const mv of diff.moves ?? []) {
    await Block.updateOne(
      { _id: mv.blockId, userId },
      { $set: { start: new Date(mv.toStart), end: new Date(mv.toEnd), status: "scheduled" } },
    );
  }

  if ((diff.deletes ?? []).length > 0) {
    await Block.updateMany(
      { _id: { $in: diff.deletes }, userId },
      { $set: { status: "cancelled" } },
    );
  }

  proposal.status = "applied";
  await proposal.save();

  return {
    applied: true,
    added: addDocs.length,
    moved: (diff.moves ?? []).length,
    cancelled: (diff.deletes ?? []).length,
  };
}

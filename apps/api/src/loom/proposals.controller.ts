import { Controller, Get, Param, Post, Query } from "@nestjs/common";
import { USER_ID } from "../../../../src/config.js";
import { Block, Proposal, type IProposal } from "../../../../src/db/index.js";
import { applyProposal } from "../../../../src/scheduling/apply.js";

type LeanProposal = IProposal & { _id: unknown; createdAt?: Date };

@Controller("proposals")
export class ProposalsController {
  @Get()
  async list(@Query("status") status?: string) {
    const query: Record<string, unknown> = { userId: USER_ID };
    if (status) query.status = status;
    const docs = await Proposal.find(query).sort({ createdAt: -1 }).limit(20).lean<LeanProposal[]>();
    return docs.map((p) => ({
      id: String(p._id),
      kind: p.kind,
      status: p.status,
      summary: {
        adds: p.diff?.adds?.length ?? 0,
        moves: p.diff?.moves?.length ?? 0,
        deletes: p.diff?.deletes?.length ?? 0,
      },
      createdAt: p.createdAt ?? null,
    }));
  }

  @Get(":id")
  async detail(@Param("id") id: string) {
    const p = await Proposal.findOne({ _id: id, userId: USER_ID }).lean<LeanProposal | null>();
    if (!p) return { ok: false, error: "not found" };

    const refIds = [
      ...(p.diff?.moves ?? []).map((m) => m.blockId),
      ...(p.diff?.deletes ?? []),
    ];
    const blocks = refIds.length
      ? await Block.find({ _id: { $in: refIds }, userId: USER_ID }).lean()
      : [];
    const byId = new Map(blocks.map((b) => [String(b._id), b]));

    return {
      ok: true,
      id: String(p._id),
      kind: p.kind,
      status: p.status,
      critique: p.critique ?? null,
      diff: {
        adds: (p.diff?.adds ?? []).map((a) => ({
          godId: a.godId,
          title: a.title,
          start: new Date(a.start).toISOString(),
          end: new Date(a.end).toISOString(),
          isAnchor: Boolean(a.isAnchor),
        })),
        moves: (p.diff?.moves ?? []).map((m) => {
          const b = byId.get(m.blockId);
          return {
            blockId: m.blockId,
            title: b?.title ?? "(block)",
            godId: b?.godId ?? null,
            fromStart: b ? b.start.toISOString() : null,
            fromEnd: b ? b.end.toISOString() : null,
            toStart: new Date(m.toStart).toISOString(),
            toEnd: new Date(m.toEnd).toISOString(),
          };
        }),
        deletes: (p.diff?.deletes ?? []).map((delId) => {
          const b = byId.get(delId);
          return { blockId: delId, title: b?.title ?? "(block)", godId: b?.godId ?? null };
        }),
      },
    };
  }

  @Post(":id/approve")
  async approve(@Param("id") id: string) {
    return applyProposal(USER_ID, id);
  }

  @Post(":id/reject")
  async reject(@Param("id") id: string) {
    await Proposal.updateOne({ _id: id, userId: USER_ID }, { $set: { status: "rejected" } });
    return { ok: true };
  }
}

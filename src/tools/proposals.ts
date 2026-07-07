import { z } from "zod";
import { Block, ImportedEvent, Proposal, Scroll } from "../db/models/index.js";
import type { ProposalAdd, ProposalMove } from "../db/models/proposal.js";
import { applyProposal } from "../scheduling/apply.js";
import { diffSchedule, type ExistingBlock } from "../scheduling/differ.js";
import { constraintsFromProfile, INTENT_JSON, intentSchema, toPlacerIntents } from "../scheduling/intents.js";
import { placeIntents } from "../scheduling/placer.js";
import { defineTool } from "../types.js";

function startOfToday(now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

// ── propose_week ────────────────────────────────────────────────
const proposeWeekSchema = z.object({
  intents: z.array(intentSchema),
  drops: z.array(z.string()).nullish(),
  windowStartISO: z.string().nullish(),
  windowEndISO: z.string().nullish(),
});

export const proposeWeekTool = defineTool({
  name: "propose_week",
  description:
    "Design a cycle: given intents (NOT datetimes), the harness places them around the outer world and existing blocks, then builds a proposal diff for human approval. Creates only a proposal — never writes the schedule. Returns the proposal id, a summary, and anything that couldn't be placed (raise trade-offs conversationally).",
  risk: "write",
  source: "native",
  scope: "all",
  skill: "week-planner",
  schema: proposeWeekSchema,
  parameters: {
    type: "object",
    properties: {
      intents: { type: "array", items: INTENT_JSON },
      drops: { type: ["array", "null"], items: { type: "string" }, description: "Block ids to drop. null if none." },
      windowStartISO: { type: ["string", "null"], description: "Cycle start ISO. null → today." },
      windowEndISO: { type: ["string", "null"], description: "Cycle end ISO. null → start + 7 days." },
    },
    required: ["intents", "drops", "windowStartISO", "windowEndISO"],
    additionalProperties: false,
  },
  execute: async (args, ctx) => {
    const now = ctx.now();
    const from = args.windowStartISO ? new Date(args.windowStartISO) : startOfToday(now);
    const to = args.windowEndISO ? new Date(args.windowEndISO) : addDays(from, 7);

    const [imported, existingDocs, scroll] = await Promise.all([
      ImportedEvent.find({ userId: ctx.userId, start: { $lt: to }, end: { $gt: from } }).lean(),
      Block.find({ userId: ctx.userId, start: { $gte: from, $lt: to }, status: { $in: ["scheduled", "proposed"] } }).lean(),
      Scroll.findOne({ userId: ctx.userId }).lean(),
    ]);

    const busy = imported.map((e) => ({ start: e.start, end: e.end }));
    const existing: ExistingBlock[] = existingDocs.map((b) => ({
      id: String(b._id),
      godId: b.godId,
      title: b.title,
      start: b.start,
      end: b.end,
    }));

    const { placements, unplaced } = placeIntents({
      windowStart: from,
      windowEnd: to,
      intents: toPlacerIntents({ intents: args.intents, drops: args.drops }),
      busy,
      constraints: constraintsFromProfile(scroll?.profile),
    });
    const diff = diffSchedule(existing, placements, args.drops ?? []);

    const proposal = await Proposal.create({ userId: ctx.userId, kind: "week_plan", diff, status: "pending" });
    ctx.emit({ type: "proposal", id: String(proposal._id) });

    return JSON.stringify({
      ok: true,
      proposalId: String(proposal._id),
      window: { from: from.toISOString(), to: to.toISOString() },
      summary: { adds: diff.adds.length, moves: diff.moves.length, deletes: diff.deletes.length },
      unplaced: unplaced.map((u) => ({ title: u.title, remaining: u.remaining, reason: u.reason })),
    });
  },
});

// ── propose_edit ────────────────────────────────────────────────
const proposeEditSchema = z.object({
  addIntents: z.array(intentSchema),
  moves: z.array(z.object({ blockId: z.string(), toStartISO: z.string(), toEndISO: z.string() })),
  deletes: z.array(z.string()),
});

export const proposeEditTool = defineTool({
  name: "propose_edit",
  description:
    "Propose the smallest mid-week change: add block(s) (placed around the outer world), move existing block(s) to new times, and/or delete block(s). Creates a proposal for human approval — never writes the schedule directly.",
  risk: "write",
  source: "native",
  scope: "all",
  skill: "editor",
  schema: proposeEditSchema,
  parameters: {
    type: "object",
    properties: {
      addIntents: { type: "array", items: INTENT_JSON },
      moves: {
        type: "array",
        items: {
          type: "object",
          properties: {
            blockId: { type: "string" },
            toStartISO: { type: "string" },
            toEndISO: { type: "string" },
          },
          required: ["blockId", "toStartISO", "toEndISO"],
          additionalProperties: false,
        },
      },
      deletes: { type: "array", items: { type: "string" } },
    },
    required: ["addIntents", "moves", "deletes"],
    additionalProperties: false,
  },
  execute: async (args, ctx) => {
    const now = ctx.now();
    const from = startOfToday(now);
    const to = addDays(from, 7);

    const [imported, existingDocs] = await Promise.all([
      ImportedEvent.find({ userId: ctx.userId, start: { $lt: to }, end: { $gt: from } }).lean(),
      Block.find({ userId: ctx.userId, start: { $gte: from, $lt: to }, status: { $in: ["scheduled", "proposed"] } }).lean(),
    ]);
    // Edits are additive: place new intents around BOTH the outer world and existing blocks.
    const busy = [
      ...imported.map((e) => ({ start: e.start, end: e.end })),
      ...existingDocs.map((b) => ({ start: b.start, end: b.end })),
    ];

    const { placements, unplaced } = placeIntents({
      windowStart: from,
      windowEnd: to,
      intents: toPlacerIntents({ intents: args.addIntents }),
      busy,
    });

    const adds: ProposalAdd[] = placements.map((p) => ({
      godId: p.godId,
      title: p.title,
      start: p.start,
      end: p.end,
      isAnchor: p.isAnchor,
    }));
    const moves: ProposalMove[] = args.moves.map((m) => ({
      blockId: m.blockId,
      toStart: new Date(m.toStartISO),
      toEnd: new Date(m.toEndISO),
    }));

    const proposal = await Proposal.create({
      userId: ctx.userId,
      kind: "edit",
      diff: { adds, moves, deletes: args.deletes },
      status: "pending",
    });
    ctx.emit({ type: "proposal", id: String(proposal._id) });

    return JSON.stringify({
      ok: true,
      proposalId: String(proposal._id),
      summary: { adds: adds.length, moves: moves.length, deletes: args.deletes.length },
      unplaced: unplaced.map((u) => ({ title: u.title, remaining: u.remaining, reason: u.reason })),
    });
  },
});

// ── apply_proposal (destructive, ALWAYS gated) ──────────────────
const applyProposalSchema = z.object({ proposalId: z.string() });

export const applyProposalTool = defineTool({
  name: "apply_proposal",
  description:
    "Write an approved proposal's changes to the schedule of record. This is destructive and ALWAYS requires human approval — model-initiated calls are blocked by the gate. The human Approve button applies it outside the loop.",
  risk: "destructive",
  source: "native",
  scope: ["zeus"],
  schema: applyProposalSchema,
  parameters: {
    type: "object",
    properties: { proposalId: { type: "string" } },
    required: ["proposalId"],
    additionalProperties: false,
  },
  execute: async (args, ctx) => {
    const result = await applyProposal(ctx.userId, args.proposalId);
    return JSON.stringify({ ok: true, ...result });
  },
});

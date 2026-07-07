import mongoose, { Schema, type Model } from "mongoose";
import { PROPOSAL_KINDS, PROPOSAL_STATUSES, type ProposalKind, type ProposalStatus } from "../../domain.js";
import type { GodId } from "../../types.js";

export interface ProposalAdd {
  godId: GodId;
  title: string;
  start: Date;
  end: Date;
  isAnchor?: boolean;
  ifThen?: string;
}
export interface ProposalMove {
  blockId: string;
  toStart: Date;
  toEnd: Date;
}
export interface ProposalDiff {
  adds: ProposalAdd[];
  moves: ProposalMove[];
  deletes: string[];
}

export interface IProposal {
  userId: string;
  kind: ProposalKind;
  diff: ProposalDiff;
  status: ProposalStatus;
  sessionId?: string;
  cycleId?: string;
}

const ProposalSchema = new Schema<IProposal>(
  {
    userId: { type: String, required: true, index: true },
    kind: { type: String, enum: PROPOSAL_KINDS, required: true },
    diff: { type: Schema.Types.Mixed, default: { adds: [], moves: [], deletes: [] } },
    status: { type: String, enum: PROPOSAL_STATUSES, default: "pending", index: true },
    sessionId: { type: String, index: true },
    cycleId: { type: String },
  },
  { timestamps: true },
);

export const Proposal: Model<IProposal> =
  (mongoose.models.Proposal as Model<IProposal>) ??
  mongoose.model<IProposal>("Proposal", ProposalSchema);

import mongoose, { Schema, type Model } from "mongoose";
import { BLOCK_STATUSES, type BlockStatus } from "../../domain.js";
import { GOD_IDS } from "../../pantheon.js";
import type { GodId } from "../../types.js";

/** The designed schedule — the Loom. God-colored blocks over the outer world. */
export interface IBlock {
  userId: string;
  godId: GodId;
  title: string;
  start: Date;
  end: Date;
  status: BlockStatus;
  isAnchor: boolean;
  ifThen?: string;
  cycleId?: string;
}

const BlockSchema = new Schema<IBlock>(
  {
    userId: { type: String, required: true, index: true },
    godId: { type: String, enum: GOD_IDS, required: true },
    title: { type: String, required: true },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    status: { type: String, enum: BLOCK_STATUSES, default: "scheduled" },
    isAnchor: { type: Boolean, default: false },
    ifThen: { type: String },
    cycleId: { type: String, index: true },
  },
  { timestamps: true },
);

BlockSchema.index({ userId: 1, start: 1 });

export const Block: Model<IBlock> =
  (mongoose.models.Block as Model<IBlock>) ?? mongoose.model<IBlock>("Block", BlockSchema);

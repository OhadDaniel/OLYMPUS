import mongoose, { Schema, type Model } from "mongoose";
import { GOD_IDS } from "../../pantheon.js";
import type { GodId } from "../../types.js";

/** A commitment extracted from Gmail (untrusted → structured). */
export interface IEmailInsight {
  userId: string;
  sourceMsgId: string;
  summary: string;
  when?: Date;
  godId?: GodId;
  handled: boolean;
}

const EmailInsightSchema = new Schema<IEmailInsight>(
  {
    userId: { type: String, required: true, index: true },
    sourceMsgId: { type: String, required: true },
    summary: { type: String, required: true },
    when: { type: Date },
    godId: { type: String, enum: GOD_IDS },
    handled: { type: Boolean, default: false },
  },
  { timestamps: true },
);

EmailInsightSchema.index({ userId: 1, sourceMsgId: 1 }, { unique: true });

export const EmailInsight: Model<IEmailInsight> =
  (mongoose.models.EmailInsight as Model<IEmailInsight>) ??
  mongoose.model<IEmailInsight>("EmailInsight", EmailInsightSchema);

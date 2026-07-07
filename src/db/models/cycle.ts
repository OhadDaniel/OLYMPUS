import mongoose, { Schema, type Model } from "mongoose";
import { CYCLE_KINDS, type CycleKind } from "../../domain.js";

/** A council-to-council week (not calendar-week-anchored). */
export interface ICycle {
  userId: string;
  startsOn: Date;
  endsOn: Date;
  councilAt: Date;
  kind: CycleKind;
  executionScore?: number;
}

const CycleSchema = new Schema<ICycle>(
  {
    userId: { type: String, required: true, index: true },
    startsOn: { type: Date, required: true },
    endsOn: { type: Date, required: true },
    councilAt: { type: Date, required: true },
    kind: { type: String, enum: CYCLE_KINDS, required: true },
    executionScore: { type: Number, min: 0, max: 100 },
  },
  { timestamps: true },
);

CycleSchema.index({ userId: 1, startsOn: 1 });

export const Cycle: Model<ICycle> =
  (mongoose.models.Cycle as Model<ICycle>) ?? mongoose.model<ICycle>("Cycle", CycleSchema);

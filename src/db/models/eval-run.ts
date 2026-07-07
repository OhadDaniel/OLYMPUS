import mongoose, { Schema, type Model } from "mongoose";

/** History of Proving Ground runs — for "score vs last commit". */
export interface IEvalRun {
  userId: string;
  overallPct: number;
  overallPassed: number;
  overallTotal: number;
  suites: unknown;
}

const EvalRunSchema = new Schema<IEvalRun>(
  {
    userId: { type: String, required: true, index: true },
    overallPct: { type: Number, required: true },
    overallPassed: { type: Number, required: true },
    overallTotal: { type: Number, required: true },
    suites: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

export const EvalRun: Model<IEvalRun> =
  (mongoose.models.EvalRun as Model<IEvalRun>) ?? mongoose.model<IEvalRun>("EvalRun", EvalRunSchema);

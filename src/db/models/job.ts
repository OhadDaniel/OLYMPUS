import mongoose, { Schema, type Model } from "mongoose";
import { JOB_STATUSES, type JobStatus } from "../../domain.js";

/** Idempotency ledger — the ONLY double-send protection (Telegram has none). */
export interface IJob {
  userId: string;
  key: string;
  status: JobStatus;
  payload?: unknown;
}

const JobSchema = new Schema<IJob>(
  {
    userId: { type: String, required: true, index: true },
    key: { type: String, required: true, unique: true },
    status: { type: String, enum: JOB_STATUSES, default: "claimed" },
    payload: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

export const Job: Model<IJob> =
  (mongoose.models.Job as Model<IJob>) ?? mongoose.model<IJob>("Job", JobSchema);

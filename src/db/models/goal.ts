import mongoose, { Schema, type Model } from "mongoose";
import { GOAL_STATUSES, type GoalStatus } from "../../domain.js";
import { GOD_IDS } from "../../pantheon.js";
import type { GodId } from "../../types.js";

export interface IGoal {
  userId: string;
  godId: GodId;
  title: string;
  target?: string;
  status: GoalStatus;
  /** 1–10 life-wheel value at baseline (First Meeting). */
  wheelBaseline?: number;
  /** 1–10 current value (Observatory baseline-vs-now). */
  wheelCurrent?: number;
}

const GoalSchema = new Schema<IGoal>(
  {
    userId: { type: String, required: true, index: true },
    godId: { type: String, enum: GOD_IDS, required: true },
    title: { type: String, required: true },
    target: { type: String },
    status: { type: String, enum: GOAL_STATUSES, default: "active" },
    wheelBaseline: { type: Number, min: 1, max: 10 },
    wheelCurrent: { type: Number, min: 1, max: 10 },
  },
  { timestamps: true },
);

export const Goal: Model<IGoal> =
  (mongoose.models.Goal as Model<IGoal>) ?? mongoose.model<IGoal>("Goal", GoalSchema);

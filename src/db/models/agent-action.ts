import mongoose, { Schema, type Model } from "mongoose";
import { ACTION_DECISIONS, type ActionDecision } from "../../domain.js";
import type { RiskClass } from "../../types.js";

/** The audit ledger — every tool crossing, logged (SPEC §6). */
export interface IAgentAction {
  userId: string;
  runId: string;
  tool: string;
  input: string;
  risk?: RiskClass;
  decision: ActionDecision;
  result: string;
  skill?: string;
}

const AgentActionSchema = new Schema<IAgentAction>(
  {
    userId: { type: String, required: true, index: true },
    runId: { type: String, required: true, index: true },
    tool: { type: String, required: true },
    input: { type: String, default: "" },
    risk: { type: String, enum: ["read_only", "write", "destructive"] },
    decision: { type: String, enum: ACTION_DECISIONS, required: true },
    result: { type: String, default: "" },
    skill: { type: String },
  },
  { timestamps: true },
);

export const AgentAction: Model<IAgentAction> =
  (mongoose.models.AgentAction as Model<IAgentAction>) ??
  mongoose.model<IAgentAction>("AgentAction", AgentActionSchema);

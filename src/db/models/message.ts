import mongoose, { Schema, type Model } from "mongoose";
import type { AgentEvent } from "../../events.js";
import type { GodId } from "../../types.js";

export interface IMessage {
  userId: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  godId?: GodId;
  content: string;
  /** Harness events captured for Veil replay. */
  events?: AgentEvent[];
}

const MessageSchema = new Schema<IMessage>(
  {
    userId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    role: { type: String, enum: ["user", "assistant", "system"], required: true },
    godId: { type: String },
    content: { type: String, default: "" },
    events: { type: [Schema.Types.Mixed], default: undefined },
  },
  { timestamps: true },
);

export const Message: Model<IMessage> =
  (mongoose.models.Message as Model<IMessage>) ?? mongoose.model<IMessage>("Message", MessageSchema);

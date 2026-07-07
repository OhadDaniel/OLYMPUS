import mongoose, { Schema, type Model } from "mongoose";

export interface IChatSession {
  userId: string;
  title?: string;
  kind: "chat" | "council";
}

const ChatSessionSchema = new Schema<IChatSession>(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String },
    kind: { type: String, enum: ["chat", "council"], default: "chat" },
  },
  { timestamps: true },
);

export const ChatSession: Model<IChatSession> =
  (mongoose.models.ChatSession as Model<IChatSession>) ??
  mongoose.model<IChatSession>("ChatSession", ChatSessionSchema);

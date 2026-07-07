import mongoose, { Schema, type Model } from "mongoose";

export interface ITelegramLink {
  userId: string;
  chatId?: string;
  linkToken: string;
  linkedAt?: Date;
  expiresAt?: Date;
}

const TelegramLinkSchema = new Schema<ITelegramLink>(
  {
    userId: { type: String, required: true, index: true },
    chatId: { type: String, index: true },
    linkToken: { type: String, required: true, unique: true },
    linkedAt: { type: Date },
    expiresAt: { type: Date },
  },
  { timestamps: true },
);

export const TelegramLink: Model<ITelegramLink> =
  (mongoose.models.TelegramLink as Model<ITelegramLink>) ??
  mongoose.model<ITelegramLink>("TelegramLink", TelegramLinkSchema);

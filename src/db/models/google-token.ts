import mongoose, { Schema, type Model } from "mongoose";

export interface IGoogleToken {
  userId: string;
  refreshToken: string;
  scopes: string[];
  accessToken?: string;
  expiryDate?: number;
}

const GoogleTokenSchema = new Schema<IGoogleToken>(
  {
    userId: { type: String, required: true, index: true, unique: true },
    refreshToken: { type: String, required: true },
    scopes: { type: [String], default: [] },
    accessToken: { type: String },
    expiryDate: { type: Number },
  },
  { timestamps: true },
);

export const GoogleToken: Model<IGoogleToken> =
  (mongoose.models.GoogleToken as Model<IGoogleToken>) ??
  mongoose.model<IGoogleToken>("GoogleToken", GoogleTokenSchema);

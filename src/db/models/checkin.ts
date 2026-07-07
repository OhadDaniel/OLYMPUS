import mongoose, { Schema, type Model } from "mongoose";
import {
  CHECKIN_RESPONSES,
  CHECKIN_VIA,
  type CheckinResponse,
  type CheckinVia,
} from "../../domain.js";

export interface ICheckin {
  userId: string;
  blockId: string;
  response: CheckinResponse;
  via: CheckinVia;
  note?: string;
}

const CheckinSchema = new Schema<ICheckin>(
  {
    userId: { type: String, required: true, index: true },
    blockId: { type: String, required: true, index: true },
    response: { type: String, enum: CHECKIN_RESPONSES, required: true },
    via: { type: String, enum: CHECKIN_VIA, default: "web" },
    note: { type: String },
  },
  { timestamps: true },
);

export const Checkin: Model<ICheckin> =
  (mongoose.models.Checkin as Model<ICheckin>) ?? mongoose.model<ICheckin>("Checkin", CheckinSchema);

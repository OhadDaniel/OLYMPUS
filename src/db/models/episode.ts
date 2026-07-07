import mongoose, { Schema, type Model } from "mongoose";
import { EPISODE_KINDS, type EpisodeKind } from "../../domain.js";

export interface IEpisode {
  userId: string;
  kind: EpisodeKind;
  summary: string;
  tags: string[];
  consolidated: boolean;
}

const EpisodeSchema = new Schema<IEpisode>(
  {
    userId: { type: String, required: true, index: true },
    kind: { type: String, enum: EPISODE_KINDS, required: true },
    summary: { type: String, required: true },
    tags: { type: [String], default: [] },
    consolidated: { type: Boolean, default: false },
  },
  { timestamps: true },
);

EpisodeSchema.index({ userId: 1, consolidated: 1 });

export const Episode: Model<IEpisode> =
  (mongoose.models.Episode as Model<IEpisode>) ?? mongoose.model<IEpisode>("Episode", EpisodeSchema);

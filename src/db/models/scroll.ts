import mongoose, { Schema, type Model } from "mongoose";
import type { Tone } from "../../domain.js";

/** The Scroll profile (SPEC §10). Stored flexibly; update_scroll validates patches with zod. */
export interface IProfile {
  identity?: { name?: string; timezone?: string };
  preferences?: { tone?: Tone; quietHours?: { start?: string; end?: string } };
  goals?: unknown[];
  constraints?: string[];
  energyMap?: { chronotype?: string; bestFocus?: string[] };
  people?: Array<{ name: string; relation?: string; notes?: string }>;
  /** Computed by code from Checkins — never LLM-written. */
  followThrough?: Record<string, { scheduled: number; done: number }>;
  learned?: Array<{ week: string; insight: string; sourceEpisodeId?: string }>;
}

export interface IScroll {
  userId: string;
  profile: IProfile;
  version: number;
}

const ScrollSchema = new Schema<IScroll>(
  {
    userId: { type: String, required: true, index: true, unique: true },
    profile: { type: Schema.Types.Mixed, default: {} },
    version: { type: Number, default: 1 },
  },
  { timestamps: true },
);

export const Scroll: Model<IScroll> =
  (mongoose.models.Scroll as Model<IScroll>) ?? mongoose.model<IScroll>("Scroll", ScrollSchema);

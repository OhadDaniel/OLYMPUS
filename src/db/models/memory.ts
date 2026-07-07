import mongoose, { Schema, type Model } from "mongoose";
import { LIFE_AREAS, MEMORY_SOURCES, type LifeArea, type MemorySource } from "../../domain.js";

export interface IMemory {
  userId: string;
  text: string;
  area?: LifeArea;
  category?: string;
  source: MemorySource;
}

const MemorySchema = new Schema<IMemory>(
  {
    userId: { type: String, required: true, index: true },
    text: { type: String, required: true },
    area: { type: String, enum: LIFE_AREAS },
    category: { type: String },
    source: { type: String, enum: MEMORY_SOURCES, default: "chat" },
  },
  { timestamps: true },
);

MemorySchema.index({ userId: 1, area: 1 });

export const Memory: Model<IMemory> =
  (mongoose.models.Memory as Model<IMemory>) ?? mongoose.model<IMemory>("Memory", MemorySchema);

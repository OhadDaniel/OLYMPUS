import mongoose, { Schema, type Model } from "mongoose";

/** Read-only mirror of a Google Calendar event — "the outer world". */
export interface IImportedEvent {
  userId: string;
  gcalId: string;
  title: string;
  start: Date;
  end: Date;
  lastSyncedAt: Date;
}

const ImportedEventSchema = new Schema<IImportedEvent>(
  {
    userId: { type: String, required: true, index: true },
    gcalId: { type: String, required: true },
    title: { type: String, default: "(busy)" },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    lastSyncedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);

// One mirror row per Google event per user (upsert target).
ImportedEventSchema.index({ userId: 1, gcalId: 1 }, { unique: true });
ImportedEventSchema.index({ userId: 1, start: 1 });

export const ImportedEvent: Model<IImportedEvent> =
  (mongoose.models.ImportedEvent as Model<IImportedEvent>) ??
  mongoose.model<IImportedEvent>("ImportedEvent", ImportedEventSchema);

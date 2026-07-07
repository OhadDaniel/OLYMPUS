import { z } from "zod";
import type { IProfile } from "../db/models/scroll.js";
import { TIME_PREFERENCES } from "../domain.js";
import { GOD_IDS } from "../pantheon.js";
import type { GodId } from "../types.js";
import type { Intent, PlacerConstraints } from "./types.js";

const GOD_ENUM = GOD_IDS as [GodId, ...GodId[]];

export const intentSchema = z.object({
  godId: z.enum(GOD_ENUM),
  title: z.string().min(1),
  durationMin: z.number().int().min(5).max(600),
  frequencyPerWeek: z.number().int().min(0).max(21),
  priority: z.number().int().min(1).max(5),
  timePreferences: z.array(z.enum(TIME_PREFERENCES)),
  daysAllowed: z.array(z.number().int().min(0).max(6)).nullish(),
  isAnchor: z.boolean(),
  rationale: z.string(),
});

export const weekIntentsSchema = z.object({
  intents: z.array(intentSchema),
  drops: z.array(z.string()).nullish(),
});

export type WeekIntentsInput = z.infer<typeof weekIntentsSchema>;

/** Strict JSON Schema for one intent (every prop required; optionals nullable). */
export const INTENT_JSON: Record<string, unknown> = {
  type: "object",
  properties: {
    godId: { type: "string", enum: GOD_IDS },
    title: { type: "string" },
    durationMin: { type: "integer", description: "Length of one session in minutes." },
    frequencyPerWeek: { type: "integer", description: "How many sessions this cycle." },
    priority: { type: "integer", description: "1 (low) to 5 (high)." },
    timePreferences: {
      type: "array",
      items: { type: "string", enum: [...TIME_PREFERENCES] },
      description: "Preferred windows, in order.",
    },
    daysAllowed: {
      type: ["array", "null"],
      items: { type: "integer" },
      description: "Weekday numbers 0=Sun..6=Sat. null = any day.",
    },
    isAnchor: { type: "boolean" },
    rationale: { type: "string", description: "Why this belongs in the week." },
  },
  required: [
    "godId",
    "title",
    "durationMin",
    "frequencyPerWeek",
    "priority",
    "timePreferences",
    "daysAllowed",
    "isAnchor",
    "rationale",
  ],
  additionalProperties: false,
};

export const WEEK_INTENTS_JSON: Record<string, unknown> = {
  type: "object",
  properties: {
    intents: { type: "array", items: INTENT_JSON },
    drops: {
      type: ["array", "null"],
      items: { type: "string" },
      description: "Existing block ids to remove this cycle. null if none.",
    },
  },
  required: ["intents", "drops"],
  additionalProperties: false,
};

/** Attach stable ids for the placer. */
export function toPlacerIntents(input: WeekIntentsInput): Intent[] {
  return input.intents.map((it, i) => ({
    id: `intent-${i}`,
    godId: it.godId,
    title: it.title,
    durationMin: it.durationMin,
    frequencyPerWeek: it.frequencyPerWeek,
    priority: it.priority,
    timePreferences: it.timePreferences,
    ...(it.daysAllowed ? { daysAllowed: it.daysAllowed } : {}),
    isAnchor: it.isAnchor,
    rationale: it.rationale,
  }));
}

/** Derive placer constraints from the Scroll profile (quiet hours, no-work). */
export function constraintsFromProfile(profile: IProfile | undefined): PlacerConstraints {
  const out: PlacerConstraints = {};
  const q = profile?.preferences?.quietHours;
  if (q?.start && q?.end) out.quietHours = { start: q.start, end: q.end };

  for (const con of profile?.constraints ?? []) {
    const m = /no work after (\d{1,2})(?::(\d{2}))?/i.exec(con);
    if (m) out.noWorkAfter = `${m[1]!.padStart(2, "0")}:${m[2] ?? "00"}`;
  }
  return out;
}

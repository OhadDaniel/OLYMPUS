import type { TimePreference } from "../domain.js";
import type { GodId } from "../types.js";

/** What the LLM proposes — intents, never datetimes (SPEC §9.4). */
export interface Intent {
  id: string;
  godId: GodId;
  title: string;
  durationMin: number;
  frequencyPerWeek: number;
  /** 1 (low) .. 5 (high). */
  priority: number;
  timePreferences: TimePreference[];
  /** Weekday numbers 0=Sun..6=Sat. Absent = any day. */
  daysAllowed?: number[];
  isAnchor: boolean;
  rationale: string;
}

export interface WeekIntents {
  intents: Intent[];
  /** Existing block ids to drop this cycle. */
  drops?: string[];
}

/** A busy span the placer must avoid (imported events + existing blocks). */
export interface BusyInterval {
  start: Date;
  end: Date;
}

export interface PlacerConstraints {
  /** No placement inside this daily window; may wrap midnight (start > end). */
  quietHours?: { start: string; end: string };
  /** Work-domain gods (career/tasks) are not scheduled after this time. */
  noWorkAfter?: string;
  /** Earliest / latest placement time each day. */
  dayStart?: string;
  dayEnd?: string;
  /** Minimum gap around every placement (minutes). */
  bufferMin?: number;
}

export interface PlacerInput {
  windowStart: Date;
  windowEnd: Date;
  intents: Intent[];
  busy: BusyInterval[];
  constraints?: PlacerConstraints;
}

export interface Placement {
  intentId: string;
  godId: GodId;
  title: string;
  start: Date;
  end: Date;
  isAnchor: boolean;
}

export interface Unplaced {
  intentId: string;
  title: string;
  remaining: number;
  reason: string;
}

export interface PlacerResult {
  placements: Placement[];
  unplaced: Unplaced[];
}

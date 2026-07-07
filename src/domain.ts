/**
 * Shared domain vocabulary — enums reused by mongoose models, tools, zod
 * boundaries, and the UI. Pure (no imports beyond types) so anything can use it.
 */

/** Life areas the psychologist covers + the coverage tracker / verifier check. */
export const LIFE_AREAS = [
  "career",
  "health",
  "tasks",
  "people",
  "self",
  "energy",
  "constraints",
] as const;
export type LifeArea = (typeof LIFE_AREAS)[number];

export const MEMORY_SOURCES = ["interview", "chat", "email"] as const;
export type MemorySource = (typeof MEMORY_SOURCES)[number];

export const EPISODE_KINDS = ["chat", "council", "first_meeting", "checkin"] as const;
export type EpisodeKind = (typeof EPISODE_KINDS)[number];

export const BLOCK_STATUSES = [
  "proposed",
  "scheduled",
  "done",
  "moved",
  "skipped",
  "cancelled",
] as const;
export type BlockStatus = (typeof BLOCK_STATUSES)[number];

export const GOAL_STATUSES = ["active", "achieved", "paused", "dropped"] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export const CYCLE_KINDS = ["bridge", "full"] as const;
export type CycleKind = (typeof CYCLE_KINDS)[number];

export const CHECKIN_RESPONSES = ["done", "moved", "skipped"] as const;
export type CheckinResponse = (typeof CHECKIN_RESPONSES)[number];

export const CHECKIN_VIA = ["telegram", "web"] as const;
export type CheckinVia = (typeof CHECKIN_VIA)[number];

export const PROPOSAL_KINDS = ["week_plan", "edit"] as const;
export type ProposalKind = (typeof PROPOSAL_KINDS)[number];

export const PROPOSAL_STATUSES = ["pending", "approved", "rejected", "applied"] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const ACTION_DECISIONS = ["allowed", "gated", "denied"] as const;
export type ActionDecision = (typeof ACTION_DECISIONS)[number];

export const TONES = ["gentle", "balanced", "blunt"] as const;
export type Tone = (typeof TONES)[number];

export const TIME_PREFERENCES = [
  "early_morning",
  "morning",
  "lunch",
  "afternoon",
  "evening",
] as const;
export type TimePreference = (typeof TIME_PREFERENCES)[number];

export const JOB_STATUSES = ["claimed", "done", "failed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

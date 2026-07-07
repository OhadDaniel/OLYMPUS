import { USER_ID } from "../config.js";
import { Block, Cycle, Goal, GoogleToken, Scroll, TelegramLink } from "../db/index.js";
import { coveredAreas } from "./first-meeting.js";

export interface FirstMeetingChecks {
  identity: boolean;
  areas: boolean;
  wheel: boolean;
  goal: boolean;
  google: boolean;
  telegram: boolean;
  councilSlot: boolean;
  bridge: boolean;
}

/**
 * Deterministic verifier (verifier skill) — trusts NOTHING the agent claims;
 * reads the real stores. Passes only when the First Meeting genuinely produced
 * durable state. Must fail on bad input as surely as it passes on good.
 */
export async function verifyFirstMeeting(userId = USER_ID): Promise<{
  ok: boolean;
  checks: FirstMeetingChecks;
  coveredAreas: string[];
  missing: string[];
}> {
  const [scroll, areas, goals, google, tg, bridgeCycles, scheduledBlocks] = await Promise.all([
    Scroll.findOne({ userId }).lean(),
    coveredAreas(userId),
    Goal.find({ userId }).lean(),
    GoogleToken.findOne({ userId }).lean(),
    TelegramLink.findOne({ userId, chatId: { $ne: null } }).lean(),
    Cycle.find({ userId, kind: "bridge" }).lean(),
    Block.countDocuments({ userId, status: "scheduled" }),
  ]);

  const checks: FirstMeetingChecks = {
    identity: Boolean(scroll?.profile?.identity?.name),
    areas: areas.length >= 3,
    wheel: goals.some((g) => g.wheelBaseline != null),
    goal: goals.length >= 1,
    google: Boolean(google?.refreshToken),
    telegram: Boolean(tg?.chatId),
    councilSlot: bridgeCycles.some((c) => Boolean(c.councilAt)),
    bridge: scheduledBlocks > 0,
  };

  const missing = (Object.keys(checks) as (keyof FirstMeetingChecks)[]).filter((k) => !checks[k]);
  return { ok: missing.length === 0, checks, coveredAreas: areas, missing };
}

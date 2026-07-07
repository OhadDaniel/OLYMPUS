import type { GodId } from "../../../../src/types.js";
import { API_URL } from "./api.js";

export interface Observatory {
  radar: Array<{ godId: GodId; title: string; baseline: number | null; current: number | null }>;
  bars: Array<{ godId: GodId; planned: number; done: number; pct: number | null }>;
  stars: Array<{ date: string; executionPct: number; count: number }>;
  candor: { streak: number; totalAnswers: number };
}
export interface ForgeStatus {
  bindings: { google: boolean; telegram: boolean; mcp: boolean };
  scroll: {
    identity?: { name?: string; timezone?: string };
    preferences?: { tone?: string; quietHours?: { start?: string; end?: string } };
    constraints?: string[];
    energyMap?: { chronotype?: string; bestFocus?: string[] };
    followThrough?: Record<string, { scheduled: number; done: number }>;
    learned?: Array<{ week: string; insight: string }>;
  };
  version: number;
}

export const fetchObservatory = (): Promise<Observatory> =>
  fetch(`${API_URL}/observatory`).then((r) => r.json());
export const fetchForge = (): Promise<ForgeStatus> => fetch(`${API_URL}/forge/status`).then((r) => r.json());
export const linkTelegram = (): Promise<{ url: string }> =>
  fetch(`${API_URL}/telegram/link`, { method: "POST" }).then((r) => r.json());
export const googleAuthUrl = (): string => `${API_URL}/auth/google`;

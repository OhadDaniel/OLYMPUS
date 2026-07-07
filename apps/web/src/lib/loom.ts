import type { GodId } from "../../../../src/types.js";
import { API_URL } from "./api.js";

export interface WeekBlock {
  id: string;
  godId: GodId;
  title: string;
  start: string;
  end: string;
  status: string;
  isAnchor: boolean;
}
export interface OuterEvent {
  id: string;
  title: string;
  start: string;
  end: string;
}
export interface WeekView {
  range: { from: string; to: string };
  stats: { totalBlocks: number; adherencePct: number | null };
  blocks: WeekBlock[];
  outerWorld: OuterEvent[];
}

export interface ProposalSummary {
  id: string;
  kind: string;
  status: string;
  summary: { adds: number; moves: number; deletes: number };
}
export interface ProposalDetail {
  ok: boolean;
  id: string;
  kind: string;
  diff: {
    adds: Array<{ godId: GodId; title: string; start: string; end: string; isAnchor: boolean }>;
    moves: Array<{
      blockId: string;
      title: string;
      godId: GodId | null;
      fromStart: string | null;
      fromEnd: string | null;
      toStart: string;
      toEnd: string;
    }>;
    deletes: Array<{ blockId: string; title: string; godId: GodId | null }>;
  };
}

const json = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(url, init);
  return res.json() as Promise<T>;
};

export const fetchWeek = (from?: string, to?: string): Promise<WeekView> => {
  const q = new URLSearchParams();
  if (from) q.set("from", from);
  if (to) q.set("to", to);
  return json<WeekView>(`${API_URL}/loom/week?${q.toString()}`);
};
export const fetchPending = (): Promise<ProposalSummary[]> =>
  json<ProposalSummary[]>(`${API_URL}/proposals?status=pending`);
export const fetchProposal = (id: string): Promise<ProposalDetail> =>
  json<ProposalDetail>(`${API_URL}/proposals/${id}`);
export const approveProposal = (id: string): Promise<unknown> =>
  json(`${API_URL}/proposals/${id}/approve`, { method: "POST" });
export const rejectProposal = (id: string): Promise<unknown> =>
  json(`${API_URL}/proposals/${id}/reject`, { method: "POST" });

import type { AgentEvent } from "../../../../src/events.js";

/** Mirror of the API's VeilFrame (apps/api/src/core/veil-bus.ts). */
export interface VeilFrame {
  runId: string;
  ts: number;
  event: AgentEvent;
}

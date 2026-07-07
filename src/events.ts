import type { GodId, RiskClass, ToolSource } from "./types.js";

/**
 * The live, ephemeral channel a run speaks on — bridged to SSE (the Veil,
 * chat streaming) and mirrored to the durable file log. This is NOT the
 * HarnessLog and NOT the AgentAction ledger; those are separate on purpose.
 */
export type AgentEvent =
  | { type: "token"; text: string }
  | { type: "god"; godId: GodId }
  | { type: "status"; text: string }
  | { type: "skill"; name: string; level: 1 | 2 | 3 }
  | {
      type: "tool_start";
      name: string;
      risk?: RiskClass;
      source?: ToolSource;
      skill?: string;
    }
  | { type: "tool_gate"; name: string; decision: "gated" }
  | { type: "tool_result"; name: string; ok: boolean }
  | { type: "self_check"; verdict: "clear" | "concerns"; risks: string[]; passed: number; total: number }
  | { type: "subagent"; godId: GodId; state: "spawned" | "working" | "done" | "silent" }
  | { type: "proposal"; id: string }
  | { type: "usage"; promptTokens: number; completionTokens: number; totalTokens: number }
  | { type: "done"; output: string }
  | { type: "error"; message: string };

export type AgentEventType = AgentEvent["type"];

const TERMINAL: ReadonlySet<AgentEventType> = new Set(["done", "error"]);

export interface RunBus {
  emit(event: AgentEvent): void;
  subscribe(listener: (event: AgentEvent) => void): () => void;
  /** Snapshot of everything emitted so far (for replay / Message.events). */
  history(): AgentEvent[];
  /** Replays past events, then streams live ones until a terminal event. */
  stream(): AsyncGenerator<AgentEvent>;
  readonly closed: boolean;
}

/** One bus per run. `emit` is passed as the loop's `onEvent` AND `ctx.emit`. */
export function createEventBus(): RunBus {
  const listeners = new Set<(event: AgentEvent) => void>();
  const past: AgentEvent[] = [];
  let closed = false;

  function emit(event: AgentEvent): void {
    past.push(event);
    // copy so a listener that unsubscribes mid-emit doesn't mutate the set
    for (const listener of [...listeners]) listener(event);
    if (TERMINAL.has(event.type)) closed = true;
  }

  function subscribe(listener: (event: AgentEvent) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  async function* stream(): AsyncGenerator<AgentEvent> {
    // Snapshot length + subscribe with NO await between them (JS is
    // single-threaded, so no emit can interleave) → no lost/duplicated event.
    const replayUpto = past.length;
    const queue: AgentEvent[] = [];
    let wake: (() => void) | null = null;
    const unsub = subscribe((event) => {
      queue.push(event);
      if (wake) {
        wake();
        wake = null;
      }
    });

    try {
      for (let i = 0; i < replayUpto; i++) {
        const event = past[i]!;
        yield event;
        if (TERMINAL.has(event.type)) return;
      }
      if (closed && queue.length === 0) return;

      while (true) {
        if (queue.length === 0) {
          if (closed) return;
          await new Promise<void>((resolve) => {
            wake = resolve;
          });
        }
        while (queue.length > 0) {
          const event = queue.shift()!;
          yield event;
          if (TERMINAL.has(event.type)) return;
        }
      }
    } finally {
      unsub();
    }
  }

  return {
    emit,
    subscribe,
    history: () => [...past],
    stream,
    get closed() {
      return closed;
    },
  };
}

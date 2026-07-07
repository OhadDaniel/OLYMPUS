import { Inject, Injectable } from "@nestjs/common";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions.js";
import { config, USER_ID } from "../../../../src/config.js";
import { createMongoAudit } from "../../../../src/db/index.js";
import { createEventBus, type AgentEvent } from "../../../../src/events.js";
import { createHarnessLog, createRunId } from "../../../../src/log.js";
import { runAgentLoop } from "../../../../src/loop.js";
import { buildRuntimeSystemPrompt } from "../../../../src/system-prompt.js";
import { createRegistry } from "../../../../src/tools/registry.js";
import type { AgentRunResult, ToolContext } from "../../../../src/types.js";
import { VeilBus } from "./veil-bus.js";

/** The ONE registry + system prompt, and the single entry into runAgentLoop. */
@Injectable()
export class HarnessService {
  private readonly registry = createRegistry();
  private cachedSystem?: string;

  constructor(@Inject(VeilBus) private readonly veil: VeilBus) {}

  private get system(): string {
    return (this.cachedSystem ??= buildRuntimeSystemPrompt());
  }

  async runChat(opts: {
    messages: ChatCompletionMessageParam[];
    extraSystem?: string;
    onEvent: (event: AgentEvent) => void;
  }): Promise<{ result: AgentRunResult; events: AgentEvent[]; runId: string }> {
    const runId = createRunId();
    const bus = createEventBus();
    // One channel: SSE consumer + the global Veil both see every event.
    bus.subscribe((event) => {
      opts.onEvent(event);
      this.veil.publish(runId, event);
    });

    const ctx: ToolContext = {
      userId: USER_ID,
      runId,
      now: () => new Date(),
      tz: config.tz,
      skillsDir: config.skillsDir,
      emit: bus.emit,
      audit: createMongoAudit(),
    };

    const system = opts.extraSystem ? `${this.system}\n\n${opts.extraSystem}` : this.system;

    const result = await runAgentLoop({
      runId,
      system,
      messages: opts.messages,
      registry: this.registry,
      tools: this.registry.list(),
      ctx,
      onEvent: bus.emit,
      log: createHarnessLog(runId),
      // Model-initiated gated tools are always denied here; the human approval
      // path (ProposalsModule) calls execute directly, outside the loop (Day 2).
      approve: async () => false,
    });

    return { result, events: bus.history(), runId };
  }
}

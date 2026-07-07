import type { ChatCompletionMessageParam } from "openai/resources/chat/completions.js";
import { config } from "./config.js";
import type { AgentEvent } from "./events.js";
import { createGodMarkerStripper, stripGodMarkers } from "./god-markers.js";
import { createHarnessLog, type HarnessLog } from "./log.js";
import {
  completeWithTools,
  completeWithToolsStreaming,
  serializeAssistantMessage,
  serializeStreamedAssistant,
} from "./openai.js";
import type { Registry } from "./tools/registry.js";
import {
  MaxTurnsExceededError,
  type AgentRunResult,
  type ApproveFn,
  type ModelCallRecord,
  type RiskClass,
  type RunRecord,
  type ToolContext,
  type ToolDefinition,
} from "./types.js";
import { requiresApproval } from "./workflows/guardrails.js";

interface NormalizedToolCall {
  id: string;
  name: string;
  arguments: string;
}

function lastUserText(messages: ChatCompletionMessageParam[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role === "user") return typeof m.content === "string" ? m.content : "[structured]";
  }
  return "";
}

/**
 * THE one agent loop (SPEC §6). Model proposes, harness executes: every side
 * effect goes through the gate + zod-validated dispatch. Streaming when
 * `onEvent` is provided (first token < 1.5s — no blocking pre-work here).
 */
export async function runAgentLoop(input: {
  runId: string;
  system: string;
  messages: ChatCompletionMessageParam[];
  registry: Registry;
  /** Already scoped (registry.forAgent(godId) or registry.list()). */
  tools: ToolDefinition[];
  ctx: ToolContext;
  maxTurns?: number;
  approve?: ApproveFn;
  requireApprovalFor?: readonly RiskClass[];
  onEvent?: (event: AgentEvent) => void;
  log?: HarnessLog;
  userInput?: string;
}): Promise<AgentRunResult> {
  const maxTurns = input.maxTurns ?? config.maxTurns;
  const log: HarnessLog = input.log ?? createHarnessLog(input.runId);
  const emit: (event: AgentEvent) => void = input.onEvent ?? input.ctx.emit;
  const streaming = input.onEvent !== undefined;
  const policy = input.requireApprovalFor ?? input.ctx.policy;

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: input.system },
    ...structuredClone(input.messages),
  ];
  const openaiTools = input.registry.toOpenAITools(input.tools);
  const userInput = input.userInput ?? lastUserText(input.messages);

  const record: RunRecord = {
    runId: input.runId,
    userInput,
    startedAt: new Date().toISOString(),
    modelCalls: [],
    toolCalls: [],
    turnsUsed: 0,
    maxTurns,
    stopReason: "completed",
  };

  log.runStart(userInput, maxTurns);

  try {
    while (true) {
      if (record.turnsUsed >= maxTurns) {
        record.stopReason = "max_turns";
        throw new MaxTurnsExceededError(record.turnsUsed, maxTurns);
      }

      record.turnsUsed += 1;
      const turn = record.turnsUsed;
      const started = performance.now();

      // ── model call (streaming or not) ──────────────────────────
      let content: string;
      let toolCalls: NormalizedToolCall[];
      let usage: { promptTokens: number; completionTokens: number; totalTokens: number };

      if (streaming) {
        const stripper = createGodMarkerStripper(emit);
        const result = await completeWithToolsStreaming({
          model: config.model,
          messages,
          tools: openaiTools,
          onToken: (text) => stripper.push(text),
        });
        stripper.flush();
        content = result.content;
        toolCalls = result.toolCalls;
        usage = result.usage;
        messages.push(serializeStreamedAssistant(result.content, result.toolCalls));
      } else {
        const response = await completeWithTools({
          model: config.model,
          messages,
          tools: openaiTools,
        });
        const choice = response.choices[0];
        if (!choice) throw new Error("OpenAI returned no choices");
        const assistant = choice.message;
        content = assistant.content ?? "";
        toolCalls = (assistant.tool_calls ?? [])
          .filter((tc) => tc.type === "function")
          .map((tc) => ({ id: tc.id, name: tc.function.name, arguments: tc.function.arguments }));
        usage = {
          promptTokens: response.usage?.prompt_tokens ?? 0,
          completionTokens: response.usage?.completion_tokens ?? 0,
          totalTokens: response.usage?.total_tokens ?? 0,
        };
        messages.push(serializeAssistantMessage(assistant));
      }

      const durationMs = Math.round(performance.now() - started);
      const modelCall: ModelCallRecord = { turn, durationMs, ...usage };
      record.modelCalls.push(modelCall);
      log.modelCall({ turn, durationMs, ...usage, toolCallCount: toolCalls.length });
      emit({ type: "usage", ...usage });

      // ── terminal: no tool calls → we have the answer ───────────
      if (toolCalls.length === 0) {
        const raw = content.trim();
        if (!raw) throw new Error("Model returned empty content without tool calls");
        const output = stripGodMarkers(raw).trim();
        record.output = output;
        record.finishedAt = new Date().toISOString();
        log.runEnd(record);
        emit({ type: "done", output });
        return { messages, output, record };
      }

      // ── execute each tool call (gate → dispatch → audit) ───────
      for (const call of toolCalls) {
        const tool = input.registry.get(call.name);
        emit({
          type: "tool_start",
          name: call.name,
          risk: tool?.risk,
          source: tool?.source,
          skill: tool?.skill,
        });
        log.toolStart({ turn, name: call.name, risk: tool?.risk, source: tool?.source, skill: tool?.skill });

        const toolStarted = performance.now();
        let decision: "allowed" | "gated" | "denied" = "allowed";
        let result: string;
        let errorMessage: string | undefined;

        if (tool && requiresApproval(tool, policy)) {
          const approved = input.approve
            ? await input.approve({ name: tool.name, arguments: call.arguments, risk: tool.risk })
            : false;
          if (!approved) {
            decision = "gated";
            emit({ type: "tool_gate", name: tool.name, decision: "gated" });
            log.toolGate({ turn, name: tool.name, risk: tool.risk });
          }
        }

        if (decision === "gated") {
          result = "BLOCKED: awaiting user approval";
        } else {
          try {
            result = await input.registry.dispatch(call.name, call.arguments, input.ctx);
          } catch (error) {
            decision = "denied";
            errorMessage = error instanceof Error ? error.message : String(error);
            result = JSON.stringify({ ok: false, error: errorMessage });
          }
        }

        const durationTool = Math.round(performance.now() - toolStarted);
        const ok = decision === "allowed";
        emit({ type: "tool_result", name: call.name, ok });
        record.toolCalls.push({
          id: call.id,
          name: call.name,
          arguments: call.arguments,
          durationMs: durationTool,
          ok,
          decision,
          ...(errorMessage ? { error: errorMessage } : {}),
        });
        log.toolResult({ turn, name: call.name, ok, durationMs: durationTool, decision, ...(errorMessage ? { error: errorMessage } : {}) });

        if (input.ctx.audit) {
          // Best-effort: a ledger write must never crash a run.
          try {
            await input.ctx.audit.write({
              userId: input.ctx.userId,
              runId: input.runId,
              tool: call.name,
              input: call.arguments,
              ...(tool?.risk ? { risk: tool.risk } : {}),
              decision,
              result,
              ...(tool?.skill ? { skill: tool.skill } : {}),
            });
          } catch (auditError) {
            log.error("audit.write_failed", {
              tool: call.name,
              error: auditError instanceof Error ? auditError.message : String(auditError),
            });
          }
        }

        messages.push({ role: "tool", tool_call_id: call.id, content: result });
      }
    }
  } catch (error) {
    record.finishedAt = new Date().toISOString();

    if (error instanceof MaxTurnsExceededError) {
      record.error = error.message;
      log.runEnd(record);
      emit({ type: "error", message: error.message });
      throw error;
    }

    record.stopReason = "error";
    record.error = error instanceof Error ? error.message : String(error);
    log.runEnd(record);
    emit({ type: "error", message: record.error });
    throw error;
  }
}

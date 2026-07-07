import { z } from "zod";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions.js";
import type { AgentEvent } from "./events.js";

// ── Leaf domain types ───────────────────────────────────────────
export type RiskClass = "read_only" | "write" | "destructive";
export type ToolSource = "native" | "mcp";
export type GodId = "zeus" | "athena" | "asclepius" | "hermes" | "hestia" | "apollo";

// ── The approval gate ───────────────────────────────────────────
export interface ToolApprovalRequest {
  name: string;
  arguments: string;
  risk: RiskClass;
}

/** Returns true to allow the tool to execute, false to block it (guardrail). */
export type ApproveFn = (request: ToolApprovalRequest) => Promise<boolean>;

// ── Audit ledger (AgentAction rows) — optional until Mongo is wired ──
export interface AgentActionRow {
  userId: string;
  runId: string;
  tool: string;
  input: string;
  risk?: RiskClass;
  decision: "allowed" | "gated" | "denied";
  result: string;
  skill?: string;
}

export interface AuditWriter {
  write(row: AgentActionRow): Promise<void>;
}

/** Minimal shape of our authored MCP world-server client. */
export interface McpClient {
  callTool(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>>;
  listTools(): Promise<
    Array<{ name: string; description?: string; inputSchema: Record<string, unknown> }>
  >;
}

// ── Tool execution context (threaded into every tool) ───────────
export interface ToolContext {
  /** Constant "ohad" today — but never assume singleton; always filter by it. */
  userId: string;
  runId: string;
  /** Injectable clock so scheduling/tests are deterministic. */
  now: () => Date;
  tz: string;
  skillsDir: string;
  /** Same function as the loop's onEvent — one channel for tools + loop. */
  emit: (event: AgentEvent) => void;
  mcp?: McpClient;
  audit?: AuditWriter;
  /** Approval policy override; defaults to ["destructive"]. */
  policy?: readonly RiskClass[];
}

// ── Tool definitions ────────────────────────────────────────────
/**
 * Stored (type-erased) shape held by the registry. Authors never build this
 * directly — they use `defineTool`, which keeps `execute`'s args zod-typed.
 */
export interface ToolDefinition {
  name: string; // snake_case
  description: string;
  risk: RiskClass;
  source: ToolSource;
  scope: GodId[] | "all";
  /** Hand-authored STRICT JSON Schema fed to OpenAI (every prop in required). */
  parameters: Record<string, unknown>;
  /** Source-of-truth validation; dispatch runs this before execute. */
  schema: z.ZodType<unknown>;
  /** Tags a tool as skill-owned → surfaces in tool_start {skill} + audit. */
  skill?: string;
  /** Receives ALREADY-validated args (dispatch parsed them). */
  execute: (args: unknown, ctx: ToolContext) => Promise<string>;
}

/** Authoring helper: typed `execute`, erased into a `ToolDefinition`. */
export function defineTool<S extends z.ZodType>(def: {
  name: string;
  description: string;
  risk: RiskClass;
  source: ToolSource;
  scope: GodId[] | "all";
  parameters: Record<string, unknown>;
  schema: S;
  skill?: string;
  execute: (args: z.infer<S>, ctx: ToolContext) => Promise<string>;
}): ToolDefinition {
  return def as unknown as ToolDefinition;
}

// ── Run records ─────────────────────────────────────────────────
export interface ToolCallRecord {
  id: string;
  name: string;
  arguments: string;
  durationMs: number;
  ok: boolean;
  decision: "allowed" | "gated" | "denied";
  error?: string;
}

export interface ModelCallRecord {
  turn: number;
  durationMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface RunRecord {
  runId: string;
  userInput: string;
  startedAt: string;
  finishedAt?: string;
  modelCalls: ModelCallRecord[];
  toolCalls: ToolCallRecord[];
  turnsUsed: number;
  maxTurns: number;
  stopReason: "completed" | "max_turns" | "error";
  output?: string;
  error?: string;
}

export interface AgentRunResult {
  messages: ChatCompletionMessageParam[];
  output: string;
  record: RunRecord;
}

// ── Error taxonomy (name-stamped for cross-module identity) ─────
export class MaxTurnsExceededError extends Error {
  readonly turnsUsed: number;
  readonly maxTurns: number;
  constructor(turnsUsed: number, maxTurns: number) {
    super(`Agent exceeded max turns (${turnsUsed}/${maxTurns})`);
    this.name = "MaxTurnsExceededError";
    this.turnsUsed = turnsUsed;
    this.maxTurns = maxTurns;
  }
}

export class ToolNotFoundError extends Error {
  constructor(name: string) {
    super(`Unknown tool: ${name}`);
    this.name = "ToolNotFoundError";
  }
}

export class ToolExecutionError extends Error {
  constructor(name: string, cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    super(`Tool ${name} failed: ${detail}`);
    this.name = "ToolExecutionError";
  }
}

/** Structured-output validation failed; carries the zod issues for the retry. */
export class StructuredValidationError extends Error {
  readonly issues: string;
  constructor(issues: string) {
    super(`Structured output failed validation: ${issues}`);
    this.name = "StructuredValidationError";
    this.issues = issues;
  }
}

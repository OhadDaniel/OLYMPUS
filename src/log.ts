import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import type { RiskClass, RunRecord, ToolSource } from "./types.js";

type LogLevel = "info" | "warn" | "error";

interface LogPayload {
  level: LogLevel;
  event: string;
  [key: string]: unknown;
}

/** A sink for one structured log line (no trailing newline). */
export type LogWriter = (line: string) => void;

/** STDERR — never stdout by default. Product surfaces own stdout. */
export const stderrWriter: LogWriter = (line) => {
  process.stderr.write(`${line}\n`);
};

export const stdoutWriter: LogWriter = (line) => {
  process.stdout.write(`${line}\n`);
};

export const silentWriter: LogWriter = () => {};

/** Append log lines to a file, creating the directory if needed. */
export function fileWriter(filePath: string): LogWriter {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  return (line) => {
    fs.appendFileSync(filePath, `${line}\n`);
  };
}

/** Default sink resolved from config — users never see JSON logs. */
function resolveWriter(): LogWriter {
  switch (config.logDestination) {
    case "stdout":
      return stdoutWriter;
    case "stderr":
      return stderrWriter;
    case "silent":
      return silentWriter;
    case "file": {
      const day = new Date().toISOString().slice(0, 10);
      return fileWriter(path.resolve(config.logDir, `harness-${day}.jsonl`));
    }
  }
}

export class HarnessLog {
  private readonly runId: string;
  private readonly startedAt: string;
  private readonly writer: LogWriter;

  constructor(runId: string, writer: LogWriter = resolveWriter()) {
    this.runId = runId;
    this.startedAt = new Date().toISOString();
    this.writer = writer;
  }

  runStart(userInput: string, maxTurns: number): void {
    this.emit({ level: "info", event: "run.start", userInput, maxTurns });
  }

  modelCall(payload: {
    turn: number;
    durationMs: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    toolCallCount: number;
  }): void {
    this.emit({ level: "info", event: "model.call", ...payload });
  }

  toolStart(payload: {
    turn: number;
    name: string;
    risk?: RiskClass;
    source?: ToolSource;
    skill?: string;
  }): void {
    this.emit({ level: "info", event: "tool.start", ...payload });
  }

  toolGate(payload: { turn: number; name: string; risk?: RiskClass }): void {
    this.emit({ level: "warn", event: "tool.gate", decision: "gated", ...payload });
  }

  toolResult(payload: {
    turn: number;
    name: string;
    ok: boolean;
    durationMs: number;
    decision: "allowed" | "gated" | "denied";
    error?: string;
  }): void {
    this.emit({ level: payload.ok ? "info" : "warn", event: "tool.result", ...payload });
  }

  skill(payload: { name: string; level: 1 | 2 | 3 }): void {
    this.emit({ level: "info", event: "skill.load", name: payload.name, skillLevel: payload.level });
  }

  subagent(payload: { godId: string; state: string }): void {
    this.emit({ level: "info", event: "subagent", ...payload });
  }

  usage(payload: { promptTokens: number; completionTokens: number; totalTokens: number }): void {
    this.emit({ level: "info", event: "usage", ...payload });
  }

  runEnd(record: RunRecord): void {
    this.emit({
      level: record.stopReason === "error" ? "error" : "info",
      event: "run.end",
      stopReason: record.stopReason,
      turnsUsed: record.turnsUsed,
      modelCalls: record.modelCalls.length,
      toolCalls: record.toolCalls.length,
      outputPreview: record.output?.slice(0, 120),
      error: record.error,
    });
  }

  info(event: string, data: Record<string, unknown> = {}): void {
    this.emit({ level: "info", event, ...data });
  }

  error(event: string, data: Record<string, unknown> = {}): void {
    this.emit({ level: "error", event, ...data });
  }

  private emit(payload: LogPayload): void {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      runId: this.runId,
      startedAt: this.startedAt,
      ...payload,
    });
    this.writer(line);
  }
}

export function createHarnessLog(runId: string): HarnessLog {
  return new HarnessLog(runId);
}

export function createRunId(): string {
  return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

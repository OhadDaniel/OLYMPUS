import readline from "node:readline";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions.js";
import { config, USER_ID } from "../src/config.js";
import { connectDb, createMongoAudit, disconnectDb } from "../src/db/index.js";
import { createEventBus } from "../src/events.js";
import { createHarnessLog, createRunId } from "../src/log.js";
import { runAgentLoop } from "../src/loop.js";
import { GODS } from "../src/pantheon.js";
import { buildRuntimeSystemPrompt } from "../src/system-prompt.js";
import { createRegistry } from "../src/tools/registry.js";
import type { AgentEvent } from "../src/events.js";
import type { ToolContext } from "../src/types.js";

// stderr = harness events (dev-facing). stdout = Maxwell's words only.
const err = (s: string) => process.stderr.write(s + "\n");
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const gold = (s: string) => `\x1b[38;5;179m${s}\x1b[0m`;

function renderEvent(event: AgentEvent): void {
  switch (event.type) {
    case "token":
      process.stdout.write(event.text);
      break;
    case "god":
      process.stdout.write(`\n${gold(`— ${GODS[event.godId].name} steps forward —`)}\n`);
      break;
    case "skill":
      err(dim(`  · skill loaded: ${event.name} (L${event.level})`));
      break;
    case "status":
      err(dim(`  · ${event.text}`));
      break;
    case "tool_start":
      err(dim(`  → tool ${event.name} [${event.risk ?? "?"} · ${event.source ?? "?"}${event.skill ? " · skill:" + event.skill : ""}]`));
      break;
    case "tool_gate":
      err(dim(`  ⛔ gated: ${event.name} (awaiting approval)`));
      break;
    case "tool_result":
      err(dim(`  ← tool ${event.name} ${event.ok ? "ok" : "blocked/failed"}`));
      break;
    case "usage":
      err(dim(`  · tokens: ${event.totalTokens} (${event.promptTokens}+${event.completionTokens})`));
      break;
    case "done":
      process.stdout.write("\n");
      break;
    case "error":
      err(`\n[error] ${event.message}`);
      break;
    default:
      break;
  }
}

const registry = createRegistry();
const system = buildRuntimeSystemPrompt();

async function runTurn(history: ChatCompletionMessageParam[], userText: string): Promise<void> {
  history.push({ role: "user", content: userText });
  const runId = createRunId();
  const bus = createEventBus();
  bus.subscribe(renderEvent);

  const ctx: ToolContext = {
    userId: USER_ID,
    runId,
    now: () => new Date(),
    tz: config.tz,
    skillsDir: config.skillsDir,
    emit: bus.emit,
    audit: createMongoAudit(),
  };

  try {
    const result = await runAgentLoop({
      runId,
      system,
      messages: history,
      registry,
      tools: registry.list(),
      ctx,
      onEvent: bus.emit,
      log: createHarnessLog(runId),
      // REPL denies gated tools; the human approval path lives in the API (Day 2).
      approve: async ({ name }) => {
        err(dim(`  (repl auto-denies gated tool: ${name})`));
        return false;
      },
    });
    // Keep the assistant turn in history for multi-turn context.
    history.push({ role: "assistant", content: result.output });
  } catch (error) {
    err(`\n[run failed] ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const onceIdx = argv.indexOf("--once");
  const history: ChatCompletionMessageParam[] = [];

  if (config.mongodbUri) {
    await connectDb();
    err(dim("[db connected]"));
  } else {
    err(dim("[no MONGODB_URI — db-backed tools will report unavailable]"));
  }

  if (onceIdx !== -1) {
    const prompt = argv.slice(onceIdx + 1).join(" ").trim() || "How does my week look?";
    err(dim(`\n[maxwell repl · one-shot · model=${config.model}]`));
    await runTurn(history, prompt);
    await disconnectDb();
    return;
  }

  err(dim(`\n[maxwell repl · model=${config.model}] type to talk, Ctrl+C to leave.\n`));
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr, prompt: "you › " });
  rl.prompt();
  rl.on("line", async (line) => {
    const text = line.trim();
    if (!text) return rl.prompt();
    process.stdout.write("\nmaxwell › ");
    await runTurn(history, text);
    process.stdout.write("\n");
    rl.prompt();
  });
  rl.on("close", () => {
    void disconnectDb().finally(() => process.exit(0));
  });
}

void main();

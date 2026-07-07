import fs from "node:fs";
import path from "node:path";
import { config, USER_ID } from "../src/config.js";
import { connectDb, disconnectDb, EvalRun } from "../src/db/index.js";
import { runEvals } from "../src/evals/run.js";

const THRESHOLD = 90; // regression gate: fail CI below this

const card = runEvals();

for (const s of card.suites) {
  console.log(`${s.pct === 100 ? "✓" : "✗"} ${s.suite.padEnd(20)} ${String(s.passed).padStart(2)}/${s.total}  — ${s.description}`);
  for (const c of s.cases.filter((x) => !x.passed)) console.log(`     ✗ ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
}
console.log(`\nProving Ground — OVERALL ${card.overallPct}%  (${card.overallPassed}/${card.overallTotal})`);

fs.mkdirSync(path.resolve(config.repoRoot, "logs"), { recursive: true });
fs.writeFileSync(path.resolve(config.repoRoot, "logs/eval-report.json"), JSON.stringify(card, null, 2));

if (config.mongodbUri) {
  try {
    await connectDb();
    await EvalRun.create({
      userId: USER_ID,
      overallPct: card.overallPct,
      overallPassed: card.overallPassed,
      overallTotal: card.overallTotal,
      suites: card.suites,
    });
    await disconnectDb();
  } catch {
    // history is best-effort
  }
}

if (card.overallPct < THRESHOLD) {
  console.error(`\nREGRESSION GATE FAILED: ${card.overallPct}% < ${THRESHOLD}%`);
  process.exit(1);
}
process.exit(0);

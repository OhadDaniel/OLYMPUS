import { Controller, Get } from "@nestjs/common";
import { USER_ID } from "../../../../src/config.js";
import { EvalRun } from "../../../../src/db/index.js";
import { runEvals } from "../../../../src/evals/run.js";
import type { Scorecard } from "../../../../src/evals/types.js";

@Controller("evals")
export class EvalsController {
  /** Run the Proving Ground live (pure + deterministic). */
  @Get()
  run(): Scorecard {
    return runEvals();
  }

  /** Recent runs, for "score vs last commit". */
  @Get("history")
  async history() {
    const runs = await EvalRun.find({ userId: USER_ID })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean<Array<{ overallPct: number; createdAt: Date }>>();
    return runs.map((r) => ({ pct: r.overallPct, at: r.createdAt }));
  }
}

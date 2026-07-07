import { allSuites } from "./suites.js";
import type { Scorecard } from "./types.js";

/** Run every suite and aggregate into a scorecard. Pure + deterministic. */
export function runEvals(): Scorecard {
  const suites = allSuites();
  const overallPassed = suites.reduce((s, x) => s + x.passed, 0);
  const overallTotal = suites.reduce((s, x) => s + x.total, 0);
  return {
    suites,
    overallPassed,
    overallTotal,
    overallPct: overallTotal ? Math.round((overallPassed / overallTotal) * 100) : 100,
    at: new Date().toISOString(),
  };
}

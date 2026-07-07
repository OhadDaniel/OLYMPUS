export interface EvalCase {
  name: string;
  passed: boolean;
  detail?: string;
}

export interface SuiteResult {
  suite: string;
  description: string;
  cases: EvalCase[];
  passed: number;
  total: number;
  pct: number;
}

export interface Scorecard {
  suites: SuiteResult[];
  overallPassed: number;
  overallTotal: number;
  overallPct: number;
  at: string;
}

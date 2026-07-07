import type { RiskClass } from "../types.js";

/**
 * The approval gate — deterministic code, never a prompt (SPEC §6).
 *
 * By default only `destructive` tools require a human OK. `write` tools are
 * auto-approved because today's writes (remember, update_scroll) are
 * self-contained. The schedule of record can therefore never change from model
 * initiative — only through the human-approved proposal path.
 */
export const DEFAULT_APPROVAL_POLICY: readonly RiskClass[] = ["destructive"];

/**
 * Tools that are gated regardless of policy. `apply_proposal` is the only write
 * path to the schedule; it stays gated even if the policy is ever loosened, so
 * a model-initiated apply is always blocked (the Veil shows the gate — a demo
 * beat). The human Approve button calls the tool's execute directly, outside
 * the loop.
 */
export const ALWAYS_GATED: ReadonlySet<string> = new Set(["apply_proposal"]);

/** Pure and unit-testable: no I/O, no prompt. */
export function requiresApproval(
  tool: { name: string; risk: RiskClass },
  policy: readonly RiskClass[] = DEFAULT_APPROVAL_POLICY,
): boolean {
  return ALWAYS_GATED.has(tool.name) || policy.includes(tool.risk);
}

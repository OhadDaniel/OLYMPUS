import { describe, expect, it } from "vitest";
import { ALWAYS_GATED, DEFAULT_APPROVAL_POLICY, requiresApproval } from "./guardrails.js";

describe("requiresApproval (the deterministic gate)", () => {
  it("auto-approves self-contained writes under the default policy", () => {
    expect(requiresApproval({ name: "remember", risk: "write" })).toBe(false);
    expect(requiresApproval({ name: "update_scroll", risk: "write" })).toBe(false);
  });

  it("never gates read-only tools", () => {
    expect(requiresApproval({ name: "get_week", risk: "read_only" })).toBe(false);
  });

  it("gates destructive tools", () => {
    expect(requiresApproval({ name: "some_destructive", risk: "destructive" })).toBe(true);
  });

  it("ALWAYS gates apply_proposal — even if its risk were downgraded", () => {
    expect(ALWAYS_GATED.has("apply_proposal")).toBe(true);
    expect(requiresApproval({ name: "apply_proposal", risk: "destructive" })).toBe(true);
    // The schedule-of-record guarantee holds regardless of risk classification:
    expect(requiresApproval({ name: "apply_proposal", risk: "read_only" })).toBe(true);
  });

  it("respects a widened policy", () => {
    expect(requiresApproval({ name: "remember", risk: "write" }, ["write", "destructive"])).toBe(true);
    expect(DEFAULT_APPROVAL_POLICY).toEqual(["destructive"]);
  });
});

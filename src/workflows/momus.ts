import { Goal, ImportedEvent, Proposal, Scroll } from "../db/index.js";
import type { ProposalAdd } from "../db/models/proposal.js";
import { constraintsFromProfile } from "../scheduling/intents.js";

export interface Critique {
  verdict: "clear" | "concerns";
  risks: string[];
  checks: Array<{ name: string; passed: boolean }>;
}

function parseHM(hm?: string): number | null {
  if (!hm) return null;
  const [h, m] = hm.split(":").map((n) => parseInt(n, 10));
  return (h ?? 0) * 60 + (m ?? 0);
}
function minsOf(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}
const WORK_GODS = new Set(["athena", "hermes"]);

/**
 * Momus — a GROUNDED critic. Before the human ever sees a proposal, it checks
 * the drafted diff against the real calendar, the Scroll's constraints, and the
 * stated goals, and records the verdict on the proposal. Not free self-correction
 * — every check is answered against ground truth.
 */
export async function critiqueProposal(userId: string, proposalId: string): Promise<Critique> {
  const proposal = await Proposal.findOne({ _id: proposalId, userId }).lean<{ diff?: { adds?: ProposalAdd[] } } | null>();
  const adds: ProposalAdd[] = proposal?.diff?.adds ?? [];

  if (adds.length === 0) {
    return { verdict: "clear", risks: [], checks: [{ name: "proposal has changes to review", passed: true }] };
  }

  const starts = adds.map((a) => new Date(a.start).getTime());
  const from = new Date(Math.min(...starts));
  const to = new Date(Math.max(...adds.map((a) => new Date(a.end).getTime())));

  const [imported, goals, scroll] = await Promise.all([
    ImportedEvent.find({ userId, start: { $lt: new Date(to.getTime() + 86_400_000) }, end: { $gt: from } }).lean(),
    Goal.find({ userId, status: "active" }).lean(),
    Scroll.findOne({ userId }).lean(),
  ]);
  const constraints = constraintsFromProfile(scroll?.profile);
  const quietStart = parseHM(constraints.quietHours?.start);
  const quietEnd = parseHM(constraints.quietHours?.end);
  const noWork = parseHM(constraints.noWorkAfter);

  const risks: string[] = [];
  const checks: Critique["checks"] = [];
  const check = (name: string, passed: boolean, risk?: string) => {
    checks.push({ name, passed });
    if (!passed && risk) risks.push(risk);
  };

  // 1. No collision with the real (outer-world) calendar.
  const worldHit = adds.filter((a) => {
    const as = new Date(a.start).getTime();
    const ae = new Date(a.end).getTime();
    return imported.some((e) => as < e.end.getTime() && ae > e.start.getTime());
  });
  check("no block collides with your real calendar", worldHit.length === 0, worldHit.length ? `${worldHit.length} block(s) overlap a real calendar event (e.g. "${worldHit[0]!.title}")` : undefined);

  // 2. Nothing in the past.
  const now = Date.now();
  check("no block is scheduled in the past", !adds.some((a) => new Date(a.end).getTime() < now), "a proposed block is in the past");

  // 3. Quiet hours / no-work windows respected.
  let quietHit = false;
  let workHit = false;
  for (const a of adds) {
    const s = minsOf(new Date(a.start));
    const e = minsOf(new Date(a.end));
    if (quietStart !== null && quietEnd !== null) {
      const inQuiet = quietStart < quietEnd ? s < quietEnd && e > quietStart : e > quietStart || s < quietEnd;
      if (inQuiet) quietHit = true;
    }
    if (noWork !== null && WORK_GODS.has(a.godId) && e > noWork) workHit = true;
  }
  check("nothing lands in your quiet hours", !quietHit, quietHit ? "a block falls inside your quiet hours" : undefined);
  check("no work-domain block past your no-work time", !workHit, workHit ? "a work block runs past your no-work cutoff" : undefined);

  // 4. Every block serves a stated goal (grounded relevance).
  const goalGods = new Set(goals.map((g) => g.godId));
  const orphans = adds.filter((a) => !goalGods.has(a.godId));
  check("every block serves a current goal", orphans.length === 0, orphans.length ? `${orphans.length} block(s) don't map to an active goal` : undefined);

  // 5. No two proposed blocks overlap each other.
  let selfOverlap = false;
  for (let i = 0; i < adds.length; i++) {
    for (let j = i + 1; j < adds.length; j++) {
      const ai = adds[i]!;
      const aj = adds[j]!;
      if (new Date(ai.start) < new Date(aj.end) && new Date(ai.end) > new Date(aj.start)) selfOverlap = true;
    }
  }
  check("no two proposed blocks overlap", !selfOverlap, selfOverlap ? "two proposed blocks overlap" : undefined);

  const critique: Critique = { verdict: risks.length === 0 ? "clear" : "concerns", risks, checks };
  await Proposal.updateOne({ _id: proposalId, userId }, { $set: { critique } });
  return critique;
}

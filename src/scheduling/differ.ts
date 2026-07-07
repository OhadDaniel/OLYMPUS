import type { ProposalAdd, ProposalDiff, ProposalMove } from "../db/models/proposal.js";
import type { GodId } from "../types.js";
import type { Placement } from "./types.js";

export interface ExistingBlock {
  id: string;
  godId: GodId;
  title: string;
  start: Date;
  end: Date;
}

function keyOf(b: { godId: GodId; title: string }): string {
  return `${b.godId}|${b.title.trim().toLowerCase()}`;
}

/**
 * Pure diff (owned by the week-planner/editor skills). Compares the desired
 * placements against the current cycle's blocks and classifies each change:
 * unchanged (no-op), moved (same god+title, new time), added (new), or deleted
 * (existing not in the design, plus explicit drops).
 */
export function diffSchedule(
  existing: ExistingBlock[],
  placements: Placement[],
  drops: string[] = [],
): ProposalDiff {
  const dropSet = new Set(drops);
  const adds: ProposalAdd[] = [];
  const moves: ProposalMove[] = [];
  const deletes: string[] = [...dropSet];

  const pool = new Map<string, ExistingBlock[]>();
  for (const e of existing) {
    if (dropSet.has(e.id)) continue;
    const arr = pool.get(keyOf(e)) ?? [];
    arr.push(e);
    pool.set(keyOf(e), arr);
  }

  const matched = new Set<string>();
  for (const p of placements) {
    const queue = pool.get(keyOf(p));
    const cand = queue && queue.length > 0 ? queue.shift() : undefined;
    if (cand) {
      matched.add(cand.id);
      if (cand.start.getTime() !== p.start.getTime() || cand.end.getTime() !== p.end.getTime()) {
        moves.push({ blockId: cand.id, toStart: p.start, toEnd: p.end });
      }
    } else {
      adds.push({
        godId: p.godId,
        title: p.title,
        start: p.start,
        end: p.end,
        isAnchor: p.isAnchor,
      });
    }
  }

  for (const e of existing) {
    if (dropSet.has(e.id) || matched.has(e.id)) continue;
    deletes.push(e.id);
  }

  return { adds, moves, deletes };
}

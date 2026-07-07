import { describe, expect, it } from "vitest";
import { diffSchedule, type ExistingBlock } from "./differ.js";
import type { Placement } from "./types.js";

const d = (day: number, h: number) => new Date(2026, 6, day, h, 0, 0, 0);

function placement(over: Partial<Placement>): Placement {
  return {
    intentId: "i",
    godId: "athena",
    title: "Deep work",
    start: d(6, 8),
    end: d(6, 9),
    isAnchor: false,
    ...over,
  };
}
function existing(over: Partial<ExistingBlock>): ExistingBlock {
  return { id: "e1", godId: "athena", title: "Deep work", start: d(6, 8), end: d(6, 9), ...over };
}

describe("diffSchedule", () => {
  it("adds everything when nothing exists", () => {
    const diff = diffSchedule([], [placement({}), placement({ title: "Inbox", godId: "hermes" })]);
    expect(diff.adds).toHaveLength(2);
    expect(diff.moves).toHaveLength(0);
    expect(diff.deletes).toHaveLength(0);
  });

  it("is a no-op when a placement matches an existing block exactly", () => {
    const diff = diffSchedule([existing({})], [placement({})]);
    expect(diff.adds).toHaveLength(0);
    expect(diff.moves).toHaveLength(0);
    expect(diff.deletes).toHaveLength(0);
  });

  it("emits a move when the same block shifts time", () => {
    const diff = diffSchedule([existing({})], [placement({ start: d(6, 10), end: d(6, 11) })]);
    expect(diff.moves).toHaveLength(1);
    expect(diff.moves[0]!.blockId).toBe("e1");
    expect(diff.adds).toHaveLength(0);
    expect(diff.deletes).toHaveLength(0);
  });

  it("deletes existing blocks not present in the design", () => {
    const diff = diffSchedule(
      [existing({}), existing({ id: "e2", godId: "hermes", title: "Inbox" })],
      [placement({})],
    );
    expect(diff.deletes).toEqual(["e2"]);
    expect(diff.adds).toHaveLength(0);
    expect(diff.moves).toHaveLength(0);
  });

  it("honors explicit drops", () => {
    const diff = diffSchedule([existing({})], [], ["e1"]);
    expect(diff.deletes).toEqual(["e1"]);
  });
});

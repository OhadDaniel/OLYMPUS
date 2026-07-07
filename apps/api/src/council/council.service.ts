import { Inject, Injectable } from "@nestjs/common";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions.js";
import { config, USER_ID } from "../../../../src/config.js";
import {
  COUNCIL_GODS,
  mergeIntents,
  prepareCouncil,
  runGod,
  type CouncilPrep,
  type GodReport,
} from "../../../../src/council.js";
import { Cycle, Episode, ImportedEvent, Proposal, Scroll } from "../../../../src/db/index.js";
import { createEventBus } from "../../../../src/events.js";
import { createGodMarkerStripper } from "../../../../src/god-markers.js";
import { createRunId } from "../../../../src/log.js";
import { completeWithToolsStreaming } from "../../../../src/openai.js";
import { GODS } from "../../../../src/pantheon.js";
import { diffSchedule } from "../../../../src/scheduling/differ.js";
import { constraintsFromProfile, toPlacerIntents } from "../../../../src/scheduling/intents.js";
import { placeIntents } from "../../../../src/scheduling/placer.js";
import { VeilBus } from "../core/veil-bus.js";

function synthesisPrompt(prep: CouncilPrep, reports: GodReport[]): ChatCompletionMessageParam[] {
  const digest = reports
    .map((r) => `## ${GODS[r.godId].name}\nheadline: ${r.headline}\nwins: ${r.wins.join("; ")}\nconcerns: ${r.concerns.join("; ")}\ntip: ${r.tip}\nquestion: ${r.oneQuestion}`)
    .join("\n\n");
  return [
    {
      role: "system",
      content:
        "You are Maxwell, closing the Weekly Council (the `feedbacker` ritual). Speak to Ohad directly, warm and concise. " +
        "Order, strictly: (1) wins first — what he actually pulled off; (2) the data — the real adherence numbers below, un-spun; " +
        "(3) the tips — at most ONE per god, only where it earns its place; (4) the feedback exchange — ask him 2–3 real questions, " +
        "and one MUST be some form of 'What did I get wrong about you this week?'. Never shame. One mythic flourish at most. " +
        "You may let a god speak a line with a [god:x] marker. End by telling him next week is proposed for his approval.",
    },
    {
      role: "user",
      content: `The cycle's numbers: overall adherence ${prep.week.stats.adherencePct ?? "—"}%, per-god ${JSON.stringify(prep.week.stats.perGod)}.\n\nThe gods' reports:\n${digest}`,
    },
  ];
}

@Injectable()
export class CouncilService {
  constructor(@Inject(VeilBus) private readonly veil: VeilBus) {}

  async run(send: (event: unknown) => void): Promise<void> {
    const runId = createRunId();
    const bus = createEventBus();
    bus.subscribe((e) => {
      send(e);
      this.veil.publish(runId, e);
    });
    const emit = bus.emit;

    // Prepare: the cycle just past (last 7 days).
    const to = new Date();
    to.setHours(0, 0, 0, 0);
    const from = new Date(to);
    from.setDate(from.getDate() - 7);
    const prep = await prepareCouncil(USER_ID, from, to);

    // Fan-out: five gods in parallel, each emitting its lifecycle to the god cards + Veil.
    emit({ type: "status", text: "The council convenes…" });
    const results = await Promise.all(
      COUNCIL_GODS.map(async (godId) => {
        emit({ type: "subagent", godId, state: "spawned" });
        emit({ type: "subagent", godId, state: "working" });
        const report = await runGod(godId, prep);
        emit({ type: "subagent", godId, state: report ? "done" : "silent" });
        return report;
      }),
    );
    const reports = results.filter((r): r is GodReport => r !== null);
    send({ type: "reports", reports });

    // Synthesis: Zeus streams wins → data → tips → the feedback exchange.
    emit({ type: "status", text: "Zeus synthesizes…" });
    const stripper = createGodMarkerStripper(emit);
    await completeWithToolsStreaming({
      model: config.model,
      messages: synthesisPrompt(prep, reports),
      tools: [],
      onToken: (t) => stripper.push(t),
    });
    stripper.flush();

    // Design next cycle from the merged intents → one proposal for the whole week.
    const nextFrom = to;
    const nextTo = new Date(to);
    nextTo.setDate(nextTo.getDate() + 7);
    const [scroll, imported] = await Promise.all([
      Scroll.findOne({ userId: USER_ID }).lean(),
      ImportedEvent.find({ userId: USER_ID, start: { $lt: nextTo }, end: { $gt: nextFrom } }).lean(),
    ]);
    const { placements } = placeIntents({
      windowStart: nextFrom,
      windowEnd: nextTo,
      intents: toPlacerIntents(mergeIntents(reports)),
      busy: imported.map((e) => ({ start: e.start, end: e.end })),
      constraints: constraintsFromProfile(scroll?.profile),
      notBefore: new Date(),
    });
    const cycle = await Cycle.create({ userId: USER_ID, startsOn: nextFrom, endsOn: nextTo, councilAt: new Date(), kind: "full" });
    const diff = diffSchedule([], placements, []);
    const proposal = await Proposal.create({
      userId: USER_ID,
      kind: "week_plan",
      diff,
      status: "pending",
      cycleId: String(cycle._id),
    });
    emit({ type: "proposal", id: String(proposal._id) });

    await Episode.create({
      userId: USER_ID,
      kind: "council",
      summary: `Weekly council: ${reports.length}/${COUNCIL_GODS.length} gods reported; next cycle proposed (${diff.adds.length} blocks).`,
      tags: ["council"],
      consolidated: false,
    });

    emit({ type: "done", output: `Council complete — next week proposed with ${diff.adds.length} blocks for your approval.` });
    send({ type: "__end__" });
  }
}

import { Inject, Injectable } from "@nestjs/common";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions.js";
import { USER_ID } from "../../../../src/config.js";
import { prepareCouncil } from "../../../../src/council.js";
import { Block, ChatSession, ImportedEvent, Message, Scroll } from "../../../../src/db/index.js";
import { HarnessService } from "../core/harness.service.js";

interface ChatInput {
  message: string;
  sessionId?: string;
  mode?: string;
}

@Injectable()
export class ChatService {
  constructor(@Inject(HarnessService) private readonly harness: HarnessService) {}

  async stream(input: ChatInput, send: (obj: unknown) => void): Promise<void> {
    const userId = USER_ID;

    const council = input.mode === "council";
    const session =
      (input.sessionId ? await ChatSession.findById(input.sessionId) : null) ??
      (await ChatSession.create({
        userId,
        kind: council ? "council" : "chat",
        title: council ? "Weekend council" : input.message.slice(0, 60),
      }));
    const sessionId = String(session._id);
    send({ type: "session", id: sessionId });

    const prior = await Message.find({ userId, sessionId }).sort({ createdAt: 1 }).lean();
    const history: ChatCompletionMessageParam[] = prior
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
    history.push({ role: "user", content: input.message });

    await Message.create({ userId, sessionId, role: "user", content: input.message });

    // Pre-fetch context so the first token comes fast (no mandatory tool round-trip).
    let extraSystem = await this.buildContext(userId);
    if (council) extraSystem += "\n\n" + (await this.buildCouncilContext(userId));

    const { result, events } = await this.harness.runChat({ messages: history, extraSystem, onEvent: send });

    await Message.create({ userId, sessionId, role: "assistant", content: result.output, events });
  }

  /** Compact ground-truth block injected into the system prompt. */
  private async buildContext(userId: string): Promise<string> {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const [scroll, blocks, imported] = await Promise.all([
      Scroll.findOne({ userId }).lean(),
      Block.find({ userId, start: { $gte: start, $lt: end } }).sort({ start: 1 }).limit(40).lean(),
      ImportedEvent.find({ userId, start: { $gte: start, $lt: end } }).sort({ start: 1 }).limit(40).lean(),
    ]);

    const lines: string[] = ["## Context (pre-fetched — treat as ground truth about the present)"];
    lines.push(`Now: ${now.toISOString()}`);

    const noScroll = !scroll || !scroll.profile || !scroll.profile.identity?.name;
    if (noScroll) {
      lines.push(
        "Scroll: not yet created — this is the FIRST MEETING. Load the `psychologist` skill and lead " +
          "the interview per its playbook: warm, one question at a time, reflect from the calendar " +
          "(call `world_calendar_events` for the next week early and mirror what you see), and capture " +
          "durable facts with `remember` (tagged by area) before moving on. Do not pretend to already " +
          "know him. Keep it to 15–20 minutes and get enough to design his first week.",
      );
    }
    if (!noScroll && scroll) {
      const p = scroll.profile;
      const name = p.identity?.name ?? "unknown";
      lines.push(
        `Scroll v${scroll.version}: name=${name}; tone=${p.preferences?.tone ?? "balanced"}; ` +
          `constraints=${(p.constraints ?? []).join("; ") || "none recorded"}.`,
      );
    }

    if (blocks.length === 0 && imported.length === 0) {
      lines.push("The Loom (next 7 days): empty. No designed blocks and no imported outer-world events.");
    } else {
      lines.push(
        `The Loom (next 7 days): ${blocks.length} designed block(s); ${imported.length} outer-world event(s). ` +
          "Use get_week for details before discussing specifics.",
      );
    }

    return lines.join("\n");
  }

  /** Weekend-council mode: the week just past, in real numbers, plus how to hold
   *  the conversation. Injected as system context (the persona itself stays in
   *  prompts/maxwell.system.md — this only sets the ritual and the ground truth). */
  private async buildCouncilContext(userId: string): Promise<string> {
    const to = new Date();
    to.setHours(0, 0, 0, 0);
    const from = new Date(to);
    from.setDate(from.getDate() - 7);
    const prep = await prepareCouncil(userId, from, to);

    const goalLines = Object.entries(prep.goalsByGod)
      .flatMap(([god, gs]) => gs.map((g) => `${god}: ${g.title} (${g.wheelBaseline ?? "?"}→${g.wheelCurrent ?? "?"})`))
      .join("; ");

    return [
      "## The Weekend Council (the `feedbacker` ritual — a CONVERSATION, not a report)",
      "It is the weekend. You are Maxwell, presiding over the weekly council with Ohad. The other gods attend and may step forward with a [god:x] marker when their domain is in play. This is a real back-and-forth: reflect on the week just past, hear him, and design the next week TOGETHER.",
      "",
      "The week just past — the real numbers (never invent figures):",
      `- Overall adherence: ${prep.week.stats.adherencePct ?? "—"}%`,
      `- Per god: ${JSON.stringify(prep.week.stats.perGod)}`,
      goalLines ? `- Goals in play: ${goalLines}` : "",
      "",
      "How to hold it:",
      "- Open warm and brief. Wins first — what he actually pulled off — then the numbers, un-spun. Never shame.",
      "- Then TALK WITH HIM. Short turns, one question at a time; listen and follow his lead. At least once ask some form of 'What did I get wrong about you this week?'",
      "- Do NOT dump a full written report or a wall of bullet points. This is a dialogue.",
      "- When you've heard enough and he's ready, design next week and offer it with the propose_week tool for his approval. You never write the schedule yourself — only he seals it.",
    ]
      .filter(Boolean)
      .join("\n");
  }
}

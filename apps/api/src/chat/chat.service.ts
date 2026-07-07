import { Inject, Injectable } from "@nestjs/common";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions.js";
import { USER_ID } from "../../../../src/config.js";
import { Block, ChatSession, ImportedEvent, Message, Scroll } from "../../../../src/db/index.js";
import { HarnessService } from "../core/harness.service.js";

interface ChatInput {
  message: string;
  sessionId?: string;
}

@Injectable()
export class ChatService {
  constructor(@Inject(HarnessService) private readonly harness: HarnessService) {}

  async stream(input: ChatInput, send: (obj: unknown) => void): Promise<void> {
    const userId = USER_ID;

    const session =
      (input.sessionId ? await ChatSession.findById(input.sessionId) : null) ??
      (await ChatSession.create({ userId, kind: "chat", title: input.message.slice(0, 60) }));
    const sessionId = String(session._id);
    send({ type: "session", id: sessionId });

    const prior = await Message.find({ userId, sessionId }).sort({ createdAt: 1 }).lean();
    const history: ChatCompletionMessageParam[] = prior
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
    history.push({ role: "user", content: input.message });

    await Message.create({ userId, sessionId, role: "user", content: input.message });

    // Pre-fetch context so the first token comes fast (no mandatory tool round-trip).
    const extraSystem = await this.buildContext(userId);

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
}

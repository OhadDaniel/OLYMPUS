import { Inject, Injectable } from "@nestjs/common";
import { USER_ID } from "../../../../src/config.js";
import { EmailInsight, Episode, Goal, Scroll } from "../../../../src/db/index.js";
import type { Tone } from "../../../../src/domain.js";
import { GODS, isGodId } from "../../../../src/pantheon.js";
import { WorldMcpClient } from "../../../../src/tools/mcp-client.js";
import type { GodId } from "../../../../src/types.js";
import { buildBridgeProposal, extractEmailInsights } from "../../../../src/workflows/first-meeting.js";
import { verifyFirstMeeting } from "../../../../src/workflows/verify-first-meeting.js";

@Injectable()
export class OnboardingService {
  constructor(@Inject(WorldMcpClient) private readonly mcp: WorldMcpClient) {}

  async status() {
    const scroll = await Scroll.findOne({ userId: USER_ID }).lean();
    const needed = !scroll?.profile?.identity?.name;
    return { needed, verify: await verifyFirstMeeting(USER_ID) };
  }

  /** Wheel sliders → one baseline Goal per god (1–10). */
  async setWheel(values: Record<string, number>) {
    const saved: string[] = [];
    for (const [godId, raw] of Object.entries(values)) {
      if (!isGodId(godId) || godId === "zeus") continue;
      const wheelBaseline = Math.max(1, Math.min(10, Math.round(raw)));
      await Goal.findOneAndUpdate(
        { userId: USER_ID, godId, title: `${GODS[godId as GodId].domain}` },
        { $set: { wheelBaseline, status: "active" } },
        { upsert: true },
      );
      saved.push(godId);
    }
    return { ok: true, saved };
  }

  async setGoals(goals: Array<{ godId: string; title: string; target?: string }>) {
    const created: string[] = [];
    for (const g of goals) {
      if (!isGodId(g.godId) || !g.title?.trim()) continue;
      const doc = await Goal.create({
        userId: USER_ID,
        godId: g.godId,
        title: g.title.trim(),
        ...(g.target ? { target: g.target } : {}),
        status: "active",
      });
      created.push(String(doc._id));
    }
    return { ok: true, created };
  }

  async scanEmail() {
    const insights = await extractEmailInsights(USER_ID, this.mcp);
    return { ok: true, insights };
  }

  async listInsights() {
    return EmailInsight.find({ userId: USER_ID, handled: false }).sort({ createdAt: -1 }).lean();
  }

  async confirmInsight(id: string) {
    await EmailInsight.updateOne({ _id: id, userId: USER_ID }, { $set: { handled: true } });
    return { ok: true };
  }

  async bridge() {
    return buildBridgeProposal(USER_ID);
  }

  async verify() {
    return verifyFirstMeeting(USER_ID);
  }

  /** Write Scroll v1 + log the first-meeting episode. */
  async complete(input: { name: string; timezone?: string; tone?: Tone; quietHours?: { start: string; end: string } }) {
    const scroll =
      (await Scroll.findOne({ userId: USER_ID })) ??
      new Scroll({ userId: USER_ID, profile: {}, version: 0 });
    scroll.profile = {
      ...(scroll.profile ?? {}),
      identity: { name: input.name, ...(input.timezone ? { timezone: input.timezone } : {}) },
      preferences: {
        tone: input.tone ?? "balanced",
        ...(input.quietHours ? { quietHours: input.quietHours } : {}),
      },
    };
    scroll.markModified("profile");
    scroll.version = (scroll.version ?? 0) + 1;
    await scroll.save();

    await Episode.create({
      userId: USER_ID,
      kind: "first_meeting",
      summary: `First Meeting completed for ${input.name}.`,
      tags: ["onboarding"],
      consolidated: false,
    });

    return { ok: true, version: scroll.version };
  }
}

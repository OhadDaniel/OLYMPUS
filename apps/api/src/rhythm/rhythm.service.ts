import { Inject, Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { InlineKeyboard } from "grammy";
import { USER_ID } from "../../../../src/config.js";
import { claimJob, releaseJob } from "../../../../src/jobs.js";
import { readWeek } from "../../../../src/scheduling/week.js";
import { TelegramService } from "../telegram/telegram.service.js";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function todayKey(prefix: string): string {
  return `${prefix}:${USER_ID}:${new Date().toISOString().slice(0, 10)}`;
}

/** Autonomous rhythm (notifier skill). Every send is wrapped in the Job ledger. */
@Injectable()
export class RhythmService {
  constructor(@Inject(TelegramService) private readonly tg: TelegramService) {}

  @Cron("5 7 * * *")
  async morningBriefCron(): Promise<void> {
    const key = todayKey("brief");
    if (!(await claimJob(USER_ID, key))) return; // already handled today
    const { sent } = await this.sendMorningBrief();
    if (!sent) await releaseJob(key); // not linked yet → let a later run retry, don't mark done
  }

  @Cron("30 21 * * *")
  async eveningCheckinCron(): Promise<void> {
    const key = todayKey("checkin");
    if (!(await claimJob(USER_ID, key))) return;
    const { sent } = await this.sendEveningCheckin();
    if (!sent) await releaseJob(key);
  }

  /** ≤600 chars, one focus, warm, never shame (notifier rules). */
  async sendMorningBrief(): Promise<{ sent: boolean; text: string }> {
    const start = startOfToday();
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const week = await readWeek(USER_ID, start, end);

    let text: string;
    if (week.blocks.length === 0 && week.outerWorld.length === 0) {
      text = "🌅 Good morning. Your day is open — nothing on the Loom yet. Want to design it together?";
    } else {
      const first = week.blocks[0] ?? week.outerWorld[0];
      const focus = week.blocks[0];
      const lines = [
        `🌅 Good morning. Today: ${week.blocks.length} block(s), ${week.outerWorld.length} from the outer world.`,
        first ? `First up: ${first.title} at ${hhmm(first.start)}.` : "",
        focus ? `One focus: ${focus.title}.` : "",
      ].filter(Boolean);
      text = lines.join("\n").slice(0, 600);
    }
    const sent = await this.tg.sendMessage(text);
    return { sent, text };
  }

  async sendEveningCheckin(): Promise<{ sent: boolean; blocks: number }> {
    const start = startOfToday();
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const week = await readWeek(USER_ID, start, end);
    const blocks = week.blocks.filter((b) => b.status === "scheduled").slice(0, 6);

    if (blocks.length === 0) {
      const sent = await this.tg.sendMessage("🌙 Evening. Nothing scheduled to check on today — rest easy.");
      return { sent, blocks: 0 };
    }

    const kb = new InlineKeyboard();
    for (const b of blocks) {
      kb.text(`${b.title} ${hhmm(b.start)}`, "noop")
        .text("✅", `chk:${b.id}:done`)
        .text("↷", `chk:${b.id}:moved`)
        .text("✕", `chk:${b.id}:skipped`)
        .row();
    }
    const sent = await this.tg.sendMessage("🌙 Evening check-in — how did today land? (✅ done · ↷ moved · ✕ skipped)", kb);
    return { sent, blocks: blocks.length };
  }
}

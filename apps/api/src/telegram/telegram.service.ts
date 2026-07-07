import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { Bot, InlineKeyboard } from "grammy";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions.js";
import { config, USER_ID } from "../../../../src/config.js";
import { Block, ChatSession, Checkin, Message, TelegramLink } from "../../../../src/db/index.js";
import { claimJob, markJob } from "../../../../src/jobs.js";
import { HarnessService } from "../core/harness.service.js";

@Injectable()
export class TelegramService implements OnModuleInit {
  private bot?: Bot;
  private username?: string;

  constructor(@Inject(HarnessService) private readonly harness: HarnessService) {}

  async onModuleInit(): Promise<void> {
    if (!config.telegramBotToken) {
      console.warn("[telegram] no TELEGRAM_BOT_TOKEN — bot disabled");
      return;
    }
    const bot = new Bot(config.telegramBotToken);
    try {
      this.username = (await bot.api.getMe()).username;
    } catch (e) {
      console.error("[telegram] getMe failed:", e instanceof Error ? e.message : e);
      return;
    }
    this.registerHandlers(bot);
    this.bot = bot;
    // Long-polling, fire-and-forget. drop_pending_updates avoids replaying a backlog.
    void bot.start({ drop_pending_updates: true }).catch((e) => console.error("[telegram] polling:", e));
    console.log(`[telegram] @${this.username} polling`);
  }

  private registerHandlers(bot: Bot): void {
    // Conversational linking: t.me/<bot>?start=<token>
    bot.command("start", async (ctx) => {
      const token = (ctx.match ?? "").trim();
      if (token) {
        const link = await TelegramLink.findOne({ linkToken: token });
        if (link && !link.chatId && (!link.expiresAt || link.expiresAt > new Date())) {
          link.chatId = String(ctx.chat.id);
          link.linkedAt = new Date();
          await link.save();
          await ctx.reply("Linked ✓  I am Maxwell. Your mornings and evenings will find you here.");
          return;
        }
      }
      await ctx.reply("Hello — I am Maxwell. Open the app and choose “connect Telegram” to link us.");
    });

    // Evening check-in buttons: chk:<blockId>:<answer>
    bot.on("callback_query:data", async (ctx) => {
      const m = /^chk:([a-f\d]{24}):(done|moved|skipped)$/.exec(ctx.callbackQuery.data);
      if (!m) {
        await ctx.answerCallbackQuery();
        return;
      }
      const [, blockId, answer] = m as unknown as [string, string, "done" | "moved" | "skipped"];
      await Checkin.create({ userId: USER_ID, blockId, response: answer, via: "telegram" });
      await Block.updateOne({ _id: blockId, userId: USER_ID }, { $set: { status: answer } });
      await ctx.answerCallbackQuery({ text: `Marked ${answer} ✓` });
      await ctx.editMessageReplyMarkup().catch(() => {});
    });

    // Chat relay
    bot.on("message:text", async (ctx) => {
      const chatId = String(ctx.chat.id);
      const link = await TelegramLink.findOne({ userId: USER_ID, chatId });
      if (!link) {
        await ctx.reply("I don't know you yet — connect me from the app first.");
        return;
      }
      const key = `tg:update:${ctx.update.update_id}`; // Telegram has no idempotency; the ledger is it.
      if (!(await claimJob(USER_ID, key))) return;
      try {
        await ctx.replyWithChatAction("typing").catch(() => {});
        await ctx.reply((await this.relay(ctx.message.text)) || "…");
        await markJob(key, "done");
      } catch {
        await markJob(key, "failed");
        await ctx.reply("Something went wrong reaching the council. Try again in a moment.");
      }
    });
  }

  private async relay(text: string): Promise<string> {
    const session =
      (await ChatSession.findOne({ userId: USER_ID, title: "Telegram" })) ??
      (await ChatSession.create({ userId: USER_ID, kind: "chat", title: "Telegram" }));
    const sessionId = String(session._id);
    const prior = await Message.find({ userId: USER_ID, sessionId }).sort({ createdAt: 1 }).limit(30).lean();
    const history: ChatCompletionMessageParam[] = prior
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
    history.push({ role: "user", content: text });
    await Message.create({ userId: USER_ID, sessionId, role: "user", content: text });
    const { result } = await this.harness.runChat({ messages: history, onEvent: () => {} });
    await Message.create({ userId: USER_ID, sessionId, role: "assistant", content: result.output });
    return result.output;
  }

  isEnabled(): boolean {
    return Boolean(this.bot);
  }

  async createLink(): Promise<{ url: string; token: string }> {
    const token = randomBytes(16).toString("base64url");
    await TelegramLink.create({ userId: USER_ID, linkToken: token, expiresAt: new Date(Date.now() + 15 * 60_000) });
    return { url: `https://t.me/${this.username ?? "your_bot"}?start=${token}`, token };
  }

  async status(): Promise<{ linked: boolean; username: string | null }> {
    const link = await TelegramLink.findOne({ userId: USER_ID, chatId: { $ne: null } });
    return { linked: Boolean(link?.chatId), username: this.username ?? null };
  }

  async sendMessage(text: string, keyboard?: InlineKeyboard): Promise<boolean> {
    if (!this.bot) return false;
    const link = await TelegramLink.findOne({ userId: USER_ID, chatId: { $ne: null } });
    if (!link?.chatId) return false;
    await this.bot.api.sendMessage(Number(link.chatId), text, keyboard ? { reply_markup: keyboard } : {});
    return true;
  }
}

import { Controller, Get } from "@nestjs/common";
import { USER_ID } from "../../../../src/config.js";
import { Scroll, TelegramLink } from "../../../../src/db/index.js";
import { isGoogleConnected } from "../../../../src/google/oauth.js";

@Controller("forge")
export class ForgeController {
  @Get("status")
  async status() {
    const [google, tg, scroll] = await Promise.all([
      isGoogleConnected(USER_ID),
      TelegramLink.findOne({ userId: USER_ID, chatId: { $ne: null } }).lean(),
      Scroll.findOne({ userId: USER_ID }).lean(),
    ]);
    return {
      bindings: { google, telegram: Boolean(tg?.chatId), mcp: true },
      scroll: scroll?.profile ?? {},
      version: scroll?.version ?? 0,
    };
  }
}

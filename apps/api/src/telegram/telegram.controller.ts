import { Controller, Get, Inject, Post } from "@nestjs/common";
import { TelegramService } from "./telegram.service.js";

@Controller("telegram")
export class TelegramController {
  constructor(@Inject(TelegramService) private readonly tg: TelegramService) {}

  /** Mint a single-use deep link the user taps to connect their phone. */
  @Post("link")
  link(): Promise<{ url: string; token: string }> {
    return this.tg.createLink();
  }

  @Get("status")
  status(): Promise<{ linked: boolean; username: string | null }> {
    return this.tg.status();
  }
}

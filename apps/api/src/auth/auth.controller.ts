import { Controller, Get, Inject, Query, Res } from "@nestjs/common";
import { config } from "../../../../src/config.js";
import { AuthService } from "./auth.service.js";

interface RedirectResponse {
  redirect(url: string): void;
}

@Controller("auth/google")
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Get()
  start(@Res() res: RedirectResponse): void {
    res.redirect(this.auth.startUrl());
  }

  @Get("callback")
  async callback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Res() res: RedirectResponse,
  ): Promise<void> {
    const ok = code && state ? await this.auth.complete(state, code) : false;
    res.redirect(`${config.appUrl}/?google=${ok ? "connected" : "error"}`);
  }

  @Get("status")
  async status(): Promise<{ connected: boolean }> {
    return { connected: await this.auth.status() };
  }
}

import { Controller, Get, Inject } from "@nestjs/common";
import { AppService } from "./app.service.js";

@Controller()
export class AppController {
  // Explicit @Inject tokens — tsx/esbuild does not emit decorator metadata,
  // so Nest cannot infer constructor param types. Applies to all DI here.
  constructor(@Inject(AppService) private readonly appService: AppService) {}

  @Get("health")
  health(): { ok: boolean; service: string } {
    return this.appService.health();
  }
}

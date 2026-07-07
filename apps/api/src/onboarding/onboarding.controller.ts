import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import type { Tone } from "../../../../src/domain.js";
import { OnboardingService } from "./onboarding.service.js";

@Controller("onboarding")
export class OnboardingController {
  constructor(@Inject(OnboardingService) private readonly onboarding: OnboardingService) {}

  @Get("status")
  status() {
    return this.onboarding.status();
  }

  @Get("verify")
  verify() {
    return this.onboarding.verify();
  }

  @Post("wheel")
  wheel(@Body() body: { values: Record<string, number> }) {
    return this.onboarding.setWheel(body.values ?? {});
  }

  @Post("goals")
  goals(@Body() body: { goals: Array<{ godId: string; title: string; target?: string }> }) {
    return this.onboarding.setGoals(body.goals ?? []);
  }

  @Post("scan-email")
  scanEmail() {
    return this.onboarding.scanEmail();
  }

  @Get("insights")
  insights() {
    return this.onboarding.listInsights();
  }

  @Post("insights/:id/confirm")
  confirmInsight(@Param("id") id: string) {
    return this.onboarding.confirmInsight(id);
  }

  @Post("bridge")
  bridge() {
    return this.onboarding.bridge();
  }

  @Post("complete")
  complete(
    @Body()
    body: { name: string; timezone?: string; tone?: Tone; quietHours?: { start: string; end: string } },
  ) {
    return this.onboarding.complete(body);
  }
}

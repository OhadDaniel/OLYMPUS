import { Controller, Inject, Post } from "@nestjs/common";
import { RhythmService } from "./rhythm.service.js";

/** Manual triggers so the brief / check-in can be demoed on demand. */
@Controller("rhythm")
export class RhythmController {
  constructor(@Inject(RhythmService) private readonly rhythm: RhythmService) {}

  @Post("brief")
  brief(): Promise<{ sent: boolean; text: string }> {
    return this.rhythm.sendMorningBrief();
  }

  @Post("checkin")
  checkin(): Promise<{ sent: boolean; blocks: number }> {
    return this.rhythm.sendEveningCheckin();
  }

  @Post("consolidate")
  consolidate(): Promise<{ learned: number }> {
    return this.rhythm.consolidate();
  }
}

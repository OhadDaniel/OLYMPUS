import { Module } from "@nestjs/common";
import { TelegramModule } from "../telegram/telegram.module.js";
import { RhythmController } from "./rhythm.controller.js";
import { RhythmService } from "./rhythm.service.js";

@Module({
  imports: [TelegramModule],
  controllers: [RhythmController],
  providers: [RhythmService],
})
export class RhythmModule {}

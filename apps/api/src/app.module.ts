import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";
import { AuthModule } from "./auth/auth.module.js";
import { ChatModule } from "./chat/chat.module.js";
import { CouncilModule } from "./council/council.module.js";
import { CoreModule } from "./core/core.module.js";
import { InsightModule } from "./insight/insight.module.js";
import { LoomModule } from "./loom/loom.module.js";
import { OnboardingModule } from "./onboarding/onboarding.module.js";
import { RhythmModule } from "./rhythm/rhythm.module.js";
import { TelegramModule } from "./telegram/telegram.module.js";
import { VeilModule } from "./veil/veil.module.js";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    CoreModule,
    ChatModule,
    CouncilModule,
    VeilModule,
    LoomModule,
    AuthModule,
    TelegramModule,
    RhythmModule,
    OnboardingModule,
    InsightModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

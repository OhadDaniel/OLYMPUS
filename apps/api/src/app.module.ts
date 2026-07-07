import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";
import { AuthModule } from "./auth/auth.module.js";
import { ChatModule } from "./chat/chat.module.js";
import { CoreModule } from "./core/core.module.js";
import { LoomModule } from "./loom/loom.module.js";
import { RhythmModule } from "./rhythm/rhythm.module.js";
import { TelegramModule } from "./telegram/telegram.module.js";
import { VeilModule } from "./veil/veil.module.js";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    CoreModule,
    ChatModule,
    VeilModule,
    LoomModule,
    AuthModule,
    TelegramModule,
    RhythmModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

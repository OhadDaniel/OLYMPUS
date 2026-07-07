import { Module } from "@nestjs/common";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";
import { ChatModule } from "./chat/chat.module.js";
import { CoreModule } from "./core/core.module.js";
import { VeilModule } from "./veil/veil.module.js";

@Module({
  imports: [CoreModule, ChatModule, VeilModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

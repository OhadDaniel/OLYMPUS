import { Global, Module } from "@nestjs/common";
import { HarnessService } from "./harness.service.js";
import { VeilBus } from "./veil-bus.js";

@Global()
@Module({
  providers: [VeilBus, HarnessService],
  exports: [VeilBus, HarnessService],
})
export class CoreModule {}

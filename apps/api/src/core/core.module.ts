import { Global, Module } from "@nestjs/common";
import { WorldMcpClient } from "../../../../src/tools/mcp-client.js";
import { HarnessService } from "./harness.service.js";
import { VeilBus } from "./veil-bus.js";

@Global()
@Module({
  providers: [VeilBus, WorldMcpClient, HarnessService],
  exports: [VeilBus, WorldMcpClient, HarnessService],
})
export class CoreModule {}

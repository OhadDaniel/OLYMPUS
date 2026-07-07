import { Module } from "@nestjs/common";
import { LoomController } from "./loom.controller.js";
import { ProposalsController } from "./proposals.controller.js";

@Module({
  controllers: [LoomController, ProposalsController],
})
export class LoomModule {}

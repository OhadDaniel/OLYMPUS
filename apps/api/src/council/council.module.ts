import { Module } from "@nestjs/common";
import { CouncilController } from "./council.controller.js";
import { CouncilService } from "./council.service.js";

@Module({
  controllers: [CouncilController],
  providers: [CouncilService],
})
export class CouncilModule {}

import { Module } from "@nestjs/common";
import { ForgeController } from "./forge.controller.js";
import { ObservatoryController } from "./observatory.controller.js";

@Module({
  controllers: [ObservatoryController, ForgeController],
})
export class InsightModule {}

import { Module } from "@nestjs/common";
import { EvalsController } from "./evals.controller.js";

@Module({
  controllers: [EvalsController],
})
export class EvalsModule {}

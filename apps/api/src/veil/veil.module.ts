import { Module } from "@nestjs/common";
import { VeilController } from "./veil.controller.js";

@Module({
  controllers: [VeilController],
})
export class VeilModule {}

import { Controller, Get } from "@nestjs/common";
import { USER_ID } from "../../../../src/config.js";
import { buildObservatory, type Observatory } from "../../../../src/observatory.js";

@Controller()
export class ObservatoryController {
  @Get("observatory")
  observatory(): Promise<Observatory> {
    return buildObservatory(USER_ID);
  }
}

import { Controller, Get, Query } from "@nestjs/common";
import { USER_ID } from "../../../../src/config.js";
import { readWeek } from "../../../../src/scheduling/week.js";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

@Controller("loom")
export class LoomController {
  @Get("week")
  async week(@Query("from") from?: string, @Query("to") to?: string) {
    const f = from ? new Date(from) : startOfToday();
    const t = to ? new Date(to) : addDays(f, 7);
    return readWeek(USER_ID, f, t);
  }
}

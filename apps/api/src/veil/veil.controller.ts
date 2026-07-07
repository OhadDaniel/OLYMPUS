import { Controller, Inject, Sse } from "@nestjs/common";
import { map, type Observable } from "rxjs";
import { VeilBus, type VeilFrame } from "../core/veil-bus.js";

@Controller("veil")
export class VeilController {
  constructor(@Inject(VeilBus) private readonly veil: VeilBus) {}

  /** GET /veil/stream — every harness event, live (Behind the Veil). */
  @Sse("stream")
  stream(): Observable<{ data: VeilFrame }> {
    return this.veil.stream().pipe(map((frame) => ({ data: frame })));
  }
}

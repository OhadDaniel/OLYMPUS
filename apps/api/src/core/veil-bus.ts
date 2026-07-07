import { Injectable } from "@nestjs/common";
import { Subject, type Observable } from "rxjs";
import type { AgentEvent } from "../../../../src/events.js";

export interface VeilFrame {
  runId: string;
  ts: number;
  event: AgentEvent;
}

/** Global relay of every harness event across all runs → the Veil SSE stream. */
@Injectable()
export class VeilBus {
  private readonly subject = new Subject<VeilFrame>();

  publish(runId: string, event: AgentEvent): void {
    this.subject.next({ runId, ts: Date.now(), event });
  }

  stream(): Observable<VeilFrame> {
    return this.subject.asObservable();
  }
}

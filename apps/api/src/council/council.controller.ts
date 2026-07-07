import { Controller, Inject, Post, Res } from "@nestjs/common";
import { CouncilService } from "./council.service.js";

interface SseResponse {
  writeHead(statusCode: number, headers: Record<string, string>): void;
  write(chunk: string): void;
  end(): void;
}

@Controller()
export class CouncilController {
  constructor(@Inject(CouncilService) private readonly council: CouncilService) {}

  @Post("council/start")
  async start(@Res() res: SseResponse): Promise<void> {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    const send = (obj: unknown): void => {
      res.write(`data: ${JSON.stringify(obj)}\n\n`);
    };
    try {
      await this.council.run(send);
    } catch (error) {
      send({ type: "error", message: error instanceof Error ? error.message : "council failed" });
      send({ type: "__end__" });
    } finally {
      res.end();
    }
  }
}

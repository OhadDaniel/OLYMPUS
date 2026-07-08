import { Body, Controller, Inject, Post, Res } from "@nestjs/common";
import { ChatService } from "./chat.service.js";

/** Minimal SSE-capable response shape (Express Response satisfies it). */
interface SseResponse {
  writeHead(statusCode: number, headers: Record<string, string>): void;
  write(chunk: string): void;
  end(): void;
}

@Controller()
export class ChatController {
  constructor(@Inject(ChatService) private readonly chatService: ChatService) {}

  @Post("chat")
  async chat(
    @Body() body: { message?: string; sessionId?: string; mode?: string },
    @Res() res: SseResponse,
  ): Promise<void> {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    const send = (obj: unknown): void => {
      res.write(`data: ${JSON.stringify(obj)}\n\n`);
    };

    const message = (body.message ?? "").trim();
    if (!message) {
      send({ type: "error", message: "empty message" });
      send({ type: "__end__" });
      res.end();
      return;
    }

    try {
      await this.chatService.stream({ message, sessionId: body.sessionId, mode: body.mode }, send);
    } catch (error) {
      send({ type: "error", message: error instanceof Error ? error.message : "chat failed" });
    } finally {
      send({ type: "__end__" });
      res.end();
    }
  }
}

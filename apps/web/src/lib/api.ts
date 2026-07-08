import type { AgentEvent } from "../../../../src/events.js";
import type { VeilFrame } from "./types.js";

export const API_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3011";

/** Frames the /chat SSE stream can send: session meta, harness events, or end. */
export type ChatFrame = { type: "session"; id: string } | AgentEvent | { type: "__end__" };

/** POST /chat and stream SSE frames to `onFrame`. Resolves when the stream ends. */
export async function streamChat(
  input: { message: string; sessionId?: string; mode?: "council" },
  onFrame: (frame: ChatFrame) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`chat request failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const line = chunk.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      try {
        onFrame(JSON.parse(payload) as ChatFrame);
      } catch {
        // ignore malformed frame
      }
    }
  }
}

/** Subscribe to the global Veil event stream. Returns an unsubscribe fn. */
export function openVeil(onFrame: (frame: VeilFrame) => void): () => void {
  const source = new EventSource(`${API_URL}/veil/stream`);
  source.onmessage = (e: MessageEvent<string>) => {
    try {
      onFrame(JSON.parse(e.data) as VeilFrame);
    } catch {
      // ignore
    }
  };
  return () => source.close();
}

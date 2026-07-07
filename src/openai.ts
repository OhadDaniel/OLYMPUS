import OpenAI from "openai";
import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions.js";
import { config } from "./config.js";

let client: OpenAI | undefined;

export function getOpenAIClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: config.openaiApiKey });
  }
  return client;
}

/**
 * The single most important history-hygiene invariant: raw SDK message objects
 * must NEVER enter `messages`. We rebuild a plain param dict, keeping only
 * function tool calls.
 */
export function serializeAssistantMessage(
  message: OpenAI.Chat.Completions.ChatCompletionMessage,
): ChatCompletionAssistantMessageParam {
  const serialized: ChatCompletionAssistantMessageParam = {
    role: "assistant",
    content: message.content,
  };

  if (message.tool_calls?.length) {
    serialized.tool_calls = message.tool_calls
      .filter((tc) => tc.type === "function")
      .map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.function.name, arguments: tc.function.arguments },
      }));
  }

  return serialized;
}

/** Non-streaming primitive (fallback + structured callers). */
export async function completeWithTools(input: {
  model: string;
  messages: ChatCompletionMessageParam[];
  tools: ChatCompletionTool[];
}): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  const openai = getOpenAIClient();
  return openai.chat.completions.create({
    model: input.model,
    messages: input.messages,
    tools: input.tools.length > 0 ? input.tools : undefined,
    tool_choice: input.tools.length > 0 ? "auto" : undefined,
  });
}

export interface StreamedToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface StreamedCompletion {
  content: string;
  toolCalls: StreamedToolCall[];
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  finishReason: string | null;
}

/**
 * Streaming primitive. Emits each text delta via `onToken` while accumulating
 * tool-call fragments by index (arguments arrive as string fragments that MUST
 * be concatenated). Usage arrives only on the terminal chunk.
 */
export async function completeWithToolsStreaming(input: {
  model: string;
  messages: ChatCompletionMessageParam[];
  tools: ChatCompletionTool[];
  onToken?: (text: string) => void;
}): Promise<StreamedCompletion> {
  const openai = getOpenAIClient();
  const stream = await openai.chat.completions.create({
    model: input.model,
    messages: input.messages,
    tools: input.tools.length > 0 ? input.tools : undefined,
    tool_choice: input.tools.length > 0 ? "auto" : undefined,
    stream: true,
    stream_options: { include_usage: true },
  });

  let content = "";
  let finishReason: string | null = null;
  const usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  const acc = new Map<number, StreamedToolCall>();

  for await (const chunk of stream) {
    const choice = chunk.choices[0];
    const delta = choice?.delta;

    if (delta?.content) {
      content += delta.content;
      input.onToken?.(delta.content);
    }

    for (const tc of delta?.tool_calls ?? []) {
      const cur = acc.get(tc.index) ?? { id: "", name: "", arguments: "" };
      if (tc.id) cur.id = tc.id;
      if (tc.function?.name) cur.name = tc.function.name;
      if (tc.function?.arguments) cur.arguments += tc.function.arguments; // concatenate
      acc.set(tc.index, cur);
    }

    if (choice?.finish_reason) finishReason = choice.finish_reason;

    if (chunk.usage) {
      usage.promptTokens = chunk.usage.prompt_tokens;
      usage.completionTokens = chunk.usage.completion_tokens;
      usage.totalTokens = chunk.usage.total_tokens;
    }
  }

  const toolCalls = [...acc.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, tc]) => tc)
    .filter((tc) => tc.id && tc.name);

  return { content, toolCalls, usage, finishReason };
}

/** Build the same assistant-message param shape from the streamed accumulator. */
export function serializeStreamedAssistant(
  content: string,
  toolCalls: StreamedToolCall[],
): ChatCompletionAssistantMessageParam {
  const serialized: ChatCompletionAssistantMessageParam = {
    role: "assistant",
    content: content.length > 0 ? content : null,
  };

  if (toolCalls.length > 0) {
    serialized.tool_calls = toolCalls.map((tc) => ({
      id: tc.id,
      type: "function" as const,
      function: { name: tc.name, arguments: tc.arguments },
    }));
  }

  return serialized;
}

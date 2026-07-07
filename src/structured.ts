import type { ChatCompletionMessageParam } from "openai/resources/chat/completions.js";
import { z } from "zod";
import { getOpenAIClient } from "./openai.js";
import { StructuredValidationError } from "./types.js";

/**
 * Forced structured output: a single strict tool the model MUST call, its
 * arguments zod-validated. One retry with the validation error appended
 * (SPEC §6). Kept OUT of the tool registry — used by WeekIntents / GodReport /
 * ScrollPatch / EmailInsights callers.
 */
export async function completeStructured<T>(input: {
  model: string;
  messages: ChatCompletionMessageParam[];
  tool: { name: string; description: string; parameters: Record<string, unknown> };
  schema: z.ZodType<T>;
}): Promise<T> {
  const openai = getOpenAIClient();
  const messages: ChatCompletionMessageParam[] = [...input.messages];

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await openai.chat.completions.create({
      model: input.model,
      messages,
      tools: [
        {
          type: "function",
          function: {
            name: input.tool.name,
            description: input.tool.description,
            parameters: input.tool.parameters,
            strict: true,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: input.tool.name } },
    });

    const call = res.choices[0]?.message.tool_calls?.[0];
    const raw = call && call.type === "function" ? call.function.arguments : "";

    let json: unknown = null;
    try {
      json = raw ? JSON.parse(raw) : {};
    } catch {
      json = null;
    }

    const parsed = input.schema.safeParse(json);
    if (parsed.success) return parsed.data;

    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    if (attempt === 0) {
      // No dangling tool_call: correct via a plain user message, then re-force.
      messages.push({
        role: "user",
        content: `Your previous structured output was invalid (${issues}). Return corrected arguments that satisfy the schema exactly.`,
      });
      continue;
    }
    throw new StructuredValidationError(issues);
  }

  throw new StructuredValidationError("exhausted structured-output retries");
}

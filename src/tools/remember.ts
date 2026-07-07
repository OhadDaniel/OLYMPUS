import { z } from "zod";
import { Memory } from "../db/models/index.js";
import { LIFE_AREAS } from "../domain.js";
import { defineTool } from "../types.js";

const schema = z.object({
  text: z.string().min(1),
  area: z.enum(LIFE_AREAS).nullish(),
  category: z.string().nullish(),
});

export const rememberTool = defineTool({
  name: "remember",
  description:
    "Persist a durable fact Ohad shared about himself (a preference, goal, relationship, constraint, or rhythm) so it can be recalled later. Use only for stable facts worth keeping — not transient chatter. Returns the stored memory.",
  // write, but self-contained (no external/social side effect) → auto-approved.
  risk: "write",
  source: "native",
  scope: "all",
  schema,
  parameters: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description: "The fact to remember, as a concise standalone statement.",
      },
      area: {
        type: ["string", "null"],
        enum: [...LIFE_AREAS, null],
        description: "Optional life area this fact belongs to. Use null if it doesn't fit one.",
      },
      category: {
        type: ["string", "null"],
        description: "Optional short classification (e.g. 'preference', 'goal'). null if none.",
      },
    },
    required: ["text", "area", "category"],
    additionalProperties: false,
  },
  execute: async (args, ctx) => {
    ctx.emit({ type: "status", text: "Committing that to memory…" });
    const mem = await Memory.create({
      userId: ctx.userId,
      text: args.text,
      area: args.area ?? undefined,
      category: args.category ?? undefined,
      source: "chat",
    });
    return JSON.stringify({
      ok: true,
      stored: { id: String(mem._id), text: mem.text, area: mem.area ?? null },
    });
  },
});

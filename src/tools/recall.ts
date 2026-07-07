import { z } from "zod";
import type { FilterQuery } from "mongoose";
import { Memory, type IMemory } from "../db/models/index.js";
import { LIFE_AREAS } from "../domain.js";
import { defineTool } from "../types.js";

const schema = z.object({
  query: z.string().nullish(),
  area: z.enum(LIFE_AREAS).nullish(),
  limit: z.number().int().min(1).max(50).nullish(),
});

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const recallTool = defineTool({
  name: "recall",
  description:
    "Recall durable facts previously remembered about Ohad. Optionally filter by a search query (all terms must appear) and/or a life area. Returns the most recent matching memories.",
  risk: "read_only",
  source: "native",
  scope: "all",
  schema,
  parameters: {
    type: "object",
    properties: {
      query: {
        type: ["string", "null"],
        description: "Optional keywords; all terms must appear in a memory. null for recent facts.",
      },
      area: {
        type: ["string", "null"],
        enum: [...LIFE_AREAS, null],
        description: "Optional life area to filter by. null for any.",
      },
      limit: {
        type: ["integer", "null"],
        description: "Max results (default 12). null for default.",
      },
    },
    required: ["query", "area", "limit"],
    additionalProperties: false,
  },
  execute: async (args, ctx) => {
    ctx.emit({ type: "status", text: "Searching what I remember…" });
    const filter: FilterQuery<IMemory> = { userId: ctx.userId };
    if (args.area) filter.area = args.area;
    if (args.query) {
      const terms = args.query.split(/\s+/).filter(Boolean).slice(0, 8);
      if (terms.length > 0) {
        filter.$and = terms.map((t) => ({ text: { $regex: escapeRegex(t), $options: "i" } }));
      }
    }
    const docs = await Memory.find(filter)
      .sort({ createdAt: -1 })
      .limit(args.limit ?? 12)
      .lean();
    return JSON.stringify({
      ok: true,
      count: docs.length,
      memories: docs.map((d) => ({ text: d.text, area: d.area ?? null, source: d.source })),
    });
  },
});

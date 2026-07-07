import { z } from "zod";
import { Scroll } from "../db/models/index.js";
import { defineTool } from "../types.js";

const schema = z.object({});

export const getScrollTool = defineTool({
  name: "get_scroll",
  description:
    "Read the Scroll — Maxwell's durable profile of Ohad (identity, preferences, goals, constraints, energy map, people, what was learned). Call this when you need to ground a reply in who he is.",
  risk: "read_only",
  source: "native",
  scope: "all",
  schema,
  parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
  execute: async (_args, ctx) => {
    ctx.emit({ type: "status", text: "Reading the Scroll…" });
    const scroll = await Scroll.findOne({ userId: ctx.userId }).lean();
    return JSON.stringify({
      ok: true,
      exists: Boolean(scroll),
      version: scroll?.version ?? 0,
      profile: scroll?.profile ?? {},
    });
  },
});

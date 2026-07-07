import { z } from "zod";
import { loadSkillBody } from "../skills/loader.js";
import { defineTool } from "../types.js";

const schema = z.object({ name: z.string().min(1) });

export const loadSkillTool = defineTool({
  name: "load_skill",
  description:
    "Load the full instructions (playbook) for one of the skills listed in 'Skills available to you'. Call this BEFORE acting on a task a skill covers — it pulls the skill's detailed steps and rules into context. Pass the skill's exact name. Returns the skill body.",
  risk: "read_only",
  source: "native",
  scope: "all",
  schema,
  parameters: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Exact name of the skill to load, e.g. 'week-planner' or 'psychologist'.",
      },
    },
    required: ["name"],
    additionalProperties: false,
  },
  execute: async (args, ctx) => {
    const body = loadSkillBody(ctx.skillsDir, args.name);
    // Level-2 load — the moment the Veil shows a skill "thinking".
    ctx.emit({ type: "skill", name: args.name, level: 2 });
    return JSON.stringify({ ok: true, name: args.name, body });
  },
});

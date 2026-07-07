import type { ToolDefinition } from "../types.js";
import { loadSkillTool } from "./load-skill.js";
import { getScrollTool } from "./scroll.js";
import { getWeekTool } from "./get-week.js";
import { rememberTool } from "./remember.js";
import { recallTool } from "./recall.js";
import { applyProposalTool, proposeEditTool, proposeWeekTool } from "./proposals.js";

/**
 * The native tool set (SPEC §6). `apply_proposal` is destructive + ALWAYS
 * gated (the human Approve endpoint applies it outside the loop). MCP world
 * tools are added by the registry when the world-server is mounted (Day 2).
 */
export const nativeTools: ToolDefinition[] = [
  loadSkillTool,
  getScrollTool,
  getWeekTool,
  rememberTool,
  recallTool,
  proposeWeekTool,
  proposeEditTool,
  applyProposalTool,
];

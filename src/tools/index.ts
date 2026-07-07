import type { ToolDefinition } from "../types.js";
import { loadSkillTool } from "./load-skill.js";
import { getScrollTool } from "./scroll.js";
import { getWeekTool } from "./get-week.js";
import { rememberTool } from "./remember.js";
import { recallTool } from "./recall.js";

/**
 * The native tool set (SPEC §6). These query mongoose models directly. The
 * proposal tools (propose_week/propose_edit/apply_proposal) and update_scroll
 * land on Day 2 with the scheduling pipeline.
 */
export const nativeTools: ToolDefinition[] = [
  loadSkillTool,
  getScrollTool,
  getWeekTool,
  rememberTool,
  recallTool,
];

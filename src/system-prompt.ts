import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import { discoverSkills, withSkillCatalog } from "./skills/loader.js";
import type { GodId } from "./types.js";

const PERSONA_PATH = path.resolve(config.repoRoot, "prompts/maxwell.system.md");

/** Persona lives in markdown, never inline in code (hard rule). */
export function loadPersona(): string {
  try {
    return fs.readFileSync(PERSONA_PATH, "utf8").trim();
  } catch {
    throw new Error(
      `Missing persona at ${PERSONA_PATH}. Maxwell's persona lives in prompts/maxwell.system.md.`,
    );
  }
}

/**
 * Runtime system prompt = persona + always-on skill catalog (level 1). Zeus
 * sees every skill; a subagent god's prompt filters the catalog to its domain.
 */
export function buildRuntimeSystemPrompt(opts?: { for?: GodId }): string {
  const skills = discoverSkills(config.skillsDir);
  return withSkillCatalog(loadPersona(), skills, opts);
}

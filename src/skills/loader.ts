import fs from "node:fs";
import path from "node:path";
import type { GodId } from "../types.js";

/**
 * Runtime skill loading — three levels (Workshop 2):
 *   1. metadata (name + description) always in context   → renderSkillCatalog()
 *   2. full SKILL.md body loaded only when triggered      → loadSkillBody() (load_skill tool)
 *   3. bundled resources/scripts loaded on demand         → resolveSkillResource() / native scripts
 *
 * Dependency-free: we parse only the frontmatter fields we rely on (name,
 * description, gods), including YAML folded (">-") and literal ("|") scalars.
 */

export interface SkillMeta {
  name: string;
  description: string;
  /** God ids this skill serves; empty/absent = available to all. */
  gods: string[];
  /** Directory name under the skills root (e.g. "week-planner"). */
  dir: string;
}

interface Frontmatter {
  name?: string;
  description?: string;
  gods?: string[];
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;
const KEY_RE = /^([A-Za-z][\w-]*):\s?(.*)$/;

/** Minimal frontmatter reader for `key: value` and folded/literal block scalars. */
export function parseFrontmatter(markdown: string): Frontmatter {
  const match = FRONTMATTER_RE.exec(markdown);
  if (!match || !match[1]) return {};

  const lines = match[1].split(/\r?\n/);
  const result: Record<string, string> = {};

  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    const keyMatch = KEY_RE.exec(line);
    if (!keyMatch) {
      i += 1;
      continue;
    }

    const key = keyMatch[1] as string;
    const inline = (keyMatch[2] ?? "").trim();

    if (inline && !["|", "|-", ">", ">-"].includes(inline)) {
      result[key] = stripQuotes(inline);
      i += 1;
      continue;
    }

    // Block scalar: gather subsequent indented lines.
    const folded = inline === "" || inline.startsWith(">");
    const block: string[] = [];
    i += 1;
    while (i < lines.length) {
      const next = lines[i] ?? "";
      if (next.trim() !== "" && !/^\s/.test(next)) break; // dedent → end of block
      block.push(next.trim());
      i += 1;
    }
    result[key] = (folded ? block.filter((l) => l !== "").join(" ") : block.join("\n")).trim();
  }

  const out: Frontmatter = {};
  if (result.name) out.name = result.name;
  if (result.description) out.description = result.description;
  if (result.gods) out.gods = parseList(result.gods);
  return out;
}

function parseList(raw: string): string[] {
  return raw
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((s) => stripQuotes(s.trim()))
    .filter((s) => s.length > 0);
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

/** Discover all skills under a root that have a SKILL.md with name + description. */
export function discoverSkills(skillsRoot: string): SkillMeta[] {
  if (!fs.existsSync(skillsRoot)) return [];

  const skills: SkillMeta[] = [];
  for (const entry of fs.readdirSync(skillsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillPath = path.join(skillsRoot, entry.name, "SKILL.md");
    if (!fs.existsSync(skillPath)) continue;

    const fm = parseFrontmatter(fs.readFileSync(skillPath, "utf8"));
    if (fm.name && fm.description) {
      skills.push({ name: fm.name, description: fm.description, gods: fm.gods ?? [], dir: entry.name });
    }
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

/** Level-1 catalog: always-on summary telling the model what it can load. */
export function renderSkillCatalog(skills: SkillMeta[], opts?: { for?: GodId }): string {
  const visible = opts?.for
    ? skills.filter((s) => s.gods.length === 0 || s.gods.includes(opts.for as string))
    : skills;
  if (visible.length === 0) return "";

  const entries = visible.map((s) => `- **${s.name}** — ${s.description}`).join("\n");
  return [
    "## Skills available to you",
    "",
    "Each skill below is a playbook you can pull in when it fits the task. Only these short",
    "summaries are loaded right now. When one is relevant, call the `load_skill` tool with its",
    "name to load its full instructions BEFORE acting — do not improvise a skill you could load.",
    "",
    entries,
  ].join("\n");
}

/** Compose the runtime system prompt: persona + always-on skill catalog. */
export function withSkillCatalog(persona: string, skills: SkillMeta[], opts?: { for?: GodId }): string {
  const catalog = renderSkillCatalog(skills, opts);
  return catalog ? `${persona}\n\n${catalog}` : persona;
}

/** Level-2: load a skill's full body (frontmatter stripped) by its `name`. */
export function loadSkillBody(skillsRoot: string, name: string): string {
  const skills = discoverSkills(skillsRoot);
  const skill = skills.find((s) => s.name === name);
  if (!skill) {
    const available = skills.map((s) => s.name).join(", ") || "(none)";
    throw new Error(`Unknown skill: ${name}. Available: ${available}`);
  }

  const skillPath = path.join(skillsRoot, skill.dir, "SKILL.md");
  return fs.readFileSync(skillPath, "utf8").replace(FRONTMATTER_RE, "").trim();
}

/** Level-3: read a bundled resource, jailed inside the skill's own directory. */
export function resolveSkillResource(skillsRoot: string, name: string, relPath: string): string {
  const skills = discoverSkills(skillsRoot);
  const skill = skills.find((s) => s.name === name);
  if (!skill) throw new Error(`Unknown skill: ${name}`);

  const base = path.resolve(skillsRoot, skill.dir);
  const target = path.resolve(base, relPath);
  if (target !== base && !target.startsWith(base + path.sep)) {
    throw new Error(`Resource path escapes skill directory: ${relPath}`);
  }
  return fs.readFileSync(target, "utf8");
}

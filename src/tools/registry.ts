import type { ChatCompletionTool } from "openai/resources/chat/completions.js";
import {
  ToolExecutionError,
  ToolNotFoundError,
  type GodId,
  type McpClient,
  type RiskClass,
  type ToolContext,
  type ToolDefinition,
} from "../types.js";
import { nativeTools } from "./index.js";
import { buildMcpTools } from "./mcp-client.js";

/**
 * ONE registry (SPEC §6), built once at the composition root. A factory (not a
 * module singleton) so the MCP client can be injected. `mcp` is optional —
 * without it the registry is native-only; with it, the world-server's
 * read-only tools mount as source:"mcp".
 */
export function createRegistry(mcp?: McpClient) {
  const tools: ToolDefinition[] = [...nativeTools, ...(mcp ? buildMcpTools(mcp) : [])];
  const byName = new Map(tools.map((tool) => [tool.name, tool]));

  return {
    list(): ToolDefinition[] {
      return [...tools];
    },

    get(name: string): ToolDefinition | undefined {
      return byName.get(name);
    },

    getToolRisk(name: string): RiskClass | undefined {
      return byName.get(name)?.risk;
    },

    /** Scope filter — a god subagent only sees its domain's tools. */
    forAgent(godId: GodId): ToolDefinition[] {
      return tools.filter((t) => t.scope === "all" || t.scope.includes(godId));
    },

    /** Project a (possibly scoped) subset into OpenAI strict tool schemas. */
    toOpenAITools(subset: ToolDefinition[] = tools): ChatCompletionTool[] {
      return subset.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
          strict: true,
        },
      }));
    },

    /** Zod-validate args FIRST (SPEC §6), then execute with typed args. */
    async dispatch(name: string, rawArguments: string, ctx: ToolContext): Promise<string> {
      const tool = byName.get(name);
      if (!tool) throw new ToolNotFoundError(name);

      let raw: unknown;
      try {
        raw = rawArguments ? JSON.parse(rawArguments) : {};
      } catch {
        throw new ToolExecutionError(name, new Error("arguments must be valid JSON"));
      }

      const parsed = tool.schema.safeParse(raw);
      if (!parsed.success) {
        throw new ToolExecutionError(name, parsed.error);
      }

      try {
        return await tool.execute(parsed.data, ctx);
      } catch (error) {
        if (error instanceof ToolNotFoundError || error instanceof ToolExecutionError) throw error;
        throw new ToolExecutionError(name, error);
      }
    },
  };
}

export type Registry = ReturnType<typeof createRegistry>;

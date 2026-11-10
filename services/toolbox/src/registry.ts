import { z } from "zod";
import type { ToolDefinition } from "@artemis/contracts";

/**
 * A tool is a named capability with a zod input schema and an async handler.
 * The registry is the only place that knows which tools exist. Adding a tool
 * means adding one file under tools/ and listing it in tools/index.ts.
 */
export interface ToolContext {
  sessionId: string;
}

export interface Tool<I extends z.ZodType> {
  name: string;
  description: string;
  input: I;
  run(input: z.output<I>, ctx: ToolContext): Promise<unknown>;
}

export class ToolRegistry {
  private readonly tools = new Map<string, Tool<z.ZodType>>();

  constructor(tools: Tool<z.ZodType>[]) {
    for (const tool of tools) {
      if (this.tools.has(tool.name)) throw new Error(`duplicate tool name: ${tool.name}`);
      this.tools.set(tool.name, tool);
    }
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()].map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: z.toJSONSchema(tool.input) as Record<string, unknown>,
    }));
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  /** Validates the input against the tool schema, then runs the handler. */
  async invoke(name: string, rawInput: unknown, ctx: ToolContext): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) throw new ToolNotFoundError(name);
    const parsed = tool.input.safeParse(rawInput);
    if (!parsed.success) {
      throw new ToolInputError(parsed.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; "));
    }
    return tool.run(parsed.data, ctx);
  }
}

export class ToolNotFoundError extends Error {
  constructor(name: string) {
    super(`unknown tool: ${name}`);
  }
}

export class ToolInputError extends Error {}

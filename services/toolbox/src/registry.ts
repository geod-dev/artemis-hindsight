import { z } from "zod";
import type { ToolDefinition } from "@artemis/contracts";

/**
 * A tool is a named capability with a zod input schema and an async handler.
 * Local tools are listed in server.ts. Tools from MCP servers are added at runtime as groups
 * (one group per server), with the JSON Schema the server declares. The remote server validates their input.
 */
export interface ToolContext {
  sessionId: string;
  /** The user the conversation belongs to, when the caller sends it. Memory tools need it. */
  username?: string;
}

export interface Tool<I extends z.ZodType> {
  name: string;
  description: string;
  input: I;
  run(input: z.output<I>, ctx: ToolContext): Promise<unknown>;
}

/** A tool whose input shape comes from a JSON Schema, such as an MCP tool. */
export interface RemoteTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run(input: unknown, ctx: ToolContext): Promise<unknown>;
}

/** The registry's view of a tool, whatever its source. */
interface Entry {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** Validates the raw input and returns the value the handler gets. Throws ToolInputError. */
  parse(raw: unknown): unknown;
  run(input: unknown, ctx: ToolContext): Promise<unknown>;
}

function fromLocal<I extends z.ZodType>(tool: Tool<I>): Entry {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: z.toJSONSchema(tool.input) as Record<string, unknown>,
    parse(raw) {
      const parsed = tool.input.safeParse(raw);
      if (!parsed.success) {
        throw new ToolInputError(parsed.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; "));
      }
      return parsed.data;
    },
    run: (input, ctx) => tool.run(input as z.output<I>, ctx),
  };
}

function fromRemote(tool: RemoteTool): Entry {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    parse: (raw) => raw,
    run: tool.run,
  };
}

export class ToolRegistry {
  private readonly local = new Map<string, Entry>();
  /** Remote tools keyed by group (the MCP server name). */
  private readonly groups = new Map<string, Map<string, Entry>>();

  constructor(tools: Tool<z.ZodType>[]) {
    for (const tool of tools) {
      if (this.local.has(tool.name)) throw new Error(`duplicate tool name: ${tool.name}`);
      this.local.set(tool.name, fromLocal(tool));
    }
  }

  /** Replaces every tool of one group. Throws, and changes nothing, when a name is already taken. */
  setGroup(group: string, tools: RemoteTool[]): void {
    const entries = new Map<string, Entry>();
    for (const tool of tools) {
      if (this.find(tool.name, group) || entries.has(tool.name)) {
        throw new Error(`duplicate tool name: ${tool.name}`);
      }
      entries.set(tool.name, fromRemote(tool));
    }
    this.groups.set(group, entries);
  }

  clearGroup(group: string): void {
    this.groups.delete(group);
  }

  list(): ToolDefinition[] {
    return this.all().map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));
  }

  has(name: string): boolean {
    return this.find(name) !== undefined;
  }

  /** Validates the input against the tool schema, then runs the handler. */
  async invoke(name: string, rawInput: unknown, ctx: ToolContext): Promise<unknown> {
    const tool = this.find(name);
    if (!tool) throw new ToolNotFoundError(name);
    return tool.run(tool.parse(rawInput), ctx);
  }

  private all(): Entry[] {
    return [...this.local.values(), ...[...this.groups.values()].flatMap((g) => [...g.values()])];
  }

  private find(name: string, exceptGroup?: string): Entry | undefined {
    const local = this.local.get(name);
    if (local) return local;
    for (const [group, entries] of this.groups) {
      if (group === exceptGroup) continue;
      const entry = entries.get(name);
      if (entry) return entry;
    }
    return undefined;
  }
}

export class ToolNotFoundError extends Error {
  constructor(name: string) {
    super(`unknown tool: ${name}`);
  }
}

export class ToolInputError extends Error {}

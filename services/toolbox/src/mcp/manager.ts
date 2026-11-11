import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { ToolRegistry, RemoteTool } from "../registry.js";
import type { McpServerConfig } from "./servers.js";

const CONNECT_TIMEOUT_MS = 15_000;
const CALL_TIMEOUT_MS = 120_000;
const RETRY_DELAY_MS = 30_000;

export interface McpServerStatus {
  name: string;
  connected: boolean;
  tools: number;
  error?: string;
}

interface Session {
  status: McpServerStatus;
}

/**
 * Connects the toolbox to MCP servers. Each server's tools join the registry as one group, named
 * <server>_<tool>, so they sit next to the local tools. A server that is down does not stop the toolbox:
 * it is retried every RETRY_DELAY_MS, and its tools are removed while it is disconnected.
 */
export class McpManager {
  private readonly sessions = new Map<string, Session>();

  constructor(
    private readonly servers: McpServerConfig[],
    private readonly registry: ToolRegistry,
  ) {
    for (const server of servers) {
      this.sessions.set(server.name, { status: { name: server.name, connected: false, tools: 0 } });
    }
  }

  start(): void {
    for (const server of this.servers) void this.connect(server);
  }

  status(): McpServerStatus[] {
    return [...this.sessions.values()].map((s) => ({ ...s.status }));
  }

  private async connect(server: McpServerConfig): Promise<void> {
    const session = this.sessions.get(server.name);
    if (!session) return;

    const client = new Client({ name: "artemis-toolbox", version: "0.1.0" });
    try {
      const transport = new StreamableHTTPClientTransport(new URL(server.url), {
        requestInit: { headers: server.headers },
      });
      await client.connect(transport, { timeout: CONNECT_TIMEOUT_MS });
      const tools = await listAllTools(client);
      this.registry.setGroup(server.name, tools.map((tool) => toRemoteTool(server.name, client, tool)));

      session.status = { name: server.name, connected: true, tools: tools.length };
      console.log(`[mcp:${server.name}] connected with ${tools.length} tools`);

      client.onclose = () => {
        this.registry.clearGroup(server.name);
        session.status = { name: server.name, connected: false, tools: 0, error: "connection closed" };
        console.log(`[mcp:${server.name}] connection closed, retrying in ${RETRY_DELAY_MS / 1000}s`);
        setTimeout(() => void this.connect(server), RETRY_DELAY_MS);
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      session.status = { name: server.name, connected: false, tools: 0, error: message };
      console.error(`[mcp:${server.name}] connect failed: ${message}; retrying in ${RETRY_DELAY_MS / 1000}s`);
      void client.close().catch(() => undefined);
      this.registry.clearGroup(server.name);
      setTimeout(() => void this.connect(server), RETRY_DELAY_MS);
    }
  }
}

type RemoteToolInfo = Awaited<ReturnType<Client["listTools"]>>["tools"][number];

async function listAllTools(client: Client): Promise<RemoteToolInfo[]> {
  const tools: RemoteToolInfo[] = [];
  let cursor: string | undefined;
  do {
    const page = await client.listTools(cursor ? { cursor } : undefined);
    tools.push(...page.tools);
    cursor = page.nextCursor;
  } while (cursor);
  return tools;
}

/** Tool names must match ^[a-z][a-z0-9_]{0,63}$, so the server and tool names are normalized and joined. */
export function toolboxToolName(server: string, tool: string): string {
  return `${server}_${tool}`.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 64);
}

function toRemoteTool(server: string, client: Client, tool: RemoteToolInfo): RemoteTool {
  return {
    name: toolboxToolName(server, tool.name),
    description: tool.description ?? tool.title ?? tool.name,
    inputSchema: (tool.inputSchema ?? { type: "object", properties: {} }) as Record<string, unknown>,
    async run(input) {
      const result = await client.callTool(
        { name: tool.name, arguments: (input ?? {}) as Record<string, unknown> },
        undefined,
        { timeout: CALL_TIMEOUT_MS },
      );
      if (result.isError) {
        throw new Error(textOf(result.content) || `${server} tool ${tool.name} failed`);
      }
      return result.structuredContent ?? { content: result.content };
    },
  };
}

function textOf(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => (typeof part === "object" && part !== null && "text" in part ? String(part.text) : ""))
    .filter(Boolean)
    .join("\n");
}

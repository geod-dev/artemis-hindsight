/**
 * MCP servers the toolbox connects to. Each one is a remote Streamable HTTP endpoint.
 * A server is enabled only when its key is set in the environment, so the toolbox runs without it.
 * Adding a server means adding one entry here and its variable to docker-compose files and .env.example.
 */
export interface McpServerConfig {
  /** Group name. Its tools are named <name>_<tool>, so it must start with a letter and use [a-z0-9_]. */
  name: string;
  url: string;
  headers: Record<string, string>;
}

export function mcpServersFromEnv(env: NodeJS.ProcessEnv): McpServerConfig[] {
  const servers: McpServerConfig[] = [];

  if (env.EXA_API_KEY) {
    servers.push({
      name: "exa",
      url: "https://mcp.exa.ai/mcp",
      headers: { "x-api-key": env.EXA_API_KEY },
    });
  }

  return servers;
}

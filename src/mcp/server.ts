import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerCcDelegateTool, registerCcReviewTool } from "./tools.js";
import { VERSION } from "../version.js";

export async function serveMcp(): Promise<void> {
  const server = new McpServer({
    name: "codex-cc-tools",
    version: VERSION
  });

  registerCcReviewTool(server);
  registerCcDelegateTool(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

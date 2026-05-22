import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import {
  registerCcDelegateTool,
  registerCcResearchTool,
  registerCcReviewTool,
  registerCcVerifyTool
} from "./tools.js";
import { VERSION } from "../version.js";

export async function serveMcp(): Promise<void> {
  const server = new McpServer({
    name: "codex-cc-tools",
    version: VERSION
  });

  registerCcReviewTool(server);
  registerCcResearchTool(server);
  registerCcVerifyTool(server);
  registerCcDelegateTool(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

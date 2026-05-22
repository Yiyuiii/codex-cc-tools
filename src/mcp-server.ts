#!/usr/bin/env node
import { serveMcp } from "./mcp/server.js";

serveMcp().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});

import { uninstallCodexCcToolsConfig } from "../config/codex.js";
import { writeLine } from "../utils/logger.js";

export interface UninstallCliOptions {
  configPath?: string;
}

export async function runUninstallCodexConfig(options: UninstallCliOptions = {}): Promise<void> {
  const result = await uninstallCodexCcToolsConfig(options.configPath);
  writeLine(
    result.changed
      ? `Removed codex_cc_tools MCP config from ${result.configPath}`
      : `No codex_cc_tools MCP config found at ${result.configPath}`
  );
}

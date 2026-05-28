import {
  installCodexCcToolsConfig,
  type CodexConfigLaunchMode
} from "../config/codex.js";
import { writeLine } from "../utils/logger.js";

export interface InstallCliOptions {
  packageSpec?: string;
  configPath?: string;
  globalBinary?: boolean;
  includeEnabledTools?: boolean;
}

export async function runInstallCodexConfig(options: InstallCliOptions = {}): Promise<void> {
  const launchMode: CodexConfigLaunchMode | undefined = options.globalBinary ? "global" : undefined;
  const result = await installCodexCcToolsConfig(options.configPath, {
    packageSpec: options.packageSpec,
    launchMode,
    includeEnabledTools: options.includeEnabledTools
  });

  writeLine(
    result.changed
      ? `Installed codex_cc_tools MCP config at ${result.configPath}`
      : `codex_cc_tools MCP config already up to date at ${result.configPath}`
  );
  if (result.registration?.mode === "global") {
    writeLine("MCP command: codex-cc-tools-mcp");
  } else if (result.registration?.mode === "npx") {
    writeLine(`MCP package spec: ${result.registration.packageSpec}`);
  }
}

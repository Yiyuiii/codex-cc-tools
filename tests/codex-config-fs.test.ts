import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  installCodexCcToolsConfig,
  uninstallCodexCcToolsConfig
} from "../src/config/codex.js";

describe("Codex MCP config file operations", () => {
  it("creates parent directories and writes install config", async () => {
    const dir = await mkdtemp(join(tmpdir(), "codex-cc-tools-"));
    const configPath = join(dir, "project", ".codex", "config.toml");

    const result = await installCodexCcToolsConfig(configPath, {
      packageSpec: "codex-cc-tools@next"
    });

    expect(result).toMatchObject({ configPath, changed: true });
    expect(result.registration).toEqual({
      mode: "npx",
      packageSpec: "codex-cc-tools@next"
    });
    const written = await readFile(configPath, "utf8");
    expect(written).toContain("[mcp_servers.codex_cc_tools]");
    expect(written).toContain('args = ["-y", "codex-cc-tools@next", "mcp"]');
  });

  it("updates and uninstalls an existing config file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "codex-cc-tools-"));
    const configPath = join(dir, "config.toml");

    const installResult = await installCodexCcToolsConfig(configPath);
    const updateResult = await installCodexCcToolsConfig(configPath, {
      launchMode: "global"
    });
    const uninstallResult = await uninstallCodexCcToolsConfig(configPath);

    expect(installResult.changed).toBe(true);
    expect(updateResult.changed).toBe(true);
    expect(uninstallResult).toMatchObject({ configPath, changed: true });
    const written = await readFile(configPath, "utf8");
    expect(written).toBe("");
  });

  it("does not create a file when uninstall has nothing to remove", async () => {
    const dir = await mkdtemp(join(tmpdir(), "codex-cc-tools-"));
    const configPath = join(dir, "missing", "config.toml");

    const result = await uninstallCodexCcToolsConfig(configPath);

    expect(result).toMatchObject({ configPath, changed: false });
    await expect(stat(configPath)).rejects.toMatchObject({ code: "ENOENT" });
  });
});

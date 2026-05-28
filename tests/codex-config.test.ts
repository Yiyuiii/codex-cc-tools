import { describe, expect, it } from "vitest";

import {
  buildCodexCcToolsConfigBlock,
  getConfiguredCodexCcToolsRegistration,
  hasCodexCcToolsConfig,
  installCodexCcToolsConfigText,
  normalizePackageSpec,
  uninstallCodexCcToolsConfigText
} from "../src/config/codex.js";

describe("Codex MCP config management", () => {
  it("builds the default npx config block for both public tools", () => {
    const block = buildCodexCcToolsConfigBlock();

    expect(block).toContain("[mcp_servers.codex_cc_tools]");
    expect(block).toContain('command = "npx"');
    expect(block).toContain('args = ["-y", "codex-cc-tools@latest", "mcp"]');
    expect(block).toContain("startup_timeout_sec = 60");
    expect(block).toContain("tool_timeout_sec = 900");
    expect(block).toContain("required = false");
    expect(block).toContain("enabled = true");
    expect(block).toContain('enabled_tools = ["cc_review", "cc_delegate"]');
  });

  it("builds a global binary config block without npx args", () => {
    const block = buildCodexCcToolsConfigBlock({ launchMode: "global" });

    expect(block).toContain('command = "codex-cc-tools-mcp"');
    expect(block).toContain("args = []");
    expect(block).not.toContain("codex-cc-tools@latest");
  });

  it("can omit enabled_tools for older Codex clients", () => {
    const block = buildCodexCcToolsConfigBlock({ includeEnabledTools: false });

    expect(block).not.toContain("enabled_tools");
  });

  it("installs a config block without disturbing other server tables", () => {
    const existing = [
      "[mcp_servers.other]",
      'command = "other-server"',
      "args = []",
      "",
      "[profiles.default]",
      'model = "gpt-5"'
    ].join("\n");

    const next = installCodexCcToolsConfigText(existing);

    expect(next).toContain("[mcp_servers.other]");
    expect(next).toContain("[profiles.default]");
    expect(next).toContain("[mcp_servers.codex_cc_tools]");
    expect(next.endsWith("\n")).toBe(true);
  });

  it("updates an existing block while preserving comments and user scalar settings", () => {
    const existing = [
      "[mcp_servers.codex_cc_tools]",
      "# keep this timeout high for long reviews",
      'command = "npx"',
      'args = ["-y", "codex-cc-tools@0.2.0", "mcp"]',
      "startup_timeout_sec = 75",
      "tool_timeout_sec = 1800",
      "required = true",
      "enabled = false",
      'enabled_tools = ["cc_review"]',
      "",
      "[mcp_servers.other]",
      'command = "other-server"',
      "args = []"
    ].join("\n");

    const next = installCodexCcToolsConfigText(existing, {
      packageSpec: "codex-cc-tools@next"
    });

    expect(next).toContain("# keep this timeout high for long reviews");
    expect(next).toContain("startup_timeout_sec = 75");
    expect(next).toContain("tool_timeout_sec = 1800");
    expect(next).toContain("required = true");
    expect(next).toContain("enabled = false");
    expect(next).toContain('args = ["-y", "codex-cc-tools@next", "mcp"]');
    expect(next).toContain('enabled_tools = ["cc_review"]');
    expect(next).toContain("[mcp_servers.other]");
    expect(next.indexOf("[mcp_servers.codex_cc_tools]")).toBeLessThan(
      next.indexOf("[mcp_servers.other]")
    );
  });

  it("preserves same-server env subtables on install update", () => {
    const existing = [
      "[mcp_servers.codex_cc_tools]",
      'command = "npx"',
      'args = ["-y", "codex-cc-tools@0.2.0", "mcp"]',
      "",
      "[mcp_servers.codex_cc_tools.env]",
      'DEEPSEEK_API_KEY = "from-codex-config"',
      "",
      "[mcp_servers.other]",
      'command = "other-server"',
      "args = []"
    ].join("\n");

    const next = installCodexCcToolsConfigText(existing, {
      packageSpec: "codex-cc-tools@next"
    });

    expect(next).toContain("[mcp_servers.codex_cc_tools.env]");
    expect(next).toContain('DEEPSEEK_API_KEY = "from-codex-config"');
    expect(next.indexOf("[mcp_servers.codex_cc_tools.env]")).toBeLessThan(
      next.indexOf("[mcp_servers.other]")
    );
    expect(next).toContain('args = ["-y", "codex-cc-tools@next", "mcp"]');
  });

  it("adds missing main-table enabled_tools before same-server subtables", () => {
    const existing = [
      "[mcp_servers.codex_cc_tools]",
      'command = "npx"',
      'args = ["-y", "codex-cc-tools@0.2.0", "mcp"]',
      "",
      "[mcp_servers.codex_cc_tools.env]",
      'DEEPSEEK_API_KEY = "from-codex-config"'
    ].join("\n");

    const next = installCodexCcToolsConfigText(existing, {
      packageSpec: "codex-cc-tools@next"
    });

    expect(next).toContain('enabled_tools = ["cc_review", "cc_delegate"]');
    expect(next.indexOf('enabled_tools = ["cc_review", "cc_delegate"]')).toBeLessThan(
      next.indexOf("[mcp_servers.codex_cc_tools.env]")
    );
  });

  it("does not add another enabled_tools line when one exists in a subtable", () => {
    const existing = [
      "[mcp_servers.codex_cc_tools]",
      'command = "npx"',
      'args = ["-y", "codex-cc-tools@0.2.0", "mcp"]',
      "",
      "[mcp_servers.codex_cc_tools.env]",
      'enabled_tools = ["cc_review"]'
    ].join("\n");

    const next = installCodexCcToolsConfigText(existing);

    expect(next.match(/enabled_tools\s*=/g)).toHaveLength(1);
    expect(next).toContain('enabled_tools = ["cc_review"]');
  });

  it("preserves an existing pinned package spec when no new package spec is passed", () => {
    const existing = [
      "[mcp_servers.codex_cc_tools]",
      'command = "npx"',
      'args = ["-y", "codex-cc-tools@0.2.0", "mcp"]',
      "tool_timeout_sec = 1800"
    ].join("\n");

    const next = installCodexCcToolsConfigText(existing);

    expect(next).toContain('args = ["-y", "codex-cc-tools@0.2.0", "mcp"]');
    expect(next).not.toContain("codex-cc-tools@latest");
  });

  it("preserves an existing global launch mode when no launch mode is passed", () => {
    const existing = [
      "[mcp_servers.codex_cc_tools]",
      'command = "codex-cc-tools-mcp"',
      "args = []",
      "tool_timeout_sec = 1800"
    ].join("\n");

    const next = installCodexCcToolsConfigText(existing);

    expect(next).toContain('command = "codex-cc-tools-mcp"');
    expect(next).toContain("args = []");
    expect(next).not.toContain('command = "npx"');
    expect(next).not.toContain("codex-cc-tools@latest");
  });

  it("switches from global to npx when a package spec is explicitly passed", () => {
    const existing = [
      "[mcp_servers.codex_cc_tools]",
      'command = "codex-cc-tools-mcp"',
      "args = []"
    ].join("\n");

    const next = installCodexCcToolsConfigText(existing, {
      packageSpec: "codex-cc-tools@next"
    });

    expect(next).toContain('command = "npx"');
    expect(next).toContain('args = ["-y", "codex-cc-tools@next", "mcp"]');
  });

  it("replaces multiline args arrays without leaving orphan fragments", () => {
    const existing = [
      "[mcp_servers.codex_cc_tools]",
      'command = "npx"',
      "args = [",
      '  "-y",',
      '  "codex-cc-tools@0.2.0",',
      '  "mcp"',
      "]",
      "tool_timeout_sec = 1800"
    ].join("\n");

    const next = installCodexCcToolsConfigText(existing, {
      packageSpec: "codex-cc-tools@next"
    });

    expect(next).toContain('args = ["-y", "codex-cc-tools@next", "mcp"]');
    expect(next).not.toContain('"codex-cc-tools@0.2.0"');
    expect(next).not.toContain("\n]");
    expect(next).toContain("tool_timeout_sec = 1800");
  });

  it("preserves existing enabled_tools even when new blocks would omit it", () => {
    const existing = [
      "[mcp_servers.codex_cc_tools]",
      'command = "npx"',
      'args = ["-y", "codex-cc-tools@0.2.0", "mcp"]',
      'enabled_tools = ["cc_review"]'
    ].join("\n");

    const next = installCodexCcToolsConfigText(existing, {
      includeEnabledTools: false
    });

    expect(next).toContain('enabled_tools = ["cc_review"]');
  });

  it("uninstalls only the codex_cc_tools block", () => {
    const existing = [
      "[mcp_servers.codex_cc_tools]",
      'command = "npx"',
      'args = ["-y", "codex-cc-tools@latest", "mcp"]',
      "",
      "[mcp_servers.codex_cc_tools.env]",
      'DEEPSEEK_API_KEY = "from-codex-config"',
      "",
      "[mcp_servers.other]",
      'command = "other-server"',
      "args = []"
    ].join("\n");

    const next = uninstallCodexCcToolsConfigText(existing);

    expect(next).not.toContain("codex_cc_tools");
    expect(next).not.toContain("DEEPSEEK_API_KEY");
    expect(next).toContain("[mcp_servers.other]");
    expect(next.endsWith("\n")).toBe(true);
  });

  it("preserves comments that precede the next unrelated table on uninstall", () => {
    const existing = [
      "[mcp_servers.codex_cc_tools]",
      'command = "npx"',
      'args = ["-y", "codex-cc-tools@latest", "mcp"]',
      "",
      "# default profile for this workstation",
      "[profiles.default]",
      'model = "gpt-5"'
    ].join("\n");

    const next = uninstallCodexCcToolsConfigText(existing);

    expect(next).not.toContain("codex_cc_tools");
    expect(next).toContain("# default profile for this workstation");
    expect(next).toContain("[profiles.default]");
  });

  it("handles CRLF configs when updating and uninstalling", () => {
    const existing = [
      "[mcp_servers.codex_cc_tools]",
      'command = "npx"',
      'args = ["-y", "codex-cc-tools@0.2.0", "mcp"]',
      "",
      "[mcp_servers.codex_cc_tools.env]",
      'DEEPSEEK_API_KEY = "from-codex-config"',
      "",
      "[profiles.default]",
      'model = "gpt-5"'
    ].join("\r\n");

    const installed = installCodexCcToolsConfigText(existing, {
      packageSpec: "codex-cc-tools@next"
    });
    const uninstalled = uninstallCodexCcToolsConfigText(installed);

    expect(installed).toContain("[mcp_servers.codex_cc_tools.env]");
    expect(installed).toContain('args = ["-y", "codex-cc-tools@next", "mcp"]');
    expect(uninstalled).not.toContain("codex_cc_tools");
    expect(uninstalled).toContain("[profiles.default]");
  });

  it("detects and parses npx and global registrations", () => {
    const npxBlock = buildCodexCcToolsConfigBlock({ packageSpec: "codex-cc-tools@next" });
    const globalBlock = buildCodexCcToolsConfigBlock({ launchMode: "global" });

    expect(hasCodexCcToolsConfig(npxBlock)).toBe(true);
    expect(getConfiguredCodexCcToolsRegistration(npxBlock)).toEqual({
      mode: "npx",
      packageSpec: "codex-cc-tools@next"
    });
    expect(getConfiguredCodexCcToolsRegistration(globalBlock)).toEqual({
      mode: "global",
      command: "codex-cc-tools-mcp"
    });
  });

  it("normalizes allowed package specs and rejects TOML injection risks", () => {
    expect(normalizePackageSpec()).toBe("codex-cc-tools@latest");
    expect(normalizePackageSpec("codex-cc-tools@next")).toBe("codex-cc-tools@next");
    expect(normalizePackageSpec("file:../codex-cc-tools-0.2.1.tgz")).toBe(
      "file:../codex-cc-tools-0.2.1.tgz"
    );
    expect(normalizePackageSpec("github:Yiyuiii/codex-cc-tools#next")).toBe(
      "github:Yiyuiii/codex-cc-tools#next"
    );
    expect(normalizePackageSpec("https://example.com/codex-cc-tools.tgz")).toBe(
      "https://example.com/codex-cc-tools.tgz"
    );
    expect(normalizePackageSpec("../codex-cc-tools-0.2.1.tgz")).toBe(
      "../codex-cc-tools-0.2.1.tgz"
    );

    expect(() => normalizePackageSpec("other-package")).toThrow(/Invalid/);
    expect(() => normalizePackageSpec('codex-cc-tools@next"')).toThrow(/Invalid/);
    expect(() => normalizePackageSpec("codex-cc-tools@next\\bad")).toThrow(/Invalid/);
    expect(() => normalizePackageSpec("codex-cc-tools@next\nbad")).toThrow(/Invalid/);
  });
});

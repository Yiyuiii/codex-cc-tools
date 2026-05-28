import { homedir } from "node:os";
import { join } from "node:path";

import { readTextIfExists, writeTextFile } from "../utils/fs.js";

export const CODEX_CC_TOOLS_SERVER_NAME = "codex_cc_tools";
export const DEFAULT_CODEX_CC_TOOLS_PACKAGE_SPEC = "codex-cc-tools@latest";

export type CodexConfigLaunchMode = "npx" | "global";

export interface CodexCcToolsConfigOptions {
  packageSpec?: string;
  launchMode?: CodexConfigLaunchMode;
  includeEnabledTools?: boolean;
}

export interface CodexConfigFileResult {
  configPath: string;
  changed: boolean;
  registration?: CodexCcToolsRegistration;
}

export type CodexCcToolsRegistration =
  | { mode: "npx"; packageSpec: string }
  | { mode: "global"; command: "codex-cc-tools-mcp" };

const TABLE_HEADER_PATTERN = /^\s*\[([^\]]+)\]\s*$/gm;
const CODEX_CC_TOOLS_TABLE = `mcp_servers.${CODEX_CC_TOOLS_SERVER_NAME}`;

interface TextRange {
  start: number;
  end: number;
  text: string;
}

export function buildCodexCcToolsConfigBlock(options: CodexCcToolsConfigOptions = {}): string {
  const launchMode = options.launchMode ?? "npx";
  const includeEnabledTools = options.includeEnabledTools ?? true;
  const lines = [
    `[mcp_servers.${CODEX_CC_TOOLS_SERVER_NAME}]`,
    launchMode === "global" ? 'command = "codex-cc-tools-mcp"' : 'command = "npx"',
    launchMode === "global"
      ? "args = []"
      : `args = ["-y", ${tomlString(normalizePackageSpec(options.packageSpec))}, "mcp"]`,
    `startup_timeout_sec = ${launchMode === "global" ? 20 : 60}`,
    "tool_timeout_sec = 900",
    "required = false",
    "enabled = true"
  ];

  if (includeEnabledTools) {
    lines.push('enabled_tools = ["cc_review", "cc_delegate"]');
  }

  return lines.join("\n");
}

export function installCodexCcToolsConfigText(
  existing: string,
  options: CodexCcToolsConfigOptions = {}
): string {
  const match = findCodexCcToolsBlock(existing);
  if (match) {
    const nextBlock = updateConfigBlock(match.text, options);
    return `${existing.slice(0, match.start)}${nextBlock}${existing.slice(match.end)}`.trimEnd() + "\n";
  }

  const nextBlock = buildCodexCcToolsConfigBlock(options);
  const existingTrimmed = existing.trimEnd();
  return existingTrimmed ? `${existingTrimmed}\n\n${nextBlock}\n` : `${nextBlock}\n`;
}

export function uninstallCodexCcToolsConfigText(existing: string): string {
  const next = removeToolsBlock(existing).trimEnd();
  return next ? `${next}\n` : "";
}

export function hasCodexCcToolsConfig(existing: string): boolean {
  return findCodexCcToolsBlock(existing) !== undefined;
}

export function getConfiguredCodexCcToolsRegistration(
  existing: string
): CodexCcToolsRegistration | undefined {
  const block = findCodexCcToolsBlock(existing)?.text;
  if (!block) return undefined;

  const command = block.match(/^\s*command\s*=\s*"((?:\\.|[^"\\])*)"\s*$/m)?.[1];
  const argsLine = block.match(/^\s*args\s*=\s*\[(.*)\]\s*$/m)?.[1];
  const args = argsLine !== undefined ? parseTomlArray(argsLine) : undefined;

  if (command === "codex-cc-tools-mcp" && args?.length === 0) {
    return { mode: "global", command };
  }

  if (command === "npx" && args?.[0] === "-y" && args?.[2] === "mcp" && args[1]) {
    return { mode: "npx", packageSpec: args[1] };
  }

  return undefined;
}

export function normalizePackageSpec(packageSpec = DEFAULT_CODEX_CC_TOOLS_PACKAGE_SPEC): string {
  const normalized = packageSpec.trim();
  if (!normalized || /[\u0000-\u001f\u007f"\\]/.test(normalized) || /\s/.test(normalized)) {
    throw new Error(`Invalid codex-cc-tools package spec: ${packageSpec || "(empty)"}`);
  }

  const allowed =
    /^codex-cc-tools(?:@[^"\\\s]+)?$/.test(normalized) ||
    /^(?:file:|https:|github:)[^"\\\s]+$/.test(normalized) ||
    /^(?:\.{1,2}\/|\/)?[^"\\\s]+\.tgz$/.test(normalized);

  if (!allowed) {
    throw new Error(`Invalid codex-cc-tools package spec: ${packageSpec}`);
  }

  return normalized;
}

export function getDefaultCodexConfigPath(home = homedir()): string {
  return join(home, ".codex", "config.toml");
}

export async function installCodexCcToolsConfig(
  configPath = getDefaultCodexConfigPath(),
  options: CodexCcToolsConfigOptions = {}
): Promise<CodexConfigFileResult> {
  const existing = await readTextIfExists(configPath);
  const next = installCodexCcToolsConfigText(existing, options);
  if (next !== existing) {
    await writeTextFile(configPath, next);
  }
  return {
    configPath,
    changed: next !== existing,
    registration: getConfiguredCodexCcToolsRegistration(next)
  };
}

export async function uninstallCodexCcToolsConfig(
  configPath = getDefaultCodexConfigPath()
): Promise<CodexConfigFileResult> {
  const existing = await readTextIfExists(configPath);
  if (!hasCodexCcToolsConfig(existing)) {
  return { configPath, changed: false };
  }
  const next = uninstallCodexCcToolsConfigText(existing);
  await writeTextFile(configPath, next);
  return { configPath, changed: true };
}

function updateConfigBlock(block: string, options: CodexCcToolsConfigOptions): string {
  const existingRegistration = getConfiguredCodexCcToolsRegistration(block);
  const generated = buildCodexCcToolsConfigBlock({
    ...options,
    launchMode:
      options.launchMode ??
      (options.packageSpec ? "npx" : existingRegistration?.mode),
    packageSpec:
      options.packageSpec ??
      (existingRegistration?.mode === "npx" ? existingRegistration.packageSpec : undefined)
  });
  const generatedLines = new Map(
    generated
      .split(/\r?\n/)
      .map((line) => line.match(/^([a-z_]+)\s*=/)?.[1])
      .filter((key): key is string => key !== undefined)
      .map((key) => [key, generated.match(new RegExp(`^${key}\\s*=.*$`, "m"))?.[0] ?? ""])
  );
  const ownedKeys = new Set(["command", "args"]);
  const seen = new Set<string>();
  const lines: string[] = [];
  let inMainTable = true;

  const sourceLines = block.split(/\r?\n/);
  for (let index = 0; index < sourceLines.length; index += 1) {
    const line = sourceLines[index] ?? "";
    if (/^\s*\[mcp_servers\.codex_cc_tools\./.test(line)) {
      inMainTable = false;
      lines.push(line);
      continue;
    }
    const key = line.match(/^\s*([a-z_]+)\s*=/)?.[1];
    if (key === "enabled_tools") {
      seen.add(key);
    }
    if (inMainTable && key && ownedKeys.has(key)) {
      const replacement = generatedLines.get(key);
      if (replacement) {
        lines.push(replacement);
        seen.add(key);
      }
      if (isMultilineArrayStart(line)) {
        while (index + 1 < sourceLines.length && !String(sourceLines[index + 1]).includes("]")) {
          index += 1;
        }
        if (index + 1 < sourceLines.length) {
          index += 1;
        }
      }
      continue;
    }
    if (inMainTable && key) seen.add(key);
    lines.push(line);
  }

  const insertions = ["command", "args", "enabled_tools"]
    .filter((key) => generatedLines.has(key) && !seen.has(key))
    .map((key) => generatedLines.get(key) ?? "");

  if (!insertions.length) {
    return lines.join("\n").trimEnd();
  }

  return insertMainTableLines(lines, insertions).join("\n").trimEnd();
}

function insertMainTableLines(lines: string[], insertions: string[]): string[] {
  const subtableIndex = lines.findIndex((line) => /^\s*\[mcp_servers\.codex_cc_tools\./.test(line));
  if (subtableIndex === -1) {
    return [...lines, ...insertions];
  }

  const prefix = lines.slice(0, subtableIndex);
  const suffix = lines.slice(subtableIndex);
  const separator = prefix.at(-1)?.trim() === "" ? [] : [""];
  return [...prefix, ...insertions, ...separator, ...suffix];
}

function removeToolsBlock(existing: string): string {
  const match = findCodexCcToolsBlock(existing);
  if (!match) return existing;
  return `${existing.slice(0, match.start)}${existing.slice(match.end)}`
    .replace(/^(?:\r?\n)+/, "")
    .replace(/\n{3,}/g, "\n\n");
}

function findCodexCcToolsBlock(existing: string): TextRange | undefined {
  const headers = Array.from(existing.matchAll(TABLE_HEADER_PATTERN));
  const tableNames = headers.map((header) => (header[1] ?? "").trim());
  const mainIndex = tableNames.findIndex((name) => name === CODEX_CC_TOOLS_TABLE);
  if (mainIndex === -1) return undefined;

  const start = headers[mainIndex]?.index ?? 0;
  let end = existing.length;
  let stoppedAtForeignTable = false;

  for (let index = mainIndex + 1; index < headers.length; index += 1) {
    const name = tableNames[index] ?? "";
    if (name !== CODEX_CC_TOOLS_TABLE && !name.startsWith(`${CODEX_CC_TOOLS_TABLE}.`)) {
      end = headers[index]?.index ?? existing.length;
      stoppedAtForeignTable = true;
      break;
    }
  }

  if (stoppedAtForeignTable) {
    const segment = existing.slice(start, end);
    end = start + segment.replace(/(?:\r?\n[ \t]*(?:#.*)?)*$/, "").length;
  }

  return { start, end, text: existing.slice(start, end) };
}

function tomlString(value: string): string {
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error("TOML basic strings cannot contain control characters");
  }
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function parseTomlArray(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];

  const result: string[] = [];
  const pattern = /"((?:\\.|[^"\\])*)"\s*(?:,|$)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(trimmed)) !== null) {
    result.push((match[1] ?? "").replace(/\\(["\\])/g, "$1"));
  }
  return result;
}

function isMultilineArrayStart(line: string): boolean {
  const value = line.slice(line.indexOf("=") + 1).trim();
  return value.startsWith("[") && !value.includes("]");
}

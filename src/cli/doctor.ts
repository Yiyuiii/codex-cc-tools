import { readdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import {
  getConfiguredCodexCcToolsRegistration,
  getDefaultCodexConfigPath,
  hasCodexCcToolsConfig
} from "../config/codex.js";
import { getProviderProfiles } from "../providers/registry.js";
import { getTaskDefinitions } from "../tasks/registry.js";
import { runCommandCheck, type CommandCheck } from "../utils/exec.js";
import { readTextIfExists } from "../utils/fs.js";
import { writeLine } from "../utils/logger.js";

export interface DoctorResult {
  name: string;
  ok: boolean;
  level: "ok" | "warn" | "error";
  detail: string;
}

export interface DoctorOptions {
  configPath?: string;
  strict?: boolean;
}

export interface CollectDoctorDeps {
  configPath?: string;
  claudeConfigDir?: string;
  env?: Record<string, string | undefined>;
}

export const MIN_CLAUDE_CODE_VERSION = "2.1.92";

export async function collectDoctorResults(deps: CollectDoctorDeps = {}): Promise<DoctorResult[]> {
  const env = deps.env ?? process.env;
  const [node, npm, codex, claude] = await Promise.all([
    runCommandCheck("node", ["--version"]),
    runCommandCheck("npm", ["--version"]),
    runCommandCheck("codex", ["--version"]),
    runCommandCheck("claude", ["--version"])
  ]);
  const configPath = deps.configPath ?? getDefaultCodexConfigPath();
  const configText = await readTextIfExists(configPath);
  const claudeVersion = parseClaudeVersion(claude.output);
  const claudeConfigDir = deps.claudeConfigDir ?? env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude");

  return [
    commandResult("Node", node),
    commandResult("npm", npm),
    codexCliResult(codex),
    claudeCliResult(claude),
    ...(await collectClaudeBackgroundResults(claudeConfigDir, claudeVersion)),
    {
      name: "Codex config",
      ok: configText.length > 0,
      level: configText.length > 0 ? "ok" : "warn",
      detail: configText.length > 0 ? configPath : `not found at ${configPath}; run 'codex-cc-tools install'`
    },
    mcpRegistrationResult(configText),
    ...registryResults(),
    deepSeekEnvResult(env),
    arkCodingPlanEnvResult(env),
    geminiEnvResult(env)
  ];
}

export async function runDoctor(options: DoctorOptions = {}): Promise<DoctorResult[]> {
  const results = await collectDoctorResults({
    configPath: options.configPath
  });

  writeLine("codex-cc-tools doctor");
  writeLine("");
  for (const result of results) {
    writeLine(`${formatLevel(result.level)} ${result.name}: ${result.detail}`);
  }

  if (options.strict && shouldDoctorFail(results)) {
    process.exitCode = 1;
  }

  return results;
}

export function shouldDoctorFail(results: DoctorResult[]): boolean {
  return results.some((result) => result.level === "error");
}

export function codexCliResult(result: CommandCheck): DoctorResult {
  if (result.ok) {
    return { name: "Codex CLI", ok: true, level: "ok", detail: result.output };
  }

  return {
    name: "Codex CLI",
    ok: false,
    level: "warn",
    detail: "not runnable from PATH; Codex app MCP config may still work"
  };
}

export function claudeCliResult(result: CommandCheck): DoctorResult {
  if (!result.ok) {
    return commandResult("Claude Code CLI", result);
  }

  const version = parseClaudeVersion(result.output);
  if (!version) {
    return {
      name: "Claude Code CLI",
      ok: true,
      level: "warn",
      detail: `${result.output}; could not parse version, expected >= ${MIN_CLAUDE_CODE_VERSION}`
    };
  }

  if (compareVersions(version, MIN_CLAUDE_CODE_VERSION) < 0) {
    return {
      name: "Claude Code CLI",
      ok: true,
      level: "warn",
      detail: `${result.output}; below validated version ${MIN_CLAUDE_CODE_VERSION}`
    };
  }

  return { name: "Claude Code CLI", ok: true, level: "ok", detail: result.output };
}

export function parseClaudeVersion(output: string): string | undefined {
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const preferredLine = lines.find((line) => /Claude Code/i.test(line)) ?? lines[0] ?? "";
  return preferredLine.match(/\b\d+\.\d+\.\d+\b/)?.[0];
}

export function daemonRosterResult(text: string, currentVersion?: string): DoctorResult {
  if (!text.trim()) {
    return {
      name: "Claude Code daemon",
      ok: true,
      level: "ok",
      detail: "no daemon roster found"
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      name: "Claude Code daemon",
      ok: true,
      level: "warn",
      detail: "daemon roster is not valid JSON; restart Claude Code if background sessions misbehave"
    };
  }

  const workers = getRosterWorkers(parsed);
  if (!workers.length) {
    return {
      name: "Claude Code daemon",
      ok: true,
      level: "ok",
      detail: "no background daemon workers registered"
    };
  }

  const mismatched = currentVersion
    ? workers.filter((worker) => worker.cliVersion && worker.cliVersion !== currentVersion)
    : [];
  if (mismatched.length) {
    return {
      name: "Claude Code daemon",
      ok: true,
      level: "warn",
      detail: `${mismatched.length} worker(s) were started with a different Claude Code version; run 'claude agents' and stop stale sessions before debugging reviews`
    };
  }

  return {
    name: "Claude Code daemon",
    ok: true,
    level: "ok",
    detail: `${workers.length} background daemon worker(s) registered`
  };
}

export function backgroundJobsResult(entries: Array<{ name: string; text: string }>): DoctorResult {
  const states = entries.map((entry) => ({
    name: entry.name,
    ...parseJobState(entry.text)
  }));
  const blocked = states.filter((entry) => entry.state === "blocked");
  const working = states.filter((entry) => entry.state === "working");
  const unreadableCount = states.filter((entry) => entry.unreadable).length;

  if (blocked.length || unreadableCount) {
    const blockedIds = blocked.map((entry) => entry.name).slice(0, 5).join(", ");
    const blockedDetail = blocked.length
      ? `${blocked.length} blocked background job(s)${blockedIds ? `: ${blockedIds}` : ""}`
      : "no blocked background jobs";
    const unreadableDetail = unreadableCount ? `; ${unreadableCount} state file(s) could not be parsed` : "";
    return {
      name: "Claude Code background jobs",
      ok: true,
      level: "warn",
      detail: `${blockedDetail}${unreadableDetail}; run 'claude agents' or 'claude stop <id>' if they are stale`
    };
  }

  return {
    name: "Claude Code background jobs",
    ok: true,
    level: "ok",
    detail: entries.length
      ? `${entries.length} historical job(s), none blocked${working.length ? `; ${working.length} working` : ""}`
      : "no background jobs found"
  };
}

export function mcpRegistrationResult(configText: string): DoctorResult {
  if (!hasCodexCcToolsConfig(configText)) {
    return {
      name: "MCP registration",
      ok: false,
      level: "warn",
      detail: "codex_cc_tools is not configured; run 'codex-cc-tools install'"
    };
  }

  const registration = getConfiguredCodexCcToolsRegistration(configText);
  if (registration?.mode === "npx") {
    return {
      name: "MCP registration",
      ok: true,
      level: "ok",
      detail: `codex_cc_tools is configured with ${registration.packageSpec}`
    };
  }

  if (registration?.mode === "global") {
    return {
      name: "MCP registration",
      ok: true,
      level: "ok",
      detail: "codex_cc_tools is configured with codex-cc-tools-mcp"
    };
  }

  return {
    name: "MCP registration",
    ok: true,
    level: "warn",
    detail: "codex_cc_tools is configured, but command/args do not match known install modes"
  };
}

export function deepSeekEnvResult(env: Record<string, string | undefined>): DoctorResult {
  const deepSeek = env.DEEPSEEK_API_KEY;
  const openAiDeepSeek = env.OPENAI_API_KEY_DEEPSEEK;

  if (deepSeek && openAiDeepSeek && deepSeek !== openAiDeepSeek) {
    return {
      name: "DeepSeek environment",
      ok: true,
      level: "warn",
      detail: "DEEPSEEK_API_KEY and OPENAI_API_KEY_DEEPSEEK are both set with different values; DEEPSEEK_API_KEY wins"
    };
  }

  if (deepSeek || openAiDeepSeek) {
    return {
      name: "DeepSeek environment",
      ok: true,
      level: "ok",
      detail: deepSeek ? "DEEPSEEK_API_KEY is set" : "OPENAI_API_KEY_DEEPSEEK is set"
    };
  }

  return {
    name: "DeepSeek environment",
    ok: false,
    level: "warn",
    detail: "no DeepSeek key found; cc_delegate defaults to providerProfile deepseek"
  };
}

export function arkCodingPlanEnvResult(env: Record<string, string | undefined>): DoctorResult {
  const ark = env.ARK_API_KEY;
  const volcengine = env.VOLCENGINE_API_KEY;

  if (ark && volcengine && ark !== volcengine) {
    return {
      name: "Ark Coding Plan environment",
      ok: true,
      level: "warn",
      detail: "ARK_API_KEY and VOLCENGINE_API_KEY are both set with different values; ARK_API_KEY wins"
    };
  }

  if (ark || volcengine) {
    return {
      name: "Ark Coding Plan environment",
      ok: true,
      level: "ok",
      detail: ark ? "ARK_API_KEY is set" : "VOLCENGINE_API_KEY is set"
    };
  }

  return {
    name: "Ark Coding Plan environment",
    ok: false,
    level: "warn",
    detail: "no Ark Coding Plan key found; set ARK_API_KEY or VOLCENGINE_API_KEY before using providerProfile ark_coding_plan"
  };
}

export function geminiEnvResult(env: Record<string, string | undefined>): DoctorResult {
  const gemini = env.GEMINI_API_KEY;
  const google = env.GOOGLE_API_KEY;
  const googleGenerative = env.GOOGLE_GENERATIVE_AI_API_KEY;

  const setKeys = [
    gemini ? "GEMINI_API_KEY" : undefined,
    google ? "GOOGLE_API_KEY" : undefined,
    googleGenerative ? "GOOGLE_GENERATIVE_AI_API_KEY" : undefined
  ].filter((item): item is string => Boolean(item));

  if (setKeys.length > 1) {
    return {
      name: "Gemini environment",
      ok: true,
      level: "warn",
      detail: `${setKeys.join(", ")} are set; GEMINI_API_KEY wins, then GOOGLE_API_KEY, then GOOGLE_GENERATIVE_AI_API_KEY`
    };
  }

  if (setKeys.length === 1) {
    return {
      name: "Gemini environment",
      ok: true,
      level: "ok",
      detail: `${setKeys[0]} is set for providerProfile gemini`
    };
  }

  return {
    name: "Gemini environment",
    ok: false,
    level: "warn",
    detail:
      "no Gemini key found; set GEMINI_API_KEY before using providerProfile gemini for cc_review"
  };
}

export function registryResults(): DoctorResult[] {
  return [
    {
      name: "Tasks",
      ok: true,
      level: "ok",
      detail: getTaskDefinitions().map((task) => task.name).join(", ")
    },
    {
      name: "Providers",
      ok: true,
      level: "ok",
      detail: getProviderProfiles().map((provider) => provider.name).join(", ")
    },
    {
      name: "MCP tool names",
      ok: true,
      level: "ok",
      detail: "cc_review, cc_delegate"
    }
  ];
}

function commandResult(name: string, result: CommandCheck): DoctorResult {
  return {
    name,
    ok: result.ok,
    level: result.ok ? "ok" : "error",
    detail: result.output
  };
}

function compareVersions(left: string, right: string): number {
  const leftParts = left.split(".").map((part) => Number.parseInt(part, 10));
  const rightParts = right.split(".").map((part) => Number.parseInt(part, 10));

  for (let index = 0; index < 3; index += 1) {
    const delta = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

async function collectClaudeBackgroundResults(
  claudeConfigDir: string,
  currentVersion?: string
): Promise<DoctorResult[]> {
  const [daemon, jobs] = await Promise.all([
    readTextIfExists(join(claudeConfigDir, "daemon", "roster.json")).then((text) =>
      daemonRosterResult(text, currentVersion)
    ),
    readBackgroundJobs(join(claudeConfigDir, "jobs")).then(backgroundJobsResult)
  ]);
  return [daemon, jobs];
}

async function readBackgroundJobs(path: string): Promise<Array<{ name: string; text: string }>> {
  try {
    const entries = await readdir(path, { withFileTypes: true });
    return Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => ({
          name: entry.name,
          text: await readFile(join(path, entry.name, "state.json"), "utf8").catch(() => "")
        }))
    );
  } catch {
    return [];
  }
}

interface RosterWorker {
  cliVersion?: string;
}

function getRosterWorkers(value: unknown): RosterWorker[] {
  if (!isRecord(value) || !isRecord(value.workers)) return [];
  return Object.values(value.workers)
    .filter(isRecord)
    .map((worker) => ({
      cliVersion: typeof worker.cliVersion === "string" ? worker.cliVersion : undefined
    }));
}

function parseJobState(text: string): { state?: string; unreadable: boolean } {
  if (!text.trim()) return { unreadable: false };

  try {
    const parsed: unknown = JSON.parse(text);
    if (isRecord(parsed) && typeof parsed.state === "string") {
      return { state: parsed.state, unreadable: false };
    }
    return { unreadable: false };
  } catch {
    return { unreadable: true };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatLevel(level: DoctorResult["level"]): string {
  if (level === "ok") return "[ok]";
  if (level === "warn") return "[warn]";
  return "[!!]";
}

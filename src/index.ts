#!/usr/bin/env node
import { Command } from "commander";
import { pathToFileURL } from "node:url";

import { runLocalDelegate } from "./cli/delegate.js";
import { runDoctor } from "./cli/doctor.js";
import { runInstallCodexConfig } from "./cli/install.js";
import { runLocalReview } from "./cli/review.js";
import { runUninstallCodexConfig } from "./cli/uninstall.js";
import { serveMcp } from "./mcp/server.js";
import { getProviderProfiles } from "./providers/registry.js";
import { getTaskDefinitions } from "./tasks/registry.js";
import { VERSION } from "./version.js";

export { runClaudeDelegate } from "./tasks/delegate/tool.js";
export type { CcDelegateInput, CcDelegateOutput } from "./tasks/delegate/schema.js";
export { runClaudeReview } from "./tasks/review/tool.js";
export type { CcReviewInput, CcReviewOutput } from "./tasks/review/schema.js";
export { serveMcp } from "./mcp/server.js";
export { registerCcDelegateTool, registerCcReviewTool } from "./mcp/tools.js";

export interface CreateProgramDeps {
  runDoctor?: typeof runDoctor;
  installCodexConfig?: typeof runInstallCodexConfig;
  runLocalDelegate?: typeof runLocalDelegate;
  runLocalReview?: typeof runLocalReview;
  serveMcp?: typeof serveMcp;
  uninstallCodexConfig?: typeof runUninstallCodexConfig;
}

export function createProgram(deps: CreateProgramDeps = {}): Command {
  const program = new Command();
  const delegateRunner = deps.runLocalDelegate ?? runLocalDelegate;
  const doctorRunner = deps.runDoctor ?? runDoctor;
  const installRunner = deps.installCodexConfig ?? runInstallCodexConfig;
  const reviewRunner = deps.runLocalReview ?? runLocalReview;
  const mcpServer = deps.serveMcp ?? serveMcp;
  const uninstallRunner = deps.uninstallCodexConfig ?? runUninstallCodexConfig;

  program
    .name("codex-cc-tools")
    .description("Claude Code task tools for Codex.")
    .version(VERSION);

  program
    .command("install")
    .description("Install codex-cc-tools MCP config into Codex.")
    .option("--package-spec <spec>", "npm package spec for npx mode.")
    .option("--config-path <path>", "Codex config path; defaults to ~/.codex/config.toml.")
    .option("--global-binary", "Use the global codex-cc-tools-mcp binary instead of npx.")
    .option("--no-enabled-tools", "Omit enabled_tools for older Codex clients.")
    .action(async (options) => {
      await installRunner({
        packageSpec: options.packageSpec,
        configPath: options.configPath,
        globalBinary: options.globalBinary,
        includeEnabledTools: options.enabledTools
      });
    });

  program
    .command("doctor")
    .description("Check Node, Codex, Claude Code, MCP config, and provider setup.")
    .option("--config-path <path>", "Codex config path; defaults to ~/.codex/config.toml.")
    .option("--strict", "Exit non-zero when required diagnostics fail.")
    .action(async (options) => {
      await doctorRunner({
        configPath: options.configPath,
        strict: options.strict
      });
    });

  program
    .command("uninstall")
    .description("Remove codex-cc-tools MCP config from Codex.")
    .option("--config-path <path>", "Codex config path; defaults to ~/.codex/config.toml.")
    .action(async (options) => {
      await uninstallRunner({
        configPath: options.configPath
      });
    });

  program
    .command("delegate")
    .description("Run Claude Code on a Codex-provided prompt.")
    .requiredOption("--prompt <prompt>", "Complete prompt to pass to Claude Code.")
    .option("--cwd <path>", "Working directory for the Claude Code subprocess.")
    .option(
      "--provider-profile <profile>",
      "Provider profile: deepseek by default; also supports anthropic or ark_coding_plan. Gemini is review-only."
    )
    .option("--model <model>", "Claude Code model or provider alias.")
    .option("--effort <level>", "Claude Code effort level.")
    .option("--timeout-ms <number>", "Claude Code subprocess timeout.")
    .option("--max-context-chars <number>", "Maximum packet context characters.")
    .option("--no-stream", "Disable Claude Code stream-json output.")
    .option("--cache-ttl <ttl>", "Prompt cache TTL.")
    .action(async (options) => {
      await delegateRunner(options);
    });

  program
    .command("review")
    .description("Run Claude Code as an external reviewer.")
    .requiredOption("--task <task>", "Review task type.")
    .requiredOption("--context <context>", "Review context or document.")
    .option("--prompt <prompt>", "Legacy review focus prompt.")
    .option("--original-goal <text>", "Original user goal.")
    .option("--review-focus <text>", "Specific review focus.")
    .option("--codex-summary <text>", "Codex implementation summary.")
    .option("--acceptance-criteria <text>", "Acceptance criteria.")
    .option("--known-risks <text>", "Known risks.")
    .option("--tests-run <text>", "Tests already run.")
    .option("--model <model>", "Claude Code model or provider alias.")
    .option("--effort <level>", "Claude Code effort level.")
    .option("--output <mode>", "Review output mode.")
    .option("--permission-mode <mode>", "Claude Code permission mode.")
    .option("--tools <tools>", "Comma-separated Claude Code tools.")
    .option("--gemini-proxy-url <url>", "HTTP proxy URL for Gemini direct review requests.")
    .option("--cwd <path>", "Working directory for Claude Code.")
    .option("--include-git-diff", "Include git diff evidence.")
    .option("--include-git-status", "Include git status evidence.")
    .option("--auto-discover-git", "Auto-discover git evidence.")
    .option("--no-auto-discover-git", "Disable auto-discovery of git evidence.")
    .option("--include-untracked-content", "Include selected untracked file content.")
    .option("--no-include-untracked-content", "Disable untracked file content embedding.")
    .option("--redact-secrets", "Redact common secrets from packet evidence.")
    .option("--no-redact-secrets", "Disable best-effort packet secret redaction.")
    .option("--max-context-chars <number>", "Maximum packet context characters.")
    .option("--no-stream", "Disable Claude Code stream-json output.")
    .option("--no-include-partial-messages", "Do not request partial message stream events.")
    .option("--no-include-hook-events", "Do not request hook stream events.")
    .option("--no-verbose", "Do not request verbose stream events.")
    .option("--cache-ttl <ttl>", "Prompt cache TTL.")
    .option("--provider-profile <profile>", "Provider profile: anthropic, deepseek, ark_coding_plan, or gemini.")
    .action(async (options) => {
      await reviewRunner(options);
    });

  program
    .command("mcp")
    .description("Start the MCP stdio server.")
    .action(async () => {
      await mcpServer();
    });

  return program;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createProgram().parseAsync(process.argv).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}

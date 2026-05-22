#!/usr/bin/env node
import { Command } from "commander";
import { pathToFileURL } from "node:url";

import { runLocalDelegate } from "./cli/delegate.js";
import { runLocalResearch } from "./cli/research.js";
import { runLocalReview } from "./cli/review.js";
import { runLocalVerify } from "./cli/verify.js";
import { serveMcp } from "./mcp/server.js";
import { getProviderProfiles } from "./providers/registry.js";
import { getTaskDefinitions } from "./tasks/registry.js";
import { VERSION } from "./version.js";

export { runClaudeResearch } from "./tasks/research/tool.js";
export type { CcResearchInput, CcResearchOutput } from "./tasks/research/schema.js";
export { runClaudeDelegate } from "./tasks/delegate/tool.js";
export type { CcDelegateInput, CcDelegateOutput } from "./tasks/delegate/schema.js";
export { runClaudeReview } from "./tasks/review/tool.js";
export type { CcReviewInput, CcReviewOutput } from "./tasks/review/schema.js";
export { runClaudeVerify } from "./tasks/verify/tool.js";
export type { CcVerifyInput, CcVerifyOutput } from "./tasks/verify/schema.js";
export { serveMcp } from "./mcp/server.js";
export {
  registerCcDelegateTool,
  registerCcResearchTool,
  registerCcReviewTool,
  registerCcVerifyTool
} from "./mcp/tools.js";

export interface CreateProgramDeps {
  runLocalDelegate?: typeof runLocalDelegate;
  runLocalReview?: typeof runLocalReview;
  runLocalResearch?: typeof runLocalResearch;
  runLocalVerify?: typeof runLocalVerify;
  serveMcp?: typeof serveMcp;
}

export function createProgram(deps: CreateProgramDeps = {}): Command {
  const program = new Command();
  const delegateRunner = deps.runLocalDelegate ?? runLocalDelegate;
  const reviewRunner = deps.runLocalReview ?? runLocalReview;
  const researchRunner = deps.runLocalResearch ?? runLocalResearch;
  const verifyRunner = deps.runLocalVerify ?? runLocalVerify;
  const mcpServer = deps.serveMcp ?? serveMcp;

  program
    .name("codex-cc-tools")
    .description("Claude Code task tools for Codex.")
    .version(VERSION);

  program
    .command("doctor")
    .description("Print the current task and provider registry.")
    .action(() => {
      const tasks = getTaskDefinitions().map((task) => task.name).join(", ");
      const providers = getProviderProfiles().map((provider) => provider.name).join(", ");
      process.stdout.write(`tasks: ${tasks}\nproviders: ${providers}\n`);
    });

  program
    .command("delegate")
    .description("Run Claude Code for explicit writable delegated work.")
    .requiredOption("--task <task>", "Writable delegation task.")
    .requiredOption("--cwd <path>", "Explicit writable workspace root.")
    .requiredOption("--isolation-kind <kind>", "Isolation kind: git-worktree, git-branch, or container.")
    .option("--isolation-evidence <json>", "JSON object with isolation evidence fields.")
    .requiredOption("--acceptance-criteria <items...>", "Acceptance criteria.")
    .option("--context <context>", "Additional delegation context.")
    .option("--allowed-paths <paths>", "Comma-separated writable path prefixes.")
    .option("--forbidden-paths <paths>", "Comma-separated forbidden path prefixes.")
    .option("--commands-allowed <commands...>", "Allowed Bash command(s); quote multi-word commands.")
    .option("--provider-profile <profile>", "Provider profile: anthropic or deepseek.")
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
    .option("--provider-profile <profile>", "Provider profile: anthropic or deepseek.")
    .action(async (options) => {
      await reviewRunner(options);
    });

  program
    .command("research")
    .description("Run Claude Code for bounded read-only repository research.")
    .requiredOption("--question <question>", "Research question.")
    .option("--cwd <path>", "Working directory for Claude Code.")
    .option("--context <context>", "Additional research context.")
    .option("--include-git-status", "Include git status evidence.")
    .option("--include-files <paths>", "Comma-separated files to include as evidence.")
    .option("--provider-profile <profile>", "Provider profile: anthropic or deepseek.")
    .option("--model <model>", "Claude Code model or provider alias.")
    .option("--effort <level>", "Claude Code effort level.")
    .option("--max-context-chars <number>", "Maximum packet context characters.")
    .option("--no-stream", "Disable Claude Code stream-json output.")
    .option("--cache-ttl <ttl>", "Prompt cache TTL.")
    .action(async (options) => {
      await researchRunner(options);
    });

  program
    .command("verify")
    .description("Run Claude Code for bounded command verification.")
    .requiredOption("--hypothesis <hypothesis>", "Verification hypothesis.")
    .requiredOption(
      "--commands-allowed <commands...>",
      "Allowed verification command(s); quote multi-word commands and do not embed credentials."
    )
    .option("--cwd <path>", "Working directory for Claude Code.")
    .option("--context <context>", "Additional verification context.")
    .option("--provider-profile <profile>", "Provider profile: anthropic or deepseek.")
    .option("--model <model>", "Claude Code model or provider alias.")
    .option("--effort <level>", "Claude Code effort level.")
    .option("--timeout-ms <number>", "Claude Code subprocess timeout.")
    .option("--max-context-chars <number>", "Maximum packet context characters.")
    .option("--no-stream", "Disable Claude Code stream-json output.")
    .option("--cache-ttl <ttl>", "Prompt cache TTL.")
    .action(async (options) => {
      await verifyRunner(options);
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

# codex-cc-tools Architecture

## Purpose

`codex-cc-tools` is a small family of MCP and CLI tools that let Codex ask
Claude Code to perform high-leverage work. The public surface is intentionally
limited to review-style critique and thin delegated execution.

## Core Concepts

### Provider Profile

A provider profile decides which backend Claude Code uses.

- `anthropic`: the inherited/default Claude Code backend.
- `deepseek`: DeepSeek's Anthropic-compatible endpoint. It has passed the
  current repeated-run gate for the implemented `review` task.

Provider profiles own model mapping, environment construction, provider-token redaction, and provider-specific diagnostics.

### Task

A task decides what Claude Code is asked to do.

- `review`: read-only external review.
- `delegate`: thin Claude Code prompt execution.

Tasks should not hard-code provider details. A review or delegate task can run
on `anthropic` or `deepseek`.

### MCP Authority Metadata

MCP authority metadata describes how the client should treat the tool.

- `readonly`: Claude Code should inspect and report.
- `destructive`: Claude Code may edit files or run commands according to the
  caller's chosen execution environment. The MCP tool does not define or enforce
  that boundary.

Destructive tools must be separate from review tools in MCP metadata and documentation.

## Initial Module Layout

```text
src/
  core/         shared runner, output parsing, redaction, progress
  providers/    provider registry and provider-specific env/model logic
  tasks/        task registry and task-specific contracts
  mcp/          MCP tool exposure
  cli/          local CLI commands
```

The current repository implements the provider and task registries, CLI/MCP entry points for review, and the first shared runner foundation:

- `src/providers/env.ts` builds per-invocation provider environments.
- `src/providers/deepseek.ts` owns DeepSeek model aliases and endpoint defaults.
- `src/core/redaction.ts` redacts provider tokens from nested output.
- `src/core/claude-runner.ts` owns the initial Claude Code subprocess contract and happy-path stream parsing. The stream parser is redaction-unaware; the runner is the single output redaction boundary, with progress callbacks redacted before delivery.
- `src/tasks/review/*` owns the read-only review schema, packet construction, output formatting, and runner adapter.
- `src/tasks/delegate/*` owns the thin delegation schema, prompt handling, output formatting, and runner adapter.
- `src/tasks/review/diff-parser.ts`, `src/tasks/review/context-router.ts`, and `src/tasks/review/untracked-router.ts` route git evidence into bounded manifests and evidence sections.
- `src/mcp/tools.ts` registers `cc_review` and `cc_delegate`.
- `src/cli/review.ts` and `src/cli/delegate.ts` expose local smoke usage through `node dist/index.js review` and `node dist/index.js delegate`.

Review remains a product-level read-only task. It asks Claude Code not to edit files and advertises read-only MCP hints, but hard sandboxing remains the caller's responsibility.

Delegate is the thin Claude Code execution task. It accepts one complete
`prompt`, optional process/model settings, invokes Claude Code, and returns
structured results. It does not require or interpret separate `context`,
`acceptanceCriteria`, `isolation`, path policy, or command policy fields.
Execution-space choices such as current checkout, linked worktree, container,
branch policy, command policy, and cleanup are outside the MCP tool. Shared
Claude Code subprocess timeouts remain runner-managed and terminate the process
tree before a timed-out task returns. The active boundary is recorded in
`docs/delegate-safety.md`.

Earlier prerelease iterations exposed separate `research` and `verify` tasks.
Those were removed from the public surface because they only split authority
levels that a capable `delegate` worker can handle under one autonomous task
contract.

Review packet safety defaults are conservative:

- Common secret-shaped content is redacted by default.
- Untracked file content is not auto-embedded for diff reviews; callers must set `includeUntrackedContent: true` or `--include-untracked-content`.
- Known secret-bearing untracked filenames such as `.env`, `.npmrc`, `.netrc`, private-key names, and credential/token paths are omitted regardless of content redaction settings.

## Design Rule

Do not make `deepseek` a task. It is a provider profile. The generic subtask capability should be represented as `task: "delegate"` with `providerProfile: "deepseek"` when DeepSeek is the selected backend.

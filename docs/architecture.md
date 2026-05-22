# codex-cc-tools Architecture

## Purpose

`codex-cc-tools` is a family of MCP and CLI tools that let Codex ask Claude Code to perform bounded tasks. It should support both review-style read-only work and explicitly authorized delegated execution.

## Core Concepts

### Provider Profile

A provider profile decides which backend Claude Code uses.

- `anthropic`: the inherited/default Claude Code backend.
- `deepseek`: DeepSeek's Anthropic-compatible endpoint. It has passed the current repeated-run gate for the implemented `review` task; future task types still need their own task-specific gates.

Provider profiles own model mapping, environment construction, provider-token redaction, and provider-specific diagnostics.

### Task

A task decides what Claude Code is asked to do.

- `review`: read-only external review.
- `delegate`: writable subtask execution.
- `verify`: run or reason about verification.
- `research`: read-only investigation.

Tasks should not hard-code provider details. A review can run on `anthropic` or `deepseek`; a delegate task can do the same once its safety policy exists.

### Execution Policy

Execution policy decides local authority.

- `readonly`: Claude Code should inspect and report.
- `command-exec`: Claude Code may run verification commands.
- `workspace-write`: Claude Code may edit files within an explicit workspace boundary.

Writable tools must be separate from review tools in MCP metadata and documentation.

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
- `src/tasks/research/*` owns the read-only repository research schema, packet construction, output formatting, and runner adapter.
- `src/tasks/verify/*` owns the command-exec verification schema, packet construction, output formatting, and runner adapter.
- `src/tasks/delegate/*` owns the workspace-write delegation schema, safety policy, packet construction, output formatting, and runner adapter.
- `src/tasks/review/diff-parser.ts`, `src/tasks/review/context-router.ts`, and `src/tasks/review/untracked-router.ts` route git evidence into bounded manifests and evidence sections.
- `src/mcp/tools.ts` registers `cc_review`, `cc_research`, `cc_verify`, and `cc_delegate`.
- `src/cli/review.ts`, `src/cli/research.ts`, `src/cli/verify.ts`, and `src/cli/delegate.ts` expose local smoke usage through `node dist/index.js review`, `node dist/index.js research`, `node dist/index.js verify`, and `node dist/index.js delegate`.

Review remains a product-level read-only task. It asks Claude Code not to edit files and advertises read-only MCP hints, but hard sandboxing remains the caller's responsibility.

Research is also a product-level read-only task. It asks Claude Code to answer bounded repository questions with explicit evidence, files read, commands run, and missing context. Its default Claude Code tools are limited to read/search tools, and explicitly included local files are checked against the workspace after realpath resolution. Hard sandboxing remains the caller's responsibility.

Verify is a command-exec task, not a writable delegation task. It requires explicit simple `commandsAllowed`, rejects command entries that cannot be safely wrapped as Claude Code Bash allowlist entries, passes the accepted commands through `--allowedTools`, and asks for structured command/evidence/reproduction output. Multi-word CLI commands must be quoted by the caller, and the first command token must be literal rather than a wildcard. Allowed command strings must not embed credentials because Claude Code receives them as subprocess arguments. The allowlist is advisory unless the caller's Claude Code runtime and sandbox enforce it; workspace writes remain out of scope until `delegate`.

Delegate is the explicit workspace-write task. It requires an explicit `cwd`, structured isolation evidence, and at least one acceptance criterion. The runner verifies available Git worktree/branch/container signals, blocks unsafe roots, rejects dangerous command authority, uses destructive MCP metadata, runs Claude Code with writable authority only after policy checks pass, revalidates observed/reported changed paths after the run, and rejects reported commands outside the declared command policy. Shared Claude Code subprocess timeouts are runner-managed and terminate the process tree before a timed-out task returns. Its limits and required safety behavior are recorded in `docs/delegate-safety.md`; caller-managed OS/container sandboxing remains required for hard isolation. A real linked-worktree writable smoke passed on 2026-05-22; see `docs/research/delegate-writable-smoke.md`.

Review packet safety defaults are conservative:

- Common secret-shaped content is redacted by default.
- Untracked file content is not auto-embedded for diff reviews; callers must set `includeUntrackedContent: true` or `--include-untracked-content`.
- Known secret-bearing untracked filenames such as `.env`, `.npmrc`, `.netrc`, private-key names, and credential/token paths are omitted regardless of content redaction settings.

## Design Rule

Do not make `deepseek` a task. It is a provider profile. The generic subtask capability should be represented as `task: "delegate"` with `providerProfile: "deepseek"` when DeepSeek is the selected backend.

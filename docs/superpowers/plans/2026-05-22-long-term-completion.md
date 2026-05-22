# codex-cc-tools Long-Term Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Post-0.1.0 Direction Update

On 2026-05-22, after the first stable publication, the maintainer decided that
separate read-only investigation and command-verification tasks are unnecessary
public tools. The active product direction is:

- keep `cc_review` for high-signal external critique;
- keep `cc_delegate` for autonomous work by passing one complete prompt to
  Claude Code; execution-space policy stays outside the MCP tool;
- remove the separate investigation and verification MCP/CLI entries from the
  current package surface.

The original milestones below remain as historical execution context. Do not
treat their separate investigation/verification task entries as current product
requirements.

**Goal:** Complete `codex-cc-tools` as a Codex-facing MCP and CLI tool family that can ask Claude Code to run bounded tasks through provider profiles such as Anthropic and DeepSeek, returning structured results that Codex can use directly.

**Architecture:** Keep provider profiles and task contracts orthogonal. The
active product surface is `review` plus thin `delegate`; historical milestones
below describe earlier prerelease work and should not be treated as current
requirements when they mention separate investigation, verification, or
execution-space policy.

**Tech Stack:** TypeScript, Node.js 20+, Commander, MCP TypeScript SDK, Zod, Execa, Vitest, tsup, Claude Code subprocesses.

---

## Historical Baseline

- Current branch: `codex/provider-runner-foundation`
- Initial commit: `ff7de35 chore: initialize codex cc tools`
- Implemented during the original completion run:
  - `src/tasks/registry.ts`: task names and coarse safety labels.
  - `src/providers/*`: provider profiles, model aliases, environment isolation, and redaction.
  - `src/core/claude-runner.ts`: Claude Code subprocess runner, stream parser, and runner-managed process-tree timeout cleanup.
  - `src/tasks/review/*`: read-only review task, CLI `review`, and MCP `cc_review`.
  - DeepSeek has passed the current `review` quality gate; future tasks still need task-specific DeepSeek gates.
  - Tests for provider env, runner, review, CLI, MCP, and formatting.
- Removed after publication:
  - Separate investigation and command-verification task entries.

Source migration reference remains read-only unless a task explicitly says otherwise:

- Mature source: `D:\Codes\codex-cc-reviewer`
- Important branch: `codex/deepseek-cc-spike`
- Reusable areas: review schema, packet builder, git evidence routing, runner, streaming parser, MCP tool wrapper, progress reporting, formatting, token redaction, release checks.

Migration safety rule:

- Migration is copy-only from `D:\Codes\codex-cc-reviewer`.
- Allowed there: file reads, `git status`, `git log`, `git diff`, `git show`, and other read-only inspection commands.
- Forbidden there unless the maintainer explicitly authorizes it: `git checkout`, `git switch`, `git stash`, `git reset`, `git commit`, `git worktree add`, file edits, dependency installs that modify files, or any command that mutates worktree, index, refs, stash, or generated artifacts.

## Product Decision

This should remain a new repository and broader tool family, not a rename of `codex-cc-reviewer`.

The competitive landscape means the project should not become a generic Claude Code orchestrator:

- DeepSeek officially documents routing Claude Code with `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, model env vars, and `CLAUDE_CODE_SUBAGENT_MODEL`.
- Claude Code itself can run as an MCP server and can connect to stdio or HTTP MCP servers.
- Existing public wrappers include `@leo000001/claude-code-mcp`, `@steipete/claude-code-mcp`, `@kadreio/mcp-coding-agents`, and OmniCode / `@lgcyaxi/oh-my-claude`.

The durable niche for this repository is narrower:

- Codex-oriented task contracts.
- Structured, bounded outputs designed for Codex synthesis.
- Provider-profile isolation per invocation.
- Two active public task contracts: `review` for critique and `delegate` for
  autonomous work from one complete prompt. Execution-space and command policy
  are external Codex/user responsibilities, not MCP tool fields.
- Conservative migration from a proven review bridge.

External references checked on 2026-05-22:

- DeepSeek Claude Code integration: `https://api-docs.deepseek.com/zh-cn/quick_start/agent_integrations/claude_code`
- Claude Code MCP documentation: `https://code.claude.com/docs/en/mcp`
- OmniCode repository: `https://github.com/lgcyaxi/omni-code`
- npm packages: `@leo000001/claude-code-mcp`, `@steipete/claude-code-mcp`, `@kadreio/mcp-coding-agents`, `@lgcyaxi/oh-my-claude`

## Target Module Layout

This historical target layout has been superseded by the post-0.1.0 two-tool
surface. Current implementations should keep only the active `review` and
`delegate` task families.

```text
src/
  cli/
    doctor.ts
    review.ts
    delegate.ts
  core/
    claude-runner.ts
    command-log.ts
    output-contract.ts
    redaction.ts
    result-status.ts
    workspace-boundary.ts
  providers/
    registry.ts
    anthropic.ts
    deepseek.ts
    env.ts
  tasks/
    registry.ts
    review/
      schema.ts
      packet.ts
      format.ts
      tool.ts
    delegate/
      schema.ts
      packet.ts
      policy.ts
      tool.ts
  git/
    diff.ts
    status.ts
    summary.ts
    untracked.ts
  mcp/
    server.ts
    progress.ts
    tools.ts
  utils/
    exec.ts
    fs.ts
    truncate.ts
```

Keep files small. Prefer migrating coherent modules from `codex-cc-reviewer` and then renaming or extracting only where the new task/provider/execution-policy boundary requires it.

## Milestone 1: Foundation Hardening

**Outcome:** provider resolution, execution policy, redaction, and runner options are testable without invoking real Claude Code.

Common schema note: Claude Code effort values are `low`, `medium`, `high`, and `max` unless upstream Claude Code changes this contract.

**Files:**

- Modify: `src/providers/registry.ts`
- Create: `src/providers/deepseek.ts`
- Create: `src/providers/anthropic.ts`
- Create: `src/providers/env.ts`
- Create: `src/core/redaction.ts`
- Create: `src/core/result-status.ts`
- Create: `src/core/claude-runner.ts`
- Test: `tests/provider-env.test.ts`
- Test: `tests/claude-runner.test.ts`
- Test: `tests/redaction.test.ts`

- [x] Add provider profile schemas with `zod`: `anthropic`, `deepseek`.
- [x] Move DeepSeek constants out of `registry.ts` into `src/providers/deepseek.ts`.
- [x] Implement per-invocation environment construction.
- [x] For DeepSeek, prefer `DEEPSEEK_API_KEY`, then `OPENAI_API_KEY_DEEPSEEK`.
- [x] Inject DeepSeek values only into the Claude Code child process.
- [x] Remove inherited Anthropic, Bedrock, Vertex, and previous provider route variables before DeepSeek injection.
- [x] Cover the provider environment deny-list in tests, including `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_MODEL`, `ANTHROPIC_SMALL_FAST_MODEL`, `ANTHROPIC_DEFAULT_OPUS_MODEL`, `ANTHROPIC_DEFAULT_SONNET_MODEL`, `ANTHROPIC_DEFAULT_HAIKU_MODEL`, `CLAUDE_CODE_SUBAGENT_MODEL`, `CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_VERTEX`, common Bedrock `AWS_*` credentials, and common Vertex credentials such as `GOOGLE_APPLICATION_CREDENTIALS`.
- [x] Explicitly decide whether HTTPS proxy environment variables pass through; document that decision and test it.
- [x] Allow a DeepSeek base URL override only through an explicit HTTPS variable such as `DEEPSEEK_ANTHROPIC_BASE_URL`.
- [x] Centralize provider-token redaction for strings, arrays, and structured objects.
- [x] Redact provider tokens from nested error fields such as `error.message`, `cause.stack`, stderr tails, activity events, and structured outputs.
- [x] Migrate the complete stream event union, parser function signature, and happy-path parser implementation in this milestone so runner output shape is locked before the full review migration.
- [x] Add at least one reviewer stream fixture from `codex-cc-reviewer` and a fake-executor test that parses it end-to-end, including provider-token redaction through parsed activity and final output.
- [x] Add runner tests using fake executors; do not require a real `claude` binary.
- [x] Keep `anthropic` behavior pass-through and the initial review/provider-registry default. Later product direction changed `cc_delegate` to default to `deepseek`; see `AGENTS.md` and `docs/delegate-safety.md`.
- [x] Define the `anthropic` profile inheritance policy explicitly: either trust caller-provided Claude Code route variables and document that in `docs/security.md`, or clean selected route variables and test the cleaning. Do not leave this implicit.
- [x] Preserve and test model alias resolution for `opus`, `sonnet`, and `haiku` in both `anthropic` and `deepseek` profiles.

Verification:

```bash
npm run typecheck
npm test -- tests/provider-registry.test.ts tests/provider-env.test.ts tests/claude-runner.test.ts tests/redaction.test.ts
npm run build
```

Commit target:

```bash
git add src tests
git commit -m "feat: add provider-scoped claude runner foundation"
```

## Milestone 2: Migrate Stable `review`

**Outcome:** `cc_review` equivalent behavior exists in this repository with the new provider profile boundary.

Naming convention for this milestone:

- CLI command: `review`.
- MCP tool name: `cc_review`.
- Review task type strings such as `review_doc` and `review_diff` may remain inside the review schema for compatibility with the existing reviewer contract.

**Files:**

- Create: `src/tasks/review/schema.ts`
- Create: `src/tasks/review/packet.ts`
- Create: `src/tasks/review/format.ts`
- Create: `src/tasks/review/tool.ts`
- Create: `src/review` migration shims only if needed temporarily.
- Create: `src/git/*.ts`
- Create: `src/mcp/server.ts`
- Create: `src/mcp/progress.ts`
- Create: `src/mcp/tools.ts`
- Modify: `src/index.ts`
- Test: migrate reviewer tests for schema, packet, runner, MCP tools, formatting, streaming activity, cache analysis, git evidence routing, and CLI review.

- [x] Port review input and output schemas from `codex-cc-reviewer`.
- [x] Rename fields only when needed for cross-task consistency; otherwise preserve proven contracts.
- [x] Port packet construction and git evidence routing.
- [x] Preserve the read-only product contract: review prompts say not to edit files, MCP annotation uses read-only hints, and docs call out that runtime sandboxing is caller-managed.
- [x] Port Claude Code stream parser and activity tail handling.
- [x] Port progress reporting for MCP.
- [x] Expose `cc_review` from this package.
- [x] Add CLI command for local review smoke, with `--provider-profile`.
- [x] Run all deterministic migrated tests before any real provider smoke.

Verification:

```bash
npm run typecheck
npm test
npm run build
node dist/index.js --help
node dist/index.js doctor
```

Real smoke, when credentials and Claude Code are available:

```bash
node dist/index.js review --task review_doc --context "Smoke review only." --model haiku
```

DeepSeek in this milestone only needs deterministic schema and provider-env tests. Real DeepSeek quality and reliability are gated in Milestone 3.

Commit target:

```bash
git add src tests docs README.md
git commit -m "feat: migrate codex-facing review task"
```

## Milestone 3: DeepSeek Review Reliability Gate

**Outcome:** DeepSeek is promoted for the implemented `review` task after representative review runs prove it is reliable enough for documented use.

Current status on 2026-05-22: official DeepSeek Claude Code environment facts are recorded in `docs/research/deepseek-claude-code-env.md`; the maintainer approved paid real-provider runs; the gate passed on primary run `2026-05-21T20-58-36-695Z`. Anthropic baseline used the native Claude Code profile/auth state, so unset Anthropic environment variables were not a blocker by themselves.

**Files:**

- Modify: `docs/architecture.md`
- Modify: `docs/migration-from-reviewer.md`
- Create: `docs/research/deepseek-review-quality.md`
- Test: add or extend provider/runner/parser tests for DeepSeek-specific stream behavior.

- [x] Re-check official DeepSeek model identifiers before treating defaults as stable.
- [x] Record the verified DeepSeek Claude Code env matrix, source URL, and check date in `docs/research/deepseek-claude-code-env.md`.
- [x] Confirm whether visible `thinking` stream blocks appear in current Claude Code output. No visible thinking blocks were confirmed in the primary run artifacts.
- [x] Ensure thinking or provider-internal deltas are not blindly forwarded as review content. `tests/claude-runner.test.ts` covers `thinking_delta`.
- [x] Run A/B review on at least three representative diffs: small docs-only, medium TypeScript behavior change, and larger mixed diff.
- [x] Repeat each representative diff at least five times per provider profile, for a minimum of 15 DeepSeek runs and 15 baseline runs.
- [x] Compare Anthropic baseline and DeepSeek output for false positives, missed blocking findings, structured output validity, latency, and cost fields.
- [x] Use quantitative promotion thresholds:
  - Structured output parses successfully in at least 14 of 15 repeated DeepSeek runs.
  - Known blocking findings missed by the DeepSeek profile: 0 on the curated sample set and run count above.
  - Confirmed false-positive rate is not more than 25% worse than the Anthropic baseline on the curated sample set.
  - p95 latency is no more than 2.5x the Anthropic baseline for comparable packets, unless the docs explicitly keep DeepSeek experimental for latency.
- [x] Store sample identifiers, diff hashes, run timestamps, models, pass/fail results, raw log hashes, and accepted caveats in `docs/research/deepseek-review-quality.md`.
- [x] Keep `docs/research/deepseek-claude-code-env.md` for provider environment facts and `docs/research/deepseek-review-quality.md` for experiment results and promotion verdicts.
- [x] Document that Claude Code-reported cost/cache may not match DeepSeek billing.
- [x] Keep `providerProfile: "deepseek"` experimental until this gate passes. It is now promoted for `review`; future task types still need their own gates.
- [x] When the gate verdict changes, add a short AGENTS.md note with the verdict, key thresholds, and links to the research files.

Verification:

```bash
npm run typecheck
npm test
npm run build
git diff --check
```

Review checkpoint:

- [ ] Run `cc_review` on the research summary and final diff.
- [ ] Accept only findings with concrete evidence; record rejected review claims in the summary if they might confuse future agents.

Commit target:

```bash
git add docs src tests
git commit -m "docs: record deepseek review reliability gate"
```

## Archived Milestone 4: Add `research` Task

Superseded after `v0.1.0`: the separate public investigation task was removed.
Keep this section only as migration history; do not recreate these files from
this plan.

**Outcome:** Codex can ask Claude Code for bounded read-only repository investigation and receive structured findings without mixing that contract into review.

**Historical files:** this milestone previously introduced a separate task
directory, CLI command, MCP registration, and task-specific tests. Those files
were deleted when the public surface was collapsed to `review` and `delegate`.

- [x] Define input fields: `question`, `cwd`, `context`, `includeGitStatus`, `includeFiles`, `providerProfile`, `model`, `effort`, `maxContextChars`.
- [x] Define output fields: `status`, `answer`, `evidence`, `filesRead`, `commandsRun`, `missingContext`, `diagnostics`.
- [x] Make MCP annotations read-only.
- [x] Default tools to read/search only.
- [x] Keep the prompt focused on evidence and uncertainty; no edits.
- [x] Add fake-runner tests for successful output, missing context, and provider config failure.

Verification:

```bash
npm run typecheck
npm test -- tests/research-schema.test.ts tests/research-packet.test.ts tests/research-tool.test.ts tests/mcp-tools.test.ts tests/cli-research.test.ts
npm run build
```

Commit target:

```bash
git add src tests docs README.md
git commit -m "feat: add read-only research task"
```

## Archived Milestone 5: Add `verify` Task

Superseded after `v0.1.0`: the separate public command-verification task was
removed. `delegate` is now the autonomous work path for investigation,
implementation, and verification under one contract.

**Outcome:** Codex can ask Claude Code to reproduce, inspect, or run verification commands, with a command-execution contract distinct from read-only review and writable delegation.

**Historical files:** this milestone previously introduced a separate task
directory, CLI command, MCP registration, and task-specific tests. Those files
were deleted when command-backed work moved under the autonomous `delegate`
contract.

- [x] Define input fields: `hypothesis`, `commandsAllowed`, `cwd`, `context`, `providerProfile`, `model`, `effort`, `timeoutMs`.
- [x] Define output fields: `status`, `summary`, `commandsRun`, `evidence`, `reproduction`, `diagnostics`, `needsFollowup`.
- [x] Keep execution policy `command-exec`, not `workspace-write`.
- [x] Require Claude Code to report command intent and observed output summaries.
- [x] Document that command allowlists are advisory unless the caller sandbox enforces them; do not overclaim hard isolation.
- [x] Add parser tests for command logs and non-zero command outcomes.

Verification:

```bash
npm run typecheck
npm test -- tests/verify-schema.test.ts tests/verify-packet.test.ts tests/cli-verify.test.ts
npm run build
```

Commit target:

```bash
git add src tests docs README.md
git commit -m "feat: add command verification task"
```

## Milestone 6: Design and Implement Writable `delegate`

**Outcome:** Writable delegation has a separate task contract, destructive MCP annotations, workspace boundary checks, and structured handoff output.

**Files:**

- Create: `docs/delegate-safety.md`
- Create: `src/core/workspace-boundary.ts`
- Create: `src/tasks/delegate/schema.ts`
- Create: `src/tasks/delegate/packet.ts`
- Create: `src/tasks/delegate/policy.ts`
- Create: `src/tasks/delegate/tool.ts`
- Modify: `src/mcp/tools.ts`
- Modify: `src/cli/delegate.ts`
- Test: `tests/workspace-boundary.test.ts`
- Test: `tests/delegate-schema.test.ts`
- Test: `tests/delegate-policy.test.ts`
- Test: `tests/delegate-packet.test.ts`
- Test: `tests/cli-delegate.test.ts`

- [x] Write the safety design before implementation.
- [x] Make `delegate` opt-in and visibly destructive in MCP annotations.
- [x] Require explicit `cwd` and reject empty, root, home, or unresolved workspace paths.
- [x] Require caller-managed workspace isolation for real writable use, represented by a structured input field such as `isolation: { kind: "git-worktree" | "git-branch" | "container", evidence: Record<string, string> }`.
- [x] Treat isolation as untrusted until runtime verification succeeds. A sentence in `context` is never enough.
- [x] For `git-worktree`, verify the current repository/worktree metadata and ensure the writable root is not the primary source checkout when that can be determined.
- [x] For `git-branch`, verify the current branch is not `main` or `master` and require a clean or explicitly accepted dirty workspace before starting.
- [x] For `container`, require explicit evidence fields and document that the tool can only verify local signals available from inside the process.
- [x] Return `blocked` when isolation cannot be verified; do not merely report uncertainty.
- [x] Reject writes outside the resolved workspace after realpath resolution.
- [x] Add Windows-specific boundary tests for symlinks, junctions, `..`, drive roots, case folding, 8.3 short names when available, and UNC/network paths.
- [x] Forbid writes to `~`, `%USERPROFILE%`, drive roots, system directories, and `.git/` internals.
- [x] Forbid push, remote mutation, global git config changes, credential changes, and shell commands that target paths outside the workspace unless a future explicit maintainer-approved policy says otherwise.
- [x] Ensure timeout handling terminates the Claude Code subprocess tree, not just the parent process.
- [x] On Windows, implement process-tree termination with `taskkill /T /F /PID <pid>` or an equivalent tested library; do not rely on POSIX process-group semantics.
- [x] Define input fields: `task`, `cwd`, `context`, `acceptanceCriteria`, `allowedPaths`, `forbiddenPaths`, `commandsAllowed`, `providerProfile`, `model`, `effort`, `timeoutMs`.
- [x] Define output fields:
  - `status`: `succeeded`, `partial`, `needs_followup`, or `blocked`.
  - `summary`
  - `filesChanged`
  - `commandsRun`
  - `verification`
  - `risks`
  - `diagnostics`
- [x] Validate `allowedPaths` and `forbiddenPaths` against resolved workspace boundaries.
- [x] Capture git status before and after. Current implementation compares post-run observed/reported paths against the pre-run dirty snapshot and downgrades reports for pre-existing dirty files to `partial`.
- [x] Require final output to list touched files and verification evidence.
- [x] Add tests for path traversal, missing cwd, blocked workspace, no-op success, partial completion, and provider config failure.
- [x] When delegate safety policy is finalized or changed, add a short AGENTS.md note with the enforced isolation rule and link to `docs/delegate-safety.md`.
- [x] Run a real linked-worktree writable smoke for a simple no-shell file creation task and record evidence in `docs/research/delegate-writable-smoke.md`.

Verification:

```bash
npm run typecheck
npm test
npm run build
node dist/index.js delegate --help
git diff --check
```

Review checkpoint:

- [x] Run `cc_review` on the delegate safety doc before implementation.
- [x] Run `cc_review` on the final delegate diff.
- [x] Iterate until no accepted material safety findings remain.

Commit target:

```bash
git add src tests docs README.md
git commit -m "feat: add explicit writable delegate task"
```

## Milestone 7: Packaging, Installation, and Release

**Outcome:** The package can be installed, used as an MCP server, and smoke-tested locally without relying on repository internals.

**Files:**

- Modify: `package.json`
- Modify: `README.md`
- Create: `README.zh-CN.md`
- Create: `docs/installation.md`
- Create: `docs/tool-contract.md`
- Create: `docs/security.md`
- Create: `docs/troubleshooting.md`
- Create: `docs/prior-art.md`
- Create: `examples/codex-config.md`
- Create: `examples/mcp-config.json`
- Create: `scripts/release-smoke.mjs`
- Test: `tests/release-assurance.test.ts`

- [x] Add MCP server entry command.
- [x] Add local install instructions for Codex and Claude Code.
- [x] Document provider profile env vars and secret redaction behavior.
- [x] Document each tool contract separately.
- [x] Document prior art and why this package is Codex-contract focused.
- [x] In `docs/prior-art.md`, include source URLs and an "as checked on" date for every compared package.
- [x] Before publishing, run `npm view` checks for the package name and the compared public package names to catch naming or ecosystem changes.
- [x] Add `npm pack --dry-run --json` to release verification.
- [x] Add smoke checks for `--version`, `--help`, `doctor`, and MCP tool registration.
- [x] Run `cc_review` on the release diff and `npm pack --dry-run --json` output before any publish.
- [x] Archive the release review conclusion and pack/build evidence under `docs/release/<version>-review.md`.
- [x] If release review finds accepted issues, rebuild, rerun deterministic checks, rerun pack dry-run, and update the release review archive before asking for approval.
- [x] Do not run `npm publish` without explicit maintainer approval in the current conversation.

Verification:

```bash
npm run typecheck
npm test
npm run build
npm pack --dry-run --json
node dist/index.js --version
node dist/index.js --help
node dist/index.js doctor
git diff --check
```

Commit target:

```bash
git add .
git commit -m "chore: prepare package release workflow"
```

## Milestone 8: Final Acceptance

The repository reaches the original goal when all of these are true:

- [x] `review` is stable and at least as usable as `codex-cc-reviewer` for Codex review loops.
- [x] `deepseek` works as a provider profile without changing global shell configuration.
- [x] Provider secrets are never intentionally returned in output, diagnostics, progress events, or formatted text.
- [x] Superseded after `v0.1.0`: separate investigation and command-verification task contracts were removed from the active public surface.
- [x] `delegate` has explicit destructive annotations, documented safety limits, workspace-boundary checks, and structured results.
- [x] CLI and MCP surfaces expose the same task/provider concepts.
- [x] Docs explain when to use this package versus generic Claude Code MCP wrappers.
- [x] Full deterministic checks pass.
- [x] At least one real `cc_review` smoke passes on Anthropic profile or inherited default Claude Code setup.
- [x] At least one real DeepSeek smoke either passes or DeepSeek remains clearly documented as experimental with current failure evidence.

Final acceptance status on 2026-05-22: complete up to the publish approval gate. Latest deterministic verification passed with `npm run typecheck`, `npm test` (33 files / 158 tests), `npm run release:smoke`, CLI `--version` / `--help` / `doctor`, `npm pack --dry-run --json`, and `git diff --check` with only CRLF warnings. Real Anthropic/inherited Claude Code smoke passed through the CLI `review` command, and DeepSeek has the recorded `review` reliability gate in `docs/research/deepseek-review-quality.md`. `npm publish` has not been run and remains a maintainer approval step; a POSIX tarball install smoke is still recommended before public publish because this Windows environment cannot verify npm bin executable bits.

Final verification:

```bash
npm run typecheck
npm test
npm run build
npm pack --dry-run --json
node dist/index.js --version
node dist/index.js --help
node dist/index.js doctor
git diff --check
```

## Long-Running Goal Automation Prompt

Use this prompt when starting an unattended execution phase with the `goal` tool:

```text
Work in D:\Codes\codex-cc-tools and continue from docs/superpowers/plans/2026-05-22-long-term-completion.md.

Constraints:
- Read AGENTS.md first, then this plan and the linked architecture/migration docs.
- Do not modify D:\Codes\codex-cc-reviewer unless the user explicitly authorizes it. Read-only migration reference is allowed.
- Use TDD. For behavior changes, write or migrate tests before implementation.
- For complex stages, use the Codex + cc_review convergence workflow: summarize/plan, review with cc_review, accept only substantiated findings, implement, then review the final diff.
- Keep the active public surface focused on `review` and `delegate`; do not recreate the removed separate investigation or command-verification tools.
- After each completed phase, update AGENTS.md or a document indexed from it with completion quality, remaining risks, and next steps.
- Communicate with the maintainer in Chinese.
- Stop and report instead of continuing if the same test or command fails twice with the same root cause, if a step would require mutating D:\Codes\codex-cc-reviewer, if credentials are missing for a real provider smoke, or if a destructive command outside D:\Codes\codex-cc-tools appears necessary.

Priority for this execution phase:
Start with Milestone 1 and complete the provider-scoped Claude runner foundation, including DeepSeek per-invocation environment construction, provider secret redaction, fake-runner tests, and deterministic verification.

Completion criteria:
- Relevant tests are written or migrated first, then made green.
- `npm run typecheck`, relevant `npm test`, and `npm run build` pass.
- Documentation matches the code state.
- Final report is in Chinese and covers what changed, quality, gaps, and next steps.
```

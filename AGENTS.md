# Repository Agent Instructions

This repository is the future home for Codex-facing Claude Code tools.

## Language

When communicating with the maintainer, use Chinese for explanations, progress reports, reviews, and final summaries.

## Product Boundary

`codex-cc-tools` is a larger tool family, not a rename of `codex-cc-reviewer`.

- Provider profiles describe which backend drives Claude Code: `anthropic`, `deepseek`, `ark_coding_plan`, and future compatible providers.
- Tasks describe what Codex asks Claude Code to do: `review` and `delegate`.
- Execution policy describes MCP metadata only: `review` is read-only; `delegate` is destructive because it asks Claude Code to work. Execution-space policy is outside this MCP tool.

Keep `review` usable as the stable first task. Treat `delegate` as a thin Claude Code execution bridge: Codex supplies a complete prompt, Claude Code runs it, and the result returns to Codex.

## Current Source Relationship

`D:\Codes\codex-cc-reviewer` remains the mature source for the existing review bridge. Its `codex/deepseek-cc-spike` branch contains the DeepSeek provider-profile experiment that should inform this repository.

Do not silently change that repository while working here.

## Documentation

- `docs/architecture.md` is the main architecture reference.
- `docs/migration-from-reviewer.md` records how this repository should reuse or migrate the reviewer code.
- `docs/security.md` records provider environment inheritance, DeepSeek / Ark Coding Plan child-process routing, and provider-token redaction boundaries.
- `docs/delegate-safety.md` records the active `delegate` boundary. The filename is historical; the current contract is a thin Claude Code bridge, not execution-space management.
- `docs/research/delegate-writable-smoke.md` records historical writable `delegate` smoke runs from the superseded safety-heavy CLI.
- `docs/research/deepseek-claude-code-env.md` records the latest checked DeepSeek Claude Code environment matrix.
- `docs/research/deepseek-review-quality.md` records the DeepSeek quality gate status.
- `docs/research/deepseek-routing-smoke.md` records route-specific DeepSeek smoke evidence and the backend-monitoring caveat.
- `docs/superpowers/plans/` stores implementation plans for longer work.
- `docs/superpowers/plans/2026-05-22-long-term-completion.md` is the current long-term completion plan for the full tool family.
- `docs/superpowers/plans/2026-05-22-install-doctor-docs-maturity.md` is the active plan for install/uninstall commands, meaningful doctor diagnostics, and public maturity docs/examples.
- `docs/superpowers/plans/2026-05-22-delegate-implementation.md` is the historical reviewed-safety `delegate` implementation plan; it is superseded by the thin delegate contract.

Update these documents when structure, API boundaries, or migration assumptions change.

## Development

Use TDD for behavior-bearing code. Keep early phases small: first establish the registry, provider model, CLI, and docs; then migrate `review`; only then implement writable `delegate`.

## Current Progress

- Milestone 1 provider-scoped runner foundation is complete on branch `codex/provider-runner-foundation`: provider env construction, DeepSeek child-process routing, Anthropic inheritance policy, provider-token redaction, stream parser happy path, and fake-runner tests are implemented.
- Milestone 2 read-only `review` migration is complete and committed as `45ee54f feat: migrate codex-facing review task`: review schema, packet builder, git evidence routing, untracked-file routing, Claude Code runner integration, CLI `review`, MCP `cc_review`, progress reporting, and formatting tests are present.
- Milestone 3 DeepSeek review reliability gate is complete: primary run `2026-05-21T20-58-36-695Z` produced 15 Anthropic baseline and 15 DeepSeek runs, with 15/15 DeepSeek structured outputs, 0 missed known findings, 0 confirmed false positives on the curated set, and p95 latency ratio 1.403 versus Anthropic. `providerProfile: "deepseek"` is promoted from experimental for the implemented `review` task; future task types still need their own gates. Results are recorded in `docs/research/deepseek-review-quality.md`.
- Follow-up architectural note: `src/providers/registry.ts` currently exposes a provider-level `experimental` flag. Before expanding DeepSeek guarantees beyond `review`, add task-scoped gate metadata or equivalent documentation so the review gate is not misread as coverage for writable delegation. Real-world review monitoring should also be added after more organic workloads exist.
- Historical note: separate read-only investigation and command-verification tasks were implemented during prerelease development, but were later removed from the active public surface because the maintainer prefers one autonomous `delegate` path for high-intelligence task execution.
- Milestone 6 historical note: `delegate` was first implemented as a safety-heavy writable task with isolation, path, and command policy checks. That design has been superseded. The active maintainer requirement is a thin Claude Code bridge: `cc_delegate` accepts a complete prompt and optional process/model settings, does not manage execution spaces, does not require `acceptanceCriteria` or `context`, and does not enforce path/command/isolation policy.
- Current `delegate` authority note: because the active goal is autonomous execution rather than interactive approval, `cc_delegate` invokes Claude Code with `bypassPermissions`. The caller must choose an appropriate working directory, worktree, container, or OS-level boundary before invoking the tool.
- Product direction update on 2026-05-22: after the first stable publication, the maintainer decided `research` and `verify` are unnecessary public tools because they only split authority levels; the project goal is to trust high-intelligence agents for autonomous work. The active public surface is now `cc_review` plus `cc_delegate`. Historical milestone notes for `research` and `verify` remain as migration history, not current product requirements.
- Milestone 7 packaging and release preparation is complete: package bins include CLI and dedicated MCP server entries, install/tool-contract/troubleshooting/prior-art docs and examples are present, `release:smoke` builds then checks CLI basics, MCP registrations, annotations, handlers, and `npm pack --dry-run --json`, and release review evidence is archived under `docs/release/`.
- Milestone 8 final acceptance and initial stable publication is complete: `0.1.0-beta.1` was published to npm `next`, then `v0.1.0` was promoted to npm `latest` through GitHub Actions Trusted Publishing on 2026-05-22. Deterministic checks passed, real Anthropic/inherited Claude Code smoke ran, DeepSeek CLI smoke passed via `OPENAI_API_KEY_DEEPSEEK`, and DeepSeek review reliability is documented as passed for the implemented `review` task.
- DeepSeek routing follow-up on 2026-05-22 found that this local environment uses `OPENAI_API_KEY_DEEPSEEK` rather than `DEEPSEEK_API_KEY`. Positive and negative routing smokes support that the Claude Code child process honors the injected DeepSeek route, but historical quality-gate artifacts did not record route host or token source. Task diagnostics now include a non-secret DeepSeek route line for future backend-monitoring reconciliation.
- Release publishing follows the reviewer package pattern: GitHub Actions release workflow publishes version tags through npm Trusted Publishing. Tags containing a prerelease suffix publish to npm `next` from branch `next`; stable tags publish to `latest` from `main` and require `.release-validation/v<version>.md`.
- Public-user docs were expanded after `v0.1.0` to clarify required runtime inputs: default `anthropic` uses native Claude Code auth and does not require `ANTHROPIC_AUTH_TOKEN` or `ANTHROPIC_API_KEY`; `deepseek` requires `DEEPSEEK_API_KEY` or `OPENAI_API_KEY_DEEPSEEK`; `ark_coding_plan` requires `ARK_API_KEY` or `VOLCENGINE_API_KEY` when explicitly selected.
- Current delegate default: `cc_delegate` defaults to `providerProfile: "deepseek"` and is described as an autonomous delegated-subtask tool, usable for read-only investigation or writable implementation when the prompt states the intended scope. `cc_review` continues to default to `anthropic`.
- Maintainer intent for `cc_delegate`: treat it as a low-cost DeepSeek V4 Pro worker for independent subtasks, not as a rare high-risk-only tool. Actively consider delegating local, lower-coupling work; multiple `cc_delegate` calls may run in parallel when their write scopes do not overlap or when they are read-only. Record observed model collaboration quality in project/global memory while distinguishing maintainer intent from later AI observations.
- 2026-05-22 maturity work is complete: installer/uninstaller config management for `codex_cc_tools`, actionable doctor diagnostics, public maturity docs/files, package file checks, and release smoke updates are implemented. The execution plan and completion note are in `docs/superpowers/plans/2026-05-22-install-doctor-docs-maturity.md`.
- Model collaboration note from the 2026-05-22 maturity work: `cc_delegate` was useful for bounded documentation generation across root docs, `docs/`, and `examples/` when given a tight write scope. `cc_review` caught several real correctness issues in config mutation and packaging/doc drift, including TOML subtable scoping, uninstall no-op behavior, comment preservation, and preserving existing npx/global launch choices. Its findings still need technical filtering: one high-severity claim about duplicate `enabled_tools` in subtables overstated TOML corruption risk, but it led to a conservative regression test.
- 2026-05-28 provider update: `ark_coding_plan` is implemented as an explicit experimental provider profile. It reads `ARK_API_KEY` first, then `VOLCENGINE_API_KEY`, injects the Ark Coding Plan Anthropic-compatible Claude Code endpoint `https://ark.cn-beijing.volces.com/api/coding`, maps `opus` / `sonnet` / `haiku` and `Doubao-Seed-2.0-pro` to `doubao-seed-2.0-pro`, and leaves `cc_delegate` defaulting to `deepseek`. The OpenAI-compatible endpoint `https://ark.cn-beijing.volces.com/api/coding/v3` is documented as not being the default for this Claude Code route.
- 2026-05-29 review tool policy update: `cc_review` no longer injects `tools: ["default"]` for any provider profile. When `tools` is omitted or empty, the Claude Code subprocess receives no `--allowedTools` flag; explicit `tools` values are still forwarded as the caller-specified allowlist.
- 2026-05-29 Anthropic Opus update: local smoke showed Claude Code `--model opus --effort max` still resolved to `claude-opus-4-7`, while explicit `--model claude-opus-4-8 --effort max` succeeded. The `anthropic` provider profile now resolves `model: "opus"` to `claude-opus-4-8`; other Anthropic model names pass through.

Standard local checks:

```bash
npm run typecheck
npm test
npm run build
node dist/index.js --version
node dist/index.js --help
```

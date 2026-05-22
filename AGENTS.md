# Repository Agent Instructions

This repository is the future home for Codex-facing Claude Code tools.

## Language

When communicating with the maintainer, use Chinese for explanations, progress reports, reviews, and final summaries.

## Product Boundary

`codex-cc-tools` is a larger tool family, not a rename of `codex-cc-reviewer`.

- Provider profiles describe which backend drives Claude Code: `anthropic`, `deepseek`, and future compatible providers.
- Tasks describe what Codex asks Claude Code to do: `review`, `delegate`, `verify`, and `research`.
- Execution policy describes how much local authority a task gets: `readonly`, `command-exec`, or `workspace-write`.

Keep `review` usable as the stable first task. Treat `delegate` as a separate writable task with explicit safety controls.

## Current Source Relationship

`D:\Codes\codex-cc-reviewer` remains the mature source for the existing review bridge. Its `codex/deepseek-cc-spike` branch contains the DeepSeek provider-profile experiment that should inform this repository.

Do not silently change that repository while working here.

## Documentation

- `docs/architecture.md` is the main architecture reference.
- `docs/migration-from-reviewer.md` records how this repository should reuse or migrate the reviewer code.
- `docs/security.md` records provider environment inheritance, DeepSeek child-process routing, and provider-token redaction boundaries.
- `docs/delegate-safety.md` records the writable `delegate` safety contract and current implementation expectations.
- `docs/research/delegate-writable-smoke.md` records real writable `delegate` smoke runs.
- `docs/research/deepseek-claude-code-env.md` records the latest checked DeepSeek Claude Code environment matrix.
- `docs/research/deepseek-review-quality.md` records the DeepSeek quality gate status.
- `docs/research/deepseek-routing-smoke.md` records route-specific DeepSeek smoke evidence and the backend-monitoring caveat.
- `docs/superpowers/plans/` stores implementation plans for longer work.
- `docs/superpowers/plans/2026-05-22-long-term-completion.md` is the current long-term completion plan for the full tool family.
- `docs/superpowers/plans/2026-05-22-delegate-implementation.md` is the reviewed-safety `delegate` implementation plan.

Update these documents when structure, API boundaries, or migration assumptions change.

## Development

Use TDD for behavior-bearing code. Keep early phases small: first establish the registry, provider model, CLI, and docs; then migrate `review`; only then implement writable `delegate`.

## Current Progress

- Milestone 1 provider-scoped runner foundation is complete on branch `codex/provider-runner-foundation`: provider env construction, DeepSeek child-process routing, Anthropic inheritance policy, provider-token redaction, stream parser happy path, and fake-runner tests are implemented.
- Milestone 2 read-only `review` migration is complete and committed as `45ee54f feat: migrate codex-facing review task`: review schema, packet builder, git evidence routing, untracked-file routing, Claude Code runner integration, CLI `review`, MCP `cc_review`, progress reporting, and formatting tests are present.
- Milestone 3 DeepSeek review reliability gate is complete: primary run `2026-05-21T20-58-36-695Z` produced 15 Anthropic baseline and 15 DeepSeek runs, with 15/15 DeepSeek structured outputs, 0 missed known findings, 0 confirmed false positives on the curated set, and p95 latency ratio 1.403 versus Anthropic. `providerProfile: "deepseek"` is promoted from experimental for the implemented `review` task; future task types still need their own gates. Results are recorded in `docs/research/deepseek-review-quality.md`.
- Follow-up architectural note: `src/providers/registry.ts` currently exposes a provider-level `experimental` flag. Before adding `research`, `verify`, or `delegate` DeepSeek guarantees, add task-scoped gate metadata or equivalent documentation so the review gate is not misread as coverage for all future tasks. Real-world review monitoring should also be added after more organic workloads exist.
- Milestone 4 read-only `research` task implementation is complete and committed as `5dea604 feat: add read-only research task`: schema, packet builder, runner adapter, CLI `research`, MCP `cc_research`, formatting, and deterministic tests are present. Full typecheck/test/build/CLI verification passed, `cc_review` found no remaining material blockers, and included-file reads use realpath workspace boundary checks.
- Milestone 5 command-exec `verify` task implementation is complete: schema, packet builder, runner adapter, CLI `verify`, MCP `cc_verify`, formatting, and deterministic tests are present. `cc_review` found no remaining material blockers after fixes for result-side redaction and command allowlist tightening; direct follow-up inspection confirmed secret redaction, command allowlist validation, malformed-output blocking, non-zero command outcomes, and provider configuration failure coverage. `verify` is not a writable task; it requires explicit `commandsAllowed`, forbids wildcard first command tokens, warns against embedding credentials in allowed command strings, and keeps workspace writes out of scope.
- Milestone 6 writable `delegate` implementation is complete for the current scope: workspace-boundary helpers, delegate schema, safety policy, packet builder, runner adapter, formatter, CLI `delegate`, and MCP `cc_delegate` are implemented with deterministic tests. The runner requires runtime isolation signals, blocks unsafe cwd/branch/command cases, rejects glob, shell-home/env-var, or out-of-workspace path policy entries, uses destructive MCP metadata, compares post-run observed/reported changed paths against the pre-run dirty snapshot with runtime realpath checks, rejects reported commands outside `commandsAllowed`, and uses runner-managed process-tree timeout cleanup. A real linked-worktree writable smoke passed on 2026-05-22 with Anthropic `haiku`; evidence is in `docs/research/delegate-writable-smoke.md`.
- Milestone 7 packaging and release preparation is complete up to the publish approval gate: package bins include CLI and dedicated MCP server entries, install/tool-contract/troubleshooting/prior-art docs and examples are present, `release:smoke` builds then checks CLI basics, MCP registrations, annotations, handlers, and `npm pack --dry-run --json`, and release review evidence is archived in `docs/release/0.0.0-review.md`. `npm publish` has not been run and still requires explicit maintainer approval.
- Milestone 8 final acceptance is complete up to the publish approval gate: deterministic checks pass, real Anthropic/inherited Claude Code review smoke has run, DeepSeek review reliability is documented as passed for the implemented `review` task, and the remaining non-code gates are maintainer approval for `npm publish` plus an optional POSIX tarball install smoke before public release.
- DeepSeek routing follow-up on 2026-05-22 found that this local environment uses `OPENAI_API_KEY_DEEPSEEK` rather than `DEEPSEEK_API_KEY`. Positive and negative routing smokes support that the Claude Code child process honors the injected DeepSeek route, but historical quality-gate artifacts did not record route host or token source. Task diagnostics now include a non-secret DeepSeek route line for future backend-monitoring reconciliation.
- Release publishing now follows the reviewer package pattern: GitHub Actions release workflow publishes version tags through npm Trusted Publishing. Tags containing a prerelease suffix publish to npm `next` from branch `next`; stable tags publish to `latest` from `main` and require `.release-validation/v<version>.md`.

Standard local checks:

```bash
npm run typecheck
npm test
npm run build
node dist/index.js --version
node dist/index.js --help
```

# Install, Doctor, and Project Maturity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `codex-cc-tools` up to the mature user-experience baseline of `codex-cc-reviewer` for installation automation, diagnostics, and public project documentation.

**Status:** Completed on 2026-05-22. Implemented install/uninstall config management, actionable doctor diagnostics, maturity docs/examples, package surface checks, and release smoke updates. Final verification passed with `npm run typecheck`, `npm test`, `npm run build`, CLI smoke, `doctor`, and `release-smoke`.

**Architecture:** Keep the current `codex-cc-tools` provider/task architecture. Add a focused Codex config module for TOML block management, thin CLI command modules for install/uninstall/doctor, and documentation/examples that describe both `cc_review` and `cc_delegate`.

**Tech Stack:** TypeScript, Commander, Vitest, Node.js standard library, `execa`, existing MCP/CLI package structure.

---

## Persistent Goal Prompt

Continue work in `D:\Codes\codex-cc-tools` until these three workstreams are complete:

1. Add install/uninstall commands and Codex MCP config management. The generated config must enable both `cc_review` and `cc_delegate`, and support either `npx -y codex-cc-tools@<spec> mcp` or the global `codex-cc-tools-mcp` binary.
2. Replace the trivial doctor command with diagnostics for Node, npm, optional Codex CLI, Claude Code CLI/version, Claude Code daemon roster, Claude Code background jobs, Codex config presence, MCP registration, registered tasks/providers, and DeepSeek env readiness.
3. Add project maturity files and user-facing docs: `CHANGELOG.md`, `CHANGELOG.zh-CN.md`, `SECURITY.md`, `CONTRIBUTING.md`, `LICENSE`, `docs/codex-usage.md`, and richer `examples/` guidance for downstream Codex usage.

Use TDD for behavior-bearing code. Preserve existing architecture. Do not modify `D:\Codes\codex-cc-reviewer`; only use it as read-only reference. Communicate with the maintainer in Chinese.

## Design Summary

Recommended approach: selectively port mature reviewer concepts, not reviewer internals wholesale.

- Config management should be a new `src/config/codex.ts`, adapted from reviewer naming to `codex_cc_tools`, two tools, and two launch modes.
- Reinstall must not silently discard user customizations. The implementation should preserve existing scalar settings and comments where possible, and only update the command/args/enabled-tools fields it owns. If an unsafe overwrite becomes necessary later, it must require an explicit force-style option.
- Config file writes must be atomic: write a same-directory temporary file, then rename it into place.
- CLI commands should live in `src/cli/install.ts`, `src/cli/uninstall.ts`, and `src/cli/doctor.ts`; `src/index.ts` should only register commands and dependency injection hooks.
- Utility helpers should be minimal and local: command checks, safe text-file read/write, line output.
- Doctor should be useful but CI-safe: missing Codex CLI, Claude CLI, Codex config, MCP registration, or DeepSeek env should be reported clearly, but the default `doctor` command should exit 0. Add `--strict` so required `error` findings can return non-zero for humans or dedicated checks. Release smoke should invoke non-strict doctor and inspect output rather than requiring a fully configured local machine.
- Docs should be package-level user docs, not internal development notes. They must explain `cc_review` and `cc_delegate` together, including the advisory nature of Claude output and the caller-managed execution boundary for delegation.

## Plan Review Revisions

`cc_review` reviewed the initial plan on 2026-05-22. Accepted revisions:

- Add `--config-path <path>` for home or project-local Codex config installation.
- Default npx package spec should be `codex-cc-tools@latest`, matching README and installation docs.
- Support `--global-binary` and parse global-binary registrations separately from npx registrations.
- Support `--no-enabled-tools` for older Codex builds that cannot parse `enabled_tools`.
- `normalizePackageSpec` must allow `codex-cc-tools@tag/version`, `file:`, `https:`, `github:`, and local `.tgz` paths while rejecting control characters, quotes, and backslashes.
- Doctor should show both internal tasks (`review`, `delegate`) and MCP tool names (`cc_review`, `cc_delegate`).
- Doctor should warn when both `DEEPSEEK_API_KEY` and `OPENAI_API_KEY_DEEPSEEK` are present with different values, and state which one wins.
- Tests must update the existing `tests/cli.test.ts` doctor assertions rather than only adding new tests.
- Release smoke and release-assurance checks must extend existing file checks, not replace them.
- Maturity docs must include actionable `SECURITY.md` reporting guidance. Use `Copyright (c) 2026 yiyuiii`, matching the mature reviewer repository license.
- `CHANGELOG.md` / `CHANGELOG.zh-CN.md` should include at least the current release history visible under `docs/release/`.
- `prepublishOnly` is only a local-publish safety net; GitHub Trusted Publishing still uses `npm publish --ignore-scripts --provenance` and relies on `verify:release`.

## File Structure

- Create `src/config/codex.ts`: build, install, uninstall, detect, and parse `codex_cc_tools` MCP config blocks.
- Create `src/cli/install.ts`: implement `codex-cc-tools install`.
- Create `src/cli/uninstall.ts`: implement `codex-cc-tools uninstall`.
- Create `src/cli/doctor.ts`: collect and print diagnostics.
- Create `src/utils/exec.ts`, `src/utils/fs.ts`, `src/utils/logger.ts`: small utilities used by CLI modules.
- Modify `src/index.ts`: register new commands, wire dependencies, keep existing review/delegate/mcp commands.
- Create tests: `tests/codex-config.test.ts`, `tests/doctor.test.ts`, and extend `tests/cli.test.ts` / `tests/release-assurance.test.ts`.
- Create docs/files: `CHANGELOG.md`, `CHANGELOG.zh-CN.md`, `SECURITY.md`, `CONTRIBUTING.md`, `LICENSE`, `docs/codex-usage.md`, `examples/AGENTS.md`, `examples/codex-global-prompt.md`, `examples/codex-synthesis.md`.
- Modify docs/package surfaces: `README.md`, `README.zh-CN.md`, `docs/installation.md`, `docs/troubleshooting.md`, `package.json`, `scripts/release-smoke.mjs`, `AGENTS.md`.

## Task 1: Codex Config Management and Install/Uninstall CLI

**Files:**
- Create: `src/config/codex.ts`
- Create: `src/cli/install.ts`
- Create: `src/cli/uninstall.ts`
- Create: `src/utils/fs.ts`
- Create: `src/utils/logger.ts`
- Test: `tests/codex-config.test.ts`
- Modify: `src/index.ts`
- Modify: `tests/cli.test.ts`

- [ ] **Step 1: Write failing config tests**

Add tests that prove:

- default config block uses server name `codex_cc_tools`
- default package spec is `codex-cc-tools@latest`
- npx mode generates `args = ["-y", "codex-cc-tools@latest", "mcp"]`
- binary mode generates `command = "codex-cc-tools-mcp"` and `args = []`
- enabled tools are `["cc_review", "cc_delegate"]`
- install updates an existing `codex_cc_tools` block without disturbing other tables, comments, or user-customized scalar fields such as `tool_timeout_sec`
- uninstall removes only the `codex_cc_tools` block
- invalid package specs and invalid launch modes are rejected
- registration parsing distinguishes npx and global-binary mode
- `--no-enabled-tools` omits `enabled_tools`

Run: `npm test -- tests/codex-config.test.ts`
Expected before implementation: FAIL because `src/config/codex.ts` does not exist.

- [ ] **Step 2: Implement config module**

Implement pure text functions first:

```ts
export const CODEX_CC_TOOLS_SERVER_NAME = "codex_cc_tools";
export const DEFAULT_CODEX_CC_TOOLS_PACKAGE_SPEC = "codex-cc-tools@latest";
export type CodexConfigLaunchMode = "npx" | "global";

export function buildCodexCcToolsConfigBlock(options?: {
  packageSpec?: string;
  launchMode?: CodexConfigLaunchMode;
}): string;

export function installCodexCcToolsConfigText(existing: string, options?: {
  packageSpec?: string;
  launchMode?: CodexConfigLaunchMode;
}): string;

export function uninstallCodexCcToolsConfigText(existing: string): string;
export function hasCodexCcToolsConfig(existing: string): boolean;
export function getConfiguredCodexCcToolsRegistration(existing: string):
  | { mode: "npx"; packageSpec: string }
  | { mode: "global"; command: "codex-cc-tools-mcp" }
  | undefined;
export function normalizePackageSpec(packageSpec?: string): string;
```

Then add file I/O wrappers using `readTextIfExists()` and `writeTextFile()`.

- [ ] **Step 3: Verify config tests pass**

Run: `npm test -- tests/codex-config.test.ts`
Expected after implementation: PASS.

- [ ] **Step 4: Write failing CLI tests**

Extend `tests/cli.test.ts` so `createProgram()` can inject install/uninstall runners and parse:

```bash
codex-cc-tools install --package-spec codex-cc-tools@next
codex-cc-tools install --global-binary
codex-cc-tools uninstall
```

Expected before CLI implementation: FAIL because commands/deps do not exist.

- [ ] **Step 5: Implement install/uninstall commands**

`install` should accept:

- `--package-spec <spec>` for npx launch mode
- `--global-binary` to generate a `codex-cc-tools-mcp` config block
- `--config-path <path>` to target a project-local or non-default Codex config
- `--no-enabled-tools` to omit `enabled_tools` for older Codex clients

`uninstall` should remove the config block.

- [ ] **Step 6: Verify CLI install/uninstall tests pass**

Run: `npm test -- tests/cli.test.ts tests/codex-config.test.ts`
Expected: PASS.

## Task 2: Doctor Diagnostics

**Files:**
- Create: `src/cli/doctor.ts`
- Create: `src/utils/exec.ts`
- Modify: `src/index.ts`
- Test: `tests/doctor.test.ts`
- Modify: `tests/cli.test.ts`

- [ ] **Step 1: Write failing doctor tests**

Add tests for pure diagnostic helpers:

- optional Codex CLI failure is `warn`, not fatal
- missing Claude Code CLI is `error`
- supported Claude Code version is `ok`
- below validated Claude Code version is `warn`
- unparsable daemon roster is `warn`
- daemon worker version mismatch is `warn`
- blocked Claude Code background jobs are `warn`
- missing config block is `error`
- missing DeepSeek env is `warn`, not fatal
- two different DeepSeek key variables produce a `warn` that explains `DEEPSEEK_API_KEY` wins
- `shouldDoctorFail()` only returns true for `error`

Run: `npm test -- tests/doctor.test.ts`
Expected before implementation: FAIL.

- [ ] **Step 2: Implement doctor module**

Follow reviewer's proven structure, adapted for `codex-cc-tools`:

```ts
export interface DoctorResult {
  name: string;
  ok: boolean;
  level: "ok" | "warn" | "error";
  detail: string;
}

export async function collectDoctorResults(): Promise<DoctorResult[]>;
export async function runDoctor(): Promise<DoctorResult[]>;
export function shouldDoctorFail(results: DoctorResult[]): boolean;
```

Include registry visibility:

- `Tasks`: `review, delegate`
- `Providers`: `anthropic, deepseek`
- `MCP tool names`: `cc_review, cc_delegate`

Include DeepSeek env readiness:

- `ok` if `DEEPSEEK_API_KEY` or `OPENAI_API_KEY_DEEPSEEK` exists
- `warn` otherwise, with detail that `cc_delegate` defaults to DeepSeek

The CLI command should support `--strict`; default doctor prints errors and warnings but exits 0 for CI/package smoke portability. Strict mode exits non-zero when `shouldDoctorFail(results)` is true.

- [ ] **Step 3: Wire doctor command through dependency injection**

`src/index.ts` should import `runDoctor`, add it to `CreateProgramDeps`, and call it from `.command("doctor")`.

- [ ] **Step 4: Verify doctor tests and CLI smoke pass**

Run: `npm test -- tests/doctor.test.ts tests/cli.test.ts`
Expected: PASS.

## Task 3: Project Maturity Files and User Docs

**Files:**
- Create: `CHANGELOG.md`
- Create: `CHANGELOG.zh-CN.md`
- Create: `SECURITY.md`
- Create: `CONTRIBUTING.md`
- Create: `LICENSE`
- Create: `docs/codex-usage.md`
- Create: `examples/AGENTS.md`
- Create: `examples/codex-global-prompt.md`
- Create: `examples/codex-synthesis.md`
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `docs/installation.md`
- Modify: `docs/troubleshooting.md`
- Modify: `package.json`
- Modify: `scripts/release-smoke.mjs`
- Modify: `tests/release-assurance.test.ts`
- Modify: `AGENTS.md`

- [ ] **Step 1: Write failing release assurance tests**

Extend `tests/release-assurance.test.ts` to assert:

- root files exist: `CHANGELOG.md`, `CHANGELOG.zh-CN.md`, `SECURITY.md`, `CONTRIBUTING.md`, `LICENSE`
- `docs/codex-usage.md` exists
- examples exist: `examples/AGENTS.md`, `examples/codex-global-prompt.md`, `examples/codex-synthesis.md`
- package `files` includes root maturity files
- `prepublishOnly` exists and runs typecheck, tests, build
- release smoke required files include new docs/examples
- `README.md`, `README.zh-CN.md`, and `docs/installation.md` mention `codex-cc-tools install`
- existing release checks for `examples/codex-config.md`, `docs/delegate-safety.md`, MCP annotations, and workflows remain intact

Run: `npm test -- tests/release-assurance.test.ts`
Expected before docs are created: FAIL.

- [ ] **Step 2: Create root maturity files**

Use concise package-appropriate text:

- `CHANGELOG.md` and `CHANGELOG.zh-CN.md`: include current version heading from `package.json`.
- `CHANGELOG.md` and `CHANGELOG.zh-CN.md`: include release history visible under `docs/release/` for `0.0.0`, `0.1.0`, `0.2.0`, and current prerelease.
- `SECURITY.md`: supported versions, GitHub Security Advisory or issue-escalation guidance, private disclosure expectation, coordinated disclosure note, and local trust boundary.
- `CONTRIBUTING.md`: local setup, checks, scope boundaries.
- `LICENSE`: MIT license with `Copyright (c) 2026 yiyuiii`.

- [ ] **Step 3: Create Codex usage docs and examples**

`docs/codex-usage.md` should cover:

- when to use `cc_review`
- when to use `cc_delegate`
- how Codex should synthesize Claude output
- recommended global prompt
- safety boundary for delegate
- `cc_delegate` runs Claude Code in non-interactive `bypassPermissions`; callers should prepare a worktree, container, or trusted checkout before delegating writable work

Examples should include:

- downstream `AGENTS.md` snippet
- global Codex prompt snippet
- review synthesis packet template

- [ ] **Step 4: Update README/install/troubleshooting/package surfaces**

Update install docs to prefer:

```bash
codex-cc-tools install
codex-cc-tools doctor
```

Keep manual TOML config as fallback. Mention:

```bash
codex-cc-tools install --global-binary
codex-cc-tools uninstall
```

Update package `files`, `prepublishOnly`, and `scripts/release-smoke.mjs`.

- [ ] **Step 5: Verify release assurance tests pass**

Run: `npm test -- tests/release-assurance.test.ts`
Expected: PASS.

## Task 4: Full Verification and Review

**Files:**
- No new functional files unless review finds issues.

- [ ] **Step 1: Run targeted tests**

Run:

```bash
npm test -- tests/codex-config.test.ts tests/doctor.test.ts tests/cli.test.ts tests/release-assurance.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run standard local checks**

Run:

```bash
npm run typecheck
npm test
npm run build
node dist/index.js --version
node dist/index.js --help
node dist/index.js doctor
node scripts/release-smoke.mjs
```

Expected: PASS. If environment-specific doctor warnings exist, `doctor` may print warnings but must exit 0 unless required checks are missing.

- [ ] **Step 3: Request `cc_review`**

Use `cc_review` with:

- task: `review_diff`
- providerProfile: `anthropic`
- includeGitDiff/status: true
- focus: install/uninstall config safety, doctor severity correctness, package docs surface, release assurance coverage

- [ ] **Step 4: Synthesize and fix accepted findings**

Accept concrete correctness/security/test findings. Reject findings contradicted by code or project requirements with explanation. Re-run targeted and full verification after any fixes.

## Completion Criteria

- Install/uninstall commands work and are tested.
- Doctor prints actionable diagnostics and is tested without relying on the local machine state.
- Public maturity files and Codex usage examples are present and included in packaging checks.
- `AGENTS.md` indexes the new plan and current progress.
- Standard local checks pass or any environment-specific blocker is clearly reported with command output.

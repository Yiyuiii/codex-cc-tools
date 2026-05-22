# Delegate Implementation Plan

Superseded after `v0.1.0`: this plan describes the earlier safety-heavy
delegate design with isolation, path policy, and command policy. The active
maintainer requirement is a thin Claude Code bridge: Codex supplies one complete
prompt, execution-space policy stays outside the MCP tool, and `cc_delegate`
returns structured results.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the reviewed writable `delegate` task behind explicit isolation, workspace-boundary, command, process, CLI, and MCP safety controls.

**Architecture:** Keep `delegate` separate from `review`, `research`, and `verify`. Build reusable workspace-boundary and delegate-policy modules first, then add schema/packet/tool/format, then expose CLI and MCP. The implementation must follow `docs/delegate-safety.md`; if code and design disagree, fix the design or code before continuing.

**Tech Stack:** TypeScript, Node.js 20+, Zod, Commander, Vitest, existing Claude Code runner, existing MCP SDK integration.

---

## File Map

- Create `src/core/workspace-boundary.ts`: path resolution, unsafe root checks, segment-boundary path membership, and changed-path validation helpers.
- Create `src/tasks/delegate/schema.ts`: input/output schemas and isolation evidence shapes.
- Create `src/tasks/delegate/policy.ts`: pre-run safety evaluation, isolation verification shell adapter boundaries, tool construction, and command policy checks.
- Create `src/tasks/delegate/packet.ts`: prompt packet with trust-boundary preamble and redaction/truncation.
- Create `src/tasks/delegate/format.ts`: CLI/MCP text formatting.
- Create `src/tasks/delegate/tool.ts`: run Claude Code with writable authority only after policy passes, parse structured output, redact returned fields, and block malformed output.
- Create `src/cli/delegate.ts`: local CLI command adapter.
- Modify `src/index.ts`: register `delegate` CLI and exports.
- Modify `src/mcp/tools.ts` and `src/mcp/server.ts`: register `cc_delegate` with destructive metadata.
- Modify `README.md`, `docs/architecture.md`, `AGENTS.md`, and `docs/superpowers/plans/2026-05-22-long-term-completion.md`.
- Test `tests/workspace-boundary.test.ts`, `tests/delegate-schema.test.ts`, `tests/delegate-policy.test.ts`, `tests/delegate-packet.test.ts`, `tests/delegate-tool.test.ts`, `tests/cli-delegate.test.ts`, plus existing CLI/MCP tests.

## Task 1: Workspace Boundary Foundation

**Files:**
- Create: `src/core/workspace-boundary.ts`
- Test: `tests/workspace-boundary.test.ts`

- [ ] **Step 1: Write failing tests for unsafe roots and segment matching**

Test cases:

```ts
expect(isPathInsideBoundary("C:\\repo\\src\\foobar", ["C:\\repo\\src\\foo"], "win32")).toBe(false);
expect(isPathInsideBoundary("C:\\repo\\src\\foo\\index.ts", ["C:\\repo\\src\\foo"], "win32")).toBe(true);
expect(isUnsafeWorkspaceRoot("C:\\")).toBe(true);
expect(isUnsafeWorkspaceRoot(process.env.USERPROFILE ?? "")).toBe(true);
```

Run: `npm test -- tests/workspace-boundary.test.ts`
Expected: FAIL because the module does not exist.

- [ ] **Step 2: Implement pure path helpers**

Implement exported helpers:

```ts
export function normalizeForPlatform(pathname: string, platform = process.platform): string;
export function isPathEqualOrInside(candidate: string, parent: string, platform = process.platform): boolean;
export function isUnsafeWorkspaceRoot(pathname: string, env = process.env): boolean;
export function isPathInsideBoundary(candidate: string, allowed: string[], platform = process.platform): boolean;
```

Rules: Windows comparisons are case-insensitive; membership is equality or `parent + path.sep`; roots, home, Windows system directories, and `.git` internals are unsafe.

- [ ] **Step 3: Run targeted tests**

Run: `npm test -- tests/workspace-boundary.test.ts`
Expected: PASS.

## Task 2: Delegate Schema

**Files:**
- Create: `src/tasks/delegate/schema.ts`
- Test: `tests/delegate-schema.test.ts`

- [ ] **Step 1: Write failing schema tests**

Cover required `cwd`, `acceptanceCriteria` as non-empty `string[]`, isolation shapes, protected branch rejection inputs passed to policy later, optional `commandsAllowed` defaulting to `undefined`, and malformed output blocking.

Run: `npm test -- tests/delegate-schema.test.ts`
Expected: FAIL because schema does not exist.

- [ ] **Step 2: Implement schemas**

Define:

```ts
export const CcDelegateInputSchema = z.object({
  task: NonEmptyStringSchema,
  cwd: NonEmptyStringSchema,
  isolation: DelegateIsolationSchema,
  acceptanceCriteria: z.array(NonEmptyStringSchema).min(1),
  context: z.string().trim().optional(),
  allowedPaths: PathListSchema,
  forbiddenPaths: PathListSchema,
  commandsAllowed: OptionalCommandListSchema,
  providerProfile: ProviderProfileSchema.default("anthropic"), // Historical superseded plan; active thin delegate defaults to deepseek.
  model: NonEmptyStringSchema.default("opus"),
  effort: ClaudeEffortSchema.default("max"),
  timeoutMs: z.number().int().positive().max(3_600_000).default(900_000),
  maxContextChars: z.number().int().min(1_000).max(1_000_000).default(120_000),
  stream: z.boolean().default(true),
  cacheTtl: CacheTtlSchema.default("1h")
}).strict();
```

Output statuses: `succeeded`, `partial`, `needs_followup`, `blocked`.

- [ ] **Step 3: Run targeted tests**

Run: `npm test -- tests/delegate-schema.test.ts`
Expected: PASS.

## Task 3: Delegate Policy

**Files:**
- Create: `src/tasks/delegate/policy.ts`
- Test: `tests/delegate-policy.test.ts`

- [ ] **Step 1: Write failing policy tests**

Cover missing/unsafe `cwd`, branch protection, `git-branch` requiring `acknowledgeSharedCheckout`, empty `commandsAllowed` disabling Bash, rejecting `bypassPermissions`, rejecting `Bash(git ...)` without `-c core.hooksPath=/dev/null`, rejecting package install/download-execute commands, pre-existing executable hooks blocking, and post-run symlink escape blocking through `validateDelegateChangedPaths`.

Run: `npm test -- tests/delegate-policy.test.ts`
Expected: FAIL because policy does not exist.

- [ ] **Step 2: Implement policy result types**

Use:

```ts
export interface DelegatePolicyResult {
  ok: boolean;
  diagnostics: string[];
  tools: string[];
  permissionMode: "acceptEdits";
  resolvedCwd?: string;
  allowedPaths?: string[];
  forbiddenPaths?: string[];
}
```

Pure policy helpers should be dependency-injected for filesystem/Git checks so tests do not need real unsafe worktrees.

- [ ] **Step 3: Run targeted tests**

Run: `npm test -- tests/delegate-policy.test.ts`
Expected: PASS.

## Task 4: Packet, Format, and Tool

**Files:**
- Create: `src/tasks/delegate/packet.ts`
- Create: `src/tasks/delegate/format.ts`
- Create: `src/tasks/delegate/tool.ts`
- Test: `tests/delegate-packet.test.ts`
- Test: `tests/delegate-tool.test.ts`

- [ ] **Step 1: Write failing packet/tool tests**

Packet tests cover trust-boundary preamble, redaction, allowed/forbidden path display, no implicit Bash language, and truncation. Tool tests cover policy failure returning `blocked` before Claude Code, successful structured output, malformed output blocking, result-side redaction, and Claude args using `acceptEdits` without `--dangerously-skip-permissions`.

Run: `npm test -- tests/delegate-packet.test.ts tests/delegate-tool.test.ts`
Expected: FAIL because files do not exist.

- [ ] **Step 2: Implement packet/format/tool**

Tool flow:

1. If signal aborted, return `blocked`.
2. Evaluate policy.
3. If policy fails, return `blocked` without invoking Claude Code.
4. Build packet.
5. Call `runClaudeTask` with `permissionMode: "acceptEdits"` and policy tools.
6. Parse `structured_output`.
7. Redact all surfaced fields.
8. Return parsed output or `blocked`.

- [ ] **Step 3: Run targeted tests**

Run: `npm test -- tests/delegate-packet.test.ts tests/delegate-tool.test.ts`
Expected: PASS.

## Task 5: CLI and MCP Surface

**Files:**
- Create: `src/cli/delegate.ts`
- Modify: `src/index.ts`
- Modify: `src/mcp/tools.ts`
- Modify: `src/mcp/server.ts`
- Test: `tests/cli-delegate.test.ts`
- Test: `tests/cli.test.ts`
- Test: `tests/mcp-tools.test.ts`

- [ ] **Step 1: Write failing CLI/MCP tests**

Cover `node dist/index.js delegate --help`, option parsing for `--task`, `--cwd`, `--acceptance-criteria`, `--isolation-kind`, `--isolation-evidence`, `--allowed-path`, `--forbidden-path`, `--commands-allowed`, and MCP metadata `readOnlyHint: false`, `destructiveHint: true`, `openWorldHint: false`.

Run: `npm test -- tests/cli-delegate.test.ts tests/cli.test.ts tests/mcp-tools.test.ts`
Expected: FAIL until CLI/MCP are registered.

- [ ] **Step 2: Implement CLI/MCP registration**

Register command `delegate` and tool `cc_delegate`. Do not expose writable behavior through any existing read-only tool.

- [ ] **Step 3: Run targeted tests**

Run: `npm test -- tests/cli-delegate.test.ts tests/cli.test.ts tests/mcp-tools.test.ts`
Expected: PASS.

## Task 6: Documentation, Review, and Commit

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `AGENTS.md`
- Modify: `docs/superpowers/plans/2026-05-22-long-term-completion.md`

- [ ] **Step 1: Update docs**

Document `delegate` as implemented but high-risk, explicitly writable, destructive in MCP, requiring `cwd`, `isolation`, and `acceptanceCriteria`.

- [ ] **Step 2: Run full verification**

Run:

```bash
npm run typecheck
npm test
npm run build
node dist/index.js delegate --help
git diff --check
```

Expected: all commands exit 0; `git diff --check` may emit only line-ending warnings.

- [ ] **Step 3: Run final review**

Run `cc_review` on the final diff with focus on delegate safety. Accept only findings with concrete evidence.

- [ ] **Step 4: Commit**

Run:

```bash
git add src tests docs README.md AGENTS.md
git commit -m "feat: add explicit writable delegate task"
```

Expected: clean worktree after commit.

## Self-Review Notes

- Every requirement in `docs/delegate-safety.md` maps to schema, policy, tool, or test tasks above.
- No implementation should call `bypassPermissions` or `--dangerously-skip-permissions`.
- The first implementation may keep real Git/worktree checks dependency-injected and deterministic; real provider/writable smoke can wait for explicit maintainer approval.

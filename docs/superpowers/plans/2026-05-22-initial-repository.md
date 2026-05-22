# Initial Repository Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish `codex-cc-tools` as a separate repository with a tested task/provider registry and enough documentation to continue migration work safely.

**Architecture:** Start with registries and CLI smoke commands only. Keep the current reviewer code as a migration source instead of copying the full runner immediately.

**Tech Stack:** TypeScript, Node.js 20+, Commander, Vitest, tsup.

---

### Task 1: Repository Skeleton

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `src/index.ts`

- [x] **Step 1: Add package/config files**

Use `codex-cc-tools` as the package/bin name and keep scripts limited to `test`, `typecheck`, `build`, and `verify`.

- [x] **Step 2: Add minimal CLI**

Implement `--version`, `--help`, and `doctor`.

- [x] **Step 3: Verify CLI tests**

Run: `npm test -- tests/cli.test.ts`

Expected: pass.

### Task 2: Task Registry

**Files:**
- Create: `src/tasks/registry.ts`
- Test: `tests/task-registry.test.ts`

- [x] **Step 1: Write registry test**

Assert that `review`, `delegate`, `verify`, and `research` are exposed with safety labels.

- [x] **Step 2: Implement registry**

Return immutable copies of task definitions.

- [x] **Step 3: Verify test**

Run: `npm test -- tests/task-registry.test.ts`

Expected: pass.

### Task 3: Provider Registry

**Files:**
- Create: `src/providers/registry.ts`
- Test: `tests/provider-registry.test.ts`

- [x] **Step 1: Write provider test**

Assert that `anthropic` is default and `deepseek` starts with the intended initial status. DeepSeek was initially experimental and was later promoted for the implemented `review` task after the Milestone 3 gate.

- [x] **Step 2: Implement model mapping**

Map `opus`/`sonnet` to `deepseek-v4-pro[1m]` and `haiku` to `deepseek-v4-flash`.

- [x] **Step 3: Verify test**

Run: `npm test -- tests/provider-registry.test.ts`

Expected: pass.

### Task 4: Documentation Baseline

**Files:**
- Create: `AGENTS.md`
- Create: `README.md`
- Create: `docs/architecture.md`
- Create: `docs/migration-from-reviewer.md`

- [x] **Step 1: Document product boundary**

State that providers and tasks are orthogonal and DeepSeek is not a task.

- [x] **Step 2: Document migration source**

Point to `D:\Codes\codex-cc-reviewer` and the `codex/deepseek-cc-spike` branch.

### Task 5: Verification

**Files:**
- No new files.

- [x] **Step 1: Run full checks**

Run:

```bash
npm run typecheck
npm test
npm run build
node dist/index.js --version
node dist/index.js --help
node dist/index.js doctor
```

Expected: all commands exit 0.

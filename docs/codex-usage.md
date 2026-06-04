# Codex Usage Guide

How to use `cc_review` and `cc_delegate` from Codex through the
`codex-cc-tools` MCP server.

## When to Use Each Tool

### cc_review

Use `cc_review` when you want a **second opinion** without letting the external
provider modify your working tree. Review tasks are read-only by contract.

| Task | When |
| --- | --- |
| `review_plan` | Before starting implementation — validate the approach, flag missing edge cases, check alignment with existing code. |
| `review_diff` | Before committing or landing a diff — catch regressions, missing tests, unintended side effects. |
| `review_doc` | After writing or updating docs, README, AGENTS.md — check for accuracy, completeness, consistency with code. |
| `adversarial_review` | When you need a deliberately skeptical second look — find what would break, what was overlooked, what assumptions are unstated. |

**Default provider**: `anthropic` (native Claude Code). `providerProfile:
"gemini"` is also available for direct Gemini review, but it does not provide
Claude Code file-reading or shell tools. When Gemini needs a local network
proxy, pass `geminiProxyUrl` directly in the `cc_review` request.

**Key pattern**: Run `cc_review` at decision checkpoints — before implementing,
before finalizing a diff, and after major documentation changes. Treat its
output as advisory evidence; you must explicitly accept, reject, or defer
each finding.

### cc_delegate

Use `cc_delegate` for **autonomous delegated subtasks** — work that can be
handed off to a Claude Code subprocess for independent completion.

| Scenario | Example |
| --- | --- |
| Read-only investigation | "Read the test suite and report which modules have no coverage." |
| Scoped writable work | "Update README examples for the new provider profile, then report changed files." |
| Independent parallel work | Two non-overlapping file changes dispatched as separate calls. |
| Routine low-cost tasks | Code formatting, simple refactors, doc updates — delegated to a DeepSeek worker. |

**Default provider**: `deepseek` (DeepSeek V4 Pro).

**Key pattern**: Each `cc_delegate` call receives one complete `prompt` plus
optional process settings. Parallelism comes from launching multiple independent
calls whose write scopes do not overlap or which are read-only.

## Bypassing Permissions

`cc_delegate` runs Claude Code with `bypassPermissions`, which means Claude Code
will **not prompt for interactive approval** during execution. This is by design
for autonomous delegated work.

**What this means for you as the caller:**

- The execution environment is whatever directory you pass as `cwd`.
- There is **no built-in isolation** — no worktree, no container, no path policy.
- You are responsible for choosing the right working directory and for any
  sandboxing you want.
- If a task should be confined to a worktree, create the worktree first, then
  pass its path as `cwd`.
- Treat `cc_delegate` like you would treat `claude -p "<prompt>" --dangerously-skip-permissions`:
  it does what you ask, in the directory you point it at, with no guardrails
  beyond what the OS and shell provide.

## Structuring Your Feedback to Claude Code

### In cc_review

Give the reviewer enough context to be useful:

```json
{
  "task": "review_diff",
  "context": "Review the current staged diff. We are adding a --global-binary flag to the install CLI.",
  "reviewFocus": "Check for missing test coverage and CLI argument parsing edge cases.",
  "includeGitDiff": true,
  "includeGitStatus": true,
  "originalGoal": "Let users install MCP config with either npx or global binary launch mode.",
  "acceptanceCriteria": ["--global-binary flag works", "default is npx mode", "doctor detects the installed config"]
}
```

### In cc_delegate

Put everything Claude Code needs into the prompt. There are no separate
`context` or `acceptanceCriteria` fields — the prompt is the contract:

```json
{
  "prompt": "Edit README.md and README.zh-CN.md to add install/uninstall examples. Use the existing style. After editing, run `node dist/index.js --help` to verify CLI works. Report: changed files, commands run, and any issues found.",
  "cwd": "/path/to/repo"
}
```

## Synthesizing Multiple Reviews

When you receive multiple `cc_review` results (e.g., a plan review and a
diff review), synthesize them before acting:

1. **Group findings** by severity (blocker / important / nice-to-have).
2. **Resolve conflicts** between reviewers — one may flag something the other missed.
3. **Decide explicitly**: accept, reject, or defer each distinct finding.
4. **Record deferred items** so they aren't lost.

See `examples/codex-synthesis.md` for a synthesis template.

## Parallel Delegation

Multiple `cc_delegate` calls can run in parallel when their write scopes do not
overlap, or when all are read-only. Each call is a separate Claude Code
subprocess with its own environment, model, and working directory.

**Safe**: Two read-only investigations, or two file edits on disjoint paths.
**Risky**: Two writable calls that may touch the same files — they could race.

## Provider Selection

| Profile | Use for |
| --- | --- |
| `anthropic` | High-stakes reviews where you want native Claude Code quality. Default for `cc_review`; `opus` resolves to `claude-opus-4-8`. |
| `deepseek` | Routine delegated work where DeepSeek V4 Pro quality is adequate and cost matters. Default for `cc_delegate`. |
| `ark_coding_plan` | Explicit fallback or comparison runs through Volcengine Ark Coding Plan. Common aliases route to `doubao-seed-2.0-pro`. |
| `gemini` | Direct Gemini review-only fallback through `gemini-3.5-flash`. Valid for `cc_review`; rejected by `cc_delegate`. |

You can override either default by setting `providerProfile` explicitly.

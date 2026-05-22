# Tool Contract

`codex-cc-tools` exposes the same task concepts through CLI commands and MCP tools.

| Task | CLI | MCP | Authority |
| --- | --- | --- | --- |
| Review | `review` | `cc_review` | Read-only |
| Research | `research` | `cc_research` | Read-only |
| Verify | `verify` | `cc_verify` | Explicit command execution |
| Delegate | `delegate` | `cc_delegate` | Explicit workspace write |

## Review

Use `review` for external critique of plans, diffs, and documents. It asks Claude Code not to edit files and returns review text plus optional structured output. Git diff, status, and untracked content are opt-in evidence sources.

## Research

Use `research` for bounded repository investigation. Output includes an answer, evidence, files read, missing context, and diagnostics. It is not a write path.

## Verify

Use `verify` for reproductions and command-backed checks. The caller must provide `commandsAllowed`; the command list is passed to Claude Code as explicit Bash tool authority and is also documented in the packet.

## Delegate

Use `delegate` only for writable subtasks. It requires:

- explicit `cwd`
- structured isolation evidence
- at least one acceptance criterion

It blocks unsafe roots, protected branches, failed isolation checks, unsafe command authority, path-policy escapes, malformed structured output, and post-run changed paths outside policy.

`delegate` is marked destructive in MCP metadata. Caller-managed OS, container, or worktree isolation remains required for hard isolation.

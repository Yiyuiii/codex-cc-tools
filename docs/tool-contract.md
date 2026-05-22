# Tool Contract

`codex-cc-tools` exposes two high-leverage task concepts through CLI commands
and MCP tools.

| Task | CLI | MCP | Authority |
| --- | --- | --- | --- |
| Review | `review` | `cc_review` | Read-only |
| Delegate | `delegate` | `cc_delegate` | Destructive Claude Code execution |

## Review

Use `review` for external critique of plans, diffs, and documents. It asks Claude Code not to edit files and returns review text plus optional structured output. Git diff, status, and untracked content are opt-in evidence sources.

## Delegate

Use `delegate` to pass one complete prompt from Codex to Claude Code and return
structured results. It is intended for autonomous delegated subtasks, including
read-only investigation and writable implementation. It requires:

- `prompt`

Optional `cwd` is only the subprocess working directory. It is not a safety
boundary. Extra context, command sequences, and acceptance checks belong inside
the prompt rather than separate MCP fields.

`delegate` is marked destructive in MCP metadata because Claude Code may edit
files or run commands. The tool invokes Claude Code in non-interactive
`bypassPermissions` mode for autonomous execution. Caller-managed OS,
container, worktree, repository, and command policy remain outside this tool.
`delegate` defaults to `providerProfile: "deepseek"`; callers can set
`providerProfile: "anthropic"` when they want native Claude Code routing.
Callers may launch multiple `delegate` tasks in parallel. Each task starts a
separate Claude Code subprocess from one complete prompt plus optional process
settings, then returns its own structured result.

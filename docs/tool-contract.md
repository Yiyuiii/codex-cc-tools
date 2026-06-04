# Tool Contract

`codex-cc-tools` exposes two high-leverage task concepts through CLI commands
and MCP tools.

| Task | CLI | MCP | Authority |
| --- | --- | --- | --- |
| Review | `review` | `cc_review` | Read-only |
| Delegate | `delegate` | `cc_delegate` | Destructive Claude Code execution |

## Review

Use `review` for external critique of plans, diffs, and documents. It asks the
selected provider not to edit files and returns review text plus optional
structured output. Git diff, status, and untracked content are opt-in evidence
sources.

By default, `review` does not pass Claude Code `--allowedTools` for any
provider profile. When callers provide the optional `tools` field, those values
are forwarded as the explicit Claude Code tool allowlist.

`providerProfile: "gemini"` is direct review-only. It calls Gemini
`generateContent`, ignores Claude Code tool allowlists because no Claude Code
subprocess is launched, and maps common aliases to `gemini-3.5-flash`.
Claude Code-specific `effort` and `cacheTtl` settings are accepted by the shared
schema but do not affect direct Gemini review behavior. `geminiProxyUrl` is an
optional request-level HTTP proxy for this direct Gemini route; it wins over
inherited `HTTPS_PROXY` and `HTTP_PROXY` and does not affect Claude Code-backed
provider profiles.

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
`providerProfile: "anthropic"` when they want native Claude Code routing, or
`providerProfile: "ark_coding_plan"` when they want Volcengine Ark Coding Plan
routing.
`providerProfile: "gemini"` is rejected for `delegate`; Gemini direct API does
not provide the Claude Code execution tool surface.
Callers may launch multiple `delegate` tasks in parallel. Each task starts a
separate Claude Code subprocess from one complete prompt plus optional process
settings, then returns its own structured result.

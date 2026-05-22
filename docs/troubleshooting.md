# Troubleshooting

## Claude Code Command Not Found

Install Claude Code and confirm the command is available:

```bash
claude --help
```

The runner checks required Claude Code flags in tests, but runtime availability depends on the user's environment.

## Anthropic Environment Variables Are Unset

For the `anthropic` provider profile, unset `ANTHROPIC_AUTH_TOKEN` or `ANTHROPIC_API_KEY` process variables are not automatically errors. Claude Code can use its native profile and authentication state.

## DeepSeek Provider Fails Configuration

Set one of:

```bash
DEEPSEEK_API_KEY=...
OPENAI_API_KEY_DEEPSEEK=...
```

The DeepSeek key is injected only into the Claude Code child process and is redacted from returned output.

## DeepSeek Backend Shows No Requests

First compare the task diagnostics with the account being monitored. DeepSeek runs now report a non-secret line such as:

```text
DeepSeek route target: api.deepseek.com; token source: OPENAI_API_KEY_DEEPSEEK.
```

If the backend dashboard is watching a different key or project than that token source, no usage will appear there. This is easy to miss because this repository prefers `DEEPSEEK_API_KEY` but falls back to `OPENAI_API_KEY_DEEPSEEK`.

The historical DeepSeek quality gate records `providerProfile: "deepseek"` and resolved DeepSeek model names, but it did not record the route host or token source. Treat those artifacts as quality evidence, not as independent billing-side proof. When billing-side proof matters, run a fresh smoke and compare the reported token source with the DeepSeek dashboard.

## PowerShell JSON Arguments

PowerShell may strip quotes from inline JSON passed to native commands. Prefer generating JSON and escaping quotes:

```powershell
$evidence = (@{ branch = "codex/feature" } | ConvertTo-Json -Compress).Replace('"','\"')
codex-cc-tools delegate --isolation-evidence $evidence ...
```

## Delegate Blocks On Dirty Workspace

`delegate` requires a clean Git worktree unless the isolation evidence explicitly accepts dirty state. Prefer creating a linked worktree for writable tasks.

## Delegate Blocks On Commands

`commandsAllowed` must contain simple command prefixes. Commands with shell control syntax, redirects, pipes, subshells, package installs, remote mutation, or global Git config changes are blocked.

## Release Smoke Fails

Run the release smoke command:

```bash
npm run release:smoke
```

`release:smoke` runs `npm run build` first, then checks CLI basics, MCP tool registration through the built package exports, tool annotations, handlers, and the `npm pack --dry-run --json` file list.

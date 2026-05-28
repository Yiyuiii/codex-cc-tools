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

## Ark Coding Plan Provider Fails Configuration

Set one of:

```bash
ARK_API_KEY=...
VOLCENGINE_API_KEY=...
```

The Ark key is injected only into the Claude Code child process and is redacted
from returned output. If both variables are present with different values,
`ARK_API_KEY` wins.

## Ark Coding Plan Uses The Wrong Endpoint

`ark_coding_plan` is a Claude Code provider profile, so it defaults to the
Anthropic-compatible Coding Plan endpoint:

```text
https://ark.cn-beijing.volces.com/api/coding
```

Do not use `https://ark.cn-beijing.volces.com/api/coding/v3` for this profile;
that endpoint is for OpenAI-wire clients. Successful runs include a non-secret
diagnostic such as:

```text
Ark Coding Plan route target: ark.cn-beijing.volces.com; token source: ARK_API_KEY.
```

## Delegate Runs In The Wrong Place

`cc_delegate` does not create, inspect, or enforce execution spaces. If a task
should run in a worktree, container, temporary directory, or guarded branch,
prepare that outside the MCP tool and pass the resulting directory with `cwd`.

## Delegate Needs More Instructions

`cc_delegate` has no separate `context`, `acceptanceCriteria`, path policy, or
command policy fields. Put the full instruction, command sequence, expected
output format, and verification request directly in `prompt`.

## Release Smoke Fails

Run the release smoke command:

```bash
npm run release:smoke
```

`release:smoke` runs `npm run build` first, then checks CLI basics, MCP tool registration through the built package exports, tool annotations, handlers, and the `npm pack --dry-run --json` file list.

## Install Fails or Config Not Written

Run `codex-cc-tools doctor` first to check the environment:

```bash
codex-cc-tools doctor
```

`doctor` checks Node, npm, Codex CLI, Claude Code CLI, daemon state,
background jobs, Codex config file presence, MCP registration status,
registered tasks and providers, and DeepSeek / Ark Coding Plan environment variables.

If `codex-cc-tools install` does not write the config block to the expected
path:

- Check that `~/.codex/` exists. `install` writes to `~/.codex/config.toml`
  by default; the directory must already exist.
- Use `--config-path <path>` to target a specific file.
- If Codex was not installed, there may be no `~/.codex/` directory.
- On Windows, the config path resolves under `%USERPROFILE%\.codex\config.toml`.

## Install Writes to Wrong Config

By default, `codex-cc-tools install` targets `~/.codex/config.toml`. If your
Codex reads a different config file, pass it explicitly:

```bash
codex-cc-tools install --config-path /path/to/project/.codex/config.toml
```

## Uninstall Does Not Remove the Block

`codex-cc-tools uninstall` removes only the `[mcp_servers.codex_cc_tools]`
block. If the block uses a different server name or was edited manually into
an unusual format, `uninstall` might not match it. Check the config file
directly.

## Doctor Reports Missing MCP Registration

`[warn] MCP registration: codex_cc_tools is not configured; run 'codex-cc-tools install'`

This means no `[mcp_servers.codex_cc_tools]` block was found in the default
Codex config file. Run:

```bash
codex-cc-tools install
```

Then restart Codex. If your config is in a non-default location, use:

```bash
codex-cc-tools doctor --config-path /path/to/.codex/config.toml
```

## Doctor Reports Missing DeepSeek Key

`[warn] DeepSeek environment: no DeepSeek key found`

This is a warning, not an error. If you only use `cc_review` with the default
`anthropic` profile, or if you override `cc_delegate` to use `anthropic`, no
DeepSeek key is needed. Set `DEEPSEEK_API_KEY` or `OPENAI_API_KEY_DEEPSEEK`
only if you use `cc_delegate` with its default `deepseek` profile.

## Doctor Reports Missing Ark Coding Plan Key

`[warn] Ark Coding Plan environment: no Ark Coding Plan key found`

This is a warning, not an error. Set `ARK_API_KEY` or `VOLCENGINE_API_KEY` only
if you use `providerProfile: "ark_coding_plan"`.

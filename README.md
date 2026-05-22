# codex-cc-tools

[English](README.md) | [简体中文](README.zh-CN.md)

[![npm version](https://img.shields.io/npm/v/codex-cc-tools.svg)](https://www.npmjs.com/package/codex-cc-tools)
[![CI](https://github.com/Yiyuiii/codex-cc-tools/actions/workflows/ci.yml/badge.svg)](https://github.com/Yiyuiii/codex-cc-tools/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js >=20](https://img.shields.io/badge/node-%3E%3D20-339933.svg)](https://nodejs.org/)

Claude Code task tools for Codex via MCP.

**Codex orchestrates. Claude Code executes. Codex decides.**

`codex-cc-tools` is the successor-style tool family to the narrower `codex-cc-reviewer` package. It keeps the same Codex-facing architecture, but keeps the public surface intentionally small:

- provider profile: which Claude Code backend to use, currently `anthropic` or `deepseek`
- task: what Codex is asking for, currently `review` or `delegate`
- authority: read-only review or potentially destructive delegated Claude Code execution
- result contract: structured output that Codex can inspect, synthesize, accept, reject, or defer

## Quickstart

Requirements:

- Node.js 20 or newer
- npm or npx
- Claude Code CLI on `PATH`; `claude --version` should work
- A DeepSeek API key if you use `cc_delegate` without overriding `providerProfile`
- Claude Code authenticated locally if you use the native `anthropic` provider profile
- Codex or another MCP client that can launch a stdio MCP server

Install globally:

```bash
npm install -g codex-cc-tools
codex-cc-tools --version
codex-cc-tools doctor
```

Or run without global install:

```bash
npx --prefer-online -y codex-cc-tools@latest --version
npx --prefer-online -y codex-cc-tools@latest doctor
```

For stable day-to-day use, pin the MCP config to a known version such as `codex-cc-tools@0.1.0`. Use `@latest` for quick setup and stable auto-updates. Use `@next` only for prerelease validation.

Add the MCP server to `~/.codex/config.toml` or a trusted project `.codex/config.toml`. If your Codex build supports `enabled_tools`, keep the tool list restricted to the two tools shown here; otherwise omit that line and rely on the server's registered tool metadata.

```toml
[mcp_servers.codex_cc_tools]
command = "npx"
args = ["-y", "codex-cc-tools@latest", "mcp"]
startup_timeout_sec = 60
tool_timeout_sec = 900
required = false
enabled = true
enabled_tools = ["cc_review", "cc_delegate"]
```

Restart Codex after changing MCP configuration.

If `codex-cc-tools` is installed globally and available on `PATH`, this equivalent config also works:

```toml
[mcp_servers.codex_cc_tools]
command = "codex-cc-tools-mcp"
args = []
startup_timeout_sec = 20
tool_timeout_sec = 900
required = false
enabled = true
enabled_tools = ["cc_review", "cc_delegate"]
```

## Required Parameters

For the native `anthropic` provider profile, this package delegates to the native `claude` command. Make sure `claude --version` works and run Claude Code once interactively if local auth is not ready. Claude Code can then use its own local authentication, profile, keychain, OAuth, or configured route.

Users do not need to provide `ANTHROPIC_AUTH_TOKEN` or `ANTHROPIC_API_KEY` as environment variables for the `anthropic` profile. If Anthropic, Bedrock, Vertex, or proxy route variables are already present in the environment, they are inherited by the Claude Code subprocess; they are optional inputs, not required setup.

For DeepSeek, the MCP server process must start with one of these environment variables:

```bash
export DEEPSEEK_API_KEY="your-deepseek-api-key"
# or
export OPENAI_API_KEY_DEEPSEEK="your-deepseek-api-key"
```

`DEEPSEEK_API_KEY` wins when both are present. Optional override:

```bash
DEEPSEEK_ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
```

Most users should not set the override.

The MCP server inherits the environment of the process that launches it. If Codex is launched from a GUI, it may not see variables exported only in a shell startup file. On Windows, set a persistent user variable such as `setx DEEPSEEK_API_KEY "your-deepseek-api-key"` and restart Codex. On macOS/Linux, either launch Codex from a shell where the key is exported or configure the variable in the desktop/session launcher that starts Codex.

When `providerProfile: "deepseek"` is used, the package builds a per-child-process Claude Code route:

- `ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic`
- `ANTHROPIC_AUTH_TOKEN=<resolved DeepSeek key>`
- `ANTHROPIC_DEFAULT_OPUS_MODEL=deepseek-v4-pro[1m]`
- `ANTHROPIC_DEFAULT_SONNET_MODEL=deepseek-v4-pro[1m]`
- `ANTHROPIC_DEFAULT_HAIKU_MODEL=deepseek-v4-flash`
- `ANTHROPIC_SMALL_FAST_MODEL=deepseek-v4-flash`
- `CLAUDE_CODE_SUBAGENT_MODEL=deepseek-v4-flash`
- `CLAUDE_CODE_EFFORT_LEVEL=<requested effort>`

The caller shell profile is not rewritten. Inherited Anthropic, Bedrock, Vertex, and provider-token route variables are removed from the DeepSeek child process before DeepSeek variables are injected. Returned output redacts the resolved provider token on a best-effort basis.

DeepSeek model inputs accepted by this package:

| Input model | DeepSeek model used |
| --- | --- |
| `opus` | `deepseek-v4-pro[1m]` |
| `sonnet` | `deepseek-v4-pro[1m]` |
| `haiku` | `deepseek-v4-flash` |
| `deepseek-v4-pro[1m]` | `deepseek-v4-pro[1m]` |
| `deepseek-v4-flash` | `deepseek-v4-flash` |

## Tools

| MCP tool | CLI command | Authority | Use it for |
| --- | --- | --- | --- |
| `cc_review` | `codex-cc-tools review` | Read-only product contract | Plan, diff, document, and adversarial review |
| `cc_delegate` | `codex-cc-tools delegate` | Destructive Claude Code execution | Autonomous delegated subtasks, including read-only investigation and writable implementation |

Recommended Codex prompt:

```text
For complex changes, use codex-cc-tools at useful checkpoints.
Use cc_review before implementation and before finalizing a diff.
Use cc_delegate for independent delegated subtasks; make the prompt explicit about read-only or writable scope, and call it in parallel when scopes are independent.
Treat Claude Code output as advisory evidence; Codex must accept, reject, or defer findings explicitly.
```

## Common MCP Inputs

All tools accept:

- `providerProfile`: `cc_review` defaults to `anthropic`; `cc_delegate` defaults to `deepseek`
- `model`: `opus` by default; provider aliases are resolved per profile
- `effort`: `max` by default; one of `low`, `medium`, `high`, `max`
- `cwd`: task working directory where applicable
- `maxContextChars`: defaults to `120000`
- `stream`: defaults to `true`
- `cacheTtl`: defaults to `1h`; one of `5m`, `1h`

`cc_review` key fields:

```json
{
  "task": "review_diff",
  "context": "Review the current diff for correctness regressions.",
  "reviewFocus": "Prioritize confirmed bugs and missing tests.",
  "includeGitDiff": true,
  "includeGitStatus": true,
  "providerProfile": "anthropic"
}
```

Review tasks are `review_plan`, `review_diff`, `review_doc`, and `adversarial_review`. Optional fields include `originalGoal`, `codexSummary`, `acceptanceCriteria`, `knownRisks`, `testsRun`, `permissionMode`, `tools`, `includeUntrackedContent`, and `redactSecrets`.

`cc_delegate` key fields:

```json
{
  "prompt": "Update README examples for the new provider profile, then report changed files and any commands run.",
  "cwd": "/path/to/repo"
}
```

`cc_delegate` defaults to `providerProfile: "deepseek"` and is marked
destructive in MCP metadata because it invokes Claude Code in non-interactive
`bypassPermissions` mode for autonomous execution. It can be used for read-only
investigation when the prompt says not to edit files, but the tool metadata must
reflect its writable capability. It does not create, inspect, or enforce an
execution space. If you want a worktree, container, temporary directory, branch
policy, or command policy, prepare that outside this MCP tool and pass the final
instruction through `prompt`.

Multiple `cc_delegate` calls can be launched in parallel when the caller ensures
they are read-only or their writable scopes do not overlap.

## CLI Examples

```bash
codex-cc-tools doctor
codex-cc-tools review --task review_doc --context "Smoke review only." --model haiku
```

PowerShell `delegate` example:

```powershell
codex-cc-tools delegate --prompt "Edit README, then summarize changed files and checks run." --cwd "D:\Codes\repo"
```

DeepSeek CLI smoke:

```bash
export DEEPSEEK_API_KEY="your-deepseek-api-key"
codex-cc-tools review \
  --provider-profile deepseek \
  --model deepseek-v4-flash \
  --task review_doc \
  --context "DeepSeek route smoke only. Report whether this review invocation works."
```

Quote exact DeepSeek model names that contain brackets when passing them in a shell, for example `--model 'deepseek-v4-pro[1m]'`. The aliases `opus`, `sonnet`, and `haiku` avoid this issue.

## Safety And Configuration

This package is designed for trusted local owner workflows. It does not make Claude Code safe for untrusted repositories by itself.

| Setting | Default | Notes |
| --- | --- | --- |
| `providerProfile` | `cc_review`: `anthropic`; `cc_delegate`: `deepseek` | `anthropic` uses native Claude Code profile/auth. `deepseek` requires `DEEPSEEK_API_KEY` or `OPENAI_API_KEY_DEEPSEEK` in the MCP server environment. |
| `model` | `opus` | In DeepSeek profile, `opus` and `sonnet` map to `deepseek-v4-pro[1m]`; `haiku` maps to `deepseek-v4-flash`. |
| `effort` | `max` | Higher effort is slower and may cost more. On metered providers, use `medium` or `low` for routine checks. |
| `cacheTtl` | `1h` | Adds Claude Code prompt-cache hint where supported; reported cache fields are provider/Claude Code estimates. |
| `redactSecrets` | `true` for review packet evidence | Best-effort only; avoid sending secrets in prompts, files, and command output. |
| `permissionMode` for review | `bypassPermissions` | Disables Claude Code's interactive permission prompts. Use the default only in repositories you own; use narrower tools/modes for shared or sensitive repos. |
| `cc_delegate` tools | Claude Code non-interactive execution | Takes a complete prompt and runs Claude Code with `bypassPermissions`. Execution-space policy is external. |

For the full provider boundary, see [docs/security.md](docs/security.md). For all schemas, see [docs/tool-contract.md](docs/tool-contract.md).

## Troubleshooting

Run:

```bash
codex-cc-tools doctor
```

Common issues:

- `claude` is not found: install Claude Code and make sure it is on `PATH`.
- Claude is not authenticated: run Claude Code interactively once and complete auth.
- Codex does not show the tools: restart Codex after changing MCP config.
- DeepSeek says credentials are missing: set `DEEPSEEK_API_KEY` or `OPENAI_API_KEY_DEEPSEEK` in the environment that starts Codex or the MCP server.
- Setting the key in a terminal is not enough if Codex was launched elsewhere. Restart Codex from an environment that contains the variable, or set a persistent OS-level user variable.
- DeepSeek dashboard shows no requests: compare the returned diagnostic, for example `DeepSeek route target: api.deepseek.com; token source: OPENAI_API_KEY_DEEPSEEK.`, with the key/account you are monitoring.
- Anthropic env vars are unset: this is fine for the `anthropic` profile when native Claude Code auth works.
- Reviews or delegated tasks time out: increase `tool_timeout_sec` in Codex config or the task `timeoutMs`.
- MCP startup times out with `npx`: the first `npx` launch can be slow on a cold npm cache or slow network. Keep `startup_timeout_sec = 60` for `npx`, or use the global `codex-cc-tools-mcp` command with a shorter startup timeout.
- Delegate does not enforce worktrees, paths, branches, or command allowlists: prepare the execution space before calling the tool, and put task details directly in `prompt`.

See [docs/troubleshooting.md](docs/troubleshooting.md).

## How Is This Different From codex-cc-reviewer?

`codex-cc-reviewer` exposes one narrow review tool, `cc_review`.

`codex-cc-tools` keeps that review workflow and adds one autonomous execution path:

- `cc_review`: second-opinion review
- `cc_delegate`: prompt-driven Claude Code execution, read-only or writable by prompt scope

Provider routing is orthogonal to the task. DeepSeek is not a separate task; it is selected with `providerProfile: "deepseek"`.

## Documentation

- [Installation](docs/installation.md)
- [Tool contract](docs/tool-contract.md)
- [Security](docs/security.md)
- [Delegate boundary](docs/delegate-safety.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Architecture](docs/architecture.md)
- [Prior art](docs/prior-art.md)
- [Examples](examples)

## License

[MIT](LICENSE)

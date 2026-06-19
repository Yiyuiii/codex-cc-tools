# Delegate Boundary

`cc_delegate` is a thin Claude Code execution bridge for Codex. Codex supplies a
complete prompt, the tool starts Claude Code, Claude Code works continuously, and
the tool returns structured results to Codex. It is suitable for autonomous
delegated subtasks, including read-only investigation and writable
implementation, when the prompt states the intended scope.
Multiple `cc_delegate` calls may run in parallel. Each call starts a separate
Claude Code subprocess, receives its own prompt and process options, and returns
its own structured result.

This tool is not an execution-space manager, sandbox, worktree creator, branch
policy engine, path policy engine, or command policy engine. Those concerns
belong outside this MCP tool.

The filename is kept for package compatibility with earlier prerelease docs.
The active contract is the thin delegate boundary described here.

## Product Boundary

`cc_delegate` should stay close to native Claude Code usage:

```bash
claude -p "<prompt>"
```

The MCP tool adds only:

- provider-profile routing such as `anthropic`, `deepseek`, `ark_coding_plan`, or `ark_agent_plan`
- model, effort, cache, stream, timeout, and working-directory options
- process execution and cancellation handling
- structured result parsing and formatting
- best-effort redaction of common secret-shaped output

It must not add task-management semantics such as separate `context` or
`acceptanceCriteria` fields. If Codex wants Claude Code to use extra context,
commands, output rules, or acceptance checks, Codex writes those instructions in
the prompt.

## Input Contract

Required:

- `prompt`: the full instruction text Codex wants Claude Code to execute.

Optional:

- `cwd`: working directory for the Claude Code subprocess. This is only a
  process working directory, not a safety boundary.
- `providerProfile`
- `model`
- `effort`
- `timeoutMs`
- `maxContextChars`
- `stream`
- `cacheTtl`

Removed from the active contract:

- `isolation`
- `allowedPaths`
- `forbiddenPaths`
- `commandsAllowed`
- `acceptanceCriteria`
- `context`

## Execution-Space Responsibility

The caller is responsible for choosing and preparing the execution space before
calling `cc_delegate`. That may be the current checkout, a linked worktree, a
container, a VM, a temporary directory, or any other environment selected by
Codex and the user.

`cc_delegate` should not inspect whether the branch is protected, whether the
workspace is clean, whether paths are allowed, or whether a command is
permitted. If those policies matter, they must be enforced by the caller,
Codex configuration, OS/container sandboxing, repository policy, or the prompt
given to Claude Code.

## Claude Code Authority

`cc_delegate` invokes Claude Code with writable authority because its purpose is
to let Claude Code do autonomous work. The tool uses Claude Code's
non-interactive `bypassPermissions` mode so command-heavy delegated prompts do
not stall on permission prompts. The exact local authority is therefore whatever
the caller environment gives the Claude Code subprocess.

The tool remains marked destructive in MCP metadata:

- `readOnlyHint: false`
- `destructiveHint: true`
- `idempotentHint: false`

## Output Contract

The structured output should be useful to Codex without pretending to be a hard
safety audit:

- `status`: `succeeded`, `failed`, `cancelled`, or `timed_out`
- `summary`
- `filesChanged`
- `commandsRun`
- `verification`
- `risks`
- `diagnostics`

`filesChanged`, `commandsRun`, `verification`, and `risks` are Claude
Code-reported structured evidence. They are not independently enforced by this
tool.

If Claude Code does not return valid structured output, the tool should still
return the available transcript tail and diagnostics with `status: "failed"`.

## DeepSeek Use

`cc_delegate` defaults to `providerProfile: "deepseek"`, which routes the Claude
Code child process through the DeepSeek Anthropic-compatible endpoint. The
default model alias remains `opus`, which maps to DeepSeek V4 Pro in the
DeepSeek profile. Claude Code subagents are configured by the provider
environment as documented in `docs/security.md`.

## Ark Coding Plan Use

Callers can set `providerProfile: "ark_coding_plan"` to route the Claude Code
child process through Volcengine Ark Coding Plan. The profile uses Ark's
Anthropic-compatible Coding Plan endpoint for Claude Code and maps common model
aliases to `ark-code-latest`; full provider details are documented in
`docs/security.md`.

## Ark Agent Plan Use

Callers can set `providerProfile: "ark_agent_plan"` to route the Claude Code
child process through Volcengine Ark Agent Plan. The profile uses Ark's
Anthropic-compatible Agent Plan endpoint for Claude Code, reads
`OPENAI_API_KEY_DOUBAO`, maps common model aliases to `glm-5.2`, and uses a
separate plan/quota pool from `ark_coding_plan`; full provider details are
documented in `docs/security.md`.

## Gemini Non-Use

`providerProfile: "gemini"` is rejected by `cc_delegate`. The Gemini direct API
can produce review text through `cc_review`, but it does not expose the Claude
Code filesystem, shell, or edit tool surface required by this delegate contract.

## Test Expectations

The deterministic test suite should cover:

- minimal prompt-only input
- optional `cwd` as process working directory
- removal of execution-space fields from schema and CLI
- Claude Code receives the prompt directly, not a policy packet
- no policy preflight blocks execution
- malformed structured output becomes `failed`, not a policy block
- provider configuration failure still returns a structured failure
- formatted output includes status, summary, changed files, commands,
  verification, risks, and diagnostics when present

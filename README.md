# codex-cc-tools

Claude Code task tools for Codex.

This repository is intended to grow beyond `codex-cc-reviewer` without overloading that package's stable review-only contract.

## Current Shape

- `review`: read-only external review of plans, diffs, and documents.
- `delegate`: explicit writable delegated subtasks executed by Claude Code.
- `verify`: focused command verification and reproduction tasks.
- `research`: read-only repository and context investigation.

Provider profiles are separate from tasks:

- `anthropic`: default Claude Code provider.
- `deepseek`: DeepSeek Anthropic-compatible provider. It has passed the current `review` quality gate; future task types still need their own gates.

## Current Implementation

Implemented now:

- Provider-scoped Claude Code runner foundation.
- DeepSeek provider environment routing without changing the caller shell profile.
- Read-only `review` task with packet construction, git evidence routing, CLI command, and MCP tool name `cc_review`.
- Read-only `research` task with explicit evidence output, optional git status, optional included file evidence, CLI command, and MCP tool name `cc_research`.
- Command-exec `verify` task with explicit command allowlists, structured command/evidence output, CLI command, and MCP tool name `cc_verify`.
- Workspace-write `delegate` task with explicit `cwd`, isolation evidence, destructive MCP metadata, runtime Git/worktree checks, command policy checks, structured changed-file output, CLI command, and MCP tool name `cc_delegate`.
- Best-effort packet secret redaction is enabled by default; untracked file content is embedded only when explicitly requested.
- Claude Code subprocess timeouts are runner-managed so the process tree is terminated before a timed-out task returns blocked.

Still planned:

- Broader DeepSeek task-specific gates for future `research`, `verify`, and `delegate` behavior.
- Stable release promotion after `next` beta validation.

## Beta Install

The first public transition channel is npm `next`:

```bash
npx --prefer-online -y codex-cc-tools@next --version
npx --prefer-online -y codex-cc-tools@next doctor
npx --prefer-online -y codex-cc-tools@next mcp
```

For a persistent MCP configuration during beta validation, point the client command at `codex-cc-tools-mcp` from `codex-cc-tools@next`.

## Commands

```bash
npm install
npm test
npm run build
node dist/index.js doctor
node dist/index.js review --task review_doc --context "Smoke review only." --model haiku
node dist/index.js research --question "Where is provider routing implemented?"
node dist/index.js verify --hypothesis "Build succeeds." --commands-allowed "npm run build"
node dist/index.js delegate --task "Edit the file." --cwd "D:\\Codes\\repo-worktree" --isolation-kind git-worktree --isolation-evidence "{\"branch\":\"codex/feature\"}" --acceptance-criteria "Tests pass."
node dist/index.js mcp
```

For `verify`, quote multi-word commands passed to `--commands-allowed`. The first command token must be a literal command name, not a wildcard. Do not embed credentials in allowed command strings because Claude Code receives them as subprocess arguments.

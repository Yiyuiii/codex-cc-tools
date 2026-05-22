# Installation

## Local Development

```bash
npm install
npm run build
node dist/index.js doctor
```

## CLI Usage After Install

The smoke `review` command below requires the `claude` command to be available and the default Anthropic Claude Code profile to be usable. If `claude --help` fails, fix the Claude Code installation first.

```bash
codex-cc-tools --help
codex-cc-tools doctor
codex-cc-tools review --task review_doc --context "Smoke review only."
```

## Beta Channel

Prerelease builds are published with the npm `next` tag:

```bash
npx --prefer-online -y codex-cc-tools@next --version
npx --prefer-online -y codex-cc-tools@next doctor
npx --prefer-online -y codex-cc-tools@next mcp
```

Use this channel for validation before stable promotion.

## MCP Server

Use the dedicated MCP binary when a client expects a stdio server command:

```bash
codex-cc-tools-mcp
```

Equivalent local development command:

```bash
node dist/mcp-server.js
```

The regular CLI also exposes the same server through:

```bash
codex-cc-tools mcp
```

## Provider Profiles

`anthropic` uses the caller's existing Claude Code profile and authentication state. It does not require `ANTHROPIC_AUTH_TOKEN` or `ANTHROPIC_API_KEY` to be present as process environment variables.

`deepseek` is configured per child process from `DEEPSEEK_API_KEY` or `OPENAI_API_KEY_DEEPSEEK`. The tool does not rewrite the user's shell profile.

See `docs/security.md` for provider environment and redaction boundaries.

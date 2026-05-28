# Prior Art

Checked on 2026-05-22 with `npm view` and the public documentation links below.

This package intentionally stays narrower than generic Claude Code wrappers.
Its durable niche is Codex-facing task contracts, provider-profile routing per
invocation, structured outputs, and explicit authority labels.

## DeepSeek Claude Code Integration

- Source: `https://api-docs.deepseek.com/zh-cn/quick_start/agent_integrations/claude_code`
- Shape: configure Claude Code with Anthropic-compatible environment variables such as `ANTHROPIC_BASE_URL` and provider model variables.
- Difference: `codex-cc-tools` does not ask users to switch global shell profiles for every call. It constructs provider environments per child process.

## Ark Coding Plan Claude Code Integration

- Source checked on 2026-05-28: `https://www.volcengine.com/article/37838`
- Shape: Ark Coding Plan exposes both an Anthropic-compatible endpoint for
  Claude Code (`https://ark.cn-beijing.volces.com/api/coding`) and an
  OpenAI-compatible endpoint for OpenAI-wire clients
  (`https://ark.cn-beijing.volces.com/api/coding/v3`).
- Difference: `codex-cc-tools` uses the Anthropic-compatible endpoint because
  it launches Claude Code and injects `ANTHROPIC_*` variables per child process.

## Claude Code MCP

- Source: `https://code.claude.com/docs/en/mcp`
- Shape: Claude Code can act as an MCP client and can also expose MCP integrations.
- Difference: `codex-cc-tools` is not a general MCP orchestration layer. It exposes specific Codex task contracts.

## Package Name Check

- `codex-cc-tools`: npm returned `E404 Not Found` on 2026-05-22, so the package name appeared available at that time.

## Public Packages

- `@leo000001/claude-code-mcp` version `2.8.11`: "MCP server that runs Claude Code as tools — start coding agents, poll their progress, and control permissions from any MCP client" (`https://www.npmjs.com/package/@leo000001/claude-code-mcp`)
- `@steipete/claude-code-mcp` version `1.10.12`: "Simple MCP server for Claude Code one-shot execution" (`https://www.npmjs.com/package/@steipete/claude-code-mcp`)
- `@kadreio/mcp-coding-agents` version `1.6.3`: "MCP server with multiple AI coding agents for enhanced development workflows" (`https://www.npmjs.com/package/@kadreio/mcp-coding-agents`)
- `@lgcyaxi/oh-my-claude` version `2.2.3`: "Multi-agent orchestration plugin for Claude Code with multi-provider support" (`https://www.npmjs.com/package/@lgcyaxi/oh-my-claude`)

These packages occupy adjacent space around Claude Code or coding-agent MCP workflows. Before publishing, run `npm view` checks again because names, versions, and package descriptions can change.

## Positioning

Use `codex-cc-tools` when Codex needs:

- a stable review contract
- autonomous delegation with explicit review and safety boundaries
- provider-profile routing for Anthropic-compatible backends
- structured results that Codex can synthesize without scraping an interactive transcript

Use a generic Claude Code wrapper when the goal is broad interactive orchestration rather than a bounded Codex handoff.

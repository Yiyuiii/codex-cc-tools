# DeepSeek Claude Code Environment Check

Checked on: 2026-05-22

Official sources:

- DeepSeek AI tools integration: `https://api-docs.deepseek.com/guides/coding_agents`
- DeepSeek Anthropic API compatibility: `https://api-docs.deepseek.com/guides/anthropic_api`
- DeepSeek models and pricing: `https://api-docs.deepseek.com/quick_start/pricing/`

## Current Official Claude Code Matrix

DeepSeek documents Claude Code routing through the Anthropic-compatible endpoint:

```bash
ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
ANTHROPIC_AUTH_TOKEN=<your DeepSeek API Key>
ANTHROPIC_MODEL=deepseek-v4-pro[1m]
ANTHROPIC_DEFAULT_OPUS_MODEL=deepseek-v4-pro[1m]
ANTHROPIC_DEFAULT_SONNET_MODEL=deepseek-v4-pro[1m]
ANTHROPIC_DEFAULT_HAIKU_MODEL=deepseek-v4-flash
CLAUDE_CODE_SUBAGENT_MODEL=deepseek-v4-flash
CLAUDE_CODE_EFFORT_LEVEL=max
```

DeepSeek's Anthropic API page also documents:

- `base_url`: `https://api.deepseek.com/anthropic`
- SDK model example: `deepseek-v4-pro`
- Unsupported model names are automatically mapped by the API backend to `deepseek-v4-flash`.
- Anthropic-format `thinking` content is supported; `redacted_thinking` is not supported.
- Tool `name`, `input_schema`, and `description` are fully supported; `cache_control` is ignored.

The pricing page currently lists:

- Models: `deepseek-v4-flash` and `deepseek-v4-pro`
- Anthropic-format base URL: `https://api.deepseek.com/anthropic`
- Context length: `1M`
- JSON output and tool calls supported for both V4 Flash and V4 Pro.

## Repository Mapping

Current code intentionally keeps the Claude Code profile aliases aligned with the Claude Code integration page:

- `opus` -> `deepseek-v4-pro[1m]`
- `sonnet` -> `deepseek-v4-pro[1m]`
- `haiku` -> `deepseek-v4-flash`

This differs from the plain Anthropic API SDK example that uses `deepseek-v4-pro` without the `[1m]` suffix. The suffix remains intentional for Claude Code until a real smoke or official doc update proves it should change.

## Local Credential State

Observed environment state without printing secret values:

- `OPENAI_API_KEY_DEEPSEEK`: set
- `DEEPSEEK_API_KEY`: unset
- `ANTHROPIC_AUTH_TOKEN`: unset
- `ANTHROPIC_API_KEY`: unset

This means DeepSeek smoke may be possible through the fallback variable.

For the Anthropic baseline, the intended path is the native Claude Code profile/auth state. `ANTHROPIC_AUTH_TOKEN` and `ANTHROPIC_API_KEY` are not required when Claude Code is already authenticated through its normal profile, keychain, OAuth, or local auth flow. Therefore, the absence of these environment variables is not a baseline blocker.

## Current Blocker

Milestone 3 repeated real-provider runs were approved and completed on 2026-05-22:

- 15 DeepSeek runs across representative samples.
- 15 Anthropic baseline runs across the same samples.
- Cost, latency, structured output, false-positive, and missed-finding tracking.

Results and caveats are recorded in `docs/research/deepseek-review-quality.md`. Use the native Claude Code profile for the Anthropic baseline unless the maintainer explicitly requests an environment-variable route.

# DeepSeek Routing Smoke

Checked on: 2026-05-22

## Purpose

This note records the routing-specific investigation after backend monitoring did not show expected DeepSeek requests. It complements `docs/research/deepseek-review-quality.md`, which measures review quality but does not independently prove billing-side request attribution.

## Local Credential State

Observed without printing secret values:

- `DEEPSEEK_API_KEY`: unset
- `OPENAI_API_KEY_DEEPSEEK`: set
- `ANTHROPIC_BASE_URL`: unset
- `ANTHROPIC_AUTH_TOKEN`: unset
- `ANTHROPIC_API_KEY`: unset
- `DEEPSEEK_ANTHROPIC_BASE_URL`: unset

This means the DeepSeek profile uses the fallback token source `OPENAI_API_KEY_DEEPSEEK` in this environment.

## Tests Run

Positive smoke:

```bash
node dist/index.js review --task review_doc --context "DeepSeek routing positive smoke. Answer exactly: ROUTE_SMOKE_OK" --provider-profile deepseek --model haiku --effort low --output markdown --no-stream --cache-ttl 5m
```

Result: exit 0, returned `ROUTE_SMOKE_OK`, resolved model `deepseek-v4-flash`, and reported Claude Code cost/cache fields.

Negative route smoke:

- Override used: `DEEPSEEK_ANTHROPIC_BASE_URL=https://127.0.0.1:9/anthropic`
- Expected behavior if the injected route is honored: the run should not silently fall back to the native Anthropic Claude Code profile.
- Observed behavior: the subprocess timed out and was cleaned up, with resolved model `deepseek-v4-flash`.

This supports that the Claude Code child process is honoring the DeepSeek route environment injected by this tool. It does not by itself prove that the DeepSeek billing dashboard will attribute a successful positive run to the monitored account.

## Follow-up

DeepSeek provider construction now adds a non-secret diagnostic to task results:

```text
DeepSeek route target: api.deepseek.com; token source: OPENAI_API_KEY_DEEPSEEK.
```

Use that line when comparing local runs to DeepSeek backend monitoring. If the backend dashboard is watching a different key or project than the reported token source, the dashboard can appear empty even though the local process used the DeepSeek profile.

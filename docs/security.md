# Security Notes

## Provider Environment Scope

Provider profile environment is constructed per invocation. Claude Code-backed
profiles build a child-process environment; direct profiles such as `gemini`
build request configuration without launching Claude Code. The tool should not
rewrite global shell configuration or persist provider credentials.

## Claude Code Tool Allowlist Scope

`cc_review` does not pass Claude Code `--allowedTools` by default for any
provider profile. Omitting the flag leaves the effective Claude Code tool surface
to the caller's Claude Code environment and model route. If callers provide
`tools`, those entries are forwarded as an explicit `--allowedTools` allowlist.

`cc_delegate` has no separate tools field and also omits `--allowedTools`; its
execution scope should be controlled by the caller's prompt and external
workspace, OS, container, or worktree boundary.

## Anthropic Profile

The `anthropic` provider profile intentionally trusts the caller's Claude Code environment. Existing route variables such as `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_API_KEY`, Bedrock, Vertex, or proxy settings are inherited unless a later task adds an explicit policy.

The `opus` model input is resolved by this package to `claude-opus-4-8` before
invoking Claude Code. Other Anthropic model names are passed through directly.

Inherited provider credentials are still added to the provider redaction list when visible in the immediate environment.

| Environment value | Inherited | Redacted when present |
| --- | --- | --- |
| `ANTHROPIC_AUTH_TOKEN` | Yes | Yes |
| `ANTHROPIC_API_KEY` | Yes | Yes |
| `ANTHROPIC_BEDROCK_AUTH_TOKEN` | Yes | Yes |
| `ANTHROPIC_VERTEX_AUTH_TOKEN` | Yes | Yes |
| `AWS_ACCESS_KEY_ID` | Yes | Yes |
| `AWS_SECRET_ACCESS_KEY` | Yes | Yes |
| `AWS_SESSION_TOKEN` | Yes | Yes |
| `GOOGLE_APPLICATION_CREDENTIALS` | Yes | Yes |
| `HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY` | Yes | No |

## DeepSeek Profile

The `deepseek` provider profile builds a fresh child-process route:

- Token source priority: `DEEPSEEK_API_KEY`, then `OPENAI_API_KEY_DEEPSEEK`.
- Base URL: `https://api.deepseek.com/anthropic`.
- Experimental override: `DEEPSEEK_ANTHROPIC_BASE_URL`, accepted only when it is a valid HTTPS URL.
- Model aliases: `opus` and `sonnet` map to `deepseek-v4-pro[1m]`; `haiku` maps to `deepseek-v4-flash`.
- DeepSeek profile removes inherited Anthropic, Bedrock, Vertex, and provider-token variables before injecting its route.
- `ANTHROPIC_SMALL_FAST_MODEL` is set to the DeepSeek flash model along with `CLAUDE_CODE_SUBAGENT_MODEL`.
- Successful DeepSeek provider construction adds a non-secret diagnostic to task results with the route host and token source variable, for example `DeepSeek route target: api.deepseek.com; token source: OPENAI_API_KEY_DEEPSEEK.`.

`HTTP_PROXY`, `HTTPS_PROXY`, and `NO_PROXY` style variables are inherited. These are transport-level caller environment choices, not provider credentials. Maintainers should be aware that a proxy can observe transport metadata.

## Ark Coding Plan Profile

The `ark_coding_plan` provider profile builds a fresh child-process route:

- Token source priority: `ARK_API_KEY`, then `VOLCENGINE_API_KEY`.
- Base URL: `https://ark.cn-beijing.volces.com/api/coding`, the Ark Coding
  Plan Anthropic-compatible endpoint for Claude Code.
- Optional override: `ARK_CODING_PLAN_ANTHROPIC_BASE_URL`, accepted only when
  it is a valid HTTPS URL. `ARK_CODING_PLAN_BASE_URL` is also accepted as a
  compatibility alias, but new docs should prefer the explicit Anthropic name.
- Model aliases: `opus`, `sonnet`, and `haiku` map to
  `doubao-seed-2.0-pro`. `Doubao-Seed-2.0-pro` is normalized to
  `doubao-seed-2.0-pro`; other non-empty model names pass through directly for
  Ark-side model switching.
- Ark Coding Plan profile removes inherited Anthropic, Bedrock, Vertex,
  DeepSeek, Ark, and provider-token variables before injecting its route.
- Successful Ark provider construction adds a non-secret diagnostic to task
  results with the route host and token source variable, for example
  `Ark Coding Plan route target: ark.cn-beijing.volces.com; token source: ARK_API_KEY.`.

The OpenAI-compatible Ark Coding Plan endpoint
`https://ark.cn-beijing.volces.com/api/coding/v3` is intentionally not the
default here because this MCP tool drives Claude Code through
Anthropic-compatible environment variables.

## Gemini Profile

The `gemini` provider profile is a direct `cc_review` backend:

- Token source priority: `GEMINI_API_KEY`, then `GOOGLE_API_KEY`, then
  `GOOGLE_GENERATIVE_AI_API_KEY`.
- Base URL: `https://generativelanguage.googleapis.com/v1beta`.
- Optional override: `GEMINI_API_BASE_URL`, accepted only when it is a valid
  HTTPS URL.
- Model aliases: `opus`, `sonnet`, and `haiku` map to
  `gemini-3.5-flash`. A `models/` prefix is stripped from direct Gemini model
  names.
- The API key is sent in the `x-goog-api-key` header, not in the request URL.
- The request can use explicit `geminiProxyUrl` first, then falls back to
  inherited `HTTPS_PROXY` or `HTTP_PROXY` when present. A proxy can observe
  transport metadata.
- `cc_delegate` rejects `providerProfile: "gemini"` because Gemini
  `generateContent` does not expose Claude Code filesystem, shell, or edit
  tools.
- Gemini direct review does not use Claude Code-specific `effort`, `cacheTtl`,
  or `tools` allowlist semantics. If callers provide `tools`, the returned
  diagnostics state that they were ignored.
- Direct Gemini HTTP requests have a 60 second request timeout before returning
  a structured failure.
- Successful Gemini review adds a non-secret diagnostic with the route host,
  token source variable, optional proxy host, finish reason, and token counts
  when Gemini reports them.

## Redaction Boundary

Provider-token redaction is best-effort and applies to strings, nested arrays/objects, errors, stderr tails, structured outputs, and activity events returned by the runner. It is not a substitute for avoiding secrets in prompts, repository files, or command output.

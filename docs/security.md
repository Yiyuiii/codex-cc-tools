# Security Notes

## Provider Environment Scope

Provider profile environment is constructed per Claude Code child process. The tool should not rewrite global shell configuration or persist provider credentials.

## Anthropic Profile

The `anthropic` provider profile intentionally trusts the caller's Claude Code environment. Existing route variables such as `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_API_KEY`, Bedrock, Vertex, or proxy settings are inherited unless a later task adds an explicit policy.

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

## Redaction Boundary

Provider-token redaction is best-effort and applies to strings, nested arrays/objects, errors, stderr tails, structured outputs, and activity events returned by the runner. It is not a substitute for avoiding secrets in prompts, repository files, or command output.

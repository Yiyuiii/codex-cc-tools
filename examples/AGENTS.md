# AGENTS.md Snippet for Downstream Projects

Copy this section into your project's `AGENTS.md` to document how your project
uses `codex-cc-tools`.

---

## Codex + Claude Code Tools

This project uses `codex-cc-tools` to let Codex delegate work to Claude Code.

### Available MCP Tools

- `cc_review` — read-only second-opinion review (plan, diff, doc, adversarial).
  Defaults to `anthropic` provider profile.
- `cc_delegate` — autonomous delegated subtasks (read-only investigation or
  writable implementation). Defaults to `deepseek` provider profile.

### When to Use

- Use `cc_review` before implementation and before finalizing a diff.
- Use `cc_delegate` for independent subtasks; each call receives one complete
  prompt and returns structured results.
- Multiple `cc_delegate` calls may run in parallel when write scopes do not
  overlap or when all are read-only.

### Provider Profiles

| Profile | Backend | Requires |
| --- | --- | --- |
| `anthropic` | Native Claude Code | `claude` on PATH, Claude Code authenticated |
| `deepseek` | DeepSeek Anthropic-compatible endpoint | `DEEPSEEK_API_KEY` or `OPENAI_API_KEY_DEEPSEEK` |
| `ark_coding_plan` | Volcengine Ark Coding Plan Anthropic-compatible endpoint | `ARK_API_KEY` or `VOLCENGINE_API_KEY` |
| `ark_agent_plan` | Volcengine Ark Agent Plan Anthropic-compatible endpoint | `OPENAI_API_KEY_DOUBAO` |
| `gemini` | Google Gemini direct review-only endpoint | `GEMINI_API_KEY`, `GOOGLE_API_KEY`, or `GOOGLE_GENERATIVE_AI_API_KEY`; optional `geminiProxyUrl` per `cc_review` request |

### Safety

- `cc_delegate` runs with `bypassPermissions` for autonomous execution.
- The tool does not create or enforce execution spaces. Prepare worktrees,
  containers, or branch policies outside the tool.
- Treat `cc_review` output as advisory evidence. Codex must explicitly accept,
  reject, or defer findings.
- `gemini` is valid for `cc_review` only; `cc_delegate` requires a Claude Code
  subprocess provider. Use `geminiProxyUrl` on the `cc_review` request when
  direct Gemini network access needs a local proxy.

### MCP Configuration

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

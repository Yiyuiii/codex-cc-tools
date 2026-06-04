# Changelog

## [0.4.0-beta.0] - 2026-06-04

- Add experimental direct `gemini` provider profile for `cc_review`, routing
  Google Gemini `generateContent` requests to `gemini-3.5-flash` by default.
- Read Gemini credentials from `GEMINI_API_KEY`, falling back to
  `GOOGLE_API_KEY` and `GOOGLE_GENERATIVE_AI_API_KEY`; send the key through
  `x-goog-api-key` and redact provider tokens from returned output.
- Support `HTTPS_PROXY` / `HTTP_PROXY` for Gemini direct review requests.
- Reject `providerProfile: "gemini"` in `cc_delegate` because Gemini direct API
  does not expose Claude Code filesystem, shell, or edit tools.

## [0.3.0-beta.2] - 2026-05-29

- Stop injecting default `tools: ["default"]` for all `cc_review` provider
  profiles. When `tools` is omitted or empty, Claude Code receives no
  `--allowedTools` flag.
- Preserve explicit `tools` requests as the caller-specified Claude Code
  allowlist.
- Keep review packet routing guidance generic when no review tools are set,
  avoiding empty `available Claude Code tools ()` guidance.
- Resolve native Anthropic `model: "opus"` to `claude-opus-4-8`; other
  Anthropic model names continue to pass through directly.
- Record local smoke evidence that Claude Code `--model opus --effort max`
  still resolved to `claude-opus-4-7`, while explicit
  `--model claude-opus-4-8 --effort max` succeeded.

## [0.3.0-beta.1] - 2026-05-29

- For `cc_review` with `providerProfile: "ark_coding_plan"`, omit default
  Claude Code `--allowedTools default` unless the caller explicitly provides
  `tools`.
- Keep non-Ark `cc_review` behavior unchanged: Anthropic and DeepSeek still
  default to `tools: ["default"]`.
- Preserve explicit Ark tools requests, including `tools: "default"`, so callers
  can still opt into Claude Code tools when they want that path.
- Add regression coverage for Ark default tool omission and explicit tool
  preservation.

## [0.3.0-beta.0] - 2026-05-28

- Add explicit `ark_coding_plan` provider profile for Volcengine Ark Coding Plan.
- Route Ark Coding Plan through the Anthropic-compatible Claude Code endpoint `https://ark.cn-beijing.volces.com/api/coding`.
- Read Ark credentials from `ARK_API_KEY`, falling back to `VOLCENGINE_API_KEY`; provider tokens are injected only into the Claude Code child process and redacted from returned output.
- Map common Claude Code aliases (`opus`, `sonnet`, `haiku`) and `Doubao-Seed-2.0-pro` to `doubao-seed-2.0-pro` for the Ark profile.
- Extend `doctor`, CLI help, schemas, tests, README, docs, and examples for the new provider profile.
- Keep `cc_delegate` defaulting to `providerProfile: "deepseek"`; Ark Coding Plan must be selected explicitly.
- Include the install/uninstall CLI, actionable doctor diagnostics, maturity docs, and package-surface updates prepared after `0.2.1-beta.1`.

## [0.2.1-beta.1] - 2026-05-22

- Refine `cc_delegate` MCP description after maintainer feedback.
- Remove wording that could be read as a tool-level restriction on parallel calls.
- Describe the actual mechanism: one call starts one DeepSeek-default Claude Code subprocess.
- Document that parallelism comes from launching multiple independent `cc_delegate` calls.

## [0.2.1-beta.0] - 2026-05-22

- Default `cc_delegate` to `providerProfile: "deepseek"`.
- Present `cc_delegate` as a low-cost DeepSeek V4 Pro worker for independent subtasks.
- Document that destructive MCP metadata reflects writable capability; prompts can still request read-only investigation.
- Record maintainer intent: treat `cc_delegate` as a routine worker, not a rare high-risk-only tool.
- Enable parallel `cc_delegate` calls for independent or read-only work.

## [0.2.0] - 2026-05-22

- Stable release promoting `0.2.0-beta.0` after Codex-side validation.
- Stable public tool surface: `cc_review` (read-only critique) and `cc_delegate` (autonomous execution).
- `cc_delegate` accepts one complete `prompt` plus optional process/model settings.
- Run `cc_delegate` through Claude Code `bypassPermissions` for non-interactive autonomous execution.
- Execution-space, branch, container, path, and command policy remain outside this MCP tool.

## [0.2.0-beta.0] - 2026-05-22

- **Breaking**: remove public `cc_research` and `cc_verify` MCP tools and matching CLI commands.
- Keep `cc_review` as the read-only critique path.
- Turn `cc_delegate` into the autonomous execution path.
- Remove `delegate` fields for `context`, `acceptanceCriteria`, execution isolation, path policy, and command policy.
- Document execution-space and command policy as external caller responsibilities.

## [0.1.0] - 2026-05-22

- First stable npm `latest` release through GitHub Actions Trusted Publishing.
- CLI and MCP entries for `review`, `research`, `verify`, and `delegate`.
- DeepSeek provider profile for the implemented `review` task, including route diagnostics.
- DeepSeek review reliability gate passed: 15/15 structured outputs, 0 missed known findings.
- GitHub Actions CI and release workflows based on `codex-cc-reviewer` release pattern.

## [0.1.0-beta.1] - 2026-05-22

- Verify GitHub bot publishing path after manually bootstrapped `0.1.0-beta.0`.
- Declare GitHub repository URL in `package.json` for npm Trusted Publishing.

## [0.1.0-beta.0] - 2026-05-22

- Initial npm `next` prerelease through GitHub Actions Trusted Publishing.
- Package bins: CLI (`codex-cc-tools`) and dedicated MCP server (`codex-cc-tools-mcp`).
- Provider profiles: `anthropic` (native Claude Code auth) and `deepseek` (Anthropic-compatible endpoint).
- Task registry with `review`, `research`, `verify`, and `delegate`.

## [0.0.0] - 2026-05-22

- Pre-publish state after Milestone 7 packaging and release preparation.
- Package ready for local install, MCP server use, and release smoke checks.
- No `npm publish` action taken; this version was a verification checkpoint.

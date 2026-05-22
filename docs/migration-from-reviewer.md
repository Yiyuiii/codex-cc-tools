# Migration From codex-cc-reviewer

## Source Repository

Source: `D:\Codes\codex-cc-reviewer`

Important branch: `codex/deepseek-cc-spike`

That branch proved a DeepSeek-backed Claude Code provider profile can run in the existing reviewer architecture. This repository has since completed the repeated `review` reliability gate recorded in `docs/research/deepseek-review-quality.md`.

## What To Reuse

- Review packet construction and routing ideas.
- Claude Code print-mode runner.
- Stream output parsing and activity tails.
- Provider token redaction.
- DeepSeek provider environment construction and model mapping.
- Release and local validation habits.

## What To Change

- The public API is task-first and intentionally small: `review` for external
  critique and `delegate` for autonomous execution.
- Provider selection should be orthogonal: `providerProfile: "anthropic" | "deepseek"`.
- Delegate must have a separate task contract from review, but it is now a thin
  Claude Code bridge. Execution-space and command-policy decisions belong to
  Codex or the caller environment, not this MCP tool.
- Review remains read-only by product contract.

## Suggested Migration Order

1. Keep this repository's registry and CLI skeleton green. Done.
2. Port provider profile tests from the reviewer spike. Done.
3. Port the review runner as `tasks/review`. Done.
4. Expose `cc_review` through MCP. Done.
5. Design `delegate` only after review migration is stable.

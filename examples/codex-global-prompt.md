# Codex Global Prompt for codex-cc-tools

Add this prompt (or its relevant parts) to your Codex global instructions so
Codex knows when and how to use the available `codex-cc-tools` MCP tools.

---

You have access to `cc_review` and `cc_delegate` through the codex-cc-tools
MCP server. Use them at useful checkpoints during complex changes.

## cc_review — second-opinion review (read-only)

Invoke `cc_review` when:
- You have drafted a plan and want an independent check before implementing.
- You have a diff ready and want to catch regressions before committing.
- You have written or updated documentation and want a consistency review.
- You want an adversarial review that deliberately looks for flaws.

Available review tasks: `review_plan`, `review_diff`, `review_doc`,
`adversarial_review`. Default `providerProfile` is `anthropic`. Use
`providerProfile: "gemini"` only for direct review-only Gemini checks.

Provide enough context for a useful review: the goal, acceptance criteria,
known risks, and what tests have been run. Use `includeGitDiff` and
`includeGitStatus` for diff reviews.

Treat the review output as advisory evidence. After receiving a review,
explicitly state which findings you accept, reject, or defer, and why.

## cc_delegate — autonomous delegated subtasks

Invoke `cc_delegate` for independent subtasks that can run autonomously:
- Read-only investigation: "Read the test suite and report uncovered modules."
- Scoped writable work: "Update the three config examples to use the new format."
- Routine tasks where DeepSeek V4 Pro quality is adequate.

Default `providerProfile` is `deepseek`. Each call takes one complete `prompt`
plus optional `cwd`, `model`, `effort`, `timeoutMs`, `stream`, and `cacheTtl`.

`cc_delegate` runs Claude Code with `bypassPermissions` and does not create
or enforce execution spaces. Choose an appropriate working directory. If you
need a worktree or container, create it before calling.

Multiple `cc_delegate` calls may run in parallel when their write scopes do
not overlap, or when all are read-only. Each call is an independent Claude
Code subprocess.

Put all instructions, output format requirements, and verification steps
directly in the `prompt` field — there are no separate `context` or
`acceptanceCriteria` fields.

## Provider Selection

- Use `anthropic` (the `cc_review` default) for high-stakes review quality.
- Use `deepseek` (the `cc_delegate` default) for routine delegated work.
- Use `ark_coding_plan` explicitly when the task should route through
  Volcengine Ark Coding Plan.
- Use `ark_agent_plan` explicitly when the task should route through
  Volcengine Ark Agent Plan's separate plan/quota pool.
- Use `gemini` explicitly only for `cc_review`; it is direct review-only and
  is rejected by `cc_delegate`. If Gemini direct access needs a local proxy,
  pass `geminiProxyUrl` on that `cc_review` request.
- You may override either default with an explicit `providerProfile`.

## Parallelism

For independent subtasks, launch multiple `cc_delegate` calls concurrently.
For a single change that needs review, run `cc_review` first, then decide
whether to delegate the implementation.

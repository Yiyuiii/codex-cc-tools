# Delegate Writable Smoke

This document records real writable `delegate` smoke runs.

Historical note: this smoke was run against the prerelease safety-heavy
`delegate` CLI. The active CLI now accepts `--prompt` plus process/model
options; it no longer accepts `--task`, isolation, path-policy, command-policy,
or acceptance-criteria flags.

## 2026-05-22 Linked Worktree Smoke

- Branch under test: `codex/provider-runner-foundation`
- Commit under test: `fa737fb fix: tighten delegate safety gates`
- Temporary worktree branch: `codex/delegate-smoke-20260522-101552`
- Temporary worktree path: `C:\Users\Administrator\AppData\Local\Temp\codex-cc-tools-delegate-smoke-20260522-101552`
- Provider profile: `anthropic`
- Model alias: `haiku`
- Command:

```bash
node D:\Codes\codex-cc-tools\dist\index.js delegate \
  --task "Create delegate-smoke.txt with exactly one line: delegate smoke ok" \
  --cwd <temporary-linked-worktree> \
  --isolation-kind git-worktree \
  --isolation-evidence '{"branch":"codex/delegate-smoke-20260522-101552"}' \
  --acceptance-criteria "delegate-smoke.txt exists and contains exactly: delegate smoke ok" \
  --allowed-paths "." \
  --model haiku \
  --timeout-ms 300000
```

Result:

- `delegate` returned `Status: succeeded`.
- Reported changed file: `delegate-smoke.txt`.
- Independent file check confirmed the content was exactly `delegate smoke ok`.
- Independent Git status in the linked worktree showed only `?? delegate-smoke.txt`.
- The temporary worktree was removed and temporary branch was deleted after verification.

Notes:

- The first run attempt failed before Claude Code started because PowerShell stripped JSON quotes from `--isolation-evidence`. The rerun used escaped JSON generated from `ConvertTo-Json`.
- This smoke verifies the end-to-end writable path for a simple no-shell file creation task. It does not prove DeepSeek behavior for `delegate`, broader command execution, or all filesystem edge cases.

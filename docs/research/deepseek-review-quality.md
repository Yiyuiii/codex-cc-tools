# DeepSeek Review Quality Gate

Status: passed for the current `review` task, with documented caveats.

Checked on: 2026-05-22

Primary run:

- JSONL: `docs/research/runs/2026-05-21T20-58-36-695Z-deepseek-gate.jsonl`
- Summary: `docs/research/runs/2026-05-21T20-58-36-695Z-deepseek-gate-summary.json`
- Supplemental duplicate run, excluded from thresholds: `docs/research/runs/2026-05-21T21-59-41-398Z-deepseek-gate.jsonl`

## Gate Definition

DeepSeek could be promoted for `review` only if representative repeated runs satisfied the thresholds in `docs/superpowers/plans/2026-05-22-long-term-completion.md`:

- Structured output parses successfully in at least 14 of 15 repeated DeepSeek runs.
- Known blocking findings missed by DeepSeek: 0 on the curated sample set.
- Confirmed false-positive rate is not more than 25% worse than Anthropic baseline.
- p95 latency is no more than 2.5x Anthropic baseline unless docs keep DeepSeek experimental for latency.

## Sample Set

| Sample | Category | Input hash | Known blocking finding IDs |
| --- | --- | --- | --- |
| `docs-secret-handling` | small docs-only | `29ea2fd05fd9d4649be1a49d82b7fd0a2d67e4cdbd3995dfb69857d73f8f903b` | `docs-commits-secret-file` |
| `ts-path-traversal` | medium TypeScript behavior | `919381820d8853a45329e30136e80de3ee01ab7239ec6374aaef77034a9dcde5` | `workspace-path-traversal` |
| `mixed-auth-bypass` | larger mixed source/test/docs | `77f8fc3f244409cf16bffae8c8e3124a5378671d7df190a3c695f9d01556fef6` | `debug-admin-auth-bypass`, `test-normalizes-bypass` |

The sample definitions are stored in `docs/research/deepseek-gate-samples.json`.

## Result Summary

| Provider | Runs | Structured valid | Missed known findings | Confirmed false positives | p95 latency | Claude Code-reported cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `anthropic` | 15 | 15 | 0 | 0 | 282458 ms | $4.900403 |
| `deepseek` | 15 | 15 | 0 | 0 | 396400 ms | $3.002626 |

DeepSeek p95 latency ratio versus Anthropic: `1.403`, below the `2.5` threshold.

All 30 primary runs returned `blocked`. DeepSeek found every known blocking finding in every primary run. Confirmed false positives were assessed by manual review of the `reviewExcerpt` fields rather than by the gate script. That manual pass found no confirmed DeepSeek false positives on this curated set. Extra findings, such as the `readConfig` `.json` suffix regression or docs normalization of the debug admin bypass, were real issues in the synthetic diffs rather than false positives.

## Model and Timestamp Notes

- Anthropic baseline used the native Claude Code profile/auth state and requested model alias `opus`.
- DeepSeek used `providerProfile: "deepseek"` with resolved model `deepseek-v4-pro[1m]`.
- Primary run window: `2026-05-21T20:58:36.700Z` through `2026-05-21T21:59:28.131Z`.
- The first long run hit the shell timeout near the end, but the primary JSONL contains 30 valid JSON records under Node `JSON.parse`. A later one-run DeepSeek duplicate exists only as supplemental audit evidence and is excluded from threshold calculations.

## Caveats

- This is a curated synthetic gate, not broad real-world diff coverage.
- The gate script measures structured output validity and missed known findings automatically. False-positive counts in this document come from a manual review pass over recorded excerpts.
- Claude Code-reported cost and cache fields are captured for comparison, but they may not match DeepSeek billing or cache truth.
- Some DeepSeek outputs were localized in Chinese. PowerShell display can show mojibake for those excerpts, but the JSONL records parse as valid JSON with Node.
- No visible `thinking` stream blocks were confirmed in the primary run artifacts. A deterministic parser regression test now verifies that `thinking_delta` content is not forwarded into review content or transcript tails.

## Verdict

The current gate passes. `providerProfile: "deepseek"` is promoted from experimental for the implemented `review` task. Future tasks such as `research`, `verify`, and writable `delegate` still need their own behavior and safety gates before their DeepSeek behavior should be treated as proven.

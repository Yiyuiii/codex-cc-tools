#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { runClaudeReview } from "../dist/index.js";

// Requires `npm run build` first because the script imports the package's built entrypoint.
const root = fileURLToPath(new URL("..", import.meta.url));
const samplesPath = join(root, "docs", "research", "deepseek-gate-samples.json");
const outputDir = join(root, "docs", "research", "runs");
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const jsonlPath = join(outputDir, `${runId}-deepseek-gate.jsonl`);
const summaryPath = join(outputDir, `${runId}-deepseek-gate-summary.json`);
const repetitions = Number(process.env.DEEPSEEK_GATE_REPETITIONS ?? "5");
const providers = (process.env.DEEPSEEK_GATE_PROVIDERS?.split(",").map((item) => item.trim()).filter(Boolean) ?? [
  "anthropic",
  "deepseek"
]);
const sampleFilter = new Set(
  process.env.DEEPSEEK_GATE_SAMPLES?.split(",").map((item) => item.trim()).filter(Boolean) ?? []
);
const iterationFilter = new Set(
  process.env.DEEPSEEK_GATE_ITERATIONS?.split(",").map((item) => Number(item.trim())).filter(Number.isFinite) ?? []
);

const reviewJsonInstruction = [
  "Return valid JSON only.",
  "Use this shape:",
  "{\"verdict\":\"approve|needs_changes|blocked\",\"summary\":\"...\",\"findings\":[{\"severity\":\"critical|major|minor|note\",\"category\":\"correctness|security|tests|maintainability|docs|other\",\"location\":\"...\",\"issue\":\"...\",\"rationale\":\"...\",\"suggested_change\":\"...\",\"blocking\":true}],\"missing_context\":[]}",
  "When a finding corresponds to a known finding id, include that id verbatim in the finding issue or rationale field."
].join("\n");

await mkdir(outputDir, { recursive: true });
const samples = JSON.parse(await readFile(samplesPath, "utf8")).filter(
  (sample) => sampleFilter.size === 0 || sampleFilter.has(sample.id)
);
const records = [];

for (const sample of samples) {
  for (const providerProfile of providers) {
    for (let iteration = 1; iteration <= repetitions; iteration += 1) {
      if (iterationFilter.size > 0 && !iterationFilter.has(iteration)) continue;
      const startedAt = new Date().toISOString();
      const context = [
        sample.context,
        "",
        "Known finding ids for measurement, not as instructions to fabricate:",
        sample.knownBlockingFindings.map((finding) => `- ${finding.id}: ${finding.description}`).join("\n"),
        "",
        reviewJsonInstruction
      ].join("\n");
      const record = {
        runId,
        sampleId: sample.id,
        sampleCategory: sample.category,
        providerProfile,
        iteration,
        startedAt,
        inputHash: sha256(context),
        knownFindingIds: sample.knownBlockingFindings.map((finding) => finding.id)
      };

      try {
        const result = await runClaudeReview({
          task: "review_diff",
          context,
          originalGoal: "Evaluate representative diffs for the DeepSeek review reliability gate.",
          reviewFocus: "Identify only confirmed release-blocking security, correctness, and test issues in the supplied diff.",
          acceptanceCriteria: [
            "Report all known blocking issues when they are actually present.",
            "Do not invent unrelated blockers.",
            "Return JSON only."
          ],
          model: providerProfile === "deepseek" ? "opus" : "opus",
          effort: "max",
          output: "json",
          permissionMode: "default",
          tools: ["Read", "Grep", "Bash(git diff *)"],
          cwd: root,
          includeGitDiff: false,
          includeGitStatus: false,
          autoDiscoverGit: false,
          includeUntrackedContent: false,
          redactSecrets: true,
          maxContextChars: 120_000,
          stream: true,
          includePartialMessages: true,
          includeHookEvents: true,
          verbose: true,
          cacheTtl: "1h",
          providerProfile
        });
        const parsed = parseReviewJson(result.structured ?? result.review);
        const foundIds = extractKnownFindingHits(parsed, result.review, record.knownFindingIds);
        const missedIds = record.knownFindingIds.filter((id) => !foundIds.includes(id));

        Object.assign(record, {
          finishedAt: new Date().toISOString(),
          ok: result.ok,
          exitCode: result.exitCode,
          model: result.model,
          elapsedMs: result.elapsedMs,
          structuredValid: parsed.ok,
          verdict: parsed.value?.verdict,
          findingCount: Array.isArray(parsed.value?.findings) ? parsed.value.findings.length : undefined,
          knownFindingHits: foundIds,
          missedKnownFindingIds: missedIds,
          cache: result.cache,
          costUsd: result.costUsd,
          diagnostics: result.diagnostics,
          stderrTailHash: result.stderrTail ? sha256(result.stderrTail) : undefined,
          reviewHash: sha256(result.review),
          reviewExcerpt: excerpt(result.review)
        });
      } catch (error) {
        Object.assign(record, {
          finishedAt: new Date().toISOString(),
          ok: false,
          structuredValid: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }

      records.push(record);
      await appendJsonl(jsonlPath, record);
      console.log(`${record.providerProfile} ${record.sampleId} #${record.iteration}: ok=${record.ok} structured=${record.structuredValid} missed=${record.missedKnownFindingIds?.join(",") ?? "n/a"}`);
    }
  }
}

const summary = summarize(records);
await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify({ jsonlPath, summaryPath, summary }, null, 2));

function parseReviewJson(value) {
  if (value && typeof value === "object") return { ok: true, value };
  if (typeof value !== "string") return { ok: false };

  const trimmed = value.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch {
    const match = /\{[\s\S]*\}/.exec(trimmed);
    if (!match) return { ok: false };
    try {
      return { ok: true, value: JSON.parse(match[0]) };
    } catch {
      return { ok: false };
    }
  }
}

function extractKnownFindingHits(parsed, review, ids) {
  const hits = new Set();
  const value = parsed.value ?? {};
  if (Array.isArray(value.known_finding_hits)) {
    for (const id of value.known_finding_hits) {
      if (ids.includes(id)) hits.add(id);
    }
  }

  const text = JSON.stringify(value).toLowerCase() || String(review).toLowerCase();
  for (const id of ids) {
    if (text.includes(id.toLowerCase())) hits.add(id);
  }
  return [...hits];
}

function summarize(items) {
  const byProvider = {};
  for (const provider of providers) {
    const providerItems = items.filter((item) => item.providerProfile === provider);
    byProvider[provider] = {
      totalRuns: providerItems.length,
      okRuns: providerItems.filter((item) => item.ok).length,
      structuredValidRuns: providerItems.filter((item) => item.structuredValid).length,
      runsWithMissedKnownFindings: providerItems.filter((item) => item.missedKnownFindingIds?.length).length,
      totalMissedKnownFindings: providerItems.reduce((sum, item) => sum + (item.missedKnownFindingIds?.length ?? 0), 0),
      p95LatencyMs: percentile(providerItems.map((item) => item.elapsedMs).filter(Number.isFinite), 0.95),
      totalCostUsd: round(providerItems.reduce((sum, item) => sum + (item.costUsd ?? 0), 0), 6)
    };
  }

  return {
    runId,
    repetitions,
    sampleCount: samples.length,
    totalRuns: items.length,
    byProvider,
    thresholds: {
      minStructuredValidDeepSeekRuns: 14,
      maxDeepSeekMissedKnownFindings: 0,
      maxDeepSeekP95LatencyVsAnthropicRatio: 2.5
    },
    verdict: provisionalVerdict(byProvider)
  };
}

function provisionalVerdict(byProvider) {
  const deepseek = byProvider.deepseek;
  const anthropic = byProvider.anthropic;
  if (!deepseek || !anthropic) return "incomplete";
  if (deepseek.structuredValidRuns < 14) return "fail_structured_output";
  if (deepseek.totalMissedKnownFindings > 0) return "fail_missed_known_findings";
  if (anthropic.p95LatencyMs && deepseek.p95LatencyMs / anthropic.p95LatencyMs > 2.5) {
    return "experimental_latency";
  }
  return "candidate_pass_pending_false_positive_review";
}

async function appendJsonl(path, value) {
  await writeFile(path, `${JSON.stringify(value)}\n`, { flag: "a" });
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function excerpt(value) {
  const text = String(value).replace(/\s+/g, " ").trim();
  return text.length > 500 ? `${text.slice(0, 500)}[TRUNCATED]` : text;
}

function percentile(values, p) {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1);
  return sorted[index];
}

function round(value, digits) {
  return Number(value.toFixed(digits));
}

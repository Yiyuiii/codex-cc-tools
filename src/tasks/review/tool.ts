import type {
  ClaudeActivityEvent,
  ClaudeExecutor,
  StreamingClaudeExecutor
} from "../../core/claude-runner.js";
import { runClaudeTask } from "../../core/claude-runner.js";
import type { CacheUsage } from "../../core/claude-runner.js";
import { buildReviewPacket } from "./packet.js";
import {
  runGeminiReview as defaultRunGeminiReview,
  type RunGeminiReviewDeps
} from "./gemini.js";
import { CcReviewOutputSchema, type CcReviewInput, type CcReviewOutput } from "./schema.js";

export const REVIEW_STDIN_PROMPT = "Review the packet provided on stdin.";

export interface RunClaudeReviewDeps {
  execute?: ClaudeExecutor;
  executeStreaming?: StreamingClaudeExecutor;
  onActivity?: (event: ClaudeActivityEvent) => void;
  now?: () => number;
  buildPacket?: (input: CcReviewInput) => Promise<string>;
  runGeminiReview?: (
    input: CcReviewInput,
    packet: string,
    deps?: RunGeminiReviewDeps
  ) => Promise<CcReviewOutput>;
  timeoutMs?: number;
  signal?: AbortSignal;
  sourceEnv?: Record<string, string | undefined>;
}

export async function runClaudeReview(
  input: CcReviewInput,
  deps: RunClaudeReviewDeps = {}
): Promise<CcReviewOutput> {
  if (deps.signal?.aborted) {
    const now = deps.now ?? Date.now;
    const started = now();
    return {
      ok: false,
      task: input.task,
      model: input.model,
      elapsedMs: Math.max(0, now() - started),
      review: "Claude Code review cancelled before the subprocess started.",
      command: ["claude"],
      diagnostics: ["Review request was already aborted before Claude Code started."]
    };
  }

  const packet = await (deps.buildPacket ?? buildReviewPacket)(input);
  if (input.providerProfile === "gemini") {
    return (deps.runGeminiReview ?? defaultRunGeminiReview)(input, packet, {
      now: deps.now,
      sourceEnv: deps.sourceEnv,
      signal: deps.signal
    });
  }

  const result = await runClaudeTask(
    {
      cwd: input.cwd ?? process.cwd(),
      input: packet,
      prompt: REVIEW_STDIN_PROMPT,
      provider: input.providerProfile,
      model: input.model,
      effort: input.effort,
      cacheTtl: input.cacheTtl,
      permissionMode: input.permissionMode,
      tools: input.tools,
      stream: input.stream,
      verbose: input.verbose,
      includePartialMessages: input.includePartialMessages,
      includeHookEvents: input.includeHookEvents,
      jsonSchema: input.output === "json" ? REVIEW_JSON_SCHEMA : undefined,
      sourceEnv: deps.sourceEnv,
      timeoutMs: deps.timeoutMs,
      signal: deps.signal
    },
    {
      execute: deps.execute,
      executeStreaming: deps.executeStreaming,
      onActivity: deps.onActivity,
      now: deps.now
    }
  );

  const diagnostics = [
    ...(result.diagnostics ?? []),
    ...(input.stream
      ? []
      : ["stream=false disables Claude Code activity, transcript, and MCP progress event tails."]),
    ...cacheDiagnostics(input.cacheTtl, result.cache),
    ...(input.providerProfile === "deepseek"
      ? [
          "DeepSeek cache and cost fields are Claude Code-reported estimates, not DeepSeek billing/cache truth."
        ]
      : [])
  ];

  return CcReviewOutputSchema.parse({
    ok: result.ok,
    task: input.task,
    model: result.model,
    elapsedMs: result.elapsedMs,
    review: result.review,
    structured: result.structured,
    command: result.command,
    eventsTail: result.eventsTail,
    transcriptTail: result.transcriptTail,
    activityTail: result.activityTail,
    eventCount: result.eventCount,
    cache: result.cache ? { ...result.cache, effective: effectiveCache(input.cacheTtl, result.cache) } : undefined,
    costUsd: result.costUsd,
    diagnostics: diagnostics.length ? diagnostics : undefined,
    stderrTail: result.stderrTail,
    exitCode: result.exitCode
  });
}

function effectiveCache(cacheTtl: CcReviewInput["cacheTtl"], cache: CacheUsage): NonNullable<CcReviewOutput["cache"]>["effective"] {
  if (cacheTtl === "5m") return "disabled";
  if ((cache.readInputTokens ?? 0) > 0) return "hit";
  if ((cache.creationInputTokens ?? 0) > 0 || cache.cacheCreation) return "write";
  return "miss_or_unreported";
}

function cacheDiagnostics(cacheTtl: CcReviewInput["cacheTtl"], cache: CacheUsage | undefined): string[] {
  if (!cache || cacheTtl === "5m") return [];
  if ((cache.readInputTokens ?? 0) > 0 || (cache.creationInputTokens ?? 0) > 0 || cache.cacheCreation) {
    return [];
  }
  return ["Claude Code did not report prompt cache creation or read tokens."];
}

const REVIEW_JSON_SCHEMA = {
  type: "object",
  properties: {
    verdict: {
      type: "string",
      enum: ["approve", "needs_changes", "blocked"]
    },
    summary: { type: "string" },
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          severity: {
            type: "string",
            enum: ["critical", "major", "minor", "note"]
          },
          category: {
            type: "string",
            enum: ["correctness", "security", "tests", "maintainability", "docs", "other"]
          },
          location: { type: "string" },
          evidence: { type: "string" },
          issue: { type: "string" },
          impact: { type: "string" },
          rationale: { type: "string" },
          suggested_change: { type: "string" },
          confidence: {
            type: "string",
            enum: ["high", "medium", "low"]
          },
          blocking: { type: "boolean" }
        },
        required: ["severity", "category", "location", "issue", "rationale", "suggested_change"],
        additionalProperties: false
      }
    },
    needs_verification: {
      type: "array",
      items: {
        type: "object",
        properties: {
          hypothesis: { type: "string" },
          how_to_verify: { type: "string" }
        },
        required: ["hypothesis", "how_to_verify"],
        additionalProperties: false
      }
    },
    missing_context: {
      type: "array",
      items: { type: "string" }
    }
  },
  required: ["verdict", "summary", "findings", "missing_context"],
  additionalProperties: false
} as const;

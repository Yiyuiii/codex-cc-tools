import type {
  ClaudeActivityEvent,
  ClaudeExecutor,
  StreamingClaudeExecutor
} from "../../core/claude-runner.js";
import { runClaudeTask } from "../../core/claude-runner.js";
import { buildResearchPacket } from "./packet.js";
import {
  CcResearchOutputSchema,
  CcResearchStructuredSchema,
  type CcResearchInput,
  type CcResearchOutput
} from "./schema.js";

export const RESEARCH_STDIN_PROMPT = "Research the packet provided on stdin.";

const READ_ONLY_RESEARCH_TOOLS = ["Read", "Grep", "Glob", "LS"];

export interface RunClaudeResearchDeps {
  execute?: ClaudeExecutor;
  executeStreaming?: StreamingClaudeExecutor;
  onActivity?: (event: ClaudeActivityEvent) => void;
  now?: () => number;
  buildPacket?: (input: CcResearchInput) => Promise<string>;
  timeoutMs?: number;
  signal?: AbortSignal;
  sourceEnv?: Record<string, string | undefined>;
}

export async function runClaudeResearch(
  input: CcResearchInput,
  deps: RunClaudeResearchDeps = {}
): Promise<CcResearchOutput> {
  if (deps.signal?.aborted) {
    const now = deps.now ?? Date.now;
    const started = now();
    return CcResearchOutputSchema.parse({
      ok: false,
      status: "blocked",
      model: input.model,
      elapsedMs: Math.max(0, now() - started),
      answer: "Claude Code research cancelled before the subprocess started.",
      evidence: [],
      filesRead: [],
      commandsRun: [],
      missingContext: [],
      command: ["claude"],
      diagnostics: ["Research request was already aborted before Claude Code started."]
    });
  }

  const packet = await (deps.buildPacket ?? buildResearchPacket)(input);
  const result = await runClaudeTask(
    {
      cwd: input.cwd ?? process.cwd(),
      input: packet,
      prompt: RESEARCH_STDIN_PROMPT,
      provider: input.providerProfile,
      model: input.model,
      effort: input.effort,
      cacheTtl: input.cacheTtl,
      permissionMode: "default",
      tools: READ_ONLY_RESEARCH_TOOLS,
      stream: input.stream,
      jsonSchema: RESEARCH_JSON_SCHEMA,
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

  const structured = parseStructuredResearch(result.structured);
  const diagnostics = [
    ...(result.diagnostics ?? []),
    ...(structured.valid ? [] : ["Claude Code did not return structured research output."]),
    ...(input.providerProfile === "deepseek"
      ? [
          "DeepSeek cache and cost fields are Claude Code-reported estimates, not DeepSeek billing/cache truth."
        ]
      : [])
  ];

  return CcResearchOutputSchema.parse({
    ok: result.ok && structured.valid,
    status: result.ok && structured.valid ? structured.status : "blocked",
    model: result.model,
    elapsedMs: result.elapsedMs,
    answer: structured.answer || result.review,
    evidence: structured.evidence,
    filesRead: structured.filesRead,
    commandsRun: structured.commandsRun,
    missingContext: structured.missingContext,
    command: result.command,
    eventsTail: result.eventsTail,
    transcriptTail: result.transcriptTail,
    eventCount: result.eventCount,
    diagnostics: diagnostics.length ? diagnostics : undefined,
    stderrTail: result.stderrTail,
    exitCode: result.exitCode
  });
}

function parseStructuredResearch(value: unknown) {
  const parsed = CcResearchStructuredSchema.safeParse(value);
  if (parsed.success) return { valid: true as const, ...parsed.data };
  return {
    valid: false as const,
    status: "blocked" as const,
    answer: "",
    evidence: [],
    filesRead: [],
    commandsRun: [],
    missingContext: []
  };
}

const RESEARCH_JSON_SCHEMA = {
  type: "object",
  properties: {
    status: {
      type: "string",
      enum: ["answered", "partial", "blocked"]
    },
    answer: { type: "string" },
    evidence: {
      type: "array",
      items: {
        type: "object",
        properties: {
          file: { type: "string" },
          command: { type: "string" },
          detail: { type: "string" }
        },
        required: ["detail"],
        additionalProperties: false
      }
    },
    filesRead: {
      type: "array",
      items: { type: "string" }
    },
    commandsRun: {
      type: "array",
      items: { type: "string" }
    },
    missingContext: {
      type: "array",
      items: { type: "string" }
    }
  },
  required: ["status", "answer", "evidence", "filesRead", "commandsRun", "missingContext"],
  additionalProperties: false
} as const;

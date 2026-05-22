import type {
  ClaudeActivityEvent,
  ClaudeExecutor,
  StreamingClaudeExecutor
} from "../../core/claude-runner.js";
import { runClaudeTask } from "../../core/claude-runner.js";
import { redactSecrets } from "../review/packet.js";
import { buildDelegatePacket } from "./packet.js";
import {
  CcDelegateOutputSchema,
  CcDelegateStructuredSchema,
  type CcDelegateInput,
  type CcDelegateOutput
} from "./schema.js";

export const DELEGATE_STDIN_PROMPT = "Execute the Codex prompt provided on stdin.";

export interface RunClaudeDelegateDeps {
  execute?: ClaudeExecutor;
  executeStreaming?: StreamingClaudeExecutor;
  onActivity?: (event: ClaudeActivityEvent) => void;
  now?: () => number;
  buildPacket?: (input: CcDelegateInput) => Promise<string> | string;
  signal?: AbortSignal;
  sourceEnv?: Record<string, string | undefined>;
}

export async function runClaudeDelegate(
  input: CcDelegateInput,
  deps: RunClaudeDelegateDeps = {}
): Promise<CcDelegateOutput> {
  const now = deps.now ?? Date.now;
  const started = now();

  if (deps.signal?.aborted) {
    return failureResult(input, "Claude Code delegation cancelled before the subprocess started.", [
      "Delegate request was already aborted before Claude Code started."
    ], "cancelled", now, started);
  }

  const prompt = await (deps.buildPacket ?? buildDelegatePacket)(input);
  const result = await runClaudeTask(
    {
      cwd: input.cwd ?? process.cwd(),
      input: prompt,
      prompt: DELEGATE_STDIN_PROMPT,
      provider: input.providerProfile,
      model: input.model,
      effort: input.effort,
      cacheTtl: input.cacheTtl,
      permissionMode: "bypassPermissions",
      stream: input.stream,
      jsonSchema: DELEGATE_JSON_SCHEMA,
      sourceEnv: deps.sourceEnv,
      timeoutMs: input.timeoutMs,
      signal: deps.signal
    },
    {
      execute: deps.execute,
      executeStreaming: deps.executeStreaming,
      onActivity: deps.onActivity,
      now: deps.now
    }
  );

  const structured = redactStructured(parseStructuredDelegate(result.structured));
  const diagnostics = [
    ...(result.diagnostics ?? []).map(redactSecrets),
    ...(structured.valid ? [] : ["Claude Code did not return structured delegate output."]),
    ...(input.providerProfile === "deepseek" && (result.cache !== undefined || result.costUsd !== undefined)
      ? [
          "DeepSeek cache and cost fields are Claude Code-reported estimates, not DeepSeek billing/cache truth."
        ]
      : [])
  ];
  const status = structured.valid ? structured.status : statusFromRunner(result);
  const ok = result.ok && structured.valid && structured.status === "succeeded";

  return CcDelegateOutputSchema.parse({
    ok,
    status: ok ? "succeeded" : status === "succeeded" ? "failed" : status,
    model: result.model,
    elapsedMs: result.elapsedMs,
    summary: redactSecrets(structured.summary || result.review || "Claude Code delegation failed."),
    filesChanged: structured.filesChanged,
    commandsRun: structured.commandsRun,
    verification: structured.verification,
    risks: structured.risks,
    diagnostics: [...structured.diagnostics, ...diagnostics].map(redactSecrets),
    command: result.command.map(redactSecrets),
    eventsTail: result.eventsTail?.map(redactSecrets),
    transcriptTail: result.transcriptTail?.map(redactSecrets),
    eventCount: result.eventCount,
    stderrTail: result.stderrTail ? redactSecrets(result.stderrTail) : undefined,
    exitCode: result.exitCode
  });
}

function failureResult(
  input: CcDelegateInput,
  summary: string,
  diagnostics: string[],
  status: "failed" | "cancelled" | "timed_out",
  now: () => number,
  started: number
): CcDelegateOutput {
  return CcDelegateOutputSchema.parse({
    ok: false,
    status,
    model: input.model,
    elapsedMs: Math.max(0, now() - started),
    summary,
    filesChanged: [],
    commandsRun: [],
    verification: [],
    risks: [],
    diagnostics: diagnostics.map(redactSecrets),
    command: ["claude"]
  });
}

function parseStructuredDelegate(value: unknown) {
  const parsed = CcDelegateStructuredSchema.safeParse(value);
  if (parsed.success) return { valid: true as const, ...parsed.data };
  return {
    valid: false as const,
    status: "failed" as const,
    summary: "",
    filesChanged: [],
    commandsRun: [],
    verification: [],
    risks: [],
    diagnostics: []
  };
}

type ParsedDelegate = ReturnType<typeof parseStructuredDelegate>;

function redactStructured(value: ParsedDelegate): ParsedDelegate {
  if (!value.valid) return value;
  return {
    ...value,
    summary: redactSecrets(value.summary),
    filesChanged: value.filesChanged.map(redactSecrets),
    commandsRun: value.commandsRun.map((command) => ({
      command: redactSecrets(command.command),
      exitCode: command.exitCode,
      summary: redactSecrets(command.summary)
    })),
    verification: value.verification.map(redactSecrets),
    risks: value.risks.map(redactSecrets),
    diagnostics: value.diagnostics.map(redactSecrets)
  };
}

function statusFromRunner(result: { stderrTail?: string; exitCode?: number }): "failed" | "cancelled" | "timed_out" {
  const stderr = result.stderrTail ?? "";
  if (/timed out/i.test(stderr)) return "timed_out";
  if (/cancelled/i.test(stderr)) return "cancelled";
  return "failed";
}

const DELEGATE_JSON_SCHEMA = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["succeeded", "failed", "cancelled", "timed_out"] },
    summary: { type: "string" },
    filesChanged: { type: "array", items: { type: "string" } },
    commandsRun: {
      type: "array",
      items: {
        type: "object",
        properties: {
          command: { type: "string" },
          exitCode: { type: "number" },
          summary: { type: "string" }
        },
        required: ["command", "summary"],
        additionalProperties: false
      }
    },
    verification: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
    diagnostics: { type: "array", items: { type: "string" } }
  },
  required: ["status", "summary", "filesChanged", "commandsRun", "verification", "risks", "diagnostics"],
  additionalProperties: false
} as const;

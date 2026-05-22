import type {
  ClaudeActivityEvent,
  ClaudeExecutor,
  StreamingClaudeExecutor
} from "../../core/claude-runner.js";
import { runClaudeTask } from "../../core/claude-runner.js";
import { redactSecrets } from "../review/packet.js";
import { buildVerifyPacket } from "./packet.js";
import {
  CcVerifyOutputSchema,
  CcVerifyStructuredSchema,
  type CcVerifyInput,
  type CcVerifyOutput
} from "./schema.js";

export const VERIFY_STDIN_PROMPT = "Verify the packet provided on stdin.";

const READ_ONLY_TOOLS = ["Read", "Grep", "Glob", "LS"];

export interface RunClaudeVerifyDeps {
  execute?: ClaudeExecutor;
  executeStreaming?: StreamingClaudeExecutor;
  onActivity?: (event: ClaudeActivityEvent) => void;
  now?: () => number;
  buildPacket?: (input: CcVerifyInput) => Promise<string> | string;
  signal?: AbortSignal;
  sourceEnv?: Record<string, string | undefined>;
}

export async function runClaudeVerify(
  input: CcVerifyInput,
  deps: RunClaudeVerifyDeps = {}
): Promise<CcVerifyOutput> {
  if (deps.signal?.aborted) {
    const now = deps.now ?? Date.now;
    const started = now();
    return CcVerifyOutputSchema.parse({
      ok: false,
      status: "blocked",
      model: input.model,
      elapsedMs: Math.max(0, now() - started),
      summary: "Claude Code verification cancelled before the subprocess started.",
      commandsRun: [],
      evidence: [],
      reproduction: "",
      needsFollowup: true,
      diagnostics: ["Verification request was already aborted before Claude Code started."],
      command: ["claude"]
    });
  }

  const packet = await (deps.buildPacket ?? buildVerifyPacket)(input);
  const result = await runClaudeTask(
    {
      cwd: input.cwd ?? process.cwd(),
      input: packet,
      prompt: VERIFY_STDIN_PROMPT,
      provider: input.providerProfile,
      model: input.model,
      effort: input.effort,
      cacheTtl: input.cacheTtl,
      permissionMode: "default",
      tools: [...READ_ONLY_TOOLS, ...input.commandsAllowed.map((command) => `Bash(${command})`)],
      stream: input.stream,
      jsonSchema: VERIFY_JSON_SCHEMA,
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

  const structured = parseStructuredVerify(result.structured);
  const redactedStructured = redactParsedVerify(structured);
  const diagnostics = [
    ...(result.diagnostics ?? []).map(redactSecrets),
    ...(redactedStructured.valid
      ? []
      : ["Claude Code did not return structured verification output."]),
    ...(input.providerProfile === "deepseek"
      ? [
          "DeepSeek cache and cost fields are Claude Code-reported estimates, not DeepSeek billing/cache truth."
        ]
      : [])
  ];

  return CcVerifyOutputSchema.parse({
    ok: result.ok && structured.valid,
    status: result.ok && structured.valid ? redactedStructured.status : "blocked",
    model: result.model,
    elapsedMs: result.elapsedMs,
    summary: redactSecrets(redactedStructured.summary || result.review),
    commandsRun: redactedStructured.commandsRun,
    evidence: redactedStructured.evidence,
    reproduction: redactedStructured.reproduction,
    needsFollowup: redactedStructured.needsFollowup || !result.ok || !structured.valid,
    diagnostics: [...redactedStructured.diagnostics, ...diagnostics].map(redactSecrets),
    command: result.command.map(redactSecrets),
    eventsTail: result.eventsTail?.map(redactSecrets),
    transcriptTail: result.transcriptTail?.map(redactSecrets),
    eventCount: result.eventCount,
    stderrTail: result.stderrTail ? redactSecrets(result.stderrTail) : undefined,
    exitCode: result.exitCode
  });
}

function parseStructuredVerify(value: unknown) {
  const parsed = CcVerifyStructuredSchema.safeParse(value);
  if (parsed.success) return { valid: true as const, ...parsed.data };
  return {
    valid: false as const,
    status: "blocked" as const,
    summary: "",
    commandsRun: [],
    evidence: [],
    reproduction: "",
    needsFollowup: true,
    diagnostics: []
  };
}

type ParsedStructuredVerify = ReturnType<typeof parseStructuredVerify>;

function redactParsedVerify(value: ParsedStructuredVerify): ParsedStructuredVerify {
  if (!value.valid) return value;
  return {
    ...value,
    summary: redactSecrets(value.summary),
    commandsRun: value.commandsRun.map((command) => ({
      command: redactSecrets(command.command),
      exitCode: command.exitCode,
      summary: redactSecrets(command.summary)
    })),
    evidence: value.evidence.map(redactSecrets),
    reproduction: redactSecrets(value.reproduction),
    diagnostics: value.diagnostics.map(redactSecrets)
  };
}

const VERIFY_JSON_SCHEMA = {
  type: "object",
  properties: {
    status: {
      type: "string",
      enum: ["verified", "reproduced", "not_reproduced", "partial", "blocked"]
    },
    summary: { type: "string" },
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
    evidence: {
      type: "array",
      items: { type: "string" }
    },
    reproduction: { type: "string" },
    needsFollowup: { type: "boolean" },
    diagnostics: {
      type: "array",
      items: { type: "string" }
    }
  },
  required: ["status", "summary", "commandsRun", "evidence", "reproduction", "needsFollowup", "diagnostics"],
  additionalProperties: false
} as const;

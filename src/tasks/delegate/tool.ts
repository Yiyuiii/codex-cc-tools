import path from "node:path";

import type {
  ClaudeActivityEvent,
  ClaudeExecutor,
  StreamingClaudeExecutor
} from "../../core/claude-runner.js";
import { runClaudeTask } from "../../core/claude-runner.js";
import { redactSecrets } from "../review/packet.js";
import { buildDelegatePacket } from "./packet.js";
import {
  collectDelegateChangedPaths,
  collectDelegatePolicyDeps,
  evaluateDelegatePolicy,
  validateReportedDelegateCommands,
  validateDelegateChangedPaths,
  type DelegatePolicyDeps
} from "./policy.js";
import {
  CcDelegateOutputSchema,
  CcDelegateStructuredSchema,
  type CcDelegateInput,
  type CcDelegateOutput
} from "./schema.js";

export const DELEGATE_STDIN_PROMPT = "Delegate the packet provided on stdin.";

export interface RunClaudeDelegateDeps {
  execute?: ClaudeExecutor;
  executeStreaming?: StreamingClaudeExecutor;
  onActivity?: (event: ClaudeActivityEvent) => void;
  now?: () => number;
  buildPacket?: (input: CcDelegateInput) => Promise<string> | string;
  signal?: AbortSignal;
  sourceEnv?: Record<string, string | undefined>;
  policy?: DelegatePolicyDeps;
  collectPolicyDeps?: (cwd: string) => Promise<DelegatePolicyDeps>;
  getChangedPaths?: (cwd: string) => Promise<string[] | undefined>;
}

export async function runClaudeDelegate(
  input: CcDelegateInput,
  deps: RunClaudeDelegateDeps = {}
): Promise<CcDelegateOutput> {
  const now = deps.now ?? Date.now;
  const started = now();

  if (deps.signal?.aborted) {
    return blockedResult(input, "Claude Code delegation cancelled before the subprocess started.", [
      "Delegate request was already aborted before Claude Code started."
    ], now, started);
  }

  const policyDeps = deps.policy ?? (await (deps.collectPolicyDeps ?? collectDelegatePolicyDeps)(input.cwd));
  const policy = evaluateDelegatePolicy(input, policyDeps);
  if (!policy.ok) {
    return blockedResult(input, "Delegate safety policy blocked the request.", policy.diagnostics, now, started);
  }

  const packet = await (deps.buildPacket ?? buildDelegatePacket)(input);
  const result = await runClaudeTask(
    {
      cwd: policy.resolvedCwd ?? input.cwd,
      input: packet,
      prompt: DELEGATE_STDIN_PROMPT,
      provider: input.providerProfile,
      model: input.model,
      effort: input.effort,
      cacheTtl: input.cacheTtl,
      permissionMode: policy.permissionMode,
      tools: policy.tools,
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
    ...(input.providerProfile === "deepseek"
      ? [
          "DeepSeek cache and cost fields are Claude Code-reported estimates, not DeepSeek billing/cache truth."
        ]
      : [])
  ];
  const reportedCommandDiagnostics = structured.valid
    ? validateReportedDelegateCommands(
        structured.commandsRun.map((command) => command.command),
        input.commandsAllowed
      )
    : [];

  const postRun = structured.valid
    ? await evaluatePostRunPaths(input, policy, policyDeps, structured.filesChanged, deps)
    : { ok: true, statusOverride: undefined, diagnostics: [] as string[] };
  const ok = result.ok && structured.valid && postRun.ok && reportedCommandDiagnostics.length === 0;
  const status = ok ? postRun.statusOverride ?? structured.status : "blocked";

  return CcDelegateOutputSchema.parse({
    ok,
    status,
    model: result.model,
    elapsedMs: result.elapsedMs,
    summary: redactSecrets(structured.summary || result.review),
    filesChanged: structured.filesChanged,
    commandsRun: structured.commandsRun,
    verification: structured.verification,
    risks: structured.risks,
    diagnostics: [
      ...structured.diagnostics,
      ...diagnostics,
      ...reportedCommandDiagnostics,
      ...postRun.diagnostics
    ].map(redactSecrets),
    command: result.command.map(redactSecrets),
    eventsTail: result.eventsTail?.map(redactSecrets),
    transcriptTail: result.transcriptTail?.map(redactSecrets),
    eventCount: result.eventCount,
    stderrTail: result.stderrTail ? redactSecrets(result.stderrTail) : undefined,
    exitCode: result.exitCode
  });
}

function blockedResult(
  input: CcDelegateInput,
  summary: string,
  diagnostics: string[],
  now: () => number,
  started: number
): CcDelegateOutput {
  return CcDelegateOutputSchema.parse({
    ok: false,
    status: "blocked",
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
    status: "blocked" as const,
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

async function evaluatePostRunPaths(
  input: CcDelegateInput,
  policy: { resolvedCwd?: string; allowedPaths?: string[]; forbiddenPaths?: string[] },
  policyDeps: DelegatePolicyDeps,
  reportedFiles: string[],
  deps: RunClaudeDelegateDeps
): Promise<{ ok: boolean; statusOverride?: "partial"; diagnostics: string[] }> {
  const cwd = policy.resolvedCwd ?? input.cwd;
  const observedFiles = await (deps.getChangedPaths ?? collectDelegateChangedPaths)(cwd);
  const preRunSnapshotUnavailable = Boolean(policyDeps.git && !Array.isArray(policyDeps.git.dirtyStatus));
  const preRunFiles = policyDeps.git?.dirtyStatus ?? [];
  const diagnostics: string[] = [];
  const preRunKeys = new Set(
    preRunFiles.map((file) => normalizeChangedPathKey(file, cwd, policyDeps.platform))
  );
  const newlyObservedFiles =
    observedFiles?.filter((file) => !preRunKeys.has(normalizeChangedPathKey(file, cwd, policyDeps.platform))) ??
    [];
  const reportedPreRunFiles = reportedFiles.filter((file) =>
    preRunKeys.has(normalizeChangedPathKey(file, cwd, policyDeps.platform))
  );
  const observedPreRunFiles =
    observedFiles?.filter((file) => preRunKeys.has(normalizeChangedPathKey(file, cwd, policyDeps.platform))) ??
    [];
  const validation = validateDelegateChangedPaths({
    cwd,
    allowedPaths: policy.allowedPaths,
    forbiddenPaths: policy.forbiddenPaths,
    changedPaths: [...new Set([...newlyObservedFiles, ...reportedFiles])],
    platform: policyDeps.platform,
    realpath: policyDeps.realpath
  });

  diagnostics.push(...validation.diagnostics);
  if (preRunSnapshotUnavailable) {
    diagnostics.push("Delegate pre-run dirty snapshot unavailable; cannot distinguish pre-existing changes.");
  }
  if (observedPreRunFiles.length) {
    diagnostics.push(
      `Observed paths were already dirty before delegate ran and cannot be proven unchanged: ${observedPreRunFiles.join(", ")}`
    );
  }
  if (reportedPreRunFiles.length) {
    diagnostics.push(
      `Reported paths were already dirty before delegate ran and cannot be proven as delegate changes: ${reportedPreRunFiles.join(", ")}`
    );
  }
  if (!validation.ok) {
    return { ok: false, diagnostics };
  }

  if (!observedFiles) {
    return {
      ok: true,
      statusOverride:
        preRunSnapshotUnavailable || observedPreRunFiles.length || reportedPreRunFiles.length
          ? "partial"
          : undefined,
      diagnostics
    };
  }

  const reported = new Set(
    reportedFiles.map((file) => normalizeChangedPathKey(file, cwd, policyDeps.platform))
  );
  const observed = new Set(
    newlyObservedFiles.map((file) => normalizeChangedPathKey(file, cwd, policyDeps.platform))
  );
  const underReported = newlyObservedFiles.filter(
    (file) => !reported.has(normalizeChangedPathKey(file, cwd, policyDeps.platform))
  );
  if (underReported.length) {
    diagnostics.push(`Observed changed paths were not reported by Claude Code: ${underReported.join(", ")}`);
    return { ok: false, diagnostics };
  }

  const overReported = reportedFiles.filter(
    (file) =>
      !observed.has(normalizeChangedPathKey(file, cwd, policyDeps.platform)) &&
      !preRunKeys.has(normalizeChangedPathKey(file, cwd, policyDeps.platform))
  );
  if (overReported.length) {
    diagnostics.push(`Claude Code reported paths not observed in git status: ${overReported.join(", ")}`);
    return { ok: true, statusOverride: "partial", diagnostics };
  }

  return {
    ok: true,
    statusOverride:
      preRunSnapshotUnavailable || observedPreRunFiles.length || reportedPreRunFiles.length
        ? "partial"
        : undefined,
    diagnostics
  };
}

function normalizeChangedPathKey(
  value: string,
  cwd: string,
  platform: NodeJS.Platform | "win32" | "linux" | "darwin" = process.platform
): string {
  const pathModule = platform === "win32" ? path.win32 : path.posix;
  const absolute = pathModule.isAbsolute(value) ? pathModule.normalize(value) : pathModule.resolve(cwd, value);
  const relative = pathModule.relative(cwd, absolute) || ".";
  const normalized = relative.replaceAll("\\", "/");
  return platform === "win32" ? normalized.toLowerCase() : normalized;
}

const DELEGATE_JSON_SCHEMA = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["succeeded", "partial", "needs_followup", "blocked"] },
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

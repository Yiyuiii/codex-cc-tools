import { execa } from "execa";
import type { Readable } from "node:stream";
import { createInterface } from "node:readline";

import {
  buildProviderEnvironment,
  type CacheTtl,
  type ClaudeEffort
} from "../providers/env.js";
import type { ProviderProfileName } from "../providers/registry.js";
import {
  redactProviderSecrets,
  redactProviderSecretsFromUnknown
} from "./redaction.js";

export type ClaudePermissionMode =
  | "acceptEdits"
  | "auto"
  | "bypassPermissions"
  | "default"
  | "dontAsk"
  | "plan";

export type ClaudeActivityKind =
  | "system"
  | "assistant_text"
  | "user_text"
  | "text_delta"
  | "tool_use"
  | "tool_result"
  | "message_delta"
  | "result"
  | "hook"
  | "unknown";

export interface ClaudeActivityEvent {
  index: number;
  kind: ClaudeActivityKind;
  rawType: string;
  summary: string;
  text?: string;
  toolName?: string;
  toolInput?: unknown;
  toolInputPreview?: string;
  toolInputTruncated?: boolean;
}

export interface CacheUsage {
  inputTokens?: number;
  creationInputTokens?: number;
  readInputTokens?: number;
  cacheCreation?: {
    ephemeral1hInputTokens?: number;
    ephemeral5mInputTokens?: number;
  };
}

export interface ParsedClaudeStream {
  review: string;
  structured?: unknown;
  eventsTail: string[];
  transcriptTail: string[];
  activityTail: ClaudeActivityEvent[];
  eventCount: number;
  cache?: CacheUsage;
  costUsd?: number;
  diagnostics: string[];
}

export interface ClaudeExecuteOptions {
  cwd: string;
  input: string;
  env: Record<string, string>;
  reject: false;
  timeout: number;
  signal?: AbortSignal;
}

export interface ClaudeExecuteResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export type ProcessTreeKillCommand =
  | { command: "taskkill"; args: string[] }
  | { pid: number; signal: NodeJS.Signals };

export type ClaudeExecutor = (
  command: string,
  args: string[],
  options: ClaudeExecuteOptions
) => Promise<ClaudeExecuteResult>;

export type StreamingClaudeExecutor = (
  command: string,
  args: string[],
  options: ClaudeExecuteOptions,
  onStdoutLine: (line: string) => void,
  onStderrLine: (line: string) => void
) => Promise<ClaudeExecuteResult>;

export interface RunClaudeTaskInput {
  cwd: string;
  input: string;
  prompt: string;
  provider: ProviderProfileName;
  model: string;
  effort: ClaudeEffort;
  cacheTtl: CacheTtl;
  permissionMode: ClaudePermissionMode;
  tools?: string[];
  stream: boolean;
  verbose?: boolean;
  includePartialMessages?: boolean;
  includeHookEvents?: boolean;
  jsonSchema?: unknown;
  sourceEnv?: Record<string, string | undefined>;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface RunClaudeTaskDeps {
  execute?: ClaudeExecutor;
  executeStreaming?: StreamingClaudeExecutor;
  onActivity?: (event: ClaudeActivityEvent) => void;
  now?: () => number;
}

export interface RunClaudeTaskOutput {
  ok: boolean;
  model: string;
  elapsedMs: number;
  review: string;
  structured?: unknown;
  command: string[];
  eventsTail?: string[];
  transcriptTail?: string[];
  activityTail?: ClaudeActivityEvent[];
  eventCount?: number;
  cache?: CacheUsage;
  costUsd?: number;
  diagnostics?: string[];
  stderrTail?: string;
  exitCode?: number;
}

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;

export async function runClaudeTask(
  input: RunClaudeTaskInput,
  deps: RunClaudeTaskDeps = {}
): Promise<RunClaudeTaskOutput> {
  const now = deps.now ?? Date.now;
  const started = now();
  const providerEnv = buildProviderEnvironment({
    provider: input.provider,
    model: input.model,
    effort: input.effort,
    cacheTtl: input.cacheTtl,
    sourceEnv: input.sourceEnv
  });

  if (!providerEnv.ok) {
    return {
      ok: false,
      model: providerEnv.model,
      elapsedMs: Math.max(0, now() - started),
      review: providerEnv.error ?? "Provider configuration failed.",
      command: ["claude"],
      diagnostics: providerEnv.error ? [providerEnv.error] : undefined
    };
  }

  const args = buildClaudeArgs({
    prompt: input.prompt,
    model: providerEnv.model,
    effort: input.effort,
    permissionMode: input.permissionMode,
    tools: input.tools,
    stream: input.stream,
    verbose: input.verbose,
    includePartialMessages: input.includePartialMessages,
    includeHookEvents: input.includeHookEvents,
    jsonSchema: input.jsonSchema
  });
  const options: ClaudeExecuteOptions = {
    cwd: input.cwd,
    input: input.input,
    env: providerEnv.env,
    reject: false,
    timeout: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    signal: input.signal
  };
  const redactions = providerEnv.redactions;
  let child: ClaudeExecuteResult;
  let parsed: ParsedClaudeOutput;

  if (input.stream) {
    const streamed = await runStreamingClaude(
      deps.executeStreaming ?? defaultExecuteStreaming,
      args,
      options,
      redactions,
      deps.onActivity
    );
    child = streamed.child;
    parsed = streamed.parsed;
  } else {
    const execute = deps.execute ?? defaultExecute;
    child = await execute("claude", args, options);
    parsed = parseClaudeOutput(child.stdout, input.stream);
  }

  const diagnostics = [...(providerEnv.diagnostics ?? []), ...parsed.diagnostics].map((item) =>
    redactProviderSecrets(item, redactions)
  );
  const stderr = redactProviderSecrets(child.stderr, redactions);

  return {
    ok: child.exitCode === 0,
    model: providerEnv.model,
    elapsedMs: Math.max(0, now() - started),
    review: redactProviderSecrets(parsed.review, redactions),
    structured: redactProviderSecretsFromUnknown(parsed.structured, redactions),
    command: ["claude", ...args.map((arg) => redactProviderSecrets(redactLongArg(arg), redactions))],
    eventsTail: parsed.eventsTail?.map((event) => redactProviderSecrets(event, redactions)),
    transcriptTail: parsed.transcriptTail?.map((event) => redactProviderSecrets(event, redactions)),
    activityTail: parsed.activityTail?.map((event) =>
      redactProviderSecretsFromUnknown(event, redactions) as ClaudeActivityEvent
    ),
    eventCount: parsed.eventCount,
    cache: parsed.cache,
    costUsd: parsed.costUsd,
    diagnostics: diagnostics.length ? diagnostics : undefined,
    stderrTail: stderr ? stderr.slice(-4_000) : undefined,
    exitCode: child.exitCode ?? undefined
  };
}

export interface BuildClaudeArgsInput {
  prompt: string;
  model: string;
  effort: ClaudeEffort;
  permissionMode: ClaudePermissionMode;
  tools?: string[];
  stream: boolean;
  verbose?: boolean;
  includePartialMessages?: boolean;
  includeHookEvents?: boolean;
  jsonSchema?: unknown;
}

const REQUIRED_CLAUDE_HELP_FLAGS = [
  "-p, --print",
  "--model",
  "--effort",
  "--permission-mode",
  "--dangerously-skip-permissions",
  "--allowedTools",
  "--output-format",
  "--verbose",
  "--include-partial-messages",
  "--include-hook-events",
  "--json-schema",
  "--no-session-persistence"
] as const;

export function assertClaudeHelpSupportsRunnerFlags(helpText: string): void {
  const missing = REQUIRED_CLAUDE_HELP_FLAGS.filter((flag) => !helpText.includes(flag));
  if (missing.length) {
    throw new Error(`Claude Code help is missing runner flag(s): ${missing.join(", ")}`);
  }
}

export function buildClaudeArgs(input: BuildClaudeArgsInput): string[] {
  const args = [
    "-p",
    input.prompt,
    "--model",
    input.model,
    "--effort",
    input.effort,
    "--permission-mode",
    input.permissionMode
  ];

  if (input.permissionMode === "bypassPermissions") {
    args.push("--dangerously-skip-permissions");
  }

  if (input.tools?.length) {
    args.push("--allowedTools", ...input.tools);
  }

  args.push("--output-format", input.stream ? "stream-json" : "json");

  if (input.stream && (input.verbose ?? true)) {
    args.push("--verbose");
  }

  if (input.stream && (input.includePartialMessages ?? true)) {
    args.push("--include-partial-messages");
  }

  if (input.stream && (input.includeHookEvents ?? true)) {
    args.push("--include-hook-events");
  }

  args.push("--no-session-persistence");

  if (input.jsonSchema !== undefined) {
    args.push("--json-schema", JSON.stringify(input.jsonSchema));
  }

  return args;
}

export function buildExecaOptions(
  options: ClaudeExecuteOptions
): Omit<ClaudeExecuteOptions, "signal" | "timeout"> & {
  cancelSignal?: AbortSignal;
  detached?: boolean;
  extendEnv: false;
  timeout: 0;
  windowsHide: true;
} {
  const { signal, timeout: _timeout, ...rest } = options;
  return {
    ...rest,
    timeout: 0,
    extendEnv: false,
    windowsHide: true,
    ...(process.platform === "win32" ? {} : { detached: true }),
    ...(signal ? { cancelSignal: signal } : {})
  };
}

export function getProcessTreeKillCommand(
  pid: number,
  platform: NodeJS.Platform = process.platform
): ProcessTreeKillCommand {
  if (platform === "win32") {
    return { command: "taskkill", args: ["/T", "/F", "/PID", String(pid)] };
  }
  return { pid: -pid, signal: "SIGTERM" };
}

interface ParsedClaudeOutput {
  review: string;
  structured?: unknown;
  eventsTail?: string[];
  transcriptTail?: string[];
  activityTail?: ClaudeActivityEvent[];
  eventCount?: number;
  cache?: CacheUsage;
  costUsd?: number;
  diagnostics: string[];
}

function parseClaudeOutput(
  stdout: string,
  stream: boolean
): ParsedClaudeOutput {
  if (stream) {
    return parseClaudeStreamOutput(stdout);
  }

  try {
    const parsed = JSON.parse(stdout) as {
      result?: unknown;
      message?: unknown;
      structured_output?: unknown;
      usage?: unknown;
      total_cost_usd?: unknown;
    };
    return {
      review:
        typeof parsed.result === "string"
          ? parsed.result
          : typeof parsed.message === "string"
            ? parsed.message
            : parsed.structured_output !== undefined
              ? JSON.stringify(parsed.structured_output, null, 2)
              : stdout,
      structured: parsed.structured_output,
      cache: parseCacheUsage(parsed.usage),
      costUsd: typeof parsed.total_cost_usd === "number" ? parsed.total_cost_usd : undefined,
      diagnostics: []
    };
  } catch {
    return { review: stdout, diagnostics: ["Claude Code returned non-JSON output."] };
  }
}

function parseClaudeStreamOutput(stdout: string): ParsedClaudeStream {
  const parser = createClaudeStreamParser();
  for (const line of stdout.split(/\r?\n/)) {
    parser.pushLine(line);
  }
  return parser.finish();
}

function createClaudeStreamParser(options: { onActivity?: (event: ClaudeActivityEvent) => void } = {}) {
  const activity: ClaudeActivityEvent[] = [];
  const events: string[] = [];
  const transcript: string[] = [];
  const textDeltas: string[] = [];
  const diagnostics: string[] = [];
  let nonJsonLines = 0;
  let review = "";
  let structured: unknown;
  let cache: CacheUsage | undefined;
  let costUsd: number | undefined;
  let eventCount = 0;
  let activityIndex = 0;

  function pushLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;

    let event: Record<string, unknown>;
    try {
      event = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      nonJsonLines += 1;
      return;
    }

    eventCount += 1;
    const normalized = normalizeClaudeStreamEvent(event, () => ++activityIndex);
    for (const item of normalized) {
      appendBounded(activity, item, 200);
      options.onActivity?.(item);
      const legacy = toLegacyEventSummary(item);
      if (legacy) appendBounded(events, legacy, 50);

      if (item.kind === "text_delta" && item.text) {
        textDeltas.push(item.text);
      }

      if (item.kind === "assistant_text" && item.text) {
        flushTextDeltas(textDeltas, transcript);
        appendBounded(transcript, item.text, 20);
      }
    }

    if (event.type === "result") {
      if (typeof event.result === "string") {
        review = event.result;
      }
      if ("structured_output" in event) {
        structured = event.structured_output;
      }
      cache = parseCacheUsage(event.usage);
      costUsd = typeof event.total_cost_usd === "number" ? event.total_cost_usd : undefined;
    }
  }

  function finish(): ParsedClaudeStream {
    flushTextDeltas(textDeltas, transcript);
    if (nonJsonLines > 0) {
      diagnostics.push(`Ignored ${nonJsonLines} non-JSON lines from Claude Code stream output.`);
    }

    return {
      review: review || transcript.join("\n\n"),
      structured,
      eventsTail: events,
      transcriptTail: transcript,
      activityTail: activity,
      eventCount,
      cache,
      costUsd,
      diagnostics
    };
  }

  return { pushLine, finish };
}

function normalizeClaudeStreamEvent(
  event: Record<string, unknown>,
  nextIndex: () => number
): ClaudeActivityEvent[] {
  if (event.type === "system") {
    const rawType = `system:${String(event.subtype ?? "event")}`;
    return [
      {
        index: nextIndex(),
        kind: String(event.subtype ?? "").startsWith("hook_") ? "hook" : "system",
        rawType,
        summary: rawType
      }
    ];
  }

  if (event.type === "result") {
    return [{ index: nextIndex(), kind: "result", rawType: "result", summary: "result" }];
  }

  if (event.type === "assistant" || event.type === "user") {
    return normalizeMessageContent(event.type, event, nextIndex);
  }

  if (event.type === "stream_event") {
    return normalizeStreamEvent(event, nextIndex);
  }

  const rawType = typeof event.type === "string" ? event.type : "unknown";
  return [{ index: nextIndex(), kind: "unknown", rawType, summary: rawType }];
}

function normalizeMessageContent(
  role: "assistant" | "user",
  event: Record<string, unknown>,
  nextIndex: () => number
): ClaudeActivityEvent[] {
  const message = event.message as Record<string, unknown> | undefined;
  const content = message?.content;
  if (!Array.isArray(content)) {
    return [{ index: nextIndex(), kind: "unknown", rawType: role, summary: role }];
  }

  const normalized: ClaudeActivityEvent[] = [];
  for (const item of content) {
    const block = item as Record<string, unknown>;
    if (block.type === "text" && typeof block.text === "string") {
      const text = block.text.trim();
      if (text) {
        normalized.push({
          index: nextIndex(),
          kind: role === "assistant" ? "assistant_text" : "user_text",
          rawType: `${role}.text`,
          summary: summarizeText(text),
          text
        });
      }
      continue;
    }

    if (block.type === "tool_use") {
      const toolName = String(block.name ?? "unknown");
      const toolInputPreview = stringifyCompact(block.input);
      normalized.push({
        index: nextIndex(),
        kind: "tool_use",
        rawType: `${role}.tool_use`,
        summary: `tool_use: ${toolName} ${toolInputPreview}`,
        toolName,
        toolInput: block.input,
        toolInputPreview
      });
      continue;
    }

    if (block.type === "tool_result") {
      const text = typeof block.content === "string" ? block.content : undefined;
      normalized.push({
        index: nextIndex(),
        kind: "tool_result",
        rawType: `${role}.tool_result`,
        summary: text ? `tool_result: ${summarizeText(text)}` : "tool_result",
        text
      });
      continue;
    }

    const rawType = `${role}.${String(block.type ?? "unknown")}`;
    normalized.push({ index: nextIndex(), kind: "unknown", rawType, summary: rawType });
  }
  return normalized;
}

function normalizeStreamEvent(
  event: Record<string, unknown>,
  nextIndex: () => number
): ClaudeActivityEvent[] {
  const streamEvent = event.event as Record<string, unknown> | undefined;
  const rawType = `stream_event.${String(streamEvent?.type ?? "unknown")}`;

  if (streamEvent?.type === "content_block_delta") {
    const delta = streamEvent.delta as Record<string, unknown> | undefined;
    if (delta?.type === "text_delta" && typeof delta.text === "string") {
      return [
        {
          index: nextIndex(),
          kind: "text_delta",
          rawType: "stream_event.text_delta",
          summary: "text_delta",
          text: delta.text
        }
      ];
    }
  }

  if (streamEvent?.type === "message_delta") {
    return [{ index: nextIndex(), kind: "message_delta", rawType, summary: "message_delta" }];
  }

  if (streamEvent?.type === "content_block_start") {
    const block = streamEvent.content_block as Record<string, unknown> | undefined;
    if (block?.type === "text" && typeof block.text === "string") {
      return [
        {
          index: nextIndex(),
          kind: "text_delta",
          rawType: "stream_event.text_start",
          summary: "text_start",
          text: block.text
        }
      ];
    }

    if (block?.type === "tool_use") {
      const toolName = String(block.name ?? "unknown");
      return [
        {
          index: nextIndex(),
          kind: "tool_use",
          rawType: "stream_event.tool_use_start",
          summary: `tool_start: ${toolName}`,
          toolName,
          toolInput: block.input,
          toolInputPreview: stringifyCompact(block.input)
        }
      ];
    }
  }

  return [{ index: nextIndex(), kind: "unknown", rawType, summary: rawType }];
}

function flushTextDeltas(buffer: string[], transcript: string[]): void {
  if (!buffer.length) return;
  const text = buffer.join("").trim();
  buffer.length = 0;
  if (text) appendBounded(transcript, text, 20);
}

function appendBounded<T>(target: T[], item: T, maxItems: number): void {
  target.push(item);
  while (target.length > maxItems) {
    target.shift();
  }
}

function toLegacyEventSummary(event: ClaudeActivityEvent): string | undefined {
  if (event.kind === "assistant_text" || event.kind === "user_text" || event.kind === "tool_result") {
    return undefined;
  }
  return event.summary;
}

function parseCacheUsage(value: unknown): CacheUsage | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const usage = value as Record<string, unknown>;
  const cacheCreation = usage.cache_creation as Record<string, unknown> | undefined;
  return compactObject({
    inputTokens: numberValue(usage.input_tokens),
    creationInputTokens: numberValue(usage.cache_creation_input_tokens),
    readInputTokens: numberValue(usage.cache_read_input_tokens),
    cacheCreation: compactObject({
      ephemeral1hInputTokens: numberValue(cacheCreation?.ephemeral_1h_input_tokens),
      ephemeral5mInputTokens: numberValue(cacheCreation?.ephemeral_5m_input_tokens)
    })
  });
}

function compactObject<T extends Record<string, unknown>>(value: T): T | undefined {
  const entries = Object.entries(value).filter(([, item]) => item !== undefined);
  if (!entries.length) return undefined;
  return Object.fromEntries(entries) as T;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

async function runStreamingClaude(
  executeStreaming: StreamingClaudeExecutor,
  args: string[],
  options: ClaudeExecuteOptions,
  redactions: string[],
  onActivity?: (event: ClaudeActivityEvent) => void
): Promise<{ child: ClaudeExecuteResult; parsed: ParsedClaudeOutput }> {
  const parser = createClaudeStreamParser({
    onActivity: onActivity
      ? (event) => onActivity(redactProviderSecretsFromUnknown(event, redactions) as ClaudeActivityEvent)
      : undefined
  });
  const child = await executeStreaming(
    "claude",
    args,
    options,
    (line) => parser.pushLine(line),
    () => undefined
  );
  const parsed = parser.finish();
  return { child, parsed };
}

async function defaultExecute(
  command: string,
  args: string[],
  options: ClaudeExecuteOptions
): Promise<ClaudeExecuteResult> {
  const subprocess = execa(command, args, buildExecaOptions(options));
  return waitForClaudeSubprocess(subprocess, { timeoutMs: options.timeout, signal: options.signal });
}

async function defaultExecuteStreaming(
  command: string,
  args: string[],
  options: ClaudeExecuteOptions,
  onStdoutLine: (line: string) => void,
  onStderrLine: (line: string) => void
): Promise<ClaudeExecuteResult> {
  const subprocess = execa(command, args, buildExecaOptions(options));
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  const stdoutTask = collectLines(subprocess.stdout, stdoutLines, onStdoutLine);
  const stderrTask = collectLines(subprocess.stderr, stderrLines, onStderrLine);
  const result = await waitForClaudeSubprocess(subprocess, {
    timeoutMs: options.timeout,
    signal: options.signal
  });
  await waitForLineCollectors([stdoutTask, stderrTask], result.exitCode === null ? 1_000 : 5_000);

  return {
    stdout: combineStreamingProcessOutput(stdoutLines, result.stdout),
    stderr: combineStreamingProcessOutput(stderrLines, result.stderr),
    exitCode: result.exitCode
  };
}

interface ClaudeSubprocessLike extends PromiseLike<unknown> {
  kill?: (signal?: NodeJS.Signals | number) => boolean;
  pid?: number;
}

export interface WaitForClaudeSubprocessOptions {
  timeoutMs: number;
  cleanupDeadlineMs?: number;
  signal?: AbortSignal;
  terminateProcessTree?: (pid: number) => Promise<string[]>;
}

export async function waitForClaudeSubprocess(
  subprocess: ClaudeSubprocessLike,
  options: WaitForClaudeSubprocessOptions
): Promise<ClaudeExecuteResult> {
  const cleanupDeadlineMs = options.cleanupDeadlineMs ?? 5_000;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  let cancelled = false;
  let cleanupDiagnostics: string[] = [];
  let cleanupPromise: Promise<string[]> | undefined;
  let abortHandler: (() => void) | undefined;

  const childPromise = Promise.resolve(subprocess).then(
    (result) => ({ kind: "settled" as const, result }),
    (error) => ({ kind: "settled" as const, error })
  );

  const hasTimeout = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0;
  const timeoutPromise = hasTimeout
    ? new Promise<{ kind: "timeout" }>((resolve) => {
        timeoutId = setTimeout(() => {
          if (cleanupPromise) return;
          timedOut = true;
          cleanupPromise = startProcessTreeCleanup(subprocess, options.terminateProcessTree, "timed out");
          resolve({ kind: "timeout" });
        }, options.timeoutMs);
      })
    : new Promise<never>(() => undefined);
  const abortPromise = new Promise<{ kind: "abort" }>((resolve) => {
    abortHandler = () => {
      if (cleanupPromise) return;
      cancelled = true;
      cleanupPromise = startProcessTreeCleanup(subprocess, options.terminateProcessTree, "was cancelled");
      resolve({ kind: "abort" });
    };
    if (options.signal?.aborted) {
      abortHandler();
    } else {
      options.signal?.addEventListener("abort", abortHandler, { once: true });
    }
  });

  const first = await Promise.race([childPromise, timeoutPromise, abortPromise]);
  if (first.kind === "timeout" || first.kind === "abort") {
    if (timeoutId) clearTimeout(timeoutId);
    if (abortHandler) options.signal?.removeEventListener("abort", abortHandler);
    cleanupDiagnostics = await settleCleanup(cleanupPromise);
    const settledAfterCleanup = await Promise.race([
      childPromise,
      delay(cleanupDeadlineMs).then(() => ({ kind: "cleanup-expired" as const }))
    ]);
    if (settledAfterCleanup.kind === "cleanup-expired") {
      const rootKillDiagnostic = killRootSubprocess(subprocess);
      return {
        stdout: "",
        stderr: [
          timedOut
            ? `Claude Code subprocess timed out after ${options.timeoutMs}ms.`
            : "Claude Code subprocess was cancelled.",
          ...cleanupDiagnostics,
          rootKillDiagnostic,
          `Claude Code subprocess did not exit within ${cleanupDeadlineMs}ms after process-tree termination.`
        ].filter(Boolean).join("\n"),
        exitCode: null
      };
    }
    return subprocessResult(settledAfterCleanup, timedOut, cancelled, options.timeoutMs, cleanupDiagnostics);
  }

  if (timeoutId) clearTimeout(timeoutId);
  if (abortHandler) options.signal?.removeEventListener("abort", abortHandler);
  return subprocessResult(first, timedOut, cancelled, options.timeoutMs, cleanupDiagnostics);
}

export async function terminateProcessTree(
  pid: number,
  platform: NodeJS.Platform = process.platform
): Promise<string[]> {
  if (!Number.isInteger(pid) || pid <= 0) {
    return [`Cannot terminate Claude Code process tree for invalid pid: ${pid}`];
  }

  const command = getProcessTreeKillCommand(pid, platform);
  if ("command" in command) {
    const result = await execa(command.command, command.args, {
      reject: false,
      timeout: 10_000,
      windowsHide: true
    });
    return result.exitCode === 0
      ? [`Terminated Claude Code subprocess tree with taskkill for pid ${pid}.`]
      : [
          `taskkill failed while terminating Claude Code subprocess tree for pid ${pid}.`,
          outputToString(result.stderr || result.stdout)
        ].filter(Boolean);
  }

  try {
    process.kill(command.pid, command.signal);
    await delay(250);
    try {
      process.kill(command.pid, "SIGKILL");
    } catch (error) {
      if (!isMissingProcessError(error)) throw error;
    }
    return [`Terminated Claude Code subprocess group for pid ${pid}.`];
  } catch (error) {
    if (isMissingProcessError(error)) {
      return [`Claude Code subprocess group for pid ${pid} already exited.`];
    }
    return [`Failed to terminate Claude Code subprocess group for pid ${pid}: ${String(error)}`];
  }
}

async function settleCleanup(cleanupPromise: Promise<string[]> | undefined): Promise<string[]> {
  if (!cleanupPromise) return [];
  try {
    return await cleanupPromise;
  } catch (error) {
    return [`Failed to terminate Claude Code subprocess tree: ${String(error)}`];
  }
}

function subprocessResult(
  settled: { result?: unknown; error?: unknown },
  timedOut: boolean,
  cancelled: boolean,
  timeoutMs: number,
  cleanupDiagnostics: string[]
): ClaudeExecuteResult {
  const source = settled.error ?? settled.result;
  const result = source as { stdout?: unknown; stderr?: unknown; exitCode?: number | null } | undefined;
  const stderrLines = [
    timedOut ? `Claude Code subprocess timed out after ${timeoutMs}ms.` : undefined,
    cancelled ? "Claude Code subprocess was cancelled." : undefined,
    ...cleanupDiagnostics,
    outputToString(result?.stderr)
  ].filter(Boolean);
  return {
    stdout: outputToString(result?.stdout),
    stderr: stderrLines.join("\n"),
    exitCode: result?.exitCode ?? null
  };
}

function startProcessTreeCleanup(
  subprocess: ClaudeSubprocessLike,
  terminator: ((pid: number) => Promise<string[]>) | undefined,
  reason: "timed out" | "was cancelled"
): Promise<string[]> {
  const pid = subprocess.pid;
  return pid
    ? (terminator ?? terminateProcessTree)(pid)
    : Promise.resolve([`Claude Code subprocess ${reason} before a process id was available.`]);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isMissingProcessError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ESRCH"
  );
}

function killRootSubprocess(subprocess: ClaudeSubprocessLike): string | undefined {
  if (!subprocess.kill) return undefined;
  try {
    subprocess.kill("SIGKILL");
    return "Sent SIGKILL to the Claude Code root subprocess after process-tree cleanup deadline.";
  } catch (error) {
    return `Failed to kill Claude Code root subprocess after cleanup deadline: ${String(error)}`;
  }
}

async function collectLines(
  stream: Readable | null,
  target: string[],
  onLine: (line: string) => void
): Promise<void> {
  if (!stream) return;
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of lines) {
    target.push(line);
    onLine(line);
  }
}

async function waitForLineCollectors(tasks: Promise<void>[], timeoutMs?: number): Promise<void> {
  const settled = Promise.allSettled(tasks).then(() => undefined);
  if (timeoutMs === undefined) {
    await settled;
    return;
  }
  await Promise.race([settled, delay(timeoutMs)]);
}

export function combineStreamingProcessOutput(lines: string[], fallback: string): string {
  return [lines.join("\n"), fallback].filter(Boolean).join("\n");
}

function outputToString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === undefined || value === null) return "";
  if (value instanceof Uint8Array) return new TextDecoder().decode(value);
  return String(value);
}

function stringifyCompact(value: unknown): string {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return String(value);
  }
}

function summarizeText(value: string): string {
  return value.replace(/\s+/g, " ").slice(0, 200);
}

function redactLongArg(value: string): string {
  if (value.length <= 200) {
    return value;
  }
  return `${value.slice(0, 200)}[TRUNCATED]`;
}

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import {
  assertClaudeHelpSupportsRunnerFlags,
  buildClaudeArgs,
  buildExecaOptions,
  combineStreamingProcessOutput,
  getProcessTreeKillCommand,
  waitForClaudeSubprocess,
  runClaudeTask,
  type ClaudeExecutor,
  type StreamingClaudeExecutor
} from "../src/core/claude-runner.js";

describe("claude runner foundation", () => {
  it("builds Claude Code args with model aliases resolved by provider", () => {
    expect(
      buildClaudeArgs({
        prompt: "Review stdin.",
        model: "deepseek-v4-pro[1m]",
        effort: "max",
        permissionMode: "bypassPermissions",
        tools: ["default"],
        stream: true,
        verbose: true,
        includePartialMessages: true,
        includeHookEvents: true
      })
    ).toEqual([
      "-p",
      "Review stdin.",
      "--model",
      "deepseek-v4-pro[1m]",
      "--effort",
      "max",
      "--permission-mode",
      "bypassPermissions",
      "--dangerously-skip-permissions",
      "--allowedTools",
      "default",
      "--output-format",
      "stream-json",
      "--verbose",
      "--include-partial-messages",
      "--include-hook-events",
      "--no-session-persistence"
    ]);
  });

  it("verifies the runner flags against a Claude help snapshot", () => {
    const help = readFileSync(
      join(process.cwd(), "tests", "fixtures", "claude-help-runner-flags.txt"),
      "utf8"
    );

    expect(() => assertClaudeHelpSupportsRunnerFlags(help)).not.toThrow();
    expect(() => assertClaudeHelpSupportsRunnerFlags(help.replace("--effort", "--missing"))).toThrow(
      "--effort"
    );
  });

  it("verifies the runner flags against the installed Claude CLI when available", () => {
    const result = spawnSync("claude", ["--help"], { encoding: "utf8" });
    if (result.error && "code" in result.error && result.error.code === "ENOENT") {
      return;
    }

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(() => assertClaudeHelpSupportsRunnerFlags(result.stdout)).not.toThrow();
  });

  it("passes multiple tools as separate variadic argv entries", () => {
    const args = buildClaudeArgs({
      prompt: "Review stdin.",
      model: "opus",
      effort: "max",
      permissionMode: "plan",
      tools: ["Bash", "Read"],
      stream: false
    });

    expect(args.slice(args.indexOf("--allowedTools"), args.indexOf("--output-format"))).toEqual([
      "--allowedTools",
      "Bash",
      "Read"
    ]);
  });

  it("honors streaming activity flag toggles", () => {
    const args = buildClaudeArgs({
      prompt: "Review stdin.",
      model: "opus",
      effort: "max",
      permissionMode: "default",
      tools: ["default"],
      stream: true,
      verbose: false,
      includePartialMessages: false,
      includeHookEvents: false
    });

    expect(args).not.toContain("--verbose");
    expect(args).not.toContain("--include-partial-messages");
    expect(args).not.toContain("--include-hook-events");
  });

  it("maps AbortSignal to execa cancelSignal without leaking signal", () => {
    const controller = new AbortController();
    const options = buildExecaOptions({
      cwd: process.cwd(),
      input: "PACKET",
      env: {},
      reject: false,
      timeout: 100,
      signal: controller.signal
    });

    expect(options).not.toHaveProperty("signal");
    expect(options).toHaveProperty("cancelSignal", controller.signal);
  });

  it("uses runner-managed timeout settings suitable for process-tree cleanup", () => {
    const options = buildExecaOptions({
      cwd: process.cwd(),
      input: "PACKET",
      env: {},
      reject: false,
      timeout: 100
    });

    expect(options.timeout).toBe(0);
    expect(options.windowsHide).toBe(true);
  });

  it("builds platform-specific process-tree kill commands", () => {
    expect(getProcessTreeKillCommand(1234, "win32")).toEqual({
      command: "taskkill",
      args: ["/T", "/F", "/PID", "1234"]
    });
    expect(getProcessTreeKillCommand(1234, "linux")).toEqual({
      pid: -1234,
      signal: "SIGTERM"
    });
  });

  it("terminates the subprocess tree when the runner-managed timeout expires", async () => {
    const calls: number[] = [];
    const rootKills: string[] = [];
    const pending = new Promise(() => undefined) as Promise<never> & {
      kill: (signal?: NodeJS.Signals | number) => boolean;
      pid: number;
    };
    pending.pid = 4321;
    pending.kill = (signal?: NodeJS.Signals | number) => {
      rootKills.push(String(signal));
      return true;
    };

    const result = await waitForClaudeSubprocess(pending, {
      timeoutMs: 1,
      cleanupDeadlineMs: 1,
      terminateProcessTree: async (pid) => {
        calls.push(pid);
        return ["terminated process tree"];
      }
    });

    expect(calls).toEqual([4321]);
    expect(rootKills).toEqual(["SIGKILL"]);
    expect(result.exitCode).toBeNull();
    expect(result.stderr).toContain("timed out after 1ms");
    expect(result.stderr).toContain("terminated process tree");
    expect(result.stderr).toContain("did not exit within 1ms");
  });

  it("preserves runner timeout diagnostics alongside collected streaming stderr", () => {
    expect(
      combineStreamingProcessOutput(["claude stderr"], "Claude Code subprocess timed out after 1ms.")
    ).toBe("claude stderr\nClaude Code subprocess timed out after 1ms.");
  });

  it("terminates the subprocess tree when the abort signal fires", async () => {
    const calls: number[] = [];
    const controller = new AbortController();
    const pending = new Promise(() => undefined) as Promise<never> & { pid: number };
    pending.pid = 4567;

    const resultPromise = waitForClaudeSubprocess(pending, {
      timeoutMs: 60_000,
      cleanupDeadlineMs: 1,
      signal: controller.signal,
      terminateProcessTree: async (pid) => {
        calls.push(pid);
        return ["terminated after abort"];
      }
    });
    controller.abort();
    const result = await resultPromise;

    expect(calls).toEqual([4567]);
    expect(result.exitCode).toBeNull();
    expect(result.stderr).toContain("cancelled");
    expect(result.stderr).toContain("terminated after abort");
  });

  it("treats non-positive runner timeout as disabled", async () => {
    const calls: number[] = [];
    const delayed = new Promise((resolve) =>
      setTimeout(() => resolve({ stdout: "ok", stderr: "", exitCode: 0 }), 5)
    );

    const result = await waitForClaudeSubprocess(delayed, {
      timeoutMs: 0,
      terminateProcessTree: async (pid) => {
        calls.push(pid);
        return [];
      }
    });

    expect(calls).toEqual([]);
    expect(result.stdout).toBe("ok");
    expect(result.stderr).not.toContain("timed out");
    expect(result.exitCode).toBe(0);
  });

  it("parses a reviewer stream fixture and redacts provider tokens end-to-end", async () => {
    const fixture = readFileSync(
      join(process.cwd(), "tests", "fixtures", "claude-stream-review.jsonl"),
      "utf8"
    );
    const progressEvents: unknown[] = [];
    let observedEnv: Record<string, string> | undefined;
    const executeStreaming: StreamingClaudeExecutor = async (
      _command,
      _args,
      options,
      onStdoutLine
    ) => {
      observedEnv = options.env;
      for (const line of fixture.trim().split(/\r?\n/)) {
        onStdoutLine(line);
      }
      return { stdout: fixture, stderr: "stderr deepseek-token", exitCode: 0 };
    };

    const result = await runClaudeTask(
      {
        cwd: process.cwd(),
        input: "PACKET",
        prompt: "Review anthropic-token.",
        provider: "deepseek",
        model: "opus",
        effort: "max",
        cacheTtl: "1h",
        permissionMode: "bypassPermissions",
        tools: ["default"],
        stream: true,
        sourceEnv: { DEEPSEEK_API_KEY: "deepseek-token" }
      },
      {
        executeStreaming,
        onActivity: (event) => progressEvents.push(event),
        now: fakeClock([1, 11])
      }
    );

    const serialized = JSON.stringify({ result, progressEvents });
    expect(result.ok).toBe(true);
    expect(result.elapsedMs).toBe(10);
    expect(result.review).toBe("Final [REDACTED_PROVIDER_TOKEN] review.");
    expect(result.eventCount).toBe(6);
    expect(result.activityTail?.map((event) => event.kind)).toContain("tool_use");
    expect(result.transcriptTail).toEqual([
      "Inspecting [REDACTED_PROVIDER_TOKEN] now.",
      "Intermediate [REDACTED_PROVIDER_TOKEN] finding."
    ]);
    expect(result.cache).toEqual({
      inputTokens: 12,
      creationInputTokens: 100,
      readInputTokens: 200,
      cacheCreation: {
        ephemeral1hInputTokens: 80,
        ephemeral5mInputTokens: 20
      }
    });
    expect(result.costUsd).toBe(0.12);
    expect(result.diagnostics).toEqual([
      "DeepSeek route target: api.deepseek.com; token source: DEEPSEEK_API_KEY."
    ]);
    expect(observedEnv?.ANTHROPIC_AUTH_TOKEN).toBe("deepseek-token");
    expect(serialized).not.toContain("deepseek-token");
    expect(serialized).toContain("[REDACTED_PROVIDER_TOKEN]");
  });

  it("redacts inherited Anthropic, Bedrock, and cloud credentials end-to-end", async () => {
    const result = await runClaudeTask(
      {
        cwd: process.cwd(),
        input: "PACKET",
        prompt: "Review anthropic-token.",
        provider: "anthropic",
        model: "opus",
        effort: "max",
        cacheTtl: "1h",
        permissionMode: "bypassPermissions",
        tools: ["default"],
        stream: false,
        sourceEnv: {
          ANTHROPIC_AUTH_TOKEN: "anthropic-token",
          ANTHROPIC_BEDROCK_AUTH_TOKEN: "bedrock-token",
          AWS_SECRET_ACCESS_KEY: "aws-secret",
          AWS_SESSION_TOKEN: "aws-session",
          GOOGLE_APPLICATION_CREDENTIALS: "vertex.json"
        }
      },
      {
        execute: async () => ({
          stdout: JSON.stringify({
            result:
              "anthropic-token bedrock-token aws-secret aws-session vertex.json"
          }),
          stderr: "anthropic-token bedrock-token aws-secret aws-session vertex.json",
          exitCode: 1
        }),
        now: fakeClock([1, 2])
      }
    );

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("anthropic-token");
    expect(serialized).not.toContain("bedrock-token");
    expect(serialized).not.toContain("aws-secret");
    expect(serialized).not.toContain("aws-session");
    expect(serialized).not.toContain("vertex.json");
    expect(serialized).toContain("[REDACTED_PROVIDER_TOKEN]");
  });

  it("reports non-json stream lines as diagnostics", async () => {
    const result = await runClaudeTask(
      {
        cwd: process.cwd(),
        input: "PACKET",
        prompt: "Review stdin.",
        provider: "anthropic",
        model: "opus",
        effort: "max",
        cacheTtl: "1h",
        permissionMode: "bypassPermissions",
        tools: ["default"],
        stream: true,
        sourceEnv: {}
      },
      {
        executeStreaming: async (_command, _args, _options, onStdoutLine) => {
          onStdoutLine("not-json");
          onStdoutLine(JSON.stringify({ type: "result", result: "Final review." }));
          return { stdout: "", stderr: "", exitCode: 0 };
        },
        now: fakeClock([1, 2])
      }
    );

    expect(result.review).toBe("Final review.");
    expect(result.diagnostics).toEqual([
      "Ignored 1 non-JSON lines from Claude Code stream output."
    ]);
  });

  it("captures text content_block_start events before text deltas", async () => {
    const result = await runClaudeTask(
      {
        cwd: process.cwd(),
        input: "PACKET",
        prompt: "Review stdin.",
        provider: "anthropic",
        model: "opus",
        effort: "max",
        cacheTtl: "1h",
        permissionMode: "bypassPermissions",
        tools: ["default"],
        stream: true,
        sourceEnv: {}
      },
      {
        executeStreaming: async (_command, _args, _options, onStdoutLine) => {
          onStdoutLine(
            JSON.stringify({
              type: "stream_event",
              event: {
                type: "content_block_start",
                content_block: { type: "text", text: "Started " }
              }
            })
          );
          onStdoutLine(
            JSON.stringify({
              type: "stream_event",
              event: {
                type: "content_block_delta",
                delta: { type: "text_delta", text: "then continued." }
              }
            })
          );
          onStdoutLine(JSON.stringify({ type: "result" }));
          return { stdout: "", stderr: "", exitCode: 0 };
        },
        now: fakeClock([1, 2])
      }
    );

    expect(result.review).toBe("Started then continued.");
    expect(result.transcriptTail).toEqual(["Started then continued."]);
  });

  it("does not forward thinking deltas as review content", async () => {
    const result = await runClaudeTask(
      {
        cwd: process.cwd(),
        input: "PACKET",
        prompt: "Review stdin.",
        provider: "anthropic",
        model: "opus",
        effort: "max",
        cacheTtl: "1h",
        permissionMode: "bypassPermissions",
        tools: ["default"],
        stream: true,
        sourceEnv: {}
      },
      {
        executeStreaming: async (_command, _args, _options, onStdoutLine) => {
          onStdoutLine(
            JSON.stringify({
              type: "stream_event",
              event: {
                type: "content_block_delta",
                delta: {
                  type: "thinking_delta",
                  thinking: "private chain of thought"
                }
              }
            })
          );
          onStdoutLine(
            JSON.stringify({
              type: "stream_event",
              event: {
                type: "content_block_delta",
                delta: { type: "text_delta", text: "Public review." }
              }
            })
          );
          onStdoutLine(JSON.stringify({ type: "result" }));
          return { stdout: "", stderr: "", exitCode: 0 };
        },
        now: fakeClock([1, 2])
      }
    );

    expect(result.review).toBe("Public review.");
    expect(result.transcriptTail).toEqual(["Public review."]);
    expect(JSON.stringify(result)).not.toContain("private chain of thought");
  });

  it("returns provider configuration errors before starting Claude Code", async () => {
    let reachedExecutor = false;
    const execute: ClaudeExecutor = async () => {
      reachedExecutor = true;
      return { stdout: "", stderr: "", exitCode: 0 };
    };

    const result = await runClaudeTask(
      {
        cwd: process.cwd(),
        input: "PACKET",
        prompt: "Review stdin.",
        provider: "deepseek",
        model: "opus",
        effort: "max",
        cacheTtl: "1h",
        permissionMode: "bypassPermissions",
        tools: ["default"],
        stream: false,
        sourceEnv: {}
      },
      { execute, now: fakeClock([1, 2]) }
    );

    expect(reachedExecutor).toBe(false);
    expect(result.ok).toBe(false);
    expect(result.review).toContain("DEEPSEEK_API_KEY");
  });
});

function fakeClock(values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? values.at(-1) ?? 0;
}

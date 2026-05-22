import { describe, expect, it } from "vitest";

import type { ClaudeExecutor } from "../src/core/claude-runner.js";
import { DELEGATE_STDIN_PROMPT, runClaudeDelegate } from "../src/tasks/delegate/tool.js";
import type { CcDelegateInput } from "../src/tasks/delegate/schema.js";

const baseInput: CcDelegateInput = {
  prompt: "Edit the requested file.",
  providerProfile: "anthropic",
  model: "opus",
  effort: "max",
  timeoutMs: 900_000,
  maxContextChars: 120_000,
  stream: false,
  cacheTtl: "1h"
};

describe("runClaudeDelegate", () => {
  it("passes Codex prompt directly to Claude Code and maps structured output", async () => {
    let observed: Parameters<ClaudeExecutor> | undefined;
    const result = await runClaudeDelegate(baseInput, {
        execute: async (...args) => {
          observed = args;
          return {
            stdout: JSON.stringify({
              result: "Implemented.",
              structured_output: {
                status: "succeeded",
                summary: "Implemented the change.",
                filesChanged: ["src/index.ts"],
                commandsRun: [{ command: "npm test", exitCode: 0, summary: "94 tests passed." }],
                verification: ["npm test passed."],
                risks: [],
                diagnostics: []
              }
            }),
            stderr: "",
            exitCode: 0
          };
        },
        now: fakeClock([1, 11])
      }
    );

    expect(result.ok).toBe(true);
    expect(result.status).toBe("succeeded");
    expect(observed?.[1]).toContain(DELEGATE_STDIN_PROMPT);
    expect(observed?.[1]).toContain("bypassPermissions");
    expect(observed?.[1]).toContain("--dangerously-skip-permissions");
    expect(observed?.[2]?.input).toBe("Edit the requested file.\n");
    expect(observed?.[2]?.cwd).toBe(process.cwd());
    expect(observed?.[1]).not.toContain("--allowedTools");
  });

  it("uses cwd only as the Claude Code subprocess working directory", async () => {
    let observedOptions: Parameters<ClaudeExecutor>[2] | undefined;
    await runClaudeDelegate(
      { ...baseInput, cwd: "D:\\Codes\\repo" },
      {
        execute: async (...args) => {
          observedOptions = args[2];
          return {
            stdout: JSON.stringify({
              result: "Done.",
              structured_output: {
                status: "succeeded",
                summary: "Done.",
                filesChanged: [],
                commandsRun: [],
                verification: [],
                risks: [],
                diagnostics: []
              }
            }),
            stderr: "",
            exitCode: 0
          };
        },
        now: fakeClock([1, 2])
      }
    );

    expect(observedOptions?.cwd).toBe("D:\\Codes\\repo");
  });

  it("returns failed for malformed structured delegate output", async () => {
    const result = await runClaudeDelegate(baseInput, {
      execute: async () => ({
        stdout: JSON.stringify({ result: "Plain output.", structured_output: { summary: "missing" } }),
        stderr: "",
        exitCode: 0
      }),
      now: fakeClock([1, 2])
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("failed");
    expect(result.diagnostics.join("\n")).toContain("structured delegate output");
  });

  it("redacts secrets from structured delegate output", async () => {
    const result = await runClaudeDelegate(baseInput, {
      execute: async () => ({
        stdout: JSON.stringify({
          result: "token=sk_test12345678",
          structured_output: {
            status: "succeeded",
            summary: "token=sk_test12345678",
            filesChanged: ["src/index.ts"],
            commandsRun: [
              { command: "echo token=sk_test12345678", exitCode: 0, summary: "api_key=sk-liveabcdefghi" }
            ],
            verification: ["token=sk_test12345678"],
            risks: ["secret=sk_test12345678"],
            diagnostics: []
          }
        }),
        stderr: "",
        exitCode: 0
      }),
      now: fakeClock([1, 2])
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("sk_test12345678");
    expect(serialized).not.toContain("sk-liveabcdefghi");
    expect(serialized).toContain("[REDACTED]");
  });

  it("returns provider configuration failures as blocked delegation", async () => {
    const result = await runClaudeDelegate(
      { ...baseInput, providerProfile: "deepseek" },
      {
        sourceEnv: {},
        now: fakeClock([1, 2])
      }
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe("failed");
    expect(result.summary).toContain("DEEPSEEK_API_KEY");
    expect(result.diagnostics.join("\n")).not.toContain("cache and cost fields");
  });

  it("returns cancelled without starting Claude Code when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await runClaudeDelegate(baseInput, {
      signal: controller.signal,
      execute: async () => {
        throw new Error("execute should not be called");
      },
      now: fakeClock([1, 2])
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("cancelled");
    expect(result.summary).toContain("cancelled");
  });
});

function fakeClock(values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? values.at(-1) ?? 0;
}

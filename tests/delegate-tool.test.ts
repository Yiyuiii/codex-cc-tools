import { describe, expect, it } from "vitest";

import type { ClaudeExecutor } from "../src/core/claude-runner.js";
import { DELEGATE_STDIN_PROMPT, runClaudeDelegate } from "../src/tasks/delegate/tool.js";
import type { CcDelegateInput } from "../src/tasks/delegate/schema.js";

const baseInput: CcDelegateInput = {
  task: "Edit the requested file.",
  cwd: "D:\\Codes\\repo-worktree",
  isolation: { kind: "git-worktree", branch: "codex/feature" },
  acceptanceCriteria: ["Tests pass."],
  providerProfile: "anthropic",
  model: "opus",
  effort: "max",
  timeoutMs: 900_000,
  maxContextChars: 120_000,
  stream: false,
  cacheTtl: "1h"
};

describe("runClaudeDelegate", () => {
  it("returns blocked before Claude Code when policy fails", async () => {
    let executed = false;
    const result = await runClaudeDelegate(
      { ...baseInput, cwd: "C:\\" },
      {
        policy: { platform: "win32" },
        execute: async () => {
          executed = true;
          throw new Error("should not execute");
        },
        now: fakeClock([1, 2])
      }
    );

    expect(executed).toBe(false);
    expect(result.ok).toBe(false);
    expect(result.status).toBe("blocked");
    expect(result.diagnostics.join("\n")).toContain("unsafe workspace");
  });

  it("runs Claude Code with writable authority and maps structured output", async () => {
    let observed: Parameters<ClaudeExecutor> | undefined;
    const result = await runClaudeDelegate(
      { ...baseInput, commandsAllowed: ["npm test"] },
      {
        policy: { git: { isLinkedWorktree: true, isBare: false, dirtyStatus: [] } },
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
        buildPacket: async () => "PACKET",
        getChangedPaths: async () => ["src/index.ts"],
        now: fakeClock([1, 11])
      }
    );

    expect(result.ok).toBe(true);
    expect(result.status).toBe("succeeded");
    expect(observed?.[1]).toContain(DELEGATE_STDIN_PROMPT);
    expect(observed?.[1]).toContain("--permission-mode");
    expect(observed?.[1]).toContain("acceptEdits");
    expect(observed?.[1]).not.toContain("--dangerously-skip-permissions");
    expect(observed?.[1]).toContain("Bash(npm test)");
  });

  it("blocks malformed structured delegate output", async () => {
    const result = await runClaudeDelegate(baseInput, {
      policy: { git: { isLinkedWorktree: true, isBare: false } },
      execute: async () => ({
        stdout: JSON.stringify({ result: "Plain output.", structured_output: { summary: "missing" } }),
        stderr: "",
        exitCode: 0
      }),
      buildPacket: async () => "PACKET",
      getChangedPaths: async () => [],
      now: fakeClock([1, 2])
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("blocked");
    expect(result.diagnostics.join("\n")).toContain("structured delegate output");
  });

  it("redacts secrets from structured delegate output", async () => {
    const result = await runClaudeDelegate(baseInput, {
      policy: { git: { isLinkedWorktree: true, isBare: false } },
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
      buildPacket: async () => "PACKET",
      getChangedPaths: async () => ["src/index.ts"],
      now: fakeClock([1, 2])
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("sk_test12345678");
    expect(serialized).not.toContain("sk-liveabcdefghi");
    expect(serialized).toContain("[REDACTED]");
  });

  it("blocks post-run changed paths that resolve outside the workspace", async () => {
    const result = await runClaudeDelegate(
      {
        ...baseInput,
        allowedPaths: ["linked"]
      },
      {
        policy: {
          git: { isLinkedWorktree: true, isBare: false },
          platform: "win32",
          realpath: (value) =>
            value.endsWith("linked\\secret.txt") ? "C:\\Users\\Ada\\secret.txt" : value
        },
        execute: async () => ({
          stdout: JSON.stringify({
            result: "Changed file.",
            structured_output: {
              status: "succeeded",
              summary: "Changed file.",
              filesChanged: ["linked\\secret.txt"],
              commandsRun: [],
              verification: [],
              risks: [],
              diagnostics: []
            }
          }),
          stderr: "",
          exitCode: 0
        }),
        buildPacket: async () => "PACKET",
        getChangedPaths: async () => ["linked\\secret.txt"],
        now: fakeClock([1, 2])
      }
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe("blocked");
    expect(result.diagnostics.join("\n")).toContain("outside workspace");
  });

  it("uses runtime-collected realpath checks for post-run changed paths", async () => {
    const result = await runClaudeDelegate(
      {
        ...baseInput,
        allowedPaths: ["linked"]
      },
      {
        collectPolicyDeps: async () => ({
          platform: "win32",
          realpath: (value) =>
            value.endsWith("linked\\secret.txt") ? "C:\\Users\\Ada\\secret.txt" : value,
          git: { isLinkedWorktree: true, isBare: false }
        }),
        execute: async () => ({
          stdout: JSON.stringify({
            result: "Changed file.",
            structured_output: {
              status: "succeeded",
              summary: "Changed file.",
              filesChanged: ["linked\\secret.txt"],
              commandsRun: [],
              verification: [],
              risks: [],
              diagnostics: []
            }
          }),
          stderr: "",
          exitCode: 0
        }),
        buildPacket: async () => "PACKET",
        getChangedPaths: async () => ["linked\\secret.txt"],
        now: fakeClock([1, 2])
      }
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe("blocked");
    expect(result.diagnostics.join("\n")).toContain("outside workspace");
  });

  it("downgrades over-reported changed paths to partial", async () => {
    const result = await runClaudeDelegate(baseInput, {
      policy: { git: { isLinkedWorktree: true, isBare: false } },
      execute: async () => ({
        stdout: JSON.stringify({
          result: "Reported change.",
          structured_output: {
            status: "succeeded",
            summary: "Reported change.",
            filesChanged: ["src/index.ts"],
            commandsRun: [],
            verification: [],
            risks: [],
            diagnostics: []
          }
        }),
        stderr: "",
        exitCode: 0
      }),
      buildPacket: async () => "PACKET",
      getChangedPaths: async () => [],
      now: fakeClock([1, 2])
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("partial");
    expect(result.diagnostics.join("\n")).toContain("reported paths not observed");
  });

  it("compares post-run changed paths against the pre-run dirty snapshot", async () => {
    const result = await runClaudeDelegate(
      {
        ...baseInput,
        isolation: { kind: "git-worktree", branch: "codex/feature", acceptDirty: true }
      },
      {
        policy: {
          git: {
            isLinkedWorktree: true,
            isBare: false,
            dirtyStatus: ["preexisting.txt"]
          }
        },
        execute: async () => ({
          stdout: JSON.stringify({
            result: "Changed file.",
            structured_output: {
              status: "succeeded",
              summary: "Changed file.",
              filesChanged: ["created.txt"],
              commandsRun: [],
              verification: [],
              risks: [],
              diagnostics: []
            }
          }),
          stderr: "",
          exitCode: 0
        }),
        buildPacket: async () => "PACKET",
        getChangedPaths: async () => ["preexisting.txt", "created.txt"],
        now: fakeClock([1, 2])
      }
    );

    expect(result.ok).toBe(true);
    expect(result.status).toBe("partial");
    expect(result.diagnostics.join("\n")).toContain("already dirty before delegate ran");
  });

  it("downgrades reports for pre-existing dirty paths to partial because git status cannot prove the delegate changed them", async () => {
    const result = await runClaudeDelegate(
      {
        ...baseInput,
        isolation: { kind: "git-worktree", branch: "codex/feature", acceptDirty: true }
      },
      {
        policy: {
          git: {
            isLinkedWorktree: true,
            isBare: false,
            dirtyStatus: ["preexisting.txt"]
          }
        },
        execute: async () => ({
          stdout: JSON.stringify({
            result: "Reported file.",
            structured_output: {
              status: "succeeded",
              summary: "Reported file.",
              filesChanged: ["preexisting.txt"],
              commandsRun: [],
              verification: [],
              risks: [],
              diagnostics: []
            }
          }),
          stderr: "",
          exitCode: 0
        }),
        buildPacket: async () => "PACKET",
        getChangedPaths: async () => ["preexisting.txt"],
        now: fakeClock([1, 2])
      }
    );

    expect(result.ok).toBe(true);
    expect(result.status).toBe("partial");
    expect(result.diagnostics.join("\n")).toContain("already dirty before delegate ran");
  });

  it("downgrades unreported pre-existing dirty paths observed after the run to partial", async () => {
    const result = await runClaudeDelegate(
      {
        ...baseInput,
        isolation: { kind: "git-worktree", branch: "codex/feature", acceptDirty: true }
      },
      {
        policy: {
          git: {
            isLinkedWorktree: true,
            isBare: false,
            dirtyStatus: ["preexisting.txt"]
          }
        },
        execute: async () => ({
          stdout: JSON.stringify({
            result: "Changed file.",
            structured_output: {
              status: "succeeded",
              summary: "Changed file.",
              filesChanged: ["created.txt"],
              commandsRun: [],
              verification: [],
              risks: [],
              diagnostics: []
            }
          }),
          stderr: "",
          exitCode: 0
        }),
        buildPacket: async () => "PACKET",
        getChangedPaths: async () => ["preexisting.txt", "created.txt"],
        now: fakeClock([1, 2])
      }
    );

    expect(result.ok).toBe(true);
    expect(result.status).toBe("partial");
    expect(result.diagnostics.join("\n")).toContain("already dirty before delegate ran");
  });

  it("downgrades when pre-run dirty snapshot is unavailable", async () => {
    const result = await runClaudeDelegate(baseInput, {
      policy: {
        git: {
          isLinkedWorktree: true,
          isBare: false
        }
      },
      execute: async () => ({
        stdout: JSON.stringify({
          result: "Changed file.",
          structured_output: {
            status: "succeeded",
            summary: "Changed file.",
            filesChanged: ["src/index.ts"],
            commandsRun: [],
            verification: [],
            risks: [],
            diagnostics: []
          }
        }),
        stderr: "",
        exitCode: 0
      }),
      buildPacket: async () => "PACKET",
      getChangedPaths: async () => ["src/index.ts"],
      now: fakeClock([1, 2])
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("partial");
    expect(result.diagnostics.join("\n")).toContain("pre-run dirty snapshot unavailable");
  });

  it("downgrades absolute reports for pre-existing dirty relative paths to partial", async () => {
    const result = await runClaudeDelegate(
      {
        ...baseInput,
        isolation: { kind: "git-worktree", branch: "codex/feature", acceptDirty: true }
      },
      {
        policy: {
          platform: "win32",
          git: {
            isLinkedWorktree: true,
            isBare: false,
            dirtyStatus: ["preexisting.txt"]
          }
        },
        execute: async () => ({
          stdout: JSON.stringify({
            result: "Reported file.",
            structured_output: {
              status: "succeeded",
              summary: "Reported file.",
              filesChanged: ["D:\\Codes\\repo-worktree\\preexisting.txt"],
              commandsRun: [],
              verification: [],
              risks: [],
              diagnostics: []
            }
          }),
          stderr: "",
          exitCode: 0
        }),
        buildPacket: async () => "PACKET",
        getChangedPaths: async () => ["preexisting.txt"],
        now: fakeClock([1, 2])
      }
    );

    expect(result.ok).toBe(true);
    expect(result.status).toBe("partial");
    expect(result.diagnostics.join("\n")).toContain("already dirty before delegate ran");
  });

  it("matches reported and observed paths with Windows separator and case normalization", async () => {
    const result = await runClaudeDelegate(
      {
        ...baseInput,
        isolation: { kind: "git-worktree", branch: "codex/feature" }
      },
      {
        policy: {
          platform: "win32",
          git: { isLinkedWorktree: true, isBare: false, dirtyStatus: [] }
        },
        execute: async () => ({
          stdout: JSON.stringify({
            result: "Changed file.",
            structured_output: {
              status: "succeeded",
              summary: "Changed file.",
              filesChanged: ["SRC\\INDEX.TS"],
              commandsRun: [],
              verification: [],
              risks: [],
              diagnostics: []
            }
          }),
          stderr: "",
          exitCode: 0
        }),
        buildPacket: async () => "PACKET",
        getChangedPaths: async () => ["src/index.ts"],
        now: fakeClock([1, 2])
      }
    );

    expect(result.ok).toBe(true);
    expect(result.status).toBe("succeeded");
    expect(result.diagnostics.join("\n")).not.toContain("not reported");
    expect(result.diagnostics.join("\n")).not.toContain("not observed");
  });

  it("returns provider configuration failures as blocked delegation", async () => {
    const result = await runClaudeDelegate(
      { ...baseInput, providerProfile: "deepseek" },
      {
        policy: { git: { isLinkedWorktree: true, isBare: false } },
        sourceEnv: {},
        buildPacket: async () => "PACKET",
        now: fakeClock([1, 2])
      }
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe("blocked");
    expect(result.summary).toContain("DEEPSEEK_API_KEY");
  });

  it("blocks structured command claims outside the delegate command policy", async () => {
    const result = await runClaudeDelegate(
      { ...baseInput, commandsAllowed: ["npm test"] },
      {
        policy: { git: { isLinkedWorktree: true, isBare: false } },
        execute: async () => ({
          stdout: JSON.stringify({
            result: "Ran command.",
            structured_output: {
              status: "succeeded",
              summary: "Ran command.",
              filesChanged: [],
              commandsRun: [{ command: "git push origin main", exitCode: 0, summary: "pushed" }],
              verification: [],
              risks: [],
              diagnostics: []
            }
          }),
          stderr: "",
          exitCode: 0
        }),
        buildPacket: async () => "PACKET",
        getChangedPaths: async () => [],
        now: fakeClock([1, 2])
      }
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe("blocked");
    expect(result.diagnostics.join("\n")).toContain("reported command is not allowed");
    expect(result.diagnostics.join("\n")).toContain("mutates remotes");
  });
});

function fakeClock(values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? values.at(-1) ?? 0;
}

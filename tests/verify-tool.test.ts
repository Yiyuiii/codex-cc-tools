import { describe, expect, it } from "vitest";

import { VERIFY_STDIN_PROMPT, runClaudeVerify } from "../src/tasks/verify/tool.js";
import type { ClaudeExecutor } from "../src/core/claude-runner.js";
import type { CcVerifyInput } from "../src/tasks/verify/schema.js";

const baseInput: CcVerifyInput = {
  hypothesis: "The test suite passes.",
  commandsAllowed: ["npm test"],
  model: "opus",
  effort: "max",
  timeoutMs: 900_000,
  maxContextChars: 120_000,
  stream: false,
  cacheTtl: "1h",
  providerProfile: "anthropic"
};

describe("runClaudeVerify", () => {
  it("maps structured verification output and passes command allowlist tools", async () => {
    let observed: Parameters<ClaudeExecutor> | undefined;
    const execute: ClaudeExecutor = async (...args) => {
      observed = args;
      return {
        stdout: JSON.stringify({
          result: "Tests pass.",
          structured_output: {
            status: "verified",
            summary: "Tests pass.",
            commandsRun: [{ command: "npm test", exitCode: 0, summary: "78 tests passed." }],
            evidence: ["Vitest reported 78 passed tests."],
            reproduction: "Ran npm test.",
            needsFollowup: false,
            diagnostics: []
          }
        }),
        stderr: "",
        exitCode: 0
      };
    };

    const result = await runClaudeVerify(baseInput, {
      execute,
      buildPacket: async () => "PACKET",
      now: fakeClock([1, 11])
    });

    expect(result).toMatchObject({
      ok: true,
      status: "verified",
      model: "opus",
      elapsedMs: 10,
      summary: "Tests pass."
    });
    expect(observed?.[1]).toContain(VERIFY_STDIN_PROMPT);
    expect(observed?.[1]).toContain("Bash(npm test)");
    expect(observed?.[2].input).toBe("PACKET");
  });

  it("blocks malformed structured verification output", async () => {
    const result = await runClaudeVerify(baseInput, {
      execute: async () => ({
        stdout: JSON.stringify({
          result: "Plain output.",
          structured_output: { summary: "Missing status." }
        }),
        stderr: "",
        exitCode: 0
      }),
      buildPacket: async () => "PACKET",
      now: fakeClock([1, 2])
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("blocked");
    expect(result.summary).toBe("Plain output.");
    expect(result.diagnostics?.join("\n")).toContain("structured verification output");
  });

  it("preserves non-zero command outcomes reported by Claude Code", async () => {
    const result = await runClaudeVerify(baseInput, {
      execute: async () => ({
        stdout: JSON.stringify({
          result: "Tests failed.",
          structured_output: {
            status: "not_reproduced",
            summary: "The command failed.",
            commandsRun: [{ command: "npm test", exitCode: 1, summary: "One test failed." }],
            evidence: ["Vitest reported one failed test."],
            reproduction: "Ran npm test.",
            needsFollowup: true,
            diagnostics: []
          }
        }),
        stderr: "",
        exitCode: 0
      }),
      buildPacket: async () => "PACKET",
      now: fakeClock([1, 2])
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("not_reproduced");
    expect(result.commandsRun[0]?.exitCode).toBe(1);
    expect(result.needsFollowup).toBe(true);
  });

  it("redacts secrets from structured verification output fields", async () => {
    const result = await runClaudeVerify(baseInput, {
      execute: async () => ({
        stdout: JSON.stringify({
          result: "curl returned token=sk_test12345678",
          structured_output: {
            status: "verified",
            summary: "curl returned token=sk_test12345678",
            commandsRun: [
              {
                command: "curl https://example.test/health?token=sk_test12345678",
                exitCode: 0,
                summary: "response included api_key=sk-liveabcdefghi"
              }
            ],
            evidence: ["raw token=sk_test12345678"],
            reproduction: "rerun with token=sk_test12345678",
            needsFollowup: false,
            diagnostics: ["saw secret=sk_test12345678"]
          }
        }),
        stderr: "",
        exitCode: 0
      }),
      buildPacket: async () => "PACKET",
      now: fakeClock([1, 2])
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("sk_test12345678");
    expect(serialized).not.toContain("sk-liveabcdefghi");
    expect(serialized).toContain("[REDACTED]");
  });

  it("returns provider configuration errors as blocked verification", async () => {
    const result = await runClaudeVerify(
      { ...baseInput, providerProfile: "deepseek" },
      {
        buildPacket: async () => "PACKET",
        sourceEnv: {},
        now: fakeClock([1, 2])
      }
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe("blocked");
    expect(result.summary).toContain("DEEPSEEK_API_KEY");
  });
});

function fakeClock(values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? values.at(-1) ?? 0;
}

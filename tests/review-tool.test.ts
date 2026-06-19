import { describe, expect, it } from "vitest";

import { runClaudeReview, REVIEW_STDIN_PROMPT } from "../src/tasks/review/tool.js";
import type { ClaudeExecutor } from "../src/core/claude-runner.js";
import { CcReviewInputSchema, type CcReviewInput } from "../src/tasks/review/schema.js";

const baseInput: CcReviewInput = {
  task: "review_plan",
  context: "Review this plan.",
  model: "opus",
  effort: "max",
  output: "markdown",
  permissionMode: "bypassPermissions",
  includeGitDiff: false,
  includeGitStatus: false,
  redactSecrets: false,
  maxContextChars: 120_000,
  stream: false,
  includePartialMessages: true,
  includeHookEvents: true,
  verbose: true,
  cacheTtl: "1h",
  providerProfile: "anthropic"
};

describe("runClaudeReview", () => {
  it("builds a review packet and maps Claude runner output into the review contract", async () => {
    let observed: Parameters<ClaudeExecutor> | undefined;
    const execute: ClaudeExecutor = async (...args) => {
      observed = args;
      return {
        stdout: JSON.stringify({
          result: "No findings.",
          usage: {
            input_tokens: 12,
            cache_creation_input_tokens: 100,
            cache_read_input_tokens: 200
          },
          total_cost_usd: 0.04
        }),
        stderr: "",
        exitCode: 0
      };
    };

    const result = await runClaudeReview(baseInput, {
      execute,
      buildPacket: async () => "PACKET",
      now: fakeClock([1_000, 1_250])
    });

    expect(result).toMatchObject({
      ok: true,
      task: "review_plan",
      model: "claude-opus-4-8",
      elapsedMs: 250,
      review: "No findings.",
      costUsd: 0.04
    });
    expect(result.cache).toEqual({
      inputTokens: 12,
      creationInputTokens: 100,
      readInputTokens: 200,
      effective: "hit"
    });
    expect(observed?.[0]).toBe("claude");
    expect(observed?.[1]).toContain(REVIEW_STDIN_PROMPT);
    expect(observed?.[2].input).toBe("PACKET");
  });

  it("requests Claude JSON schema output when review output is json", async () => {
    let observedArgs: string[] | undefined;

    await runClaudeReview(
      { ...baseInput, output: "json" },
      {
        execute: async (_command, args) => {
          observedArgs = args;
          return {
            stdout: JSON.stringify({
              result: "Needs changes.",
              structured_output: { verdict: "needs_changes", summary: "x", findings: [], missing_context: [] }
            }),
            stderr: "",
            exitCode: 0
          };
        },
        buildPacket: async () => "PACKET",
        now: fakeClock([1, 2])
      }
    );

    expect(observedArgs).toContain("--json-schema");
    expect(JSON.parse(observedArgs?.at((observedArgs?.indexOf("--json-schema") ?? -1) + 1) ?? "{}")).toMatchObject({
      type: "object",
      properties: {
        verdict: { type: "string" }
      }
    });
  });

  it("passes streaming activity flag toggles to the shared runner", async () => {
    let observedArgs: string[] | undefined;

    await runClaudeReview(
      {
        ...baseInput,
        stream: true,
        verbose: false,
        includePartialMessages: false,
        includeHookEvents: false
      },
      {
        executeStreaming: async (_command, args, _options, onStdoutLine) => {
          observedArgs = args;
          onStdoutLine(JSON.stringify({ type: "result", result: "No findings." }));
          return { stdout: "", stderr: "", exitCode: 0 };
        },
        buildPacket: async () => "PACKET",
        now: fakeClock([1, 2])
      }
    );

    expect(observedArgs).not.toContain("--verbose");
    expect(observedArgs).not.toContain("--include-partial-messages");
    expect(observedArgs).not.toContain("--include-hook-events");
  });

  it("routes Gemini reviews through the direct Gemini backend", async () => {
    let claudeStarted = false;
    const result = await runClaudeReview(
      { ...baseInput, providerProfile: "gemini", model: "opus" },
      {
        execute: async () => {
          claudeStarted = true;
          throw new Error("Claude Code should not be started for Gemini review");
        },
        buildPacket: async () => "PACKET",
        runGeminiReview: async (input, packet) => ({
          ok: true,
          task: input.task,
          model: "gemini-3.5-flash",
          elapsedMs: 5,
          review: `Gemini saw ${packet}.`,
          command: ["gemini", "generateContent", "--model", "gemini-3.5-flash"]
        })
      }
    );

    expect(claudeStarted).toBe(false);
    expect(result).toMatchObject({
      ok: true,
      model: "gemini-3.5-flash",
      review: "Gemini saw PACKET.",
      command: ["gemini", "generateContent", "--model", "gemini-3.5-flash"]
    });
  });

  it("omits default allowed tools for every provider unless tools are explicit", async () => {
    const observedArgs: string[][] = [];
    const execute: ClaudeExecutor = async (_command, args) => {
      observedArgs.push(args);
      return {
        stdout: JSON.stringify({ result: "No findings." }),
        stderr: "",
        exitCode: 0
      };
    };

    for (const [index, providerProfile, sourceEnv] of [
      [0, "anthropic", {}],
      [1, "deepseek", { DEEPSEEK_API_KEY: "deepseek-token" }],
      [2, "ark_coding_plan", { ARK_API_KEY: "ark-token" }],
      [3, "ark_agent_plan", { OPENAI_API_KEY_DOUBAO: "doubao-token" }]
    ] as const) {
      await runClaudeReview(
        CcReviewInputSchema.parse({
          task: "review_doc",
          context: "Review this document.",
          providerProfile,
          stream: false
        }),
        {
          execute,
          buildPacket: async () => "PACKET",
          sourceEnv,
          now: fakeClock([index * 2 + 1, index * 2 + 2])
        }
      );
    }

    await runClaudeReview(
      CcReviewInputSchema.parse({
        task: "review_doc",
        context: "Review this document.",
        providerProfile: "ark_coding_plan",
        tools: "default",
        stream: false
      }),
      {
        execute,
        buildPacket: async () => "PACKET",
        sourceEnv: { ARK_API_KEY: "ark-token" },
        now: fakeClock([9, 10])
      }
    );

    expect(observedArgs[0]).not.toContain("--allowedTools");
    expect(observedArgs[1]).not.toContain("--allowedTools");
    expect(observedArgs[2]).not.toContain("--allowedTools");
    expect(observedArgs[3]).not.toContain("--allowedTools");
    expect(observedArgs[4]?.slice(observedArgs[4].indexOf("--allowedTools"), observedArgs[4].indexOf("--output-format"))).toEqual([
      "--allowedTools",
      "default"
    ]);
  });

  it("returns cancellation before building the packet when already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    let builtPacket = false;

    const result = await runClaudeReview(baseInput, {
      signal: controller.signal,
      buildPacket: async () => {
        builtPacket = true;
        return "PACKET";
      },
      now: fakeClock([10, 20])
    });

    expect(builtPacket).toBe(false);
    expect(result.ok).toBe(false);
    expect(result.review).toContain("cancelled");
  });

  it("adds diagnostics for non-streaming runs and DeepSeek cost caveats", async () => {
    const result = await runClaudeReview(
      {
        ...baseInput,
        providerProfile: "deepseek",
        stream: false
      },
      {
        execute: async () => ({
          stdout: JSON.stringify({ result: "No findings." }),
          stderr: "",
          exitCode: 0
        }),
        buildPacket: async () => "PACKET",
        sourceEnv: { DEEPSEEK_API_KEY: "deepseek-token" },
        now: fakeClock([1, 2])
      }
    );

    expect(result.diagnostics?.join("\n")).toContain("stream=false");
    expect(result.diagnostics?.join("\n")).toContain(
      "DeepSeek route target: api.deepseek.com; token source: DEEPSEEK_API_KEY."
    );
    expect(result.diagnostics?.join("\n")).toContain("cost fields are Claude Code-reported estimates");
    expect(result.diagnostics?.join("\n")).not.toContain("experimental");
  });
});

function fakeClock(values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? values.at(-1) ?? 0;
}

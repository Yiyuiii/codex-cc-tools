import { describe, expect, it } from "vitest";

import { RESEARCH_STDIN_PROMPT, runClaudeResearch } from "../src/tasks/research/tool.js";
import type { ClaudeExecutor } from "../src/core/claude-runner.js";
import type { CcResearchInput } from "../src/tasks/research/schema.js";

const baseInput: CcResearchInput = {
  question: "Where is provider routing implemented?",
  model: "opus",
  effort: "max",
  includeGitStatus: false,
  maxContextChars: 120_000,
  stream: false,
  cacheTtl: "1h",
  providerProfile: "anthropic"
};

describe("runClaudeResearch", () => {
  it("builds a research packet and maps structured runner output", async () => {
    let observed: Parameters<ClaudeExecutor> | undefined;
    const execute: ClaudeExecutor = async (...args) => {
      observed = args;
      return {
        stdout: JSON.stringify({
          result: "Provider routing lives in src/providers.",
          structured_output: {
            status: "answered",
            answer: "Provider routing lives in src/providers.",
            evidence: [{ file: "src/providers/registry.ts", detail: "Defines provider names." }],
            filesRead: ["src/providers/registry.ts"],
            commandsRun: [],
            missingContext: []
          }
        }),
        stderr: "",
        exitCode: 0
      };
    };

    const result = await runClaudeResearch(baseInput, {
      execute,
      buildPacket: async () => "PACKET",
      now: fakeClock([1, 11])
    });

    expect(result).toMatchObject({
      ok: true,
      status: "answered",
      model: "opus",
      elapsedMs: 10,
      answer: "Provider routing lives in src/providers."
    });
    expect(result.evidence[0]?.file).toBe("src/providers/registry.ts");
    expect(observed?.[1]).toContain(RESEARCH_STDIN_PROMPT);
    expect(observed?.[2].input).toBe("PACKET");
  });

  it("uses safe defaults for read-only investigation tools", async () => {
    let observedArgs: string[] | undefined;

    await runClaudeResearch(baseInput, {
      execute: async (_command, args) => {
        observedArgs = args;
        return {
          stdout: JSON.stringify({ result: "No context.", structured_output: { status: "partial", answer: "No context.", evidence: [], filesRead: [], commandsRun: [], missingContext: ["No files included."] } }),
          stderr: "",
          exitCode: 0
        };
      },
      buildPacket: async () => "PACKET",
      now: fakeClock([1, 2])
    });

    const toolsStart = observedArgs?.indexOf("--allowedTools") ?? -1;
    const toolsEnd = observedArgs?.indexOf("--output-format") ?? -1;
    expect(observedArgs?.slice(toolsStart + 1, toolsEnd)).toEqual(["Read", "Grep", "Glob", "LS"]);
    expect(observedArgs).toContain("default");
  });

  it("returns provider configuration errors as blocked research", async () => {
    const result = await runClaudeResearch(
      { ...baseInput, providerProfile: "deepseek" },
      {
        buildPacket: async () => "PACKET",
        sourceEnv: {},
        now: fakeClock([1, 2])
      }
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe("blocked");
    expect(result.answer).toContain("DEEPSEEK_API_KEY");
  });

  it("blocks malformed structured research output", async () => {
    const result = await runClaudeResearch(baseInput, {
      execute: async () => ({
        stdout: JSON.stringify({
          result: "Plain answer without structured fields.",
          structured_output: { answer: "Missing status." }
        }),
        stderr: "",
        exitCode: 0
      }),
      buildPacket: async () => "PACKET",
      now: fakeClock([1, 2])
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("blocked");
    expect(result.answer).toBe("Plain answer without structured fields.");
    expect(result.diagnostics?.join("\n")).toContain("structured research output");
  });
});

function fakeClock(values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? values.at(-1) ?? 0;
}

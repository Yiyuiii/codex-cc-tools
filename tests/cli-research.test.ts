import { describe, expect, it } from "vitest";

import { runLocalResearch } from "../src/cli/research.js";
import type { CcResearchOutput } from "../src/tasks/research/schema.js";

describe("runLocalResearch", () => {
  it("normalizes CLI options and writes formatted output", async () => {
    const writes: string[] = [];
    let observed: unknown;

    const result = await runLocalResearch(
      {
        question: "Where is provider routing?",
        includeFiles: "src/index.ts",
        includeGitStatus: true,
        maxContextChars: "120000",
        providerProfile: "deepseek"
      },
      {
        runResearch: async (input) => {
          observed = input;
          return researchOutput();
        },
        write: (text) => writes.push(text)
      }
    );

    expect(result.ok).toBe(true);
    expect(observed).toMatchObject({
      question: "Where is provider routing?",
      includeFiles: ["src/index.ts"],
      includeGitStatus: true,
      maxContextChars: 120_000,
      providerProfile: "deepseek"
    });
    expect(writes.join("")).toContain("Provider routing lives in src/providers.");
  });
});

function researchOutput(): CcResearchOutput {
  return {
    ok: true,
    status: "answered",
    model: "opus",
    elapsedMs: 1,
    answer: "Provider routing lives in src/providers.",
    evidence: [],
    filesRead: [],
    commandsRun: [],
    missingContext: [],
    command: ["claude"]
  };
}

import { describe, expect, it } from "vitest";

import { CcResearchInputSchema, CcResearchOutputSchema } from "../src/tasks/research/schema.js";

describe("CcResearchInputSchema", () => {
  it("applies read-only defaults for a minimal research request", () => {
    const parsed = CcResearchInputSchema.parse({
      question: "Where is provider routing implemented?"
    });

    expect(parsed.context).toBeUndefined();
    expect(parsed.includeGitStatus).toBe(false);
    expect(parsed.includeFiles).toBeUndefined();
    expect(parsed.providerProfile).toBe("anthropic");
    expect(parsed.model).toBe("opus");
    expect(parsed.effort).toBe("max");
    expect(parsed.maxContextChars).toBe(120_000);
    expect(parsed.stream).toBe(true);
    expect(parsed.cacheTtl).toBe("1h");
  });

  it("normalizes includeFiles and rejects unknown keys", () => {
    const parsed = CcResearchInputSchema.parse({
      question: "Summarize this module.",
      includeFiles: "src/index.ts",
      providerProfile: "deepseek"
    });

    expect(parsed.includeFiles).toEqual(["src/index.ts"]);
    expect(parsed.providerProfile).toBe("deepseek");

    expect(() =>
      CcResearchInputSchema.parse({
        question: "What changed?",
        includeGitDiff: true
      })
    ).toThrow(/unrecognized/i);
  });
});

describe("CcResearchOutputSchema", () => {
  it("accepts structured research evidence and missing context", () => {
    const parsed = CcResearchOutputSchema.parse({
      ok: true,
      status: "answered",
      model: "opus",
      elapsedMs: 10,
      answer: "Provider routing lives in src/providers.",
      evidence: [
        {
          file: "src/providers/registry.ts",
          detail: "Defines provider names."
        }
      ],
      filesRead: ["src/providers/registry.ts"],
      commandsRun: [],
      missingContext: ["No release docs were included."],
      command: ["claude"]
    });

    expect(parsed.evidence[0]?.file).toBe("src/providers/registry.ts");
    expect(parsed.missingContext).toEqual(["No release docs were included."]);
  });
});

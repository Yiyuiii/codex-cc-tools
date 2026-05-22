import { describe, expect, it } from "vitest";

import { CcReviewInputSchema, CcReviewOutputSchema } from "../src/tasks/review/schema.js";

describe("CcReviewInputSchema", () => {
  it("applies defaults for a minimal review request", () => {
    const parsed = CcReviewInputSchema.parse({
      task: "review_plan",
      context: "Review this implementation plan."
    });

    expect(parsed.model).toBe("opus");
    expect(parsed.effort).toBe("max");
    expect(parsed.output).toBe("markdown");
    expect(parsed.permissionMode).toBe("bypassPermissions");
    expect(parsed.tools).toEqual(["default"]);
    expect(parsed.includeGitDiff).toBe(false);
    expect(parsed.includeGitStatus).toBe(false);
    expect(parsed.autoDiscoverGit).toBeUndefined();
    expect(parsed.includeUntrackedContent).toBeUndefined();
    expect(parsed.redactSecrets).toBe(true);
    expect(parsed.maxContextChars).toBe(120_000);
    expect(parsed.stream).toBe(true);
    expect(parsed.includePartialMessages).toBe(true);
    expect(parsed.includeHookEvents).toBe(true);
    expect(parsed.verbose).toBe(true);
    expect(parsed.cacheTtl).toBe("1h");
    expect(parsed.providerProfile).toBe("anthropic");
  });

  it("accepts DeepSeek provider profile and rejects unknown keys", () => {
    expect(
      CcReviewInputSchema.parse({
        task: "review_doc",
        context: "Review this document.",
        providerProfile: "deepseek"
      }).providerProfile
    ).toBe("deepseek");

    expect(() =>
      CcReviewInputSchema.parse({
        task: "review_plan",
        context: "Review this plan.",
        maxTurns: 4
      })
    ).toThrow(/unrecognized/i);
  });

  it("normalizes tools and structured list fields", () => {
    const parsed = CcReviewInputSchema.parse({
      task: "review_diff",
      context: "Review the current patch.",
      tools: "Read, Bash(git diff *)",
      acceptanceCriteria: "Published package uses the new README.",
      knownRisks: ["GitHub Actions may lag."],
      testsRun: []
    });

    expect(parsed.tools).toEqual(["Read", "Bash(git diff *)"]);
    expect(parsed.acceptanceCriteria).toEqual(["Published package uses the new README."]);
    expect(parsed.knownRisks).toEqual(["GitHub Actions may lag."]);
    expect(parsed.testsRun).toBeUndefined();

    expect(
      CcReviewInputSchema.parse({
        task: "review_doc",
        context: "Review this document.",
        tools: ""
      }).tools
    ).toEqual(["default"]);
  });
});

describe("CcReviewOutputSchema", () => {
  it("accepts optional expanded cache and activity fields", () => {
    const parsed = CcReviewOutputSchema.parse({
      ok: true,
      task: "review_diff",
      model: "opus",
      elapsedMs: 10,
      review: "No findings.",
      command: ["claude"],
      eventCount: 1,
      activityTail: [
        {
          index: 1,
          kind: "tool_use",
          rawType: "assistant.tool_use",
          summary: "tool_use: Read",
          toolName: "Read"
        }
      ],
      cache: {
        inputTokens: 7,
        creationInputTokens: 11,
        readInputTokens: 13,
        cacheCreation: {
          ephemeral1hInputTokens: 17,
          ephemeral5mInputTokens: 19
        },
        effective: "hit"
      }
    });

    expect(parsed.cache?.effective).toBe("hit");
    expect(parsed.activityTail?.[0].kind).toBe("tool_use");
  });
});

import { describe, expect, it } from "vitest";

import { CcVerifyInputSchema, CcVerifyOutputSchema } from "../src/tasks/verify/schema.js";

describe("CcVerifyInputSchema", () => {
  it("applies command-exec defaults for a minimal verification request", () => {
    const parsed = CcVerifyInputSchema.parse({
      hypothesis: "The test suite passes.",
      commandsAllowed: ["npm test"]
    });

    expect(parsed.commandsAllowed).toEqual(["npm test"]);
    expect(parsed.providerProfile).toBe("anthropic");
    expect(parsed.model).toBe("opus");
    expect(parsed.effort).toBe("max");
    expect(parsed.timeoutMs).toBe(900_000);
    expect(parsed.stream).toBe(true);
    expect(parsed.cacheTtl).toBe("1h");
  });

  it("normalizes a single command string and rejects empty command allowlists", () => {
    expect(
      CcVerifyInputSchema.parse({
        hypothesis: "Build succeeds.",
        commandsAllowed: "npm run build"
      }).commandsAllowed
    ).toEqual(["npm run build"]);

    expect(() =>
      CcVerifyInputSchema.parse({
        hypothesis: "Build succeeds.",
        commandsAllowed: []
      })
    ).toThrow();
  });

  it("rejects command strings that cannot be safely wrapped as Bash allowlist entries", () => {
    for (const command of [
      "npm test && rm -rf dist",
      "npm test; whoami",
      "npm test)",
      "npm test(",
      "npm `test`",
      "*"
    ]) {
      expect(() =>
        CcVerifyInputSchema.parse({
          hypothesis: "Run a command.",
          commandsAllowed: [command]
        })
      ).toThrow(/simple command/i);
    }
  });
});

describe("CcVerifyOutputSchema", () => {
  it("accepts command evidence and follow-up state", () => {
    const parsed = CcVerifyOutputSchema.parse({
      ok: true,
      status: "verified",
      model: "opus",
      elapsedMs: 10,
      summary: "Tests pass.",
      commandsRun: [{ command: "npm test", exitCode: 0, summary: "78 tests passed." }],
      evidence: ["Vitest reported 78 passed tests."],
      reproduction: "Ran npm test.",
      needsFollowup: false,
      diagnostics: [],
      command: ["claude"]
    });

    expect(parsed.commandsRun[0]?.command).toBe("npm test");
    expect(parsed.needsFollowup).toBe(false);
  });
});

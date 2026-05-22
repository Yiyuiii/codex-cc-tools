import { describe, expect, it } from "vitest";

import {
  CcDelegateInputSchema,
  CcDelegateOutputSchema
} from "../src/tasks/delegate/schema.js";

describe("CcDelegateInputSchema", () => {
  it("parses a minimal prompt-only delegate request", () => {
    const parsed = CcDelegateInputSchema.parse({
      prompt: "Implement the focused change."
    });

    expect(parsed.providerProfile).toBe("anthropic");
    expect(parsed.model).toBe("opus");
    expect(parsed.effort).toBe("max");
    expect(parsed.cwd).toBeUndefined();
  });

  it("accepts cwd only as an optional process working directory", () => {
    const parsed = CcDelegateInputSchema.parse({
      prompt: "Run the requested commands.",
      cwd: "D:\\Codes\\repo"
    });

    expect(parsed.cwd).toBe("D:\\Codes\\repo");
  });

  it("rejects removed execution-space fields", () => {
    expect(() =>
      CcDelegateInputSchema.parse({
        prompt: "Implement the change.",
        isolation: { kind: "git-worktree", branch: "codex/feature" }
      })
    ).toThrow();

    expect(() =>
      CcDelegateInputSchema.parse({
        prompt: "Implement the change.",
        acceptanceCriteria: ["Tests pass."]
      })
    ).toThrow();

    expect(() =>
      CcDelegateInputSchema.parse({
        prompt: "Implement the change.",
        commandsAllowed: "npm test,npm run build"
      })
    ).toThrow();
  });
});

describe("CcDelegateOutputSchema", () => {
  it("accepts structured delegate results", () => {
    const parsed = CcDelegateOutputSchema.parse({
      ok: true,
      status: "succeeded",
      model: "opus",
      elapsedMs: 10,
      summary: "Implemented the change.",
      filesChanged: ["src/index.ts"],
      commandsRun: [{ command: "npm test", exitCode: 0, summary: "94 tests passed." }],
      verification: ["npm test passed."],
      risks: [],
      diagnostics: [],
      command: ["claude"]
    });

    expect(parsed.status).toBe("succeeded");
    expect(parsed.filesChanged).toEqual(["src/index.ts"]);
  });
});

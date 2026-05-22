import { describe, expect, it } from "vitest";

import { runLocalVerify } from "../src/cli/verify.js";
import type { CcVerifyOutput } from "../src/tasks/verify/schema.js";

describe("runLocalVerify", () => {
  it("normalizes CLI options and writes formatted output", async () => {
    const writes: string[] = [];
    let observed: unknown;

    const result = await runLocalVerify(
      {
        hypothesis: "Build succeeds.",
        commandsAllowed: ["npm run build"],
        context: "Focus on current changes.",
        timeoutMs: "120000",
        providerProfile: "deepseek"
      },
      {
        runVerify: async (input) => {
          observed = input;
          return verifyOutput();
        },
        write: (text) => writes.push(text)
      }
    );

    expect(result.ok).toBe(true);
    expect(observed).toMatchObject({
      hypothesis: "Build succeeds.",
      commandsAllowed: ["npm run build"],
      context: "Focus on current changes.",
      timeoutMs: 120_000,
      providerProfile: "deepseek"
    });
    expect(writes.join("")).toContain("Build passes.");
  });
});

function verifyOutput(): CcVerifyOutput {
  return {
    ok: true,
    status: "verified",
    model: "opus",
    elapsedMs: 1,
    summary: "Build passes.",
    commandsRun: [],
    evidence: [],
    reproduction: "Ran npm run build.",
    needsFollowup: false,
    diagnostics: [],
    command: ["claude"]
  };
}

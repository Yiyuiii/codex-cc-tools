import { describe, expect, it, vi } from "vitest";

import { runLocalDelegate } from "../src/cli/delegate.js";
import type { CcDelegateInput, CcDelegateOutput } from "../src/tasks/delegate/schema.js";

describe("runLocalDelegate", () => {
  it("normalizes CLI options and writes formatted output", async () => {
    const write = vi.fn();
    let observed: CcDelegateInput | undefined;

    const result = await runLocalDelegate(
      {
        prompt: "Edit the file.",
        cwd: "D:\\Codes\\repo-worktree",
        timeoutMs: "120000",
        maxContextChars: "5000",
        stream: false
      },
      {
        runDelegate: async (input) => {
          observed = input;
          return delegateOutput();
        },
        write
      }
    );

    expect(result.ok).toBe(true);
    expect(observed).toMatchObject({
      prompt: "Edit the file.",
      cwd: "D:\\Codes\\repo-worktree",
      timeoutMs: 120000,
      maxContextChars: 5000,
      providerProfile: "deepseek",
      stream: false
    });
    expect(write.mock.calls[0]?.[0]).toContain("Status: succeeded");
  });
});

function delegateOutput(): CcDelegateOutput {
  return {
    ok: true,
    status: "succeeded",
    model: "opus",
    elapsedMs: 1,
    summary: "Done.",
    filesChanged: ["src/index.ts"],
    commandsRun: [],
    verification: [],
    risks: [],
    diagnostics: [],
    command: ["claude"]
  };
}

import { describe, expect, it } from "vitest";

import {
  CcDelegateInputSchema,
  CcDelegateOutputSchema
} from "../src/tasks/delegate/schema.js";

describe("CcDelegateInputSchema", () => {
  it("parses a minimal git-worktree delegate request", () => {
    const parsed = CcDelegateInputSchema.parse({
      task: "Implement the focused change.",
      cwd: "D:\\Codes\\repo-worktree",
      isolation: {
        kind: "git-worktree",
        branch: "codex/feature"
      },
      acceptanceCriteria: ["Tests pass."]
    });

    expect(parsed.providerProfile).toBe("anthropic");
    expect(parsed.model).toBe("opus");
    expect(parsed.effort).toBe("max");
    expect(parsed.commandsAllowed).toBeUndefined();
    expect(parsed.acceptanceCriteria).toEqual(["Tests pass."]);
  });

  it("rejects missing cwd and empty acceptance criteria", () => {
    expect(() =>
      CcDelegateInputSchema.parse({
        task: "Implement the change.",
        isolation: { kind: "git-worktree", branch: "codex/feature" },
        acceptanceCriteria: ["Tests pass."]
      })
    ).toThrow();

    expect(() =>
      CcDelegateInputSchema.parse({
        task: "Implement the change.",
        cwd: "D:\\Codes\\repo-worktree",
        isolation: { kind: "git-worktree", branch: "codex/feature" },
        acceptanceCriteria: []
      })
    ).toThrow();
  });

  it("requires explicit acknowledgements for weaker isolation modes", () => {
    expect(() =>
      CcDelegateInputSchema.parse({
        task: "Implement the change.",
        cwd: "D:\\Codes\\repo-worktree",
        isolation: { kind: "git-branch", branch: "codex/feature" },
        acceptanceCriteria: ["Tests pass."]
      })
    ).toThrow();

    expect(() =>
      CcDelegateInputSchema.parse({
        task: "Implement the change.",
        cwd: "/workspace/repo",
        isolation: {
          kind: "container",
          containerId: "abc123",
          workspaceMount: "/workspace/repo",
          writableRoot: "/workspace/repo"
        },
        acceptanceCriteria: ["Tests pass."]
      })
    ).toThrow();
  });

  it("normalizes optional string lists and treats empty command lists as no Bash", () => {
    const parsed = CcDelegateInputSchema.parse({
      task: "Implement the change.",
      cwd: "D:\\Codes\\repo-worktree",
      isolation: { kind: "git-worktree", branch: "codex/feature" },
      acceptanceCriteria: ["Tests pass."],
      allowedPaths: "src, tests",
      forbiddenPaths: ["src/secrets"],
      commandsAllowed: []
    });

    expect(parsed.allowedPaths).toEqual(["src", "tests"]);
    expect(parsed.forbiddenPaths).toEqual(["src/secrets"]);
    expect(parsed.commandsAllowed).toBeUndefined();
  });

  it("rejects comma-separated command allowlists", () => {
    expect(() =>
      CcDelegateInputSchema.parse({
        task: "Implement the change.",
        cwd: "D:\\Codes\\repo-worktree",
        isolation: { kind: "git-worktree", branch: "codex/feature" },
        acceptanceCriteria: ["Tests pass."],
        commandsAllowed: "npm test,npm run build"
      })
    ).toThrow(/separate command arguments/i);
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

import { execa } from "execa";
import { describe, expect, it } from "vitest";

import { createProgram } from "../src/index.js";
import type { CcReviewOutput } from "../src/tasks/review/schema.js";
import type { CcDelegateOutput } from "../src/tasks/delegate/schema.js";
import { VERSION } from "../src/version.js";

describe("codex-cc-tools CLI", () => {
  it("prints the package version", async () => {
    const result = await execa("npx", ["tsx", "src/index.ts", "--version"], {
      cwd: process.cwd()
    });

    expect(result.stdout).toBe(VERSION);
  });

  it("lists task and provider families", async () => {
    const result = await execa("npx", ["tsx", "src/index.ts", "doctor"], {
      cwd: process.cwd()
    });

    expect(result.stdout).toContain("tasks: review, delegate");
    expect(result.stdout).toContain("providers: anthropic, deepseek");
  });

  it("exposes review, delegate, and mcp commands in help output", async () => {
    const result = await execa("npx", ["tsx", "src/index.ts", "--help"], {
      cwd: process.cwd()
    });

    expect(result.stdout).toContain("review");
    expect(result.stdout).toContain("delegate");
    expect(result.stdout).toContain("mcp");
    expect(result.stdout).not.toMatch(/^\s+research\b/m);
    expect(result.stdout).not.toMatch(/^\s+verify\b/m);
  });

  it("parses review command boolean defaults without opting into git or untracked flags", async () => {
    let observedOptions: Record<string, unknown> | undefined;
    const program = createProgram({
      runLocalReview: async (options) => {
        observedOptions = options as Record<string, unknown>;
        return reviewOutput();
      }
    });

    await program.parseAsync(
      ["node", "codex-cc-tools", "review", "--task", "review_diff", "--context", "Review."],
      { from: "node" }
    );

    expect(observedOptions).not.toHaveProperty("autoDiscoverGit");
    expect(observedOptions).not.toHaveProperty("includeUntrackedContent");
  });

  it("parses review command negated boolean flags explicitly", async () => {
    let observedOptions: Record<string, unknown> | undefined;
    const program = createProgram({
      runLocalReview: async (options) => {
        observedOptions = options as Record<string, unknown>;
        return reviewOutput();
      }
    });

    await program.parseAsync(
      [
        "node",
        "codex-cc-tools",
        "review",
        "--task",
        "review_diff",
        "--context",
        "Review.",
        "--no-auto-discover-git",
        "--no-include-untracked-content",
        "--no-redact-secrets"
      ],
      { from: "node" }
    );

    expect(observedOptions?.autoDiscoverGit).toBe(false);
    expect(observedOptions?.includeUntrackedContent).toBe(false);
    expect(observedOptions?.redactSecrets).toBe(false);
  });

  it("parses delegate command options", async () => {
    let observedOptions: Record<string, unknown> | undefined;
    const program = createProgram({
      runLocalDelegate: async (options) => {
        observedOptions = options as unknown as Record<string, unknown>;
        return delegateOutput();
      }
    });

    await program.parseAsync(
      [
        "node",
        "codex-cc-tools",
        "delegate",
        "--prompt",
        "Edit the file.",
        "--cwd",
        "D:\\Codes\\repo-worktree",
        "--no-stream"
      ],
      { from: "node" }
    );

    expect(observedOptions).toMatchObject({
      prompt: "Edit the file.",
      cwd: "D:\\Codes\\repo-worktree",
      stream: false
    });
  });
});

function reviewOutput(): CcReviewOutput {
  return {
    ok: true,
    task: "review_diff",
    model: "opus",
    elapsedMs: 1,
    review: "No findings.",
    command: ["claude"]
  };
}

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

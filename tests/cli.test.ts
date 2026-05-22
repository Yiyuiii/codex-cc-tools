import { execa } from "execa";
import { describe, expect, it } from "vitest";

import { createProgram } from "../src/index.js";
import type { CcReviewOutput } from "../src/tasks/review/schema.js";
import type { CcResearchOutput } from "../src/tasks/research/schema.js";
import type { CcVerifyOutput } from "../src/tasks/verify/schema.js";
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

    expect(result.stdout).toContain("tasks: review, delegate, verify, research");
    expect(result.stdout).toContain("providers: anthropic, deepseek");
  });

  it("exposes review, research, verify, delegate, and mcp commands in help output", async () => {
    const result = await execa("npx", ["tsx", "src/index.ts", "--help"], {
      cwd: process.cwd()
    });

    expect(result.stdout).toContain("review");
    expect(result.stdout).toContain("research");
    expect(result.stdout).toContain("verify");
    expect(result.stdout).toContain("delegate");
    expect(result.stdout).toContain("mcp");
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

  it("parses research command options", async () => {
    let observedOptions: Record<string, unknown> | undefined;
    const program = createProgram({
      runLocalResearch: async (options) => {
        observedOptions = options as unknown as Record<string, unknown>;
        return researchOutput();
      }
    });

    await program.parseAsync(
      [
        "node",
        "codex-cc-tools",
        "research",
        "--question",
        "Where is provider routing?",
        "--include-files",
        "src/index.ts,src/providers/registry.ts",
        "--include-git-status",
        "--cwd",
        "D:\\Codes\\codex-cc-tools",
        "--context",
        "Focus on providers.",
        "--provider-profile",
        "deepseek",
        "--no-stream",
        "--cache-ttl",
        "5m",
        "--effort",
        "high",
        "--model",
        "haiku",
        "--max-context-chars",
        "5000"
      ],
      { from: "node" }
    );

    expect(observedOptions).toMatchObject({
      question: "Where is provider routing?",
      includeFiles: "src/index.ts,src/providers/registry.ts",
      includeGitStatus: true,
      cwd: "D:\\Codes\\codex-cc-tools",
      context: "Focus on providers.",
      providerProfile: "deepseek",
      stream: false,
      cacheTtl: "5m",
      effort: "high",
      model: "haiku",
      maxContextChars: "5000"
    });
  });

  it("parses verify command options", async () => {
    let observedOptions: Record<string, unknown> | undefined;
    const program = createProgram({
      runLocalVerify: async (options) => {
        observedOptions = options as unknown as Record<string, unknown>;
        return verifyOutput();
      }
    });

    await program.parseAsync(
      [
        "node",
        "codex-cc-tools",
        "verify",
        "--hypothesis",
        "Build succeeds.",
        "--commands-allowed",
        "npm run build",
        "--context",
        "Focus on current changes.",
        "--timeout-ms",
        "120000",
        "--no-stream"
      ],
      { from: "node" }
    );

    expect(observedOptions).toMatchObject({
      hypothesis: "Build succeeds.",
      commandsAllowed: ["npm run build"],
      context: "Focus on current changes.",
      timeoutMs: "120000",
      stream: false
    });
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
        "--task",
        "Edit the file.",
        "--cwd",
        "D:\\Codes\\repo-worktree",
        "--isolation-kind",
        "git-worktree",
        "--isolation-evidence",
        "{\"branch\":\"codex/feature\"}",
        "--acceptance-criteria",
        "Tests pass.",
        "--allowed-paths",
        "src,tests",
        "--forbidden-paths",
        "src/secrets",
        "--commands-allowed",
        "npm test",
        "--no-stream"
      ],
      { from: "node" }
    );

    expect(observedOptions).toMatchObject({
      task: "Edit the file.",
      cwd: "D:\\Codes\\repo-worktree",
      isolationKind: "git-worktree",
      isolationEvidence: "{\"branch\":\"codex/feature\"}",
      acceptanceCriteria: ["Tests pass."],
      allowedPaths: "src,tests",
      forbiddenPaths: "src/secrets",
      commandsAllowed: ["npm test"],
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

function researchOutput(): CcResearchOutput {
  return {
    ok: true,
    status: "answered",
    model: "opus",
    elapsedMs: 1,
    answer: "No findings.",
    evidence: [],
    filesRead: [],
    commandsRun: [],
    missingContext: [],
    command: ["claude"]
  };
}

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

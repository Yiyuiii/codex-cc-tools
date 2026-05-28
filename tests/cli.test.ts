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

    expect(result.stdout).toContain("codex-cc-tools doctor");
    expect(result.stdout).toContain("Tasks: review, delegate");
    expect(result.stdout).toContain("Providers: anthropic, deepseek, ark_coding_plan");
    expect(result.stdout).toContain("MCP tool names: cc_review, cc_delegate");
  });

  it("parses doctor config path and strict options", async () => {
    let observedOptions: Record<string, unknown> | undefined;
    const program = createProgram({
      runDoctor: async (options) => {
        observedOptions = options as Record<string, unknown>;
        return [];
      }
    });

    await program.parseAsync(
      [
        "node",
        "codex-cc-tools",
        "doctor",
        "--config-path",
        "D:\\Codes\\repo\\.codex\\config.toml",
        "--strict"
      ],
      { from: "node" }
    );

    expect(observedOptions).toMatchObject({
      configPath: "D:\\Codes\\repo\\.codex\\config.toml",
      strict: true
    });
  });

  it("exposes review, delegate, and mcp commands in help output", async () => {
    const result = await execa("npx", ["tsx", "src/index.ts", "--help"], {
      cwd: process.cwd()
    });

    expect(result.stdout).toContain("review");
    expect(result.stdout).toContain("delegate");
    expect(result.stdout).toContain("install");
    expect(result.stdout).toContain("uninstall");
    expect(result.stdout).toContain("mcp");
    expect(result.stdout).not.toMatch(/^\s+research\b/m);
    expect(result.stdout).not.toMatch(/^\s+verify\b/m);
  });

  it("documents distinct provider defaults for delegate and review commands", () => {
    const program = createProgram();
    const delegate = program.commands.find((command) => command.name() === "delegate");
    const review = program.commands.find((command) => command.name() === "review");

    expect(delegate?.options.find((option) => option.long === "--provider-profile")?.description).toBe(
      "Provider profile: deepseek by default; also supports anthropic or ark_coding_plan."
    );
    expect(review?.options.find((option) => option.long === "--provider-profile")?.description).toBe(
      "Provider profile: anthropic, deepseek, or ark_coding_plan."
    );
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

  it("parses install command options", async () => {
    let observedOptions: Record<string, unknown> | undefined;
    const program = createProgram({
      installCodexConfig: async (options) => {
        observedOptions = options as Record<string, unknown>;
      }
    });

    await program.parseAsync(
      [
        "node",
        "codex-cc-tools",
        "install",
        "--package-spec",
        "codex-cc-tools@next",
        "--config-path",
        "D:\\Codes\\repo\\.codex\\config.toml",
        "--no-enabled-tools"
      ],
      { from: "node" }
    );

    expect(observedOptions).toMatchObject({
      packageSpec: "codex-cc-tools@next",
      configPath: "D:\\Codes\\repo\\.codex\\config.toml",
      includeEnabledTools: false
    });
  });

  it("parses install global binary mode", async () => {
    let observedOptions: Record<string, unknown> | undefined;
    const program = createProgram({
      installCodexConfig: async (options) => {
        observedOptions = options as Record<string, unknown>;
      }
    });

    await program.parseAsync(["node", "codex-cc-tools", "install", "--global-binary"], {
      from: "node"
    });

    expect(observedOptions).toMatchObject({
      globalBinary: true
    });
  });

  it("parses uninstall command options", async () => {
    let observedOptions: Record<string, unknown> | undefined;
    const program = createProgram({
      uninstallCodexConfig: async (options) => {
        observedOptions = options as Record<string, unknown>;
      }
    });

    await program.parseAsync(
      [
        "node",
        "codex-cc-tools",
        "uninstall",
        "--config-path",
        "D:\\Codes\\repo\\.codex\\config.toml"
      ],
      { from: "node" }
    );

    expect(observedOptions).toMatchObject({
      configPath: "D:\\Codes\\repo\\.codex\\config.toml"
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

import { describe, expect, it } from "vitest";

import {
  evaluateDelegatePolicy,
  validateReportedDelegateCommands,
  validateDelegateChangedPaths
} from "../src/tasks/delegate/policy.js";
import { CcDelegateInputSchema, type CcDelegateInput } from "../src/tasks/delegate/schema.js";

const baseInput: CcDelegateInput = CcDelegateInputSchema.parse({
  task: "Edit the requested file.",
  cwd: "C:\\repo\\worktree",
  isolation: { kind: "git-worktree", branch: "codex/feature" },
  acceptanceCriteria: ["Tests pass."]
});

describe("evaluateDelegatePolicy", () => {
  it("blocks unsafe cwd before Claude Code starts", () => {
    const result = evaluateDelegatePolicy({ ...baseInput, cwd: "C:\\" }, { platform: "win32" });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.join("\n")).toContain("unsafe workspace");
  });

  it("uses writable authority without implicit Bash", () => {
    const result = evaluateDelegatePolicy(baseInput, {
      platform: "win32",
      git: { isLinkedWorktree: true, isBare: false }
    });

    expect(result.ok).toBe(true);
    expect(result.permissionMode).toBe("acceptEdits");
    expect(result.tools).toEqual(["Read", "Grep", "Glob", "LS", "Edit", "Write"]);
    expect(result.tools.join(" ")).not.toContain("Bash(");
  });

  it("rejects protected branches and unacknowledged worktree state", () => {
    const main = evaluateDelegatePolicy(
      { ...baseInput, isolation: { kind: "git-worktree", branch: "main" } },
      { platform: "win32" }
    );
    const primary = evaluateDelegatePolicy(baseInput, {
      platform: "win32",
      git: { isLinkedWorktree: false }
    });
    const unknown = evaluateDelegatePolicy(baseInput, { platform: "win32" });

    expect(main.ok).toBe(false);
    expect(main.diagnostics.join("\n")).toContain("protected branch");
    expect(primary.ok).toBe(false);
    expect(primary.diagnostics.join("\n")).toContain("linked worktree");
    expect(unknown.ok).toBe(false);
    expect(unknown.diagnostics.join("\n")).toContain("could not verify linked worktree");
  });

  it("rejects runtime branch mismatches and dirty workspaces", () => {
    const mismatch = evaluateDelegatePolicy(baseInput, {
      platform: "win32",
      git: {
        isLinkedWorktree: true,
        isBare: false,
        currentBranch: "main"
      }
    });
    const dirty = evaluateDelegatePolicy(baseInput, {
      platform: "win32",
      git: {
        isLinkedWorktree: true,
        isBare: false,
        currentBranch: "codex/feature",
        dirtyStatus: ["M src/index.ts"]
      }
    });

    expect(mismatch.ok).toBe(false);
    expect(mismatch.diagnostics.join("\n")).toContain("protected branch");
    expect(mismatch.diagnostics.join("\n")).toContain("branch mismatch");
    expect(dirty.ok).toBe(false);
    expect(dirty.diagnostics.join("\n")).toContain("workspace is dirty");
  });

  it("rejects forbidden command authority", () => {
    const install = evaluateDelegatePolicy(
      { ...baseInput, commandsAllowed: ["npm install"] },
      { platform: "win32", git: { isLinkedWorktree: true, isBare: false } }
    );
    const gitWithoutHookDisable = evaluateDelegatePolicy(
      { ...baseInput, commandsAllowed: ["git commit -m test"] },
      { platform: "win32", git: { isLinkedWorktree: true, isBare: false } }
    );
    const gitWithHookDisable = evaluateDelegatePolicy(
      { ...baseInput, commandsAllowed: ["git -c core.hooksPath=/dev/null status"] },
      { platform: "win32", git: { isLinkedWorktree: true, isBare: false } }
    );
    const pushWithHookDisable = evaluateDelegatePolicy(
      { ...baseInput, commandsAllowed: ["git -c core.hooksPath=/dev/null push origin main"] },
      { platform: "win32", git: { isLinkedWorktree: true, isBare: false } }
    );

    expect(install.ok).toBe(false);
    expect(install.diagnostics.join("\n")).toContain("package installation");
    expect(gitWithoutHookDisable.ok).toBe(false);
    expect(gitWithoutHookDisable.diagnostics.join("\n")).toContain("core.hooksPath");
    expect(gitWithHookDisable.ok).toBe(true);
    expect(gitWithHookDisable.tools).toContain("Bash(git -c core.hooksPath=/dev/null status)");
    expect(pushWithHookDisable.ok).toBe(false);
    expect(pushWithHookDisable.diagnostics.join("\n")).toContain("mutates remotes");
  });

  it("blocks pre-existing executable hooks", () => {
    const result = evaluateDelegatePolicy(baseInput, {
      platform: "win32",
      git: { isLinkedWorktree: true, isBare: false, executableHooks: ["pre-commit"] }
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.join("\n")).toContain(".git/hooks");
  });

  it("rejects glob path policy entries", () => {
    const result = evaluateDelegatePolicy(
      { ...baseInput, allowedPaths: ["src/*.ts"] },
      { platform: "win32", git: { isLinkedWorktree: true, isBare: false } }
    );

    expect(result.ok).toBe(false);
    expect(result.diagnostics.join("\n")).toContain("glob syntax");
  });

  it("rejects path policy entries that resolve outside the workspace", () => {
    const result = evaluateDelegatePolicy(
      { ...baseInput, forbiddenPaths: ["..\\outside"] },
      { platform: "win32", git: { isLinkedWorktree: true, isBare: false } }
    );

    expect(result.ok).toBe(false);
    expect(result.diagnostics.join("\n")).toContain("outside workspace");
  });

  it("rejects shell home and environment-variable path policy entries", () => {
    const result = evaluateDelegatePolicy(
      { ...baseInput, allowedPaths: ["~", "~root\\Desktop", "%USERPROFILE%\\Desktop"] },
      { platform: "win32", git: { isLinkedWorktree: true, isBare: false } }
    );

    expect(result.ok).toBe(false);
    expect(result.diagnostics.join("\n")).toContain("shell or environment variable syntax");
  });

  it("rejects path policy entries that cannot be resolved with realpath", () => {
    const result = evaluateDelegatePolicy(
      { ...baseInput, allowedPaths: ["broken-link"] },
      {
        platform: "win32",
        git: { isLinkedWorktree: true, isBare: false },
        realpath: (value) => {
          if (value.endsWith("broken-link")) throw new Error("ENOENT");
          return value;
        }
      }
    );

    expect(result.ok).toBe(false);
    expect(result.diagnostics.join("\n")).toContain("could not be resolved");
  });

  it("allows reported command arguments under an allowed command prefix", () => {
    const result = validateReportedDelegateCommands(["npm test -- --runInBand"], ["npm test"]);

    expect(result).toEqual([]);
  });

  it("reports a distinct diagnostic when commands are reported without commandsAllowed", () => {
    const result = validateReportedDelegateCommands(["npm test"], undefined);

    expect(result.join("\n")).toContain("commandsAllowed was not declared");
  });

  it("reports a distinct diagnostic when commands are reported with an empty commandsAllowed list", () => {
    const result = validateReportedDelegateCommands(["npm test"], []);

    expect(result.join("\n")).toContain("commandsAllowed is empty");
  });

  it("rejects reported command shell chaining even under an allowed prefix", () => {
    const result = validateReportedDelegateCommands(["npm test && echo pwned"], ["npm test"]);

    expect(result.join("\n")).toContain("shell control syntax");
  });
});

describe("validateDelegateChangedPaths", () => {
  it("blocks changed paths outside allowed path segment boundaries", () => {
    const result = validateDelegateChangedPaths({
      cwd: "C:\\repo\\worktree",
      allowedPaths: ["C:\\repo\\worktree\\src\\foo"],
      forbiddenPaths: [],
      changedPaths: ["src/foobar.ts"],
      platform: "win32",
      realpath: (value) => value.replaceAll("/", "\\").replace("src\\foobar.ts", "src\\foobar.ts")
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.join("\n")).toContain("outside allowed paths");
  });

  it("blocks post-run symlink or junction escapes after realpath", () => {
    const result = validateDelegateChangedPaths({
      cwd: "C:\\repo\\worktree",
      allowedPaths: [],
      forbiddenPaths: [],
      changedPaths: ["linked\\secret.txt"],
      platform: "win32",
      realpath: (value) =>
        value.endsWith("linked\\secret.txt") ? "C:\\Users\\Ada\\secret.txt" : value
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.join("\n")).toContain("outside workspace");
  });

  it("blocks changed paths inside git internals", () => {
    const result = validateDelegateChangedPaths({
      cwd: "C:\\repo\\worktree",
      allowedPaths: [],
      forbiddenPaths: [],
      changedPaths: [".git\\hooks\\post-commit"],
      platform: "win32"
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.join("\n")).toContain("Git internals");
  });

  it("blocks changed paths that use shell home or environment-variable syntax", () => {
    const result = validateDelegateChangedPaths({
      cwd: "C:\\repo\\worktree",
      changedPaths: ["~\\secret.txt", "%USERPROFILE%\\Desktop\\secret.txt"],
      platform: "win32"
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.join("\n")).toContain("shell or environment variable syntax");
  });

  it("allows dollar signs that are not shell variable path syntax", () => {
    const result = validateDelegateChangedPaths({
      cwd: "C:\\repo\\worktree",
      changedPaths: ["src\\$generated\\route.ts", "$generated\\route.ts", "report-100%draft%.txt"],
      platform: "win32"
    });

    expect(result.ok).toBe(true);
  });
});

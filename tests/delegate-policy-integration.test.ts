import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { execa } from "execa";
import { describe, expect, it } from "vitest";

import {
  collectDelegatePolicyDeps,
  evaluateDelegatePolicy
} from "../src/tasks/delegate/policy.js";
import { CcDelegateInputSchema } from "../src/tasks/delegate/schema.js";

describe("delegate policy integration", () => {
  it("accepts a clean linked Git worktree with matching runtime branch", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "codex-cc-tools-delegate-"));
    try {
      const repo = path.join(root, "repo");
      const worktree = path.join(root, "worktree");
      await git(root, "init", "repo");
      await git(repo, "config", "user.email", "codex@example.com");
      await git(repo, "config", "user.name", "Codex");
      await writeFile(path.join(repo, "README.md"), "fixture\n");
      await git(repo, "add", "README.md");
      await git(repo, "commit", "-m", "init");
      await git(repo, "worktree", "add", "-b", "codex/feature", worktree);

      const deps = await collectDelegatePolicyDeps(worktree);
      const result = evaluateDelegatePolicy(
        CcDelegateInputSchema.parse({
          task: "Edit README.",
          cwd: worktree,
          isolation: { kind: "git-worktree", branch: "codex/feature" },
          acceptanceCriteria: ["README updated."]
        }),
        deps
      );

      expect(result.ok).toBe(true);
      expect(deps.git?.isLinkedWorktree).toBe(true);
      expect(deps.git?.currentBranch).toBe("codex/feature");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

async function git(cwd: string, ...args: string[]): Promise<void> {
  const result = await execa("git", args, { cwd, reject: false });
  expect(result.exitCode, result.stderr || result.stdout).toBe(0);
}

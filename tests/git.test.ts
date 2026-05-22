import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { execa } from "execa";
import { describe, expect, it } from "vitest";

import { getGitDiff } from "../src/git/diff.js";
import { getUntrackedFileEvidence, readUntrackedPath } from "../src/git/untracked.js";

async function initRepo(): Promise<string> {
  const cwd = await mkdtemp(path.join(tmpdir(), "codex-cc-tools-git-"));
  await execa("git", ["init"], { cwd });
  await execa("git", ["config", "user.email", "test@example.com"], { cwd });
  await execa("git", ["config", "user.name", "Test User"], { cwd });
  await writeFile(path.join(cwd, "tracked.txt"), "old\n");
  await execa("git", ["add", "tracked.txt"], { cwd });
  await execa("git", ["commit", "-m", "initial"], { cwd });
  return cwd;
}

describe("git helpers", () => {
  it("getGitDiff includes staged changes against HEAD", async () => {
    const cwd = await initRepo();

    try {
      await writeFile(path.join(cwd, "tracked.txt"), "new\n");
      await execa("git", ["add", "tracked.txt"], { cwd });

      const diff = await getGitDiff(cwd);

      expect(diff).toContain("diff --git a/tracked.txt b/tracked.txt");
      expect(diff).toContain("+new");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("getUntrackedFileEvidence includes text candidates and omits low-signal files", async () => {
    const cwd = await initRepo();

    try {
      await writeFile(path.join(cwd, "notes.txt"), "review notes\n");
      await writeFile(path.join(cwd, "binary.dat"), Buffer.from([0x61, 0x00, 0x62]));
      await mkdir(path.join(cwd, "dist"));
      await writeFile(path.join(cwd, "dist", "app.js"), "console.log('built');\n");

      const evidence = await getUntrackedFileEvidence(cwd);

      expect(evidence).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: "notes.txt",
            inclusion: "candidate",
            reason: "untracked_text",
            content: "review notes\n"
          }),
          expect.objectContaining({
            path: "binary.dat",
            inclusion: "omitted",
            reason: "null_byte_binary"
          }),
          expect.objectContaining({
            path: "dist/app.js",
            inclusion: "omitted",
            reason: "generated_or_lockfile"
          })
        ])
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("always omits known secret-bearing untracked filenames", async () => {
    const cwd = await initRepo();

    try {
      await writeFile(path.join(cwd, ".env"), "DATABASE_URL=postgres://user:pwd@localhost/app\n");
      await writeFile(path.join(cwd, "id_rsa"), "PRIVATE KEY\n");
      await writeFile(path.join(cwd, ".npmrc"), "//registry.npmjs.org/:_authToken=secret\n");

      const evidence = await getUntrackedFileEvidence(cwd);

      expect(evidence).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ".env", inclusion: "omitted", reason: "secret_filename" }),
          expect.objectContaining({ path: "id_rsa", inclusion: "omitted", reason: "secret_filename" }),
          expect.objectContaining({ path: ".npmrc", inclusion: "omitted", reason: "secret_filename" })
        ])
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("readUntrackedPath omits oversized files, symlinks, and repo-escape paths", async () => {
    const cwd = await initRepo();

    try {
      await writeFile(path.join(cwd, "large.txt"), "x".repeat(128_001));
      await writeFile(path.join(cwd, "target.txt"), "target\n");
      await symlink(path.join(cwd, "target.txt"), path.join(cwd, "link.txt"));

      await expect(readUntrackedPath(cwd, "../outside.txt")).resolves.toMatchObject({
        inclusion: "omitted",
        reason: "outside_repository"
      });
      await expect(readUntrackedPath(cwd, "large.txt")).resolves.toMatchObject({
        inclusion: "omitted",
        reason: "file_too_large"
      });
      await expect(readUntrackedPath(cwd, "link.txt")).resolves.toMatchObject({
        inclusion: "omitted",
        reason: "symlink"
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("returns no untracked evidence outside a git repository", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "codex-cc-tools-no-git-"));

    try {
      await expect(getUntrackedFileEvidence(cwd)).resolves.toEqual([]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

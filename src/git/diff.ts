import { execa } from "execa";

export async function getGitDiff(cwd?: string): Promise<string> {
  const workingDirectory = cwd ?? process.cwd();
  const result = await execa("git", ["diff", "--no-ext-diff", "HEAD"], {
    cwd: workingDirectory,
    reject: false
  });

  if (result.exitCode === 0) {
    return result.stdout.trim();
  }

  const [cached, worktree] = await Promise.all([
    execa("git", ["diff", "--no-ext-diff", "--cached"], {
      cwd: workingDirectory,
      reject: false
    }),
    execa("git", ["diff", "--no-ext-diff"], {
      cwd: workingDirectory,
      reject: false
    })
  ]);

  return [cached, worktree]
    .filter((item) => item.exitCode === 0 && item.stdout.trim())
    .map((item) => item.stdout.trim())
    .join("\n");
}

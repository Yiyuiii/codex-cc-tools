import { execa } from "execa";

export async function getGitStatus(cwd?: string): Promise<string> {
  const result = await execa("git", ["status", "--porcelain=v2"], {
    cwd: cwd ?? process.cwd(),
    reject: false
  });
  return result.stdout;
}

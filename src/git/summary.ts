import { execa } from "execa";

export async function getGitSummary(cwd?: string): Promise<string> {
  const workingDirectory = cwd ?? process.cwd();
  const [status, diffStat] = await Promise.all([
    execa("git", ["status", "--short"], { cwd: workingDirectory, reject: false }),
    execa("git", ["diff", "--stat"], { cwd: workingDirectory, reject: false })
  ]);

  return [
    diffStat.stdout ? `Diff Stat\n${diffStat.stdout}` : "",
    status.stdout ? `Name Status\n${status.stdout}` : ""
  ]
    .filter(Boolean)
    .join("\n\n");
}

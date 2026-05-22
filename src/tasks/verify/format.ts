import type { CcVerifyOutput } from "./schema.js";

export function formatVerifyResult(result: CcVerifyOutput): string {
  const lines = [
    `Status: ${result.status}`,
    `Model: ${result.model}`,
    `Elapsed: ${result.elapsedMs}ms`,
    "",
    result.summary
  ];

  if (result.commandsRun.length) {
    lines.push("", "Commands run:");
    for (const command of result.commandsRun) {
      const exit = command.exitCode === undefined ? "exit unknown" : `exit ${command.exitCode}`;
      lines.push(`- ${command.command} (${exit}): ${command.summary}`);
    }
  }

  if (result.evidence.length) {
    lines.push("", "Evidence:", ...result.evidence.map((item) => `- ${item}`));
  }

  if (result.reproduction) {
    lines.push("", "Reproduction:", result.reproduction);
  }

  if (result.needsFollowup) {
    lines.push("", "Needs follow-up: yes");
  }

  if (result.diagnostics.length) {
    lines.push("", "Diagnostics:", ...result.diagnostics.map((item) => `- ${item}`));
  }

  return `${lines.join("\n")}\n`;
}

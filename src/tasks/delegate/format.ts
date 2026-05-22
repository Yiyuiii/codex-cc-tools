import type { CcDelegateOutput } from "./schema.js";

export function formatDelegateResult(result: CcDelegateOutput): string {
  const lines = [
    `Status: ${result.status}`,
    `Model: ${result.model}`,
    `Elapsed: ${result.elapsedMs}ms`,
    "",
    result.summary
  ];

  if (result.filesChanged.length) {
    lines.push("", "Files changed:", ...result.filesChanged.map((file) => `- ${file}`));
  }

  if (result.commandsRun.length) {
    lines.push("", "Commands run:");
    for (const command of result.commandsRun) {
      const exit = command.exitCode === undefined ? "exit unknown" : `exit ${command.exitCode}`;
      lines.push(`- ${command.command} (${exit}): ${command.summary}`);
    }
  }

  if (result.verification.length) {
    lines.push("", "Verification:", ...result.verification.map((item) => `- ${item}`));
  }

  if (result.risks.length) {
    lines.push("", "Risks:", ...result.risks.map((item) => `- ${item}`));
  }

  if (result.diagnostics.length) {
    lines.push("", "Diagnostics:", ...result.diagnostics.map((item) => `- ${item}`));
  }

  return `${lines.join("\n")}\n`;
}

import type { CcResearchOutput } from "./schema.js";

export function formatResearchResult(result: CcResearchOutput): string {
  const lines = [
    `Status: ${result.status}`,
    `Model: ${result.model}`,
    `Elapsed: ${result.elapsedMs}ms`,
    "",
    result.answer
  ];

  if (result.evidence.length) {
    lines.push("", "Evidence:");
    for (const item of result.evidence) {
      const location = item.file ?? item.command ?? "context";
      lines.push(`- ${location}: ${item.detail}`);
    }
  }

  if (result.filesRead.length) {
    lines.push("", "Files read:", ...result.filesRead.map((file) => `- ${file}`));
  }

  if (result.commandsRun.length) {
    lines.push("", "Commands run:", ...result.commandsRun.map((command) => `- ${command}`));
  }

  if (result.missingContext.length) {
    lines.push("", "Missing context:", ...result.missingContext.map((item) => `- ${item}`));
  }

  if (result.diagnostics?.length) {
    lines.push("", "Diagnostics:", ...result.diagnostics.map((item) => `- ${item}`));
  }

  return `${lines.join("\n")}\n`;
}

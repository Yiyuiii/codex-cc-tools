import { formatResearchResult } from "../tasks/research/format.js";
import {
  CcResearchInputSchema,
  type CcResearchInput,
  type CcResearchOutput
} from "../tasks/research/schema.js";
import { runClaudeResearch } from "../tasks/research/tool.js";

export interface LocalResearchOptions {
  question: string;
  cwd?: string;
  context?: string;
  includeGitStatus?: boolean;
  includeFiles?: string | string[];
  providerProfile?: string;
  model?: string;
  effort?: string;
  maxContextChars?: number | string;
  stream?: boolean;
  cacheTtl?: string;
}

export interface LocalResearchDeps {
  runResearch?: (input: CcResearchInput) => Promise<CcResearchOutput>;
  write?: (text: string) => void;
}

export async function runLocalResearch(
  options: LocalResearchOptions,
  deps: LocalResearchDeps = {}
): Promise<CcResearchOutput> {
  const input = CcResearchInputSchema.parse(normalizeResearchOptions(options));
  const runResearch = deps.runResearch ?? runClaudeResearch;
  const write = deps.write ?? ((text: string) => process.stdout.write(text));
  const result = await runResearch(input);

  write(formatResearchResult(result));

  if (!result.ok) {
    process.exitCode = 1;
  }

  return result;
}

function normalizeResearchOptions(options: LocalResearchOptions): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...options };

  if (typeof options.maxContextChars === "string") {
    normalized.maxContextChars = Number(options.maxContextChars);
  }

  return normalized;
}

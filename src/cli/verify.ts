import { formatVerifyResult } from "../tasks/verify/format.js";
import {
  CcVerifyInputSchema,
  type CcVerifyInput,
  type CcVerifyOutput
} from "../tasks/verify/schema.js";
import { runClaudeVerify } from "../tasks/verify/tool.js";

export interface LocalVerifyOptions {
  hypothesis: string;
  commandsAllowed: string | string[];
  cwd?: string;
  context?: string;
  providerProfile?: string;
  model?: string;
  effort?: string;
  timeoutMs?: number | string;
  maxContextChars?: number | string;
  stream?: boolean;
  cacheTtl?: string;
}

export interface LocalVerifyDeps {
  runVerify?: (input: CcVerifyInput) => Promise<CcVerifyOutput>;
  write?: (text: string) => void;
}

export async function runLocalVerify(
  options: LocalVerifyOptions,
  deps: LocalVerifyDeps = {}
): Promise<CcVerifyOutput> {
  const input = CcVerifyInputSchema.parse(normalizeVerifyOptions(options));
  const runVerify = deps.runVerify ?? runClaudeVerify;
  const write = deps.write ?? ((text: string) => process.stdout.write(text));
  const result = await runVerify(input);

  write(formatVerifyResult(result));

  if (!result.ok) {
    process.exitCode = 1;
  }

  return result;
}

function normalizeVerifyOptions(options: LocalVerifyOptions): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...options };

  if (typeof options.timeoutMs === "string") {
    normalized.timeoutMs = Number(options.timeoutMs);
  }

  if (typeof options.maxContextChars === "string") {
    normalized.maxContextChars = Number(options.maxContextChars);
  }

  return normalized;
}

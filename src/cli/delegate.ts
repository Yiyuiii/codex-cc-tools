import { formatDelegateResult } from "../tasks/delegate/format.js";
import {
  CcDelegateInputSchema,
  type CcDelegateInput,
  type CcDelegateOutput
} from "../tasks/delegate/schema.js";
import { runClaudeDelegate } from "../tasks/delegate/tool.js";

export interface LocalDelegateOptions {
  prompt: string;
  cwd?: string;
  providerProfile?: string;
  model?: string;
  effort?: string;
  timeoutMs?: number | string;
  maxContextChars?: number | string;
  stream?: boolean;
  cacheTtl?: string;
}

export interface LocalDelegateDeps {
  runDelegate?: (input: CcDelegateInput) => Promise<CcDelegateOutput>;
  write?: (text: string) => void;
}

export async function runLocalDelegate(
  options: LocalDelegateOptions,
  deps: LocalDelegateDeps = {}
): Promise<CcDelegateOutput> {
  const input = CcDelegateInputSchema.parse(normalizeDelegateOptions(options));
  const runDelegate = deps.runDelegate ?? runClaudeDelegate;
  const write = deps.write ?? ((text: string) => process.stdout.write(text));
  const result = await runDelegate(input);

  write(formatDelegateResult(result));

  if (!result.ok) {
    process.exitCode = 1;
  }

  return result;
}

function normalizeDelegateOptions(options: LocalDelegateOptions): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...options };

  if (typeof options.timeoutMs === "string") {
    normalized.timeoutMs = Number(options.timeoutMs);
  }

  if (typeof options.maxContextChars === "string") {
    normalized.maxContextChars = Number(options.maxContextChars);
  }

  return normalized;
}

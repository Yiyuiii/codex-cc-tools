import { formatDelegateResult } from "../tasks/delegate/format.js";
import {
  CcDelegateInputSchema,
  type CcDelegateInput,
  type CcDelegateOutput
} from "../tasks/delegate/schema.js";
import { runClaudeDelegate } from "../tasks/delegate/tool.js";

export interface LocalDelegateOptions {
  task: string;
  cwd: string;
  isolationKind: "git-worktree" | "git-branch" | "container";
  isolationEvidence?: string;
  acceptanceCriteria: string | string[];
  context?: string;
  allowedPaths?: string | string[];
  forbiddenPaths?: string | string[];
  commandsAllowed?: string | string[];
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
  const isolationEvidence = parseIsolationEvidence(options.isolationEvidence);
  const normalized: Record<string, unknown> = {
    ...options,
    isolation: {
      kind: options.isolationKind,
      ...isolationEvidence
    }
  };

  delete normalized.isolationKind;
  delete normalized.isolationEvidence;

  if (typeof options.timeoutMs === "string") {
    normalized.timeoutMs = Number(options.timeoutMs);
  }

  if (typeof options.maxContextChars === "string") {
    normalized.maxContextChars = Number(options.maxContextChars);
  }

  return normalized;
}

function parseIsolationEvidence(value: string | undefined): Record<string, unknown> {
  if (!value?.trim()) return {};
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("--isolation-evidence must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
}

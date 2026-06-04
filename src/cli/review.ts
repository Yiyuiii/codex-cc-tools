import { runClaudeReview } from "../tasks/review/tool.js";
import { formatReviewResult } from "../tasks/review/format.js";
import {
  CcReviewInputSchema,
  type CcReviewInput,
  type CcReviewOutput
} from "../tasks/review/schema.js";

export interface LocalReviewOptions {
  task?: string;
  context?: string;
  prompt?: string;
  originalGoal?: string;
  reviewFocus?: string;
  codexSummary?: string;
  acceptanceCriteria?: string | string[];
  knownRisks?: string | string[];
  testsRun?: string | string[];
  model?: string;
  effort?: string;
  output?: string;
  permissionMode?: string;
  tools?: string;
  geminiProxyUrl?: string;
  cwd?: string;
  includeGitDiff?: boolean;
  includeGitStatus?: boolean;
  autoDiscoverGit?: boolean;
  includeUntrackedContent?: boolean;
  redactSecrets?: boolean;
  maxContextChars?: number | string;
  stream?: boolean;
  includePartialMessages?: boolean;
  includeHookEvents?: boolean;
  verbose?: boolean;
  cacheTtl?: string;
  providerProfile?: string;
}

export interface LocalReviewDeps {
  runReview?: (input: CcReviewInput) => Promise<CcReviewOutput>;
  write?: (text: string) => void;
}

export async function runLocalReview(
  options: LocalReviewOptions,
  deps: LocalReviewDeps = {}
): Promise<CcReviewOutput> {
  const input = CcReviewInputSchema.parse(normalizeReviewOptions(options));
  const runReview = deps.runReview ?? runClaudeReview;
  const write = deps.write ?? ((text: string) => process.stdout.write(text));
  const result = await runReview(input);

  write(formatReviewResult(result));

  if (!result.ok) {
    process.exitCode = 1;
  }

  return result;
}

function normalizeReviewOptions(options: LocalReviewOptions): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...options };

  if (typeof options.maxContextChars === "string") {
    normalized.maxContextChars = Number(options.maxContextChars);
  }

  return normalized;
}

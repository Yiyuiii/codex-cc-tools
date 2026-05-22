import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { formatDelegateResult } from "../tasks/delegate/format.js";
import { CcDelegateInputSchema, CcDelegateOutputSchema } from "../tasks/delegate/schema.js";
import type { CcDelegateInput, CcDelegateOutput } from "../tasks/delegate/schema.js";
import { runClaudeDelegate, type RunClaudeDelegateDeps } from "../tasks/delegate/tool.js";
import { formatResearchResult } from "../tasks/research/format.js";
import { CcResearchInputSchema, CcResearchOutputSchema } from "../tasks/research/schema.js";
import type { CcResearchInput, CcResearchOutput } from "../tasks/research/schema.js";
import { runClaudeResearch, type RunClaudeResearchDeps } from "../tasks/research/tool.js";
import { formatReviewResult } from "../tasks/review/format.js";
import { CcReviewInputSchema, CcReviewOutputSchema } from "../tasks/review/schema.js";
import type { CcReviewInput, CcReviewOutput } from "../tasks/review/schema.js";
import { runClaudeReview, type RunClaudeReviewDeps } from "../tasks/review/tool.js";
import { formatVerifyResult } from "../tasks/verify/format.js";
import { CcVerifyInputSchema, CcVerifyOutputSchema } from "../tasks/verify/schema.js";
import type { CcVerifyInput, CcVerifyOutput } from "../tasks/verify/schema.js";
import { runClaudeVerify, type RunClaudeVerifyDeps } from "../tasks/verify/tool.js";
import { createProgressReporter } from "./progress.js";

export interface RegisterCcReviewToolDeps {
  runReview?: (input: CcReviewInput, deps?: RunClaudeReviewDeps) => Promise<CcReviewOutput>;
}

export interface RegisterCcResearchToolDeps {
  runResearch?: (input: CcResearchInput, deps?: RunClaudeResearchDeps) => Promise<CcResearchOutput>;
}

export interface RegisterCcVerifyToolDeps {
  runVerify?: (input: CcVerifyInput, deps?: RunClaudeVerifyDeps) => Promise<CcVerifyOutput>;
}

export interface RegisterCcDelegateToolDeps {
  runDelegate?: (input: CcDelegateInput, deps?: RunClaudeDelegateDeps) => Promise<CcDelegateOutput>;
}

export function registerCcDelegateTool(
  server: McpServer,
  deps: RegisterCcDelegateToolDeps = {}
): void {
  const runDelegate = deps.runDelegate ?? runClaudeDelegate;

  server.registerTool(
    "cc_delegate",
    {
      title: "Claude Code Delegate",
      description: "Run Claude Code for explicit writable delegated work.",
      inputSchema: CcDelegateInputSchema.shape,
      outputSchema: CcDelegateOutputSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false
      }
    },
    async (input, extra) => {
      const parsed = CcDelegateInputSchema.parse(input);
      const progress = createProgressReporter(extra);
      let progressFinished = false;
      const finishProgress = async () => {
        if (!progressFinished) {
          progressFinished = true;
          await progress.finish();
        }
      };

      try {
        const result = await runDelegate(parsed, {
          onActivity: progress.onActivity,
          signal: extra.signal
        });
        await finishProgress();
        const diagnostics = [...result.diagnostics, ...progress.getDiagnostics()];
        const output = diagnostics.length ? { ...result, diagnostics } : result;

        return {
          content: [
            {
              type: "text",
              text: formatDelegateResult(output)
            }
          ],
          structuredContent: output
        };
      } finally {
        await finishProgress();
      }
    }
  );
}

export function registerCcReviewTool(
  server: McpServer,
  deps: RegisterCcReviewToolDeps = {}
): void {
  const runReview = deps.runReview ?? runClaudeReview;

  server.registerTool(
    "cc_review",
    {
      title: "Claude Code Review",
      description: "Run Claude Code as an external reviewer for Codex plans, diffs, or documents.",
      inputSchema: CcReviewInputSchema.shape,
      outputSchema: CcReviewOutputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (input, extra) => {
      const parsed = CcReviewInputSchema.parse(input);
      const progress = createProgressReporter(extra);
      let progressFinished = false;
      const finishProgress = async () => {
        if (!progressFinished) {
          progressFinished = true;
          await progress.finish();
        }
      };

      try {
        const result = await runReview(parsed, {
          onActivity: progress.onActivity,
          signal: extra.signal
        });
        await finishProgress();
        const diagnostics = [...(result.diagnostics ?? []), ...progress.getDiagnostics()];
        const output = diagnostics.length ? { ...result, diagnostics } : result;

        return {
          content: [
            {
              type: "text",
              text: formatReviewResult(output)
            }
          ],
          structuredContent: output
        };
      } finally {
        await finishProgress();
      }
    }
  );
}

export function registerCcResearchTool(
  server: McpServer,
  deps: RegisterCcResearchToolDeps = {}
): void {
  const runResearch = deps.runResearch ?? runClaudeResearch;

  server.registerTool(
    "cc_research",
    {
      title: "Claude Code Research",
      description: "Run Claude Code for bounded read-only repository research.",
      inputSchema: CcResearchInputSchema.shape,
      outputSchema: CcResearchOutputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async (input, extra) => {
      const parsed = CcResearchInputSchema.parse(input);
      const progress = createProgressReporter(extra);
      let progressFinished = false;
      const finishProgress = async () => {
        if (!progressFinished) {
          progressFinished = true;
          await progress.finish();
        }
      };

      try {
        const result = await runResearch(parsed, {
          onActivity: progress.onActivity,
          signal: extra.signal
        });
        await finishProgress();
        const diagnostics = [...(result.diagnostics ?? []), ...progress.getDiagnostics()];
        const output = diagnostics.length ? { ...result, diagnostics } : result;

        return {
          content: [
            {
              type: "text",
              text: formatResearchResult(output)
            }
          ],
          structuredContent: output
        };
      } finally {
        await finishProgress();
      }
    }
  );
}

export function registerCcVerifyTool(
  server: McpServer,
  deps: RegisterCcVerifyToolDeps = {}
): void {
  const runVerify = deps.runVerify ?? runClaudeVerify;

  server.registerTool(
    "cc_verify",
    {
      title: "Claude Code Verify",
      description: "Run Claude Code for bounded command verification.",
      inputSchema: CcVerifyInputSchema.shape,
      outputSchema: CcVerifyOutputSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false
      }
    },
    async (input, extra) => {
      const parsed = CcVerifyInputSchema.parse(input);
      const progress = createProgressReporter(extra);
      let progressFinished = false;
      const finishProgress = async () => {
        if (!progressFinished) {
          progressFinished = true;
          await progress.finish();
        }
      };

      try {
        const result = await runVerify(parsed, {
          onActivity: progress.onActivity,
          signal: extra.signal
        });
        await finishProgress();
        const diagnostics = [...result.diagnostics, ...progress.getDiagnostics()];
        const output = diagnostics.length ? { ...result, diagnostics } : result;

        return {
          content: [
            {
              type: "text",
              text: formatVerifyResult(output)
            }
          ],
          structuredContent: output
        };
      } finally {
        await finishProgress();
      }
    }
  );
}

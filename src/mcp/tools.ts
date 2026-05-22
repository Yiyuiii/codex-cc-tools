import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { formatDelegateResult } from "../tasks/delegate/format.js";
import { CcDelegateInputSchema, CcDelegateOutputSchema } from "../tasks/delegate/schema.js";
import type { CcDelegateInput, CcDelegateOutput } from "../tasks/delegate/schema.js";
import { runClaudeDelegate, type RunClaudeDelegateDeps } from "../tasks/delegate/tool.js";
import { formatReviewResult } from "../tasks/review/format.js";
import { CcReviewInputSchema, CcReviewOutputSchema } from "../tasks/review/schema.js";
import type { CcReviewInput, CcReviewOutput } from "../tasks/review/schema.js";
import { runClaudeReview, type RunClaudeReviewDeps } from "../tasks/review/tool.js";
import { createProgressReporter } from "./progress.js";

export interface RegisterCcReviewToolDeps {
  runReview?: (input: CcReviewInput, deps?: RunClaudeReviewDeps) => Promise<CcReviewOutput>;
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
      description:
        "Run a DeepSeek-default Claude Code subprocess for one complete prompt plus optional process settings; returns structured results, and multiple calls can run concurrently.",
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
      const parsed = CcDelegateInputSchema.safeParse(input);
      if (!parsed.success) {
        const output = CcDelegateOutputSchema.parse({
          ok: false,
          status: "failed",
          model: "unknown",
          elapsedMs: 0,
          summary: "Invalid cc_delegate input.",
          filesChanged: [],
          commandsRun: [],
          verification: [],
          risks: [],
          diagnostics: [
            "Input validation failed.",
            ...parsed.error.issues.map((issue) => {
              const path = issue.path.join(".") || "<root>";
              return `${path}: ${issue.message}`;
            })
          ],
          command: ["claude"]
        });

        return {
          content: [
            {
              type: "text",
              text: formatDelegateResult(output)
            }
          ],
          structuredContent: output
        };
      }

      const progress = createProgressReporter(extra);
      let progressFinished = false;
      const finishProgress = async () => {
        if (!progressFinished) {
          progressFinished = true;
          await progress.finish();
        }
      };

      try {
        const result = await runDelegate(parsed.data, {
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

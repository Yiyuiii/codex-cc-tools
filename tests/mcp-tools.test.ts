import { describe, expect, it } from "vitest";

import {
  registerCcDelegateTool,
  registerCcReviewTool
} from "../src/mcp/tools.js";
import type { CcDelegateInput, CcDelegateOutput } from "../src/tasks/delegate/schema.js";
import type { CcReviewOutput } from "../src/tasks/review/schema.js";

describe("registerCcReviewTool", () => {
  it("registers cc_review with read-only annotations and provider profile input", () => {
    let observed: { name?: string; config?: { inputSchema?: Record<string, unknown>; annotations?: Record<string, unknown> } } = {};
    const server = {
      registerTool: (name: string, config: typeof observed.config) => {
        observed = { name, config };
      }
    };

    registerCcReviewTool(server as never);

    expect(observed.name).toBe("cc_review");
    expect(observed.config?.inputSchema).toHaveProperty("providerProfile");
    expect(observed.config?.annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false
    });
  });

  it("passes MCP progress and cancellation hooks into runClaudeReview", async () => {
    let callback: ((input: unknown, extra: unknown) => Promise<unknown>) | undefined;
    const server = {
      registerTool: (_name: string, _config: unknown, cb: typeof callback) => {
        callback = cb;
      }
    };
    const signal = new AbortController().signal;
    const notifications: unknown[] = [];
    let observedSignal: AbortSignal | undefined;

    registerCcReviewTool(server as never, {
      runReview: async (_input, deps) => {
        observedSignal = deps?.signal;
        deps?.onActivity?.({
          index: 1,
          kind: "tool_use",
          rawType: "assistant.tool_use",
          summary: "tool_use: Read {}",
          toolName: "Read",
          toolInput: {}
        });

        return {
          ok: true,
          task: "review_plan",
          model: "opus",
          elapsedMs: 1,
          review: "No findings.",
          command: ["claude"]
        } satisfies CcReviewOutput;
      }
    });

    const result = (await callback?.(
      { task: "review_plan", context: "Plan" },
      {
        signal,
        _meta: { progressToken: "progress-1" },
        sendNotification: async (notification: unknown) => {
          notifications.push(notification);
        }
      }
    )) as { structuredContent: CcReviewOutput };

    expect(observedSignal).toBe(signal);
    expect(notifications).toEqual([
      {
        method: "notifications/progress",
        params: {
          progressToken: "progress-1",
          progress: 1,
          message: "tool_use: Read {}"
        }
      }
    ]);
    expect(result.structuredContent.review).toBe("No findings.");
  });
});

describe("registerCcDelegateTool", () => {
  it("registers cc_delegate with destructive annotations and provider profile input", () => {
    let observed: {
      name?: string;
      config?: {
        description?: string;
        inputSchema?: Record<string, unknown>;
        annotations?: Record<string, unknown>;
      };
    } = {};
    const server = {
      registerTool: (name: string, config: typeof observed.config) => {
        observed = { name, config };
      }
    };

    registerCcDelegateTool(server as never);

    expect(observed.name).toBe("cc_delegate");
    expect(observed.config?.description).toBe(
      "Run a DeepSeek-default Claude Code worker for autonomous delegated subtasks; caller must ensure parallel tasks are read-only or have disjoint writable scopes."
    );
    expect(observed.config?.inputSchema).toHaveProperty("providerProfile");
    expect(observed.config?.inputSchema).toHaveProperty("prompt");
    expect(observed.config?.inputSchema).not.toHaveProperty("isolation");
    expect(observed.config?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false
    });
  });

  it("passes MCP progress and cancellation hooks into runClaudeDelegate", async () => {
    let callback: ((input: unknown, extra: unknown) => Promise<unknown>) | undefined;
    const server = {
      registerTool: (_name: string, _config: unknown, cb: typeof callback) => {
        callback = cb;
      }
    };
    const signal = new AbortController().signal;
    let observedSignal: AbortSignal | undefined;
    let observedInput: CcDelegateInput | undefined;

    registerCcDelegateTool(server as never, {
      runDelegate: async (input, deps) => {
        observedInput = input;
        observedSignal = deps?.signal;
        deps?.onActivity?.({
          index: 1,
          kind: "tool_use",
          rawType: "assistant.tool_use",
          summary: "tool_use: Edit {}",
          toolName: "Edit",
          toolInput: {}
        });

        return {
          ok: true,
          status: "succeeded",
          model: "opus",
          elapsedMs: 1,
          summary: "Done.",
          filesChanged: ["src/index.ts"],
          commandsRun: [],
          verification: [],
          risks: [],
          diagnostics: [],
          command: ["claude"]
        } satisfies CcDelegateOutput;
      }
    });

    const result = (await callback?.(
      {
        prompt: "Edit file.",
        cwd: "D:\\Codes\\repo-worktree"
      },
      {
        signal,
        _meta: { progressToken: "progress-1" },
        sendNotification: async () => undefined
      }
    )) as { structuredContent: CcDelegateOutput };

    expect(observedSignal).toBe(signal);
    expect(observedInput?.providerProfile).toBe("deepseek");
    expect(result.structuredContent.summary).toContain("Done");
  });

  it("returns a structured failure for invalid delegate input", async () => {
    let callback: ((input: unknown, extra: unknown) => Promise<unknown>) | undefined;
    const server = {
      registerTool: (_name: string, _config: unknown, cb: typeof callback) => {
        callback = cb;
      }
    };

    registerCcDelegateTool(server as never, {
      runDelegate: async () => {
        throw new Error("runDelegate should not be called");
      }
    });

    const result = (await callback?.(
      {
        prompt: "Edit file.",
        isolation: { kind: "git-worktree", branch: "codex/old-shape" }
      },
      {
        signal: new AbortController().signal,
        sendNotification: async () => undefined
      }
    )) as { structuredContent: CcDelegateOutput; content: Array<{ text: string }> };

    expect(result.structuredContent.ok).toBe(false);
    expect(result.structuredContent.status).toBe("failed");
    expect(result.structuredContent.summary).toBe("Invalid cc_delegate input.");
    expect(result.structuredContent.diagnostics.join("\n")).toContain("Unrecognized key");
    expect(result.content[0]?.text).toContain("Status: failed");
  });
});

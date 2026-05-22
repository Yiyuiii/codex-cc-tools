import { describe, expect, it } from "vitest";

import {
  registerCcDelegateTool,
  registerCcResearchTool,
  registerCcReviewTool,
  registerCcVerifyTool
} from "../src/mcp/tools.js";
import type { CcDelegateOutput } from "../src/tasks/delegate/schema.js";
import type { CcReviewOutput } from "../src/tasks/review/schema.js";
import type { CcResearchOutput } from "../src/tasks/research/schema.js";
import type { CcVerifyOutput } from "../src/tasks/verify/schema.js";

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

describe("registerCcResearchTool", () => {
  it("registers cc_research with read-only annotations and provider profile input", () => {
    let observed: { name?: string; config?: { inputSchema?: Record<string, unknown>; annotations?: Record<string, unknown> } } = {};
    const server = {
      registerTool: (name: string, config: typeof observed.config) => {
        observed = { name, config };
      }
    };

    registerCcResearchTool(server as never);

    expect(observed.name).toBe("cc_research");
    expect(observed.config?.inputSchema).toHaveProperty("providerProfile");
    expect(observed.config?.annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    });
  });

  it("passes MCP progress and cancellation hooks into runClaudeResearch", async () => {
    let callback: ((input: unknown, extra: unknown) => Promise<unknown>) | undefined;
    const server = {
      registerTool: (_name: string, _config: unknown, cb: typeof callback) => {
        callback = cb;
      }
    };
    const signal = new AbortController().signal;
    let observedSignal: AbortSignal | undefined;

    registerCcResearchTool(server as never, {
      runResearch: async (_input, deps) => {
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
          status: "answered",
          model: "opus",
          elapsedMs: 1,
          answer: "Provider routing lives in src/providers.",
          evidence: [],
          filesRead: ["src/providers/registry.ts"],
          commandsRun: [],
          missingContext: [],
          command: ["claude"]
        } satisfies CcResearchOutput;
      }
    });

    const result = (await callback?.(
      { question: "Where is provider routing?" },
      {
        signal,
        _meta: { progressToken: "progress-1" },
        sendNotification: async () => undefined
      }
    )) as { structuredContent: CcResearchOutput };

    expect(observedSignal).toBe(signal);
    expect(result.structuredContent.answer).toContain("Provider routing");
  });
});

describe("registerCcVerifyTool", () => {
  it("registers cc_verify with command-exec annotations and provider profile input", () => {
    let observed: { name?: string; config?: { inputSchema?: Record<string, unknown>; annotations?: Record<string, unknown> } } = {};
    const server = {
      registerTool: (name: string, config: typeof observed.config) => {
        observed = { name, config };
      }
    };

    registerCcVerifyTool(server as never);

    expect(observed.name).toBe("cc_verify");
    expect(observed.config?.inputSchema).toHaveProperty("providerProfile");
    expect(observed.config?.inputSchema).toHaveProperty("commandsAllowed");
    expect(observed.config?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false
    });
  });

  it("passes MCP progress and cancellation hooks into runClaudeVerify", async () => {
    let callback: ((input: unknown, extra: unknown) => Promise<unknown>) | undefined;
    const server = {
      registerTool: (_name: string, _config: unknown, cb: typeof callback) => {
        callback = cb;
      }
    };
    const signal = new AbortController().signal;
    let observedSignal: AbortSignal | undefined;

    registerCcVerifyTool(server as never, {
      runVerify: async (_input, deps) => {
        observedSignal = deps?.signal;
        deps?.onActivity?.({
          index: 1,
          kind: "tool_use",
          rawType: "assistant.tool_use",
          summary: "tool_use: Bash {}",
          toolName: "Bash",
          toolInput: {}
        });

        return {
          ok: true,
          status: "verified",
          model: "opus",
          elapsedMs: 1,
          summary: "Build passes.",
          commandsRun: [{ command: "npm run build", exitCode: 0, summary: "Build passed." }],
          evidence: ["Build exited 0."],
          reproduction: "Ran npm run build.",
          needsFollowup: false,
          diagnostics: [],
          command: ["claude"]
        } satisfies CcVerifyOutput;
      }
    });

    const result = (await callback?.(
      { hypothesis: "Build succeeds.", commandsAllowed: ["npm run build"] },
      {
        signal,
        _meta: { progressToken: "progress-1" },
        sendNotification: async () => undefined
      }
    )) as { structuredContent: CcVerifyOutput };

    expect(observedSignal).toBe(signal);
    expect(result.structuredContent.summary).toContain("Build passes");
  });
});

describe("registerCcDelegateTool", () => {
  it("registers cc_delegate with destructive annotations and provider profile input", () => {
    let observed: { name?: string; config?: { inputSchema?: Record<string, unknown>; annotations?: Record<string, unknown> } } = {};
    const server = {
      registerTool: (name: string, config: typeof observed.config) => {
        observed = { name, config };
      }
    };

    registerCcDelegateTool(server as never);

    expect(observed.name).toBe("cc_delegate");
    expect(observed.config?.inputSchema).toHaveProperty("providerProfile");
    expect(observed.config?.inputSchema).toHaveProperty("isolation");
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

    registerCcDelegateTool(server as never, {
      runDelegate: async (_input, deps) => {
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
        task: "Edit file.",
        cwd: "D:\\Codes\\repo-worktree",
        isolation: { kind: "git-worktree", branch: "codex/feature" },
        acceptanceCriteria: ["Tests pass."]
      },
      {
        signal,
        _meta: { progressToken: "progress-1" },
        sendNotification: async () => undefined
      }
    )) as { structuredContent: CcDelegateOutput };

    expect(observedSignal).toBe(signal);
    expect(result.structuredContent.summary).toContain("Done");
  });
});

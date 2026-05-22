import { afterEach, describe, expect, it, vi } from "vitest";

import { createProgressReporter } from "../src/mcp/progress.js";
import type { ClaudeActivityEvent } from "../src/core/claude-runner.js";

const toolUseEvent: ClaudeActivityEvent = {
  index: 1,
  kind: "tool_use",
  rawType: "assistant.tool_use",
  summary: "tool_use: Read {\"file_path\":\"README.md\"}",
  toolName: "Read",
  toolInput: { file_path: "README.md" }
};

describe("createProgressReporter", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends MCP progress notifications with increasing progress when a token exists", async () => {
    const notifications: unknown[] = [];
    const reporter = createProgressReporter(
      {
        _meta: { progressToken: "token-1" },
        sendNotification: async (notification: unknown) => {
          notifications.push(notification);
        }
      },
      { throttleMs: 0 }
    );

    reporter.onActivity({
      index: 0,
      kind: "system",
      rawType: "system:init",
      summary: "system:init"
    });
    reporter.onActivity(toolUseEvent);
    await reporter.finish();

    expect(notifications).toEqual([
      {
        method: "notifications/progress",
        params: {
          progressToken: "token-1",
          progress: 1,
          message: "system:init"
        }
      },
      {
        method: "notifications/progress",
        params: {
          progressToken: "token-1",
          progress: 2,
          message: "tool_use: Read {\"file_path\":\"README.md\"}"
        }
      }
    ]);
  });

  it("flushes a throttled pending event on finish", async () => {
    vi.useFakeTimers();
    const notifications: unknown[] = [];
    const reporter = createProgressReporter(
      {
        _meta: { progressToken: "token-2" },
        sendNotification: async (notification: unknown) => {
          notifications.push(notification);
        }
      },
      { throttleMs: 1_000 }
    );

    reporter.onActivity({
      index: 1,
      kind: "assistant_text",
      rawType: "assistant.text",
      summary: "pending progress"
    });
    await reporter.finish();

    expect(notifications).toEqual([
      {
        method: "notifications/progress",
        params: {
          progressToken: "token-2",
          progress: 1,
          message: "pending progress"
        }
      }
    ]);
    await vi.runOnlyPendingTimersAsync();
    expect(notifications).toHaveLength(1);
  });
});

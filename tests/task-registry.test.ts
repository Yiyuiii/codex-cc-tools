import { describe, expect, it } from "vitest";

import { getTaskDefinitions } from "../src/tasks/registry.js";

describe("task registry", () => {
  it("exposes the first four Codex/Claude Code task families", () => {
    expect(getTaskDefinitions()).toEqual([
      {
        name: "review",
        capability: "Read-only external review of plans, diffs, and documents",
        safety: "readonly"
      },
      {
        name: "delegate",
        capability: "Writable delegated subtasks executed by Claude Code",
        safety: "workspace-write"
      },
      {
        name: "verify",
        capability: "Focused verification and reproduction tasks",
        safety: "command-exec"
      },
      {
        name: "research",
        capability: "Read-only repository and context investigation",
        safety: "readonly"
      }
    ]);
  });
});

import { describe, expect, it } from "vitest";

import { getTaskDefinitions } from "../src/tasks/registry.js";

describe("task registry", () => {
  it("exposes the high-leverage Codex/Claude Code task families", () => {
    expect(getTaskDefinitions()).toEqual([
      {
        name: "review",
        capability: "Read-only external review of plans, diffs, and documents",
        safety: "readonly"
      },
      {
        name: "delegate",
        capability: "Thin Claude Code prompt execution for Codex",
        safety: "destructive"
      }
    ]);
    expect(getTaskDefinitions().map((task) => task.name)).not.toContain("research");
    expect(getTaskDefinitions().map((task) => task.name)).not.toContain("verify");
  });
});

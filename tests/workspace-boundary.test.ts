import { describe, expect, it } from "vitest";

import {
  isPathEqualOrInside,
  isPathInsideBoundary,
  isUnsafeWorkspaceRoot,
  normalizeForPlatform
} from "../src/core/workspace-boundary.js";

describe("workspace boundary helpers", () => {
  it("normalizes Windows paths case-insensitively", () => {
    expect(normalizeForPlatform("C:\\Repo\\SRC", "win32")).toBe("c:\\repo\\src");
    expect(normalizeForPlatform("/Users/Ada/Repo", "linux")).toBe("/Users/Ada/Repo");
  });

  it("matches path boundaries by segment, not raw string prefix", () => {
    expect(isPathEqualOrInside("C:\\repo\\src\\foo", "C:\\repo\\src\\foo", "win32")).toBe(true);
    expect(isPathEqualOrInside("C:\\repo\\src\\foo\\index.ts", "C:\\repo\\src\\foo", "win32")).toBe(
      true
    );
    expect(isPathEqualOrInside("C:\\repo\\src\\foobar.ts", "C:\\repo\\src\\foo", "win32")).toBe(
      false
    );
    expect(isPathEqualOrInside("C:\\repo\\src\\foo-secrets\\x", "C:\\repo\\src\\foo", "win32")).toBe(
      false
    );
  });

  it("checks candidate paths against any allowed boundary", () => {
    const allowed = ["C:\\repo\\src\\foo", "C:\\repo\\docs"];

    expect(isPathInsideBoundary("C:\\REPO\\src\\foo\\index.ts", allowed, "win32")).toBe(true);
    expect(isPathInsideBoundary("C:\\repo\\docs\\design.md", allowed, "win32")).toBe(true);
    expect(isPathInsideBoundary("C:\\repo\\src\\bar\\index.ts", allowed, "win32")).toBe(false);
  });

  it("handles Windows UNC and drive boundaries by path segment", () => {
    expect(isPathEqualOrInside("\\\\server\\share\\repo\\src", "\\\\SERVER\\share\\repo", "win32")).toBe(
      true
    );
    expect(isPathEqualOrInside("\\\\server\\share\\repo2\\src", "\\\\server\\share\\repo", "win32")).toBe(
      false
    );
    expect(isPathEqualOrInside("C:\\repo-worktree\\src", "C:\\repo", "win32")).toBe(false);
    expect(isUnsafeWorkspaceRoot("\\\\server\\share\\", {}, "win32")).toBe(true);
  });

  it("rejects unsafe workspace roots and git internals", () => {
    expect(isUnsafeWorkspaceRoot("C:\\", { USERPROFILE: "C:\\Users\\Ada" }, "win32")).toBe(true);
    expect(isUnsafeWorkspaceRoot("C:\\Users\\Ada", { USERPROFILE: "C:\\Users\\Ada" }, "win32")).toBe(
      true
    );
    expect(isUnsafeWorkspaceRoot("C:\\Windows", { WINDIR: "C:\\Windows" }, "win32")).toBe(true);
    expect(isUnsafeWorkspaceRoot("C:\\repo\\.git", {}, "win32")).toBe(true);
    expect(isUnsafeWorkspaceRoot("C:\\repo\\.git\\hooks", {}, "win32")).toBe(true);
    expect(isUnsafeWorkspaceRoot("C:\\repo\\worktree", { USERPROFILE: "C:\\Users\\Ada" }, "win32")).toBe(
      false
    );
  });
});

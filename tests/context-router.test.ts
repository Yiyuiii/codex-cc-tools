import { describe, expect, it } from "vitest";

import { routeDiffForReview, routeRawDiffFallbackForReview } from "../src/tasks/review/context-router.js";
import { parseUnifiedDiff, type ParsedDiffFile } from "../src/tasks/review/diff-parser.js";

describe("routeDiffForReview", () => {
  it("includes small source diffs fully with a manifest and routing guidance", () => {
    const routed = routeDiffForReview(
      parseUnifiedDiff([
        "diff --git a/src/foo.ts b/src/foo.ts",
        "index 1111111..2222222 100644",
        "--- a/src/foo.ts",
        "+++ b/src/foo.ts",
        "@@ -1 +1,2 @@",
        " const keep = true;",
        "+export const added = true;"
      ].join("\n")),
      { totalBudgetChars: 4_000 }
    );

    expect(routed.manifestRows[0]).toMatchObject({
      path: "src/foo.ts",
      status: "modified",
      inclusion: "full",
      reason: "risk: source; source diff within budget"
    });
    expect(routed.markdown).toContain("## Changed Files Manifest");
    expect(routed.markdown).toContain("| src/foo.ts | modified | full | +1/-0 | risk: source; source diff within budget |");
    expect(routed.markdown).toContain("## Context Routing Guidance");
    expect(routed.markdown).toContain("## Routed Git Diff Evidence");
    expect(routed.markdown).toContain("+export const added = true;");
  });

  it("prioritizes high-risk review infrastructure before lower-risk docs consume body budget", () => {
    const diff = [
      "diff --git a/docs/guide.md b/docs/guide.md",
      "index 1111111..2222222 100644",
      "--- a/docs/guide.md",
      "+++ b/docs/guide.md",
      "@@ -1 +1,60 @@",
      ...Array.from({ length: 60 }, (_, index) => `+doc-${index}`),
      "diff --git a/src/mcp/server.ts b/src/mcp/server.ts",
      "index 3333333..4444444 100644",
      "--- a/src/mcp/server.ts",
      "+++ b/src/mcp/server.ts",
      "@@ -1 +1 @@",
      "-old",
      "+new"
    ].join("\n");

    const routed = routeDiffForReview(parseUnifiedDiff(diff), {
      totalBudgetChars: 260,
      fullFileMaxChars: 260
    });

    expect(routed.sections[0]).toMatchObject({
      path: "src/mcp/server.ts",
      inclusion: "full",
      reason: "risk: mcp_transport; source diff within budget"
    });
    expect(routed.manifestRows.find((row) => row.path === "docs/guide.md")).toMatchObject({
      inclusion: "omitted",
      reason: "risk: docs; budget_exhausted"
    });
  });

  it("uses raw diff fallback markdown when parsing fails", () => {
    const routed = routeRawDiffFallbackForReview("mailbox-style diff\n+important fallback evidence\n", {
      totalBudgetChars: 400
    });

    expect(routed.manifestRows[0]).toMatchObject({
      path: "[unparsed-diff]",
      status: "unknown",
      inclusion: "full"
    });
    expect(routed.markdown).toContain("## Routed Git Diff Evidence");
    expect(routed.markdown).toContain("+important fallback evidence");
  });
});

export function diffFile(path: string, rawBody: string): ParsedDiffFile {
  return {
    path,
    status: "modified",
    addedLines: 1,
    deletedLines: 1,
    binary: false,
    generated: false,
    raw: rawBody
  };
}

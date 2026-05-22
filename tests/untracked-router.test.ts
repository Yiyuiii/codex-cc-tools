import { describe, expect, it } from "vitest";

import type { UntrackedFileEvidence } from "../src/git/untracked.js";
import { routeUntrackedForReview } from "../src/tasks/review/untracked-router.js";

describe("routeUntrackedForReview", () => {
  it("embeds selected untracked text files and keeps a separate manifest", () => {
    const routed = routeUntrackedForReview(
      [
        candidate(".env", "DATABASE_URL=postgres://user:pwd@localhost/app\n"),
        { path: "dist/app.js", sizeBytes: 12, inclusion: "omitted", reason: "generated_or_lockfile" }
      ],
      { totalBudgetChars: 4_000, contentRedacted: false }
    );

    expect(routed.manifestRows[0]).toMatchObject({
      path: ".env",
      inclusion: "full",
      reason: "untracked_text; embedded raw because redactSecrets=false",
      redacted: false
    });
    expect(routed.markdown).toContain("## Untracked Files Manifest");
    expect(routed.markdown).toContain("## Routed Untracked File Evidence");
    expect(routed.markdown).toContain("DATABASE_URL=postgres://user:pwd@localhost/app");
  });

  it("routes higher-risk untracked source before lower-risk docs consume body budget", () => {
    const routed = routeUntrackedForReview(
      [
        candidate("docs/notes.md", "docs\n".repeat(80)),
        candidate("src/new-feature.ts", "export const value = 1;\n")
      ],
      { totalBudgetChars: 140, fullFileMaxChars: 140, contentRedacted: false }
    );

    expect(routed.sections[0]).toMatchObject({
      path: "src/new-feature.ts",
      inclusion: "full"
    });
    expect(routed.manifestRows.find((row) => row.path === "docs/notes.md")).toMatchObject({
      inclusion: "omitted",
      reason: "untracked_text; budget_exhausted"
    });
  });
});

function candidate(path: string, content: string): UntrackedFileEvidence {
  return {
    path,
    sizeBytes: Buffer.byteLength(content, "utf8"),
    content,
    inclusion: "candidate",
    reason: "untracked_text"
  };
}

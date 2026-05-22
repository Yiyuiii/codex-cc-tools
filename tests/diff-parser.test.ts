import { describe, expect, it } from "vitest";

import { isGeneratedOrLockfilePath, parseUnifiedDiff } from "../src/tasks/review/diff-parser.js";

describe("parseUnifiedDiff", () => {
  it("parses modified, added, renamed, binary, and generated diff blocks", () => {
    const files = parseUnifiedDiff([
      "diff --git a/src/foo.ts b/src/foo.ts",
      "index 1111111..2222222 100644",
      "--- a/src/foo.ts",
      "+++ b/src/foo.ts",
      "@@ -1 +1,2 @@",
      "-const oldValue = 1;",
      "+const newValue = 2;",
      "+const added = 3;",
      "diff --git a/src/new.ts b/src/new.ts",
      "new file mode 100644",
      "index 0000000..3333333",
      "--- /dev/null",
      "+++ b/src/new.ts",
      "@@ -0,0 +1 @@",
      "+export const value = 1;",
      "diff --git a/src/old-name.ts b/src/new-name.ts",
      "similarity index 78%",
      "rename from src/old-name.ts",
      "rename to src/new-name.ts",
      "index 5555555..6666666 100644",
      "--- a/src/old-name.ts",
      "+++ b/src/new-name.ts",
      "@@ -1 +1 @@",
      "-export const name = 'old';",
      "+export const name = 'new';",
      "diff --git a/assets/logo.png b/assets/logo.png",
      "new file mode 100644",
      "index 0000000..7777777",
      "Binary files /dev/null and b/assets/logo.png differ",
      "diff --git a/package-lock.json b/package-lock.json",
      "index 1111111..2222222 100644",
      "--- a/package-lock.json",
      "+++ b/package-lock.json",
      "@@ -1 +1 @@",
      "-old",
      "+new"
    ].join("\n"));

    expect(files.map((file) => [file.path, file.status, file.addedLines, file.deletedLines])).toEqual([
      ["src/foo.ts", "modified", 2, 1],
      ["src/new.ts", "added", 1, 0],
      ["src/new-name.ts", "renamed", 1, 1],
      ["assets/logo.png", "binary", 0, 0],
      ["package-lock.json", "modified", 1, 1]
    ]);
    expect(files[2]?.oldPath).toBe("src/old-name.ts");
    expect(files[3]?.binary).toBe(true);
    expect(files[4]?.generated).toBe(true);
  });

  it("classifies build output and lockfiles without treating source cache modules as generated", () => {
    expect(isGeneratedOrLockfilePath("package-lock.json")).toBe(true);
    expect(isGeneratedOrLockfilePath("dist/app.js")).toBe(true);
    expect(isGeneratedOrLockfilePath("src/cache/session.ts")).toBe(false);
  });
});

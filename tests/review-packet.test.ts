import { describe, expect, it } from "vitest";

import { buildReviewPacket, redactSecrets } from "../src/tasks/review/packet.js";
import { CcReviewInputSchema, type CcReviewInput } from "../src/tasks/review/schema.js";

const baseInput: CcReviewInput = CcReviewInputSchema.parse({
  task: "review_diff",
  context: "Please review the diff for correctness.",
  model: "sonnet",
  effort: "high",
  output: "markdown",
  permissionMode: "plan",
  tools: ["Read"],
  autoDiscoverGit: false,
  redactSecrets: true
});

describe("buildReviewPacket", () => {
  it("wraps review input in stable packet sections", async () => {
    const packet = await buildReviewPacket({
      ...baseInput,
      prompt: "Focus on regression risk."
    });

    expect(packet).toContain("# Codex to Claude Code Review Packet");
    expect(packet).toContain("## Review Instructions");
    expect(packet).toContain("Do not edit files.");
    expect(packet).toContain("## Task Type\n\nreview_diff");
    expect(packet).toContain("## Review Focus\n\nFocus on regression risk.");
    expect(packet).toContain("## Current Context\n\nPlease review the diff for correctness.");
    expect(packet.indexOf("## Review Instructions")).toBeLessThan(
      packet.indexOf("## Current Context")
    );
  });

  it("separates original goal, acceptance criteria, implementation notes, risks, and tests", async () => {
    const packet = await buildReviewPacket({
      ...baseInput,
      originalGoal: "Ship a safe installer.",
      reviewFocus: "Focus on install rollback.",
      codexSummary: "Changed the Codex config writer.",
      acceptanceCriteria: ["Install is idempotent.", "Uninstall removes only this server."],
      knownRisks: ["Windows TOML formatting."],
      testsRun: ["npm test: passed"]
    });

    expect(packet).toContain("## Original User Goal\n\nShip a safe installer.");
    expect(packet).toContain("## Acceptance Criteria\n\n- Install is idempotent.\n- Uninstall removes only this server.");
    expect(packet).toContain("## Codex Implementation Summary\n\nChanged the Codex config writer.");
    expect(packet).toContain("## Known Risks\n\n- Windows TOML formatting.");
    expect(packet).toContain("## Tests Run\n\n- npm test: passed");
    expect(packet).toContain("## Review Focus\n\nFocus on install rollback.");
  });

  it("injects git summary, status, and diff only when requested", async () => {
    const packet = await buildReviewPacket(
      {
        ...baseInput,
        includeGitStatus: true,
        includeGitDiff: true
      },
      {
        getGitSummary: async () => "Summary",
        getGitStatus: async () => "M src/index.ts",
        getGitDiff: async () => "diff --git a/src/index.ts b/src/index.ts"
      }
    );

    expect(packet).toContain("## Git Evidence Summary");
    expect(packet).toContain("Summary");
    expect(packet).toContain("## Optional Git Status");
    expect(packet).toContain("M src/index.ts");
    expect(packet).toContain("## Routed Git Diff Evidence");
    expect(packet).toContain("diff --git a/src/index.ts b/src/index.ts");
  });

  it("auto-discovers raw git evidence for review_diff by default", async () => {
    const packet = await buildReviewPacket(
      CcReviewInputSchema.parse({
        task: "review_diff",
        context: "Review this diff."
      }),
      {
        getGitSummary: async () => "Diff Stat\n src/index.ts | 2 +-",
        getGitStatus: async () => "1 .M N... src/index.ts",
        getGitDiff: async () => "diff --git a/src/index.ts b/src/index.ts",
        getUntrackedFileEvidence: async () => []
      }
    );

    expect(packet).toContain("## Git Evidence Summary");
    expect(packet).toContain("## Optional Git Status");
    expect(packet).toContain("## Routed Git Diff Evidence");
    expect(packet).not.toContain("## Untracked Files Manifest");
  });

  it("includes untracked file content only when explicitly requested", async () => {
    const defaultPacket = await buildReviewPacket(
      CcReviewInputSchema.parse({
        task: "review_diff",
        context: "Review this diff."
      }),
      {
        getGitSummary: async () => "",
        getGitStatus: async () => "",
        getGitDiff: async () => "",
        getUntrackedFileEvidence: async () => [
          {
            path: ".env",
            sizeBytes: 20,
            inclusion: "candidate",
            reason: "untracked_text",
            content: "API_KEY=sk-secretvalue\n"
          }
        ]
      }
    );
    const explicitPacket = await buildReviewPacket(
      CcReviewInputSchema.parse({
        task: "review_diff",
        context: "Review this diff.",
        includeUntrackedContent: true
      }),
      {
        getGitSummary: async () => "",
        getGitStatus: async () => "",
        getGitDiff: async () => "",
        getUntrackedFileEvidence: async () => [
          {
            path: ".env",
            sizeBytes: 20,
            inclusion: "candidate",
            reason: "untracked_text",
            content: "API_KEY=sk-secretvalue\n"
          }
        ]
      }
    );

    expect(defaultPacket).not.toContain("## Untracked Files Manifest");
    expect(explicitPacket).toContain("## Untracked Files Manifest");
    expect(explicitPacket).not.toContain("sk-secretvalue");
  });

  it("redacts common secret-shaped values and truncates oversized context", async () => {
    const packet = await buildReviewPacket({
      ...baseInput,
      context: `HEAD-IMPORTANT\nAPI_KEY=sk-test1234567890\n${"x".repeat(5_000)}\nTAIL-IMPORTANT`,
      maxContextChars: 5_000
    });

    expect(packet).toContain("HEAD-IMPORTANT");
    expect(packet).toContain("TAIL-IMPORTANT");
    expect(packet).toContain("[TRUNCATED");
    expect(packet).toContain("API_KEY=[REDACTED]");
    expect(packet).not.toContain("sk-test1234567890");
  });

  it("keeps the final packet within maxContextChars", async () => {
    const packet = await buildReviewPacket(
      {
        ...baseInput,
        context: "context\n".repeat(500),
        includeGitStatus: true,
        includeGitDiff: true,
        includeUntrackedContent: true,
        maxContextChars: 1_200
      },
      {
        getGitSummary: async () => "summary\n".repeat(200),
        getGitStatus: async () => "status\n".repeat(200),
        getGitDiff: async () =>
          [
            "diff --git a/src/large.ts b/src/large.ts",
            "index 1111111..2222222 100644",
            "--- a/src/large.ts",
            "+++ b/src/large.ts",
            "@@ -1 +1,300 @@",
            ...Array.from({ length: 300 }, (_, index) => `+line-${index}`)
          ].join("\n"),
        getUntrackedFileEvidence: async () => [
          {
            path: "notes.txt",
            sizeBytes: 4_000,
            inclusion: "candidate",
            reason: "untracked_text",
            content: "note\n".repeat(800)
          }
        ]
      }
    );

    expect(packet.length).toBeLessThanOrEqual(1_200);
    expect(packet).toContain("[TRUNCATED");
  });
});

describe("redactSecrets", () => {
  it("redacts private key blocks and env-style secrets", () => {
    const redacted = redactSecrets(
      [
        "-----BEGIN OPENSSH PRIVATE KEY-----",
        "secret-key-body",
        "-----END OPENSSH PRIVATE KEY-----",
        "DATABASE_URL=postgres://user:pwd@localhost/app"
      ].join("\n")
    );

    expect(redacted).toContain("[REDACTED PRIVATE KEY BLOCK]");
    expect(redacted).toContain("DATABASE_URL=[REDACTED]");
    expect(redacted).not.toContain("secret-key-body");
    expect(redacted).not.toContain("postgres://user:pwd@localhost/app");
  });

  it("redacts common provider and platform token shapes", () => {
    const redacted = redactSecrets(
      [
        "GITHUB_TOKEN=" + "ghp_" + "1234567890abcdef1234567890abcdef123456",
        "AWS_ACCESS_KEY_ID=" + "AKIA" + "1234567890ABCDEF",
        "SLACK_BOT_TOKEN=" + "xoxb-" + "123456789012-123456789012-abcdefghijklmnopqrstuvwx",
        "STRIPE_SECRET=" + "sk_live_" + "1234567890abcdef"
      ].join("\n")
    );

    expect(redacted).not.toContain("ghp_" + "123456");
    expect(redacted).not.toContain("AKIA" + "123456");
    expect(redacted).not.toContain("xoxb-" + "123456");
    expect(redacted).not.toContain("sk_live_" + "123");
    expect(redacted).toContain("[REDACTED]");
  });
});

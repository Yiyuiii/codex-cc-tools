import { describe, expect, it } from "vitest";

import { buildVerifyPacket } from "../src/tasks/verify/packet.js";
import { CcVerifyInputSchema } from "../src/tasks/verify/schema.js";

describe("buildVerifyPacket", () => {
  it("wraps verification input in command-exec packet sections", async () => {
    const packet = await buildVerifyPacket(
      CcVerifyInputSchema.parse({
        hypothesis: "The TypeScript build passes.",
        commandsAllowed: ["npm run build"],
        context: "Focus on current changes."
      })
    );

    expect(packet).toContain("# Codex to Claude Code Verification Packet");
    expect(packet).toContain("Do not edit files.");
    expect(packet).toContain("## Hypothesis\n\nThe TypeScript build passes.");
    expect(packet).toContain("## Allowed Commands\n\n- npm run build");
    expect(packet).toContain("## Context\n\nFocus on current changes.");
    expect(packet).toContain("## Verification Output Contract");
  });

  it("truncates oversized context within maxContextChars", async () => {
    const packet = await buildVerifyPacket(
      CcVerifyInputSchema.parse({
        hypothesis: "The suite passes.",
        commandsAllowed: ["npm test"],
        context: `HEAD\n${"x".repeat(5_000)}\nTAIL`,
        maxContextChars: 1_200
      })
    );

    expect(packet.length).toBeLessThanOrEqual(1_200);
    expect(packet).toContain("[TRUNCATED");
  });

  it("redacts secret-shaped values in allowed command display", async () => {
    const packet = await buildVerifyPacket(
      CcVerifyInputSchema.parse({
        hypothesis: "Curl health endpoint.",
        commandsAllowed: ["curl https://example.test/health?token=sk_test12345678"]
      })
    );

    expect(packet).toContain("token=[REDACTED]");
    expect(packet).not.toContain("sk_test12345678");
  });
});

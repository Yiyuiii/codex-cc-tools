import { describe, expect, it } from "vitest";

import { buildDelegatePacket } from "../src/tasks/delegate/packet.js";
import { CcDelegateInputSchema } from "../src/tasks/delegate/schema.js";

describe("buildDelegatePacket", () => {
  it("passes the prompt through as a bounded Claude Code prompt", () => {
    const packet = buildDelegatePacket(
      CcDelegateInputSchema.parse({
        prompt: "Update the implementation."
      })
    );

    expect(packet).toBe("Update the implementation.\n");
    expect(packet).not.toContain("Isolation");
    expect(packet).not.toContain("Allowed Commands");
  });

  it("redacts secret-shaped values and truncates oversized prompts", () => {
    const packet = buildDelegatePacket(
      CcDelegateInputSchema.parse({
        prompt: "Use token=sk_test12345678\n" + "x".repeat(5_000),
        maxContextChars: 1_200
      })
    );

    expect(packet.length).toBeLessThanOrEqual(1_200);
    expect(packet).toContain("[TRUNCATED");
    expect(packet).not.toContain("sk_test12345678");
    expect(packet).toContain("token=[REDACTED]");
  });
});

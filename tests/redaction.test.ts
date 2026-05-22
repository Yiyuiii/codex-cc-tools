import { describe, expect, it } from "vitest";

import { redactProviderSecretsFromUnknown } from "../src/core/redaction.js";

describe("provider redaction", () => {
  it("redacts provider tokens from nested strings, arrays, objects, and errors", () => {
    const error = new Error("failed with deepseek-token");
    error.stack = "stack contains deepseek-token";

    const redacted = redactProviderSecretsFromUnknown(
      {
        text: "stdout deepseek-token",
        list: ["stderr deepseek-token"],
        nested: {
          error,
          cause: {
            message: "cause deepseek-token"
          }
        }
      },
      ["deepseek-token"]
    );

    const serialized = JSON.stringify(redacted);
    expect(serialized).not.toContain("deepseek-token");
    expect(serialized).toContain("[REDACTED_PROVIDER_TOKEN]");
  });
});

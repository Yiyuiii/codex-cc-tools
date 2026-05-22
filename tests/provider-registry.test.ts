import { describe, expect, it } from "vitest";

import {
  getProviderProfiles,
  ProviderProfileSchema,
  resolveProviderProfile
} from "../src/providers/registry.js";

describe("provider registry", () => {
  it("exposes anthropic and deepseek provider profiles", () => {
    expect(getProviderProfiles()).toEqual([
      {
        name: "anthropic",
        role: "default Claude Code provider",
        experimental: false
      },
      {
        name: "deepseek",
        role: "DeepSeek Anthropic-compatible Claude Code provider",
        experimental: false
      }
    ]);
  });

  it("maps common Claude Code aliases for the DeepSeek provider", () => {
    expect(resolveProviderProfile("deepseek", "opus")).toEqual({
      provider: "deepseek",
      model: "deepseek-v4-pro[1m]",
      subagentModel: "deepseek-v4-flash",
      experimental: false
    });
    expect(resolveProviderProfile("deepseek", "haiku").model).toBe("deepseek-v4-flash");
  });

  it("keeps Anthropic model aliases unchanged", () => {
    expect(resolveProviderProfile("anthropic", "opus")).toEqual({
      provider: "anthropic",
      model: "opus",
      experimental: false
    });
  });

  it("validates provider profile names with zod", () => {
    expect(ProviderProfileSchema.parse("anthropic")).toBe("anthropic");
    expect(ProviderProfileSchema.parse("deepseek")).toBe("deepseek");
    expect(() => ProviderProfileSchema.parse("unknown")).toThrow();
  });
});

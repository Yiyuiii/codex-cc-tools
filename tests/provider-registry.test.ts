import { describe, expect, it } from "vitest";

import {
  getProviderProfiles,
  ProviderProfileSchema,
  resolveProviderProfile
} from "../src/providers/registry.js";

describe("provider registry", () => {
  it("exposes anthropic, deepseek, and Ark Coding Plan provider profiles", () => {
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
      },
      {
        name: "ark_coding_plan",
        role: "Volcengine Ark Coding Plan Claude Code provider",
        experimental: true
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

  it("maps the Anthropic opus alias to Claude Opus 4.8", () => {
    expect(resolveProviderProfile("anthropic", "opus")).toEqual({
      provider: "anthropic",
      model: "claude-opus-4-8",
      experimental: false
    });
    expect(resolveProviderProfile("anthropic", "claude-opus-4-8").model).toBe(
      "claude-opus-4-8"
    );
    expect(resolveProviderProfile("anthropic", "sonnet").model).toBe("sonnet");
  });

  it("maps common Claude Code aliases for the Ark Coding Plan provider", () => {
    expect(resolveProviderProfile("ark_coding_plan", "opus")).toEqual({
      provider: "ark_coding_plan",
      model: "doubao-seed-2.0-pro",
      subagentModel: "doubao-seed-2.0-pro",
      experimental: true
    });
    expect(resolveProviderProfile("ark_coding_plan", "Doubao-Seed-2.0-pro").model).toBe(
      "doubao-seed-2.0-pro"
    );
  });

  it("validates provider profile names with zod", () => {
    expect(ProviderProfileSchema.parse("anthropic")).toBe("anthropic");
    expect(ProviderProfileSchema.parse("deepseek")).toBe("deepseek");
    expect(ProviderProfileSchema.parse("ark_coding_plan")).toBe("ark_coding_plan");
    expect(() => ProviderProfileSchema.parse("unknown")).toThrow();
  });
});

import { describe, expect, it } from "vitest";

import { buildProviderEnvironment } from "../src/providers/env.js";

describe("provider environment", () => {
  it("passes Anthropic profile route variables through and redacts inherited provider tokens", () => {
    const result = buildProviderEnvironment({
      provider: "anthropic",
      model: "opus",
      effort: "max",
      cacheTtl: "1h",
      sourceEnv: {
        ANTHROPIC_BASE_URL: "https://gateway.example.test/anthropic",
        ANTHROPIC_AUTH_TOKEN: "anthropic-token",
        ANTHROPIC_API_KEY: "anthropic-api-key",
        ANTHROPIC_BEDROCK_AUTH_TOKEN: "bedrock-token",
        AWS_ACCESS_KEY_ID: "aws-access-key",
        AWS_SECRET_ACCESS_KEY: "aws-secret-key",
        AWS_SESSION_TOKEN: "aws-session-token",
        GOOGLE_APPLICATION_CREDENTIALS: "vertex-credentials.json"
      }
    });

    expect(result.ok).toBe(true);
    expect(result.env).toMatchObject({
      ANTHROPIC_BASE_URL: "https://gateway.example.test/anthropic",
      ANTHROPIC_AUTH_TOKEN: "anthropic-token",
      ANTHROPIC_API_KEY: "anthropic-api-key",
      ENABLE_PROMPT_CACHING_1H: "1"
    });
    expect(result.redactions).toEqual([
      "anthropic-token",
      "anthropic-api-key",
      "bedrock-token",
      "aws-access-key",
      "aws-secret-key",
      "aws-session-token",
      "vertex-credentials.json"
    ]);
  });

  it("injects DeepSeek env per invocation and removes inherited provider route variables", () => {
    const result = buildProviderEnvironment({
      provider: "deepseek",
      model: "opus",
      effort: "max",
      cacheTtl: "5m",
      sourceEnv: {
        DEEPSEEK_API_KEY: "deepseek-token",
        OPENAI_API_KEY_DEEPSEEK: "fallback-token",
        DEEPSEEK_ANTHROPIC_BASE_URL: " https://deepseek.example.test/anthropic ",
        ANTHROPIC_API_KEY: "stale-anthropic-key",
        ANTHROPIC_AUTH_TOKEN: "stale-auth-token",
        ANTHROPIC_BASE_URL: "https://stale.example.test",
        ANTHROPIC_MODEL: "claude-opus",
        ANTHROPIC_SMALL_FAST_MODEL: "claude-haiku",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "claude-opus",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "claude-sonnet",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "claude-haiku",
        ANTHROPIC_CUSTOM_HEADERS: "Authorization: Bearer stale",
        ANTHROPIC_BEDROCK_AUTH_TOKEN: "stale-bedrock-token",
        ANTHROPIC_VERTEX_AUTH_TOKEN: "stale-vertex-token",
        CLAUDE_CODE_SUBAGENT_MODEL: "claude-haiku",
        CLAUDE_CODE_USE_BEDROCK: "1",
        CLAUDE_CODE_USE_VERTEX: "1",
        AWS_ACCESS_KEY_ID: "aws-key",
        AWS_SECRET_ACCESS_KEY: "aws-secret",
        AWS_REGION: "us-east-1",
        GOOGLE_APPLICATION_CREDENTIALS: "vertex.json",
        HTTPS_PROXY: "http://proxy.example.test:8080"
      }
    });

    expect(result.ok).toBe(true);
    expect(result.model).toBe("deepseek-v4-pro[1m]");
    expect(result.env).toMatchObject({
      ANTHROPIC_BASE_URL: "https://deepseek.example.test/anthropic",
      ANTHROPIC_AUTH_TOKEN: "deepseek-token",
      ANTHROPIC_MODEL: "deepseek-v4-pro[1m]",
      ANTHROPIC_DEFAULT_OPUS_MODEL: "deepseek-v4-pro[1m]",
      ANTHROPIC_DEFAULT_SONNET_MODEL: "deepseek-v4-pro[1m]",
      ANTHROPIC_DEFAULT_HAIKU_MODEL: "deepseek-v4-flash",
      ANTHROPIC_SMALL_FAST_MODEL: "deepseek-v4-flash",
      CLAUDE_CODE_SUBAGENT_MODEL: "deepseek-v4-flash",
      CLAUDE_CODE_EFFORT_LEVEL: "max",
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
      ENABLE_PROMPT_CACHING_1H: "0",
      HTTPS_PROXY: "http://proxy.example.test:8080"
    });
    expect(result.env).not.toHaveProperty("DEEPSEEK_API_KEY");
    expect(result.env).not.toHaveProperty("OPENAI_API_KEY_DEEPSEEK");
    expect(result.env).not.toHaveProperty("ANTHROPIC_API_KEY");
    expect(result.env).not.toHaveProperty("ANTHROPIC_CUSTOM_HEADERS");
    expect(result.env).not.toHaveProperty("ANTHROPIC_BEDROCK_AUTH_TOKEN");
    expect(result.env).not.toHaveProperty("ANTHROPIC_VERTEX_AUTH_TOKEN");
    expect(result.env).not.toHaveProperty("CLAUDE_CODE_USE_BEDROCK");
    expect(result.env).not.toHaveProperty("CLAUDE_CODE_USE_VERTEX");
    expect(result.env).not.toHaveProperty("AWS_ACCESS_KEY_ID");
    expect(result.env).not.toHaveProperty("AWS_SECRET_ACCESS_KEY");
    expect(result.env).toHaveProperty("AWS_REGION", "us-east-1");
    expect(result.env).not.toHaveProperty("GOOGLE_APPLICATION_CREDENTIALS");
    expect(result.redactions).toEqual(["deepseek-token", "fallback-token"]);
    expect(result.diagnostics).toEqual([
      "DeepSeek route target: deepseek.example.test; token source: DEEPSEEK_API_KEY."
    ]);
  });

  it("uses OPENAI_API_KEY_DEEPSEEK as fallback and rejects missing or invalid DeepSeek config", () => {
    expect(
      buildProviderEnvironment({
        provider: "deepseek",
        model: "haiku",
        effort: "medium",
        cacheTtl: "1h",
        sourceEnv: { OPENAI_API_KEY_DEEPSEEK: "fallback-token" }
      })
    ).toMatchObject({
      ok: true,
      model: "deepseek-v4-flash",
      diagnostics: [
        "DeepSeek route target: api.deepseek.com; token source: OPENAI_API_KEY_DEEPSEEK."
      ],
      redactions: ["fallback-token"]
    });

    expect(
      buildProviderEnvironment({
        provider: "deepseek",
        model: "opus",
        effort: "medium",
        cacheTtl: "1h",
        sourceEnv: {}
      })
    ).toMatchObject({
      ok: false,
      error: expect.stringContaining("DEEPSEEK_API_KEY")
    });

    expect(
      buildProviderEnvironment({
        provider: "deepseek",
        model: "claude-opus-4",
        effort: "medium",
        cacheTtl: "1h",
        sourceEnv: { DEEPSEEK_API_KEY: "deepseek-token" }
      })
    ).toMatchObject({
      ok: false,
      error: expect.stringContaining("Unsupported model")
    });

    expect(
      buildProviderEnvironment({
        provider: "deepseek",
        model: "opus",
        effort: "medium",
        cacheTtl: "1h",
        sourceEnv: {
          DEEPSEEK_API_KEY: " deepseek-token ",
          DEEPSEEK_ANTHROPIC_BASE_URL: "http://deepseek.example.test/anthropic"
        }
      })
    ).toMatchObject({
      ok: false,
      redactions: ["deepseek-token"],
      error: expect.stringContaining("https")
    });
  });
});

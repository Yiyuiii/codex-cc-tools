import { describe, expect, it } from "vitest";

import {
  resolveGeminiReviewConfig,
  runGeminiReview,
  type GeminiFetch
} from "../src/tasks/review/gemini.js";
import type { CcReviewInput } from "../src/tasks/review/schema.js";

const baseInput: CcReviewInput = {
  task: "review_doc",
  context: "Review this document.",
  model: "opus",
  effort: "max",
  output: "markdown",
  permissionMode: "bypassPermissions",
  includeGitDiff: false,
  includeGitStatus: false,
  redactSecrets: true,
  maxContextChars: 120_000,
  stream: false,
  includePartialMessages: true,
  includeHookEvents: true,
  verbose: true,
  cacheTtl: "1h",
  providerProfile: "gemini"
};

describe("Gemini direct review", () => {
  it("resolves Gemini config from key, model, base URL, and proxy env", () => {
    const config = resolveGeminiReviewConfig({
      model: "models/gemini-3.5-flash",
      sourceEnv: {
        GEMINI_API_KEY: "gemini-token",
        GOOGLE_API_KEY: "fallback-token",
        GEMINI_API_BASE_URL: " https://generativelanguage.googleapis.com/v1beta/ ",
        HTTPS_PROXY: " http://127.0.0.1:10808 "
      }
    });

    expect(config).toMatchObject({
      ok: true,
      model: "gemini-3.5-flash",
      apiKey: "gemini-token",
      keySource: "GEMINI_API_KEY",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      proxyUrl: "http://127.0.0.1:10808"
    });
    expect(config.ok && config.redactions).toEqual(["gemini-token", "fallback-token"]);
  });

  it("rejects missing Gemini keys and invalid Gemini base/proxy URLs", () => {
    expect(resolveGeminiReviewConfig({ model: "opus", sourceEnv: {} })).toMatchObject({
      ok: false,
      error: expect.stringContaining("GEMINI_API_KEY")
    });

    expect(
      resolveGeminiReviewConfig({
        model: "opus",
        sourceEnv: {
          GEMINI_API_KEY: "gemini-token",
          GEMINI_API_BASE_URL: "http://generativelanguage.googleapis.com/v1beta"
        }
      })
    ).toMatchObject({
      ok: false,
      redactions: ["gemini-token"],
      error: expect.stringContaining("https")
    });

    expect(
      resolveGeminiReviewConfig({
        model: "opus",
        sourceEnv: {
          GEMINI_API_KEY: "gemini-token",
          HTTPS_PROXY: "ftp://127.0.0.1:10808"
        }
      })
    ).toMatchObject({
      ok: false,
      redactions: ["gemini-token"],
      error: expect.stringContaining("HTTP proxy")
    });
  });

  it("calls Gemini generateContent without putting the API key in the URL", async () => {
    let observedUrl = "";
    let observedInit: Parameters<GeminiFetch>[1] | undefined;
    const fetch: GeminiFetch = async (url, init) => {
      observedUrl = url;
      observedInit = init;
      return jsonResponse({
        candidates: [
          {
            content: { parts: [{ text: "Gemini review ok." }] },
            finishReason: "STOP"
          }
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 4,
          thoughtsTokenCount: 2,
          totalTokenCount: 16
        }
      });
    };

    const result = await runGeminiReview(baseInput, "PACKET", {
      fetch,
      sourceEnv: {
        GEMINI_API_KEY: "gemini-token",
        HTTPS_PROXY: "http://127.0.0.1:10808"
      },
      now: fakeClock([1, 6])
    });

    expect(result).toMatchObject({
      ok: true,
      task: "review_doc",
      model: "gemini-3.5-flash",
      elapsedMs: 5,
      review: "Gemini review ok.",
      command: ["gemini", "generateContent", "--model", "gemini-3.5-flash"]
    });
    expect(observedUrl).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent"
    );
    expect(observedUrl).not.toContain("gemini-token");
    expect(observedInit?.headers["x-goog-api-key"]).toBe("gemini-token");
    expect(observedInit?.body).toContain("PACKET");
    expect(observedInit?.body).toContain('"maxOutputTokens":8192');
    expect(observedInit?.dispatcher).toBeDefined();
    expect(result.diagnostics?.join("\n")).toContain("finishReason: STOP");
    expect(result.diagnostics?.join("\n")).toContain("thoughts tokens: 2");
    expect(JSON.stringify(result)).not.toContain("gemini-token");
  });

  it("reports that Claude Code tool allowlists are ignored for Gemini review", async () => {
    const result = await runGeminiReview(
      { ...baseInput, tools: ["Read"] },
      "PACKET",
      {
        fetch: async () =>
          jsonResponse({
            candidates: [
              {
                content: { parts: [{ text: "No findings." }] },
                finishReason: "STOP"
              }
            ]
          }),
        sourceEnv: { GEMINI_API_KEY: "gemini-token" },
        now: fakeClock([1, 2])
      }
    );

    expect(result.ok).toBe(true);
    expect(result.diagnostics?.join("\n")).toContain("Gemini direct review ignores Claude Code tools");
  });

  it("redacts provider tokens from Gemini HTTP failures", async () => {
    const result = await runGeminiReview(baseInput, "PACKET", {
      fetch: async () => ({
        ok: false,
        status: 401,
        text: async () => "bad key gemini-token"
      }),
      sourceEnv: { GEMINI_API_KEY: "gemini-token" },
      now: fakeClock([1, 2])
    });

    expect(result.ok).toBe(false);
    expect(result.review).toContain("HTTP 401");
    expect(JSON.stringify(result)).not.toContain("gemini-token");
    expect(JSON.stringify(result)).toContain("[REDACTED_PROVIDER_TOKEN]");
  });

  it("fails clearly when Gemini returns an empty successful response", async () => {
    const result = await runGeminiReview(baseInput, "PACKET", {
      fetch: async () =>
        jsonResponse({
          candidates: [
            {
              content: { parts: [] },
              finishReason: "STOP"
            }
          ]
        }),
      sourceEnv: { GEMINI_API_KEY: "gemini-token" },
      now: fakeClock([1, 2])
    });

    expect(result.ok).toBe(false);
    expect(result.review).toContain("empty response");
  });

  it("aborts Gemini requests after the direct request timeout", async () => {
    const result = await runGeminiReview(baseInput, "PACKET", {
      fetch: async (_url, init) =>
        new Promise((_, reject) => {
          init.signal?.addEventListener("abort", () => {
            reject(new Error("aborted"));
          });
        }),
      sourceEnv: { GEMINI_API_KEY: "gemini-token" },
      timeoutMs: 1,
      now: fakeClock([1, 5])
    });

    expect(result.ok).toBe(false);
    expect(result.review).toContain("timed out after 1ms");
  });

  it("parses Gemini JSON review output when requested", async () => {
    const structured = { verdict: "approve", summary: "ok", findings: [], missing_context: [] };
    const result = await runGeminiReview(
      { ...baseInput, output: "json" },
      "PACKET",
      {
        fetch: async () =>
          jsonResponse({
            candidates: [
              {
                content: { parts: [{ text: JSON.stringify(structured) }] },
                finishReason: "STOP"
              }
            ]
          }),
        sourceEnv: { GEMINI_API_KEY: "gemini-token" },
        now: fakeClock([1, 2])
      }
    );

    expect(result.ok).toBe(true);
    expect(result.structured).toEqual(structured);
    expect(result.review).toContain('"verdict"');
  });
});

function jsonResponse(value: unknown): ReturnType<GeminiFetch> {
  return Promise.resolve({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(value)
  });
}

function fakeClock(values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? values.at(-1) ?? 0;
}

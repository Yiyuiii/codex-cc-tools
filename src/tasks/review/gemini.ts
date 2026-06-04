import { fetch as undiciFetch, ProxyAgent, type Dispatcher } from "undici";

import { redactProviderSecrets, redactProviderSecretsFromUnknown } from "../../core/redaction.js";
import {
  GEMINI_API_KEY_ENV_NAMES,
  GEMINI_BASE_URL,
  resolveGeminiModel
} from "../../providers/gemini.js";
import { CcReviewOutputSchema, type CcReviewInput, type CcReviewOutput } from "./schema.js";

export interface GeminiFetchInit {
  method: "POST";
  headers: Record<string, string>;
  body: string;
  dispatcher?: Dispatcher;
  signal?: AbortSignal;
}

export type GeminiFetch = (
  url: string,
  init: GeminiFetchInit
) => Promise<{
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}>;

export type GeminiReviewConfig =
  | {
      ok: true;
      model: string;
      apiKey: string;
      keySource: string;
      baseUrl: string;
      proxyUrl?: string;
      redactions: string[];
    }
  | {
      ok: false;
      model: string;
      error: string;
      redactions: string[];
    };

export interface ResolveGeminiReviewConfigInput {
  model: string;
  geminiProxyUrl?: string;
  sourceEnv?: Record<string, string | undefined>;
}

export interface RunGeminiReviewDeps {
  fetch?: GeminiFetch;
  now?: () => number;
  sourceEnv?: Record<string, string | undefined>;
  signal?: AbortSignal;
  timeoutMs?: number;
}

const GEMINI_MAX_OUTPUT_TOKENS = 8192;
const DEFAULT_GEMINI_REQUEST_TIMEOUT_MS = 60_000;

export function resolveGeminiReviewConfig(
  input: ResolveGeminiReviewConfigInput
): GeminiReviewConfig {
  const sourceEnv = normalizeEnv(input.sourceEnv ?? process.env);
  const model = resolveGeminiModel(input.model);
  const redactions = GEMINI_API_KEY_ENV_NAMES
    .map((key) => sourceEnv[key]?.trim())
    .filter((value): value is string => Boolean(value));
  const keyEntry = GEMINI_API_KEY_ENV_NAMES
    .map((key) => [key, sourceEnv[key]?.trim()] as const)
    .find(([, value]) => Boolean(value));

  if (!keyEntry?.[1]) {
    return {
      ok: false,
      model,
      redactions,
      error:
        "Gemini provider profile requires GEMINI_API_KEY, GOOGLE_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY in the environment."
    };
  }

  const baseUrl = resolveGeminiBaseUrl(sourceEnv.GEMINI_API_BASE_URL);
  if (!baseUrl.ok) {
    return {
      ok: false,
      model,
      redactions,
      error: baseUrl.error
    };
  }

  const proxyCandidate =
    input.geminiProxyUrl ??
    sourceEnv.HTTPS_PROXY ??
    sourceEnv.https_proxy ??
    sourceEnv.HTTP_PROXY ??
    sourceEnv.http_proxy;
  const proxyUrl = resolveGeminiProxyUrl(proxyCandidate);
  if (!proxyUrl.ok) {
    return {
      ok: false,
      model,
      redactions,
      error: proxyUrl.error
    };
  }

  return {
    ok: true,
    model,
    apiKey: keyEntry[1],
    keySource: keyEntry[0],
    baseUrl: baseUrl.url,
    proxyUrl: proxyUrl.url,
    redactions
  };
}

export async function runGeminiReview(
  input: CcReviewInput,
  packet: string,
  deps: RunGeminiReviewDeps = {}
): Promise<CcReviewOutput> {
  const now = deps.now ?? Date.now;
  const started = now();

  if (deps.signal?.aborted) {
    return CcReviewOutputSchema.parse({
      ok: false,
      task: input.task,
      model: resolveGeminiModel(input.model),
      elapsedMs: Math.max(0, now() - started),
      review: "Gemini review cancelled before the request started.",
      command: ["gemini"],
      diagnostics: ["Review request was already aborted before Gemini started."]
    });
  }

  const config = resolveGeminiReviewConfig({
    model: input.model,
    geminiProxyUrl: input.geminiProxyUrl,
    sourceEnv: deps.sourceEnv
  });
  if (!config.ok) {
    return CcReviewOutputSchema.parse({
      ok: false,
      task: input.task,
      model: config.model,
      elapsedMs: Math.max(0, now() - started),
      review: redactProviderSecrets(config.error, config.redactions),
      command: ["gemini"],
      diagnostics: [redactProviderSecrets(config.error, config.redactions)]
    });
  }

  const url = `${config.baseUrl}/models/${config.model}:generateContent`;
  const body = JSON.stringify(buildGeminiRequestBody(input, packet));
  const requestTimeoutMs = deps.timeoutMs ?? DEFAULT_GEMINI_REQUEST_TIMEOUT_MS;
  const requestAbort = createGeminiRequestAbort(deps.signal, requestTimeoutMs);
  const init: GeminiFetchInit = {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": config.apiKey
    },
    body,
    ...(config.proxyUrl ? { dispatcher: new ProxyAgent(config.proxyUrl) } : {}),
    signal: requestAbort.signal
  };

  let responseText = "";
  let status = 0;
  try {
    const response = await (deps.fetch ?? (undiciFetch as GeminiFetch))(url, init);
    status = response.status;
    responseText = await response.text();
    if (!response.ok) {
      return geminiFailure(input, config.model, started, now, config.redactions, {
        review: `Gemini generateContent failed with HTTP ${response.status}.`,
        diagnostics: [
          geminiRouteDiagnostic(config),
          `Gemini generateContent failed with HTTP ${response.status}.`,
          truncate(redactProviderSecrets(responseText, config.redactions), 4_000)
        ]
      });
    }
  } catch (error) {
    const message = requestAbort.didTimeout()
      ? `Gemini generateContent request timed out after ${requestTimeoutMs}ms.`
      : `Gemini generateContent request failed: ${errorMessage(error)}.`;
    return geminiFailure(input, config.model, started, now, config.redactions, {
      review: message,
      diagnostics: [
        geminiRouteDiagnostic(config),
        message
      ]
    });
  } finally {
    requestAbort.cleanup();
  }

  const parsed = parseGeminiResponse(responseText);
  if (!parsed.ok) {
    return geminiFailure(input, config.model, started, now, config.redactions, {
      review: parsed.error,
      diagnostics: [
        geminiRouteDiagnostic(config),
        `Gemini returned HTTP ${status}, but the response could not be parsed.`,
        parsed.error
      ]
    });
  }

  const structured = input.output === "json" ? parseStructuredReview(parsed.text) : undefined;
  const diagnostics = [
    geminiRouteDiagnostic(config),
    input.tools?.length
      ? "Gemini direct review ignores Claude Code tools because it does not launch a Claude Code subprocess."
      : undefined,
    parsed.finishReason ? `Gemini finishReason: ${parsed.finishReason}.` : undefined,
    parsed.usage ? geminiUsageDiagnostic(parsed.usage) : undefined,
    structured && !structured.ok ? structured.error : undefined
  ].filter((item): item is string => Boolean(item));

  return CcReviewOutputSchema.parse({
    ok: true,
    task: input.task,
    model: config.model,
    elapsedMs: Math.max(0, now() - started),
    review: redactProviderSecrets(parsed.text, config.redactions),
    structured: structured?.ok
      ? redactProviderSecretsFromUnknown(structured.value, config.redactions)
      : undefined,
    command: ["gemini", "generateContent", "--model", config.model],
    diagnostics: diagnostics.map((item) => redactProviderSecrets(item, config.redactions))
  });
}

function buildGeminiRequestBody(input: CcReviewInput, packet: string): Record<string, unknown> {
  return {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: [
              packet,
              input.output === "json"
                ? "Return only valid JSON matching the reviewer output contract."
                : undefined
            ].filter(Boolean).join("\n\n")
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
      ...(input.output === "json" ? { responseMimeType: "application/json" } : {})
    }
  };
}

function geminiFailure(
  input: CcReviewInput,
  model: string,
  started: number,
  now: () => number,
  redactions: string[],
  failure: { review: string; diagnostics: string[] }
): CcReviewOutput {
  return CcReviewOutputSchema.parse({
    ok: false,
    task: input.task,
    model,
    elapsedMs: Math.max(0, now() - started),
    review: redactProviderSecrets(failure.review, redactions),
    command: ["gemini", "generateContent", "--model", model],
    diagnostics: failure.diagnostics.map((item) => redactProviderSecrets(item, redactions))
  });
}

function createGeminiRequestAbort(
  parentSignal: AbortSignal | undefined,
  timeoutMs: number
): { signal: AbortSignal; cleanup: () => void; didTimeout: () => boolean } {
  const controller = new AbortController();
  let timedOut = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let parentAbortHandler: (() => void) | undefined;

  if (parentSignal?.aborted) {
    controller.abort();
  } else if (parentSignal) {
    parentAbortHandler = () => controller.abort();
    parentSignal.addEventListener("abort", parentAbortHandler, { once: true });
  }

  if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
    timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      if (timeout) clearTimeout(timeout);
      if (parentSignal && parentAbortHandler) {
        parentSignal.removeEventListener("abort", parentAbortHandler);
      }
    },
    didTimeout: () => timedOut
  };
}

type BaseUrlResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

function resolveGeminiBaseUrl(override: string | undefined): BaseUrlResult {
  const candidate = override?.trim() || GEMINI_BASE_URL;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" || !url.hostname) {
      return {
        ok: false,
        error: "GEMINI_API_BASE_URL must be an https URL with a non-empty host when provided."
      };
    }
    return { ok: true, url: url.toString().replace(/\/$/, "") };
  } catch {
    return {
      ok: false,
      error: "GEMINI_API_BASE_URL must be a valid https URL with a non-empty host when provided."
    };
  }
}

function resolveGeminiProxyUrl(override: string | undefined): BaseUrlResult {
  const candidate = override?.trim();
  if (!candidate) {
    return { ok: true, url: "" };
  }

  try {
    const url = new URL(candidate);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.hostname) {
      return {
        ok: false,
        error: "Gemini HTTP proxy URL must use http or https and include a non-empty host."
      };
    }
    return { ok: true, url: url.toString().replace(/\/$/, "") };
  } catch {
    return {
      ok: false,
      error: "Gemini HTTP proxy URL must be a valid http or https URL when provided."
    };
  }
}

function normalizeEnv(env: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] => entry[1] !== undefined)
  );
}

function geminiRouteDiagnostic(config: Extract<GeminiReviewConfig, { ok: true }>): string {
  const host = new URL(config.baseUrl).host;
  const proxy = config.proxyUrl ? `; proxy: ${new URL(config.proxyUrl).host}` : "";
  return `Gemini route target: ${host}; token source: ${config.keySource}${proxy}.`;
}

interface ParsedGeminiResponse {
  ok: true;
  text: string;
  finishReason?: string;
  usage?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    totalTokenCount?: number;
  };
}

function parseGeminiResponse(text: string): ParsedGeminiResponse | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "Gemini returned non-JSON response." };
  }

  if (!isRecord(parsed)) {
    return { ok: false, error: "Gemini response was not an object." };
  }

  const candidates = Array.isArray(parsed.candidates) ? parsed.candidates : [];
  const firstCandidate = candidates.find(isRecord);
  const parts = isRecord(firstCandidate?.content) && Array.isArray(firstCandidate.content.parts)
    ? firstCandidate.content.parts
    : [];
  const outputText = parts
    .filter(isRecord)
    .map((part) => part.text)
    .filter((value): value is string => typeof value === "string")
    .join("");

  if (!outputText.trim()) {
    return { ok: false, error: "Gemini returned an empty response." };
  }

  return {
    ok: true,
    text: outputText,
    finishReason: typeof firstCandidate?.finishReason === "string"
      ? firstCandidate.finishReason
      : undefined,
    usage: parseGeminiUsage(parsed.usageMetadata)
  };
}

function parseGeminiUsage(value: unknown): ParsedGeminiResponse["usage"] {
  if (!isRecord(value)) return undefined;
  return compactObject({
    promptTokenCount: numberValue(value.promptTokenCount),
    candidatesTokenCount: numberValue(value.candidatesTokenCount),
    thoughtsTokenCount: numberValue(value.thoughtsTokenCount),
    totalTokenCount: numberValue(value.totalTokenCount)
  });
}

function geminiUsageDiagnostic(usage: NonNullable<ParsedGeminiResponse["usage"]>): string {
  return [
    "Gemini tokens:",
    usage.promptTokenCount === undefined ? undefined : `prompt tokens: ${usage.promptTokenCount};`,
    usage.candidatesTokenCount === undefined
      ? undefined
      : `candidates tokens: ${usage.candidatesTokenCount};`,
    usage.thoughtsTokenCount === undefined ? undefined : `thoughts tokens: ${usage.thoughtsTokenCount};`,
    usage.totalTokenCount === undefined ? undefined : `total tokens: ${usage.totalTokenCount}.`
  ].filter(Boolean).join(" ");
}

function parseStructuredReview(text: string):
  | { ok: true; value: unknown }
  | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return {
      ok: false,
      error: "Gemini responseMimeType requested JSON, but the returned text was not valid JSON."
    };
  }
}

function compactObject<T extends Record<string, unknown>>(value: T): T | undefined {
  const entries = Object.entries(value).filter(([, item]) => item !== undefined);
  if (!entries.length) return undefined;
  return Object.fromEntries(entries) as T;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function truncate(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}[TRUNCATED]`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
